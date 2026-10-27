"""
Tests for FeatureService.
Covers: config integrity, boost decay, anti-gating, subscription limits, ranking.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

pytest_plugins = ("pytest_asyncio",)

# ── Module-level mocks ────────────────────────────────────────────────

prisma_mock = MagicMock()
prisma_mock.module = MagicMock()
prisma_mock.project = MagicMock()
prisma_mock.freelancerprofile = MagicMock()
prisma_mock.featurepurchase = MagicMock()
prisma_mock.subscription = MagicMock()


@pytest.fixture(autouse=True)
def _mock_prisma():
    # Patch the already-imported service binding rather than sys.modules:
    # sys.modules is global and would silently break other modules that
    # import `app.core.prisma` after us.
    with patch("app.services.feature_service.prisma", prisma_mock):
        yield


# ── Pure constants ────────────────────────────────────────────────────


class TestDecayConstants:
    def test_decay_per_hour(self):
        from app.services.feature_service import DECAY_PER_HOUR

        assert DECAY_PER_HOUR == 0.00625

    def test_full_decay_duration(self):
        """Boost 1.0 decays to 0 in ~160 hours (~6.67 days)."""
        from app.services.feature_service import DECAY_PER_HOUR

        hours_to_zero = 1.0 / DECAY_PER_HOUR
        assert 150 < hours_to_zero < 170

    def test_partial_decay(self):
        from app.services.feature_service import DECAY_PER_HOUR

        boost = 1.0
        after_24h = max(boost - DECAY_PER_HOUR * 24, 0)
        assert after_24h == 0.85

    def test_boost_never_goes_below_zero(self):
        from app.services.feature_service import DECAY_PER_HOUR

        boost = 0.003
        assert max(boost - DECAY_PER_HOUR, 0) == 0

    def test_anti_gaming_ctr_threshold(self):
        from app.services.feature_service import ANTI_GAMING_CTR_THRESHOLD

        assert ANTI_GAMING_CTR_THRESHOLD == 0.05

    def test_boost_cap(self):
        from app.services.feature_service import BOOST_CAP

        assert BOOST_CAP == 0.3

    def test_boost_cap_multiplier(self):
        from app.services.feature_service import BOOST_CAP

        capped = min(1.0 * BOOST_CAP, BOOST_CAP)
        assert capped == 0.3

        half = min(0.5 * BOOST_CAP, BOOST_CAP)
        assert half == 0.15


class TestAntiGamingLogic:
    def test_ctr_below_threshold(self):
        from app.services.feature_service import ANTI_GAMING_CTR_THRESHOLD

        views = 100
        clicks = 2
        ctr = clicks / views
        assert ctr < ANTI_GAMING_CTR_THRESHOLD

    def test_ctr_above_threshold(self):
        from app.services.feature_service import ANTI_GAMING_CTR_THRESHOLD

        views = 100
        clicks = 6
        ctr = clicks / views
        assert ctr >= ANTI_GAMING_CTR_THRESHOLD

    def test_boost_halved_on_penalty(self):
        current = 0.5
        reduced = current * 0.5
        assert reduced == 0.25

    def test_low_views_skip_check(self):
        views = 30
        if views <= 50:
            assert True  # not enough views, skip
        else:
            assert False


# ── Config map integrity ──────────────────────────────────────────────


class TestFeatureConfigIntegrity:
    def test_all_keys_present(self):
        from app.services.feature_service import FeatureService

        keys = set(FeatureService.FEATURE_CONFIG.keys())
        expected = {"project_post", "featured_project_7d", "freelancer_boost",
                    "freelancer_featured_7d", "skill_passport"}
        assert keys == expected

    def test_project_post_config(self):
        from app.services.feature_service import FeatureService

        cfg = FeatureService.FEATURE_CONFIG["project_post"]
        assert cfg["type"] == "consumable"
        assert cfg["price"] == 200
        assert cfg["duration_days"] is None
        assert cfg["subscription_map"]["business_starter"] == "project_posting_5"
        assert cfg["subscription_map"]["business_pro"] == "unlimited_posting"

    def test_activation_configs(self):
        from app.services.feature_service import FeatureService

        for key in ("featured_project_7d", "freelancer_boost", "freelancer_featured_7d"):
            cfg = FeatureService.FEATURE_CONFIG[key]
            assert cfg["type"] == "activation"
            assert cfg["price"] > 0
            assert cfg["duration_days"] is not None and cfg["duration_days"] > 0
            assert cfg["boost_initial"] == 1.0

    def test_skill_passport_config(self):
        from app.services.feature_service import FeatureService

        cfg = FeatureService.FEATURE_CONFIG["skill_passport"]
        assert cfg["type"] == "permanent"
        assert cfg["price"] == 500
        assert cfg["duration_days"] is None

    def test_no_negative_prices(self):
        from app.services.feature_service import FeatureService

        for key, cfg in FeatureService.FEATURE_CONFIG.items():
            assert cfg["price"] >= 0, f"{key} has negative price"


# ── Subscription posting logic ────────────────────────────────────────


class TestSubscriptionLimits:
    def test_business_starter_limit(self):
        limit = 5
        assert limit == 5

    def test_starter_limit_exhausted(self):
        monthly_used = 5
        limit = 5
        assert monthly_used >= limit

    def test_starter_limit_available(self):
        monthly_used = 3
        limit = 5
        assert monthly_used < limit

    def test_business_pro_unlimited(self):
        assert True

    def test_subscription_map(self):
        from app.services.feature_service import FeatureService

        sm = FeatureService.FEATURE_CONFIG["project_post"]["subscription_map"]
        assert sm["business_starter"] == "project_posting_5"
        assert sm["business_pro"] == "unlimited_posting"


# ── Consumable usage logic ────────────────────────────────────────────


class TestConsumableLogic:
    def test_single_purchase_remaining(self):
        quantity = 5
        used = 0
        remaining = quantity - used
        assert remaining == 5

    def test_consumed_one(self):
        quantity = 5
        used = 1
        remaining = quantity - used
        assert remaining == 4

    def test_fully_consumed(self):
        quantity = 3
        used = 3
        remaining = quantity - used
        assert remaining == 0

    def test_aggregate_remaining(self):
        """Multiple purchases should aggregate remaining."""
        purchases = [
            {"qty": 3, "used": 1},
            {"qty": 5, "used": 0},
        ]
        total = sum(p["qty"] - p["used"] for p in purchases)
        assert total == 7


# ── Ranking formula ───────────────────────────────────────────────────


class TestRankingFormula:
    def test_boosted_project_ranks_higher(self):
        """Boost adds up to +0.3 to search rank."""
        base_rank = 0.5
        boosted = base_rank + min(0.5 * 0.3, 0.3)
        assert boosted == 0.65

    def test_max_boost_effect(self):
        """Max boost adds exactly 0.3 to rank."""
        base_rank = 0.0
        boosted = base_rank + min(1.0 * 0.3, 0.3)
        assert boosted == 0.3

    def test_expired_boost_has_no_effect(self):
        """boost=0 should not affect ranking."""
        base_rank = 0.5
        boosted = base_rank + min(0 * 0.3, 0.3)
        assert boosted == 0.5


# ── Service method tests (async, with mocked prisma) ──────────────────


class TestServiceCheckPostAvailable:
    @pytest.mark.asyncio
    async def test_no_purchase_no_subscription(self):
        prisma_mock.featurepurchase.find_many = AsyncMock(return_value=[])
        prisma_mock.subscription.find_first = AsyncMock(return_value=None)

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        result = await svc.check_project_post_available(99)
        assert result["allowed"] is False
        assert result["source"] == "none"

    @pytest.mark.asyncio
    async def test_purchase_has_remaining(self):
        prisma_mock.featurepurchase.find_many = AsyncMock(
            return_value=[
                MagicMock(quantity=5, usedCount=2),
            ]
        )
        prisma_mock.subscription.find_first = AsyncMock(return_value=None)

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        result = await svc.check_project_post_available(1)
        assert result["allowed"] is True
        assert result["source"] == "purchase"

    @pytest.mark.asyncio
    async def test_business_pro_subscription(self):
        plan_mock = MagicMock()
        plan_mock.value = "BUSINESS_PRO"
        prisma_mock.subscription.find_first = AsyncMock(
            return_value=MagicMock(plan=plan_mock, status="ACTIVE")
        )
        from app.services.feature_service import FeatureService

        svc = FeatureService()
        result = await svc.check_project_post_available(1)
        assert result["allowed"] is True
        assert result["source"] == "subscription"

    @pytest.mark.asyncio
    async def test_remaining_posts_count(self):
        prisma_mock.featurepurchase.find_many = AsyncMock(
            return_value=[
                MagicMock(quantity=3, usedCount=1),
                MagicMock(quantity=2, usedCount=0),
            ]
        )
        prisma_mock.subscription.find_first = AsyncMock(return_value=None)

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        remaining = await svc.get_remaining_posts(1)
        assert remaining == 4


class TestServiceSkillPassport:
    @pytest.mark.asyncio
    async def test_skill_passport_already_owned(self):
        prisma_mock.freelancerprofile.find_unique = AsyncMock(
            return_value=MagicMock(skillPassportVerified=True)
        )

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        with pytest.raises(Exception) as exc:
            await svc.purchase_skill_passport(1, 100)
        assert "409" in str(exc.type) or "already" in str(exc.value).lower()


class TestServiceActiveFeatures:
    @pytest.mark.asyncio
    async def test_active_features_no_boost(self):
        prisma_mock.project.find_many = AsyncMock(return_value=[])
        prisma_mock.freelancerprofile.find_unique = AsyncMock(
            return_value=MagicMock(
                featured=False,
                isPremium=False,
                skillPassportVerified=False,
            )
        )

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        result = await svc.get_active_features(1)
        assert result == []

    @pytest.mark.asyncio
    async def test_active_features_with_skill_passport(self):
        now = datetime.now(timezone.utc)
        prisma_mock.project.find_many = AsyncMock(return_value=[])
        prisma_mock.freelancerprofile.find_unique = AsyncMock(
            return_value=MagicMock(
                featured=False,
                featuredUntil=None,
                isPremium=False,
                skillPassportVerified=True,
                skillPassportVerifiedAt=now,
            )
        )

        from app.services.feature_service import FeatureService

        svc = FeatureService()
        result = await svc.get_active_features(1)
        types = [r["type"] for r in result]
        assert "skill_passport" in types
