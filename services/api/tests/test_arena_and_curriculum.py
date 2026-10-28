"""
TamWheel Sovereign Ethical Agentic Venture OS — Test Suite for Pillar 6:
Realtime Multiplayer Watch Party & Live Pitch Arena WebSockets,
Decree 20-254 Startup Label Diagnostic, and Darija Financial Literacy Academy.
"""

from __future__ import annotations

import json
import math
import time
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

from app.generated.prisma.enums import AnalystLevel
from app.services.arena_service import (
    ArenaStage,
    ArenaSession,
    RealtimeArenaService,
    STAGE_DURATIONS_SEC,
    MAX_DRIFT_TOLERANCE_MS,
    HYPE_ALARM_THRESHOLD_PCT,
    HYPE_ALARM_DEFENSE_WINDOW_SEC,
)
from app.services.curriculum_engine import (
    DarijaFinancialCurriculumEngine,
    CURRICULUM_MODULES,
    PASSING_SCORE_THRESHOLD_PCT,
    RETAKE_COOLDOWN_SECONDS,
)
from app.services.label_diagnostic import (
    StartupLabelDiagnosticEngine,
    LABEL_READY_THRESHOLD,
    CANDIDATE_THRESHOLD,
    MAX_INNOVATION_SCORE,
    MAX_SCALABILITY_SCORE,
    MAX_TEAM_SCORE,
    MAX_IP_SCORE,
    MAX_TRACTION_SCORE,
)
from app.main import app


# =============================================================================
# 1. UNIT TESTS: REALTIME ARENA SERVICE & SYNCHRONIZATION
# =============================================================================

