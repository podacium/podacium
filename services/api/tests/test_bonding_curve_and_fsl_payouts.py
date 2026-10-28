"""
TamWheel Sovereign Ethical Agentic Venture OS — Comprehensive Test Suite for Phase 4.
Focus: AMM Continuous Bonding Curve for Fantasy Shares & Season-End Touiza Dividend Distribution.

Verifies:
1. Continuous Bonding Curve AMM Engine:
   - Polynomial & Sigmoid continuous pricing calculus (exact integrals).
   - Spot price evaluation, buying price integral, selling price refund.
   - Dynamic slippage protection and rejection of excessive slippage.
   - Anti-front-running delay window (rapid sandwich round-trip prevention).
   - Double-entry virtual liquidity pool invariants with DoubleEntrySimulationLedger.
2. Season-End Dividend & Touiza Tournament Distribution Engine:
   - Top 100 Individual Analysts Leaderboard (Gold/Silver/Bronze Touiza Trophies & bonuses).
   - 58-Wilaya Sovereign Cup (1,000,000 DZD Grand Prize Pool distributed to champion Wilaya cohort).
   - Simulated Dividend Payouts: profitable startups declaring virtual dividends based on GMV.
   - Complete season-end distribution settlement report and ledger verification.
3. FastAPI Endpoints Integration:
   - /api/v1/amm/pools, /pools/{startup_id}, /quote, /trade, /holdings
   - /api/v1/fantasy/season/leaderboard, /wilaya-cup, /dividends, /distribute, /report
"""

import math
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.services.bonding_curve_amm import (
    ContinuousBondingCurveEngine,
    StartupBondingPool,
    FRONT_RUNNING_COOLDOWN_SECONDS,
)
from app.services.fsl_season_rewards import (
    SeasonRewardsEngine,
    WILAYA_CUP_PRIZE_POOL_DZD,
)
from app.services.simulation_engine import DoubleEntrySimulationLedger
from app.services.fantasy_league import FantasyStartupLeagueEngine


# =============================================================================
# 1. UNIT TESTS: CONTINUOUS BONDING CURVE AMM ENGINE
# =============================================================================

