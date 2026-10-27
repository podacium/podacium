"""
Comprehensive unit tests for the Podacium 60+ Tool Registry, Sandboxing,
Batch Operations, Simulation Mode, and Critical Domain Tools.
"""

import pytest
from app.agent.tools.base import BaseTool, ToolDomain
from app.agent.tools.registry import tool_registry
from app.agent.tools import ALL_TOOLS, ALL_40_TOOLS
from app.agent.context import AgentSecurityContext
from app.schemas.auth import UserRole


def test_registry_contains_all_tools():
    all_tools = tool_registry.list_tools()
    assert len(all_tools) >= 60, f"Expected at least 60 tools, got {len(all_tools)}"
    assert len(ALL_TOOLS) >= 60
    assert len(ALL_40_TOOLS) >= 60


def test_domain_distribution():
    # At least 12 tools per domain across all 5 domains (total >= 60)
    edtech_tools = tool_registry.get_domain_tools(ToolDomain.EDTECH)
    freelance_tools = tool_registry.get_domain_tools(ToolDomain.FREELANCE)
    bi_tools = tool_registry.get_domain_tools(ToolDomain.BI)
    fintech_tools = tool_registry.get_domain_tools(ToolDomain.FINTECH)
    core_tools = tool_registry.get_domain_tools(ToolDomain.CORE)

    assert (
        len(edtech_tools) >= 12
    ), f"Expected >= 12 EdTech tools, got {len(edtech_tools)}"
    assert (
        len(freelance_tools) >= 12
    ), f"Expected >= 12 Freelance tools, got {len(freelance_tools)}"
    assert len(bi_tools) >= 12, f"Expected >= 12 BI tools, got {len(bi_tools)}"
    assert (
        len(fintech_tools) >= 12
    ), f"Expected >= 12 FinTech tools, got {len(fintech_tools)}"
    assert len(core_tools) >= 12, f"Expected >= 12 Core tools, got {len(core_tools)}"


def test_rbac_filtering():
    # Student role check
    student_tools = tool_registry.get_domain_tools(
        ToolDomain.CORE, role=UserRole.STUDENT
    )
    student_tool_names = [t.name for t in student_tools]
    assert "send_corporate_mail" not in student_tool_names
    assert "get_my_profile" in student_tool_names

    # Admin role check
    admin_tools = tool_registry.get_domain_tools(ToolDomain.CORE, role=UserRole.ADMIN)
    admin_tool_names = [t.name for t in admin_tools]
    assert "send_corporate_mail" in admin_tool_names
    assert "get_my_profile" in admin_tool_names

    # Business role equivalence check
    from pydantic import BaseModel

    class DummyArgs(BaseModel):
        val: int = 1

    class MockClientTool(BaseTool):
        name = "mock_client_tool"
        description = "Mock client tool"
        domain = ToolDomain.CORE
        access_roles = ["CLIENT", "ORGANIZATION_ADMIN"]
        args_schema = DummyArgs

        async def execute(self, args, context):
            return None

    mock_tool = MockClientTool()
    assert mock_tool.is_accessible_by(UserRole.BUSINESS) is True
    assert mock_tool.is_accessible_by(UserRole.STUDENT) is False


def test_dual_schema_generation():
    tool = tool_registry.get_tool("search_courses")
    assert tool is not None

    # OpenAI Schema
    openai_schema = tool.get_openai_schema()
    assert openai_schema.name == "search_courses"
    assert "properties" in openai_schema.parameters

    # Gemini Schema
    gemini_schema = tool.get_gemini_schema()
    assert gemini_schema["name"] == "search_courses"
    params = gemini_schema["parameters"]
    assert "$schema" not in params
    assert params.get("type") in ("OBJECT", "object")


def test_tool_pydantic_validation():
    tool = tool_registry.get_tool("calculate_tax_deductions")
    assert tool is not None

    # Valid args
    valid_args = tool.args_schema(expense_amount_dzd=500000, corporate_ibs_rate=0.26)
    assert valid_args.expense_amount_dzd == 500000

    # Invalid negative amount should raise validation error
    with pytest.raises(Exception):
        tool.args_schema(expense_amount_dzd=-100)


