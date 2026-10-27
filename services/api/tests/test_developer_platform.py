import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from app.core.security import encrypt_vault_secret, decrypt_vault_secret
from app.schemas.api_keys import ApiKeyCreate
from app.schemas.webhooks import WebhookEndpointCreate


def test_vault_token_encryption():
    raw_token = "gho_16Fd7100000000000000000000000000000000"
    cipher_text = encrypt_vault_secret(raw_token)
    assert cipher_text != raw_token
    decrypted = decrypt_vault_secret(cipher_text)
    assert decrypted == raw_token


def make_mock_user(**overrides):
    base = dict(id=1, email="dev@podacium.com", role="STUDENT")
    base.update(overrides)
    obj = MagicMock(spec=[])
    for k, v in base.items():
        setattr(obj, k, v)
    return obj


@pytest.fixture
def app_with_auth():
    from app.routers.api_keys import router as api_keys_router
    from app.routers.webhooks import router as webhooks_router
    from app.core.auth import get_current_user

    test_app = FastAPI()
    test_app.include_router(api_keys_router, prefix="/api/v1")
    test_app.include_router(webhooks_router, prefix="/api/v1")
    test_app.dependency_overrides[get_current_user] = lambda: make_mock_user()
    return test_app


@pytest.mark.asyncio
async def test_api_keys_endpoints(app_with_auth):
    mock_key = MagicMock(
        id=10,
        userId=1,
        name="CI Test Key",
        keyPrefix="sk_live_pod",
        keyHash="hash123",
        scopes=["*"],
        environment="production",
        lastUsedAt=None,
        expiresAt=None,
        created_at=datetime.utcnow(),
        createdAt=datetime.utcnow(),
        revokedAt=None,
    )
    with patch("app.services.api_key_service.api_key_service.create_api_key", new_callable=AsyncMock) as mock_create, \
         patch("app.services.api_key_service.api_key_service.list_api_keys", new_callable=AsyncMock) as mock_list, \
         patch("app.services.api_key_service.api_key_service.revoke_api_key", new_callable=AsyncMock) as mock_revoke:

        mock_create.return_value = {
            "id": 10,
            "user_id": 1,
            "name": "CI Test Key",
            "key_prefix": "sk_live_pod",
            "scopes": ["*"],
            "environment": "production",
            "created_at": datetime.utcnow().isoformat(),
            "secret_key": "sk_live_podacium_testsecret123",
        }
        mock_list.return_value = {"api_keys": [mock_create.return_value]}
        mock_revoke.return_value = True

        async with AsyncClient(transport=ASGITransport(app=app_with_auth), base_url="http://test") as ac:
            res_create = await ac.post("/api/v1/api-keys", json={"name": "CI Test Key", "scopes": ["*"]})
            assert res_create.status_code == 201
            assert "secret_key" in res_create.json()

            res_list = await ac.get("/api/v1/api-keys")
            assert res_list.status_code == 200
            assert len(res_list.json()["api_keys"]) == 1

            res_del = await ac.delete("/api/v1/api-keys/10")
            assert res_del.status_code == 200
            assert res_del.json()["success"] is True


@pytest.mark.asyncio
async def test_webhooks_endpoints(app_with_auth):
    mock_ep = {
        "id": 5,
        "user_id": 1,
        "name": "Test Endpoint",
        "url": "https://example.com/wh",
        "events": ["course.completed"],
        "active": True,
        "failure_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "secret": "whsec_test123",
    }
    with patch("app.services.webhook_service.webhook_service.create_webhook_endpoint", new_callable=AsyncMock) as mock_create, \
         patch("app.services.webhook_service.webhook_service.list_webhook_endpoints", new_callable=AsyncMock) as mock_list, \
         patch("app.services.webhook_service.webhook_service.delete_webhook_endpoint", new_callable=AsyncMock) as mock_del:

        mock_create.return_value = mock_ep
        mock_list.return_value = {"endpoints": [mock_ep]}
        mock_del.return_value = True

        async with AsyncClient(transport=ASGITransport(app=app_with_auth), base_url="http://test") as ac:
            res_create = await ac.post(
                "/api/v1/dev-webhooks",
                json={"name": "Test Endpoint", "url": "https://example.com/wh", "events": ["course.completed"]},
            )
            assert res_create.status_code == 201
            assert res_create.json()["secret"] == "whsec_test123"

            res_list = await ac.get("/api/v1/dev-webhooks")
            assert res_list.status_code == 200
            assert len(res_list.json()["endpoints"]) == 1

            res_del = await ac.delete("/api/v1/dev-webhooks/5")
            assert res_del.status_code == 200
            assert res_del.json()["success"] is True
