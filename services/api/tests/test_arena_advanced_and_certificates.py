"""
TamWheel Sovereign Ethical Agentic Venture OS — Test Suite for Phase 2 Expansion:
Advanced Live Stage Queue Arbitration, Dual-Track Slide Deck Synchronizer,
and ESE Oran Darija Financial Literacy Academy Verifiable Certificate Generator.
"""

from __future__ import annotations

import json
import time
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

from app.main import app
from app.services.stage_queue_manager import (
    LiveStageQueueManager,
    SpeakerRole,
    HandRaiseStatus,
    DEFAULT_HOT_SEAT_DURATION_SEC,
    MAX_HOT_SEAT_SPEAKERS,
)
from app.services.slide_synchronizer import (
    SlideDeckSynchronizer,
    SlideDeckSession,
)
from app.services.academy_certificate import (
    AcademyCertificateGenerator,
    ACCREDITATION_AUTHORITY,
)


# =============================================================================
# 1. UNIT TESTS: LIVE STAGE QUEUE & SPEAKER ARBITRATION
# =============================================================================

class TestLiveStageQueueManager:
    """Verifies audience hand-raising, moderator approval/denial, 3-minute hot-seat timer, and WebRTC tokens."""

    def test_hand_raising_and_queue_ordering(self):
        """Verify participants can raise hands and join the FIFO queue."""
        mgr = LiveStageQueueManager()
        room = "arena:pitch-batna-1"
        t0 = 1000.0

        # User 1 raises hand
        r1 = mgr.raise_hand(room, user_id=101, username="Farid", wilaya=5, now=t0)
        assert r1["type"] == "stage:hand_raised"
        assert r1["queue_position"] == 1
        assert r1["total_queued"] == 1

        # User 2 raises hand
        r2 = mgr.raise_hand(room, user_id=102, username="Yasmine", wilaya=16, now=t0 + 2.0)
        assert r2["queue_position"] == 2
        assert r2["total_queued"] == 2

        # User 1 attempts to raise hand again -> idempotent
        r1_again = mgr.raise_hand(room, user_id=101, username="Farid", wilaya=5, now=t0 + 5.0)
        assert r1_again["action"] == "already_queued"
        assert r1_again["queue_position"] == 1

        # Lower hand for User 1
        lowered = mgr.lower_hand(room, user_id=101)
        assert lowered["type"] == "stage:hand_lowered"
        assert lowered["total_queued"] == 1

    def test_moderator_approve_and_hot_seat_timer(self):
        """Verify moderator promotes queued user to speaker with a 180s (3-min) turn timer."""
        mgr = LiveStageQueueManager()
        room = "arena:pitch-oran-2"
        t0 = 2000.0

        mgr.raise_hand(room, user_id=201, username="Bilel", wilaya=31, now=t0)

        # Moderator approves speaker with standard 180s hot-seat
        appr = mgr.approve_speaker(room, user_id=201, moderator_id=1, duration_sec=180, now=t0 + 10.0)
        assert appr["type"] == "stage:speaker_approved"
        assert appr["duration_sec"] == 180
        assert appr["turn_expires_at"] == (t0 + 10.0 + 180)
        assert len(appr["active_speakers"]) == 1
        assert appr["active_speakers"][0]["remaining_seconds"] == 180.0
        assert "webrtc_token" in appr

    def test_hot_seat_timer_expiration_sweep(self):
        """Verify speakers exceeding the 3-minute limit are swept and demoted."""
        mgr = LiveStageQueueManager()
        room = "arena:pitch-annaba-3"
        t0 = 3000.0

        mgr.raise_hand(room, user_id=301, username="Chawki", now=t0)
        mgr.approve_speaker(room, user_id=301, moderator_id=1, duration_sec=180, now=t0)

        # At t0 + 100s, speaker is still active
        expired_mid = mgr.sweep_expired_speakers(room, now=t0 + 100.0)
        assert len(expired_mid) == 0

        # At t0 + 181s (> 3 minutes), speaker is expired
        expired_end = mgr.sweep_expired_speakers(room, now=t0 + 181.0)
        assert len(expired_end) == 1
        assert expired_end[0]["type"] == "stage:speaker_demoted"
        assert expired_end[0]["user_id"] == 301
        assert "3-minute hot-seat" in expired_end[0]["reason"]

    def test_moderator_deny_and_manual_demote(self):
        """Verify moderator can deny queued user or manually demote active speaker."""
        mgr = LiveStageQueueManager()
        room = "arena:pitch-tlemcen-4"
        now = 4000.0

        mgr.raise_hand(room, user_id=401, username="Nadjib", now=now)
        denied = mgr.deny_speaker(room, user_id=401, moderator_id=1, reason="Off-topic question")
        assert denied["type"] == "stage:speaker_denied"

        # Direct promote & demote
        mgr.raise_hand(room, user_id=402, username="Sara", now=now)
        mgr.approve_speaker(room, user_id=402, moderator_id=1, now=now)
        demoted = mgr.demote_speaker(room, user_id=402, moderator_id=1, reason="Finished question")
        assert demoted["type"] == "stage:speaker_demoted"
        assert demoted["user_id"] == 402

    def test_webrtc_token_provisioning_grants(self):
        """Verify audience gets receive-only token; speaker gets publish grants."""
        mgr = LiveStageQueueManager()
        room = "arena:stage-tokens"

        aud_token = mgr.provision_webrtc_token(room, user_id=501, username="AudienceUser", role=SpeakerRole.AUDIENCE)
        assert isinstance(aud_token, str)
        assert len(aud_token) > 20

        spk_token = mgr.provision_webrtc_token(room, user_id=502, username="SpeakerUser", role=SpeakerRole.SPEAKER)
        assert isinstance(spk_token, str)
        assert len(spk_token) > 20


