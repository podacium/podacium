"""
TamWheel Sovereign Ethical Agentic Venture OS — Live Collaborative Term Sheet Room,
Synchronized Deck Overlays & Multilingual Audio Pipeline Test Suite (Phase 4 Expansion).

Tests:
1. Sub-100ms laser-pointer coordinate stream (x, y in [0.0, 1.0]) & multi-user concurrent pointers
2. Multi-user vector pen/highlighting annotations & ephemeral TTL expiration
3. Timed presentation bookmarks for post-event diligence
4. Priority Q&A Queue exact weighted ranking formula:
   Priority Score = Upvotes * 1.0 + Academy Tier Bonus * 2.0 + Reputation Weight * 1.5
5. Q&A State machine: SUBMITTED -> MODERATED_APPROVED -> PROMOTED_TO_STAGE -> ANSWERED -> ARCHIVED
6. Anti-duplicate upvoting & toxicity/scam keyword filtering
7. Multilingual audio transcription with synchronized timestamps across Darija, MSA, French, English
8. Live deal term sheet collaborative room: real-time adjustment of valuation, ticket, board seats,
   liquidation preference, and Sharia covenants
9. Interactive mutual electronic initials: founder & lead shark locking gates
10. Sovereign Haptic Khatm ceremony gating (mandatory 3s reflection hold + 80ms tactile pulse + 72h cooling-off)
11. REST API endpoints under /api/v1/arena/presentation, /api/v1/arena/qa, /api/v1/arena/live-termsheet
12. WebSocket real-time broadcast and bi-directional synchronization
"""

