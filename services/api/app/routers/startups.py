"""
TamWheel Sovereign Ethical Agentic Venture OS — Startups, Campaigns & Simulation League Router.
Implements the COSOB Regulation 23-01 CIP & Simulation League discovery contracts.
"""

import logging
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.generated.prisma.enums import CampaignStatus, AnalystLevel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["startups", "simulation"])


# =============================================================================
# SCHEMAS
# =============================================================================

class CampaignResponse(BaseModel):
    id: str
    startupId: str
    targetAmountDzd: int
    raisedAmountDzd: int
    minTicketDzd: int
    status: CampaignStatus
    startDate: datetime
    endDate: datetime


class StartupResponse(BaseModel):
    id: str
    name: str
    tagline: str
    description: str
    logoUrl: Optional[str] = None
    pitchDeckUrl: Optional[str] = None
    videoPitchUrl: Optional[str] = None
    founderId: int
    wilaya: int
    sector: str
    hasAsfLabel: bool
    hypeScore: float
    createdAt: datetime
    updatedAt: datetime
    campaigns: Optional[List[CampaignResponse]] = None


class VirtualPledgeRequest(BaseModel):
    amountDzd: int = Field(..., ge=1000, description="Virtual DZD amount to pledge")
    equitySharePct: Optional[float] = None


class VirtualPledgeResponse(BaseModel):
    id: str
    campaignId: str
    userId: int
    amountDzd: int
    equitySharePct: Optional[float] = None
    createdAt: datetime


class CommunityScoreRequest(BaseModel):
    analystLevel: AnalystLevel = AnalystLevel.NOVICE
    marketScore: int = Field(..., ge=1, le=10)
    teamScore: int = Field(..., ge=1, le=10)
    tractionScore: int = Field(..., ge=1, le=10)
    feedback: Optional[str] = None


class CommunityScoreResponse(BaseModel):
    id: str
    startupId: str
    userId: int
    analystLevel: AnalystLevel
    marketScore: int
    teamScore: int
    tractionScore: int
    feedback: Optional[str] = None
    createdAt: datetime


class LeaderboardEntryResponse(BaseModel):
    userId: int
    fullName: str
    portfolioValueDzd: int
    successfulPledgesCount: int
    analystBadge: str
    rank: int


class FinancialQuizRequest(BaseModel):
    moduleIndex: int
    score: int = Field(..., ge=0, le=100)
    passed: bool


class FinancialQuizResponse(BaseModel):
    id: str
    userId: int
    moduleIndex: int
    score: int
    passed: bool
    completedAt: datetime


# =============================================================================
# ENDPOINTS
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


@router.post("/campaigns/{campaign_id}/pledge", response_model=VirtualPledgeResponse)
async def pledge_to_campaign(
    campaign_id: str,
    pledge_in: VirtualPledgeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Execute a virtual investment pledge in the TamWheel Simulation League.
    Simulates equity crowdfunding commitments under COSOB 23-01 CIP compliance rules.
    """
    campaign = await prisma.campaign.find_unique(where={"id": campaign_id})
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )

    if campaign.status != CampaignStatus.ACTIVE_SIMULATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign is not currently accepting simulation pledges"
        )

    if pledge_in.amountDzd < campaign.minTicketDzd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum ticket size is {campaign.minTicketDzd} DZD"
        )

    # Record pledge
    pledge = await prisma.virtualpledge.create(
        data={
            "campaignId": campaign_id,
            "userId": current_user.id,
            "amountDzd": pledge_in.amountDzd,
            "equitySharePct": pledge_in.equitySharePct,
        }
    )

    # Increment campaign raised volume
    await prisma.campaign.update(
        where={"id": campaign_id},
        data={"raisedAmountDzd": {"increment": pledge_in.amountDzd}}
    )

    return pledge


@router.post("/startups/{startup_id}/score", response_model=CommunityScoreResponse)
async def submit_community_score(
    startup_id: str,
    score_in: CommunityScoreRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submit crowd wisdom due diligence scoring for a startup across Market, Team, and Traction vectors.
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found"
        )

    score = await prisma.communityscore.upsert(
        where={
            "startupId_userId": {
                "startupId": startup_id,
                "userId": current_user.id,
            }
        },
        data={
            "create": {
                "startupId": startup_id,
                "userId": current_user.id,
                "analystLevel": score_in.analystLevel,
                "marketScore": score_in.marketScore,
                "teamScore": score_in.teamScore,
                "tractionScore": score_in.tractionScore,
                "feedback": score_in.feedback,
            },
            "update": {
                "analystLevel": score_in.analystLevel,
                "marketScore": score_in.marketScore,
                "teamScore": score_in.teamScore,
                "tractionScore": score_in.tractionScore,
                "feedback": score_in.feedback,
            }
        }
    )
    return score


@router.get("/simulation/leaderboard", response_model=List[LeaderboardEntryResponse])
async def get_simulation_leaderboard():
    """
    Retrieve current top-ranking investors & community scouts in the TamWheel Fantasy Venture League.
    """
    # Sample leaderboard aggregation for contract spec
    return [
        LeaderboardEntryResponse(
            userId=1,
            fullName="Amine Benali",
            portfolioValueDzd=15400000,
            successfulPledgesCount=14,
            analystBadge="PARTNER",
            rank=1,
        ),
        LeaderboardEntryResponse(
            userId=2,
            fullName="Fatima Zohra K.",
            portfolioValueDzd=12100000,
            successfulPledgesCount=11,
            analystBadge="ANALYST",
            rank=2,
        ),
        LeaderboardEntryResponse(
            userId=3,
            fullName="Yacine Meziani",
            portfolioValueDzd=9800000,
            successfulPledgesCount=8,
            analystBadge="SCOUT",
            rank=3,
        ),
    ]


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
