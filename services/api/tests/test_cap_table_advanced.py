"""
Advanced Integration Tests for TamWheel Cap-Table & Venture Infrastructure (Phase 2 Expansion).
Tests:
- Secondary Liquidity Engine: Quarterly windows, Uniform-Price Dutch Auction price discovery,
  pro-rata rationing, 1.5% platform transaction fee, 5.0% profit carry, CIDTA Art. 169 tax exemption.
- Dual-Entity Cap-Table Mirror: Cross-border ADGM / Delaware / DIFC HoldCo holding Algerian SPAS OpCo,
  hard-currency diaspora shares (USD/EUR), fixed FX exchange parity, and parity verification.
- ESOP Vesting Engine: 48-month schedule, 12-month cliff (25%), monthly linear progression,
  single-trigger vs. double-trigger change-of-control acceleration, option exercise, and cap-table conversion.
- FastAPI Router Endpoints: HTTP tests for all secondary liquidity, mirror, and ESOP endpoints.
"""

from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.services.cap_table import (
    CapTableEngine,
    SecondaryLiquidityEngine,
    DualEntityCapTableMirror,
    ESOPVestingEngine,
)
from app.schemas.cap_table import (
    ShareClassType,
    LiquidityWindowCreateRequest,
    SellerOrderRequest,
    HoldCoJurisdiction,
    HoldCoMirrorSetupRequest,
    HoldCoShareIssuanceRequest,
    AccelerationType,
    EsopGrantCreateRequest,
    EsopExerciseRequest,
)


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
def clean_advanced_engines():
    CapTableEngine._registry.clear()
    SecondaryLiquidityEngine._windows.clear()
    DualEntityCapTableMirror._mirrors.clear()
    ESOPVestingEngine._grants.clear()
    return {
        "cap_table": CapTableEngine,
        "secondary": SecondaryLiquidityEngine,
        "mirror": DualEntityCapTableMirror,
        "esop": ESOPVestingEngine,
    }


# =============================================================================
# 1. SECONDARY LIQUIDITY & UNIFORM-PRICE DUTCH AUCTION TESTS
# =============================================================================

def test_secondary_liquidity_window_creation(clean_advanced_engines):
    """Test creating a quarterly private secondary liquidity window."""
    secondary = clean_advanced_engines["secondary"]
    req = LiquidityWindowCreateRequest(
        quarter="2026-Q4",
        minPriceDzd=300.0,
        maxPriceDzd=600.0,
        buyerPoolAvailableDzd=5000000.0, # 5M DZD pool
        openDate="2026-10-01",
        closeDate="2026-10-25",
    )
    window = secondary.create_liquidity_window("startup-sec-01", req)

    assert window["quarter"] == "2026-Q4"
    assert window["status"] == "OPEN"
    assert window["minPriceDzd"] == 300.0
    assert window["maxPriceDzd"] == 600.0
    assert window["buyerPoolAvailableDzd"] == 5000000.0


def test_secondary_order_outside_price_bounds_rejected(clean_advanced_engines):
    """Test that tender orders with reserve prices outside [minPrice, maxPrice] are rejected."""
    secondary = clean_advanced_engines["secondary"]
    req = LiquidityWindowCreateRequest(
        quarter="2026-Q4",
        minPriceDzd=300.0,
        maxPriceDzd=500.0,
        buyerPoolAvailableDzd=2000000.0,
        openDate="2026-10-01",
        closeDate="2026-10-25",
    )
    window = secondary.create_liquidity_window("startup-sec-02", req)
    win_id = window["windowId"]

    # Order at 600 DZD (above max 500)
    order_req = SellerOrderRequest(
        sellerId="emp-01",
        sharesOffered=500,
        minPricePerShareDzd=600.0,
        costBasisPerShareDzd=100.0,
    )
    with pytest.raises(ValueError, match="outside the statutory range"):
        secondary.submit_seller_order(win_id, order_req)


