"""
Unit tests for IntentClassifier, AgentSupervisor, and HITL Safety Gate controller.
"""

import pytest

from app.agent.context import AgentSecurityContext
from app.agent.router.classifier import IntentClassifier
from app.agent.router.supervisor import AgentSupervisor
from app.agent.tools.base import ToolDomain
from app.routers.agent_actions import generate_action_token, verify_action_token
from app.schemas.auth import UserRole


def test_intent_classifier_domain_routing():
    # EdTech query
    res_edtech = IntentClassifier.classify(
        "Je souhaite suivre une formation et passer le quiz"
    )
    assert res_edtech.primary_domain == ToolDomain.EDTECH

    # Freelance query
    res_freelance = IntentClassifier.classify(
        "Trouver un projet freelance et soumettre une offre"
    )
    assert res_freelance.primary_domain == ToolDomain.FREELANCE

    # BI query
    res_bi = IntentClassifier.classify(
        "Créer un tableau de bord analytics et exécuter une requête SQL DuckDB"
    )
    assert res_bi.primary_domain == ToolDomain.BI

    # FinTech query
    res_fintech = IntentClassifier.classify(
        "Voir mon solde de wallet DZD et faire un retrait CCP BaridiMob"
    )
    assert res_fintech.primary_domain == ToolDomain.FINTECH

    # Core query
    res_core = IntentClassifier.classify(
        "Consulter mon profil et voir mes tickets de support"
    )
    assert res_core.primary_domain == ToolDomain.CORE


def test_supervisor_tool_planning_and_filtering():
    supervisor = AgentSupervisor()
    context = AgentSecurityContext(
        user_id=10,
        user_role=UserRole.STUDENT,
        session_id="supervisor-test-sess",
    )

    planned_tools = supervisor.plan_tools(
        query="Je veux m'inscrire à une formation en data science",
        context=context,
        max_tools=8,
    )
    assert len(planned_tools) > 0
    # Must include EdTech tools
    domains = {t.domain for t in planned_tools}
    assert ToolDomain.EDTECH in domains


def test_hitl_action_token_verification():
    intent_id = "intent-uuid-456"
    tool_name = "enroll_course"
    user_id = 99
    payload_args = {"course_id": 12, "voucher": "RAMADAN2026"}

    token = generate_action_token(intent_id, tool_name, user_id, args=payload_args)
    assert "." in token
    assert (
        verify_action_token(intent_id, tool_name, user_id, token, args=payload_args)
        is True
    )

    # Tampered user_id
    assert (
        verify_action_token(intent_id, tool_name, 100, token, args=payload_args)
        is False
    )

    # Tampered tool_name
    assert (
        verify_action_token(intent_id, "other_tool", user_id, token, args=payload_args)
        is False
    )

    # Tampered argument payload
    tampered_args = {"course_id": 12, "voucher": "MALICIOUS_DISCOUNT"}
    assert (
        verify_action_token(intent_id, tool_name, user_id, token, args=tampered_args)
        is False
    )

    # Expired token
    expired_token = generate_action_token(
        intent_id, tool_name, user_id, args=payload_args, expires_at=1000
    )
    assert (
        verify_action_token(
            intent_id, tool_name, user_id, expired_token, args=payload_args
        )
        is False
    )


