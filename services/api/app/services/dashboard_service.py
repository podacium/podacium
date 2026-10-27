import json
from typing import Dict, Any, Optional
import logging

from app.core.config import setting
from app.schemas.auth import UserRole
from app.schemas.dashboard import DashboardResponse, DashboardState
from app.services.dashboard.strategies import get_strategy
from app.services.dashboard.view_config import get_view_config

logger = logging.getLogger(__name__)


class RedisCache:
    """Thin Redis-backed cache for dashboard responses."""

    def __init__(self):
        self._client = None
        self._default_ttl = 300

    async def _get_client(self):
        if self._client is None:
            try:
                import redis.asyncio as aioredis
                self._client = aioredis.from_url(
                    setting.REDIS_CACHE_URL or setting.REDIS_URL or "redis://localhost:6379/1",
                    decode_responses=True,
                    socket_timeout=2,
                    socket_connect_timeout=2,
                    retry_on_timeout=False,
                )
                await self._client.ping()
                logger.info("Redis cache connected")
            except Exception as e:
                logger.warning(f"Redis cache unavailable, using fallback: {e}")
                self._client = None
        return self._client

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        client = await self._get_client()
        if not client:
            return None
        try:
            data = await client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.warning(f"Redis cache get failed: {e}")
            return None

    async def set(self, key: str, value: Dict[str, Any], ttl: int = 300):
        client = await self._get_client()
        if not client:
            return
        try:
            await client.setex(key, ttl, json.dumps(value, default=str))
        except Exception:
            pass

    async def delete(self, key: str):
        client = await self._get_client()
        if not client:
            return
        try:
            await client.delete(key)
        except Exception:
            pass


class DashboardService:
    """Orchestrates role-specific dashboard data loading via strategy pattern."""

    def __init__(self):
        self._cache = RedisCache()
        self._cache_ttl = 300
        self._fallback: Dict[str, Any] = {}

    def _cache_key(self, user_id: int, role: UserRole) -> str:
        return f"dash:{user_id}:{role.value}"

    async def get_user_dashboard(
        self, user_id: int, role: UserRole, refresh: bool = False
    ) -> DashboardResponse:
        cache_key = self._cache_key(user_id, role)

        if not refresh:
            try:
                cached = await self._cache.get(cache_key)
                if cached:
                    return DashboardResponse(**cached)
            except Exception as e:
                logger.warning(f"Cache read failed, rebuilding dashboard: {e}")

        strategy = get_strategy(role)

        try:
            state = await strategy.load_common(user_id, DashboardState())
        except Exception as e:
            logger.error(f"Dashboard load_common failed for user={user_id} role={role.value}: {e}", exc_info=True)
            raise ValueError(f"Failed to load common dashboard data: {e}")

        try:
            state = await strategy.load_role_data(user_id, state)
        except Exception as e:
            logger.error(f"Dashboard load_role_data failed for user={user_id} role={role.value}: {e}", exc_info=True)
            raise ValueError(f"Failed to load role-specific dashboard data: {e}")

        try:
            view_config = get_view_config(role)
        except Exception as e:
            logger.error(f"Dashboard view_config failed for role={role.value}: {e}", exc_info=True)
            raise ValueError(f"Failed to load view configuration: {e}")

        try:
            response = DashboardResponse(role=role.value, view_config=view_config, state=state)
        except Exception as e:
            logger.error(f"Dashboard response construction failed for user={user_id}: {e}", exc_info=True)
            raise ValueError(f"Failed to construct dashboard response: {e}")

        try:
            dump = response.model_dump(mode="json")
            await self._cache.set(cache_key, dump)
        except Exception as e:
            logger.warning(f"Dashboard cache write failed: {e}")

        return response

    async def refresh_user_dashboard(self, user_id: int, role: UserRole):
        cache_key = self._cache_key(user_id, role)
        await self._cache.delete(cache_key)


dashboard_service = DashboardService()
