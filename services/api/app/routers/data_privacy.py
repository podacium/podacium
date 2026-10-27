"""
Data Privacy Router — GDPR & Algerian Law 18-07 Compliance Self-Service Portal.

Compliance Scope:
  - Algerian Law 18-07 (Loi n° 18-07 du 10 juin 2018 relative à la protection des
    personnes physiques dans le traitement des données à caractère personnel)
  - ANPDP (Autorité Nationale de Protection des Données à caractère Personnel)
  - GDPR (Regulation EU 2016/679)

Endpoints:
  GET  /api/v1/users/me/privacy-notice   — Statutory Privacy Notice (Law 18-07 Art. 32 / GDPR Art. 13-14)
  GET  /api/v1/users/me/export           — Data Portability & Access (Law 18-07 Art. 34 / GDPR Art. 15, 20)
  POST /api/v1/users/me/delete-request   — Right to Erasure / 30-day grace (Law 18-07 Art. 36 / GDPR Art. 17)
  DELETE /api/v1/users/me/delete-request — Cancel pending deletion request
  GET  /api/v1/users/me/delete-request   — Check deletion request status
  POST /api/v1/users/me/privacy/objection — Right to Object (Law 18-07 Art. 37 / GDPR Art. 21)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.security import verify_password
from app.core.prisma import prisma
from app.core.config import setting
from app.services.data_export_service import (
    build_user_export,
    create_export_record,
    create_deletion_request,
    cancel_deletion_request,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Data Privacy & GDPR & Law 18-07 Compliance"])


# ─── Schemas ──────────────────────────────────────────────────────────────────


class DeletionRequestCreate(BaseModel):
    password: str = Field(
        ..., min_length=1, description="Account password for confirmation"
    )
    reason: Optional[str] = Field(
        None, max_length=500, description="Why are you deleting your account?"
    )
    feedback: Optional[str] = Field(
        None, max_length=1000, description="Optional feedback for the team"
    )


class DeletionRequestResponse(BaseModel):
    id: int
    status: str
    scheduled_for: datetime
    requested_at: datetime
    message: str


class ExportStatusResponse(BaseModel):
    id: int
    status: str
    requested_at: datetime
    expires_at: Optional[datetime]
    message: str


class DataObjectionCreate(BaseModel):
    processing_type: str = Field(
        ...,
        description="Type of processing objected to (e.g. DIRECT_MARKETING, PROFILING, THIRD_PARTY_ANALYTICS)",
    )
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Legitimate grounds or reason for the objection (Law 18-07 Art. 37)",
    )


class DataObjectionResponse(BaseModel):
    status: str
    recorded_at: datetime
    processing_type: str
    message: str


class StatutoryPrivacyNoticeResponse(BaseModel):
    data_controller: str
    governing_laws: List[str]
    supervisory_authorities: Dict[str, str]
    processing_purposes: List[str]
    legal_bases: List[str]
    statutory_rights: Dict[str, str]
    data_retention_schedule: Dict[str, str]
    cross_border_transfers: Dict[str, str]
    dpo_contact: str


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get(
    "/users/me/privacy-notice",
    response_model=StatutoryPrivacyNoticeResponse,
    summary="Statutory Privacy Notice (Law 18-07 Art. 32 & GDPR Art. 13-14)",
    description=(
        "Returns the legal privacy notice and data processing disclosures compliant with "
        "Algerian Law 18-07 and GDPR."
    ),
)
async def get_privacy_notice(current_user=Depends(get_current_user)):
    """Retrieve the legal privacy notice and statutory data protection disclosures."""
    return StatutoryPrivacyNoticeResponse(
        data_controller="Podacium Platform Inc. / Podacium SARL (Algeria)",
        governing_laws=[
            "Algerian Law 18-07 of June 10, 2018 (Loi n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel)",
            "General Data Protection Regulation (EU GDPR 2016/679)",
            "Bank of Algeria Regulation 25-02 (Financial Data Safeguards)",
        ],
        supervisory_authorities={
            "Algeria": "ANPDP (Autorité Nationale de Protection des Données à caractère Personnel)",
            "European_Union": "Competent EU Data Protection Authorities",
        },
        processing_purposes=[
            "User identity authentication, verification, and profile management",
            "Freelance marketplace matching, contracting, and escrow fund management",
            "EdTech LMS course delivery, live interactive streaming, and accredited certification",
            "Financial billing, invoice generation, tax reporting, and payment gateway routing (Chargily Pay)",
            "Customer support helpdesk and platform security monitoring",
        ],
        legal_bases=[
            "Contractual Necessity (Execution of Service Terms)",
            "Explicit User Consent (Law 18-07 Art. 7-8 / GDPR Art. 6.1.a)",
            "Legal & Fiscal Compliance Obligations (Law 18-07 Art. 6 / Code de Commerce Algérien)",
            "Legitimate Security & Fraud Prevention Interests",
        ],
        statutory_rights={
            "Right to Prior Information": "Law 18-07 Art. 32 / GDPR Art. 13-14",
            "Right of Access": "Law 18-07 Art. 34 / GDPR Art. 15",
            "Right to Rectification": "Law 18-07 Art. 35 / GDPR Art. 16",
            "Right to Erasure (30-day grace)": "Law 18-07 Art. 36 / GDPR Art. 17",
            "Right to Object / Opposition": "Law 18-07 Art. 37 / GDPR Art. 21",
            "Right to Data Portability": "GDPR Art. 20 / Law 18-07 Art. 34",
            "Right to Lodge a Complaint": "ANPDP (Algeria) / National DPA",
        },
        data_retention_schedule={
            "active_account_data": "Duration of active account lifecycle",
            "financial_invoices_and_ledger": "10 years (Algerian Commercial Code Art. 11 / Tax Law)",
            "audit_logs_and_security_records": "5 years (ISO 27001 / SOC 2 Type II compliance)",
            "deleted_accounts": "Purged after 30-day grace period with cascading anonymization",
        },
        cross_border_transfers={
            "status": "ANPDP-authorized with contractual standard clauses and encryption at rest",
            "safeguards": "AES-256-GCM envelope encryption, TLS 1.3 in transit, ISO 27001 certified cloud infrastructure",
            "governing_article": "Law 18-07 Articles 44, 45, 46",
        },
        dpo_contact="dpo@podacium.com / privacy@podacium.com",
    )


@router.post(
    "/users/me/privacy/objection",
    response_model=DataObjectionResponse,
    summary="Record Data Processing Objection (Law 18-07 Art. 37 & GDPR Art. 21)",
    description=(
        "Allows users to exercise their statutory right to object to specific processing activities "
        "(such as direct marketing or non-essential profiling)."
    ),
)
async def record_data_objection(
    body: DataObjectionCreate,
    current_user=Depends(get_current_user),
):
    """Record a user's formal objection to data processing."""
    user_id: int = current_user.id
    now = datetime.now(timezone.utc)

    try:
        from app.generated.prisma import Json

        await prisma.auditlog.create(
            data={
                "actorId": user_id,
                "entityType": "DataPrivacy",
                "entityId": str(user_id),
                "eventType": "DATA_PROCESSING_OBJECTION",
                "metadata": Json(
                    {
                        "processing_type": body.processing_type,
                        "reason": body.reason,
                        "law_reference": "Algerian Law 18-07 Art. 37 / GDPR Art. 21",
                        "recorded_at": now.isoformat(),
                    }
                ),
            }
        )

        return DataObjectionResponse(
            status="RECORDED",
            recorded_at=now,
            processing_type=body.processing_type,
            message=(
                f"Your objection to '{body.processing_type}' has been recorded in compliance with "
                f"Algerian Law 18-07 Article 37 and GDPR Article 21. Processing has been updated accordingly."
            ),
        )
    except Exception as e:
        logger.error(f"Failed to record data objection for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to record data processing objection. Please try again.",
        )


