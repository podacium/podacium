"""
TamWheel SAFE & Convertible Note Conversion Router (Pillar 1 Phase 4).
FastAPI endpoints for Y Combinator standard Post/Pre-Money SAFEs, convertible promissory notes,
interest accruals, and exact integer share distribution via Hamilton-Hare.
"""

from decimal import Decimal
import logging
from typing import List, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_active_user
from app.services.safe_conversion_engine import safe_conversion_engine
from app.schemas.safe_conversion import (
    InterestType,
    SafeConversionSimulationRequest,
    SafeConversionSimulationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/safes", tags=["SAFE & Convertible Notes"])


class InterestCalculationRequest(BaseModel):
    principal_dzd: Decimal
    annual_interest_rate: Decimal
    interest_type: InterestType
    issuance_date: str
    conversion_date: str


class InterestCalculationResponse(BaseModel):
    principal_dzd: Decimal
    accrued_interest_dzd: Decimal
    total_amount_dzd: Decimal


class HamiltonHareRequest(BaseModel):
    allocations: List[Tuple[str, float]]


class HamiltonHareResponse(BaseModel):
    allocated: List[Tuple[str, int, float]]
    total_integer_shares: int


@router.post("/simulate", response_model=SafeConversionSimulationResponse)
async def simulate_safe_conversion(
    req: SafeConversionSimulationRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Simulate SAFE & Convertible Note conversion across scenarios (Equity Financing, Liquidity, Dissolution).
    Uses Hamilton-Hare Largest Remainder Method for exact integer shares.
    """
    try:
        response = safe_conversion_engine.simulate_conversion(req)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Failed to simulate SAFE conversion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation error: {str(e)}",
        )


@router.post("/calculate-interest", response_model=InterestCalculationResponse)
async def calculate_note_interest(
    req: InterestCalculationRequest,
    current_user=Depends(get_current_active_user),
):
    """Calculate accrued interest for convertible promissory notes."""
    try:
        from datetime import datetime
        dt_issuance = datetime.fromisoformat(req.issuance_date)
        dt_conversion = datetime.fromisoformat(req.conversion_date)

        accrued = safe_conversion_engine.calculate_accrued_interest(
            principal=req.principal_dzd,
            annual_rate=req.annual_interest_rate,
            interest_type=req.interest_type,
            issuance_date=dt_issuance,
            conversion_date=dt_conversion,
        )

        return InterestCalculationResponse(
            principal_dzd=req.principal_dzd,
            accrued_interest_dzd=accrued,
            total_amount_dzd=req.principal_dzd + accrued,
        )
    except Exception as e:
        logger.error(f"Failed to calculate interest: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date or parameters: {str(e)}",
        )


@router.post("/hamilton-hare-allocation", response_model=HamiltonHareResponse)
async def run_hamilton_hare_allocation(
    req: HamiltonHareRequest,
    current_user=Depends(get_current_active_user),
):
    """Run discrete integer share allocation using Hamilton-Hare largest remainder method."""
    try:
        results = safe_conversion_engine.allocate_integer_shares_hamilton_hare(req.allocations)
        total_shares = sum(item[1] for item in results)
        return HamiltonHareResponse(
            allocated=results,
            total_integer_shares=total_shares,
        )
    except Exception as e:
        logger.error(f"Hamilton-Hare calculation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
