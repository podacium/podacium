"""
TamWheel Sovereign Ethical Agentic Venture OS — Sanctions & Adverse Media Screening Router.
Exposes endpoints for:
1. Full entity sanctions screening across UN, OFAC, EU, and Algerian National Freeze lists
2. High-precision Algerian phonetic & transliteration name fuzzy matching (Levenshtein & Jaro-Winkler)
3. Politically Exposed Persons (PEP) checks under Algerian Law 05-01 / 23-01
4. Automated adverse media and financial crime scanning
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.diligence_sanctions import (
    SanctionsScreeningRequest,
    SanctionsScreeningResponse,
    FuzzyMatchRequest,
    FuzzyMatchResponse,
    PEPScreeningRequest,
    PEPScreeningResponse,
    AdverseMediaScanRequest,
    AdverseMediaScanResponse,
)
from app.services.sanctions_screening_engine import sanctions_screening_engine

logger = logging.getLogger("tamwheel.routers.diligence_sanctions")

router = APIRouter(prefix="/diligence/sanctions", tags=["AML/CFT Sanctions & Adverse Media Screening"])


@router.post(
    "/screen",
    response_model=SanctionsScreeningResponse,
    summary="Screen entity against international & Algerian sanctions lists",
)
async def screen_sanctions(request: SanctionsScreeningRequest):
    """
    Automated sanctions screening:
    - Checks UN, OFAC SDN, EU, and Algerian National Terrorism / CTRF Freeze List
    - Phonetic name fuzzy matching for Algerian transliterations (Mohamed / Mouhamed / Mohamed Cherif)
    - PEP detection under Law 05-01 / Law 23-01
    - Automated adverse media scanning for white-collar crimes
    """
    try:
        return sanctions_screening_engine.screen_entity(request)
    except Exception as e:
        logger.error(f"Sanctions screening failed for {request.entityName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sanctions screening failed: {str(e)}",
        )


@router.post(
    "/fuzzy-match",
    response_model=FuzzyMatchResponse,
    summary="Phonetic & fuzzy similarity score between two Maghreb names",
)
async def fuzzy_match_names(request: FuzzyMatchRequest):
    """
    Compute multi-factor name similarity:
    - Jaro-Winkler prefix-weighted distance
    - Levenshtein edit distance
    - Token permutation set ratio
    - Maghreb phonetic soundex skeleton match
    """
    try:
        return sanctions_screening_engine.fuzzy_match(request.queryName, request.targetName)
    except Exception as e:
        logger.error(f"Fuzzy match failed between {request.queryName} and {request.targetName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fuzzy name match failed: {str(e)}",
        )


@router.post(
    "/pep-check",
    response_model=PEPScreeningResponse,
    summary="Politically Exposed Persons (PEP) status check",
)
async def check_pep(request: PEPScreeningRequest):
    """
    Check PEP status under Algerian Law 05-01 / Law 23-01:
    - National PEPs (Ministers, Walis, MPs, Generals, Senior Judges, SOE PDGs)
    - Relatives and Close Associates (RCA) with cooling-off period calculation
    """
    try:
        pep_hit = sanctions_screening_engine.check_pep_status(request.fullName, request.nationalId)
        mitigations = []
        if pep_hit.isPep:
            mitigations.append("Obtain Senior Compliance / Investment Committee Sign-off prior to term sheet execution.")
            mitigations.append("Conduct comprehensive Source of Wealth (SOW) and Source of Funds (SOF) audit.")
            if pep_hit.enhancedDueDiligenceMandatory:
                mitigations.append("Prepare CTRF declaration dossier in compliance with Law 05-01 Art. 8.")

        return PEPScreeningResponse(
            candidateName=request.fullName,
            pepHit=pep_hit,
            recommendedMitigations=mitigations,
        )
    except Exception as e:
        logger.error(f"PEP check failed for {request.fullName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PEP check failed: {str(e)}",
        )


@router.post(
    "/adverse-media",
    response_model=AdverseMediaScanResponse,
    summary="Adverse media & financial crime scanning",
)
async def scan_adverse_media(request: AdverseMediaScanRequest):
    """
    Scan media records and legal gazettes for white-collar crimes, bribery,
    tax evasion, customs fraud, and commercial defaults.
    """
    try:
        return sanctions_screening_engine.scan_adverse_media(request)
    except Exception as e:
        logger.error(f"Adverse media scan failed for {request.entityName}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Adverse media scan failed: {str(e)}",
        )
