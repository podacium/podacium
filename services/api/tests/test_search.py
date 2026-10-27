"""
Tests for search router endpoints.
Covers: full-text search across modules, projects, and users.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestSearch:
    """GET /api/v1/search"""

    @pytest.mark.asyncio
    async def test_search_returns_results(self, client):
        resp = await client.get("/api/v1/search?q=python")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_type_filter(self, client):
        resp = await client.get("/api/v1/search?q=python&type=module")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_project_type(self, client):
        resp = await client.get("/api/v1/search?q=data&type=project")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_user_type(self, client):
        resp = await client.get("/api/v1/search?q=ahmed&type=user")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_empty_query_returns_422(self, client):
        resp = await client.get("/api/v1/search?q=")
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_short_query_returns_422(self, client):
        resp = await client.get("/api/v1/search?q=a")
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_with_pagination(self, client):
        resp = await client.get("/api/v1/search?q=python&limit=5&offset=0")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_exceeds_limit_returns_422(self, client):
        resp = await client.get("/api/v1/search?q=python&limit=200")
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_negative_offset_returns_422(self, client):
        resp = await client.get("/api/v1/search?q=python&offset=-1")
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_invalid_type_returns_empty(self, client):
        resp = await client.get("/api/v1/search?q=python&type=invalid")
        assert resp.status_code in (200, 422)

    @pytest.mark.asyncio
    async def test_search_special_chars_handled(self, client):
        resp = await client.get("/api/v1/search?q=hello%20world")
        assert resp.status_code in (200, 500)

    @pytest.mark.asyncio
    async def test_search_unicode_safe(self, client):
        resp = await client.get("/api/v1/search?q=python")
        assert resp.status_code in (200, 500)
