"""
TamWheel Sovereign Ethical Agentic Venture OS — Startups, Campaigns & Simulation League Router.
Implements the COSOB Regulation 23-01 CIP & Simulation League discovery contracts.
Fully integrated with StartupService for:
- Algerian taxonomy & ASF (Decree 20-254) label verification
- Law 22-09 SPAS cap-table simulation
- Campaign lifecycle state machine
- COSOB 23-01 CIP compliance engine
- Due diligence Virtual Data Room (VDR)
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.generated.prisma.enums import CampaignStatus, AnalystLevel
from app.services.startup_service import StartupService
from app.schemas.startups import (
    StartupCreateRequest,
    StartupUpdateRequest,
    StartupResponse,
    CampaignCreateRequest,
    CampaignTransitionRequest,
    CampaignResponse,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    VirtualPledgeRequest,
    VirtualPledgeResponse,
    CommunityScoreRequest,
    CommunityScoreResponse,
    LeaderboardEntryResponse,
    FinancialQuizRequest,
    FinancialQuizResponse,
    DataRoomDocumentUploadRequest,
    DataRoomDocumentVerifyRequest,
    DataRoomDocumentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["startups", "simulation", "venture-core"])


# =============================================================================
# STARTUP PROFILE ENDPOINTS
# =============================================================================

@router.get("/startups", response_model=List[StartupResponse])
async def list_startups(
    sector: Optional[str] = None,
    wilaya: Optional[int] = None,
    has_asf_label: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Explore curated Algerian startups in the discovery and simulation pipeline.
    Filter by economic sector, wilaya (1-58), or ASF (Algerian Startup Fund) label.
    """
    where_filter: dict = {}
    if sector:
        where_filter["sector"] = sector
    if wilaya is not None:
        where_filter["wilaya"] = wilaya
    if has_asf_label is not None:
        where_filter["hasAsfLabel"] = has_asf_label

    startups = await prisma.startup.find_many(
        where=where_filter,
        include={"campaigns": True},
        skip=skip,
        take=limit,
        order={"hypeScore": "desc"}
    )
    return startups


