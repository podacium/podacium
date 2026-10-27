import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.video.interval_tracker import interval_tracker
from app.services.video.heatmap_service import heatmap_service
from app.services.certificate_service import certificate_service
from app.services.quiz_service import quiz_service, QuizService
from app.services.education_service import education_service


class TestEnrollmentLogic:
    """Test enrollment business rules and progress calculations in education_service."""

    @pytest.mark.asyncio
    async def test_progress_calculation_standard(self):
        """Test progress calculation with 7 of 10 completed lessons."""
        with (
            patch(
                "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
            ) as mock_total,
            patch(
                "app.core.prisma.prisma.lessonprogress.count", new_callable=AsyncMock
            ) as mock_completed,
            patch(
                "app.core.prisma.prisma.enrollment.update_many", new_callable=AsyncMock
            ) as mock_update,
        ):
            mock_total.return_value = 10
            mock_completed.return_value = 7

            await education_service._update_module_progress("mod-1", user_id=1)

            mock_update.assert_called_once()
            called_data = mock_update.call_args[1]["data"]
            assert called_data["progress"] == 70.0
            assert "completedAt" not in called_data

    @pytest.mark.asyncio
    async def test_progress_zero_lessons(self):
        """Zero total lessons should safely result in 0.0% progress."""
        with (
            patch(
                "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
            ) as mock_total,
            patch(
                "app.core.prisma.prisma.lessonprogress.count", new_callable=AsyncMock
            ) as mock_completed,
            patch(
                "app.core.prisma.prisma.enrollment.update_many", new_callable=AsyncMock
            ) as mock_update,
        ):
            mock_total.return_value = 0
            mock_completed.return_value = 0

            await education_service._update_module_progress("mod-empty", user_id=1)

            mock_update.assert_called_once()
            assert mock_update.call_args[1]["data"]["progress"] == 0.0

    @pytest.mark.asyncio
    async def test_progress_all_completed_sets_completed_at(self):
        """All lessons completed should be 100.0% and trigger completedAt timestamp."""
        with (
            patch(
                "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
            ) as mock_total,
            patch(
                "app.core.prisma.prisma.lessonprogress.count", new_callable=AsyncMock
            ) as mock_completed,
            patch(
                "app.core.prisma.prisma.enrollment.update_many", new_callable=AsyncMock
            ) as mock_update,
            patch(
                "app.services.billing_services.education_service.education_billing_service.grant_subscription_certificate",
                new_callable=AsyncMock,
            ) as mock_cert,
        ):
            mock_total.return_value = 5
            mock_completed.return_value = 5
            mock_cert.return_value = True

            await education_service._update_module_progress("mod-complete", user_id=1)

            assert mock_update.call_args[1]["data"]["progress"] == 100.0
            assert "completedAt" in mock_update.call_args[1]["data"]

    @pytest.mark.asyncio
    async def test_progress_float_rounding_deterministic(self):
        """Odd fraction like 1/3 (33.333333333333336%) should be deterministically rounded to 33.33."""
        with (
            patch(
                "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
            ) as mock_total,
            patch(
                "app.core.prisma.prisma.lessonprogress.count", new_callable=AsyncMock
            ) as mock_completed,
            patch(
                "app.core.prisma.prisma.enrollment.update_many", new_callable=AsyncMock
            ) as mock_update,
        ):
            mock_total.return_value = 3
            mock_completed.return_value = 1

            await education_service._update_module_progress("mod-third", user_id=1)

            assert mock_update.call_args[1]["data"]["progress"] == 33.33


class TestVideoIntervalAntiCheat:
    """Test anti-cheat video telemetry and interval merging algorithms."""

    def test_sweep_line_merging_with_jitter(self):
        intervals = [(0.0, 10.0), (9.5, 20.0), (25.0, 30.0)]
        merged = interval_tracker.merge_intervals(intervals, jitter_tolerance=1.0)
        assert merged == [(0.0, 20.0), (25.0, 30.0)]

    def test_unique_watched_seconds_calculation(self):
        intervals = [(0.0, 10.0), (5.0, 15.0), (20.0, 25.0)]
        unique_secs = interval_tracker.calculate_unique_watched_seconds(intervals)
        assert unique_secs == 20.0  # 15s (0..15) + 5s (20..25)

    def test_heartbeat_rejects_speed_hack(self):
        # 30 seconds of video played in 5 seconds wall clock = 6x speed (> 2.5x allowed)
        result = interval_tracker.verify_progress_heartbeat(
            existing_intervals=[],
            new_start=0.0,
            new_end=30.0,
            duration_seconds=100.0,
            time_elapsed_since_last_beacon=5.0,
        )
        assert result["is_valid"] is False
        assert "exceeded max allowed limit" in result["reason"]

    def test_heartbeat_completes_at_90_percent(self):
        result = interval_tracker.verify_progress_heartbeat(
            existing_intervals=[(0.0, 80.0)],
            new_start=80.0,
            new_end=95.0,
            duration_seconds=100.0,
            time_elapsed_since_last_beacon=15.0,
        )
        assert result["is_valid"] is True
        assert result["progress_percentage"] == 95.0
        assert result["is_completed"] is True


