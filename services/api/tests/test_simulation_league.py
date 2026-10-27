"""
TamWheel Sovereign Ethical Agentic Venture OS — Simulation League, Hype Score & Curriculum Test Suite.
Tests:
1. Virtual pledge deduction and simulation ledger (strictly zero real-money movement)
2. Minimum ticket enforcement (>= 5,000 DZD)
3. Insufficient virtual balance rejection
4. Campaign ACTIVE_SIMULATION status gate & auto-funding transition
5. Weighted Hype Score exact formula & analyst tier weights (1.0x, 1.5x, 2.5x, 4.0x)
6. Anti-brigading exponential decay over burst windows
7. Darija Financial Literacy 5-module quiz grading and automatic promotion (NOVICE -> SCOUT)
8. Executive Decree 20-254 Startup Label Diagnostic scoring & gap analysis
9. Fantasy Startup League (FSL) ROI calculation and leaderboard dynamic ranking
"""

import math
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.generated.prisma.enums import CampaignStatus, AnalystLevel
from app.services.hype_score import HypeScoreEngine, ANALYST_WEIGHTS
from app.services.simulation_engine import SimulationEngine, INITIAL_SIMULATION_GRANT_DZD, DEFAULT_MIN_TICKET_DZD
from app.main import app


# =============================================================================
# 1. UNIT TESTS: WEIGHTED HYPE SCORE ENGINE
# =============================================================================

class TestHypeScoreEngine:
    """Mathematical and anti-brigading verification for HypeScoreEngine."""

    def test_analyst_weights_constants(self):
        """Verify weights: Novice 1.0x, Scout 1.5x, Analyst 2.5x, Partner 4.0x."""
        engine = HypeScoreEngine()
        assert engine.get_analyst_weight(AnalystLevel.NOVICE) == 1.0
        assert engine.get_analyst_weight(AnalystLevel.SCOUT) == 1.5
        assert engine.get_analyst_weight(AnalystLevel.ANALYST) == 2.5
        assert engine.get_analyst_weight(AnalystLevel.PARTNER) == 4.0

    def test_calculate_raw_score_normalization(self):
        """Verify raw score normalizes 1-10 to 10-100 scale."""
        # 10, 10, 10 -> 100.0
        assert HypeScoreEngine.calculate_raw_score(10, 10, 10) == 100.0
        # 1, 1, 1 -> 10.0
        assert HypeScoreEngine.calculate_raw_score(1, 1, 1) == 10.0
        # 6, 8, 7 -> 70.0
        assert HypeScoreEngine.calculate_raw_score(6, 8, 7) == 70.0

    def test_weighted_hype_score_formula_exact(self):
        """
        Verify formula: HypeScore = Sum(Score_i * Weight(Level_i)) / Sum(Weight(Level_i))
        Test case:
        - Novice (Weight 1.0): scores 5, 5, 5 -> Raw = 50.0
        - Scout (Weight 1.5): scores 8, 8, 8 -> Raw = 80.0
        - Analyst (Weight 2.5): scores 9, 9, 9 -> Raw = 90.0
        - Partner (Weight 4.0): scores 10, 10, 10 -> Raw = 100.0

        Expected numerator: (50 * 1.0) + (80 * 1.5) + (90 * 2.5) + (100 * 4.0)
                          = 50 + 120 + 225 + 400 = 795.0
        Expected denominator: 1.0 + 1.5 + 2.5 + 4.0 = 9.0
        Expected score: 795.0 / 9.0 = 88.33
        """
        engine = HypeScoreEngine()
        scores = [
            {"marketScore": 5, "teamScore": 5, "tractionScore": 5, "analystLevel": AnalystLevel.NOVICE},
            {"marketScore": 8, "teamScore": 8, "tractionScore": 8, "analystLevel": AnalystLevel.SCOUT},
            {"marketScore": 9, "teamScore": 9, "tractionScore": 9, "analystLevel": AnalystLevel.ANALYST},
            {"marketScore": 10, "teamScore": 10, "tractionScore": 10, "analystLevel": AnalystLevel.PARTNER},
        ]
        result = engine.calculate_hype_score(scores, apply_anti_brigading=False)
        assert result == 88.33

    def test_empty_scores_returns_zero(self):
        """Verify empty score list returns 0.0."""
        engine = HypeScoreEngine()
        assert engine.calculate_hype_score([]) == 0.0

    def test_anti_brigading_burst_decay(self):
        """
        Verify that coordinated burst votes beyond threshold experience exponential decay.
        """
        engine = HypeScoreEngine(burst_threshold=3, decay_lambda=0.5)
        now = datetime.now(timezone.utc)

        # 6 votes all arriving within a 1-minute window
        timestamps = [now + timedelta(seconds=i * 10) for i in range(6)]

        # The first 3 votes in window should have decay factor 1.0
        # The 6th vote (excess = 6 - 3 = 3) should have decay = exp(-0.5 * 3) = exp(-1.5) approx 0.223
        factor_early = engine.compute_decay_factor(timestamps[0], timestamps)
        factor_late = engine.compute_decay_factor(timestamps[5], timestamps)

        assert factor_early <= 1.0
        assert factor_late < 0.3
        assert factor_late == pytest.approx(math.exp(-0.5 * 3), rel=1e-3)


