"""
TamWheel Sovereign Ethical Agentic Venture OS — Algorithmic Valuation & Investor Protection Test Suite.
Tests:
1. Modified Berkus Method calibrated to Algeria (5 qualitative building blocks capped at 20M DZD)
2. Scorecard (Bill Payne) Valuation Method with MENA weights
3. Risk Factor Summation Method (RFSM) across 12 emerging market vectors
4. Venture Capital (VC) Method & First Chicago Scenario DCF
5. Stage-based composite valuation weighting (Stages 0, 1, 2, 3)
6. 6-Month Liquid Living Expense Reserve Diagnostic (COSOB & MiFID II consumer protection)
7. Vulnerable Investor allocation capping (max 5,000 DA)
8. Cryptographic Ethical Risk Waiver generation (Multilingual copy & 4-day cooling-off deadline)
9. FastAPI Endpoints (/valuation/calculate, /protection/diagnostic, /protection/waiver/generate)
"""

from datetime import datetime, timezone
import math
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.generated.prisma.enums import UserRole
from app.services.valuation_engine import (
    MultiMethodValuationEngine,
    valuation_engine,
    STAGE_WEIGHT_VECTORS,
    SCORECARD_WEIGHTS,
)
from app.services.investor_protection import (
    InvestorProtectionEngine,
    investor_protection_engine,
    VULNERABLE_INVESTOR_TICKET_CAP_DZD,
    STATUTORY_COOLING_OFF_DAYS,
)
from app.schemas.valuation import (
    StartupVentureStage,
    BerkusBlockInputs,
    ScorecardFactorInputs,
    RFSMFactorGrades,
    VCMethodInputs,
    DCFScenarioInputs,
    ValuationCalculationRequest,
)
from app.schemas.protection import (
    InvestorSuitabilityTier,
    LiquidityDiagnosticRequest,
    EthicalWaiverGenerateRequest,
)


# =============================================================================
# FIXTURES
# =============================================================================

class MockUser:
    def __init__(self, user_id=1, role=UserRole.STUDENT, email="investor@tamwheel.dz", full_name="Nassim Investor"):
        self.id = user_id
        self.role = role
        self.email = email
        self.fullName = full_name
        self.isActive = True


@pytest.fixture
def mock_investor_user():
    return MockUser(user_id=45, full_name="Nassim Investor")


@pytest.fixture
def api_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# =============================================================================
# 1. MULTI-METHOD ALGORITHMIC VALUATION ENGINE TESTS
# =============================================================================

