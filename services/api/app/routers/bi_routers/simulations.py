"""
Simulation Sandbox Router.
Implements Tier 3 (Simulation Layer) of the Executive Cockpit:
- POST /api/bi/simulations/evaluate : sub-50ms real-time What-If sensitivity model
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.tenant import TenantContext, get_tenant_context
from app.services.bi_services.simulation_engine import (
    SimulationEngine,
    SimulationResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulations", tags=["BI - Simulations"])


class SimulationEvaluateRequest(BaseModel):
    retention_rate_target: float = Field(
        0.85,
        ge=0.0,
        le=1.0,
        description="Target monthly user retention rate (0.0 to 1.0)",
    )
    ad_budget_dzd: float = Field(
        500000.0,
        ge=0.0,
        description="Monthly paid acquisition budget in Algerian Dinars",
    )
    freelance_commission_rate: float = Field(
        0.12,
        ge=0.0,
        le=1.0,
        description="Platform take-rate on freelance marketplace (e.g. 0.12)",
    )
    pricing_discount: float = Field(
        0.0,
        ge=-0.50,
        le=0.50,
        description="Promotional pricing discount (-50% to +50%)",
    )
    horizon_months: int = Field(
        6, ge=1, le=12, description="Simulation projection window in months (1 to 12)"
    )
    base_monthly_revenue: float = Field(
        12500000.0, ge=0.0, description="Current baseline monthly revenue in DZD"
    )
    base_active_users: int = Field(
        50000, ge=0, description="Current active user count baseline"
    )
    target_revenue_goal: Optional[float] = Field(
        None, description="Optional custom target revenue threshold to test against"
    )


@router.post(
    "/evaluate",
    response_model=SimulationResult,
    summary="Evaluate What-If operational scenario in <50ms",
    description="Calculates 6-month projected revenue, 95% confidence intervals, and target goal zones in <50ms",
)
async def evaluate_simulation_scenario(
    request: SimulationEvaluateRequest,
    ctx: TenantContext = Depends(get_tenant_context),
) -> SimulationResult:
    """
    Real-time parameter modeling endpoint evaluating multi-variable sensitivity.
    """
    try:
        result = SimulationEngine.evaluate_simulation(
            retention_rate_target=request.retention_rate_target,
            ad_budget_dzd=request.ad_budget_dzd,
            freelance_commission_rate=request.freelance_commission_rate,
            pricing_discount=request.pricing_discount,
            horizon_months=request.horizon_months,
            base_monthly_revenue=request.base_monthly_revenue,
            base_active_users=request.base_active_users,
            target_revenue_goal=request.target_revenue_goal,
        )
        return result
    except Exception as e:
        logger.error(f"Error evaluating simulation scenario: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation evaluation failed: {str(e)}",
        )
