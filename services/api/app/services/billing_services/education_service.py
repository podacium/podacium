"""
Education Billing Service

Handles education-specific billing logic:
- One-time course purchases (lifetime access + enrollment)
- One-time path purchases (lifetime access to all courses + enrollments)
- Subscription-based access (tiered limits on courses and certificates)

Certificates are NEVER issued at purchase time — only after completion
eligibility is verified (see certificate_service.check_module_eligibility).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from app.core.prisma import prisma
from app.services.billing_services.entitlement_service import entitlement_service
from app.services.billing_services.usage_tracking_service import usage_tracking_service
from app.services.billing_services.billing_core_service import (
    is_price_verified,
    ENTITLEMENT_PURPOSES,
)
from app.services.wallet_service import wallet_service
from app.schemas.billing_schemas.base import (
    SubscriptionPlan,
    SubscriptionStatus,
    PaymentPurpose,
)

logger = logging.getLogger(__name__)


class EducationBillingService:
    """
    Handles education-specific billing logic:
    - One-time purchases (course / path) → lifetime access + enrollment
    - Subscriptions → tiered access with course & certificate limits
    """

    # ── Entitlement Granting (called after payment success) ────────────────

    async def grant_entitlements(self, transaction_id: int) -> None:
        """
        Grants entitlements based on a successful transaction.
        Dispatches to the appropriate handler based on payment purpose.
        """
        transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
        if not transaction or not transaction.userId:
            logger.warning(f"grant_entitlements: invalid transaction {transaction_id}")
            return

        purpose = transaction.purpose
        user_id = transaction.userId
        metadata = transaction.metadata or {}

        # Reject transactions without server price verification — they may have been created with a client-supplied amount.
        if purpose in {p.value for p in ENTITLEMENT_PURPOSES}:
            if not is_price_verified(metadata):
                logger.error(
                    f"BLOCKED entitlement grant: transaction {transaction_id} "
                    f"(purpose={purpose}) lacks server price verification marker."
                )
                return

            # Verify paid amount matches authoritative current DB price
            course_id = metadata.get("course_id") or metadata.get("module_id")
            if course_id:
                module = await prisma.module.find_unique(
                    where={"id": course_id},
                )
                if not module:
                    logger.error(
                        f"BLOCKED entitlement grant: module {course_id} not found"
                    )
                    return
                db_price = self._parse_price(module.price)
                paid_amount = transaction.amount
                base_price = (
                    db_price.get("discounted")
                    if db_price.get("discounted") is not None
                    else (db_price.get("original") or 0)
                )
                discount = int(
                    metadata.get("discount_amount")
                    or metadata.get("coupon_discount")
                    or 0
                )
                expected = max(0, base_price - discount)
                if paid_amount != expected:
                    logger.error(
                        f"BLOCKED entitlement grant: price mismatch for tx {transaction_id}. "
                        f"Paid {paid_amount}, expected {expected} (base {base_price}, discount {discount}) from DB."
                    )
                    return
            elif purpose in {
                PaymentPurpose.COURSE_PURCHASE.value,
                PaymentPurpose.CERTIFICATE_PURCHASE.value,
            }:
                logger.error(
                    f"BLOCKED entitlement grant: transaction {transaction_id} lacks course_id/module_id"
                )
                return

        if purpose == PaymentPurpose.COURSE_PURCHASE.value:
            await self._handle_course_purchase(user_id, metadata, transaction.id)

        elif purpose == PaymentPurpose.PATH_PURCHASE.value:
            await self._handle_path_purchase(user_id, metadata, transaction.id)

        elif purpose == PaymentPurpose.STUDENT_SUBSCRIPTION.value:
            await self._handle_subscription_activation(user_id, metadata, transaction)

        elif purpose == PaymentPurpose.CERTIFICATE_PURCHASE.value:
            await self._handle_certificate_purchase(user_id, metadata, transaction.id)

        logger.info(
            f"Entitlements granted for transaction {transaction_id} "
            f"(purpose={purpose}, user={user_id})"
        )

    # ── One-Time Course Purchase ───────────────────────────────────────────

    async def _handle_course_purchase(
        self, user_id: int, metadata: dict, transaction_id: int
    ) -> None:
        """Grants a lifetime course entitlement, enrollment record, and creator royalties.

        Certificates are never issued at purchase time — only after the user
        completes all lessons and passes all quizzes.
        """
        course_id = metadata.get("course_id")
        if not course_id:
            logger.error("Course purchase missing course_id in metadata")
            return

        # 1. Grant lifetime entitlement
        await entitlement_service.grant_entitlement(
            user_id=user_id,
            entitlement_type="course",
            resource_id=str(course_id),
            source_type="purchase",
            source_id=str(transaction_id),
            expires_at=None,  # Lifetime
        )

        # 2. Create enrollment
        await self._ensure_enrollment(
            user_id, course_id=str(course_id), transaction_id=transaction_id
        )

        # 3. Creator Royalty Payout (80% creator split credited to instructor wallet)
        try:
            module = await prisma.module.find_unique(where={"id": str(course_id)})
            if module and module.instructorId:
                transaction = await prisma.transaction.find_unique(
                    where={"id": transaction_id}
                )
                paid_amount = transaction.amount if transaction else 0
                if paid_amount > 0:
                    royalty_amount = int(paid_amount * 0.80)
                    if royalty_amount > 0:
                        royalty_ref = f"royalty:tx_{transaction_id}:mod_{course_id}"
                        # Idempotency check: don't double-credit if already processed
                        existing_credit = await prisma.wallettransaction.find_first(
                            where={"referenceId": royalty_ref, "type": "CREDIT"}
                        )
                        if not existing_credit:
                            instructor_wallet = await wallet_service.ensure_user_wallet(
                                module.instructorId
                            )
                            await wallet_service.credit_wallet(
                                wallet_id=instructor_wallet.id,
                                amount=royalty_amount,
                                purpose=PaymentPurpose.CREATOR_ROYALTY,
                                reference_id=royalty_ref,
                                description=f"Royalty for course purchase: {module.title}",
                                skip_transaction=True,
                            )
                            latest_wt = await prisma.wallettransaction.find_first(
                                where={
                                    "referenceId": royalty_ref,
                                    "type": "CREDIT",
                                },
                                order={"id": "desc"},
                            )
                            if latest_wt:
                                await prisma.wallettransaction.update(
                                    where={"id": latest_wt.id},
                                    data={
                                        "metadata": {
                                            "course_id": module.id,
                                            "course_title": module.title,
                                            "transaction_id": transaction_id,
                                            "gross_amount": paid_amount,
                                            "royalty_rate": 0.80,
                                        }
                                    },
                                )
                            logger.info(
                                f"Credited {royalty_amount} DZD royalty to instructor {module.instructorId} for course {course_id}"
                            )
        except Exception as e:
            logger.error(
                f"Failed to credit creator royalty for course {course_id}: {e}",
                exc_info=True,
            )

    # ── One-Time Path Purchase ─────────────────────────────────────────────

    async def _handle_path_purchase(
        self, user_id: int, metadata: dict, transaction_id: int
    ) -> None:
        """Grants lifetime entitlements for the path and all its courses, plus enrollment records and creator royalties.

        Certificates are never issued at purchase time — only after completion is verified.
        """
        path_id = metadata.get("path_id")
        if not path_id:
            logger.error("Path purchase missing path_id in metadata")
            return

        # 1. Grant lifetime path entitlement
        await entitlement_service.grant_entitlement(
            user_id=user_id,
            entitlement_type="path",
            resource_id=str(path_id),
            source_type="purchase",
            source_id=str(transaction_id),
            expires_at=None,
        )

        # 2. Create path enrollment
        await self._ensure_enrollment(
            user_id, path_id=str(path_id), transaction_id=transaction_id
        )

        # 3. Enroll in all courses within the path
        path_modules = await prisma.pathmodule.find_many(
            where={"pathId": str(path_id)},
            include={"module": True},
        )

        for pm in path_modules:
            module_id = pm.moduleId

            # Grant course entitlement
            await entitlement_service.grant_entitlement(
                user_id=user_id,
                entitlement_type="course",
                resource_id=module_id,
                source_type="purchase",
                source_id=str(transaction_id),
                expires_at=None,
            )

            # Create course enrollment
            await self._ensure_enrollment(
                user_id, course_id=module_id, transaction_id=transaction_id
            )

        # 4. Creator Royalty Payout for Path (80% split distributed across path module instructors)
        try:
            modules_with_instructors = [
                pm.module for pm in path_modules if pm.module and pm.module.instructorId
            ]
            if modules_with_instructors:
                transaction = await prisma.transaction.find_unique(
                    where={"id": transaction_id}
                )
                paid_amount = transaction.amount if transaction else 0
                if paid_amount > 0:
                    total_royalty = int(paid_amount * 0.80)
                    per_mod_royalty = total_royalty // len(modules_with_instructors)
                    if per_mod_royalty > 0:
                        for mod in modules_with_instructors:
                            royalty_ref = f"royalty:tx_{transaction_id}:path_{path_id}:mod_{mod.id}"
                            existing_credit = await prisma.wallettransaction.find_first(
                                where={
                                    "referenceId": royalty_ref,
                                    "type": "CREDIT",
                                }
                            )
                            if not existing_credit:
                                instructor_wallet = (
                                    await wallet_service.ensure_user_wallet(
                                        mod.instructorId
                                    )
                                )
                                await wallet_service.credit_wallet(
                                    wallet_id=instructor_wallet.id,
                                    amount=per_mod_royalty,
                                    purpose=PaymentPurpose.CREATOR_ROYALTY,
                                    reference_id=royalty_ref,
                                    description=f"Royalty for path purchase: {mod.title}",
                                    skip_transaction=True,
                                )
                                latest_wt = await prisma.wallettransaction.find_first(
                                    where={
                                        "referenceId": royalty_ref,
                                        "type": "CREDIT",
                                    },
                                    order={"id": "desc"},
                                )
                                if latest_wt:
                                    await prisma.wallettransaction.update(
                                        where={"id": latest_wt.id},
                                        data={
                                            "metadata": {
                                                "course_id": mod.id,
                                                "course_title": mod.title,
                                                "path_id": str(path_id),
                                                "transaction_id": transaction_id,
                                                "royalty_share": per_mod_royalty,
                                            }
                                        },
                                    )
                                logger.info(
                                    f"Credited {per_mod_royalty} DZD path royalty to instructor {mod.instructorId} for {mod.id}"
                                )
        except Exception as e:
            logger.error(
                f"Failed to credit creator royalty for path {path_id}: {e}",
                exc_info=True,
            )

    # ── Subscription Activation ────────────────────────────────────────────

    async def _handle_subscription_activation(
        self, user_id: int, metadata: dict, transaction
    ) -> None:
        """
        Subscription activation grants:
        1. Subscription record (upsert)
        2. Feature entitlement with expiry
        """
        plan_name = metadata.get("plan")
        billing_cycle = metadata.get("billing_cycle", "monthly")

        if not plan_name:
            logger.error("Subscription missing plan in metadata")
            return

        await self._create_or_renew_subscription(
            user_id=user_id,
            plan=SubscriptionPlan(plan_name),
            amount=transaction.amount,
            billing_cycle=billing_cycle,
            transaction_id=transaction.id,
        )

    # ── Standalone Certificate Purchase ────────────────────────────────────

    async def _handle_certificate_purchase(
        self, user_id: int, metadata: dict, transaction_id: int
    ) -> None:
        """Grant a certificate from a standalone purchase — bypasses subscription limits."""
        module_id = metadata.get("module_id")
        if not module_id:
            logger.error(f"Certificate purchase {transaction_id} missing module_id")
            return
        await self._grant_certificate(user_id, module_id=module_id)
        logger.info(
            f"Certificate granted via standalone purchase for user={user_id} module={module_id}"
        )

    async def _create_or_renew_subscription(
        self,
        user_id: int,
        plan: SubscriptionPlan,
        amount: int,
        billing_cycle: str,
        transaction_id: int,
    ) -> None:
        """Creates or renews a subscription record and grants access."""
        now = datetime.now(timezone.utc)
        expiry = now + (
            timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30)
        )

        subscription = await prisma.subscription.upsert(
            where={
                "userId_plan": {
                    "userId": user_id,
                    "plan": plan.value,
                }
            },
            data={
                "create": {
                    "userId": user_id,
                    "plan": plan.value,
                    "status": SubscriptionStatus.ACTIVE.value,
                    "startedAt": now,
                    "currentPeriodEnd": expiry,
                    "amount": amount,
                    "billingCycle": billing_cycle,
                },
                "update": {
                    "status": SubscriptionStatus.ACTIVE.value,
                    "currentPeriodEnd": expiry,
                    "amount": amount,
                    "cancelledAt": None,
                },
            },
        )

        # Connect transaction to subscription
        await prisma.transaction.update(
            where={"id": transaction_id},
            data={"subscriptionId": subscription.id},
        )

        # Grant feature entitlement with expiry
        await entitlement_service.grant_entitlement(
            user_id=user_id,
            entitlement_type="feature",
            resource_id=plan.value.lower(),
            source_type="subscription",
            source_id=str(subscription.id),
            expires_at=expiry,
        )

        logger.info(f"Subscription {subscription.id} activated for user {user_id}")

    # ── Subscription Cancellation ──────────────────────────────────────────

    async def cancel_subscription(self, subscription_id: int) -> None:
        """
        Cancel a subscription. It remains ACTIVE until currentPeriodEnd.
        """
        await prisma.subscription.update(
            where={"id": subscription_id},
            data={
                "status": SubscriptionStatus.CANCELLED.value,
                "cancelledAt": datetime.now(timezone.utc),
            },
        )
        logger.info(
            f"Subscription {subscription_id} cancelled (will expire at period end)"
        )

    # ── Subscription-Based Course Access ───────────────────────────────────

    async def can_access_course_via_subscription(
        self, user_id: int, course_id: str
    ) -> bool:
        """
        Check if a subscription user can access another course.
        First checks one-time purchase entitlement, then subscription limit.
        """
        # Already has direct purchase entitlement? Always allowed.
        has_direct = await entitlement_service.has_entitlement(
            user_id=user_id, entitlement_type="course", resource_id=course_id
        )
        if has_direct:
            return True

        # Check subscription limits
        result = await usage_tracking_service.check_course_limit(user_id)
        return result["allowed"]

    # ── Certificate Management ─────────────────────────────────────────────

    async def _grant_certificate(
        self,
        user_id: int,
        module_id: Optional[str] = None,
        path_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Issues a certificate only after completion eligibility is verified.

        Delegates to certificate_service so every cert is digitally signed and
        backed by real completion evidence. Returns None if not yet eligible.
        """
        try:
            from app.services.certificate_service import certificate_service

            if module_id:
                return await certificate_service.generate_module_certificate(
                    user_id, module_id
                )
            if path_id:
                return await certificate_service.generate_path_certificate(
                    user_id, path_id
                )
            return None
        except Exception as e:
            logger.error(
                f"Failed to grant certificate for user {user_id} "
                f"(module={module_id}, path={path_id}): {e}"
            )
            return None

    async def grant_subscription_certificate(
        self, user_id: int, module_id: str
    ) -> bool:
        """
        Grant a certificate for a subscription user (Pro tier only).
        Returns True if granted, False if not eligible.
        """
        from app.services.certificate_service import certificate_service

        # Completion eligibility FIRST, so a not-yet-completed module never
        # consumes the user's subscription certificate quota.
        module_eligible = await certificate_service.check_module_eligibility(
            user_id, module_id
        )
        if not module_eligible.get("eligible"):
            logger.info(
                f"Subscription certificate denied for user {user_id} "
                f"on module {module_id}: {module_eligible.get('reason')}"
            )
            return False

        eligibility = await usage_tracking_service.check_certificate_eligibility(
            user_id
        )
        if not eligibility["allowed"]:
            return False

        # Record the usage
        recorded = await usage_tracking_service.record_certificate_grant(user_id)
        if not recorded:
            return False

        # _grant_certificate re-verifies completion and produces a signed cert.
        cert = await self._grant_certificate(user_id, module_id=module_id)
        return cert is not None

    # ── Enrollment Helpers ─────────────────────────────────────────────────

    async def _ensure_enrollment(
        self,
        user_id: int,
        course_id: Optional[str] = None,
        path_id: Optional[str] = None,
        transaction_id: Optional[int] = None,
    ) -> None:
        """Creates an enrollment record using the unified EducationService."""
        from app.services.education_service import education_service

        await education_service.enroll_user(
            module_id=course_id,
            path_id=path_id,
            user_id=user_id,
            transaction_id=transaction_id,
        )

    def _parse_price(self, price_data: Any) -> Dict[str, Any]:
        """Safely parse price JSON data into numeric dictionary."""
        if not price_data:
            return {"original": 0, "discounted": None}
        if isinstance(price_data, (int, float)):
            return {"original": int(price_data), "discounted": None}
        if isinstance(price_data, dict):
            parsed = price_data
        elif isinstance(price_data, str):
            try:
                import json

                parsed = json.loads(price_data)
            except Exception:
                return {"original": 0, "discounted": None}
        else:
            return {"original": 0, "discounted": None}

        orig = (
            parsed.get("original") or parsed.get("amount") or parsed.get("price") or 0
        )
        disc = parsed.get("discounted")
        try:
            orig = int(orig)
        except (ValueError, TypeError):
            orig = 0
        try:
            disc = int(disc) if disc is not None else None
        except (ValueError, TypeError):
            disc = None
        return {"original": orig, "discounted": disc}


education_billing_service = EducationBillingService()
