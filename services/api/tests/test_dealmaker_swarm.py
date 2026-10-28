"""
Comprehensive Test Suite for Pillar 5: Dealmaker Swarm & Bilateral MAUT Negotiation Engine.
Tests:
1. Persona 1: Al-Mu'assis (المؤسس) — Founder Co-Pilot (equity protection, runway, protective provisions, GTM)
2. Persona 2: Al-Muhaqqiq (المحقق) — Forensic Diligence (unit economics, burn multiple, TAM, valuation sanity, risk flags)
3. Persona 3: Al-Muqawil (المقاول) — Milestone Escrow Governor (technical feasibility, SMART tranches, S4E Istihaq)
4. Persona 4: Al-Mizan (الميزان) — Tournament Referee & Arbiter (Al-Jadara Index, tiering, ZOPA, bad-faith detection)
5. MAUT Multi-Attribute Utility Engine (5 dimensions, exact weights, polynomial concession curves, Nash equilibrium)
6. ZOPA Convergence, Empty-ZOPA Deadlock & 3-Tier Arbitration
7. Bad-Faith Proposal Detection & Utility Penalization
8. Standardized Term Sheet Generation (JSON & Markdown)
9. Dealmaking API Endpoints:
   - POST /api/v1/dealmaking/analyze
   - POST /api/v1/dealmaking/negotiate
   - GET /api/v1/dealmaking/negotiations/{session_id}
   - GET /api/v1/dealmaking/negotiations/{session_id}/turns
   - GET /api/v1/dealmaking/negotiations/{session_id}/termsheet (JSON & Markdown)
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.agent.dealmakers import (
    AlMuassisAgent,
    AlMuhaqqiqAgent,
    AlMuqawilAgent,
    AlMizanAgent,
    DealmakerSwarm,
    StartupProfileInput,
    TournamentTier,
    AntiDilutionRatchet,
    MilestoneVerificationType,
    ValuationSanityVerdict,
)
from app.services.maut_negotiation import (
    MAUTNegotiationEngine,
    MAUTUtilityCalculator,
    MAUT_WEIGHTS,
    DealOffer,
    NegotiationStatus,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


@pytest.fixture
def sample_profile():
    return StartupProfileInput(
        startup_name="Biskra Solar AgriTech",
        sector="AgTech & Renewable Energy",
        wilaya=7,
        pitch_summary="IoT and AI micro-irrigation optimization for high-yield date palm farming in Southern Algeria.",
        arr_dzd=18_000_000.0,
        mrr_growth_rate_pct=14.5,
        burn_rate_dzd=1_200_000.0,
        runway_months=10.0,
        cac_dzd=25_000.0,
        ltv_dzd=125_000.0,
        valuation_ask_dzd=120_000_000.0,
        target_raise_dzd=25_000_000.0,
        has_asf_label=True,
        tech_stack=["Python", "FastAPI", "PyTorch", "React", "Rust"],
        churn_rate_pct=1.8,
        team_size=5,
        tam_dzd=45_000_000_000.0,
    )


# =============================================================================
# 1. PERSONA 1: AL-MU'ASSIS (المؤسس) — FOUNDER CO-PILOT TESTS
# =============================================================================

class TestAlMuassisPersona:
    """Test suite for Al-Mu'assis founder-friendly co-pilot."""

    def test_founder_equity_retention_and_dilution(self, sample_profile):
        agent = AlMuassisAgent()
        synthesis = agent.synthesize(sample_profile)

        assert synthesis.agent_name == "Al-Mu'assis (المؤسس)"
        assert synthesis.max_acceptable_dilution_pct <= 25.0
        assert synthesis.max_acceptable_dilution_pct >= 10.0
        assert synthesis.runway_post_raise_months > sample_profile.runway_months
        assert "Wilaya 07" in synthesis.growth_narrative
        assert "ASF Startup Label certified" in synthesis.asf_regulatory_readiness
        assert "Article 169 CIDTA" in synthesis.asf_regulatory_readiness

    def test_founder_protective_provisions(self, sample_profile):
        agent = AlMuassisAgent()
        synthesis = agent.synthesize(sample_profile)

        provisions = synthesis.protective_provisions_demanded
        assert any("Non-Participating" in p for p in provisions)
        assert any("Broad-Based Weighted Average" in p for p in provisions)
        assert any("Founder Board Majority" in p for p in provisions)
        assert any("reverse vesting" in p.lower() for p in provisions)


