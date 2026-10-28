"""
TamWheel Sovereign Ethical Agentic Venture OS — Test Suite for Phase 3 Expansion:
Founder Digital HQ (2.5D RPG Engine), Startup Reels & Swipe-to-Diligence,
and Sovereign Haptic Khatm Ceremony with Statutory 72-Hour Cooling-Off.
"""

from __future__ import annotations

import time
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.digital_hq_engine import (
    DigitalHQEngine,
    StartupHqState,
    XP_REWARDS,
    TIER_CONFIG,
)
from app.services.reels_service import (
    StartupReelsService,
    MAX_AUDIO_AMA_DURATION_SEC,
)
from app.services.haptic_khatm import (
    HapticKhatmService,
    MANDATORY_REFLECTION_SECONDS,
    COOLING_OFF_PERIOD_SECONDS,
    HAPTIC_PROFILE,
)


# =============================================================================
# 1. UNIT TESTS: FOUNDER DIGITAL HQ (2.5D RPG ENGINE)
# =============================================================================

class TestDigitalHQEngine:
    """Verifies 5-tier RPG evolution, T(L) = 1000 * L^2 XP progression, and isometric room inspectors."""

    def test_tier_xp_formula_and_defaults(self):
        """
        Verify progression formula T(L) = 1000 * L^2:
        Level 1: 1,000 XP
        Level 2: 4,000 XP
        Level 3: 9,000 XP
        Level 4: 16,000 XP
        Level 5: 25,000 XP
        """
        for tier in TIER_CONFIG:
            lvl = tier["tierLevel"]
            expected_xp = 1000 * (lvl ** 2)
            assert tier["xpRequired"] == expected_xp

    def test_startup_progression_levels_and_gates(self):
        """Verify startup transitions through tiers as XP and gating requirements are met."""
        state = StartupHqState(startup_id="test-hq-1", startup_name="SolarDZ")
        assert state.compute_tier()["tierLevel"] == 1
        assert state.compute_tier()["visualSkin"] == "ISOMETRIC_GARAGE"

        # 1. Add XP to cross Level 2 (>= 4,000 XP)
        state.add_xp("MILESTONE_CLOSE", custom_xp=3200)
        assert state.total_xp >= 4000
        tier2 = state.compute_tier()
        assert tier2["tierLevel"] == 2
        assert tier2["visualSkin"] == "MODERN_INCUBATOR"

        # 2. Add XP to reach 9,000 XP without Startup Label -> stays at Level 2
        state.add_xp("PATENT_RECEIPT", custom_xp=5500)
        assert state.total_xp >= 9000
        tier_no_label = state.compute_tier()
        assert tier_no_label["tierLevel"] == 2  # Gated by Decree 20-254 Startup Label

        # Grant Startup Label -> levels up to Level 3
        state.has_startup_label = True
        tier3 = state.compute_tier()
        assert tier3["tierLevel"] == 3
        assert tier3["visualSkin"] == "LABELED_COMMISSION_SUITE"

        # 3. Add XP to reach 16,000 XP with verified GMV > 1M DZD
        state.add_xp("MILESTONE_CLOSE", custom_xp=7500)
        state.verified_gmv_dzd = 1_500_000
        tier4 = state.compute_tier()
        assert tier4["tierLevel"] == 4
        assert tier4["visualSkin"] == "EXPANSION_FLOOR"

        # 4. Add XP to reach 25,000 XP with export certificate
        state.add_xp("MILESTONE_CLOSE", custom_xp=10_000)
        state.has_export_cert = True
        tier5 = state.compute_tier()
        assert tier5["tierLevel"] == 5
        assert tier5["visualSkin"] == "SOVEREIGN_SKYSCRAPER"
        assert tier5["xpNeededForNextTier"] == 0

    def test_verifiable_telemetry_xp_rewards(self):
        """Verify exact XP rewards for standard verifiable events."""
        engine = DigitalHQEngine()
        sid = "hq-xp-test"

        ev1 = engine.record_xp_event(sid, "FINANCIAL_RECONCILIATION")
        assert ev1["xp_awarded"] == 250

        ev2 = engine.record_xp_event(sid, "RESOLVE_COMMUNITY_AMA")
        assert ev2["xp_awarded"] == 50

        ev3 = engine.record_xp_event(sid, "PATENT_RECEIPT")
        assert ev3["xp_awarded"] == 1500

        ev4 = engine.record_xp_event(sid, "MILESTONE_CLOSE")
        assert ev4["xp_awarded"] == 2000

    def test_isometric_room_inspectors(self):
        """Verify telemetry inspector payloads for all 4 rooms."""
        state = StartupHqState(startup_id="hq-rooms-test", startup_name="AlgerianRobotics")

        server = state.get_room_inspector("server_room")
        assert "Server Room" in server["room"]
        assert server["codeVelocityCommitsPerWeek"] > 0
        assert server["apiUptimePct"] > 99.0

        legal = state.get_room_inspector("legal_safe")
        assert "Legal Safe" in legal["room"]
        assert legal["vdrNdaRequired"] is True
        assert "cnrcNumber" in legal

        war = state.get_room_inspector("war_room")
        assert "War Room" in war["room"]
        assert war["pitchVideoDurationSec"] == 60
        assert len(war["strategyMilestones"]) >= 3

        finance = state.get_room_inspector("finance_dept")
        assert "Finance Department" in finance["room"]
        assert finance["arrDzd"] > 0
        assert finance["ltvCacRatio"] > 3.0


