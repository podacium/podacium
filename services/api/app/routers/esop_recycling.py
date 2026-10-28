"""
FastAPI Router for Dynamic ESOP Pool Rebalancing, Forfeiture Recycling & IRG Tax Engine.
Mounted under `/api/v1/cap-table/esop-recycling`.
"""

import logging
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.esop_recycling_engine import esop_recycling_engine
from app.schemas.esop_recycling import (
    EsopPoolInitRequest,
    EsopPoolStatusResponse,
    EsopGrantCreateRequest,
    EsopGrantDetailResponse,
    ForfeitureRecycleRequest,
    ForfeitureRecycleResponse,
    DownRoundAntiDilutionRequest,
    DownRoundAntiDilutionResponse,
    IrgTaxCalculationRequest,
    IrgTaxCalculationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cap-table/esop-recycling", tags=["Dynamic ESOP Pool & IRG Tax"])


@router.post(
    "/pool/init",
    response_model=EsopPoolStatusResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize or reconfigure startup ESOP reserve pool",
    description="Allocates authorized pool shares under Law 22-09 SPAS charter.",
)
async def initialize_esop_pool(
    req: EsopPoolInitRequest,
    current_user: Any = Depends(get_current_active_user),
) -> EsopPoolStatusResponse:
    try:
        return esop_recycling_engine.initialize_pool(req)
    except Exception as e:
        logger.error(f"Failed to initialize ESOP pool: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pool initialization failed: {str(e)}",
        )


@router.get(
    "/{startup_id}/pool/status",
    response_model=EsopPoolStatusResponse,
    summary="Retrieve real-time ESOP pool utilization and available reserves",
)
async def get_esop_pool_status(
    startup_id: str,
    current_user: Any = Depends(get_current_active_user),
) -> EsopPoolStatusResponse:
    try:
        return esop_recycling_engine.get_pool_status(startup_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/grants",
    response_model=EsopGrantDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create 48-month statutory vesting grant with 12-month cliff",
    description="Deducts options from the unallocated reserve pool and registers vesting terms.",
)
async def create_esop_grant(
    req: EsopGrantCreateRequest,
    current_user: Any = Depends(get_current_active_user),
) -> EsopGrantDetailResponse:
    try:
        return esop_recycling_engine.create_grant(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create ESOP grant: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Grant creation failed: {str(e)}",
        )


@router.get(
    "/grants/{grant_id}",
    response_model=EsopGrantDetailResponse,
    summary="Get ESOP grant vesting detail as of a specified date",
)
async def get_esop_grant_detail(
    grant_id: str,
    as_of_date: Optional[str] = Query(None, description="Evaluation date in YYYY-MM-DD format"),
    current_user: Any = Depends(get_current_active_user),
) -> EsopGrantDetailResponse:
    try:
        return esop_recycling_engine.get_grant_detail(grant_id, as_of_date=as_of_date)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/forfeiture/recycle",
    response_model=ForfeitureRecycleResponse,
    status_code=status.HTTP_200_OK,
    summary="Recycle forfeited unvested shares upon employee departure back into ESOP pool",
    description="Calculates cliff forfeiture, applies PTEW window, and restores options to unallocated reserves.",
)
async def recycle_forfeited_shares(
    req: ForfeitureRecycleRequest,
    current_user: Any = Depends(get_current_active_user),
) -> ForfeitureRecycleResponse:
    try:
        return esop_recycling_engine.recycle_forfeited_options(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to recycle forfeited options: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Forfeiture recycling failed: {str(e)}",
        )


@router.post(
    "/anti-dilution/rebalance",
    response_model=DownRoundAntiDilutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Rebalance and reprice option strike prices upon a down-round financing",
    description="Executes Full Ratchet, BBWA, or Value Parity repricing with Law 22-09 SPAS board resolution.",
)
async def rebalance_down_round(
    req: DownRoundAntiDilutionRequest,
    current_user: Any = Depends(get_current_active_user),
) -> DownRoundAntiDilutionResponse:
    try:
        return esop_recycling_engine.rebalance_down_round_grants(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to rebalance grants on down-round: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Down-round rebalancing failed: {str(e)}",
        )


@router.post(
    "/tax/irg-calculate",
    response_model=IrgTaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute Algerian IRG tax withholding on option exercise discount spread",
    description="Applies CIDTA Art. 67 / 104 progressive scale or Startup Label 15% flat rate + CNAS deductions.",
)
async def calculate_irg_tax(
    req: IrgTaxCalculationRequest,
    current_user: Any = Depends(get_current_active_user),
) -> IrgTaxCalculationResponse:
    try:
        return esop_recycling_engine.calculate_irg_tax_withholding(req)
    except Exception as e:
        logger.error(f"Failed to calculate IRG tax withholding: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"IRG tax calculation failed: {str(e)}",
        )
