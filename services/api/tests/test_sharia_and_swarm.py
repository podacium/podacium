"""
Tests for Programmatic Sharia Screening, Istihaq Sweat-Equity Vesting,
Autonomous Dealmaker Swarm, and Multiplayer Simulation WebSocket.
"""

import pytest
import json
from starlette.testclient import TestClient

from app.main import app
from app.services.sharia_engine import (
    sharia_engine,
    FinancialStatement,
    ShariaVerdict,
    MilestoneType,
    VerificationStatus,
    MilestoneDeliverable,
    IstihaqCalculationRequest,
)
from app.services.dealmaker_swarm import (
    dealmaker_swarm,
    StartupProfileInput,
    TournamentTier,
    TermSheetVector,
    NegotiationRequest,
    NegotiationStatus,
    AntiDilutionRatchet,
)
from app.routers.simulation_ws import simulation_manager


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. SHARIA SCREENING TESTS (AAOIFI STANDARD NO. 21)
# =============================================================================

class TestShariaScreening:
    """Test suite for AAOIFI Shariah Standard No. 21 ratio and sector screening."""

    def test_fully_compliant_startup(self):
        stmt = FinancialStatement(
            total_assets_dzd=50_000_000,
            market_cap_dzd=100_000_000,
            total_debt_dzd=10_000_000,              # 10% (<33%)
            interest_bearing_deposits_dzd=8_000_000, # 8% (<33%)
            total_revenue_dzd=20_000_000,
            non_permissible_revenue_dzd=0.0,         # 0% (<5%)
            business_sectors=["AgTech", "AI Software"],
            business_description="AI-driven irrigation management for date palm agriculture in Biskra.",
        )
        res = sharia_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.COMPLIANT
        assert res.debt_to_market_cap_ratio == 0.10
        assert res.interest_bearing_deposits_ratio == 0.08
        assert res.non_permissible_revenue_ratio == 0.0
        assert res.purification_required_dzd == 0.0
        assert len(res.prohibited_sectors_detected) == 0
        assert all(s.passed for s in res.ratio_screens)

    def test_non_compliant_due_to_excessive_debt(self):
        stmt = FinancialStatement(
            total_assets_dzd=30_000_000,
            market_cap_dzd=40_000_000,
            total_debt_dzd=18_000_000,              # 45% (>=33% fail)
            interest_bearing_deposits_dzd=2_000_000,
            total_revenue_dzd=10_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["Logistics"],
            business_description="Cold chain delivery fleet across Algerian coastal wilayas.",
        )
        res = sharia_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        assert res.debt_to_market_cap_ratio == 0.45
        debt_screen = next(s for s in res.ratio_screens if "Debt" in s.metric_name)
        assert debt_screen.passed is False

    def test_non_compliant_due_to_prohibited_sector(self):
        stmt = FinancialStatement(
            total_assets_dzd=20_000_000,
            market_cap_dzd=50_000_000,
            total_debt_dzd=1_000_000,
            interest_bearing_deposits_dzd=1_000_000,
            total_revenue_dzd=15_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["Hospitality", "Brewery"],
            business_description="Distillery and alcohol delivery service.",
        )
        res = sharia_engine.screen_financials(stmt)

        assert res.is_compliant is False
        assert res.verdict == ShariaVerdict.NON_COMPLIANT
        assert "ALCOHOL" in res.prohibited_sectors_detected

    def test_tathir_purification_calculation(self):
        stmt = FinancialStatement(
            total_assets_dzd=10_000_000,
            market_cap_dzd=30_000_000,
            total_debt_dzd=2_000_000,               # 6.6% (<33%)
            interest_bearing_deposits_dzd=3_000_000,# 10% (<33%)
            total_revenue_dzd=10_000_000,
            non_permissible_revenue_dzd=250_000,    # 2.5% (<5%)
            business_sectors=["E-Commerce"],
            business_description="Marketplace for Algerian craft artisans with incidental bank account interest.",
        )
        res = sharia_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.COMPLIANT
        assert res.non_permissible_revenue_ratio == 0.025
        assert res.purification_required_dzd == 250_000.0
        assert res.purification_percentage == 2.5

    def test_borderline_questionable_ratio(self):
        stmt = FinancialStatement(
            total_assets_dzd=10_000_000,
            market_cap_dzd=10_000_000,
            total_debt_dzd=3_100_000,               # 31% (Between 30% and 33%)
            interest_bearing_deposits_dzd=1_000_000,
            total_revenue_dzd=5_000_000,
            non_permissible_revenue_dzd=0.0,
            business_sectors=["HealthTech"],
            business_description="Telemedicine platform connecting Algerian diaspora doctors.",
        )
        res = sharia_engine.screen_financials(stmt)

        assert res.is_compliant is True
        assert res.verdict == ShariaVerdict.QUESTIONABLE