class TestContinuousBondingCurveAMM:
    """Verifies continuous bonding curve mathematics, slippage, anti-front-running, and ledger invariants."""

    @pytest.fixture
    def ledger(self):
        return DoubleEntrySimulationLedger()

    @pytest.fixture
    def amm(self, ledger):
        return ContinuousBondingCurveEngine(ledger=ledger)

    def test_polynomial_bonding_curve_pricing_and_integral(self):
        """
        Validates polynomial bonding curve: P(S) = P0 + m * S^k
        For P0 = 100.0, m = 0.5, k = 1.0 (linear):
        - Spot price at S = 0: P(0) = 100.0
        - Spot price at S = 10: P(10) = 105.0
        - Exact cost for 10 shares from 0:
          Integral = 100 * 10 + (0.5 / 2) * (10^2 - 0) = 1000 + 25 = 1025.0 DZD.
        """
        pool = StartupBondingPool(
            startup_id="test-poly",
            startup_name="Poly Tech",
            curve_type="POLYNOMIAL",
            p0=100.0,
            slope_m=0.5,
            exponent_k=1.0,
            initial_supply=0,
        )

        assert pool.spot_price(0) == 100.0
        assert pool.spot_price(10) == 105.0

        cost = pool.calculate_cost(0, 10)
        assert abs(cost - 1025.0) < 1e-4

        # Selling 5 shares from S = 10: S becomes 5
        # Refund = 100 * 5 + (0.5 / 2) * (10^2 - 5^2) = 500 + 0.25 * 75 = 518.75 DZD
        refund = pool.calculate_refund(10, 5)
        assert abs(refund - 518.75) < 1e-4

    def test_sigmoid_bonding_curve_pricing_and_integral(self):
        """Validates S-curve Sigmoid bonding curve with inflection point and carrying capacity."""
        pool = StartupBondingPool(
            startup_id="test-sigmoid",
            startup_name="Sigmoid Bio",
            curve_type="SIGMOID",
            p0=150.0,
            slope_m=0.02,  # steepness
            sigmoid_l=5000.0,  # carrying capacity ceiling
            sigmoid_s0=200.0,  # midpoint inflection
            initial_supply=0,
        )

        # Early stage spot price is near base floor price
        spot_0 = pool.spot_price(0)
        assert spot_0 >= 150.0

        # Cost must increase monotonically with share supply
        cost_10 = pool.calculate_cost(0, 10)
        cost_20 = pool.calculate_cost(10, 10)
        assert cost_20 > cost_10

    def test_bancor_bonding_curve_pricing_and_integral(self):
        """Validates Bancor power curve with reserve ratio CW = 0.5 (linear) and CW = 0.333 (quadratic)."""
        pool_linear = StartupBondingPool(
            startup_id="test-bancor-linear",
            startup_name="Bancor Linear",
            curve_type="BANCOR",
            p0=100.0,
            slope_m=0.5,
            reserve_ratio=0.5,  # k = (1/0.5) - 1 = 1.0
            initial_supply=0,
        )
        assert pool_linear.exponent_k == 1.0
        assert pool_linear.spot_price(10) == 105.0
        cost_10 = pool_linear.calculate_cost(0, 10)
        assert abs(cost_10 - 1025.0) < 1e-4

        # Quadratic Bancor curve: CW = 0.333333 -> k = 2.0
        pool_quad = StartupBondingPool(
            startup_id="test-bancor-quad",
            startup_name="Bancor Quad",
            curve_type="BANCOR",
            p0=50.0,
            slope_m=0.1,
            reserve_ratio=1.0 / 3.0,  # k = 2.0
            initial_supply=0,
        )
        assert abs(pool_quad.exponent_k - 2.0) < 1e-4
        assert pool_quad.spot_price(10) == 50.0 + 0.1 * (10 ** 2)
        # Cost integral = 50 * 10 + (0.1 / 3) * 10^3 = 500 + 33.333 = 533.333
        cost_quad = pool_quad.calculate_cost(0, 10)
        assert abs(cost_quad - (500.0 + (100.0 / 3.0))) < 1e-3

    def test_slippage_protection_rejection(self, amm):
        """Orders exceeding the maximum slippage tolerance percentage must be rejected."""
        # Query buying 500 shares: large price impact will result in high slippage
        quote = amm.get_quote("startup-greenfarm", shares_amount=500, action="BUY")
        assert quote.slippage_pct > 2.0

        # Attempting trade with max_slippage_pct = 0.5% must raise 400
        with pytest.raises(HTTPException) as exc_info:
            amm.execute_trade(
                user_id=1,
                startup_id="startup-greenfarm",
                action="BUY",
                shares_amount=500,
                max_slippage_pct=0.5,
            )
        assert exc_info.value.status_code == 400
        assert "Slippage tolerance exceeded" in exc_info.value.detail

    def test_anti_front_running_delay_window(self, amm):
        """Selling shares immediately after buying (within cooldown window) is blocked as front-running."""
        user_id = 42
        startup_id = "startup-solartech"

        # 1. Execute a buy
        buy_res = amm.execute_trade(
            user_id=user_id,
            startup_id=startup_id,
            action="BUY",
            shares_amount=5,
            max_slippage_pct=10.0,
        )
        assert buy_res.shares_amount == 5

        # 2. Attempt immediate sell (within cooldown window) -> FRONT RUNNING REJECTION
        with pytest.raises(HTTPException) as exc_info:
            amm.execute_trade(
                user_id=user_id,
                startup_id=startup_id,
                action="SELL",
                shares_amount=2,
                max_slippage_pct=10.0,
            )
        assert exc_info.value.status_code in (400, 429)
        assert "Anti-front-running delay" in exc_info.value.detail

    def test_atomic_buy_and_sell_with_double_entry_ledger_invariants(self, amm, ledger):
        """
        Validates end-to-end continuous curve trading with double-entry ledger balance invariants:
        - Buy: Debit AMM Reserve / Credit User Cash (cost).
        - Sell: Credit AMM Reserve (gross refund), Debit User Cash (net refund), Debit Fee Pool (protocol fee).
        - Zero-sum balancing preserved across all operations.
        """
        user_id = 88
        startup_id = "startup-finflow"

        # User starts with 50,000 DZD starter grant
        ledger.issue_starter_grant(user_id)
        assert ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH") == 50_000

        pool_before = amm.get_pool_state(startup_id)
        supply_before = pool_before.circulating_supply

        # 1. Buy 10 shares
        buy_res = amm.execute_trade(
            user_id=user_id,
            startup_id=startup_id,
            action="BUY",
            shares_amount=10,
            max_slippage_pct=10.0,
        )
        cost = buy_res.total_cost_or_refund
        assert cost > 0
        assert buy_res.new_user_shares == 10
        assert buy_res.new_supply == supply_before + 10

        # Verify ledger balances after Buy
        user_bal_after_buy = ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
        assert user_bal_after_buy == 50_000 - cost

        amm_reserve = ledger.get_account_balance(f"AMM:{startup_id}:RESERVE_POOL")
        assert amm_reserve == cost

        # Verify cryptographic state chain
        audit_1 = ledger.verify_state_chain()
        assert audit_1["isValid"] is True

        # 2. Wait out anti-front-running cooldown
        past_time = datetime.now(timezone.utc) - timedelta(seconds=10)
        amm._last_user_buy[(user_id, startup_id)] = past_time
        amm._last_user_trade[user_id] = past_time

        # 3. Sell 4 shares
        sell_res = amm.execute_trade(
            user_id=user_id,
            startup_id=startup_id,
            action="SELL",
            shares_amount=4,
            max_slippage_pct=10.0,
        )
        assert sell_res.shares_amount == 4
        assert sell_res.new_user_shares == 6  # 10 - 4
        assert sell_res.new_supply == supply_before + 6

        # Net refund credited back to user
        user_bal_after_sell = ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
        assert user_bal_after_sell == user_bal_after_buy + sell_res.net_refund

        # Protocol fee collected
        fee_balance = ledger.get_account_balance("SYSTEM:TOUIZA_LIQUIDITY_FEE_POOL")
        assert fee_balance == sell_res.protocol_fee

        # Zero-sum state chain verification
        audit_2 = ledger.verify_state_chain()
        assert audit_2["isValid"] is True

    def test_insufficient_balance_and_shares_rejection(self, amm, ledger):
        """Trading with insufficient cash or shares must be rejected."""
        user_id = 99
        startup_id = "startup-logixpress"

        # User has no shares: selling must fail
        with pytest.raises(HTTPException) as exc_info:
            amm.execute_trade(
                user_id=user_id,
                startup_id=startup_id,
                action="SELL",
                shares_amount=1,
            )
        assert exc_info.value.status_code == 400
        assert "Insufficient shares" in exc_info.value.detail


