"""
TamWheel Founder SaaS Subscription & Feature-Entitlement Engine (Section 10 & 18).
Implements the 4-tier monetization model:
1. Genesis ($0/mo / 0 DZD)
2. Seed OS ($49/mo / 6,500 DZD)
3. Growth OS ($199/mo / 27,000 DZD)
4. Enterprise Venture OS ($499/mo / 68,000 DZD)
Enforces strict gatekeeping for cap table stakeholders, VDR storage limits, and advanced modules.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import logging
from typing import Dict, List, Optional

from app.schemas.saas_subscription import (
    SaaSTier,
    BillingCycle,
    SaaSFeature,
    SaaSEntitlementConfig,
    StartupSubscription,
    StartupSubscriptionResponse,
    EntitlementCheckResult,
    SaaSPlanCatalogResponse,
)
from app.schemas.vdr import VDRDocumentTier

logger = logging.getLogger(__name__)

# Standard Plan Definitions based on Master Blueprint Section 10
PLAN_DEFINITIONS: Dict[SaaSTier, SaaSEntitlementConfig] = {
    SaaSTier.GENESIS: SaaSEntitlementConfig(
        tier=SaaSTier.GENESIS,
        name="Genesis OS",
        monthly_price_usd=Decimal("0.00"),
        monthly_price_dzd=Decimal("0.00"),
        annual_price_usd=Decimal("0.00"),
        annual_price_dzd=Decimal("0.00"),
        max_cap_table_stakeholders=10,
        max_vdr_storage_bytes=500 * 1024 * 1024,  # 500 MB
        max_vdr_tier=VDRDocumentTier.TIER_1_PUBLIC_TEASER,
        watermarking_enabled=False,
        valuation_modeling_enabled=False,
        s4e_contracts_enabled=False,
        multi_currency_enabled=False,
        holdco_mirroring_enabled=False,
        secondary_liquidity_enabled=False,
        features_summary=[
            "Cap table up to 10 stakeholders",
            "500 MB Public Teaser VDR",
            "Basic legal templates",
            "Startup Label Decree 20-254 diagnostic",
        ],
    ),
    SaaSTier.SEED_OS: SaaSEntitlementConfig(
        tier=SaaSTier.SEED_OS,
        name="Seed OS",
        monthly_price_usd=Decimal("49.00"),
        monthly_price_dzd=Decimal("6500.00"),
        annual_price_usd=Decimal("490.00"),
        annual_price_dzd=Decimal("65000.00"),
        max_cap_table_stakeholders=25,
        max_vdr_storage_bytes=5 * 1024 * 1024 * 1024,  # 5 GB
        max_vdr_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
        watermarking_enabled=True,
        valuation_modeling_enabled=False,
        s4e_contracts_enabled=False,
        multi_currency_enabled=False,
        holdco_mirroring_enabled=False,
        secondary_liquidity_enabled=False,
        features_summary=[
            "Cap table up to 25 stakeholders",
            "5 GB Watermarked VDR (Tier 1 & 2)",
            "Clickwrap NDA execution & audit trail",
            "Investor updates & read telemetry",
            "Automated tax / CNAS compliance alerts",
        ],
    ),
    SaaSTier.GROWTH_OS: SaaSEntitlementConfig(
        tier=SaaSTier.GROWTH_OS,
        name="Growth OS",
        monthly_price_usd=Decimal("199.00"),
        monthly_price_dzd=Decimal("27000.00"),
        annual_price_usd=Decimal("1990.00"),
        annual_price_dzd=Decimal("270000.00"),
        max_cap_table_stakeholders=-1,  # Unlimited
        max_vdr_storage_bytes=50 * 1024 * 1024 * 1024,  # 50 GB
        max_vdr_tier=VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE,
        watermarking_enabled=True,
        valuation_modeling_enabled=True,
        s4e_contracts_enabled=True,
        multi_currency_enabled=True,
        holdco_mirroring_enabled=False,
        secondary_liquidity_enabled=False,
        features_summary=[
            "Unlimited cap table stakeholders",
            "50 GB Full VDR (Tier 1, 2 & 3 confirmatory)",
            "Unlimited dilution & liquidation waterfall modeling",
            "Automated 409A / regional valuations",
            "Multi-currency accounting (DZD / EUR / USD)",
            "S4E sweat-equity contract builder",
        ],
    ),
    SaaSTier.ENTERPRISE_OS: SaaSEntitlementConfig(
        tier=SaaSTier.ENTERPRISE_OS,
        name="Enterprise Venture OS",
        monthly_price_usd=Decimal("499.00"),
        monthly_price_dzd=Decimal("68000.00"),
        annual_price_usd=Decimal("4990.00"),
        annual_price_dzd=Decimal("680000.00"),
        max_cap_table_stakeholders=-1,  # Unlimited
        max_vdr_storage_bytes=500 * 1024 * 1024 * 1024,  # 500 GB
        max_vdr_tier=VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE,
        watermarking_enabled=True,
        valuation_modeling_enabled=True,
        s4e_contracts_enabled=True,
        multi_currency_enabled=True,
        holdco_mirroring_enabled=True,
        secondary_liquidity_enabled=True,
        features_summary=[
            "Unlimited cap table stakeholders",
            "500 GB High-Security VDR with forensic tracking",
            "Multi-jurisdiction HoldCo mirror (ADGM / Delaware / DIFC)",
            "Quarterly secondary liquidity auction engine",
            "ESOP double-trigger vesting & exercise suite",
            "Dedicated corporate governance counsel",
        ],
    ),
}


class SaaSSubscriptionEngine:
    """
    Manages startup SaaS subscriptions, plan upgrades, and runtime entitlement enforcement.
    """

    def __init__(self):
        # startup_id -> StartupSubscription
        self._subscriptions: Dict[str, StartupSubscription] = {}

    def get_plan_catalog(self) -> SaaSPlanCatalogResponse:
        """Retrieve full catalog of available Founder OS plans."""
        return SaaSPlanCatalogResponse(plans=list(PLAN_DEFINITIONS.values()))

    def get_tier_config(self, tier: SaaSTier) -> SaaSEntitlementConfig:
        """Get configuration for a specific tier."""
        return PLAN_DEFINITIONS[tier]

    def get_subscription(self, startup_id: str) -> StartupSubscription:
        """
        Get or initialize startup subscription.
        Defaults to the Genesis tier ($0/mo) for any startup.
        """
        if startup_id not in self._subscriptions:
            now = datetime.now(timezone.utc)
            self._subscriptions[startup_id] = StartupSubscription(
                startup_id=startup_id,
                tier=SaaSTier.GENESIS,
                billing_cycle=BillingCycle.MONTHLY,
                started_at=now,
                renews_at=now + timedelta(days=3650),  # Free indefinitely
                is_active=True,
                current_stakeholders_count=1,
                current_vdr_storage_bytes=0,
            )
        return self._subscriptions[startup_id]

    def upgrade_subscription(
        self,
        startup_id: str,
        target_tier: SaaSTier,
        billing_cycle: BillingCycle = BillingCycle.MONTHLY,
    ) -> StartupSubscriptionResponse:
        """Upgrade or renew a startup's SaaS subscription."""
        now = datetime.now(timezone.utc)
        sub = self.get_subscription(startup_id)

        duration_days = 365 if billing_cycle == BillingCycle.ANNUAL else 30
        sub.tier = target_tier
        sub.billing_cycle = billing_cycle
        sub.is_active = True
        sub.renews_at = now + timedelta(days=duration_days)

        return self.get_subscription_response(startup_id)

    def update_usage(
        self,
        startup_id: str,
        stakeholders_count: Optional[int] = None,
        vdr_storage_bytes: Optional[int] = None,
    ) -> StartupSubscription:
        """Update current resource usage telemetry."""
        sub = self.get_subscription(startup_id)
        if stakeholders_count is not None:
            sub.current_stakeholders_count = stakeholders_count
        if vdr_storage_bytes is not None:
            sub.current_vdr_storage_bytes = vdr_storage_bytes
        return sub

    def validate_stakeholder_capacity(
        self,
        startup_id: str,
        candidate_count: int,
    ) -> EntitlementCheckResult:
        """
        Check if adding stakeholders exceeds the startup's current subscription limit.
        Genesis: max 10. Seed: max 25. Growth/Enterprise: Unlimited (-1).
        """
        sub = self.get_subscription(startup_id)
        cfg = self.get_tier_config(sub.tier)

        if cfg.max_cap_table_stakeholders == -1:
            return EntitlementCheckResult(
                allowed=True,
                feature="CAP_TABLE_STAKEHOLDERS",
                current_usage=candidate_count,
                limit=-1,
                upgrade_required=False,
                suggested_tier=None,
                message=f"Unlimited stakeholders supported on {cfg.name}.",
            )

        if candidate_count > cfg.max_cap_table_stakeholders:
            suggested = SaaSTier.SEED_OS if sub.tier == SaaSTier.GENESIS and candidate_count <= 25 else SaaSTier.GROWTH_OS
            return EntitlementCheckResult(
                allowed=False,
                feature="CAP_TABLE_STAKEHOLDERS",
                current_usage=candidate_count,
                limit=cfg.max_cap_table_stakeholders,
                upgrade_required=True,
                suggested_tier=suggested,
                message=(
                    f"Stakeholder limit exceeded ({candidate_count} > {cfg.max_cap_table_stakeholders}). "
                    f"Please upgrade to {suggested.value} to add more stakeholders."
                ),
            )

        return EntitlementCheckResult(
            allowed=True,
            feature="CAP_TABLE_STAKEHOLDERS",
            current_usage=candidate_count,
            limit=cfg.max_cap_table_stakeholders,
            upgrade_required=False,
            suggested_tier=None,
            message=f"Stakeholder count {candidate_count} is within limits for {cfg.name}.",
        )

    def validate_vdr_storage_capacity(
        self,
        startup_id: str,
        additional_bytes: int,
        document_tier: VDRDocumentTier = VDRDocumentTier.TIER_1_PUBLIC_TEASER,
    ) -> EntitlementCheckResult:
        """
        Validate whether the uploaded document fits within VDR storage and tier allowance.
        """
        sub = self.get_subscription(startup_id)
        cfg = self.get_tier_config(sub.tier)

        # Check Tier Clearance: Genesis only supports Tier 1; Seed supports Tier 1 & 2; Growth+ supports Tier 3
        tier_ranks = {
            VDRDocumentTier.TIER_1_PUBLIC_TEASER: 1,
            VDRDocumentTier.TIER_2_NDA_FINANCIALS: 2,
            VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE: 3,
        }

        doc_rank = tier_ranks.get(document_tier, 1)
        max_allowed_rank = tier_ranks.get(cfg.max_vdr_tier, 1)

        if doc_rank > max_allowed_rank:
            suggested = SaaSTier.SEED_OS if doc_rank == 2 else SaaSTier.GROWTH_OS
            return EntitlementCheckResult(
                allowed=False,
                feature="VDR_DOCUMENT_TIER",
                current_usage=doc_rank,
                limit=max_allowed_rank,
                upgrade_required=True,
                suggested_tier=suggested,
                message=(
                    f"Your {cfg.name} plan only supports up to {cfg.max_vdr_tier.value}. "
                    f"To upload {document_tier.value} documents, upgrade to {suggested.value}."
                ),
            )

        # Check Storage Size Limit
        projected_bytes = sub.current_vdr_storage_bytes + additional_bytes
        if projected_bytes > cfg.max_vdr_storage_bytes:
            suggested = SaaSTier.SEED_OS if sub.tier == SaaSTier.GENESIS else (
                SaaSTier.GROWTH_OS if sub.tier == SaaSTier.SEED_OS else SaaSTier.ENTERPRISE_OS
            )
            return EntitlementCheckResult(
                allowed=False,
                feature="VDR_STORAGE",
                current_usage=projected_bytes,
                limit=cfg.max_vdr_storage_bytes,
                upgrade_required=True,
                suggested_tier=suggested,
                message=(
                    f"Storage quota exceeded ({projected_bytes / (1024*1024):.1f} MB > "
                    f"{cfg.max_vdr_storage_bytes / (1024*1024):.1f} MB). Upgrade to {suggested.value}."
                ),
            )

        return EntitlementCheckResult(
            allowed=True,
            feature="VDR_STORAGE",
            current_usage=projected_bytes,
            limit=cfg.max_vdr_storage_bytes,
            upgrade_required=False,
            suggested_tier=None,
            message=f"Storage request accepted under {cfg.name}.",
        )

    def validate_feature_access(
        self,
        startup_id: str,
        feature: SaaSFeature,
    ) -> EntitlementCheckResult:
        """Validate boolean feature entitlements (e.g., HoldCo mirroring, secondary market, dilution)."""
        sub = self.get_subscription(startup_id)
        cfg = self.get_tier_config(sub.tier)

        feature_map = {
            SaaSFeature.CAP_TABLE_BASIC: True,
            SaaSFeature.CAP_TABLE_STAKEHOLDER_EXPANSION: cfg.max_cap_table_stakeholders > 10 or cfg.max_cap_table_stakeholders == -1,
            SaaSFeature.VDR_STORAGE: True,
            SaaSFeature.VDR_WATERMARKING: cfg.watermarking_enabled,
            SaaSFeature.VDR_TIER_2_FINANCIALS: cfg.max_vdr_tier in (VDRDocumentTier.TIER_2_NDA_FINANCIALS, VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE),
            SaaSFeature.VDR_TIER_3_CAPTABLE: cfg.max_vdr_tier == VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE,
            SaaSFeature.VALUATION_DILUTION_MODELING: cfg.valuation_modeling_enabled,
            SaaSFeature.MULTI_CURRENCY: cfg.multi_currency_enabled,
            SaaSFeature.S4E_CONTRACT_BUILDER: cfg.s4e_contracts_enabled,
            SaaSFeature.HOLDCO_CROSS_BORDER_MIRROR: cfg.holdco_mirroring_enabled,
            SaaSFeature.SECONDARY_LIQUIDITY_ENGINE: cfg.secondary_liquidity_enabled,
            SaaSFeature.TAX_CNAS_COMPLIANCE_ALERTS: sub.tier != SaaSTier.GENESIS,
        }

        allowed = feature_map.get(feature, False)
        if not allowed:
            # Determine minimum suggested tier
            suggested = SaaSTier.ENTERPRISE_OS if feature in (
                SaaSFeature.HOLDCO_CROSS_BORDER_MIRROR,
                SaaSFeature.SECONDARY_LIQUIDITY_ENGINE,
            ) else (
                SaaSTier.GROWTH_OS if feature in (
                    SaaSFeature.VALUATION_DILUTION_MODELING,
                    SaaSFeature.MULTI_CURRENCY,
                    SaaSFeature.S4E_CONTRACT_BUILDER,
                    SaaSFeature.VDR_TIER_3_CAPTABLE,
                ) else SaaSTier.SEED_OS
            )

            return EntitlementCheckResult(
                allowed=False,
                feature=feature.value,
                current_usage=0,
                limit=0,
                upgrade_required=True,
                suggested_tier=suggested,
                message=f"Feature '{feature.value}' is locked on {cfg.name}. Upgrade to {suggested.value} to unlock.",
            )

        return EntitlementCheckResult(
            allowed=True,
            feature=feature.value,
            current_usage=1,
            limit=1,
            upgrade_required=False,
            suggested_tier=None,
            message=f"Feature '{feature.value}' is unlocked on {cfg.name}.",
        )

    def get_subscription_response(self, startup_id: str) -> StartupSubscriptionResponse:
        """Return formatted response with active tier configuration and usage metrics."""
        sub = self.get_subscription(startup_id)
        cfg = self.get_tier_config(sub.tier)

        used_mb = sub.current_vdr_storage_bytes / (1024 * 1024)
        limit_mb = cfg.max_vdr_storage_bytes / (1024 * 1024)

        if cfg.max_cap_table_stakeholders == -1:
            stakeholder_pct = 0.0
        else:
            stakeholder_pct = round((sub.current_stakeholders_count / cfg.max_cap_table_stakeholders) * 100, 1)

        return StartupSubscriptionResponse(
            subscription=sub,
            tier_config=cfg,
            storage_used_mb=round(used_mb, 2),
            storage_limit_mb=round(limit_mb, 2),
            stakeholder_usage_percent=stakeholder_pct,
        )


# Global singleton instance
saas_subscription_engine = SaaSSubscriptionEngine()
