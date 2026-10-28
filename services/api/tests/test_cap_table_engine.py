"""
Unit and Integration Tests for TamWheel Cap-Table Engine (Pillar 1).
Tests:
- Law 22-09 SPAS multi-class securities model (Ordinary, Preferred A/B, BSPCE, Convertibles)
- Stakeholder ledger, fully-diluted ownership, and voting power calculation
- Pre-Money vs. Post-Money equity financing dilution simulation
- Option pool expansion: Pre-Round (founder-diluted) vs. Post-Round (shared dilution)
- BSA-AIR convertible warrants & SAFEs: Discount, Valuation Cap, Valuation Floor, and MFN clause
- Hamilton-Hare Largest Remainder Method: Indivisible shares, deterministic tie-breaking, and Zero-Loss Invariant
- Liquidation Waterfall Simulation: Seniority, Non-Participating vs Participating, Capped, and As-Converted
- Nominee SPAS entity tracker & Portage Convention (Law 22-09 & Civil Code Art 571)
- Standard Algerian SPAS BSA-AIR warrant agreement generator with SHA-256 seal
- FastAPI Router HTTP endpoints with auth dependency overrides
"""

from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.services.cap_table import CapTableEngine
from app.schemas.cap_table import (
    ShareClassType,
    StakeholderRole,
    ConvertibleInstrumentType,
    OptionPoolTiming,
    LiquidationPreferenceType,
    ShareClassCreateRequest,
    StakeholderCreateRequest,
    ShareIssuanceCreateRequest,
    ConvertibleInstrumentItem,
    PledgeItem,
    CapTableSimulateRequest,
    WaterfallSimulateRequest,
    NomineePoolRequest,
    BsaAirGenerateRequest,
)


# =============================================================================
# FIXTURES
# =============================================================================

class MockUser:
    def __init__(self, user_id=1, role="ADMIN"):
        self.id = user_id
        self.role = role
        self.email = "admin@tamwheel.dz"


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_active_user] = lambda: MockUser()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def clean_engine():
    """Reset the CapTableEngine in-memory registry before tests."""
    CapTableEngine._registry.clear()
    CapTableEngine._nominee_ledgers.clear()
    return CapTableEngine


# =============================================================================
# 1. MULTI-CLASS SECURITIES & STATE MANAGEMENT
# =============================================================================

def test_initialize_cap_table_spas_defaults(clean_engine):
    """Test default initialization of an Algerian SPAS startup cap table."""
    ct = clean_engine.get_or_create_cap_table("startup-alg-001", "Yassir Logistics SPAS")

    assert ct["companyName"] == "Yassir Logistics SPAS"
    assert len(ct["shareClasses"]) == 1
    assert len(ct["stakeholders"]) == 1
    assert len(ct["issuances"]) == 1

    summary = clean_engine.get_cap_table_summary("startup-alg-001")
    assert summary.totalAuthorizedShares == 100000
    assert summary.totalIssuedShares == 100000
    assert summary.totalFullyDilutedShares == 100000
    assert len(summary.stakeholders) == 1

    founder = summary.stakeholders[0]
    assert founder.undilutedOwnershipPct == 100.0
    assert founder.votingPowerPct == 100.0


