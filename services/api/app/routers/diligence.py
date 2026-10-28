"""
TamWheel Sovereign Ethical Agentic Venture OS — Community Due Diligence, AMA & FactGuard Router.
Exposes endpoints for:
1. Multi-dimensional crowd wisdom ratings (Market, Team, Traction, Sharia/Ethics 1-10)
2. Crowd consensus aggregation, Hype Score, and Narrative Bubble warning flags
3. Threaded founder-community AMA with text and 15-second voice notes
4. FactGuard AI multimodal video pitch auditing against official Algerian registries
5. Bayan Card 1-page mobile infographic generator for WhatsApp/Telegram viral loops
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.diligence_service import diligence_service
from app.schemas.diligence import (
    MultiDimensionalRatingRequest,
    MultiDimensionalRatingResponse,
    ConsensusBreakdownResponse,
    AMAQuestionCreateRequest,
    AMAAnswerCreateRequest,
    AMAQuestionResponse,
    FactGuardAuditRequest,
    FactGuardAuditResponse,
    BayanCardMetadataResponse,
    ForensicAuditRequest,
    ForensicAuditResponse,
    ConflictGraphResponse,
    DDMResponse,
)

logger = logging.getLogger("tamwheel.routers.diligence")

router = APIRouter(tags=["community-diligence", "factguard", "ama", "bayan"])


# =============================================================================
# 1. MULTI-DIMENSIONAL RATINGS & CONSENSUS
# =============================================================================

@router.post(
    "/diligence/{startup_id}/ratings",
    response_model=MultiDimensionalRatingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_diligence_rating(
    startup_id: str,
    rating_in: MultiDimensionalRatingRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submit crowd wisdom due diligence rating across 4 orthogonal dimensions:
    - Market Need & Utility (1-10)
    - Team Execution Capability (1-10)
    - Traction & ARR Metrics (1-10)
    - Sharia & Ethical Compliance (1-10)
    Applies reputation-weighted scoring with moving 24h anti-brigading decay.
    """
    user_id = getattr(current_user, "id", 1)
    return await diligence_service.submit_rating(
        startup_id=startup_id,
        user_id=user_id,
        rating_in=rating_in,
    )


@router.get(
    "/diligence/{startup_id}/consensus",
    response_model=ConsensusBreakdownResponse,
)
async def get_diligence_consensus(startup_id: str):
    """
    Retrieve aggregated crowd diligence consensus for a startup:
    - 4-dimensional score averages
    - Reputation-weighted Hype Score
    - Effective weighted votes & tier distribution
    - Narrative Bubble divergence analysis & warning banner flag
    """
    return await diligence_service.get_consensus_breakdown(startup_id=startup_id)


# =============================================================================
# 2. BAYAN CARD (VIRAL INFOGRAPHIC METADATA)
# =============================================================================

@router.get(
    "/diligence/{startup_id}/bayan-card",
    response_model=BayanCardMetadataResponse,
)
async def get_bayan_card_metadata(startup_id: str):
    """
    Generate 1-page mobile Bayan Card infographic metadata for WhatsApp and Telegram viral sharing.
    Includes Hype Score, consensus dimensions, FactGuard verification status,
    deep-link QR payload, and pre-formatted Arabic, French, and English share copy.
    """
    return await diligence_service.generate_bayan_card(startup_id=startup_id)


# =============================================================================
# 3. THREADED FOUNDER AMA
# =============================================================================