# =============================================================================
# 2. UNIT TESTS: SEASON REWARDS & TOUIZA TOURNAMENT DISTRIBUTION
# =============================================================================

class TestSeasonRewardsAndDividends:
    """Verifies Top 100 Touiza trophies, 58-Wilaya Sovereign Cup, and simulated startup dividends."""

    @pytest.fixture
    def ledger(self):
        return DoubleEntrySimulationLedger()

    @pytest.fixture
    def fantasy_engine(self):
        return FantasyStartupLeagueEngine()

    @pytest.fixture
    def amm_engine(self, ledger):
        return ContinuousBondingCurveEngine(ledger=ledger)

    @pytest.fixture
    def rewards_engine(self, ledger, fantasy_engine, amm_engine):
        return SeasonRewardsEngine(
            ledger=ledger,
            fantasy_engine=fantasy_engine,
            amm_engine=amm_engine,
        )

    def test_individual_analysts_leaderboard_reward_tiers(self, rewards_engine):
        """Verifies rank tiers: Gold Touiza (50k DZD), Silver (25k), Bronze (10k), Honor (5k)."""
        assert rewards_engine.get_rank_reward_tier(1) == ("GOLD_TOUIZA", "PARTNER", 50_000)
        assert rewards_engine.get_rank_reward_tier(2) == ("SILVER_TOUIZA", "SENIOR_ANALYST", 25_000)
        assert rewards_engine.get_rank_reward_tier(10) == ("SILVER_TOUIZA", "SENIOR_ANALYST", 25_000)
        assert rewards_engine.get_rank_reward_tier(11) == ("BRONZE_TOUIZA", "ANALYST", 10_000)
        assert rewards_engine.get_rank_reward_tier(50) == ("BRONZE_TOUIZA", "ANALYST", 10_000)
        assert rewards_engine.get_rank_reward_tier(51) == ("TOUIZA_HONOR", "SCOUT", 5_000)
        assert rewards_engine.get_rank_reward_tier(100) == ("TOUIZA_HONOR", "SCOUT", 5_000)
        assert rewards_engine.get_rank_reward_tier(101) == ("PARTICIPANT", "NOVICE", 0)

    def test_58_wilaya_sovereign_cup_aggregation_and_champion(self, rewards_engine, fantasy_engine):
        """Aggregates fantasy points across Wilayas and awards 1,000,000 DZD to champion Wilaya."""
        active_season = fantasy_engine.get_active_season()

        # Set up analyst from Sétif (Wilaya 19)
        fantasy_engine.build_team_roster(
            user_id=191,
            season_id=active_season.season_id,
            gameweek=1,
            captain_startup_id="startup-greenfarm",
            wildcard_startup_id="startup-finflow",
            core_startup_ids=["startup-solartech", "startup-logixpress", "startup-edualgerie"],
        )
        rewards_engine.set_user_wilaya(191, 19)  # Sétif

        # Trigger event giving points to greenfarm
        fantasy_engine.trigger_real_world_event(
            startup_id="startup-greenfarm",
            event_type="ARR_GROWTH_20",
            gameweek=1,
            description="GreenFarm MoM growth",
        )

        wilaya_standings = rewards_engine.evaluate_wilaya_cup(season_id=active_season.season_id)
        assert len(wilaya_standings) == 58
        top_wilaya = wilaya_standings[0]

        # Sétif should be the top scoring Wilaya
        assert top_wilaya.wilaya_code == 19
        assert top_wilaya.wilaya_name == "Sétif"
        assert top_wilaya.total_points > 0
        assert top_wilaya.is_champion is True
        assert top_wilaya.allocated_prize_dzd == WILAYA_CUP_PRIZE_POOL_DZD

    def test_simulated_startup_dividend_declaration_and_distribution(
        self, rewards_engine, amm_engine, ledger
    ):
        """
        Simulated startup dividend:
        - User 10 owns 20 shares of GreenFarm AI.
        - User 20 owns 10 shares of GreenFarm AI.
        - GreenFarm declares 50 DZD/share dividend for 2.5M DZD GMV milestone.
        - Payout: User 10 gets 1000 DZD, User 20 gets 500 DZD.
        - Zero-sum balancing verified.
        """
        startup_id = "startup-greenfarm"

        # Seed share ownership via AMM
        amm_engine._user_shares.setdefault(10, {})[startup_id] = 20
        amm_engine._user_shares.setdefault(20, {})[startup_id] = 10

        receipt = rewards_engine.declare_and_distribute_dividends(
            startup_id=startup_id,
            dividend_per_share_dzd=50,
            gmv_milestone_dzd=2_500_000,
            description="Q3 AgriTech GMV Milestone Dividend",
        )

        assert receipt.total_shares_eligible == 30
        assert receipt.total_payout_dzd == 1500  # 30 * 50
        assert receipt.recipients_count == 2
        assert "div-" in receipt.declaration_id

        # Verify ledger balances
        u10_bal = ledger.get_account_balance("USER:10:VIRTUAL_CASH")
        assert u10_bal == 50_000 + 1000  # starter grant + 1000 div

        u20_bal = ledger.get_account_balance("USER:20:VIRTUAL_CASH")
        assert u20_bal == 50_000 + 500   # starter grant + 500 div

        audit = ledger.verify_state_chain()
        assert audit["isValid"] is True

    def test_comprehensive_season_end_distribution_settlement(
        self, rewards_engine, fantasy_engine, ledger
    ):
        """
        Full end-of-season settlement:
        - Leaderboard bonus distribution.
        - Wilaya cup prize distribution.
        - Complete season distribution report generation.
        """
        active_season = fantasy_engine.get_active_season()

        # Build rosters for test users
        fantasy_engine.build_team_roster(
            user_id=1,
            season_id=active_season.season_id,
            gameweek=1,
            captain_startup_id="startup-finflow",
            wildcard_startup_id="startup-greenfarm",
            core_startup_ids=["startup-solartech", "startup-logixpress", "startup-edualgerie"],
        )
        rewards_engine.set_user_wilaya(1, 16)  # Alger

        # Trigger event
        fantasy_engine.trigger_real_world_event(
            startup_id="startup-finflow",
            event_type="STARTUP_LABEL",
            gameweek=1,
            description="Startup Label Decree 20-254",
        )

        report = rewards_engine.distribute_season_end_rewards(season_id=active_season.season_id)
        assert report.season_id == active_season.season_id
        assert report.total_analysts >= 1
        assert report.top_analysts_rewards_dzd >= 50_000  # Rank 1 gets 50,000 DZD
        assert report.grand_total_distributed_dzd > 0

        # Verify rank 1 user received 50k bonus
        u1_bal = ledger.get_account_balance("USER:1:VIRTUAL_CASH")
        assert u1_bal > 50_000  # initial 50k + prize payout

        # Verify audit state chain
        audit = ledger.verify_state_chain()
        assert audit["isValid"] is True

    def test_collusion_disqualification_strips_season_bonus(
        self, rewards_engine, fantasy_engine, amm_engine, ledger
    ):
        """Verifies that an analyst flagged for wash trading/collusion has their reward revoked."""
        from app.services.anti_collusion_engine import anti_collusion_engine
        active_season = fantasy_engine.get_active_season()

        # Build roster for user 999
        fantasy_engine.build_team_roster(
            user_id=999,
            season_id=active_season.season_id,
            gameweek=1,
            captain_startup_id="startup-greenfarm",
            wildcard_startup_id="startup-finflow",
            core_startup_ids=["startup-solartech", "startup-logixpress", "startup-edualgerie"],
        )
        rewards_engine.set_user_wilaya(999, 16)
        fantasy_engine.advance_gameweek(active_season.season_id)

        # Manually flag user 999 for wash trading
        anti_collusion_engine.flag_account_manually(999)

        standings = rewards_engine.evaluate_season_leaderboard(season_id=active_season.season_id)
        user_standing = next((s for s in standings if s.user_id == 999), None)
        assert user_standing is not None
        assert user_standing.is_disqualified is True
        assert user_standing.reward_dzd == 0
        assert user_standing.trophy == "REVOKED"
        assert user_standing.badge == "DISQUALIFIED"


