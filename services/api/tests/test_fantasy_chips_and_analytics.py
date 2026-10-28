"""
TamWheel Sovereign Ethical Agentic Venture OS — Pillar 2 Phase 2 Comprehensive Test Suite.
Focus: Fantasy Strategic Chips, Transfer Market Momentum, Portfolio Analytics (TWR/MWR/Sharpe),
and 58-Wilaya Sovereign Diversification Index.

Verifies:
1. Strategic Chips Engine:
   - TRIPLE_CAPTAIN: 3.0x multiplier on designated captain.
   - SECTOR_SURGE: +50% multiplier boost on designated sector startups.
   - Single-use per season validation (cannot consume same chip twice).
   - Mutual exclusivity: max 1 chip active per gameweek.
   - FREE_HIT: 1-gameweek squad overhaul with 0 penalty points, followed by automatic reversion.
2. Transfer Market & Momentum:
   - Free transfer quota deduction (1 free transfer/gameweek, banked up to 2).
   - Extra transfers hit penalty: -4 SP per additional transfer.
   - 1-hour broadcast deadline lock: transfers frozen within 1 hour of show broadcast.
   - Price change momentum: net transfers (in - out) shift prices by +/- 500 SP, clamped to [10k, 35k].
3. Portfolio Analytics Engine:
   - Time-Weighted Return (TWR) eliminating cash flow timing distortion.
   - Money-Weighted Return (MWR / IRR) via Newton-Raphson approximation.
   - Sharpe Ratio simulator with 3.5% sovereign risk-free rate proxy.
   - 58-Wilaya Sovereign Diversification Index (Decree 19-12): HHI, normalized 0-100 score, Shannon entropy.
4. FastAPI Endpoints Integration:
   - POST /api/v1/fantasy/chips/activate
   - GET /api/v1/fantasy/chips/status
   - POST /api/v1/fantasy/transfers
   - GET /api/v1/fantasy/market/trends
   - POST /api/v1/fantasy/market/rebalance-prices
   - GET /api/v1/simulation/analytics
   - GET /api/v1/simulation/analytics/wilayas
"""

import math
import copy
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.services.fantasy_league import (
    FantasyStartupLeagueEngine,
    StartupMetadata,
    SALARY_CAP_SP,
    ROSTER_SIZE,
)
from app.services.portfolio_analytics import (
    PortfolioAnalyticsEngine,
    CashFlowPeriod,
    NUM_ALGERIAN_WILAYAS,
    DEFAULT_RISK_FREE_RATE,
    WILAYA_NAMES_DZ,
)


# =============================================================================
# 1. UNIT TESTS: FANTASY STRATEGIC CHIPS & TRANSFER MARKET MOMENTUM
# =============================================================================

