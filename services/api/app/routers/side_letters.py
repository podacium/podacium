"""
TamWheel Institutional Side Letter & CNRC Filing Router (Pillar 1 Phase 4).
FastAPI endpoints for investor side letters, covenants tracking,
statutory SPAS conflict detection, and CNRC official register export.
"""

from decimal import Decimal
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_active_user
from app.services.side_letter_engine import side_letter_engine
from app.services.safe_conversion_engine import safe_conversion_engine
from app.schemas.side_letter import (
    SideLetterModel,
    SideLetterCreateRequest,
    StatutsConflictReport,
    MfnElectionRequest,
    MfnElectionResponse,
    CnrcFilingExportResponse,
)
from app.schemas.safe_conversion import SafeConversionSimulationRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/side-letters", tags=["Institutional Side Letters & CNRC"])


class CnrcExportRequest(BaseModel):
    company_legal_name: str
    commercial_register_num: str  # Numéro RC
    tax_id_num: str  # NIF
    nominal_value_dzd: Decimal = Decimal("1000.00")
    founder_name: str = "Fondateur Principal"
    founder_nin: str = "198016010012345678"
    conversion_simulation_request: SafeConversionSimulationRequest


@router.post("/startups/{startup_id}", response_model=SideLetterModel, status_code=status.HTTP_201_CREATED)
async def create_side_letter(
    startup_id: str,
    req: SideLetterCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """Register a new institutional side letter with investor covenants."""
    try:
        letter = side_letter_engine.create_side_letter(startup_id=startup_id, req=req)
        return letter
    except Exception as e:
        logger.error(f"Failed to create side letter: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create side letter: {str(e)}",
        )


@router.get("/startups/{startup_id}", response_model=List[SideLetterModel])
async def list_side_letters(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """List all registered side letters for a startup."""
    try:
        return side_letter_engine.list_side_letters(startup_id)
    except Exception as e:
        logger.error(f"Failed to list side letters: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/startups/{startup_id}/{side_letter_id}", response_model=SideLetterModel)
async def get_side_letter(
    startup_id: str,
    side_letter_id: str,
    current_user=Depends(get_current_active_user),
):
    """Retrieve details of a specific side letter."""
    letter = side_letter_engine.get_side_letter(startup_id, side_letter_id)
    if not letter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Side letter not found",
        )
    return letter


@router.get("/startups/{startup_id}/audit/conflicts", response_model=StatutsConflictReport)
async def audit_statuts_conflicts(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """Audit all registered side letters against Algerian Law 22-09 SPAS bylaws."""
    try:
        report = side_letter_engine.audit_statuts_conflicts(startup_id)
        return report
    except Exception as e:
        logger.error(f"Failed to audit side letter conflicts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/startups/{startup_id}/elect-mfn", response_model=MfnElectionResponse)
async def elect_mfn_terms(
    startup_id: str,
    req: MfnElectionRequest,
    current_user=Depends(get_current_active_user),
):
    """Allow an investor to elect more favorable covenants via their MFN clause."""
    try:
        response = side_letter_engine.elect_mfn_covenants(startup_id, req)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"MFN election failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/startups/{startup_id}/export-cnrc", response_model=CnrcFilingExportResponse)
async def export_cnrc_filing_manifest(
    startup_id: str,
    req: CnrcExportRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Generate formal Shareholder Register & Capital Modification Declaration
    formatted for official filing with the Algerian CNRC under Law 22-09.
    """
    try:
        simulation_res = safe_conversion_engine.simulate_conversion(req.conversion_simulation_request)
        filing_manifest = side_letter_engine.export_cnrc_filing_manifest(
            startup_id=startup_id,
            company_legal_name=req.company_legal_name,
            rc_number=req.commercial_register_num,
            nif_number=req.tax_id_num,
            nominal_value_dzd=req.nominal_value_dzd,
            conversion_simulation=simulation_res,
            founder_name=req.founder_name,
            founder_nin=req.founder_nin,
        )
        return filing_manifest
    except Exception as e:
        logger.error(f"CNRC filing generation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CNRC export error: {str(e)}",
        )