# =============================================================================
# 2. UNIT TESTS: STARTUP REELS & 15-SECOND AUDIO AMA
# =============================================================================

class TestStartupReelsService:
    """Verifies 9:16 vertical video feed, swipe-to-diligence data, and 15s audio AMA limits."""

    def test_list_and_get_reels(self):
        """Verify default seed reels are present and properly formatted."""
        svc = StartupReelsService()
        reels = svc.list_reels()
        assert len(reels) >= 3

        r0 = reels[0]
        assert "reelId" in r0
        assert "startupName" in r0
        assert r0["durationSec"] <= 60
        assert r0["factguardStatus"] in ("GREEN_VERIFIED", "AMBER_CONTEXT", "RED_UNVERIFIED")

    def test_swipe_to_diligence_drawer_payload(self):
        """Verify diligence drawer payload provides instant unit economics without audio pause."""
        svc = StartupReelsService()
        reels = svc.list_reels()
        first_reel_id = reels[0]["reelId"]

        drawer = svc.get_diligence_drawer(first_reel_id)
        assert drawer is not None
        assert drawer["arrDzd"] > 0
        assert drawer["burnRateDzd"] > 0
        assert drawer["runwayMonths"] > 0
        assert "capTableSummary" in drawer
        assert "foundersEquityPct" in drawer["capTableSummary"]

    def test_audio_ama_submission_and_duration_limit(self):
        """
        Verify users can submit audio AMAs <= 15 seconds,
        and submissions > 15 seconds are strictly rejected.
        """
        svc = StartupReelsService()
        reel_id = "reel-solar-01"

        # Valid 12.5s question
        q_valid = svc.submit_audio_ama(
            reel_id=reel_id,
            user_id=123,
            username="Amine Angel",
            audio_url="/static/audio/ama_123.mp3",
            duration_sec=12.5,
            question_text="How do you handle solar panel dust in Southern Wilayas?",
        )
        assert q_valid["amaId"].startswith("ama-")
        assert q_valid["durationSec"] == 12.5
        assert q_valid["answered"] is False

        # Exceeds 15-second maximum limit -> raises ValueError
        with pytest.raises(ValueError) as exc_info:
            svc.submit_audio_ama(
                reel_id=reel_id,
                user_id=123,
                username="Amine Angel",
                audio_url="/static/audio/long_audio.mp3",
                duration_sec=18.0,
            )
        assert "exceeds 15-second" in str(exc_info.value)

    def test_founder_answers_audio_ama(self):
        """Verify founder can attach voice and text reply to an AMA question."""
        svc = StartupReelsService()
        q = svc.submit_audio_ama(
            reel_id="reel-solar-01",
            user_id=456,
            username="Nadia Investor",
            audio_url="/static/audio/q_456.mp3",
            duration_sec=10.0,
        )

        ans = svc.answer_audio_ama(
            ama_id=q["amaId"],
            founder_id=1,
            answer_audio_url="/static/audio/founder_reply_456.mp3",
            answer_text="We have an automated dry-wipe robotic wiper designed with CDER Algiers.",
        )
        assert ans["answered"] is True
        assert "founder_reply" in ans["answerAudioUrl"]
        assert ans["answeredAt"] is not None


