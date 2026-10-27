"""
BI Billing Service

Manages tier-based entitlements for Business Intelligence services:
- Starter/Basic (Free): simple dashboards, basic stats
- Growth: advanced dashboards, comparisons, trend tracking
- Scale: full analytics suite, custom reports, forecasts
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from app.core.prisma import prisma
from app.services.billing_services.entitlement_service import entitlement_service

logger = logging.getLogger(__name__)


# ─── BI Tier Feature Mapping ──────────────────────────────────────────────────
# Each key is a feature name used for access checks.  True = allowed.

BI_TIER_FEATURES: Dict[str, Dict[str, bool]] = {
    "FREE": {
        "simple_dashboards": True,
        "basic_stats": True,
        "advanced_dashboards": False,
        "comparisons": False,
        "trend_tracking": False,
        "custom_reports": False,
        "forecasts": False,
    },
    "BI_GROWTH": {
        "simple_dashboards": True,
        "basic_stats": True,
        "advanced_dashboards": True,
        "comparisons": True,
        "trend_tracking": True,
        "custom_reports": False,
        "forecasts": False,
    },
    "BI_SCALE": {
        "simple_dashboards": True,
        "basic_stats": True,
        "advanced_dashboards": True,
        "comparisons": True,
        "trend_tracking": True,
        "custom_reports": True,
        "forecasts": True,
    },
    "BI_ELITE": {
        "simple_dashboards": True,
        "basic_stats": True,
        "advanced_dashboards": True,
        "comparisons": True,
        "trend_tracking": True,
        "custom_reports": True,
        "forecasts": True,
    },
}


class BIBillingService:
    """Handles BI-specific billing logic and feature gating."""

    async def grant_bi_entitlements(
        self,
        transaction,
    ) -> None:
        """
        Grant feature entitlements based on BI tier.
        Called when a BI subscription is activated or renewed.
        Creates or updates the Subscription record.
        """
        metadata = transaction.metadata or {}
        plan = metadata.get("plan", "BI_GROWTH")
        billing_cycle = metadata.get("billing_cycle", "monthly")
        
        now = datetime.now(timezone.utc)
        expiry = now + (timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30))
        
        user_id = transaction.userId
        organization_id = transaction.organizationId
        target_id = user_id or organization_id

        if not target_id:
            logger.error("grant_bi_entitlements called without user_id or org_id")
            return

        # 1. UPSERT SUBSCRIPTION RECORD
        where_clause = {}
        if user_id:
            where_clause = {"userId_plan": {"userId": user_id, "plan": plan}}
        else:
            where_clause = {"organizationId_plan": {"organizationId": organization_id, "plan": plan}}

        subscription = await prisma.subscription.upsert(
            where=where_clause,
            data={
                "create": {
                    "userId": user_id,
                    "organizationId": organization_id,
                    "plan": plan,
                    "status": "ACTIVE",
                    "startedAt": now,
                    "currentPeriodEnd": expiry,
                    "amount": transaction.amount,
                    "billingCycle": billing_cycle,
                },
                "update": {
                    "status": "ACTIVE",
                    "currentPeriodEnd": expiry,
                    "amount": transaction.amount,
                    "cancelledAt": None,
                },
            },
        )

        # Connect transaction to subscription
        await prisma.transaction.update(
            where={"id": transaction.id},
            data={"subscriptionId": subscription.id},
        )

        # 2. GRANT ENTITLEMENTS
        features = BI_TIER_FEATURES.get(plan, BI_TIER_FEATURES["FREE"])
        for feature_name, allowed in features.items():
            if allowed:
                await entitlement_service.grant_entitlement(
                    user_id=user_id or 0,
                    entitlement_type="bi_feature",
                    resource_id=feature_name,
                    source_type="subscription",
                    source_id=str(subscription.id),
                    expires_at=expiry,
                )

        # Also grant a tier-level entitlement for simpler checks
        await entitlement_service.grant_entitlement(
            user_id=user_id or 0,
            entitlement_type="bi_tier",
            resource_id=plan.lower(),
            source_type="subscription",
            source_id=str(subscription.id),
            expires_at=expiry,
        )

        logger.info(
            f"Created subscription and granted BI entitlements for plan={plan} to "
            f"user={user_id} org={organization_id}"
        )

    async def check_bi_feature_access(
        self,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        feature: str = "",
    ) -> bool:
        """
        Check if a user or organization can access a specific BI feature.
        Free features are always accessible.
        """
        # Free features are always available
        free_features = BI_TIER_FEATURES["FREE"]
        if free_features.get(feature, False):
            return True

        # Check entitlement
        target_id = user_id or organization_id
        if not target_id:
            return False

        return await entitlement_service.has_entitlement(
            user_id=target_id,
            entitlement_type="bi_feature",
            resource_id=feature,
        )

    async def get_bi_tier(
        self,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> str:
        """
        Determine the current BI tier for a user or organization.
        Returns the plan name (e.g., "BI_GROWTH") or "FREE".
        """
        target_id = user_id or organization_id
        if not target_id:
            return "FREE"

        # Look for an active BI subscription
        where_clause: Dict[str, Any] = {
            "status": "ACTIVE",
            "plan": {"in": ["BI_GROWTH", "BI_SCALE", "BI_ELITE"]},
            "currentPeriodEnd": {"gt": datetime.now(timezone.utc)},
        }

        if user_id:
            where_clause["userId"] = user_id
        elif organization_id:
            where_clause["organizationId"] = organization_id

        subscription = await prisma.subscription.find_first(where=where_clause)

        if subscription:
            return subscription.plan

        return "FREE"

    async def revoke_bi_entitlements(
        self,
        user_id: Optional[int],
        organization_id: Optional[int],
    ) -> None:
        """
        Revoke all BI entitlements when subscription expires or is cancelled.
        The entitlement service's expiry-based check handles this naturally
        for time-limited entitlements, but this can be called for immediate revocation.
        """
        target_id = user_id or organization_id
        if not target_id:
            return

        # Delete all BI feature entitlements for this user
        await prisma.userentitlement.delete_many(
            where={
                "userId": target_id,
                "entitlementType": {"in": ["bi_feature", "bi_tier"]},
            }
        )

        await entitlement_service.invalidate_cache(target_id)
        logger.info(f"Revoked BI entitlements for user/org {target_id}")


bi_billing_service = BIBillingService()