# =============================================================================
# 2. PERSONA 2: AL-MUHAQQIQ (المحقق) — FORENSIC DILIGENCE TESTS
# =============================================================================

class TestAlMuhaqqiqPersona:
    """Test suite for Al-Muhaqqiq forensic auditor."""

    def test_unit_economics_and_burn_multiple(self, sample_profile):
        agent = AlMuhaqqiqAgent()
        synthesis = agent.synthesize(sample_profile)

        assert synthesis.agent_name == "Al-Muhaqqiq (المحقق)"
        assert synthesis.ltv_to_cac_ratio == 5.0  # 125,000 / 25,000 = 5.0
        assert synthesis.payback_period_months > 0.0
        assert "FAIR VALUATION" in synthesis.valuation_sanity_verdict
        assert synthesis.implied_arr_multiple == round(120_000_000.0 / 18_000_000.0, 2)
        assert synthesis.market_tam_dzd == 45_000_000_000.0
        assert synthesis.market_sam_dzd == round(45_000_000_000.0 * 0.28, 2)
        assert synthesis.forensic_audit_score >= 60.0

    def test_forensic_risk_flags_detection(self):
        risky_profile = StartupProfileInput(
            startup_name="High Burn AI",
            sector="General AI",
            wilaya=16,
            pitch_summary="Speculative AI wrapper without product market fit.",
            arr_dzd=2_000_000.0,
            mrr_growth_rate_pct=1.0,
            burn_rate_dzd=4_000_000.0,
            runway_months=3.5,  # Acute runway risk
            cac_dzd=80_000.0,
            ltv_dzd=90_000.0,   # Weak LTV/CAC
            valuation_ask_dzd=200_000_000.0,  # 100x ARR multiple
            target_raise_dzd=30_000_000.0,
            has_asf_label=False,
            tech_stack=[],      # Missing tech stack
            churn_rate_pct=8.5, # Elevated churn
        )
        agent = AlMuhaqqiqAgent()
        synthesis = agent.synthesize(risky_profile)

        assert "OVERVALUATION ALERT" in synthesis.valuation_sanity_verdict
        assert any("CRITICAL RUNWAY" in flag for flag in synthesis.risk_flags)
        assert any("UNIT ECONOMICS" in flag for flag in synthesis.risk_flags)
        assert any("OVERVALUATION" in flag for flag in synthesis.risk_flags)
        assert any("CHURN" in flag for flag in synthesis.risk_flags)
        assert synthesis.forensic_audit_score < 60.0


# =============================================================================
# 3. PERSONA 3: AL-MUQAWIL (المقاول) — MILESTONE ESCROW GOVERNOR TESTS
# =============================================================================

class TestAlMuqawilPersona:
    """Test suite for Al-Muqawil milestone escrow governor."""

    def test_smart_escrow_tranches_and_feasibility(self, sample_profile):
        agent = AlMuqawilAgent()
        synthesis = agent.synthesize(sample_profile)

        assert synthesis.agent_name == "Al-Muqawil (المقاول)"
        assert synthesis.technical_feasibility_score >= 70.0  # High-value tech stack bonus
        assert len(synthesis.suggested_escrow_tranches) == 3

        total_pct = sum(t.percentage_of_round for t in synthesis.suggested_escrow_tranches)
        assert round(total_pct, 2) == 1.00

        total_amount = sum(t.amount_dzd for t in synthesis.suggested_escrow_tranches)
        assert round(total_amount, 2) == sample_profile.target_raise_dzd

        v_types = [t.verification_type for t in synthesis.suggested_escrow_tranches]
        assert MilestoneVerificationType.DIRECT_RELEASE in v_types
        assert MilestoneVerificationType.ZK_TLS_ATTESTATION in v_types
        assert MilestoneVerificationType.DUAL_AGENT_CONSENSUS in v_types

        assert "Istihaq dynamic protocol" in synthesis.s4e_sweat_equity_recommendation