class TestRealtimeArenaService:
    """Verifies synchronized video playback clock, stage state machine, reaction radar, and hype alarm."""

    def test_arena_session_initial_state(self):
        """Verify default session initialized in LOBBY with paused video."""
        session = ArenaSession(room_id="room-oran-1", startup_id="startup-solar")
        assert session.stage == ArenaStage.LOBBY
        assert session.video_playback_state == "PAUSED"
        assert session.current_sentiment_score == 75.0
        assert session.total_pledges_dzd == 0

    def test_video_playback_extrapolation(self):
        """Verify position advances linearly when PLAYING and halts when PAUSED."""
        session = ArenaSession(room_id="room-1", startup_id="s1")
        base_time = 1000.0

        # Start playback at position 10.0s with 1.0x rate
        session.update_video_state(position_sec=10.0, playback_state="PLAYING", playback_rate=1.0, now=base_time)

        # 5 seconds later
        pos_after_5s = session.get_video_position(now=base_time + 5.0)
        assert pos_after_5s == pytest.approx(15.0, rel=1e-3)

        # Pause playback at 15.0s
        session.update_video_state(position_sec=15.0, playback_state="PAUSED", now=base_time + 5.0)
        pos_paused = session.get_video_position(now=base_time + 20.0)
        assert pos_paused == 15.0

    def test_clock_sync_payload_contract(self):
        """Verify payload contains drift tolerance <= 250ms and millisecond timestamps."""
        session = ArenaSession(room_id="room-1", startup_id="s1")
        now = time.time()
        payload = session.get_clock_sync_payload(now=now)

        assert payload["type"] == "arena:clock_sync"
        assert payload["max_drift_tolerance_ms"] == MAX_DRIFT_TOLERANCE_MS
        assert payload["max_drift_tolerance_ms"] <= 250.0
        assert payload["server_timestamp"] == now
        assert payload["stage"] == "LOBBY"

    def test_arena_stage_state_machine_transitions(self):
        """
        Verify state machine progression:
        LOBBY -> PITCH_ACTIVE (3 min) -> GRILLING_ACTIVE (5 min) -> FLASH_ALLOCATION (60 sec) -> CLOSED.
        """
        session = ArenaSession(room_id="room-1", startup_id="s1")
        now = 10000.0

        # 1. Advance to PITCH_ACTIVE (180s)
        t1 = session.advance_stage(now=now)
        assert session.stage == ArenaStage.PITCH_ACTIVE
        assert session.stage_duration_seconds == 180
        assert t1["current_stage"] == "PITCH_ACTIVE"

        # 2. Advance to GRILLING_ACTIVE (300s)
        t2 = session.advance_stage(now=now + 180)
        assert session.stage == ArenaStage.GRILLING_ACTIVE
        assert session.stage_duration_seconds == 300
        assert t2["current_stage"] == "GRILLING_ACTIVE"

        # 3. Advance to FLASH_ALLOCATION (60s)
        t3 = session.advance_stage(now=now + 480)
        assert session.stage == ArenaStage.FLASH_ALLOCATION
        assert session.stage_duration_seconds == 60
        assert t3["current_stage"] == "FLASH_ALLOCATION"

        # 4. Advance to CLOSED
        t4 = session.advance_stage(now=now + 540)
        assert session.stage == ArenaStage.CLOSED
        assert t4["current_stage"] == "CLOSED"

    def test_rolling_sentiment_radar_calculation(self):
        """
        Verify exponential time decay on reaction streams.
        Positive reactions (🚀, 💡) lift sentiment towards 90-100%.
        Negative reactions (🚩) pull sentiment down.
        """
        session = ArenaSession(room_id="room-1", startup_id="s1")
        t0 = 5000.0

        # Backer sends 🚀 (100% conviction) and 💡 (90% conviction)
        session.add_reaction("🚀", user_name="Karim", now=t0)
        session.add_reaction("💡", user_name="Nadia", now=t0 + 1.0)

        sentiment_positive = session.calculate_rolling_sentiment(now=t0 + 2.0)
        assert sentiment_positive >= 90.0

        # Flood of 🚩 red flags arrives
        for i in range(5):
            session.add_reaction("🚩", user_name=f"Skeptic-{i}", now=t0 + 5.0 + i)

        sentiment_dropped = session.calculate_rolling_sentiment(now=t0 + 10.0)
        assert sentiment_dropped < 40.0

    def test_hype_alarm_triggered_below_35_percent_in_pitch(self):
        """
        Verify Hype Alarm rings when sentiment drops below 35% during PITCH_ACTIVE,
        allocating 30 seconds for the founder to defend their model.
        """
        session = ArenaSession(room_id="room-1", startup_id="s1", startup_name="SolarDZ")
        session.set_stage(ArenaStage.PITCH_ACTIVE, now=1000.0)

        # Critical wave of red flags pulls conviction down
        now = 1010.0
        alarm_event = None
        for i in range(6):
            rx_evt, al_evt = session.add_reaction("🚩", user_name=f"Referee-{i}", now=now + i)
            if al_evt:
                alarm_event = al_evt

        assert alarm_event is not None
        assert alarm_event["type"] == "arena:hype_alarm"
        assert alarm_event["audience_sentiment_score"] < HYPE_ALARM_THRESHOLD_PCT
        assert alarm_event["defense_window_sec"] == HYPE_ALARM_DEFENSE_WINDOW_SEC
        assert "30 seconds" in alarm_event["action_required"]

    def test_flash_allocation_window_pledges(self):
        """Verify pledge recording during the 60-second Flash Allocation window."""
        session = ArenaSession(room_id="room-1", startup_id="s1", startup_name="AgriTech Batna")
        session.set_stage(ArenaStage.FLASH_ALLOCATION, now=2000.0)

        p1 = session.record_flash_pledge(
            backer_name="Amine Oran",
            amount_dzd=50_000,
            equity_share_pct=0.1,
            wilaya=31,
            now=2010.0,
        )
        assert p1["type"] == "arena:flash_pledge"
        assert p1["running_total_dzd"] == 50_000
        assert session.total_pledges_dzd == 50_000
        assert session.pledges_count == 1

        p2 = session.record_flash_pledge(
            backer_name="Samir Algiers",
            amount_dzd=100_000,
            equity_share_pct=0.2,
            wilaya=16,
            now=2015.0,
        )
        assert p2["running_total_dzd"] == 150_000
        assert session.pledges_count == 2


# =============================================================================
# 2. UNIT TESTS: DARIJA FINANCIAL LITERACY CURRICULUM ENGINE
# =============================================================================

