"""
services/api/app/agent/tools/edtech/courses.py
Tools 1 & 2: Search courses catalog and fetch course details with syllabus.
"""

from typing import Optional, Literal, List, Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.core.prisma import prisma


class SearchCoursesArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    query: Optional[str] = Field(
        None, max_length=150, description="Keyword in title, description, or skills"
    )
    level: Optional[Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]] = Field(
        None, description="Difficulty level"
    )
    limit: int = Field(
        default=5, ge=1, le=20, description="Number of courses to return"
    )


class SearchCoursesTool(BaseTool):
    name = "search_courses"
    description = "Search published courses and learning modules on Podacium with filters for difficulty and topic."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    args_schema = SearchCoursesArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: SearchCoursesArgs = args
        where: dict[str, Any] = {"status": "PUBLISHED", "deletedAt": None}

        if typed_args.query:
            where["OR"] = [
                {"title": {"contains": typed_args.query, "mode": "insensitive"}},
                {"description": {"contains": typed_args.query, "mode": "insensitive"}},
            ]
        if typed_args.level:
            where["level"] = typed_args.level

        modules = await prisma.module.find_many(
            where=where,
            take=typed_args.limit,
            order={"createdAt": "desc"},
            include={"instructor": True},
        )

        courses_data: List[dict[str, Any]] = []
        for m in modules:
            instructor_name = (
                m.instructor.fullName if m.instructor else "Podacium Academy"
            )
            price_val = 0
            if isinstance(m.price, dict):
                price_val = m.price.get("discounted") or m.price.get("original") or 0
            elif isinstance(m.price, (int, float)):
                price_val = int(m.price)

            courses_data.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "description": (m.description or "")[:150],
                    "level": m.level,
                    "duration_minutes": m.durationMinutes,
                    "price_dzd": price_val,
                    "instructor_name": instructor_name,
                    "url": f"/learn/courses/{m.id}",
                }
            )

        return ToolResult(
            success=True,
            data={"count": len(courses_data), "courses": courses_data},
            widget_payload={"type": "CourseCarousel", "courses": courses_data},
        )


class GetCourseDetailsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    course_id: str = Field(..., min_length=1, description="Unique course or module ID")
    include_syllabus: bool = Field(
        default=True, description="Whether to include full lesson breakdown"
    )


class GetCourseDetailsTool(BaseTool):
    name = "get_course_details"
    description = "Retrieve detailed course information including syllabus lessons, instructor credentials, and pricing."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    args_schema = GetCourseDetailsArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetCourseDetailsArgs = args
        module = await prisma.module.find_first(
            where={"id": typed_args.course_id, "deletedAt": None},
            include={"instructor": True, "lessons": True},
        )
        if not module:
            return ToolResult(
                success=False, error=f"Course '{typed_args.course_id}' not found."
            )

        lessons_summary: List[dict[str, Any]] = []
        if typed_args.include_syllabus and module.lessons:
            for l in sorted(module.lessons, key=lambda x: x.order):
                lessons_summary.append(
                    {
                        "id": l.id,
                        "title": l.title,
                        "order": l.order,
                        "duration_minutes": l.durationMinutes,
                        "is_preview": l.isPreview,
                    }
                )

        instructor_name = (
            module.instructor.fullName if module.instructor else "Podacium Faculty"
        )
        price_val = 0
        if isinstance(module.price, dict):
            price_val = (
                module.price.get("discounted") or module.price.get("original") or 0
            )
        elif isinstance(module.price, (int, float)):
            price_val = int(module.price)

        detail = {
            "id": module.id,
            "title": module.title,
            "description": module.description,
            "level": module.level,
            "duration_minutes": module.durationMinutes,
            "skills": module.skills,
            "price_dzd": price_val,
            "instructor": {"name": instructor_name},
            "lessons_count": len(lessons_summary),
            "lessons": lessons_summary,
            "url": f"/learn/courses/{module.id}",
        }

        return ToolResult(
            success=True,
            data=detail,
            widget_payload={"type": "CourseDetailCard", "course": detail},
        )