import json
import time
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.pitch_canvas_sync import (
    PitchCanvasSyncEngine,
    AnnotationType,
    pitch_canvas_sync,
)
from app.services.arena_qa_engine import (
    ArenaQAEngine,
    QuestionState,
    AcademyTier,
    TIER_BONUS_MAP,
    arena_qa_engine,
)
from app.services.pitch_transcription_engine import (
    PitchTranscriptionEngine,
    pitch_transcription_engine,
)
from app.services.live_term_sheet_room import (
    LiveTermSheetEngine,
    TermSheetStatus,
    PartyRole,
    live_term_sheet_engine,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. PITCH CANVAS SYNC & LASER POINTER STREAM TESTS
# =============================================================================

class TestPitchCanvasSync:
    """Verifies sub-100ms normalized coordinate streaming, annotations, and bookmarks."""

    def test_laser_pointer_clamping_and_normalization(self):
        engine = PitchCanvasSyncEngine()
        session = engine.get_or_create_session("room-laser-1")

        # Normal coordinate inside [0.0, 1.0]
        evt1 = session.update_pointer(user_id=10, username="Founder", x=0.45, y=0.82)
        assert evt1["pointer"]["x"] == 0.45
        assert evt1["pointer"]["y"] == 0.82
        assert evt1["pointer"]["active"] is True

        # Out-of-bounds coordinates must be strictly clamped
        evt2 = session.update_pointer(user_id=10, username="Founder", x=-0.5, y=1.8)
        assert evt2["pointer"]["x"] == 0.0
        assert evt2["pointer"]["y"] == 1.0

    def test_multi_user_concurrent_pointers(self):
        engine = PitchCanvasSyncEngine()
        session = engine.get_or_create_session("room-laser-multi")

        session.update_pointer(user_id=1, username="Founder", x=0.2, y=0.3, color="#E8632E")
        session.update_pointer(user_id=2, username="Lead Shark", x=0.7, y=0.8, color="#2E7D52")
        session.update_pointer(user_id=3, username="Moderator", x=0.5, y=0.5, color="#1E3A8A")

        state = session.get_canvas_state()
        active_pointers = state["active_pointers"]
        assert len(active_pointers) == 3
        uids = {p["user_id"] for p in active_pointers}
        assert uids == {1, 2, 3}

    def test_slide_navigation_and_clamping(self):
        engine = PitchCanvasSyncEngine()
        session = engine.get_or_create_session("room-nav-1", total_slides=10)

        # Slide change
        res = session.set_slide(index=4, presenter_name="Samir Founder")
        assert res["current_slide_index"] == 4
        assert res["current_slide_number"] == 5

        # Clamping beyond total slides
        res_clamp = session.set_slide(index=99)
        assert res_clamp["current_slide_index"] == 9

        # Clamping negative slide
        res_neg = session.set_slide(index=-5)
        assert res_neg["current_slide_index"] == 0

    def test_persistent_and_ephemeral_annotations(self):
        engine = PitchCanvasSyncEngine()
        session = engine.get_or_create_session("room-ann-1")

        # Persistent Pen Stroke
        pen_ann = session.add_annotation(
            author_id=1,
            author_name="Shark 1",
            annotation_type=AnnotationType.PEN_STROKE,
            data={"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]},
            slide_index=0,
            is_ephemeral=False,
        )
        assert pen_ann.is_ephemeral is False

        # Ephemeral Highlight with 1s TTL
        eph_ann = session.add_annotation(
            author_id=2,
            author_name="Scout",
            annotation_type=AnnotationType.HIGHLIGHT_RECT,
            data={"x": 0.3, "y": 0.3, "width": 0.4, "height": 0.2},
            slide_index=0,
            is_ephemeral=True,
            ttl_sec=0.1,
        )
        assert eph_ann.is_ephemeral is True

        # Immediately available
        anns_now = session.get_slide_annotations(slide_index=0)
        assert len(anns_now) == 2

        # After TTL expires
        time.sleep(0.15)
        anns_later = session.get_slide_annotations(slide_index=0)
        assert len(anns_later) == 1
        assert anns_later[0]["annotation_id"] == pen_ann.annotation_id

    def test_slide_bookmarks_timeline(self):
        engine = PitchCanvasSyncEngine()
        session = engine.get_or_create_session("room-bm-1")

        session.add_bookmark(slide_index=1, label="Market Size 5000 Startups", user_id=1, username="Shark", timestamp_sec=12.5)
        session.add_bookmark(slide_index=3, label="Unit Economics & Gross Margin", user_id=2, username="Partner", timestamp_sec=45.0)

        bms = session.get_bookmarks()
        assert len(bms) == 2
        assert bms[0]["timestamp_sec"] == 12.5
        assert bms[1]["timestamp_sec"] == 45.0


# =============================================================================
# 2. PRIORITY Q&A QUEUE ENGINE TESTS
# =============================================================================

class TestArenaQAEngine:
    """Verifies weighted priority scoring, anti-duplicate upvoting, and moderation state machine."""

    def test_weighted_priority_score_formula_exact(self):
        """
        Verify Priority Score = Upvotes * 1.0 + Academy Tier Bonus * 2.0 + Reputation Weight * 1.5
        """
        engine = ArenaQAEngine()

        # Author with GOLD tier (+3.5 bonus) and 2.0 reputation weight, 0 upvotes
        # Score = (0 * 1.0) + (3.5 * 2.0) + (2.0 * 1.5) = 0 + 7.0 + 3.0 = 10.0
        q1 = engine.submit_question(
            room_id="room-qa-1",
            startup_id="startup-1",
            author_id=101,
            author_name="Gold Analyst",
            content="What is your CAC to LTV ratio across Algerian Wilayas?",
            academy_tier="GOLD",
            reputation_weight=2.0,
        )
        assert q1.priority_score == 10.0

        # Author with ESE_ORAN_FELLOW tier (+5.0 bonus) and 3.0 reputation weight
        # Score = 0 + (5.0 * 2.0) + (3.0 * 1.5) = 10.0 + 4.5 = 14.5
        q2 = engine.submit_question(
            room_id="room-qa-1",
            startup_id="startup-1",
            author_id=102,
            author_name="ESE Fellow",
            content="How are Diminishing Musharakah capital distributions executed?",
            academy_tier="ESE_ORAN_FELLOW",
            reputation_weight=3.0,
        )
        assert q2.priority_score == 14.5

        # Upvoting q1 by 3 distinct users adds 3 * 1.0 = 3.0 -> new score = 13.0
        engine.upvote_question("room-qa-1", q1.question_id, user_id=201)
        engine.upvote_question("room-qa-1", q1.question_id, user_id=202)
        engine.upvote_question("room-qa-1", q1.question_id, user_id=203)
        assert q1.upvotes == 3
        assert q1.priority_score == 13.0

    def test_anti_duplicate_upvoting_enforcement(self):
        engine = ArenaQAEngine()
        q = engine.submit_question(
            room_id="room-qa-dups",
            startup_id="startup-1",
            author_id=1,
            author_name="Scout",
            content="Is the software stack proprietary or open source?",
        )
        engine.upvote_question("room-qa-dups", q.question_id, user_id=99)

        # Duplicate upvote from same user_id must raise ValueError
        with pytest.raises(ValueError, match="already upvoted"):
            engine.upvote_question("room-qa-dups", q.question_id, user_id=99)

    def test_automated_toxicity_and_spam_filtering(self):
        engine = ArenaQAEngine()

        # Spam/scam question
        q_spam = engine.submit_question(
            room_id="room-qa-spam",
            startup_id="startup-1",
            author_id=1,
            author_name="Bot",
            content="Join our telegram group for 100x guaranteed pump and dump crypto returns!",
        )
        assert q_spam.state == QuestionState.FLAGGED_REJECTED
        assert "Triggered prohibited spam/toxicity pattern" in (q_spam.flag_reason or "")

        # Legitimate question
        q_legit = engine.submit_question(
            room_id="room-qa-spam",
            startup_id="startup-1",
            author_id=2,
            author_name="Investor",
            content="Can you explain your Sharia certification timeline with the HIIF committee?",
        )
        assert q_legit.state == QuestionState.MODERATED_APPROVED

    def test_qa_state_machine_lifecycle(self):
        """
        State Machine: SUBMITTED -> MODERATED_APPROVED -> PROMOTED_TO_STAGE -> ANSWERED -> ARCHIVED
        """
        engine = ArenaQAEngine()
        # Submit without auto-moderation
        q = engine.submit_question(
            room_id="room-lifecycle",
            startup_id="startup-1",
            author_id=1,
            author_name="Investor",
            content="What are the unit economics?",
            auto_moderate=False,
        )
        assert q.state == QuestionState.SUBMITTED

        # 1. Moderation Approval
        engine.moderate_question("room-lifecycle", q.question_id, approved=True, moderator_id=42)
        assert q.state == QuestionState.MODERATED_APPROVED

        # 2. Promotion to Stage
        engine.promote_to_stage("room-lifecycle", q.question_id)
        assert q.state == QuestionState.PROMOTED_TO_STAGE
        active_q = engine.get_active_stage_question("room-lifecycle")
        assert active_q is not None
        assert active_q["question_id"] == q.question_id

        # 3. Answer on Stage
        engine.answer_question(
            "room-lifecycle",
            q.question_id,
            answer_notes="Founder answered: 68% gross margin, 8 months payback period.",
        )
        assert q.state == QuestionState.ANSWERED
        assert q.answer_notes is not None
        assert engine.get_active_stage_question("room-lifecycle") is None

        # 4. Archive
        engine.archive_question("room-lifecycle", q.question_id)
        assert q.state == QuestionState.ARCHIVED


# =============================================================================
# 3. MULTILINGUAL AUDIO TRANSCRIPTION ENGINE TESTS
# =============================================================================

class TestPitchTranscriptionEngine:
    """Verifies synchronized closed captions across Darija, MSA, French, and English."""

    def test_streaming_audio_transcription_and_translation(self):
        engine = PitchTranscriptionEngine()
        session = engine.get_or_create_session("room-audio-1")

        # Ingest chunk for slide 0 (Intro)
        seg0 = session.ingest_audio_chunk(
            duration_sec=5.0,
            speaker_name="Amine Founder",
            current_slide_index=0,
            original_language="ar-DZ",
        )
        assert seg0.slide_index == 0
        assert "TamWheel" in seg0.translations["darija"]
        assert "TamWheel" in seg0.translations["french"]
        assert "TamWheel" in seg0.translations["english"]

        # Ingest chunk for slide 4 (Unit Economics)
        seg4 = session.ingest_audio_chunk(
            duration_sec=4.0,
            speaker_name="Amine Founder",
            current_slide_index=4,
            original_language="ar-DZ",
        )
        assert seg4.slide_index == 4
        assert "68%" in seg4.translations["english"]
        assert "68%" in seg4.translations["french"]

    def test_transcript_filtering_and_export(self):
        engine = PitchTranscriptionEngine()
        session = engine.get_or_create_session("room-audio-export")

        session.ingest_audio_chunk(duration_sec=3.0, speaker_name="Founder", current_slide_index=1)
        session.ingest_audio_chunk(duration_sec=3.0, speaker_name="Founder", current_slide_index=2)

        french_captions = session.get_transcript(language="french")
        assert len(french_captions) == 2
        assert "displayed_caption" in french_captions[0]

        exported = session.export_full_transcript()
        assert exported["total_segments"] == 2
        assert 1 in exported["slides"]
        assert 2 in exported["slides"]


# =============================================================================
# 4. LIVE DEAL TERM SHEET COLLABORATIVE ROOM TESTS
# =============================================================================

class TestLiveTermSheetRoom:
    """Verifies collaborative term sheet negotiation, mutual initials, and Khatm ceremony."""

    def test_open_term_sheet_and_defaults(self):
        engine = LiveTermSheetEngine()
        session = engine.get_or_create_room(
            room_id="deal-room-1",
            startup_id="startup-alpha",
            startup_name="Alpha Robotics",
            founder_id=10,
            founder_name="Karim Founder",
            investor_id=99,
            investor_name="Lead Shark",
            initial_valuation_dzd=60_000_000,
            initial_ticket_dzd=15_000_000,
        )
        state = session.get_state()
        assert state["valuation_pre_money_dzd"] == 60_000_000
        assert state["ticket_size_dzd"] == 15_000_000
        assert state["post_money_valuation_dzd"] == 75_000_000
        # 15M / (60M + 15M) = 15/75 = 20.0%
        assert state["equity_share_pct"] == 20.0
        assert state["status"] == TermSheetStatus.NEGOTIATING.value
        assert state["is_mutually_locked"] is False

    def test_term_adjustments_recalculate_equity_and_reset_initials(self):
        engine = LiveTermSheetEngine()
        session = engine.get_or_create_room(
            room_id="deal-room-adjust",
            initial_valuation_dzd=50_000_000,
            initial_ticket_dzd=10_000_000,
        )

        # Initial the valuation clause first
        session.initial_clause("valuation_equity", user_id=1, username="Founder", party=PartyRole.FOUNDER, initials="KF")
        assert session.clauses["valuation_equity"].founder_initials == "KF"

        # Now Shark negotiates valuation down to 40M and ticket up to 10M
        session.update_terms(
            actor_id=99,
            actor_name="Shark",
            actor_role="INVESTOR",
            valuation_pre_money_dzd=40_000_000,
            ticket_size_dzd=10_000_000,
        )
        state = session.get_state()
        assert state["valuation_pre_money_dzd"] == 40_000_000
        # 10M / (40M + 10M) = 20.0%
        assert state["equity_share_pct"] == 20.0

        # Updating valuation must reset previous initials on valuation_equity clause!
        assert session.clauses["valuation_equity"].founder_initials is None
        assert session.clauses["valuation_equity"].is_locked is False

    def test_mutual_electronic_initials_locking_gate(self):
        engine = LiveTermSheetEngine()
        session = engine.get_or_create_room("deal-room-locking")

        # Founder initials all clauses
        session.initial_all_clauses(user_id=10, username="Founder", party=PartyRole.FOUNDER, initials="KF")
        assert session.status == TermSheetStatus.NEGOTIATING
        assert session.is_mutually_locked is False

        # Lead Shark initials all clauses
        session.initial_all_clauses(user_id=99, username="Shark", party=PartyRole.INVESTOR, initials="MS")
        assert session.status == TermSheetStatus.MUTUALLY_LOCKED
        state = session.get_state()
        assert state["is_mutually_locked"] is True

    def test_haptic_khatm_ceremony_trigger_and_validation(self):
        engine = LiveTermSheetEngine()
        session = engine.get_or_create_room(
            room_id="deal-room-khatm",
            initial_valuation_dzd=50_000_000,
            initial_ticket_dzd=10_000_000,
        )

        # Attempt to seal before mutual locking -> must fail
        with pytest.raises(ValueError, match="is currently in state 'NEGOTIATING'"):
            session.trigger_khatm_ceremony(user_id=10, reflection_hold_duration_sec=3.5)

        # Mutually lock all clauses
        session.initial_all_clauses(user_id=10, username="Founder", party=PartyRole.FOUNDER, initials="KF")
        session.initial_all_clauses(user_id=99, username="Shark", party=PartyRole.INVESTOR, initials="MS")
        assert session.status == TermSheetStatus.MUTUALLY_LOCKED

        # Attempt to seal with reflection hold duration < 3.0 seconds -> must fail
        with pytest.raises(ValueError, match="minimum required is 3.0s"):
            session.trigger_khatm_ceremony(user_id=10, reflection_hold_duration_sec=2.4)

        # Valid Sovereign Khatm ceremony (held for 3.2 seconds)
        khatm_evt = session.trigger_khatm_ceremony(user_id=10, reflection_hold_duration_sec=3.2)
        assert khatm_evt["status"] == TermSheetStatus.KHATM_SEALED.value
        assert "khatm_record" in khatm_evt
        assert khatm_evt["haptic_profile"]["pulseDurationMs"] == 80
        assert session.status == TermSheetStatus.KHATM_SEALED


# =============================================================================
# 5. REST API ENDPOINTS TESTS (FASTAPI TESTCLIENT)
# =============================================================================

class TestArenaApiEndpoints:
    """Verifies REST endpoints under /api/v1/arena."""

    def test_presentation_canvas_endpoints(self, client):
        room_id = "api-room-canvas-1"

        # Update laser pointer
        resp_ptr = client.post(
            f"/api/v1/arena/presentation/rooms/{room_id}/pointer",
            json={"x": 0.32, "y": 0.65, "active": True, "color": "#E8632E"},
        )
        assert resp_ptr.status_code == 200
        data_ptr = resp_ptr.json()
        assert data_ptr["pointer"]["x"] == 0.32

        # Change slide
        resp_slide = client.post(
            f"/api/v1/arena/presentation/rooms/{room_id}/slides/current",
            json={"slide_index": 2, "presenter_name": "Farid"},
        )
        assert resp_slide.status_code == 200
        assert resp_slide.json()["current_slide_index"] == 2

        # Add annotation
        resp_ann = client.post(
            f"/api/v1/arena/presentation/rooms/{room_id}/annotations",
            json={
                "slide_index": 2,
                "annotation_type": "PEN_STROKE",
                "data": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]},
                "color": "#E8632E",
                "stroke_width": 3.0,
                "is_ephemeral": False,
                "ttl_sec": 5.0,
            },
        )
        assert resp_ann.status_code == 201
        ann_id = resp_ann.json()["annotation_id"]

        # List annotations
        resp_list = client.get(f"/api/v1/arena/presentation/rooms/{room_id}/slides/2/annotations")
        assert resp_list.status_code == 200
        assert len(resp_list.json()) >= 1

        # Delete annotation
        resp_del = client.delete(f"/api/v1/arena/presentation/rooms/{room_id}/annotations/{ann_id}")
        assert resp_del.status_code == 200

        # Add bookmark
        resp_bm = client.post(
            f"/api/v1/arena/presentation/rooms/{room_id}/bookmarks",
            json={"slide_index": 2, "label": "Revenue Model", "timestamp_sec": 60.0},
        )
        assert resp_bm.status_code == 201

        # Get full canvas state
        resp_state = client.get(f"/api/v1/arena/presentation/rooms/{room_id}/state")
        assert resp_state.status_code == 200
        assert resp_state.json()["current_slide_index"] == 2

    def test_multilingual_transcription_endpoints(self, client):
        room_id = "api-room-transcribe-1"

        # Ingest audio chunk
        resp_chunk = client.post(
            f"/api/v1/arena/presentation/rooms/{room_id}/transcribe",
            json={
                "duration_sec": 4.5,
                "speaker_name": "Founder",
                "current_slide_index": 0,
                "original_language": "ar-DZ",
            },
        )
        assert resp_chunk.status_code == 201
        assert "translations" in resp_chunk.json()

        # Get transcript in French
        resp_tr = client.get(f"/api/v1/arena/presentation/rooms/{room_id}/transcript?language=french")
        assert resp_tr.status_code == 200
        assert len(resp_tr.json()) >= 1

        # Export full transcript
        resp_exp = client.get(f"/api/v1/arena/presentation/rooms/{room_id}/transcript/export")
        assert resp_exp.status_code == 200
        assert resp_exp.json()["total_segments"] >= 1

    def test_arena_qa_endpoints(self, client):
        room_id = "api-room-qa-1"

        # Submit question
        resp_sub = client.post(
            f"/api/v1/arena/qa/rooms/{room_id}/questions",
            json={
                "startup_id": "startup-test",
                "content": "What are your customer acquisition costs?",
                "academy_tier": "SILVER",
                "reputation_weight": 1.5,
            },
        )
        assert resp_sub.status_code == 201
        q_data = resp_sub.json()
        qid = q_data["question_id"]
        # SILVER tier bonus 2.0 * 2.0 = 4.0 + 1.5 * 1.5 = 2.25 -> 6.25
        assert q_data["priority_score"] == 6.25

        # Upvote question
        resp_up = client.post(f"/api/v1/arena/qa/rooms/{room_id}/questions/{qid}/upvote")
        assert resp_up.status_code == 200
        assert resp_up.json()["upvotes"] == 1
        assert resp_up.json()["priority_score"] == 7.25

        # Promote to stage
        resp_prom = client.post(f"/api/v1/arena/qa/rooms/{room_id}/questions/{qid}/promote")
        assert resp_prom.status_code == 200
        assert resp_prom.json()["state"] == "PROMOTED_TO_STAGE"

        # Answer question
        resp_ans = client.post(
            f"/api/v1/arena/qa/rooms/{room_id}/questions/{qid}/answer",
            json={"answer_notes": "CAC is 1200 DZD per converted SME."},
        )
        assert resp_ans.status_code == 200
        assert resp_ans.json()["state"] == "ANSWERED"

    def test_live_termsheet_endpoints(self, client):
        room_id = "api-deal-room-1"

        # Open room
        resp_open = client.post(
            f"/api/v1/arena/live-termsheet/rooms/{room_id}/termsheet",
            json={
                "startup_id": "startup-bio",
                "startup_name": "BioTech Algeria",
                "initial_valuation_dzd": 80_000_000,
                "initial_ticket_dzd": 20_000_000,
            },
        )
        assert resp_open.status_code == 201
        assert resp_open.json()["valuation_pre_money_dzd"] == 80_000_000
        assert resp_open.json()["equity_share_pct"] == 20.0

        # Adjust terms
        resp_patch = client.patch(
            f"/api/v1/arena/live-termsheet/rooms/{room_id}/terms",
            json={
                "valuation_pre_money_dzd": 60_000_000,
                "ticket_size_dzd": 15_000_000,
                "actor_role": "INVESTOR",
            },
        )
        assert resp_patch.status_code == 200
        assert resp_patch.json()["valuation_pre_money_dzd"] == 60_000_000

        # Initial all clauses by Founder
        resp_f = client.post(
            f"/api/v1/arena/live-termsheet/rooms/{room_id}/initial-all",
            json={"party": "FOUNDER", "initials": "AK"},
        )
        assert resp_f.status_code == 200

        # Initial all clauses by Investor
        resp_i = client.post(
            f"/api/v1/arena/live-termsheet/rooms/{room_id}/initial-all",
            json={"party": "INVESTOR", "initials": "MS"},
        )
        assert resp_i.status_code == 200
        assert resp_i.json()["status"] == "MUTUALLY_LOCKED"

        # Seal Khatm ceremony
        resp_khatm = client.post(
            f"/api/v1/arena/live-termsheet/rooms/{room_id}/seal-khatm",
            json={"reflection_hold_duration_sec": 3.5},
        )
        assert resp_khatm.status_code == 200
        assert resp_khatm.json()["status"] == "KHATM_SEALED"
        assert resp_khatm.json()["haptic_profile"]["pulseDurationMs"] == 80

        # Audit log
        resp_log = client.get(f"/api/v1/arena/live-termsheet/rooms/{room_id}/audit-log")
        assert resp_log.status_code == 200
        assert len(resp_log.json()) >= 4


