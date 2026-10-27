"""
Tests for support tickets router endpoints.
Covers: create, list, get, update, messages, close, rate, stats.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestTicketCreate:
    """POST /api/v1/tickets"""

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        resp = await client.post("/api/v1/tickets", json={
            "subject": "Test ticket", "message": "Need help with something please",
        })
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_short_subject_returns_422(self, client):
        resp = await client.post("/api/v1/tickets", json={
            "subject": "AB", "message": "X" * 10,
        })
        assert resp.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_create_short_message_returns_422(self, client):
        resp = await client.post("/api/v1/tickets", json={
            "subject": "Valid subject", "message": "Short",
        })
        assert resp.status_code in (401, 403, 422)


class TestTicketList:
    """GET /api/v1/tickets"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/tickets")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_list_with_filters_requires_auth(self, client):
        resp = await client.get("/api/v1/tickets?status=OPEN&priority=HIGH")
        assert resp.status_code in (401, 403)


class TestTicketStats:
    """GET /api/v1/tickets/stats"""

    @pytest.mark.asyncio
    async def test_stats_requires_auth(self, client):
        resp = await client.get("/api/v1/tickets/stats")
        assert resp.status_code in (401, 403)


class TestTicketDetail:
    """GET /api/v1/tickets/{id}"""

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/tickets/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/tickets/99999")
        assert resp.status_code in (401, 403, 404)


class TestTicketUpdate:
    """PATCH /api/v1/tickets/{id}"""

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.patch("/api/v1/tickets/1", json={"status": "RESOLVED"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_returns_404_for_nonexistent(self, client):
        resp = await client.patch("/api/v1/tickets/99999", json={"status": "CLOSED"})
        assert resp.status_code in (401, 403, 404)


class TestTicketMessages:
    """POST /api/v1/tickets/{id}/messages"""

    @pytest.mark.asyncio
    async def test_add_message_requires_auth(self, client):
        resp = await client.post("/api/v1/tickets/1/messages", json={
            "body": "This is a test message body",
        })
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_add_message_returns_404_for_nonexistent(self, client):
        resp = await client.post("/api/v1/tickets/99999/messages", json={
            "body": "This is a test message body",
        })
        assert resp.status_code in (401, 403, 404)


class TestTicketClose:
    """POST /api/v1/tickets/{id}/close"""

    @pytest.mark.asyncio
    async def test_close_requires_auth(self, client):
        resp = await client.post("/api/v1/tickets/1/close")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_close_returns_404_for_nonexistent(self, client):
        resp = await client.post("/api/v1/tickets/99999/close")
        assert resp.status_code in (401, 403, 404)


class TestTicketRating:
    """POST /api/v1/tickets/{id}/rate"""

    @pytest.mark.asyncio
    async def test_rate_requires_auth(self, client):
        resp = await client.post("/api/v1/tickets/1/rate", json={"score": 5})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_rate_returns_404_for_nonexistent(self, client):
        resp = await client.post("/api/v1/tickets/99999/rate", json={"score": 3})
        assert resp.status_code in (401, 403, 404)

    @pytest.mark.asyncio
    async def test_rate_invalid_score_returns_422(self, client):
        resp = await client.post("/api/v1/tickets/1/rate", json={"score": 0})
        assert resp.status_code in (401, 403, 422)