class TestValuationEngine:
    """Mathematical tests for emerging market valuation methodologies."""

    def test_berkus_method_calculation_and_cap(self):
        """
        Verify Berkus building blocks:
        Cap = 20M DZD, each block = 4M DZD max.
        Full score (1.0 each) = 20M DZD.
        """
        engine = MultiMethodValuationEngine()

        # Full score
        inputs_full = BerkusBlockInputs(
            soundIdea=1.0, teamQuality=1.0, workingPrototype=1.0, strategicAlliances=1.0, startupLabelMoat=1.0, maxCapDzd=20_000_000.0
        )
        res_full = engine.calculate_berkus(inputs_full)
        assert res_full.preMoneyValuationDzd == 20_000_000.0
        assert res_full.details["totalScorePct"] == 100.0

        # Partial score: 0.5 across all blocks -> 10M DZD
        inputs_half = BerkusBlockInputs(
            soundIdea=0.5, teamQuality=0.5, workingPrototype=0.5, strategicAlliances=0.5, startupLabelMoat=0.5, maxCapDzd=20_000_000.0
        )
        res_half = engine.calculate_berkus(inputs_half)
        assert res_half.preMoneyValuationDzd == 10_000_000.0

    def test_scorecard_method_weighting(self):
        """
        Verify Scorecard (Bill Payne) method:
        Val = Base * Sum(W_j * S_j)
        Baseline = 30M DZD. Factor scores at 1.0 = exactly baseline.
        Factor scores at 1.2 average = 36M DZD.
        """
        engine = MultiMethodValuationEngine()

        # Baseline parity (all 1.0)
        inputs_parity = ScorecardFactorInputs(
            team=1.0, opportunitySize=1.0, productTechnology=1.0, competitiveEnvironment=1.0,
            marketingPartnerships=1.0, capitalIntensity=1.0, startupLabelDecree=1.0, baselineValuationDzd=30_000_000.0
        )
        res_parity = engine.calculate_scorecard(inputs_parity)
        assert res_parity.preMoneyValuationDzd == 30_000_000.0

        # Above average team (1.2) and opportunity (1.2)
        inputs_above = ScorecardFactorInputs(
            team=1.2, opportunitySize=1.2, productTechnology=1.0, competitiveEnvironment=1.0,
            marketingPartnerships=1.0, capitalIntensity=1.0, startupLabelDecree=1.0, baselineValuationDzd=30_000_000.0
        )
        res_above = engine.calculate_scorecard(inputs_above)
        # Delta = (0.35 * 0.2) + (0.20 * 0.2) = 0.07 + 0.04 = 0.11 -> multiplier 1.11 -> 33.3M DZD
        assert res_above.preMoneyValuationDzd == pytest.approx(33_300_000.0, rel=1e-3)

    def test_rfsm_risk_factor_adjustments(self):
        """
        Verify Risk Factor Summation Method across 12 vectors:
        Val = Base + Sum(grade * delta).
        Base = 25M DZD, delta = 2M DZD.
        """
        engine = MultiMethodValuationEngine()

        # All neutral (0)
        inputs_neutral = RFSMFactorGrades(
            managementRisk=0, stageOfBusiness=0, legislationPoliticalRisk=0, supplyChainCustomsRisk=0,
            salesDistributionRisk=0, fundingCapitalRaiseRisk=0, competitionRisk=0, technologyIpRisk=0,
            litigationLegalRisk=0, internationalFxRisk=0, reputationRisk=0, exitOpportunityRisk=0,
            deltaQuantumDzd=2_000_000.0, baselineValuationDzd=25_000_000.0
        )
        res_neutral = engine.calculate_rfsm(inputs_neutral)
        assert res_neutral.preMoneyValuationDzd == 25_000_000.0

        # Strong team (+2) and strong IP (+1), customs penalty (-1) -> net grade = +2 -> +4M DZD
        inputs_adjusted = RFSMFactorGrades(
            managementRisk=2, stageOfBusiness=0, legislationPoliticalRisk=0, supplyChainCustomsRisk=-1,
            salesDistributionRisk=0, fundingCapitalRaiseRisk=0, competitionRisk=0, technologyIpRisk=1,
            litigationLegalRisk=0, internationalFxRisk=0, reputationRisk=0, exitOpportunityRisk=0,
            deltaQuantumDzd=2_000_000.0, baselineValuationDzd=25_000_000.0
        )
        res_adj = engine.calculate_rfsm(inputs_adjusted)
        assert res_adj.preMoneyValuationDzd == 29_000_000.0

    def test_vc_method_irr_and_post_money(self):
        """
        Verify VC method: Post_0 = (V_exit * Retention) / (1 + IRR)^T, Pre_0 = Post_0 - Investment.
        """
        engine = MultiMethodValuationEngine()
        inputs = VCMethodInputs(
            projectedExitValuationDzd=100_000_000.0,
            exitHorizonYears=3,
            targetAnnualIrrPct=50.0,  # (1 + 0.5)^3 = 3.375
            investmentRequiredDzd=5_000_000.0,
            retentionDilutionFactor=0.80,  # 80M numerator
        )
        res = engine.calculate_vc_method(inputs)
        # Post = 80,000,000 / 3.375 = 23,703,703.70 DZD
        # Pre = Post - 5,000,000 = 18,703,703.70 DZD
        assert res.preMoneyValuationDzd == pytest.approx(18_703_703.70, rel=1e-2)

    def test_stage_composite_valuation_transitions(self):
        """
        Verify stage-based composite weighting vector:
        - Stage 0 (Pre-MVP): Berkus 40%, Scorecard 40%, RFSM 20%, VC 0%, DCF 0%.
        - Stage 2 (Revenue < 10M DZD): Berkus 10%, Scorecard 15%, RFSM 15%, VC 30%, DCF 30%.
        """
        req_stage0 = ValuationCalculationRequest(stage=StartupVentureStage.STAGE_0_PRE_MVP)
        report0 = valuation_engine.calculate_composite_valuation(req_stage0)
        assert report0.stageWeightingVector["berkus"] == 0.40
        assert report0.stageWeightingVector["scorecard"] == 0.40
        assert report0.stageWeightingVector["rfsm"] == 0.20
        assert report0.stageWeightingVector["vcMethod"] == 0.0
        assert report0.stageWeightingVector["dcf"] == 0.0

        req_stage2 = ValuationCalculationRequest(stage=StartupVentureStage.STAGE_2_EARLY_REVENUE)
        report2 = valuation_engine.calculate_composite_valuation(req_stage2)
        assert report2.stageWeightingVector["vcMethod"] == 0.30
        assert report2.stageWeightingVector["dcf"] == 0.30
        assert len(report2.sensitivityAnalysis) == 5
        assert report2.confidenceIntervalLowDzd < report2.compositePreMoneyValuationDzd < report2.confidenceIntervalHighDzd


