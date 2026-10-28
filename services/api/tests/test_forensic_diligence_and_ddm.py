"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Audit & Automated DDM Test Suite.
Tests:
1. Benford's Law First-Digit Conformity Test on natural vs fabricated financial ledgers
2. Graph-Based Conflict of Interest & Related-Party Transaction (RPT) Detector
3. Automated Due Diligence Memorandum (DDM) Generator (Sequoia / Y Combinator standards)
4. Institutional Red Flag Matrix (Deal Breakers, Major Concerns, Managed Risks)
5. FastAPI Endpoints: /forensic-audit, /conflict-graph, and /ddm (JSON and Markdown)
"""

from datetime import datetime, timezone
import math
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.generated.prisma.enums import UserRole, AnalystLevel
from app.services.forensic_audit import (
    ForensicAuditEngine,
    forensic_audit_engine,
    run_benford_analysis,
    extract_first_digit,
    BenfordConformityStatus,
    ConflictSeverity,
    ConflictType,
)
from app.services.ddm_generator import AutomatedDDMGenerator, ddm_generator
from app.services.factguard_ai import FactBadgeStatus


# =============================================================================
# FIXTURES
# =============================================================================

class MockUser:
    def __init__(self, user_id=1, role=UserRole.STUDENT, email="analyst@tamwheel.dz", full_name="Karim DueDiligence"):
        self.id = user_id
        self.role = role
        self.email = email
        self.fullName = full_name
        self.analystTier = "PARTNER"
        self.isActive = True


@pytest.fixture
def mock_analyst_user():
    return MockUser(user_id=10, full_name="Yacine Partner")


@pytest.fixture
def api_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# =============================================================================
# 1. BENFORD'S LAW FORENSIC ACCOUNTING TESTS
# =============================================================================

class TestBenfordLawForensics:
    """Forensic financial testing for ledger fabrication and digit anomalies."""

    def test_first_digit_extraction(self):
        """Verify first leading non-zero digit extraction across scales."""
        assert extract_first_digit(1500000) == 1
        assert extract_first_digit(9450.50) == 9
        assert extract_first_digit(0.00782) == 7
        assert extract_first_digit(-42000) == 4
        assert extract_first_digit(0) is None

    def test_benford_natural_distribution_conformity(self):
        """
        Naturally generated exponential financial distributions conform to Benford's Law
        with low MAD (< 0.012) and p-value > 0.05.
        """
        # Generate naturally distributed numbers across orders of magnitude: 2^x, 3^x, fibonacci
        natural_ledger = [int(100 * (1.15 ** i) * (i % 7 + 1)) for i in range(1, 150)]
        result = run_benford_analysis(natural_ledger)

        assert result.sample_size == len(natural_ledger)
        assert result.conformity in (
            BenfordConformityStatus.CLOSE_CONFORMITY,
            BenfordConformityStatus.ACCEPTABLE_CONFORMITY,
            BenfordConformityStatus.MARGINALLY_ACCEPTABLE,
        )
        assert result.is_anomalous is False

    def test_benford_fabricated_uniform_distribution_flagged(self):
        """
        Fabricated ledger entries where human fraudsters invent round or uniform numbers
        are flagged as NON_CONFORMING with high Chi-Square and low p-value.
        """
        # Fraudster inventing transactions evenly distributed across digits 1 to 9 (e.g. 50 of each)
        fabricated_ledger = []
        for d in range(1, 10):
            fabricated_ledger.extend([d * 10000 + i * 50 for i in range(40)])

        result = run_benford_analysis(fabricated_ledger)
        assert result.conformity == BenfordConformityStatus.NON_CONFORMING
        assert result.is_anomalous is True
        assert result.p_value < 0.01
        assert "violates Benford's Law" in result.diagnostic_notes

    def test_benford_insufficient_sample_size(self):
        """Sample sizes smaller than 15 return INSUFFICIENT_DATA gracefully."""
        tiny_ledger = [1000, 2000, 3000]
        result = run_benford_analysis(tiny_ledger)
        assert result.conformity == BenfordConformityStatus.INSUFFICIENT_DATA
        assert result.is_anomalous is False
        assert "Insufficient sample size" in result.diagnostic_notes


# =============================================================================
# 2. GRAPH-BASED CONFLICT OF INTEREST & RELATED PARTIES TESTS
# =============================================================================

class TestConflictOfInterestGraph:
    """Graph traversal tests for interlocking directorates and kinship conflicts."""

    def test_undisclosed_family_juror_detected(self):
        """
        Matching surname and shared NIN wilaya prefix between founder and juror
        triggers CRITICAL UNDISCLOSED_FAMILY_JURY conflict.
        """
        engine = ForensicAuditEngine()
        founders = [
            {"id": "f-1", "fullName": "Mohamed Benali", "email": "m.benali@startup.dz", "nin": "160123456789"}
        ]
        jurors = [
            {"id": "j-1", "fullName": "Prof. Rachid Benali", "email": "r.benali@university.dz", "nin": "160987654321"}
        ]
        vendors = []

        report = engine.detect_conflicts_of_interest(founders, jurors, vendors, "Benali Tech SPAS")
        assert report["overallSeverity"] == ConflictSeverity.CRITICAL.value
        assert report["statusFlag"] == "FATAL_CONFLICT"
        assert report["criticalCount"] == 1

        conflict = report["conflicts"][0]
        assert conflict["conflictType"] == ConflictType.UNDISCLOSED_FAMILY_JURY.value
        assert "Kinship signal detected" in conflict["description"]
        assert "Immediate recusal" in conflict["remedyRecommendation"]

    def test_interlocking_directorate_vendor_self_dealing(self):
        """
        Founder directing or controlling an S4E vendor company triggers INTERLOCKING_DIRECTORATE.
        """
        engine = ForensicAuditEngine()
        founders = [
            {"id": "f-2", "fullName": "Yassine Mansouri", "email": "yassine@cloud.dz"}
        ]
        jurors = []
        vendors = [
            {"id": "v-1", "companyName": "Mansouri Dev Agency", "directorName": "Yassine Mansouri"}
        ]

        report = engine.detect_conflicts_of_interest(founders, jurors, vendors, "Cloud DZ")
        assert report["overallSeverity"] == ConflictSeverity.CRITICAL.value
        assert report["criticalCount"] == 1
        assert report["conflicts"][0]["conflictType"] == ConflictType.INTERLOCKING_DIRECTORATE.value

    def test_corporate_domain_collusion(self):
        """Shared corporate email domain between founder and juror triggers DOMAIN_COLLUSION."""
        engine = ForensicAuditEngine()
        founders = [
            {"id": "f-3", "fullName": "Amira Chaoui", "email": "amira@algeria-invest.dz"}
        ]
        jurors = [
            {"id": "j-3", "fullName": "Karim Slimani", "email": "karim@algeria-invest.dz"}
        ]
        vendors = []

        report = engine.detect_conflicts_of_interest(founders, jurors, vendors, "Chaoui Energy")
        assert report["overallSeverity"] == ConflictSeverity.MODERATE.value
        assert report["conflicts"][0]["conflictType"] == ConflictType.DOMAIN_COLLUSION.value

    def test_clean_unconnected_entities(self):
        """Completely independent parties yield CLEAN status with zero conflicts."""
        engine = ForensicAuditEngine()
        founders = [{"id": "f-4", "fullName": "Anis Meziani", "email": "anis@meziani.dz", "nin": "310111"}]
        jurors = [{"id": "j-4", "fullName": "Dr. Leila Haddad", "email": "leila@algiers-vc.dz", "nin": "160222"}]
        vendors = [{"id": "v-4", "companyName": "AuditExpert SARL", "directorName": "Omar Farouk"}]

        report = engine.detect_conflicts_of_interest(founders, jurors, vendors, "MedTech SPAS")
        assert report["overallSeverity"] == ConflictSeverity.CLEAN.value
        assert report["totalConflictsCount"] == 0
        assert report["conflictRiskScore"] == 0.0


# =============================================================================
# 3. AUTOMATED DUE DILIGENCE MEMORANDUM (DDM) TESTS
# =============================================================================

class TestAutomatedDDMGenerator:
    """Institutional Sequoia / YC template compliance tests."""

    def test_generate_ddm_sections(self):
        """Verify presence of all 8 diligence sections and structured metadata."""
        startup_data = {
            "id": "st-ddm-1",
            "name": "AgroSovereign SPAS",
            "tagline": "AI-guided smart pivot irrigation for the High Plateaus",
            "wilaya": 19,
            "sector": "Agritech & Foodtech",
            "hasAsfLabel": True,
            "hypeScore": 88.5,
        }

        memo = ddm_generator.generate_memorandum(startup_data=startup_data)

        # Check section keys
        assert "section1_executive_summary" in memo
        assert "section2_founding_team" in memo
        assert "section3_market_opportunity" in memo
        assert "section4_product_and_moat" in memo
        assert "section5_traction_and_economics" in memo
        assert "section6_forensic_and_factguard_audit" in memo
        assert "section7_red_flag_matrix" in memo
        assert "section8_final_ic_verdict" in memo
        assert "markdownReport" in memo

        # Check content
        assert memo["section1_executive_summary"]["asfLabelStatus"] == "Active Certified"
        assert memo["section1_executive_summary"]["wilaya"] == "Sétif"
        assert len(memo["section7_red_flag_matrix"]) >= 1

    def test_ddm_deal_breaker_triggers_reject(self):
        """FactGuard RED status triggers DEAL_BREAKER and REJECT_FATAL_FLAW IC verdict."""
        startup_data = {
            "id": "st-fraud-1",
            "name": "FakeTech",
            "tagline": "Unverified claims",
            "wilaya": 16,
            "sector": "FinTech",
        }
        factguard_poisoned = {
            "overallBadge": FactBadgeStatus.RED_UNVERIFIED.value,
            "verifiedCount": 0,
            "totalClaims": 3,
            "redCount": 1,
            "summary": "Fabricated registration",
        }

        memo = ddm_generator.generate_memorandum(
            startup_data=startup_data,
            factguard_data=factguard_poisoned,
        )

        assert memo["section1_executive_summary"]["icVerdict"] == "REJECT_FATAL_FLAW"
        deal_breakers = [r for r in memo["section7_red_flag_matrix"] if r["severity"] == "DEAL_BREAKER"]
        assert len(deal_breakers) == 1
        assert "PASS" in memo["section8_final_ic_verdict"]["summary"]

    def test_ddm_markdown_report_rendering(self):
        """Verify generated markdown string contains tables, headers, and IC check items."""
        startup_data = {
            "id": "st-md-1",
            "name": "SolarTech SPAS",
            "tagline": "Bifacial desert PV panels",
            "wilaya": 30,
            "sector": "CleanTech",
        }
        memo = ddm_generator.generate_memorandum(startup_data=startup_data)
        md = memo["markdownReport"]

        assert "# DUE DILIGENCE MEMORANDUM (DDM) — SOLARTECH SPAS" in md
        assert "## 1. EXECUTIVE SUMMARY & RECOMMENDATION" in md
        assert "## 7. INSTITUTIONAL RED FLAG MATRIX" in md
        assert "## 8. FINAL INVESTMENT COMMITTEE VERDICT" in md
        assert "| Pillar | Severity | Identified Issue |" in md


# =============================================================================
# 4. FASTAPI ENDPOINT INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_endpoint_forensic_audit(api_client, mock_analyst_user):
    """Test POST /api/v1/diligence/{startup_id}/forensic-audit."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_analyst_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    startup_id = "st-forensic-test"
    mock_startup = SimpleNamespace(id=startup_id, name="LogisticsDZ SPAS", founderName="Omar Ziani")

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_startup

        ledger = [100000 * (1.2 ** i) for i in range(1, 40)]

        resp = await api_client.post(
            f"/api/v1/diligence/{startup_id}/forensic-audit",
            json={
                "ledgerEntries": ledger,
                "founders": [{"id": "f-1", "fullName": "Omar Ziani", "email": "omar@logistics.dz"}],
                "jurors": [{"id": "j-1", "fullName": "Dr. Belkacem", "email": "belkacem@jury.dz"}],
            },
            headers=headers,
        )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["startupId"] == startup_id
        assert "benfordAnalysis" in data
        assert "conflictAnalysis" in data
        assert data["benfordAnalysis"]["sampleSize"] == len(ledger)

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_endpoint_conflict_graph(api_client, mock_analyst_user):
    """Test GET /api/v1/diligence/{startup_id}/conflict-graph."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_analyst_user
    startup_id = "st-graph-test"
    mock_startup = SimpleNamespace(id=startup_id, name="HealthCloud SPAS", founderName="Karim Toumi")

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_startup

        resp = await api_client.get(f"/api/v1/diligence/{startup_id}/conflict-graph")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "nodes" in data["graph"]
        assert "edges" in data["graph"]
        assert data["startupName"] == "HealthCloud SPAS"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_endpoint_get_ddm_json_and_markdown(api_client):
    """Test GET /api/v1/diligence/{startup_id}/ddm in JSON and Markdown formats."""
    startup_id = "st-ddm-api"
    mock_startup = SimpleNamespace(
        id=startup_id,
        name="Algérie Mobility SPAS",
        tagline="Shared urban micro-mobility network",
        wilaya=16,
        sector="Mobility & Logistics",
        hasAsfLabel=True,
        hypeScore=91.0,
    )

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find, \
         patch("app.core.prisma.prisma.communityscore.find_many", new_callable=AsyncMock) as mock_scores:

        mock_find.return_value = mock_startup
        mock_scores.return_value = []

        # 1. JSON Request
        resp_json = await api_client.get(f"/api/v1/diligence/{startup_id}/ddm?format=json")
        assert resp_json.status_code == status.HTTP_200_OK
        json_data = resp_json.json()
        assert json_data["metadata"]["startupName"] == "Algérie Mobility SPAS"
        assert json_data["section1_executive_summary"]["asfLabelStatus"] == "Active Certified"
        assert len(json_data["section7_red_flag_matrix"]) >= 1

        # 2. Markdown Request
        resp_md = await api_client.get(f"/api/v1/diligence/{startup_id}/ddm?format=markdown")
        assert resp_md.status_code == status.HTTP_200_OK
        assert resp_md.headers["content-type"].startswith("text/markdown")
        md_text = resp_md.text
        assert "# DUE DILIGENCE MEMORANDUM (DDM) — ALGÉRIE MOBILITY SPAS" in md_text
        assert "## 8. FINAL INVESTMENT COMMITTEE VERDICT" in md_text