class TestHeatmapTelemetryAggregation:
    """Test 100-bin telemetry binning."""

    def test_record_and_fetch_bins(self):
        lesson_id = "test-lesson-heatmap-42"
        bins = heatmap_service.record_interval_replay(
            lesson_id=lesson_id,
            start_time=10.0,
            end_time=30.0,
            duration=100.0,
        )
        assert len(bins) == 100
        # Bins 10..30 should have count >= 1
        assert bins[10] >= 1
        assert bins[30] >= 1
        assert bins[0] == 0

        fetched = heatmap_service.get_lesson_heatmap(lesson_id)
        assert fetched[10] >= 1


class TestQuizScoring:
    """Test quiz grading allowlists, question type evaluators, and denominator exclusion."""

    def test_auto_graded_allowlist(self):
        """Auto-graded types should only include supported deterministic question types."""
        mc_q = MagicMock(questionType="MULTIPLE_CHOICE")
        tf_q = MagicMock(questionType="TRUE_FALSE")
        sa_q = MagicMock(questionType="SHORT_ANSWER")
        fib_q = MagicMock(questionType="FILL_IN_BLANK")
        match_q = MagicMock(questionType="MATCHING")
        essay_q = MagicMock(questionType="ESSAY")
        unknown_q = MagicMock(questionType="UNSUPPORTED_RANDOM")

        assert QuizService._is_auto_graded(mc_q) is True
        assert QuizService._is_auto_graded(tf_q) is True
        assert QuizService._is_auto_graded(sa_q) is True
        assert QuizService._is_auto_graded(fib_q) is True
        assert QuizService._is_auto_graded(match_q) is True
        assert QuizService._is_auto_graded(essay_q) is False
        assert QuizService._is_auto_graded(unknown_q) is False

    @pytest.mark.asyncio
    async def test_start_attempt_cooldown_enforcement(self):
        """Test cooldown check prevents retakes within the cooldown window."""
        quiz_id = 99
        user_id = 42

        recent_attempt = MagicMock()
        recent_attempt.id = 101
        recent_attempt.createdAt = datetime.now(timezone.utc) - timedelta(minutes=15)
        recent_attempt.completedAt = datetime.now(timezone.utc) - timedelta(minutes=15)
        recent_attempt.isPassed = False

        mock_quiz = MagicMock(
            allowRetake=True,
            retakeCooldownMinutes=60,
            timeLimitMinutes=30,
        )

        with (
            patch(
                "app.core.prisma.prisma.quizattempt.find_first", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.core.prisma.prisma.quiz.find_unique", new_callable=AsyncMock
            ) as mock_quiz_find,
        ):
            # First find_first is for incomplete attempt (None), second is for last completed attempt
            mock_find.side_effect = [None, recent_attempt]
            mock_quiz_find.return_value = mock_quiz

            result = await quiz_service.start_attempt(user_id=user_id, quiz_id=quiz_id)
            assert result is None, "Should block retake when cooldown is active"

    @pytest.mark.asyncio
    async def test_start_attempt_allowed_after_cooldown(self):
        """Test cooldown allows retake after cooldown period expires."""
        quiz_id = 99
        user_id = 42

        old_attempt = MagicMock()
        old_attempt.id = 101
        old_attempt.createdAt = datetime.now(timezone.utc) - timedelta(minutes=90)
        old_attempt.completedAt = datetime.now(timezone.utc) - timedelta(minutes=90)
        old_attempt.isPassed = False

        mock_quiz = MagicMock(
            allowRetake=True,
            retakeCooldownMinutes=60,
            timeLimitMinutes=30,
        )

        new_attempt = MagicMock()
        new_attempt.id = 102
        new_attempt.startedAt = datetime.now(timezone.utc)

        with (
            patch(
                "app.core.prisma.prisma.quizattempt.find_first", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.core.prisma.prisma.quiz.find_unique", new_callable=AsyncMock
            ) as mock_quiz_find,
            patch(
                "app.core.prisma.prisma.quizattempt.create", new_callable=AsyncMock
            ) as mock_create,
        ):
            mock_find.side_effect = [None, old_attempt]
            mock_quiz_find.return_value = mock_quiz
            mock_create.return_value = new_attempt

            result = await quiz_service.start_attempt(user_id=user_id, quiz_id=quiz_id)
            assert result == 102