@pytest.mark.asyncio
async def test_hitl_action_replay_returns_409_conflict():
    import json
    from unittest.mock import AsyncMock, MagicMock, patch
    from fastapi import HTTPException
    from app.core.redis import get_redis
    from app.routers.agent_actions import (
        execute_confirmed_action,
        ExecuteConfirmedActionRequest,
    )
    from app.schemas.auth import UserResponse

    user = UserResponse.model_construct(
        id=77,
        email="replay-test@podacium.dz",
        fullName="Replay Tester",
        role=UserRole.STUDENT,
        isActive=True,
    )
    intent_id = "intent-replay-uuid-777"
    tool_name = "enroll_course"
    args = {"course_id": "course-123"}

    redis = await get_redis()
    if redis:
        await redis.set(f"hitl:nonce:{intent_id}", "PENDING", ex=300)
        await redis.setex(
            f"ai_intent:{intent_id}",
            300,
            json.dumps(
                {
                    "id": intent_id,
                    "sessionId": "replay-sess",
                    "intentType": tool_name,
                    "payload": args,
                    "status": "PROPOSED",
                }
            ),
        )

    token = generate_action_token(intent_id, tool_name, user.id, args=args)
    req = ExecuteConfirmedActionRequest(
        intent_id=intent_id,
        token=token,
        idempotency_key="idemp-replay-1",
    )

    mock_intent = MagicMock(
        id=intent_id,
        sessionId="replay-sess",
        intentType=tool_name,
        payload=json.dumps(args),
        status="PROPOSED",
    )

    mock_tool = AsyncMock()
    mock_tool.is_mutating = True
    mock_tool.call.return_value = MagicMock(
        success=True, data={"enrolled": True}, error=None
    )

    with (
        patch(
            "app.core.prisma.prisma.aiactionintent.find_unique",
            new=AsyncMock(return_value=mock_intent),
        ),
        patch("app.core.prisma.prisma.aiactionintent.update", new=AsyncMock()),
        patch(
            "app.routers.agent_actions.tool_registry.get_tool", return_value=mock_tool
        ),
    ):
        # First execution succeeds
        res1 = await execute_confirmed_action(req=req, current_user=user)
        assert res1.success is True

        # Second execution with same token must raise 409 Conflict (GETDEL consumed nonce)
        with pytest.raises(HTTPException) as exc_info:
            await execute_confirmed_action(req=req, current_user=user)
        assert exc_info.value.status_code == 409
        assert "already been executed or has expired" in exc_info.value.detail


