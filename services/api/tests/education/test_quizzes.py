"""Tests for quiz attempts, scoring, and edge cases."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

from app.services.quiz_service import QuizService, QuizSubmission


@pytest.fixture
def qsvc():
    return QuizService()


@pytest.fixture
def mock_quiz():
    return MagicMock(
        id=1, lessonId="less-1", title="Test Quiz", description=None,
        passingScore=90, timeLimitMinutes=30, allowRetake=True,
        shuffleQuestions=False, retakeCooldownMinutes=60,
    )


@pytest.fixture
def mock_attempt():
    return MagicMock(
        id=1, userId=1, quizId=1, score=0.0, isPassed=False,
        startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
        completedAt=None, timeSpent=None,
    )


class TestGetQuiz:
    """Quiz retrieval."""

    @patch("app.services.quiz_service.prisma")
    async def test_get_quiz_with_questions(self, mock_prisma, qsvc):
        """get_quiz should return quiz with formatted questions (no answers)."""
        mock_prisma.quiz.find_unique = AsyncMock(return_value=MagicMock(
            id=1, title="Test Quiz", description=None, passingScore=90,
            timeLimitMinutes=30, allowRetake=True, shuffleQuestions=False,
            retakeCooldownMinutes=60, questions=[
                MagicMock(id=1, question="Q1?", questionType="MULTIPLE_CHOICE",
                          points=10, explanation="Hmm", order=0, deletedAt=None,
                          options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}]),
            ]
        ))
        result = await qsvc.get_quiz("less-1")
        assert result["title"] == "Test Quiz"
        assert len(result["questions"]) == 1
        assert "correctAnswer" not in result["questions"][0]

    @patch("app.services.quiz_service.prisma")
    async def test_get_quiz_not_found(self, mock_prisma, qsvc):
        """No quiz for lesson should return None."""
        mock_prisma.quiz.find_unique = AsyncMock(return_value=None)
        result = await qsvc.get_quiz("less-1")
        assert result is None


class TestStartAttempt:
    """Quiz attempt creation."""

    @patch("app.services.quiz_service.prisma")
    async def test_first_attempt_allowed(self, mock_prisma, qsvc, mock_quiz):
        """First attempt should always be allowed."""
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,  # no incomplete
            None,  # no completed
        ])
        mock_prisma.quizattempt.create = AsyncMock(return_value=MagicMock(id=1))
        result = await qsvc.start_attempt(1, 1)
        assert result == 1

    @patch("app.services.quiz_service.prisma")
    async def test_continue_incomplete_attempt(self, mock_prisma, qsvc, mock_quiz, mock_attempt):
        """Incomplete attempt within time should be continued."""
        mock_prisma.quizattempt.find_first = AsyncMock(return_value=mock_attempt)
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        result = await qsvc.start_attempt(1, 1)
        assert result == 1

    @patch("app.services.quiz_service.prisma")
    async def test_expired_incomplete_creates_new(self, mock_prisma, qsvc, mock_quiz):
        """Expired incomplete attempt should auto-complete and create new."""
        expired = MagicMock(
            id=1, userId=1, quizId=1, score=0.0, isPassed=False,
            startedAt=datetime.now(timezone.utc) - timedelta(hours=2),
            completedAt=None,
        )
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            expired,  # incomplete found
            None,     # no completed
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        mock_prisma.quizattempt.update = AsyncMock()
        mock_prisma.quizattempt.create = AsyncMock(return_value=MagicMock(id=2))
        result = await qsvc.start_attempt(1, 1)
        assert result == 2
        mock_prisma.quizattempt.update.assert_awaited_once()

    @patch("app.services.quiz_service.prisma")
    async def test_retake_not_allowed(self, mock_prisma, qsvc, mock_quiz):
        """allowRetake=False with passed attempt should block retry."""
        mock_quiz.allowRetake = False
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,  # no incomplete
            MagicMock(isPassed=True),  # completed and passed
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        result = await qsvc.start_attempt(1, 1)
        assert result is None

    @patch("app.services.quiz_service.prisma")
    async def test_retake_allowed_on_fail(self, mock_prisma, qsvc, mock_quiz):
        """allowRetake=False with failed attempt should allow retry."""
        mock_quiz.allowRetake = False
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,  # no incomplete
            MagicMock(isPassed=False, createdAt=datetime.now(timezone.utc) - timedelta(hours=2)),  # completed but failed, cooldown expired
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        mock_prisma.quizattempt.create = AsyncMock(return_value=MagicMock(id=2))
        result = await qsvc.start_attempt(1, 1)
        assert result == 2

    @patch("app.services.quiz_service.prisma")
    async def test_cooldown_not_expired(self, mock_prisma, qsvc, mock_quiz):
        """Cooldown period should block retry."""
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,  # no incomplete
            MagicMock(isPassed=False, createdAt=datetime.now(timezone.utc) - timedelta(minutes=10)),
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        result = await qsvc.start_attempt(1, 1)
        assert result is None

    @patch("app.services.quiz_service.prisma")
    async def test_negative_cooldown_ignored(self, mock_prisma, qsvc, mock_quiz):
        """Negative cooldown should be treated as 0 (no cooldown)."""
        mock_quiz.retakeCooldownMinutes = -5
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,  # no incomplete
            MagicMock(isPassed=False, createdAt=datetime.now(timezone.utc) - timedelta(seconds=30)),
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        mock_prisma.quizattempt.create = AsyncMock(return_value=MagicMock(id=3))
        result = await qsvc.start_attempt(1, 1)
        assert result == 3


class TestSubmitAttempt:
    """Quiz submission and grading."""

    @patch("app.services.quiz_service.prisma")
    async def test_submit_all_correct(self, mock_prisma, qsvc):
        """All correct answers should yield 100%."""
        submission = QuizSubmission(answers={"1": "A", "2": "True"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MULTIPLE_CHOICE", points=10,
                          correctAnswer="A", options=[{"id": "0", "text": "B"}, {"id": "1", "text": "A"}]),
                MagicMock(id=2, questionType="TRUE_FALSE", points=10,
                          correctAnswer="True", options=[{"id": "0", "text": "False"}, {"id": "1", "text": "True"}]),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 100.0
        assert result["passed"] is True

    @patch("app.services.quiz_service.prisma")
    async def test_submit_all_wrong(self, mock_prisma, qsvc):
        """All wrong answers should yield 0%."""
        submission = QuizSubmission(answers={"1": "B"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MULTIPLE_CHOICE", points=10,
                          correctAnswer="A", options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}]),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0
        assert result["passed"] is False

    @patch("app.services.quiz_service.prisma")
    async def test_submit_time_exceeded(self, mock_prisma, qsvc):
        """Submission after time limit should fail."""
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None,
            startedAt=datetime.now(timezone.utc) - timedelta(hours=2),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        result = await qsvc.submit_attempt(1, 1, QuizSubmission(answers={}))
        assert result["success"] is False

    @patch("app.services.quiz_service.prisma")
    async def test_submit_essay_full_points(self, mock_prisma, qsvc):
        """Essay questions should NOT auto-award full points (await manual grading)."""
        submission = QuizSubmission(answers={"1": "My essay answer here"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="ESSAY", points=20,
                          correctAnswer=None, options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0

    @patch("app.services.quiz_service.prisma")
    async def test_submit_short_answer_keyword_match(self, mock_prisma, qsvc):
        """Short answer should match on keywords (50% threshold)."""
        submission = QuizSubmission(answers={"1": "python programming language"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="SHORT_ANSWER", points=10,
                          correctAnswer="python,programming", options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True

    @patch("app.services.quiz_service.prisma")
    async def test_submit_invalid_attempt(self, mock_prisma, qsvc):
        """Wrong user or already completed attempt should fail."""
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=MagicMock(
            id=1, userId=2, completedAt=datetime.now(timezone.utc)  # wrong user
        ))
        result = await qsvc.submit_attempt(1, 1, QuizSubmission(answers={}))
        assert result["success"] is False

    @patch("app.services.quiz_service.prisma")
    async def test_matching_type_grading(self, mock_prisma, qsvc):
        """Matching questions should compare key-value pairs."""
        submission = QuizSubmission(answers={"1": '{"key1": "val1", "key2": "val2"}'})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MATCHING", points=10,
                          correctAnswer='{"key1": "val1", "key2": "val2"}', options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 100.0

    @patch("app.services.quiz_service.prisma")
    async def test_submit_empty_answers(self, mock_prisma, qsvc):
        """Empty submission should yield 0%."""
        submission = QuizSubmission(answers={})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MULTIPLE_CHOICE", points=10,
                          correctAnswer="A", options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}]),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0
        assert result["passed"] is False

    @patch("app.services.quiz_service.prisma")
    async def test_submit_fill_in_blank_keyword(self, mock_prisma, qsvc):
        """Fill-in-blank should use keyword matching (50% threshold)."""
        submission = QuizSubmission(answers={"1": "python language"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="FILL_IN_BLANK", points=10,
                          correctAnswer="python,programming", options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True

    @patch("app.services.quiz_service.prisma")
    async def test_submit_fill_in_blank_no_match(self, mock_prisma, qsvc):
        """Fill-in-blank with no matching keywords should yield 0."""
        submission = QuizSubmission(answers={"1": "irrelevant text"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="FILL_IN_BLANK", points=10,
                          correctAnswer="python,programming", options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0

    @patch("app.services.quiz_service.prisma")
    async def test_submit_question_not_in_map(self, mock_prisma, qsvc):
        """Question ID not in questions map should be skipped."""
        submission = QuizSubmission(answers={"999": "A"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0

    @patch("app.services.quiz_service.prisma")
    async def test_submit_no_total_points(self, mock_prisma, qsvc):
        """Zero total points should return 0% score."""
        submission = QuizSubmission(answers={})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
        assert result["score"] == 0.0

    @patch("app.services.quiz_service.prisma")
    async def test_submit_internal_error(self, mock_prisma, qsvc):
        """Exception during submission should return error response."""
        mock_prisma.quizattempt.find_unique = AsyncMock(side_effect=Exception("Unexpected error"))
        result = await qsvc.submit_attempt(1, 1, QuizSubmission(answers={}))
        assert result["success"] is False
        assert result["error"] == "Internal error"


class TestQuizQuestionFormatting:
    """Quiz question formatting with various option formats."""

    @patch("app.services.quiz_service.prisma")
    async def test_options_as_string_list(self, mock_prisma, qsvc):
        mock_prisma.quiz.find_unique = AsyncMock(return_value=MagicMock(
            id=1, title="Quiz", description=None, passingScore=90,
            timeLimitMinutes=30, allowRetake=True, shuffleQuestions=False,
            retakeCooldownMinutes=60, questions=[
                MagicMock(id=1, question="Q?", questionType="MULTIPLE_CHOICE",
                          points=10, explanation="Hmm", order=0, deletedAt=None,
                          options=["Option A", "Option B"]),
            ]
        ))
        result = await qsvc.get_quiz("less-1")
        assert len(result["questions"]) == 1
        assert result["questions"][0]["options"][0]["text"] == "Option A"
        assert result["questions"][0]["options"][0]["id"] == "0"

    @patch("app.services.quiz_service.prisma")
    async def test_options_as_dict(self, mock_prisma, qsvc):
        mock_prisma.quiz.find_unique = AsyncMock(return_value=MagicMock(
            id=1, title="Quiz", description=None, passingScore=90,
            timeLimitMinutes=30, allowRetake=True, shuffleQuestions=False,
            retakeCooldownMinutes=60, questions=[
                MagicMock(id=1, question="Q?", questionType="MULTIPLE_CHOICE",
                          points=10, explanation="Hmm", order=0, deletedAt=None,
                          options={"a": "Alpha", "b": "Beta"}),
            ]
        ))
        result = await qsvc.get_quiz("less-1")
        assert result is not None

    @patch("app.services.quiz_service.prisma")
    async def test_no_options_returns_no_options_field(self, mock_prisma, qsvc):
        mock_prisma.quiz.find_unique = AsyncMock(return_value=MagicMock(
            id=1, title="Quiz", description=None, passingScore=90,
            timeLimitMinutes=30, allowRetake=True, shuffleQuestions=False,
            retakeCooldownMinutes=60, questions=[
                MagicMock(id=1, question="Q?", questionType="ESSAY",
                          points=20, explanation=None, order=0, deletedAt=None,
                          options=None),
            ]
        ))
        result = await qsvc.get_quiz("less-1")
        assert len(result["questions"]) == 1
        assert "options" not in result["questions"][0]

    @patch("app.services.quiz_service.prisma")
    async def test_question_type_as_enum(self, mock_prisma, qsvc):
        mock_prisma.quiz.find_unique = AsyncMock(return_value=MagicMock(
            id=1, title="Quiz", description=None, passingScore=90,
            timeLimitMinutes=30, allowRetake=True, shuffleQuestions=False,
            retakeCooldownMinutes=60, questions=[
                MagicMock(id=1, question="Q?", questionType="MULTIPLE_CHOICE",
                          points=10, explanation="Hmm", order=0, deletedAt=None,
                          options=[{"id": "0", "text": "A"}]),
            ]
        ))
        result = await qsvc.get_quiz("less-1")
        assert result["questions"][0]["type"] == "MULTIPLE_CHOICE"

    @patch("app.services.quiz_service.prisma")
    async def test_start_attempt_quiz_not_found(self, mock_prisma, qsvc):
        mock_prisma.quizattempt.find_first = AsyncMock(return_value=None)
        mock_prisma.quiz.find_unique = AsyncMock(return_value=None)
        result = await qsvc.start_attempt(1, 999)
        assert result is None

    @patch("app.services.quiz_service.prisma")
    async def test_start_attempt_error_returns_none(self, mock_prisma, qsvc):
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=Exception("DB error"))
        result = await qsvc.start_attempt(1, 1)
        assert result is None


class TestQuizNetworkFailure:
    """Quiz behavior under network/database failure."""

    @patch("app.services.quiz_service.prisma")
    async def test_submit_db_failure_during_answer_create(self, mock_prisma, qsvc):
        """DB failure during answer creation should return error."""
        submission = QuizSubmission(answers={"1": "A"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MULTIPLE_CHOICE", points=10,
                          correctAnswer="A", options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}]),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock(side_effect=Exception("Write timeout"))
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is False
        assert result["error"] == "Internal error"

    @patch("app.services.quiz_service.prisma")
    async def test_submit_attempt_update_failure_returns_error(self, mock_prisma, qsvc):
        """Failure updating attempt after grading should return error."""
        submission = QuizSubmission(answers={})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(side_effect=Exception("Update failed"))
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is False  # caught by outer try/except

    @patch("app.services.quiz_service.prisma")
    async def test_submit_attempt_not_found(self, mock_prisma, qsvc):
        """Non-existent attempt should return error."""
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=None)
        result = await qsvc.submit_attempt(1, 999, QuizSubmission(answers={}))
        assert result["success"] is False
        assert result["error"] == "Invalid attempt"


class TestQuizRetryEdgeCases:
    """Retry logic edge cases under boundary conditions."""

    @patch("app.services.quiz_service.prisma")
    async def test_cooldown_exactly_at_boundary(self, mock_prisma, qsvc, mock_quiz):
        """Cooldown exactly at boundary should allow retry (>=)."""
        mock_prisma.quizattempt.find_first = AsyncMock(side_effect=[
            None,
            MagicMock(isPassed=False, createdAt=datetime.now(timezone.utc) - timedelta(minutes=60)),
        ])
        mock_prisma.quiz.find_unique = AsyncMock(return_value=mock_quiz)
        mock_prisma.quizattempt.create = AsyncMock(return_value=MagicMock(id=2))
        result = await qsvc.start_attempt(1, 1)
        assert result == 2

    @patch("app.services.quiz_service.prisma")
    async def test_attempt_just_under_time_limit(self, mock_prisma, qsvc):
        """Attempt at exactly time_limit - 1 minute should be valid."""
        submission = QuizSubmission(answers={"1": "A"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None,
            startedAt=datetime.now(timezone.utc) - timedelta(minutes=29),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="MULTIPLE_CHOICE", points=10,
                          correctAnswer="A", options=[{"id": "0", "text": "A"}, {"id": "1", "text": "B"}]),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True

    @patch("app.services.quiz_service.prisma")
    async def test_get_quiz_db_failure_returns_none(self, mock_prisma, qsvc):
        """Database failure during quiz retrieval should return None."""
        mock_prisma.quiz.find_unique = AsyncMock(side_effect=Exception("Connection timeout"))
        result = await qsvc.get_quiz("less-1")
        assert result is None

    @patch("app.services.quiz_service.prisma")
    async def test_short_answer_no_keywords_in_correct_answer(self, mock_prisma, qsvc):
        """Short answer with no keywords in correctAnswer should be safe."""
        submission = QuizSubmission(answers={"1": "anything"})
        mock_attempt = MagicMock(
            id=1, userId=1, completedAt=None, startedAt=datetime.now(timezone.utc) - timedelta(minutes=5),
            quiz=MagicMock(timeLimitMinutes=30, passingScore=90, questions=[
                MagicMock(id=1, questionType="SHORT_ANSWER", points=10,
                          correctAnswer=None, options=None),
            ])
        )
        mock_prisma.quizattempt.find_unique = AsyncMock(return_value=mock_attempt)
        mock_prisma.quizattempt.update_many = AsyncMock(return_value=1)
        mock_prisma.quizuseranswer.create_many = AsyncMock()
        result = await qsvc.submit_attempt(1, 1, submission)
        assert result["success"] is True