def test_uniform_price_dutch_auction_clearing_and_fees(clean_advanced_engines):
    """
    Test Uniform-Price Dutch Auction execution:
    - 3 sellers submit orders with different reserve prices.
    - Uniform price discovery: all clearing sellers receive the uniform clearing price.
    - Platform fee: 1.5% of gross volume.
    - Profit carry: 5.0% of realized capital gains.
    """
    secondary = clean_advanced_engines["secondary"]
    req = LiquidityWindowCreateRequest(
        quarter="2026-Q4",
        minPriceDzd=200.0,
        maxPriceDzd=800.0,
        buyerPoolAvailableDzd=2500000.0, # 2.5M DZD pool
        openDate="2026-10-01",
        closeDate="2026-10-25",
    )
    window = secondary.create_liquidity_window("startup-sec-03", req)
    win_id = window["windowId"]

    # Seller 1: 1,000 shares @ 400 DZD (Cost basis: 100 DZD)
    secondary.submit_seller_order(win_id, SellerOrderRequest(
        sellerId="seller-1",
        sharesOffered=1000,
        minPricePerShareDzd=400.0,
        costBasisPerShareDzd=100.0,
        isReinvestmentExemptCidta169=True,
    ))
    # Seller 2: 2,000 shares @ 500 DZD (Cost basis: 150 DZD)
    secondary.submit_seller_order(win_id, SellerOrderRequest(
        sellerId="seller-2",
        sharesOffered=2000,
        minPricePerShareDzd=500.0,
        costBasisPerShareDzd=150.0,
        isReinvestmentExemptCidta169=False,
    ))
    # Seller 3: 2,000 shares @ 750 DZD (Cost basis: 200 DZD)
    secondary.submit_seller_order(win_id, SellerOrderRequest(
        sellerId="seller-3",
        sharesOffered=2000,
        minPricePerShareDzd=750.0,
        costBasisPerShareDzd=200.0,
        isReinvestmentExemptCidta169=False,
    ))

    # At P=400: supply=1,000, cost=400k <= 2.5M
    # At P=500: supply=1,000+2,000=3,000, cost=3,000*500 = 1.5M <= 2.5M
    # At P=750: supply=5,000, cost=5,000*750 = 3.75M > 2.5M
    # Clearing price P* = 500.0 DZD!
    clear_res = secondary.clear_uniform_price_auction(win_id)

    assert clear_res.clearingPriceDzd == 500.0
    assert clear_res.clearingStatus == "CLEARED_UNIFORM_PRICE"
    assert clear_res.totalSharesTransacted == 3000

    # Total gross volume: 3,000 * 500 = 1,500,000 DZD
    assert clear_res.totalGrossVolumeDzd == 1500000.0

    # 1.5% platform fee on 1.5M = 22,500 DZD
    assert clear_res.totalPlatformFeesDzd == 22500.0

    # Seller 1 sold 1,000 shares @ 500 (Gross: 500k)
    s1_res = next(o for o in clear_res.settledOrders if o.sellerId == "seller-1")
    assert s1_res.sharesSold == 1000
    assert s1_res.clearingPriceDzd == 500.0
    assert s1_res.grossProceedsDzd == 500000.0
    assert s1_res.platformFeeDzd == 7500.0 # 1.5% of 500k
    # Capital gain: (500 - 100) * 1000 = 400,000 DZD
    assert s1_res.capitalGainDzd == 400000.0
    # 5.0% profit carry on 400k = 20,000 DZD
    assert s1_res.profitCarryDzd == 20000.0
    # Net payout = 500,000 - 7,500 - 20,000 = 472,500 DZD
    assert s1_res.netPayoutDzd == 472500.0
    assert s1_res.cidtaExemptionApplied is True

    # Seller 3 bid 750 DZD (above clearing price 500) -> 0 shares sold
    s3_res = next(o for o in clear_res.settledOrders if o.sellerId == "seller-3")
    assert s3_res.sharesSold == 0
    assert s3_res.grossProceedsDzd == 0.0


# =============================================================================
# 2. DUAL-ENTITY CROSS-BORDER HOLDCO-OPCO MIRROR TESTS
# =============================================================================

def test_dual_entity_cross_border_setup_and_parity(clean_advanced_engines):
    """
    Test setting up an offshore HoldCo mirror (ADGM) holding 100% of an Algerian SPAS OpCo.
    Verifies fixed FX exchange parity (USD to DZD) and cross-border cap-table parity.
    """
    mirror_engine = clean_advanced_engines["mirror"]
    startup_id = "opco-spas-alg-10"

    req = HoldCoMirrorSetupRequest(
        holdcoName="TamWheel Ventures Ltd (ADGM)",
        jurisdiction=HoldCoJurisdiction.ADGM,
        holdcoRegistrationNumber="ADGM-REG-2026-994",
        currency="USD",
        fxExchangeRateToDzd=135.0, # 1 USD = 135 DZD
        totalAuthorizedShares=1000000,
        parValueForeign=0.01,
    )
    res = mirror_engine.setup_mirror(startup_id, req)

    assert res.holdcoName == "TamWheel Ventures Ltd (ADGM)"
    assert res.jurisdiction == "ADGM"
    assert res.currency == "USD"
    assert res.fxExchangeRateToDzd == 135.0
    assert res.mirrorParityVerified is True
    assert "Reg. 07-01" in res.regulatoryComplianceNote


