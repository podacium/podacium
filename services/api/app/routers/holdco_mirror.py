"""
FastAPI Router for Cross-Border Dual HoldCo / OpCo Mirroring Engine.
Mounted under `/api/v1/cap-table/holdco-mirror`.
"""

import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.services.holdco_mirror_engine import holdco_mirror_engine
from app.schemas.holdco_mirror import (
    HoldCoMirrorSetupRequest,
    HoldCoShareIssuanceRequest,
    CrossBorderMirrorStatus,
    FDIRegulatoryFilingRequest,
    FDIRegulatoryFilingRecord,
    TransferPricingAgreementRequest,
    TransferPricingAgreementResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cap-table/holdco-mirror", tags=["Cross-Border HoldCo/OpCo Mirroring"])


@router.post(
    "/setup",
    response_model=CrossBorderMirrorStatus,
    status_code=status.HTTP_201_CREATED,
    summary="Configure cross-border offshore HoldCo to Algerian SPAS mirror",
    description="Sets up HoldCo (ADGM, Delaware, UK) mirror parity ratio, currency FX, and authorized shares.",
)
async def setup_holdco_mirror(
    req: HoldCoMirrorSetupRequest,
    current_user: Any = Depends(get_current_active_user),
) -> CrossBorderMirrorStatus:
    try:
        return holdco_mirror_engine.setup_mirror(req)
    except Exception as e:
        logger.error(f"Failed to setup HoldCo mirror: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"HoldCo mirror setup failed: {str(e)}",
        )


@router.post(
    "/issue-shares",
    response_model=CrossBorderMirrorStatus,
    status_code=status.HTTP_201_CREATED,
    summary="Issue offshore HoldCo shares and synchronize Algerian OpCo SPAS shares",
    description="Issues shares at HoldCo level, maps beneficial units to OpCo, and verifies parity.",
)
async def issue_holdco_shares(
    req: HoldCoShareIssuanceRequest,
    current_user: Any = Depends(get_current_active_user),
) -> CrossBorderMirrorStatus:
    try:
        return holdco_mirror_engine.issue_holdco_shares(req)
    except Exception as e:
        logger.error(f"Failed to issue HoldCo shares: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"HoldCo share issuance failed: {str(e)}",
        )


@router.get(
    "/{startup_id}/status",
    response_model=CrossBorderMirrorStatus,
    summary="Retrieve cross-border mirror cap table status and equity leakage audit",
)
async def get_mirror_status(
    startup_id: str,
    current_user: Any = Depends(get_current_active_user),
) -> CrossBorderMirrorStatus:
    try:
        return holdco_mirror_engine.get_mirror_status(startup_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/fdi/filing",
    response_model=FDIRegulatoryFilingRecord,
    status_code=status.HTTP_201_CREATED,
    summary="File Foreign Direct Investment (FDI) notice under Banque d'Algérie Regulation 07-01",
    description="Records capital importation in foreign currency and computes DZD retrocession attestation.",
)
async def record_fdi_filing(
    req: FDIRegulatoryFilingRequest,
    current_user: Any = Depends(get_current_active_user),
) -> FDIRegulatoryFilingRecord:
    try:
        return holdco_mirror_engine.record_fdi_filing(req)
    except Exception as e:
        logger.error(f"Failed to record FDI filing: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FDI filing failed: {str(e)}",
        )


@router.get(
    "/{startup_id}/fdi/filings",
    response_model=List[FDIRegulatoryFilingRecord],
    summary="List all FDI regulatory filings for a startup",
)
async def list_fdi_filings(
    startup_id: str,
    current_user: Any = Depends(get_current_active_user),
) -> List[FDIRegulatoryFilingRecord]:
    return holdco_mirror_engine.get_fdi_filings_for_startup(startup_id)


@router.post(
    "/transfer-pricing/generate-agreement",
    response_model=TransferPricingAgreementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Sharia-compliant (Ijarah) Transfer Pricing & IP Licensing Agreement",
    description="Generates bilateral contract compliant with CIDTA Art. 169 bis arm's length principles and DTT WHT rates.",
)
async def generate_transfer_pricing_agreement(
    req: TransferPricingAgreementRequest,
    current_user: Any = Depends(get_current_active_user),
) -> TransferPricingAgreementResponse:
    try:
        return holdco_mirror_engine.generate_transfer_pricing_agreement(req)
    except Exception as e:
        logger.error(f"Failed to generate transfer pricing agreement: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer pricing agreement generation failed: {str(e)}",
        )


@router.get(
    "/transfer-pricing/agreements/{agreement_id}",
    response_model=TransferPricingAgreementResponse,
    summary="Retrieve generated Transfer Pricing Agreement by ID",
)
async def get_transfer_pricing_agreement(
    agreement_id: str,
    current_user: Any = Depends(get_current_active_user),
) -> TransferPricingAgreementResponse:
    agreement = holdco_mirror_engine.get_agreement(agreement_id)
    if not agreement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agreement '{agreement_id}' not found.",
        )
    return agreement
