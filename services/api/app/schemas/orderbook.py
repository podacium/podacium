"""
TamWheel Sovereign Ethical Agentic Venture OS — Simulated Order Book & Market Depth Schemas.
Pillar 2 / Phase 4: Continuous Limit Order Book (LOB) for Secondary Fantasy Venture Shares.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str = Field(..., description="Target startup venture ID")
    side: str = Field(..., description="BUY | SELL")
    order_type: str = Field("LIMIT", description="LIMIT | MARKET")
    price: Optional[float] = Field(None, ge=1.0, description="Limit price in DZD (required for LIMIT orders)")
    quantity: int = Field(..., ge=1, description="Quantity of shares to trade")


class OrderResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    order_id: str
    user_id: int
    startup_id: str
    side: str
    order_type: str
    price: Optional[float]
    quantity: int
    filled_quantity: int
    remaining_quantity: int
    status: str  # OPEN | PARTIALLY_FILLED | FILLED | CANCELLED
    created_at: str
    updated_at: str


class OrderMatchTrade(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    trade_id: str
    maker_order_id: str
    taker_order_id: str
    buyer_id: int
    seller_id: int
    startup_id: str
    price: float
    quantity: int
    total_dzd: int
    fee_dzd: int
    timestamp: str
    journal_entry_id: Optional[str] = None


class OrderPlacementResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    order: OrderResponse
    executed_trades: List[OrderMatchTrade] = Field(default_factory=list)
    fully_filled: bool
    net_cash_spent_or_received: int


class MarketDepthLevel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    price: float
    volume: int
    orders_count: int


class MarketDepthResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str
    startup_name: str
    bids: List[MarketDepthLevel] = Field(default_factory=list, description="Aggregated bids ordered descending by price")
    asks: List[MarketDepthLevel] = Field(default_factory=list, description="Aggregated asks ordered ascending by price")
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None
    spread_dzd: Optional[float] = None
    mid_price: Optional[float] = None
    depth_imbalance: float = Field(0.0, description="Order book depth imbalance ratio in [-1.0, 1.0]")
    last_trade_price: Optional[float] = None
    total_bids_volume: int = 0
    total_asks_volume: int = 0
    total_volume_dzd: int = 0
    trades_count: int = 0
    timestamp: str


class CancelOrderResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    order_id: str
    startup_id: str
    status: str
    cancelled_quantity: int
    refunded_cash_dzd: int
    refunded_shares: int