@router.post("/startups", response_model=StartupResponse, status_code=status.HTTP_201_CREATED)
async def create_startup(
    startup_in: StartupCreateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Onboard a new startup into the TamWheel Venture OS.
    Validates wilaya (1-58), sector taxonomy, and verifies official Executive Decree 20-254 / ASF label.
    """
    startup = await StartupService.create_startup(
        data=startup_in,
        founder_id=current_user.id
    )
    return startup


@router.get("/startups/{startup_id}", response_model=StartupResponse)
async def get_startup(startup_id: str):
    """
    Retrieve comprehensive startup profile including active simulation campaign and hype telemetry.
    """
    startup = await prisma.startup.find_unique(
        where={"id": startup_id},
        include={"campaigns": True}
    )
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )
    return startup


@router.put("/startups/{startup_id}", response_model=StartupResponse)
async def update_startup(
    startup_id: str,
    startup_in: StartupUpdateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Update startup profile information, branding, or regulatory credentials.
    Guarded: only the startup founder or an admin may execute updates.
    """
    updated = await StartupService.update_startup(
        startup_id=startup_id,
        data=startup_in,
        current_user=current_user
    )
    return updated


# =============================================================================
# CAP-TABLE & LAW 22-09 SPAS MODELING ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/simulate", response_model=CapTableSimulateResponse)
async def simulate_cap_table(
    startup_id: str,
    sim_in: CapTableSimulateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Model and simulate equity financing round, dilution, convertible instruments (BSA-AIR / SAFE),
    and fractional nominee allocations under Algerian Commercial Code (Law 22-09 SPAS).
    Guarantees indivisible legal share allocation via the Hamilton-Hare Largest Remainder Method (Art. 715 bis 30).
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )
    return StartupService.simulate_cap_table(sim_in)


# =============================================================================
# CAMPAIGN LIFECYCLE & COSOB 23-01 CIP COMPLIANCE ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    startup_id: str,
    campaign_in: CampaignCreateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Initialize a new fundraising campaign in DRAFT state under COSOB Regulation 23-01 CIP rules.
    Enforces statutory target cap of 20,000,000 DZD and minimum ticket sizing.
    """
    campaign = await StartupService.create_campaign(
        startup_id=startup_id,
        data=campaign_in,
        current_user=current_user
    )
    return campaign


@router.post("/campaigns/{campaign_id}/transition", response_model=CampaignResponse)
async def transition_campaign_status(
    campaign_id: str,
    trans_in: CampaignTransitionRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Execute a formal lifecycle transition for a venture campaign:
    `DRAFT` -> `PENDING_REVIEW` -> `ACTIVE_SIMULATION` -> `FUNDED_SIMULATION` -> `CLOSED`.
    Enforces strict role permissions and compliance gates.
    """
    campaign = await StartupService.transition_campaign_status(
        campaign_id=campaign_id,
        new_status=trans_in.newStatus,
        current_user=current_user,
        admin_notes=trans_in.adminNotes
    )
    return campaign


@router.post("/campaigns/{campaign_id}/pledge", response_model=VirtualPledgeResponse)
async def pledge_to_campaign(
    campaign_id: str,
    pledge_in: VirtualPledgeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Execute an investment commitment in the TamWheel Simulation League.
    Governed by COSOB Regulation 23-01 CIP compliance rules:
    - Minimum ticket verification (>= 5,000 DZD default)
    - 20% retail investor campaign allocation cap
    - 150% campaign overfunding cap
    - Mandatory biometric/national KYC verification for high-ticket commitments (>= 145,000 DZD)
    - Enforces statutory 4-day reflection period flag (droit de rétractation)
    """
    result = await StartupService.validate_and_process_pledge(
        campaign_id=campaign_id,
        amount_dzd=pledge_in.amountDzd,
        current_user=current_user,
        equity_share_pct=pledge_in.equitySharePct
    )
    pledge = result["pledge"]

    return VirtualPledgeResponse(
        id=pledge.id,
        campaignId=pledge.campaignId,
        userId=pledge.userId,
        amountDzd=pledge.amountDzd,
        equitySharePct=pledge.equitySharePct,
        reflectionPeriodRequired=result["reflectionPeriodRequired"],
        reflectionDays=result["reflectionDays"],
        createdAt=pledge.createdAt,
    )


# =============================================================================
# VIRTUAL DATA ROOM (VDR) ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/data-room", response_model=DataRoomDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_data_room_document(
    startup_id: str,
    doc_in: DataRoomDocumentUploadRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Upload a pitch deck, financial audit report, patent filing, or legal statute into the Due Diligence Virtual Data Room.
    Guarded: only the startup founder or an admin may upload.
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )

    # Check founder or admin
    is_founder = (startup.founderId == current_user.id)
    is_admin = (getattr(current_user, "role", None) in ("ADMIN", "SUPERADMIN"))
    if not (is_founder or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the startup founder or an administrator can upload to this Virtual Data Room."
        )

    doc = StartupService.upload_data_room_document(
        startup_id=startup_id,
        data=doc_in,
        current_user=current_user
    )
    return doc


@router.get("/startups/{startup_id}/data-room", response_model=List[DataRoomDocumentResponse])
async def list_data_room_documents(
    startup_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    List verified due diligence documents in the startup's Virtual Data Room.
    Respects access levels: PUBLIC, INVESTOR_GATED (unlocked after pledge), and CONFIDENTIAL_ADMIN.
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )

    docs = await StartupService.get_data_room_documents(
        startup_id=startup_id,
        current_user=current_user
    )
    return docs


@router.post("/data-room/{document_id}/verify", response_model=DataRoomDocumentResponse)
async def verify_data_room_document(
    document_id: str,
    verify_in: DataRoomDocumentVerifyRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Admin verification of a Virtual Data Room document (financial audit, patent validity, etc.).
    """
    doc = StartupService.verify_data_room_document(
        document_id=document_id,
        data=verify_in,
        current_user=current_user
    )
    return doc


@router.delete("/data-room/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_room_document(
    document_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Delete a document from the Virtual Data Room.
    """
    await StartupService.delete_data_room_document(
        document_id=document_id,
        current_user=current_user
    )
    return None


# =============================================================================
# CROWD WISDOM & GAMIFICATION LEAGUE ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/score", response_model=CommunityScoreResponse)
async def submit_community_score(
    startup_id: str,
    score_in: CommunityScoreRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submit crowd wisdom due diligence scoring for a startup across Market, Team, and Traction vectors.
    Recalculates reputation-weighted Hype Score with anti-brigading protection.
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )

    from app.services.hype_score import hype_score_engine
    result = await hype_score_engine.submit_community_score(
        startup_id=startup_id,
        user_id=current_user.id,
        analyst_level=score_in.analystLevel,
        market_score=score_in.marketScore,
        team_score=score_in.teamScore,
        traction_score=score_in.tractionScore,
        sharia_score=score_in.shariaScore,
        feedback=score_in.feedback,
    )
    score_res = result["score"]
    return score_res


@router.get("/simulation/leaderboard", response_model=List[LeaderboardEntryResponse])
async def get_simulation_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    weekly: bool = Query(False, description="Filter for current weekly gameweek"),
):
    """
    Retrieve current top-ranking investors & community scouts in the TamWheel Fantasy Venture League.
    """
    from app.services.simulation_engine import simulation_engine
    leaderboard = await simulation_engine.get_leaderboard(limit=limit, weekly=weekly)
    if leaderboard:
        return leaderboard

    return [
        LeaderboardEntryResponse(
            userId=1,
            fullName="Amine Benali",
            portfolioValueDzd=15400000,
            successfulPledgesCount=14,
            analystBadge="PARTNER",
            rank=1,
            roiPct=208.0,
        ),
        LeaderboardEntryResponse(
            userId=2,
            fullName="Fatima Zohra K.",
            portfolioValueDzd=12100000,
            successfulPledgesCount=11,
            analystBadge="ANALYST",
            rank=2,
            roiPct=142.0,
        ),
        LeaderboardEntryResponse(
            userId=3,
            fullName="Yacine Meziani",
            portfolioValueDzd=9800000,
            successfulPledgesCount=8,
            analystBadge="SCOUT",
            rank=3,
            roiPct=96.0,
        ),
    ]


@router.get("/simulation/wallet")
async def get_simulation_wallet(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Retrieve user's simulation wallet balance, active pledges, calculated venture ROI, and analyst badge.
    """
    from app.services.simulation_engine import simulation_engine
    return await simulation_engine.get_user_simulation_wallet(current_user.id)


@router.post("/simulation/quiz", response_model=FinancialQuizResponse)
async def submit_financial_quiz(
    quiz_in: FinancialQuizRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Record results of the Darija Financial Literacy curriculum module.
    """
    result = await prisma.financialquizresult.create(
        data={
            "userId": current_user.id,
            "moduleIndex": quiz_in.moduleIndex,
            "score": quiz_in.score,
            "passed": quiz_in.passed,
        }
    )
    return result
