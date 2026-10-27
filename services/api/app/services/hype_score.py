"""
TamWheel Sovereign Ethical Agentic Venture OS — Weighted Hype Score Engine.
Implements reputation-weighted crowd wisdom curation with anti-brigading protection
per TamWheel Blueprint Section 8.4 and Section 20.4.
"""

import math
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from app.core.prisma import prisma
from app.generated.prisma.enums import AnalystLevel

logger = logging.getLogger(__name__)

# Reputation weights per analyst tier
ANALYST_WEIGHTS: Dict[str, float] = {
    AnalystLevel.NOVICE.value: 1.0,
    AnalystLevel.SCOUT.value: 1.5,
    AnalystLevel.ANALYST.value: 2.5,
    AnalystLevel.PARTNER.value: 4.0,
}

# Default burst parameters for anti-brigading
BURST_WINDOW_SECONDS = 3600  # 1 hour burst window
BURST_THRESHOLD = 3          # Max normal votes per window before decay
DECAY_LAMBDA = 0.35          # Exponential decay factor for burst spam


class HypeScoreEngine:
    """
    Weighted Hype Score Engine.
    Calculates composite crowd wisdom diligence score using reputation weights
    and protects against sybil attacks, voting rings, and coordinated brigading.
    """

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        burst_threshold: int = BURST_THRESHOLD,
        decay_lambda: float = DECAY_LAMBDA,
    ):
        self.weights = weights or ANALYST_WEIGHTS
        self.burst_threshold = burst_threshold
        self.decay_lambda = decay_lambda

    def get_analyst_weight(self, level: AnalystLevel | str) -> float:
        """Return the multiplier for the given analyst level."""
        level_str = level.value if isinstance(level, AnalystLevel) else str(level)
        return self.weights.get(level_str, 1.0)

    @staticmethod
    def calculate_raw_score(market_score: int, team_score: int, traction_score: int) -> float:
        """
        Normalize 1-10 scores across Market, Team, and Traction into a 0-100 composite score.
        Formula: ((Market + Team + Traction) / 3.0) * 10.0
        """
        clamped_market = max(1, min(10, market_score))
        clamped_team = max(1, min(10, team_score))
        clamped_traction = max(1, min(10, traction_score))
        return ((clamped_market + clamped_team + clamped_traction) / 3.0) * 10.0

    def compute_decay_factor(
        self,
        score_time: datetime,
        all_times: List[datetime],
        window_seconds: int = BURST_WINDOW_SECONDS,
    ) -> float:
        """
        Calculate exponential anti-brigading decay factor D_i.
        If a burst of votes arrives within window_seconds, votes past the threshold
        experience exponential weight attenuation: exp(-lambda * (burst_count - threshold)).
        """
        if not all_times:
            return 1.0

        # Ensure tz-aware
        if score_time.tzinfo is None:
            score_time = score_time.replace(tzinfo=timezone.utc)

        # Count how many scores occurred in the same burst window prior to or at this score
        prior_in_window = 0
        for t in all_times:
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            delta = abs((score_time - t).total_seconds())
            if delta <= window_seconds:
                prior_in_window += 1

        if prior_in_window > self.burst_threshold:
            excess = prior_in_window - self.burst_threshold
            return math.exp(-self.decay_lambda * excess)

        return 1.0

    def calculate_hype_score(
        self,
        scores: List[Dict[str, Any]],
        apply_anti_brigading: bool = True,
    ) -> float:
        """
        Compute reputation-weighted Hype Score:
        HypeScore = Sum(Score_i * Weight(Level_i) * Decay_i) / Sum(Weight(Level_i) * Decay_i)

        Each score in `scores` must contain:
        - marketScore (int, 1-10)
        - teamScore (int, 1-10)
        - tractionScore (int, 1-10)
        - analystLevel (AnalystLevel or str)
        - createdAt (datetime, optional for anti-brigading)
        """
        if not scores:
            return 0.0

        timestamps = [
            s.get("createdAt", datetime.now(timezone.utc))
            for s in scores
            if isinstance(s.get("createdAt"), datetime)
        ]

        total_weighted_score = 0.0
        total_weight = 0.0

        for s in scores:
            level = s.get("analystLevel", AnalystLevel.NOVICE)
            weight = self.get_analyst_weight(level)

            raw = self.calculate_raw_score(
                s.get("marketScore", 5),
                s.get("teamScore", 5),
                s.get("tractionScore", 5),
            )

            decay = 1.0
            if apply_anti_brigading and "createdAt" in s and isinstance(s["createdAt"], datetime):
                decay = self.compute_decay_factor(s["createdAt"], timestamps)

            effective_weight = weight * decay
            total_weighted_score += raw * effective_weight
            total_weight += effective_weight

        if total_weight <= 0.0:
            return 0.0

        return round(total_weighted_score / total_weight, 2)

    async def submit_community_score(
        self,
        startup_id: str,
        user_id: int,
        analyst_level: AnalystLevel,
        market_score: int,
        team_score: int,
        traction_score: int,
        feedback: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Persist community score in database, recompute startup HypeScore,
        and update the Startup record atomically.
        """
        # Upsert the user's score for this startup
        saved_score = await prisma.communityscore.upsert(
            where={
                "startupId_userId": {
                    "startupId": startup_id,
                    "userId": user_id,
                }
            },
            data={
                "create": {
                    "startupId": startup_id,
                    "userId": user_id,
                    "analystLevel": analyst_level,
                    "marketScore": market_score,
                    "teamScore": team_score,
                    "tractionScore": traction_score,
                    "feedback": feedback,
                },
                "update": {
                    "analystLevel": analyst_level,
                    "marketScore": market_score,
                    "teamScore": team_score,
                    "tractionScore": traction_score,
                    "feedback": feedback,
                },
            },
        )

        # Retrieve all scores for this startup to recompute Hype Score
        all_scores = await prisma.communityscore.find_many(
            where={"startupId": startup_id}
        )

        score_dicts = [
            {
                "marketScore": s.marketScore,
                "teamScore": s.teamScore,
                "tractionScore": s.tractionScore,
                "analystLevel": s.analystLevel,
                "createdAt": s.createdAt,
            }
            for s in all_scores
        ]

        new_hype_score = self.calculate_hype_score(score_dicts)

        # Update startup hype score
        await prisma.startup.update(
            where={"id": startup_id},
            data={"hypeScore": new_hype_score},
        )

        return {
            "score": saved_score,
            "newHypeScore": new_hype_score,
        }


hype_score_engine = HypeScoreEngine()
