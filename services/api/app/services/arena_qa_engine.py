"""
TamWheel Sovereign Ethical Agentic Venture OS — Priority Investor Q&A Upvoting & Moderation Queue.
Phase 4 Expansion: High-throughput live question submission for Shark Tank grilling rounds.

Includes:
- Real-time upvoting by watch party participants with anti-duplicate enforcement.
- Priority Queue Weighted Ranking Formula:
  Priority Score = Upvotes * 1.0 + Academy Tier Bonus * 2.0 + Reputation Weight * 1.5
- State machine: SUBMITTED -> MODERATED_APPROVED -> PROMOTED_TO_STAGE -> ANSWERED -> ARCHIVED (and FLAGGED_REJECTED)
- Automated toxicity, profanity, and off-topic filtering.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class QuestionState(str, Enum):
    SUBMITTED = "SUBMITTED"
    MODERATED_APPROVED = "MODERATED_APPROVED"
    PROMOTED_TO_STAGE = "PROMOTED_TO_STAGE"
    ANSWERED = "ANSWERED"
    ARCHIVED = "ARCHIVED"
    FLAGGED_REJECTED = "FLAGGED_REJECTED"


class AcademyTier(str, Enum):
    NONE = "NONE"
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    ESE_ORAN_FELLOW = "ESE_ORAN_FELLOW"


TIER_BONUS_MAP: Dict[str, float] = {
    "NONE": 0.0,
    "BRONZE": 1.0,
    "SILVER": 2.0,
    "GOLD": 3.5,
    "ESE_ORAN_FELLOW": 5.0,
}

# Automated toxicity / spam / off-topic keywords (multilingual: EN, FR, AR/Darija transliterated)
TOXIC_SPAM_PATTERNS = [
    r"\b(?:100x|1000x)\s+guaranteed\b",
    r"\bpump\s+and\s+dump\b",
    r"\bscam\b",
    r"\bponzi\b",
    r"\bpyramid\s+scheme\b",
    r"\b(?:whatsapp|telegram)\s+(?:me|group|\+?\d+)\b",
    r"\b(?:send|transfer)\s+(?:crypto|usdt|btc|eth)\b",
    r"\bharram\b",
    r"\brésolu\s+arnaque\b",
    r"\bfraud\b",
    r"\bfake\s+metrics\b",
    r"\bshitcoin\b",
    r"\bfree\s+money\b",
]


class ArenaQuestion:
    """Represents a submitted investor or community question in the pitch grilling round."""

    def __init__(
        self,
        question_id: str,
        room_id: str,
        startup_id: str,
        author_id: int,
        author_name: str,
        content: str,
        academy_tier: str = "NONE",
        reputation_weight: float = 1.0,
        slide_reference: Optional[int] = None,
        category: str = "UNIT_ECONOMICS",
        created_at: Optional[float] = None,
    ):
        self.question_id = question_id
        self.room_id = room_id
        self.startup_id = startup_id
        self.author_id = author_id
        self.author_name = author_name
        self.content = content.strip()
        self.academy_tier = academy_tier.upper()
        self.academy_tier_bonus = TIER_BONUS_MAP.get(self.academy_tier, 0.0)
        self.reputation_weight = max(0.1, float(reputation_weight))
        self.slide_reference = slide_reference
        self.category = category
        self.state = QuestionState.SUBMITTED
        self.flag_reason: Optional[str] = None
        self.upvoter_ids: Set[int] = set()
        self.upvotes = 0
        self.priority_score = 0.0
        self.answer_notes: Optional[str] = None
        self.answered_at: Optional[float] = None
        self.promoted_at: Optional[float] = None
        self.created_at = created_at or time.time()

        # Calculate initial score
        self.recalculate_priority_score()

    def recalculate_priority_score(self) -> float:
        """
        Priority Queue Weighted Ranking:
        Score = Upvotes * 1.0 + Academy Tier Bonus * 2.0 + Reputation Weight * 1.5
        """
        self.upvotes = len(self.upvoter_ids)
        score = (
            (self.upvotes * 1.0)
            + (self.academy_tier_bonus * 2.0)
            + (self.reputation_weight * 1.5)
        )
        self.priority_score = round(score, 3)
        return self.priority_score

    def add_upvote(self, user_id: int) -> float:
        """Adds an upvote if the user hasn't upvoted yet; raises ValueError on duplicate."""
        if user_id in self.upvoter_ids:
            raise ValueError(f"User {user_id} has already upvoted question {self.question_id}")
        self.upvoter_ids.add(user_id)
        return self.recalculate_priority_score()

    def remove_upvote(self, user_id: int) -> float:
        """Removes an upvote if present."""
        if user_id in self.upvoter_ids:
            self.upvoter_ids.remove(user_id)
            return self.recalculate_priority_score()
        return self.priority_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "question_id": self.question_id,
            "room_id": self.room_id,
            "startup_id": self.startup_id,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "content": self.content,
            "academy_tier": self.academy_tier,
            "academy_tier_bonus": self.academy_tier_bonus,
            "reputation_weight": self.reputation_weight,
            "slide_reference": self.slide_reference,
            "category": self.category,
            "state": self.state.value,
            "flag_reason": self.flag_reason,
            "upvotes": self.upvotes,
            "priority_score": self.priority_score,
            "answer_notes": self.answer_notes,
            "answered_at": self.answered_at,
            "promoted_at": self.promoted_at,
            "created_at": self.created_at,
        }