class TestFantasyChipsAndTransfers:
    """Verifies strategic chips (Triple Captain, Sector Surge, Free Hit) and Transfer Market mechanics."""

    @pytest.fixture
    def engine(self):
        eng = FantasyStartupLeagueEngine()
        return eng

    def _setup_test_roster(self, engine: FantasyStartupLeagueEngine, user_id: int = 101, gw: int = 1):
        """
        Builds a valid initial 5-startup roster using seeded catalog startups:
        - Captain: startup-finflow (FinTech, 18,000 SP, 22M DZD) -> 1.5x
        - Wildcard: startup-greenfarm (AgTech, 22,000 SP, 28M DZD < 30M -> 2.0x)
        - Core 1: startup-logixpress (Logistics, 15,000 SP) -> 1.0x
        - Core 2: startup-edualgerie (EduTech, 12,000 SP) -> 1.0x
        - Core 3: startup-saharasolar (CleanTech, 16,000 SP) -> 1.0x
        Total SP = 18 + 22 + 15 + 12 + 16 = 83,000 SP <= 100,000 SP.
        5 distinct sectors (FinTech, AgTech, Logistics, EduTech, CleanTech).
        """
        active_season = engine.get_active_season()
        return engine.build_team_roster(
            user_id=user_id,
            season_id=active_season.season_id,
            gameweek=gw,
            captain_startup_id="startup-finflow",
            wildcard_startup_id="startup-greenfarm",
            core_startup_ids=[
                "startup-logixpress",
                "startup-edualgerie",
                "startup-saharasolar",
            ],
        )

    def test_triple_captain_chip_multiplier(self, engine):
        """TRIPLE_CAPTAIN applies 3.0x multiplier to designated Captain."""
        roster = self._setup_test_roster(engine, user_id=1, gw=1)
        active_season = engine.get_active_season()

        # Before chip: Captain has 1.5x multiplier
        capt_before = next(s for s in roster.startups if s.role == "CAPTAIN")
        assert capt_before.multiplier == 1.5

        # Activate TRIPLE_CAPTAIN
        res = engine.activate_chip(
            user_id=1,
            season_id=active_season.season_id,
            gameweek=1,
            chip_type="TRIPLE_CAPTAIN",
        )
        assert res["success"] is True
        assert res["chipType"] == "TRIPLE_CAPTAIN"

        # After chip: Captain must have exactly 3.0x multiplier
        updated_roster = engine.get_user_roster(user_id=1, season_id=active_season.season_id, gameweek=1)
        assert updated_roster.active_chip == "TRIPLE_CAPTAIN"
        capt_after = next(s for s in updated_roster.startups if s.role == "CAPTAIN")
        assert capt_after.multiplier == 3.0

        # Trigger scoring event: TECH_HIRE (+50 pts) on startup-finflow
        engine.trigger_real_world_event(
            startup_id="startup-finflow",
            event_type="TECH_HIRE",
            gameweek=1,
            description="FinFlow hires Lead Rust Blockchain Engineer",
        )

        refreshed_roster = engine.get_user_roster(user_id=1, season_id=active_season.season_id, gameweek=1)
        capt_scored = next(s for s in refreshed_roster.startups if s.role == "CAPTAIN")
        # 50 base points * 3.0x multiplier = 150.0 points
        assert capt_scored.gameweek_points == 150.0

    def test_sector_surge_chip_bonus(self, engine):
        """SECTOR_SURGE grants +50% multiplier boost on all startups in target sector."""
        roster = self._setup_test_roster(engine, user_id=2, gw=1)
        active_season = engine.get_active_season()

        # Target AgTech sector (startup-greenfarm is Wildcard with 2.0x baseline)
        res = engine.activate_chip(
            user_id=2,
            season_id=active_season.season_id,
            gameweek=1,
            chip_type="SECTOR_SURGE",
            target_sector="AgTech",
        )
        assert res["success"] is True

        updated_roster = engine.get_user_roster(user_id=2, season_id=active_season.season_id, gameweek=1)
        greenfarm = next(s for s in updated_roster.startups if s.startup_id == "startup-greenfarm")
        # 2.0 * 1.5 = 3.0x multiplier
        assert greenfarm.multiplier == 3.0

        # Trigger ARR_GROWTH_20 (+100 pts) on GreenFarm
        engine.trigger_real_world_event(
            startup_id="startup-greenfarm",
            event_type="ARR_GROWTH_20",
            gameweek=1,
            description="GreenFarm monthly ARR explodes by 35%",
        )

        refreshed = engine.get_user_roster(user_id=2, season_id=active_season.season_id, gameweek=1)
        greenfarm_scored = next(s for s in refreshed.startups if s.startup_id == "startup-greenfarm")
        assert greenfarm_scored.gameweek_points == 300.0  # 100 base * 3.0

    def test_chip_single_use_per_season_rejection(self, engine):
        """Chips are single-use per 12-week season. Consuming twice must raise 400 Bad Request."""
        self._setup_test_roster(engine, user_id=3, gw=1)
        active_season = engine.get_active_season()

        # Use in Gameweek 1
        engine.activate_chip(
            user_id=3,
            season_id=active_season.season_id,
            gameweek=1,
            chip_type="TRIPLE_CAPTAIN",
        )

        # Attempt to use again in Gameweek 2
        with pytest.raises(HTTPException) as exc_info:
            engine.activate_chip(
                user_id=3,
                season_id=active_season.season_id,
                gameweek=2,
                chip_type="TRIPLE_CAPTAIN",
            )
        assert exc_info.value.status_code == 400
        assert "already been consumed" in exc_info.value.detail

    def test_chip_mutex_per_gameweek(self, engine):
        """Only one chip can be active in a given gameweek. Mutex violation raises 400."""
        self._setup_test_roster(engine, user_id=4, gw=1)
        active_season = engine.get_active_season()

        # Activate TRIPLE_CAPTAIN
        engine.activate_chip(
            user_id=4,
            season_id=active_season.season_id,
            gameweek=1,
            chip_type="TRIPLE_CAPTAIN",
        )

        # Attempt to activate SECTOR_SURGE in same gameweek
        with pytest.raises(HTTPException) as exc_info:
            engine.activate_chip(
                user_id=4,
                season_id=active_season.season_id,
                gameweek=1,
                chip_type="SECTOR_SURGE",
                target_sector="FinTech",
            )
        assert exc_info.value.status_code == 400
        assert "already active in Gameweek 1" in exc_info.value.detail

    def test_free_hit_squad_overhaul_and_gameweek_reversion(self, engine):
        """
        FREE_HIT: Overhauls team for 1 gameweek with zero transfer penalties.
        Upon advance_gameweek, squad automatically reverts back to pre-Free Hit snapshot.
        """
        active_season = engine.get_active_season()

        # GW1 Roster (Squad A)
        roster_gw1 = self._setup_test_roster(engine, user_id=5, gw=1)
        original_startup_ids = {s.startup_id for s in roster_gw1.startups}

        # Advance to GW2
        engine.advance_gameweek(active_season.season_id)
        active_season = engine.get_active_season()
        assert active_season.current_gameweek == 2

        # In GW2, build standard squad first
        self._setup_test_roster(engine, user_id=5, gw=2)

        # Activate FREE_HIT chip in GW2
        chip_res = engine.activate_chip(
            user_id=5,
            season_id=active_season.season_id,
            gameweek=2,
            chip_type="FREE_HIT",
        )
        assert chip_res["success"] is True

        # Perform transfer under FREE_HIT (out: startup-edualgerie 12k, in: startup-solartech 20k)
        # Total SP = 83k - 12k + 20k = 91k SP <= 100k SP
        transfer_res = engine.execute_transfers(
            user_id=5,
            season_id=active_season.season_id,
            gameweek=2,
            transfers=[
                {"startup_out_id": "startup-edualgerie", "startup_in_id": "startup-solartech"},
            ],
            bypass_deadline=True,
        )
        # FREE_HIT waives penalty points
        assert transfer_res["transferPenaltyPoints"] == 0
        gw2_roster = engine.get_user_roster(user_id=5, season_id=active_season.season_id, gameweek=2)
        assert any(s.startup_id == "startup-solartech" for s in gw2_roster.startups)
        assert not any(s.startup_id == "startup-edualgerie" for s in gw2_roster.startups)

        # Now advance gameweek to GW3 -> Squad MUST revert to original Squad A!
        engine.advance_gameweek(active_season.season_id)
        gw3_season = engine.get_active_season()
        assert gw3_season.current_gameweek == 3

        gw3_roster = engine.get_user_roster(user_id=5, season_id=active_season.season_id, gameweek=3)
        assert gw3_roster is not None
        reverted_startup_ids = {s.startup_id for s in gw3_roster.startups}
        assert reverted_startup_ids == original_startup_ids
        assert "startup-edualgerie" in reverted_startup_ids
        assert "startup-solartech" not in reverted_startup_ids

    def test_transfer_free_quota_and_penalty_deduction(self, engine):
        """
        1 free transfer per gameweek.
        Extra transfers incur -4 SP hit each.
        Free transfers bank up to a max of 2 if unused.
        """
        roster = self._setup_test_roster(engine, user_id=6, gw=1)
        active_season = engine.get_active_season()

        # Available free transfers starts at 1
        assert engine.get_user_free_transfers(user_id=6, season_id=active_season.season_id) == 1

        # Execute 2 transfers: 1 free, 1 extra -> -4 SP penalty
        # Out: startup-edualgerie (12k, EduTech), startup-saharasolar (16k, CleanTech) = 28k SP freed
        # In: startup-solartech (20k, CleanTech), startup-sihatech (25k, HealthTech)
        # 83k - 28k + 20k + 25k = 100,000 SP (exactly salary cap)
        res = engine.execute_transfers(
            user_id=6,
            season_id=active_season.season_id,
            gameweek=1,
            transfers=[
                {"startup_out_id": "startup-edualgerie", "startup_in_id": "startup-solartech"},
                {"startup_out_id": "startup-saharasolar", "startup_in_id": "startup-sihatech"},
            ],
            bypass_deadline=True,
        )
        assert res["success"] is True
        assert res["freeTransfersUsed"] == 1
        assert res["extraTransfers"] == 1
        assert res["transferPenaltyPoints"] == 4  # 1 * 4

        # Verify roster records transfer penalty points
        gw1_roster = engine.get_user_roster(user_id=6, season_id=active_season.season_id, gameweek=1)
        assert gw1_roster.transfer_penalty_points == 4

        # Test banking: Advance gameweek when a new user doesn't use transfers
        self._setup_test_roster(engine, user_id=7, gw=1)
        assert engine.get_user_free_transfers(user_id=7, season_id=active_season.season_id) == 1
        # Advance gameweek -> should bank to 2
        engine.advance_gameweek(active_season.season_id)
        assert engine.get_user_free_transfers(user_id=7, season_id=active_season.season_id) == 2
        # Advance again -> should cap at 2
        engine.advance_gameweek(active_season.season_id)
        assert engine.get_user_free_transfers(user_id=7, season_id=active_season.season_id) == 2

    def test_transfer_market_deadline_lock(self, engine):
        """Transfers freeze 1 hour before televised pitch broadcast."""
        self._setup_test_roster(engine, user_id=8, gw=1)
        active_season = engine.get_active_season()

        # Set deadline to 30 minutes in the future (within the 1-hour freeze period)
        locked_deadline = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        active_season.gameweek_deadline = locked_deadline

        # Attempt transfer without bypass_deadline -> must be rejected
        with pytest.raises(HTTPException) as exc_info:
            engine.execute_transfers(
                user_id=8,
                season_id=active_season.season_id,
                gameweek=1,
                transfers=[
                    {"startup_out_id": "startup-edualgerie", "startup_in_id": "startup-solartech"},
                ],
                bypass_deadline=False,
            )
        assert exc_info.value.status_code == 400
        assert "Transfer deadline locked" in exc_info.value.detail

        # With bypass_deadline=True, execution succeeds
        res = engine.execute_transfers(
            user_id=8,
            season_id=active_season.season_id,
            gameweek=1,
            transfers=[
                {"startup_out_id": "startup-edualgerie", "startup_in_id": "startup-solartech"},
            ],
            bypass_deadline=True,
        )
        assert res["success"] is True

    def test_price_change_momentum_algorithm(self, engine):
        """
        Transfers shift price momentum:
        Net transfers >= 5 triggers +500 SP increase.
        Net transfers <= -5 triggers -500 SP decrease.
        Prices clamped within [10,000 SP, 35,000 SP].
        """
        startup = engine.get_startup_metadata("startup-finflow")
        assert startup is not None
        initial_price = startup.fantasy_price_sp

        # Simulate 6 community purchases (transfers IN)
        startup.transfers_in = 6
        startup.transfers_out = 0

        adjustments = engine.rebalance_market_prices(threshold=5, price_step_sp=500)
        assert len(adjustments) >= 1
        adj = next(a for a in adjustments if a["startupId"] == "startup-finflow")
        assert adj["deltaSp"] == 500
        assert adj["newPriceSp"] == initial_price + 500
        assert startup.fantasy_price_sp == initial_price + 500

        # Simulate 7 sales (transfers OUT)
        startup.transfers_in = 0
        startup.transfers_out = 7
        adjustments_neg = engine.rebalance_market_prices(threshold=5, price_step_sp=500)
        adj_neg = next(a for a in adjustments_neg if a["startupId"] == "startup-finflow")
        assert adj_neg["deltaSp"] == -500
        assert adj_neg["newPriceSp"] == initial_price

        # Clamping tests
        startup.fantasy_price_sp = 34_800
        startup.transfers_in = 10
        engine.rebalance_market_prices(threshold=5, price_step_sp=500)
        assert startup.fantasy_price_sp == 35_000  # Clamped at 35,000 SP max

        startup.fantasy_price_sp = 10_200
        startup.transfers_out = 10
        engine.rebalance_market_prices(threshold=5, price_step_sp=500)
        assert startup.fantasy_price_sp == 10_000  # Clamped at 10,000 SP min


