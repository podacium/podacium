"""
TamWheel Virtual Data Room (VDR) & Dynamic Watermarking Router (Pillars 3 & 10).
Carta, SecureDocs, and Datasite-compliant multi-tier document room, clickwrap NDA lifecycle,
forensic watermark overlay generation, and engagement telemetry.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import get_current_active_user
from app.services.vdr_engine import vdr_engine
from app.services.saas_subscription import saas_subscription_engine
from app.schemas.vdr import (
    VDRDocumentCreateRequest,
    VDRDocumentResponse,
    VDRWatermarkedDocumentResponse,
    VDRAccessApplyRequest,
    VDRAccessReviewRequest,
    VDRAccessRevokeRequest,
    VDRAccessRequestResponse,
    VDRLogViewRequest,
    VDRAuditLogResponse,
    VDRAnalyticsSummaryResponse,
    AuditLogAction,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vdr", tags=["Virtual Data Room (VDR)"])


def _extract_client_info(request: Request) -> tuple[str, str]:
    """Helper to extract IP and User-Agent from FastAPI request."""
    client_ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else "127.0.0.1"
    )
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "Unknown-Browser")
    return client_ip, user_agent


@router.post("/startups/{startup_id}/documents", response_model=VDRDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_vdr_document(
    startup_id: str,
    req: VDRDocumentCreateRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """
    Upload and register a document in the startup's VDR under a designated tier.
    Validates SaaS subscription storage and tier permissions.
    """
    try:
        # Check storage and tier entitlements
        entitlement = saas_subscription_engine.validate_vdr_storage_capacity(
            startup_id=startup_id,
            additional_bytes=req.file_size_bytes,
            document_tier=req.tier,
        )
        if not entitlement.allowed:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=entitlement.message,
            )

        client_ip, user_agent = _extract_client_info(request)
        doc = vdr_engine.upload_document(
            startup_id=startup_id,
            req=req,
            uploader_id=str(current_user.id),
            uploader_email=getattr(current_user, "email", "founder@startup.dz"),
            client_ip=client_ip,
            user_agent=user_agent,
        )

        # Update SaaS storage telemetry
        sub = saas_subscription_engine.get_subscription(startup_id)
        saas_subscription_engine.update_usage(
            startup_id=startup_id,
            vdr_storage_bytes=sub.current_vdr_storage_bytes + req.file_size_bytes,
        )

        return VDRDocumentResponse(
            document=doc,
            is_accessible=True,
            required_tier=doc.tier,
            user_highest_tier=doc.tier,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload VDR document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload VDR document: {str(e)}",
        )


@router.get("/startups/{startup_id}/documents", response_model=List[VDRDocumentResponse])
async def list_vdr_documents(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    List all documents in the VDR with dynamic accessibility flags based on the viewer's
    active NDA and granted clearance tier.
    """
    try:
        is_founder = getattr(current_user, "role", "") in ["ADMIN", "FOUNDER"]
        documents = vdr_engine.list_documents(
            startup_id=startup_id,
            user_id=str(current_user.id),
            is_founder=is_founder,
        )
        return documents
    except Exception as e:
        logger.error(f"Failed to list VDR documents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list VDR documents: {str(e)}",
        )


@router.get("/startups/{startup_id}/documents/{document_id}", response_model=VDRWatermarkedDocumentResponse)
async def get_watermarked_document(
    startup_id: str,
    document_id: str,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """
    Fetch an authorized document with an immutable dynamic forensic watermark
    (viewer email, IP, timestamp, and legal NDA warning).
    """
    try:
        is_founder = getattr(current_user, "role", "") in ["ADMIN", "FOUNDER"]
        client_ip, user_agent = _extract_client_info(request)
        viewer_email = getattr(current_user, "email", "investor@tamwheel.dz")

        resp, err = vdr_engine.get_watermarked_document(
            startup_id=startup_id,
            document_id=document_id,
            user_id=str(current_user.id),
            viewer_email=viewer_email,
            client_ip=client_ip,
            user_agent=user_agent,
            is_founder=is_founder,
        )

        if err:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN if "Access Denied" in err else status.HTTP_404_NOT_FOUND,
                detail=err,
            )

        return resp
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve watermarked document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve watermarked document: {str(e)}",
        )