# =============================================================================
# 4. PERSONA 4: AL-MIZAN (الميزان) — REFEREE & ARBITRATOR TESTS
# =============================================================================

class TestAlMizanPersona:
    """Test suite for Al-Mizan tournament referee and arbitrator."""

    def test_al_jadara_index_and_tiering(self, sample_profile):
        swarm = DealmakerSwarm()
        analysis = swarm.analyze_startup(sample_profile)

        referee = analysis.referee_verdict
        assert referee.agent_name == "Al-Mizan (الميزان)"
        assert 0.0 <= referee.jadara_index_score <= 100.0
        assert referee.tier in [TournamentTier.PUBLIC_LISTING, TournamentTier.PRIVATE_SYNDICATE]

        breakdown = referee.score_breakdown
        assert "technical_feasibility" in breakdown
        assert "forensic_financial_health" in breakdown
        assert "market_growth_velocity" in breakdown
        assert "regulatory_readiness" in breakdown
        assert "team_execution" in breakdown
        assert "composite_al_jadara" in breakdown

        assert len(referee.arbitration_clauses) >= 2


# =============================================================================
# 5. MAUT MULTI-ATTRIBUTE UTILITY ENGINE TESTS
# =============================================================================

class TestMAUTUtilityTheory:
    """Test suite for MAUT utility calculations across 5 dimensions."""

    def test_dimension_weights_sum_to_one(self):
        total_weight = sum(MAUT_WEIGHTS.values())
        assert round(total_weight, 5) == 1.00
        assert MAUT_WEIGHTS["pre_money_valuation"] == 0.30
        assert MAUT_WEIGHTS["investment_ticket"] == 0.25
        assert MAUT_WEIGHTS["equity_percentage"] == 0.20
        assert MAUT_WEIGHTS["milestone_tranches"] == 0.15
        assert MAUT_WEIGHTS["governance_rights"] == 0.10

    def test_founder_and_investor_utility_monotonicity(self):
        val_bounds = (40_000_000.0, 100_000_000.0)

        # High valuation offer vs Low valuation offer
        high_val_offer = DealOffer(
            pre_money_valuation_dzd=90_000_000.0,
            investment_ticket_dzd=15_000_000.0,
            milestone_tranches_count=2,
            governance_board_seats_investor=1,
            has_board_observer_rights=True,
            has_veto_rights=False,
        )

        low_val_offer = DealOffer(
            pre_money_valuation_dzd=45_000_000.0,
            investment_ticket_dzd=15_000_000.0,
            milestone_tranches_count=3,
            governance_board_seats_investor=1,
            has_board_observer_rights=True,
            has_veto_rights=True,
        )

        u_f_high = MAUTUtilityCalculator.evaluate_founder_utility(
            offer=high_val_offer,
            val_bounds=val_bounds,
            target_ticket=15_000_000.0,
        )
        u_f_low = MAUTUtilityCalculator.evaluate_founder_utility(
            offer=low_val_offer,
            val_bounds=val_bounds,
            target_ticket=15_000_000.0,
        )

        # Founder must strictly prefer high valuation and clean governance
        assert u_f_high.composite_utility > u_f_low.composite_utility
        assert u_f_high.pre_money_valuation > u_f_low.pre_money_valuation
        assert u_f_high.governance_rights > u_f_low.governance_rights

        # Investor must strictly prefer low valuation
        u_i_high = MAUTUtilityCalculator.evaluate_investor_utility(
            offer=high_val_offer,
            val_bounds=val_bounds,
            max_budget=20_000_000.0,
        )
        u_i_low = MAUTUtilityCalculator.evaluate_investor_utility(
            offer=low_val_offer,
            val_bounds=val_bounds,
            max_budget=20_000_000.0,
        )
        assert u_i_low.composite_utility > u_i_high.composite_utility
        assert u_i_low.pre_money_valuation > u_i_high.pre_money_valuation


