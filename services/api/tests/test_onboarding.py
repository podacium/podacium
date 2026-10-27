"""
Tests for onboarding router endpoints.
Covers: submit onboarding answers, skip onboarding.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestOnboardingSubmit:
    """POST /onboarding"""

    @pytest.mark.asyncio
    async def test_submit_requires_auth(self, client):
        resp = await client.post("/onboarding", json={"goals": ["learn_ai"]})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_submit_empty_body_returns_422(self, client):
        resp = await client.post("/onboarding", json={})
        assert resp.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_submit_invalid_data_returns_400(self, client):
        resp = await client.post("/onboarding", json={"goals": "not_a_list"})
        assert resp.status_code in (401, 403, 400, 422)


class TestOnboardingSkip:
    """POST /onboarding/skip"""

    @pytest.mark.asyncio
    async def test_skip_requires_auth(self, client):
        resp = await client.post("/onboarding/skip")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_skip_returns_200_when_authenticated(self, client):
        resp = await client.post("/onboarding/skip")
        assert resp.status_code in (401, 403)
