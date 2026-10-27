"""Redis Friction Heatmap Telemetry Aggregator Service."""

import json
import logging

logger = logging.getLogger(__name__)


class HeatmapService:
    """Aggregates 100-bin replayed interval frequencies for video scrubber heatmaps."""

    def __init__(self):
        self._heatmap_store: dict[str, list[int]] = {}

    def _get_redis_client(self):
        try:
            from app.core.config import setting

            if setting.REDIS_URL:
                import redis

                return redis.from_url(setting.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.debug(f"Redis client initialization failed: {e}")
        return None

    def record_interval_replay(
        self, lesson_id: str, start_time: float, end_time: float, duration: float
    ) -> list[int]:
        """Maps watch interval slice to 100 time bins (0..99) and increments replayed bin counters."""
        bins = self.get_lesson_heatmap(lesson_id)
        if duration <= 0 or end_time <= start_time:
            return bins

        start_bin = int(max(0, min(99, (start_time / duration) * 100)))
        end_bin = int(max(0, min(99, (end_time / duration) * 100)))

        for b in range(start_bin, end_bin + 1):
            bins[b] += 1

        self._heatmap_store[lesson_id] = bins

        # Persist to Redis if available
        r = self._get_redis_client()
        if r:
            try:
                key = f"video:heatmap:{lesson_id}"
                r.setex(key, 86400 * 30, json.dumps(bins))
            except Exception as e:
                logger.debug(f"Failed to persist heatmap to Redis: {e}")

        return bins

    def get_lesson_heatmap(self, lesson_id: str) -> list[int]:
        """Retrieves 100-element bin frequency array for a given lesson."""
        if lesson_id in self._heatmap_store:
            return list(self._heatmap_store[lesson_id])

        r = self._get_redis_client()
        if r:
            try:
                key = f"video:heatmap:{lesson_id}"
                raw = r.get(key)
                if raw:
                    loaded = json.loads(raw)
                    if isinstance(loaded, list) and len(loaded) == 100:
                        self._heatmap_store[lesson_id] = loaded
                        return list(loaded)
            except Exception as e:
                logger.debug(f"Failed to fetch heatmap from Redis: {e}")

        bins = [0] * 100
        self._heatmap_store[lesson_id] = bins
        return list(bins)


heatmap_service = HeatmapService()
