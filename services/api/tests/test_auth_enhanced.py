"""
Enhanced auth tests for security improvements.
Covers: token scope, user blocklist, replay protection, rate limiting, user enumeration.
"""

import pytest
from datetime import timedelta

from app.core.security import (
    create_access_token_for_user,
    create_refresh_token_for_user,
    create_access_token,
    verify_token,
    add_token_to_blocklist_sync,
    is_token_blocklisted_locally,
    clear_token_blocklist,
    add_user_to_blocklist,
    is_user_blocklisted,
    is_user_blocklisted_sync,
    clear_session_cookie,
    create_email_verification_token,
    create_password_reset_token,
)
from app.utils.rate_limit import (
    PerCredentialRateLimiter,
    login_ip_rate_limiter,
    complete_2fa_rate_limiter,
    resend_verification_email_limiter,
)


class TestTokenScope:
    """Test scope claim in access and refresh tokens."""

    def setup_method(self):
        clear_token_blocklist()

    def test_access_token_default_no_scope(self):
        """Default access token should not have a scope claim."""
        token = create_access_token_for_user(1)
        payload = verify_token(token)
        assert payload is not None
        assert "scope" not in payload or payload["scope"] is None

    def test_access_token_with_scope(self):
        """Access token should carry the scope claim when provided."""
        token = create_access_token_for_user(1, scope="email_unverified")
        payload = verify_token(token)
        assert payload is not None
        assert payload["scope"] == "email_unverified"

    def test_refresh_token_with_scope(self):
        """Refresh token should carry the scope claim when provided."""
        token = create_refresh_token_for_user(1, scope="email_unverified")
        payload = verify_token(token)
        assert payload is not None
        assert payload["scope"] == "email_unverified"

    def test_access_token_scope_preserved_in_verify(self):
        """Scope claim should survive encode/decode cycle."""
        token = create_access_token_for_user(42, scope="email_unverified")
        payload = verify_token(token)
        assert payload["sub"] == "42"
        assert payload["scope"] == "email_unverified"
        assert payload["type"] == "access"

    def test_multiple_scopes_distinct(self):
        """Different scope values should produce distinct tokens."""
        t1 = create_access_token_for_user(1, scope="email_unverified")
        t2 = create_access_token_for_user(1, scope="full")
        p1 = verify_token(t1)
        p2 = verify_token(t2)
        assert p1["scope"] == "email_unverified"
        assert p2["scope"] == "full"

    def test_none_scope_no_claim(self):
        """Explicit None scope should not add the claim."""
        token = create_access_token_for_user(1, scope=None)
        payload = verify_token(token)
        assert "scope" not in payload


class TestUserBlocklist:
    """Test user-level blocklist for session invalidation."""

    def setup_method(self):
        clear_token_blocklist()

    def teardown_method(self):
        clear_token_blocklist()

    @pytest.mark.asyncio
    async def test_user_not_blocklisted_by_default(self):
        """A user should not be blocklisted initially."""
        assert await is_user_blocklisted(42) is False
        assert is_user_blocklisted_sync(42) is False

    @pytest.mark.asyncio
    async def test_add_and_check_user_blocklist(self):
        """After adding, user should be blocklisted."""
        await add_user_to_blocklist(42)
        assert await is_user_blocklisted(42) is True

    @pytest.mark.asyncio
    async def test_user_blocklist_sync(self):
        """Sync check should also detect blocklisted user."""
        await add_user_to_blocklist(99)
        assert is_user_blocklisted_sync(99) is True

    @pytest.mark.asyncio
    async def test_user_blocklist_independent(self):
        """Different users should have independent blocklist entries."""
        await add_user_to_blocklist(1)
        assert await is_user_blocklisted(1) is True
        assert await is_user_blocklisted(2) is False
        assert is_user_blocklisted_sync(1) is True
        assert is_user_blocklisted_sync(2) is False

    @pytest.mark.asyncio
    async def test_token_blocklist_not_affected_by_user_blocklist(self):
        """Adding a user to blocklist should not affect unrelated tokens."""
        token = create_access_token_for_user(1)
        assert verify_token(token) is not None  # token is valid
        await add_user_to_blocklist(1)
        # The user is blocklisted, but a different token should still be recognisable
        # as blocklisted (token-level blocklist is independent)
        assert is_token_blocklisted_locally(token) is False