# =============================================================================
# 2. CONSUMER PROTECTION & VULNERABLE INVESTOR TESTS
# =============================================================================

class TestInvestorProtectionEngine:
    """Consumer financial protection & 6-month reserve tests."""

    def test_vulnerable_investor_triggered_when_savings_below_6_months(self):
        """
        If liquid savings cover less than 6 months of household living expenses,
        investor is flagged as VULNERABLE_INVESTOR and ticket is capped at 5,000 DA.
        """
        # Monthly expenses: 75,000 DZD. Required reserve: 450,000 DZD.
        # Savings: 225,000 DZD (3.0 months < 6.0 months)
        req = LiquidityDiagnosticRequest(
            monthlyHouseholdExpenseDzd=75000.0,
            liquidSavingsDzd=225000.0,
            netWorthDzd=800000.0,
        )
        diag = investor_protection_engine.evaluate_liquidity_reserve(req)

        assert diag.isVulnerable is True
        assert diag.suitabilityTier == InvestorSuitabilityTier.VULNERABLE_INVESTOR
        assert diag.reserveCoverageMonths == 3.0
        assert diag.requiredReserveDzd == 450000.0
        assert diag.maxPermittedTicketDzd == VULNERABLE_INVESTOR_TICKET_CAP_DZD  # Exactly 5,000 DA
        assert diag.requiresEthicalWaiver is True
        assert "VULNERABLE INVESTOR" in diag.riskWarning

    def test_suitable_investor_when_savings_exceed_6_months(self):
        """
        When liquid savings cover >= 6 months of expenses, normal retail limit applies.
        """
        # Monthly expenses: 60,000 DZD. Required reserve: 360,000 DZD.
        # Savings: 600,000 DZD (10.0 months >= 6.0 months)
        req = LiquidityDiagnosticRequest(
            monthlyHouseholdExpenseDzd=60000.0,
            liquidSavingsDzd=600000.0,
            netWorthDzd=3000000.0,
        )
        diag = investor_protection_engine.evaluate_liquidity_reserve(req)

        assert diag.isVulnerable is False
        assert diag.suitabilityTier == InvestorSuitabilityTier.SUITABLE_RETAIL_INVESTOR
        assert diag.reserveCoverageMonths == 10.0
        assert diag.maxPermittedTicketDzd > 5000.0
        assert diag.requiresEthicalWaiver is False
        assert diag.riskWarning is None

    def test_accredited_angel_qualification(self):
        """
        High net worth (>= 10M DZD) and high suitability score qualifies as ACCREDITED_ANGEL.
        """
        req = LiquidityDiagnosticRequest(
            monthlyHouseholdExpenseDzd=150000.0,
            liquidSavingsDzd=3000000.0,
            netWorthDzd=25000000.0,
            knowledgeScoreK=90.0,
            lossBearingCapacityC=85.0,
            behavioralRiskB=80.0,
        )
        diag = investor_protection_engine.evaluate_liquidity_reserve(req)

        assert diag.isVulnerable is False
        assert diag.suitabilityTier == InvestorSuitabilityTier.ACCREDITED_ANGEL
        assert diag.maxPermittedTicketDzd == 5000000.0  # 20% of net worth

    def test_ethical_waiver_generation_and_capping(self):
        """
        Generating waiver for a vulnerable investor enforces 5,000 DA ticket cap,
        generates SHA-256 declaration hash, multilingual disclosures, and 4-day cooling-off deadline.
        """
        req = EthicalWaiverGenerateRequest(
            investorId=88,
            proposedPledgeAmountDzd=100000.0,  # Attempting 100k DA pledge
            monthlyHouseholdExpenseDzd=80000.0,
            liquidSavingsDzd=200000.0,  # 2.5 months reserve < 6 months
        )
        waiver = investor_protection_engine.generate_ethical_waiver(req)

        assert waiver.isVulnerable is True
        assert waiver.proposedPledgeAmountDzd == 100000.0
        assert waiver.cappedPledgeAmountDzd == VULNERABLE_INVESTOR_TICKET_CAP_DZD  # Capped to 5,000 DA
        assert waiver.statutoryCoolingOffDays == STATUTORY_COOLING_OFF_DAYS        # 4 days
        assert len(waiver.declarationHash) == 64                                   # SHA-256 hex string
        assert "إقرار وتنازل أخلاقي" in waiver.waiverTextAr
        assert "Règlement COSOB 23-01" in waiver.waiverTextFr
        assert "cooling-off" in waiver.waiverTextEn.lower()


