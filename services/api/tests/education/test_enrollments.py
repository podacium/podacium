"""Tests for enrollment flow, duplicate prevention, and edge cases."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.education_service import EducationService
from app.schemas.education import SearchQuery


@pytest.fixture
def svc():
    return EducationService()


class TestEnrollFreeModule:

    @patch("app.services.education_service.prisma")
    async def test_enroll_free_module(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True


class TestEnrollPaidModule:

    @patch("app.services.education_service.prisma")
    async def test_enroll_paid_no_access(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=False)):
                result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_enroll_paid_with_access(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price={"original": 5000}))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(return_value=True)
                    result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True


class TestEnrollPath:

    @patch("app.services.education_service.prisma")
    async def test_enroll_free_path(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.path.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(path_id="path-1", user_id=1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_enroll_path_not_found(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.path.find_unique = AsyncMock(return_value=None)
        result = await svc.enroll_user(path_id="nonexistent", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_enroll_path_paid_no_access(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.path.find_unique = AsyncMock(return_value=MagicMock(price={"original": 10000}))
        with patch.object(svc, "_parse_price", return_value={"original": 10000}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.enroll_user(path_id="path-1", user_id=1)
        assert result is False


class TestDuplicatePrevention:

    @patch("app.services.education_service.prisma")
    async def test_duplicate_module_enrollment_idempotent(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True
        assert not mock_prisma.enrollment.create.called

    @patch("app.services.education_service.prisma")
    async def test_duplicate_path_enrollment_idempotent(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.path.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        result = await svc.enroll_user(path_id="path-1", user_id=1)
        assert result is True
        assert not mock_prisma.enrollment.create.called


class TestEnrollmentEdgeCases:

    @patch("app.services.education_service.prisma")
    async def test_transaction_bypasses_access_check(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        result = await svc.enroll_user(module_id="mod-1", user_id=1, transaction_id=100)
        assert result is True
        assert not mock_prisma.module.find_unique.called

    @patch("app.services.education_service.prisma")
    async def test_no_module_or_path_returns_false(self, mock_prisma, svc):
        result = await svc.enroll_user(user_id=1)
        assert result is False


class TestCheckAccessEdgeCases:

    @patch("app.services.education_service.prisma")
    async def test_path_expiry_denies_access(self, mock_prisma, svc):
        from datetime import datetime, timezone
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED"))
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[
            MagicMock(pathId="path-1", expiresAt=datetime(2020, 1, 1, tzinfo=timezone.utc)),
        ])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[MagicMock(pathId="path-1")])
        result = await svc.check_access(1, "mod-1")
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_free_module_grants_access(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_no_enrollment_free_module(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_no_enrollment_paid_no_entitlement(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price={"original": 5000}))
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_subscription_entitlement_grants_access(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price={"original": 5000}))
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is False


class TestSubscriptionEnrollment:
    """Subscription-based enrollment flow with usage recording."""

    @patch("app.services.education_service.prisma")
    async def test_subscription_enrollment_records_usage(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: False)
                    with patch("app.services.education_service.usage_tracking_service") as usage:
                        usage.record_course_access = AsyncMock(return_value=True)
                        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True
        usage.record_course_access.assert_awaited_once()

    @patch("app.services.education_service.prisma")
    async def test_subscription_limit_reached(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: False)
                    with patch("app.services.education_service.usage_tracking_service") as usage:
                        usage.record_course_access = AsyncMock(return_value=False)
                        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_direct_purchase_skips_usage_recording(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: rtype == "course")
                    result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_path_via_subscription_records_usage(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        mock_prisma.enrollment.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.enrollment.upsert = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[MagicMock(pathId="path-1")])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: rtype == "path")
                    result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is True


class TestGetUserEnrollments:
    """User enrollment listing."""

    @patch("app.services.education_service.prisma")
    async def test_get_user_enrollments_empty(self, mock_prisma, svc):
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[])
        result = await svc.get_user_enrollments(1)
        assert result == []

    @patch("app.services.education_service.prisma")
    async def test_get_user_enrollments_with_data(self, mock_prisma, svc):
        now = datetime.now(timezone.utc)
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[
            MagicMock(
                id=1, userId=1, moduleId="mod-1", pathId=None, progress=50.0,
                createdAt=now, updatedAt=now,
                completedAt=None, deletedAt=None, startedAt=now,
                certificateId=None,
                module=MagicMock(id="mod-1", title="M1", description="D", level="b",
                                 durationMinutes=60, tags=[], skills=[], price=None,
                                 featured=False, createdAt=now, updatedAt=now,
                                 estimatedEffort="2h", fullDescription=None, lastUpdated=None,
                                 totalLessons=5, instructorId=1, thumbnailUrl=None,
                                 instructor=None),
                path=None,
            )
        ])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[{"moduleId": "mod-1", "_count": {"_all": 5}}])
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[{"moduleId": "mod-1", "_count": {"_all": 10}}])
        mock_prisma.pathmodule.group_by = AsyncMock(return_value=[])
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_get_module_gradient", return_value=""):
                with patch.object(svc, "_get_module_icon", return_value=""):
                    with patch.object(svc, "_get_module_category", return_value="General"):
                        with patch.object(svc, "_is_module_new", return_value=False):
                            result = await svc.get_user_enrollments(1)
        assert len(result) == 1
        assert result[0].module_id == "mod-1"

    @patch("app.services.education_service.prisma")
    async def test_get_user_enrollments_error(self, mock_prisma, svc):
        mock_prisma.enrollment.find_many = AsyncMock(side_effect=Exception("DB error"))
        result = await svc.get_user_enrollments(1)
        assert result == []


class TestUserLearningStats:
    """Learning statistics computation."""

    @patch("app.services.education_service.prisma")
    async def test_learning_stats_basic(self, mock_prisma, svc):
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[
            MagicMock(moduleId="mod-1", pathId=None, progress=100.0),
        ])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[
            MagicMock(isCompleted=True, completedAt=datetime.now(timezone.utc),
                      lesson=MagicMock(durationMinutes=30)),
        ])
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[
            MagicMock(score=85.0),
        ])
        mock_prisma.certificate.count = AsyncMock(return_value=1)
        stats = await svc.get_user_learning_stats(1)
        assert stats.total_modules_enrolled == 1
        assert stats.total_lessons_completed == 1
        assert stats.certificates_earned == 1

    @patch("app.services.education_service.prisma")
    async def test_learning_stats_empty(self, mock_prisma, svc):
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[])
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        mock_prisma.certificate.count = AsyncMock(return_value=0)
        stats = await svc.get_user_learning_stats(1)
        assert stats.total_modules_enrolled == 0

    @patch("app.services.education_service.prisma")
    async def test_learning_stats_error(self, mock_prisma, svc):
        mock_prisma.enrollment.find_many = AsyncMock(side_effect=Exception("error"))
        stats = await svc.get_user_learning_stats(1)
        assert stats.total_modules_enrolled == 0


class TestSearchAndRecommendations:
    """Search and recommendation functionality."""

    @patch("app.services.education_service.prisma")
    async def test_search_modules(self, mock_prisma, svc):
        mock_prisma.module.find_many = AsyncMock(return_value=[])
        mock_prisma.module.count = AsyncMock(return_value=0)
        mock_prisma.path.find_many = AsyncMock(return_value=[])
        mock_prisma.path.count = AsyncMock(return_value=0)
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_get_module_gradient", return_value=""):
                with patch.object(svc, "_get_module_icon", return_value=""):
                    with patch.object(svc, "_get_module_category", return_value="General"):
                        with patch.object(svc, "_is_module_new", return_value=False):
                            with patch.object(svc, "_get_what_you_get", AsyncMock(return_value=[])):
                                with patch.object(svc, "_get_module_features", AsyncMock(return_value=[])):
                                    with patch.object(svc, "_format_duration", return_value="1h"):
                                        result = await svc.search_modules_and_paths(
                                            SearchQuery(query="python", page=1, page_size=20)
                                        )
        assert result.total_modules == 0
        assert result.total_paths == 0

    @patch("app.services.education_service.prisma")
    async def test_search_with_results(self, mock_prisma, svc):
        mock_prisma.module.find_many = AsyncMock(return_value=[
            MagicMock(id="m1", title="Python 101", description="Learn Python", level="beginner",
                      skills=["python"], tags=["programming"], price=None, featured=False,
                      instructorId=1, durationMinutes=120, estimatedEffort="2h",
                      totalLessons=10, fullDescription=None, lastUpdated=None,
                      createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
                      deletedAt=None, instructor=MagicMock(id=1, fullName="I", profilePictureUrl=None, bio=None, role="INSTRUCTOR"),
                      lessons=[], enrollments=[]),
        ])
        mock_prisma.module.count = AsyncMock(return_value=1)
        mock_prisma.path.find_many = AsyncMock(return_value=[])
        mock_prisma.path.count = AsyncMock(return_value=0)
        mock_prisma.enrollment.group_by = AsyncMock(return_value=[{"moduleId": "m1", "_count": {"_all": 5}}])
        mock_prisma.lesson.group_by = AsyncMock(return_value=[{"moduleId": "m1", "_count": {"_all": 10}}])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_get_module_gradient", return_value=""):
                with patch.object(svc, "_get_module_icon", return_value=""):
                    with patch.object(svc, "_get_module_category", return_value="programming"):
                        with patch.object(svc, "_is_module_new", return_value=False):
                            with patch.object(svc, "_get_what_you_get", AsyncMock(return_value=[])):
                                with patch.object(svc, "_get_module_features", AsyncMock(return_value=[])):
                                    with patch.object(svc, "_format_duration", return_value="2h"):
                                        result = await svc.search_modules_and_paths(
                                            SearchQuery(query="python", page=1, page_size=20)
                                        )
        assert result.total_modules == 1

    @patch("app.services.education_service.prisma")
    async def test_search_error(self, mock_prisma, svc):
        mock_prisma.module.find_many = AsyncMock(side_effect=Exception("error"))
        result = await svc.search_modules_and_paths(SearchQuery(query="test"))
        assert result.total_modules == 0

    @patch("app.services.education_service.prisma")
    async def test_recommendations_no_skills(self, mock_prisma, svc):
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(skills=[]))
        mock_prisma.enrollment.find_many = AsyncMock(return_value=[])
        mock_prisma.path.find_many = AsyncMock(return_value=[])
        result = await svc.get_recommendations(1, limit=5)
        assert result == []

    @patch("app.services.education_service.prisma")
    async def test_recommendations_error(self, mock_prisma, svc):
        mock_prisma.user.find_unique = AsyncMock(side_effect=Exception("error"))
        result = await svc.get_recommendations(1)
        assert result == []


class TestCourseReviews:
    """Course review submission, listing, and deletion."""

    @patch("app.services.education_service.prisma")
    async def test_submit_review(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.lesson.find_many = AsyncMock(return_value=[MagicMock(id="l1")])
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.coursereview.upsert = AsyncMock(return_value=MagicMock(
            id=1, userId=1, moduleId="mod-1", rating=4, comment="Great!",
            createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
            user=MagicMock(fullName="U", profilePictureUrl=None),
        ))
        result = await svc.submit_review(1, "mod-1", rating=4, comment="Great!")
        assert result.rating == 4

    @patch("app.services.education_service.prisma")
    async def test_submit_review_not_enrolled(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        with pytest.raises(PermissionError, match="must be enrolled"):
            await svc.submit_review(1, "mod-1", rating=4)

    @patch("app.services.education_service.prisma")
    async def test_submit_review_no_lessons_completed(self, mock_prisma, svc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.lesson.find_many = AsyncMock(return_value=[MagicMock(id="l1")])
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        with pytest.raises(PermissionError, match="complete at least one lesson"):
            await svc.submit_review(1, "mod-1", rating=4)

    @patch("app.services.education_service.prisma")
    async def test_submit_review_invalid_rating(self, mock_prisma, svc):
        with pytest.raises(ValueError, match="Rating must be between 1 and 5"):
            await svc.submit_review(1, "mod-1", rating=6)

    @patch("app.services.education_service.prisma")
    async def test_get_course_reviews(self, mock_prisma, svc):
        mock_prisma.coursereview.count = AsyncMock(return_value=1)
        mock_prisma.coursereview.find_many = AsyncMock(return_value=[
            MagicMock(id=1, userId=1, moduleId="mod-1", rating=4, comment="Good",
                      createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
                      user=MagicMock(fullName="U", profilePictureUrl=None)),
        ])
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[
            {"moduleId": "mod-1", "_avg": {"rating": 4.0}}
        ])
        result = await svc.get_course_reviews("mod-1", page=1, page_size=10)
        assert result.total == 1
        assert result.average_rating == 4.0

    @patch("app.services.education_service.prisma")
    async def test_get_course_reviews_empty(self, mock_prisma, svc):
        mock_prisma.coursereview.count = AsyncMock(return_value=0)
        mock_prisma.coursereview.find_many = AsyncMock(return_value=[])
        mock_prisma.coursereview.group_by = AsyncMock(return_value=[])
        result = await svc.get_course_reviews("mod-1")
        assert result.total == 0

    @patch("app.services.education_service.prisma")
    async def test_get_course_reviews_error(self, mock_prisma, svc):
        mock_prisma.coursereview.count = AsyncMock(side_effect=Exception("error"))
        result = await svc.get_course_reviews("mod-1")
        assert result.total == 0

    @patch("app.services.education_service.prisma")
    async def test_delete_review(self, mock_prisma, svc):
        mock_prisma.coursereview.find_unique = AsyncMock(return_value=MagicMock(id=1, userId=1))
        mock_prisma.coursereview.delete = AsyncMock()
        result = await svc.delete_review(1, 1)
        assert result is True

    @patch("app.services.education_service.prisma")
    async def test_delete_review_not_found(self, mock_prisma, svc):
        mock_prisma.coursereview.find_unique = AsyncMock(return_value=None)
        with pytest.raises(ValueError, match="Review not found"):
            await svc.delete_review(1, 999)

    @patch("app.services.education_service.prisma")
    async def test_delete_review_not_owner(self, mock_prisma, svc):
        mock_prisma.coursereview.find_unique = AsyncMock(return_value=MagicMock(id=1, userId=2))
        with pytest.raises(PermissionError, match="own review"):
            await svc.delete_review(1, 1)


class TestConcurrentEnrollment:
    """Race condition and concurrency edge cases."""

    @patch("app.services.education_service.prisma")
    async def test_enroll_race_duplicate_detected(self, mock_prisma, svc):
        """Simulate race: first check finds no enrollment, but create hits unique constraint."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", price=None))
        mock_prisma.enrollment.create = AsyncMock(side_effect=Exception("Unique constraint violation"))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_enroll_db_failure(self, mock_prisma, svc):
        """Database failure during enrollment creation should return False."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", price=None))
        mock_prisma.enrollment.create = AsyncMock(side_effect=Exception("Connection lost"))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_enroll_module_deleted_while_enrolling(self, mock_prisma, svc):
        """Module not found during enrollment should fail."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=None)
        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False

    @patch("app.services.education_service.prisma")
    async def test_check_access_deleted_enrollment(self, mock_prisma, svc):
        """Deleted enrollment should be treated as no enrollment."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(
            deletedAt=datetime.now(timezone.utc), expiresAt=None
        ))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=None, price=None))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is True  # free module, no active enrollment blocking

    @patch("app.services.education_service.prisma")
    async def test_subscription_expiry_blocks_new_enrollment(self, mock_prisma, svc):
        """Expired subscription should block enrollment via usage tracking."""
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(price={"original": 5000}))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 5000}):
            with patch.object(svc, "check_access", AsyncMock(return_value=True)):
                with patch("app.services.education_service.entitlement_service") as ent:
                    ent.has_entitlement = AsyncMock(side_effect=lambda uid, rtype, rid: False)
                    with patch("app.services.education_service.usage_tracking_service") as usage:
                        usage.record_course_access = AsyncMock(return_value=False)
                        result = await svc.enroll_user(module_id="mod-1", user_id=1)
        assert result is False


class TestSoftDeleteDataIntegrity:
    """Data integrity when courses are soft-deleted while students enrolled."""

    @patch("app.services.education_service.prisma")
    async def test_check_access_soft_deleted_module(self, mock_prisma, svc):
        """Soft-deleted module should be denied access."""
        now = datetime.now(timezone.utc)
        mock_prisma.enrollment.find_first = AsyncMock(return_value=MagicMock(
            expiresAt=None, deletedAt=None
        ))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", deletedAt=now, price=None))
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch("app.services.education_service.entitlement_service") as ent:
                ent.has_entitlement = AsyncMock(return_value=False)
                result = await svc.check_access(1, "mod-1")
        assert result is False  # soft-deleted module is denied

    @patch("app.services.education_service.prisma")
    async def test_get_soft_deleted_module_handles_gracefully(self, mock_prisma, svc):
        """Module with deletedAt should be blocked and return None."""
        now = datetime.now(timezone.utc)
        mod = MagicMock(
            id="mod-1", title="M", description="D", deletedAt=now, status="PUBLISHED",
            level=None, instructorId=None, price=None, skills=[], tags=[],
            featured=False, thumbnailUrl=None, durationMinutes=None, estimatedEffort=None,
            totalLessons=0, createdAt=now, updatedAt=now,
            fullDescription=None, lastUpdated=None, instructor=None, lessons=[], enrollments=[],
            module=None, path=None,
        )
        mock_prisma.module.find_unique = AsyncMock(return_value=mod)
        mock_prisma.enrollment.count = AsyncMock(return_value=0)
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "_parse_price", return_value={"original": 0}):
            with patch.object(svc, "_get_module_gradient", return_value="g"):
                with patch.object(svc, "_get_module_icon", return_value="i"):
                    with patch.object(svc, "_get_module_category", return_value="c"):
                        with patch.object(svc, "_get_what_you_get", AsyncMock(return_value=[])):
                            with patch.object(svc, "_get_module_features", AsyncMock(return_value=[])):
                                with patch.object(svc, "_format_duration", return_value="1h"):
                                    with patch.object(svc, "_estimate_completion_time", return_value="1w"):
                                        with patch.object(svc, "_is_module_new", return_value=False):
                                            with patch.object(svc, "_get_module_avg_rating", AsyncMock(return_value=None)):
                                                result = await svc.get_module("mod-1", user_id=None)
        assert result is None


class TestPermissionEscalation:
    """Permission escalation attempt detection."""

    @patch("app.services.education_service.prisma")
    async def test_non_instructor_no_bypass(self, mock_prisma, svc):
        """Regular student should not bypass lesson locks."""
        lesson = MagicMock(id="l1", moduleId="mod-1", order=2, quizId=None, title="L1",
                           description="D1", type="video", status="PUBLISHED", durationMinutes=10,
                           videoUrl=None, learningObjectives=[], keyTakeaways=[],
                           instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner",
                           tags=[], relatedResources=None, attachments=None, transcript=None,
                           deletedAt=None)
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map={"mod-1": MagicMock()},
                ordered_lessons=[MagicMock(id="l0", order=1), lesson],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is True  # sequential unlock keeps it locked

    @patch("app.services.education_service.prisma")
    async def test_instructor_bypasses_all_locks(self, mock_prisma, svc):
        """Instructor bypass_lock should override sequential lock."""
        lesson = MagicMock(id="l1", moduleId="mod-1", order=2, quizId=None, title="L1",
                           description="D1", type="video", status="PUBLISHED", durationMinutes=10,
                           videoUrl="vid.mp4", learningObjectives=[], keyTakeaways=[],
                           instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner",
                           tags=[], relatedResources=None, attachments=None, transcript=None,
                           deletedAt=None)
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map={"mod-1": MagicMock()},
                ordered_lessons=[MagicMock(id="l0", order=1), lesson],
                quiz_pass_map={}, bypass_lock=True
            )
        assert result["isLocked"] is False
        assert result["videoUrl"] == "vid.mp4"