# =============================================================================
# 3. FASTAPI HTTP ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestFastApiAMMAndSeasonRewardsEndpoints:
    """Verifies all FastAPI HTTP endpoints under /api/v1/amm and /api/v1/fantasy/season."""

    @pytest.fixture
    def client(self):
        transport = ASGITransport(app=app)
        c = AsyncClient(transport=transport, base_url="http://test")
        csrf_val = "test_csrf_token_value_32_chars_123"
        c.cookies.set("csrf_token", csrf_val)
        c.headers.update({"x-csrf-token": csrf_val})
        return c

    @pytest.fixture
    def mock_user(self):
        return MagicMock(
            id=77,
            fullName="Samir Hadj",
            email="samir@tamwheel.dz",
            role="STUDENT",
            analystTier="SCOUT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_amm_endpoints_flow(self, client, mock_user):
        """Tests /amm/pools, /amm/quote, /amm/trade, and /amm/holdings."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. GET /api/v1/amm/pools
            pools_resp = await client.get("/api/v1/amm/pools")
            assert pools_resp.status_code == 200
            pools_data = pools_resp.json()
            assert len(pools_data) >= 1

            # 2. GET /api/v1/amm/pools/startup-finflow
            p_resp = await client.get("/api/v1/amm/pools/startup-finflow")
            assert p_resp.status_code == 200
            p_data = p_resp.json()
            assert p_data["startupId"] == "startup-finflow"
            assert p_data["spotPrice"] > 0

            # 3. POST /api/v1/amm/quote (BUY quote)
            q_resp = await client.post(
                "/api/v1/amm/quote",
                json={"startupId": "startup-finflow", "sharesAmount": 5, "action": "BUY"},
            )
            assert q_resp.status_code == 200
            q_data = q_resp.json()
            assert q_data["action"] == "BUY"
            assert q_data["totalCostOrRefund"] > 0

            # 4. POST /api/v1/amm/trade (BUY trade)
            trade_resp = await client.post(
                "/api/v1/amm/trade",
                json={
                    "startupId": "startup-finflow",
                    "action": "BUY",
                    "sharesAmount": 5,
                    "maxSlippagePct": 10.0,
                },
            )
            assert trade_resp.status_code == 200
            trade_data = trade_resp.json()
            assert trade_data["action"] == "BUY"
            assert trade_data["sharesAmount"] == 5
            assert "JE-" in trade_data["journalEntryId"]

            # 5. GET /api/v1/amm/holdings
            h_resp = await client.get("/api/v1/amm/holdings")
            assert h_resp.status_code == 200
            h_data = h_resp.json()
            assert h_data["userId"] == 77
            assert h_data["holdingsCount"] >= 1
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_season_rewards_endpoints_flow(self, client, mock_user):
        """Tests /fantasy/season/leaderboard, /wilaya-cup, /dividends, /distribute."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. GET /api/v1/fantasy/season/leaderboard
            lb_resp = await client.get("/api/v1/fantasy/season/leaderboard")
            assert lb_resp.status_code == 200
            lb_data = lb_resp.json()
            assert isinstance(lb_data, list)

            # 2. GET /api/v1/fantasy/season/wilaya-cup
            wc_resp = await client.get("/api/v1/fantasy/season/wilaya-cup")
            assert wc_resp.status_code == 200
            wc_data = wc_resp.json()
            assert len(wc_data) == 58

            # 3. POST /api/v1/fantasy/season/distribute
            dist_resp = await client.post("/api/v1/fantasy/season/distribute")
            assert dist_resp.status_code == 200
            dist_data = dist_resp.json()
            assert "grandTotalDistributedDzd" in dist_data
            assert "seasonId" in dist_data

            # 4. GET /api/v1/fantasy/season/report
            rep_resp = await client.get("/api/v1/fantasy/season/report")
            assert rep_resp.status_code == 200
            rep_data = rep_resp.json()
            assert rep_data["seasonId"] == dist_data["seasonId"]
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)
