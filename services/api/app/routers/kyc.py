import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_active_user
from app.core.rbac import require_permissions
from app.services.kyc_service import kyc_service

router = APIRouter(prefix="/kyc", tags=["KYC"])
logger = logging.getLogger(__name__)


class KycSubmitRequest(BaseModel):
    national_id_number: Optional[str] = None
    anae_card_number: Optional[str] = None
    anae_certificate_url: Optional[str] = None
    rib_ccp_number: Optional[str] = None


class KycReviewRequest(BaseModel):
    user_id: int
    status: str  # APPROVED | REJECTED
    rejection_reason: Optional[str] = None


@router.get("/me")
async def get_my_kyc(current_user=Depends(get_current_active_user)):
    """Get current user's KYC verification profile."""
    return await kyc_service.get_user_kyc(current_user.id)


@router.post("/submit")
async def submit_kyc(
    req: KycSubmitRequest,
    current_user=Depends(get_current_active_user),
):
    """Submit or update user KYC (ANAE, National ID, RIB/CCP)."""
    try:
        return await kyc_service.submit_kyc(
            user_id=current_user.id,
            national_id_number=req.national_id_number,
            anae_card_number=req.anae_card_number,
            anae_certificate_url=req.anae_certificate_url,
            rib_ccp_number=req.rib_ccp_number,
        )
    except Exception as e:
        logger.error(f"Failed to submit KYC: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Failed to submit KYC documentation",
                "code": "KYC_SUBMIT_FAILED",
            },
        )


@router.post("/admin/review")
async def review_kyc(
    req: KycReviewRequest,
    admin=Depends(require_permissions("kyc:review")),
):
    """Admin review of submitted KYC."""
    try:
        return await kyc_service.review_kyc(
            user_id=req.user_id,
            status=req.status,
            admin_id=admin.id,
            rejection_reason=req.rejection_reason,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": str(e), "code": "INVALID_STATUS"},
        )
    except LookupError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": str(e), "code": "KYC_NOT_FOUND"},
        )
    except Exception as e:
        logger.error(f"Failed to review KYC: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Failed to process KYC review",
                "code": "KYC_REVIEW_FAILED",
            },
        )