class TestCertificateEligibility:
    """Test certificate issuance rules, deterministic signing, and Podacium ID generation."""

    def test_generate_podacium_id_format(self):
        """Podacium ID must start with PDC- and contain timestamp, entropy, and HMAC components."""
        cert_id = certificate_service._generate_podacium_id()
        assert cert_id.startswith("PDC-")
        parts = cert_id.split("-")
        assert len(parts) == 4
        assert len(parts[1]) >= 5
        assert len(parts[2]) >= 10
        assert len(parts[3]) == 6

    def test_canonical_timestamp_reproducibility(self):
        """Canonical timestamp should strip microseconds and ensure UTC timezone."""
        dt = datetime(2026, 9, 17, 14, 30, 45, 123456, tzinfo=timezone.utc)
        ts_str = certificate_service._canonical_ts(dt)
        assert ts_str == "2026-09-17T14:30:45+00:00"
        assert "." not in ts_str

    def test_signature_v2_verification(self):
        """HMAC signature v2 should verify correctly against identical claims."""
        cert_id = "PDC-TEST-123456"
        user_id = 99
        module_id = "mod-cyber-sec"
        issued_at_str = "2026-09-17T14:30:45+00:00"

        sig = certificate_service._generate_signature(
            cert_id, user_id, module_id, None, issued_at_str
        )
        assert sig.startswith("v2:")

        sig_check = certificate_service._generate_signature(
            cert_id, user_id, module_id, None, issued_at_str
        )
        assert sig == sig_check

        sig_tampered = certificate_service._generate_signature(
            cert_id, user_id + 1, module_id, None, issued_at_str
        )
        assert sig != sig_tampered

    @pytest.mark.asyncio
    async def test_module_eligibility_fails_below_100(self):
        """Module eligibility check should fail if progress < 100%."""
        mock_enrollment = MagicMock(progress=95.0, expiresAt=None)
        with (
            patch(
                "app.core.prisma.prisma.enrollment.find_first", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.services.education_service.education_service.check_access",
                new_callable=AsyncMock,
            ) as mock_access,
        ):
            mock_find.return_value = mock_enrollment
            mock_access.return_value = True

            result = await certificate_service.check_module_eligibility(
                user_id=1, module_id="mod-1"
            )
            assert result["eligible"] is False
            assert "Progress is 95.0%" in result["reason"]


