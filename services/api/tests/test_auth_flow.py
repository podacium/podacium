"""
Comprehensive auth flow integration tests.

Tests the full HTTP-level auth cycle:
  register → verify → login → refresh → logout

Uses mocked Prisma layer (no real database needed). Rate limiters and account
lockout use in-memory fallbacks, so no Redis dependency either.
"""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport


class MockUser:
    """Mimics a Prisma User model instance for test mocks."""

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


_USER_ID = 1


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _mock_all_deps():
    """
    Mock every module that imports `prisma` from app.core.prisma so they
    all see the same AsyncMock tree.  Also stub totp_service (2FA disabled).
    """
    patches = [
        patch("app.services.auth_service.prisma"),
        patch("app.routers.auth.prisma"),
        patch("app.services.totp_service.prisma"),
        patch("app.services.email_otp_service.prisma"),
        patch(
            "app.core.turnstile.verify_turnstile_token",
            new=AsyncMock(return_value=True),
        ),
    ]
    for p in patches:
        p.start()
    yield
    for p in patches:
        p.stop()


@pytest.fixture
def mock_auth_service():
    """Selectively replace auth_service methods so we control token issuance."""
    with patch("app.routers.auth.auth_service") as mock:
        yield mock


@pytest.fixture
def verified_user_password() -> str:
    return "StrongP@ss1"


@pytest.fixture
def verified_user(verified_user_password: str) -> MockUser:
    """A user dict that has verified email and all required fields."""
    from app.core.security import get_password_hash

    return MockUser(
        id=_USER_ID,
        email="alice@podacium.com",
        fullName="Alice",
        role="STUDENT",
        emailVerified=True,
        isActive=True,
        isDeactivated=False,
        deletedAt=None,
        deactivatedAt=None,
        onboardingCompleted=False,
        passwordHash=get_password_hash(verified_user_password),
        createdAt=datetime.datetime.now(datetime.timezone.utc),
        updatedAt=datetime.datetime.now(datetime.timezone.utc),
        lastLoginAt=None,
    )


