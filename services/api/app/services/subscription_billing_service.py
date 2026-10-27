import logging
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.schemas.payment import (
    SubscriptionResponse,
    SubscriptionCreateRequest,
    SubscriptionPlan,
    SubscriptionStatus,
    PaymentPurpose,
)


logger = logging.getLogger(__name__)


class SubscriptionBillingService:
    """Service for subscription management and billing.

    Prices are read from SubscriptionTierConfig table (admin-configurable).
    Falls back to PLAN_PRICES only if config table is unavailable.
    """

    # Fallback plan pricing in whole DZD (used only if DB config unavailable)
    # Research-backed: business plan numbers with 16.7% annual discount (pay 10, get 12)
    PLAN_PRICES = {
        SubscriptionPlan.STUDENT_STARTER: 1900,  # 1,900 DZD/month
        SubscriptionPlan.STUDENT_PLUS: 3400,  # 3,400 DZD/month
        SubscriptionPlan.STUDENT_PRO: 5400,  # 5,400 DZD/month
        SubscriptionPlan.BI_GROWTH: 3500,  # 3,500 DZD/month
        SubscriptionPlan.BI_SCALE: 8000,  # 8,000 DZD/month
        SubscriptionPlan.BI_ELITE: 15000,  # 15,000 DZD/month
        SubscriptionPlan.FREE: 0,
        SubscriptionPlan.CUSTOM: 0,
    }

    # Fallback yearly plan pricing in whole DZD
    PLAN_YEARLY_PRICES = {
        SubscriptionPlan.STUDENT_STARTER: 17900,  # 17,900 DZD/year
        SubscriptionPlan.STUDENT_PLUS: 31900,  # 31,900 DZD/year
        SubscriptionPlan.STUDENT_PRO: 49900,  # 49,900 DZD/year
        SubscriptionPlan.BI_GROWTH: 32900,  # 32,900 DZD/year
        SubscriptionPlan.BI_SCALE: 74900,  # 74,900 DZD/year
        SubscriptionPlan.BI_ELITE: 139900,  # 139,900 DZD/year
        SubscriptionPlan.FREE: 0,
        SubscriptionPlan.CUSTOM: 0,
    }

    # Plan features mapping (fallback — config table is source of truth)
    PLAN_FEATURES = {
        SubscriptionPlan.STUDENT_STARTER: {
            "max_courses": 10,
            "storage_mb": 500,
            "support": "email",
            "analytics": "basic",
        },
        SubscriptionPlan.STUDENT_PLUS: {
            "max_courses": 50,
            "storage_mb": 2000,
            "support": "priority_email",
            "analytics": "advanced",
        },
        SubscriptionPlan.STUDENT_PRO: {
            "max_courses": "unlimited",
            "storage_mb": 10000,
            "support": "24/7_chat",
            "analytics": "premium",
        },
        SubscriptionPlan.BI_GROWTH: {
            "max_datasets": 5,
            "max_dashboards": 10,
            "api_calls": 10000,
            "support": "business_hours",
        },
        SubscriptionPlan.BI_SCALE: {
            "max_datasets": 25,
            "max_dashboards": 50,
            "api_calls": 100000,
            "support": "24/7_phone",
        },
        SubscriptionPlan.BI_ELITE: {
            "max_datasets": 100,
            "max_dashboards": 200,
            "api_calls": 1000000,
            "support": "dedicated_account_manager",
        },
    }

    async def get_plan_price(
        self, plan: SubscriptionPlan, billing_cycle: str = "monthly"
    ) -> int:
        """Get the price for a plan from the config table (single source of truth)."""
        try:
            config = await prisma.subscriptiontierconfig.find_first(
                where={"plan": plan.value, "isActive": True}
            )
            if config:
                if billing_cycle == "yearly" and config.yearlyPrice is not None:
                    return config.yearlyPrice
                return config.price
        except Exception as e:
            logger.warning(f"Failed to fetch plan price from config: {e}")
        if billing_cycle == "yearly":
            return self.PLAN_YEARLY_PRICES.get(plan, 0)
        return self.PLAN_PRICES.get(plan, 0)

    async def create_subscription(
        self, request: SubscriptionCreateRequest
    ) -> SubscriptionResponse:
        """Create a new subscription"""
        try:
            # Validate entity exists
            if request.user_id:
                user = await prisma.user.find_unique(where={"id": request.user_id})
                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.subscription.user_not_found",
                    )
            elif request.organization_id:
                org = await prisma.organization.find_unique(
                    where={"id": request.organization_id}
                )
                if not org:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.subscription.org_not_found",
                    )

            # Check for existing active subscription
            existing = await self._get_active_subscription(
                request.user_id, request.organization_id
            )

            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.subscription.already_exists",
                )

            # Get plan price from config table (single source of truth)
            amount = await self.get_plan_price(request.plan, request.billing_cycle)

            if request.plan == SubscriptionPlan.CUSTOM:
                # Custom pricing requires manual setup
                amount = 0

            # Calculate billing period
            current_period_start = datetime.now(timezone.utc)

            if request.billing_cycle == "yearly":
                current_period_end = current_period_start + timedelta(days=365)
            else:
                current_period_end = current_period_start + timedelta(days=30)

            # Create subscription
            metadata_dict = {
                "features": self.PLAN_FEATURES.get(request.plan, {}),
                "created_via": "api",
            }

            subscription_data = {
                "plan": request.plan.value,
                "status": SubscriptionStatus.ACTIVE.value,
                "startedAt": current_period_start,
                "currentPeriodStart": current_period_start,
                "currentPeriodEnd": current_period_end,
                "amount": amount,
                "currency": "DZD",
                "billingCycle": request.billing_cycle,
                "autoRenew": request.auto_renew,
                "metadata": Json(metadata_dict),
            }

            # Add entity references
            if request.user_id:
                subscription_data["userId"] = request.user_id
            if request.organization_id:
                subscription_data["organizationId"] = request.organization_id
            if request.payment_method_id:
                subscription_data["paymentMethodId"] = request.payment_method_id

            subscription = await prisma.subscription.create(data=subscription_data)

            # Send subscription confirmation email
            try:
                from app.services.email_service import email_service

                if request.user_id:
                    sub_user = await prisma.user.find_unique(
                        where={"id": request.user_id}
                    )
                    if sub_user and sub_user.email:
                        await email_service.send_subscription_email(
                            email=sub_user.email,
                            name=sub_user.fullName or "User",
                            plan=subscription.plan,
                            amount=f"{amount:.2f} DZD/{request.billing_cycle}",
                            status="Active",
                            started=current_period_start.strftime("%Y-%m-%d"),
                            renewal=current_period_end.strftime("%Y-%m-%d"),
                            user_id=request.user_id,
                        )
            except Exception as ex:
                logger.warning(f"Failed to send subscription email: {ex}")

            logger.info(
                f"Created subscription {subscription.id} for plan {request.plan}"
            )

            # Create initial payment transaction if amount > 0
            if amount > 0:
                await self._create_initial_payment(subscription, request)

            return SubscriptionResponse.from_orm(subscription)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.subscription.create_failed",
            )

    async def _get_active_subscription(
        self, user_id: Optional[int], organization_id: Optional[int]
    ):
        """Get active subscription for entity"""
        where_clause = {"status": SubscriptionStatus.ACTIVE.value}

        if user_id:
            where_clause["userId"] = user_id
        elif organization_id:
            where_clause["organizationId"] = organization_id

        return await prisma.subscription.find_first(where=where_clause)

    async def _create_initial_payment(
        self, subscription, request: SubscriptionCreateRequest
    ):
        """Create initial payment transaction for subscription"""

        purpose = PaymentPurpose.STUDENT_SUBSCRIPTION
        if subscription.plan.startswith("BI_"):
            purpose = PaymentPurpose.BI_SUBSCRIPTION

        # Create transaction record
        await prisma.transaction.create(
            data={
                "subscriptionId": subscription.id,
                "amount": subscription.amount,
                "currency": subscription.currency,
                "purpose": purpose.value,
                "status": "PENDING",  # Will be completed via payment
                "provider": "SUBSCRIPTION",
                "metadata": Json(
                    {
                        "plan": subscription.plan,
                        "billing_cycle": subscription.billingCycle,
                        "period_start": subscription.currentPeriodStart.isoformat(),
                        "period_end": subscription.currentPeriodEnd.isoformat(),
                    }
                ),
            }
        )

    async def get_subscription(
        self, subscription_id: int
    ) -> Optional[SubscriptionResponse]:
        """Get subscription by ID"""
        subscription = await prisma.subscription.find_unique(
            where={"id": subscription_id},
            include={"user": True, "organization": True, "paymentMethod": True},
        )

        if subscription:
            return SubscriptionResponse.from_orm(subscription)
        return None

    async def get_user_subscriptions(
        self, user_id: int, include_inactive: bool = False
    ) -> List[SubscriptionResponse]:
        """Get all subscriptions for user"""
        where_clause = {"userId": user_id}

        if not include_inactive:
            where_clause["status"] = SubscriptionStatus.ACTIVE.value

        subscriptions = await prisma.subscription.find_many(
            where=where_clause, order={"startedAt": "desc"}
        )

        return [SubscriptionResponse.from_orm(sub) for sub in subscriptions]

    async def get_organization_subscriptions(
        self, organization_id: int, include_inactive: bool = False
    ) -> List[SubscriptionResponse]:
        """Get all subscriptions for organization"""
        where_clause = {"organizationId": organization_id}

        if not include_inactive:
            where_clause["status"] = SubscriptionStatus.ACTIVE.value

        subscriptions = await prisma.subscription.find_many(
            where=where_clause, order={"startedAt": "desc"}
        )

        return [SubscriptionResponse.from_orm(sub) for sub in subscriptions]

    async def update_subscription(
        self,
        subscription_id: int,
        plan: Optional[SubscriptionPlan] = None,
        auto_renew: Optional[bool] = None,
    ) -> SubscriptionResponse:
        """Update subscription plan or settings"""
        try:
            subscription = await prisma.subscription.find_unique(
                where={"id": subscription_id}
            )

            if not subscription:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.subscription_not_found",
                )

            update_data = {}

            if plan and plan.value != subscription.plan:
                # Plan change logic
                update_data["plan"] = plan.value

                # Update price from config table (single source of truth)
                new_price = await self.get_plan_price(plan)
                if new_price != subscription.amount:
                    update_data["amount"] = new_price

                # Update metadata with new features
                current_metadata = subscription.metadata or {}
                current_metadata["features"] = self.PLAN_FEATURES.get(plan, {})
                update_data["metadata"] = Json(current_metadata)

                # Pro-rate if changing mid-period (simplified logic)
                if subscription.status == SubscriptionStatus.ACTIVE.value:
                    await self._handle_plan_change_proration(subscription, plan)

            if auto_renew is not None:
                update_data["autoRenew"] = auto_renew

            if update_data:
                update_data["updatedAt"] = datetime.now(timezone.utc)
                updated = await prisma.subscription.update(
                    where={"id": subscription_id}, data=update_data
                )

                logger.info(f"Updated subscription {subscription_id}")
                return SubscriptionResponse.from_orm(updated)

            return SubscriptionResponse.from_orm(subscription)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to update subscription: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.subscription.update_failed",
            )

    async def _handle_plan_change_proration(
        self, subscription, new_plan: SubscriptionPlan
    ):
        """Handle proration for plan changes"""
        # Simplified proration logic
        # In production, implement proper proration based on days remaining
        days_used = (datetime.now(timezone.utc) - subscription.currentPeriodStart).days
        days_in_period = (
            subscription.currentPeriodEnd - subscription.currentPeriodStart
        ).days
        days_remaining = days_in_period - days_used

        if days_remaining > 0:
            old_daily_rate = subscription.amount / days_in_period
            new_plan_price = await self.get_plan_price(new_plan)
            new_daily_rate = new_plan_price / 30  # Assuming 30-day month

            credit = old_daily_rate * days_remaining
            charge = new_daily_rate * days_remaining

            # Create proration transaction
            await prisma.transaction.create(
                data={
                    "subscriptionId": subscription.id,
                    "amount": int(charge - credit),
                    "currency": subscription.currency,
                    "purpose": "PLAN_CHANGE_PRORATION",
                    "status": "PENDING",
                    "provider": "SYSTEM",
                    "metadata": Json(
                        {
                            "old_plan": subscription.plan,
                            "new_plan": new_plan.value,
                            "days_used": days_used,
                            "days_remaining": days_remaining,
                            "old_daily_rate": old_daily_rate,
                            "new_daily_rate": new_daily_rate,
                        }
                    ),
                }
            )

    async def cancel_subscription(
        self, subscription_id: int, immediate: bool = False
    ) -> SubscriptionResponse:
        """Cancel subscription"""
        try:
            subscription = await prisma.subscription.find_unique(
                where={"id": subscription_id}
            )

            if not subscription:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.subscription_not_found",
                )

            if subscription.status != SubscriptionStatus.ACTIVE.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.subscription.not_active",
                )

            update_data = {
                "status": SubscriptionStatus.CANCELLED.value,
                "cancelledAt": datetime.now(timezone.utc),
                "autoRenew": False,
            }

            if immediate:
                # End immediately
                update_data["endsAt"] = datetime.now(timezone.utc)
            else:
                # End at period end
                update_data["endsAt"] = subscription.currentPeriodEnd

            updated = await prisma.subscription.update(
                where={"id": subscription_id}, data=update_data
            )

            logger.info(f"Cancelled subscription {subscription_id}")

            # Send subscription cancellation email
            try:
                from app.services.email_service import email_service

                if subscription.userId:
                    sub_user = await prisma.user.find_unique(
                        where={"id": subscription.userId}
                    )
                    if sub_user and sub_user.email:
                        await email_service.send_subscription_email(
                            email=sub_user.email,
                            name=sub_user.fullName or "User",
                            plan=subscription.plan,
                            amount=f"{(subscription.amount or 0):.2f} {subscription.currency or 'DZD'}",
                            status="Cancelled",
                            started=subscription.startedAt.strftime("%Y-%m-%d")
                            if subscription.startedAt
                            else "",
                            renewal=subscription.currentPeriodEnd.strftime("%Y-%m-%d")
                            if subscription.currentPeriodEnd
                            else "",
                            user_id=subscription.userId,
                        )
            except Exception as ex:
                logger.warning(f"Failed to send subscription cancellation email: {ex}")

            return SubscriptionResponse.from_orm(updated)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.subscription.cancel_failed",
            )

    async def pause_subscription(self, subscription_id: int) -> SubscriptionResponse:
        """Pause subscription"""
        subscription = await prisma.subscription.find_unique(
            where={"id": subscription_id}
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found",
            )

        if subscription.status != SubscriptionStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.subscription.not_active",
            )

        updated = await prisma.subscription.update(
            where={"id": subscription_id},
            data={
                "status": SubscriptionStatus.PAUSED.value,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        logger.info(f"Paused subscription {subscription_id}")
        return SubscriptionResponse.from_orm(updated)

    async def resume_subscription(self, subscription_id: int) -> SubscriptionResponse:
        """Resume paused subscription"""
        subscription = await prisma.subscription.find_unique(
            where={"id": subscription_id}
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found",
            )

        if subscription.status != SubscriptionStatus.PAUSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.subscription.not_paused",
            )

        updated = await prisma.subscription.update(
            where={"id": subscription_id},
            data={
                "status": SubscriptionStatus.ACTIVE.value,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        logger.info(f"Resumed subscription {subscription_id}")
        return SubscriptionResponse.from_orm(updated)

    async def process_renewals(self):
        """Process subscription renewals (cron job)"""
        try:
            logger.info("Processing subscription renewals...")

            # Find subscriptions due for renewal
            now = datetime.now(timezone.utc)
            renewals_due = await prisma.subscription.find_many(
                where={
                    "status": SubscriptionStatus.ACTIVE.value,
                    "autoRenew": True,
                    "currentPeriodEnd": {
                        "lte": now + timedelta(days=1)
                    },  # Due in next 24h
                },
                include={"user": True, "organization": True, "paymentMethod": True},
            )

            logger.info(f"Found {len(renewals_due)} subscriptions due for renewal")

            for subscription in renewals_due:
                try:
                    await self._renew_subscription(subscription)
                except Exception as e:
                    logger.error(
                        f"Failed to renew subscription {subscription.id}: {str(e)}"
                    )
                    # Mark for grace period
                    await self._handle_failed_renewal(subscription)

            logger.info("Subscription renewals processing completed")

        except Exception as e:
            logger.error(f"Failed to process renewals: {str(e)}")

    async def _renew_subscription(self, subscription):
        """Renew a single subscription — creates a Chargily checkout for the user to pay."""
        from app.generated.prisma import enums, fields
        from app.core.config import setting
        from app.services.billing_services.billing_core_service import (
            billing_core_service,
        )
        from app.schemas.billing_schemas.base import CheckoutInitiate

        new_period_start = subscription.currentPeriodEnd
        if subscription.billingCycle == "yearly":
            new_period_end = new_period_start + timedelta(days=365)
        else:
            new_period_end = new_period_start + timedelta(days=30)

        purpose = (
            "STUDENT_SUBSCRIPTION"
            if subscription.plan.startswith("STUDENT_")
            else "BI_SUBSCRIPTION"
        )
        purpose_enum = enums.PaymentPurpose[purpose]
        from app.schemas.payment import PaymentPurpose as PaymentPurposeEnum

        purpose_key = (
            PaymentPurposeEnum.STUDENT_SUBSCRIPTION
            if "STUDENT" in subscription.plan
            else PaymentPurposeEnum.BI_SUBSCRIPTION
        )

        if subscription.amount > 0:
            # Idempotency check: Skip if an active pending renewal checkout was created in the last 24h
            existing_pending = await prisma.transaction.find_first(
                where={
                    "subscriptionId": subscription.id,
                    "status": "PENDING",
                    "createdAt": {
                        "gte": datetime.now(timezone.utc) - timedelta(hours=24)
                    },
                }
            )
            if existing_pending:
                logger.info(
                    f"Renewal checkout already active for subscription {subscription.id} (tx {existing_pending.id}), skipping duplicate generation."
                )
                return

            frontend = (setting.FRONTEND_URL or "http://localhost:3000").rstrip("/")

            # Create a PENDING transaction
            renewal_tx = await prisma.transaction.create(
                data={
                    "subscriptionId": subscription.id,
                    "amount": subscription.amount,
                    "currency": subscription.currency,
                    "purpose": purpose_enum,
                    "status": enums.PaymentStatus.PENDING,
                    "provider": enums.PaymentProvider.CHARGILY,
                    "gateway": enums.PaymentGateway.CHARGILY,
                    "userId": subscription.userId,
                    "metadata": fields.Json(
                        {
                            "renewal": True,
                            "renewal_period": {
                                "start": new_period_start.isoformat(),
                                "end": new_period_end.isoformat(),
                            },
                        }
                    ),
                }
            )

            # Create a real Chargily checkout so the user can pay
            try:
                checkout = await billing_core_service.initiate_chargily_checkout(
                    transaction_id=renewal_tx.id,
                    request=CheckoutInitiate(
                        amount=subscription.amount,
                        purpose=purpose_key,
                        success_url=f"{frontend}/billing?renewal=success",
                        failure_url=f"{frontend}/billing?renewal=failure",
                        metadata={
                            "renewal": True,
                            "subscription_id": subscription.id,
                            "renewal_period_start": new_period_start.isoformat(),
                            "renewal_period_end": new_period_end.isoformat(),
                        },
                    ),
                )
                logger.info(
                    f"Created renewal checkout {checkout.id} for subscription {subscription.id} "
                    f"({subscription.amount} DZD) — tx {renewal_tx.id}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to create Chargily checkout for renewal tx {renewal_tx.id}: {e}"
                )
        else:
            # Free plan — just extend the period
            await prisma.subscription.update(
                where={"id": subscription.id},
                data={
                    "currentPeriodStart": new_period_start,
                    "currentPeriodEnd": new_period_end,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )
            logger.info(
                f"Renewed free subscription {subscription.id} until {new_period_end}"
            )

        # Do NOT update period here — it stays unchanged until payment completes.
        # The handle_subscription_payment callback (triggered by webhook) handles
        # period extension when the renewal transaction is marked COMPLETED.

    async def _handle_failed_renewal(self, subscription):
        """Handle failed subscription renewal"""
        # Enter grace period (7 days)
        now = datetime.now(timezone.utc)

        await prisma.subscription.update(
            where={"id": subscription.id},
            data={"status": SubscriptionStatus.GRACE_PERIOD.value, "updatedAt": now},
        )

        # Create a failed transaction that tracks the dunning schedule
        purpose = (
            "STUDENT_SUBSCRIPTION"
            if subscription.plan.startswith("STUDENT_")
            else "BI_SUBSCRIPTION"
        )

        await prisma.transaction.create(
            data={
                "subscriptionId": subscription.id,
                "amount": subscription.amount,
                "currency": subscription.currency,
                "purpose": purpose,
                "status": "FAILED",
                "provider": "SUBSCRIPTION_RENEWAL",
                "metadata": Json(
                    {
                        "dunning_retries": 0,
                        "failed_at": now.isoformat(),
                        "next_retry_at": (now + timedelta(days=1)).isoformat(),
                    }
                ),
            }
        )

        logger.warning(
            f"Subscription {subscription.id} entered grace period. Scheduled dunning retry 1 in 24 hours."
        )

    async def process_dunning_retries(self):
        """Process active dunning retries for failed subscriptions (cron job)"""
        try:
            logger.info("Processing subscription dunning retries...")
            now = datetime.now(timezone.utc)

            # Find all failed subscription transactions with dunning retries scheduled
            failed_transactions = await prisma.transaction.find_many(
                where={
                    "status": "FAILED",
                    "provider": "SUBSCRIPTION_RENEWAL",
                    "subscriptionId": {"not": None},
                },
                include={"subscription": True},
            )

            for tx in failed_transactions:
                sub = tx.subscription
                if not sub or sub.status != SubscriptionStatus.GRACE_PERIOD.value:
                    continue

                # Check metadata for retry info
                meta = tx.metadata or {}
                if not isinstance(meta, dict):
                    continue

                next_retry_str = meta.get("next_retry_at")
                if not next_retry_str:
                    continue

                next_retry = datetime.fromisoformat(
                    next_retry_str.replace("Z", "+00:00")
                )
                if next_retry.tzinfo is None:
                    next_retry = next_retry.replace(tzinfo=timezone.utc)

                if now >= next_retry:
                    # 1. Verify if user has already paid via another transaction
                    paid_tx = await prisma.transaction.find_first(
                        where={
                            "subscriptionId": sub.id,
                            "status": "COMPLETED",
                            "createdAt": {"gte": tx.createdAt},
                        }
                    )
                    if paid_tx:
                        await prisma.subscription.update(
                            where={"id": sub.id},
                            data={
                                "status": SubscriptionStatus.ACTIVE.value,
                                "updatedAt": now,
                            },
                        )
                        await prisma.transaction.update(
                            where={"id": tx.id},
                            data={
                                "status": "RESOLVED",
                                "metadata": Json(
                                    {
                                        "resolved_via_tx": paid_tx.id,
                                        "resolved_at": now.isoformat(),
                                    }
                                ),
                            },
                        )
                        logger.info(
                            f"Dunning resolved for subscription {sub.id} via completed transaction {paid_tx.id}"
                        )
                        continue

                    # 2. Increment dunning retry count
                    retries = meta.get("dunning_retries", 0) + 1
                    logger.info(
                        f"Processing dunning retry {retries}/3 for subscription {sub.id}"
                    )

                    if retries >= 3:
                        # 3 retries failed (Day 1, 3, 5). Expire subscription and revoke entitlements.
                        await prisma.subscription.update(
                            where={"id": sub.id},
                            data={
                                "status": SubscriptionStatus.EXPIRED.value,
                                "updatedAt": now,
                            },
                        )
                        await prisma.transaction.update(
                            where={"id": tx.id},
                            data={
                                "metadata": Json(
                                    {
                                        "dunning_retries": retries,
                                        "failed_at": meta.get("failed_at"),
                                        "status": "Dunning retries exhausted. Subscription expired.",
                                    }
                                )
                            },
                        )
                        try:
                            from app.services.billing_services.entitlement_service import (
                                entitlement_service,
                            )

                            await entitlement_service.revoke_entitlements_by_source(
                                str(sub.id), user_id=sub.userId
                            )
                        except Exception as rev_err:
                            logger.warning(
                                f"Failed to revoke entitlements for expired sub {sub.id}: {rev_err}"
                            )

                        logger.warning(
                            f"Dunning retries exhausted for subscription {sub.id}. Subscription is now EXPIRED."
                        )
                    else:
                        # Prompt user for renewal payment via Chargily checkout
                        try:
                            await self._renew_subscription(sub)
                        except Exception as ren_err:
                            logger.warning(
                                f"Renewal checkout generation failed during dunning: {ren_err}"
                            )

                        delay_days = 2
                        next_retry_at = now + timedelta(days=delay_days)
                        await prisma.transaction.update(
                            where={"id": tx.id},
                            data={
                                "metadata": Json(
                                    {
                                        "dunning_retries": retries,
                                        "failed_at": meta.get("failed_at"),
                                        "next_retry_at": next_retry_at.isoformat(),
                                    }
                                )
                            },
                        )
                        logger.info(
                            f"Dunning retry {retries} scheduled next retry in {delay_days} days for subscription {sub.id}."
                        )

            logger.info("Subscription dunning retries processing completed")
        except Exception as e:
            logger.error(f"Failed to process dunning retries: {str(e)}")

    async def check_subscription_access(
        self, user_id: Optional[int], organization_id: Optional[int], feature: str
    ) -> bool:
        """Check if entity has access to a specific feature"""
        subscription = await self._get_active_subscription(user_id, organization_id)

        if not subscription:
            return False

        # Free plan has limited access
        if subscription.plan == SubscriptionPlan.FREE.value:
            free_features = ["basic_courses", "limited_storage"]
            return feature in free_features

        # Check plan features
        features = self.PLAN_FEATURES.get(SubscriptionPlan(subscription.plan), {})

        if feature in features:
            value = features[feature]
            if value == "unlimited":
                return True
            # Additional logic for numeric limits
            return True

        return False

    async def handle_subscription_payment(self, transaction):
        """Handle subscription payment completion — extends period for renewal payments."""
        if not transaction.subscriptionId:
            return

        subscription = await prisma.subscription.find_unique(
            where={"id": transaction.subscriptionId}
        )

        if not subscription:
            return

        metadata = transaction.metadata or {}
        is_renewal = metadata.get("renewal") if isinstance(metadata, dict) else False

        if is_renewal:
            # Renewal payment completed — extend the period
            renewal_period = (
                metadata.get("renewal_period", {}) if isinstance(metadata, dict) else {}
            )
            new_end_str = (
                renewal_period.get("end") if isinstance(renewal_period, dict) else None
            )

            if new_end_str:
                new_end = datetime.fromisoformat(new_end_str)
                new_start = subscription.currentPeriodEnd
            else:
                new_start = subscription.currentPeriodEnd
                if subscription.billingCycle == "yearly":
                    new_end = new_start + timedelta(days=365)
                else:
                    new_end = new_start + timedelta(days=30)

            await prisma.subscription.update(
                where={"id": subscription.id},
                data={
                    "currentPeriodStart": new_start,
                    "currentPeriodEnd": new_end,
                    "status": SubscriptionStatus.ACTIVE.value,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )
            logger.info(
                f"Subscription {subscription.id} renewed via payment — period extended to {new_end}"
            )
        elif subscription.status == "PENDING_PAYMENT":
            await prisma.subscription.update(
                where={"id": subscription.id},
                data={
                    "status": SubscriptionStatus.ACTIVE.value,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )


subscription_service = SubscriptionBillingService()
