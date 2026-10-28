"""
TamWheel Cap Table & Corporate Law Router (Pillar 1).
Implements Law 22-09 SPAS equity management, Nominee portage blocks,
BSA-AIR warrant contracts, option pool expansion, and exit waterfalls.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.cap_table import CapTableEngine
from app.schemas.cap_table import (
    ShareClassModel,
    ShareClassCreateRequest,
    StakeholderModel,
    StakeholderCreateRequest,
    ShareIssuanceModel,
    ShareIssuanceCreateRequest,
    ConvertibleInstrumentItem,
    CapTableSummaryResponse,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    WaterfallSimulateRequest,
    WaterfallSimulateResponse,
    NomineePoolRequest,
    NomineePoolResponse,
    NomineeAllocationResponse,
    BsaAirGenerateRequest,
    BsaAirContractResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cap Table & Law 22-09 SPAS Engine"])


# =============================================================================
# 1. CAP TABLE SUMMARY & LEDGER
# =============================================================================

@router.get("/startups/{startup_id}/cap-table", response_model=CapTableSummaryResponse)
async def get_startup_cap_table(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve comprehensive statutory cap table for an Algerian SPAS startup.
    Returns multi-class share inventory, stakeholder ledger with voting & fully-diluted ownership,
    option pools, and active BSA-AIR convertible warrants.
    """
    try:
        summary = CapTableEngine.get_cap_table_summary(startup_id)
        return summary
    except Exception as exc:
        logger.error("Error retrieving cap table for startup %s: %s", startup_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cap table: {str(exc)}",
        )


# =============================================================================
# 2. SHARE CLASSES, STAKEHOLDERS & ISSUANCES
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/share-classes", response_model=ShareClassModel, status_code=status.HTTP_201_CREATED)
async def create_share_class(
    startup_id: str,
    req: ShareClassCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Register a new statutory share class (Actions Ordinaires, Actions de Préférence A/B, BSPCE)
    under Law 22-09 Articles 715 bis 133+.
    """
    try:
        new_class = CapTableEngine.add_share_class(startup_id, req)
        return new_class
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/stakeholders", response_model=StakeholderModel, status_code=status.HTTP_201_CREATED)
async def create_stakeholder(
    startup_id: str,
    req: StakeholderCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Register a new shareholder, investor, or nominee entity on the startup ledger.
    """
    try:
        stakeholder = CapTableEngine.add_stakeholder(startup_id, req)
        return stakeholder
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/issuances", response_model=ShareIssuanceModel, status_code=status.HTTP_201_CREATED)
async def create_share_issuance(
    startup_id: str,
    req: ShareIssuanceCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Execute a statutory share issuance certificate against authorized capital.
    Enforces authorized limits and generates official certificate numbers.
    """
    try:
        issuance = CapTableEngine.issue_shares(startup_id, req)
        return issuance
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/convertibles", response_model=ConvertibleInstrumentItem, status_code=status.HTTP_201_CREATED)
async def register_convertible_instrument(
    startup_id: str,
    req: ConvertibleInstrumentItem,
    current_user=Depends(get_current_active_user),
):
    """
    Register an active convertible warrant (BSA-AIR / SAFE) with valuation cap, floor, and discount.
    """
    try:
        item = CapTableEngine.add_convertible_instrument(startup_id, req)
        return item
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# =============================================================================
# 3. DILUTION & LIQUIDATION WATERFALL SIMULATION
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/simulate-dilution", response_model=CapTableSimulateResponse)
async def simulate_dilution_round(
    startup_id: str,
    req: CapTableSimulateRequest,
):
    """
    Simulate a future financing round with pre- vs post-money pricing, option pool creation
    (pre-round vs post-round), multi-instrument BSA-AIR / SAFE conversion, and Hamilton-Hare
    nominee discretization under Law 22-09.
    """
    try:
        res = CapTableEngine.simulate_dilution(req)
        return res
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dilution simulation failed: {str(exc)}",
        )


@router.post("/startups/{startup_id}/cap-table/simulate-waterfall", response_model=WaterfallSimulateResponse)
async def simulate_liquidation_waterfall(
    startup_id: str,
    req: WaterfallSimulateRequest,
):
    """
    Simulate exit proceeds distribution waterfall across senior debt, preferred share classes
    (seniority-ordered liquidation preferences), non-participating vs participating rights,
    and ordinary residual equity with stakeholder MOIC calculations.
    """
    try:
        res = CapTableEngine.simulate_waterfall(req, startup_id=startup_id)
        return res
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Waterfall simulation failed: {str(exc)}",
        )


# =============================================================================
# 4. NOMINEE SPAS POOLING & BENEFICIAL SUB-LEDGER
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/nominee/pool", response_model=NomineePoolResponse, status_code=status.HTTP_201_CREATED)
async def execute_nominee_crowd_pool(
    startup_id: str,
    req: NomineePoolRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Aggregate thousands of micro-pledges into a single legal line-item for the CNRC register
    under Law 22-09 and Civil Code Article 571 (Convention de Portage).
    Guarantees indivisible shares via Hamilton-Hare largest remainder allocation and returns
    official CNRC Notarial Summary Certificate with SHA-256 fingerprint.
    """
    try:
        req.startupId = startup_id
        res = CapTableEngine.execute_nominee_pooling(req)
        return res
    except Exception as exc:
        logger.error("Nominee pooling failed for startup %s: %s", startup_id, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nominee pooling failed: {str(exc)}",
        )


@router.get("/startups/{startup_id}/cap-table/nominee/{issuance_id}/ledger", response_model=NomineeAllocationResponse)
async def get_nominee_beneficial_ledger(
    startup_id: str,
    issuance_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve beneficial ownership sub-ledger for a registered Nominee block issuance.
    """
    ledger = CapTableEngine.get_nominee_ledger(issuance_id)
    if not ledger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nominee beneficial ledger for issuance {issuance_id} not found.",
        )
    return ledger


# =============================================================================
# 5. BSA-AIR CONTRACT GENERATOR
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/bsa-air/generate-contract", response_model=BsaAirContractResponse)
async def generate_bsa_air_warrant_contract(
    startup_id: str,
    req: BsaAirGenerateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Generate legally binding Algerian SPAS-compliant BSA-AIR (Accord d'Investissement Rapide)
    contract incorporating valuation tunnel (Cap, Floor, Discount), qualified round triggers,
    MFN clause, and tamper-evident SHA-256 cryptographic seal.
    """
    try:
        contract = CapTableEngine.generate_bsa_air_contract(req)
        return contract
    except Exception as exc:
        logger.error("BSA-AIR contract generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract generation failed: {str(exc)}",
        )