# =============================================================================
# 2. UNIT TESTS: PORTFOLIO ANALYTICS (TWR, MWR, SHARPE & 58-WILAYA INDEX)
# =============================================================================

class TestPortfolioAnalyticsEngine:
    """Verifies mathematical correctness of TWR, MWR (IRR), Sharpe Ratio, and Wilaya Diversification."""

    def test_portfolio_twr_calculation(self):
        """Time-Weighted Return eliminates cash inflow/outflow timing distortions."""
        # Sub-period 1: Start 50k, End 60k (Return = +20%)
        # Sub-period 2: Start 60k + Cash Inflow 10k (Base = 70k), End 77k (Return = +10%)
        # Total TWR = (1 + 0.20) * (1 + 0.10) - 1 = +32.0%
        periods = [
            CashFlowPeriod(period_index=1, start_value=50_000, end_value=60_000, cash_inflow=0),
            CashFlowPeriod(period_index=2, start_value=60_000, end_value=77_000, cash_inflow=10_000),
        ]
        twr = PortfolioAnalyticsEngine.calculate_time_weighted_return(periods)
        assert twr == 32.0

        # Empty periods returns 0.0
        assert PortfolioAnalyticsEngine.calculate_time_weighted_return([]) == 0.0

    def test_portfolio_mwr_calculation(self):
        """Money-Weighted Return approximates Internal Rate of Return (IRR) via Newton-Raphson."""
        # Single initial investment of 50,000 at t=0, terminal value 60,000 at t=1.0 year
        # Expected IRR = (60k - 50k) / 50k = +20.0%
        cash_flows = [(0.0, -50_000.0)]
        mwr = PortfolioAnalyticsEngine.calculate_money_weighted_return(
            cash_flows=cash_flows,
            terminal_value=60_000.0,
            terminal_time=1.0,
        )
        assert abs(mwr - 20.0) < 0.5

    def test_sharpe_ratio_simulation(self):
        """Calculates annualized Sharpe Ratio using 3.5% sovereign risk-free rate proxy."""
        # Steady positive return series
        returns = [0.04, 0.05, 0.03, 0.06, 0.04, 0.05]
        sharpe, vol = PortfolioAnalyticsEngine.calculate_sharpe_ratio(
            periodic_returns=returns,
            risk_free_rate=DEFAULT_RISK_FREE_RATE,
        )
        assert sharpe > 0.0
        assert vol > 0.0

        # Zero volatility series returns 0.0
        flat_returns = [0.02, 0.02, 0.02]
        s_flat, v_flat = PortfolioAnalyticsEngine.calculate_sharpe_ratio(flat_returns)
        assert s_flat == 0.0
        assert v_flat == 0.0

    def test_wilaya_diversification_58_index(self):
        """
        Decree 19-12 58 Wilaya Index:
        1. 100% concentration in 1 wilaya: HHI = 1.0, Score = 0.0, Shannon entropy = 0.0.
        2. Uniform distribution across all 58 wilayas: HHI = 1/58, Score = 100.0, Shannon entropy = 1.0.
        3. Balanced 4-Wilaya distribution: Score strictly between 0 and 100.
        """
        # 1. 100% Concentrated in Algiers (Wilaya 16)
        conc = {16: 50_000}
        res_conc = PortfolioAnalyticsEngine.calculate_wilaya_diversification(conc)
        assert res_conc["hhi"] == 1.0
        assert res_conc["score"] == 0.0
        assert res_conc["entropy_ratio"] == 0.0
        assert res_conc["active_wilayas"] == 1

        # 2. Perfectly Uniform across all 58 Wilayas (1,000 DZD in each)
        uniform = {w: 1_000 for w in range(1, NUM_ALGERIAN_WILAYAS + 1)}
        res_unif = PortfolioAnalyticsEngine.calculate_wilaya_diversification(uniform)
        expected_min_hhi = round(1.0 / NUM_ALGERIAN_WILAYAS, 4)
        assert abs(res_unif["hhi"] - expected_min_hhi) <= 0.0001
        assert res_unif["score"] == 100.0
        assert res_unif["entropy_ratio"] == 1.0
        assert res_unif["active_wilayas"] == 58

        # 3. 4-Wilaya distribution (Alger, Oran, Constantine, Ouargla)
        balanced_4 = {16: 15_000, 31: 15_000, 25: 10_000, 30: 10_000}
        res_4 = PortfolioAnalyticsEngine.calculate_wilaya_diversification(balanced_4)
        assert 0.0 < res_4["score"] < 100.0
        assert res_4["active_wilayas"] == 4
        assert res_4["hhi"] < 1.0
        assert res_4["entropy_ratio"] > 0.0

    def test_evaluate_portfolio_full(self):
        """Full institutional analytics evaluation for a simulation user."""
        holdings = [
            {"amount_dzd": 15_000, "current_value_dzd": 18_000, "wilaya": 16},
            {"amount_dzd": 10_000, "current_value_dzd": 12_000, "wilaya": 31},
            {"amount_dzd": 10_000, "current_value_dzd": 11_000, "wilaya": 30},
        ]
        res = PortfolioAnalyticsEngine.evaluate_portfolio(
            user_id=99,
            initial_grant_dzd=50_000,
            holdings=holdings,
            cash_balance_dzd=15_000,
        )
        assert res.user_id == 99
        assert res.initial_capital_dzd == 50_000
        assert res.current_portfolio_value_dzd == 56_000  # 15k cash + 41k holdings
        assert res.net_profit_dzd == 6_000
        assert res.simple_roi_pct == 12.0
        assert res.active_wilayas_count == 3
        assert res.wilaya_diversification_score > 0.0
        assert len(res.top_wilaya_allocations) == 3


