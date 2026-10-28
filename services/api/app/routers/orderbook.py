"""
TamWheel Sovereign Ethical Agentic Venture OS — Fantasy Order Book & Anti-Collusion Router.
Pillar 2 / Phase 4: Continuous Secondary Trading & Sybil Wash Trading Detection for Fantasy Startups.

Endpoints:
1. `POST /fantasy/orderbook/order`: Place limit or market order on secondary fantasy share market.
2. `DELETE /fantasy/orderbook/order/{order_id}`: Cancel an open limit order.
3. `GET /fantasy/orderbook/depth/{startup_id}`: Market depth visualization payload with spread and imbalance.
4. `GET /fantasy/orderbook/orders/mine`: List active and historical orders for current user.
5. `GET /fantasy/orderbook/trades/{startup_id}`: List recent matched trades on startup order book.
6. `POST /fantasy/orderbook/collusion/telemetry`: Record client IP and device fingerprint telemetry.
7. `GET /fantasy/orderbook/collusion/score/{user_id}`: Get account collusion score and risk factors.
8. `GET /fantasy/orderbook/collusion/audit`: Generate full anti-collusion wash trading audit report.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request

from app.core.auth import get_current_active_user, get_client_ip
from app.services.simulated_order_book import simulated_order_book
from app.services.anti_collusion_engine import anti_collusion_engine
from app.schemas.orderbook import (
    CreateOrderRequest,
    OrderPlacementResult,
    CancelOrderResponse,
    MarketDepthResponse,
    OrderResponse,
    OrderMatchTrade,
)
from app.schemas.anti_collusion import (
    TelemetryInput,
    AccountCollusionScoreResponse,
    CollusionAuditReport,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fantasy/orderbook", tags=["Fantasy Order Book & Anti-Collusion"])


# =============================================================================
# ORDER BOOK TRADING ENDPOINTS
# =============================================================================

@router.post(
    "/order",
    response_model=OrderPlacementResult,
    summary="Place a limit or market order for fantasy startup shares",
)
async def place_orderbook_order(
    req: CreateOrderRequest,
    request: Request,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Submits and matches a limit or market order against the continuous order book:
    - Enforces price-time priority.
    - Locks required virtual cash (for buy) or shares (for sell) in escrow.
    - Matches immediately against crossing counter-orders.
    - Settles completed trades atomically onto the Double-Entry Virtual Ledger.
    - Records trade execution in the Anti-Collusion Wash Trading Engine.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")

    # Ingest client IP & telemetry
    client_ip = get_client_ip(request)
    ua = request.headers.get("user-agent")
    if client_ip:
        anti_collusion_engine.record_telemetry(user_id=user_id, ip_address=client_ip, user_agent=ua)

    return simulated_order_book.place_order(
        user_id=user_id,
        startup_id=req.startup_id,
        side=req.side,
        order_type=req.order_type,
        price=req.price,
        quantity=req.quantity,
    )


@router.delete(
    "/order/{order_id}",
    response_model=CancelOrderResponse,
    summary="Cancel an open or partially filled limit order",
)
async def cancel_orderbook_order(
    order_id: str,
    current_user: Any = Depends(get_current_active_user),
):
    """Cancels an open order and unencumbers escrowed virtual cash or shares."""
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    return simulated_order_book.cancel_order(user_id=user_id, order_id=order_id)


@router.get(
    "/depth/{startup_id}",
    response_model=MarketDepthResponse,
    summary="Get market depth visualization payload for a startup venture",
)
async def get_market_depth(
    startup_id: str,
    depth: int = Query(15, ge=1, le=50, description="Number of price levels to return"),
):
    """
    Returns real-time aggregated market depth:
    - Bids sorted descending by price
    - Asks sorted ascending by price
    - Best bid, best ask, bid-ask spread in DZD
    - Mid price and order book depth imbalance in [-1.0, 1.0]
    """
    return simulated_order_book.get_market_depth(startup_id=startup_id, depth_levels=depth)


@router.get(
    "/orders/mine",
    response_model=List[OrderResponse],
    summary="Get user's open and historical limit orders",
)
async def get_my_orders(
    startupId: Optional[str] = Query(None, description="Optional startup filter"),
    status: Optional[str] = Query(None, description="Optional status filter: OPEN, FILLED, CANCELLED"),
    current_user: Any = Depends(get_current_active_user),
):
    """Retrieves all order book orders placed by the current user."""
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    return simulated_order_book.get_user_orders(
        user_id=user_id,
        startup_id=startupId,
        status_filter=status,
    )


@router.get(
    "/trades/{startup_id}",
    response_model=List[OrderMatchTrade],
    summary="Get recent matched trades for a startup order book",
)
async def get_recent_orderbook_trades(
    startup_id: str,
    limit: int = Query(50, ge=1, le=100, description="Max trades to retrieve"),
):
    """Returns chronological trade history for the specified startup venture."""
    return simulated_order_book.get_recent_trades(startup_id=startup_id, limit=limit)


# =============================================================================
# ANTI-COLLUSION & SYBIL RESISTANCE ENDPOINTS
# =============================================================================

@router.post(
    "/collusion/telemetry",
    summary="Ingest client device fingerprint and IP telemetry",
)
async def submit_telemetry(
    req: TelemetryInput,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Records client network and browser fingerprint telemetry:
    - Identifies multi-accounting Sybils operating across identical devices or networks.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    target_uid = req.user_id if user_id == req.user_id else user_id

    anti_collusion_engine.record_telemetry(
        user_id=target_uid,
        ip_address=req.ip_address,
        device_fingerprint=req.device_fingerprint,
        user_agent=req.user_agent,
    )
    return {"status": "SUCCESS", "userId": target_uid, "telemetryRecorded": True}


@router.get(
    "/collusion/score/{user_id}",
    response_model=AccountCollusionScoreResponse,
    summary="Get account collusion score and factor breakdown",
)
async def get_account_collusion_score(
    user_id: int,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Evaluates account collusion score in [0.0, 100.0]:
    - Cycle score (reciprocal pairs, circular rings)
    - Bilateral volume concentration & wash-trading symmetry
    - Device fingerprint and IP network overlap
    - High-frequency burst velocity
    """
    return anti_collusion_engine.evaluate_collusion_score(user_id=user_id)


@router.get(
    "/collusion/audit",
    response_model=CollusionAuditReport,
    summary="Generate comprehensive anti-collusion and wash trading audit report",
)
async def get_collusion_audit_report(
    seasonId: Optional[str] = Query(None, description="Optional season identifier"),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Scans the complete transaction graph for:
    - Flagged high-risk accounts (score >= 60.0)
    - Detected circular Sybil wash-trading rings
    - Cross-account device and IP clustering
    """
    return anti_collusion_engine.generate_audit_report(season_id=seasonId)