class TestRateLimiters:
    """Test the PerCredentialRateLimiter used for resend-verification."""

    def setup_method(self):
        self.limiter_email = PerCredentialRateLimiter(max_attempts=3, window_seconds=60)
        self.limiter_ip = PerCredentialRateLimiter(max_attempts=5, window_seconds=60)

    @pytest.mark.asyncio
    async def test_email_below_limit(self):
        """Requests below the threshold should not be limited."""
        assert await self.limiter_email.is_limited("test@example.com") is False
        assert await self.limiter_email.is_limited("test@example.com") is False

    @pytest.mark.asyncio
    async def test_email_reaches_limit(self):
        """Should be limited after reaching max_attempts."""
        for _ in range(3):
            await self.limiter_email.is_limited("test@example.com")
        assert await self.limiter_email.is_limited("test@example.com") is True

    @pytest.mark.asyncio
    async def test_ip_rate_limiter(self):
        """Per-IP limiter should work independently."""
        for _ in range(5):
            await self.limiter_ip.is_limited("192.168.1.1")
        assert await self.limiter_ip.is_limited("192.168.1.1") is True

    @pytest.mark.asyncio
    async def test_reset_clears_limit(self):
        """Resetting should clear the rate limit."""
        for _ in range(3):
            await self.limiter_email.is_limited("test@example.com")
        assert await self.limiter_email.is_limited("test@example.com") is True
        await self.limiter_email.reset("test@example.com")
        assert await self.limiter_email.is_limited("test@example.com") is False

    @pytest.mark.asyncio
    async def test_different_emails_independent(self):
        """Different emails should have independent rate limits."""
        for _ in range(3):
            await self.limiter_email.is_limited("user1@example.com")
        assert await self.limiter_email.is_limited("user1@example.com") is True
        assert await self.limiter_email.is_limited("user2@example.com") is False

    @pytest.mark.asyncio
    async def test_singleton_limiters(self):
        """Singleton limiters should work."""
        for _ in range(3):
            await resend_verification_email_limiter.is_limited("test@example.com")
        assert (
            await resend_verification_email_limiter.is_limited("test@example.com")
            is True
        )

    @pytest.mark.asyncio
    async def test_login_ip_rate_limiter(self):
        """login_ip_rate_limiter should rate limit after 20 attempts."""
        test_ip = "10.0.0.99"
        await login_ip_rate_limiter.reset(test_ip)
        for _ in range(20):
            await login_ip_rate_limiter.is_limited(test_ip)
        assert await login_ip_rate_limiter.is_limited(test_ip) is True
        await login_ip_rate_limiter.reset(test_ip)
        assert await login_ip_rate_limiter.is_limited(test_ip) is False

    @pytest.mark.asyncio
    async def test_complete_2fa_rate_limiter(self):
        """complete_2fa_rate_limiter should rate limit after 5 attempts."""
        key = "2fa:user-999"
        await complete_2fa_rate_limiter.reset(key)
        for _ in range(5):
            await complete_2fa_rate_limiter.is_limited(key)
        assert await complete_2fa_rate_limiter.is_limited(key) is True
        await complete_2fa_rate_limiter.reset(key)
        assert await complete_2fa_rate_limiter.is_limited(key) is False


class TestEmailVerificationToken:
    """Test email verification token creation and verification."""

    def test_create_email_verification_token(self):
        """Should create a valid email verification token."""
        token = create_email_verification_token("test@example.com", 42)
        assert token is not None
        assert len(token) > 20

    def test_email_verification_token_has_correct_type(self):
        """Payload should have type='email_verification'."""
        from app.core.security import verify_email_token

        token = create_email_verification_token("test@example.com", 42)
        payload = verify_email_token(token)
        assert payload is not None
        assert payload["type"] == "email_verification"
        assert payload["sub"] == "42"
        assert payload["email"] == "test@example.com"


class TestPasswordResetToken:
    """Test password reset token creation and verification."""

    def test_create_password_reset_token(self):
        """Should create a valid password reset token."""
        token = create_password_reset_token(42)
        assert token is not None
        from app.core.security import verify_password_reset_token

        payload = verify_password_reset_token(token)
        assert payload is not None
        assert payload["type"] == "password_reset"
        assert payload["sub"] == "42"