@router.post("/startups/{startup_id}/documents/{document_id}/log-view", response_model=VDRAuditLogResponse)
async def log_vdr_document_activity(
    startup_id: str,
    document_id: str,
    req: VDRLogViewRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """Record view duration, download attempts, and telemetry for audit trails."""
    try:
        client_ip, user_agent = _extract_client_info(request)
        viewer_email = getattr(current_user, "email", "investor@tamwheel.dz")

        log_entry = vdr_engine.log_activity(
            startup_id=startup_id,
            document_id=document_id,
            user_id=str(current_user.id),
            user_email=viewer_email,
            action=req.action,
            view_duration_seconds=req.view_duration_seconds,
            client_ip=client_ip,
            user_agent=user_agent,
            metadata=req.metadata,
        )
        return log_entry
    except Exception as e:
        logger.error(f"Failed to log VDR activity: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log activity: {str(e)}",
        )


@router.post("/startups/{startup_id}/access-requests", response_model=VDRAccessRequestResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_vdr_access(
    startup_id: str,
    req: VDRAccessApplyRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """
    Request access to Tier 2 (Financials/G50) or Tier 3 (Cap Table/ESOP) VDR.
    Executes a binding Algerian clickwrap NDA agreement.
    """
    try:
        client_ip, user_agent = _extract_client_info(request)
        access_req = vdr_engine.apply_for_access(
            startup_id=startup_id,
            user_id=str(current_user.id),
            req=req,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        return access_req
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Failed to apply for VDR access: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply for VDR access: {str(e)}",
        )


@router.get("/startups/{startup_id}/access-requests", response_model=List[VDRAccessRequestResponse])
async def list_vdr_access_requests(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """List all access requests for founder evaluation."""
    try:
        return vdr_engine.list_access_requests(startup_id)
    except Exception as e:
        logger.error(f"Failed to list VDR access requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list access requests: {str(e)}",
        )


@router.post("/startups/{startup_id}/access-requests/{request_id}/review", response_model=VDRAccessRequestResponse)
async def review_vdr_access_request(
    startup_id: str,
    request_id: str,
    req: VDRAccessReviewRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """Founder review: approve or reject an investor's VDR access request."""
    try:
        client_ip, user_agent = _extract_client_info(request)
        reviewed = vdr_engine.review_access_request(
            startup_id=startup_id,
            request_id=request_id,
            reviewer_id=str(current_user.id),
            review=req,
            reviewer_email=getattr(current_user, "email", "founder@startup.dz"),
            client_ip=client_ip,
            user_agent=user_agent,
        )
        if not reviewed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Access request not found",
            )
        return reviewed
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to review VDR access request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to review access request: {str(e)}",
        )


@router.post("/startups/{startup_id}/access-requests/{request_id}/revoke", response_model=VDRAccessRequestResponse)
async def revoke_vdr_access(
    startup_id: str,
    request_id: str,
    req: VDRAccessRevokeRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """Immediately revoke access clearance for an investor."""
    try:
        client_ip, user_agent = _extract_client_info(request)
        revoked = vdr_engine.revoke_access(
            startup_id=startup_id,
            request_id=request_id,
            reviewer_id=str(current_user.id),
            reason=req.reason,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        if not revoked:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Access request not found",
            )
        return revoked
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke VDR access: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke access: {str(e)}",
        )


@router.get("/startups/{startup_id}/audit-logs", response_model=List[VDRAuditLogResponse])
async def get_vdr_audit_logs(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """Retrieve complete, immutable forensic audit trail for the data room."""
    try:
        return vdr_engine.get_audit_trail(startup_id)
    except Exception as e:
        logger.error(f"Failed to fetch audit logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit logs: {str(e)}",
        )


@router.get("/startups/{startup_id}/analytics", response_model=VDRAnalyticsSummaryResponse)
async def get_vdr_analytics(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """Retrieve aggregated engagement telemetry, view counts, and popular documents."""
    try:
        return vdr_engine.get_analytics_summary(startup_id)
    except Exception as e:
        logger.error(f"Failed to fetch VDR analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics: {str(e)}",
        )
