"""
Tests for Layer 6 Progression Hardening:
- Client cannot spoof video completion without verified intervals.
- Enrolled paying students retain access on DRAFT/IN_REVIEW module status.
- Anti-cheat rejects speed hack and idle-drift segment duration.
- Server-side unique watched seconds calculation using sweep line algorithm.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.video.interval_tracker import interval_tracker, WatchedIntervalTracker
from app.services.education_service import (
    education_service,
    ProgressUpdateResult,
)
from app.schemas.education import ProgressUpdate


def test_sweep_line_merging_disjoint_and_overlapping():
    tracker = WatchedIntervalTracker()
    intervals = [(0.0, 10.0), (5.0, 15.0), (14.5, 20.0), (30.0, 40.0)]
    merged = tracker.merge_intervals(intervals, jitter_tolerance=0.5)
    assert merged == [(0.0, 20.0), (30.0, 40.0)]
    unique = tracker.calculate_unique_watched_seconds(intervals)
    assert unique == 30.0  # 20s + 10s


def test_heartbeat_rejects_speed_hack():
    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[],
        new_start=0.0,
        new_end=25.0,
        duration_seconds=100.0,
        time_elapsed_since_last_beacon=5.0,  # 5x speed (> 2.5x max)
    )
    assert res["is_valid"] is False
    assert "exceeded max allowed limit" in res["reason"]


def test_heartbeat_rejects_idle_drift_too_large():
    # A single segment of 120s in one heartbeat beacon exceeds max allowed chunk
    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[],
        new_start=0.0,
        new_end=120.0,
        duration_seconds=300.0,
        time_elapsed_since_last_beacon=48.0,
        server_elapsed_seconds=1200.0,  # 20 min idle
    )
    assert res["is_valid"] is False
    assert "exceeds maximum allowed chunk" in res["reason"]


def test_heartbeat_completion_strictly_at_90_percent():
    # 85% watched -> not completed
    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[(0.0, 70.0)],
        new_start=70.0,
        new_end=85.0,
        duration_seconds=100.0,
        time_elapsed_since_last_beacon=15.0,
    )
    assert res["is_valid"] is True
    assert res["progress_percentage"] == 85.0
    assert res["is_completed"] is False

    # Reach 90% watched -> completed
    res2 = interval_tracker.verify_progress_heartbeat(
        existing_intervals=[(0.0, 85.0)],
        new_start=85.0,
        new_end=90.0,
        duration_seconds=100.0,
        time_elapsed_since_last_beacon=5.0,
    )
    assert res2["is_valid"] is True
    assert res2["progress_percentage"] == 90.0
    assert res2["is_completed"] is True


@pytest.mark.asyncio
async def test_update_lesson_progress_rejects_spoofed_completion():
    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-video-1"
    mock_lesson.moduleId = "mod-1"
    mock_lesson.type = "video"
    mock_lesson.durationSeconds = 100.0
    mock_lesson.order = 1
    mock_lesson.quizId = None
    mock_lesson.module = None

    with (
        patch("app.services.education_service.prisma") as mock_prisma,
        patch.object(
            education_service, "check_access", new=AsyncMock(return_value=True)
        ),
        patch.object(
            education_service,
            "_is_lesson_sequentially_locked",
            new=AsyncMock(return_value=False),
        ),
        patch.object(
            interval_tracker, "get_user_intervals", new=AsyncMock(return_value=[])
        ),
    ):
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.user.find_unique = AsyncMock(return_value=None)
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)

        # Attacker posts progress=95.0, completed=True without having watched intervals
        progress_payload = ProgressUpdate(progress=95.0, completed=True)
        result = await education_service.update_lesson_progress(
            "lesson-video-1", user_id=42, progress_data=progress_payload
        )

        # Must reject with CRITERIA_NOT_MET
        assert result == ProgressUpdateResult.CRITERIA_NOT_MET


@pytest.mark.asyncio
async def test_complete_lesson_rejects_unwatched_video():
    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-video-2"
    mock_lesson.moduleId = "mod-1"
    mock_lesson.type = "video"
    mock_lesson.durationSeconds = 100.0
    mock_lesson.order = 1
    mock_lesson.quizId = None
    mock_lesson.module = None

    with (
        patch("app.services.education_service.prisma") as mock_prisma,
        patch.object(
            interval_tracker, "get_user_intervals", new=AsyncMock(return_value=[])
        ),
    ):
        mock_prisma.lesson.find_unique = AsyncMock(return_value=mock_lesson)
        mock_prisma.lessonprogress.find_first = AsyncMock(return_value=None)

        result = await education_service.complete_lesson("lesson-video-2", user_id=42)
        assert result == ProgressUpdateResult.CRITERIA_NOT_MET


@pytest.mark.asyncio
async def test_enrolled_student_retains_access_on_draft_module():
    mock_module = MagicMock()
    mock_module.id = "mod-draft-1"
    mock_module.status = "DRAFT"
    mock_module.deletedAt = None
    mock_module.instructorId = 999  # Someone else is instructor

    mock_enrollment = MagicMock()
    mock_enrollment.id = "enr-1"
    mock_enrollment.userId = 42
    mock_enrollment.moduleId = "mod-draft-1"

    with patch("app.services.education_service.prisma") as mock_prisma:
        mock_prisma.module.find_unique = AsyncMock(return_value=mock_module)
        mock_prisma.enrollment.find_first = AsyncMock(return_value=mock_enrollment)

        can_view = await education_service._can_view_module("mod-draft-1", user_id=42)
        assert can_view is True


@pytest.mark.asyncio
async def test_non_enrolled_student_denied_on_draft_module():
    mock_module = MagicMock()
    mock_module.id = "mod-draft-2"
    mock_module.status = "DRAFT"
    mock_module.deletedAt = None
    mock_module.instructorId = 999

    with patch("app.services.education_service.prisma") as mock_prisma:
        mock_prisma.module.find_unique = AsyncMock(return_value=mock_module)
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        mock_prisma.user.find_unique = AsyncMock(return_value=None)

        can_view = await education_service._can_view_module("mod-draft-2", user_id=42)
        assert can_view is False
