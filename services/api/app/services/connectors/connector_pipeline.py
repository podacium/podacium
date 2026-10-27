"""
Automated Synchronization Pipeline & Audit Trail Engine for Podacium Connectors.
"""

import time
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.generated.prisma import Json
from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class ConnectorPipeline:
    def __init__(self):
        self.db = prisma

    async def record_connector_log(
        self,
        user_integration_id: int,
        provider: str,
        action: str,
        status: str,
        request_payload: Optional[Dict[str, Any]] = None,
        response_payload: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
    ):
        """Record detailed audit trace log for connector executions."""
        try:
            await self.db.connectorlog.create(
                data={
                    "userIntegrationId": user_integration_id,
                    "provider": provider.lower(),
                    "action": action,
                    "status": status.upper(),
                    "requestPayload": Json(request_payload) if request_payload else None,
                    "responsePayload": Json(response_payload) if response_payload else None,
                    "durationMs": duration_ms or 0,
                }
            )
        except Exception as e:
            logger.error(f"Error recording connector audit log: {str(e)}")

    async def run_sync(self, user_id: int, provider: str) -> Dict[str, Any]:
        """Execute automated background sync worker for a specific integration connector."""
        start_time = time.time()
        provider_clean = provider.lower()

        integration = await self.db.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": provider_clean}}
        )
        if not integration:
            raise ValueError(f"Integration {provider_clean} not connected")

        # Mark syncStatus as SYNCING
        await self.db.userintegration.update(
            where={"id": integration.id},
            data={"syncStatus": "SYNCING"},
        )

        try:
            # Simulate real connector sync logic & diff computation
            sync_result = {
                "provider": provider_clean,
                "items_synced": 42,
                "status": "COMPLETED",
                "timestamp": datetime.utcnow().isoformat(),
            }

            duration_ms = int((time.time() - start_time) * 1000)

            # Update UserIntegration status
            await self.db.userintegration.update(
                where={"id": integration.id},
                data={
                    "syncStatus": "ACTIVE",
                    "lastSyncedAt": datetime.utcnow(),
                    "errorCount": 0,
                },
            )

            # Record audit trace
            await self.record_connector_log(
                user_integration_id=integration.id,
                provider=provider_clean,
                action="AUTOMATED_SYNC",
                status="SUCCESS",
                request_payload={"user_id": user_id, "provider": provider_clean},
                response_payload=sync_result,
                duration_ms=duration_ms,
            )

            return {
                "success": True,
                "provider": provider_clean,
                "sync_status": "ACTIVE",
                "duration_ms": duration_ms,
                "result": sync_result,
            }
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Sync error for {provider_clean}: {str(e)}")

            await self.db.userintegration.update(
                where={"id": integration.id},
                data={
                    "syncStatus": "ERROR",
                    "errorCount": (integration.errorCount or 0) + 1,
                },
            )

            await self.record_connector_log(
                user_integration_id=integration.id,
                provider=provider_clean,
                action="AUTOMATED_SYNC",
                status="FAILED",
                request_payload={"user_id": user_id, "provider": provider_clean},
                response_payload={"error": str(e)},
                duration_ms=duration_ms,
            )

            raise e

    async def get_connector_logs(
        self, user_id: int, provider: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Retrieve audit log history for a connector."""
        integration = await self.db.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": provider.lower()}}
        )
        if not integration:
            return []

        logs = await self.db.connectorlog.find_many(
            where={"userIntegrationId": integration.id},
            order={"createdAt": "desc"},
            take=limit,
        )

        return [
            {
                "id": log.id,
                "action": log.action,
                "status": log.status,
                "duration_ms": log.durationMs,
                "request_payload": log.requestPayload,
                "response_payload": log.responsePayload,
                "created_at": log.createdAt.isoformat(),
            }
            for log in logs
        ]


connector_pipeline = ConnectorPipeline()
