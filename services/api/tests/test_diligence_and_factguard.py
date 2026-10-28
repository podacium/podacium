"""
TamWheel Sovereign Ethical Agentic Venture OS — Diligence, Hype Score & FactGuard AI Test Suite.
Tests:
1. Reputation-Weighted HypeScoreEngine (Novice 1.0x, Scout 1.5x, Analyst 2.5x, Partner 4.0x)
2. Credibility formula with historical Brier calibration and account longevity dampening
3. Multi-dimensional rating normalization (Market, Team, Traction, Sharia/Ethics)
4. Anti-brigading moving 24h exponential burst decay
5. Divergence & Narrative Bubble detector (public engagement vs expert diligence > 3.0x)
6. FactGuard AI multimodal claim extraction & registry cross-referencing (CNRC, INAPI, Decree 20-254)
7. Community Due Diligence Consensus & Threaded AMA router endpoints
8. 1-Page Mobile Bayan Card infographic metadata generation
"""

from datetime import datetime, timedelta, timezone
import math
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.generated.prisma.enums import AnalystLevel, UserRole
from app.services.hype_score import HypeScoreEngine, ANALYST_WEIGHTS
from app.services.factguard_ai import (
    FactGuardAIEngine,
    FactCategory,
    FactBadgeStatus,
    factguard_ai_engine,
)
from app.services.diligence_service import DiligenceService, _AMA_QUESTIONS, _FACTGUARD_AUDITS, _RATINGS_CACHE
from app.schemas.diligence import (
    MultiDimensionalRatingRequest,
    AMAQuestionCreateRequest,
    AMAAnswerCreateRequest,
    FactGuardAuditRequest,
)


# =============================================================================
# FIXTURES & HELPERS
# =============================================================================

class MockUser:
    def __init__(self, user_id=1, role=UserRole.STUDENT, email="analyst@tamwheel.dz", full_name="Sofiane Analyst"):
        self.id = user_id
        self.role = role
        self.email = email
        self.fullName = full_name
        self.analystTier = "ANALYST"
        self.isActive = True


@pytest.fixture(autouse=True)
def clean_diligence_cache():
    _AMA_QUESTIONS.clear()
    _FACTGUARD_AUDITS.clear()
    _RATINGS_CACHE.clear()
    yield
    _AMA_QUESTIONS.clear()
    _FACTGUARD_AUDITS.clear()
    _RATINGS_CACHE.clear()


@pytest.fixture
def mock_analyst_user():
    return MockUser(user_id=25, full_name="Lyes Partner")


@pytest.fixture
def api_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# =============================================================================
# 1. HYPE SCORE ENGINE: HARDENING & TIERS
# =============================================================================

