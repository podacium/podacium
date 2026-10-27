import pytest
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional
from unittest.mock import AsyncMock

from app.core.prisma import prisma
from app.services.system_settings_service import system_settings_service


@dataclass
class DummySystemSetting:
    id: str
    key: str
    value: str
    category: str
    isSecret: bool
    description: Optional[str]
    updatedBy: str
    createdAt: datetime
    updatedAt: datetime


@dataclass
class DummySystemSettingAudit:
    id: str
    settingKey: str
    oldValue: Optional[str]
    newValue: Optional[str]
    changedBy: str
    ipAddress: Optional[str]
    createdAt: datetime


@pytest.fixture(autouse=True)
def mock_prisma_settings(monkeypatch):
    settings_db: Dict[str, DummySystemSetting] = {}
    audit_db: List[DummySystemSettingAudit] = []

    async def mock_find_unique(where):
        key = where.get("key")
        return settings_db.get(key)

    async def mock_upsert(where, data):
        key = where.get("key")
        payload = data.get("create") if key not in settings_db else data.get("update")
        existing = settings_db.get(key)

        new_val = payload.get("value")
        cat = payload.get("category", existing.category if existing else "video")
        sec = payload.get("isSecret", existing.isSecret if existing else False)
        desc = payload.get("description", existing.description if existing else None)
        ub = payload.get("updatedBy", existing.updatedBy if existing else "system")

        rec = DummySystemSetting(
            id=f"setting-{len(settings_db)+1}",
            key=key,
            value=new_val,
            category=cat,
            isSecret=sec,
            description=desc,
            updatedBy=ub,
            createdAt=existing.createdAt if existing else datetime.utcnow(),
            updatedAt=datetime.utcnow(),
        )
        settings_db[key] = rec
        return rec

    async def mock_find_many(where=None, category=None):
        where = where or {}
        cat = where.get("category")
        recs = [r for r in settings_db.values() if not cat or r.category == cat]
        return recs

    async def mock_audit_create(data=None, **kwargs):
        d = data if isinstance(data, dict) else kwargs.get("data", {})
        audit = DummySystemSettingAudit(
            id=f"audit-{len(audit_db)+1}",
            settingKey=d["settingKey"],
            oldValue=d.get("oldValue"),
            newValue=d.get("newValue"),
            changedBy=d["changedBy"],
            ipAddress=d.get("ipAddress"),
            createdAt=datetime.utcnow(),
        )
        audit_db.append(audit)
        return audit

    async def mock_audit_find_many(where=None, take=50, order=None):
        where = where or {}
        sk = where.get("settingKey")
        res = [a for a in audit_db if not sk or a.settingKey == sk]
        return res[:take]

    monkeypatch.setattr(
        prisma.systemsetting, "find_unique", AsyncMock(side_effect=mock_find_unique)
    )
    monkeypatch.setattr(
        prisma.systemsetting, "upsert", AsyncMock(side_effect=mock_upsert)
    )
    monkeypatch.setattr(
        prisma.systemsetting, "find_many", AsyncMock(side_effect=mock_find_many)
    )
    monkeypatch.setattr(
        prisma.systemsettingaudit, "create", AsyncMock(side_effect=mock_audit_create)
    )
    monkeypatch.setattr(
        prisma.systemsettingaudit,
        "find_many",
        AsyncMock(side_effect=mock_audit_find_many),
    )


@pytest.mark.asyncio
async def test_set_and_get_setting_plaintext():
    """Test standard non-secret system setting storage and retrieval."""
    res = await system_settings_service.set_setting(
        key="test.video.provider",
        value="bunny",
        category="video",
        is_secret=False,
        description="Active video provider",
        updated_by="admin-user",
    )
    assert res["key"] == "test.video.provider"
    assert res["value"] == "bunny"

    val = await system_settings_service.get_setting("test.video.provider")
    assert val == "bunny"


@pytest.mark.asyncio
async def test_set_and_get_setting_encrypted_secret():
    """Test secret setting encryption at rest and auto-decryption on retrieval."""
    raw_key = "secret_bunny_api_token_abc123"
    res = await system_settings_service.set_setting(
        key="test.video.bunny_key",
        value=raw_key,
        category="video",
        is_secret=True,
        description="Bunny API Secret Key",
        updated_by="admin-user",
    )
    # Return dictionary should mask the secret
    assert "••••••••c123" in res["value"]

    # Raw database value must be Fernet encrypted (not raw_key)
    db_rec = await prisma.systemsetting.find_unique(
        where={"key": "test.video.bunny_key"}
    )
    assert db_rec is not None
    assert db_rec.value != raw_key
    assert db_rec.isSecret is True

    # get_setting should return the decrypted plaintext key
    val = await system_settings_service.get_setting("test.video.bunny_key")
    assert val == raw_key


@pytest.mark.asyncio
async def test_get_all_settings_masks_secrets():
    """Test bulk get_all_settings returns masked secret values for UI presentation."""
    await system_settings_service.set_setting(
        "test.video.provider", "bunny", category="video", is_secret=False
    )
    await system_settings_service.set_setting(
        "test.video.secret",
        "super_secret_password_99",
        category="video",
        is_secret=True,
    )

    settings = await system_settings_service.get_all_settings(category="video")
    assert settings.get("test.video.provider") == "bunny"
    assert "••••••••" in settings.get("test.video.secret", "")


@pytest.mark.asyncio
async def test_setting_audit_logging():
    """Test audit log entry generation when a setting is updated."""
    await system_settings_service.set_setting(
        key="test.video.quality",
        value="1080p",
        category="video",
        is_secret=False,
        updated_by="admin-1",
        ip_address="127.0.0.1",
    )

    logs = await system_settings_service.get_audit_logs(
        key="test.video.quality", limit=5
    )
    assert len(logs) >= 1
    assert logs[0]["setting_key"] == "test.video.quality"
    assert logs[0]["new_value"] == "1080p"
    assert logs[0]["changed_by"] == "admin-1"