@pytest.mark.asyncio
async def test_claim_check_sandbox_and_cleanup(tmp_path, monkeypatch):
    from app.agent.tools.claim_check import ClaimCheckManager
    import pyarrow as pa
    import pyarrow.parquet as pq
    import time
    import os

    test_dir = str(tmp_path / "claims")
    os.makedirs(test_dir, exist_ok=True)
    monkeypatch.setattr("app.agent.tools.claim_check.STORAGE_CLAIMS_DIR", test_dir)

    old_file = os.path.join(test_dir, "old.parquet")
    new_file = os.path.join(test_dir, "new.parquet")
    t = pa.Table.from_pydict({"x": [1, 2]})
    pq.write_table(t, old_file)
    pq.write_table(t, new_file)

    past_time = time.time() - 10000
    os.utime(old_file, (past_time, past_time))

    pruned = ClaimCheckManager.cleanup_expired_claims(max_age_seconds=7200)
    assert pruned == 1
    assert not os.path.exists(old_file)
    assert os.path.exists(new_file)

    res = await ClaimCheckManager.query_claim_dataset(
        urn="urn:podacium:claim-check:test:new",
        sql_expression="SELECT SUM(x) as total FROM dataset",
    )
    assert res == [{"total": 3}]


@pytest.mark.asyncio
async def test_payout_withdrawal_rip_validation():
    from app.agent.tools.fintech.payout import (
        RequestPayoutWithdrawalTool,
        RequestPayoutWithdrawalArgs,
    )

    tool = RequestPayoutWithdrawalTool()
    ctx = AgentSecurityContext(
        user_id=1,
        user_role=UserRole.FREELANCER,
        session_id="test",
    )

    args = RequestPayoutWithdrawalArgs(
        amount_dzd=5000,
        rip_number="1234567890",
        account_holder_name="Mohamed Benali",
    )
    res = await tool.execute(args, ctx)
    assert res.success is False
    assert "20 digits" in res.error


# =========================================================================
# Leap 1, 2, 7: Critical Tools, Batch Operations & Simulation Mode Tests
# =========================================================================


@pytest.mark.asyncio
async def test_simulation_mode_preview():
    """Verify simulate() returns dry-run preview without mutating state."""
    tool = tool_registry.get_tool("batch_create_milestones")
    assert tool is not None

    ctx = AgentSecurityContext(
        user_id=10,
        user_role=UserRole.BUSINESS,
        session_id="sim-test",
    )

    args = {
        "contract_id": 42,
        "milestones": [
            {
                "title": "Design Mockups",
                "description": "Figma screens",
                "amount_dzd": 120000,
                "due_days_offset": 7,
            },
            {
                "title": "Backend API",
                "description": "FastAPI endpoints",
                "amount_dzd": 180000,
                "due_days_offset": 14,
            },
        ],
    }

    res = await tool.simulate(args, ctx)
    assert res.success is True
    assert res.metadata.get("simulated") is True
    assert res.data.get("simulation") is True
    assert res.data.get("contract_id") == 42


@pytest.mark.asyncio
async def test_run_python_sandbox_ast_and_security():
    """Verify Python sandbox AST validation, safe execution, and forbidden module blocks."""
    from app.agent.tools.bi.python_sandbox import (
        RunPythonSandboxTool,
        RunPythonSandboxArgs,
    )

    tool = RunPythonSandboxTool()
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN, session_id="test")

    # 1. Valid mathematical computation
    safe_code = """
import math
result = math.sqrt(256) * 2
print("Computation completed")
"""
    res = await tool.execute(RunPythonSandboxArgs(code=safe_code), ctx)
    assert res.success is True
    assert res.data["result"] == 32.0
    assert "Computation completed" in res.data["stdout"]

    # 2. Block forbidden module (os)
    unsafe_os = "import os\nos.system('ls')"
    res_os = await tool.execute(RunPythonSandboxArgs(code=unsafe_os), ctx)
    assert res_os.success is False
    assert "forbidden" in res_os.error.lower()

    # 3. Block forbidden module (subprocess)
    unsafe_sub = "import subprocess\nsubprocess.run(['echo', 'hacked'])"
    res_sub = await tool.execute(RunPythonSandboxArgs(code=unsafe_sub), ctx)
    assert res_sub.success is False
    assert "forbidden" in res_sub.error.lower()

    # 4. Block eval call
    unsafe_eval = "result = eval('1 + 1')"
    res_eval = await tool.execute(RunPythonSandboxArgs(code=unsafe_eval), ctx)
    assert res_eval.success is False
    assert "forbidden" in res_eval.error.lower()

    # 5. Block dunder traversal
    unsafe_dunder = "result = ().__class__.__bases__"
    res_dunder = await tool.execute(RunPythonSandboxArgs(code=unsafe_dunder), ctx)
    assert res_dunder.success is False
    assert "dunder" in res_dunder.error.lower()