def test_add_multi_class_shares_and_issuances(clean_engine):
    """Test creating Preferred A shares and issuing them to an institutional VC."""
    startup_id = "startup-seed-002"
    clean_engine.get_or_create_cap_table(startup_id, "Fintech SPAS")

    # 1. Add Preferred A Class with 1.0x liquidation preference
    pref_req = ShareClassCreateRequest(
        className=ShareClassType.PREFERENCE_A,
        parValueDzd=500.0,
        authorizedShares=50000,
        liquidationPreferenceMultiple=1.0,
        liquidationType=LiquidationPreferenceType.NON_PARTICIPATING,
        seniority=1,
        isVoting=True,
    )
    pref_class = clean_engine.add_share_class(startup_id, pref_req)
    assert pref_class.className == ShareClassType.PREFERENCE_A

    # 2. Add VC Stakeholder
    vc_req = StakeholderCreateRequest(
        name="Casbah Capital",
        role=StakeholderRole.INVESTOR_VC,
        taxIdNif="099916001234567",
    )
    vc_stakeholder = clean_engine.add_stakeholder(startup_id, vc_req)
    assert vc_stakeholder.name == "Casbah Capital"

    # 3. Issue 25,000 Preferred A shares
    iss_req = ShareIssuanceCreateRequest(
        classId=pref_class.classId,
        stakeholderId=vc_stakeholder.stakeholderId,
        sharesIssued=25000,
        issuePriceDzd=1000.0,
    )
    issuance = clean_engine.issue_shares(startup_id, iss_req)
    assert issuance.sharesIssued == 25000

    # 4. Check Cap Table Summary
    summary = clean_engine.get_cap_table_summary(startup_id)
    assert summary.totalIssuedShares == 125000
    assert summary.totalAuthorizedShares == 150000

    # Founder: 100k / 125k = 80.0%, VC: 25k / 125k = 20.0%
    vc_entry = next(s for s in summary.stakeholders if s.stakeholderId == vc_stakeholder.stakeholderId)
    assert vc_entry.undilutedOwnershipPct == 20.0
    assert vc_entry.votingPowerPct == 20.0
    assert vc_entry.totalCapitalInvestedDzd == 25000 * 1000.0


def test_issuance_exceeding_authorized_shares_raises_error(clean_engine):
    """Test that issuing more shares than authorized triggers a ValueError."""
    startup_id = "startup-err-003"
    ct = clean_engine.get_or_create_cap_table(startup_id)
    ord_class_id = list(ct["shareClasses"].keys())[0]
    founder_id = list(ct["stakeholders"].keys())[0]

    # Authorized is 100,000, already issued 100,000
    iss_req = ShareIssuanceCreateRequest(
        classId=ord_class_id,
        stakeholderId=founder_id,
        sharesIssued=5000,
        issuePriceDzd=100.0,
    )
    with pytest.raises(ValueError, match="exceeds authorized limit"):
        clean_engine.issue_shares(startup_id, iss_req)


# =============================================================================
# 2. DILUTION SIMULATOR (PRE/POST MONEY, OPTION POOL, CONVERTIBLES)
# =============================================================================

def test_dilution_standard_priced_round(clean_engine):
    """Verify standard pre/post money valuation dilution mechanics."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=60000000,
        investmentAmountDzd=20000000,
        preMoneyShares=100000,
        shareClass=ShareClassType.ORDINAIRE,
    )
    res = clean_engine.simulate_dilution(req)

    assert res.preMoneyValuationDzd == 60000000
    assert res.investmentAmountDzd == 20000000
    assert res.postMoneyValuationDzd == 80000000
    # Share price = 60M / 100k = 600.0 DZD
    assert res.sharePriceDzd == 600.0
    assert res.effectiveSharePriceDzd == 600.0
    # New shares = 20M / 600 = 33,333 shares
    assert res.newSharesIssued == 33333
    assert res.postRoundTotalShares == 133333
    # Investor owns 33,333 / 133,333 ≈ 25.0%
    assert abs(res.investorEquityPct - 25.0) < 0.1


def test_dilution_pre_round_option_pool_expansion(clean_engine):
    """
    Test Pre-Round option pool expansion:
    Dilution from the option pool is absorbed 100% by the founders via a lower effective share price.
    """
    # 50,000,000 pre-money, 10,000,000 investment, 10% unallocated ESOP pool created Pre-Round
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=50000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        optionPoolExpansionPct=0.10,
        optionPoolTiming=OptionPoolTiming.PRE_ROUND,
    )
    res = clean_engine.simulate_dilution(req)

    # Base price = 50M / 100k = 500 DZD
    assert res.sharePriceDzd == 500.0
    # Effective share price = 500 * (1 - 0.10) = 450.0 DZD
    assert res.effectiveSharePriceDzd == 450.0
    # New shares = 10M / 450 = 22,222
    assert res.newSharesIssued == 22222
    # Option pool shares created
    assert res.optionPoolSharesCreated > 0
    # Total fully diluted shares
    assert res.postRoundFullyDilutedShares == res.postRoundTotalShares + res.optionPoolSharesCreated
    # Verify option pool is ~10% of fully diluted
    pool_ratio = res.optionPoolSharesCreated / res.postRoundFullyDilutedShares
    assert abs(pool_ratio - 0.10) < 0.01


def test_dilution_post_round_option_pool_expansion(clean_engine):
    """Test Post-Round option pool expansion: share price stays base price, pool dilutes everyone equally."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=50000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        optionPoolExpansionPct=0.10,
        optionPoolTiming=OptionPoolTiming.POST_ROUND,
    )
    res = clean_engine.simulate_dilution(req)

    # Effective price remains equal to base price (500 DZD)
    assert res.effectiveSharePriceDzd == 500.0
    # New investor shares = 10M / 500 = 20,000
    assert res.newSharesIssued == 20000
    assert res.optionPoolSharesCreated > 0


