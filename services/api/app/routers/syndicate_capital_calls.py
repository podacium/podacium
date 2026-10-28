"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate Capital Calls & Drawdowns Router.
Exposes endpoints for:
1. LP capital commitments and uncalled dry powder tracking.
2. Tranche-based capital call notice generation (pro-rata, Algerian RIB, SWIFT/IBAN).
3. LP wire settlement recording.
4. Delinquent LP evaluation (Waqf default interest penalty, voting suspension).
5. Non-defaulting LP step-in cure and haircut secondary transfers.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.capital_call_engine import (
    capital_call_engine,
    LPCommitment,
    CapitalCallNotice,
    LPCapitalCallItem,
    DelinquentResolution,
    CommitmentStatus,
    CallNoticeStatus,
    LPPaymentStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/syndicates/capital-calls", tags=["Syndicate Capital Calls & Drawdowns"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class RegisterCommitmentRequest(BaseModel):
    spv_id: str
    lp_id: str
    lp_name: str
    lp_email: str
    committed_amount_dzd: float = Field(..., gt=0.0)
    is_diaspora: bool = False
    residence_country: str = "DZ"
    units_allocated: int = Field(default=0, ge=0)


class CreateCallNoticeRequest(BaseModel):
    spv_id: str
    spv_name: str
    total_call_amount_dzd: float = Field(..., gt=0.0)
    tranche_title: str
    purpose_description: str
    tranche_number: int = Field(default=1, ge=1)
    due_date_business_days: int = Field(default=10, ge=1)
    grace_period_days: int = Field(default=5, ge=1)
    domestic_rib: Optional[str] = None
    swift_bic: Optional[str] = None
    iban: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    lp_id: str
    amount_paid_dzd: float = Field(..., gt=0.0)
    payment_reference: str


class CureDelinquentRequest(BaseModel):
    delinquent_lp_id: str
    curing_lp_contributions: Dict[str, float]
    haircut_discount_pct: float = Field(default=30.0, ge=0.0, le=90.0)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/commitments",
    response_model=LPCommitment,
    summary="Register LP binding capital commitment",
)
async def register_lp_commitment(
    req: RegisterCommitmentRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> LPCommitment:
    try:
        return capital_call_engine.register_lp_commitment(
            spv_id=req.spv_id,
            lp_id=req.lp_id,
            lp_name=req.lp_name,
            lp_email=req.lp_email,
            committed_amount_dzd=req.committed_amount_dzd,
            is_diaspora=req.is_diaspora,
            residence_country=req.residence_country,
            units_allocated=req.units_allocated,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error registering LP commitment: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/commitments/{spv_id}",
    summary="Get SPV commitments and dry powder summary",
)
async def get_spv_commitments(
    spv_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    summary = capital_call_engine.get_spv_commitment_summary(spv_id)
    commitments = capital_call_engine.get_commitments(spv_id)
    return {
        "summary": summary,
        "commitments": [c.model_dump() for c in commitments],
    }


@router.post(
    "/notices",
    response_model=CapitalCallNotice,
    summary="Issue a tranche-based Capital Call Notice",
)
async def create_capital_call_notice(
    req: CreateCallNoticeRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CapitalCallNotice:
    try:
        return capital_call_engine.create_capital_call_notice(
            spv_id=req.spv_id,
            spv_name=req.spv_name,
            total_call_amount_dzd=req.total_call_amount_dzd,
            tranche_title=req.tranche_title,
            purpose_description=req.purpose_description,
            tranche_number=req.tranche_number,
            due_date_business_days=req.due_date_business_days,
            grace_period_days=req.grace_period_days,
            domestic_rib=req.domestic_rib,
            swift_bic=req.swift_bic,
            iban=req.iban,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating capital call notice: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/notices/{notice_id}",
    response_model=CapitalCallNotice,
    summary="Get Capital Call Notice details",
)
async def get_capital_call_notice(
    notice_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CapitalCallNotice:
    notice = capital_call_engine.get_notice(notice_id)
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Notice '{notice_id}' not found.")
    return notice


@router.post(
    "/notices/{notice_id}/payments",
    response_model=CapitalCallNotice,
    summary="Record wire remittance settlement from LP",
)
async def record_lp_payment(
    notice_id: str,
    req: RecordPaymentRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CapitalCallNotice:
    try:
        return capital_call_engine.record_lp_payment(
            notice_id=notice_id,
            lp_id=req.lp_id,
            amount_paid_dzd=req.amount_paid_dzd,
            payment_reference=req.payment_reference,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error recording LP payment: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/notices/{notice_id}/delinquencies/evaluate",
    summary="Evaluate delinquent LPs and apply Sharia Waqf penalty",
)
async def evaluate_delinquencies(
    notice_id: str,
    annualized_penalty_rate_pct: float = 8.0,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    try:
        delinquents = capital_call_engine.evaluate_and_flag_delinquencies(
            notice_id=notice_id,
            annualized_penalty_rate_pct=annualized_penalty_rate_pct,
        )
        notice = capital_call_engine.get_notice(notice_id)
        return {
            "notice_id": notice_id,
            "status": notice.status.value if notice else "UNKNOWN",
            "delinquent_count": len(delinquents),
            "delinquents": [d.model_dump() for d in delinquents],
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/notices/{notice_id}/delinquencies/cure",
    response_model=DelinquentResolution,
    summary="Execute step-in cure with secondary haircut transfer",
)
async def cure_delinquent_lp(
    notice_id: str,
    req: CureDelinquentRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DelinquentResolution:
    try:
        return capital_call_engine.resolve_delinquent_lp_secondary_haircut(
            notice_id=notice_id,
            delinquent_lp_id=req.delinquent_lp_id,
            curing_lp_contributions=req.curing_lp_contributions,
            haircut_discount_pct=req.haircut_discount_pct,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error curing delinquent LP: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