@pytest.mark.asyncio
async def test_generate_legal_invoice_pdf():
    """Verify ReportLab PDF generation with Article 169 CIDTA notices and QR code."""
    from app.agent.tools.fintech.legal_invoice_pdf import (
        GenerateLegalInvoicePdfTool,
        GenerateLegalInvoicePdfArgs,
    )

    tool = GenerateLegalInvoicePdfTool()
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN, session_id="test")

    args = GenerateLegalInvoicePdfArgs(
        invoice_number="INV-2026-DZ-0089",
        client_name="Sonatrach Innovation Lab",
        client_nif="002016010012345",
        freelancer_name="Amina Mansouri",
        freelancer_ifu="002231010054321",
        amount_ht=500000.0,
        service_description="Audit de sécurité des smart contracts et conseil IA",
        scf_account="6186",
    )

    res = await tool.execute(args, ctx)
    assert res.success is True
    assert res.data["amount_ht_dzd"] == 500000.0
    assert res.data["tax_shield_dzd"] == 130000.0  # 26% of 500,000
    assert res.data["ibs_deduction_rate"] == 0.26
    assert res.data["loi_22_23_ifu_rate"] == 0.005
    assert res.data["pdf_size_bytes"] > 1000
    assert "Article 169 CIDTA" in res.data["legal_compliance"][0]
    assert "podacium.dz/verify/invoice" in res.data["verification_url"]


@pytest.mark.asyncio
async def test_generate_adaptive_quiz():
    """Verify adaptive pedagogical quiz for Arrêté 1275 startup competencies."""
    from app.agent.tools.edtech.adaptive_quiz import (
        GenerateAdaptiveQuizTool,
        GenerateAdaptiveQuizArgs,
    )

    tool = GenerateAdaptiveQuizTool()
    ctx = AgentSecurityContext(user_id=5, user_role=UserRole.STUDENT, session_id="test")

    args = GenerateAdaptiveQuizArgs(
        topic="Diplôme-Startup & Brevet d'Invention",
        target_competency="Arrêté 1275 Startup Incubator",
        num_questions=3,
        identified_weak_spots=["INAPI patent protection", "SCF accounting 6186"],
    )

    res = await tool.execute(args, ctx)
    assert res.success is True
    assert res.data["question_count"] == 3
    assert len(res.data["questions"]) == 3
    assert "evaluation_grid" in res.data
    first_q = res.data["questions"][0]
    assert "question" in first_q
    assert "options" in first_q
    assert "bloom_level" in first_q


@pytest.mark.asyncio
async def test_verify_cnrc_company_registry():
    """Verify Algerian Trade Register validator checking NIF (15 digits), NIS (20 digits), and RC."""
    from app.agent.tools.core.cnrc_registry import (
        VerifyCnrcCompanyRegistryTool,
        VerifyCnrcCompanyRegistryArgs,
    )

    tool = VerifyCnrcCompanyRegistryTool()
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN, session_id="test")

    # Valid CNRC entry (Wilaya 16 = Alger)
    valid_args = VerifyCnrcCompanyRegistryArgs(
        company_name="Podacium Digital SARL",
        nif="002016010012345",
        nis="00201601001234567890",
        rc_number="16/00-0123456B22",
        wilaya_code="16",
    )
    res = await tool.execute(valid_args, ctx)
    assert res.success is True
    assert res.data["compliance_status"] == "CONFORME_CNRC"
    assert res.data["wilaya_name"] == "Alger"
    assert res.data["verification_checks"]["nif_15_digits_valid"] is True

    # Invalid NIF length (10 digits instead of 15)
    bad_nif_args = VerifyCnrcCompanyRegistryArgs(
        nif="1234567890",
        rc_number="16/00-0123456B22",
    )
    res_bad_nif = await tool.execute(bad_nif_args, ctx)
    assert res_bad_nif.success is False
    assert "15 numeric digits" in res_bad_nif.error

    # Wilaya code mismatch
    mismatch_args = VerifyCnrcCompanyRegistryArgs(
        nif="002016010012345",
        rc_number="16/00-0123456B22",
        wilaya_code="31",  # 31 is Oran, RC is 16
    )
    res_mismatch = await tool.execute(mismatch_args, ctx)
    assert res_mismatch.success is False
    assert "mismatch" in res_mismatch.error.lower()


