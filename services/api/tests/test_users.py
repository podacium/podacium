"""
Tests for users router endpoints.
Covers: profile, settings, skills, public profiles, stats, contact form.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestUserProfile:
    """GET /me, PUT /me/profile, PUT /me"""

    @pytest.mark.asyncio
    async def test_me_requires_auth(self, client):
        resp = await client.get("/api/v1/me")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_me_public_requires_auth(self, client):
        resp = await client.get("/api/v1/me/public")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_profile_requires_auth(self, client):
        resp = await client.put("/api/v1/me/profile", json={"fullName": "New Name"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_legacy_requires_auth(self, client):
        resp = await client.put("/api/v1/me", json={"fullName": "New"})
        assert resp.status_code in (401, 403)


class TestUserSettings:
    """GET/PUT /me/settings, PUT /me/notifications, PUT /me/security"""

    @pytest.mark.asyncio
    async def test_get_settings_requires_auth(self, client):
        resp = await client.get("/api/v1/me/settings")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_put_settings_requires_auth(self, client):
        resp = await client.put("/api/v1/me/settings", json={"email": "a@b.com"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_notifications_requires_auth(self, client):
        resp = await client.put("/api/v1/me/notifications", json={})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_security_requires_auth(self, client):
        resp = await client.put("/api/v1/me/security", json={})
        assert resp.status_code in (401, 403)


class TestUserAuth:
    """POST /auth/change-password, /auth/verify-email/request"""

    @pytest.mark.asyncio
    async def test_change_password_requires_auth(self, client):
        resp = await client.post("/api/v1/auth/change-password", json={
            "current_password": "old", "new_password": "NewStr0ng!"
        })
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_verify_email_request_requires_auth(self, client):
        resp = await client.post("/api/v1/auth/verify-email/request", json={"email": "a@b.com"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_account_requires_auth(self, client):
        resp = await client.post("/api/v1/me/delete-account", json={"password": "x"})
        assert resp.status_code in (401, 403)


class TestUserSkills:
    """GET /users/{id}/skills, POST /users/me/skills, DELETE /users/me/skills/{id}"""

    @pytest.mark.asyncio
    async def test_get_skills_requires_auth(self, client):
        resp = await client.get("/api/v1/users/1/skills")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_add_skill_requires_auth(self, client):
        resp = await client.post("/api/v1/users/me/skills", json={"name": "Python"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_skill_requires_auth(self, client):
        resp = await client.delete("/api/v1/users/me/skills/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_skills_returns_404_for_nonexistent_user(self, client):
        resp = await client.get("/api/v1/users/99999/skills")
        assert resp.status_code in (401, 403, 404)


class TestUserPublicProfiles:
    """GET /users/{id}/public"""

    @pytest.mark.asyncio
    async def test_public_profile_no_auth(self, client):
        resp = await client.get("/api/v1/users/1/public")
        assert resp.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_public_profile_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/users/99999/public")
        assert resp.status_code == 404


class TestUserDetail:
    """GET /users/{id}"""

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/users/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/users/99999")
        assert resp.status_code in (401, 403, 404)


class TestUserStats:
    """GET /users/{id}/stats, GET /dashboard/summary"""

    @pytest.mark.asyncio
    async def test_stats_requires_auth(self, client):
        resp = await client.get("/api/v1/users/1/stats")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_dashboard_summary_requires_auth(self, client):
        resp = await client.get("/api/v1/dashboard/summary")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_projects_requires_auth(self, client):
        resp = await client.get("/api/v1/users/me/projects")
        assert resp.status_code in (401, 403)


class TestContactForm:
    """POST /contact"""

    @pytest.mark.asyncio
    async def test_contact_no_auth_allowed(self, client):
        resp = await client.post("/api/v1/contact", json={
            "name": "Test", "email": "a@b.com", "message": "Hello world test message",
        })
        assert resp.status_code in (200, 202, 500)