def test_dual_entity_issue_diaspora_shares(clean_advanced_engines):
    """
    Test issuing hard-currency shares in ADGM HoldCo to diaspora investors (e.g. France, UAE)
    and calculating implied DZD valuation at parity.
    """
    mirror_engine = clean_advanced_engines["mirror"]
    startup_id = "opco-spas-alg-11"

    mirror_engine.setup_mirror(startup_id, HoldCoMirrorSetupRequest(
        holdcoName="Algeria Tech HoldCo Ltd (ADGM)",
        jurisdiction=HoldCoJurisdiction.ADGM,
        holdcoRegistrationNumber="ADGM-REG-101",
        currency="USD",
        fxExchangeRateToDzd=135.0,
    ))

    # Issue 10,000 Preferred shares to Diaspora Angel in France @ $10.00/share = $100,000 USD
    iss_req = HoldCoShareIssuanceRequest(
        stakeholderId="diaspora-paris-01",
        stakeholderName="Karim Mansouri",
        diasporaCountry="France",
        sharesIssued=10000,
        shareClass="Series Seed Preferred USD",
        issuePriceForeign=10.0,
    )
    status = mirror_engine.issue_holdco_shares(startup_id, iss_req)

    assert status.totalHoldCoShares == 10000
    assert status.impliedValuationForeign == 100000.0 # $100,000 USD
    # Implied DZD valuation: $100,000 * 135 = 13,500,000 DZD
    assert status.impliedValuationDzd == 13500000.0
    assert len(status.diasporaHolders) == 1
    assert status.diasporaHolders[0]["country"] == "France"


# =============================================================================
# 3. ESOP / BSPCE VESTING & DOUBLE-TRIGGER ACCELERATION TESTS
# =============================================================================

def test_esop_vesting_schedule_cliff_and_progression(clean_advanced_engines):
    """
    Test standard 48-month statutory vesting with 12-month cliff (25% cliff vest):
    - Month 6: 0% vested (cliff not reached).
    - Month 12: 25% (12/48) vested.
    - Month 24: 50% (24/48) vested.
    - Month 48: 100% (48/48) vested.
    """
    esop = clean_advanced_engines["esop"]
    grant_req = EsopGrantCreateRequest(
        employeeId="emp-tech-lead-01",
        employeeName="Yacine Cherif",
        optionsGranted=48000,
        strikePriceDzd=100.0,
        grantDate="2024-01-01",
        vestingScheduleMonths=48,
        cliffMonths=12,
        accelerationClause=AccelerationType.DOUBLE_TRIGGER,
    )
    grant = esop.create_grant("startup-esop-01", grant_req)
    g_id = grant["grantId"]

    # 1. At 6 months (2024-07-01) -> Cliff not reached
    s6 = esop.calculate_vesting(g_id, as_of_date="2024-07-01", current_fmv_dzd=250.0)
    assert s6.monthsElapsed == 6
    assert s6.cliffReached is False
    assert s6.vestedOptions == 0
    assert s6.unvestedOptions == 48000
    assert s6.intrinsicValueDzd == 0.0

    # 2. At 12 months (2025-01-01) -> Exactly 25% cliff vest = 12,000 options
    s12 = esop.calculate_vesting(g_id, as_of_date="2025-01-01", current_fmv_dzd=250.0)
    assert s12.monthsElapsed == 12
    assert s12.cliffReached is True
    assert s12.vestedOptions == 12000
    assert s12.vestedPercentage == 25.0
    # Intrinsic value: (250 - 100) * 12,000 = 1,800,000 DZD
    assert s12.intrinsicValueDzd == 1800000.0

    # 3. At 24 months (2026-01-01) -> 50% vest = 24,000 options
    s24 = esop.calculate_vesting(g_id, as_of_date="2026-01-01", current_fmv_dzd=300.0)
    assert s24.monthsElapsed == 24
    assert s24.vestedOptions == 24000
    assert s24.vestedPercentage == 50.0

    # 4. At 48 months (2028-01-01) -> 100% vest = 48,000 options
    s48 = esop.calculate_vesting(g_id, as_of_date="2028-01-01", current_fmv_dzd=500.0)
    assert s48.monthsElapsed == 48
    assert s48.vestedOptions == 48000
    assert s48.vestedPercentage == 100.0


