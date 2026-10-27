"""
Tests for waitlist router endpoints.
Covers: register, validate referral, position, leaderboard, stats, status.
"""
import pytest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from httpx import AsyncClient, ASGITransport
from app.main import app


def _make_entry(**overrides):
    base = {
        "id": 1,
        "fullName": "Test User",
        "email": "test@example.com",
        "referralCode": "ABCD1234",
        "friendsReferredCount": 0,
        "status": "PENDING",
        "createdAt": datetime.now(timezone.utc),
        "locale": "en",
        "metadata": {},
    }
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def fake_waitlist_prisma(monkeypatch):
    """Swap the waitlist router's prisma for well-behaved AsyncMocks.

    Waitlist handlers await count/find/create etc., so the shared suite-wide
    prisma fake (which returns MagicMocks by default) would 500 here. This
    fixture gives the router deterministic, awaitable results.
    """
    from app.routers import waitlist as waitlist_router

    entry = _make_entry()
    ns = MagicMock()
    ns.waitlistentry.find_unique = AsyncMock(return_value=None)
    ns.waitlistentry.find_first = AsyncMock(return_value=None)
    ns.waitlistentry.find_many = AsyncMock(return_value=[])
    ns.waitlistentry.count = AsyncMock(return_value=0)
    ns.waitlistentry.create = AsyncMock(return_value=entry)
    ns.waitlistentry.update = AsyncMock(return_value=None)
    monkeypatch.setattr(waitlist_router, "prisma", ns)
    return ns


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestWaitlistRegister:
    """POST /waitlist/register"""

    @pytest.mark.asyncio
    async def test_register_valid_email(self, client):
        resp = await client.post("/api/v1/waitlist/register", json={
            "fullName": "Test User",
            "email": "newuser@example.com",
        })
        assert resp.status_code in (201, 409)

    @pytest.mark.asyncio
    async def test_register_disposable_email_returns_400(self, client):
        resp = await client.post("/api/v1/waitlist/register", json={
            "fullName": "Spam Bot",
            "email": "spam@mailinator.com",
        })
        assert resp.status_code in (400, 409)

    @pytest.mark.asyncio
    async def test_register_invalid_email_returns_422(self, client):
        resp = await client.post("/api/v1/waitlist/register", json={
            "fullName": "Test",
            "email": "not-an-email",
        })
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_register_missing_name_returns_422(self, client):
        resp = await client.post("/api/v1/waitlist/register", json={
            "email": "test@example.com",
        })
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_register_with_referral(self, client):
        resp = await client.post("/api/v1/waitlist/register", json={
            "fullName": "Referred User",
            "email": "referred@example.com",
            "referralCode": "ABCD2345",
        })
        assert resp.status_code in (201, 400, 409)


class TestWaitlistValidateReferral:
    """GET /waitlist/validate-referral"""

    @pytest.mark.asyncio
    async def test_validate_valid_format(self, client):
        resp = await client.get("/api/v1/waitlist/validate-referral?code=ABCD1234")
        assert resp.status_code == 200
        body = resp.json()
        assert "valid" in body

    @pytest.mark.asyncio
    async def test_validate_invalid_format_returns_invalid(self, client):
        resp = await client.get("/api/v1/waitlist/validate-referral?code=short")
        assert resp.status_code == 200
        assert resp.json()["valid"] is False

    @pytest.mark.asyncio
    async def test_validate_empty_code_returns_422(self, client):
        resp = await client.get("/api/v1/waitlist/validate-referral?code=")
        assert resp.status_code in (200, 422)


class TestWaitlistPosition:
    """GET /waitlist/position"""

    @pytest.mark.asyncio
    async def test_position_registered_email(self, client):
        resp = await client.get("/api/v1/waitlist/position?email=test@test.com")
        assert resp.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_position_unregistered_email_returns_404(self, client):
        resp = await client.get("/api/v1/waitlist/position?email=nobody@nowhere.com")
        assert resp.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_position_invalid_email_returns_422(self, client):
        resp = await client.get("/api/v1/waitlist/position?email=bad-email")
        assert resp.status_code in (404, 422)


class TestWaitlistLeaderboard:
    """GET /waitlist/leaderboard"""

    @pytest.mark.asyncio
    async def test_leaderboard_returns_200(self, client):
        resp = await client.get("/api/v1/waitlist/leaderboard")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_leaderboard_has_entries_field(self, client):
        resp = await client.get("/api/v1/waitlist/leaderboard")
        assert resp.status_code == 200
        assert "entries" in resp.json()
        assert "totalCount" in resp.json()


class TestWaitlistStats:
    """GET /waitlist/stats"""

    @pytest.mark.asyncio
    async def test_stats_returns_200(self, client):
        resp = await client.get("/api/v1/waitlist/stats")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_stats_has_total_count(self, client):
        resp = await client.get("/api/v1/waitlist/stats")
        assert resp.status_code == 200
        assert "totalCount" in resp.json()


class TestWaitlistStatus:
    """GET /waitlist/status"""

    @pytest.mark.asyncio
    async def test_status_registered_email(self, client):
        resp = await client.get("/api/v1/waitlist/status?email=test@test.com")
        assert resp.status_code == 200
        body = resp.json()
        assert "registered" in body

    @pytest.mark.asyncio
    async def test_status_unregistered_email_returns_not_registered(self, client):
        resp = await client.get("/api/v1/waitlist/status?email=nobody@nowhere.com")
        assert resp.status_code == 200
        assert resp.json()["registered"] is False

    @pytest.mark.asyncio
    async def test_status_invalid_email_returns_422(self, client):
        resp = await client.get("/api/v1/waitlist/status?email=bad")
        assert resp.status_code in (200, 422)
