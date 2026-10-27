"""Server-side Watched Intervals Union & Anti-Cheat Progress Engine."""

import json
import logging
from typing import List, Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Fallback in-memory cache if Redis is unavailable
_memory_interval_store: Dict[str, List[Tuple[float, float]]] = {}
_memory_timestamp_store: Dict[str, float] = {}


class WatchedIntervalTracker:
    """Calculates true unique watched seconds and enforces anti-cheat verification using Sweep Line Algorithm."""

    @staticmethod
    def merge_intervals(
        intervals: List[Tuple[float, float]], jitter_tolerance: float = 0.25
    ) -> List[Tuple[float, float]]:
        """O(N log N) Sweep Line interval merging with 0.25s jitter tolerance."""
        if not intervals:
            return []

        # Filter invalid bounds and sort by start time
        valid_intervals = [
            (float(start), float(end))
            for start, end in intervals
            if end > start and not (start < 0)
        ]
        if not valid_intervals:
            return []

        sorted_intervals = sorted(valid_intervals, key=lambda x: (x[0], x[1]))
        merged: List[Tuple[float, float]] = []
        curr_start, curr_end = sorted_intervals[0]

        for next_start, next_end in sorted_intervals[1:]:
            if next_start <= (curr_end + jitter_tolerance):
                curr_end = max(curr_end, next_end)
            else:
                merged.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end

        merged.append((curr_start, curr_end))
        return merged

    @classmethod
    def calculate_unique_watched_seconds(
        cls, intervals: List[Tuple[float, float]]
    ) -> float:
        """Calculate exact non-overlapping watched seconds."""
        merged = cls.merge_intervals(intervals)
        return sum(max(0.0, end - start) for start, end in merged)

    @classmethod
    async def get_user_intervals(
        cls, user_id: int, lesson_id: str
    ) -> List[Tuple[float, float]]:
        """Retrieve authoritative watched intervals from shared Redis pool or in-memory fallback."""
        key = f"video:intervals:{user_id}:{lesson_id}"
        try:
            from app.core.redis import get_redis

            r = await get_redis()
            if r:
                raw = await r.get(key)
                if raw:
                    loaded = json.loads(raw)
                    return [(float(i[0]), float(i[1])) for i in loaded if len(i) == 2]
        except Exception as e:
            logger.debug(f"Redis get_user_intervals failed, using fallback: {e}")

        return _memory_interval_store.get(key, [])

    @classmethod
    async def save_user_intervals(
        cls, user_id: int, lesson_id: str, intervals: List[Tuple[float, float]]
    ) -> None:
        """Persist authoritative watched intervals to Redis with 30-day TTL."""
        key = f"video:intervals:{user_id}:{lesson_id}"
        merged = cls.merge_intervals(intervals)
        _memory_interval_store[key] = merged
        try:
            from app.core.redis import get_redis

            r = await get_redis()
            if r:
                await r.setex(key, 86400 * 30, json.dumps(merged))
        except Exception as e:
            logger.debug(f"Redis save_user_intervals failed, cached in memory: {e}")

    @classmethod
    async def get_last_heartbeat_timestamp(
        cls, user_id: int, lesson_id: str
    ) -> Optional[float]:
        """Fetch server wall-clock timestamp of previous valid heartbeat."""
        key = f"video:heartbeat_ts:{user_id}:{lesson_id}"
        try:
            from app.core.redis import get_redis

            r = await get_redis()
            if r:
                ts = await r.get(key)
                if ts:
                    return float(ts)
        except Exception as e:
            logger.debug(f"Redis get_last_heartbeat_timestamp fallback: {e}")

        return _memory_timestamp_store.get(key)

    @classmethod
    async def update_last_heartbeat_timestamp(
        cls, user_id: int, lesson_id: str, timestamp: float
    ) -> None:
        """Store authoritative server timestamp for heartbeat rate verification."""
        key = f"video:heartbeat_ts:{user_id}:{lesson_id}"
        _memory_timestamp_store[key] = timestamp
        try:
            from app.core.redis import get_redis

            r = await get_redis()
            if r:
                await r.setex(key, 7200, str(timestamp))
        except Exception as e:
            logger.debug(f"Redis update_last_heartbeat_timestamp fallback: {e}")

    @classmethod
    def verify_progress_heartbeat(
        cls,
        existing_intervals: List[Tuple[float, float]],
        new_start: float,
        new_end: float,
        duration_seconds: float,
        time_elapsed_since_last_beacon: float,
        server_elapsed_seconds: Optional[float] = None,
        max_speed_multiplier: float = 2.5,
        drift_allowance: float = 3.0,
    ) -> Dict[str, Any]:
        """Validate playback heartbeat payload against physical limits and calculate completion."""
        if duration_seconds <= 0:
            return {
                "is_valid": False,
                "reason": "Invalid video duration",
                "unique_watched_seconds": 0.0,
                "progress_percentage": 0.0,
                "merged_intervals": existing_intervals,
                "is_completed": False,
            }

        # Strict clamping to valid video bounds
        clamped_start = max(0.0, min(new_start, duration_seconds))
        clamped_end = max(0.0, min(new_end, duration_seconds))

        if clamped_end <= clamped_start:
            unique_seconds = cls.calculate_unique_watched_seconds(existing_intervals)
            progress_pct = min(100.0, (unique_seconds / duration_seconds) * 100.0)
            return {
                "is_valid": True,
                "reason": "Zero-length interval ignored",
                "unique_watched_seconds": unique_seconds,
                "progress_percentage": round(progress_pct, 2),
                "merged_intervals": existing_intervals,
                "is_completed": progress_pct >= 90.0,
            }

        segment_duration = clamped_end - clamped_start

        # Anti-cheat check 0: Cap any single heartbeat segment duration to prevent idle-drift exploitation
        MAX_BEACON_SEGMENT = 30.0
        if segment_duration > (
            MAX_BEACON_SEGMENT * max_speed_multiplier + drift_allowance
        ):
            return {
                "is_valid": False,
                "reason": (
                    f"Heartbeat segment duration {segment_duration:.1f}s exceeds maximum allowed chunk "
                    f"({MAX_BEACON_SEGMENT * max_speed_multiplier + drift_allowance:.1f}s). Heartbeats must be streamed periodically."
                ),
                "unique_watched_seconds": cls.calculate_unique_watched_seconds(
                    existing_intervals
                ),
                "progress_percentage": 0.0,
                "merged_intervals": existing_intervals,
                "is_completed": False,
            }

        # Anti-cheat check 1: Authoritative Server Clock Delta Verification
        if server_elapsed_seconds is not None:
            effective_elapsed = max(0.0, server_elapsed_seconds)
            # Anti-flood check: heartbeats cannot arrive faster than 0.20s with non-trivial segment duration
            if effective_elapsed < 0.20 and segment_duration > 0.5:
                return {
                    "is_valid": False,
                    "reason": f"Heartbeats arriving too rapidly ({effective_elapsed:.3f}s elapsed on server).",
                    "unique_watched_seconds": cls.calculate_unique_watched_seconds(
                        existing_intervals
                    ),
                    "progress_percentage": 0.0,
                    "merged_intervals": existing_intervals,
                    "is_completed": False,
                }

            # Proportional drift allowance: do not allow full drift on tiny elapsed intervals
            effective_drift = min(drift_allowance, max(0.5, effective_elapsed * 0.5))
            max_permitted_segment = (
                effective_elapsed * max_speed_multiplier
            ) + effective_drift
            if segment_duration > max_permitted_segment:
                return {
                    "is_valid": False,
                    "reason": (
                        f"Server anti-cheat violation: {segment_duration:.1f}s watched in "
                        f"{server_elapsed_seconds:.1f}s real elapsed time (limit: {max_permitted_segment:.1f}s at {max_speed_multiplier}x)."
                    ),
                    "unique_watched_seconds": cls.calculate_unique_watched_seconds(
                        existing_intervals
                    ),
                    "progress_percentage": 0.0,
                    "merged_intervals": existing_intervals,
                    "is_completed": False,
                }
        else:
            # First beacon in session: cap single segment duration to reasonable chunk (max 30s)
            if segment_duration > (15.0 * max_speed_multiplier + drift_allowance):
                return {
                    "is_valid": False,
                    "reason": f"Initial heartbeat segment too large ({segment_duration:.1f}s). Must stream in sequence.",
                    "unique_watched_seconds": cls.calculate_unique_watched_seconds(
                        existing_intervals
                    ),
                    "progress_percentage": 0.0,
                    "merged_intervals": existing_intervals,
                    "is_completed": False,
                }

        # Anti-cheat check 2: Client Reported Speed Validation
        if time_elapsed_since_last_beacon > 0:
            playback_speed = segment_duration / time_elapsed_since_last_beacon
            if playback_speed > (
                max_speed_multiplier
                + (drift_allowance / time_elapsed_since_last_beacon)
            ):
                return {
                    "is_valid": False,
                    "reason": f"Playback speed {playback_speed:.1f}x exceeded max allowed limit ({max_speed_multiplier}x)",
                    "unique_watched_seconds": cls.calculate_unique_watched_seconds(
                        existing_intervals
                    ),
                    "progress_percentage": 0.0,
                    "merged_intervals": existing_intervals,
                    "is_completed": False,
                }

        # Merge new clamped interval
        all_intervals = existing_intervals + [(clamped_start, clamped_end)]
        merged = cls.merge_intervals(all_intervals)
        unique_seconds = cls.calculate_unique_watched_seconds(merged)

        # Calculate progress percentage
        progress_pct = (unique_seconds / duration_seconds) * 100.0
        progress_pct = min(100.0, max(0.0, progress_pct))

        # Completion rule: strictly require unique watched seconds >= 90% of duration
        is_completed = (progress_pct >= 90.0) or (
            unique_seconds >= (0.90 * duration_seconds)
        )

        return {
            "is_valid": True,
            "reason": "OK",
            "unique_watched_seconds": round(unique_seconds, 2),
            "progress_percentage": round(progress_pct, 2),
            "merged_intervals": merged,
            "is_completed": is_completed,
        }


interval_tracker = WatchedIntervalTracker()