def test_esop_double_trigger_acceleration(clean_advanced_engines):
    """
    Test double-trigger acceleration logic:
    - Trigger 1 alone (Change of Control): NO acceleration occurs.
    - Trigger 1 + Trigger 2 (Change of Control + Involuntary Termination): 100% acceleration!
    """
    esop = clean_advanced_engines["esop"]
    grant = esop.create_grant("startup-esop-02", EsopGrantCreateRequest(
        employeeId="emp-02",
        employeeName="Samir B.",
        optionsGranted=24000,
        strikePriceDzd=150.0,
        grantDate="2026-01-01",
        vestingScheduleMonths=48,
        cliffMonths=12,
        accelerationClause=AccelerationType.DOUBLE_TRIGGER,
    ))
    g_id = grant["grantId"]

    # At Month 6, company is acquired (Change of Control only)
    s_coc = esop.apply_acceleration(g_id, is_change_of_control=True, is_involuntary_termination=False)
    assert s_coc.accelerationApplied is False
    assert s_coc.vestedOptions == 0 # Cliff still not reached, employee keeps vesting under acquirer

    # 2 months later, acquirer eliminates role (Involuntary Termination -> Trigger 2)
    s_double = esop.apply_acceleration(g_id, is_change_of_control=True, is_involuntary_termination=True)
    assert s_double.accelerationApplied is True
    assert s_double.vestedOptions == 24000 # All 24,000 options accelerate immediately!
    assert s_double.vestedPercentage == 100.0


def test_esop_exercise_options_and_cap_table_issuance(clean_advanced_engines):
    """Test exercising vested options and ensuring statutory shares are recorded."""
    esop = clean_advanced_engines["esop"]
    cap_table = clean_advanced_engines["cap_table"]
    startup_id = "startup-esop-03"
    cap_table.get_or_create_cap_table(startup_id)

    grant = esop.create_grant(startup_id, EsopGrantCreateRequest(
        employeeId="emp-03",
        employeeName="Nadia L.",
        optionsGranted=10000,
        strikePriceDzd=50.0,
        grantDate="2024-01-01", # 2+ years ago -> fully vested
        vestingScheduleMonths=48,
        cliffMonths=12,
    ))
    g_id = grant["grantId"]

    # Exercise 4,000 options
    ex_res = esop.exercise_options(g_id, EsopExerciseRequest(
        optionsToExercise=4000,
        paymentMethod="CASH",
    ))

    assert ex_res["optionsExercised"] == 4000
    assert ex_res["totalCostDzd"] == 4000 * 50.0 # 200,000 DZD
    assert ex_res["remainingExercisable"] > 0

    # Ensure employee now has shares on cap table
    summary = cap_table.get_cap_table_summary(startup_id)
    assert any(s.stakeholderId == "emp-03" for s in summary.stakeholders)


# =============================================================================
# 4. FASTAPI HTTP ROUTER INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_router_secondary_liquidity_lifecycle(clean_advanced_engines):
    """Test HTTP endpoints for creating window, submitting seller order, and clearing auction."""
    startup_id = "test-sec-http-01"
    clean_advanced_engines["cap_table"].get_or_create_cap_table(startup_id)

    csrf_token = "test_csrf_token_value_32_chars_123"
    headers = {"x-csrf-token": csrf_token}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)

        # 1. Create Window
        win_resp = await client.post(
            f"/api/v1/startups/{startup_id}/secondary/windows",
            json={
                "quarter": "2026-Q4",
                "minPriceDzd": 200.0,
                "maxPriceDzd": 500.0,
                "buyerPoolAvailableDzd": 1000000.0,
                "openDate": "2026-10-01",
                "closeDate": "2026-10-25",
            },
            headers=headers,
        )
        assert win_resp.status_code == 201
        win_data = win_resp.json()
        win_id = win_data["windowId"]

        # 2. Submit Seller Order
        ord_resp = await client.post(
            f"/api/v1/startups/{startup_id}/secondary/windows/{win_id}/orders",
            json={
                "sellerId": "seller-http-1",
                "sharesOffered": 1000,
                "minPricePerShareDzd": 300.0,
                "costBasisPerShareDzd": 100.0,
                "isReinvestmentExemptCidta169": True,
            },
            headers=headers,
        )
        assert ord_resp.status_code == 201

        # 3. Clear Auction
        clear_resp = await client.post(
            f"/api/v1/startups/{startup_id}/secondary/windows/{win_id}/clear",
            headers=headers,
        )
        assert clear_resp.status_code == 200
        clear_data = clear_resp.json()
        assert clear_data["clearingPriceDzd"] == 300.0
        assert clear_data["totalSharesTransacted"] == 1000
        assert clear_data["totalPlatformFeesDzd"] == 4500.0 # 1.5% of 300,000 DZD


