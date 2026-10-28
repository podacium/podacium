"""
TamWheel Sovereign Ethical Agentic Venture OS — Pitch Deck Diligence & Exaggeration Router.
Exposes endpoints for:
1. Full slide-by-slide pitch deck integrity audit (TAM inflation, moat defensibility, claim provenance)
2. Standalone TAM/SAM/SOM economic reality check against ONS statistics
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.services.deck_audit_service import deck_auditor
from app.schemas.deck_audit import (
    DeckAuditRequest,
    DeckAuditResponse,
    TAMCheckRequest,
    TAMCheckResponse,
)

logger = logging.getLogger("tamwheel.routers.deck_audit")

router = APIRouter(tags=["diligence", "deck-auditing"])


@router.post(
    "/diligence/deck-audit/analyze",
    response_model=DeckAuditResponse,
    summary="Perform comprehensive pitch deck slide-by-slide audit",
)
async def analyze_pitch_deck(request: DeckAuditRequest):
    """
    Audit investor pitch deck for exaggeration and credibility:
    - Slices pitch deck into archetypes (Problem, Solution, TAM/SAM/SOM, Moat, Traction, Team, Financials)
    - Flags impossible market sizes against official Algerian ONS statistics & national GDP ceiling
    - Evaluates moat defensibility (INAPI IP, Decree 20-254 Startup Label, switching costs vs buzzwords)
    - Computes Claim Provenance Index based on primary verifiable documentation
    - Delivers slide-by-slide integrity scores, red flags, strengths, and recommendations
    """
    try:
        return deck_auditor.audit_deck(request)
    except Exception as e:
        logger.error(f"Deck audit failed for startup {request.startupId}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pitch deck audit failed: {str(e)}",
        )


@router.post(
    "/diligence/deck-audit/tam-check",
    response_model=TAMCheckResponse,
    summary="Validate TAM/SAM/SOM market sizing against official ONS data",
)
async def check_tam_benchmarks(request: TAMCheckRequest):
    """
    Benchmark claimed TAM/SAM/SOM figures against empirical Algerian ONS economic ceilings.
    Identifies top-down market sizing fallacies and calculates inflation multiples.
    """
    try:
        analysis = deck_auditor.evaluate_tam(
            sector=request.sector,
            claimed_tam=request.claimedTamUsd,
            claimed_sam=request.claimedSamUsd,
            claimed_som=request.claimedSomUsd,
            target_geo=request.targetMarketGeo,
        )
        return TAMCheckResponse(
            sector=request.sector,
            targetMarketGeo=request.targetMarketGeo or "ALGERIA",
            benchmarkTamUsd=analysis.benchmarkTamUsd,
            inflationFactor=analysis.inflationFactor,
            inflationStatus=analysis.inflationStatus,
            critique=analysis.critique,
        )
    except Exception as e:
        logger.error(f"TAM benchmark check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TAM benchmark check failed: {str(e)}",
        )