# =============================================================================
# 6. NEGOTIATION CONVERGENCE & ZOPA TESTS
# =============================================================================

class TestNegotiationDynamics:
    """Test suite for concession curves, ZOPA convergence, and deadlock handling."""

    def test_successful_negotiation_convergence_on_nash(self):
        engine = MAUTNegotiationEngine()

        founder_ask = DealOffer(
            pre_money_valuation_dzd=60_000_000.0,
            investment_ticket_dzd=12_000_000.0,
            milestone_tranches_count=2,
            governance_board_seats_investor=0,
            has_board_observer_rights=True,
            has_veto_rights=False,
        )

        investor_offer = DealOffer(
            pre_money_valuation_dzd=45_000_000.0,
            investment_ticket_dzd=10_000_000.0,
            milestone_tranches_count=3,
            governance_board_seats_investor=1,
            has_board_observer_rights=True,
            has_veto_rights=False,
        )

        res = engine.negotiate(
            startup_name="Fintech Algerie",
            founder_ask=founder_ask,
            investor_offer=investor_offer,
            max_rounds=10,
        )

        assert res.status == NegotiationStatus.AGREED
        assert res.rounds_conducted <= 10
        assert res.agreed_term_sheet is not None
        assert res.nash_product_score is not None
        assert res.nash_product_score > 0.0
        assert res.equity_stake_pct is not None
        assert 10.0 <= res.equity_stake_pct <= 30.0
        assert len(res.contract_clauses) >= 5
        assert res.termsheet_markdown is not None
        assert "# TERM SHEET" in res.termsheet_markdown

    def test_deadlock_when_zopa_is_empty(self):
        engine = MAUTNegotiationEngine()

        # Founder demands astronomical valuation with non-negotiable floor
        founder_ask = DealOffer(
            pre_money_valuation_dzd=200_000_000.0,
            investment_ticket_dzd=15_000_000.0,
        )
        # Investor ceiling is far below founder floor
        investor_offer = DealOffer(
            pre_money_valuation_dzd=30_000_000.0,
            investment_ticket_dzd=10_000_000.0,
        )

        res = engine.negotiate(
            startup_name="Stubborn Venture",
            founder_ask=founder_ask,
            investor_offer=investor_offer,
            founder_res_val=180_000_000.0,  # Floor far above investor cap
            investor_res_val=40_000_000.0,   # Ceiling far below founder floor
            max_rounds=5,
        )

        assert res.status == NegotiationStatus.DEADLOCK
        assert res.agreed_term_sheet is None
        assert res.arbitration_recommendation is not None
        assert "Tier 1 TEE algorithmic mediation" in res.arbitration_recommendation
        assert res.termsheet_markdown is None

    def test_bad_faith_detection(self):
        engine = MAUTNegotiationEngine()

        # Opening predatory investor term
        predatory_offer = DealOffer(
            pre_money_valuation_dzd=40_000_000.0,
            investment_ticket_dzd=10_000_000.0,
            liquidation_preference_multiplier=2.5,  # Predatory
        )
        note = engine.detect_bad_faith(None, predatory_offer, "investor")
        assert note is not None
        assert "Predatory liquidation preference" in note

        # Regressive concession in later round: founder raises valuation ask
        round1_founder = DealOffer(
            pre_money_valuation_dzd=80_000_000.0,
            investment_ticket_dzd=15_000_000.0,
        )
        round2_regressive_founder = DealOffer(
            pre_money_valuation_dzd=95_000_000.0,  # Increased ask!
            investment_ticket_dzd=15_000_000.0,
        )
        regressive_note = engine.detect_bad_faith(round1_founder, round2_regressive_founder, "founder")
        assert regressive_note is not None
        assert "Regressive demand" in regressive_note


