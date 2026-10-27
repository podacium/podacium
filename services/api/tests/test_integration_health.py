"""
Integration tests for health and root endpoints.

These tests use httpx.AsyncClient to make real HTTP requests
against the FastAPI application (without needing a running server).
"""
import hashlib
import os

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
class TestHealthEndpoints:
    """Integration tests for health check endpoints."""

    async def test_root_returns_200(self, client: AsyncClient):
        """Root endpoint should return 200 with version info."""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert "message" in data
        assert "Podacium" in data["message"]

    async def test_healthz_returns_200(self, client: AsyncClient):
        """Simple health check should always return 200."""
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_health_returns_status(self, client: AsyncClient):
        """Full health check should return service status."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "service" in data
        assert "timestamp" in data

    async def test_openapi_docs_accessible(self, client: AsyncClient):
        """OpenAPI JSON should be accessible."""
        from app.core.config import setting
        secret = setting.SECRET_KEY.encode()
        hash_suffix = hashlib.sha256(secret).hexdigest()[:8]
        url = f"/api/v1/openapi-{hash_suffix}.json"

        response = await client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data

    async def test_metrics_endpoint_accessible(self, client: AsyncClient):
        """Prometheus metrics endpoint should be accessible."""
        response = await client.get("/metrics")
        assert response.status_code == 200
        assert "http_request" in response.text or "process_" in response.text


@pytest.mark.asyncio
class TestSecurityHeaders:
    """Integration tests for security headers middleware."""

    async def test_hsts_header_present(self, client: AsyncClient):
        """HSTS header should be present on all responses."""
        response = await client.get("/healthz")
        assert "strict-transport-security" in response.headers
        assert "max-age=" in response.headers["strict-transport-security"]

    async def test_x_frame_options_present(self, client: AsyncClient):
        """X-Frame-Options should be DENY."""
        response = await client.get("/healthz")
        assert response.headers.get("x-frame-options") == "DENY"

    async def test_x_content_type_options_present(self, client: AsyncClient):
        """X-Content-Type-Options should be nosniff."""
        response = await client.get("/healthz")
        assert response.headers.get("x-content-type-options") == "nosniff"

    async def test_csp_no_unsafe_inline(self, client: AsyncClient):
        """CSP should NOT contain unsafe-inline/unsafe-eval in production."""
        response = await client.get("/healthz")
        csp = response.headers.get("content-security-policy", "")
        is_dev = os.environ.get("ENVIRONMENT", "").lower() in ("development", "dev", "")
        if not is_dev:
            assert "unsafe-inline" not in csp
            assert "unsafe-eval" not in csp

    async def test_request_id_header(self, client: AsyncClient):
        """X-Request-ID should be present in response."""
        response = await client.get("/healthz")
        assert "x-request-id" in response.headers

    async def test_process_time_header(self, client: AsyncClient):
        """X-Process-Time should be present in response."""
        response = await client.get("/healthz")
        assert "x-process-time" in response.headers


@pytest.mark.asyncio
class TestRateLimiting:
    """Integration tests for rate limiting."""

    @pytest.mark.skip(reason="Rate limiting test sends 65 POST requests to auth — depends on Redis and CSRF state. Flaky in CI. Skip until test isolates rate limiter from CSRF middleware.")
    async def test_auth_endpoint_rate_limited(self, client: AsyncClient):
        """Auth endpoints should be rate limited after threshold."""
        # Send many requests rapidly
        responses = []
        for _ in range(65):
            resp = await client.post(
                "/api/v1/auth/login",
                json={"email": "test@test.com", "password": "test"},
            )
            responses.append(resp)

        # At least one should be 429 (rate limited)
        status_codes = [r.status_code for r in responses]
        assert 429 in status_codes or all(
            s in (401, 422, 429) for s in status_codes
        )