def test_convertible_valuation_cap_vs_discount(clean_engine):
    """Test BSA-AIR conversion when valuation cap produces a lower price than standard discount."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=60000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        convertibles=[
            ConvertibleInstrumentItem(
                instrumentType="BSA_AIR",
                principalAmountDzd=3000000,
                valuationCapDzd=40000000, # Cap price: 40M / 100k = 400 DZD
                discountRate=0.20,        # Discount price: 600 * 0.8 = 480 DZD
            )
        ]
    )
    res = clean_engine.simulate_dilution(req)
    assert len(res.convertibleConversions) == 1
    c = res.convertibleConversions[0]
    # Cap price (400 DZD) is lower than discount price (480 DZD)
    assert c.conversionPriceDzd == 400.0
    assert c.appliedCapOrDiscount == "VALUATION_CAP"
    assert c.sharesIssued == int(3000000 / 400)


def test_convertible_valuation_floor_protection(clean_engine):
    """Test BSA-AIR valuation floor protecting founders from excessive down-round dilution."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=20000000, # Depressed round: share price = 200 DZD
        investmentAmountDzd=5000000,
        preMoneyShares=100000,
        convertibles=[
            ConvertibleInstrumentItem(
                instrumentType="BSA_AIR_PROTECTED",
                principalAmountDzd=5000000,
                valuationCapDzd=80000000,
                valuationFloorDzd=30000000, # Floor price: 30M / 100k = 300 DZD
                discountRate=0.20,          # Discount price: 200 * 0.8 = 160 DZD
            )
        ]
    )
    res = clean_engine.simulate_dilution(req)
    c = res.convertibleConversions[0]
    # Conversion price cannot fall below Floor price (300 DZD)
    assert c.conversionPriceDzd == 300.0
    assert c.appliedCapOrDiscount == "VALUATION_FLOOR"
    assert c.sharesIssued == int(5000000 / 300)


