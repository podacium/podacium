"""
TamWheel Sovereign Ethical Agentic Venture OS — Weighted Hype Score Engine.
Implements reputation-weighted crowd wisdom curation with anti-brigading protection,
moving 24h exponential decay, and divergence narrative bubble detection
per TamWheel Blueprint Section 8.4 and Section 20.4.
"""

import math
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from app.core.prisma import prisma
from app.generated.prisma.enums import AnalystLevel

logger = logging.getLogger(__name__)

# Reputation weights per analyst tier (Blueprint Section 8.4)
ANALYST_WEIGHTS: Dict[str, float] = {
    AnalystLevel.NOVICE.value: 1.0,
    AnalystLevel.SCOUT.value: 1.5,
    AnalystLevel.ANALYST.value: 2.5,
    AnalystLevel.PARTNER.value: 4.0,
}

# Aliases for flexibility across strings and enums
TIER_ALIASES: Dict[str, str] = {
    "novice": AnalystLevel.NOVICE.value,
    "scout": AnalystLevel.SCOUT.value,
    "analyst": AnalystLevel.ANALYST.value,
    "partner": AnalystLevel.PARTNER.value,
    "expert": AnalystLevel.PARTNER.value,
    "expert_verdict": AnalystLevel.PARTNER.value,
    "juror": AnalystLevel.PARTNER.value,
}

# Anti-brigading decay parameters
BURST_WINDOW_SECONDS = 3600          # 1 hour burst window (legacy compatibility)
MOVING_24H_WINDOW_SECONDS = 86400    # 24-hour moving window
BURST_THRESHOLD = 3                  # Max normal votes per window before decay kicks in
DECAY_LAMBDA = 0.35                  # Exponential decay rate for burst spam
NARRATIVE_BUBBLE_RATIO_THRESHOLD = 3.0  # Public engagement / Expert diligence ratio threshold