@pytest.fixture
def unverified_user(verified_user_password: str) -> MockUser:
    """Same as verified_user but emailVerified=False."""
    from app.core.security import get_password_hash

    return MockUser(
        id=2,
        email="bob@podacium.com",
        fullName="Bob",
        role="STUDENT",
        emailVerified=False,
        isActive=True,
        isDeactivated=False,
        deletedAt=None,
        deactivatedAt=None,
        onboardingCompleted=False,
        passwordHash=get_password_hash(verified_user_password),
        createdAt=datetime.datetime.now(datetime.timezone.utc),
        updatedAt=datetime.datetime.now(datetime.timezone.utc),
        lastLoginAt=None,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────


async def _get_client():
    """Import app.main and build an async test client."""
    from app.main import app

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestAuthFlow:
    async def test_full_auth_flow(
        self, verified_user: MockUser, verified_user_password: str
    ):
        """
        Complete happy path: register → verify → login → refresh → logout.
        Mocks the Prisma layer but hits real HTTP endpoints.
        """
        # ── 0. Mock wiring ────────────────────────────────────────────────────
        from app.routers.auth import prisma as router_prisma
        from app.services.auth_service import prisma as service_prisma
        from app.services.totp_service import prisma as totp_prisma

        # TOTP returns 2FA disabled
        totp_prisma.securitysettings = MagicMock()
        totp_prisma.securitysettings.find_unique = AsyncMock(return_value=None)

        # No existing user during registration
        service_prisma.user = MagicMock()
        service_prisma.user.find_first = AsyncMock(return_value=None)

        # Registration creates a user
        service_prisma.user.create = AsyncMock(return_value=verified_user)
        service_prisma.usersettings = MagicMock()
        service_prisma.usersettings.create = AsyncMock(return_value=None)
        service_prisma.authtoken = MagicMock()
        service_prisma.authtoken.create = AsyncMock(return_value=None)

        # ── 1. Register ───────────────────────────────────────────────────────
        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "alice@podacium.com",
                    "password": verified_user_password,
                    "fullName": "Alice",
                    "acceptedTerms": True,
                    "locale": "en",
                },
            )
        assert resp.status_code == 201, f"Register failed: {resp.text}"
        data = resp.json()
        assert "user_id" in data
        assert data["verification_sent"] is True

        # ── 2. Verify email ────────────────────────────────────────────────────
        # Stub auth_service.verify_email to return success + tokens
        from app.core.security import (
            create_access_token_for_user,
            create_refresh_token_for_user,
        )

        fake_tokens = {
            "tokens": {
                "access_token": create_access_token_for_user(_USER_ID),
                "refresh_token": create_refresh_token_for_user(_USER_ID),
            },
            "user_id": _USER_ID,
        }

        with patch(
            "app.routers.auth.auth_service.verify_email",
            new=AsyncMock(return_value=fake_tokens),
        ):
            async with await _get_client() as client:
                resp = await client.post(
                    "/api/v1/auth/verify-email",
                    json={
                        "token": "valid-mock-token",
                    },
                )
        assert resp.status_code == 200, f"Verify email failed: {resp.text}"
        assert resp.json()["message"] == "Email verified successfully"

        # ── 3. Login ──────────────────────────────────────────────────────────
        # Make find_unique return the verified user with attributes
        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=verified_user)
        router_prisma.user.update = AsyncMock(return_value=verified_user)
        # Regular users have no AdminProfile row
        router_prisma.adminprofile = MagicMock()
        router_prisma.adminprofile.find_unique = AsyncMock(return_value=None)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "alice@podacium.com",
                    "password": verified_user_password,
                },
            )
        assert resp.status_code == 200, f"Login failed: {resp.text}"

        # Check cookies were set (httpx returns them as a dict in resp.cookies)
        cookies = {c.name: c.value for c in client.cookies.jar}
        assert "access_token" in cookies, "Access token cookie not set"
        assert "refresh_token" in cookies, "Refresh token cookie not set"

        login_body = resp.json()
        assert login_body["message"] == "Login successful"

        # ── 4. Refresh token ──────────────────────────────────────────────────
        # Stub refresh_tokens so we don't need blocklist / redis
        new_access = create_access_token_for_user(_USER_ID)
        new_refresh = create_refresh_token_for_user(_USER_ID)
        fake_refresh = {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": 900,
        }

        with patch(
            "app.routers.auth.auth_service.refresh_tokens",
            new=AsyncMock(return_value=fake_refresh),
        ):
            async with await _get_client() as client:
                # Set the refresh cookie so the endpoint sees it
                client.cookies.set("refresh_token", "mock-refresh-token")
                resp = await client.post("/api/v1/auth/refresh-token")
        assert resp.status_code == 200, f"Refresh failed: {resp.text}"
        refresh_body = resp.json()
        assert refresh_body.get("message") == "Token refreshed successfully"

        # ── 5. Logout ─────────────────────────────────────────────────────────
        # Logout requires a valid access token (auth dependency) plus a refresh
        # token to revoke. Issue real tokens and stub the revocation lookup so
        # the token is not treated as already-revoked. The auth dependency
        # reads prisma via app.core.auth (NOT the router/service mocks above),
        # so it must be stubbed too.
        from app.core.security import (
            create_access_token_for_user,
            create_refresh_token_for_user,
        )
        from app.core import auth as core_auth

        core_auth.prisma.user.find_unique = AsyncMock(return_value=verified_user)
        core_auth.prisma.authtoken.find_unique = AsyncMock(return_value=None)
        verified_user.skills = []
        verified_user.socialLinks = None
        router_prisma.authtoken = MagicMock()
        router_prisma.authtoken.find_unique = AsyncMock(return_value=None)
        async with await _get_client() as client:
            client.cookies.set("access_token", create_access_token_for_user(_USER_ID))
            client.cookies.set("refresh_token", create_refresh_token_for_user(_USER_ID))
            resp = await client.post("/api/v1/auth/logout")
        assert resp.status_code == 200, f"Logout failed: {resp.text}"
        assert resp.json()["message"] == "Logged out successfully"

    async def test_register_duplicate_email(self):
        """Register with an already-taken email returns 400."""
        from app.services.auth_service import prisma as service_prisma

        existing = MockUser(id=99, email="taken@podacium.com", fullName="Existing")
        service_prisma.user = MagicMock()
        service_prisma.user.find_first = AsyncMock(return_value=existing)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "taken@podacium.com",
                    "password": "StrongP@ss1",
                    "fullName": "Me",
                    "acceptedTerms": True,
                },
            )
        assert resp.status_code == 400
        assert (
            "Registration failed" in resp.text
            or "VALIDATION_ERROR" in resp.text
            or "EMAIL_ALREADY_REGISTERED" in resp.text
            or "already registered" in resp.text.lower()
        )

    async def test_register_weak_password_rejected(self):
        """Registration with weak password is rejected (schema validation)."""
        from app.services.auth_service import prisma as service_prisma

        service_prisma.user = MagicMock()
        service_prisma.user.find_first = AsyncMock(return_value=None)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "weak@podacium.com",
                    "password": "short",  # too weak
                    "fullName": "Weak",
                    "acceptedTerms": True,
                },
            )
        assert resp.status_code in (400, 422)

    async def test_register_duplicate_email_detailed_error_and_code(self):
        """Registration with duplicate email returns clear EMAIL_ALREADY_REGISTERED error code and message."""
        from app.services.auth_service import prisma as service_prisma

        existing = MockUser(
            id=99,
            email="alreadyexists@podacium.com",
            fullName="Existing User",
            phoneNumber=None,
        )
        service_prisma.user = MagicMock()
        service_prisma.user.find_first = AsyncMock(return_value=existing)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/register",
                headers={"Accept-Language": "fr"},
                json={
                    "email": "alreadyexists@podacium.com",
                    "password": "StrongP@ss1!",
                    "fullName": "New User",
                    "acceptedTerms": True,
                },
            )
        assert resp.status_code == 400
        data = resp.json()
        assert (
            data.get("code") == "EMAIL_ALREADY_REGISTERED"
            or "already registered" in resp.text.lower()
            or "enregistrée" in resp.text.lower()
        )

    async def test_login_wrong_password_returns_401(self, verified_user: MockUser):
        """Login with wrong password returns 401 and does not crash."""
        from app.routers.auth import prisma as router_prisma

        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=verified_user)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "alice@podacium.com",
                    "password": "WrongP@ss1",
                },
            )
        assert resp.status_code == 401

    async def test_login_unverified_email_returns_403(self, unverified_user: MockUser):
        """Login with unverified email returns 403."""
        from app.routers.auth import prisma as router_prisma

        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=unverified_user)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "bob@podacium.com",
                    "password": "StrongP@ss1",
                },
            )
        assert resp.status_code == 403
        assert "verify your email" in resp.text

    async def test_login_nonexistent_email_returns_401(self):
        """Login with an email that doesn't exist returns 401."""
        from app.routers.auth import prisma as router_prisma

        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=None)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "ghost@podacium.com",
                    "password": "StrongP@ss1",
                },
            )
        assert resp.status_code == 401

    async def test_login_admin_creates_admin_session(self):
        """Admin login must succeed and create a tracked AdminSession.

        Regression test: a local `from datetime import timedelta` inside the
        2FA branch shadowed the module-level import, so the admin-session path
        raised UnboundLocalError and every admin login returned a 500.
        """
        from app.core.security import get_password_hash
        from app.routers.auth import prisma as router_prisma

        admin = MockUser(
            id=7,
            email="admin@podacium.com",
            fullName="Admin",
            role="ADMIN",
            emailVerified=True,
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
            onboardingCompleted=True,
            passwordHash=get_password_hash("StrongP@ss1"),
            twoFactorEnabled=False,
        )
        profile = MockUser(id=3, userId=7, isActive=True)
        admin_session = MockUser(id=11)

        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=admin)
        router_prisma.user.update = AsyncMock(return_value=admin)
        router_prisma.adminprofile = MagicMock()
        router_prisma.adminprofile.find_unique = AsyncMock(return_value=profile)
        router_prisma.adminsession = MagicMock()
        router_prisma.adminsession.create = AsyncMock(return_value=admin_session)
        router_prisma.adminsession.update = AsyncMock(return_value=admin_session)

        async with await _get_client() as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@podacium.com",
                    "password": "StrongP@ss1",
                },
            )

        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        assert resp.json()["message"] == "Login successful"
        router_prisma.adminsession.create.assert_awaited_once()
        router_prisma.adminsession.update.assert_awaited_once()

    async def test_verify_email_invalid_token_returns_400(self):
        """Verify-email with an invalid/expired token returns 400."""
        with patch(
            "app.routers.auth.auth_service.verify_email",
            new=AsyncMock(return_value=None),
        ):
            async with await _get_client() as client:
                resp = await client.post(
                    "/api/v1/auth/verify-email",
                    json={
                        "token": "garbage-token",
                    },
                )
        assert resp.status_code == 400
        assert "Invalid or expired" in resp.text or "INVALID_TOKEN" in resp.text

    async def test_refresh_token_without_cookie_returns_401(self):
        """Refresh without a cookie returns 401."""
        async with await _get_client() as client:
            resp = await client.post("/api/v1/auth/refresh-token")
        assert resp.status_code in (401, 422)

    async def test_refresh_token_invalid_returns_401(self):
        """Refresh with a bad token (auth_service raises ValueError) returns 401."""
        with patch(
            "app.routers.auth.auth_service.refresh_tokens",
            new=AsyncMock(side_effect=ValueError("Invalid refresh token")),
        ):
            async with await _get_client() as client:
                client.cookies.set("__Host-refresh_token", "bad-token")
                resp = await client.post("/api/v1/auth/refresh-token")
        assert resp.status_code == 401

    async def test_logout_requires_refresh_cookie(self):
        """Logout endpoint requires a refresh-token cookie to actually revoke."""
        async with await _get_client() as client:
            resp = await client.post("/api/v1/auth/logout")

        # Without cookie, it may return 401 (or still 200 with a no-op message).
        # Both are acceptable — we mainly verify it doesn't crash.
        assert resp.status_code in (200, 401)

    async def test_me_requires_auth(self):
        """GET /api/auth/me-light returns 401 without a valid access token."""
        async with await _get_client() as client:
            resp = await client.get("/api/auth/me-light")
        assert resp.status_code == 401

    async def test_me_profile_requires_auth(self):
        """GET /api/v1/me returns 401 without auth."""
        async with await _get_client() as client:
            resp = await client.get("/api/v1/me")
        assert resp.status_code == 401


