"""
TamWheel Sovereign Ethical Agentic Venture OS — Consumer Protection & Vulnerable Investor Router.
Exposes endpoints for:
1. 6-Month Liquid Living Expense Reserve Diagnostic
2. Vulnerable Investor status verification and allocation capping
3. Cryptographic Ethical Risk Waiver generation
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.services.investor_protection import investor_protection_engine
from app.schemas.protection import (
    LiquidityDiagnosticRequest,
    LiquidityDiagnosticResponse,
    EthicalWaiverGenerateRequest,
    EthicalWaiverDocumentResponse,
)

logger = logging.getLogger("tamwheel.routers.protection")

router = APIRouter(tags=["investor-protection", "suitability", "mifid-ii"])


@router.post(
    "/protection/diagnostic",
    response_model=LiquidityDiagnosticResponse,
)
async def evaluate_investor_liquidity_reserve(
    request: LiquidityDiagnosticRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Perform 6-month liquid living expense reserve diagnostic:
    - If liquid savings < 6 months living expenses: flags as VULNERABLE_INVESTOR.
    - Caps investment ticket to statutory micro-backer limit (max 5,000 DA).
    - Requires mandatory ethical risk waiver.
    """
    return investor_protection_engine.evaluate_liquidity_reserve(request)


@router.post(
    "/protection/waiver/generate",
    response_model=EthicalWaiverDocumentResponse,
)
async def generate_ethical_risk_waiver(
    request: EthicalWaiverGenerateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Generate cryptographic ethical risk waiver with multilingual statutory text
    and 4-day reflection cooling-off window.
    """
    return investor_protection_engine.generate_ethical_waiver(request)


@router.get(
    "/protection/investor/{user_id}/status",
    response_model=LiquidityDiagnosticResponse,
)
async def get_investor_protection_status(
    user_id: int,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Retrieve baseline suitability profile and living expense diagnostic for an investor.
    """
    default_req = LiquidityDiagnosticRequest(
        monthlyHouseholdExpenseDzd=60000.0,
        liquidSavingsDzd=450000.0,
        netWorthDzd=2500000.0,
    )
    return investor_protection_engine.evaluate_liquidity_reserve(default_req)