# =============================================================================
# 7. DEALMAKING API ROUTER ENDPOINT TESTS
# =============================================================================

class TestDealmakingEndpoints:
    """Test suite for the /api/v1/dealmaking REST endpoints."""

    def test_api_dealmaking_analyze_endpoint(self, client, sample_profile):
        payload = sample_profile.model_dump()
        resp = client.post("/api/v1/dealmaking/analyze", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["startup_name"] == sample_profile.startup_name
        assert "founder_copilot" in data
        assert "due_diligence" in data
        assert "milestone_escrow" in data
        assert "referee_verdict" in data
        assert data["referee_verdict"]["jadara_index_score"] > 0.0

    def test_api_dealmaking_negotiate_and_turn_inspection(self, client):
        req_payload = {
            "startup_name": "Constantine Biotech",
            "founder_ask": {
                "pre_money_valuation_dzd": 70_000_000.0,
                "investment_ticket_dzd": 14_000_000.0,
                "milestone_tranches_count": 2,
                "governance_board_seats_investor": 0,
                "has_board_observer_rights": True,
                "has_veto_rights": False,
                "liquidation_preference_multiplier": 1.0,
                "anti_dilution_ratchet": "BROAD_BASED_WEIGHTED_AVERAGE",
                "vesting_schedule_months": 48,
            },
            "investor_offer": {
                "pre_money_valuation_dzd": 55_000_000.0,
                "investment_ticket_dzd": 12_000_000.0,
                "milestone_tranches_count": 3,
                "governance_board_seats_investor": 1,
                "has_board_observer_rights": True,
                "has_veto_rights": False,
                "liquidation_preference_multiplier": 1.0,
                "anti_dilution_ratchet": "BROAD_BASED_WEIGHTED_AVERAGE",
                "vesting_schedule_months": 48,
            },
            "max_rounds": 8,
        }

        # 1. Initiate negotiation
        neg_resp = client.post("/api/v1/dealmaking/negotiate", json=req_payload)
        assert neg_resp.status_code == 200
        neg_data = neg_resp.json()
        assert neg_data["status"] == "AGREED"
        session_id = neg_data["session_id"]
        assert session_id is not None
        assert len(neg_data["rounds_history"]) > 0

        # 2. Inspect session details
        sess_resp = client.get(f"/api/v1/dealmaking/negotiations/{session_id}")
        assert sess_resp.status_code == 200
        sess_data = sess_resp.json()
        assert sess_data["session_id"] == session_id
        assert sess_data["startup_name"] == "Constantine Biotech"

        # 3. Inspect step-by-step turns
        turns_resp = client.get(f"/api/v1/dealmaking/negotiations/{session_id}/turns")
        assert turns_resp.status_code == 200
        turns_data = turns_resp.json()
        assert len(turns_data) == neg_data["rounds_conducted"]
        first_turn = turns_data[0]
        assert "founder_utility_breakdown" in first_turn
        assert "investor_utility_breakdown" in first_turn
        assert "zopa_gap_pct" in first_turn

        # 4. Download Term Sheet as JSON
        ts_json_resp = client.get(f"/api/v1/dealmaking/negotiations/{session_id}/termsheet?format=json")
        assert ts_json_resp.status_code == 200
        ts_json_data = ts_json_resp.json()
        assert ts_json_data["format"] == "json"
        assert "# TERM SHEET" in ts_json_data["content"]
        assert ts_json_data["equity_stake_pct"] is not None

        # 5. Download Term Sheet as Markdown
        ts_md_resp = client.get(f"/api/v1/dealmaking/negotiations/{session_id}/termsheet?format=markdown")
        assert ts_md_resp.status_code == 200
        assert "text/markdown" in ts_md_resp.headers["content-type"]
        assert "# TERM SHEET — SERIES SEED INVESTMENT" in ts_md_resp.text

    def test_api_dealmaking_404_error_handling(self, client):
        resp = client.get("/api/v1/dealmaking/negotiations/non-existent-uuid")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
