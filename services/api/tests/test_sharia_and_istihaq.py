"""
TamWheel Sovereign Ethical Agentic Venture OS — Pillar 4 Comprehensive Test Suite.
Tests:
1. Programmatic AAOIFI Standard No. 21 Sharia Compliance Engine & Ratios.
2. Qualitative Prohibited Sector Detection (Riba, Maysir, Alcohol, Pork, etc.).
3. Algorithmic Tathir (Financial Purification) & Sadaqah Distribution Rules.
4. Cryptographically Hashed Sharia Certificate Generation (SHA-256).
5. Proof-of-Touiza / S4E Bounty Smart Escrow Lifecycle (0.05% - 1.0% BSA-AIR).
6. Dual-Signature Independent Expert Peer Review Workflow.
7. Automated BSA-AIR Warrant Certificate Minting under Law 22-09 SPAS Nominee.
8. Complete FastAPI Endpoints for Sharia and Bounties.
"""

import pytest
import hashlib
from datetime import datetime, timezone
from starlette.testclient import TestClient

from app.main import app
from app.services.sharia_compliance import (
    sharia_compliance_engine,
    FinancialStatement,
    ShariaVerdict,
    ProhibitedSector,
    AAOIFI_MAX_DEBT_RATIO,
    AAOIFI_MAX_INTEREST_DEPOSITS_RATIO,
    AAOIFI_MAX_NON_PERMISSIBLE_REVENUE,
)
from app.services.istihaq_engine import (
    istihaq_engine,
    MilestoneType,
    VerificationStatus,
    BountyStatus,
    ExpertRoleTier,
    MIN_BSA_AIR_EQUITY_PCT,
    MAX_BSA_AIR_EQUITY_PCT,
    MilestoneDeliverable,
    IstihaqCalculationRequest,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. SHARIA COMPLIANCE ENGINE & RATIOS (AAOIFI STANDARD 21)
# =============================================================================

class TestShariaComplianceEngine:
    """Rigorous testing of AAOIFI Sharia Standard No. 21 ratio and sector screening."""

    def test_fully_compliant_tech_startup(self):
        stmt = FinancialStatement(
            total_assets_dzd=60_000_000,
            market_cap_dzd=120_000_000,
            total_debt_dzd=12_000_000,              # 10% (<33%)
            interest_bearing_deposits_dzd=15_000_000, # 12.5% (<33%)
            total_revenue_dzd=30_000_000,
            non_permissible_revenue_dzd=0.0,         # 0% (<5%)
            business_sectors=["B2B SaaS", "Logistics Tech"],
            business_description="Enterprise ERP and supply chain routing for Algerian manufacturing hubs.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.COMPLIANT
        assert res.debt_to_market_cap_ratio == 0.10
        assert res.interest_bearing_deposits_ratio == 0.125
        assert res.non_permissible_revenue_ratio == 0.0
        assert len(res.prohibited_sectors_detected) == 0
        assert all(r.passed for r in res.ratio_screens)

    def test_unlisted_startup_fallback_to_trailing_assets(self):
        """For early-stage startups without market cap, verifies trailing 12M assets denominator."""
        stmt = FinancialStatement(
            total_assets_dzd=25_000_000,
            market_cap_dzd=None,
            trailing_12m_assets_dzd=20_000_000,
            total_debt_dzd=4_000_000,              # 20% of trailing assets (<33%)
            interest_bearing_deposits_dzd=2_000_000, # 10% (<33%)
            total_revenue_dzd=12_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["AgTech"],
            business_description="Hydroponic greenhouse automation in Biskra.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.COMPLIANT
        debt_screen = next(r for r in res.ratio_screens if "Debt" in r.metric_name)
        assert debt_screen.denominator_used == "TRAILING_12M_ASSETS"
        assert debt_screen.ratio == 0.20

    def test_debt_ratio_breach_fails_compliance(self):
        stmt = FinancialStatement(
            total_assets_dzd=50_000_000,
            market_cap_dzd=100_000_000,
            total_debt_dzd=45_000_000,              # 45% (>=33% FAIL)
            interest_bearing_deposits_dzd=5_000_000,
            total_revenue_dzd=25_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["Hardware"],
            business_description="Solar panel assembly in Ouargla.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        debt_screen = next(r for r in res.ratio_screens if "Debt" in r.metric_name)
        assert debt_screen.passed is False
        assert "Refinance interest-bearing conventional debt" in debt_screen.remediation_guidance

    def test_deposits_ratio_breach_fails_compliance(self):
        stmt = FinancialStatement(
            total_assets_dzd=40_000_000,
            market_cap_dzd=80_000_000,
            total_debt_dzd=10_000_000,
            interest_bearing_deposits_dzd=32_000_000, # 40% (>=33% FAIL)
            total_revenue_dzd=20_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["FinTech"],
            business_description="Micro-lending platform.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        deposits_screen = next(r for r in res.ratio_screens if "Deposits" in r.metric_name)
        assert deposits_screen.passed is False

    def test_tainted_revenue_breach_fails_compliance(self):
        stmt = FinancialStatement(
            total_assets_dzd=50_000_000,
            market_cap_dzd=100_000_000,
            total_debt_dzd=5_000_000,
            interest_bearing_deposits_dzd=5_000_000,
            total_revenue_dzd=20_000_000,
            non_permissible_revenue_dzd=1_600_000,  # 8% (>=5% FAIL)
            business_sectors=["Hospitality"],
            business_description="Hotel management system.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        rev_screen = next(r for r in res.ratio_screens if "Impure" in r.metric_name)
        assert rev_screen.passed is False

    def test_questionable_borderline_ratio_classification(self):
        """Metrics between 30% and 33% trigger QUESTIONABLE supervisory watch."""
        stmt = FinancialStatement(
            total_assets_dzd=50_000_000,
            market_cap_dzd=100_000_000,
            total_debt_dzd=31_500_000,              # 31.5% (in [30%, 33%))
            interest_bearing_deposits_dzd=8_000_000,
            total_revenue_dzd=20_000_000,
            non_permissible_revenue_dzd=200_000,    # 1.0% (<5%)
            business_sectors=["CleanTech"],
            business_description="Water filtration systems.",
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.QUESTIONABLE
        assert any("Borderline quantitative ratios flagged" in n for n in res.screening_notes)

    @pytest.mark.parametrize(
        "prohibited_term,sector_enum",
        [
            ("Craft brewery and alcohol distribution", ProhibitedSector.ALCOHOL),
            ("Online sports betting and poker portal", ProhibitedSector.GAMBLING),
            ("Commercial bank and payday loan broker", ProhibitedSector.CONVENTIONAL_FINANCE),
            ("Pork sausage processing and distribution", ProhibitedSector.PORK),
            ("Adult entertainment and escort magazine", ProhibitedSector.ADULT_ENTERTAINMENT),
            ("Electronic cigarette vape and tobacco juice", ProhibitedSector.TOBACCO),
            ("Military assault weapons dealer", ProhibitedSector.WEAPONS),
            ("Binary options CFD high frequency trading", ProhibitedSector.SPECULATIVE_DERIVATIVES),
        ],
    )
    def test_prohibited_sector_rejections(self, prohibited_term, sector_enum):
        stmt = FinancialStatement(
            total_assets_dzd=30_000_000,
            market_cap_dzd=60_000_000,
            total_debt_dzd=2_000_000,
            interest_bearing_deposits_dzd=2_000_000,
            total_revenue_dzd=10_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["Retail"],
            business_description=prohibited_term,
        )
        res = sharia_compliance_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        assert sector_enum.value in res.prohibited_sectors_detected


# =============================================================================
# 2. TATHIR PURIFICATION CALCULATOR
# =============================================================================

class TestTathirPurification:
    """Testing calculation of financial purification amounts under AAOIFI rules."""

    def test_per_share_and_total_dividend_purification(self):
        tathir = sharia_compliance_engine.calculate_tathir(
            total_revenue_dzd=10_000_000,
            non_permissible_revenue_dzd=300_000,    # 3.0% (<5% compliant)
            dividend_amount_dzd=1_000_000,          # 1M DZD dividend pool
            total_shares=100_000,                   # 10 DZD dividend per share
            shares_held=5_000,                      # 5% stake
        )

        assert tathir.is_purification_mandatory is True
        assert tathir.purification_ratio == 0.03
        assert tathir.purification_percentage == 3.0
        # Dividend per share = 10 DZD -> Purification per share = 0.3 DZD
        assert tathir.dividend_purification_per_share_dzd == 0.30
        # Investor dividend payout = 50,000 DZD -> Total purification = 1,500 DZD
        assert tathir.total_purification_for_payout_dzd == 1500.0
        assert "cannot be claimed as tax deductions" in tathir.tax_deductibility_warning

    def test_zero_tainted_revenue_requires_no_purification(self):
        tathir = sharia_compliance_engine.calculate_tathir(
            total_revenue_dzd=25_000_000,
            non_permissible_revenue_dzd=0.0,
            dividend_amount_dzd=500_000,
            total_shares=50_000,
            shares_held=1_000,
        )

        assert tathir.is_purification_mandatory is False
        assert tathir.purification_ratio == 0.0
        assert tathir.purification_percentage == 0.0
        assert tathir.dividend_purification_per_share_dzd == 0.0
        assert tathir.total_purification_for_payout_dzd == 0.0


# =============================================================================
# 3. SHARIA CERTIFICATE GENERATION & CRYPTOGRAPHIC HASH
# =============================================================================

class TestShariaCertificate:
    """Testing creation and verification of cryptographic Sharia Certificates."""

    def test_sharia_certificate_cryptographic_seal(self):
        stmt = FinancialStatement(
            total_assets_dzd=50_000_000,
            market_cap_dzd=100_000_000,
            total_debt_dzd=10_000_000,
            interest_bearing_deposits_dzd=8_000_000,
            total_revenue_dzd=20_000_000,
            non_permissible_revenue_dzd=200_000,
            business_sectors=["EduTech", "AI"],
            business_description="Adaptive learning platforms for Algerian high schools.",
        )
        cert = sharia_compliance_engine.generate_certificate(
            startup_id="start-biskra-001",
            startup_name="Biskra AI Labs",
            statement=stmt,
        )

        assert cert.certificate_id.startswith("CERT-SHARIA-START-BI")
        assert cert.verdict == ShariaVerdict.COMPLIANT
        assert len(cert.certificate_audit_hash) == 64
        assert len(cert.canonical_signature) == 64
        assert (cert.expires_at - cert.issued_at).days == 90
        assert cert.tathir_obligations.is_purification_mandatory is True
        assert cert.tathir_obligations.purification_percentage == 1.0


# =============================================================================
# 4. S4E BOUNTY ESCROW & DUAL-SIGNATURE PEER REVIEW WORKFLOW
# =============================================================================

class TestS4EBountyEscrow:
    """Testing Proof-of-Touiza bounty lifecycle, peer review, and BSA-AIR minting."""

    def test_bounty_creation_validation(self):
        # Valid creation
        bounty = istihaq_engine.create_bounty(
            startup_id="startup-chlef-001",
            startup_name="Chlef Robotics",
            title="PostgreSQL Multi-Wilaya Query Optimizer",
            description="Optimize latency of geospatial routing queries across all 58 wilayas.",
            acceptance_criteria=["P99 query time < 50ms", "Explain plan audit attached"],
            milestone_type=MilestoneType.CODE_PULL_REQUEST,
            estimated_labor_value_dzd=250_000,
            equity_allocation_pct=0.25, # 0.25% in [0.05%, 1.0%]
            post_money_valuation_dzd=50_000_000,
            total_shares_pool=1_000_000,
        )
        assert bounty.bounty_id.startswith("BNTY-STARTU")
        assert bounty.status == BountyStatus.OPEN
        assert bounty.escrow_deposit_locked is True

        # Invalid equity allocation (<0.05% or >1.0%)
        with pytest.raises(ValueError, match="must be between 0.05% and 1.0%"):
            istihaq_engine.create_bounty(
                startup_id="startup-chlef-001",
                startup_name="Chlef Robotics",
                title="Invalid Bounty",
                description="Invalid equity test",
                acceptance_criteria=["Criteria"],
                milestone_type=MilestoneType.CODE_PULL_REQUEST,
                estimated_labor_value_dzd=100_000,
                equity_allocation_pct=2.5, # Exceeds 1.0% maximum
                post_money_valuation_dzd=50_000_000,
            )

    def test_end_to_end_peer_review_and_warrant_minting(self):
        # 1. Create Bounty
        bounty = istihaq_engine.create_bounty(
            startup_id="startup-oran-002",
            startup_name="Oran BioMed",
            title="Algerian Satim CIB Gateway Integration",
            description="Implement secure cryptographic signature verification for SATIM e-payment webhooks.",
            acceptance_criteria=["Zero mock fallbacks in prod", "100% unit test coverage"],
            milestone_type=MilestoneType.CODE_PULL_REQUEST,
            estimated_labor_value_dzd=300_000,
            equity_allocation_pct=0.30,
            post_money_valuation_dzd=60_000_000,
            total_shares_pool=1_000_000,
        )

        # 2. Claim Bounty
        bounty = istihaq_engine.claim_bounty(
            bounty_id=bounty.bounty_id,
            contributor_id="dev-karim-algiers",
            contributor_name="Karim B.",
        )
        assert bounty.status == BountyStatus.CLAIMED
        assert bounty.contributor_id == "dev-karim-algiers"

        # 3. Submit Deliverable
        bounty = istihaq_engine.submit_bounty(
            bounty_id=bounty.bounty_id,
            contributor_id="dev-karim-algiers",
            contributor_name="Karim B.",
            proof_description="Complete integration with SHA256 MAC validation and 18 passing tests.",
            git_repo_url="https://github.com/oran-biomed/cib-gateway",
            git_commit_hash="a1b2c3d4e5f67890123456789abcdef012345678",
            pull_request_url="https://github.com/oran-biomed/cib-gateway/pull/4",
        )
        assert bounty.status == BountyStatus.SUBMITTED
        assert bounty.submission is not None
        assert len(bounty.submission.proof_hash) == 64

        # 4. First Expert Review
        bounty = istihaq_engine.review_bounty(
            bounty_id=bounty.bounty_id,
            reviewer_id="expert-amira-sec",
            reviewer_name="Amira S.",
            role_tier=ExpertRoleTier.SENIOR_SECURITY_AUDITOR,
            technical_score=92.0,
            spec_compliance_score=95.0,
            security_sharia_score=98.0,
            documentation_score=88.0,
            approved=True,
            feedback="Clean timing-attack resilient HMAC verification.",
        )
        # 1 review approved -> status must be UNDER_REVIEW (requires 2!)
        assert bounty.status == BountyStatus.UNDER_REVIEW
        assert len(bounty.submission.reviews) == 1
        assert bounty.warrant is None

        # 5. Prevent duplicate review by same reviewer
        with pytest.raises(ValueError, match="already submitted a verdict"):
            istihaq_engine.review_bounty(
                bounty_id=bounty.bounty_id,
                reviewer_id="expert-amira-sec",
                reviewer_name="Amira S.",
                role_tier=ExpertRoleTier.SENIOR_SECURITY_AUDITOR,
                technical_score=95.0,
                spec_compliance_score=95.0,
                security_sharia_score=95.0,
                documentation_score=95.0,
                approved=True,
                feedback="Duplicate review attempt",
            )

        # 6. Prevent self-review by contributor
        with pytest.raises(ValueError, match="cannot review their own submission"):
            istihaq_engine.review_bounty(
                bounty_id=bounty.bounty_id,
                reviewer_id="dev-karim-algiers",
                reviewer_name="Karim B.",
                role_tier=ExpertRoleTier.PRINCIPAL_SOFTWARE_ENGINEER,
                technical_score=100.0,
                spec_compliance_score=100.0,
                security_sharia_score=100.0,
                documentation_score=100.0,
                approved=True,
                feedback="Self review",
            )

        # 7. Second Independent Expert Review -> Triggers VERIFIED & Warrant Minting!
        bounty = istihaq_engine.review_bounty(
            bounty_id=bounty.bounty_id,
            reviewer_id="expert-yacine-eng",
            reviewer_name="Yacine M.",
            role_tier=ExpertRoleTier.PRINCIPAL_SOFTWARE_ENGINEER,
            technical_score=90.0,
            spec_compliance_score=92.0,
            security_sharia_score=90.0,
            documentation_score=85.0,
            approved=True,
            feedback="Robust error handling and exemplary test suite.",
        )

        assert bounty.status == BountyStatus.VERIFIED
        assert bounty.verified_at is not None
        assert bounty.warrant is not None

        # Inspect issued BSA-AIR Warrant Certificate
        warrant = bounty.warrant
        assert warrant.warrant_id.startswith("WRNT-BSA-AIR-STARTU")
        assert warrant.beneficiary_id == "dev-karim-algiers"
        assert warrant.equity_percentage == 0.30
        assert warrant.shares_allocated == 3_000 # 0.30% of 1,000,000 shares
        assert warrant.immediate_vest_shares == 2_400 # 80% immediate vest
        assert warrant.retention_lock_shares == 600 # 20% locked for 90 days
        assert warrant.retention_lock_days == 90
        assert "Law 22-09 SPAS" in warrant.statutory_framework
        assert len(warrant.warrant_hash) == 64
        assert len(warrant.cryptographic_seal) == 64

    def test_review_rejection_and_revision_requested(self):
        bounty = istihaq_engine.create_bounty(
            startup_id="startup-setif-003",
            startup_name="Setif Agritech",
            title="IoT Sensor Protocol",
            description="LoRaWAN sensor packet decoder.",
            acceptance_criteria=["Low battery consumption"],
            milestone_type=MilestoneType.ARCHITECTURE_DESIGN,
            estimated_labor_value_dzd=150_000,
            equity_allocation_pct=0.15,
            post_money_valuation_dzd=30_000_000,
        )
        istihaq_engine.claim_bounty(bounty.bounty_id, "dev-ahmed", "Ahmed T.")
        istihaq_engine.submit_bounty(bounty.bounty_id, "dev-ahmed", "Ahmed T.", "Initial draft decoder")

        # Reviewer requests revisions (approved=False, score=60)
        bounty = istihaq_engine.review_bounty(
            bounty_id=bounty.bounty_id,
            reviewer_id="expert-nadir",
            reviewer_name="Nadir B.",
            role_tier=ExpertRoleTier.AI_RESEARCHER,
            technical_score=60.0,
            spec_compliance_score=60.0,
            security_sharia_score=60.0,
            documentation_score=60.0,
            approved=False,
            feedback="Payload missing CRC check.",
        )
        assert bounty.status == BountyStatus.REVISION_REQUESTED


# =============================================================================
# 5. FASTAPI ROUTER ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestShariaAndBountiesEndpoints:
    """End-to-end integration tests for /api/v1/sharia and /api/v1/bounties routes."""

    def test_api_sharia_screen_endpoint(self, client):
        payload = {
            "total_assets_dzd": 80000000,
            "market_cap_dzd": 150000000,
            "total_debt_dzd": 15000000,
            "interest_bearing_deposits_dzd": 10000000,
            "total_revenue_dzd": 40000000,
            "non_permissible_revenue_dzd": 400000,
            "business_sectors": ["GreenTech"],
            "business_description": "Solar micro-grids in Tindouf.",
        }
        res = client.post("/api/v1/sharia/screen", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["is_compliant"] is True
        assert data["verdict"] == "COMPLIANT"
        assert data["purification_required_dzd"] == 400000.0
        assert data["purification_percentage"] == 1.0

    def test_api_sharia_certificate_endpoint(self, client):
        payload = {
            "startup_id": "start-alg-005",
            "startup_name": "Algiers Cloud Fabric",
            "financial_statement": {
                "total_assets_dzd": 100000000,
                "market_cap_dzd": 200000000,
                "total_debt_dzd": 20000000,
                "interest_bearing_deposits_dzd": 10000000,
                "total_revenue_dzd": 50000000,
                "non_permissible_revenue_dzd": 500000,
                "business_sectors": ["Cloud Infrastructure"],
                "business_description": "Sovereign cloud data center in Sidi Abdellah.",
            },
        }
        res = client.post("/api/v1/sharia/certificate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["certificate_id"].startswith("CERT-SHARIA-START-AL")
        assert len(data["certificate_audit_hash"]) == 64
        assert len(data["canonical_signature"]) == 64
        assert data["verdict"] == "COMPLIANT"

    def test_api_sharia_tathir_endpoint(self, client):
        payload = {
            "total_revenue_dzd": 50000000,
            "non_permissible_revenue_dzd": 1000000, # 2%
            "dividend_amount_dzd": 5000000,
            "total_shares": 500000,
            "shares_held": 25000,
        }
        res = client.post("/api/v1/sharia/tathir/calculate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["is_purification_mandatory"] is True
        assert data["purification_percentage"] == 2.0
        assert data["dividend_purification_per_share_dzd"] == 0.20
        assert data["total_purification_for_payout_dzd"] == 5000.0

    def test_api_bounties_crud_and_review_lifecycle(self, client):
        # 1. Create Bounty
        create_payload = {
            "startup_id": "start-annaba-007",
            "startup_name": "Annaba Maritime Tech",
            "title": "AIS Vessel Tracking Algorithm",
            "description": "Port of Annaba real-time container throughput tracking.",
            "acceptance_criteria": ["WebSocket event latency < 200ms", "Clean documentation"],
            "milestone_type": "CODE_PULL_REQUEST",
            "complexity_weight": 2.0,
            "estimated_labor_value_dzd": 400000,
            "equity_allocation_pct": 0.40,
            "post_money_valuation_dzd": 80000000,
            "total_shares_pool": 1000000,
        }
        res = client.post("/api/v1/bounties", json=create_payload)
        assert res.status_code == 201
        bounty = res.json()
        b_id = bounty["bounty_id"]
        assert bounty["status"] == "OPEN"

        # 2. List bounties
        res = client.get("/api/v1/bounties")
        assert res.status_code == 200
        assert any(b["bounty_id"] == b_id for b in res.json())

        # 3. Get Bounty by ID
        res = client.get(f"/api/v1/bounties/{b_id}")
        assert res.status_code == 200
        assert res.json()["title"] == "AIS Vessel Tracking Algorithm"

        # 4. Claim Bounty
        res = client.post(
            f"/api/v1/bounties/{b_id}/claim",
            json={"contributor_id": "contributor-walid", "contributor_name": "Walid K."},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "CLAIMED"

        # 5. Submit Bounty Deliverable
        res = client.post(
            f"/api/v1/bounties/{b_id}/submit",
            json={
                "contributor_id": "contributor-walid",
                "contributor_name": "Walid K.",
                "proof_description": "AIS stream processor with Redis Streams backpressure.",
                "git_commit_hash": "deadbeef1234567890abcdef1234567890abcdef",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "SUBMITTED"

        # 6. First Expert Review
        res = client.post(
            f"/api/v1/bounties/{b_id}/review",
            json={
                "reviewer_id": "rev-expert-1",
                "reviewer_name": "Dr. Benali",
                "role_tier": "PRINCIPAL_SOFTWARE_ENGINEER",
                "technical_score": 90,
                "spec_compliance_score": 92,
                "security_sharia_score": 95,
                "documentation_score": 88,
                "approved": True,
                "feedback": "Outstanding performance metrics.",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "UNDER_REVIEW"

        # 7. Second Expert Review -> Unlocks VERIFIED & Warrant!
        res = client.post(
            f"/api/v1/bounties/{b_id}/review",
            json={
                "reviewer_id": "rev-expert-2",
                "reviewer_name": "Sofia L.",
                "role_tier": "SENIOR_SECURITY_AUDITOR",
                "technical_score": 88,
                "spec_compliance_score": 90,
                "security_sharia_score": 92,
                "documentation_score": 85,
                "approved": True,
                "feedback": "Security checks pass without vulnerability.",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "VERIFIED"
        assert data["warrant"] is not None

        # 8. Fetch Warrant endpoint
        res = client.get(f"/api/v1/bounties/{b_id}/warrant")
        assert res.status_code == 200
        warrant_data = res.json()
        assert warrant_data["beneficiary_id"] == "contributor-walid"
        assert warrant_data["equity_percentage"] == 0.40
        assert warrant_data["shares_allocated"] == 4000
        assert warrant_data["immediate_vest_shares"] == 3200
        assert warrant_data["retention_lock_shares"] == 800