# =============================================================================
# 2. UNIT TESTS: SIMULATION LEAGUE ENGINE
# =============================================================================

class TestSimulationEngine:
    """Virtual balance, atomic pledge execution, and FSL portfolio ROI tests."""

    @pytest.mark.asyncio
    async def test_initial_grant_balance(self):
        """Verify fresh user starts with 50,000 virtual DZD grant."""
        engine = SimulationEngine()
        with patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_find:
            mock_find.return_value = []
            balance = await engine.get_user_virtual_balance(user_id=42)
            assert balance == 50_000

    @pytest.mark.asyncio
    async def test_balance_deduction_after_pledges(self):
        """Verify balance is initial grant minus active virtual pledges."""
        engine = SimulationEngine()
        p1 = MagicMock(amountDzd=15_000)
        p2 = MagicMock(amountDzd=10_000)

        with patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_find:
            mock_find.return_value = [p1, p2]
            balance = await engine.get_user_virtual_balance(user_id=42)
            assert balance == 25_000  # 50,000 - 25,000

    @pytest.mark.asyncio
    async def test_minimum_ticket_enforcement(self):
        """Verify pledges below minimum ticket (5,000 DZD) are rejected."""
        engine = SimulationEngine()
        mock_campaign = MagicMock(
            id="camp-1",
            status=CampaignStatus.ACTIVE_SIMULATION,
            minTicketDzd=5_000,
            targetAmountDzd=2_000_000,
            raisedAmountDzd=100_000,
        )

        with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_camp:
            mock_camp.return_value = mock_campaign
            with pytest.raises(Exception) as exc_info:
                await engine.execute_virtual_pledge(
                    user_id=1,
                    campaign_id="camp-1",
                    amount_dzd=3_000,  # Below 5,000 min ticket
                )
            assert "Minimum ticket size" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_insufficient_virtual_balance_rejection(self):
        """Verify users cannot pledge more virtual currency than available."""
        engine = SimulationEngine()
        mock_campaign = MagicMock(
            id="camp-1",
            status=CampaignStatus.ACTIVE_SIMULATION,
            minTicketDzd=5_000,
            targetAmountDzd=2_000_000,
            raisedAmountDzd=100_000,
        )

        with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_camp, \
             patch.object(engine, "get_user_virtual_balance", new_callable=AsyncMock) as mock_bal:
            mock_camp.return_value = mock_campaign
            mock_bal.return_value = 10_000  # Only 10,000 DZD left

            with pytest.raises(Exception) as exc_info:
                await engine.execute_virtual_pledge(
                    user_id=1,
                    campaign_id="camp-1",
                    amount_dzd=15_000,  # Requesting 15,000 DZD
                )
            assert "Insufficient virtual balance" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_campaign_status_gate(self):
        """Verify campaigns not in ACTIVE_SIMULATION status reject pledges."""
        engine = SimulationEngine()
        mock_campaign = MagicMock(
            id="camp-draft",
            status=CampaignStatus.DRAFT,  # Not active
            minTicketDzd=5_000,
        )

        with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_camp:
            mock_camp.return_value = mock_campaign
            with pytest.raises(Exception) as exc_info:
                await engine.execute_virtual_pledge(
                    user_id=1,
                    campaign_id="camp-draft",
                    amount_dzd=5_000,
                )
            assert "not currently accepting simulation pledges" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_successful_pledge_atomic_execution(self):
        """Verify successful atomic pledge creation and raisedAmountDzd increment."""
        engine = SimulationEngine()
        mock_campaign = MagicMock(
            id="camp-live",
            status=CampaignStatus.ACTIVE_SIMULATION,
            minTicketDzd=5_000,
            targetAmountDzd=1_000_000,
            raisedAmountDzd=100_000,
        )

        with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_camp, \
             patch.object(engine, "get_user_virtual_balance", new_callable=AsyncMock) as mock_bal, \
             patch("app.core.prisma.prisma.virtualpledge.create", new_callable=AsyncMock) as mock_create_pledge, \
             patch("app.core.prisma.prisma.campaign.update", new_callable=AsyncMock) as mock_update_camp:

            mock_camp.return_value = mock_campaign
            mock_bal.return_value = 50_000
            mock_create_pledge.return_value = MagicMock(id="pledge-xyz", amountDzd=10_000)

            pledge = await engine.execute_virtual_pledge(
                user_id=1,
                campaign_id="camp-live",
                amount_dzd=10_000,
            )

            assert pledge.id == "pledge-xyz"
            # Verify campaign raised volume incremented
            mock_update_camp.assert_awaited_once_with(
                where={"id": "camp-live"},
                data={"raisedAmountDzd": 110_000},
            )

    @pytest.mark.asyncio
    async def test_auto_funding_transition_when_target_reached(self):
        """Verify campaign status transitions to FUNDED_SIMULATION when target is reached."""
        engine = SimulationEngine()
        mock_campaign = MagicMock(
            id="camp-reach",
            status=CampaignStatus.ACTIVE_SIMULATION,
            minTicketDzd=5_000,
            targetAmountDzd=500_000,
            raisedAmountDzd=480_000,  # 20k left
        )

        with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_camp, \
             patch.object(engine, "get_user_virtual_balance", new_callable=AsyncMock) as mock_bal, \
             patch("app.core.prisma.prisma.virtualpledge.create", new_callable=AsyncMock), \
             patch("app.core.prisma.prisma.campaign.update", new_callable=AsyncMock) as mock_update_camp:

            mock_camp.return_value = mock_campaign
            mock_bal.return_value = 50_000

            await engine.execute_virtual_pledge(
                user_id=1,
                campaign_id="camp-reach",
                amount_dzd=25_000,  # Pledging 25k -> total 505k >= 500k
            )

            # Assert status updated to FUNDED_SIMULATION
            mock_update_camp.assert_awaited_once_with(
                where={"id": "camp-reach"},
                data={"raisedAmountDzd": 505_000, "status": CampaignStatus.FUNDED_SIMULATION},
            )


