"""
Integration and End-to-End tests for Agentic Chat and HITL safety gate execution.
Tests POST /api/v1/agent/chat, POST /api/v1/agent/chat/stream, and execute-confirmed-action.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.agent.schemas import (
    ChatCompletionResponse,
    ChatMessage,
    Role,
    ToolCall,
    FunctionCall,
)
from app.generated.prisma.enums import AiIntentStatus
from app.routers.agent_actions import (
    _run_agent_turn,
    _stream_agent_turn,
    ExecuteConfirmedActionRequest,
    execute_confirmed_action,
)
from app.schemas.auth import UserResponse, UserRole


@pytest.fixture
def dummy_user():
    return UserResponse.model_construct(
        id=42,
        email="student@podacium.dz",
        fullName="Amine Student",
        role=UserRole.STUDENT,
        isActive=True,
    )


@pytest.fixture(autouse=True)
def setup_mock_prisma():
    from app.core.prisma import prisma

    mock_session = MagicMock(
        id="test-session-id",
        userId=42,
        agentType="GENERAL_ASSISTANT",
        summaryState=None,
        compactedUntilSequence=0,
        contextTokens=0,
        deletedAt=None,
    )
    prisma.aisession.find_unique = AsyncMock(return_value=mock_session)
    prisma.aisession.create = AsyncMock(return_value=mock_session)
    prisma.aisession.update = AsyncMock(return_value=mock_session)

    mock_msg = MagicMock(id=1, sequence=1, tokenCount=10)
    prisma.aimessage.find_first = AsyncMock(return_value=mock_msg)
    prisma.aimessage.find_many = AsyncMock(return_value=[])
    prisma.aimessage.create = AsyncMock(return_value=mock_msg)
    prisma.aimessage.update = AsyncMock(return_value=mock_msg)

    mock_intent = MagicMock(
        id="test-intent-id",
        sessionId="test-session-id",
        intentType="enroll_course",
        payload=json.dumps({"course_id": "course-123", "payment_method": "FREE"}),
        status=AiIntentStatus.PROPOSED,
        riskScore=0.85,
    )
    prisma.aiactionintent.find_unique = AsyncMock(return_value=mock_intent)
    prisma.aiactionintent.create = AsyncMock(return_value=mock_intent)
    prisma.aiactionintent.update = AsyncMock(return_value=mock_intent)

    # Education models
    mock_module = MagicMock(id="course-123", title="Python 101", price=0)
    prisma.module.find_first = AsyncMock(return_value=mock_module)
    prisma.module.find_unique = AsyncMock(return_value=mock_module)
    prisma.module.find_many = AsyncMock(return_value=[mock_module])
    prisma.enrollment.find_first = AsyncMock(return_value=None)
    mock_enrollment = MagicMock(id=1, userId=42, moduleId="course-123", progress=0.0)
    prisma.enrollment.create = AsyncMock(return_value=mock_enrollment)
    prisma.enrollment.delete = AsyncMock(return_value=mock_enrollment)

    from app.services.education_service import education_service

    education_service.enroll_user = AsyncMock(return_value=True)


@pytest.mark.asyncio
async def test_agent_chat_offline_fallback(dummy_user):
    """When no LLM provider is available, gracefully falls back to offline knowledge."""
    with patch(
        "app.routers.agent_actions.LLMProviderFactory.get_provider",
        side_effect=Exception("No API Key"),
    ):
        res = await _run_agent_turn(
            message="Comment payer avec EDAHABIA ?",
            locale="fr",
            session_id=None,
            current_user=dummy_user,
        )
        assert res["session_id"] is not None
        assert res["domain"] in ("FINTECH", "BILLING", "CORE", "EDTECH")
        assert "EDAHABIA" in res["reply"] or "assistant" in res["reply"].lower()
        assert res["engine"] == "offline_knowledge"


@pytest.mark.asyncio
async def test_agent_chat_text_response(dummy_user):
    """When LLM provider returns text response directly."""
    mock_provider = AsyncMock()
    mock_provider.model_name = "test-mock-llm"
    mock_provider.complete.return_value = ChatCompletionResponse(
        id="resp-1",
        model="test-mock-llm",
        message=ChatMessage(
            role=Role.ASSISTANT,
            content="Voici les informations demandées sur Podacium.",
        ),
    )

    with patch(
        "app.routers.agent_actions.LLMProviderFactory.get_provider",
        return_value=mock_provider,
    ):
        res = await _run_agent_turn(
            message="Quelles sont les opportunités sur la plateforme ?",
            locale="fr",
            session_id="test-session-id",
            current_user=dummy_user,
        )
        assert res["session_id"] == "test-session-id"
        assert res["reply"] == "Voici les informations demandées sur Podacium."
        assert res["engine"] == "agent_supervisor"
        assert res["tools_executed"] == []


@pytest.mark.asyncio
async def test_agent_chat_autonomous_tool_execution(dummy_user):
    """When LLM requests an autonomous tool (search_courses), executes tool and returns final response."""
    mock_provider = AsyncMock()
    mock_provider.model_name = "test-mock-llm"

    # Turn 1: tool call for search_courses
    tool_call = ToolCall(
        id="tc-1",
        function=FunctionCall(name="search_courses", arguments={"query": "Python"}),
    )
    resp_turn1 = ChatCompletionResponse(
        id="resp-t1",
        model="test-mock-llm",
        message=ChatMessage(role=Role.ASSISTANT, tool_calls=[tool_call]),
        finish_reason="tool_calls",
    )
    # Turn 2: final synthesized answer
    resp_turn2 = ChatCompletionResponse(
        id="resp-t2",
        model="test-mock-llm",
        message=ChatMessage(
            role=Role.ASSISTANT,
            content="J'ai trouvé plusieurs formations Python sur Podacium.",
        ),
    )
    mock_provider.complete.side_effect = [resp_turn1, resp_turn2]

    with patch(
        "app.routers.agent_actions.LLMProviderFactory.get_provider",
        return_value=mock_provider,
    ):
        res = await _run_agent_turn(
            message="Cherche des cours sur Python",
            locale="fr",
            session_id="test-session-id",
            current_user=dummy_user,
        )
        assert "search_courses" in res["tools_executed"]
        assert "Python" in res["reply"]
        assert res["action_confirmation"] is None


@pytest.mark.asyncio
async def test_agent_chat_hitl_action_proposal_and_execution(dummy_user):
    """
    When LLM requests a tool requiring HITL (enroll_course):
    1. Chat loop creates AiActionIntent and emits action_confirmation_card.
    2. Calling execute_confirmed_action verifies HMAC token and executes the action.
    """
    mock_provider = AsyncMock()
    mock_provider.model_name = "test-mock-llm"

    # LLM requests enroll_course (HITL tool)
    tool_call = ToolCall(
        id="tc-hitl-1",
        function=FunctionCall(
            name="enroll_course",
            arguments={"course_id": "course-123", "payment_method": "FREE"},
        ),
    )
    resp_hitl = ChatCompletionResponse(
        id="resp-hitl",
        model="test-mock-llm",
        message=ChatMessage(role=Role.ASSISTANT, tool_calls=[tool_call]),
        finish_reason="tool_calls",
    )
    mock_provider.complete.return_value = resp_hitl

    with patch(
        "app.routers.agent_actions.LLMProviderFactory.get_provider",
        return_value=mock_provider,
    ):
        res = await _run_agent_turn(
            message="Inscris-moi au cours course-123",
            locale="fr",
            session_id="test-session-id",
            current_user=dummy_user,
        )

        assert res["action_confirmation"] is not None
        card = res["action_confirmation"]
        assert card["widgetType"] == "action_confirmation_card"
        assert card["tool_name"] == "enroll_course"
        assert card["token"] is not None

        # Now simulate user clicking [Confirm Action] in frontend
        # Calling execute_confirmed_action
        confirm_req = ExecuteConfirmedActionRequest(
            intent_id=card["intent_id"],
            token=card["token"],
            idempotency_key="idem-key-999",
        )

        confirm_res = await execute_confirmed_action(
            req=confirm_req,
            current_user=dummy_user,
        )
        assert confirm_res.success is True
        assert confirm_res.status == "EXECUTED"


@pytest.mark.asyncio
async def test_agent_chat_streaming_chunks(dummy_user):
    """Tests Server-Sent Events (SSE) streaming output."""
    mock_provider = AsyncMock()
    mock_provider.model_name = "test-mock-llm"
    mock_provider.complete.return_value = ChatCompletionResponse(
        id="resp-stream",
        model="test-mock-llm",
        message=ChatMessage(
            role=Role.ASSISTANT,
            content="Bonjour de Podacium.",
        ),
    )

    with patch(
        "app.routers.agent_actions.LLMProviderFactory.get_provider",
        return_value=mock_provider,
    ):
        chunks = []
        async for chunk in _stream_agent_turn(
            message="Bonjour",
            locale="fr",
            session_id="test-session-id",
            current_user=dummy_user,
        ):
            chunks.append(chunk)

        full_stream = "".join(chunks)
        assert "data: " in full_stream
        assert "Bonjour" in full_stream
        assert '"done": true' in full_stream
