"""
Pydantic Schemas for Advanced SAFE & Convertible Note Conversion Simulator (Pillar 1 Phase 4).
Supports Y Combinator standard Post-Money SAFE, Pre-Money SAFE, Promissory Notes,
interest accruals, MFN elections, and Hamilton-Hare integer share distribution.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SafeType(str, Enum):
    POST_MONEY_SAFE = "POST_MONEY_SAFE"
    PRE_MONEY_SAFE = "PRE_MONEY_SAFE"
    CONVERTIBLE_NOTE = "CONVERTIBLE_NOTE"
    BSA_AIR_ALGERIA = "BSA_AIR_ALGERIA"


class InterestType(str, Enum):
    NONE = "NONE"
    SIMPLE = "SIMPLE"
    COMPOUND = "COMPOUND"


class ConversionScenario(str, Enum):
    EQUITY_FINANCING = "EQUITY_FINANCING"
    LIQUIDITY_EVENT = "LIQUIDITY_EVENT"
    DISSOLUTION = "DISSOLUTION"


class SafeInstrumentModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    investor_id: str
    investor_name: str
    safe_type: SafeType
    principal_dzd: Decimal
    principal_foreign_currency: Optional[Decimal] = None
    currency: str = "DZD"
    valuation_cap_dzd: Optional[Decimal] = None
    valuation_floor_dzd: Optional[Decimal] = None  # Algerian protection against down-round floor
    discount_rate: Decimal = Decimal("0.0")  # e.g. 0.20 for 20% discount
    interest_rate_annual: Decimal = Decimal("0.0")  # e.g. 0.08 for 8%
    interest_type: InterestType = InterestType.NONE
    issuance_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    maturity_date: Optional[datetime] = None
    has_mfn_clause: bool = False
    target_share_class: str = "PREFERENCE_A"
    is_sharia_compliant: bool = True


class PricedRoundTerms(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    round_name: str = "Series Seed"
    pre_money_valuation_dzd: Decimal
    new_capital_invested_dzd: Decimal
    new_share_price_dzd: Decimal
    expand_option_pool_percent: Decimal = Decimal("0.0")
    round_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SafeConversionResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    safe_id: str
    investor_name: str
    safe_type: SafeType
    original_principal_dzd: Decimal
    accrued_interest_dzd: Decimal
    total_converting_amount_dzd: Decimal
    effective_conversion_price_dzd: Decimal
    conversion_mechanism_chosen: str  # VALUATION_CAP, DISCOUNT_PRICE, ROUND_PRICE, MFN_ELECTED, LIQUIDITY_PAYOUT
    unrounded_shares: float
    integer_shares_issued: int
    remainder: float
    post_conversion_ownership_percent: float


class CapTableComparisonEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stakeholder_name: str
    share_class: str
    pre_shares: int
    pre_ownership_percent: float
    post_shares: int
    post_ownership_percent: float
    dilution_percent: float


class SafeConversionSimulationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    existing_pre_round_shares: int = Field(..., gt=0)
    instruments: List[SafeInstrumentModel]
    scenario: ConversionScenario = ConversionScenario.EQUITY_FINANCING
    round_terms: Optional[PricedRoundTerms] = None
    liquidity_event_valuation_dzd: Optional[Decimal] = None
    apply_mfn_automatically: bool = True


class SafeConversionSimulationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    scenario: ConversionScenario
    pre_money_valuation_dzd: Decimal
    post_money_valuation_dzd: Decimal
    round_share_price_dzd: Decimal
    total_new_shares_from_safes: int
    total_new_shares_from_priced_round: int
    total_post_shares: int
    safe_conversions: List[SafeConversionResultItem]
    cap_table_before_vs_after: List[CapTableComparisonEntry]
    conservation_verified: bool
    summary_report: str