@pytest.mark.asyncio
async def test_inspect_freelance_deliverable():
    """Verify deliverable inspection for code syntax, security patterns, and milestone adherence."""
    from app.agent.tools.freelance.inspect_deliverable import (
        InspectFreelanceDeliverableTool,
        InspectFreelanceDeliverableArgs,
    )

    tool = InspectFreelanceDeliverableTool()
    ctx = AgentSecurityContext(
        user_id=2, user_role=UserRole.FREELANCER, session_id="test"
    )

    # Clean code snippet
    clean_code = """
def test_user_authentication():
    # Unit test implementation
    assert True

def get_api_status():
    return {"status": "ok"}
"""
    clean_args = InspectFreelanceDeliverableArgs(
        milestone_id=101,
        code_snippet=clean_code,
        expected_deliverables=["api", "tests"],
    )
    res_clean = await tool.execute(clean_args, ctx)
    assert res_clean.success is True
    assert res_clean.data["passed"] is True
    assert res_clean.data["security_score"] == 100
    assert res_clean.data["syntax_valid"] is True

    # Vulnerable code snippet with hardcoded secret and dangerous os.system
    vuln_code = """
api_key = "sk_live_FAKE_KEY_FOR_TESTING_ONLY"
import os
os.system("rm -rf /tmp/data")
"""
    vuln_args = InspectFreelanceDeliverableArgs(
        milestone_id=102,
        code_snippet=vuln_code,
    )
    res_vuln = await tool.execute(vuln_args, ctx)
    assert res_vuln.success is True
    assert res_vuln.data["vulnerabilities_count"] >= 2
    assert res_vuln.data["passed"] is False


@pytest.mark.asyncio
async def test_send_whatsapp_notification():
    """Verify WhatsApp notification formatting with Algerian international dialing format."""
    from app.agent.tools.core.whatsapp_notification import (
        SendWhatsappNotificationTool,
        SendWhatsappNotificationArgs,
    )

    tool = SendWhatsappNotificationTool()
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN, session_id="test")

    args = SendWhatsappNotificationArgs(
        phone_number="0550123456",
        notification_type="invoice_link",
        recipient_name="Yacine Brahimi",
        invoice_url="https://podacium.dz/invoices/INV-2026-DZ-0089",
    )

    res = await tool.execute(args, ctx)
    assert res.success is True
    assert res.data["recipient_phone"] == "213550123456"
    assert res.data["notification_type"] == "invoice_link"
    assert (
        "169" in res.data["message_preview"] and "CIDTA" in res.data["message_preview"]
    )


@pytest.mark.asyncio
async def test_batch_operations_suite():
    """Verify batch operations across domains: Kridi aging, payouts, milestones, and certificates."""
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN, session_id="test")

    # 1. BI Kridi aging report
    kridi_tool = tool_registry.get_tool("generate_kridi_aging_report")
    assert kridi_tool is not None
    kridi_res = await kridi_tool.execute(kridi_tool.args_schema(), ctx)
    assert kridi_res.success is True
    assert "aging_buckets" in kridi_res.data
    assert "current_0_30" in kridi_res.data["aging_buckets"]
    assert "critical_90_plus" in kridi_res.data["aging_buckets"]

    # 2. FinTech Batch Payouts with 20-digit RIP validation
    payout_tool = tool_registry.get_tool("batch_payout_disbursement")
    assert payout_tool is not None
    payout_args = payout_tool.args_schema(
        disbursements=[
            {
                "recipient_id": 1,
                "freelancer_name": "Karim Ziani",
                "rip_number": "00799999000123456789",  # 20 digits
                "amount_dzd": 45000.0,
            }
        ]
    )
    payout_res = await payout_tool.execute(payout_args, ctx)
    assert payout_res.success is True
    assert payout_res.data["recipients_processed"] == 1

    # 3. EdTech Batch Certificates
    cert_tool = tool_registry.get_tool("batch_issue_certificates")
    assert cert_tool is not None
    cert_args = cert_tool.args_schema(
        certificates=[
            {
                "student_id": 101,
                "student_name": "Nour Belkacem",
                "course_id": 12,
                "grade_percent": 92.5,
            }
        ]
    )
    cert_res = await cert_tool.execute(cert_args, ctx)
    assert cert_res.success is True
    assert cert_res.data["issued_count"] == 1
    assert "CERT-DZ-12-101" in cert_res.data["certificates"][0]["certificate_id"]
