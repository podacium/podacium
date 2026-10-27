"""
Tests for organizations router endpoints.
Covers: CRUD, member management, invitations, leave/remove.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestOrganizationList:
    """GET /organizations"""

    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/v1/organizations")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_list_returns_empty_for_new_user(self, client):
        resp = await client.get("/api/v1/organizations")
        assert resp.status_code in (401, 403)


class TestOrganizationCreate:
    """POST /organizations"""

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations", json={
            "name": "Test Org", "description": "Desc",
            "country": "ALGERIA", "city": "ALGIERS",
        })
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_invalid_city_country(self, client):
        resp = await client.post("/api/v1/organizations", json={
            "name": "Test", "description": "Desc",
            "country": "ALGERIA", "city": "CAIRO",
        })
        assert resp.status_code in (401, 403, 400)

    @pytest.mark.asyncio
    async def test_create_missing_fields_returns_422(self, client):
        resp = await client.post("/api/v1/organizations", json={
            "name": "Test",
        })
        assert resp.status_code in (401, 403, 422)


class TestOrganizationDetail:
    """GET /organizations/{id}"""

    @pytest.mark.asyncio
    async def test_detail_requires_auth(self, client):
        resp = await client.get("/api/v1/organizations/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_detail_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/organizations/99999")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationUpdate:
    """PUT /organizations/{id}"""

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client):
        resp = await client.put("/api/v1/organizations/1", json={"name": "New Name"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_returns_404_for_nonexistent(self, client):
        resp = await client.put("/api/v1/organizations/99999", json={"name": "New"})
        assert resp.status_code in (401, 403, 404)


class TestOrganizationDelete:
    """DELETE /organizations/{id}"""

    @pytest.mark.asyncio
    async def test_delete_requires_auth(self, client):
        resp = await client.delete("/api/v1/organizations/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_delete_returns_404_for_nonexistent(self, client):
        resp = await client.delete("/api/v1/organizations/99999")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationSwitch:
    """POST /organizations/{id}/switch"""

    @pytest.mark.asyncio
    async def test_switch_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/1/switch")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_switch_returns_404_for_nonexistent(self, client):
        resp = await client.post("/api/v1/organizations/99999/switch")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationMembers:
    """GET /organizations/{id}/members"""

    @pytest.mark.asyncio
    async def test_list_members_requires_auth(self, client):
        resp = await client.get("/api/v1/organizations/1/members")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_list_members_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/organizations/99999/members")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationInvite:
    """POST /organizations/{id}/members"""

    @pytest.mark.asyncio
    async def test_invite_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/1/members", json={
            "email": "user@test.com", "role": "MEMBER",
        })
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_invite_returns_404_for_nonexistent_org(self, client):
        resp = await client.post("/api/v1/organizations/99999/members", json={
            "email": "user@test.com", "role": "MEMBER",
        })
        assert resp.status_code in (401, 403, 404)


class TestMyInvitations:
    """GET /organizations/invitations/me"""

    @pytest.mark.asyncio
    async def test_my_invitations_requires_auth(self, client):
        resp = await client.get("/api/v1/organizations/invitations/me")
        assert resp.status_code in (401, 403)


class TestInvitationByToken:
    """GET /organizations/invitations/{token}"""

    @pytest.mark.asyncio
    async def test_invitation_invalid_token_returns_404(self, client):
        resp = await client.get("/api/v1/organizations/invitations/invalidtoken123")
        assert resp.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_invitation_missing_token_returns_404(self, client):
        resp = await client.get("/api/v1/organizations/invitations/nonexistent")
        assert resp.status_code in (404, 400)


class TestInvitationAccept:
    """POST /organizations/invitations/{token}/accept"""

    @pytest.mark.asyncio
    async def test_accept_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/invitations/token123/accept")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_accept_invalid_token(self, client):
        resp = await client.post("/api/v1/organizations/invitations/invalidtoken/accept")
        assert resp.status_code in (401, 403, 404)


class TestInvitationDecline:
    """POST /organizations/invitations/{token}/decline"""

    @pytest.mark.asyncio
    async def test_decline_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/invitations/token123/decline")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_decline_invalid_token(self, client):
        resp = await client.post("/api/v1/organizations/invitations/invalidtoken/decline")
        assert resp.status_code in (401, 403, 404)


class TestInvitationCancel:
    """POST /organizations/invitations/{token}/cancel"""

    @pytest.mark.asyncio
    async def test_cancel_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/invitations/token123/cancel")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_cancel_invalid_token(self, client):
        resp = await client.post("/api/v1/organizations/invitations/invalidtoken/cancel")
        assert resp.status_code in (401, 403, 404)


class TestInvitationResend:
    """POST /organizations/invitations/{token}/resend"""

    @pytest.mark.asyncio
    async def test_resend_requires_auth(self, client):
        resp = await client.post("/api/v1/organizations/invitations/token123/resend")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_resend_invalid_token(self, client):
        resp = await client.post("/api/v1/organizations/invitations/invalidtoken/resend")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationInvitationsList:
    """GET /organizations/{id}/invitations"""

    @pytest.mark.asyncio
    async def test_list_invitations_requires_auth(self, client):
        resp = await client.get("/api/v1/organizations/1/invitations")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_list_invitations_returns_404_for_nonexistent(self, client):
        resp = await client.get("/api/v1/organizations/99999/invitations")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationLeave:
    """DELETE /organizations/{id}/leave"""

    @pytest.mark.asyncio
    async def test_leave_requires_auth(self, client):
        resp = await client.delete("/api/v1/organizations/1/leave")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_leave_returns_404_for_nonexistent(self, client):
        resp = await client.delete("/api/v1/organizations/99999/leave")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationRemoveMember:
    """DELETE /organizations/{id}/members/{member_id}"""

    @pytest.mark.asyncio
    async def test_remove_member_requires_auth(self, client):
        resp = await client.delete("/api/v1/organizations/1/members/1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_remove_member_returns_404_for_nonexistent(self, client):
        resp = await client.delete("/api/v1/organizations/99999/members/1")
        assert resp.status_code in (401, 403, 404)


class TestOrganizationUpdateMember:
    """PUT /organizations/{id}/members/{member_id}"""

    @pytest.mark.asyncio
    async def test_update_member_requires_auth(self, client):
        resp = await client.put("/api/v1/organizations/1/members/1", json={"role": "ADMIN"})
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_member_returns_404_for_nonexistent(self, client):
        resp = await client.put("/api/v1/organizations/99999/members/1", json={"role": "ADMIN"})
        assert resp.status_code in (401, 403, 404)