# =============================================================================
# 2. DYNAMIC ISTIHAQ SWEAT-EQUITY TESTS
# =============================================================================

class TestIstihaqSweatEquity:
    """Test suite for Istihaq proof-of-contribution sweat equity vesting."""

    def test_istihaq_verified_milestone_allocation(self):
        req = IstihaqCalculationRequest(
            startup_id="startup-777",
            post_money_valuation_dzd=50_000_000, # 50M DZD
            total_tokenized_shares=1_000_000,    # 50 DZD per share
            sweat_equity_pool_pct=10.0,          # 100,000 shares cap
            allocated_shares_so_far=10_000,
            milestones=[
                MilestoneDeliverable(
                    milestone_id="m1-pr",
                    contributor_id="dev-amine",
                    title="Implement Zero-Knowledge Proofs verification circuit",
                    milestone_type=MilestoneType.CODE_PULL_REQUEST,
                    complexity_weight=3.0,
                    estimated_labor_value_dzd=300_000, # 300,000 DZD
                    verification_status=VerificationStatus.VERIFIED,
                    proof_hash="0xabc123789456deadbeef",
                    evidence_url="https://github.com/tamwheel/zk-circuits/pull/42",
                    verified_by="oracle-node-alger",
                ),
                MilestoneDeliverable(
                    milestone_id="m2-audit",
                    contributor_id="auditor-karim",
                    title="Smart Escrow Vault Security Audit",
                    milestone_type=MilestoneType.SECURITY_AUDIT,
                    complexity_weight=5.0,
                    estimated_labor_value_dzd=500_000,
                    verification_status=VerificationStatus.VERIFIED,
                    proof_hash="0xdef456123987feedcafe",
                    evidence_url="https://audit.tamwheel.dz/reports/escrow-vault.pdf",
                    verified_by="certik-syndicate",
                ),
                MilestoneDeliverable(
                    milestone_id="m3-pending",
                    contributor_id="dev-yacine",
                    title="Unverified feature PR",
                    milestone_type=MilestoneType.CODE_PULL_REQUEST,
                    complexity_weight=1.0,
                    estimated_labor_value_dzd=100_000,
                    verification_status=VerificationStatus.PENDING_REVIEW,
                ),
            ],
        )

        res = sharia_engine.calculate_istihaq(req)

        assert res.startup_id == "startup-777"
        assert res.share_price_dzd == 50.0
        assert res.total_shares_allocated > 0
        assert res.vested_shares > 0
        assert res.unvested_shares > 0
        assert res.vested_shares + res.unvested_shares == res.total_shares_allocated

        # Milestone 3 pending should have 0 shares allocated
        m3_summary = next(m for m in res.milestones_summary if m.milestone_id == "m3-pending")
        assert m3_summary.shares_allocated == 0

        # Warrants verification
        assert res.warrant_issuance.warrant_id.startswith("WRNT-")
        assert len(res.warrant_issuance.warrant_hash) == 64
        assert res.warrant_issuance.beneficial_holder == "dev-amine"
        assert res.sweat_equity_pool_cap_shares == 100_000

    def test_istihaq_pool_cap_enforcement(self):
        # Pool has only 1,000 shares remaining
        req = IstihaqCalculationRequest(
            startup_id="startup-capped",
            post_money_valuation_dzd=10_000_000,
            total_tokenized_shares=100_000, # 100 DZD / share
            sweat_equity_pool_pct=10.0,     # 10,000 shares total cap
            allocated_shares_so_far=9_500,  # 500 shares remaining
            milestones=[
                MilestoneDeliverable(
                    milestone_id="m-huge",
                    contributor_id="agency-design",
                    title="Full Brand & Sensory Design System",
                    milestone_type=MilestoneType.ARCHITECTURE_DESIGN,
                    complexity_weight=5.0,
                    estimated_labor_value_dzd=5_000_000, # Would normally demand 50,000+ shares
                    verification_status=VerificationStatus.VERIFIED,
                )
            ],
        )

        res = sharia_engine.calculate_istihaq(req)

        # Must cap at remaining 500 shares!
        assert res.total_shares_allocated == 500
        assert res.remaining_pool_shares == 0
        assert res.pool_utilization_pct == 100.0


