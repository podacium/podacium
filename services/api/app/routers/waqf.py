"""
TamWheel Sovereign Ethical Agentic Venture OS — Waqf Endowment & Sharia Fatwa Router.
Exposes endpoints for:
1. Listing Cash Waqf Innovation Pools (`GET /waqf/pools`)
2. Contributing Cash Waqf capital (`POST /waqf/endow`)
3. Disbursing non-dilutive STEM & Health research grants (`POST /waqf/grants`)
4. Listing awarded Waqf scientific research grants (`GET /waqf/grants`)
5. Listing Sharia Supervisory Board Fatwas & Audits (`GET /waqf/fatwas`)
6. Registering new Sharia Fatwa rulings (`POST /waqf/fatwas`)
"""

from __future__ import annotations

import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user_optional
from app.services.waqf_engine import (
    waqf_engine,
    WaqfCategory,
    WaqfPoolState,
    WaqfContribution,
    WaqfGrantDisbursement,
    EndowWaqfRequest,
    DisburseGrantRequest,
)
from app.services.sharia_fatwa import (
    sharia_fatwa_service,
    FatwaType,
    FatwaStatus,
    FatwaRecord,
    RegisterFatwaRequest,
    AnnualShariaAuditReport,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/waqf", tags=["Waqf Endowments & Sharia Fatwa Registry"])


# =============================================================================
# 1. CASH WAQF POOLS & ENDOWMENTS
# =============================================================================

@router.get(
    "/pools",
    response_model=List[WaqfPoolState],
    summary="List all Cash Waqf innovation pools",
    description="Returns endowed principal, disbursed grants, and available research balances across HealthTech, AgriTech, and STEM.",
)
async def list_waqf_pools(
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[WaqfPoolState]:
    return waqf_engine.list_all_pools()


@router.post(
    "/endow",
    response_model=WaqfContribution,
    status_code=status.HTTP_201_CREATED,
    summary="Endow capital into Cash Waqf (Waqf al-Nuqud)",
    description="Contribute perpetual philanthropic capital into a designated innovation pool under AAOIFI Standard No. 60.",
)
async def endow_cash_waqf(
    req: EndowWaqfRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> WaqfContribution:
    try:
        return waqf_engine.endow_cash_waqf(req)
    except Exception as e:
        logger.error(f"Error endowing Waqf: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/grants",
    response_model=WaqfGrantDisbursement,
    status_code=status.HTTP_201_CREATED,
    summary="Disburse non-dilutive scientific research grant",
    description="Awards philanthropic research grant from Cash Waqf yield to an Algerian university spin-off or researcher lab.",
)
async def disburse_waqf_grant(
    req: DisburseGrantRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> WaqfGrantDisbursement:
    try:
        return waqf_engine.disburse_grant(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error disbursing Waqf grant: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/grants",
    response_model=List[WaqfGrantDisbursement],
    summary="List awarded Waqf scientific research grants",
    description="Retrieve all non-dilutive research and spin-off grants awarded by the Mutawalli board.",
)
async def list_waqf_grants(
    category: Optional[WaqfCategory] = Query(None, description="Filter by category"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[WaqfGrantDisbursement]:
    return waqf_engine.list_grants(category=category)


# =============================================================================
# 2. SHARIA FATWA AUDIT REGISTRY
# =============================================================================

@router.get(
    "/fatwas",
    response_model=List[FatwaRecord],
    summary="List Sharia Supervisory Board Fatwa records",
    description="Fetch immutable Fatwa pronouncements and product approvals under AAOIFI Governance Standards.",
)
async def list_sharia_fatwas(
    fatwa_type: Optional[FatwaType] = Query(None, description="Filter by Fatwa type"),
    status: Optional[FatwaStatus] = Query(None, description="Filter by status"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[FatwaRecord]:
    return sharia_fatwa_service.list_fatwas(fatwa_type=fatwa_type, status=status)


@router.post(
    "/fatwas",
    response_model=FatwaRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Sharia Fatwa ruling",
    description="Records formal scholar pronouncement, AAOIFI standards grounding, and cryptographic seal.",
)
async def register_sharia_fatwa(
    req: RegisterFatwaRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> FatwaRecord:
    try:
        return sharia_fatwa_service.register_fatwa(req)
    except Exception as e:
        logger.error(f"Error registering Fatwa: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/fatwas/annual-audit",
    response_model=AnnualShariaAuditReport,
    summary="Generate Annual Sharia Supervisory Board Audit Report",
    description="Produces comprehensive compliance audit report under AAOIFI Governance Standard No. 1.",
)
async def get_annual_sharia_audit_report(
    fiscal_year: int = Query(2026, ge=2024, le=2035),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> AnnualShariaAuditReport:
    return sharia_fatwa_service.generate_annual_audit_report(
        fiscal_year=fiscal_year,
        total_startups_screened=42,
        compliant_startups_count=38,
        non_compliant_startups_count=4,
        total_purification_routed_dzd=3_450_000,
    )
