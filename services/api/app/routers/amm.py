"""
TamWheel Sovereign Ethical Agentic Venture OS — Continuous Bonding Curve AMM Router.
Pillar 2 / Phase 4: Automated Algorithmic Continuous Pricing for Fantasy Shares.

Endpoints:
1. `GET /amm/pools`: List all startup continuous bonding curve liquidity pools.
2. `GET /amm/pools/{startup_id}`: Retrieve real-time AMM bonding curve pool metrics.
3. `POST /amm/quote`: Quote exact continuous calculus integral cost, execution price, and slippage.
4. `POST /amm/trade`: Execute atomic continuous curve buy or sell with anti-front-running protection.
5. `GET /amm/holdings`: Retrieve user's fantasy share portfolio across all startups.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.bonding_curve_amm import (
    bonding_curve_amm,
)
from app.schemas.amm import (
    BondingCurveQuoteRequest,
    BondingCurveQuoteResponse,
    BondingCurveTradeRequest,
    BondingCurveTradeResponse,
    PoolStateResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/amm", tags=["Bonding Curve AMM & Continuous Liquidity"])


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get(
    "/pools",
    response_model=List[PoolStateResponse],
    summary="List all AMM bonding curve liquidity pools",
)
async def list_amm_pools():
    """
    Returns real-time continuous bonding curve pool metrics for all draftable fantasy startups:
    - Circulating supply
    - Current spot price in DZD (Sim)
    - AMM reserve pool balance
    - Cumulative volume and trade count
    """
    return [
        bonding_curve_amm.get_pool_state(sid)
        for sid in bonding_curve_amm._pools.keys()
    ]


@router.get(
    "/pools/{startup_id}",
    response_model=PoolStateResponse,
    summary="Get AMM bonding curve pool state for a startup",
)
async def get_amm_pool_state(startup_id: str):
    """Retrieves real-time continuous bonding curve pool metrics for a specific startup."""
    return bonding_curve_amm.get_pool_state(startup_id)


@router.post(
    "/quote",
    response_model=BondingCurveQuoteResponse,
    summary="Quote exact integral cost and slippage on the continuous bonding curve",
)
async def get_bonding_curve_quote(req: BondingCurveQuoteRequest):
    """
    Computes exact continuous calculus integral:
    - BUY: Integral of P(s) ds from S to S + delta_shares
    - SELL: Integral of P(s) ds from S - delta_shares to S minus protocol fee
    Evaluates price impact and execution slippage.
    """
    return bonding_curve_amm.get_quote(
        startup_id=req.startup_id,
        shares_amount=req.shares_amount,
        action=req.action,
    )


@router.post(
    "/trade",
    response_model=BondingCurveTradeResponse,
    summary="Execute atomic continuous bonding curve trade (BUY or SELL)",
)
async def execute_bonding_curve_trade(
    req: BondingCurveTradeRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes an atomic trade on the continuous bonding curve:
    - Enforces slippage tolerance protection.
    - Anti-front-running delay window to mitigate sandwich attacks.
    - Settles transaction directly onto the Double-Entry Virtual Currency Ledger
      (Debit AMM Reserve / Credit User Cash on Buy, and vice versa on Sell).
    - Preserves zero-sum invariant across the sovereign sandbox.
    """
    return bonding_curve_amm.execute_trade(
        user_id=current_user.id,
        startup_id=req.startup_id,
        action=req.action,
        shares_amount=req.shares_amount,
        max_slippage_pct=req.max_slippage_pct,
        expected_avg_price=req.expected_avg_price,
    )


@router.get(
    "/holdings",
    summary="Get current user fantasy share holdings across all startups",
)
async def get_user_fantasy_holdings(
    current_user: Any = Depends(get_current_active_user),
):
    """Returns fantasy share quantities owned by the current authenticated user."""
    holdings = bonding_curve_amm.get_all_user_holdings(current_user.id)
    detailed_holdings = []
    total_val = 0

    for sid, count in holdings.items():
        pool = bonding_curve_amm.get_or_create_pool(sid)
        spot = pool.spot_price()
        est_val = int(count * spot)
        total_val += est_val
        detailed_holdings.append({
            "startupId": sid,
            "startupName": pool.startup_name,
            "sharesCount": count,
            "currentSpotPriceDzd": round(spot, 2),
            "estimatedValueDzd": est_val,
        })

    return {
        "userId": current_user.id,
        "holdingsCount": len(detailed_holdings),
        "totalEstimatedPortfolioValueDzd": total_val,
        "holdings": detailed_holdings,
    }
