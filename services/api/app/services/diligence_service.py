"""
TamWheel Sovereign Ethical Agentic Venture OS — Community Due Diligence, AMA & Bayan Service.
Coordinates multi-dimensional consensus scoring, threaded voice/text AMA queries,
FactGuard AI auditing records, and Bayan Card viral sharing payloads.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma.enums import AnalystLevel
from app.services.hype_score import hype_score_engine
from app.services.factguard_ai import factguard_ai_engine, FactBadgeStatus
from app.services.forensic_audit import forensic_audit_engine
from app.services.ddm_generator import ddm_generator
from app.services.startup_service import ALGERIAN_WILAYAS
from app.schemas.diligence import (
    MultiDimensionalRatingRequest,
    MultiDimensionalRatingResponse,
    ConsensusBreakdownResponse,
    DimensionConsensus,
    AMAQuestionCreateRequest,
    AMAAnswerCreateRequest,
    AMAQuestionResponse,
    FactGuardAuditRequest,
    FactGuardAuditResponse,
    BayanCardMetadataResponse,
    SocialCaptionSet,
    ForensicAuditRequest,
    ForensicAuditResponse,
    ConflictGraphResponse,
    DDMResponse,
)

logger = logging.getLogger("tamwheel.diligence_service")

# In-memory stores for thread persistence alongside prisma fallback
_AMA_QUESTIONS: Dict[str, Dict[str, Any]] = {}
_FACTGUARD_AUDITS: Dict[str, Dict[str, Any]] = {}
_RATINGS_CACHE: Dict[str, List[Dict[str, Any]]] = {}


class DiligenceService:
    """
    Service layer for Community Due Diligence, Consensus, AMAs,
    FactGuard auditing, and Bayan Cards.
    """

    # =========================================================================
    # 1. MULTI-DIMENSIONAL RATINGS & CONSENSUS
    # =========================================================================

    @classmethod
    async def submit_rating(
        cls,
        startup_id: str,
        user_id: int,
        rating_in: MultiDimensionalRatingRequest,
    ) -> MultiDimensionalRatingResponse:
        """
        Record a 4-dimensional diligence rating (Market, Team, Traction, Sharia).
        Recalculates HypeScore with 24h exponential anti-brigading decay.
        """
        raw_score = hype_score_engine.calculate_raw_score(
            market_score=rating_in.marketScore,
            team_score=rating_in.teamScore,
            traction_score=rating_in.tractionScore,
            sharia_score=rating_in.shariaScore,
        )

        eff_weight = hype_score_engine.compute_user_credibility_weight(
            level=rating_in.analystLevel,
            account_age_days=rating_in.accountAgeDays,
        )

        # Submit to hype score engine
        result = await hype_score_engine.submit_community_score(
            startup_id=startup_id,
            user_id=user_id,
            analyst_level=rating_in.analystLevel,
            market_score=rating_in.marketScore,
            team_score=rating_in.teamScore,
            traction_score=rating_in.tractionScore,
            sharia_score=rating_in.shariaScore,
            feedback=rating_in.feedback,
            account_age_days=rating_in.accountAgeDays,
        )

        record_id = str(uuid.uuid4())
        rating_obj = {
            "id": getattr(result.get("score"), "id", record_id),
            "startupId": startup_id,
            "userId": user_id,
            "analystLevel": rating_in.analystLevel,
            "marketScore": rating_in.marketScore,
            "teamScore": rating_in.teamScore,
            "tractionScore": rating_in.tractionScore,
            "shariaScore": rating_in.shariaScore,
            "compositeRawScore": raw_score,
            "effectiveWeight": eff_weight,
            "feedback": rating_in.feedback,
            "createdAt": datetime.now(timezone.utc),
        }

        # Cache rating in memory
        if startup_id not in _RATINGS_CACHE:
            _RATINGS_CACHE[startup_id] = []
        _RATINGS_CACHE[startup_id].append(rating_obj)

        return MultiDimensionalRatingResponse(**rating_obj)

    @classmethod
    async def get_consensus_breakdown(cls, startup_id: str) -> ConsensusBreakdownResponse:
        """
        Fetch crowd wisdom consensus metrics:
        - 4-dimensional breakdown (Market, Team, Traction, Sharia/Ethics)
        - Reputation-weighted Hype Score
        - Divergence ratio & Narrative Bubble warning flag
        """
        # Fetch from database
        db_scores = await prisma.communityscore.find_many(where={"startupId": startup_id})

        score_dicts: List[Dict[str, Any]] = []
        cached_scores = _RATINGS_CACHE.get(startup_id, [])

        if db_scores:
            for s in db_scores:
                sharia_val = 10
                if s.feedback and "[SHARIA_SCORE:" in s.feedback:
                    try:
                        sharia_val = int(s.feedback.split("[SHARIA_SCORE:")[1].split("]")[0])
                    except Exception:
                        sharia_val = 10

                score_dicts.append({
                    "marketScore": s.marketScore,
                    "teamScore": s.teamScore,
                    "tractionScore": s.tractionScore,
                    "shariaScore": sharia_val,
                    "analystLevel": s.analystLevel,
                    "createdAt": s.createdAt,
                })
        elif cached_scores:
            score_dicts = [
                {
                    "marketScore": c["marketScore"],
                    "teamScore": c["teamScore"],
                    "tractionScore": c["tractionScore"],
                    "shariaScore": c["shariaScore"],
                    "analystLevel": c["analystLevel"],
                    "createdAt": c["createdAt"],
                }
                for c in cached_scores
            ]

        if not score_dicts:
            return ConsensusBreakdownResponse(
                startupId=startup_id,
                hypeScore=0.0,
                dimensions=DimensionConsensus(marketAvg=0.0, teamAvg=0.0, tractionAvg=0.0, shariaAvg=0.0),
                totalRatingsCount=0,
                effectiveWeightedVotes=0.0,
                tierDistribution={"NOVICE": 0, "SCOUT": 0, "ANALYST": 0, "PARTNER": 0},
                narrativeBubbleWarning=False,
                divergenceRatio=0.0,
                statusFlag="NORMAL",
                warningMessage=None,
            )

        n = len(score_dicts)
        m_avg = round(sum(s["marketScore"] for s in score_dicts) / n, 2)
        t_avg = round(sum(s["teamScore"] for s in score_dicts) / n, 2)
        tr_avg = round(sum(s["tractionScore"] for s in score_dicts) / n, 2)
        sh_avg = round(sum(s.get("shariaScore", 10) for s in score_dicts) / n, 2)

        hype_score = hype_score_engine.calculate_hype_score(score_dicts, use_moving_24h_window=True)
        bubble_data = hype_score_engine.detect_narrative_bubble(score_dicts)

        tier_dist = {"NOVICE": 0, "SCOUT": 0, "ANALYST": 0, "PARTNER": 0}
        eff_weight_sum = 0.0
        for s in score_dicts:
            lvl = s["analystLevel"]
            lvl_name = lvl.value if isinstance(lvl, AnalystLevel) else str(lvl).upper()
            tier_dist[lvl_name] = tier_dist.get(lvl_name, 0) + 1
            eff_weight_sum += hype_score_engine.get_analyst_weight(lvl)

        return ConsensusBreakdownResponse(
            startupId=startup_id,
            hypeScore=hype_score,
            dimensions=DimensionConsensus(
                marketAvg=m_avg,
                teamAvg=t_avg,
                tractionAvg=tr_avg,
                shariaAvg=sh_avg,
            ),
            totalRatingsCount=n,
            effectiveWeightedVotes=round(eff_weight_sum, 2),
            tierDistribution=tier_dist,
            narrativeBubbleWarning=bubble_data["is_bubble"],
            divergenceRatio=bubble_data["divergence_ratio"],
            statusFlag=bubble_data["warning_code"] or "NORMAL",
            warningMessage=bubble_data["alert_message"],
        )

    # =========================================================================
    # 2. THREADED AMA QUESTIONS & FOUNDER REPLIES
    # =========================================================================

    @classmethod
    async def create_ama_question(
        cls,
        startup_id: str,
        user: Any,
        data: AMAQuestionCreateRequest,
    ) -> AMAQuestionResponse:
        """
        Submit a new community question for a startup AMA thread.
        Supports text or 15-second voice note question URL.
        """
        question_id = str(uuid.uuid4())
        user_name = getattr(user, "fullName", None) or getattr(user, "name", None) or f"User #{getattr(user, 'id', 1)}"
        user_tier = getattr(user, "analystTier", "NOVICE")

        question_obj = {
            "id": question_id,
            "startupId": startup_id,
            "userId": getattr(user, "id", 1),
            "authorName": user_name,
            "authorTier": str(user_tier),
            "questionText": data.questionText,
            "audioUrl": data.audioUrl,
            "category": data.category.upper(),
            "upvotes": 1,  # Author upvotes by default
            "isAnswered": False,
            "answerText": None,
            "answerAudioUrl": None,
            "answeredAt": None,
            "createdAt": datetime.now(timezone.utc),
        }

        _AMA_QUESTIONS[question_id] = question_obj
        return AMAQuestionResponse(**question_obj)

    @classmethod
    async def list_ama_questions(
        cls,
        startup_id: str,
        category: Optional[str] = None,
    ) -> List[AMAQuestionResponse]:
        """
        Retrieve all threaded AMA questions for a startup, sorted by upvotes descending.
        """
        results: List[Dict[str, Any]] = [
            q for q in _AMA_QUESTIONS.values()
            if q["startupId"] == startup_id
            and (category is None or q["category"] == category.upper())
        ]
        results.sort(key=lambda x: (x["upvotes"], x["createdAt"]), reverse=True)
        return [AMAQuestionResponse(**r) for r in results]

    @classmethod
    async def answer_ama_question(
        cls,
        question_id: str,
        user: Any,
        data: AMAAnswerCreateRequest,
    ) -> AMAQuestionResponse:
        """
        Answer an AMA question with founder text or audio response.
        """
        q = _AMA_QUESTIONS.get(question_id)
        if not q:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AMA question not found")

        q["answerText"] = data.answerText
        q["answerAudioUrl"] = data.audioUrl
        q["isAnswered"] = True
        q["answeredAt"] = datetime.now(timezone.utc)

        return AMAQuestionResponse(**q)

    @classmethod
    async def upvote_ama_question(cls, question_id: str) -> AMAQuestionResponse:
        """
        Upvote an AMA question to boost community priority.
        """
        q = _AMA_QUESTIONS.get(question_id)
        if not q:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AMA question not found")

        q["upvotes"] += 1
        return AMAQuestionResponse(**q)

    # =========================================================================
    # 3. FACTGUARD AI AUDIT INTEGRATION
    # =========================================================================

    @classmethod
    async def run_factguard_audit(
        cls,
        startup_id: str,
        data: FactGuardAuditRequest,
    ) -> FactGuardAuditResponse:
        """
        Execute FactGuard AI audit on pitch reel transcript and video claims.
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        startup_context = {"name": startup.name} if startup else None

        audit_result = factguard_ai_engine.audit_pitch_reel(
            startup_id=startup_id,
            transcript_text=data.transcriptText,
            video_url=data.videoUrl,
            custom_claims=data.customClaims,
            startup_context=startup_context,
        )

        _FACTGUARD_AUDITS[startup_id] = audit_result
        return FactGuardAuditResponse(**audit_result)

    @classmethod
    async def get_factguard_status(cls, startup_id: str) -> FactGuardAuditResponse:
        """
        Retrieve latest FactGuard audit status for a startup.
        """
        if startup_id in _FACTGUARD_AUDITS:
            return FactGuardAuditResponse(**_FACTGUARD_AUDITS[startup_id])

        # Default audit if not run yet
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        name = startup.name if startup else "Startup"
        has_label = startup.hasAsfLabel if startup else False

        default_transcript = f"{name} est une startup algérienne {'labellisée' if has_label else ''} opérant dans le secteur technologique."
        audit_result = factguard_ai_engine.audit_pitch_reel(
            startup_id=startup_id,
            transcript_text=default_transcript,
            startup_context={"name": name},
        )
        _FACTGUARD_AUDITS[startup_id] = audit_result
        return FactGuardAuditResponse(**audit_result)

    # =========================================================================
    # 4. BAYAN CARD (1-PAGE VIRAL MOBILE INFOGRAPHIC PAYLOAD)
    # =========================================================================

    @classmethod
    async def generate_bayan_card(cls, startup_id: str) -> BayanCardMetadataResponse:
        """
        Compile full 1-page mobile Bayan Card payload for WhatsApp/Telegram sharing.
        Combines metadata, Hype Score, Consensus dimensions, FactGuard verification,
        and multi-lingual social share copy.
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        if not startup:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")

        consensus = await cls.get_consensus_breakdown(startup_id)
        factguard = await cls.get_factguard_status(startup_id)

        wilaya_name = ALGERIAN_WILAYAS.get(startup.wilaya, f"Wilaya {startup.wilaya}")

        # Determine reputation tier
        if consensus.hypeScore >= 90:
            tier_label = "Validated Powerhouse (مؤسسة رائدة معتمدة)"
        elif consensus.hypeScore >= 75:
            tier_label = "Community Favorite (خيار المجتمع الواعد)"
        elif consensus.hypeScore >= 50:
            tier_label = "Emerging Contender (مشروع ناشئ صاعد)"
        else:
            tier_label = "Early Discovery (قيد التقييم الأولي)"

        share_url = f"https://tamwheel.dz/startups/{startup_id}/bayan"
        qr_payload = f"tamwheel://startups/{startup_id}/diligence"

        # Multi-language social captions
        badge_str = "✅ Vérifié" if factguard.overallBadge == FactBadgeStatus.GREEN_VERIFIED else "⚠️ Sous audit"
        ar_caption = (
            f"📊 *بطاقة بيان الاستثمار* — {startup.name} ({wilaya_name})\n"
            f"🔥 مؤشر الزخم (Hype Score): {consensus.hypeScore}/100\n"
            f"🛡️ تدقيق FactGuard الذكي: {factguard.overallBadge}\n"
            f"⚖️ مطابقة الشريعة والأخلاق: {consensus.dimensions.shariaAvg}/10\n"
            f"🔗 استكشف بطاقة البيان الكاملة: {share_url}"
        )
        fr_caption = (
            f"📊 *Fiche Bayan Diligence* — {startup.name} ({wilaya_name})\n"
            f"🔥 Hype Score: {consensus.hypeScore}/100\n"
            f"🛡️ Audit FactGuard AI: {badge_str}\n"
            f"⚖️ Éthique & Charia: {consensus.dimensions.shariaAvg}/10\n"
            f"🔗 Voir l'infographie complète: {share_url}"
        )
        en_caption = (
            f"📊 *Bayan Diligence Card* — {startup.name} ({wilaya_name})\n"
            f"🔥 Hype Score: {consensus.hypeScore}/100\n"
            f"🛡️ FactGuard AI Audit: {factguard.overallBadge}\n"
            f"⚖️ Sharia & Ethics Vector: {consensus.dimensions.shariaAvg}/10\n"
            f"🔗 Open full Bayan Card: {share_url}"
        )

        brand_tokens = {
            "navyPrimary": "#1B2A4A",      # PANTONE 2767 C Deep Trust
            "orangeAccent": "#E8632E",     # Dynamic Energy Orange
            "greenVerified": "#10B981",    # Sharia & Integrity Emerald
            "amberContext": "#F59E0B",     # Context Amber
            "redUnverified": "#EF4444",    # Contradicted Red
        }

        return BayanCardMetadataResponse(
            startupId=startup.id,
            startupName=startup.name,
            tagline=startup.tagline,
            wilaya=startup.wilaya,
            wilayaName=wilaya_name,
            sector=startup.sector,
            hasAsfLabel=startup.hasAsfLabel,
            hypeScore=consensus.hypeScore,
            reputationTierLabel=tier_label,
            consensus=consensus.dimensions,
            factGuardBadge=factguard.overallBadge.value,
            factGuardVerifiedClaimsCount=factguard.verifiedCount,
            narrativeBubbleWarning=consensus.narrativeBubbleWarning,
            divergenceRatio=consensus.divergenceRatio,
            shareUrl=share_url,
            qrPayload=qr_payload,
            socialCaptions=SocialCaptionSet(ar=ar_caption, fr=fr_caption, en=en_caption),
            brandTokens=brand_tokens,
        )

    # =========================================================================
    # 5. FORENSIC AUDIT & CONFLICT GRAPH
    # =========================================================================

    @classmethod
    async def run_forensic_audit(
        cls,
        startup_id: str,
        data: ForensicAuditRequest,
    ) -> ForensicAuditResponse:
        """
        Execute Benford's Law analysis and Graph Conflict of Interest evaluation.
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        startup_name = startup.name if startup else f"Startup {startup_id}"

        ledger = data.ledgerEntries or [
            120000, 150000, 180000, 220000, 280000, 310000, 115000, 190000,
            450000, 130000, 260000, 390000, 540000, 175000, 210000, 140000,
            330000, 480000, 160000, 270000, 125000, 350000, 620000, 185000,
        ]
        benford_res = forensic_audit_engine.analyze_financial_ledger(ledger)

        founders = data.founders or [
            {"id": "f-1", "fullName": getattr(startup, "founderName", "Founder"), "email": "founder@tamwheel.dz", "nin": "160123456789"}
        ]
        jurors = data.jurors or [
            {"id": "j-1", "fullName": "Amine Benali", "email": "amine@invest.dz", "nin": "160987654321", "role": "PARTNER"}
        ]
        vendors = data.vendors or [
            {"id": "v-1", "companyName": "TechSolutions SARL", "directorName": "Karim Meziani", "emailDomain": "techsolutions.dz"}
        ]

        conflict_res = forensic_audit_engine.detect_conflicts_of_interest(
            founders=founders,
            jurors=jurors,
            vendors=vendors,
            startup_name=startup_name,
        )

        return ForensicAuditResponse(
            startupId=startup_id,
            benfordAnalysis=benford_res,
            conflictAnalysis=ConflictGraphResponse(**conflict_res),
            auditedAt=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    async def get_conflict_graph(cls, startup_id: str) -> ConflictGraphResponse:
        """
        Retrieve knowledge graph of related parties and conflicts of interest.
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        startup_name = startup.name if startup else f"Startup {startup_id}"

        default_founders = [
            {"id": "f-1", "fullName": getattr(startup, "founderName", "Founder Principal"), "email": "founder@startup.dz", "nin": "160111222333"}
        ]
        default_jurors = [
            {"id": "j-1", "fullName": "Dr. Samy Khelifi", "email": "samy@jury.tamwheel.dz", "nin": "310444555666", "role": "PARTNER"}
        ]
        default_vendors = [
            {"id": "v-1", "companyName": "CloudAlgérie SPAS", "directorName": "Nabil Touati", "emailDomain": "cloudalgerie.dz"}
        ]

        res = forensic_audit_engine.detect_conflicts_of_interest(
            founders=default_founders,
            jurors=default_jurors,
            vendors=default_vendors,
            startup_name=startup_name,
        )
        return ConflictGraphResponse(**res)

    # =========================================================================
    # 6. AUTOMATED DUE DILIGENCE MEMORANDUM (DDM)
    # =========================================================================

    @classmethod
    async def generate_ddm(
        cls,
        startup_id: str,
        custom_red_flags: Optional[List[Dict[str, Any]]] = None,
    ) -> DDMResponse:
        """
        Generate comprehensive institutional Due Diligence Memorandum (DDM).
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        if not startup:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")

        startup_dict = {
            "id": startup.id,
            "name": startup.name,
            "tagline": startup.tagline,
            "wilaya": startup.wilaya,
            "sector": startup.sector,
            "hasAsfLabel": startup.hasAsfLabel,
            "hypeScore": startup.hypeScore,
        }

        consensus = await cls.get_consensus_breakdown(startup_id)
        factguard = await cls.get_factguard_status(startup_id)

        memo_dict = ddm_generator.generate_memorandum(
            startup_data=startup_dict,
            consensus_data=consensus.model_dump(),
            factguard_data=factguard.model_dump(),
            custom_red_flags=custom_red_flags,
        )

        return DDMResponse(**memo_dict)


diligence_service = DiligenceService()
