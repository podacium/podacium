"""
TamWheel Sovereign Ethical Agentic Venture OS — Season-End Rewards & Touiza Distribution Router.
Pillar 2 / Phase 4: Season-End Tournament Distribution, 58-Wilaya Cup, and Simulated Dividends.

Endpoints:
1. `GET /fantasy/season/leaderboard`: Top 100 Individual Analysts Touiza Leaderboard.
2. `GET /fantasy/season/wilaya-cup`: 58-Wilaya Sovereign Cup standings and prize allocation.
3. `POST /fantasy/season/dividends`: Declare and distribute simulated startup dividends.
4. `GET /fantasy/season/dividends`: List historical startup dividend declarations.
5. `POST /fantasy/season/distribute`: Execute complete season-end tournament settlement and payouts.
6. `GET /fantasy/season/report`: Get season distribution summary report.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.fsl_season_rewards import (
    season_rewards_engine,
)
from app.schemas.season_rewards import (
    AnalystSeasonStanding,
    WilayaCupStanding,
    DividendDeclarationRequest,
    DividendPayoutReceipt,
    SeasonDistributionReport,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fantasy/season", tags=["Season Rewards & Touiza Distribution"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get(
    "/leaderboard",
    response_model=List[AnalystSeasonStanding],
    summary="Top 100 Individual Analysts Touiza Leaderboard",
)
async def get_season_analysts_leaderboard(
    seasonId: Optional[str] = Query(None, description="Season ID (defaults to active season)"),
    limit: int = Query(100, ge=1, le=100, description="Rank limit (max 100)"),
):
    """
    Returns ranked standings for the season, including:
    - Gold Touiza Trophy (Rank 1): 50,000 DZD Virtual Bonus + Partner Badge
    - Silver Touiza Trophy (Rank 2-10): 25,000 DZD Virtual Bonus + Senior Analyst Badge
    - Bronze Touiza Trophy (Rank 11-50): 10,000 DZD Virtual Bonus + Analyst Badge
    - Touiza Honor Roll (Rank 51-100): 5,000 DZD Virtual Bonus + Scout Badge
    """
    return season_rewards_engine.evaluate_season_leaderboard(season_id=seasonId, limit=limit)


@router.get(
    "/wilaya-cup",
    response_model=List[WilayaCupStanding],
    summary="58-Wilaya Sovereign Cup standings and prize allocation",
)
async def get_wilaya_cup_standings(
    seasonId: Optional[str] = Query(None, description="Season ID (defaults to active season)"),
):
    """
    Returns ranked standings across all 58 Algerian Wilayas under Decree 19-12:
    - 1,000,000 DZD Touiza Grand Prize Pool awarded to the champion regional cohort.
    """
    return season_rewards_engine.evaluate_wilaya_cup(season_id=seasonId)


@router.post(
    "/dividends",
    response_model=DividendPayoutReceipt,
    summary="Declare and distribute simulated startup revenue dividends",
)
async def declare_startup_dividends(
    req: DividendDeclarationRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes automated dividend distribution for a profitable startup:
    - Finds all fantasy shareholders holding shares in the startup's AMM pool.
    - Calculates virtual dividend payout per user (shares * dividendPerShareDzd).
    - Records atomic double-entry journal entries crediting user cash balances.
    """
    return season_rewards_engine.declare_and_distribute_dividends(
        startup_id=req.startup_id,
        dividend_per_share_dzd=req.dividend_per_share_dzd,
        gmv_milestone_dzd=req.gmv_milestone_dzd,
        description=req.description,
    )


@router.get(
    "/dividends",
    response_model=List[DividendPayoutReceipt],
    summary="List historical startup dividend distributions",
)
async def list_dividend_distributions():
    """Returns all historical startup dividend declarations and payout receipts."""
    return season_rewards_engine.list_dividend_receipts()


@router.post(
    "/distribute",
    response_model=SeasonDistributionReport,
    summary="Execute comprehensive season-end tournament settlement and payouts",
)
async def distribute_season_rewards(
    seasonId: Optional[str] = Query(None, description="Target season ID"),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes complete end-of-season tournament prize distribution:
    1. Distributes Top 100 Individual Analysts Touiza bonuses.
    2. Distributes 1,000,000 DZD 58-Wilaya Sovereign Cup Grand Prize.
    3. Records cryptographic double-entry journal entries in the simulation ledger.
    """
    return season_rewards_engine.distribute_season_end_rewards(season_id=seasonId)


@router.get(
    "/report",
    response_model=SeasonDistributionReport,
    summary="Get season distribution report",
)
async def get_season_distribution_report(
    seasonId: Optional[str] = Query(None, description="Target season ID"),
):
    """Retrieves distribution report for a settled season."""
    active = season_rewards_engine.fantasy_engine.get_active_season()
    target = seasonId or active.season_id
    report = season_rewards_engine.get_season_report(target)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Season '{target}' has not been settled yet.",
        )
    return report
