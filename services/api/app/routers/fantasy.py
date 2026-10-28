"""
TamWheel Sovereign Ethical Agentic Venture OS — Fantasy Startup League (FSL) Router.
Pillar 2: Fantasy Venture Tournament & Real-World KPI Scoring Endpoints.

Implements:
1. `GET /fantasy/seasons`: 12-week tournament cycle seasons.
2. `GET /fantasy/seasons/active`: Current active season and gameweek deadline.
3. `GET /fantasy/catalog`: Draftable startups catalog with SP salary cap prices and valuations.
4. `POST /fantasy/roster`: Build/update 5-startup roster (100k SP cap, >= 3 sectors, Captain x1.5, Wildcard x2.0).
5. `GET /fantasy/roster`: User's gameweek roster and score breakdown.
6. `POST /fantasy/events/trigger`: Real-world scoring event triggers (+50 hire, +100 ARR, +150 label, +75 TV pitch, -50 bubble).
7. `GET /fantasy/events`: List scoring events.
8. `GET /fantasy/leaderboard`: Global season and gameweek standings.
9. `POST /fantasy/mini-leagues`: Create private mini-league (University, Regional, Diaspora, Corporate).
10. `POST /fantasy/mini-leagues/join`: Join private mini-league via invite code.
11. `GET /fantasy/mini-leagues`: List user's joined mini-leagues.
12. `GET /fantasy/mini-leagues/{league_id}`: Mini-league standings and member ranks.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user, get_current_user_optional
from app.services.fantasy_league import (
    fantasy_league_engine,
    SALARY_CAP_SP,
    ROSTER_SIZE,
    KPI_SCORING_SCHEDULE,
    UserGameweekRoster,
    TournamentSeason,
    MiniLeague,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fantasy", tags=["Fantasy Startup League"])


# =============================================================================
# REQUEST & RESPONSE SCHEMAS
# =============================================================================

class RosterBuildRequest(BaseModel):
    seasonId: Optional[str] = Field(None, description="Season ID (defaults to active season)")
    gameweek: Optional[int] = Field(None, ge=1, le=12, description="Target gameweek (1-12)")
    captainStartupId: str = Field(..., description="Designated Captain (1.5x multiplier)")
    wildcardStartupId: str = Field(..., description="Designated Wildcard (2.0x if valuation < 30M DZD)")
    coreStartupIds: List[str] = Field(..., min_length=3, max_length=3, description="3 Core Startups (1.0x each)")


class EventTriggerRequest(BaseModel):
    startupId: str = Field(..., description="Target Startup ID")
    eventType: str = Field(..., description="Trigger type: TECH_HIRE, ARR_GROWTH_20, STARTUP_LABEL, TV_PITCH_WINNER, NARRATIVE_BUBBLE, etc.")
    gameweek: int = Field(..., ge=1, le=12, description="Gameweek index (1-12)")
    description: Optional[str] = Field(None, description="Event description or headline")
    evidenceHash: Optional[str] = Field(None, description="Cryptographic SHA-256 evidence digest")


class MiniLeagueCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, description="Mini-league display name")
    category: str = Field("UNIVERSITY", description="Category: UNIVERSITY | REGIONAL | DIASPORA | CORPORATE")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")


class MiniLeagueJoinRequest(BaseModel):
    inviteCode: str = Field(..., description="Unique mini-league invite code")


class ChipActivateRequest(BaseModel):
    seasonId: Optional[str] = Field(None, description="Season ID (defaults to active season)")
    gameweek: Optional[int] = Field(None, ge=1, le=12, description="Target gameweek (1-12)")
    chipType: str = Field(..., description="Strategic chip: TRIPLE_CAPTAIN | SECTOR_SURGE | FREE_HIT")
    targetSector: Optional[str] = Field(None, description="Designated sector (required for SECTOR_SURGE)")


class TransferItem(BaseModel):
    startup_out_id: str = Field(..., description="Startup to transfer out")
    startup_in_id: str = Field(..., description="Startup to transfer in")


class TransferExecuteRequest(BaseModel):
    seasonId: Optional[str] = Field(None, description="Season ID (defaults to active season)")
    gameweek: Optional[int] = Field(None, ge=1, le=12, description="Gameweek index (1-12)")
    transfers: List[TransferItem] = Field(..., min_length=1, description="List of in/out transfer pairs")
    bypassDeadline: Optional[bool] = Field(False, description="Emergency or test override for deadline lock")


class PriceRebalanceRequest(BaseModel):
    threshold: Optional[int] = Field(5, ge=1, description="Net transfer threshold triggering price delta")
    priceStepSp: Optional[int] = Field(500, ge=100, le=5000, description="Price step adjustment in SP")


# =============================================================================
# TOURNAMENT SEASONS & CATALOG ENDPOINTS
# =============================================================================

@router.get("/seasons", response_model=List[TournamentSeason], summary="List all tournament seasons")
async def list_seasons():
    """List 12-week tournament cycles matching televised pitch show seasons."""
    return fantasy_league_engine.list_seasons()


@router.get("/seasons/active", response_model=TournamentSeason, summary="Get active tournament season")
async def get_active_season():
    """Returns the currently active 12-week tournament season and gameweek."""
    return fantasy_league_engine.get_active_season()


@router.get("/catalog", summary="List draftable startups in fantasy catalog")
async def list_fantasy_catalog():
    """
    Returns draftable startups catalog with fantasy salary cap prices (in SP),
    official valuation, sectors, and hype scores.
    """
    startups = fantasy_league_engine.list_catalog()
    return {
        "salaryCapSp": SALARY_CAP_SP,
        "rosterSize": ROSTER_SIZE,
        "catalog": [getattr(s, "model_dump", s.dict)() for s in startups],
    }


# =============================================================================
# ROSTER MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/roster", response_model=UserGameweekRoster, summary="Build or update 5-startup fantasy roster")
async def submit_roster(
    req: RosterBuildRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Validates and submits user's 5-startup fantasy team roster.
    Rules:
    - Exactly 5 startups across >= 3 distinct industry sectors.
    - Salary cap budget: total SP spent <= 100,000 SP.
    - Roles: Captain (1.5x), Wildcard (2.0x if valuation < 30M DZD), 3 Core (1.0x).
    """
    active_season = fantasy_league_engine.get_active_season()
    season_id = req.seasonId or active_season.season_id
    gameweek = req.gameweek or active_season.current_gameweek

    return fantasy_league_engine.build_team_roster(
        user_id=current_user.id,
        season_id=season_id,
        gameweek=gameweek,
        captain_startup_id=req.captainStartupId,
        wildcard_startup_id=req.wildcardStartupId,
        core_startup_ids=req.coreStartupIds,
    )