# =============================================================================
# 2. UNIT TESTS: DUAL-TRACK SLIDE DECK SYNCHRONIZER
# =============================================================================

class TestSlideDeckSynchronizer:
    """Verifies slide casting, laser pointer coordinates, and collaborative slide annotations."""

    def test_slide_navigation_and_clamping(self):
        """Verify slide index updates and clamps within [0, total_slides - 1]."""
        sync = SlideDeckSynchronizer()
        session = sync.get_or_create_session(room_id="deck-room-1", total_slides=10)

        # Advance to slide 4
        res4 = session.set_slide(4, presenter_name="Founder Karim")
        assert res4["type"] == "deck:slide_change"
        assert res4["current_slide_index"] == 4
        assert res4["current_slide_number"] == 5
        assert res4["total_slides"] == 10

        # Attempt to advance beyond total_slides -> clamps to 9
        res_over = session.set_slide(25)
        assert res_over["current_slide_index"] == 9

        # Attempt to go below 0 -> clamps to 0
        res_under = session.set_slide(-5)
        assert res_under["current_slide_index"] == 0

    def test_laser_pointer_coordinate_broadcasting(self):
        """Verify pointer coordinates are clamped within [0.0, 1.0] and precision-rounded."""
        session = SlideDeckSession(room_id="deck-room-2")

        # Standard pointer update
        p1 = session.update_pointer(x=0.45678, y=0.87654, active=True, color="#E8632E")
        assert p1["type"] == "deck:pointer_update"
        assert p1["pointer"]["x"] == 0.4568
        assert p1["pointer"]["y"] == 0.8765
        assert p1["pointer"]["active"] is True
        assert p1["pointer"]["color"] == "#E8632E"

        # Out-of-bounds pointer coordinates are clamped
        p_clamped = session.update_pointer(x=-0.2, y=1.5, active=True)
        assert p_clamped["pointer"]["x"] == 0.0
        assert p_clamped["pointer"]["y"] == 1.0

    def test_slide_annotations_and_clear(self):
        """Verify annotations are assigned to target slides and can be cleared."""
        session = SlideDeckSession(room_id="deck-room-3", total_slides=5)
        session.set_slide(2)

        # Add annotation to slide 2
        ann1 = {"tool": "pen", "points": [[10, 20], [30, 40]], "color": "#2E7D52"}
        session.add_annotation(ann1)

        ann2 = {"tool": "box", "bounds": [50, 50, 100, 100], "color": "#E8632E"}
        session.add_annotation(ann2)

        state = session.get_state()
        assert len(state["slide_annotations"]) == 2

        # Clear slide 2 annotations
        session.clear_annotations(slide_index=2)
        state_cleared = session.get_state()
        assert len(state_cleared["slide_annotations"]) == 0


# =============================================================================
# 3. UNIT TESTS: ESE ORAN ACADEMY VERIFIABLE CERTIFICATE GENERATOR
# =============================================================================

