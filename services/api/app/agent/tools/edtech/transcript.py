"""
services/api/app/agent/tools/edtech/transcript.py
Tool 8: Get lesson transcript and subtitles with PII scrubbing.
"""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.core.prisma import prisma
from app.services.education_service import education_service
from app.agent.security.pii_cleaner import AlgerianComplianceEngine


class GetLessonTranscriptArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    lesson_id: str = Field(
        ..., min_length=1, description="Lesson ID to retrieve transcript for"
    )
    format: Literal["raw_text", "timestamped"] = Field(
        default="raw_text", description="Transcript format"
    )


class GetLessonTranscriptTool(BaseTool):
    name = "get_lesson_transcript"
    description = "Retrieve transcript text or subtitles for a lesson. Enrollment access is required."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.ADMIN,
        UserRole.MODERATOR,
    ]
    args_schema = GetLessonTranscriptArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetLessonTranscriptArgs = args
        lesson = await prisma.lesson.find_first(
            where={"id": typed_args.lesson_id, "deletedAt": None}
        )
        if not lesson:
            return ToolResult(
                success=False, error=f"Lesson '{typed_args.lesson_id}' not found."
            )

        # Check access to module unless preview
        has_access = await education_service.check_access(
            context.user_id, lesson.moduleId
        )
        if not has_access and not lesson.isPreview:
            return ToolResult(
                success=False,
                error="Access denied: Enrollment required to view lesson transcript.",
            )

        transcript_content = (
            lesson.transcript or "No transcript available for this lesson."
        )
        clean_text, _ = await AlgerianComplianceEngine.pre_llm_redact(
            transcript_content, context.session_id
        )

        return ToolResult(
            success=True,
            data={
                "lesson_id": lesson.id,
                "title": lesson.title,
                "transcript": clean_text[:3000],
            },
            widget_payload={
                "type": "LessonTranscriptViewer",
                "lesson_id": lesson.id,
                "title": lesson.title,
            },
        )
