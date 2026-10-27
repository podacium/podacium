"""
Integration tests for authentication endpoints.

Tests the full auth flow through the HTTP layer using httpx.AsyncClient.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    """Create an async HTTP client for integration testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
class TestAuthEndpoints:
    """Integration tests for auth endpoints."""

    async def test_login_with_invalid_credentials_returns_401(self, client: AsyncClient):
        """Login with wrong credentials should return 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@test.com", "password": "WrongPass123!"},
        )
        assert response.status_code in (401, 422)

    async def test_login_with_missing_fields_returns_422(self, client: AsyncClient):
        """Login with missing fields should return 422."""
        response = await client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422

    async def test_register_with_weak_password_rejected(self, client: AsyncClient):
        """Registration with weak password should be rejected."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "weak",
                "fullName": "Test User",
            },
        )
        # Should be rejected (400 or 422)
        assert response.status_code in (400, 422)

    async def test_check_email_availability(self, client: AsyncClient):
        """Check-email endpoint should return availability status."""
        response = await client.post(
            "/api/auth/check-email",
            json={"email": "random-nonexistent@test.podacium.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert data["available"] is True

    async def test_check_email_invalid_format_rejected(self, client: AsyncClient):
        """Check-email with invalid email format should be rejected."""
        response = await client.post(
            "/api/auth/check-email",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422

    async def test_me_light_requires_auth(self, client: AsyncClient):
        """me-light endpoint should require authentication."""
        response = await client.get("/api/auth/me-light")
        assert response.status_code == 401

    async def test_initial_data_requires_auth(self, client: AsyncClient):
        """initial-data endpoint should require authentication."""
        response = await client.get("/api/user/initial-data")
        assert response.status_code == 401

    async def test_refresh_token_without_cookie_fails(self, client: AsyncClient):
        """Refresh token without cookie should fail."""
        response = await client.post("/api/v1/auth/refresh-token")
        assert response.status_code in (401, 422)


@pytest.mark.asyncio
class TestProductionGuards:
    """Test production safety guards."""

    def test_payment_gateway_config_exists(self):
        """PAYMENT_GATEWAY should be configured."""
        from app.core.config import setting
        assert hasattr(setting, "PAYMENT_GATEWAY")
        assert setting.PAYMENT_GATEWAY in ("chargily", "satim", "cib", "edahabia", "mock")

    def test_jwt_algorithm_is_secure(self):
        """JWT algorithm should be HS256 or RS256."""
        from app.core.config import setting
        assert setting.JWT_ALGORITHM in ("HS256", "HS384", "HS512", "RS256", "RS384", "RS512")

    def test_access_token_expiry_reasonable(self):
        """Access token should expire within 60 minutes."""
        from app.core.config import setting
        assert setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES <= 60

    def test_refresh_token_expiry_reasonable(self):
        """Refresh token should expire within 30 days."""
        from app.core.config import setting
        assert setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS <= 30
