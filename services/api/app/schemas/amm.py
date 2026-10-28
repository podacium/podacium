"""
TamWheel Sovereign Ethical Agentic Venture OS — AMM Bonding Curve Schemas.
Pillar 2 / Phase 4: Automated Algorithmic Continuous Token Pricing for Fantasy Shares.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


class BondingCurveConfig(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str
    curve_type: str = Field("POLYNOMIAL", description="POLYNOMIAL | SIGMOID | BANCOR")
    p0: float = Field(100.0, ge=1.0, description="Base floor price in DZD (Sim)")
    slope_m: float = Field(0.5, ge=0.0001, description="Slope sensitivity parameter")
    exponent_k: float = Field(1.0, ge=0.0, le=5.0, description="Curve power exponent")
    reserve_ratio: Optional[float] = Field(0.5, ge=0.01, le=1.0, description="Connector weight / reserve ratio for Bancor curve (F)")
    sigmoid_l: Optional[float] = Field(None, description="Ceiling carrying capacity for Sigmoid")
    sigmoid_s0: Optional[float] = Field(None, description="Midpoint inflection supply for Sigmoid")
    fee_rate: float = Field(0.015, ge=0.0, le=0.1, description="Protocol Touiza liquidity exit fee (1.5%)")


class BondingCurveQuoteRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str = Field(..., description="Target startup ID")
    shares_amount: int = Field(..., ge=1, description="Number of shares to quote")
    action: str = Field("BUY", description="BUY | SELL")


class BondingCurveQuoteResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str
    action: str
    shares_amount: int
    current_supply: int
    new_supply: int
    current_spot_price: float
    new_spot_price: float
    total_cost_or_refund: float
    net_refund: Optional[float] = None
    protocol_fee: float
    avg_execution_price: float
    price_impact_pct: float
    slippage_pct: float


class BondingCurveTradeRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str = Field(..., description="Target startup ID")
    action: str = Field(..., description="BUY | SELL")
    shares_amount: int = Field(..., ge=1, description="Number of shares to trade")
    max_slippage_pct: float = Field(2.5, ge=0.1, le=50.0, description="Maximum acceptable slippage %")
    expected_avg_price: Optional[float] = Field(None, description="Optional client expected execution price")


class BondingCurveTradeResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    trade_id: str
    user_id: int
    startup_id: str
    action: str
    shares_amount: int
    total_cost_or_refund: int
    net_refund: Optional[int] = None
    protocol_fee: int
    avg_execution_price: float
    slippage_pct: float
    current_spot_price: float
    new_supply: int
    new_user_shares: int
    journal_entry_id: str
    entry_hash: str
    timestamp: str


class PoolStateResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str
    startup_name: str
    curve_type: str
    circulating_supply: int
    spot_price: float
    reserve_balance_dzd: int
    total_volume_dzd: int
    trades_count: int
    p0: float
    slope_m: float
    exponent_k: float
    fee_rate: float
