"""System settings service for dynamic provider configurations."""

import logging
from typing import Optional, Dict, Any, List
from app.core.prisma import prisma
from app.core.encryption import encrypt_field, decrypt_field, mask_secret

logger = logging.getLogger(__name__)


class SystemSettingsService:
    async def get_setting(
        self, key: str, default: Optional[str] = None
    ) -> Optional[str]:
        """Fetch a system setting value, decrypting automatically if isSecret."""
        setting_rec = await prisma.systemsetting.find_unique(where={"key": key})
        if not setting_rec:
            return default

        val = setting_rec.value
        if setting_rec.isSecret and val:
            val = decrypt_field(val)
        return val

    async def set_setting(
        self,
        key: str,
        value: str,
        category: str = "video",
        is_secret: bool = False,
        description: Optional[str] = None,
        updated_by: str = "system",
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upsert a setting, encrypt secrets, and log audit trail."""
        existing = await prisma.systemsetting.find_unique(where={"key": key})
        old_val = existing.value if existing else None

        updater_str = str(updated_by) if updated_by is not None else "system"
        store_val = encrypt_field(value) if (is_secret and value) else value

        updated = await prisma.systemsetting.upsert(
            where={"key": key},
            data={
                "create": {
                    "key": key,
                    "value": store_val,
                    "category": category,
                    "isSecret": is_secret,
                    "description": description,
                    "updatedBy": updater_str,
                },
                "update": {
                    "value": store_val,
                    "category": category,
                    "isSecret": is_secret,
                    "description": description,
                    "updatedBy": updater_str,
                },
            },
        )

        # Log Audit Trail
        old_display = (
            mask_secret(decrypt_field(old_val))
            if (existing and existing.isSecret and old_val)
            else old_val
        )
        new_display = mask_secret(value) if is_secret else value

        await prisma.systemsettingaudit.create(
            data={
                "settingKey": key,
                "oldValue": old_display,
                "newValue": new_display,
                "changedBy": updater_str,
                "ipAddress": ip_address,
            }
        )

        return {
            "key": updated.key,
            "category": updated.category,
            "is_secret": updated.isSecret,
            "value": mask_secret(value) if is_secret else value,
        }

    async def get_all_settings(self, category: str = "video") -> Dict[str, Any]:
        """Return key-value dict for category with secret values masked for Admin UI."""
        records = await prisma.systemsetting.find_many(where={"category": category})
        res = {}
        for r in records:
            if r.isSecret:
                decrypted = decrypt_field(r.value)
                res[r.key] = mask_secret(decrypted)
            else:
                res[r.key] = r.value
        return res

    async def delete_setting(
        self, key: str, deleted_by: str = "system", ip_address: Optional[str] = None
    ) -> bool:
        """Delete a setting by key and log audit entry."""
        existing = await prisma.systemsetting.find_unique(where={"key": key})
        if not existing:
            return False

        old_val = existing.value
        if existing.isSecret and old_val:
            old_val = mask_secret(decrypt_field(old_val))

        deleter_str = str(deleted_by) if deleted_by is not None else "system"
        await prisma.systemsetting.delete(where={"key": key})

        await prisma.systemsettingaudit.create(
            data={
                "settingKey": key,
                "oldValue": old_val,
                "newValue": None,
                "changedBy": deleter_str,
                "ipAddress": ip_address,
            }
        )
        return True

    async def get_audit_logs(
        self, key: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve audit history entries."""
        where_clause = {"settingKey": key} if key else {}
        records = await prisma.systemsettingaudit.find_many(
            where=where_clause,
            take=limit,
            order={"createdAt": "desc"},
        )
        return [
            {
                "id": r.id,
                "setting_key": r.settingKey,
                "old_value": r.oldValue,
                "new_value": r.newValue,
                "changed_by": r.changedBy,
                "ip_address": r.ipAddress,
                "created_at": r.createdAt.isoformat(),
            }
            for r in records
        ]


system_settings_service = SystemSettingsService()