class TestCreatorRoyalties:
    @pytest.mark.asyncio
    async def test_course_purchase_credits_creator_royalty(self):
        """Course purchase should calculate 80% creator royalty and credit instructor wallet."""
        from app.services.billing_services.education_service import (
            education_billing_service,
        )
        from app.schemas.billing_schemas.base import PaymentPurpose

        mock_module = MagicMock(
            id="mod-101",
            title="FastAPI Mastery",
            instructorId=42,
        )
        mock_tx = MagicMock(
            id=1234,
            amount=10000,
        )
        mock_instructor_wallet = MagicMock(id=55, userId=42, podaPoints=0)

        with (
            patch(
                "app.core.prisma.prisma.module.find_unique", new_callable=AsyncMock
            ) as mock_mod_find,
            patch(
                "app.core.prisma.prisma.transaction.find_unique", new_callable=AsyncMock
            ) as mock_tx_find,
            patch(
                "app.core.prisma.prisma.wallettransaction.find_first",
                new_callable=AsyncMock,
            ) as mock_wt_find,
            patch(
                "app.services.wallet_service.wallet_service.ensure_user_wallet",
                new_callable=AsyncMock,
            ) as mock_ensure_wallet,
            patch(
                "app.services.wallet_service.wallet_service.credit_wallet",
                new_callable=AsyncMock,
            ) as mock_credit,
            patch(
                "app.services.billing_services.entitlement_service.entitlement_service.grant_entitlement",
                new_callable=AsyncMock,
            ),
            patch.object(
                education_billing_service, "_ensure_enrollment", new_callable=AsyncMock
            ),
            patch(
                "app.core.prisma.prisma.wallettransaction.update",
                new_callable=AsyncMock,
            ),
        ):
            mock_mod_find.return_value = mock_module
            mock_tx_find.return_value = mock_tx
            mock_wt_find.side_effect = [
                None,
                MagicMock(id=999),
            ]  # First check None (not yet credited), then latest_wt for metadata
            mock_ensure_wallet.return_value = mock_instructor_wallet

            await education_billing_service._handle_course_purchase(
                user_id=10,
                metadata={"course_id": "mod-101"},
                transaction_id=1234,
            )

            # Expected 80% of 10000 DZD = 8000 DZD
            mock_ensure_wallet.assert_called_once_with(42)
            mock_credit.assert_called_once_with(
                wallet_id=55,
                amount=8000,
                purpose=PaymentPurpose.CREATOR_ROYALTY,
                reference_id="royalty:tx_1234:mod_mod-101",
                description="Royalty for course purchase: FastAPI Mastery",
                skip_transaction=True,
            )

    @pytest.mark.asyncio
    async def test_course_purchase_royalty_idempotency(self):
        """Duplicate course purchase processing must not double-credit instructor."""
        from app.services.billing_services.education_service import (
            education_billing_service,
        )

        mock_module = MagicMock(
            id="mod-101",
            title="FastAPI Mastery",
            instructorId=42,
        )
        mock_tx = MagicMock(id=1234, amount=10000)
        existing_credit = MagicMock(id=99, amount=8000)

        with (
            patch(
                "app.core.prisma.prisma.module.find_unique", new_callable=AsyncMock
            ) as mock_mod_find,
            patch(
                "app.core.prisma.prisma.transaction.find_unique", new_callable=AsyncMock
            ) as mock_tx_find,
            patch(
                "app.core.prisma.prisma.wallettransaction.find_first",
                new_callable=AsyncMock,
            ) as mock_wt_find,
            patch(
                "app.services.wallet_service.wallet_service.credit_wallet",
                new_callable=AsyncMock,
            ) as mock_credit,
            patch(
                "app.services.billing_services.entitlement_service.entitlement_service.grant_entitlement",
                new_callable=AsyncMock,
            ),
            patch.object(
                education_billing_service, "_ensure_enrollment", new_callable=AsyncMock
            ),
        ):
            mock_mod_find.return_value = mock_module
            mock_tx_find.return_value = mock_tx
            mock_wt_find.return_value = existing_credit  # Already credited!

            await education_billing_service._handle_course_purchase(
                user_id=10,
                metadata={"course_id": "mod-101"},
                transaction_id=1234,
            )

            mock_credit.assert_not_called()


class TestEducationSecurity:
    @pytest.mark.asyncio
    async def test_non_admin_cannot_feature_module(self):
        """Non-admin instructors must be blocked from self-promoting courses via featured=True."""
        from fastapi import HTTPException
        from app.routers.education import update_module
        from app.schemas.education import ModuleUpdate

        instructor_user = MagicMock(id=42, role="INSTRUCTOR")
        update_data = ModuleUpdate(title="Hacked Course", featured=True)

        with pytest.raises(HTTPException) as exc_info:
            await update_module(
                module_id="mod-101",
                module_data=update_data,
                current_user=instructor_user,
            )
        assert exc_info.value.status_code == 403
        assert "feature courses" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_non_admin_cannot_feature_learning_path(self):
        """Non-admin instructors must be blocked from self-promoting paths via featured=True."""
        from fastapi import HTTPException
        from app.routers.education import update_learning_path
        from app.schemas.education import InstructorPathUpdate

        instructor_user = MagicMock(id=42, role="INSTRUCTOR")
        update_data = InstructorPathUpdate(title="Hacked Path", featured=True)

        with pytest.raises(HTTPException) as exc_info:
            await update_learning_path(
                path_id="path-101",
                data=update_data,
                current_user=instructor_user,
            )
        assert exc_info.value.status_code == 403
        assert "feature learning paths" in exc_info.value.detail


