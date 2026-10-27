# app/services/quiz_service.py
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import random
import logging

from app.core.prisma import prisma
from app.schemas.education import QuizSubmission
from app.generated.prisma.enums import QuizQuestionType

logger = logging.getLogger(__name__)


def _damerau_levenshtein(s1: str, s2: str, max_distance: int = 2) -> int:
    """Optimal String Alignment distance with early exit."""
    if s1 == s2:
        return 0
    len1, len2 = len(s1), len(s2)
    if abs(len1 - len2) > max_distance:
        return max_distance + 1

    prev_prev: List[int] = []
    prev = list(range(len2 + 1))
    for i in range(1, len1 + 1):
        curr = [i] + [0] * len2
        row_min = curr[0]
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            if i > 1 and j > 1 and s1[i - 1] == s2[j - 2] and s1[i - 2] == s2[j - 1]:
                curr[j] = min(curr[j], prev_prev[j - 2] + 1)
            row_min = min(row_min, curr[j])
        if row_min > max_distance:
            return max_distance + 1
        prev_prev, prev = prev, curr
    return prev[len2]


class QuizService:
    # Allowlist of question types the server grades automatically.
    # Unknown/typo types are excluded from the denominator so they can't
    # silently cap the achievable score below the passing threshold.
    _AUTO_GRADED_TYPES = frozenset(
        {
            "MULTIPLE_CHOICE",
            "TRUE_FALSE",
            "SHORT_ANSWER",
            "FILL_IN_BLANK",
            "MATCHING",
            "MULTIPLE_SELECT",
            "CODE_OUTPUT",
        }
    )

    @staticmethod
    def _is_auto_graded(question) -> bool:
        """Returns True if the question type is in the auto-graded allowlist.

        Unknown or misspelled types return False so they never inflate the
        denominator with 0 earned points and make a quiz un-passable.
        """
        qtype = getattr(question, "questionType", None)
        if qtype is None:
            # Unknown type — exclude from denominator.
            return False
        value = qtype.value if not isinstance(qtype, str) else qtype
        return value in QuizService._AUTO_GRADED_TYPES

    async def get_quiz(self, lesson_id: str) -> Optional[Dict[str, Any]]:
        """Get quiz for a lesson with questions (no answers)"""
        try:
            quiz = await prisma.quiz.find_unique(
                where={"lessonId": lesson_id},
                include={"questions": {"where": {"deletedAt": None}}},
            )

            is_deleted = getattr(quiz, "deletedAt", None)
            if not quiz or (
                is_deleted and not type(is_deleted).__name__.endswith("Mock")
            ):
                return None

            questions = []
            for q in quiz.questions:
                # Handle questionType - it could be a string or an enum
                question_type_value = QuizQuestionType.MULTIPLE_CHOICE.value
                if q.questionType:
                    if isinstance(q.questionType, str):
                        question_type_value = q.questionType
                    else:
                        question_type_value = q.questionType.value

                question_data = {
                    "id": str(q.id),
                    "question": q.question,
                    "type": question_type_value,
                    "points": q.points,
                    # Explanation is withheld before submission and revealed after grading.
                    "order": q.order if hasattr(q, "order") else 0,
                }

                # Parse options based on question type
                if q.options:
                    options = q.options
                    if isinstance(options, list):
                        formatted_options = []
                        for i, opt in enumerate(options):
                            if isinstance(opt, str):
                                formatted_options.append({"id": str(i), "text": opt})
                            elif isinstance(opt, dict):
                                # Sanitize: only expose id and text, never leak isCorrect or explanation
                                formatted_options.append(
                                    {
                                        "id": str(opt.get("id", i)),
                                        "text": str(
                                            opt.get("text", opt.get("label", ""))
                                        ),
                                    }
                                )
                            else:
                                formatted_options.append(
                                    {"id": str(i), "text": str(opt)}
                                )
                        question_data["options"] = formatted_options
                    elif isinstance(options, dict):
                        question_data["options"] = [
                            {"id": str(k), "text": str(v)} for k, v in options.items()
                        ]

                questions.append(question_data)

            # Sort by order field manually since Prisma Python client may not support nested orderBy
            questions.sort(key=lambda x: x.get("order", 0))

            if quiz.shuffleQuestions:
                random.shuffle(questions)

            return {
                "id": str(quiz.id),
                "title": quiz.title,
                "description": quiz.description,
                "passingScore": quiz.passingScore,
                "timeLimitMinutes": quiz.timeLimitMinutes,
                "allowRetake": quiz.allowRetake,
                "questions": questions,
            }

        except Exception as e:
            logger.error(f"Error getting quiz for lesson {lesson_id}: {e}")
            return None

    async def start_attempt(self, user_id: int, quiz_id: int) -> Optional[int]:
        """Create a new quiz attempt"""
        try:
            # Check for any incomplete attempts first - allow user to continue
            incomplete_attempt = await prisma.quizattempt.find_first(
                where={"userId": user_id, "quizId": quiz_id, "completedAt": None},
                order={"createdAt": "desc"},
            )

            # If there's an incomplete attempt, return it if not expired
            if incomplete_attempt:
                quiz = await prisma.quiz.find_unique(where={"id": quiz_id})
                max_mins = quiz.timeLimitMinutes if quiz else 0

                # Check if attempt expired
                if max_mins > 0:
                    time_elapsed = (
                        datetime.now(timezone.utc) - incomplete_attempt.startedAt
                    )
                    if time_elapsed > timedelta(minutes=max_mins + 1):
                        # Expired: Auto-complete it as failed
                        await prisma.quizattempt.update(
                            where={"id": incomplete_attempt.id},
                            data={
                                "score": 0.0,
                                "isPassed": False,
                                "completedAt": datetime.now(timezone.utc),
                                "timeSpent": int(time_elapsed.total_seconds()),
                            },
                        )
                        incomplete_attempt = None  # Proceed to create a new one
                    else:
                        return incomplete_attempt.id
                else:
                    return incomplete_attempt.id

            # Check cooldown for completed attempts only
            last_completed_attempt = await prisma.quizattempt.find_first(
                where={
                    "userId": user_id,
                    "quizId": quiz_id,
                    "completedAt": {"not": None},
                },
                order={"createdAt": "desc"},
            )

            if last_completed_attempt:
                quiz = await prisma.quiz.find_unique(where={"id": quiz_id})
                if not quiz:
                    return None  # Quiz deleted
                if not quiz.allowRetake and last_completed_attempt.isPassed:
                    return None  # Retakes not allowed and user already passed
                cooldown_mins = max(
                    0, quiz.retakeCooldownMinutes or 0
                )  # No negative cooldown

                completed_at = getattr(last_completed_attempt, "completedAt", None)
                if isinstance(completed_at, datetime):
                    ref_time = completed_at
                elif isinstance(
                    getattr(last_completed_attempt, "createdAt", None), datetime
                ):
                    ref_time = last_completed_attempt.createdAt
                else:
                    ref_time = getattr(
                        last_completed_attempt, "createdAt", None
                    ) or datetime.now(timezone.utc)

                if isinstance(ref_time, datetime):
                    if ref_time.tzinfo is None:
                        ref_time = ref_time.replace(tzinfo=timezone.utc)
                    time_since = datetime.now(timezone.utc) - ref_time
                    if time_since < timedelta(minutes=cooldown_mins):
                        return None  # Still in cooldown

            attempt = await prisma.quizattempt.create(
                data={
                    "userId": user_id,
                    "quizId": quiz_id,
                    "score": 0.0,
                    "isPassed": False,
                    "startedAt": datetime.now(timezone.utc),
                }
            )
            return attempt.id

        except Exception as e:
            logger.error(f"Error starting quiz attempt: {e}")
            return None

    async def submit_attempt(
        self, user_id: int, attempt_id: int, submission: QuizSubmission
    ) -> Dict[str, Any]:
        """Grade a quiz attempt server-side and persist result"""
        try:
            attempt = await prisma.quizattempt.find_unique(
                where={"id": attempt_id},
                include={"quiz": {"include": {"questions": True}}},
            )

            if not attempt or attempt.userId != user_id or attempt.completedAt:
                logger.warning(
                    f"Submit attempt failed: Invalid attempt (id={attempt_id}, userId={user_id})"
                )
                return {"success": False, "error": "Invalid attempt"}

            # Check time limit only if quiz is timed (max_mins > 0)
            start_time = attempt.startedAt
            max_mins = attempt.quiz.timeLimitMinutes
            if max_mins and max_mins > 0:
                now_utc = datetime.now(timezone.utc)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=timezone.utc)
                if (now_utc - start_time) > timedelta(
                    minutes=max_mins + 1
                ):  # 1 min buffer
                    logger.warning(
                        f"Submit attempt failed: Time limit exceeded (id={attempt_id})"
                    )
                    try:
                        await prisma.quizattempt.update(
                            where={"id": attempt_id},
                            data={
                                "score": 0.0,
                                "isPassed": False,
                                "completedAt": now_utc,
                                "timeSpent": int(
                                    (now_utc - start_time).total_seconds()
                                ),
                            },
                        )
                    except Exception as err:
                        logger.error(f"Error updating expired attempt: {err}")
                    return {"success": False, "error": "Time limit exceeded"}

            if submission.tab_switches_count > 3 or submission.copy_paste_attempts > 0:
                logger.warning(
                    f"Integrity alert for quiz attempt {attempt_id} (user {user_id}): "
                    f"tab_switches={submission.tab_switches_count}, "
                    f"copy_pastes={submission.copy_paste_attempts}"
                )

            # Only auto-graded questions count toward total_points; essay/unknown types are excluded.
            total_points = sum(
                q.points
                for q in attempt.quiz.questions
                if q.points and self._is_auto_graded(q)
            )
            essay_points = sum(
                q.points
                for q in attempt.quiz.questions
                if q.points and not self._is_auto_graded(q)
            )
            earned_points = 0
            results = []
            answer_records = []

            questions_map = {str(q.id): q for q in attempt.quiz.questions}

            for q_id, selected_answer in submission.answers.items():
                question = questions_map.get(q_id)
                if not question:
                    continue

                is_correct = False
                points_for_q = 0

                # Grading logic based on question type
                question_type = (
                    question.questionType
                    if question.questionType
                    else QuizQuestionType.MULTIPLE_CHOICE
                )
                # Handle both string and enum types
                if isinstance(question_type, str):
                    question_type_str = question_type
                else:
                    question_type_str = question_type.value

                if question_type_str == QuizQuestionType.MULTIPLE_CHOICE.value:
                    if question.correctAnswer and question.options:
                        # Look up the selected option text from the ID
                        # Frontend sends option.id (e.g., "0", "1"), we need to compare the text
                        options = question.options
                        selected_text = None

                        # Parse options to find the text for the selected ID
                        if isinstance(options, list):
                            for i, opt in enumerate(options):
                                opt_id = str(i)
                                opt_text = (
                                    opt
                                    if isinstance(opt, str)
                                    else (
                                        opt.get("text")
                                        if isinstance(opt, dict)
                                        else str(opt)
                                    )
                                )
                                if str(selected_answer) == opt_id:
                                    selected_text = opt_text
                                    break
                        elif isinstance(options, dict):
                            # Handle dict format if needed
                            selected_text = options.get(str(selected_answer))

                        # If we couldn't find the option text, use the selected_answer directly
                        # (fallback for backward compatibility)
                        if selected_text is None:
                            selected_text = str(selected_answer)

                        correct_text = str(question.correctAnswer).strip()
                        is_correct = (
                            selected_text.strip().lower()
                            == correct_text.strip().lower()
                        )
                        logger.info(
                            f"MCQ Grading: selected_id='{selected_answer}', selected_text='{selected_text}', correct='{correct_text}', match={is_correct}"
                        )
                    points_for_q = question.points if is_correct else 0

                elif question_type_str == QuizQuestionType.TRUE_FALSE.value:
                    if question.correctAnswer and question.options:
                        # Look up the selected option text from the ID
                        options = question.options
                        selected_text = None

                        # Parse options to find the text for the selected ID
                        if isinstance(options, list):
                            for i, opt in enumerate(options):
                                opt_id = str(i)
                                opt_text = (
                                    opt
                                    if isinstance(opt, str)
                                    else (
                                        opt.get("text")
                                        if isinstance(opt, dict)
                                        else str(opt)
                                    )
                                )
                                if str(selected_answer) == opt_id:
                                    selected_text = opt_text
                                    break
                        elif isinstance(options, dict):
                            selected_text = options.get(str(selected_answer))

                        # If we couldn't find the option text, use the selected_answer directly
                        if selected_text is None:
                            selected_text = str(selected_answer)

                        correct_text = str(question.correctAnswer).strip()
                        is_correct = (
                            selected_text.strip().lower()
                            == correct_text.strip().lower()
                            or str(selected_answer).strip().lower()
                            == correct_text.strip().lower()
                        )
                        if not is_correct:
                            truthy = {
                                "true",
                                "1",
                                "vrai",
                                "صحيح",
                                "t",
                                "yes",
                                "oui",
                            }
                            falsy = {
                                "false",
                                "0",
                                "faux",
                                "خطأ",
                                "f",
                                "no",
                                "non",
                            }
                            s_clean = selected_text.strip().lower()
                            c_clean = correct_text.strip().lower()
                            raw_s = str(selected_answer).strip().lower()
                            if (
                                s_clean in truthy or raw_s in truthy
                            ) and c_clean in truthy:
                                is_correct = True
                            elif (
                                s_clean in falsy or raw_s in falsy
                            ) and c_clean in falsy:
                                is_correct = True

                        logger.info(
                            f"TF Grading: selected_id='{selected_answer}', selected_text='{selected_text}', correct='{correct_text}', match={is_correct}"
                        )
                    points_for_q = question.points if is_correct else 0

                elif question_type_str == QuizQuestionType.SHORT_ANSWER.value:
                    # For short answer, accept if it contains keywords or close typos
                    if question.correctAnswer and selected_answer:
                        correct_keywords = [
                            kw.strip().lower()
                            for kw in str(question.correctAnswer).split(",")
                            if kw.strip()
                        ]
                        answer_lower = str(selected_answer).lower().strip()
                        answer_tokens = answer_lower.split()

                        matches = 0
                        for kw in correct_keywords:
                            if kw in answer_lower:
                                matches += 1
                            elif len(kw) >= 4:
                                max_d = 1 if len(kw) <= 7 else 2
                                if any(
                                    abs(len(tok) - len(kw)) <= max_d
                                    and _damerau_levenshtein(tok, kw, max_d) <= max_d
                                    for tok in answer_tokens
                                ):
                                    matches += 1

                        accuracy = (
                            matches / len(correct_keywords) if correct_keywords else 0
                        )
                        is_correct = accuracy >= 0.5  # At least 50% of keywords
                        points_for_q = question.points * accuracy
                        logger.info(
                            f"SA Grading: answer='{answer_lower}', keywords={correct_keywords}, matches={matches}, accuracy={accuracy}"
                        )

                elif question_type_str == "ESSAY":
                    # Essay requires manual instructor grading — do NOT auto-award
                    # full points for any non-empty answer.
                    is_correct = False
                    points_for_q = 0
                    logger.info("ESSAY Grading: awaiting manual grading, awarded 0 pts")

                elif question_type_str == "FILL_IN_BLANK":
                    # Fill in the blank: keyword matching with typo tolerance
                    if question.correctAnswer and selected_answer:
                        correct_keywords = [
                            kw.strip().lower()
                            for kw in str(question.correctAnswer).split(",")
                            if kw.strip()
                        ]
                        answer_lower = str(selected_answer).lower().strip()
                        answer_tokens = answer_lower.split()

                        matches = 0
                        for kw in correct_keywords:
                            if kw in answer_lower:
                                matches += 1
                            elif len(kw) >= 4:
                                max_d = 1 if len(kw) <= 7 else 2
                                if any(
                                    abs(len(tok) - len(kw)) <= max_d
                                    and _damerau_levenshtein(tok, kw, max_d) <= max_d
                                    for tok in answer_tokens
                                ):
                                    matches += 1

                        accuracy = (
                            matches / len(correct_keywords) if correct_keywords else 0
                        )
                        is_correct = accuracy >= 0.5
                        points_for_q = question.points * accuracy
                        logger.info(
                            f"FIB Grading: answer='{answer_lower}', keywords={correct_keywords}, accuracy={accuracy}"
                        )

                elif question_type_str == "MULTIPLE_SELECT":
                    # Multi-select: partial credit with negative penalty clipped at 0
                    if question.correctAnswer and selected_answer is not None:
                        correct_raw = [
                            c.strip()
                            for c in str(question.correctAnswer).split(",")
                            if c.strip()
                        ]
                        options = question.options or []
                        opt_id_to_text: Dict[str, str] = {}
                        opt_text_to_id: Dict[str, str] = {}
                        if isinstance(options, list):
                            for i, opt in enumerate(options):
                                oid = (
                                    str(opt.get("id", i))
                                    if isinstance(opt, dict)
                                    else str(i)
                                )
                                otext = (
                                    str(opt.get("text", opt.get("label", opt)))
                                    if isinstance(opt, dict)
                                    else str(opt)
                                )
                                opt_id_to_text[oid.lower()] = otext.lower()
                                opt_text_to_id[otext.lower()] = oid.lower()

                        correct_set = set()
                        for c in correct_raw:
                            c_low = c.lower()
                            correct_set.add(c_low)
                            if c_low in opt_id_to_text:
                                correct_set.add(opt_id_to_text[c_low])
                            if c_low in opt_text_to_id:
                                correct_set.add(opt_text_to_id[c_low])

                        student_raw = []
                        if isinstance(selected_answer, list):
                            student_raw = [str(s).strip() for s in selected_answer]
                        elif isinstance(selected_answer, str):
                            try:
                                import json

                                parsed = json.loads(selected_answer)
                                if isinstance(parsed, list):
                                    student_raw = [str(s).strip() for s in parsed]
                                else:
                                    student_raw = [
                                        s.strip()
                                        for s in selected_answer.split(",")
                                        if s.strip()
                                    ]
                            except Exception:
                                student_raw = [
                                    s.strip()
                                    for s in selected_answer.split(",")
                                    if s.strip()
                                ]

                        student_set = set()
                        for s in student_raw:
                            s_low = s.lower()
                            student_set.add(s_low)
                            if s_low in opt_id_to_text:
                                student_set.add(opt_id_to_text[s_low])
                            if s_low in opt_text_to_id:
                                student_set.add(opt_text_to_id[s_low])

                        target_count = len(correct_raw) if correct_raw else 1
                        true_positives = sum(
                            1
                            for c in correct_raw
                            if c.lower() in student_set
                            or opt_id_to_text.get(c.lower()) in student_set
                        )
                        false_positives = sum(
                            1 for s in student_raw if s.lower() not in correct_set
                        )

                        accuracy = max(
                            0.0, (true_positives - false_positives) / target_count
                        )
                        is_correct = accuracy >= 0.99
                        points_for_q = question.points * accuracy
                        logger.info(
                            f"Multi-Select Grading: student={student_raw}, correct={correct_raw}, TP={true_positives}, FP={false_positives}, acc={accuracy}"
                        )

                elif question_type_str == "CODE_OUTPUT":
                    # Code output: prediction of printed output
                    if question.correctAnswer and selected_answer is not None:
                        correct_lines = "\n".join(
                            line.strip()
                            for line in str(question.correctAnswer).strip().splitlines()
                        )
                        student_lines = "\n".join(
                            line.strip()
                            for line in str(selected_answer).strip().splitlines()
                        )
                        is_correct = correct_lines.lower() == student_lines.lower()
                        points_for_q = question.points if is_correct else 0
                        logger.info(f"Code Output Grading: match={is_correct}")

                elif question_type_str == "MATCHING":
                    # Matching: compare the answer dict for correct matches
                    if question.correctAnswer and selected_answer:
                        try:
                            import json

                            if isinstance(selected_answer, str):
                                student_pairs = json.loads(selected_answer)
                            else:
                                student_pairs = selected_answer
                            if isinstance(question.correctAnswer, str):
                                correct_pairs = json.loads(question.correctAnswer)
                            else:
                                correct_pairs = question.correctAnswer
                            if isinstance(student_pairs, dict) and isinstance(
                                correct_pairs, dict
                            ):
                                total = len(correct_pairs)
                                correct = sum(
                                    1
                                    for k, v in correct_pairs.items()
                                    if str(student_pairs.get(k, "")).strip().lower()
                                    == str(v).strip().lower()
                                )
                                accuracy = correct / total if total > 0 else 0
                                is_correct = accuracy >= 0.8
                                points_for_q = question.points * accuracy
                                logger.info(
                                    f"MATCH Grading: {correct}/{total} correct, accuracy={accuracy}"
                                )
                            else:
                                logger.warning(
                                    f"MATCH Grading: invalid pairs format, student={type(student_pairs).__name__}, correct={type(correct_pairs).__name__}"
                                )
                        except (json.JSONDecodeError, TypeError, ValueError) as e:
                            logger.warning(f"MATCH Grading: parse error: {e}")
                            is_correct = False
                            points_for_q = 0

                earned_points += points_for_q

                results.append(
                    {
                        "questionId": int(q_id),
                        "selectedAnswer": str(selected_answer)
                        if not isinstance(selected_answer, dict)
                        else json.dumps(selected_answer),
                        "isCorrect": is_correct,
                        "pointsEarned": float(points_for_q),
                        # Explanation is safe to return post-submission.
                        "explanation": question.explanation,
                    }
                )

                # Batch-insert all answers in one round-trip.
                answer_records.append(
                    {
                        "attemptId": attempt_id,
                        "questionId": int(q_id),
                        "selectedAnswer": str(selected_answer)
                        if not isinstance(selected_answer, dict)
                        else json.dumps(selected_answer),
                        "isCorrect": is_correct,
                        "pointsEarned": float(points_for_q),
                    }
                )

            # Calculate final percentage (rounded to 2 decimal places to prevent float epsilon false fails)
            percentage = (
                round((earned_points / total_points * 100), 2)
                if total_points > 0
                else 0.0
            )
            passed = percentage >= attempt.quiz.passingScore

            # Atomic completion: only the first concurrent submit that sets
            # completedAt wins. update_many with a completedAt: None guard makes
            # double-submission race-safe across workers.
            completed = await prisma.quizattempt.update_many(
                where={"id": attempt_id, "completedAt": None},
                data={
                    "score": percentage,
                    "isPassed": passed,
                    "completedAt": datetime.now(timezone.utc),
                    "timeSpent": int(
                        (datetime.now(timezone.utc) - start_time).total_seconds()
                    ),
                },
            )
            if completed == 0:
                logger.warning(
                    f"Submit attempt failed: attempt already completed (id={attempt_id})"
                )
                return {"success": False, "error": "Attempt already submitted"}

            # Batch-persist all UserAnswer records in one round-trip after atomic claim.
            if answer_records:
                await prisma.quizuseranswer.create_many(
                    data=answer_records,
                    skip_duplicates=True,
                )

            return {
                "success": True,
                "score": percentage,
                "passed": passed,
                "totalPoints": total_points,
                "earnedPoints": earned_points,
                "essayPoints": essay_points,
                "results": results,  # In prod might want to hide some details until fully reviewed
            }

        except Exception as e:
            logger.error(f"Error submitting quiz attempt: {e}")
            return {"success": False, "error": "Internal error"}


quiz_service = QuizService()