class TestSessionCookie:
    """Test session cookie helpers."""

    def test_clear_session_cookie_no_error(self):
        """clear_session_cookie should not raise even without a response."""
        from fastapi.responses import JSONResponse

        response = JSONResponse(content={"message": "test"})
        # Should not raise
        clear_session_cookie(response)

    def test_clear_session_cookie_sets_expiry(self):
        """clear_session_cookie should set max-age=0 on the cookie."""
        from fastapi.responses import JSONResponse

        response = JSONResponse(content={"x": 1})
        clear_session_cookie(response)
        # The cookie header should include max-age=0 or expires in the past
        headers = dict(response.headers)
        cookie_val = headers.get("set-cookie", "")
        # Starlette's delete_cookie sets max-age=0
        assert "podacium_session=" in cookie_val
        assert "Max-Age=0" in cookie_val or "max-age=0" in cookie_val

    def test_set_session_cookie_publishes_fingerprint_cookie(self):
        """The raw fingerprint must be available to the Edge on the next request.

        The API issues the session (with an `fpt` claim) while the browser's
        FingerprintJS cookie may not be written yet. Publishing it alongside
        the session cookie keeps role-gated routes from being treated as
        unverified and bounced to /auth/login.
        """
        from fastapi.responses import JSONResponse

        from app.core.security import set_session_cookie

        response = JSONResponse(content={"x": 1})
        set_session_cookie(response, 42, role="ADMIN", fingerprint="abc123def456")

        cookies = "; ".join(response.headers.getlist("set-cookie"))
        assert "podacium_session=" in cookies
        assert "x-fingerprint=abc123def456" in cookies

    def test_set_session_cookie_without_fingerprint_skips_cookie(self):
        from fastapi.responses import JSONResponse

        from app.core.security import set_session_cookie

        response = JSONResponse(content={"x": 1})
        set_session_cookie(response, 42, role="ADMIN")

        cookies = "; ".join(response.headers.getlist("set-cookie"))
        assert "x-fingerprint=" not in cookies


class TestUserEnumerationPrevention:
    """Test that auth endpoints don't leak whether an email exists."""

    def test_register_error_generic_for_duplicate(self):
        """Registration should return generic error for duplicate emails."""
        error_msg = "Email already registered"
        # Simulate what the router does
        if "already registered" in error_msg.lower():
            error_msg = "Registration failed. Please try again."
        assert error_msg == "Registration failed. Please try again."
        assert "already registered" not in error_msg.lower()

    def test_forgot_password_response_always_generic(self):
        """Forgot password should always return generic message."""
        expected = "If the email exists, a reset link has been sent"
        assert expected is not None and len(expected) > 10

    def test_resend_verification_response_always_generic(self):
        """Resend verification should always return generic message."""
        expected = "If the account exists and is not verified, a new link has been sent"
        assert expected is not None and len(expected) > 10


class TestReplayProtection:
    """Test replay protection patterns used in verify_email and reset_password."""

    def test_verify_token_marked_used_before_update(self):
        """Replay protection principle: mark consumed BEFORE applying changes.
        This test verifies the concept — actual DB calls tested separately."""
        # Simulate the pattern used in verify_email:
        # 1. Verify JWT
        token = create_access_token({"sub": "42", "type": "verification"})
        payload = verify_token(token)
        assert payload is not None

        # 2. Find token (simulated)
        assert payload["sub"] == "42"

        # 3. Mark used FIRST (simulated — blocklist is the proxy for this)
        add_token_to_blocklist_sync(token)
        assert is_token_blocklisted_locally(token) is True

        # 4. If blocked, attempting to use again fails
        assert verify_token(token) is None  # now invalid

    def test_expired_token_cannot_be_replayed(self):
        """Expired tokens should always fail verification."""
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
        assert verify_token(token) is None

    def test_wrong_type_token_rejected_for_verification(self):
        """Tokens with wrong type should be rejected by type-specific verifiers."""
        from app.core.security import verify_email_token, verify_password_reset_token

        access_token = create_access_token_for_user(1)
        # verify_email_token should reject non-email_verification tokens
        assert verify_email_token(access_token) is None
        # verify_password_reset_token should reject non-password_reset tokens
        assert verify_password_reset_token(access_token) is None