# =============================================================================
# 3. UNIT TESTS: SOVEREIGN HAPTIC KHATM & 72-HOUR COOLING-OFF
# =============================================================================

class TestHapticKhatmService:
    """Verifies 3-second ethical reflection slider, 80ms haptic profile, and statutory 72h cancellation."""

    def test_mandatory_3_second_reflection_slider_enforcement(self):
        """
        Verify user cannot confirm pledge without holding the slider for >= 3.0 seconds.
        """
        svc = HapticKhatmService()
        uid = 500
        sid = "startup-khatm-test"

        # Held for only 1.5 seconds -> rejected
        with pytest.raises(ValueError) as exc_info:
            svc.seal_pledge(
                user_id=uid,
                startup_id=sid,
                amount_dzd=50_000,
                reflection_hold_duration_sec=1.5,
            )
        assert "Ethical reflection requirement not satisfied" in str(exc_info.value)
        assert "3.0s" in str(exc_info.value)

        # Held for 3.2 seconds -> succeeds with Haptic profile tokens
        sealed = svc.seal_pledge(
            user_id=uid,
            startup_id=sid,
            amount_dzd=50_000,
            reflection_hold_duration_sec=3.2,
        )
        assert sealed["khatmId"].startswith("KHATM-")
        assert sealed["status"] == "PENDING_COOLING_OFF"
        assert sealed["isCoolingOffActive"] is True
        assert sealed["hapticProfile"]["pulseDurationMs"] == 80
        assert sealed["hapticProfile"]["soundEffect"] == "fx_khatm_chime"

    def test_statutory_72_hour_cooling_off_cancellation(self):
        """
        Verify backer can cancel pledge within 72 hours for a 100% refund,
        and cancellation after 72 hours is rejected.
        """
        svc = HapticKhatmService()
        t0 = 10000.0

        sealed = svc.seal_pledge(
            user_id=601,
            startup_id="startup-bio-agro",
            amount_dzd=100_000,
            reflection_hold_duration_sec=3.5,
            now=t0,
        )
        kid = sealed["khatmId"]

        # Cancel 24 hours later (within 72h window)
        t_cancel = t0 + (24 * 3600)
        res_cancel = svc.cancel_during_cooling_off(
            khatm_id=kid,
            user_id=601,
            reason="Reallocating to another sector",
            now=t_cancel,
        )
        assert res_cancel["status"] == "CANCELLED_REFUNDED"
        assert res_cancel["refundAmountDzd"] == 100_000
        assert res_cancel["refundPercentage"] == 100

        # Cannot cancel again
        with pytest.raises(ValueError) as exc_already:
            svc.cancel_during_cooling_off(khatm_id=kid, user_id=601, now=t_cancel + 10)
        assert "cancellation impossible" in str(exc_already.value)

    def test_cooling_off_expiration_and_finalization(self):
        """
        Verify pledge cannot be prematurely finalized (< 72h),
        and can be finalized after 72 hours elapses.
        """
        svc = HapticKhatmService()
        t0 = 20000.0

        sealed = svc.seal_pledge(
            user_id=701,
            startup_id="startup-final",
            amount_dzd=75_000,
            reflection_hold_duration_sec=4.0,
            now=t0,
        )
        kid = sealed["khatmId"]

        # Premature finalization at t0 + 10 hours -> rejected
        with pytest.raises(ValueError) as exc_premature:
            svc.finalize_pledge(kid, now=t0 + (10 * 3600))
        assert "Cooling-off period still active" in str(exc_premature.value)

        # Finalization at t0 + 73 hours (> 72 hours) -> succeeds
        t_final = t0 + (73 * 3600)
        finalized = svc.finalize_pledge(kid, now=t_final)
        assert finalized["status"] == "FINALIZED"
        assert finalized["isCoolingOffActive"] is False

        # Once finalized, cooling-off cancellation is rejected
        with pytest.raises(ValueError) as exc_post_final:
            svc.cancel_during_cooling_off(kid, user_id=701, now=t_final + 10)
        assert "cancellation impossible" in str(exc_post_final.value)


# =============================================================================
# 4. INTEGRATION TESTS: HTTP REST ENDPOINTS FOR HQ, REELS & KHATM
# =============================================================================

