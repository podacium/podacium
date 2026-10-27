"""
services/api/app/agent/tools/edtech/progress.py
Tool 3: Get learning progress, active enrollments, and next lesson.
"""

from typing import Optional, Any, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.core.prisma import prisma


class GetLearningProgressArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    course_id: Optional[str] = Field(
        None, description="Optional specific course ID to check"
    )


class GetLearningProgressTool(BaseTool):
    name = "get_my_learning_progress"
    description = "Fetch the authenticated student's active course enrollments, completion rates, and next lessons."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.ADMIN,
        UserRole.MODERATOR,
    ]
    args_schema = GetLearningProgressArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetLearningProgressArgs = args
        user_id = context.user_id

        where: dict[str, Any] = {"userId": user_id, "deletedAt": None}
        if typed_args.course_id:
            where["moduleId"] = typed_args.course_id

        enrollments = await prisma.enrollment.find_many(
            where=where,
            include={"module": True},
            order={"createdAt": "desc"},
        )

        active_courses: List[dict[str, Any]] = []
        for e in enrollments:
            mod_title = e.module.title if e.module else "Course"
            active_courses.append(
                {
                    "enrollment_id": e.id,
                    "course_id": e.moduleId,
                    "title": mod_title,
                    "progress_percent": e.progress,
                    "completed": e.completedAt is not None,
                    "url": f"/learn/courses/{e.moduleId}",
                }
            )

        return ToolResult(
            success=True,
            data={
                "user_id": user_id,
                "enrolled_count": len(enrollments),
                "courses": active_courses,
            },
            widget_payload={"type": "StudentProgressWidget", "courses": active_courses},
        )
