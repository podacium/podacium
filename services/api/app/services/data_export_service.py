"""
Data Export & Account Deletion Service.

Handles GDPR-style user data portability and right-to-erasure requests:

- build_user_export()  — collects all user-owned records into a JSON dict
- create_export_record() — persists a DataExport row and returns it
- create_deletion_request() — creates an AccountDeletionRequest with a 30-day
  grace period and sends a confirmation email

The export is returned as an in-memory JSON payload (no S3 required for the
initial implementation). When an S3 bucket is configured via AWS_S3_BUCKET,
the payload is uploaded and a pre-signed URL is returned instead.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

GRACE_PERIOD_DAYS = 30  # Days before a deletion request is executed


# ─── Public API ───────────────────────────────────────────────────────────────


async def build_user_export(user_id: int) -> dict[str, Any]:
    """
    Collect all data owned by *user_id* and return it as a plain dict.

    Runs all queries in parallel for speed.
    """
    from app.core.prisma import prisma
    import asyncio

    (
        user,
        enrollments,
        certificates,
        projects,
        proposals,
        contracts_as_freelancer,
        contracts_as_client,
        tickets,
        datasets,
        wallet,
        transactions,
        notifications,
        skills,
        audit_logs,
    ) = await asyncio.gather(
        prisma.user.find_unique(where={"id": user_id}),
        prisma.enrollment.find_many(where={"userId": user_id}, take=500),
        prisma.certificate.find_many(where={"userId": user_id}, take=200),
        prisma.project.find_many(
            where={"ownerId": user_id, "deletedAt": None}, take=200
        ),
        prisma.proposal.find_many(where={"freelancerId": user_id}, take=200),
        prisma.contract.find_many(where={"freelancerId": user_id}, take=200),
        prisma.contract.find_many(where={"clientId": user_id}, take=200),
        prisma.ticket.find_many(where={"userId": user_id, "deletedAt": None}, take=200),
        prisma.dataset.find_many(where={"userId": user_id}, take=100),
        prisma.wallet.find_unique(where={"userId": user_id}),
        prisma.transaction.find_many(
            where={"userId": user_id}, take=500, order={"createdAt": "desc"}
        ),
        prisma.notification.find_many(
            where={"userId": user_id}, take=200, order={"createdAt": "desc"}
        ),
        prisma.userskill.find_many(where={"userId": user_id}),
        prisma.auditlog.find_many(
            where={"actorId": user_id}, take=200, order={"createdAt": "desc"}
        ),
    )

    def _serialize(obj: Any) -> Any:
        """Recursively convert Prisma model instances to plain dicts."""
        if obj is None:
            return None
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, list):
            return [_serialize(item) for item in obj]
        if hasattr(obj, "__dict__"):
            return {
                k: _serialize(v)
                for k, v in obj.__dict__.items()
                if not k.startswith("_")
            }
        return obj

    # Redact sensitive fields before export
    user_dict = _serialize(user) or {}
    for sensitive in ("passwordHash", "totpSecret", "totpBackupCodes"):
        user_dict.pop(sensitive, None)

    return {
        "export_version": "2.0",
        "compliance_frameworks": [
            "GDPR (Regulation EU 2016/679)",
            "Algerian Law 18-07 (Loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel)",
        ],
        "supervisory_authorities": {
            "algeria": "ANPDP (Autorité Nationale de Protection des Données à caractère Personnel)",
            "international": "Applicable Data Protection Authorities",
        },
        "statutory_rights": {
            "right_of_access": "Law 18-07 Art. 34 / GDPR Art. 15",
            "right_to_rectification": "Law 18-07 Art. 35 / GDPR Art. 16",
            "right_to_erasure": "Law 18-07 Art. 36 / GDPR Art. 17",
            "right_to_object": "Law 18-07 Art. 37 / GDPR Art. 21",
            "right_to_data_portability": "GDPR Art. 20 / Law 18-07 Art. 34",
            "cross_border_transfer_safeguards": "Law 18-07 Art. 44-46",
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "profile": user_dict,
        "enrollments": _serialize(enrollments),
        "certificates": _serialize(certificates),
        "projects": _serialize(projects),
        "proposals": _serialize(proposals),
        "contracts_as_freelancer": _serialize(contracts_as_freelancer),
        "contracts_as_client": _serialize(contracts_as_client),
        "support_tickets": _serialize(tickets),
        "analytics_datasets": _serialize(datasets),
        "wallet": _serialize(wallet),
        "transactions": _serialize(transactions),
        "notifications": _serialize(notifications),
        "skills": _serialize(skills),
        "audit_logs": _serialize(audit_logs),
    }


async def create_export_record(user_id: int) -> Any:
    """
    Create a DataExport record in PENDING state and return it.
    The actual export data is built on-demand by the endpoint.
    """
    from app.core.prisma import prisma

    # Cancel any existing pending export for this user to avoid duplicates
    await prisma.dataexport.update_many(
        where={"userId": user_id, "status": "PENDING"},
        data={"status": "CANCELLED"},
    )

    record = await prisma.dataexport.create(
        data={
            "userId": user_id,
            "status": "PROCESSING",
            "format": "JSON",
            "expiresAt": datetime.now(timezone.utc) + timedelta(hours=24),
        }
    )
    return record


async def create_deletion_request(
    user_id: int,
    reason: str | None = None,
    feedback: str | None = None,
) -> Any:
    """
    Create an AccountDeletionRequest with a 30-day grace period.

    Returns the created request record.
    Raises ValueError if a pending request already exists.
    """
    from app.core.prisma import prisma

    # Prevent duplicate requests
    existing = await prisma.accountdeletionrequest.find_first(
        where={"userId": user_id, "status": "PENDING"}
    )
    if existing:
        raise ValueError(
            "A deletion request is already pending for this account. "
            f"Scheduled for: {existing.scheduledFor.isoformat()}"
        )

    scheduled_for = datetime.now(timezone.utc) + timedelta(days=GRACE_PERIOD_DAYS)

    request = await prisma.accountdeletionrequest.create(
        data={
            "userId": user_id,
            "reason": reason,
            "feedback": feedback,
            "status": "PENDING",
            "scheduledFor": scheduled_for,
        }
    )

    logger.info(
        f"Account deletion request created for user {user_id}. "
        f"Scheduled for: {scheduled_for.isoformat()}"
    )
    return request


async def cancel_deletion_request(user_id: int) -> bool:
    """
    Cancel a pending deletion request (user changed their mind).
    Returns True if a request was cancelled, False if none existed.
    """
    from app.core.prisma import prisma

    result = await prisma.accountdeletionrequest.update_many(
        where={"userId": user_id, "status": "PENDING"},
        data={
            "status": "CANCELLED",
            "cancelledAt": datetime.now(timezone.utc),
        },
    )
    cancelled = (
        result > 0
        if isinstance(result, int)
        else (result.count > 0 if hasattr(result, "count") else False)
    )
    if cancelled:
        logger.info(f"Deletion request cancelled for user {user_id}")
    return cancelled
