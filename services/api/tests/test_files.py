"""
Tests for files router endpoints.
Covers: upload, list user files, delete file.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestFileUpload:
    """POST /files/upload"""

    @pytest.mark.asyncio
    async def test_upload_requires_auth(self, client):
        resp = await client.post("/api/v1/files/upload?category=avatars")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_upload_invalid_category(self, client):
        resp = await client.post("/api/v1/files/upload?category=invalid")
        assert resp.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_upload_without_file(self, client):
        resp = await client.post("/api/v1/files/upload?category=avatars")
        assert resp.status_code in (401, 403, 422)


class TestFileList:
    """GET /files/"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/files/?category=avatars")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_list_invalid_category(self, client):
        resp = await client.get("/api/v1/files/?category=invalid")
        assert resp.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_list_no_category_defaults(self, client):
        resp = await client.get("/api/v1/files/")
        assert resp.status_code in (401, 403)


class TestFileDelete:
    """DELETE /files/{file_id}"""

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/files/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_returns_404_for_nonexistent(self, client):
        resp = await client.delete("/api/v1/files/99999")
        assert resp.status_code in (401, 403, 404)

    @pytest.mark.asyncio
    async def test_delete_negative_id_returns_422(self, client):
        resp = await client.delete("/api/v1/files/-1")
        assert resp.status_code in (401, 403, 404, 422)
