"""Tests for lesson progression, content delivery, and completion."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.education_service import EducationService, ProgressUpdateResult
from app.services.quiz_service import QuizService
from app.schemas.education import ProgressUpdate


@pytest.fixture
def svc():
    return EducationService()


@pytest.fixture
def qsvc():
    return QuizService()


@pytest.fixture
def mock_lesson():
    return MagicMock(
        id="less-1", moduleId="mod-1", title="Test Lesson",
        description="A test lesson", type="video", status="PUBLISHED",
        durationMinutes=15, order=1, videoUrl=None, quizId=None,
        learningObjectives=["obj1"], keyTakeaways=["take1"],
        instructorNotes=None, estimatedCompletionTime=15,
        difficulty="beginner", tags=[], relatedResources=None,
        attachments=None, transcript=None, deletedAt=None,
        thumbnailUrl=None, thumbnailBlurDataURL=None,
        storageProvider=None, hlsPath=None, rawPath=None,
        transcodingStatus=None, requiredPassScore=90,
        subtitlesPath=None, subtitlesLanguage=None, subtitlesEnabled=False,
    )


class TestGetLessons:
    """Lesson retrieval and listing."""

    @patch("app.services.education_service.prisma")
    async def test_get_module_lessons(self, mock_prisma, svc, mock_lesson):
        """get_module_lessons should return ordered lessons."""
        mock_prisma.lesson.find_many = AsyncMock(return_value=[mock_lesson])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            lessons = await svc.get_module_lessons("mod-1", user_id=1)
        assert len(lessons) > 0
        assert lessons[0].id == "less-1"

    @patch("app.services.education_service.prisma")
    async def test_get_module_lessons_empty(self, mock_prisma, svc):
        """No lessons should return empty list."""
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        lessons = await svc.get_module_lessons("mod-1", user_id=1)
        assert lessons == []

    @patch("app.services.education_service.prisma")
    async def test_get_lesson(self, mock_prisma, svc, mock_lesson):
        """get_lesson should return lesson details with access check."""
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lesson.find_many = AsyncMock(return_value=[mock_lesson])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[MagicMock(
            lessonId="less-1", isCompleted=True, progress=100.0, completedAt=datetime.now(timezone.utc)
        )])
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        mock_prisma.user.find_unique = AsyncMock(return_value=None)
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is not None
        assert lesson.id == "less-1"
        assert lesson.is_completed is True

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_not_found(self, mock_prisma, svc):
        """Non-existent lesson should return None."""
        mock_prisma.lesson.find_unique = AsyncMock(return_value=None)
        lesson = await svc.get_lesson("nonexistent", user_id=1)
        assert lesson is None


class TestCompleteLesson:
    """Lesson completion flow."""

    @patch("app.services.education_service.prisma")
    async def test_complete_lesson(self, mock_prisma, svc, mock_lesson):
        """Complete lesson should create/update progress and recalculate module progress."""
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.lesson.count = AsyncMock(return_value=1)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=1)
        mock_prisma.enrollment.update_many = AsyncMock()
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            with patch("app.services.certificate_service.certificate_service") as cert_svc:
                cert_svc.generate_module_certificate = AsyncMock()
                result = await svc.complete_lesson("less-1", user_id=1)
        assert result == ProgressUpdateResult.OK

    @patch("app.services.education_service.prisma")
    async def test_complete_lesson_not_found(self, mock_prisma, svc):
        """Non-existent lesson should fail."""
        mock_prisma.lesson.find_unique = AsyncMock(return_value=None)
        result = await svc.complete_lesson("nonexistent", user_id=1)
        assert result == ProgressUpdateResult.NOT_FOUND

    @patch("app.services.education_service.prisma")
    async def test_update_lesson_progress(self, mock_prisma, svc, mock_lesson):
        """Update progress should upsert progress record."""
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock(return_value=MagicMock(id=1))
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc.update_lesson_progress("less-1", 1, ProgressUpdate(progress=50.0))
        assert result == ProgressUpdateResult.OK

    def test_progress_schema_validation(self):
        """Pydantic schema should validate progress between 0 and 100."""
        with pytest.raises(Exception):
            ProgressUpdate(progress=-1.0)
        with pytest.raises(Exception):
            ProgressUpdate(progress=101.0)


class TestSequentialUnlock:
    """Sequential lesson unlock logic."""

    @patch("app.services.education_service.prisma")
    async def test_first_lesson_unlocked(self, mock_prisma, svc):
        lesson1 = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson_progress_map = {}
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson1, user_id=1, lesson_progress_map=lesson_progress_map,
                enrollment_map=enrollment_map, ordered_lessons=[lesson1],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is False

    @patch("app.services.education_service.prisma")
    async def test_second_lesson_locked_if_prev_not_complete(self, mock_prisma, svc):
        lesson1 = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson2 = MagicMock(id="l2", moduleId="mod-1", order=2, quizId=None, title="L2", description="D2", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson_progress_map = {}
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson2, user_id=1, lesson_progress_map=lesson_progress_map,
                enrollment_map=enrollment_map, ordered_lessons=[lesson1, lesson2],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is True

    @patch("app.services.education_service.prisma")
    async def test_second_lesson_unlocked_when_prev_complete(self, mock_prisma, svc):
        lesson1 = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson2 = MagicMock(id="l2", moduleId="mod-1", order=2, quizId=None, title="L2", description="D2", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson_progress_map = {"l1": MagicMock(isCompleted=True)}
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson2, user_id=1, lesson_progress_map=lesson_progress_map,
                enrollment_map=enrollment_map, ordered_lessons=[lesson1, lesson2],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is False

    @patch("app.services.education_service.prisma")
    async def test_lesson_locked_when_quiz_not_passed(self, mock_prisma, svc):
        lesson1 = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=1, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson2 = MagicMock(id="l2", moduleId="mod-1", order=2, quizId=None, title="L2", description="D2", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson_progress_map = {"l1": MagicMock(isCompleted=True)}
        enrollment_map = {"mod-1": MagicMock()}
        quiz_pass_map = {"l1": False}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson2, user_id=1, lesson_progress_map=lesson_progress_map,
                enrollment_map=enrollment_map, ordered_lessons=[lesson1, lesson2],
                quiz_pass_map=quiz_pass_map, bypass_lock=False
            )
        assert result["isLocked"] is True

    @patch("app.services.education_service.prisma")
    async def test_lesson_unlocked_when_quiz_passed(self, mock_prisma, svc):
        lesson1 = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=1, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson2 = MagicMock(id="l2", moduleId="mod-1", order=2, quizId=None, title="L2", description="D2", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        lesson_progress_map = {"l1": MagicMock(isCompleted=True)}
        enrollment_map = {"mod-1": MagicMock()}
        quiz_pass_map = {"l1": True}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson2, user_id=1, lesson_progress_map=lesson_progress_map,
                enrollment_map=enrollment_map, ordered_lessons=[lesson1, lesson2],
                quiz_pass_map=quiz_pass_map, bypass_lock=False
            )
        assert result["isLocked"] is False

    @patch("app.services.education_service.prisma")
    async def test_locked_without_enrollment(self, mock_prisma, svc):
        lesson = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl=None, learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        with patch.object(svc, "check_access", AsyncMock(return_value=False)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map={}, ordered_lessons=[lesson],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is True


class TestBypassLock:
    """Instructor/Admin bypass for lesson locking."""

    @patch("app.services.education_service.prisma")
    async def test_instructor_bypasses_lock(self, mock_prisma, svc):
        lesson = MagicMock(id="l1", moduleId="mod-1", order=2, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl="vid.mp4", learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], relatedResources=None, attachments=None, transcript=None, deletedAt=None)
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map=enrollment_map, ordered_lessons=[MagicMock(id="l0", order=1), lesson],
                quiz_pass_map={}, bypass_lock=True
            )
        assert result["isLocked"] is False

    @patch("app.services.education_service.prisma")
    async def test_user_without_access_cannot_bypass(self, mock_prisma, svc):
        lesson = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl="https://example.com/video.mp4", transcript="Some text", attachments=[{"id": "a1"}], relatedResources=[{"id": "r1"}], learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], deletedAt=None)
        with patch.object(svc, "check_access", AsyncMock(return_value=False)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map={}, ordered_lessons=[lesson],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is True


class TestLessonContentGating:
    """Gated content (videoUrl, transcript, attachments) hidden when locked."""

    @patch("app.services.education_service.prisma")
    async def test_content_hidden_when_locked(self, mock_prisma, svc):
        lesson = MagicMock(id="l1", moduleId="mod-1", order=2, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl="https://example.com/video.mp4", transcript="secret transcript", attachments=[{"id": "a1"}], relatedResources=[{"id": "r1"}], learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], deletedAt=None)
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map=enrollment_map, ordered_lessons=[MagicMock(id="l0", order=1), lesson],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is True
        assert result["videoUrl"] is None
        assert result["transcript"] is None
        assert result["attachments"] == []

    @patch("app.services.education_service.prisma")
    async def test_content_visible_when_unlocked(self, mock_prisma, svc):
        lesson = MagicMock(id="l1", moduleId="mod-1", order=1, quizId=None, title="L1", description="D1", type="video", status="PUBLISHED", durationMinutes=10, videoUrl="https://example.com/video.mp4", transcript="visible", attachments=[{"id": "a1"}], relatedResources=[{"id": "r1"}], learningObjectives=[], keyTakeaways=[], instructorNotes=None, estimatedCompletionTime=10, difficulty="beginner", tags=[], deletedAt=None)
        enrollment_map = {"mod-1": MagicMock()}
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc._prepare_lesson_data(
                lesson, user_id=1, lesson_progress_map={},
                enrollment_map=enrollment_map, ordered_lessons=[lesson],
                quiz_pass_map={}, bypass_lock=False
            )
        assert result["isLocked"] is False
        assert result["videoUrl"] == "https://example.com/video.mp4"
        assert result["transcript"] == "visible"
        assert result["attachments"] == [{"id": "a1"}]


class TestModuleProgressRecalculation:
    """Module progress recalculation logic."""

    @patch("app.services.education_service.prisma")
    async def test_update_module_progress_partial(self, mock_prisma, svc):
        mock_prisma.lesson.count = AsyncMock(return_value=10)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=4)
        mock_prisma.enrollment.update_many = AsyncMock()
        await svc._update_module_progress("mod-1", 1)
        update_call = mock_prisma.enrollment.update_many.call_args[1]
        assert update_call["data"]["progress"] == 40.0

    @patch("app.services.education_service.prisma")
    async def test_update_module_progress_complete(self, mock_prisma, svc):
        mock_prisma.lesson.count = AsyncMock(return_value=10)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=10)
        mock_prisma.enrollment.update_many = AsyncMock()
        with patch("app.services.certificate_service.certificate_service") as cert_svc:
            cert_svc.generate_module_certificate = AsyncMock()
            await svc._update_module_progress("mod-1", 1)
        update_call = mock_prisma.enrollment.update_many.call_args[1]
        assert update_call["data"]["progress"] == 100.0
        assert "completedAt" in update_call["data"]

    @patch("app.services.education_service.prisma")
    async def test_update_module_progress_zero_lessons(self, mock_prisma, svc):
        mock_prisma.lesson.count = AsyncMock(return_value=0)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=0)
        mock_prisma.enrollment.update_many = AsyncMock()
        await svc._update_module_progress("mod-1", 1)
        update_call = mock_prisma.enrollment.update_many.call_args[1]
        assert update_call["data"]["progress"] == 0.0

    @patch("app.services.education_service.prisma")
    async def test_complete_lesson_triggers_progress_update(self, mock_prisma, svc, mock_lesson):
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.lesson.count = AsyncMock(return_value=1)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=1)
        mock_prisma.enrollment.update_many = AsyncMock()
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            with patch("app.services.certificate_service.certificate_service") as cert_svc:
                cert_svc.generate_module_certificate = AsyncMock()
                result = await svc.complete_lesson("less-1", user_id=1)
        assert result == ProgressUpdateResult.OK


class TestGetLessonEdgeCases:

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_instructor_bypass(self, mock_prisma, svc, mock_lesson):
        mock_lesson.module = MagicMock(instructorId=1)
        mock_prisma.module.find_unique = AsyncMock(return_value=MagicMock(status="PUBLISHED", instructorId=1))
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lesson.find_many = AsyncMock(return_value=[mock_lesson])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="INSTRUCTOR"))
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch("app.services.education_service.entitlement_service") as ent:
            ent.has_entitlement = AsyncMock(return_value=True)
            lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is not None
        assert lesson.is_locked is False

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_error_returns_none(self, mock_prisma, svc):
        mock_prisma.lesson.find_unique = AsyncMock(side_effect=Exception("DB error"))
        lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is None

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_without_user_id(self, mock_prisma, svc, mock_lesson):
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        lesson = await svc.get_lesson("less-1", user_id=None)
        assert lesson is not None
        assert lesson.is_locked is True

    @patch("app.services.education_service.prisma")
    async def test_update_progress_lesson_not_found(self, mock_prisma, svc):
        mock_prisma.lesson.find_unique = AsyncMock(return_value=None)
        result = await svc.update_lesson_progress("nonexistent", 1, ProgressUpdate(progress=50.0))
        assert result == ProgressUpdateResult.NOT_FOUND


class TestCdnDegradation:
    """Graceful degradation when video CDN is down."""

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_null_video_url(self, mock_prisma, svc, mock_lesson):
        """Lesson with null videoUrl should return None without crashing."""
        mock_lesson.videoUrl = None
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lesson.find_many = AsyncMock(return_value=[mock_lesson])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch("app.services.education_service.entitlement_service") as ent:
            ent.has_entitlement = AsyncMock(return_value=True)
            lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is not None
        assert lesson.video_url is None

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_empty_storage_provider(self, mock_prisma, svc, mock_lesson):
        """Missing storage provider should not crash lesson retrieval."""
        mock_lesson.storageProvider = None
        mock_lesson.videoUrl = "https://cdn.example.com/video.mp4"
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lesson.find_many = AsyncMock(return_value=[mock_lesson])
        mock_prisma.lessonprogress.find_many = AsyncMock(return_value=[])
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_many = AsyncMock(return_value=[])
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        mock_prisma.user.find_unique = AsyncMock(return_value=None)
        with patch("app.services.education_service.entitlement_service") as ent:
            ent.has_entitlement = AsyncMock(return_value=True)
            lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is not None

    @patch("app.services.education_service.prisma")
    async def test_get_lesson_db_failure_returns_none(self, mock_prisma, svc):
        """Database failure in lesson retrieval should return None gracefully."""
        mock_prisma.lesson.find_unique = AsyncMock(side_effect=Exception("DB connection lost"))
        lesson = await svc.get_lesson("less-1", user_id=1)
        assert lesson is None

    @patch("app.services.education_service.prisma")
    async def test_complete_lesson_db_failure(self, mock_prisma, svc, mock_lesson):
        """Database failure during lesson completion should return ERROR."""
        mock_prisma.lesson.find_unique = AsyncMock(side_effect=Exception("DB connection lost"))
        result = await svc.complete_lesson("less-1", user_id=1)
        assert result == ProgressUpdateResult.ERROR


class TestProgressUpdateFailureModes:
    """Failure modes for progress updates."""

    @patch("app.services.education_service.prisma")
    async def test_progress_update_create_fails(self, mock_prisma, svc, mock_lesson):
        """Failure creating progress record should return ERROR."""
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock(side_effect=Exception("Write conflict"))
        result = await svc.update_lesson_progress("less-1", 1, ProgressUpdate(progress=50.0))
        assert result == ProgressUpdateResult.ERROR

    @patch("app.services.education_service.prisma")
    async def test_progress_update_completed_triggers_module_recalc(self, mock_prisma, svc, mock_lesson):
        """Progress with completed=True should trigger module recalculation."""
        mock_lesson.module = MagicMock(instructorId=999)
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.lesson.count = AsyncMock(return_value=5)
        mock_prisma.lessonprogress.count = AsyncMock(return_value=3)
        mock_prisma.enrollment.update_many = AsyncMock()
        with patch.object(svc, "check_access", AsyncMock(return_value=True)):
            result = await svc.update_lesson_progress("less-1", 1, ProgressUpdate(progress=100.0, completed=True))
        assert result == ProgressUpdateResult.OK