# =============================================================================
# 3. FASTAPI HTTP ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestPillar2Phase2Endpoints:
    """Verifies new FastAPI endpoints for Chips, Transfers, Market Momentum, and Portfolio Analytics."""

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
            fullName="Amine Mansouri",
            email="amine@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_chips_activate_and_status_endpoints(self, client, mock_user):
        """POST /api/v1/fantasy/chips/activate and GET /api/v1/fantasy/chips/status."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. First build a roster using valid seeded startups
            roster_payload = {
                "captainStartupId": "startup-finflow",
                "wildcardStartupId": "startup-greenfarm",
                "coreStartupIds": ["startup-logixpress", "startup-edualgerie", "startup-saharasolar"],
            }
            roster_resp = await client.post("/api/v1/fantasy/roster", json=roster_payload)
            assert roster_resp.status_code == 200

            # 2. Activate TRIPLE_CAPTAIN chip
            chip_payload = {
                "chipType": "TRIPLE_CAPTAIN",
            }
            chip_resp = await client.post("/api/v1/fantasy/chips/activate", json=chip_payload)
            assert chip_resp.status_code == 200
            chip_data = chip_resp.json()
            assert chip_data["success"] is True
            assert chip_data["chipType"] == "TRIPLE_CAPTAIN"

            # 3. Query chips status
            status_resp = await client.get("/api/v1/fantasy/chips/status")
            assert status_resp.status_code == 200
            status_data = status_resp.json()
            assert "TRIPLE_CAPTAIN" in status_data["consumedChips"]
            assert "SECTOR_SURGE" in status_data["availableChips"]
            assert "FREE_HIT" in status_data["availableChips"]
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_transfers_and_market_endpoints(self, client, mock_user):
        """POST /api/v1/fantasy/transfers, GET /market/trends, and POST /market/rebalance-prices."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. Build roster
            roster_payload = {
                "captainStartupId": "startup-finflow",
                "wildcardStartupId": "startup-greenfarm",
                "coreStartupIds": ["startup-logixpress", "startup-edualgerie", "startup-saharasolar"],
            }
            roster_init = await client.post("/api/v1/fantasy/roster", json=roster_payload)
            assert roster_init.status_code == 200

            # 2. Execute transfer with bypassDeadline=True
            transfer_payload = {
                "transfers": [
                    {"startup_out_id": "startup-edualgerie", "startup_in_id": "startup-solartech"},
                ],
                "bypassDeadline": True,
            }
            trans_resp = await client.post("/api/v1/fantasy/transfers", json=transfer_payload)
            assert trans_resp.status_code == 200
            trans_data = trans_resp.json()
            assert trans_data["success"] is True
            assert trans_data["transfersExecuted"] == 1

            # 3. Get market trends
            trends_resp = await client.get("/api/v1/fantasy/market/trends")
            assert trends_resp.status_code == 200
            trends_data = trends_resp.json()
            assert "trends" in trends_data
            assert trends_data["count"] > 0

            # 4. Trigger price rebalancing
            rebal_resp = await client.post(
                "/api/v1/fantasy/market/rebalance-prices",
                json={"threshold": 1, "priceStepSp": 500},
            )
            assert rebal_resp.status_code == 200
            rebal_data = rebal_resp.json()
            assert "adjustments" in rebal_data
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_simulation_analytics_endpoints(self, client, mock_user):
        """GET /api/v1/simulation/analytics and GET /api/v1/simulation/analytics/wilayas."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        mock_campaign = MagicMock(
            id="camp-1",
            targetAmountDzd=10_000_000,
            raisedAmountDzd=6_000_000,
            startup=MagicMock(
                id="start-1",
                name="Adrar Solar Tech",
                wilaya=1,  # Adrar
                hypeScore=60.0,
            ),
        )
        mock_pledge = MagicMock(
            id="pledge-1",
            campaignId="camp-1",
            userId=77,
            amountDzd=15_000,
            campaign=mock_campaign,
        )

        try:
            with patch("app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock) as mock_u, \
                 patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_pledges:

                mock_u.return_value = mock_user
                mock_pledges.return_value = [mock_pledge]

                # 1. Test GET /api/v1/simulation/analytics
                ana_resp = await client.get("/api/v1/simulation/analytics")
                assert ana_resp.status_code == 200
                ana_data = ana_resp.json()
                assert ana_data["userId"] == 77
                assert ana_data["initialCapitalDzd"] == 50_000
                assert "timeWeightedReturnPct" in ana_data
                assert "moneyWeightedReturnPct" in ana_data
                assert "sharpeRatio" in ana_data
                assert "wilayaDiversificationScore" in ana_data
                assert ana_data["totalWilayasCount"] == 58

                # 2. Test GET /api/v1/simulation/analytics/wilayas
                w_resp = await client.get("/api/v1/simulation/analytics/wilayas")
                assert w_resp.status_code == 200
                w_data = w_resp.json()
                assert "score" in w_data
                assert "hhi" in w_data
                assert "entropyRatio" in w_data
                assert w_data["totalWilayasCount"] == 58
                assert len(w_data["allocations"]) >= 1
                assert w_data["allocations"][0]["wilayaCode"] == 1
                assert w_data["allocations"][0]["wilayaName"] == "Adrar"
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)
            app.dependency_overrides.pop(get_current_user, None)
