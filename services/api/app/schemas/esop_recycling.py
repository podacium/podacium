"""
Pydantic Schemas for Dynamic ESOP Pool Rebalancing, Forfeiture Recycling,
Anti-Dilution Strike Repricing & Algerian IRG Tax Withholding Engine.
Implements Law 22-09 SPAS equity incentives, 48-month/12-month cliff vesting,
unallocated reserve pool recycling, and CIDTA Art. 67 / 104 salary tax withholding.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class TerminationType(str, Enum):
    RESIGNATION = "RESIGNATION"
    TERMINATION_WITHOUT_CAUSE = "TERMINATION_WITHOUT_CAUSE"
    TERMINATION_FOR_CAUSE = "TERMINATION_FOR_CAUSE"
    DEATH_OR_DISABILITY = "DEATH_OR_DISABILITY"


class AntiDilutionMethod(str, Enum):
    FULL_RATCHET = "FULL_RATCHET"
    BROAD_BASED_WEIGHTED_AVERAGE = "BROAD_BASED_WEIGHTED_AVERAGE"
    VALUE_PARITY_OPTION_EXCHANGE = "VALUE_PARITY_OPTION_EXCHANGE"


class GrantStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PARTIALLY_EXERCISED = "PARTIALLY_EXERCISED"
    FULLY_EXERCISED = "FULLY_EXERCISED"
    TERMINATED_RECYCLED = "TERMINATED_RECYCLED"
    EXPIRED = "EXPIRED"


class EsopPoolInitRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    total_authorized_pool_shares: int = Field(..., gt=0, description="Total authorized ESOP reserve shares")
    pool_name: str = Field(default="SPAS Employee Stock Option Plan 2026")
    par_value_dzd: Decimal = Field(default=Decimal("1000.00"), gt=0)


class EsopPoolStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    pool_name: str
    total_authorized_pool_shares: int
    allocated_granted_shares: int
    unallocated_reserve_shares: int
    vested_shares_total: int
    unvested_shares_total: int
    exercised_shares_total: int
    forfeited_recycled_shares_total: int
    pool_utilization_rate: Decimal
    available_pool_percentage: Decimal
    active_grants_count: int


class EsopGrantCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    employee_id: str
    employee_name: str
    employee_email: Optional[str] = None
    options_granted: int = Field(..., gt=0)
    strike_price_dzd: Decimal = Field(..., gt=0)
    grant_date: str = Field(..., description="YYYY-MM-DD")
    vesting_schedule_months: int = Field(default=48, ge=1, le=120)
    cliff_months: int = Field(default=12, ge=0, le=48)
    role_title: str = Field(default="Key Contributor")


class EsopGrantDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grant_id: str
    startup_id: str
    employee_id: str
    employee_name: str
    role_title: str
    options_granted: int
    strike_price_dzd: Decimal
    grant_date: str
    as_of_date: str
    months_elapsed: int
    cliff_months: int
    cliff_reached: bool
    vesting_schedule_months: int
    vested_options: int
    unvested_options: int
    exercised_options: int
    exercisable_options: int
    vested_percentage: Decimal
    grant_status: GrantStatus
    intrinsic_value_dzd: Decimal


class ForfeitureRecycleRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grant_id: str
    departure_date: str = Field(..., description="YYYY-MM-DD date of termination or resignation")
    termination_type: TerminationType = Field(default=TerminationType.RESIGNATION)
    ptew_days: int = Field(default=90, ge=0, description="Post-termination exercise window in days")
    voluntary_release_vested: bool = Field(
        default=False,
        description="If True or for cause, vested options are also released and recycled",
    )


class ForfeitureRecycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recycle_event_id: str
    grant_id: str
    startup_id: str
    employee_id: str
    employee_name: str
    departure_date: str
    termination_type: TerminationType
    months_active: int
    cliff_reached: bool
    options_granted: int
    vested_options_at_departure: int
    exercised_prior_to_departure: int
    unvested_forfeited_options: int
    vested_recycled_options: int
    total_recycled_to_pool: int
    remaining_exercisable_during_ptew: int
    ptew_expiration_date: Optional[str]
    previous_unallocated_pool_shares: int
    new_unallocated_pool_shares: int
    previous_utilization_rate: Decimal
    new_utilization_rate: Decimal
    audit_memo: str
    timestamp: str


class DownRoundAntiDilutionRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    previous_round_share_price_dzd: Decimal = Field(..., gt=0)
    new_down_round_share_price_dzd: Decimal = Field(..., gt=0)
    shares_outstanding_pre_round: int = Field(..., gt=0)
    new_shares_issued_in_round: int = Field(..., gt=0)
    rebalancing_method: AntiDilutionMethod = Field(
        default=AntiDilutionMethod.BROAD_BASED_WEIGHTED_AVERAGE
    )
    apply_to_all_active_grants: bool = Field(default=True)


class AdjustedGrantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grant_id: str
    employee_id: str
    employee_name: str
    options_count_before: int
    options_count_after: int
    old_strike_price_dzd: Decimal
    new_strike_price_dzd: Decimal
    repricing_factor: Decimal
    economic_retention_preserved: bool


class DownRoundAntiDilutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    previous_share_price_dzd: Decimal
    down_round_share_price_dzd: Decimal
    valuation_haircut_percentage: Decimal
    rebalancing_method: AntiDilutionMethod
    total_active_grants_repriced: int
    total_options_affected: int
    adjusted_grants: List[AdjustedGrantSummary]
    statutory_spas_board_resolution_text: str


class IrgTaxBracketBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bracket_index: int
    bracket_range_dzd: str
    taxable_amount_in_bracket_dzd: Decimal
    bracket_rate_percent: Decimal
    tax_generated_dzd: Decimal


class IrgTaxCalculationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    options_to_exercise: int = Field(..., gt=0)
    strike_price_dzd: Decimal = Field(..., gt=0)
    fair_market_value_dzd: Decimal = Field(..., gt=0)
    employee_monthly_gross_salary_dzd: Optional[Decimal] = Field(
        default=Decimal("150000.00"),
        ge=0,
        description="Standard monthly salary base for progressive marginal bracket calculation",
    )
    apply_social_security_cnas: bool = Field(
        default=True,
        description="Include 9% employee CNAS social security contribution if treated through payroll",
    )
    is_spas_bspce_flat_regime: bool = Field(
        default=False,
        description="Apply Startup Label Decree 20-254 / SPAS preferential 15% flat withholding",
    )


class IrgTaxCalculationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    options_exercised: int
    strike_price_dzd: Decimal
    fair_market_value_dzd: Decimal
    total_exercise_cost_dzd: Decimal  # options * strike
    gross_market_value_dzd: Decimal  # options * FMV
    discount_spread_per_share_dzd: Decimal  # FMV - strike
    gross_exercise_gain_dzd: Decimal  # options * (FMV - strike)
    taxable_gain_base_dzd: Decimal
    irg_tax_withheld_dzd: Decimal
    effective_irg_rate_percent: Decimal
    cnas_social_security_dzd: Decimal
    total_statutory_deductions_dzd: Decimal
    net_employee_take_home_value_dzd: Decimal
    cidta_legal_basis: str
    g50_filing_line_item: Dict[str, Any]
    bracket_breakdown: List[IrgTaxBracketBreakdown]