@router.get("/roster", summary="Get user's current fantasy roster and score")
async def get_my_roster(
    seasonId: Optional[str] = Query(None),
    gameweek: Optional[int] = Query(None, ge=1, le=12),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Retrieves user's submitted roster for the active gameweek, including
    assigned multipliers and real-time points.
    """
    active_season = fantasy_league_engine.get_active_season()
    target_season = seasonId or active_season.season_id
    target_gw = gameweek or active_season.current_gameweek

    roster = fantasy_league_engine.get_user_roster(
        user_id=current_user.id,
        season_id=target_season,
        gameweek=target_gw,
    )
    if not roster:
        return {
            "rosterSubmitted": False,
            "seasonId": target_season,
            "gameweek": target_gw,
            "message": "No roster submitted for this gameweek yet. Build your 5-startup team to participate.",
        }

    return {
        "rosterSubmitted": True,
        "roster": getattr(roster, "model_dump", roster.dict)(),
    }


# =============================================================================
# REAL-WORLD KPI SCORING TRIGGERS (TELEMETRY & ORACLE)
# =============================================================================

@router.post("/events/trigger", summary="Trigger verified real-world scoring event")
async def trigger_kpi_event(
    req: EventTriggerRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Records an authenticated real-world scoring trigger for a startup:
    - TECH_HIRE: +50 pts (Verified senior tech hire)
    - ARR_GROWTH_20: +100 pts (MoM ARR growth >= 20%)
    - STARTUP_LABEL: +150 pts (Official Startup Label awarded under Decree 20-254)
    - TV_PITCH_WINNER: +75 pts (TV Judge Pitch of the Week)
    - NARRATIVE_BUBBLE: -50 pts (Narrative Bubble warning)
    Automatically propagates points to all manager rosters holding the startup!
    """
    event = fantasy_league_engine.trigger_real_world_event(
        startup_id=req.startupId,
        event_type=req.eventType,
        gameweek=req.gameweek,
        description=req.description,
        evidence_hash=req.evidenceHash,
    )
    return {
        "success": True,
        "event": getattr(event, "model_dump", event.dict)(),
        "scoringSchedule": KPI_SCORING_SCHEDULE.get(req.eventType),
    }


@router.get("/events", summary="List real-world KPI scoring events")
async def list_kpi_events(
    gameweek: Optional[int] = Query(None, ge=1, le=12),
):
    """Lists verified real-world events recorded by oracles."""
    events = fantasy_league_engine.list_events(gameweek=gameweek)
    return {
        "count": len(events),
        "gameweek": gameweek,
        "events": [getattr(e, "model_dump", e.dict)() for e in events],
    }


@router.get("/scoring-schedule", summary="Get KPI scoring point matrix")
async def get_scoring_schedule():
    """Returns the official real-world KPI scoring matrix and point schedule."""
    return KPI_SCORING_SCHEDULE


# =============================================================================
# LEADERBOARD ENDPOINTS
# =============================================================================

@router.get("/leaderboard", summary="Global Fantasy Startup League leaderboard")
async def get_fantasy_leaderboard(
    seasonId: Optional[str] = Query(None),
    gameweek: Optional[int] = Query(None, ge=1, le=12),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Returns global leaderboard rankings for Fantasy Startup League.
    Filterable by season or specific gameweek.
    """
    return fantasy_league_engine.get_global_leaderboard(
        season_id=seasonId,
        gameweek=gameweek,
        limit=limit,
    )


# =============================================================================
# PRIVATE MINI-LEAGUES (University, Regional, Diaspora, Corporate)
# =============================================================================

@router.post("/mini-leagues", response_model=MiniLeague, summary="Create private mini-league")
async def create_mini_league(
    req: MiniLeagueCreateRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Creates a private mini-league (University, Regional, Diaspora, or Corporate)
    and generates a shareable invite code.
    """
    return fantasy_league_engine.create_mini_league(
        name=req.name,
        category=req.category,
        description=req.description,
        owner_user_id=current_user.id,
    )


@router.post("/mini-leagues/join", response_model=MiniLeague, summary="Join private mini-league via invite code")
async def join_mini_league(
    req: MiniLeagueJoinRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """Joins a private mini-league using its unique invite code."""
    return fantasy_league_engine.join_mini_league(
        invite_code=req.inviteCode,
        user_id=current_user.id,
    )


@router.get("/mini-leagues", response_model=List[MiniLeague], summary="List user's private mini-leagues")
async def get_user_mini_leagues(
    current_user: Any = Depends(get_current_active_user),
):
    """Lists all private mini-leagues the current user is a member of."""
    return fantasy_league_engine.get_user_mini_leagues(current_user.id)


@router.get("/mini-leagues/{league_id}", summary="Get mini-league details and standings")
async def get_mini_league_details(
    league_id: str,
    gameweek: Optional[int] = Query(None, ge=1, le=12),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Retrieves mini-league details and ranked member standings for the season or gameweek.
    """
    return fantasy_league_engine.get_mini_league_standings(
        league_id=league_id,
        gameweek=gameweek,
    )


# =============================================================================
# STRATEGIC CHIPS & TRANSFER MARKET ENDPOINTS
# =============================================================================

@router.post("/chips/activate", summary="Activate a strategic chip for the gameweek")
async def activate_chip(
    req: ChipActivateRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Activates a strategic chip:
    - TRIPLE_CAPTAIN: 3.0x multiplier on Captain points.
    - SECTOR_SURGE: +50% bonus points on all startups in designated sector.
    - FREE_HIT: 1-gameweek temporary squad overhaul with zero transfer penalties and automated reversion.
    Enforces single-use per season and mutual exclusivity (max 1 chip per gameweek).
    """
    active_season = fantasy_league_engine.get_active_season()
    season_id = req.seasonId or active_season.season_id
    gameweek = req.gameweek or active_season.current_gameweek

    return fantasy_league_engine.activate_chip(
        user_id=current_user.id,
        season_id=season_id,
        gameweek=gameweek,
        chip_type=req.chipType,
        target_sector=req.targetSector,
    )


@router.get("/chips/status", summary="Get user's available and consumed chips")
async def get_chips_status(
    seasonId: Optional[str] = Query(None),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Returns strategic chip inventory: consumed chips, available chips, and banked free transfers.
    """
    active_season = fantasy_league_engine.get_active_season()
    target_season = seasonId or active_season.season_id
    return fantasy_league_engine.get_user_chips_status(
        user_id=current_user.id,
        season_id=target_season,
    )


@router.post("/transfers", summary="Execute squad transfers in transfer market")
async def execute_transfers(
    req: TransferExecuteRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes player transfers with free transfer quota (1 free per GW, banked up to 2),
    -4 SP transfer hit penalties for extra transfers, and 1-hour broadcast deadline locking.
    """
    active_season = fantasy_league_engine.get_active_season()
    season_id = req.seasonId or active_season.season_id
    gameweek = req.gameweek or active_season.current_gameweek

    transfers_dicts = [
        t.model_dump() if hasattr(t, "model_dump") else t.dict()
        for t in req.transfers
    ]

    return fantasy_league_engine.execute_transfers(
        user_id=current_user.id,
        season_id=season_id,
        gameweek=gameweek,
        transfers=transfers_dicts,
        bypass_deadline=req.bypassDeadline or False,
    )


@router.get("/market/trends", summary="Get transfer market volume and momentum trends")
async def get_market_trends():
    """
    Returns transfer market volume, net transfer momentum (transfers in - out),
    and projected price shift pressure across catalog startups.
    """
    trends = fantasy_league_engine.get_market_trends()
    return {
        "count": len(trends),
        "trends": trends,
    }


@router.post("/market/rebalance-prices", summary="Rebalance fantasy startup prices based on market momentum")
async def rebalance_prices(
    req: Optional[PriceRebalanceRequest] = None,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes market momentum price adjustments:
    Net transfers >= threshold: +price_step_sp.
    Net transfers <= -threshold: -price_step_sp.
    Prices clamped between 10,000 SP and 35,000 SP.
    """
    threshold = req.threshold if req and req.threshold is not None else 5
    price_step = req.priceStepSp if req and req.priceStepSp is not None else 500
    adjustments = fantasy_league_engine.rebalance_market_prices(
        threshold=threshold,
        price_step_sp=price_step,
    )
    return {
        "adjustmentsCount": len(adjustments),
        "adjustments": adjustments,
    }