@pytest.mark.asyncio
async def test_router_cross_border_mirror_endpoints(clean_advanced_engines):
    """Test HTTP endpoints for setting up HoldCo mirror and issuing diaspora shares."""
    startup_id = "test-mirror-http-01"
    clean_advanced_engines["cap_table"].get_or_create_cap_table(startup_id)

    csrf_token = "test_csrf_token_value_32_chars_123"
    headers = {"x-csrf-token": csrf_token}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)

        # 1. Setup Mirror
        setup_resp = await client.post(
            f"/api/v1/startups/{startup_id}/mirror/setup",
            json={
                "holdcoName": "TamWheel Global Ltd",
                "jurisdiction": "ADGM",
                "holdcoRegistrationNumber": "ADGM-2026-88",
                "currency": "USD",
                "fxExchangeRateToDzd": 135.0,
            },
            headers=headers,
        )
        assert setup_resp.status_code == 201
        data = setup_resp.json()
        assert data["jurisdiction"] == "ADGM"

        # 2. Issue Diaspora Shares
        iss_resp = await client.post(
            f"/api/v1/startups/{startup_id}/mirror/shares",
            json={
                "stakeholderId": "diaspora-user-01",
                "stakeholderName": "Ali H.",
                "diasporaCountry": "Canada",
                "sharesIssued": 5000,
                "shareClass": "Series Seed USD",
                "issuePriceForeign": 20.0,
            },
            headers=headers,
        )
        assert iss_resp.status_code == 201
        iss_data = iss_resp.json()
        assert iss_data["impliedValuationForeign"] == 100000.0 # 5000 * $20
        assert iss_data["impliedValuationDzd"] == 13500000.0


@pytest.mark.asyncio
async def test_router_esop_vesting_endpoints(clean_advanced_engines):
    """Test HTTP endpoints for ESOP grant creation, vesting calculation, acceleration, and exercise."""
    startup_id = "test-esop-http-01"
    clean_advanced_engines["cap_table"].get_or_create_cap_table(startup_id)

    csrf_token = "test_csrf_token_value_32_chars_123"
    headers = {"x-csrf-token": csrf_token}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)

        # 1. Create Grant
        grant_resp = await client.post(
            f"/api/v1/startups/{startup_id}/esop/grants",
            json={
                "employeeId": "emp-http-01",
                "employeeName": "Farid M.",
                "optionsGranted": 12000,
                "strikePriceDzd": 100.0,
                "grantDate": "2025-01-01",
                "vestingScheduleMonths": 48,
                "cliffMonths": 12,
                "accelerationClause": "DOUBLE_TRIGGER",
            },
            headers=headers,
        )
        assert grant_resp.status_code == 201
        grant_data = grant_resp.json()
        g_id = grant_data["grantId"]

        # 2. Query Vesting as of 2026-01-01 (12 months = 25% cliff vest = 3,000 options)
        vest_resp = await client.get(
            f"/api/v1/startups/{startup_id}/esop/grants/{g_id}/vesting?as_of_date=2026-01-01&current_fmv_dzd=300.0"
        )
        assert vest_resp.status_code == 200
        v_data = vest_resp.json()
        assert v_data["vestedOptions"] == 3000
        assert v_data["cliffReached"] is True

        # 3. Double-Trigger Acceleration (Change of Control + Involuntary Termination)
        acc_resp = await client.post(
            f"/api/v1/startups/{startup_id}/esop/grants/{g_id}/accelerate?is_change_of_control=true&is_involuntary_termination=true",
            headers=headers,
        )
        assert acc_resp.status_code == 200
        acc_data = acc_resp.json()
        assert acc_data["accelerationApplied"] is True
        assert acc_data["vestedOptions"] == 12000

        # 4. Exercise Options
        ex_resp = await client.post(
            f"/api/v1/startups/{startup_id}/esop/grants/{g_id}/exercise",
            json={
                "optionsToExercise": 2000,
                "paymentMethod": "CASH",
            },
            headers=headers,
        )
        assert ex_resp.status_code == 200
        ex_data = ex_resp.json()
        assert ex_data["optionsExercised"] == 2000
        assert ex_data["totalCostDzd"] == 200000.0