class TestCurriculumEngine:
    """Verifies 5 ESE Oran modules, 5-question quizzes, 80% passing threshold, and 24h retake lockout."""

    def test_modules_structure_and_multilingual_content(self):
        """Verify all 5 modules are present with Darija, MSA, French, and English metadata."""
        engine = DarijaFinancialCurriculumEngine()
        modules = engine.get_modules_summary()
        assert len(modules) == 5

        m1 = modules[0]
        assert m1["index"] == 1
        assert "شنو هي ستارت أب" in m1["titleAr"]
        assert m1["titleMsa"] is not None
        assert m1["titleFr"] is not None
        assert m1["titleEn"] == "What is a Startup?"
        assert m1["questionsCount"] == 5

        # Check each module has exactly 5 comprehension questions
        for idx in range(1, 6):
            mod = engine.get_module(idx)
            assert mod is not None
            assert len(mod["questions"]) == 5
            for q in mod["questions"]:
                assert "id" in q
                assert "questionAr" in q
                assert "optionsAr" in q
                assert len(q["optionsAr"]) == 4
                assert "correctAnswerIndex" in q
                assert "explanationAr" in q

    def test_strict_80_percent_passing_threshold(self):
        """
        Verify strict 4/5 (80%) passing threshold.
        5/5 (100%) -> PASSED
        4/5 (80%)  -> PASSED
        3/5 (60%)  -> FAILED
        """
        engine = DarijaFinancialCurriculumEngine()

        # Case 1: 5 out of 5 correct (100%) -> PASSED
        perfect_answers = {
            "m1_q1": 0,
            "m1_q2": 0,
            "m1_q3": 0,
            "m1_q4": 0,
            "m1_q5": 0,
        }
        res_perfect = engine.grade_quiz(module_index=1, answers=perfect_answers)
        assert res_perfect["score"] == 100
        assert res_perfect["passed"] is True
        assert res_perfect["correct_count"] == 5

        # Case 2: 4 out of 5 correct (80%) -> PASSED
        pass_answers = {
            "m1_q1": 0,
            "m1_q2": 0,
            "m1_q3": 0,
            "m1_q4": 0,
            "m1_q5": 3,  # Wrong
        }
        res_pass = engine.grade_quiz(module_index=1, answers=pass_answers)
        assert res_pass["score"] == 80
        assert res_pass["passed"] is True
        assert res_pass["correct_count"] == 4

        # Case 3: 3 out of 5 correct (60%) -> FAILED
        fail_answers = {
            "m1_q1": 0,
            "m1_q2": 0,
            "m1_q3": 0,
            "m1_q4": 2,  # Wrong
            "m1_q5": 3,  # Wrong
        }
        res_fail = engine.grade_quiz(module_index=1, answers=fail_answers)
        assert res_fail["score"] == 60
        assert res_fail["passed"] is False
        assert res_fail["correct_count"] == 3

    def test_24_hour_retake_cooldown_lockout(self):
        """
        Verify that a failed quiz attempt triggers a 24-hour retake lockout cooldown,
        and is unlocked after 24 hours elapse.
        """
        engine = DarijaFinancialCurriculumEngine()
        now = datetime.now(timezone.utc)

        # Attempt failed 2 hours ago (within 24h lockout)
        failed_2h_ago = now - timedelta(hours=2)
        is_locked, rem_sec = engine.check_retake_cooldown(failed_2h_ago, now=now)
        assert is_locked is True
        assert 78000 <= rem_sec <= 80000

        # Attempt failed 25 hours ago (outside 24h lockout)
        failed_25h_ago = now - timedelta(hours=25)
        is_locked_past, rem_sec_past = engine.check_retake_cooldown(failed_25h_ago, now=now)
        assert is_locked_past is False
        assert rem_sec_past == 0

        # No previous failed attempt
        is_locked_none, _ = engine.check_retake_cooldown(None, now=now)
        assert is_locked_none is False


# =============================================================================
# 3. UNIT TESTS: STARTUP LABEL DIAGNOSTIC ENGINE (DECREE 20-254)
# =============================================================================