class TestCurriculumReordering:
    @pytest.mark.asyncio
    async def test_reorder_module_lessons_sequential_reindexing_no_collisions(self):
        """Atomic transaction re-indexes sibling lessons sequentially (1, 2, 3...) eliminating collisions."""
        from app.services.education_service import education_service
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_tx = MagicMock()
        mock_tx.lesson.update = AsyncMock()

        class MockTxContext:
            async def __aenter__(self):
                return mock_tx

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                return False

        with (
            patch(
                "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
            ) as mock_count,
            patch("app.core.prisma.prisma.tx", return_value=MockTxContext()),
            patch.object(
                education_service, "recalculate_module_duration", new_callable=AsyncMock
            ) as mock_mod_dur,
            patch.object(
                education_service,
                "recalculate_parent_paths_for_module",
                new_callable=AsyncMock,
            ) as mock_parent_dur,
        ):
            mock_count.return_value = 3

            # Input has collisions/duplicate orders and unordered values: order 5, order 1, order 1
            payload = [
                {"lessonId": "les-c", "order": 5},
                {"lessonId": "les-a", "order": 1},
                {"lessonId": "les-b", "order": 1},
            ]

            success = await education_service.reorder_module_lessons("mod-1", payload)
            assert success is True

            # Verify sequential 1-based sequential re-indexing without collisions:
            # Sorted: les-a (order 1, idx 1) -> order 1, les-b (order 1, idx 2) -> order 2, les-c (order 5, idx 0) -> order 3
            assert mock_tx.lesson.update.call_count == 3
            mock_tx.lesson.update.assert_any_call(
                where={"id": "les-a"}, data={"order": 1}
            )
            mock_tx.lesson.update.assert_any_call(
                where={"id": "les-b"}, data={"order": 2}
            )
            mock_tx.lesson.update.assert_any_call(
                where={"id": "les-c"}, data={"order": 3}
            )

            mock_mod_dur.assert_called_once_with("mod-1")
            mock_parent_dur.assert_called_once_with("mod-1")

    @pytest.mark.asyncio
    async def test_reorder_module_lessons_rejects_duplicate_ids(self):
        """Duplicate lesson IDs in reorder payload must raise ValueError."""
        from app.services.education_service import education_service

        payload = [
            {"lessonId": "les-1", "order": 1},
            {"lessonId": "les-1", "order": 2},
        ]

        with pytest.raises(ValueError) as exc:
            await education_service.reorder_module_lessons("mod-1", payload)
        assert "Duplicate lesson IDs" in str(exc.value)

    @pytest.mark.asyncio
    async def test_reorder_module_lessons_rejects_unowned_lessons(self):
        """Foreign lesson IDs not belonging to the module must raise ValueError."""
        from app.services.education_service import education_service
        from unittest.mock import AsyncMock, patch

        with patch(
            "app.core.prisma.prisma.lesson.count", new_callable=AsyncMock
        ) as mock_count:
            # Only 1 of the 2 lessons belongs to mod-1
            mock_count.return_value = 1

            payload = [
                {"lessonId": "les-1", "order": 1},
                {"lessonId": "les-foreign", "order": 2},
            ]

            with pytest.raises(ValueError) as exc:
                await education_service.reorder_module_lessons("mod-1", payload)
            assert "do not belong to this module" in str(exc.value)

    @pytest.mark.asyncio
    async def test_reorder_path_modules_sequential_reindexing(self):
        """Atomic transaction re-indexes path modules sequentially and recalculates path duration."""
        from app.services.education_service import education_service
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_tx = MagicMock()
        mock_tx.pathmodule.update = AsyncMock()

        class MockTxContext:
            async def __aenter__(self):
                return mock_tx

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                return False

        mock_link1 = MagicMock(id=101, moduleId="mod-x")
        mock_link2 = MagicMock(id=102, moduleId="mod-y")

        with (
            patch(
                "app.core.prisma.prisma.pathmodule.find_many", new_callable=AsyncMock
            ) as mock_find_many,
            patch("app.core.prisma.prisma.tx", return_value=MockTxContext()),
            patch.object(
                education_service, "recalculate_path_duration", new_callable=AsyncMock
            ) as mock_path_dur,
        ):
            mock_find_many.return_value = [mock_link1, mock_link2]

            payload = [
                {"moduleId": "mod-y", "order": 1},
                {"moduleId": "mod-x", "order": 2},
            ]

            success = await education_service.reorder_path_modules("path-1", payload)
            assert success is True

            assert mock_tx.pathmodule.update.call_count == 2
            mock_tx.pathmodule.update.assert_any_call(
                where={"id": 102}, data={"order": 1}
            )
            mock_tx.pathmodule.update.assert_any_call(
                where={"id": 101}, data={"order": 2}
            )

            mock_path_dur.assert_called_once_with("path-1")
