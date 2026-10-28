"""
TamWheel Sovereign Ethical Agentic Venture OS — Viral Growth & Brag Engine Router.
Sections 13.4 & 14: High-Status Viral Loops, Multiplayer Growth, and Collective Wilaya Milestones (K=1.48).

Endpoints:
1. `GET /viral/brag-card`: Generate visual brag card metadata (1.91:1 or 9:16) with localized Darija/Arabic/French texts.
2. `GET /viral/k-factor`: Mathematical viral coefficient breakdown (K = 1.48) and exponential growth simulations.
3. `GET /viral/vip-status`: User's VIP 48-Hour Early Access Window qualification status.
4. `POST /viral/referral`: Track and log a user referral with verification.
5. `GET /viral/milestones`: List Wilaya collective milestone grant challenges and progress.
6. `POST /viral/milestones`: Create a new Wilaya collective milestone challenge.
7. `POST /viral/milestones/contribute`: Record a backer commitment towards a Wilaya milestone grant.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.viral_engine import (
    viral_growth_engine,
    BragCardMetadata,
    ViralKFactorModel,
    VipStatusResult,
    WilayaMilestone,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/viral", tags=["Viral Growth & Brag Engine"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class ReferralRecordRequest(BaseModel):
    refereeId: int = Field(..., description="Referred new user ID")
    isVerified: Optional[bool] = Field(True, description="Whether referee has completed KYC/Quiz or committed")


class WilayaMilestoneCreateRequest(BaseModel):
    startupId: str = Field(..., description="Target Startup ID")
    startupName: str = Field(..., description="Startup display name")
    wilayaCode: int = Field(..., ge=1, le=58, description="Target Algerian Wilaya (1-58)")
    targetBackersCount: int = Field(..., ge=5, description="Required backers count to trigger grant")
    grantAmountDzd: int = Field(..., ge=50000, description="Non-dilutive grant award in DZD")
    sponsorName: str = Field(..., description="Sponsor or angel syndicate name funding the grant")


class WilayaMilestoneContributeRequest(BaseModel):
    milestoneId: str = Field(..., description="Target Wilaya Milestone ID")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get(
    "/brag-card",
    response_model=BragCardMetadata,
    summary="Generate high-status visual brag card metadata",
)
async def get_brag_card(
    cardType: str = Query("FOUNDING_BACKER", description="FOUNDING_BACKER | INVESTMENT_THESIS | FANTASY_CHAMPION | WILAYA_PATRIOT"),
    aspectRatio: str = Query("1.91:1", description="1.91:1 (Landscape) or 9:16 (Vertical)"),
    startupName: str = Query("GreenFarm AI", description="Startup name for backer card"),
    startupId: str = Query("startup-greenfarm", description="Startup UUID or slug"),
    wilayaCode: int = Query(16, ge=1, le=58, description="Wilaya code (1-58)"),
    amountDzd: int = Query(10000, ge=1000, description="Virtual commitment in DZD"),
    fantasyRank: int = Query(4, ge=1, description="Fantasy leaderboard rank"),
    fantasySp: int = Query(850, ge=0, description="Fantasy score in SP"),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Generates tailored brag card metadata:
    - 1.91:1 (1200x628) for LinkedIn & Twitter/X feed posts.
    - 9:16 (1080x1920) for Instagram Stories, TikTok & WhatsApp Status.
    - Localized vernacular copy in Algerian Darija, Standard Arabic, French, and English.
    - Embedded deep-link URL with referral code and QR code data payload.
    """
    user_name = getattr(current_user, "fullName", "Amine Mansouri")
    user_tier = getattr(current_user, "analystTier", "SCOUT")

    return viral_growth_engine.generate_brag_card(
        user_id=current_user.id,
        user_name=user_name,
        card_type=cardType,
        aspect_ratio=aspectRatio,
        startup_name=startupName,
        startup_id=startupId,
        wilaya_code=wilayaCode,
        user_tier=user_tier,
        amount_dzd=amountDzd,
        fantasy_rank=fantasyRank,
        fantasy_sp=fantasySp,
    )


@router.get(
    "/k-factor",
    response_model=ViralKFactorModel,
    summary="Get mathematical viral coefficient (K = 1.48) breakdown and projections",
)
async def get_k_factor_model(
    initialUsers: int = Query(1000, ge=10, le=1000000, description="Baseline user population"),
    cycles: int = Query(5, ge=1, le=20, description="Number of viral compounding cycles"),
):
    """
    Returns the analytical breakdown of TamWheel's viral coefficient:
    K = K_thesis (0.42) + K_squad (0.58) + K_fantasy (0.36) + K_wilaya (0.12) = 1.48.
    Includes exponential compounding projections across viral cycles.
    """
    return viral_growth_engine.calculate_k_factor_model(
        initial_users=initialUsers,
        cycles=cycles,
    )


@router.get(
    "/vip-status",
    response_model=VipStatusResult,
    summary="Get user VIP 48-Hour Early Access Window status",
)
async def get_vip_status(
    current_user: Any = Depends(get_current_active_user),
):
    """
    Retrieves the user's referral progress towards unlocking the priority 48-Hour
    Early Access Allocation Window (requires >= 3 verified analyst referrals).
    """
    return viral_growth_engine.get_vip_status(current_user.id)


@router.post(
    "/referral",
    summary="Record and verify a user referral",
)
async def record_user_referral(
    req: ReferralRecordRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Logs a referral for the current authenticated user as the referrer.
    Updates the referral graph and evaluates VIP 48-hour access qualification.
    """
    return viral_growth_engine.record_referral(
        referrer_id=current_user.id,
        referee_id=req.refereeId,
        is_verified=req.isVerified if req.isVerified is not None else True,
    )


@router.get(
    "/milestones",
    response_model=List[WilayaMilestone],
    summary="List active and achieved Wilaya collective milestone grant challenges",
)
async def list_wilaya_milestones(
    wilayaCode: Optional[int] = Query(None, ge=1, le=58, description="Filter by Wilaya code"),
):
    """
    Returns collective regional challenges:
    'If 50 backers from Sétif back X, unlock 500k DZD non-dilutive grant'.
    """
    return viral_growth_engine.list_wilaya_milestones(wilaya_code=wilayaCode)


@router.post(
    "/milestones",
    response_model=WilayaMilestone,
    summary="Create a new Wilaya collective milestone challenge",
)
async def create_wilaya_milestone(
    req: WilayaMilestoneCreateRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """Creates a new collective Wilaya milestone challenge sponsored by angels or institutions."""
    return viral_growth_engine.create_wilaya_milestone(
        startup_id=req.startupId,
        startup_name=req.startupName,
        wilaya_code=req.wilayaCode,
        target_backers_count=req.targetBackersCount,
        grant_amount_dzd=req.grantAmountDzd,
        sponsor_name=req.sponsorName,
    )


@router.post(
    "/milestones/contribute",
    summary="Record backer backing towards a Wilaya collective milestone grant",
)
async def contribute_to_wilaya_milestone(
    req: WilayaMilestoneContributeRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Registers the current user's backing towards a Wilaya milestone.
    Automatically triggers grant unlock if the target backer threshold is achieved!
    """
    return viral_growth_engine.record_wilaya_backing(
        milestone_id=req.milestoneId,
        user_id=current_user.id,
    )