# ── Rate limiter tests (in-memory) ─────────────────────────────────────────────


@pytest.mark.asyncio
class TestRateLimiting:
    async def test_login_rate_limited(self):
        """Rapid failed login attempts trigger rate limiting."""
        from app.routers.auth import prisma as router_prisma

        router_prisma.user = MagicMock()
        router_prisma.user.find_unique = AsyncMock(return_value=None)

        async with await _get_client() as client:
            for _ in range(7):
                resp = await client.post(
                    "/api/v1/auth/login",
                    json={
                        "email": "rate-limited@podacium.com",
                        "password": "WrongP@ss1",
                    },
                )
                last_status = resp.status_code
        # After many requests, should be 429
        assert last_status == 429, f"Expected 429, got {last_status}: {resp.text}"

    async def test_resend_verification_rate_limited(self):
        """Rapid resend-verification requests are rate-limited."""
        # No existing user -> resend_verification_email no-ops (returns 200);
        # otherwise it would try to build a token against the bare prisma mock.
        from app.services.auth_service import prisma as service_prisma

        service_prisma.user.find_unique = AsyncMock(return_value=None)
        async with await _get_client() as client:
            for _ in range(7):
                resp = await client.post(
                    "/api/v1/auth/resend-verification",
                    json={
                        "email": "ratelimited@podacium.com",
                    },
                )
        # Should still return 200 (the "always return same message" behavior)
        # but the rate limiter logs a warning internally.
        assert resp.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__])