class TestHypeScoreEngineHardened:
    """Rigorous mathematical tests for hardened reputation tiers and decay."""

    def test_analyst_reputation_tiers_and_aliases(self):
        """Verify reputation weights: Novice 1.0x, Scout 1.5x, Analyst 2.5x, Partner 4.0x."""
        engine = HypeScoreEngine()
        assert engine.get_analyst_weight(AnalystLevel.NOVICE) == 1.0
        assert engine.get_analyst_weight(AnalystLevel.SCOUT) == 1.5
        assert engine.get_analyst_weight(AnalystLevel.ANALYST) == 2.5
        assert engine.get_analyst_weight(AnalystLevel.PARTNER) == 4.0

        # String aliases
        assert engine.get_analyst_weight("expert") == 4.0
        assert engine.get_analyst_weight("expert_verdict") == 4.0
        assert engine.get_analyst_weight("juror") == 4.0
        assert engine.get_analyst_weight("unknown_role") == 1.0

    def test_credibility_weighting_formula_brier_and_longevity(self):
        """
        Verify Blueprint Section 8.4 credibility formula:
        W_user = Phi_tier * Psi_hist * Omega_stake
        - Phi_tier: Partner = 4.0
        - Psi_hist: Brier calibration factor = 1.2
        - Omega_stake: sqrt(Days / 90) -> 90 days = 1.0, 22.5 days = 0.5
        """
        engine = HypeScoreEngine()

        # Mature account (100 days >= 90) with high Brier accuracy (1.2x)
        w_mature = engine.compute_user_credibility_weight(
            level=AnalystLevel.PARTNER,
            history_brier_calibration=1.2,
            account_age_days=100,
        )
        # 4.0 * 1.2 * 1.0 = 4.8
        assert w_mature == pytest.approx(4.8, rel=1e-3)

        # Fresh burner account (10 days) -> sqrt(10/90) = 1/3 = 0.3333
        w_burner = engine.compute_user_credibility_weight(
            level=AnalystLevel.NOVICE,
            history_brier_calibration=1.0,
            account_age_days=10,
        )
        expected_omega = math.sqrt(10.0 / 90.0)
        assert w_burner == pytest.approx(1.0 * 1.0 * expected_omega, rel=1e-3)
        assert w_burner < 0.40

    def test_multi_dimensional_raw_score_normalization(self):
        """
        Verify 4-dimensional score: ((Market + Team + Traction + Sharia) / 4.0) * 10.0
        and backward compatibility when sharia is None: ((Market + Team + Traction) / 3.0) * 10.0
        """
        # 4-dimensional perfect score
        assert HypeScoreEngine.calculate_raw_score(10, 10, 10, 10) == 100.0

        # 4-dimensional mixed score: (8 + 6 + 7 + 9) / 4 = 30 / 4 = 7.5 -> 75.0
        assert HypeScoreEngine.calculate_raw_score(8, 6, 7, 9) == 75.0

        # 3-dimensional fallback: (6 + 8 + 7) / 3 = 7.0 -> 70.0
        assert HypeScoreEngine.calculate_raw_score(6, 8, 7, None) == 70.0

        # Clamping limits: values out of 1-10 range are bounded (15->10, 0->1, 12->10, 11->10: 31/4 * 10 = 77.5)
        assert HypeScoreEngine.calculate_raw_score(15, 0, 12, 11) == 77.5
        assert HypeScoreEngine.calculate_raw_score(15, 12, 12, 11) == 100.0
        assert HypeScoreEngine.calculate_raw_score(0, 0, 0, 0) == 10.0

    def test_moving_24h_exponential_decay_brigading(self):
        """
        Verify that coordinated voting bursts within a 24-hour window experience
        progressive exponential attenuation past the burst threshold.
        """
        engine = HypeScoreEngine(burst_threshold=3, decay_lambda=0.4)
        base_time = datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc)

        # 5 votes within a rolling 24-hour window
        timestamps = [base_time + timedelta(hours=i * 2) for i in range(5)]

        decay_vote1 = engine.compute_moving_24h_decay(timestamps[0], timestamps)
        decay_vote3 = engine.compute_moving_24h_decay(timestamps[2], timestamps)
        decay_vote5 = engine.compute_moving_24h_decay(timestamps[4], timestamps)

        # Votes 1, 2, 3 are within threshold (3) -> decay factor is 1.0
        assert decay_vote1 == 1.0
        assert decay_vote3 == 1.0

        # Vote 5 (5 total within 24h, excess = 5 - 3 = 2) -> exp(-0.4 * 2) = exp(-0.8) approx 0.449
        expected_decay = math.exp(-0.4 * 2)
        assert decay_vote5 == pytest.approx(expected_decay, rel=1e-3)
        assert decay_vote5 < 0.50

    def test_narrative_bubble_detection_trigger_warning(self):
        """
        Trigger NARRATIVE_BUBBLE_WARNING when retail hype volume outpaces expert evaluations by > 3.0x.
        """
        engine = HypeScoreEngine(bubble_threshold=3.0)

        # 10 Novice retail reviews vs 1 Partner review -> ratio = 10.0x (> 3.0x threshold)
        scores = [
            {"marketScore": 10, "teamScore": 10, "tractionScore": 10, "analystLevel": AnalystLevel.NOVICE}
            for _ in range(10)
        ] + [
            {"marketScore": 5, "teamScore": 4, "tractionScore": 5, "analystLevel": AnalystLevel.PARTNER}
        ]

        check = engine.detect_narrative_bubble(scores)
        assert check["is_bubble"] is True
        assert check["warning_code"] == "NARRATIVE_BUBBLE_WARNING"
        assert check["divergence_ratio"] == 10.0
        assert check["alert_flag"] is True
        assert "outpaces verified expert diligence" in check["alert_message"]

    def test_narrative_bubble_detection_balanced_no_warning(self):
        """
        When retail hype is balanced by sufficient expert reviews, no warning is triggered.
        """
        engine = HypeScoreEngine(bubble_threshold=3.0)

        # 6 retail reviews vs 3 expert reviews -> ratio = 2.0x (<= 3.0x threshold)
        scores = [
            {"marketScore": 9, "teamScore": 8, "tractionScore": 8, "analystLevel": AnalystLevel.NOVICE}
            for _ in range(6)
        ] + [
            {"marketScore": 8, "teamScore": 8, "tractionScore": 7, "analystLevel": AnalystLevel.ANALYST}
            for _ in range(3)
        ]

        check = engine.detect_narrative_bubble(scores)
        assert check["is_bubble"] is False
        assert check["warning_code"] is None
        assert check["divergence_ratio"] == 2.0
        assert check["alert_flag"] is False