def test_convertible_mfn_clause(clean_engine):
    """Test Most-Favored-Nation (MFN) clause adopting superior cap from subsequent note."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=80000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        convertibles=[
            ConvertibleInstrumentItem(
                instrumentType="BSA_AIR_EARLY",
                principalAmountDzd=2000000,
                valuationCapDzd=60000000, # Higher original cap
                discountRate=0.15,
                hasMfnClause=True,        # Has MFN!
            ),
            ConvertibleInstrumentItem(
                instrumentType="BSA_AIR_LATER",
                principalAmountDzd=2000000,
                valuationCapDzd=40000000, # Lower cap (400 DZD)
                discountRate=0.25,        # Higher discount (25%)
                hasMfnClause=False,
            ),
        ]
    )
    res = clean_engine.simulate_dilution(req)
    # The early MFN note inherits the superior 40M cap (400 DZD)
    early_conv = res.convertibleConversions[0]
    assert early_conv.conversionPriceDzd == 400.0


# =============================================================================
# 3. HAMILTON-HARE LARGEST REMAINDER METHOD (LAW 22-09 ART. 715 BIS 30)
# =============================================================================

def test_hamilton_hare_exact_equity_conservation(clean_engine):
    """
    Test Hamilton-Hare allocation across 5 retail backers with complex fractional quotas.
    Verifies the Zero-Loss Invariant: sum(discretized) == total_legal_shares.
    """
    total_legal_shares = 1000
    pledges = [
        {"investorId": "retail_1", "amountDzd": 175432},
        {"investorId": "retail_2", "amountDzd": 283120},
        {"investorId": "retail_3", "amountDzd": 91845},
        {"investorId": "retail_4", "amountDzd": 412903},
        {"investorId": "retail_5", "amountDzd": 36700},
    ]

    res = clean_engine.allocate_nominee_units(total_legal_shares, pledges)

    assert res.totalNomineeShares == 1000
    assert res.exactZeroLossInvariantVerified is True
    assert res.unallocatedShares == 0

    allocated_shares_sum = sum(a.discretizedShares for a in res.allocations)
    assert allocated_shares_sum == 1000

    # Ensure ownership percentages sum to 100%
    pct_sum = sum(a.ownershipPct for a in res.allocations)
    assert abs(pct_sum - 100.0) < 0.01


def test_hamilton_hare_equal_remainders_deterministic_tiebreak(clean_engine):
    """Test deterministic allocation when remainders are identical."""
    total_legal_shares = 10
    # 3 investors contributing exactly identical amounts
    pledges = [
        {"investorId": "backer_A", "amountDzd": 10000},
        {"investorId": "backer_B", "amountDzd": 10000},
        {"investorId": "backer_C", "amountDzd": 10000},
    ]
    res = clean_engine.allocate_nominee_units(total_legal_shares, pledges)

    # 10 / 3 = 3.3333 shares each -> integer floor is 3 each (9 total), deficit is 1 share.
    # Total must equal 10 exactly.
    assert sum(a.discretizedShares for a in res.allocations) == 10
    assert res.exactZeroLossInvariantVerified is True


def test_hamilton_hare_edge_cases(clean_engine):
    """Test single backer and empty pledges."""
    # Single backer takes 100%
    res1 = clean_engine.allocate_nominee_units(500, [{"investorId": "solo", "amountDzd": 500000}])
    assert res1.allocations[0].discretizedShares == 500
    assert res1.allocations[0].ownershipPct == 100.0

    # Zero shares or empty
    res2 = clean_engine.allocate_nominee_units(0, [])
    assert res2.exactZeroLossInvariantVerified is True


# =============================================================================
# 4. LIQUIDATION WATERFALL ENGINE (CARTA-GRADE)
# =============================================================================

def test_waterfall_preferred_liquidation_preference_payout(clean_engine):
    """
    Test liquidation waterfall in a modest exit:
    Preferred shareholders receive their 1.0x liquidation preference before Common gets anything.
    """
    startup_id = "startup-exit-01"
    clean_engine.get_or_create_cap_table(startup_id)

    # Setup: 100k Ordinary shares (Founders, 10M DZD invested)
    # 50k Preferred A shares (VC, 20M DZD invested, 1.0x non-participating preference)
    pref_req = ShareClassCreateRequest(
        className=ShareClassType.PREFERENCE_A,
        parValueDzd=400.0,
        authorizedShares=50000,
        liquidationPreferenceMultiple=1.0,
        liquidationType=LiquidationPreferenceType.NON_PARTICIPATING,
        seniority=1,
    )
    pref_class = clean_engine.add_share_class(startup_id, pref_req)
    vc_stakeholder = clean_engine.add_stakeholder(startup_id, StakeholderCreateRequest(name="VC Fund", role=StakeholderRole.INVESTOR_VC))

    clean_engine.issue_shares(startup_id, ShareIssuanceCreateRequest(
        classId=pref_class.classId,
        stakeholderId=vc_stakeholder.stakeholderId,
        sharesIssued=50000,
        issuePriceDzd=400.0,
    ))

    # Exit Valuation: 25,000,000 DZD
    # VC liquidation preference: 50,000 * 400 = 20,000,000 DZD
    # If VC converts to common (50k / 150k = 33.3% of 25M = 8.33M DZD) -> VC takes 20M preference!
    # Residual for Common: 5,000,000 DZD
    wf_req = WaterfallSimulateRequest(
        exitValuationDzd=25000000,
        debtAmountDzd=0,
    )
    res = clean_engine.simulate_waterfall(wf_req, startup_id=startup_id)

    assert res.exitValuationDzd == 25000000
    pref_payout = next(p for p in res.classPayouts if p.className == "PREFERENCE_A")
    ord_payout = next(p for p in res.classPayouts if p.className == "ORDINAIRE")

    assert pref_payout.totalPayoutDzd == 20000000.0
    assert pref_payout.convertedToOrdinary is False
    assert pref_payout.moic == 1.0

    assert ord_payout.totalPayoutDzd == 5000000.0


def test_waterfall_high_exit_preferred_converts_to_ordinary(clean_engine):
    """
    Test liquidation waterfall in a high exit:
    Non-participating preferred converts to Ordinary because pro-rata share exceeds 1.0x preference.
    """
    startup_id = "startup-exit-02"
    clean_engine.get_or_create_cap_table(startup_id)

    pref_req = ShareClassCreateRequest(
        className=ShareClassType.PREFERENCE_A,
        parValueDzd=400.0,
        authorizedShares=50000,
        liquidationPreferenceMultiple=1.0,
        liquidationType=LiquidationPreferenceType.NON_PARTICIPATING,
        seniority=1,
    )
    pref_class = clean_engine.add_share_class(startup_id, pref_req)
    vc_stakeholder = clean_engine.add_stakeholder(startup_id, StakeholderCreateRequest(name="VC Fund", role=StakeholderRole.INVESTOR_VC))

    clean_engine.issue_shares(startup_id, ShareIssuanceCreateRequest(
        classId=pref_class.classId,
        stakeholderId=vc_stakeholder.stakeholderId,
        sharesIssued=50000,
        issuePriceDzd=400.0,
    ))

    # Exit Valuation: 300,000,000 DZD (300M DZD)
    # Total shares: 150k (100k Ordinary, 50k Preferred)
    # VC as-converted: 50k / 150k = 33.33% of 300M = 100M DZD > 20M preference -> Converts!
    wf_req = WaterfallSimulateRequest(
        exitValuationDzd=300000000,
        debtAmountDzd=0,
    )
    res = clean_engine.simulate_waterfall(wf_req, startup_id=startup_id)

    pref_payout = next(p for p in res.classPayouts if p.className == "PREFERENCE_A")
    assert pref_payout.convertedToOrdinary is True
    assert abs(pref_payout.totalPayoutDzd - 100000000.0) < 1.0
    assert pref_payout.moic == 5.0 # 100M / 20M = 5.0x


def test_waterfall_participating_preferred_double_dip(clean_engine):
    """Test Participating Preferred: receives 1.0x preference PLUS pro-rata share of residual proceeds."""
    startup_id = "startup-exit-03"
    clean_engine.get_or_create_cap_table(startup_id)

    pref_req = ShareClassCreateRequest(
        className=ShareClassType.PREFERENCE_B,
        parValueDzd=100.0,
        authorizedShares=50000,
        liquidationPreferenceMultiple=1.0,
        liquidationType=LiquidationPreferenceType.PARTICIPATING,
        seniority=1,
    )
    pref_class = clean_engine.add_share_class(startup_id, pref_req)
    vc = clean_engine.add_stakeholder(startup_id, StakeholderCreateRequest(name="Aggressive VC", role=StakeholderRole.INVESTOR_VC))
    clean_engine.issue_shares(startup_id, ShareIssuanceCreateRequest(
        classId=pref_class.classId,
        stakeholderId=vc.stakeholderId,
        sharesIssued=50000,
        issuePriceDzd=100.0,
    ))

    # Exit Valuation: 50,000,000 DZD
    # Pref Invested: 5M DZD. Preference: 5M DZD.
    # Remaining proceeds: 45M DZD.
    # Total participating shares: 100k ord + 50k pref = 150k shares.
    # Pref participation: 50k / 150k * 45M = 15M DZD.
    # Total Pref Payout: 5M (preference) + 15M (participation) = 20M DZD.
    wf_req = WaterfallSimulateRequest(
        exitValuationDzd=50000000,
        debtAmountDzd=0,
    )
    res = clean_engine.simulate_waterfall(wf_req, startup_id=startup_id)

    pref_payout = next(p for p in res.classPayouts if p.className == "PREFERENCE_B")
    assert pref_payout.preferencePayoutDzd == 5000000.0
    assert abs(pref_payout.participationPayoutDzd - 15000000.0) < 1.0
    assert abs(pref_payout.totalPayoutDzd - 20000000.0) < 1.0
    assert pref_payout.moic == 4.0 # 20M / 5M = 4.0x


# =============================================================================
# 5. NOMINEE SPAS & PORTAGE CONVENTION (LAW 22-09 & CIVIL CODE 571)
# =============================================================================

def test_execute_nominee_crowd_pooling(clean_engine):
    """
    Test pooling hundreds of retail investors into a single legal Nominee SPAS line-item.
    Verifies CNRC Notarial Summary Certificate and SHA-256 fingerprint generation.
    """
    startup_id = "startup-pool-01"
    clean_engine.get_or_create_cap_table(startup_id, "Algerian AI SPAS")

    req = NomineePoolRequest(
        startupId=startup_id,
        totalLegalShares=5000,
        pledges=[
            PledgeItem(investorId=f"backer_{i}", amountDzd=20000)
            for i in range(50)
        ], # 50 backers investing 20,000 DZD = 1,000,000 DZD total
        nomineeSpasName="TamWheel Nominee SPAS I",
        parValueDzd=100.0,
    )
    res = clean_engine.execute_nominee_pooling(req)

    assert res.statutoryIssuanceId is not None
    assert res.nomineeAllocation.totalNomineeShares == 5000
    assert res.nomineeAllocation.totalNomineeAmountDzd == 1000000
    assert res.nomineeAllocation.exactZeroLossInvariantVerified is True

    # Check CNRC filing manifest
    manifest = res.cnrcManifest
    assert manifest.nomineeSpasName == "TamWheel Nominee SPAS I"
    assert manifest.legalSharesCount == 5000
    assert manifest.beneficialOwnersCount == 50
    assert len(manifest.ledgerSha256) == 64 # SHA-256 length
    assert "CONVENTION DE PORTAGE" in manifest.notarialCertificateText
    assert "Article 715 bis 30" in manifest.notarialCertificateText

    # Cap table summary must now include the Nominee SPAS line-item
    summary = clean_engine.get_cap_table_summary(startup_id)
    assert any(s.role == "NOMINEE_SPAS" for s in summary.stakeholders)

    # Verify retrieval of sub-ledger
    ledger = clean_engine.get_nominee_ledger(res.statutoryIssuanceId)
    assert ledger is not None
    assert len(ledger.allocations) == 50


# =============================================================================
# 6. BSA-AIR CONTRACT GENERATOR
# =============================================================================

def test_generate_bsa_air_warrant_contract(clean_engine):
    """Test generating a standardized Algerian Law 22-09 SPAS BSA-AIR contract."""
    req = BsaAirGenerateRequest(
        startupName="Sovereign AI Labs",
        startupRcNumber="16/00-9876543B23",
        startupWilaya=16, # Alger
        investorName="Amine Benali",
        investorNifOrNin="198716001234567890",
        principalAmountDzd=5000000,
        valuationCapDzd=50000000,
        valuationFloorDzd=25000000,
        discountRate=0.20,
        qualifiedRoundThresholdDzd=20000000,
        maturityMonths=18,
        hasMfnClause=True,
    )
    contract = clean_engine.generate_bsa_air_contract(req)

    assert contract.contractId.startswith("BSA-AIR-")
    assert len(contract.contractHashSha256) == 64
    assert "Loi n° 22-09" in contract.governingLaw

    # Verify Markdown contains key legal clauses
    md = contract.contractMarkdown
    assert "Sovereign AI Labs" in md
    assert "Amine Benali" in md
    assert "5,000,000 DZD" in md
    assert "50,000,000 DZD" in md
    assert "25,000,000 DZD" in md
    assert "20%" in md
    assert "Nation la Plus Favorisée" in md
    assert "Code Civil" in md


# =============================================================================
# 7. FASTAPI ROUTER HTTP ENDPOINTS
# =============================================================================

@pytest.mark.asyncio
async def test_router_get_cap_table(clean_engine):
    """Test GET /api/v1/startups/{startup_id}/cap-table endpoint."""
    startup_id = "test-api-startup-01"
    clean_engine.get_or_create_cap_table(startup_id, "API Test SPAS")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/api/v1/startups/{startup_id}/cap-table")
        assert resp.status_code == 200
        data = resp.json()
        assert data["companyName"] == "API Test SPAS"
        assert data["totalAuthorizedShares"] == 100000


@pytest.mark.asyncio
async def test_router_dilution_and_waterfall(clean_engine):
    """Test POST simulation endpoints for dilution and exit waterfall."""
    startup_id = "test-api-startup-02"
    clean_engine.get_or_create_cap_table(startup_id)

    csrf_token = "test_csrf_token_value_32_chars_123"
    headers = {"x-csrf-token": csrf_token}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        # 1. Dilution
        dil_resp = await client.post(
            f"/api/v1/startups/{startup_id}/cap-table/simulate-dilution",
            json={
                "preMoneyValuationDzd": 40000000,
                "investmentAmountDzd": 10000000,
                "preMoneyShares": 100000,
            },
            headers=headers,
        )
        assert dil_resp.status_code == 200
        dil_data = dil_resp.json()
        assert dil_data["postMoneyValuationDzd"] == 50000000
        assert dil_data["newSharesIssued"] == 25000

        # 2. Waterfall
        wf_resp = await client.post(
            f"/api/v1/startups/{startup_id}/cap-table/simulate-waterfall",
            json={
                "exitValuationDzd": 100000000,
                "debtAmountDzd": 0,
            },
            headers=headers,
        )
        assert wf_resp.status_code == 200
        wf_data = wf_resp.json()
        assert wf_data["exitValuationDzd"] == 100000000
        assert len(wf_data["classPayouts"]) >= 1


@pytest.mark.asyncio
async def test_router_nominee_pool_and_bsa_contract(clean_engine):
    """Test POST endpoints for nominee crowd pooling and BSA-AIR contract generation."""
    startup_id = "test-api-startup-03"
    clean_engine.get_or_create_cap_table(startup_id, "Nominee Test SPAS")

    csrf_token = "test_csrf_token_value_32_chars_123"
    headers = {"x-csrf-token": csrf_token}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        # 1. Nominee Pooling
        pool_resp = await client.post(
            f"/api/v1/startups/{startup_id}/cap-table/nominee/pool",
            json={
                "startupId": startup_id,
                "totalLegalShares": 1000,
                "pledges": [
                    {"investorId": "u1", "amountDzd": 50000},
                    {"investorId": "u2", "amountDzd": 50000},
                ],
                "nomineeSpasName": "TamWheel Nominee SPAS I",
            },
            headers=headers,
        )
        assert pool_resp.status_code == 201
        pool_data = pool_resp.json()
        issuance_id = pool_data["statutoryIssuanceId"]
        assert pool_data["cnrcManifest"]["beneficialOwnersCount"] == 2

        # 2. Get Nominee Ledger
        ledger_resp = await client.get(
            f"/api/v1/startups/{startup_id}/cap-table/nominee/{issuance_id}/ledger"
        )
        assert ledger_resp.status_code == 200
        ledger_data = ledger_resp.json()
        assert ledger_data["exactZeroLossInvariantVerified"] is True

        # 3. BSA-AIR Contract Generation
        bsa_resp = await client.post(
            f"/api/v1/startups/{startup_id}/cap-table/bsa-air/generate-contract",
            json={
                "startupName": "Nominee Test SPAS",
                "investorName": "Fatima Zohra",
                "principalAmountDzd": 2000000,
                "valuationCapDzd": 20000000,
                "discountRate": 0.20,
            },
            headers=headers,
        )
        assert bsa_resp.status_code == 200
        bsa_data = bsa_resp.json()
        assert len(bsa_data["contractHashSha256"]) == 64
        assert "Fatima Zohra" in bsa_data["contractMarkdown"]