# =============================================================================
# 3. DEALMAKER SWARM & AI DUE DILIGENCE TESTS
# =============================================================================

class TestDealmakerSwarm:
    """Test suite for Autonomous AI Due Diligence Swarm and MAUT Negotiation."""

    def test_swarm_due_diligence_analysis(self):
        profile = StartupProfileInput(
            startup_name="Biskra Dates AI",
            sector="Agtech",
            wilaya=7, # Biskra
            pitch_summary="AI multispectral drone analysis for date palm yields and water optimization.",
            arr_dzd=12_000_000,
            mrr_growth_rate_pct=18.5,
            burn_rate_dzd=600_000,
            runway_months=14.0,
            cac_dzd=25_000,
            ltv_dzd=150_000,           # LTV/CAC = 6.0x
            valuation_ask_dzd=80_000_000, # ~6.6x ARR
            target_raise_dzd=20_000_000,
            has_asf_label=True,
            tech_stack=["Python", "FastAPI", "PyTorch", "Rust", "Next.js"],
        )

        analysis = dealmaker_swarm.analyze_startup(profile)

        assert analysis.startup_name == "Biskra Dates AI"
        assert analysis.founder_copilot.agent_name.startswith("Al-Mu'assis")
        assert "Decree 20-254" in analysis.founder_copilot.asf_regulatory_readiness

        assert analysis.due_diligence.ltv_to_cac_ratio == 6.0
        assert analysis.due_diligence.implied_arr_multiple == 6.67
        assert "FAIR VALUATION" in analysis.due_diligence.valuation_sanity_verdict

        assert len(analysis.milestone_escrow.suggested_escrow_tranches) == 3
        assert analysis.milestone_escrow.technical_feasibility_score >= 80.0

        assert analysis.referee_verdict.jadara_index_score >= 70.0
        assert analysis.referee_verdict.tier in (TournamentTier.PUBLIC_LISTING, TournamentTier.PRIVATE_SYNDICATE)

    def test_swarm_due_diligence_overvaluation_risk_flag(self):
        profile = StartupProfileInput(
            startup_name="SuperHype Web3",
            sector="Crypto",
            wilaya=16,
            pitch_summary="Tokenized meme coins for cafes.",
            arr_dzd=2_000_000,
            mrr_growth_rate_pct=2.0,
            burn_rate_dzd=1_500_000,
            runway_months=3.5, # Critical runway
            cac_dzd=50_000,
            ltv_dzd=40_000,   # LTV/CAC < 1.0 (disastrous)
            valuation_ask_dzd=100_000_000, # 50x ARR!
            target_raise_dzd=30_000_000,
            has_asf_label=False,
        )

        analysis = dealmaker_swarm.analyze_startup(profile)

        assert "CRITICAL RUNWAY" in str(analysis.due_diligence.risk_flags)
        assert "OVERVALUATION ALERT" in analysis.due_diligence.valuation_sanity_verdict
        assert analysis.referee_verdict.tier in (TournamentTier.SANDBOX, TournamentTier.SIMULATION_LEAGUE)

    def test_dealmaker_bilateral_negotiation_success(self):
        # Founder asks for 60M DZD post-money for 15M DZD investment
        # Investor offers 45M DZD post-money for 15M DZD investment
        req = NegotiationRequest(
            startup_name="Sétif Robotics",
            founder_ask=TermSheetVector(
                post_money_valuation_dzd=60_000_000,
                investment_amount_dzd=15_000_000,
                liquidation_preference_multiplier=1.0,
                board_seats_investor=0,
                veto_rights=False,
                anti_dilution_ratchet=AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE,
                vesting_schedule_months=48,
            ),
            investor_offer=TermSheetVector(
                post_money_valuation_dzd=45_000_000,
                investment_amount_dzd=15_000_000,
                liquidation_preference_multiplier=1.5,
                board_seats_investor=1,
                veto_rights=True,
                anti_dilution_ratchet=AntiDilutionRatchet.NARROW_BASED_WEIGHTED_AVERAGE,
                vesting_schedule_months=36,
            ),
            max_rounds=5,
        )

        res = dealmaker_swarm.negotiate_term_sheet(req)

        assert res.status == NegotiationStatus.AGREED
        assert res.rounds_conducted > 0
        assert res.agreed_term_sheet is not None
        # Agreed valuation should be between 45M and 60M DZD
        assert 45_000_000 <= res.agreed_term_sheet.post_money_valuation_dzd <= 60_000_000
        assert res.equity_stake_pct is not None
        assert res.agreed_term_sheet.liquidation_preference_multiplier == 1.0
        assert len(res.contract_clauses) >= 4


