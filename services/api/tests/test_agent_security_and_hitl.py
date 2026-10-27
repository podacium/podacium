"""
Unit and Integration Tests for Agent Zero-Day Security & HITL Cryptographic Integrity.
Covers:
1. Multi-Tenant IDOR checks across BI tools (datasets & dashboards).
2. Path traversal rejection in DLG and OCR tools.
3. Strict HMAC parameter tampering protection (no empty-args fallback).
4. PII Detokenization in execute_confirmed_action.
5. Gemini API key header validation (no ?key= query parameter).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import httpx

from app.agent.context import AgentSecurityContext
from app.agent.tools.bi.query import PreviewDatasetSchemaTool, QueryDatasetSqlTool
from app.agent.tools.bi.dashboards import GetDashboardWidgetsTool
from app.agent.tools.bi.analytics import GetDatasetKpisTool
from app.agent.tools.bi.dlg_parser import ParseDlgAccountingFileTool
from app.agent.tools.fintech.ocr import OcrReceiptScanTool
from app.agent.providers.gemini import GeminiRESTProvider
from app.agent.schemas import ChatCompletionRequest, ChatMessage, Role
from app.routers.agent_actions import (
    generate_action_token,
    verify_action_token,
    execute_confirmed_action,
    ExecuteConfirmedActionRequest,
)
from app.schemas.auth import UserResponse, UserRole


@pytest.fixture
def mock_dataset_org():
    return MagicMock(
        id=101,
        organizationId=50,
        userId=1,
        name="Org Dataset",
        rowCount=100,
        columnCount=5,
        format="csv",
        previewRows=[{"col1": "val1"}],
        schema_={"col1": "string"},
        columns={"col1": "string"},
        filePath=None,
        deletedAt=None,
        qualityScore=0.95,
    )


@pytest.fixture
def mock_dataset_user():
    return MagicMock(
        id=202,
        organizationId=None,
        userId=10,
        name="User Dataset",
        rowCount=50,
        columnCount=3,
        format="csv",
        previewRows=[{"col1": "val1"}],
        schema_={"col1": "string"},
        columns={"col1": "string"},
        filePath=None,
        deletedAt=None,
        qualityScore=0.90,
    )


@pytest.fixture
def mock_dashboard_org():
    return MagicMock(
        id=303,
        organizationId=50,
        ownerId=1,
        title="Org Dashboard",
        deletedAt=None,
    )


@pytest.fixture
def mock_dashboard_user():
    return MagicMock(
        id=404,
        organizationId=None,
        ownerId=10,
        title="User Dashboard",
        deletedAt=None,
    )


# ============================================================================
# 1. Multi-Tenant IDOR Fix Tests
# ============================================================================


@pytest.mark.asyncio
async def test_preview_dataset_schema_idor(mock_dataset_org, mock_dataset_user):
    tool = PreviewDatasetSchemaTool()

    with patch(
        "app.core.prisma.prisma.dataset.find_unique", new=AsyncMock()
    ) as mock_find:
        # Scenario A: Org-owned dataset accessed by different org -> Blocked
        mock_find.return_value = mock_dataset_org
        ctx_diff_org = AgentSecurityContext(
            user_id=99,
            organization_id=999,
            user_role=UserRole.BUSINESS,
            session_id="test-session-1",
        )
        res = await tool.execute(tool.args_schema(dataset_id=101), ctx_diff_org)
        assert res.success is False
        assert "Unauthorized" in res.error

        # Scenario B: Org-owned dataset accessed with no org_id -> Blocked
        ctx_no_org = AgentSecurityContext(
            user_id=1,
            organization_id=None,
            user_role=UserRole.STUDENT,
            session_id="test-session-2",
        )
        res = await tool.execute(tool.args_schema(dataset_id=101), ctx_no_org)
        assert res.success is False
        assert "Unauthorized" in res.error

        # Scenario C: Org-owned dataset accessed by same org -> Allowed
        ctx_same_org = AgentSecurityContext(
            user_id=99,
            organization_id=50,
            user_role=UserRole.BUSINESS,
            session_id="test-session-3",
        )
        res = await tool.execute(tool.args_schema(dataset_id=101), ctx_same_org)
        assert res.success is True

        # Scenario D: Org-owned dataset accessed by ADMIN -> Allowed
        ctx_admin = AgentSecurityContext(
            user_id=999,
            organization_id=999,
            user_role=UserRole.ADMIN,
            session_id="test-session-4",
        )
        res = await tool.execute(tool.args_schema(dataset_id=101), ctx_admin)
        assert res.success is True

        # Scenario E: User-owned dataset accessed by different user -> Blocked
        mock_find.return_value = mock_dataset_user
        ctx_diff_user = AgentSecurityContext(
            user_id=20,
            organization_id=None,
            user_role=UserRole.FREELANCER,
            session_id="test-session-5",
        )
        res = await tool.execute(tool.args_schema(dataset_id=202), ctx_diff_user)
        assert res.success is False
        assert "Unauthorized" in res.error

        # Scenario F: User-owned dataset accessed by owner -> Allowed
        ctx_owner = AgentSecurityContext(
            user_id=10,
            organization_id=None,
            user_role=UserRole.FREELANCER,
            session_id="test-session-6",
        )
        res = await tool.execute(tool.args_schema(dataset_id=202), ctx_owner)
        assert res.success is True


@pytest.mark.asyncio
async def test_query_dataset_sql_idor(mock_dataset_org, mock_dataset_user):
    tool = QueryDatasetSqlTool()

    with patch(
        "app.core.prisma.prisma.dataset.find_unique", new=AsyncMock()
    ) as mock_find:
        # Cross-org access blocked
        mock_find.return_value = mock_dataset_org
        ctx_diff_org = AgentSecurityContext(
            user_id=2,
            organization_id=999,
            user_role=UserRole.BUSINESS,
            session_id="test-session-7",
        )
        res = await tool.execute(
            tool.args_schema(dataset_id=101, sql_query="SELECT * FROM dataset"),
            ctx_diff_org,
        )
        assert res.success is False
        assert "Unauthorized" in res.error

        # Cross-user access blocked
        mock_find.return_value = mock_dataset_user
        ctx_diff_user = AgentSecurityContext(
            user_id=20,
            organization_id=None,
            user_role=UserRole.STUDENT,
            session_id="test-session-8",
        )
        res = await tool.execute(
            tool.args_schema(dataset_id=202, sql_query="SELECT * FROM dataset"),
            ctx_diff_user,
        )
        assert res.success is False
        assert "Unauthorized" in res.error


@pytest.mark.asyncio
async def test_get_dashboard_widgets_idor(mock_dashboard_org, mock_dashboard_user):
    tool = GetDashboardWidgetsTool()

    with (
        patch(
            "app.core.prisma.prisma.dashboard.find_unique", new=AsyncMock()
        ) as mock_find_dash,
        patch(
            "app.core.prisma.prisma.widget.find_many", new=AsyncMock(return_value=[])
        ),
    ):
        # Org dashboard cross-tenant check
        mock_find_dash.return_value = mock_dashboard_org
        ctx_diff_org = AgentSecurityContext(
            user_id=1,
            organization_id=999,
            user_role=UserRole.BUSINESS,
            session_id="test-session-9",
        )
        res = await tool.execute(tool.args_schema(dashboard_id=303), ctx_diff_org)
        assert res.success is False
        assert "Unauthorized" in res.error

        # Org dashboard matching tenant
        ctx_same_org = AgentSecurityContext(
            user_id=1,
            organization_id=50,
            user_role=UserRole.BUSINESS,
            session_id="test-session-10",
        )
        res = await tool.execute(tool.args_schema(dashboard_id=303), ctx_same_org)
        assert res.success is True

        # User dashboard cross-user check
        mock_find_dash.return_value = mock_dashboard_user
        ctx_diff_user = AgentSecurityContext(
            user_id=20,
            organization_id=None,
            user_role=UserRole.STUDENT,
            session_id="test-session-11",
        )
        res = await tool.execute(tool.args_schema(dashboard_id=404), ctx_diff_user)
        assert res.success is False
        assert "Unauthorized" in res.error

        # User dashboard owner access
        ctx_owner = AgentSecurityContext(
            user_id=10,
            organization_id=None,
            user_role=UserRole.STUDENT,
            session_id="test-session-12",
        )
        res = await tool.execute(tool.args_schema(dashboard_id=404), ctx_owner)
        assert res.success is True


@pytest.mark.asyncio
async def test_get_dataset_kpis_idor(mock_dataset_org, mock_dataset_user):
    tool = GetDatasetKpisTool()

    with patch(
        "app.core.prisma.prisma.dataset.find_unique", new=AsyncMock()
    ) as mock_find:
        mock_find.return_value = mock_dataset_org
        ctx_diff_org = AgentSecurityContext(
            user_id=2,
            organization_id=999,
            user_role=UserRole.BUSINESS,
            session_id="test-session-13",
        )
        res = await tool.execute(tool.args_schema(dataset_id=101), ctx_diff_org)
        assert res.success is False
        assert "Unauthorized" in res.error

        mock_find.return_value = mock_dataset_user
        ctx_diff_user = AgentSecurityContext(
            user_id=20,
            organization_id=None,
            user_role=UserRole.STUDENT,
            session_id="test-session-14",
        )
        res = await tool.execute(tool.args_schema(dataset_id=202), ctx_diff_user)
        assert res.success is False
        assert "Unauthorized" in res.error


# ============================================================================
# 2. Path Traversal Elimination Tests
# ============================================================================


@pytest.mark.asyncio
async def test_dlg_parser_path_traversal_rejection():
    tool = ParseDlgAccountingFileTool()
    ctx = AgentSecurityContext(
        user_id=1,
        user_role=UserRole.ADMIN,
        session_id="test-session-15",
    )

    # Relative traversal
    res = await tool.execute(
        tool.args_schema(file_path="../../etc/passwd"),
        ctx,
    )
    assert res.success is False
    assert "traversal" in res.error.lower() or "not read file" in res.error.lower()

    # System directory traversal
    res_sys = await tool.execute(
        tool.args_schema(file_path="/etc/passwd"),
        ctx,
    )
    assert res_sys.success is False
    assert (
        "traversal" in res_sys.error.lower() or "not read file" in res_sys.error.lower()
    )


@pytest.mark.asyncio
async def test_ocr_receipt_scan_path_traversal_rejection():
    tool = OcrReceiptScanTool()
    ctx = AgentSecurityContext(
        user_id=1,
        user_role=UserRole.STUDENT,
        session_id="test-session-16",
    )

    # Direct system path traversal
    res = await tool.execute(
        tool.args_schema(receipt_image_path="/etc/passwd"),
        ctx,
    )
    assert res.success is False
    assert "traversal" in res.error.lower() or "outside allowed" in res.error.lower()

    # Relative path traversal
    res_rel = await tool.execute(
        tool.args_schema(receipt_image_path="../../etc/shadow"),
        ctx,
    )
    assert res_rel.success is False
    assert (
        "traversal" in res_rel.error.lower()
        or "outside allowed" in res_rel.error.lower()
    )


# ============================================================================
# 3. Cryptographic HITL Token Hardening Tests
# ============================================================================


def test_action_token_tamper_proofing_no_empty_args_fallback():
    intent_id = "intent-uuid-12345"
    tool_name = "transfer_payout"
    user_id = 42
    original_args = {"amount": 50000, "destination": "00799999000123456740"}

    # Generate token bound to original args
    token = generate_action_token(
        intent_id=intent_id,
        tool_name=tool_name,
        user_id=user_id,
        args=original_args,
    )

    # 1. Exact match -> Succeeds
    assert (
        verify_action_token(
            intent_id=intent_id,
            tool_name=tool_name,
            user_id=user_id,
            token=token,
            args=original_args,
        )
        is True
    )

    # 2. Tampered arguments payload -> MUST FAIL
    tampered_args = {"amount": 500000, "destination": "00799999000123456740"}
    assert (
        verify_action_token(
            intent_id=intent_id,
            tool_name=tool_name,
            user_id=user_id,
            token=token,
            args=tampered_args,
        )
        is False
    )

    # 3. Empty args supplied to token signed with args -> MUST FAIL (no fallback!)
    assert (
        verify_action_token(
            intent_id=intent_id,
            tool_name=tool_name,
            user_id=user_id,
            token=token,
            args={},
        )
        is False
    )

    assert (
        verify_action_token(
            intent_id=intent_id,
            tool_name=tool_name,
            user_id=user_id,
            token=token,
            args=None,
        )
        is False
    )


@pytest.mark.asyncio
async def test_execute_confirmed_action_detokenization():
    user = UserResponse.model_construct(
        id=42,
        email="test@podacium.dz",
        fullName="Test User",
        role=UserRole.ADMIN,
        isActive=True,
    )

    intent_id = "intent-detok-1"
    session_id = "sess-detok-1"
    raw_nif = "123456789012345"
    token_nif = "{{DZ_NIF_abc123}}"

    token = generate_action_token(
        intent_id=intent_id,
        tool_name="calculate_tax_deductions",
        user_id=user.id,
        args={"expense_amount_dzd": 50000, "nif": token_nif},
    )

    mock_intent = MagicMock(
        id=intent_id,
        sessionId=session_id,
        intentType="calculate_tax_deductions",
        payload=json.dumps({"expense_amount_dzd": 50000, "nif": token_nif}),
        status="PROPOSED",
    )

    req = ExecuteConfirmedActionRequest(
        intent_id=intent_id,
        token=token,
        idempotency_key="idemp-key-1",
    )

    with (
        patch(
            "app.core.prisma.prisma.aiactionintent.find_unique",
            new=AsyncMock(return_value=mock_intent),
        ),
        patch("app.core.prisma.prisma.aiactionintent.update", new=AsyncMock()),
        patch(
            "app.agent.security.pii_cleaner.AlgerianComplianceEngine.post_llm_detokenize",
            new=AsyncMock(return_value={"expense_amount_dzd": 50000, "nif": raw_nif}),
        ) as mock_detok,
    ):
        res = await execute_confirmed_action(req=req, current_user=user)
        assert res.success is True
        mock_detok.assert_called_once()


# ============================================================================
# 4. Gemini Provider Header Security Tests
# ============================================================================


@pytest.mark.asyncio
async def test_gemini_provider_uses_header_not_query_param():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Reponse securisee"}],
                    "role": "model",
                },
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 5,
            "candidatesTokenCount": 5,
            "totalTokenCount": 10,
        },
    }

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.return_value = mock_response

    provider = GeminiRESTProvider(
        model_name="gemini-2.5-flash",
        api_key="secret-api-key-test",
        client=mock_client,
    )

    req = ChatCompletionRequest(
        messages=[ChatMessage(role=Role.USER, content="Test")],
    )

    await provider.complete(req)

    # Verify call args
    call_args = mock_client.post.call_args
    url = call_args[0][0]
    headers = call_args[1].get("headers", {})

    # 1. URL must NOT contain API key
    assert "?key=" not in url
    assert "secret-api-key-test" not in url

    # 2. Headers must contain x-goog-api-key
    assert headers.get("x-goog-api-key") == "secret-api-key-test"
