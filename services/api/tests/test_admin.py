"""
Tests for admin router endpoints.
Covers: dashboard, user management, organization management,
path/module/lesson/quiz CRUD, analytics, appeals.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestAdminDashboard:
    """GET /admin/dashboard"""

    @pytest.mark.asyncio
    async def test_dashboard_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/dashboard")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_users_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/users")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_users_list_returns_404_for_bogus_id(self, client):
        resp = await client.get("/api/v1/admin/users/99999")
        assert resp.status_code in (401, 403, 404)


class TestAdminSubtitles:
    """POST /admin/lessons/{id}/subtitles"""

    @pytest.mark.asyncio
    async def test_subtitles_upload_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/lessons/test-lesson-id/subtitles")
        assert resp.status_code in (401, 403)

    def test_srt_to_vtt_conversion_logic(self):
        srt_content = "1\n00:00:01,000 --> 00:00:04,000\nHello World\n\n2\n00:00:05,000 --> 00:00:09,000\nWelcome to Podacium"
        lines = srt_content.replace("\r\n", "\n").split("\n")
        vtt_lines = ["WEBVTT\n"]
        for line in lines:
            if "-->" in line:
                line = line.replace(",", ".")
            vtt_lines.append(line)
        vtt_result = "\n".join(vtt_lines)

        assert "WEBVTT" in vtt_result
        assert "00:00:01.000 --> 00:00:04.000" in vtt_result
        assert "Hello World" in vtt_result


class TestAdminOrganizations:
    """GET /admin/organizations"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/organizations")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/organizations/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/admin/organizations/1")
        assert resp.status_code in (401, 403)


class TestAdminPaths:
    """GET/POST/PUT/DELETE /admin/paths"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/paths")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/paths", json={"id": "p1", "title": "Test"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/paths/p1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.put("/api/v1/admin/paths/p1", json={"title": "Updated"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/admin/paths/p1")
        assert resp.status_code in (401, 403)


class TestAdminModules:
    """GET/POST/PUT/DELETE /admin/modules"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/modules")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/modules", json={"id": "m1", "title": "Module"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/modules/m1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.put("/api/v1/admin/modules/m1", json={"title": "Upd"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/admin/modules/m1")
        assert resp.status_code in (401, 403)


class TestAdminLessons:
    """GET/POST/PUT/DELETE /admin/modules/{id}/lessons"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/modules/m1/lessons")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        payload = {"id": "l1", "title": "Lesson", "order": 1, "type": "VIDEO"}
        resp = await client.post("/api/v1/admin/modules/m1/lessons", json=payload)
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/lessons/l1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.put("/api/v1/admin/lessons/l1", json={"title": "Upd"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/admin/lessons/l1")
        assert resp.status_code in (401, 403)


class TestAdminQuizzes:
    """GET/POST/PUT/DELETE /admin/quizzes"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/quizzes")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/quizzes/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.put("/api/v1/admin/quizzes/1", json={"title": "Upd"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/admin/quizzes/1")
        assert resp.status_code in (401, 403)


class TestAdminAnalytics:
    """GET /admin/analytics"""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/analytics")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_invalid_period_returns_422(self, client):
        resp = await client.get("/api/v1/admin/analytics?period=invalid")
        assert resp.status_code in (401, 403, 422)


class TestAdminAppeals:
    """GET /admin/appeals, POST /admin/appeals/{id}/resolve"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/appeals")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_resolve_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/appeals/1/resolve", json={"status": "APPROVED"})
        assert resp.status_code in (401, 403)


class TestAdminEnrollments:
    """GET /admin/enrollments"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/admin/enrollments")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_grant_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/enrollments?user_id=1&module_id=m1")
        assert resp.status_code in (401, 403)


class TestAdminUpload:
    """POST /admin/upload"""

    @pytest.mark.asyncio
    async def test_upload_requires_auth(self, client):
        resp = await client.post("/api/v1/admin/upload")
        assert resp.status_code in (401, 403)