# =============================================================================
# 2. FACTGUARD AI VIDEO PITCH AUDITING
# =============================================================================

class TestFactGuardAIEngine:
    """Multimodal claim extraction & registry verification tests."""

    def test_claim_extraction_from_pitch_transcript(self):
        """
        Verify that speech transcript is parsed into structured quantitative claims:
        ARR revenue, customer count, national label, INAPI patent, and CNRC registration.
        """
        engine = FactGuardAIEngine()
        transcript = (
            "Bonjour les investisseurs. Notre startup TamWheel est labellisée sous le numéro ASF-2024-0412. "
            "Nous sommes immatriculés au registre du commerce 16/00-1234567B22. "
            "Nous avons déposé un brevet d'invention INAPI DZ/P/2023/0045 pour notre algorithme. "
            "Nous avons atteint un ARR de 25 millions DZD cette année avec plus de 60,000 utilisateurs actifs."
        )

        claims = engine.extract_claims_from_text(transcript)
        categories = [c["category"] for c in claims]

        assert FactCategory.STARTUP_LABEL.value in categories
        assert FactCategory.REGULATORY_CNRC.value in categories
        assert FactCategory.PATENT_IP.value in categories
        assert FactCategory.REVENUE.value in categories
        assert FactCategory.CUSTOMER_COUNT.value in categories

    def test_verify_startup_label_valid_green(self):
        """Valid national startup label under Decree 20-254 returns GREEN_VERIFIED."""
        engine = FactGuardAIEngine()
        claim = {
            "category": FactCategory.STARTUP_LABEL.value,
            "claimText": "Notre startup est titulaire du Label Startup ASF-2024-0412",
            "claimedValue": "ASF-2024-0412",
        }
        res = engine.verify_claim(claim)
        assert res["badge"] == FactBadgeStatus.GREEN_VERIFIED.value
        assert "Ministère" in res["registrySource"]
        assert "Valid until 2028" in res["verificationNotes"]

    def test_verify_startup_label_expired_red(self):
        """Expired or revoked label returns RED_UNVERIFIED."""
        engine = FactGuardAIEngine()
        claim = {
            "category": FactCategory.STARTUP_LABEL.value,
            "claimText": "Nous avons le label officiel LABEL-ALG-2022-009",
            "claimedValue": "LABEL-ALG-2022-009",
        }
        res = engine.verify_claim(claim)
        assert res["badge"] == FactBadgeStatus.RED_UNVERIFIED.value
        assert "expired" in res["verificationNotes"].lower()

    def test_verify_cnrc_commercial_registration(self):
        """Active CNRC returns GREEN_VERIFIED; dissolved entity returns RED_UNVERIFIED."""
        engine = FactGuardAIEngine()

        # Active SPAS in Algiers
        active_claim = {
            "category": FactCategory.REGULATORY_CNRC.value,
            "claimText": "Immatriculation CNRC 16/00-1234567B22",
            "claimedValue": "16/00-1234567B22",
        }
        res_active = engine.verify_claim(active_claim)
        assert res_active["badge"] == FactBadgeStatus.GREEN_VERIFIED.value

        # Dissolved entity in Constantine
        dissolved_claim = {
            "category": FactCategory.REGULATORY_CNRC.value,
            "claimText": "Registre du commerce 25/00-5554321A19",
            "claimedValue": "25/00-5554321A19",
        }
        res_dissolved = engine.verify_claim(dissolved_claim)
        assert res_dissolved["badge"] == FactBadgeStatus.RED_UNVERIFIED.value
        assert "DISSOLVED" in res_dissolved["verificationNotes"]

    def test_verify_inapi_patent(self):
        """Granted patent returns GREEN_VERIFIED; pending examination returns AMBER_CONTEXT."""
        engine = FactGuardAIEngine()

        # Granted patent
        granted_claim = {
            "category": FactCategory.PATENT_IP.value,
            "claimText": "Brevet d'invention INAPI DZ/P/2023/0045",
            "claimedValue": "DZ/P/2023/0045",
        }
        res_granted = engine.verify_claim(granted_claim)
        assert res_granted["badge"] == FactBadgeStatus.GREEN_VERIFIED.value

        # Pending patent
        pending_claim = {
            "category": FactCategory.PATENT_IP.value,
            "claimText": "Brevet déposé DZ/P/2024/0112",
            "claimedValue": "DZ/P/2024/0112",
        }
        res_pending = engine.verify_claim(pending_claim)
        assert res_pending["badge"] == FactBadgeStatus.AMBER_CONTEXT.value

    def test_pitch_reel_overall_audit_fatal_gate(self):
        """
        Verify that a single fraudulent/contradicted claim drops overall Reel to RED_UNVERIFIED,
        while a verified pitch yields GREEN_VERIFIED with video overlays.
        """
        engine = FactGuardAIEngine()

        # Clean pitch
        clean_transcript = (
            "Startup TamWheel avec label ASF-2024-0412. "
            "Registre CNRC 16/00-1234567B22. "
            "Brevet INAPI DZ/P/2023/0045."
        )
        report_clean = engine.audit_pitch_reel("st-1", clean_transcript, video_url="https://cdn.tamwheel.dz/reels/pitch1.mp4")
        assert report_clean["overallBadge"] == FactBadgeStatus.GREEN_VERIFIED.value
        assert report_clean["redCount"] == 0
        assert len(report_clean["overlays"]) == 3

        # Poisoned pitch with expired label
        fraud_transcript = (
            "Startup avec label LABEL-ALG-2022-009 expiré. "
            "Registre CNRC 16/00-1234567B22."
        )
        report_fraud = engine.audit_pitch_reel("st-2", fraud_transcript)
        assert report_fraud["overallBadge"] == FactBadgeStatus.RED_UNVERIFIED.value
        assert report_fraud["redCount"] == 1
        assert "Flagged" in report_fraud["summary"]