class TestStartupLabelDiagnosticEngine:
    """Verifies Decree 20-254 weighted criteria, readiness bands, gap analysis, and action plan."""

    def test_decree_20_254_pillar_weights_and_maximums(self):
        """
        Decree 20-254 weighted criteria:
        Innovation: 30%, Scalability: 25%, Team: 20%, IP: 15%, Traction: 10%.
        Total = 100%.
        """
        engine = StartupLabelDiagnosticEngine()
        result = engine.evaluate(
            startup_name="Bionic Algérie",
            sector="HealthTech",
            wilaya=16,
            innovation_score=30,
            scalability_score=25,
            team_score=20,
            ip_score=15,
            traction_score=10,
        )
        assert result["totalScore"] == 100
        assert result["readinessBand"] == "Highly Recommended"
        assert result["eligibilityStatus"] == "LABEL_READY"
        assert result["isEligibleForDecree20254"] is True
        assert len(result["gapAnalysis"]) == 0
        assert len(result["actionPlan"]) > 0

    def test_readiness_bands_thresholds(self):
        """
        Verify:
        Score >= 75: Highly Recommended (LABEL_READY)
        50 <= Score < 75: Candidate (CANDIDATE)
        Score < 50: Not Ready (EARLY_STAGE)
        """
        engine = StartupLabelDiagnosticEngine()

        # 1. Highly Recommended (78/100)
        res_high = engine.evaluate(
            startup_name="FinTech Constantine",
            sector="FinTech",
            wilaya=25,
            innovation_score=25,
            scalability_score=22,
            team_score=16,
            ip_score=8,
            traction_score=7,
        )
        assert res_high["totalScore"] == 78
        assert res_high["readinessBand"] == "Highly Recommended"
        assert res_high["isEligibleForDecree20254"] is True

        # 2. Candidate (60/100)
        res_mid = engine.evaluate(
            startup_name="AgriTech Biskra",
            sector="AgTech",
            wilaya=7,
            innovation_score=18,
            scalability_score=16,
            team_score=12,
            ip_score=7,
            traction_score=7,
        )
        assert res_mid["totalScore"] == 60
        assert res_mid["readinessBand"] == "Candidate"
        assert res_mid["isEligibleForDecree20254"] is False

        # 3. Not Ready (35/100)
        res_low = engine.evaluate(
            startup_name="Generic Shop",
            sector="E-Commerce",
            wilaya=31,
            innovation_score=10,
            scalability_score=10,
            team_score=8,
            ip_score=3,
            traction_score=4,
        )
        assert res_low["totalScore"] == 35
        assert res_low["readinessBand"] == "Not Ready"
        assert res_low["isEligibleForDecree20254"] is False
        assert len(res_low["gapAnalysis"]) >= 4


# =============================================================================
# 4. INTEGRATION TESTS: HTTP REST ENDPOINTS
# =============================================================================

