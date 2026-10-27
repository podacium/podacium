import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status

from app.core.prisma import prisma

logger = logging.getLogger(__name__)

DECAY_PER_HOUR = 0.00625
ANTI_GAMING_CTR_THRESHOLD = 0.05
BOOST_CAP = 0.3


class FeatureService:
    FEATURE_CONFIG = {
        "project_post": {
            "price": 200,
            "type": "consumable",
            "duration_days": None,
            "subscription_map": {
                "business_starter": "project_posting_5",
                "business_pro": "unlimited_posting",
            },
        },
        "featured_project_7d": {
            "price": 500,
            "type": "activation",
            "duration_days": 7,
            "boost_initial": 1.0,
        },
        "freelancer_boost": {
            "price": 200,
            "type": "activation",
            "duration_days": 3,
            "boost_initial": 1.0,
        },
        "freelancer_featured_7d": {
            "price": 500,
            "type": "activation",
            "duration_days": 7,
            "boost_initial": 1.0,
        },
        "skill_passport": {
            "price": 500,
            "type": "permanent",
            "duration_days": None,
        },
    }

    # ── Availability checks ──────────────────────────────────────────────

    async def check_project_post_available(self, user_id: int) -> Dict[str, Any]:
        sub_access = await self._check_subscription_posting(user_id)
        if sub_access["allowed"]:
            return sub_access

        remaining = await self._count_remaining_consumables(user_id, "project_post")
        if remaining > 0:
            return {"allowed": True, "source": "purchase", "remaining": remaining}

        return {"allowed": False, "source": "none", "remaining": 0}

    async def get_remaining_posts(self, user_id: int) -> int:
        return await self._count_remaining_consumables(user_id, "project_post")

    async def _count_remaining_consumables(self, user_id: int, feature_key: str) -> int:
        purchases = await prisma.featurepurchase.find_many(
            where={
                "userId": user_id,
                "featureKey": feature_key,
                "expiresAt": None,
            }
        )
        total = 0
        for p in purchases:
            total += p.quantity - p.usedCount
        return total

    async def _check_subscription_posting(self, user_id: int) -> Dict[str, Any]:
        subscription = await prisma.subscription.find_first(
            where={"userId": user_id, "status": "ACTIVE"},
        )
        if not subscription:
            return {"allowed": False, "source": "none"}

        plan_key = subscription.plan.value.lower() if subscription.plan else ""
        if plan_key == "business_pro":
            return {"allowed": True, "source": "subscription", "plan": "unlimited"}
        if plan_key == "business_starter":
            monthly_used = await self._get_monthly_posting_usage(user_id)
            if monthly_used < 5:
                return {
                    "allowed": True,
                    "source": "subscription",
                    "plan": "starter",
                    "used": monthly_used,
                    "limit": 5,
                }
            return {"allowed": False, "source": "subscription_exhausted"}
        return {"allowed": False, "source": "none"}

    async def _get_monthly_posting_usage(self, user_id: int) -> int:
        start_of_month = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        count = await prisma.project.count(
            where={
                "ownerId": user_id,
                "createdAt": {"gte": start_of_month},
            }
        )
        return count

    # ── Consumption ──────────────────────────────────────────────────────

    async def consume_project_post(self, user_id: int):
        sub_access = await self._check_subscription_posting(user_id)
        if sub_access["allowed"]:
            if sub_access.get("plan") == "unlimited":
                return {"source": "subscription", "plan": "unlimited"}
            if sub_access.get("plan") == "starter":
                return {"source": "subscription", "plan": "starter"}
            return {"source": "subscription"}

        purchase = await prisma.featurepurchase.find_first(
            where={
                "userId": user_id,
                "featureKey": "project_post",
                "expiresAt": None,
            },
            order={"purchasedAt": "asc"},
        )
        if not purchase:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="feature.post.insufficient",
            )
        if purchase.usedCount >= purchase.quantity:
            purchase = await prisma.featurepurchase.find_first(
                where={
                    "userId": user_id,
                    "featureKey": "project_post",
                    "expiresAt": None,
                    "usedCount": {"lt": purchase.quantity},
                },
                order={"purchasedAt": "asc"},
            )
            if not purchase:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="feature.post.insufficient",
                )

        await prisma.featurepurchase.update(
            where={"id": purchase.id},
            data={"usedCount": purchase.usedCount + 1},
        )
        return {
            "source": "purchase",
            "remaining": purchase.quantity - purchase.usedCount - 1,
        }

    # ── Purchase effects ─────────────────────────────────────────────────

    async def purchase_project_post(
        self,
        user_id: int,
        wallet_tx_id: int,
        quantity: int = 1,
        tx=None,
    ) -> Dict[str, Any]:
        db = tx if tx is not None else prisma
        fp = await db.featurepurchase.create(
            data={
                "userId": user_id,
                "featureKey": "project_post",
                "quantity": quantity,
                "usedCount": 0,
                "walletTransactionId": wallet_tx_id,
            }
        )
        return {"purchase_id": fp.id, "feature": "project_post", "quantity": quantity}

    async def purchase_featured_project(
        self,
        user_id: int,
        wallet_tx_id: int,
        reference_id: str,
        tx=None,
    ) -> Dict[str, Any]:
        db = tx if tx is not None else prisma
        project_id = int(reference_id)
        project = await db.project.find_unique(where={"id": project_id})
        if not project or project.ownerId != user_id:
            raise HTTPException(status_code=404, detail="Project not found")

        now = datetime.now(timezone.utc)
        current_expiry = project.featureExpiresAt
        if project.featured and current_expiry and current_expiry > now:
            new_expiry = current_expiry + timedelta(days=7)
        else:
            new_expiry = now + timedelta(days=7)

        await db.project.update(
            where={"id": project_id},
            data={
                "featured": True,
                "featuredBoost": 1.0,
                "featureExpiresAt": new_expiry,
            },
        )
        await db.featurepurchase.create(
            data={
                "userId": user_id,
                "featureKey": "featured_project_7d",
                "quantity": 1,
                "usedCount": 1,
                "referenceId": reference_id,
                "walletTransactionId": wallet_tx_id,
                "expiresAt": new_expiry,
            }
        )
        return {
            "feature": "featured_project_7d",
            "project_id": project_id,
            "expires_at": new_expiry.isoformat(),
        }

    async def purchase_freelancer_boost(
        self,
        user_id: int,
        wallet_tx_id: int,
        tx=None,
    ) -> Dict[str, Any]:
        db = tx if tx is not None else prisma
        profile = await self._ensure_profile(user_id, tx=tx)
        now = datetime.now(timezone.utc)
        if profile.featured and profile.featuredUntil and profile.featuredUntil > now:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="feature.freelancer_boost.already_active",
            )
        new_until = now + timedelta(days=3)

        await db.freelancerprofile.update(
            where={"userId": user_id},
            data={
                "featured": True,
                "featuredBoost": 1.0,
                "featuredUntil": new_until,
            },
        )
        await db.featurepurchase.create(
            data={
                "userId": user_id,
                "featureKey": "freelancer_boost",
                "quantity": 1,
                "usedCount": 1,
                "walletTransactionId": wallet_tx_id,
                "expiresAt": new_until,
            }
        )
        return {"feature": "freelancer_boost", "expires_at": new_until.isoformat()}

    async def purchase_freelancer_featured(
        self,
        user_id: int,
        wallet_tx_id: int,
        tx=None,
    ) -> Dict[str, Any]:
        db = tx if tx is not None else prisma
        profile = await self._ensure_profile(user_id, tx=tx)
        now = datetime.now(timezone.utc)
        if profile.isPremium and profile.featuredUntil and profile.featuredUntil > now:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="feature.freelancer_featured_7d.already_active",
            )
        new_until = now + timedelta(days=7)

        await db.freelancerprofile.update(
            where={"userId": user_id},
            data={
                "isPremium": True,
                "featured": True,
                "featuredBoost": 1.0,
                "featuredUntil": new_until,
            },
        )
        await db.featurepurchase.create(
            data={
                "userId": user_id,
                "featureKey": "freelancer_featured_7d",
                "quantity": 1,
                "usedCount": 1,
                "walletTransactionId": wallet_tx_id,
                "expiresAt": new_until,
            }
        )
        return {
            "feature": "freelancer_featured_7d",
            "expires_at": new_until.isoformat(),
        }

    async def purchase_skill_passport(
        self,
        user_id: int,
        wallet_tx_id: int,
    ) -> Dict[str, Any]:
        profile = await self._ensure_profile(user_id)
        if getattr(profile, "skillPassportVerified", False):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Skill passport already owned",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill Passport cannot be purchased. It must be earned through technical assessments.",
        )

    # ── Atomic purchase orchestration ────────────────────────────────────

    # Features that may be bought with PodaPoints. Everything else in
    # FEATURE_CONFIG must be earned (skill_passport) or comes with a tier.
    PURCHASABLE_FEATURES = frozenset(
        {
            "project_post",
            "featured_project_7d",
            "freelancer_boost",
            "freelancer_featured_7d",
        }
    )
    MAX_QUANTITY = 100

    async def purchase_with_points(
        self,
        user_id: int,
        feature_key: str,
        reference_id: Optional[str] = None,
        quantity: int = 1,
    ) -> Dict[str, Any]:
        """Debit PodaPoints and grant the feature in ONE transaction.

        The debit and the grant are two halves of the same operation. Committing
        the debit first (the previous behaviour) charged users for features they
        never received whenever the grant failed — including `skill_passport`,
        which is never purchasable.
        """
        from app.services.poda_points_service import poda_points_service

        config = self.FEATURE_CONFIG.get(feature_key)
        if not config:
            raise HTTPException(
                status_code=400, detail=f"Unknown feature: {feature_key}"
            )

        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
            raise HTTPException(
                status_code=400, detail="quantity must be a positive integer"
            )
        if quantity > self.MAX_QUANTITY:
            raise HTTPException(
                status_code=400,
                detail=f"quantity exceeds maximum of {self.MAX_QUANTITY}",
            )

        if feature_key == "skill_passport":
            raise HTTPException(
                status_code=400,
                detail="Skill Passport cannot be purchased. It must be earned through technical assessments.",
            )
        if feature_key not in self.PURCHASABLE_FEATURES:
            raise HTTPException(
                status_code=400, detail=f"Feature is not purchasable: {feature_key}"
            )

        # The catalog price must equal the price the ledger charges, or the UI
        # advertises one number and the debit is another.
        ledger_price = poda_points_service.FEATURE_PRICES.get(feature_key)
        if ledger_price != config["price"]:
            logger.error(
                f"Feature price drift for '{feature_key}': "
                f"FEATURE_CONFIG={config['price']} FEATURE_PRICES={ledger_price}"
            )
            raise HTTPException(
                status_code=500, detail="errors.feature.price_misconfigured"
            )

        if feature_key == "featured_project_7d" and not reference_id:
            raise HTTPException(
                status_code=400, detail="reference_id (projectId) required"
            )

        async with prisma.tx() as tx:
            spend = await poda_points_service.spend_points(
                user_id,
                feature_key,
                quantity=quantity,
                tx=tx,
            )
            wallet_tx_id = spend["transaction_id"]

            if feature_key == "project_post":
                result = await self.purchase_project_post(
                    user_id, wallet_tx_id, quantity, tx=tx
                )
            elif feature_key == "featured_project_7d":
                result = await self.purchase_featured_project(
                    user_id, wallet_tx_id, reference_id, tx=tx
                )
            elif feature_key == "freelancer_boost":
                result = await self.purchase_freelancer_boost(
                    user_id, wallet_tx_id, tx=tx
                )
            elif feature_key == "freelancer_featured_7d":
                result = await self.purchase_freelancer_featured(
                    user_id, wallet_tx_id, tx=tx
                )
            else:  # pragma: no cover - guarded by PURCHASABLE_FEATURES
                raise HTTPException(
                    status_code=400, detail=f"Unknown feature: {feature_key}"
                )

        result["remaining_balance"] = spend["remaining_balance"]
        result["wallet_transaction_id"] = wallet_tx_id
        return result

    async def _ensure_profile(self, user_id: int, tx=None):
        db = tx if tx is not None else prisma
        profile = await db.freelancerprofile.find_unique(where={"userId": user_id})
        if not profile:
            profile = await db.freelancerprofile.create(data={"userId": user_id})
        return profile

    # ── Boost decay ──────────────────────────────────────────────────────

    async def decay_all_boosts(self):
        now = datetime.now(timezone.utc)
        await prisma.execute_raw(
            'UPDATE "Project" SET "featuredBoost" = GREATEST("featuredBoost" - $1, 0) WHERE featured = true AND "featureExpiresAt" > $2',
            DECAY_PER_HOUR,
            now,
        )
        await prisma.execute_raw(
            'UPDATE "FreelancerProfile" SET "featuredBoost" = GREATEST("featuredBoost" - $1, 0) WHERE featured = true AND "featuredUntil" > $2',
            DECAY_PER_HOUR,
            now,
        )

    async def expire_boosted_items(self):
        now = datetime.now(timezone.utc)
        await prisma.project.update_many(
            where={"featured": True, "featureExpiresAt": {"lte": now}},
            data={"featured": False, "featuredBoost": 0},
        )
        await prisma.freelancerprofile.update_many(
            where={"featured": True, "featuredUntil": {"lte": now}},
            data={"featured": False, "featuredBoost": 0},
        )
        await prisma.freelancerprofile.update_many(
            where={"isPremium": True, "featuredUntil": {"lte": now}},
            data={"isPremium": False},
        )

    # ── Anti-gaming ──────────────────────────────────────────────────────

    async def check_anti_gaming(self, project_id: int):
        views = await prisma.projectview.count(
            where={"projectId": project_id},
        )
        clicks = await prisma.projectclick.count(
            where={"projectId": project_id},
        )
        if views > 50:
            ctr = clicks / views
            if ctr < ANTI_GAMING_CTR_THRESHOLD:
                project = await prisma.project.find_unique(where={"id": project_id})
                if project and project.featured and project.featuredBoost > 0:
                    new_boost = project.featuredBoost * 0.5
                    await prisma.project.update(
                        where={"id": project_id},
                        data={"featuredBoost": new_boost},
                    )
                    logger.warning(
                        "Anti-gaming: reduced boost for project %s (CTR %.2f%%)",
                        project_id,
                        ctr * 100,
                    )
                    return {"reduced": True, "new_boost": new_boost}
        return {"reduced": False}

    # ── Active features for user ─────────────────────────────────────────

    async def get_active_features(self, user_id: int) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        result = []

        active_projects = await prisma.project.find_many(
            where={
                "ownerId": user_id,
                "featured": True,
                "OR": [
                    {"featureExpiresAt": None},
                    {"featureExpiresAt": {"gte": now}},
                ],
            },
        )
        for p in active_projects:
            result.append(
                {
                    "type": "featured_project",
                    "feature_key": "featured_project_7d",
                    "reference_id": str(p.id),
                    "label": p.title,
                    "expires_at": p.featureExpiresAt.isoformat()
                    if p.featureExpiresAt
                    else None,
                    "boost": p.featuredBoost,
                }
            )

        profile = await prisma.freelancerprofile.find_unique(where={"userId": user_id})
        if profile:
            if (
                profile.featured
                and profile.featuredUntil
                and profile.featuredUntil > now
            ):
                result.append(
                    {
                        "type": "featured_freelancer",
                        "feature_key": "freelancer_boost",
                        "expires_at": profile.featuredUntil.isoformat(),
                        "boost": profile.featuredBoost,
                    }
                )
            if (
                profile.isPremium
                and profile.featuredUntil
                and profile.featuredUntil > now
            ):
                result.append(
                    {
                        "type": "premium_freelancer",
                        "feature_key": "freelancer_featured_7d",
                        "expires_at": profile.featuredUntil.isoformat(),
                    }
                )
            if profile.skillPassportVerified:
                result.append(
                    {
                        "type": "skill_passport",
                        "feature_key": "skill_passport",
                        "verified_at": profile.skillPassportVerifiedAt.isoformat()
                        if profile.skillPassportVerifiedAt
                        else None,
                    }
                )

        return result


feature_service = FeatureService()