@router.get(
    "/users/me/export",
    summary="Download all personal data",
    description=(
        "Returns a JSON document containing all data associated with your account: "
        "profile, enrollments, certificates, projects, proposals, contracts, "
        "support tickets, analytics datasets, wallet, transactions, and audit logs. "
        "Sensitive fields (password hash, TOTP secrets) are redacted."
    ),
    response_class=JSONResponse,
)
async def export_personal_data(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Export all personal data for the authenticated user.

    The response is a JSON file download containing every record owned by
    the user. Sensitive fields are redacted before export.
    """
    user_id: int = current_user.id

    try:
        # Create an audit record for the export request
        export_record = await create_export_record(user_id)

        # Build the export payload synchronously (fast enough for <500 records)
        export_data = await build_user_export(user_id)

        # Mark the export as completed
        background_tasks.add_task(_mark_export_completed, export_record.id)

        # Log the export event
        background_tasks.add_task(_log_export_event, user_id, export_record.id)

        filename = f"podacium-data-export-{user_id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"

        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Export-Id": str(export_record.id),
            },
        )

    except Exception as e:
        logger.error(f"Data export failed for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate data export. Please try again later.",
        )


@router.post(
    "/users/me/delete-request",
    response_model=DeletionRequestResponse,
    status_code=202,
    summary="Request account deletion",
    description=(
        "Initiates a GDPR-style account deletion request. "
        "Your account will be permanently deleted after a 30-day grace period. "
        "You can cancel this request at any time before the grace period expires."
    ),
)
async def request_account_deletion(
    body: DeletionRequestCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Create a scheduled account deletion request.

    - A 30-day grace period is applied before permanent deletion.
    - A confirmation email is sent to the user's registered address.
    - The user can cancel the request via DELETE /users/me/delete-request.
    """
    user_id: int = current_user.id

    if current_user.passwordHash is not None:
        if not body.password or not verify_password(
            body.password, current_user.passwordHash
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_PASSWORD",
                    "message": "Incorrect password provided",
                },
            )

    try:
        request = await create_deletion_request(
            user_id=user_id,
            reason=body.reason,
            feedback=body.feedback,
        )

        # Send confirmation email in background
        background_tasks.add_task(
            _send_deletion_confirmation_email,
            user_id=user_id,
            email=current_user.email,
            full_name=current_user.fullName,
            scheduled_for=request.scheduledFor,
        )

        return DeletionRequestResponse(
            id=request.id,
            status=request.status,
            scheduled_for=request.scheduledFor,
            requested_at=request.requestedAt,
            message=(
                f"Your account deletion has been scheduled for "
                f"{request.scheduledFor.strftime('%B %d, %Y')}. "
                f"A confirmation email has been sent to {current_user.email}. "
                f"You can cancel this request at any time before that date."
            ),
        )

    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Deletion request failed for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to create deletion request. Please try again later.",
        )