# =============================================================================
# 4. REST API ENDPOINTS TESTS
# =============================================================================

class TestShariaAndSwarmEndpoints:
    """Test suite for FastAPI REST endpoints in /api/v1/sharia and /api/v1/swarm."""

    def test_api_sharia_screen_endpoint(self, client):
        payload = {
            "total_assets_dzd": 80000000,
            "market_cap_dzd": 120000000,
            "total_debt_dzd": 15000000,
            "interest_bearing_deposits_dzd": 10000000,
            "total_revenue_dzd": 35000000,
            "non_permissible_revenue_dzd": 500000,
            "business_sectors": ["FinTech", "AI"],
            "business_description": "Sharia-compliant venture crowdfunding platform.",
        }
        resp = client.post("/api/v1/sharia/screen", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_compliant"] is True
        assert data["verdict"] in ["COMPLIANT", "QUESTIONABLE"]
        assert "debt_to_market_cap_ratio" in data
        assert data["purification_required_dzd"] == 500000.0

    def test_api_istihaq_calculate_endpoint(self, client):
        payload = {
            "startup_id": "startup-test-api",
            "post_money_valuation_dzd": 40000000,
            "total_tokenized_shares": 1000000,
            "sweat_equity_pool_pct": 10.0,
            "allocated_shares_so_far": 5000,
            "milestones": [
                {
                    "milestone_id": "api-ms-1",
                    "contributor_id": "engineer-karim",
                    "title": "API Gateway Implementation",
                    "milestone_type": "CODE_PULL_REQUEST",
                    "complexity_weight": 2.5,
                    "estimated_labor_value_dzd": 200000,
                    "verification_status": "VERIFIED",
                    "proof_hash": "0x123abc",
                }
            ],
        }
        resp = client.post("/api/v1/sharia/istihaq/calculate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["startup_id"] == "startup-test-api"
        assert data["total_shares_allocated"] > 0
        assert data["warrant_issuance"]["warrant_id"].startswith("WRNT-")

    def test_api_swarm_analyze_endpoint(self, client):
        payload = {
            "startup_name": "Algeria Green H2",
            "sector": "Cleantech",
            "wilaya": 30, # Ouargla
            "pitch_summary": "Green hydrogen electrolysis powered by solar micro-grids.",
            "arr_dzd": 25000000,
            "mrr_growth_rate_pct": 12.0,
            "burn_rate_dzd": 1200000,
            "runway_months": 18.0,
            "cac_dzd": 100000,
            "ltv_dzd": 500000,
            "valuation_ask_dzd": 150000000,
            "target_raise_dzd": 40000000,
            "has_asf_label": True,
            "tech_stack": ["Rust", "C++", "SolarSCADA"],
        }
        resp = client.post("/api/v1/swarm/analyze", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["startup_name"] == "Algeria Green H2"
        assert "founder_copilot" in data
        assert "due_diligence" in data
        assert "milestone_escrow" in data
        assert "referee_verdict" in data
        assert data["referee_verdict"]["jadara_index_score"] > 0

    def test_api_swarm_negotiate_endpoint(self, client):
        payload = {
            "startup_name": "Oran Biotech",
            "founder_ask": {
                "post_money_valuation_dzd": 50000000,
                "investment_amount_dzd": 10000000,
                "liquidation_preference_multiplier": 1.0,
                "board_seats_investor": 0,
                "veto_rights": False,
                "anti_dilution_ratchet": "BROAD_BASED_WEIGHTED_AVERAGE",
                "vesting_schedule_months": 48,
            },
            "investor_offer": {
                "post_money_valuation_dzd": 40000000,
                "investment_amount_dzd": 10000000,
                "liquidation_preference_multiplier": 1.0,
                "board_seats_investor": 1,
                "veto_rights": False,
                "anti_dilution_ratchet": "BROAD_BASED_WEIGHTED_AVERAGE",
                "vesting_schedule_months": 48,
            },
            "max_rounds": 4,
        }
        resp = client.post("/api/v1/swarm/negotiate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ["AGREED", "DEADLOCK"]
        assert len(data["rounds_history"]) > 0


# =============================================================================
# 5. MULTIPLAYER SIMULATION WEBSOCKET TESTS
# =============================================================================

class TestSimulationWebSocket:
    """Test suite for multiplayer simulation WebSocket rooms and broadcasts."""

    def test_websocket_connect_and_ping_pong(self, client):
        with client.websocket_connect("/ws/simulation") as ws:
            # First message should be simulation:welcome
            welcome_msg = ws.receive_json()
            assert welcome_msg["type"] == "simulation:welcome"
            assert "client_id" in welcome_msg

            # Test Ping -> Pong
            ws.send_json({"action": "ping"})
            pong_msg = ws.receive_json()
            assert pong_msg["type"] == "pong"

    def test_websocket_subscribe_and_pledge_alert(self, client):
        with client.websocket_connect("/ws/simulation") as ws:
            # Receive welcome
            ws.receive_json()

            # Subscribe to startup room
            ws.send_json({
                "action": "subscribe",
                "room": "startup:startup-alpha-test",
            })
            sub_ack = ws.receive_json()
            assert sub_ack["type"] == "subscribed"
            assert sub_ack["room"] == "startup:startup-alpha-test"

            # Trigger synchronous broadcast via event loop
            import asyncio
            asyncio.run(
                simulation_manager.broadcast_pledge(
                    startup_id="startup-alpha-test",
                    startup_name="Algerian AI Foundry",
                    backer_name="Yacine M.",
                    amount_dzd=50_000,
                    equity_share_pct=0.15,
                    new_hype_score=87.5,
                )
            )

            # Client should receive pledge alert
            pledge_event = ws.receive_json()
            assert pledge_event["type"] == "simulation:pledge_alert"
            assert pledge_event["startup_id"] == "startup-alpha-test"
            assert pledge_event["backer_name"] == "Yacine M."
            assert pledge_event["amount_dzd"] == 50_000
            assert pledge_event["new_hype_score"] == 87.5

    def test_websocket_reaction_stream(self, client):
        with client.websocket_connect("/ws/simulation") as ws:
            ws.receive_json() # welcome

            # Subscribe to startup room
            ws.send_json({
                "action": "subscribe",
                "room": "startup:startup-reaction-test",
            })
            ws.receive_json() # subscribed

            # Send reaction emoji
            ws.send_json({
                "action": "reaction",
                "startup_id": "startup-reaction-test",
                "emoji": "🚀",
            })

            # Receive the broadcasted reaction
            reaction_event = ws.receive_json()
            assert reaction_event["type"] in ("simulation:sentiment_reaction", "arena:reaction")
            assert reaction_event["startup_id"] == "startup-reaction-test"
            assert reaction_event["emoji"] == "🚀"
