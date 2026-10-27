import logging
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.core.prisma import prisma
from app.schemas.dashboard import (
    DashboardState, CourseProgress,
)
from .strategies import DashboardStrategy

logger = logging.getLogger(__name__)


class StudentStrategy(DashboardStrategy):
    """Student/learner dashboard — courses, progress, certificates."""

    async def load_role_data(self, user_id: int, state: DashboardState) -> DashboardState:
        state.ongoing_courses = await self._get_ongoing_courses(user_id)
        state.learning_streak = await self._get_learning_streak(user_id)
        state.certificates_earned = await self._count_certificates(user_id)
        return state

    async def _get_ongoing_courses(self, user_id: int) -> List[CourseProgress]:
        enrollments = await self._get_cached(
            user_id, "student_courses", prisma.enrollment.find_many,
            where={"userId": user_id, "completedAt": None},
            include={"module": {"include": {"lessons": True}}},
        ) or []
        if not enrollments:
            return []

        lesson_ids = set()
        module_map = {}
        for enrollment in enrollments:
            if not enrollment.module:
                continue
            module_map[enrollment.module.id] = enrollment.module
            for lesson in enrollment.module.lessons:
                lesson_ids.add(lesson.id)

        if lesson_ids:
            progress_records = await prisma.lessonprogress.find_many(
                where={"userId": user_id, "lessonId": {"in": list(lesson_ids)}},
            )
            completed_map = {p.lessonId: p for p in progress_records if p.isCompleted}
            next_map = {}
            for lesson in sorted(
                [l for e in enrollments if e.module for l in (e.module.lessons or [])],
                key=lambda x: x.order,
            ):
                if lesson.id not in completed_map:
                    next_map[lesson.moduleId] = lesson.title
        else:
            completed_map = {}
            next_map = {}

        courses: List[CourseProgress] = []
        for enrollment in enrollments:
            module = enrollment.module
            if not module:
                continue
            total = len(module.lessons or [])
            completed = sum(1 for l in (module.lessons or []) if l.id in completed_map)
            progress = (completed / total * 100) if total > 0 else 0
            courses.append(CourseProgress(
                id=module.id, title=module.title,
                progress=progress, module_count=total, completed_modules=completed,
                next_lesson=next_map.get(module.id),
                estimated_completion=self._estimate(progress),
                thumbnail_url=module.thumbnailUrl,
            ))
        return courses

    async def _get_learning_streak(self, user_id: int) -> Optional[int]:
        recent = await prisma.lessonprogress.find_many(
            where={"userId": user_id, "isCompleted": True},
            order={"completedAt": "desc"}, take=7,
        )
        if not recent:
            return 0
        streak = 0
        today = datetime.now(timezone.utc).date()
        for day_offset in range(7):
            if any(r.completedAt and r.completedAt.date() == today - timedelta(days=day_offset) for r in recent if r.completedAt):
                streak += 1
            else:
                break
        return streak

    async def _count_certificates(self, user_id: int) -> int:
        return await prisma.certificate.count(where={"userId": user_id})

    def _estimate(self, progress: float):
        if progress >= 100:
            return None
        return datetime.now(timezone.utc) + timedelta(days=(100 - progress) / 3.33)
