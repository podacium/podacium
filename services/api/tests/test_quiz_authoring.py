"""Unit tests for Lesson Quiz Authoring and Deletion endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.routers.education import get_quiz_authoring, delete_quiz_for_lesson


@pytest.mark.asyncio
async def test_get_quiz_authoring_has_quiz(monkeypatch):
    from app.core import prisma

    mock_question = MagicMock()
    mock_question.id = 101
    mock_question.question = "What is Python?"
    mock_question.questionType = "MULTIPLE_CHOICE"
    mock_question.options = (
        '[{"id": "a", "text": "Language"}, {"id": "b", "text": "Snake"}]'
    )
    mock_question.correctAnswer = "a"
    mock_question.explanation = "Python is a high-level programming language."
    mock_question.points = 10
    mock_question.order = 0

    mock_quiz = MagicMock()
    mock_quiz.id = 1
    mock_quiz.title = "Python Basics Assessment"
    mock_quiz.description = "Test your Python knowledge"
    mock_quiz.passingScore = 80
    mock_quiz.timeLimitMinutes = 20
    mock_quiz.retakeCooldownMinutes = 30
    mock_quiz.allowRetake = True
    mock_quiz.shuffleQuestions = False
    mock_quiz.deletedAt = None
    mock_quiz.questions = [mock_question]

    mock_module = MagicMock(id="mod-1", instructorId=42)
    mock_lesson = MagicMock(
        id="les-1",
        moduleId="mod-1",
        module=mock_module,
        quiz=mock_quiz,
    )

    monkeypatch.setattr(
        prisma.prisma.lesson, "find_unique", AsyncMock(return_value=mock_lesson)
    )

    instructor = {"id": 42, "role": "INSTRUCTOR"}
    res = await get_quiz_authoring(lesson_id="les-1", current_user=instructor)

    assert res["hasQuiz"] is True
    assert res["quiz"]["title"] == "Python Basics Assessment"
    assert res["quiz"]["passingScore"] == 80
    assert len(res["quiz"]["questions"]) == 1
    assert res["quiz"]["questions"][0]["correctAnswer"] == "a"
    assert res["quiz"]["questions"][0]["points"] == 10


@pytest.mark.asyncio
async def test_get_quiz_authoring_no_quiz(monkeypatch):
    from app.core import prisma

    mock_module = MagicMock(id="mod-1", instructorId=42)
    mock_lesson = MagicMock(
        id="les-2",
        moduleId="mod-1",
        module=mock_module,
        quiz=None,
    )

    monkeypatch.setattr(
        prisma.prisma.lesson, "find_unique", AsyncMock(return_value=mock_lesson)
    )

    instructor = {"id": 42, "role": "INSTRUCTOR"}
    res = await get_quiz_authoring(lesson_id="les-2", current_user=instructor)

    assert res["hasQuiz"] is False
    assert res["quiz"] is None


@pytest.mark.asyncio
async def test_delete_quiz_for_lesson(monkeypatch):
    from app.core import prisma

    mock_quiz = MagicMock(id=5)
    mock_module = MagicMock(id="mod-1", instructorId=42)
    mock_lesson = MagicMock(
        id="les-1",
        moduleId="mod-1",
        module=mock_module,
        quiz=mock_quiz,
    )

    monkeypatch.setattr(
        prisma.prisma.lesson, "find_unique", AsyncMock(return_value=mock_lesson)
    )
    monkeypatch.setattr(
        prisma.prisma.quizquestion, "delete_many", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(prisma.prisma.quiz, "delete", AsyncMock(return_value=None))
    monkeypatch.setattr(prisma.prisma.lesson, "update", AsyncMock(return_value=None))

    instructor = {"id": 42, "role": "INSTRUCTOR"}
    res = await delete_quiz_for_lesson(lesson_id="les-1", current_user=instructor)

    assert res["success"] is True
    assert res["message"] == "Quiz deleted"
