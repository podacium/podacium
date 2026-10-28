"""
Comprehensive Test Suite for Syndicate SPV Management, Multi-Tier Carry Waterfalls,
Pro-Rata Anti-Dilution Calculations, and Multi-Dimensional ZOPA Telemetry.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.syndicate_engine import (
    syndicate_deal_engine,
    SyndicateSPV,
    SyndicateMember,
    CarryWaterfallRequest,
    ProRataCalculationRequest,
    SPVStatus,
)
from app.services.zopa_telemetry import (
    zopa_telemetry_generator,
)
from app.services.maut_negotiation import (
    maut_negotiation_engine,
    DealOffer,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


@pytest.fixture
def sample_members():
    return [
        SyndicateMember(
            member_id="lead-001",
            full_name="Amine B. (Lead Partner)",
            email="amine@tamwheel.dz",
            pledged_amount_dzd=5_000_000.0,
            is_lead=True,
        ),
        SyndicateMember(
            member_id="lp-002",
            full_name="Fatima Z. (Angel LP)",
            email="fatima@algeria-tech.com",
            pledged_amount_dzd=3_000_000.0,
            is_lead=False,
        ),
        SyndicateMember(
            member_id="lp-003",
            full_name="Karim M. (Diaspora LP)",
            email="karim@diaspora-paris.fr",
            pledged_amount_dzd=2_000_000.0,
            is_lead=False,
        ),
    ]


# =============================================================================
# 1. SYNDICATE SPV CREATION & MEMBERSHIP TESTS
# =============================================================================

class TestSyndicateFormation:
    """Test suite for AngelList-style SPV syndicate creation and member allocations."""

    def test_create_syndicate_spv(self):
        spv = syndicate_deal_engine.create_syndicate(
            startup_name="Oran BioLogistics",
            deal_round="Seed",
            target_raise_dzd=20_000_000.0,
            min_allocation_dzd=500_000.0,
            lead_investor_id="lead-123",
            lead_name="Yacine K.",
            lead_carry_pct=15.0,
            platform_carry_pct=5.0,
            hurdle_rate_pct=7.0,
            backoffice_setup_fee_dzd=150_000.0,
            closing_days=45,
        )

        assert spv.spv_id is not None
        assert spv.startup_name == "Oran BioLogistics"
        assert spv.target_raise_dzd == 20_000_000.0
        assert spv.lead_carry_pct == 15.0
        assert spv.platform_carry_pct == 5.0
        assert spv.hurdle_rate_pct == 7.0
        assert spv.backoffice_setup_fee_dzd == 150_000.0
        assert spv.status == SPVStatus.OPEN
        assert len(spv.members) == 0

    def test_add_member_pledges_and_thresholds(self):
        spv = syndicate_deal_engine.create_syndicate(
            startup_name="Algeria FinAI",
            deal_round="Seed",
            target_raise_dzd=10_000_000.0,
            min_allocation_dzd=500_000.0,
            lead_investor_id="lead-456",
            lead_name="Meriem L.",
        )

        # Valid pledge
        updated_spv = syndicate_deal_engine.add_member_pledge(
            spv_id=spv.spv_id,
            member_id="lp-789",
            full_name="Omar T.",
            email="omar@dz-capital.dz",
            amount_dzd=1_000_000.0,
        )
        assert len(updated_spv.members) == 1
        assert updated_spv.total_pledged_dzd == 1_000_000.0
        assert updated_spv.net_invested_capital_dzd == 850_000.0  # 1M - 150k fee

        # Pledge below minimum ticket rejected
        with pytest.raises(ValueError) as exc:
            syndicate_deal_engine.add_member_pledge(
                spv_id=spv.spv_id,
                member_id="lp-999",
                full_name="Small Angel",
                email="small@dz.com",
                amount_dzd=200_000.0,  # Below 500k minimum
            )
        assert "below minimum ticket" in str(exc.value)


# =============================================================================
# 2. MULTI-TIER CARRY WATERFALL CALCULATOR TESTS
# =============================================================================

class TestCarryWaterfallCalculations:
    """Test suite for 3-tier carry waterfall exit distributions."""

    def test_healthy_venture_exit_3x(self, sample_members):
        # 10M invested, 30M exit after 4 years, 7% annual hurdle
        req = CarryWaterfallRequest(
            exit_proceeds_dzd=30_000_000.0,
            total_invested_capital_dzd=10_000_000.0,
            hurdle_rate_pct=7.0,
            holding_period_years=4.0,
            lead_carry_pct=15.0,
            platform_carry_pct=5.0,
            members=sample_members,
        )

        res = syndicate_deal_engine.calculate_waterfall(req)

        # Tier 1: 10M Capital fully returned to LPs
        assert res.tier1_capital_returned_dzd == 10_000_000.0
        assert res.tier1_shortfall_dzd == 0.0

        # Tier 2: 7% compound hurdle on 10M over 4 years = 10M * ((1.07)^4 - 1) ≈ 3,107,960.10 DZD
        expected_hurdle = 10_000_000.0 * (pow(1.07, 4) - 1.0)
        assert round(res.tier2_hurdle_target_dzd, 2) == round(expected_hurdle, 2)
        assert res.tier2_preferred_return_paid_dzd == round(expected_hurdle, 2)

        # Tier 3: Remaining profit after capital and hurdle: 30M - 10M - 3.108M = 16.892M DZD
        expected_profit = 30_000_000.0 - 10_000_000.0 - expected_hurdle
        assert round(res.tier3_distributable_profit_dzd, 2) == round(expected_profit, 2)

        # Carry split: 15% to Lead, 5% to TamWheel, 80% to LPs
        expected_lead_carry = expected_profit * 0.15
        expected_platform_carry = expected_profit * 0.05
        expected_lp_profit = expected_profit * 0.80

        assert round(res.lead_carry_amount_dzd, 2) == round(expected_lead_carry, 2)
        assert round(res.platform_carry_amount_dzd, 2) == round(expected_platform_carry, 2)
        assert round(res.lp_residual_profit_dzd, 2) == round(expected_lp_profit, 2)

        # Check total sums match exit proceeds
        total_payouts = res.total_lp_payout_dzd + res.total_lead_payout_dzd + res.total_platform_payout_dzd
        assert abs(total_payouts - 30_000_000.0) < 0.05

        # Performance metrics
        assert res.lp_blended_moic > 2.5
        assert res.lp_net_annual_irr_pct > 25.0
        assert len(res.per_member_ledger) == 3

        # Lead investor earns their LP share + 15% lead carry
        lead_member = next(m for m in res.per_member_ledger if m.is_lead)
        assert lead_member.lead_carry_earned_dzd == round(expected_lead_carry, 2)
        assert lead_member.total_distribution_dzd > lead_member.initial_pledge_dzd

    def test_breakeven_exit_no_carry(self, sample_members):
        # 10M invested, 10M exit (1.0x return): LPs get 100% capital back, zero carry
        req = CarryWaterfallRequest(
            exit_proceeds_dzd=10_000_000.0,
            total_invested_capital_dzd=10_000_000.0,
            hurdle_rate_pct=7.0,
            holding_period_years=3.0,
            members=sample_members,
        )

        res = syndicate_deal_engine.calculate_waterfall(req)
        assert res.tier1_capital_returned_dzd == 10_000_000.0
        assert res.tier1_shortfall_dzd == 0.0
        assert res.tier2_preferred_return_paid_dzd == 0.0
        assert res.tier3_distributable_profit_dzd == 0.0
        assert res.lead_carry_amount_dzd == 0.0
        assert res.platform_carry_amount_dzd == 0.0
        assert res.lp_blended_moic == 1.0
        assert res.lp_net_annual_irr_pct == 0.0

    def test_downside_partial_loss_exit(self, sample_members):
        # 10M invested, 4M exit (0.4x return): LPs get 4M, 6M shortfall, zero carry
        req = CarryWaterfallRequest(
            exit_proceeds_dzd=4_000_000.0,
            total_invested_capital_dzd=10_000_000.0,
            hurdle_rate_pct=8.0,
            holding_period_years=2.0,
            members=sample_members,
        )

        res = syndicate_deal_engine.calculate_waterfall(req)
        assert res.tier1_capital_returned_dzd == 4_000_000.0
        assert res.tier1_shortfall_dzd == 6_000_000.0
        assert res.tier2_preferred_return_paid_dzd == 0.0
        assert res.lead_carry_amount_dzd == 0.0
        assert res.platform_carry_amount_dzd == 0.0
        assert res.lp_blended_moic == 0.4
        assert res.lp_net_annual_irr_pct < 0.0


# =============================================================================
# 3. PRO-RATA RIGHTS & ANTI-DILUTION TESTS
# =============================================================================

class TestProRataRights:
    """Test suite for pro-rata rights calculation and capital call notices."""

    def test_pro_rata_rights_exercise_preserves_ownership(self, sample_members):
        # Investor owns 1,000,000 shares out of 10,000,000 (10% ownership)
        # Series A raises 50,000,000 DZD at 200,000,000 DZD pre-money
        req = ProRataCalculationRequest(
            current_shares_held=1_000_000,
            total_pre_round_shares=10_000_000,
            new_round_pre_money_dzd=200_000_000.0,
            new_round_target_raise_dzd=50_000_000.0,
            option_pool_expansion_pct=0.0,
            syndicate_members=sample_members,
        )

        res = syndicate_deal_engine.calculate_pro_rata(req)

        assert res.current_ownership_pct == 10.0
        assert res.new_round_post_money_dzd == 250_000_000.0
        assert res.share_price_new_round_dzd == 20.0  # 200M / 10M shares = 20 DZD/share

        # Pro-rata check = 10% * 50M = 5,000,000 DZD
        assert res.pro_rata_investment_required_dzd == 5_000_000.0
        assert res.new_shares_to_acquire == 250_000  # 5M / 20 DZD

        # Ownership with pro-rata exercised remains strictly 10.0%
        assert res.post_round_ownership_with_prorata_pct == 10.0

        # Ownership without pro-rata dilutes from 10.0% down to 8.0%
        # (1M shares / 12.5M total shares = 8.0%)
        assert res.post_round_ownership_without_prorata_pct == 8.0
        assert res.dilution_loss_pct == 2.0

        # Capital call notice validation
        notice = res.capital_call_notice
        assert notice.total_pro_rata_check_dzd == 5_000_000.0
        assert notice.payment_deadline_days == 10
        assert len(notice.per_member_allocations) == 3
        # Amine owns 50% of the syndicate (5M/10M), so pays 50% of 5M = 2.5M DZD
        assert notice.per_member_allocations["lead-001"] == 2_500_000.0


# =============================================================================
# 4. ZOPA MULTI-DIMENSIONAL TELEMETRY TESTS
# =============================================================================

class TestZOPATelemetryGenerator:
    """Test suite for 2D contour, 5D radar, and 3D surface telemetry."""

    def test_zopa_telemetry_generation(self):
        founder_ask = DealOffer(
            pre_money_valuation_dzd=70_000_000.0,
            investment_ticket_dzd=15_000_000.0,
            milestone_tranches_count=2,
        )
        investor_offer = DealOffer(
            pre_money_valuation_dzd=50_000_000.0,
            investment_ticket_dzd=12_000_000.0,
            milestone_tranches_count=3,
        )

        res = maut_negotiation_engine.negotiate(
            startup_name="Telemetry AI",
            founder_ask=founder_ask,
            investor_offer=investor_offer,
            max_rounds=6,
        )

        session = maut_negotiation_engine.get_session(res.session_id)
        assert session is not None

        telemetry = zopa_telemetry_generator.generate_telemetry(session)

        # Top-level telemetry
        assert telemetry.session_id == res.session_id
        assert telemetry.has_viable_zopa is True
        assert telemetry.zopa_overlap_dzd > 0.0

        # 2D Contour
        contour = telemetry.contour_2d
        assert contour.valuation_max_dzd > contour.valuation_min_dzd
        assert contour.ticket_max_dzd > contour.ticket_min_dzd
        assert len(contour.founder_region.vertices) == 4
        assert len(contour.investor_region.vertices) == 4
        assert contour.zopa_intersection is not None
        assert len(contour.zopa_intersection.vertices) == 4
        assert len(contour.trajectory) == res.rounds_conducted
        assert contour.nash_equilibrium_point is not None

        # 5D Radar
        radar = telemetry.radar_5d
        assert len(radar.axes) == 5
        assert len(radar.axis_data) == 5
        assert len(radar.founder_polygon) == 5
        assert len(radar.investor_polygon) == 5
        assert len(radar.agreed_polygon) == 5

        # 3D Surface
        surface = telemetry.surface_3d
        assert len(surface.grid_points) == 36  # 6x6 grid
        assert surface.optimal_peak is not None
        assert surface.optimal_peak.nash_product > 0.0


# =============================================================================
# 5. REST API ENDPOINTS INTEGRATION TESTS
# =============================================================================

class TestSyndicateAndTelemetryEndpoints:
    """Integration test suite for the new REST API endpoints."""

    def test_api_syndicate_creation_and_join(self, client):
        create_payload = {
            "startup_name": "Sétif Robotics Hub",
            "deal_round": "Seed",
            "target_raise_dzd": 15_000_000.0,
            "min_allocation_dzd": 500_000.0,
            "lead_investor_id": "lead-setif-1",
            "lead_name": "Dr. Walid B.",
            "lead_carry_pct": 15.0,
            "platform_carry_pct": 5.0,
            "hurdle_rate_pct": 7.0,
            "backoffice_setup_fee_dzd": 150_000.0,
            "closing_days": 30,
        }

        # 1. Create Syndicate SPV
        resp = client.post("/api/v1/dealmaking/syndicate/create", json=create_payload)
        assert resp.status_code == 200
        spv_data = resp.json()
        spv_id = spv_data["spv_id"]
        assert spv_id is not None
        assert spv_data["startup_name"] == "Sétif Robotics Hub"

        # 2. Get Syndicate SPV
        get_resp = client.get(f"/api/v1/dealmaking/syndicate/{spv_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["spv_id"] == spv_id

        # 3. Join Syndicate SPV
        join_payload = {
            "member_id": "angel-dz-1",
            "full_name": "Nabil R.",
            "email": "nabil@dz.com",
            "pledged_amount_dzd": 1_000_000.0,
            "is_lead": False,
        }
        join_resp = client.post(f"/api/v1/dealmaking/syndicate/{spv_id}/join", json=join_payload)
        assert join_resp.status_code == 200
        assert len(join_resp.json()["members"]) == 1

    def test_api_syndicate_waterfall_endpoint(self, client):
        wf_payload = {
            "exit_proceeds_dzd": 25_000_000.0,
            "total_invested_capital_dzd": 10_000_000.0,
            "hurdle_rate_pct": 7.0,
            "holding_period_years": 3.0,
            "lead_carry_pct": 15.0,
            "platform_carry_pct": 5.0,
        }
        resp = client.post("/api/v1/dealmaking/syndicate/waterfall/calculate", json=wf_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["tier1_capital_returned_dzd"] == 10_000_000.0
        assert data["lead_carry_amount_dzd"] > 0.0
        assert data["platform_carry_amount_dzd"] > 0.0
        assert data["lp_blended_moic"] > 2.0

    def test_api_syndicate_prorata_endpoint(self, client):
        prorata_payload = {
            "current_shares_held": 500_000,
            "total_pre_round_shares": 5_000_000,
            "new_round_pre_money_dzd": 100_000_000.0,
            "new_round_target_raise_dzd": 20_000_000.0,
            "option_pool_expansion_pct": 5.0,
        }
        resp = client.post("/api/v1/dealmaking/syndicate/prorata/calculate", json=prorata_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_ownership_pct"] == 10.0
        assert data["pro_rata_investment_required_dzd"] == 2_000_000.0
        assert data["capital_call_notice"]["total_pro_rata_check_dzd"] == 2_000_000.0

    def test_api_zopa_telemetry_endpoint(self, client):
        # 1. Run a negotiation to get session_id
        neg_payload = {
            "startup_name": "Telemetry Drone Corp",
            "founder_ask": {
                "pre_money_valuation_dzd": 60_000_000.0,
                "investment_ticket_dzd": 12_000_000.0,
            },
            "investor_offer": {
                "pre_money_valuation_dzd": 45_000_000.0,
                "investment_ticket_dzd": 10_000_000.0,
            },
            "max_rounds": 6,
        }
        neg_resp = client.post("/api/v1/dealmaking/negotiate", json=neg_payload)
        session_id = neg_resp.json()["session_id"]

        # 2. Fetch ZOPA telemetry
        telemetry_resp = client.get(f"/api/v1/dealmaking/negotiations/{session_id}/zopa-telemetry")
        assert telemetry_resp.status_code == 200
        t_data = telemetry_resp.json()
        assert t_data["session_id"] == session_id
        assert "contour_2d" in t_data
        assert "radar_5d" in t_data
        assert "surface_3d" in t_data
