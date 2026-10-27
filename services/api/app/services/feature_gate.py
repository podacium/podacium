import logging

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class FeatureModeError(Exception):
    """Raised when a commission/escrow operation is attempted in feature-based mode."""

    def __init__(self, message: str = "Feature-based monetization active. Commission/escrow operations are disabled. See SubscriptionTierConfig for feature pricing."):
        self.message = message
        super().__init__(self.message)


class FeatureGate:
    """Middleware for checking feature access based on PodaPoints or subscriptions."""

    FEATURE_PRICE_MAP = {
        "project_post": 200,
        "featured_project_7d": 500,
        "freelancer_boost": 200,
        "freelancer_featured_7d": 500,
        "skill_passport": 500,
    }

    SUBSCRIPTION_FEATURES = {
        "freelancer_plus": ["unlimited_applications", "ai_proposal_assistant", "profile_badges"],
        "freelancer_premium": ["unlimited_applications", "ai_proposal_assistant", "priority_matching", "analytics_dashboard", "featured_rotation"],
        "business_starter": ["project_posting_5", "ai_matching", "proposal_management"],
        "business_pro": ["unlimited_posting", "priority_matching", "talent_pool_search"],
    }

    async def check_poda_points_access(self, user_id: int, feature_key: str) -> bool:
        if feature_key not in self.FEATURE_PRICE_MAP:
            return False

        price = self.FEATURE_PRICE_MAP[feature_key]
        wallet = await prisma.wallet.find_unique(where={"userId": user_id})
        if not wallet:
            return False
        return wallet.podaPoints >= price

    async def check_subscription_access(self, user_id: int, feature_key: str) -> bool:
        subscription = await prisma.subscription.find_first(
            where={
                "userId": user_id,
                "status": "ACTIVE",
            },
            include={"tierConfig": True},
        )
        if not subscription:
            return False

        plan_key = subscription.plan.value.lower() if subscription.plan else ""
        plan_features = self.SUBSCRIPTION_FEATURES.get(plan_key, [])
        return feature_key in plan_features

    async def check_feature_access(self, user_id: int, feature_key: str) -> bool:
        has_points = await self.check_poda_points_access(user_id, feature_key)
        if has_points:
            return True
        has_subscription = await self.check_subscription_access(user_id, feature_key)
        return has_subscription


feature_gate = FeatureGate()
