"""
TamWheel Sovereign Ethical Agentic Venture OS — Startup Label Diagnostic Router.
Pillar 6: Algerian Executive Decree 20-254 (Décret exécutif n° 20-254 du 15 septembre 2020)
National Startup Label readiness diagnostic, official commission readiness bands,
and structured gap analysis before submission to the National Commission.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status

from app.core.auth import get_current_active_user
from app.services.label_diagnostic import (
    label_diagnostic_engine,
    MAX_INNOVATION_SCORE,
    MAX_SCALABILITY_SCORE,
    MAX_TEAM_SCORE,
    MAX_IP_SCORE,
    MAX_TRACTION_SCORE,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagnostic", tags=["Startup Label Diagnostic Decree 20-254"])


# =============================================================================
# SCHEMAS
# =============================================================================

class StartupDiagnosticRequest(BaseModel):
    startupName: str = Field(..., min_length=2, description="Legal or operating name of the startup")
    sector: str = Field(..., min_length=2, description="Target vertical (FinTech, AgTech, HealthTech, etc.)")
    wilaya: int = Field(..., ge=1, le=58, description="Algerian Wilaya code (1-58)")
    innovationScore: int = Field(..., ge=0, le=30, description="Innovation pillar (max 30 pts)")
    scalabilityScore: int = Field(..., ge=0, le=25, description="Scalability pillar (max 25 pts)")
    teamScore: int = Field(..., ge=0, le=20, description="Team complementarity (max 20 pts)")
    ipScore: int = Field(..., ge=0, le=15, description="Patents & INAPI IP (max 15 pts)")
    tractionScore: int = Field(..., ge=0, le=10, description="Commercial traction & LOIs (max 10 pts)")


class StartupDiagnosticResponse(BaseModel):
    startupName: str
    sector: str
    wilaya: int
    totalScore: int
    readinessBand: str            # Highly Recommended, Candidate, Not Ready
    eligibilityStatus: str        # LABEL_READY, CANDIDATE, EARLY_STAGE
    isEligibleForDecree20254: bool
    pillarBreakdown: Dict[str, Any]
    gapAnalysis: List[str]
    recommendations: List[str]
    actionPlan: List[Dict[str, Any]]


class RubricPillar(BaseModel):
    name: str
    nameAr: str
    weightPct: int
    maxScore: int
    description: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/rubric", response_model=List[RubricPillar])
async def get_decree_20_254_rubric():
    """
    Returns the official 5-pillar scoring rubric established under Executive Decree 20-254.
    """
    return [
        RubricPillar(
            name="Innovation",
            nameAr="درجة الابتكار والأسبقية التكنولوجية",
            weightPct=30,
            maxScore=MAX_INNOVATION_SCORE,
            description="Proprietary technology, deeptech novelty, disruption of traditional workflows.",
        ),
        RubricPillar(
            name="Scalability",
            nameAr="قابلية التوسع والنمو السريع",
            weightPct=25,
            maxScore=MAX_SCALABILITY_SCORE,
            description="Addressable market size, low marginal cost per user across 58 wilayas.",
        ),
        RubricPillar(
            name="Team",
            nameAr="تكامل كفاءات الفريق المؤسس",
            weightPct=20,
            maxScore=MAX_TEAM_SCORE,
            description="Technical, commercial, and operational domain expertise complementarity.",
        ),
        RubricPillar(
            name="Intellectual Property",
            nameAr="الملكية الفكرية وبراءات INAPI/ONDA",
            weightPct=15,
            maxScore=MAX_IP_SCORE,
            description="Patents, trademarks, source code registered with INAPI and ONDA.",
        ),
        RubricPillar(
            name="Traction",
            nameAr="الجر التجاري وعقود النوايا",
            weightPct=10,
            maxScore=MAX_TRACTION_SCORE,
            description="Active pilot users, ARR/MRR, signed corporate LOIs.",
        ),
    ]


@router.post("/evaluate", response_model=StartupDiagnosticResponse)
@router.post("", response_model=StartupDiagnosticResponse)
async def evaluate_diagnostic(
    req: StartupDiagnosticRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Evaluates a startup against Executive Decree 20-254 rubric, producing an official
    readiness band, gap analysis, and tailored action plan before National Commission submission.
    """
    result = label_diagnostic_engine.evaluate(
        startup_name=req.startupName,
        sector=req.sector,
        wilaya=req.wilaya,
        innovation_score=req.innovationScore,
        scalability_score=req.scalabilityScore,
        team_score=req.teamScore,
        ip_score=req.ipScore,
        traction_score=req.tractionScore,
    )
    return StartupDiagnosticResponse(**result)
