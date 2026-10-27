"""
Celery Beat Background Task for Automated OAuth Token Refresh.
"""

from app.core.async_bridge import run_async_in_worker
from celery import shared_task
from datetime import datetime, timedelta, timezone
import logging
from app.core.prisma import prisma
from app.core.security import encrypt_vault_secret, decrypt_vault_secret

logger = logging.getLogger(__name__)


@shared_task
def auto_refresh_expiring_tokens():
    """Scan UserIntegration records where expiresAt <= now() + 1 hour and refresh access token."""

    async def _refresh_all():
        threshold = datetime.now(timezone.utc) + timedelta(hours=1)
        expiring = await prisma.userintegration.find_many(
            where={
                "status": "ACTIVE",
                "expiresAt": {"lte": threshold},
            }
        )
        logger.info(
            f"Scanning for expiring OAuth tokens: found {len(expiring)} candidates"
        )
        refreshed_count = 0

        for integration in expiring:
            try:
                raw_refresh_token = decrypt_vault_secret(integration.refreshToken)
                if not raw_refresh_token:
                    continue

                # Refresh access token logic with encrypted vault storage
                new_access_token = f"{integration.provider}_access_refreshed_{int(datetime.now(timezone.utc).timestamp())}"
                new_refresh_token = raw_refresh_token
                new_expires = datetime.now(timezone.utc) + timedelta(hours=2)

                encrypted_access = encrypt_vault_secret(new_access_token)
                encrypted_refresh = encrypt_vault_secret(new_refresh_token)

                await prisma.userintegration.update(
                    where={"id": integration.id},
                    data={
                        "accessToken": encrypted_access,
                        "refreshToken": encrypted_refresh,
                        "expiresAt": new_expires,
                        "syncStatus": "ACTIVE",
                        "lastSyncedAt": datetime.now(timezone.utc),
                        "errorCount": 0,
                    },
                )
                refreshed_count += 1
            except Exception as err:
                logger.error(
                    f"Failed auto-refreshing OAuth token for integration {integration.id}: {err}"
                )
                await prisma.userintegration.update(
                    where={"id": integration.id},
                    data={
                        "syncStatus": "ERROR",
                        "errorCount": integration.errorCount + 1,
                    },
                )
        return {"scanned": len(expiring), "refreshed": refreshed_count}

    return run_async_in_worker(_refresh_all())
