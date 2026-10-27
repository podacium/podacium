"""Tests for settings endpoints using a standalone FastAPI app."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

SECTION = "app.routers.settings"


def make_mock_user(**overrides):
    base = dict(id=1, email="test@podacium.com", role="STUDENT")
    base.update(overrides)
    obj = MagicMock(spec=[])
    for k, v in base.items():
        setattr(obj, k, v)
    return obj


def mock_prisma():
    mp = MagicMock()
    mp.user.update = AsyncMock()
    mp.user.find_unique = AsyncMock()
    mp.notificationpreferences.find_unique = AsyncMock()
    mp.notificationpreferences.upsert = AsyncMock()
    mp.userintegration.find_many = AsyncMock(return_value=[])
    mp.userintegration.create = AsyncMock()
    mp.userintegration.upsert = AsyncMock()
    mp.userintegration.delete_many = AsyncMock()
    mp.advancedsettings.find_unique = AsyncMock()
    mp.advancedsettings.upsert = AsyncMock()
    mp.dataexport.find_many = AsyncMock(return_value=[])
    mp.dataexport.create = AsyncMock(
        return_value=MagicMock(id=1, requestedAt=datetime.utcnow())
    )
    mp.accountdeletionrequest.create = AsyncMock()
    return mp


@pytest.fixture
def app_no_auth():
    from app.routers.settings import router

    test_app = FastAPI()
    test_app.include_router(router, prefix="/api/v1")
    return test_app


@pytest.fixture
def app_with_auth(app_no_auth):
    from app.core.auth import get_current_user

    app_no_auth.dependency_overrides[get_current_user] = lambda: make_mock_user()
    yield app_no_auth
    app_no_auth.dependency_overrides = {}


@pytest.fixture
def client(app_no_auth):
    transport = ASGITransport(app=app_no_auth)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def auth_client(app_with_auth):
    transport = ASGITransport(app=app_with_auth)
    return AsyncClient(transport=transport, base_url="http://test")


# ── Service-based endpoints ────────────────────────────────────


class TestAccountSettings:
    @pytest.mark.asyncio
    async def test_get_requires_auth(self, client):
        resp = await client.get("/api/v1/settings/account")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_account(self, auth_client):
        svc = AsyncMock()
        svc.get_account_settings.return_value = {
            "email": "test@podacium.com",
            "language": "en",
            "timezone": "UTC",
            "date_format": "MM/DD/YYYY",
            "time_format": "12h",
            "email_verified": True,
            "phone_verified": False,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.get("/api/v1/settings/account")
        assert resp.status_code == 200
        assert resp.json()["language"] == "en"

    @pytest.mark.asyncio
    async def test_get_404(self, auth_client):
        svc = AsyncMock()
        svc.get_account_settings.return_value = None
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.get("/api/v1/settings/account")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        svc = AsyncMock()
        svc.update_account_settings.return_value = {
            "email": "new@podacium.com",
            "language": "fr",
            "timezone": "Europe/Paris",
            "date_format": "DD/MM/YYYY",
            "time_format": "24h",
            "email_verified": True,
            "phone_verified": False,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.put(
                "/api/v1/settings/account",
                json={"email": "new@podacium.com", "language": "fr"},
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update_value_error(self, auth_client):
        svc = AsyncMock()
        svc.update_account_settings.side_effect = ValueError("Email already in use")
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.put(
                "/api/v1/settings/account", json={"email": "dup@podacium.com"}
            )
        assert resp.status_code == 400


class TestSecurity:
    @pytest.mark.asyncio
    async def test_get(self, auth_client):
        svc = AsyncMock()
        svc.get_security_settings.return_value = {
            "two_factor_enabled": False,
            "login_alerts": True,
            "device_management": True,
            "session_timeout": 24,
            "user_id": 1,
            "last_password_change": None,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.security_service", svc):
            resp = await auth_client.get("/api/v1/settings/security")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        svc = AsyncMock()
        svc.update_security_settings.return_value = {
            "two_factor_enabled": True,
            "login_alerts": True,
            "device_management": True,
            "session_timeout": 12,
            "user_id": 1,
            "last_password_change": None,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.security_service", svc):
            resp = await auth_client.put(
                "/api/v1/settings/security",
                json={"two_factor_enabled": True, "session_timeout": 12},
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password(self, auth_client):
        svc = AsyncMock()
        svc.change_password.return_value = {
            "message": "Password changed",
            "changed_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.security_service", svc):
            resp = await auth_client.post(
                "/api/v1/settings/security/change-password",
                json={
                    "currentPassword": "old",
                    "newPassword": "NewPass123!",
                    "confirmPassword": "NewPass123!",
                },
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_error(self, auth_client):
        svc = AsyncMock()
        svc.change_password.side_effect = ValueError("Incorrect password")
        with patch(f"{SECTION}.security_service", svc):
            resp = await auth_client.post(
                "/api/v1/settings/security/change-password",
                json={
                    "currentPassword": "wrong",
                    "newPassword": "NewPass123!",
                    "confirmPassword": "NewPass123!",
                },
            )
        assert resp.status_code == 400


class TestUsage:
    @pytest.mark.asyncio
    async def test_get(self, auth_client):
        svc = AsyncMock()
        svc.get_usage_metrics.return_value = {
            "metrics": {
                "storage": 100,
                "storage_limit": 1000,
                "bandwidth": 50,
                "bandwidth_limit": 5000,
                "projects": 3,
                "projects_limit": 10,
                "collaborators": 1,
                "collaborators_limit": 5,
            },
            "period_start": datetime(2025, 1, 1),
            "period_end": datetime(2025, 2, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.get("/api/v1/settings/usage")
        assert resp.status_code == 200


class TestAppearance:
    @pytest.mark.asyncio
    async def test_get(self, auth_client):
        svc = AsyncMock()
        svc.get_appearance_settings.return_value = {
            "theme": "dark",
            "reduced_motion": False,
            "high_contrast": False,
            "font_size": "medium",
            "density": "comfortable",
            "user_id": 1,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.get("/api/v1/settings/appearance")
        assert resp.status_code == 200
        assert resp.json()["theme"] == "dark"

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        svc = AsyncMock()
        svc.update_appearance_settings.return_value = {
            "theme": "light",
            "reduced_motion": True,
            "high_contrast": False,
            "font_size": "large",
            "density": "compact",
            "user_id": 1,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.put(
                "/api/v1/settings/appearance",
                json={"theme": "light", "font_size": "large"},
            )
        assert resp.status_code == 200


class TestPrivacy:
    @pytest.mark.asyncio
    async def test_get(self, auth_client):
        svc = AsyncMock()
        svc.get_privacy_settings.return_value = {
            "profile_visibility": "public",
            "search_visibility": True,
            "activity_status": True,
            "read_receipts": True,
            "show_bio": "inherit",
            "show_skills": "inherit",
            "show_email": False,
            "show_phone": False,
            "show_last_active": True,
            "user_id": 1,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.get("/api/v1/settings/privacy")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        svc = AsyncMock()
        svc.update_privacy_settings.return_value = {
            "profile_visibility": "private",
            "search_visibility": False,
            "activity_status": False,
            "read_receipts": False,
            "show_bio": "inherit",
            "show_skills": "inherit",
            "show_email": True,
            "show_phone": False,
            "show_last_active": False,
            "user_id": 1,
            "created_at": datetime(2025, 1, 1),
            "updated_at": datetime(2025, 1, 1),
        }
        with patch(f"{SECTION}.settings_service", svc):
            resp = await auth_client.put(
                "/api/v1/settings/privacy", json={"profile_visibility": "private"}
            )
        assert resp.status_code == 200


# ── Prisma-direct endpoints ──────────────────────────────────


class TestNotifications:
    @pytest.mark.asyncio
    async def test_get_defaults(self, auth_client):
        mp = mock_prisma()
        mp.notificationpreferences.find_unique.return_value = None
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/settings/notifications")
        assert resp.status_code == 200
        assert resp.json()["email_notifications"] is True

    @pytest.mark.asyncio
    async def test_get_existing(self, auth_client):
        mp = mock_prisma()
        prefs = MagicMock(
            spec=[
                "emailNotifications",
                "pushNotifications",
                "smsNotifications",
                "marketingEmails",
                "newsletter",
                "quietHoursStart",
                "quietHoursEnd",
                "digestFrequency",
            ]
        )
        prefs.emailNotifications = True
        prefs.pushNotifications = False
        prefs.smsNotifications = True
        prefs.marketingEmails = False
        prefs.newsletter = False
        prefs.quietHoursStart = None
        prefs.quietHoursEnd = None
        prefs.digestFrequency = "weekly"
        mp.notificationpreferences.find_unique.return_value = prefs
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/settings/notifications")
        assert resp.json()["digest"] == "weekly"

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        mp = mock_prisma()
        updated = MagicMock(
            spec=[
                "emailNotifications",
                "pushNotifications",
                "smsNotifications",
                "marketingEmails",
                "newsletter",
                "quietHoursStart",
                "quietHoursEnd",
                "digestFrequency",
            ]
        )
        updated.emailNotifications = False
        updated.pushNotifications = False
        updated.smsNotifications = False
        updated.marketingEmails = False
        updated.newsletter = False
        updated.quietHoursStart = None
        updated.quietHoursEnd = None
        updated.digestFrequency = "never"
        mp.notificationpreferences.upsert.return_value = updated
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.put(
                "/api/v1/settings/notifications",
                json={
                    "email_notifications": False,
                    "push_notifications": False,
                    "digest": "never",
                },
            )
        assert resp.json()["digest"] == "never"

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        assert (await client.get("/api/v1/settings/notifications")).status_code == 401


class TestBilling:
    @pytest.mark.asyncio
    async def test_get(self, auth_client):
        resp = await auth_client.get("/api/v1/settings/billing")
        assert resp.status_code == 200
        assert resp.json()["plan"] == "free"

    @pytest.mark.asyncio
    async def test_invoices(self, auth_client):
        resp = await auth_client.get("/api/v1/settings/billing/invoices")
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_add_payment(self, auth_client):
        mp = mock_prisma()
        mp.paymentmethod.count = AsyncMock(return_value=0)
        mp.paymentmethod.update_many = AsyncMock()
        mp.paymentmethod.create = AsyncMock(
            return_value=MagicMock(id="pm_123", isDefault=True)
        )
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.post(
                "/api/v1/settings/billing/payment-method", json={"token": "tok_xxx"}
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_payment(self, auth_client):
        mp = mock_prisma()
        mp.paymentmethod.find_first = AsyncMock(return_value=MagicMock(id=123))
        mp.paymentmethod.update = AsyncMock()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.delete(
                "/api/v1/settings/billing/payment-method/123"
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        assert (await client.get("/api/v1/settings/billing")).status_code == 401
        assert (
            await client.get("/api/v1/settings/billing/invoices")
        ).status_code == 401


class TestIntegrations:
    @pytest.mark.asyncio
    async def test_empty(self, auth_client):
        mp = mock_prisma()
        mp.userintegration.find_many.return_value = []
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/settings/integrations")
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_connect(self, auth_client):
        mp = mock_prisma()
        mp.userintegration.upsert.return_value = MagicMock()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.post("/api/v1/settings/integrations/github")
        assert resp.json()["status"] == "connected"

    @pytest.mark.asyncio
    async def test_disconnect(self, auth_client):
        mp = mock_prisma()
        mp.userintegration.delete_many.return_value = MagicMock()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.delete("/api/v1/settings/integrations/github")
        assert resp.json()["status"] == "disconnected"


class TestAdvanced:
    @pytest.mark.asyncio
    async def test_get_defaults(self, auth_client):
        mp = mock_prisma()
        mp.advancedsettings.find_unique.return_value = None
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/settings/advanced")
        assert resp.json()["api_access"] is False
        assert resp.json()["api_keys"] == []

    @pytest.mark.asyncio
    async def test_update(self, auth_client):
        mp = mock_prisma()
        updated = MagicMock(
            spec=[
                "apiAccess",
                "webhooks",
                "dataExport",
                "debugMode",
                "performanceMode",
                "cacheSize",
                "logLevel",
            ]
        )
        updated.apiAccess = True
        updated.webhooks = False
        updated.dataExport = False
        updated.debugMode = False
        updated.performanceMode = False
        updated.cacheSize = 500
        updated.logLevel = "info"
        mp.advancedsettings.upsert.return_value = updated
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.put(
                "/api/v1/settings/advanced",
                json={
                    "api_access": True,
                },
            )
        assert resp.json()["status"] == "updated"
        assert resp.json()["settings"]["apiAccess"] is True

    @pytest.mark.asyncio
    async def test_export_data(self, auth_client):
        mp = mock_prisma()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.post("/api/v1/settings/advanced/export-data")
        assert resp.json()["status"] == "requested"

    @pytest.mark.asyncio
    async def test_list_exports(self, auth_client):
        mp = mock_prisma()
        mp.dataexport.find_many.return_value = []
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/settings/advanced/exports")
        assert resp.json() == []


class TestAccountActions:
    @pytest.mark.asyncio
    async def test_deactivate(self, auth_client):
        mp = mock_prisma()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.post("/api/v1/settings/account/deactivate")
        assert resp.json()["status"] == "deactivated"

    @pytest.mark.asyncio
    async def test_delete_request(self, auth_client):
        mp = mock_prisma()
        mp.accountdeletionrequest.create.return_value = MagicMock()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.post("/api/v1/settings/account/delete")
        assert resp.json()["status"] == "requested"

    @pytest.mark.asyncio
    async def test_verify_email(self, auth_client):
        resp = await auth_client.post("/api/v1/settings/account/verify-email")
        assert "sent" in resp.json()["status"]

    @pytest.mark.asyncio
    async def test_verify_phone(self, auth_client):
        resp = await auth_client.post("/api/v1/settings/account/verify-phone")
        assert "sent" in resp.json()["status"]

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for path in (
            "/api/v1/settings/account/deactivate",
            "/api/v1/settings/account/delete",
            "/api/v1/settings/account/verify-email",
            "/api/v1/settings/account/verify-phone",
        ):
            assert (await client.post(path)).status_code == 401
