"""
Tests for idempotency service.
Covers: key generation, duplicate detection, cache key format.
"""
import pytest
from app.services.idempotency_service import IdempotencyService, IDEMPOTENCY_TTL_HOURS


class TestIdempotencyService:
    """Test idempotency logic (unit tests, no Redis/DB)."""

    def setup_method(self):
        self.service = IdempotencyService()

    def test_cache_key_format(self):
        """Cache keys should be namespaced by user."""
        key = self.service._make_cache_key("abc-123", 42)
        assert key == "idempotency:42:abc-123"

    def test_cache_key_different_users(self):
        """Same idempotency key for different users should produce different cache keys."""
        key1 = self.service._make_cache_key("same-key", 1)
        key2 = self.service._make_cache_key("same-key", 2)
        assert key1 != key2

    def test_cache_key_different_keys(self):
        """Different idempotency keys for same user should produce different cache keys."""
        key1 = self.service._make_cache_key("key-a", 1)
        key2 = self.service._make_cache_key("key-b", 1)
        assert key1 != key2

    def test_ttl_is_24_hours(self):
        """Idempotency keys should expire after 24 hours."""
        assert IDEMPOTENCY_TTL_HOURS == 24

    @pytest.mark.asyncio
    async def test_new_key_not_duplicate(self):
        """A never-seen key should not be flagged as duplicate."""
        # Without Redis/DB, this should return (False, None)
        is_dup, response = await self.service.check_idempotency("new-key-123", 1)
        assert is_dup is False
        assert response is None

    @pytest.mark.asyncio
    async def test_empty_key_not_duplicate(self):
        """Empty idempotency key should not be treated as duplicate."""
        is_dup, response = await self.service.check_idempotency("", 1)
        assert is_dup is False
        assert response is None

    @pytest.mark.asyncio
    async def test_none_key_not_duplicate(self):
        """None idempotency key should not be treated as duplicate."""
        is_dup, response = await self.service.check_idempotency(None, 1)
        assert is_dup is False
        assert response is None