class HypeScoreEngine:
    """
    Weighted Hype Score Engine.
    Calculates composite crowd wisdom diligence score using reputation weights,
    protects against sybil attacks, voting rings, and coordinated brigading via
    moving 24h exponential decay, and detects narrative bubbles via divergence analysis.
    """

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        burst_threshold: int = BURST_THRESHOLD,
        decay_lambda: float = DECAY_LAMBDA,
        bubble_threshold: float = NARRATIVE_BUBBLE_RATIO_THRESHOLD,
    ):
        self.weights = weights or ANALYST_WEIGHTS
        self.burst_threshold = burst_threshold
        self.decay_lambda = decay_lambda
        self.bubble_threshold = bubble_threshold

    def get_analyst_weight(self, level: AnalystLevel | str) -> float:
        """Return the multiplier for the given analyst level."""
        if isinstance(level, AnalystLevel):
            level_str = level.value
        else:
            raw_str = str(level).strip().lower()
            canonical = TIER_ALIASES.get(raw_str, raw_str.upper())
            level_str = canonical

        return self.weights.get(level_str, 1.0)

    def compute_user_credibility_weight(
        self,
        level: AnalystLevel | str,
        history_brier_calibration: float = 1.0,
        account_age_days: Optional[int] = None,
    ) -> float:
        """
        Calculate full credibility weight per Blueprint Section 8.4:
        W_user = Phi_tier * Psi_hist * Omega_stake
        - Phi_tier: Novice (1.0), Scout (1.5), Analyst (2.5), Partner/Expert (4.0)
        - Psi_hist: historical Brier predictive accuracy calibrated against outcomes (clamped 0.2 to 2.0)
        - Omega_stake: account longevity dampening min(1.0, sqrt(Days / 90.0)), penalty for burner accounts
        """
        phi_tier = self.get_analyst_weight(level)
        psi_hist = max(0.2, min(2.0, float(history_brier_calibration)))
        omega_stake = 1.0
        if account_age_days is not None:
            omega_stake = max(0.1, min(1.0, math.sqrt(max(0, account_age_days) / 90.0)))

        return round(phi_tier * psi_hist * omega_stake, 4)

    @staticmethod
    def calculate_raw_score(
        market_score: int,
        team_score: int,
        traction_score: int,
        sharia_score: Optional[int] = None,
    ) -> float:
        """
        Normalize 1-10 scores across Market, Team, Traction, and Sharia/Ethics vectors
        into a 0-100 composite score.
        If sharia_score is provided: ((Market + Team + Traction + Sharia) / 4.0) * 10.0
        If sharia_score is None: ((Market + Team + Traction) / 3.0) * 10.0
        """
        clamped_market = max(1, min(10, market_score))
        clamped_team = max(1, min(10, team_score))
        clamped_traction = max(1, min(10, traction_score))

        if sharia_score is not None:
            clamped_sharia = max(1, min(10, sharia_score))
            return ((clamped_market + clamped_team + clamped_traction + clamped_sharia) / 4.0) * 10.0

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
            delta = (score_time - t).total_seconds()
            if 0 <= delta <= window_seconds:
                prior_in_window += 1

        if prior_in_window > self.burst_threshold:
            excess = prior_in_window - self.burst_threshold
            return math.exp(-self.decay_lambda * excess)

        return 1.0

    def compute_moving_24h_decay(
        self,
        score_time: datetime,
        all_times: List[datetime],
        window_seconds: int = MOVING_24H_WINDOW_SECONDS,
    ) -> float:
        """
        Moving 24h exponential decay preventing coordinated vote manipulation or sudden burst brigading.
        Evaluates clustering over rolling 24-hour windows.
        """
        return self.compute_decay_factor(score_time, all_times, window_seconds=window_seconds)

    def calculate_hype_score(
        self,
        scores: List[Dict[str, Any]],
        apply_anti_brigading: bool = True,
        use_moving_24h_window: bool = False,
    ) -> float:
        """
        Compute reputation-weighted Hype Score:
        HypeScore = Sum(Score_i * Weight(Level_i) * Decay_i) / Sum(Weight(Level_i) * Decay_i)

        Each score in `scores` can contain:
        - marketScore (int, 1-10)
        - teamScore (int, 1-10)
        - tractionScore (int, 1-10)
        - shariaScore (int, 1-10, optional)
        - analystLevel (AnalystLevel or str)
        - createdAt (datetime, optional for anti-brigading)
        - historyBrierCalibration (float, optional)
        - accountAgeDays (int, optional)
        """
        if not scores:
            return 0.0

        timestamps = [
            s.get("createdAt", datetime.now(timezone.utc))
            for s in scores
            if isinstance(s.get("createdAt"), datetime)
        ]

        window_sec = MOVING_24H_WINDOW_SECONDS if use_moving_24h_window else BURST_WINDOW_SECONDS

        total_weighted_score = 0.0
        total_weight = 0.0

        for s in scores:
            level = s.get("analystLevel", AnalystLevel.NOVICE)
            
            # Credibility weighting with optional Brier calibration & account age
            if "historyBrierCalibration" in s or "accountAgeDays" in s:
                weight = self.compute_user_credibility_weight(
                    level=level,
                    history_brier_calibration=s.get("historyBrierCalibration", 1.0),
                    account_age_days=s.get("accountAgeDays"),
                )
            else:
                weight = self.get_analyst_weight(level)

            raw = self.calculate_raw_score(
                market_score=s.get("marketScore", 5),
                team_score=s.get("teamScore", 5),
                traction_score=s.get("tractionScore", 5),
                sharia_score=s.get("shariaScore"),
            )

            decay = 1.0
            if apply_anti_brigading and "createdAt" in s and isinstance(s["createdAt"], datetime):
                decay = self.compute_decay_factor(s["createdAt"], timestamps, window_seconds=window_sec)

            effective_weight = weight * decay
            total_weighted_score += raw * effective_weight
            total_weight += effective_weight

        if total_weight <= 0.0:
            return 0.0

        return round(total_weighted_score / total_weight, 2)

    def detect_narrative_bubble(
        self,
        scores: List[Dict[str, Any]],
        threshold_ratio: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Divergence & Narrative Bubble detector.
        Computes the ratio between unweighted retail hype volume (Novice & Scout)
        and expert verdict evaluations (Analyst & Partner).
        Triggers NARRATIVE_BUBBLE_WARNING when ratio > threshold_ratio (default 3.0x).
        """
        threshold = threshold_ratio or self.bubble_threshold

        if not scores:
            return {
                "is_bubble": False,
                "divergence_ratio": 0.0,
                "retail_volume": 0,
                "expert_count": 0,
                "retail_avg_score": 0.0,
                "expert_avg_score": 0.0,
                "warning_code": None,
                "alert_message": None,
                "alert_flag": False,
            }

        retail_scores: List[float] = []
        expert_scores: List[float] = []

        for s in scores:
            level_val = s.get("analystLevel", AnalystLevel.NOVICE)
            level_str = level_val.value if isinstance(level_val, AnalystLevel) else str(level_val).upper()
            raw = self.calculate_raw_score(
                market_score=s.get("marketScore", 5),
                team_score=s.get("teamScore", 5),
                traction_score=s.get("tractionScore", 5),
                sharia_score=s.get("shariaScore"),
            )

            if level_str in ("NOVICE", "SCOUT"):
                retail_scores.append(raw)
            elif level_str in ("ANALYST", "PARTNER", "EXPERT", "EXPERT_VERDICT", "JUROR"):
                expert_scores.append(raw)
            else:
                retail_scores.append(raw)

        retail_volume = len(retail_scores)
        expert_count = len(expert_scores)

        retail_avg = round(sum(retail_scores) / retail_volume, 2) if retail_volume > 0 else 0.0
        expert_avg = round(sum(expert_scores) / expert_count, 2) if expert_count > 0 else 0.0

        if expert_count > 0:
            divergence_ratio = round(retail_volume / float(expert_count), 2)
        else:
            divergence_ratio = round(float(retail_volume), 2)

        # Trigger condition: public engagement volume outpaces expert evaluations by > 3.0x
        # We require at least 3 retail votes to avoid tripping on small test initializations
        is_bubble = (divergence_ratio > threshold) and (retail_volume >= 3)

        warning_code = "NARRATIVE_BUBBLE_WARNING" if is_bubble else None
        alert_message = (
            f"Public engagement volume outpaces verified expert diligence by {divergence_ratio:.1f}x "
            f"(threshold: {threshold:.1f}x). Retail hype is unanchored by expert due diligence."
            if is_bubble else None
        )

        return {
            "is_bubble": is_bubble,
            "divergence_ratio": divergence_ratio,
            "retail_volume": retail_volume,
            "expert_count": expert_count,
            "retail_avg_score": retail_avg,
            "expert_avg_score": expert_avg,
            "warning_code": warning_code,
            "alert_message": alert_message,
            "alert_flag": is_bubble,
        }

    async def submit_community_score(
        self,
        startup_id: str,
        user_id: int,
        analyst_level: AnalystLevel,
        market_score: int,
        team_score: int,
        traction_score: int,
        sharia_score: Optional[int] = None,
        feedback: Optional[str] = None,
        account_age_days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Persist community score in database, recompute startup HypeScore,
        perform narrative bubble divergence check, and update the Startup record.
        """
        effective_feedback = feedback
        if sharia_score is not None:
            prefix = f"[SHARIA_SCORE:{sharia_score}] "
            if not effective_feedback:
                effective_feedback = prefix.strip()
            elif prefix not in effective_feedback:
                effective_feedback = f"{prefix}{effective_feedback}"

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
                    "feedback": effective_feedback,
                },
                "update": {
                    "analystLevel": analyst_level,
                    "marketScore": market_score,
                    "teamScore": team_score,
                    "tractionScore": traction_score,
                    "feedback": effective_feedback,
                },
            },
        )

        # Retrieve all scores for this startup to recompute Hype Score
        all_scores = await prisma.communityscore.find_many(
            where={"startupId": startup_id}
        )

        score_dicts: List[Dict[str, Any]] = []
        for s in all_scores:
            s_sharia = None
            if s.feedback and "[SHARIA_SCORE:" in s.feedback:
                try:
                    part = s.feedback.split("[SHARIA_SCORE:")[1].split("]")[0]
                    s_sharia = int(part)
                except Exception:
                    s_sharia = None

            score_dicts.append({
                "marketScore": s.marketScore,
                "teamScore": s.teamScore,
                "tractionScore": s.tractionScore,
                "shariaScore": s_sharia if s_sharia is not None else (sharia_score if s.userId == user_id else None),
                "analystLevel": s.analystLevel,
                "createdAt": s.createdAt,
            })

        new_hype_score = self.calculate_hype_score(score_dicts, use_moving_24h_window=True)
        bubble_check = self.detect_narrative_bubble(score_dicts)

        # Update startup hype score in database
        try:
            await prisma.startup.update(
                where={"id": startup_id},
                data={"hypeScore": new_hype_score},
            )
        except Exception as e:
            logger.warning(f"Failed to update startup hypeScore: {e}")

        return {
            "score": saved_score,
            "newHypeScore": new_hype_score,
            "bubbleCheck": bubble_check,
        }


hype_score_engine = HypeScoreEngine()