class TestAcademyCertificateGenerator:
    """Verifies DARIJA-ACADEMY-CERT issuance, Ed25519 signatures, W3C Verifiable Credentials, and tamper detection."""

    def test_certificate_issuance_contract(self):
        """Verify format DARIJA-ACADEMY-CERT-YYYY-XXXX and accreditation hash."""
        gen = AcademyCertificateGenerator()
        fixed_date = datetime(2026, 10, 28, 12, 0, 0, tzinfo=timezone.utc)

        bundle = gen.issue_certificate(
            user_id=88,
            recipient_name="Djamel Belkacem",
            average_score=94.5,
            wilaya=31,
            issued_at=fixed_date,
        )

        assert bundle["certificateId"].startswith("DARIJA-ACADEMY-CERT-2026-")
        assert bundle["claims"]["recipientName"] == "Djamel Belkacem"
        assert bundle["claims"]["modulesCompleted"] == 5
        assert bundle["claims"]["averageScore"] == 94.5
        assert ACCREDITATION_AUTHORITY in bundle["claims"]["accreditationAuthority"]
        assert "accreditationHash" in bundle
        assert "signature" in bundle
        assert bundle["qrCodeDataUrl"].startswith("data:image/png;base64,")

        # Verify W3C VC JSON-LD envelope
        vc = bundle["verifiableCredential"]
        assert "VerifiableCredential" in vc["type"]
        assert vc["issuer"]["name"] == ACCREDITATION_AUTHORITY
        assert vc["proof"]["type"] == "Ed25519Signature2020"

    def test_certificate_cryptographic_verification_success(self):
        """Verify authentic certificate validates with status VERIFIED_AUTHENTIC."""
        gen = AcademyCertificateGenerator()
        bundle = gen.issue_certificate(
            user_id=99,
            recipient_name="Amina Mansouri",
            average_score=88.0,
            wilaya=16,
        )

        result = gen.verify_certificate(bundle)
        assert result["isValid"] is True
        assert result["status"] == "VERIFIED_AUTHENTIC"
        assert result["recipientName"] == "Amina Mansouri"

    def test_certificate_tamper_detection(self):
        """Verify modifying claims triggers cryptographic tamper detection."""
        gen = AcademyCertificateGenerator()
        bundle = gen.issue_certificate(
            user_id=100,
            recipient_name="Hakim Test",
            average_score=82.0,
            wilaya=25,
        )

        # Malicious actor tampers with the score from 82.0 to 100.0
        tampered_bundle = json.loads(json.dumps(bundle))
        tampered_bundle["claims"]["averageScore"] = 100.0

        tamper_res = gen.verify_certificate(tampered_bundle)
        assert tamper_res["isValid"] is False
        assert "Tamper Detected" in tamper_res["reason"]

    def test_certificate_signature_corruption_detection(self):
        """Verify invalid or forged Ed25519 signature is rejected."""
        gen = AcademyCertificateGenerator()
        bundle = gen.issue_certificate(
            user_id=101,
            recipient_name="Samia Algerian",
            average_score=90.0,
        )

        corrupted = json.loads(json.dumps(bundle))
        # Flip bits in signature
        corrupted["signature"] = "a" * len(bundle["signature"])

        res = gen.verify_certificate(corrupted)
        assert res["isValid"] is False
        assert "verification failed" in res["reason"]


# =============================================================================
# 4. INTEGRATION TESTS: HTTP REST ENDPOINTS FOR CERTIFICATES
# =============================================================================

class TestCertificateHttpEndpoints:
    """Tests /api/v1/curriculum/certificate endpoints."""

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
            id=777,
            fullName="Fatima Zohra",
            email="fatima@tamwheel.dz",
            wilaya=31,
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_issue_certificate_rejection_if_modules_incomplete(self, client, mock_user):
        """POST /api/v1/curriculum/certificate/issue returns 400 if user completed < 5 modules."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_find:
                # User only completed 3 modules
                mock_find.return_value = [
                    MagicMock(moduleIndex=1, score=90, passed=True),
                    MagicMock(moduleIndex=2, score=85, passed=True),
                    MagicMock(moduleIndex=3, score=80, passed=True),
                ]

                resp = await client.post("/api/v1/curriculum/certificate/issue")
                assert resp.status_code == 400
                assert "completed 3/5 modules" in resp.json()["detail"]
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_issue_and_verify_certificate_happy_path(self, client, mock_user):
        """POST /certificate/issue succeeds when all 5 modules passed, and GET /certificate/{id} verifies it."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.financialquizresult.find_many", new_callable=AsyncMock) as mock_find:
                mock_find.return_value = [
                    MagicMock(moduleIndex=1, score=100, passed=True),
                    MagicMock(moduleIndex=2, score=90, passed=True),
                    MagicMock(moduleIndex=3, score=85, passed=True),
                    MagicMock(moduleIndex=4, score=95, passed=True),
                    MagicMock(moduleIndex=5, score=90, passed=True),
                ]

                # 1. Issue Certificate
                issue_resp = await client.post("/api/v1/curriculum/certificate/issue")
                assert issue_resp.status_code == 200
                cert_data = issue_resp.json()
                cert_id = cert_data["certificateId"]
                assert cert_id.startswith("DARIJA-ACADEMY-CERT-")
                assert cert_data["claims"]["modulesCompleted"] == 5
                assert cert_data["status"] == "VALID"

                # 2. Public Verification
                verify_resp = await client.get(f"/api/v1/curriculum/certificate/{cert_id}")
                assert verify_resp.status_code == 200
                v_data = verify_resp.json()
                assert v_data["isValid"] is True
                assert v_data["status"] == "VERIFIED_AUTHENTIC"
                assert v_data["recipientName"] == "Fatima Zohra"

                # 3. Retrieve Latest
                latest_resp = await client.get("/api/v1/curriculum/certificate/user/latest")
                assert latest_resp.status_code == 200
                assert latest_resp.json()["certificateId"] == cert_id
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# 5. INTEGRATION TESTS: WEBSOCKET ADVANCED STAGE QUEUE & SLIDE CASTING
# =============================================================================