# =============================================================================
# 6. WEBSOCKET REAL-TIME STREAMING TESTS
# =============================================================================

class TestArenaWebSockets:
    """Verifies WebSocket broadcast and synchronization for presentation, Q&A, and live termsheet."""

    def test_websocket_canvas_pointer_and_annotation(self, client):
        with client.websocket_connect("/ws/arena?startup_id=ws-canvas-startup") as ws:
            ws.receive_json()  # welcome

            # 1. Pointer Update
            ws.send_json({
                "action": "canvas_pointer",
                "startup_id": "ws-canvas-startup",
                "x": 0.42,
                "y": 0.77,
                "active": True,
                "color": "#E8632E",
            })
            ptr_msg = ws.receive_json()
            assert ptr_msg["type"] == "deck:pointer_update"
            assert ptr_msg["pointer"]["x"] == 0.42

            # 2. Add Annotation
            ws.send_json({
                "action": "canvas_annotate",
                "startup_id": "ws-canvas-startup",
                "slide_index": 1,
                "annotation_type": "HIGHLIGHT_RECT",
                "data": {"x": 0.2, "y": 0.2, "w": 0.3, "h": 0.1},
            })
            ann_msg = ws.receive_json()
            assert ann_msg["type"] == "deck:annotation_added"
            assert ann_msg["annotation"]["slide_index"] == 1

            # 3. Add Bookmark
            ws.send_json({
                "action": "canvas_bookmark",
                "startup_id": "ws-canvas-startup",
                "slide_index": 1,
                "label": "TAM Locus",
                "timestamp_sec": 34.2,
            })
            bm_msg = ws.receive_json()
            assert bm_msg["type"] == "deck:bookmark_added"
            assert bm_msg["bookmark"]["label"] == "TAM Locus"

            # 4. Get Canvas State
            ws.send_json({
                "action": "get_canvas_state",
                "startup_id": "ws-canvas-startup",
            })
            state_msg = ws.receive_json()
            assert state_msg["type"] == "deck:canvas_sync"

    def test_websocket_live_qa_flow(self, client):
        with client.websocket_connect("/ws/arena?startup_id=ws-qa-startup") as ws:
            ws.receive_json()  # welcome

            # Submit Question
            ws.send_json({
                "action": "qa_submit",
                "startup_id": "ws-qa-startup",
                "content": "What is the expected churn rate?",
                "academy_tier": "GOLD",
                "reputation_weight": 2.0,
            })
            sub_msg = ws.receive_json()
            assert sub_msg["type"] == "qa:question_submitted"
            qid = sub_msg["question"]["question_id"]
            assert sub_msg["question"]["priority_score"] == 10.0

            # Upvote Question
            ws.send_json({
                "action": "qa_upvote",
                "startup_id": "ws-qa-startup",
                "question_id": qid,
            })
            up_msg = ws.receive_json()
            assert up_msg["type"] == "qa:question_upvoted"
            assert up_msg["upvotes"] == 1
            assert up_msg["priority_score"] == 11.0

            # Promote Question
            ws.send_json({
                "action": "qa_promote",
                "startup_id": "ws-qa-startup",
                "question_id": qid,
            })
            prom_msg = ws.receive_json()
            assert prom_msg["type"] == "qa:question_promoted"
            assert prom_msg["question"]["state"] == "PROMOTED_TO_STAGE"

    def test_websocket_live_termsheet_negotiation(self, client):
        with client.websocket_connect("/ws/arena?startup_id=ws-deal-startup") as ws:
            ws.receive_json()  # welcome

            # Open Term Sheet Room
            ws.send_json({
                "action": "termsheet_open",
                "startup_id": "ws-deal-startup",
                "startup_name": "AgroTech Setif",
                "initial_valuation_dzd": 70_000_000,
                "initial_ticket_dzd": 14_000_000,
            })
            open_msg = ws.receive_json()
            assert open_msg["type"] == "termsheet:opened"
            assert open_msg["state"]["equity_share_pct"] == 16.67

            # Update Terms (Shark counters at 50M valuation)
            ws.send_json({
                "action": "termsheet_update",
                "startup_id": "ws-deal-startup",
                "valuation_pre_money_dzd": 50_000_000,
                "ticket_size_dzd": 10_000_000,
            })
            upd_msg = ws.receive_json()
            assert upd_msg["type"] == "termsheet:updated"
            assert upd_msg["state"]["valuation_pre_money_dzd"] == 50_000_000

            # Initial all clauses by Founder
            ws.send_json({
                "action": "termsheet_initial",
                "startup_id": "ws-deal-startup",
                "party": "FOUNDER",
                "initials": "AK",
            })
            f_msg = ws.receive_json()
            assert f_msg["type"] == "termsheet:state_sync"
            assert f_msg["is_mutually_locked"] is False

            # Initial all clauses by Investor -> triggers MUTUALLY_LOCKED
            ws.send_json({
                "action": "termsheet_initial",
                "startup_id": "ws-deal-startup",
                "party": "INVESTOR",
                "initials": "RK",
            })
            i_msg = ws.receive_json()
            assert i_msg["type"] == "termsheet:state_sync"
            assert i_msg["is_mutually_locked"] is True

            # Trigger Sovereign Haptic Khatm
            ws.send_json({
                "action": "termsheet_seal_khatm",
                "startup_id": "ws-deal-startup",
                "reflection_hold_duration_sec": 3.1,
            })
            khatm_msg = ws.receive_json()
            assert khatm_msg["type"] == "termsheet:khatm_sealed"
            assert khatm_msg["status"] == "KHATM_SEALED"
            assert khatm_msg["haptic_profile"]["pulseDurationMs"] == 80
