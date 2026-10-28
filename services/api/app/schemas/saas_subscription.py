"""
Pydantic Schemas for TamWheel Founder SaaS Subscription Engine (Section 10).
Defines subscription tiers (Genesis, Seed OS, Growth OS, Enterprise OS) and
rigorous entitlement validation models.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.vdr import VDRDocumentTier


class SaaSTier(str, Enum):
    GENESIS = "GENESIS"
    SEED_OS = "SEED_OS"
    GROWTH_OS = "GROWTH_OS"
    ENTERPRISE_OS = "ENTERPRISE_OS"


class BillingCycle(str, Enum):
    MONTHLY = "MONTHLY"
    ANNUAL = "ANNUAL"


class SaaSFeature(str, Enum):
    CAP_TABLE_BASIC = "CAP_TABLE_BASIC"
    CAP_TABLE_STAKEHOLDER_EXPANSION = "CAP_TABLE_STAKEHOLDER_EXPANSION"
    VDR_STORAGE = "VDR_STORAGE"
    VDR_WATERMARKING = "VDR_WATERMARKING"
    VDR_TIER_2_FINANCIALS = "VDR_TIER_2_FINANCIALS"
    VDR_TIER_3_CAPTABLE = "VDR_TIER_3_CAPTABLE"
    VALUATION_DILUTION_MODELING = "VALUATION_DILUTION_MODELING"
    MULTI_CURRENCY = "MULTI_CURRENCY"
    S4E_CONTRACT_BUILDER = "S4E_CONTRACT_BUILDER"
    HOLDCO_CROSS_BORDER_MIRROR = "HOLDCO_CROSS_BORDER_MIRROR"
    SECONDARY_LIQUIDITY_ENGINE = "SECONDARY_LIQUIDITY_ENGINE"
    TAX_CNAS_COMPLIANCE_ALERTS = "TAX_CNAS_COMPLIANCE_ALERTS"


class SaaSEntitlementConfig(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tier: SaaSTier
    name: str
    monthly_price_usd: Decimal
    monthly_price_dzd: Decimal
    annual_price_usd: Decimal
    annual_price_dzd: Decimal
    max_cap_table_stakeholders: int  # -1 for unlimited
    max_vdr_storage_bytes: int
    max_vdr_tier: VDRDocumentTier
    watermarking_enabled: bool
    valuation_modeling_enabled: bool
    s4e_contracts_enabled: bool
    multi_currency_enabled: bool
    holdco_mirroring_enabled: bool
    secondary_liquidity_enabled: bool
    features_summary: List[str]


class StartupSubscription(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    tier: SaaSTier
    billing_cycle: BillingCycle
    started_at: datetime
    renews_at: datetime
    is_active: bool = True
    current_stakeholders_count: int = 1
    current_vdr_storage_bytes: int = 0


class SaaSPlanUpgradeRequest(BaseModel):
    target_tier: SaaSTier
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    payment_method: str = "CHARGILY"  # e.g., CHARGILY, CIB_EDAHABIA, WIRE


class EntitlementCheckResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allowed: bool
    feature: str
    current_usage: Union[int, float]
    limit: Union[int, float]  # -1 for unlimited
    upgrade_required: bool
    suggested_tier: Optional[SaaSTier] = None
    message: str


class ValidateStakeholdersRequest(BaseModel):
    candidate_count: int


class ValidateStorageRequest(BaseModel):
    additional_bytes: int
    document_tier: VDRDocumentTier = VDRDocumentTier.TIER_1_PUBLIC_TEASER


class StartupSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subscription: StartupSubscription
    tier_config: SaaSEntitlementConfig
    storage_used_mb: float
    storage_limit_mb: float
    stakeholder_usage_percent: float


class SaaSPlanCatalogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plans: List[SaaSEntitlementConfig]