@router.post(
    "/diligence/{startup_id}/ama/questions",
    response_model=AMAQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_ama_question(
    startup_id: str,
    question_in: AMAQuestionCreateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submit a community due diligence question to the startup founder.
    Supports text questions or 15-second voice notes.
    """
    return await diligence_service.create_ama_question(
        startup_id=startup_id,
        user=current_user,
        data=question_in,
    )


@router.get(
    "/diligence/{startup_id}/ama/questions",
    response_model=List[AMAQuestionResponse],
)
async def list_ama_questions(
    startup_id: str,
    category: Optional[str] = Query(None, description="Filter by category (TEAM, PRODUCT, TRACTION, SHARIA, FINANCIALS)"),
):
    """
    List all community AMA questions and founder replies for a startup,
    ranked by community upvotes.
    """
    return await diligence_service.list_ama_questions(
        startup_id=startup_id,
        category=category,
    )


@router.post(
    "/diligence/ama/questions/{question_id}/answer",
    response_model=AMAQuestionResponse,
)
async def answer_ama_question(
    question_id: str,
    answer_in: AMAAnswerCreateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Founder or authorized executive answers an AMA question with text or audio note.
    """
    return await diligence_service.answer_ama_question(
        question_id=question_id,
        user=current_user,
        data=answer_in,
    )


@router.post(
    "/diligence/ama/questions/{question_id}/upvote",
    response_model=AMAQuestionResponse,
)
async def upvote_ama_question(
    question_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Upvote an AMA question to boost visibility and prioritize founder response.
    """
    return await diligence_service.upvote_ama_question(question_id=question_id)


# =============================================================================
# 4. FACTGUARD AI VIDEO PITCH AUDITING
# =============================================================================

@router.post(
    "/diligence/{startup_id}/factguard/audit",
    response_model=FactGuardAuditResponse,
)
async def audit_pitch_with_factguard(
    startup_id: str,
    audit_in: FactGuardAuditRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Trigger FactGuard AI multimodal audit on video pitch reel transcript.
    Extracts quantitative metrics (revenue, customer count, label claims, patent claims)
    and cross-references them against Algerian official registries (CNRC, INAPI, Decree 20-254).
    Outputs verification badges: GREEN_VERIFIED, AMBER_CONTEXT, or RED_UNVERIFIED.
    """
    return await diligence_service.run_factguard_audit(
        startup_id=startup_id,
        data=audit_in,
    )


@router.get(
    "/diligence/{startup_id}/factguard/status",
    response_model=FactGuardAuditResponse,
)
async def get_factguard_status(startup_id: str):
    """
    Retrieve latest FactGuard AI audit report, verified badges, and video overlay timestamps for a startup.
    """
    return await diligence_service.get_factguard_status(startup_id=startup_id)


# =============================================================================
# 5. FORENSIC FINANCIAL AUDIT & CONFLICT GRAPH
# =============================================================================

@router.post(
    "/diligence/{startup_id}/forensic-audit",
    response_model=ForensicAuditResponse,
)
async def run_forensic_audit(
    startup_id: str,
    audit_in: ForensicAuditRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Run forensic financial anomaly detection:
    - Benford's Law First-Digit conformity test (Chi-Square & p-value) on revenue/expense items
    - Graph-based conflict of interest and related-party transaction detector
    """
    return await diligence_service.run_forensic_audit(
        startup_id=startup_id,
        data=audit_in,
    )


@router.get(
    "/diligence/{startup_id}/conflict-graph",
    response_model=ConflictGraphResponse,
)
async def get_conflict_graph(
    startup_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Retrieve knowledge graph representation of corporate interlocks, family ties, and vendor transactions.
    """
    return await diligence_service.get_conflict_graph(startup_id=startup_id)


# =============================================================================
# 6. AUTOMATED DUE DILIGENCE MEMORANDUM (DDM)
# =============================================================================

@router.get(
    "/diligence/{startup_id}/ddm",
    response_model=DDMResponse,
)
async def get_due_diligence_memorandum(
    startup_id: str,
    format: str = Query("json", pattern="^(json|markdown)$"),
):
    """
    Generate institutional Due Diligence Memorandum (DDM) adhering to Sequoia / Y Combinator standards.
    Returns structured JSON with all 8 diligence sections and Red Flag Matrix,
    or rendered Markdown report.
    """
    from fastapi.responses import PlainTextResponse
    ddm = await diligence_service.generate_ddm(startup_id=startup_id)
    if format == "markdown":
        return PlainTextResponse(content=ddm.markdownReport or "", media_type="text/markdown")
    return ddm
