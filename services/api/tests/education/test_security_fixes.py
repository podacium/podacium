"""Regression tests for security fixes.

Each test class maps to a security hardening measure:
- TestModuleOwnershipRBAC       → Module ownership enforcement for live-session link/unlink
- TestNoCertificateOnPurchase   → Certificate auto-grant prevention on purchase
- TestVerifyUnsignedCertificate → Unsigned certificate verification rejection
- TestProgressAntiForgery       → Server-side completion criteria + monotonic progress
- TestEssayQuizDenominator      → Essay questions excluded from auto-graded denominator
- TestVideoUploadValidation     → Video upload validation (extension, magic bytes, size)
- TestSubtitleTraversal         → Subtitle path traversal rejection
- TestSignedUrlProviderGuard    → Signed-url provider allowlist enforcement
- TestIdempotencyReservation    → Idempotency reservation for double-charge prevention
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from types import SimpleNamespace
from app.services.education_service import ProgressUpdateResult

from app.routers.education import (
    _ensure_instructor_owns_module,
    link_session_to_module,
    unlink_session_from_module,
)
from app.schemas.education import (
    LiveSessionModuleLinkCreate,
    ProgressUpdate,
    QuizSubmission,
)
from app.services.quiz_service import QuizService


@pytest.fixture
def qsvc():
    return QuizService()


def _instructor_user(user_id: str = "inst-1") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="INSTRUCTOR")


def _admin_user() -> SimpleNamespace:
    return SimpleNamespace(id="admin-1", role="ADMIN")


def _student_user() -> SimpleNamespace:
    return SimpleNamespace(id="stu-1", role="STUDENT")


class TestModuleOwnershipRBAC:
    """Module ownership must be enforced for live-session link ops."""

    def test_module_owner_instructor_allowed(self):
        _ensure_instructor_owns_module(
            _instructor_user("inst-1"), MagicMock(instructorId="inst-1")
        )

    def test_other_instructor_denied(self):
        with pytest.raises(HTTPException) as exc:
            _ensure_instructor_owns_module(
                _instructor_user("inst-2"), MagicMock(instructorId="inst-1")
            )
        assert exc.value.status_code == 403

    def test_admin_allowed(self):
        _ensure_instructor_owns_module(_admin_user(), MagicMock(instructorId="someone"))

    def test_student_denied(self):
        with pytest.raises(HTTPException) as exc:
            _ensure_instructor_owns_module(
                _student_user(), MagicMock(instructorId="inst-1")
            )
        assert exc.value.status_code == 403

    @patch("app.routers.education.prisma")
    async def test_link_session_non_owner_instructor_denied(self, mock_prisma):
        """The endpoint must reject an instructor who does not own the module."""
        mock_prisma.module.find_unique = AsyncMock(
            return_value=MagicMock(instructorId="inst-owner")
        )
        with pytest.raises(HTTPException) as exc:
            await link_session_to_module(
                module_id="mod-1",
                link_data=LiveSessionModuleLinkCreate(
                    module_id="mod-1", session_id="sess-1"
                ),
                current_user=_instructor_user("intruder"),
            )
        assert exc.value.status_code == 403

    @patch("app.routers.education.prisma")
    async def test_unlink_session_non_owner_instructor_denied(self, mock_prisma):
        mock_prisma.module.find_unique = AsyncMock(
            return_value=MagicMock(instructorId="inst-owner")
        )
        with pytest.raises(HTTPException) as exc:
            await unlink_session_from_module(
                module_id="mod-1",
                session_id="sess-1",
                current_user=_instructor_user("intruder"),
            )
        assert exc.value.status_code == 403


class TestNoCertificateOnPurchase:
    """Purchasing a course/path must NOT issue a certificate."""

    @patch("app.services.billing_services.education_service.entitlement_service")
    @patch("app.services.billing_services.education_service.prisma")
    async def test_course_purchase_grants_no_certificate(self, mock_prisma, mock_ent):
        from app.services.billing_services.education_service import (
            EducationBillingService,
        )

        mock_ent.grant_entitlement = AsyncMock()
        svc = EducationBillingService()
        svc._ensure_enrollment = AsyncMock()

        await svc._handle_course_purchase(
            user_id=1,
            metadata={"course_id": "course-1"},
            transaction_id=99,
        )

        mock_ent.grant_entitlement.assert_awaited_once()
        svc._ensure_enrollment.assert_awaited_once()
        # The legacy bug created a certificate record at purchase time.
        assert not mock_prisma.certificate.create.called

    @patch("app.services.billing_services.education_service.entitlement_service")
    @patch("app.services.billing_services.education_service.prisma")
    async def test_path_purchase_grants_no_certificate(self, mock_prisma, mock_ent):
        from app.services.billing_services.education_service import (
            EducationBillingService,
        )

        mock_ent.grant_entitlement = AsyncMock()
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        svc = EducationBillingService()
        svc._ensure_enrollment = AsyncMock()

        await svc._handle_path_purchase(
            user_id=1,
            metadata={"path_id": "path-1"},
            transaction_id=98,
        )

        mock_ent.grant_entitlement.assert_awaited()
        svc._ensure_enrollment.assert_awaited()
        assert not mock_prisma.certificate.create.called


class TestVerifyUnsignedCertificate:
    """Certificates without a digital signature must not verify."""

    @patch("app.services.certificate_service.prisma")
    async def test_unsigned_certificate_reported_invalid(self, mock_prisma):
        from app.services.certificate_service import CertificateService

        cert = MagicMock(
            certificateId="c-1",
            userId=1,
            moduleId="mod-1",
            pathId=None,
            issuedAt=datetime.now(timezone.utc),
            digitalSignature=None,
            revokedAt=None,
            deletedAt=None,
            verificationUrl=None,
            qrCodeUrl=None,
            metadata=None,
            module=MagicMock(title="Course"),
            path=None,
            user=MagicMock(fullName="Test User", email="t@t.com"),
        )
        mock_prisma.certificate.find_unique = AsyncMock(return_value=cert)

        result = await CertificateService().verify_certificate("c-1")

        assert result is not None
        assert result["isValid"] is False
        assert result["reason"] == "UNSIGNED_CERTIFICATE"


class TestProgressAntiForgery:
    """Server-side completion criteria + monotonic progress."""

    def _svc(self):
        from app.services.education_service import EducationService

        svc = EducationService()
        svc.check_access = AsyncMock(return_value=True)
        svc._update_module_progress = AsyncMock()
        return svc

    @patch("app.services.education_service.prisma")
    async def test_video_completion_below_90_rejected(self, mock_prisma):
        lesson = MagicMock(
            id="l-1",
            moduleId="mod-1",
            module=None,
            quiz=None,
            quizId=None,
            type="video",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)

        result = await self._svc().update_lesson_progress(
            "l-1", 1, ProgressUpdate(progress=50.0, completed=True)
        )
        assert result == ProgressUpdateResult.CRITERIA_NOT_MET
        # Completion forgery must never reach the DB.
        assert not mock_prisma.lessonprogress.create.called

    @patch("app.services.education_service.prisma")
    async def test_video_completion_at_90_accepted(self, mock_prisma):
        lesson = MagicMock(
            id="l-1",
            moduleId="mod-1",
            module=None,
            quiz=None,
            quizId=None,
            type="video",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.create = AsyncMock()

        result = await self._svc().update_lesson_progress(
            "l-1", 1, ProgressUpdate(progress=95.0, completed=True)
        )
        assert result == ProgressUpdateResult.OK
        mock_prisma.lessonprogress.create.assert_awaited_once()

    @patch("app.services.education_service.prisma")
    async def test_quiz_completion_without_passed_attempt_rejected(self, mock_prisma):
        lesson = MagicMock(
            id="l-1",
            moduleId="mod-1",
            module=None,
            quiz=MagicMock(id="qz-1"),
            type="quiz",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_first = AsyncMock(return_value=None)

        result = await self._svc().update_lesson_progress(
            "l-1", 1, ProgressUpdate(progress=100.0, completed=True)
        )
        assert result == ProgressUpdateResult.CRITERIA_NOT_MET

    @patch("app.services.education_service.prisma")
    async def test_quiz_completion_with_passed_attempt_accepted(self, mock_prisma):
        lesson = MagicMock(
            id="l-1",
            moduleId="mod-1",
            module=None,
            quiz=MagicMock(id="qz-1"),
            type="quiz",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)
        mock_prisma.quizattempt.find_first = AsyncMock(
            return_value=MagicMock(isPassed=True)
        )
        mock_prisma.lessonprogress.create = AsyncMock()

        result = await self._svc().update_lesson_progress(
            "l-1", 1, ProgressUpdate(progress=100.0, completed=True)
        )
        assert result == ProgressUpdateResult.OK

    @patch("app.services.education_service.prisma")
    async def test_progress_is_monotonic(self, mock_prisma):
        lesson = MagicMock(
            id="l-1",
            moduleId="mod-1",
            module=None,
            quiz=None,
            quizId=None,
            type="video",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(role="STUDENT"))
        existing = MagicMock(
            id="lp-1", progress=80.0, isCompleted=False, completedAt=None
        )
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=existing)
        mock_prisma.lessonprogress.update = AsyncMock()

        result = await self._svc().update_lesson_progress(
            "l-1", 1, ProgressUpdate(progress=30.0, completed=False)
        )
        assert result == ProgressUpdateResult.OK
        _, kwargs = mock_prisma.lessonprogress.update.await_args
        assert kwargs["data"]["progress"] == 80.0
        assert kwargs["data"]["isCompleted"] is False


class TestEssayQuizDenominator:
    """Essay questions are excluded from the auto-graded denominator."""

    @patch("app.services.quiz_service.prisma")
    async def test_mixed_quiz_passes_on_mcq_denominator(self, mock_prisma, qsvc):
        submission = QuizSubmission(answers={"1": "A"})
        mock_attempt = MagicMock(
            id=1,
            userId=1,
            completedAt=None,
            startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(
                timeLimitMinutes=30,
                passingScore=60,
                questions=[
                    MagicMock(
                        id=1,
                        questionType="MULTIPLE_CHOICE",
                        points=80,
                        correctAnswer="A",
                        options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}],
                    ),
                    MagicMock(
                        id=2,
                        questionType="ESSAY",
                        points=20,
                        correctAnswer=None,
                        options=None,
                    ),
                ],
            ),
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()

        result = await qsvc.submit_attempt(1, 1, submission)

        assert result["success"] is True
        assert result["score"] == 100.0
        assert result["passed"] is True
        assert result["essayPoints"] == 20
        # Answers are persisted in a single batched insert (N+1 fix).
        mock_prisma.quizuseranswer.create_many.assert_awaited_once()

    @patch("app.services.quiz_service.prisma")
    async def test_essay_only_quiz_cannot_be_passed(self, mock_prisma, qsvc):
        submission = QuizSubmission(answers={"1": "my essay"})
        mock_attempt = MagicMock(
            id=1,
            userId=1,
            completedAt=None,
            startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(
                timeLimitMinutes=30,
                passingScore=50,
                questions=[
                    MagicMock(
                        id=1,
                        questionType="ESSAY",
                        points=20,
                        correctAnswer=None,
                        options=None,
                    ),
                ],
            ),
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()

        result = await qsvc.submit_attempt(1, 1, submission)

        assert result["success"] is True
        assert result["score"] == 0.0
        assert result["passed"] is False


class TestVideoUploadValidation:
    """Video uploads are validated by extension, magic bytes and size."""

    def _fake_file(self, filename, content_type, chunks):
        async def read(n=-1):
            if chunks:
                return chunks.pop(0)
            return b""

        async def seek(offset):
            return None

        return MagicMock(
            filename=filename,
            content_type=content_type,
            read=read,
            seek=seek,
        )

    async def test_blocked_extension_rejected(self):
        from app.services.file_validation_service import validate_video_upload

        ok, err = await validate_video_upload(
            self._fake_file("evil.exe", "video/mp4", [])
        )
        assert ok is False
        assert "not a supported video format" in err

    async def test_wrong_magic_bytes_rejected(self):
        from app.services.file_validation_service import validate_video_upload

        ok, err = await validate_video_upload(
            self._fake_file(
                "clip.mp4", "video/mp4", [b"%PDF-1.7 fake pdf" + b"0" * 1024]
            )
        )
        assert ok is False
        assert "not a recognized video container" in err

    async def test_oversize_rejected(self):
        from app.services.file_validation_service import validate_video_upload

        header = b"\x00\x00\x00\x18ftypmp42" + b"0" * (16 * 1024)
        ok, err = await validate_video_upload(
            self._fake_file("big.mp4", "video/mp4", [header, b"1" * (2 * 1024 * 1024)]),
            max_size=1 * 1024 * 1024,
        )
        assert ok is False
        assert "too large" in err

    async def test_valid_mp4_accepted(self):
        from app.services.file_validation_service import validate_video_upload

        header = b"\x00\x00\x00\x18ftypmp42" + b"0" * (16 * 1024)
        ok, err = await validate_video_upload(
            self._fake_file("clip.mp4", "video/mp4", [header, b"more data"])
        )
        assert ok is True
        assert err is None


class TestSubtitleTraversal:
    """Subtitle endpoint must reject path traversal before touching disk."""

    async def test_traversal_rejected(self):
        from app.routers.subtitles import get_lesson_subtitles

        with pytest.raises(HTTPException) as exc:
            await get_lesson_subtitles("../../etc/passwd", MagicMock())
        assert exc.value.status_code == 400


class TestSignedUrlProviderGuard:
    """Signed-url endpoint must not accept arbitrary providers/raw URLs."""

    @patch(
        "app.services.education_service.education_service.check_access",
        new=AsyncMock(return_value=True),
    )
    @patch("app.routers.education.prisma")
    async def test_invalid_provider_rejected(self, mock_prisma):
        from app.routers.education import get_video_signed_url

        lesson = MagicMock(module=MagicMock(instructorId="inst-1"), moduleId="mod-1")
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)

        with pytest.raises(HTTPException) as exc:
            await get_video_signed_url(
                lesson_id="l-1",
                provider="javascript:alert(1)",
                current_user=SimpleNamespace(id="stu-1", role="STUDENT"),
            )
        assert exc.value.status_code == 400

    @patch(
        "app.services.education_service.education_service.check_access",
        new=AsyncMock(return_value=True),
    )
    @patch("app.routers.education.prisma")
    async def test_external_raw_url_not_returned_unsigned(self, mock_prisma):
        from app.routers.education import get_video_signed_url

        lesson = MagicMock(
            module=MagicMock(instructorId="inst-1"),
            moduleId="mod-1",
            storageProvider="cloudfront",
            hlsPath=None,
            videoUrl="https://evil.example.com/private/video.mp4",
        )
        mock_prisma.lesson.find_unique = AsyncMock(return_value=lesson)

        with pytest.raises(HTTPException) as exc:
            await get_video_signed_url(
                lesson_id="l-1",
                provider="cloudfront",
                current_user=SimpleNamespace(id="stu-1", role="STUDENT"),
            )
        assert exc.value.status_code == 400


class TestIdempotencyReservation:
    """Idempotency reservation closes the concurrent double-charge race."""

    @patch("app.routers.billing_routers.payment_router.prisma")
    async def test_first_claim_wins(self, mock_prisma):
        from app.routers.billing_routers.payment_router import _reserve_idempotency

        mock_prisma.idempotencykey.create_many = AsyncMock(return_value=1)
        assert await _reserve_idempotency("k-1", 1) is True

    @patch("app.routers.billing_routers.payment_router.prisma")
    async def test_duplicate_claim_rejected(self, mock_prisma):
        from app.routers.billing_routers.payment_router import _reserve_idempotency

        mock_prisma.idempotencykey.create_many = AsyncMock(return_value=0)
        assert await _reserve_idempotency("k-1", 1) is False

    @patch("app.routers.billing_routers.payment_router.prisma")
    async def test_no_key_still_processes(self, mock_prisma):
        from app.routers.billing_routers.payment_router import _reserve_idempotency

        assert await _reserve_idempotency(None, 1) is True