# =============================================================================
# 3. INTEGRATION TESTS: CURRICULUM ROUTER & QUIZ PROMOTION
# =============================================================================

class TestCurriculumRouter:
    """Darija Financial Literacy curriculum, quiz grading, tier promotion, and Label diagnostic."""

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
            id=1,
            fullName="Amine Test",
            email="amine@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_list_curriculum_modules(self, client, mock_user):
        """GET /api/v1/curriculum/modules returns all 5 modules with Darija content."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_quizzes:
                mock_quizzes.return_value = []

                resp = await client.get("/api/v1/curriculum/modules")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 5
                # Module 1 title in Darija
                assert "شنو هي ستارت أب" in data[0]["titleAr"]
                assert data[0]["index"] == 1
                assert data[4]["index"] == 5
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_module_detail(self, client, mock_user):
        """GET /api/v1/curriculum/modules/2 returns module details and question options."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            resp = await client.get("/api/v1/curriculum/modules/2")
            assert resp.status_code == 200
            data = resp.json()
            assert data["index"] == 2
            assert "الكراودفندينغ" in data["titleAr"]
            assert len(data["questions"]) >= 2
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_quiz_submission_and_scout_promotion(self, client, mock_user):
        """
        POST /api/v1/curriculum/quiz verifies answers, grades the test,
        and automatically promotes analyst tier to SCOUT when all 5 modules are completed.
        """
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.financialquizresult.create", new_callable=AsyncMock) as mock_create, \
                 patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_find_many:

                mock_create.return_value = MagicMock(id="quiz-res-1")

                # Simulate user having passed modules 1, 2, 3, 4, 5
                mock_find_many.return_value = [
                    MagicMock(moduleIndex=1, passed=True),
                    MagicMock(moduleIndex=2, passed=True),
                    MagicMock(moduleIndex=3, passed=True),
                    MagicMock(moduleIndex=4, passed=True),
                    MagicMock(moduleIndex=5, passed=True),
                ]

                payload = {
                    "moduleIndex": 5,
                    "answers": {
                        "m5_q1": 0,  # Correct
                        "m5_q2": 0,  # Correct
                    }
                }

                resp = await client.post("/api/v1/curriculum/quiz", json=payload)
                assert resp.status_code == 200
                data = resp.json()
                assert data["score"] == 100
                assert data["passed"] is True
                assert data["allModulesCompleted"] is True
                assert data["promotedToScout"] is True
                assert data["analystTier"] == "SCOUT"
                assert "SCOUT" in data["feedback"]
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_startup_label_diagnostic_decree_20_254(self, client, mock_user):
        """
        POST /api/v1/curriculum/label-diagnostic evaluates against Executive Decree 20-254.
        Verifies composite scoring out of 100, gap analysis, and label eligibility.
        """
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # High-performing startup case
            payload = {
                "startupName": "SolarTech Oran",
                "sector": "AgTech",
                "wilaya": 31,
                "innovationScore": 28,  # max 30
                "scalabilityScore": 23, # max 25
                "teamScore": 19,        # max 20
                "ipScore": 14,          # max 15
                "tractionScore": 9,     # max 10
            }

            resp = await client.post("/api/v1/curriculum/label-diagnostic", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["totalScore"] == 93
            assert data["eligibilityStatus"] == "LABEL_READY"
            assert data["isEligibleForDecree20254"] is True
            assert len(data["recommendations"]) > 0
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# 4. INTEGRATION TESTS: STARTUPS & SIMULATION LEAGUE ENDPOINTS
# =============================================================================

class TestSimulationEndpoints:
    """Tests for /api/v1/simulation/wallet and /api/v1/simulation/leaderboard."""

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
            id=1,
            fullName="Amine Test",
            email="amine@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_get_simulation_wallet_endpoint(self, client, mock_user):
        """GET /api/v1/simulation/wallet returns user's virtual balance and portfolio stats."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock) as mock_u, \
                 patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_pledges, \
                 patch("app.core.prisma.prisma.financialquizresult.count", new_callable=AsyncMock) as mock_quizzes, \
                 patch("app.core.prisma.prisma.virtualpledge.count", new_callable=AsyncMock) as mock_count:

                mock_u.return_value = mock_user
                mock_pledges.return_value = []
                mock_quizzes.return_value = 5
                mock_count.return_value = 0

                resp = await client.get("/api/v1/simulation/wallet")
                assert resp.status_code == 200
                data = resp.json()
                assert data["userId"] == 1
                assert data["initialGrantDzd"] == 50_000
                assert data["availableBalanceDzd"] == 50_000
                assert data["portfolioValueDzd"] == 50_000
                assert data["roiPct"] == 0.0
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_simulation_leaderboard_endpoint(self, client):
        """GET /api/v1/simulation/leaderboard returns ranked FSL managers."""
        resp = await client.get("/api/v1/simulation/leaderboard")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert "portfolioValueDzd" in data[0]
        assert "rank" in data[0]
        assert "analystBadge" in data[0]