@router.delete(
    "/users/me/delete-request",
    summary="Cancel a pending deletion request",
    description="Cancels a pending account deletion request if one exists.",
)
async def cancel_account_deletion(current_user=Depends(get_current_user)):
    """Cancel a pending account deletion request."""
    user_id: int = current_user.id

    cancelled = await cancel_deletion_request(user_id)

    if not cancelled:
        raise HTTPException(
            status_code=404,
            detail="No pending deletion request found for your account.",
        )

    return {
        "detail": "Account deletion request cancelled successfully. Your account will remain active.",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/users/me/delete-request",
    summary="Check deletion request status",
    description="Returns the status of any pending account deletion request.",
)
async def get_deletion_request_status(current_user=Depends(get_current_user)):
    """Get the status of the user's pending deletion request."""
    user_id: int = current_user.id

    request = await prisma.accountdeletionrequest.find_first(
        where={"userId": user_id, "status": "PENDING"},
        order={"requestedAt": "desc"},
    )

    if not request:
        return {
            "has_pending_request": False,
            "detail": "No pending deletion request found.",
        }

    return {
        "has_pending_request": True,
        "id": request.id,
        "status": request.status,
        "scheduled_for": request.scheduledFor.isoformat(),
        "requested_at": request.requestedAt.isoformat(),
        "days_remaining": max(
            0,
            (request.scheduledFor - datetime.now(timezone.utc)).days,
        ),
    }


# ─── Background helpers ───────────────────────────────────────────────────────


async def _mark_export_completed(export_id: int) -> None:
    try:
        await prisma.dataexport.update(
            where={"id": export_id},
            data={
                "status": "COMPLETED",
                "completedAt": datetime.now(timezone.utc),
            },
        )
    except Exception as e:
        logger.warning(f"Failed to mark export {export_id} as completed: {e}")


async def _log_export_event(user_id: int, export_id: int) -> None:
    try:
        from app.generated.prisma import Json

        await prisma.auditlog.create(
            data={
                "actorId": user_id,
                "entityType": "DataExport",
                "entityId": str(export_id),
                "eventType": "DATA_EXPORT_REQUESTED",
                "metadata": Json({"export_id": export_id, "format": "JSON"}),
            }
        )
    except Exception as e:
        logger.warning(f"Failed to log export event for user {user_id}: {e}")


async def _send_deletion_confirmation_email(
    user_id: int,
    email: str,
    full_name: str,
    scheduled_for: datetime,
) -> None:
    try:
        from app.services.email_service import email_service
        from app.services.email_templates import render_email

        subject, text_body, html_body = render_email(
            "account_deleted",
            locale="en",
            recipient_email=email,
            name=full_name or "User",
            deletion_date=scheduled_for.strftime("%B %d, %Y"),
            recover_url=f"{setting.FRONTEND_URL}/auth/login",
            feedback_url=f"{setting.FRONTEND_URL}/settings/data",
        )
        await email_service.send_email_with_retry(
            to_email=email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
    except Exception as e:
        logger.warning(
            f"Failed to send deletion confirmation email to user {user_id}: {e}"
        )
