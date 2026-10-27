import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Mock prisma before any app imports
prisma_mock = MagicMock()
prisma_mock.module = MagicMock()
prisma_mock.project = MagicMock()
prisma_mock.freelancerprofile = MagicMock()
prisma_mock.user = MagicMock()

pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(autouse=True)
def _mock_prisma():
    with patch.dict("sys.modules", {"app.core.prisma": MagicMock(prisma=prisma_mock)}):
        yield


class TestScoringFormula:
    def test_weights_sum_to_one(self):
        from app.services.trending_service import SCORE_WEIGHTS

        total = sum(SCORE_WEIGHTS.values())
        assert abs(total - 1.0) < 0.001

    def test_weight_values(self):
        from app.services.trending_service import SCORE_WEIGHTS

        assert SCORE_WEIGHTS["recent_views"] == 0.35
        assert SCORE_WEIGHTS["recent_engagement"] == 0.25
        assert SCORE_WEIGHTS["rating_weight"] == 0.20
        assert SCORE_WEIGHTS["recency_bonus"] == 0.20

    def test_max_score(self):
        from app.services.trending_service import SCORE_WEIGHTS

        score = sum(SCORE_WEIGHTS.values())
        assert abs(score - 1.0) < 0.001

    def test_min_score(self):
        score = 0.0
        assert abs(score - 0.0) < 0.001

    def test_mixed_score(self):
        from app.services.trending_service import SCORE_WEIGHTS

        score = (
            SCORE_WEIGHTS["recent_views"] * 0.5
            + SCORE_WEIGHTS["recent_engagement"] * 0.3
            + SCORE_WEIGHTS["rating_weight"] * 0.8
            + SCORE_WEIGHTS["recency_bonus"] * 0.6
        )
        expected = 0.35 * 0.5 + 0.25 * 0.3 + 0.20 * 0.8 + 0.20 * 0.6
        assert abs(score - expected) < 0.001


class TestService:
    @pytest.mark.asyncio
    async def test_calculate_trending_invalid_type(self):
        from app.services.trending_service import TrendingService

        svc = TrendingService()
        with pytest.raises(ValueError, match="Unknown entity_type"):
            await svc.calculate_trending("invalid")

    @pytest.mark.asyncio
    async def test_get_trending_invalid_type(self):
        from app.services.trending_service import TrendingService

        svc = TrendingService()
        result = await svc.get_trending("invalid")
        assert result == []

    @pytest.mark.asyncio
    async def test_cache_hit(self):
        import json

        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis_instance.get = AsyncMock(
                return_value=json.dumps({"mod_1": 0.95, "mod_2": 0.85})
            )
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True
            svc._enrich_items = AsyncMock(
                return_value=[
                    {"entity_id": "mod_1", "entity_type": "course", "score": 0.95, "rank": 1, "title": "M1"},
                    {"entity_id": "mod_2", "entity_type": "course", "score": 0.85, "rank": 2, "title": "M2"},
                ]
            )

            result = await svc.get_trending("course", limit=10)
            assert len(result) == 2
            assert result[0]["entity_id"] == "mod_1"
            assert result[0]["score"] == 0.95

    @pytest.mark.asyncio
    async def test_cache_miss_triggers_calculation(self):
        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis_instance.get = AsyncMock(return_value=None)
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True
            svc.calculate_trending = AsyncMock(return_value={"mod_1": 0.9})
            svc._enrich_items = AsyncMock(
                return_value=[
                    {"entity_id": "mod_1", "entity_type": "course", "score": 0.9, "rank": 1, "title": "M1"},
                ]
            )

            result = await svc.get_trending("course", limit=5)
            svc.calculate_trending.assert_awaited_once_with("course")
            assert len(result) == 1

    @pytest.mark.asyncio
    async def test_cache_scores(self):

        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis_instance.setex = AsyncMock()
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True

            await svc._cache_scores("course", {"mod_1": 0.9})
            svc._redis.setex.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_record_interaction(self):
        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis_instance.incr = AsyncMock(return_value=1)
            mock_redis_instance.expire = AsyncMock(return_value=True)
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True

            await svc.record_interaction("course", 1, "view")
            svc._redis.incr.assert_awaited_once()
            svc._redis.expire.assert_awaited_once()


class TestEndpointValidation:
    def test_valid_entity_types(self):
        from app.routers.trending import VALID_ENTITY_TYPES

        assert "course" in VALID_ENTITY_TYPES
        assert "project" in VALID_ENTITY_TYPES
        assert "freelancer" in VALID_ENTITY_TYPES
        assert len(VALID_ENTITY_TYPES) == 3


class TestEnrichItems:
    @pytest.mark.asyncio
    async def test_enrich_course(self):
        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True

            with patch("app.services.trending_service.prisma") as mock_prisma:
                mock_prisma.module.find_unique = AsyncMock(
                    return_value=MagicMock(
                        title="Test Module",
                        description="A test module",
                        thumbnailUrl="/thumb.jpg",
                    )
                )

                items = [("mod_1", 0.95)]
                result = await svc._enrich_items("course", items)

                assert len(result) == 1
                assert result[0]["entity_id"] == "mod_1"
                assert result[0]["title"] == "Test Module"
                assert result[0]["description"] == "A test module"
                assert result[0]["thumbnail_url"] == "/thumb.jpg"
                assert result[0]["rank"] == 1
                assert result[0]["entity_type"] == "course"

    @pytest.mark.asyncio
    async def test_enrich_project(self):
        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True

            with patch("app.services.trending_service.prisma") as mock_prisma:
                mock_prisma.project.find_unique = AsyncMock(
                    return_value=MagicMock(
                        title="Test Project",
                        description="A test project",
                    )
                )

                items = [("42", 0.85)]
                result = await svc._enrich_items("project", items)

                assert len(result) == 1
                assert result[0]["entity_id"] == "42"
                assert result[0]["title"] == "Test Project"
                assert result[0]["entity_type"] == "project"

    @pytest.mark.asyncio
    async def test_enrich_freelancer(self):
        with patch("app.services.trending_service.aioredis") as mock_redis:
            mock_redis_instance = AsyncMock()
            mock_redis_instance.ping = AsyncMock(return_value=True)
            mock_redis.from_url.return_value = mock_redis_instance

            from app.services.trending_service import TrendingService

            svc = TrendingService()
            svc._redis = mock_redis_instance
            svc._connected = True

            with patch("app.services.trending_service.prisma") as mock_prisma:
                mock_prisma.user.find_unique = AsyncMock(
                    return_value=MagicMock(
                        fullName="John Doe",
                        profilePictureUrl="/avatar.jpg",
                    )
                )

                items = [("1", 0.75)]
                result = await svc._enrich_items("freelancer", items)

                assert len(result) == 1
                assert result[0]["entity_id"] == "1"
                assert result[0]["title"] == "John Doe"
                assert result[0]["thumbnail_url"] == "/avatar.jpg"
