"""
Usage Tracking Service

Tracks and enforces per-tier limits for subscription plans:
- Course access limits (monthly/yearly)
- Certificate grant limits (monthly/yearly)
- BI dataset & dashboard creation limits
- BI storage & API call limits
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


# ─── Education Tier Limits ────────────────────────────────────────────────────

EDUCATION_TIER_LIMITS: Dict[str, Dict[str, int]] = {
    "STUDENT_STARTER": {
        "monthly_courses": 2,
        "yearly_courses": 24,
        "monthly_certificates": 0,
        "yearly_certificates": 0,
    },
    "STUDENT_PLUS": {
        "monthly_courses": 4,
        "yearly_courses": 48,
        "monthly_certificates": 0,
        "yearly_certificates": 0,
    },
    "STUDENT_PRO": {
        "monthly_courses": 7,
        "yearly_courses": 84,
        "monthly_certificates": 1,
        "yearly_certificates": 10,
    },
}

# ─── BI Tier Limits ───────────────────────────────────────────────────────────

BI_TIER_LIMITS: Dict[str, Dict[str, int]] = {
    "BI_GROWTH": {
        "monthly_datasets": 3,
        "yearly_datasets": 36,
        "monthly_dashboards": 2,
        "yearly_dashboards": 24,
        "monthly_storage_mb": 1000,
        "yearly_storage_mb": 12000,
        "monthly_api_calls": 10000,
        "yearly_api_calls": 120000,
    },
    "BI_SCALE": {
        "monthly_datasets": 10,
        "yearly_datasets": 120,
        "monthly_dashboards": 10,
        "yearly_dashboards": 120,
        "monthly_storage_mb": 5000,
        "yearly_storage_mb": 60000,
        "monthly_api_calls": 100000,
        "yearly_api_calls": 1200000,
    },
    "BI_ELITE": {
        "monthly_datasets": 100,
        "yearly_datasets": 1200,
        "monthly_dashboards": 50,
        "yearly_dashboards": 600,
        "monthly_storage_mb": 50000,
        "yearly_storage_mb": 600000,
        "monthly_api_calls": 1000000,
        "yearly_api_calls": 12000000,
    },
}


class UsageTrackingService:
    """Tracks and enforces per-tier subscription usage limits."""

    # ── Course Limits (Education) ───────────────────────────────────────────

    async def check_course_limit(self, user_id: int) -> Dict[str, Any]:
        sub = await self._get_active_education_subscription(user_id)
        if not sub:
            return {"allowed": False, "used": 0, "limit": 0, "plan": None}

        limits = EDUCATION_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_courses" if sub.billingCycle == "yearly" else "monthly_courses"
        )
        limit = limits.get(limit_key, 0)
        used = await self._get_current_usage(
            user_id, "courses_accessed", sub.startedAt, sub.currentPeriodEnd
        )

        return {"allowed": used < limit, "used": used, "limit": limit, "plan": sub.plan}

    async def record_course_access(
        self, user_id: int, subscription_id: Optional[int] = None
    ) -> bool:
        sub = await self._get_active_education_subscription(user_id)
        if not sub:
            return False
        limits = EDUCATION_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_courses" if sub.billingCycle == "yearly" else "monthly_courses"
        )
        limit = limits.get(limit_key, 0)
        return await self._increment_usage(
            user_id=user_id,
            metric_type="courses_accessed",
            limit=limit,
            period_start=sub.startedAt,
            period_end=sub.currentPeriodEnd,
            subscription_id=sub.id,
        )

    # ── Certificate Limits (Education) ──────────────────────────────────────

    async def check_certificate_eligibility(self, user_id: int) -> Dict[str, Any]:
        sub = await self._get_active_education_subscription(user_id)
        if not sub:
            return {"allowed": False, "used": 0, "limit": 0, "plan": None}
        limits = EDUCATION_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_certificates"
            if sub.billingCycle == "yearly"
            else "monthly_certificates"
        )
        limit = limits.get(limit_key, 0)
        if limit == 0:
            return {"allowed": False, "used": 0, "limit": 0, "plan": sub.plan}
        used = await self._get_current_usage(
            user_id, "certificates_granted", sub.startedAt, sub.currentPeriodEnd
        )
        return {"allowed": used < limit, "used": used, "limit": limit, "plan": sub.plan}

    async def record_certificate_grant(self, user_id: int) -> bool:
        sub = await self._get_active_education_subscription(user_id)
        if not sub:
            return False
        limits = EDUCATION_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_certificates"
            if sub.billingCycle == "yearly"
            else "monthly_certificates"
        )
        limit = limits.get(limit_key, 0)
        if limit == 0:
            return False
        return await self._increment_usage(
            user_id=user_id,
            metric_type="certificates_granted",
            limit=limit,
            period_start=sub.startedAt,
            period_end=sub.currentPeriodEnd,
            subscription_id=sub.id,
        )

    # ── BI Dataset Limits ───────────────────────────────────────────────────

    async def check_dataset_limit(self, user_id: int) -> Dict[str, Any]:
        sub = await self._get_active_bi_subscription(user_id)
        if not sub:
            return {"allowed": False, "used": 0, "limit": 0, "plan": None}
        limits = BI_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_datasets" if sub.billingCycle == "yearly" else "monthly_datasets"
        )
        limit = limits.get(limit_key, 0)
        used = await self._count_user_datasets(user_id)
        return {"allowed": used < limit, "used": used, "limit": limit, "plan": sub.plan}

    async def record_dataset_created(self, user_id: int) -> bool:
        sub = await self._get_active_bi_subscription(user_id)
        if not sub:
            return False
        limits = BI_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_datasets" if sub.billingCycle == "yearly" else "monthly_datasets"
        )
        return await self._increment_usage(
            user_id=user_id,
            metric_type="datasets_created",
            limit=limits.get(limit_key, 0),
            period_start=sub.startedAt,
            period_end=sub.currentPeriodEnd,
            subscription_id=sub.id,
        )

    # ── BI Dashboard Limits ─────────────────────────────────────────────────

    async def check_dashboard_limit(self, user_id: int) -> Dict[str, Any]:
        sub = await self._get_active_bi_subscription(user_id)
        if not sub:
            return {"allowed": False, "used": 0, "limit": 0, "plan": None}
        limits = BI_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_dashboards"
            if sub.billingCycle == "yearly"
            else "monthly_dashboards"
        )
        limit = limits.get(limit_key, 0)
        used = await self._count_user_dashboards(user_id)
        return {"allowed": used < limit, "used": used, "limit": limit, "plan": sub.plan}

    async def record_dashboard_created(self, user_id: int) -> bool:
        sub = await self._get_active_bi_subscription(user_id)
        if not sub:
            return False
        limits = BI_TIER_LIMITS.get(sub.plan, {})
        limit_key = (
            "yearly_dashboards"
            if sub.billingCycle == "yearly"
            else "monthly_dashboards"
        )
        return await self._increment_usage(
            user_id=user_id,
            metric_type="dashboards_created",
            limit=limits.get(limit_key, 0),
            period_start=sub.startedAt,
            period_end=sub.currentPeriodEnd,
            subscription_id=sub.id,
        )

    # ── Usage Summary (Education + BI) ──────────────────────────────────────

    async def get_usage_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Return full usage breakdown for the current billing period.
        Works for both Education and BI subscriptions.
        """
        ed_sub = await self._get_active_education_subscription(user_id)
        bi_sub = await self._get_active_bi_subscription(user_id)

        if not ed_sub and not bi_sub:
            return {
                "has_subscription": False,
                "plan": None,
                "billing_cycle": None,
                "courses": {"used": 0, "limit": 0},
                "certificates": {"used": 0, "limit": 0},
                "datasets": {"used": 0, "limit": 0},
                "dashboards": {"used": 0, "limit": 0},
                "storage_mb": {"used": 0, "limit": 0},
                "api_calls": {"used": 0, "limit": 0},
                "period_start": None,
                "period_end": None,
            }

        result = {"has_subscription": True, "billing_cycle": None}

        # ── Education usage ──
        if ed_sub:
            result["plan"] = ed_sub.plan
            result["billing_cycle"] = ed_sub.billingCycle
            ed_limits = EDUCATION_TIER_LIMITS.get(ed_sub.plan, {})
            is_annual = ed_sub.billingCycle == "yearly"

            courses_limit = ed_limits.get(
                "yearly_courses" if is_annual else "monthly_courses", 0
            )
            certs_limit = ed_limits.get(
                "yearly_certificates" if is_annual else "monthly_certificates", 0
            )
            courses_used = await self._get_current_usage(
                user_id, "courses_accessed", ed_sub.startedAt, ed_sub.currentPeriodEnd
            )
            certs_used = await self._get_current_usage(
                user_id,
                "certificates_granted",
                ed_sub.startedAt,
                ed_sub.currentPeriodEnd,
            )

            result["courses"] = {"used": courses_used, "limit": courses_limit}
            result["certificates"] = {"used": certs_used, "limit": certs_limit}
            result["period_start"] = ed_sub.startedAt.isoformat()
            result["period_end"] = ed_sub.currentPeriodEnd.isoformat()
        else:
            result["courses"] = {"used": 0, "limit": 0}
            result["certificates"] = {"used": 0, "limit": 0}

        # ── BI usage ──
        if bi_sub:
            result["plan"] = bi_sub.plan
            result["billing_cycle"] = bi_sub.billingCycle
            bi_limits = BI_TIER_LIMITS.get(bi_sub.plan, {})
            is_annual = bi_sub.billingCycle == "yearly"

            datasets_limit = bi_limits.get(
                "yearly_datasets" if is_annual else "monthly_datasets", 0
            )
            dashboards_limit = bi_limits.get(
                "yearly_dashboards" if is_annual else "monthly_dashboards", 0
            )
            storage_limit = bi_limits.get(
                "yearly_storage_mb" if is_annual else "monthly_storage_mb", 0
            )
            api_limit = bi_limits.get(
                "yearly_api_calls" if is_annual else "monthly_api_calls", 0
            )

            datasets_used = await self._count_user_datasets(user_id)
            dashboards_used = await self._count_user_dashboards(user_id)
            storage_used = await self._count_user_storage_mb(user_id)
            api_used = await self._count_user_api_calls(
                user_id, bi_sub.startedAt, bi_sub.currentPeriodEnd
            )

            result["datasets"] = {"used": datasets_used, "limit": datasets_limit}
            result["dashboards"] = {"used": dashboards_used, "limit": dashboards_limit}
            result["storage_mb"] = {"used": storage_used, "limit": storage_limit}
            result["api_calls"] = {"used": api_used, "limit": api_limit}
            result["period_start"] = bi_sub.startedAt.isoformat()
            result["period_end"] = bi_sub.currentPeriodEnd.isoformat()
        else:
            result["datasets"] = {"used": 0, "limit": 0}
            result["dashboards"] = {"used": 0, "limit": 0}
            result["storage_mb"] = {"used": 0, "limit": 0}
            result["api_calls"] = {"used": 0, "limit": 0}

        return result

    # ── Period Reset ───────────────────────────────────────────────────────

    async def reset_period_usage(self, subscription_id: int) -> None:
        logger.info(
            f"Period usage reset acknowledged for subscription {subscription_id}"
        )

    # ── Internals ──────────────────────────────────────────────────────────

    async def _get_active_education_subscription(self, user_id: int):
        return await prisma.subscription.find_first(
            where={
                "userId": user_id,
                "status": {"in": ["ACTIVE", "GRACE_PERIOD"]},
                "plan": {"in": ["STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO"]},
                "currentPeriodEnd": {
                    "gt": datetime.now(timezone.utc) - timedelta(days=7)
                },
            }
        )

    async def _get_active_bi_subscription(self, user_id: int):
        return await prisma.subscription.find_first(
            where={
                "userId": user_id,
                "status": {"in": ["ACTIVE", "GRACE_PERIOD"]},
                "plan": {"in": ["BI_GROWTH", "BI_SCALE", "BI_ELITE"]},
                "currentPeriodEnd": {
                    "gt": datetime.now(timezone.utc) - timedelta(days=7)
                },
            }
        )

    async def _count_user_datasets(self, user_id: int) -> int:
        return await prisma.dataset.count(where={"userId": user_id, "deletedAt": None})

    async def _count_user_dashboards(self, user_id: int) -> int:
        return await prisma.dashboard.count(
            where={"ownerId": user_id, "deletedAt": None}
        )

    async def _count_user_storage_mb(self, user_id: int) -> int:
        datasets = await prisma.dataset.find_many(
            where={"userId": user_id, "deletedAt": None}
        )
        total_bytes = sum(
            d.fileSize for d in datasets if getattr(d, "fileSize", None) is not None
        )
        return total_bytes // (1024 * 1024)

    async def _count_user_api_calls(
        self, user_id: int, period_start: datetime, period_end: datetime
    ) -> int:
        return await prisma.biauditlog.count(
            where={
                "userId": user_id,
                "createdAt": {"gte": period_start, "lte": period_end},
            }
        )

    async def _get_current_usage(
        self,
        user_id: int,
        metric_type: str,
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        tracking = await prisma.usagetracking.find_first(
            where={
                "userId": user_id,
                "metricType": metric_type,
                "periodStart": period_start,
                "periodEnd": period_end,
            }
        )
        return tracking.value if tracking else 0

    async def _increment_usage(
        self,
        user_id: int,
        metric_type: str,
        limit: int,
        period_start: datetime,
        period_end: datetime,
        subscription_id: Optional[int] = None,
    ) -> bool:
        async with prisma.tx() as tx:
            tracking = await tx.usagetracking.find_first(
                where={
                    "userId": user_id,
                    "metricType": metric_type,
                    "periodStart": period_start,
                    "periodEnd": period_end,
                }
            )
            if tracking:
                if tracking.value >= limit:
                    return False
                await tx.usagetracking.update(
                    where={"id": tracking.id}, data={"value": {"increment": 1}}
                )
                return True
            else:
                await tx.usagetracking.create(
                    data={
                        "userId": user_id,
                        "metricType": metric_type,
                        "value": 1,
                        "limit": limit,
                        "periodStart": period_start,
                        "periodEnd": period_end,
                        "subscriptionId": subscription_id,
                    }
                )
                return True


usage_tracking_service = UsageTrackingService()
