"""
TamWheel Sovereign Ethical Agentic Venture OS — INAPI IP Provenance Router.
Exposes endpoints for:
1. Patent application, BOPI gazette publication, and annuity validity verification (Ordinance 03-07)
2. Trademark Nice Classification and protection term validation (Ordinance 03-06)
3. Full startup IP portfolio audit, IP Moat Index calculation, and verified badge issuance
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.inapi_ip import (
    PatentVerificationRequest,
    PatentVerificationResponse,
    TrademarkVerificationRequest,
    TrademarkVerificationResponse,
    IPOldPortfolioAuditRequest,
    IPOldPortfolioAuditResponse,
)
from app.services.inapi_ip_verifier import inapi_ip_verifier

logger = logging.getLogger("tamwheel.routers.inapi_ip")

router = APIRouter(prefix="/diligence/inapi", tags=["INAPI Patent & Industrial IP Verification"])


@router.post(
    "/verify-patent",
    response_model=PatentVerificationResponse,
    summary="Verify patent number syntax, BOPI gazette publication, and annuity maintenance",
)
async def verify_patent_claim(request: PatentVerificationRequest):
    """
    Validate claimed patent against official INAPI criteria:
    - Number syntax (DZ/P/YYYY/XXXXXX, legacy DZ/YYYY/XXXX, P/YYYY/XXXXXX)
    - IPC classification validity
    - Paris Convention 12-month priority period
    - 20-year statutory term & 6-month late surcharge grace period
    - Issue verified IP Moat Badges
    """
    try:
        return inapi_ip_verifier.verify_patent(request)
    except Exception as e:
        logger.error(f"Patent verification failed for {request.patent.patentNumber}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Patent verification failed: {str(e)}",
        )


@router.post(
    "/verify-trademark",
    response_model=TrademarkVerificationResponse,
    summary="Verify trademark registration, Nice classification, and 10-year term renewal",
)
async def verify_trademark_claim(request: TrademarkVerificationRequest):
    """
    Validate claimed trademark against official INAPI criteria:
    - Number formatting (DZ/M/YYYY/XXXXXX)
    - Nice Classification classes (Classes 1-45), checking for tech classes (9, 35, 36, 38, 42)
    - 10-year term and renewal status under Ordinance 03-06
    """
    try:
        return inapi_ip_verifier.verify_trademark(request)
    except Exception as e:
        logger.error(f"Trademark verification failed for {request.trademark.registrationNumber}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trademark verification failed: {str(e)}",
        )


@router.post(
    "/audit-portfolio",
    response_model=IPOldPortfolioAuditResponse,
    summary="Audit complete IP portfolio and compute defensibility IP Moat Index",
)
async def audit_ip_portfolio(request: IPOldPortfolioAuditRequest):
    """
    Conduct thorough intellectual property portfolio audit:
    - Verifies all claimed patents and trademarks
    - Computes defensibility IP Moat Index [0.0 - 100.0]
    - Categorizes into Moat Tier (DEEP_TECH_TIER_1, DEEP_TECH_DEFENSIBLE, MODEST, UNPROTECTED)
    - Generates verified badges for founder profiles and data rooms
    """
    try:
        return inapi_ip_verifier.audit_portfolio(request)
    except Exception as e:
        logger.error(f"IP portfolio audit failed for startup {request.startupId}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"IP portfolio audit failed: {str(e)}",
        )
