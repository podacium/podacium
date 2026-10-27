"""
services/api/app/agent/tools/edtech/quiz.py
Tools 5 & 6: Get lesson quiz (withheld answers) and submit quiz answers for server-side grading.
"""

from typing import Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.core.prisma import prisma
from app.services.quiz_service import quiz_service
from app.schemas.education import QuizSubmission


class GetQuizArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    lesson_id: str = Field(
        ..., min_length=1, description="Lesson ID associated with the quiz"
    )


class GetQuizTool(BaseTool):
    name = "get_quiz"
    description = "Retrieve test questions and options for a lesson quiz. Answers are strictly withheld."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.ADMIN,
        UserRole.MODERATOR,
    ]
    args_schema = GetQuizArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetQuizArgs = args
        quiz_data = await quiz_service.get_quiz(typed_args.lesson_id)
        if not quiz_data:
            return ToolResult(
                success=False,
                error=f"No quiz found for lesson '{typed_args.lesson_id}'.",
            )

        attempt_id = await quiz_service.start_attempt(
            context.user_id, int(quiz_data["id"])
        )

        return ToolResult(
            success=True,
            data={
                "quiz_id": quiz_data["id"],
                "attempt_id": attempt_id,
                "title": quiz_data["title"],
                "time_limit_minutes": quiz_data["timeLimitMinutes"],
                "passing_score": quiz_data["passingScore"],
                "questions_count": len(quiz_data["questions"]),
                "questions": quiz_data["questions"],
            },
            widget_payload={
                "type": "InteractiveQuiz",
                "quiz_id": quiz_data["id"],
                "attempt_id": attempt_id,
                "title": quiz_data["title"],
                "questions": quiz_data["questions"],
            },
        )


class SubmitQuizAnswersArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    lesson_id: str = Field(..., description="Lesson ID associated with the quiz")
    attempt_id: int = Field(..., gt=0, description="Active QuizAttempt ID")
    answers: Dict[str, Any] = Field(
        ..., min_length=1, description="Map of question_id to selected answer"
    )


class SubmitQuizAnswersTool(BaseTool):
    name = "submit_quiz_answers"
    description = (
        "Submit student answers for automated server-side grading and progress record."
    )
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.ADMIN,
        UserRole.MODERATOR,
    ]
    is_mutating = True
    args_schema = SubmitQuizAnswersArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: SubmitQuizAnswersArgs = args
        submission = QuizSubmission(answers=typed_args.answers)

        result = await quiz_service.submit_attempt(
            user_id=context.user_id,
            attempt_id=typed_args.attempt_id,
            submission=submission,
        )

        if not result.get("success"):
            return ToolResult(
                success=False, error=result.get("error", "Quiz grading failed.")
            )

        passed = result.get("passed", False)
        score = result.get("score", 0.0)

        return ToolResult(
            success=True,
            data={
                "attempt_id": typed_args.attempt_id,
                "score": score,
                "passed": passed,
                "earned_points": result.get("earnedPoints"),
                "total_points": result.get("totalPoints"),
            },
            widget_payload={
                "type": "QuizResultReview",
                "passed": passed,
                "score": score,
                "results": result.get("results"),
            },
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        attempt_id = payload.get("attempt_id")
        if attempt_id:
            await prisma.quizuseranswer.delete_many(where={"attemptId": attempt_id})
            await prisma.quizattempt.update(
                where={"id": attempt_id},
                data={"completedAt": None, "score": 0.0, "isPassed": False},
            )
            return {
                "status": "COMPENSATED",
                "message": f"Quiz attempt {attempt_id} reset.",
            }
        return {"status": "NOOP"}
