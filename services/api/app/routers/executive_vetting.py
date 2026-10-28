"""
TamWheel Sovereign Ethical Agentic Venture OS — Executive Vetting & Officer Disqualification Router.
Exposes endpoints for:
1. Full background check of founders & executive officers (NIN, CNRC blacklist, bankruptcy, mandates)
2. Direct lookup in CNRC Official Disqualification Register (Fichier National des Fraudeurs)
3. Corporate mandate limit and non-compete conflict audit (Art. 615 & 569 Code de Commerce)
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.executive_vetting import (
    ExecutiveVettingRequest,
    ExecutiveVettingResponse,
    DisqualificationCheckRequest,
    DisqualificationCheckResponse,
    MandatesCheckRequest,
    MandatesCheckResponse,
)
from app.services.executive_vetting_service import executive_vetting_service

logger = logging.getLogger("tamwheel.routers.executive_vetting")

router = APIRouter(prefix="/diligence/executives", tags=["Executive Vetting & Officer Disqualification"])


@router.post(
    "/vet",
    response_model=ExecutiveVettingResponse,
    summary="Comprehensive background and disqualification audit for executive officer",
)
async def vet_executive_officer(request: ExecutiveVettingRequest):
    """
    Execute exhaustive executive officer diligence:
    - Validate 18-digit Algerian National Identification Number (NIN)
    - Cross-check CNRC Disqualification Register (Fichier National des Fraudeurs - Law 04-08)
    - Check commercial court insolvency, liquidation, and manager liability rulings
    - Verify SPA 5-mandate limit (Art. 615) and SARL Gérant non-compete obligations (Art. 569)
    - Generate risk score, verdict, and condition precedents
    """
    try:
        return executive_vetting_service.vet_executive(request)
    except Exception as e:
        logger.error(f"Executive vetting failed for {request.fullName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Executive vetting failed: {str(e)}",
        )


@router.post(
    "/disqualification-check",
    response_model=DisqualificationCheckResponse,
    summary="Instant check against CNRC Official Disqualification Register",
)
async def check_officer_disqualification(request: DisqualificationCheckRequest):
    """
    Check if individual has an active managing ban (Interdiction de gérer),
    personal bankruptcy (Faillite personnelle), or tax fraud blacklisting.
    """
    try:
        return executive_vetting_service.check_disqualification_only(request)
    except Exception as e:
        logger.error(f"Disqualification check failed for {request.fullName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disqualification check failed: {str(e)}",
        )


@router.post(
    "/mandates-check",
    response_model=MandatesCheckResponse,
    summary="Check corporate mandate limits and conflict of interest",
)
async def check_officer_mandates(request: MandatesCheckRequest):
    """
    Audit concurrent directorship mandates across Algerian SPA and SARL entities.
    Checks statutory compliance with Articles 615 and 569 of Algerian Commercial Code.
    """
    try:
        return executive_vetting_service.check_mandates_only(request)
    except Exception as e:
        logger.error(f"Mandates check failed for {request.officerName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mandates check failed: {str(e)}",
        )