class TestAdvancedArenaWebSocket:
    """Verifies live stage queue arbitration and slide casting over WebSockets."""

    def test_websocket_hand_raising_and_speaker_approval(self):
        """Audience raises hand, moderator approves speaker, receiving WebRTC token."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-stage-1") as ws:
            ws.receive_json()  # Consume welcome

            # 1. Raise hand
            ws.send_json({
                "action": "raise_hand",
                "startup_id": "startup-stage-1",
                "wilaya": 31,
            })
            hand_msg = ws.receive_json()
            assert hand_msg["type"] == "stage:hand_raised"
            assert hand_msg["queue_position"] >= 1
            raised_uid = hand_msg["user_id"]

            # 2. Query queue
            ws.send_json({
                "action": "get_stage_queue",
                "startup_id": "startup-stage-1",
            })
            q_state = ws.receive_json()
            assert "queue" in q_state
            assert "active_speakers" in q_state

            # 3. Moderator approves speaker
            ws.send_json({
                "action": "approve_speaker",
                "startup_id": "startup-stage-1",
                "target_user_id": raised_uid,
                "duration_sec": 180,
            })
            appr_msg = ws.receive_json()
            assert appr_msg["type"] == "stage:speaker_approved"
            assert appr_msg["user_id"] == raised_uid
            assert appr_msg["duration_sec"] == 180
            assert "webrtc_token" in appr_msg

            # 4. Demote speaker
            ws.send_json({
                "action": "demote_speaker",
                "startup_id": "startup-stage-1",
                "target_user_id": raised_uid,
            })
            demote_msg = ws.receive_json()
            assert demote_msg["type"] == "stage:speaker_demoted"

    def test_websocket_dual_track_slide_casting(self):
        """Presenter broadcasts slide change, pointer movement, and annotations."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-deck-2") as ws:
            ws.receive_json()  # Consume welcome

            # 1. Presenter changes slide
            ws.send_json({
                "action": "slide_change",
                "startup_id": "startup-deck-2",
                "slide_index": 3,
                "total_slides": 12,
            })
            slide_msg = ws.receive_json()
            assert slide_msg["type"] == "deck:slide_change"
            assert slide_msg["current_slide_index"] == 3
            assert slide_msg["current_slide_number"] == 4

            # 2. Presenter moves laser pointer
            ws.send_json({
                "action": "slide_pointer",
                "startup_id": "startup-deck-2",
                "x": 0.35,
                "y": 0.72,
                "active": True,
            })
            ptr_msg = ws.receive_json()
            assert ptr_msg["type"] == "deck:pointer_update"
            assert ptr_msg["pointer"]["x"] == 0.35
            assert ptr_msg["pointer"]["y"] == 0.72

            # 3. Presenter draws an annotation
            ws.send_json({
                "action": "slide_annotate",
                "startup_id": "startup-deck-2",
                "slide_index": 3,
                "annotation": {"type": "highlight", "area": [10, 10, 50, 50]},
            })
            ann_msg = ws.receive_json()
            assert ann_msg["type"] == "deck:annotation_added"
            assert ann_msg["slide_index"] == 3

            # 4. Query full deck state
            ws.send_json({
                "action": "get_slide_state",
                "startup_id": "startup-deck-2",
            })
            deck_state = ws.receive_json()
            assert deck_state["type"] == "deck:state_sync"
            assert deck_state["current_slide_index"] == 3
            assert len(deck_state["slide_annotations"]) >= 1

    def test_websocket_webrtc_token_request(self):
        """Client requests WebRTC token directly over WebSocket."""
        client = TestClient(app)
        with client.websocket_connect("/ws/arena?startup_id=startup-tokens-3") as ws:
            ws.receive_json()  # Consume welcome

            ws.send_json({
                "action": "request_webrtc_token",
                "startup_id": "startup-tokens-3",
                "role": "SPEAKER",
            })
            token_resp = ws.receive_json()
            assert token_resp["type"] == "stage:webrtc_token"
            assert "token" in token_resp
            assert token_resp["role"] == "SPEAKER"
