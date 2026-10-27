"""Tests for module CRUD, permissions, and access control."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.education_service import EducationService


@pytest.fixture
def svc():
    return EducationService()


@pytest.fixture
def mock_module():
    return MagicMock(
        id="mod-1", title="Test Module", description="A test module",
        level="beginner", status="PUBLISHED", instructorId=1,
        price=None, skills=["python"], tags=["data"], featured=False,
        thumbnailUrl=None, durationMinutes=120, estimatedEffort="2h",
        totalLessons=5, createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc), deletedAt=None,
        fullDescription=None, lastUpdated=None, instructor=None,
        lessons=[], enrollments=[], module=None, path=None,
    )


@pytest.fixture
def mock_user():
    return MagicMock(id=1, fullName="Test User", email="test@test.com")


class TestCheckAccess:
    """Authoritative access control checks."""

    @patch("app.services.education_service.prisma")
    async def test_expired_enrollment_denied(self, mock_prisma, svc):
        """Enrollment with past expiresAt should deny access."""
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None))
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(
            expiresAt=datetime(2020, 1, 1, tzinfo=timezone.utc)
        ))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        result = await svc.check_access(1, "mod-1")
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_no_expiry_passes(self, mock_prisma, svc):
        """Enrollment without expiresAt should proceed to entitlement checks."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(expiresAt=None))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
                result = await svc.check_access(1, "mod-1")
                assert result is True  # free module

    @patch("app.services.education_service.prisma")
    async def test_paid_module_no_access(self, mock_prisma, svc):
        """Paid module without entitlement should deny access."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price={"original": 5000}))
                result = await svc.check_access(1, "mod-1")
                assert result is False

    @patch("app.services.education_service.prisma")
    async def test_direct_entitlement_grants_access(self, mock_prisma, svc):
        """Direct purchase entitlement should grant access."""
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None))
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch("app.services.education_service.entitlement_service") as ent:
            ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: rtype == "course")
            result = await svc.check_access(1, "mod-1")
            assert result is True

    @patch("app.services.education_service.prisma")
    async def test_path_entitlement_grants_access(self, mock_prisma, svc):
        """Path ownership should grant access to its modules."""
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None))
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[MagicMock(pathId="path-1")])
        with patch("app.services.education_service.entitlement_service") as ent:
            ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: rtype == "path")
            result = await svc.check_access(1, "mod-1")
            assert result is True


class TestGetModules:
    """Module listing and filtering."""

    @patch("app.services.education_service.prisma")
    async def test_get_public_modules_returns_published(self, mock_prisma, svc):
        """get_modules should return published modules for unauthenticated users."""
        now = datetime.now(timezone.utc)
        mock_module = lambda i: MagicMock(
            id=f"m{i}", status="PUBLISHED", price=None, deletedAt=None,
            featured=False, instructor=None, enrollments=[], tags=[], skills=[],
            createdAt=now, updatedAt=now, durationMinutes=60, level="beginner",
            description="desc", title=f"Module {i}", estimatedEffort="2h",
            fullDescription=None, lastUpdated=None, totalLessons=5, instructorId=1,
            thumbnailUrl=None, module=None, path=None,
        )
        mock_prisma.module.find_many = AsyncMock(return_value=[mock_module(1), mock_module(2)])
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[])
        with patch.object(svc, "_get_module_icon", return_value="book"):
            with patch.object(svc, "_get_module_gradient", return_value=""):
                with patch.object(svc, "_get_module_category", return_value="data"):
                    with patch.object(svc, "_parse_price", return_value={"original": 0}):
                        with patch.object(svc, "_get_what_you_get", return_value=[]):
                            with patch.object(svc, "_get_module_features", return_value=[]):
                                with patch.object(svc, "_format_duration", return_value="1h"):
                                    with patch.object(svc, "_is_module_new", return_value=False):
                                        modules = await svc.get_modules(user_id=None, lightweight=True)
        assert len(modules) == 2
        assert modules[0].id == "m1"

    @patch("app.services.education_service.prisma")
    async def test_get_modules_empty(self, mock_prisma, svc):
        """No modules should return empty list."""
        mock_prisma.module.find_many = AsyncMock(return_value=[])
        modules = await svc.get_modules(user_id=None)
        assert modules == []

    @patch("app.services.education_service.prisma")
    async def test_get_module_by_id(self, mock_prisma, svc, mock_module):
        """get_module should return module details."""
        mock_module.status = "PUBLISHED"
        mock_module.instructorId = 1
        mock_module.instructor = MagicMock(
            id=1, fullName="Instructor", profilePictureUrl=None, bio=None, role="INSTRUCTOR"
        )
        mock_module.lessons = [MagicMock(id=f"l{i}", durationMinutes=10) for i in range(5)]
        mock_prisma.module.find_unique = AsyncMock(return_value=mock_module)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(
            id=1, fullName="Instructor", profilePictureUrl=None
        ))
        mock_prisma.enrollment.count = AsyncMock(return_value=10)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_get_module_icon", return_value="book"):
                with patch.object(svc, "_get_module_gradient", return_value="from-blue-500 to-cyan-500"):
                    with patch.object(svc, "_get_module_category", return_value="data"):
                        with patch.object(svc, "_get_what_you_get", AsyncMock(return_value=[])):
                            with patch.object(svc, "_get_module_features", AsyncMock(return_value=[])):
                                with patch.object(svc, "_format_duration", return_value="2h"):
                                    with patch.object(svc, "_estimate_completion_time", return_value="2 weeks"):
                                        with patch.object(svc, "_is_module_new", return_value=False):
                                            with patch.object(svc, "_get_module_avg_rating", AsyncMock(return_value=4.5)):
                                                result = await svc.get_module("mod-1", user_id=None)
        assert result is not None
        assert result.id == "mod-1"
        assert result.total_lessons == 5

    @patch("app.services.education_service.prisma")
    async def test_get_module_not_found(self, mock_prisma, svc):
        """Non-existent module should return None."""
        mock_prisma.module.find_unique = AsyncMock(return_value=None)
        result = await svc.get_module("non-existent", user_id=None)
        assert result is None


class TestEnrollUser:
    """Enrollment logic."""

    @patch("app.services.education_service.prisma")
    async def test_enroll_module_free(self, mock_prisma, svc):
        """Free module should enroll without entitlement checks."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_enroll_module_already_enrolled(self, mock_prisma, svc):
        """Duplicate enrollment should return True (idempotent)."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_enroll_module_not_found(self, mock_prisma, svc):
        """Non-existent module should fail."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=None)
        result = await svc.enroll_user(module_id="nonexistent", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_enroll_path(self, mock_prisma, svc):
        """Path enrollment should work."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.path.find_unique = AsyncMock(return_value=MagicMock(price=None))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(path_id="path-1", user_id=1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_enroll_neither_module_nor_path(self, mock_prisma, svc):
        """Missing both module_id and path_id should return False."""
        result = await svc.enroll_user(user_id=1)
        assert result is False


class TestProgressCalculation:
    """Progress tracking logic."""

    def test_progress_full(self):
        total = 10
        completed = 10
        assert (completed / total) * 100 == 100.0

    def test_progress_partial(self):
        total = 10
        completed = 4
        assert (completed / total) * 100 == 40.0

    def test_progress_zero_total(self):
        total = 0
        completed = 0
        assert (0 if total == 0 else (completed / total) * 100) == 0

    def test_progress_capped_at_100(self):
        total = 5
        completed = 7
        assert min((completed / total) * 100, 100.0) == 100.0


class TestGetPaths:
    """Learning path listing and retrieval."""

    @patch("app.services.education_service.prisma")
    async def test_get_public_paths(self, mock_prisma, svc):
        mock_prisma.path.find_many = AsyncMock(return_value=[
            MagicMock(id="path-1", title="Path 1", description="Desc 1", modules=[], enrollments=[], createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc)),
        ])
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[])
        mock_prisma.pathmodule.group_by = AsyncMock(return_value=[])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_format_duration", return_value="2h"):
                with patch.object(svc, "_estimate_completion_time", return_value="2 weeks"):
                    with patch.object(svc, "_get_module_gradient", return_value=""):
                        with patch.object(svc, "_get_module_icon", return_value=""):
                            with patch.object(svc, "_get_module_category", return_value="General"):
                                with patch.object(svc, "_is_module_new", return_value=False):
                                    paths = await svc.get_paths(user_id=None)
        assert len(paths) == 1
        assert paths[0].title == "Path 1"

    @patch("app.services.education_service.prisma")
    async def test_get_paths_empty(self, mock_prisma, svc):
        mock_prisma.path.find_many = AsyncMock(return_value=[])
        paths = await svc.get_paths(user_id=None)
        assert paths == []

    @patch("app.services.education_service.prisma")
    async def test_get_path_by_id(self, mock_prisma, svc):
        mock_prisma.path.find_unique = AsyncMock(return_value=MagicMock(
            id="path-1", title="Path 1", description="Desc", modules=[], enrollments=[], deletedAt=None,
            createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
        ))
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[])
        mock_prisma.enrollment.count = AsyncMock(return_value=5)
        with patch.object(svc, "_format_duration", return_value="5h"):
            with patch.object(svc, "_estimate_completion_time", return_value="1 month"):
                with patch.object(svc, "_get_module_gradient", return_value=""):
                    with patch.object(svc, "_get_module_icon", return_value=""):
                        with patch.object(svc, "_get_module_category", return_value="General"):
                            with patch.object(svc, "_parse_price", return_value={"original": 0}):
                                with patch.object(svc, "_is_module_new", return_value=False):
                                    with patch.object(svc, "_get_what_you_get", AsyncMock(return_value=[])):
                                        with patch.object(svc, "_get_module_features", AsyncMock(return_value=[])):
                                            result = await svc.get_path("path-1", user_id=1)
        assert result.id == "path-1"
        assert result.total_modules == 0

    @patch("app.services.education_service.prisma")
    async def test_get_path_not_found(self, mock_prisma, svc):
        mock_prisma.path.find_unique = AsyncMock(return_value=None)
        result = await svc.get_path("nonexistent")
        assert result is None


class TestModuleEnrollmentCounts:
    """Module enrollment and path enrollment count queries."""

    @patch("app.services.education_service.prisma")
    async def test_get_module_enrollment_count(self, mock_prisma, svc):
        mock_prisma.enrollment.count = AsyncMock(return_value=42)
        result = await svc._get_module_enrollment_count("mod-1")
        assert result == 42

    @patch("app.services.education_service.prisma")
    async def test_get_path_enrollment_count(self, mock_prisma, svc):
        mock_prisma.enrollment.count = AsyncMock(return_value=7)
        result = await svc._get_path_enrollment_count("path-1")
        assert result == 7


class TestModuleContentHelpers:
    """Tests for what_you_get, features, avg rating helpers."""

    @patch("app.services.education_service.prisma")
    async def test_get_what_you_get(self, mock_prisma, svc):
        result = await svc._get_what_you_get(MagicMock(id="m1"), lesson_count=5)
        assert len(result) == 4
        assert any("5" in item for item in result)

    @patch("app.services.education_service.prisma")
    async def test_get_module_features(self, mock_prisma, svc):
        result = await svc._get_module_features(MagicMock(id="m1"), lesson_count=3)
        assert len(result) == 6
        assert any("3" in item for item in result)

    @patch("app.services.education_service.prisma")
    async def test_get_module_avg_rating_present(self, mock_prisma, svc):
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[
            {"moduleId": "m1", "_avg": {"rating": 4.5}}
        ])
        result = await svc._get_module_avg_rating("m1")
        assert result == 4.5

    @patch("app.services.education_service.prisma")
    async def test_get_module_avg_rating_none(self, mock_prisma, svc):
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[])
        result = await svc._get_module_avg_rating("m1")
        assert result is None

    @patch("app.services.education_service.prisma")
    async def test_get_module_avg_ratings_batch(self, mock_prisma, svc):
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[
            {"moduleId": "m1", "_avg": {"rating": 4.0}},
            {"moduleId": "m2", "_avg": {"rating": 3.5}},
        ])
        result = await svc._get_module_avg_ratings(["m1", "m2"])
        assert result["m1"] == 4.0
        assert result["m2"] == 3.5

    @patch("app.services.education_service.prisma")
    async def test_get_module_avg_ratings_empty(self, mock_prisma, svc):
        result = await svc._get_module_avg_ratings([])
        assert result == {}

    @patch("app.services.education_service.prisma")
    async def test_get_modules_with_featured_filter(self, mock_prisma, svc):
        now = datetime.now(timezone.utc)
        mock_prisma.module.find_many = AsyncMock(return_value=[
            MagicMock(id="m1", status="PUBLISHED", price=None, deletedAt=None, featured=True, instructor=None, enrollments=[], tags=[], skills=[], createdAt=now, updatedAt=now, durationMinutes=60, level="beginner", description="desc", title="M1", estimatedEffort="2h", fullDescription=None, lastUpdated=None, totalLessons=5, instructorId=1, thumbnailUrl=None, module=None, path=None),
        ])
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[])
        with patch.object(svc, "_get_module_icon", return_value="book"):
            with patch.object(svc, "_get_module_gradient", return_value=""):
                with patch.object(svc, "_get_module_category", return_value="data"):
                    with patch.object(svc, "_parse_price", return_value={"original": 0}):
                        with patch.object(svc, "_get_what_you_get", return_value=[]):
                            with patch.object(svc, "_get_module_features", return_value=[]):
                                with patch.object(svc, "_is_module_new", return_value=False):
                                    with patch.object(svc, "_format_duration", return_value="1h"):
                                        modules = await svc.get_modules(user_id=None, featured=True)
        assert len(modules) == 1
        assert modules[0].id == "m1"


class TestModuleHelperMethods:
    """Unit tests for module helper methods."""

    def test_parse_price_none(self, svc):
        result = svc._parse_price(None)
        assert result["original"] == 0
        assert result["discounted"] is None

    def test_parse_price_dict(self, svc):
        result = svc._parse_price({"original": 5000, "discounted": 4000})
        assert result["original"] == 5000
        assert result["discounted"] == 4000

    def test_parse_price_string(self, svc):
        result = svc._parse_price('{"original": 3000}')
        assert result["original"] == 3000

    def test_parse_price_invalid_string(self, svc):
        result = svc._parse_price("not-json")
        assert result["original"] == 0

    def test_parse_price_with_amount_fallback(self, svc):
        result = svc._parse_price({"amount": 2500})
        assert result["original"] == 2500
        assert result["amount"] == 2500

    def test_parse_price_with_currency(self, svc):
        result = svc._parse_price({"original": 1000, "currency": "USD"})
        assert result["currency"] == "USD"

    def test_format_duration_zero(self, svc):
        assert svc._format_duration(0) == "Unknown"

    def test_format_duration_minutes_only(self, svc):
        assert svc._format_duration(45) == "45 min"

    def test_format_duration_hours_only(self, svc):
        assert svc._format_duration(120) == "2h"

    def test_format_duration_hours_and_minutes(self, svc):
        assert svc._format_duration(150) == "2h 30min"

    def test_format_duration_negative(self, svc):
        assert svc._format_duration(-10) == "Unknown"

    def test_estimate_completion_time_none(self, svc):
        assert svc._estimate_completion_time(0) == "Unknown"

    def test_estimate_completion_time_1_week(self, svc):
        result = svc._estimate_completion_time(60)
        assert result == "1 week"

    def test_estimate_completion_time_multiple_weeks(self, svc):
        result = svc._estimate_completion_time(300)
        assert "weeks" in result

    def test_estimate_completion_time_months(self, svc):
        result = svc._estimate_completion_time(5000)
        assert "month" in result

    def test_is_module_new_recent(self, svc):
        module = MagicMock(createdAt=datetime.now(timezone.utc))
        assert svc._is_module_new(module) is True

    def test_is_module_new_old(self, svc):
        module = MagicMock(createdAt=datetime(2020, 1, 1, tzinfo=timezone.utc))
        assert svc._is_module_new(module) is False

    def test_is_module_new_no_date(self, svc):
        module = MagicMock(createdAt=None)
        assert svc._is_module_new(module) is False

    def test_get_module_icon_by_tag(self, svc):
        module = MagicMock(id="m1", tags=["programming"], skills=[])
        assert "💻" in svc._get_module_icon(module)

    def test_get_module_icon_by_skill(self, svc):
        module = MagicMock(id="m2", tags=[], skills=["data analysis"])
        assert "📊" in svc._get_module_icon(module)

    def test_get_module_icon_default(self, svc):
        module = MagicMock(id="m3", tags=[], skills=[])
        assert svc._get_module_icon(module) == "📚"

    def test_get_module_gradient_consistent(self, svc):
        module = MagicMock(id="mod-1")
        g1 = svc._get_module_gradient(module)
        g2 = svc._get_module_gradient(module)
        assert g1 == g2

    def test_get_module_category_from_tags(self, svc):
        module = MagicMock(id="m1", tags=["data"], skills=[])
        assert svc._get_module_category(module) == "data"

    def test_get_module_category_default(self, svc):
        module = MagicMock(id="m1", tags=[], skills=[])
        assert svc._get_module_category(module) == "General"

    def test_sort_order_default(self, svc):
        assert svc._get_sort_order("invalid") == {"createdAt": "desc"}

    def test_sort_order_recent(self, svc):
        assert svc._get_sort_order("recent") == {"createdAt": "desc"}

    def test_parse_json_field_none(self, svc):
        assert svc._parse_json_field(None, []) == []

    def test_parse_json_field_dict(self, svc):
        assert svc._parse_json_field({"key": "val"}) == {"key": "val"}

    def test_parse_json_field_string(self, svc):
        result = svc._parse_json_field('{"key": "val"}')
        assert result == {"key": "val"}

    def test_calculate_streak_empty(self, svc):
        assert svc._calculate_streak([]) == 0

    def test_calculate_streak_consecutive(self, svc):
        from datetime import timedelta
        today = datetime.now(timezone.utc).date()
        dates = [today, today - timedelta(days=1), today - timedelta(days=2)]
        assert svc._calculate_streak(dates) == 3

    def test_calculate_streak_broken(self, svc):
        from datetime import timedelta
        today = datetime.now(timezone.utc).date()
        dates = [today, today - timedelta(days=2)]
        assert svc._calculate_streak(dates) == 1

    def test_calculate_streak_not_today(self, svc):
        from datetime import timedelta
        yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
        dates = [yesterday]
        assert svc._calculate_streak(dates) == 0
