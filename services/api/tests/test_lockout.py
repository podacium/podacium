"""
Tests for account lockout service.
Covers: attempt tracking, lockout thresholds, clearing attempts.

OWASP Top 10 (2021): A07 (Auth Failures), A04 (Insecure Design)
CWE: CWE-307 (Brute Force), CWE-645 (Lockout Bypass), CWE-799 (Rate Limiting)
"""
import pytest
from app.services.account_lockout_service import (
    AccountLockoutService,
    _attempt_store,
)


class TestAccountLockout:
    """Test account lockout logic (in-memory fallback)."""

    def setup_method(self):
        """Clear the in-memory store before each test."""
        _attempt_store.clear()
        self.service = AccountLockoutService()
        # Force in-memory mode by mocking _get_redis to return None
        async def mock_get_redis():
            return None
        self.service._get_redis = mock_get_redis

    @pytest.mark.asyncio
    async def test_no_lockout_initially(self):
        """Fresh account should not be locked out."""
        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is False
        assert remaining == 0

    @pytest.mark.asyncio
    async def test_lockout_after_threshold(self):
        """Account should be locked after 5 failed attempts."""
        for _ in range(5):
            await self.service.record_failed_attempt("test@example.com")

        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is True
        assert remaining == 5 * 60  # 5 minutes

    @pytest.mark.asyncio
    async def test_escalating_lockout(self):
        """Lockout duration should escalate with more attempts."""
        for _ in range(10):
            await self.service.record_failed_attempt("test@example.com")

        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is True
        assert remaining == 30 * 60  # 30 minutes

    @pytest.mark.asyncio
    async def test_max_lockout(self):
        """15+ attempts should trigger maximum lockout."""
        for _ in range(15):
            await self.service.record_failed_attempt("test@example.com")

        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is True
        assert remaining == 60 * 60  # 1 hour

    @pytest.mark.asyncio
    async def test_clear_attempts(self):
        """Clearing attempts should remove lockout."""
        for _ in range(5):
            await self.service.record_failed_attempt("test@example.com")

        await self.service.clear_attempts("test@example.com")

        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is False
        assert remaining == 0

    @pytest.mark.asyncio
    async def test_different_identifiers_independent(self):
        """Different emails should have independent lockout counters."""
        for _ in range(5):
            await self.service.record_failed_attempt("user1@example.com")

        is_locked_1, _ = await self.service.is_locked_out("user1@example.com")
        is_locked_2, _ = await self.service.is_locked_out("user2@example.com")

        assert is_locked_1 is True
        assert is_locked_2 is False

    @pytest.mark.asyncio
    async def test_get_attempt_count(self):
        """Should accurately track attempt count."""
        assert await self.service.get_attempt_count("test@example.com") == 0

        await self.service.record_failed_attempt("test@example.com")
        await self.service.record_failed_attempt("test@example.com")
        await self.service.record_failed_attempt("test@example.com")

        assert await self.service.get_attempt_count("test@example.com") == 3

    @pytest.mark.asyncio
    async def test_below_threshold_not_locked(self):
        """4 attempts (below threshold of 5) should not trigger lockout."""
        for _ in range(4):
            await self.service.record_failed_attempt("test@example.com")

        is_locked, remaining = await self.service.is_locked_out("test@example.com")
        assert is_locked is False
        assert remaining == 0