class TestPhase3HttpEndpoints:
    """Tests /api/v1/hq, /api/v1/reels, and /api/v1/khatm endpoints."""

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
            id=999,
            fullName="Karim Algerian",
            email="karim@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_digital_hq_endpoints(self, client, mock_user):
        """GET /api/v1/hq/startups/{id} and /rooms/{room} and POST /xp."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            sid = "api-test-startup-hq"

            # 1. Get HQ Profile
            resp_profile = await client.get(f"/api/v1/hq/startups/{sid}")
            assert resp_profile.status_code == 200
            data_hq = resp_profile.json()
            assert data_hq["tierLevel"] == 1
            assert "ISOMETRIC_GARAGE" in data_hq["visualSkin"]

            # 2. Inspect Server Room
            resp_room = await client.get(f"/api/v1/hq/startups/{sid}/rooms/server_room")
            assert resp_room.status_code == 200
            room_data = resp_room.json()
            assert "Server Room" in room_data["room"]
            assert room_data["codeVelocityCommitsPerWeek"] > 0

            # 3. Award XP
            xp_payload = {
                "trigger": "FINANCIAL_RECONCILIATION",
                "proof": "Monthly Bank Reconciliation Q3",
            }
            resp_xp = await client.post(f"/api/v1/hq/startups/{sid}/xp", json=xp_payload)
            assert resp_xp.status_code == 200
            assert resp_xp.json()["status"] == "XP_AWARDED"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_startup_reels_endpoints(self, client, mock_user):
        """GET /api/v1/reels, /diligence, and POST /ama."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. List Reels
            resp_list = await client.get("/api/v1/reels")
            assert resp_list.status_code == 200
            reels = resp_list.json()
            assert len(reels) >= 1
            target_reel = reels[0]["reelId"]

            # 2. Get Diligence Drawer
            resp_drawer = await client.get(f"/api/v1/reels/{target_reel}/diligence")
            assert resp_drawer.status_code == 200
            drawer_data = resp_drawer.json()
            assert "arrDzd" in drawer_data
            assert "capTableSummary" in drawer_data

            # 3. Submit Audio AMA (<= 15s)
            ama_payload = {
                "audioUrl": "/static/audio/test_voice_note.mp3",
                "durationSec": 14.2,
                "questionText": "Can your software integrate with local ERPs?",
            }
            resp_ama = await client.post(f"/api/v1/reels/{target_reel}/ama", json=ama_payload)
            assert resp_ama.status_code == 200
            ama_data = resp_ama.json()
            assert ama_data["durationSec"] == 14.2
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_haptic_khatm_endpoints(self, client, mock_user):
        """POST /api/v1/khatm/seal, /cancel, and GET /{id}."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. Seal Pledge (< 3.0s fails)
            fail_payload = {
                "startupId": "startup-http-khatm",
                "amountDzd": 20_000,
                "reflectionHoldDurationSec": 2.1,
            }
            resp_fail = await client.post("/api/v1/khatm/seal", json=fail_payload)
            assert resp_fail.status_code == 400
            assert "Ethical reflection requirement" in resp_fail.json()["detail"]

            # 2. Seal Pledge (>= 3.0s succeeds)
            seal_payload = {
                "startupId": "startup-http-khatm",
                "amountDzd": 20_000,
                "reflectionHoldDurationSec": 3.4,
            }
            resp_seal = await client.post("/api/v1/khatm/seal", json=seal_payload)
            assert resp_seal.status_code == 200
            seal_data = resp_seal.json()
            khatm_id = seal_data["khatmId"]
            assert seal_data["hapticProfile"]["pulseDurationMs"] == 80

            # 3. Query Khatm Status
            resp_status = await client.get(f"/api/v1/khatm/{khatm_id}")
            assert resp_status.status_code == 200
            assert resp_status.json()["isCoolingOffActive"] is True

            # 4. Cancel during Cooling-Off
            cancel_payload = {"reason": "Cancelled per statutory 72h window"}
            resp_cancel = await client.post(f"/api/v1/khatm/{khatm_id}/cancel", json=cancel_payload)
            assert resp_cancel.status_code == 200
            assert resp_cancel.json()["status"] == "CANCELLED_REFUNDED"
            assert resp_cancel.json()["refundAmountDzd"] == 20_000
        finally:
            app.dependency_overrides.clear()
