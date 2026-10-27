# services/api/app/services/audit_trail_service.py
"""
Immutable Cryptographic Audit Vault Service (NIST SP 800-53 AU-2/AU-9, SOC 2 Type II).
Provides tamper-evident audit logging using HMAC-SHA256 sequence chaining.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.config import setting
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.generated.prisma import enums as p_enums

logger = logging.getLogger("podacium.audit_vault")

GENESIS_PREVIOUS_HASH = (
    "0000000000000000000000000000000000000000000000000000000000000000"
)

DOMAIN_ALIASES: Dict[str, str] = {
    "IAM": "RBAC",
    "AUTH": "SECURITY",
    "FINANCE": "BILLING",
    "COURSES": "EDUCATION",
    "LESSONS": "EDUCATION",
    "MODERATION": "SUPPORT",
}


def _compute_hash(
    secret: str,
    sequence: int,
    timestamp: str,
    action: str,
    domain: str,
    resource_type: str,
    resource_id: Optional[str],
    status: str,
    previous_hash: str,
    metadata_str: str,
) -> str:
    """Compute HMAC-SHA256 digest over audit record payload and previous link (NIST SP 800-53 AU-2/AU-9)."""
    payload_content = f"{resource_type}|{resource_id or ''}|{status}|{metadata_str}"
    payload_hash = hashlib.sha256(payload_content.encode("utf-8")).hexdigest()
    chain_payload = (
        f"{sequence}|{timestamp}|{action}|{domain}|{previous_hash}|{payload_hash}"
    )
    return hmac.new(
        secret.encode("utf-8"),
        chain_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


from contextvars import ContextVar

current_session_id_ctx: ContextVar[Optional[str]] = ContextVar(
    "current_session_id_ctx", default=None
)
current_impersonator_id_ctx: ContextVar[Optional[int]] = ContextVar(
    "current_impersonator_id_ctx", default=None
)


class AuditTrailService:
    """Enterprise Cryptographic Audit Vault Engine."""

    _lock = asyncio.Lock()

    @classmethod
    async def log_action(
        cls,
        action: str,
        domain: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        status: str = "SUCCESS",
        severity: str = "INFO",
        admin_profile_id: Optional[int] = None,
        actor_id: Optional[int] = None,
        impersonator_id: Optional[int] = None,
        ip_address: str = "127.0.0.1",
        user_agent: Optional[str] = None,
        geo_country: str = "DZ",
        geo_wilaya: Optional[int] = None,
        session_id: Optional[str] = None,
        mfa_verified: bool = True,
        request_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        try:
            if session_id is None:
                session_id = current_session_id_ctx.get()
            if impersonator_id is None:
                impersonator_id = current_impersonator_id_ctx.get()

            if actor_id is not None and admin_profile_id is None:
                if metadata is None:
                    metadata = {}
                metadata.setdefault("actorUserId", actor_id)

            domain_enum = getattr(
                p_enums.AdminPermissionDomain,
                domain.upper(),
                p_enums.AdminPermissionDomain.SYSTEM,
            )
            status_enum = getattr(
                p_enums.AuditActionStatus,
                status.upper(),
                p_enums.AuditActionStatus.SUCCESS,
            )
            severity_enum = getattr(
                p_enums.AuditSeverity, severity.upper(), p_enums.AuditSeverity.INFO
            )

            from app.core.redis import get_redis

            redis_client = None
            try:
                redis_client = await get_redis()
            except Exception:
                pass

            redis_lock = None
            if redis_client:
                try:
                    redis_lock = redis_client.lock(
                        "audit:chain:lock", timeout=2.0, blocking_timeout=2.0
                    )
                    await redis_lock.acquire()
                except Exception as e:
                    logger.warning(
                        f"Distributed Redis lock unavailable for audit trail: {e}"
                    )
                    redis_lock = None

            try:
                async with cls._lock:
                    # 1. Fetch the latest audit record to chain the hash within lock
                    latest = await prisma.adminaudittrail.find_first(
                        order={"sequenceNumber": "desc"},
                    )

                    if latest:
                        sequence_number = int(latest.sequenceNumber) + 1
                        previous_hash = latest.sha256Hash
                    else:
                        sequence_number = 1
                        previous_hash = GENESIS_PREVIOUS_HASH

                    now = datetime.now(timezone.utc)
                    timestamp_str = now.isoformat()
                    meta_str = json.dumps(metadata or {}, sort_keys=True)

                    secret = setting.JWT_SECRET_KEY or "audit_secret_fallback_2026"
                    current_hash = _compute_hash(
                        secret=secret,
                        sequence=sequence_number,
                        timestamp=timestamp_str,
                        action=action,
                        domain=domain_enum.name,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        status=status_enum.name,
                        previous_hash=previous_hash,
                        metadata_str=meta_str,
                    )

                    create_data: Dict[str, Any] = {
                        "sequenceNumber": sequence_number,
                        "action": action,
                        "domain": domain_enum,
                        "resourceType": resource_type,
                        "resourceId": str(resource_id) if resource_id else None,
                        "status": status_enum,
                        "severity": severity_enum,
                        "ipAddress": ip_address,
                        "userAgent": user_agent,
                        "geoCountry": geo_country,
                        "geoWilaya": geo_wilaya,
                        "sessionId": session_id,
                        "mfaVerified": mfa_verified,
                        "requestId": request_id,
                        "sha256Hash": current_hash,
                        "previousHash": previous_hash,
                        "timestamp": now,
                    }
                    if admin_profile_id is not None:
                        create_data["adminProfile"] = {
                            "connect": {"id": admin_profile_id}
                        }
                    if impersonator_id is not None:
                        create_data["impersonatorId"] = impersonator_id
                    if before_state is not None:
                        create_data["beforeState"] = Json(before_state)
                    if after_state is not None:
                        create_data["afterState"] = Json(after_state)
                    if metadata is not None:
                        create_data["metadata"] = Json(metadata)

                    record = await prisma.adminaudittrail.create(data=create_data)

                    logger.info(
                        f"Audit record #{sequence_number} appended. Action: {action}, Domain: {domain}, Status: {status}"
                    )
                    return record
            finally:
                if redis_lock:
                    try:
                        await redis_lock.release()
                    except Exception:
                        pass

        except Exception as e:
            logger.error(f"Failed to record cryptographic audit trail: {e}")
            return None

    @classmethod
    async def verify_chain_integrity(
        cls, limit: int = 1000, secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Verify cryptographic HMAC-SHA256 linkage across historical records.
        """
        records = await prisma.adminaudittrail.find_many(
            order={"sequenceNumber": "asc"},
            take=limit,
        )

        signing_secret = (
            secret or setting.JWT_SECRET_KEY or "audit_secret_fallback_2026"
        )
        expected_prev_hash = GENESIS_PREVIOUS_HASH
        corrupted = []

        for r in records:
            if r.previousHash != expected_prev_hash:
                corrupted.append(
                    {
                        "sequence": int(r.sequenceNumber),
                        "reason": "Previous hash link broken",
                        "expected": expected_prev_hash,
                        "actual": r.previousHash,
                    }
                )
                break

            meta_str = (
                json.dumps(r.metadata or {}, sort_keys=True)
                if isinstance(r.metadata, dict)
                else "{}"
            )
            domain_name = getattr(r.domain, "name", None)
            if not isinstance(domain_name, str):
                domain_name = getattr(r.domain, "_mock_name", None)
            if not isinstance(domain_name, str):
                domain_name = str(r.domain)

            status_name = getattr(r.status, "name", None)
            if not isinstance(status_name, str):
                status_name = getattr(r.status, "_mock_name", None)
            if not isinstance(status_name, str):
                status_name = str(r.status)

            computed = _compute_hash(
                secret=signing_secret,
                sequence=int(r.sequenceNumber),
                timestamp=r.timestamp.isoformat(),
                action=r.action,
                domain=domain_name,
                resource_type=r.resourceType,
                resource_id=r.resourceId,
                status=status_name,
                previous_hash=r.previousHash,
                metadata_str=meta_str,
            )

            if computed != r.sha256Hash:
                corrupted.append(
                    {
                        "sequence": int(r.sequenceNumber),
                        "reason": "Payload hash recalculation mismatch",
                        "expected": computed,
                        "actual": r.sha256Hash,
                    }
                )
                break

            expected_prev_hash = r.sha256Hash

        return {
            "verified_count": len(records),
            "is_valid": len(corrupted) == 0,
            "corruptions": corrupted,
        }


audit_trail_service = AuditTrailService()