class ArenaQAEngine:
    """Manages high-throughput live question queuing, real-time upvoting, and moderation for pitch rooms."""

    def __init__(self):
        # room_id -> dict of question_id -> ArenaQuestion
        self._rooms: Dict[str, Dict[str, ArenaQuestion]] = {}
        # room_id -> active on-stage question_id
        self._active_stage_question: Dict[str, Optional[str]] = {}

    def scan_content_toxicity(self, text: str) -> tuple[bool, Optional[str]]:
        """Scans content for spam patterns, predatory promotion, or toxicity."""
        text_lower = text.lower()
        for pattern in TOXIC_SPAM_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True, f"Triggered prohibited spam/toxicity pattern: {pattern}"
        return False, None

    def submit_question(
        self,
        room_id: str,
        startup_id: str,
        author_id: int,
        author_name: str,
        content: str,
        academy_tier: str = "NONE",
        reputation_weight: float = 1.0,
        slide_reference: Optional[int] = None,
        category: str = "UNIT_ECONOMICS",
        auto_moderate: bool = True,
    ) -> ArenaQuestion:
        """
        Submits an investor question, runs automated safety filtering,
        and enqueues it with weighted priority scoring.
        """
        cleaned_content = content.strip()
        if not cleaned_content:
            raise ValueError("Question content cannot be empty")
        if len(cleaned_content) > 500:
            raise ValueError("Question content exceeds 500 characters limit")

        q_id = f"q-{uuid.uuid4().hex[:12]}"
        question = ArenaQuestion(
            question_id=q_id,
            room_id=room_id,
            startup_id=startup_id,
            author_id=author_id,
            author_name=author_name,
            content=cleaned_content,
            academy_tier=academy_tier,
            reputation_weight=reputation_weight,
            slide_reference=slide_reference,
            category=category,
        )

        # Automated toxicity check
        is_toxic, reason = self.scan_content_toxicity(cleaned_content)
        if is_toxic:
            question.state = QuestionState.FLAGGED_REJECTED
            question.flag_reason = reason
            logger.warning(f"Question {q_id} auto-rejected: {reason}")
        elif auto_moderate:
            question.state = QuestionState.MODERATED_APPROVED

        # Store in room catalog
        self._rooms.setdefault(room_id, {})[q_id] = question
        return question

    def upvote_question(self, room_id: str, question_id: str, user_id: int) -> ArenaQuestion:
        """Registers a verified upvote for a question and recalculates queue priority."""
        room_questions = self._rooms.get(room_id, {})
        question = room_questions.get(question_id)
        if not question:
            raise KeyError(f"Question {question_id} not found in room {room_id}")

        if question.state == QuestionState.FLAGGED_REJECTED:
            raise ValueError("Cannot upvote a flagged/rejected question")

        question.add_upvote(user_id)
        return question

    def moderate_question(
        self,
        room_id: str,
        question_id: str,
        approved: bool,
        moderator_id: int,
        reason: Optional[str] = None,
    ) -> ArenaQuestion:
        """Allows a moderator to approve or reject a question."""
        room_questions = self._rooms.get(room_id, {})
        question = room_questions.get(question_id)
        if not question:
            raise KeyError(f"Question {question_id} not found in room {room_id}")

        if approved:
            question.state = QuestionState.MODERATED_APPROVED
            question.flag_reason = None
        else:
            question.state = QuestionState.FLAGGED_REJECTED
            question.flag_reason = reason or "Rejected by moderator"

        return question

    def promote_to_stage(self, room_id: str, question_id: str) -> ArenaQuestion:
        """Promotes an approved question to the hot-seat grilling stage."""
        room_questions = self._rooms.get(room_id, {})
        question = room_questions.get(question_id)
        if not question:
            raise KeyError(f"Question {question_id} not found in room {room_id}")

        if question.state not in (QuestionState.MODERATED_APPROVED, QuestionState.SUBMITTED):
            raise ValueError(f"Cannot promote question in state '{question.state.value}' to stage")

        question.state = QuestionState.PROMOTED_TO_STAGE
        question.promoted_at = time.time()
        self._active_stage_question[room_id] = question_id
        return question

    def answer_question(
        self,
        room_id: str,
        question_id: str,
        answer_notes: Optional[str] = None,
    ) -> ArenaQuestion:
        """Marks the on-stage question as answered and archives it from active stage."""
        room_questions = self._rooms.get(room_id, {})
        question = room_questions.get(question_id)
        if not question:
            raise KeyError(f"Question {question_id} not found in room {room_id}")

        question.state = QuestionState.ANSWERED
        question.answer_notes = answer_notes
        question.answered_at = time.time()

        if self._active_stage_question.get(room_id) == question_id:
            self._active_stage_question[room_id] = None

        return question

    def archive_question(
        self,
        room_id: str,
        question_id: str,
    ) -> ArenaQuestion:
        """Transitions an answered or moderated question into the ARCHIVED state."""
        room_questions = self._rooms.get(room_id, {})
        question = room_questions.get(question_id)
        if not question:
            raise KeyError(f"Question {question_id} not found in room {room_id}")

        question.state = QuestionState.ARCHIVED
        return question

    def get_active_stage_question(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Returns the currently spotlighted on-stage question."""
        q_id = self._active_stage_question.get(room_id)
        if not q_id:
            return None
        q = self._rooms.get(room_id, {}).get(q_id)
        return q.to_dict() if q else None

    def list_questions(
        self,
        room_id: str,
        state: Optional[QuestionState | str] = None,
        sort_by: str = "priority_score",
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Lists questions in room, sorted by priority score, upvotes, or created time.
        """
        room_questions = list(self._rooms.get(room_id, {}).values())

        if state:
            target_state = state.value if isinstance(state, QuestionState) else state.upper()
            room_questions = [q for q in room_questions if q.state.value == target_state]

        if sort_by == "upvotes":
            room_questions.sort(key=lambda q: (q.upvotes, q.created_at), reverse=True)
        elif sort_by == "recent":
            room_questions.sort(key=lambda q: q.created_at, reverse=True)
        else:  # priority_score default
            room_questions.sort(key=lambda q: (q.priority_score, q.upvotes), reverse=True)

        return [q.to_dict() for q in room_questions[:limit]]

    def get_question(self, room_id: str, question_id: str) -> Optional[ArenaQuestion]:
        """Retrieves a specific question."""
        return self._rooms.get(room_id, {}).get(question_id)


# Global singleton instance
arena_qa_engine = ArenaQAEngine()