# =============================================================================
# 3. COMMUNITY DILIGENCE, AMA & BAYAN CARD ROUTER TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_submit_diligence_rating_endpoint(api_client, mock_analyst_user):
    """Test POST /api/v1/diligence/{startup_id}/ratings."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_analyst_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    startup_mock = SimpleNamespace(id="st-test-diligence", name="Algeria Drone SPAS")

    with patch("app.core.prisma.prisma.communityscore.upsert", new_callable=AsyncMock) as mock_upsert, \
         patch("app.core.prisma.prisma.communityscore.find_many", new_callable=AsyncMock) as mock_find_many, \
         patch("app.core.prisma.prisma.startup.update", new_callable=AsyncMock):

        mock_upsert.return_value = SimpleNamespace(
            id="score-uuid-1",
            startupId="st-test-diligence",
            userId=mock_analyst_user.id,
            analystLevel=AnalystLevel.ANALYST,
            marketScore=8,
            teamScore=9,
            tractionScore=7,
            feedback="Strong autonomous drone hardware team.",
            createdAt=datetime.now(timezone.utc),
        )
        mock_find_many.return_value = []

        resp = await api_client.post(
            "/api/v1/diligence/st-test-diligence/ratings",
            json={
                "marketScore": 8,
                "teamScore": 9,
                "tractionScore": 7,
                "shariaScore": 10,
                "analystLevel": "ANALYST",
                "feedback": "Strong autonomous drone hardware team.",
                "accountAgeDays": 60,
            },
            headers=headers,
        )

        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["marketScore"] == 8
        assert data["teamScore"] == 9
        assert data["tractionScore"] == 7
        assert data["shariaScore"] == 10
        # ((8 + 9 + 7 + 10) / 4) * 10 = 85.0
        assert data["compositeRawScore"] == 85.0

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_diligence_consensus_breakdown_endpoint(api_client):
    """Test GET /api/v1/diligence/{startup_id}/consensus."""
    startup_id = "st-test-consensus"

    mock_scores = [
        SimpleNamespace(
            startupId=startup_id,
            userId=1,
            analystLevel=AnalystLevel.NOVICE,
            marketScore=8,
            teamScore=8,
            tractionScore=8,
            feedback="[SHARIA_SCORE:9] Good",
            createdAt=datetime.now(timezone.utc),
        ),
        SimpleNamespace(
            startupId=startup_id,
            userId=2,
            analystLevel=AnalystLevel.PARTNER,
            marketScore=9,
            teamScore=9,
            tractionScore=9,
            feedback="[SHARIA_SCORE:10] Excellent",
            createdAt=datetime.now(timezone.utc),
        ),
    ]

    with patch("app.core.prisma.prisma.communityscore.find_many", new_callable=AsyncMock) as mock_find_many:
        mock_find_many.return_value = mock_scores

        resp = await api_client.get(f"/api/v1/diligence/{startup_id}/consensus")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["totalRatingsCount"] == 2
        assert data["hypeScore"] > 80.0
        assert data["dimensions"]["marketAvg"] == 8.5
        assert data["dimensions"]["shariaAvg"] == 9.5
        assert data["narrativeBubbleWarning"] is False


@pytest.mark.asyncio
async def test_ama_question_submission_and_upvoting(api_client, mock_analyst_user):
    """Test POST question, GET questions, and POST upvote in AMA thread."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_analyst_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    startup_id = "st-ama-test"

    # 1. Post a question
    resp_post = await api_client.post(
        f"/api/v1/diligence/{startup_id}/ama/questions",
        json={
            "questionText": "What is your customer churn rate in the Oran and Constantine markets?",
            "category": "TRACTION",
            "audioUrl": "https://cdn.tamwheel.dz/audio/ama_question_12.mp3",
        },
        headers=headers,
    )
    assert resp_post.status_code == status.HTTP_201_CREATED
    q_data = resp_post.json()
    q_id = q_data["id"]
    assert q_data["category"] == "TRACTION"
    assert q_data["upvotes"] == 1
    assert q_data["isAnswered"] is False

    # 2. Upvote question
    resp_upvote = await api_client.post(
        f"/api/v1/diligence/ama/questions/{q_id}/upvote",
        headers=headers,
    )
    assert resp_upvote.status_code == status.HTTP_200_OK
    assert resp_upvote.json()["upvotes"] == 2

    # 3. Founder answers question
    resp_answer = await api_client.post(
        f"/api/v1/diligence/ama/questions/{q_id}/answer",
        json={
            "answerText": "Our MoM churn is strictly below 2.8% due to exclusive merchant agreements.",
            "audioUrl": "https://cdn.tamwheel.dz/audio/founder_reply_12.mp3",
        },
        headers=headers,
    )
    assert resp_answer.status_code == status.HTTP_200_OK
    ans_data = resp_answer.json()
    assert ans_data["isAnswered"] is True
    assert "below 2.8%" in ans_data["answerText"]

    # 4. List questions
    resp_list = await api_client.get(f"/api/v1/diligence/{startup_id}/ama/questions")
    assert resp_list.status_code == status.HTTP_200_OK
    assert len(resp_list.json()) >= 1

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_bayan_card_metadata_payload(api_client):
    """
    Test GET /api/v1/diligence/{startup_id}/bayan-card.
    Verifies 1-page mobile infographic payload for WhatsApp / Telegram sharing.
    """
    startup_id = "st-bayan-1"
    mock_startup = SimpleNamespace(
        id=startup_id,
        name="FinSovereign SPAS",
        tagline="Ethical Sharia-compliant digital banking infrastructure",
        wilaya=16,
        sector="FinTech & InsurTech",
        hasAsfLabel=True,
    )

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find, \
         patch("app.core.prisma.prisma.communityscore.find_many", new_callable=AsyncMock) as mock_scores:

        mock_find.return_value = mock_startup
        mock_scores.return_value = [
            SimpleNamespace(
                startupId=startup_id,
                userId=1,
                analystLevel=AnalystLevel.SCOUT,
                marketScore=9,
                teamScore=9,
                tractionScore=8,
                feedback="[SHARIA_SCORE:10] Top tier",
                createdAt=datetime.now(timezone.utc),
            )
        ]

        resp = await api_client.get(f"/api/v1/diligence/{startup_id}/bayan-card")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        assert data["startupName"] == "FinSovereign SPAS"
        assert data["wilayaName"] == "Alger"
        assert data["hasAsfLabel"] is True
        assert data["brandTokens"]["navyPrimary"] == "#1B2A4A"
        assert data["brandTokens"]["orangeAccent"] == "#E8632E"
        assert data["shareUrl"] == f"https://tamwheel.dz/startups/{startup_id}/bayan"
        assert "tamwheel://" in data["qrPayload"]

        # Check multi-language captions
        assert "بطاقة بيان الاستثمار" in data["socialCaptions"]["ar"]
        assert "Fiche Bayan Diligence" in data["socialCaptions"]["fr"]
        assert "Bayan Diligence Card" in data["socialCaptions"]["en"]


@pytest.mark.asyncio
async def test_factguard_audit_endpoint(api_client, mock_analyst_user):
    """Test POST /api/v1/diligence/{startup_id}/factguard/audit."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_analyst_user
    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    mock_startup = SimpleNamespace(
        id="st-audit-1",
        name="Garini Smart Parking SPAS",
        hasAsfLabel=True,
    )

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_startup

        transcript = (
            "Garini est labellisée ASF-2023-0105 sous le décret 20-254. "
            "Notre chiffre d'affaires est de 15 millions DZD avec 35,000 clients."
        )

        resp = await api_client.post(
            "/api/v1/diligence/st-audit-1/factguard/audit",
            json={
                "videoUrl": "https://cdn.tamwheel.dz/reels/garini.mp4",
                "transcriptText": transcript,
            },
            headers=headers,
        )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["overallBadge"] == FactBadgeStatus.GREEN_VERIFIED.value
        assert data["verifiedCount"] >= 2
        assert len(data["overlays"]) >= 2

    app.dependency_overrides.clear()
