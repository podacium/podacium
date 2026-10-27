"""
BI Audit Logging Service
Tracks administrative actions, report exports, dataset modifications, and external DB connections for enterprise compliance.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.prisma import prisma

logger = logging.getLogger(__name__)


def json_dumps(data: Any) -> str:
    try:
        from app.services.bi_services.analytics_service import AnalyticsService

        sanitized = AnalyticsService._make_json_serializable(data)
        return json.dumps(sanitized)
    except Exception:
        return json.dumps(str(data))


class BIAuditService:
    """Service for logging security-critical BI actions for enterprise compliance and auditing."""

    @classmethod
    async def log_action(
        cls,
        user_id: int,
        organization_id: int,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        duration_ms: Optional[float] = None,
        rows_affected: Optional[int] = None,
    ) -> None:
        """
        Record an audit log entry in structured logs and database.
        """
        try:
            event_data = {
                "action": action.upper(),
                "resource_type": resource_type.lower(),
                "resource_id": str(resource_id) if resource_id else None,
                "details": details or {},
                "ip_address": ip_address,
                "user_agent": user_agent,
                "duration_ms": duration_ms,
                "rows_affected": rows_affected,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            logger.info("BI_AUDIT_LOG: %s", event_data)

            # Record in BiAuditLog if datasetId is valid integer or fallback to dataset_id 0
            ds_id = 0
            if (
                resource_type.lower() == "dataset"
                and resource_id
                and str(resource_id).isdigit()
            ):
                ds_id = int(resource_id)

            if ds_id > 0:
                await prisma.biauditlog.create(
                    data={
                        "datasetId": ds_id,
                        "organizationId": organization_id,
                        "userId": user_id,
                        "eventType": action.upper(),
                        "eventData": event_data,
                    }
                )
            else:
                # General system audit log fallback
                await prisma.auditlog.create(
                    data={
                        "userId": user_id,
                        "action": f"BI_{action.upper()}",
                        "resource": f"{resource_type}:{resource_id or 'all'}",
                        "details": json_dumps(event_data),
                        "ipAddress": ip_address,
                    }
                )
        except Exception as e:
            logger.warning(f"Failed to write DB audit log: {e}")

    @classmethod
    async def get_organization_audit_logs(
        cls,
        organization_id: int,
        event_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent BI audit logs for an organization.
        """
        try:
            where_clause: Dict[str, Any] = {"organizationId": organization_id}
            if event_type:
                where_clause["eventType"] = event_type.upper()

            records = await prisma.biauditlog.find_many(
                where=where_clause,
                order={"createdAt": "desc"},
                take=limit,
                include={"user": True},
            )

            result = []
            for r in records:
                user_email = r.user.email if r.user else "system"
                result.append(
                    {
                        "id": r.id,
                        "dataset_id": r.datasetId,
                        "event_type": r.eventType,
                        "event_data": r.eventData,
                        "user_id": r.userId,
                        "user_email": user_email,
                        "created_at": r.createdAt.isoformat() if r.createdAt else None,
                    }
                )
            return result
        except Exception as e:
            logger.exception(f"Error fetching BI audit logs: {e}")
            return []