class TestCurriculumAndDiagnosticEndpoints:
    """Tests /api/v1/curriculum and /api/v1/diagnostic endpoints."""

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
            id=42,
            fullName="Lamine Testeur",
            email="lamine@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_get_all_curriculum_modules_api(self, client, mock_user):
        """GET /api/v1/curriculum/modules returns all 5 modules with multilingual titles."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_find:
                mock_find.return_value = []
                resp = await client.get("/api/v1/curriculum/modules")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 5
                assert "شنو هي ستارت أب" in data[0]["titleAr"]
                assert data[0]["questionsCount"] == 5
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_quiz_lockout_cooldown_rejection_api(self, client, mock_user):
        """POST /api/v1/curriculum/quiz rejects submission if under active 24h retake lockout."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        now_utc = datetime.now(timezone.utc)
        recent_failed_attempt = MagicMock(
            moduleIndex=1,
            passed=False,
            score=40,
            completedAt=now_utc - timedelta(hours=3),
        )

        try:
            with patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_find:
                mock_find.return_value = [recent_failed_attempt]

                payload = {
                    "moduleIndex": 1,
                    "answers": {"m1_q1": 0, "m1_q2": 0, "m1_q3": 0, "m1_q4": 0, "m1_q5": 0},
                    "bypassCooldown": False,
                }
                resp = await client.post("/api/v1/curriculum/quiz", json=payload)
                assert resp.status_code == 403
                assert "24-hour retake cooldown" in resp.json()["detail"]
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_dedicated_diagnostic_router_api(self, client, mock_user):
        """GET /api/v1/diagnostic/rubric and POST /api/v1/diagnostic/evaluate."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. Rubric
            resp_rubric = await client.get("/api/v1/diagnostic/rubric")
            assert resp_rubric.status_code == 200
            rubric = resp_rubric.json()
            assert len(rubric) == 5
            assert any(p["name"] == "Innovation" and p["weightPct"] == 30 for p in rubric)

            # 2. Evaluate
            eval_payload = {
                "startupName": "HydroSahara",
                "sector": "AgTech",
                "wilaya": 30,  # Ouargla
                "innovationScore": 27,
                "scalabilityScore": 22,
                "teamScore": 18,
                "ipScore": 12,
                "tractionScore": 8,
            }
            resp_eval = await client.post("/api/v1/diagnostic/evaluate", json=eval_payload)
            assert resp_eval.status_code == 200
            data = resp_eval.json()
            assert data["totalScore"] == 87
            assert data["readinessBand"] == "Highly Recommended"
            assert data["isEligibleForDecree20254"] is True
            assert "pillarBreakdown" in data
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# 5. WEBSOCKET REALTIME MULTIPLAYER ARENA TESTS
# =============================================================================

class TestRealtimeArenaWebSocket:
    """Verifies WebSocket arena interactions via Starlette TestClient."""

    def test_websocket_welcome_handshake_and_clock_sync(self):
        """Client connects and receives simulation:welcome with max_drift_tolerance_ms."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-alg-1") as ws:
            welcome_msg = ws.receive_json()
            assert welcome_msg["type"] == "simulation:welcome"
            assert "client_id" in welcome_msg
            assert welcome_msg["max_drift_tolerance_ms"] <= 250.0

            # Ping clock sync
            client_ts = time.time()
            ws.send_json({"action": "ping", "client_time": client_ts})
            pong_msg = ws.receive_json()
            assert pong_msg["type"] == "pong"
            assert pong_msg["client_time"] == client_ts
            assert pong_msg["max_drift_tolerance_ms"] <= 250.0

    def test_websocket_stage_advance_and_reactions(self):
        """Client advances arena stage and sends emoji reactions in realtime."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-oran-2") as ws:
            ws.receive_json()  # Consume welcome

            # 1. Advance stage to PITCH_ACTIVE
            ws.send_json({"action": "advance_stage", "startup_id": "startup-oran-2"})
            trans_msg = ws.receive_json()
            assert trans_msg["type"] == "arena:stage_transition"
            assert trans_msg["current_stage"] == "PITCH_ACTIVE"
            # Consume clock sync broadcast
            sync_msg = ws.receive_json()
            assert sync_msg["type"] == "arena:clock_sync"

            # 2. Send reaction 🚀
            ws.send_json({
                "action": "reaction",
                "startup_id": "startup-oran-2",
                "emoji": "🚀",
            })
            rx_msg = ws.receive_json()
            assert rx_msg["type"] == "arena:reaction"
            assert rx_msg["emoji"] == "🚀"
            assert rx_msg["audience_sentiment_score"] >= 80.0
            # Consume legacy reaction broadcast
            ws.receive_json()

    def test_websocket_flash_pledge_broadcast(self):
        """Client submits flash pledge during window, broadcasting ticker alert."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-setif-3") as ws:
            ws.receive_json()  # Consume welcome

            ws.send_json({
                "action": "flash_pledge",
                "startup_id": "startup-setif-3",
                "amount_dzd": 25_000,
                "wilaya": 19,
            })
            pledge_msg = ws.receive_json()
            assert pledge_msg["type"] == "arena:flash_pledge"
            assert pledge_msg["amount_dzd"] == 25_000
            assert "25,000 DZD" in pledge_msg["crowd_ticker_alert"]