@pytest.mark.asyncio
async def test_hitl_approval_card_parameter_diff():
    """Verify HITL approval cards correctly populate parameter_diff with proposed and previous values."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.agent.tools.base import BaseTool, ToolResult
    from app.routers.agent_actions import chat_with_agent, AgentChatRequest
    from app.schemas.auth import UserResponse

    from pydantic import BaseModel

    class ContractArgs(BaseModel):
        contract_id: str
        payout_dzd: int

    class SensitiveContractTool(BaseTool):
        name = "update_contract_terms"
        description = "Update escrow contract payout amount"
        domain = ToolDomain.FREELANCE
        is_mutating = True
        requires_hitl = True
        args_schema = ContractArgs

        async def execute(self, args, context):
            return ToolResult(success=True, data={"updated": True})

        async def simulate(self, args, context):
            return ToolResult(
                success=True,
                data={
                    "preview": "Will change contract payout from 50000 DZD to 75000 DZD",
                    "previous": {"contract_id": "c-101", "payout_dzd": 50000},
                },
            )

    test_tool = SensitiveContractTool()
    user = UserResponse.model_construct(
        id=88,
        email="hitl-diff@podacium.dz",
        fullName="Diff Tester",
        role=UserRole.BUSINESS,
        isActive=True,
    )

    req = AgentChatRequest(
        message="Mettre à jour le contrat",
        session_id="diff-sess-123",
        locale="fr",
    )

    from app.agent.schemas import ChatMessage, Role, ToolCall, FunctionCall

    assistant_msg = ChatMessage(
        role=Role.ASSISTANT,
        content="I will prepare the contract update for your review.",
        tool_calls=[
            ToolCall(
                id="tc_1",
                function=FunctionCall(
                    name="update_contract_terms",
                    arguments={"contract_id": "c-101", "payout_dzd": 75000},
                ),
            )
        ],
    )
    mock_llm_response = MagicMock(
        message=assistant_msg,
        model="mock-model",
    )

    with (
        patch(
            "app.routers.agent_actions.tool_registry.get_tool", return_value=test_tool
        ),
        patch(
            "app.agent.providers.factory.LLMProviderFactory.get_provider"
        ) as mock_provider_factory,
        patch(
            "app.agent.router.supervisor.AgentSupervisor.plan_tools",
            return_value=[test_tool],
        ),
        patch(
            "app.routers.agent_actions.session_service.acquire_session_lock",
            new=AsyncMock(return_value="lock_token_123"),
        ),
        patch(
            "app.routers.agent_actions.session_service.release_session_lock",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "app.routers.agent_actions.session_service.get_or_create_session",
            new=AsyncMock(return_value=MagicMock(id="diff-sess-123")),
        ),
        patch(
            "app.routers.agent_actions.session_service.get_active_context",
            new=AsyncMock(return_value={"messages": [], "summaryState": None}),
        ),
        patch("app.routers.agent_actions.session_service.append_turn", new=AsyncMock()),
        patch(
            "app.routers.agent_actions.session_service.compact_context_if_needed",
            new=AsyncMock(),
        ),
        patch(
            "app.routers.agent_actions.get_redis",
            new=AsyncMock(return_value=AsyncMock()),
        ),
        patch("app.core.redis.get_redis", new=AsyncMock(return_value=AsyncMock())),
    ):
        mock_provider = AsyncMock()
        mock_provider.complete = AsyncMock(return_value=mock_llm_response)
        mock_provider.model_name = "test-model"
        mock_provider_factory.return_value = mock_provider

        response = await chat_with_agent(req=req, current_user=user)
        assert response.action_confirmation is not None

        card = response.action_confirmation
        assert card["widgetType"] == "action_confirmation_card"
        assert card["tool_name"] == "update_contract_terms"
        assert card["is_mutating"] is True
        assert card["risk_score"] == 0.85

        # Verify parameter diff
        diff = card["parameter_diff"]
        assert "contract_id" in diff
        assert diff["contract_id"]["proposed"] == "c-101"
        assert diff["contract_id"]["previous"] == "c-101"

        assert "payout_dzd" in diff
        assert diff["payout_dzd"]["proposed"] == 75000
        assert diff["payout_dzd"]["previous"] == 50000

        # Verify cryptographic token is valid for proposed parameters
        assert (
            verify_action_token(
                intent_id=card["intent_id"],
                tool_name="update_contract_terms",
                user_id=user.id,
                token=card["token"],
                args=card["parameters"],
            )
            is True
        )


@pytest.mark.asyncio
async def test_hitl_action_replay_lua_getdel_fallback():
    """Verify Lua script GETDEL fallback when redis.getdel raises an exception."""
    import json
    from unittest.mock import AsyncMock, MagicMock, patch
    from fastapi import HTTPException
    from app.routers.agent_actions import (
        execute_confirmed_action,
        ExecuteConfirmedActionRequest,
    )
    from app.schemas.auth import UserResponse

    user = UserResponse.model_construct(
        id=78,
        email="lua-test@podacium.dz",
        fullName="Lua Tester",
        role=UserRole.STUDENT,
        isActive=True,
    )
    intent_id = "intent-lua-uuid-888"
    tool_name = "enroll_course"
    args = {"course_id": "course-lua"}

    mock_redis = AsyncMock()
    # Simulate redis server without native GETDEL support
    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.getdel.side_effect = Exception("ERR unknown command 'GETDEL'")

    # Mock eval to emulate atomic GETDEL lua script behavior
    eval_call_count = 0

    async def mock_eval(script, numkeys, key):
        nonlocal eval_call_count
        eval_call_count += 1
        if eval_call_count == 1:
            return "PENDING"
        return None

    mock_redis.eval = mock_eval

    token = generate_action_token(intent_id, tool_name, user.id, args=args)
    req = ExecuteConfirmedActionRequest(
        intent_id=intent_id,
        token=token,
        idempotency_key="idemp-lua-1",
    )

    mock_intent = MagicMock(
        id=intent_id,
        sessionId="lua-sess",
        intentType=tool_name,
        payload=json.dumps(args),
        status="PROPOSED",
    )

    mock_tool = AsyncMock()
    mock_tool.is_mutating = True
    mock_tool.call.return_value = MagicMock(
        success=True, data={"enrolled": True}, error=None
    )

    with (
        patch("app.routers.agent_actions.get_redis", return_value=mock_redis),
        patch(
            "app.core.prisma.prisma.aiactionintent.find_unique",
            new=AsyncMock(return_value=mock_intent),
        ),
        patch("app.core.prisma.prisma.aiactionintent.update", new=AsyncMock()),
        patch(
            "app.routers.agent_actions.tool_registry.get_tool", return_value=mock_tool
        ),
    ):
        # 1st call: Lua GETDEL returns "PENDING" -> Success
        res1 = await execute_confirmed_action(req=req, current_user=user)
        assert res1.success is True

        # 2nd call: Lua GETDEL returns None -> 409 Conflict
        with pytest.raises(HTTPException) as exc_info:
            await execute_confirmed_action(req=req, current_user=user)
        assert exc_info.value.status_code == 409
        assert "already been executed or has expired" in exc_info.value.detail
