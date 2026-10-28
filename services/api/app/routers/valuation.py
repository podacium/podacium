"""
TamWheel Sovereign Ethical Agentic Venture OS — Multi-Method Algorithmic Valuation Router.
Exposes endpoints for:
1. Calculating composite pre-money valuations (Berkus, Scorecard, RFSM, VC, DCF)
2. Generating valuation reports with sensitivity analysis and confidence intervals
3. Fetching recommended algorithmic valuations for specific startups
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.prisma import prisma
from app.services.valuation_engine import valuation_engine
from app.schemas.valuation import (
    ValuationCalculationRequest,
    ValuationReportResponse,
    StartupVentureStage,
    BerkusBlockInputs,
    ScorecardFactorInputs,
    RFSMFactorGrades,
)

logger = logging.getLogger("tamwheel.routers.valuation")

router = APIRouter(tags=["valuation", "algorithmic-finance"])


@router.post(
    "/valuation/calculate",
    response_model=ValuationReportResponse,
)
async def calculate_algorithmic_valuation(request: ValuationCalculationRequest):
    """
    Calculate multi-method algorithmic startup pre-money valuation:
    - Modified Berkus Method (calibrated to Algeria, capped at 20M DZD)
    - Scorecard (Bill Payne) Method with MENA weights
    - Risk Factor Summation Method (RFSM) across 12 emerging market vectors
    - Venture Capital (VC) Method & First Chicago Scenario DCF
    - Stage-based composite synthesis with sensitivity bounds (+/- 10%, +/- 20%)
    """
    return valuation_engine.calculate_composite_valuation(request)


@router.get(
    "/valuation/startup/{startup_id}",
    response_model=ValuationReportResponse,
)
async def get_startup_algorithmic_valuation(startup_id: str):
    """
    Generate an algorithmic valuation for an onboarded startup based on its
    sector, wilaya, ASF label status, and current development tier.
    """
    startup = await prisma.startup.find_unique(where={"id": startup_id})
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")

    has_label = getattr(startup, "hasAsfLabel", False)

    # Determine stage based on campaigns or default to STAGE_1_EARLY_MVP
    req = ValuationCalculationRequest(
        stage=StartupVentureStage.STAGE_1_EARLY_MVP,
        berkus=BerkusBlockInputs(
            soundIdea=0.85,
            teamQuality=0.80,
            workingPrototype=0.75,
            strategicAlliances=0.50,
            startupLabelMoat=1.0 if has_label else 0.40,
        ),
        scorecard=ScorecardFactorInputs(
            team=1.15,
            opportunitySize=1.10,
            productTechnology=1.05,
            startupLabelDecree=1.30 if has_label else 0.90,
        ),
        rfsm=RFSMFactorGrades(
            managementRisk=1,
            legislationPoliticalRisk=1 if has_label else 0,
            technologyIpRisk=1,
            litigationLegalRisk=1,
        ),
    )

    return valuation_engine.calculate_composite_valuation(req)