# =============================================================================
# 3. REST ENDPOINT INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_endpoint_calculate_valuation(api_client):
    """Test POST /api/v1/valuation/calculate."""
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    resp = await api_client.post(
        "/api/v1/valuation/calculate",
        json={
            "stage": "STAGE_1_EARLY_MVP",
            "berkus": {"soundIdea": 0.9, "teamQuality": 0.85},
            "scorecard": {"team": 1.2, "opportunitySize": 1.15},
        },
        headers=headers,
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["stage"] == "STAGE_1_EARLY_MVP"
    assert data["compositePreMoneyValuationDzd"] > 10_000_000.0
    assert len(data["methodBreakdown"]) == 5
    assert len(data["sensitivityAnalysis"]) == 5


@pytest.mark.asyncio
async def test_endpoint_startup_valuation(api_client):
    """Test GET /api/v1/valuation/startup/{startup_id}."""
    startup_id = "st-val-test-1"
    mock_startup = SimpleNamespace(
        id=startup_id,
        name="Algérie AgriTech SPAS",
        tagline="Automated greenhouse climate control",
        wilaya=19,
        sector="Agritech",
        hasAsfLabel=True,
    )

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_startup

        resp = await api_client.get(f"/api/v1/valuation/startup/{startup_id}")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["compositePreMoneyValuationDzd"] > 15_000_000.0
        assert data["confidenceIntervalHighDzd"] > data["confidenceIntervalLowDzd"]


@pytest.mark.asyncio
async def test_endpoint_protection_diagnostic(api_client, mock_investor_user):
    """Test POST /api/v1/protection/diagnostic."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_investor_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    resp = await api_client.post(
        "/api/v1/protection/diagnostic",
        json={
            "monthlyHouseholdExpenseDzd": 70000.0,
            "liquidSavingsDzd": 280000.0,  # 4 months < 6 months
            "netWorthDzd": 900000.0,
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["isVulnerable"] is True
    assert data["maxPermittedTicketDzd"] == 5000.0
    assert data["requiresEthicalWaiver"] is True

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_endpoint_protection_waiver_generate(api_client, mock_investor_user):
    """Test POST /api/v1/protection/waiver/generate."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_investor_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    resp = await api_client.post(
        "/api/v1/protection/waiver/generate",
        json={
            "investorId": mock_investor_user.id,
            "proposedPledgeAmountDzd": 50000.0,
            "monthlyHouseholdExpenseDzd": 65000.0,
            "liquidSavingsDzd": 200000.0,  # < 6 months
        },
        headers=headers,
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["isVulnerable"] is True
    assert data["cappedPledgeAmountDzd"] == 5000.0
    assert len(data["declarationHash"]) == 64
    assert data["statutoryCoolingOffDays"] == 4

    app.dependency_overrides.clear()
