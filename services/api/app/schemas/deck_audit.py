"""
TamWheel Sovereign Ethical Agentic Venture OS — Pitch Deck Diligence & Exaggeration Schemas.
Implements data models for:
- Slide-by-slide Archetype Auditing (Problem, Solution, TAM/SAM/SOM, Moat, Traction, Team, Financials)
- TAM/SAM/SOM Inflation Detection calibrated to ONS (Office National des Statistiques) economic data
- Moat Plausibility & Defensibility Rating (evaluating INAPI IP, Network Effects vs Buzzwords)
- Claim Provenance Index (measuring verification ratio of factual claims with primary documents)
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SlideArchetype(str, Enum):
    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"
    TAM_SAM_SOM = "TAM_SAM_SOM"
    MOAT = "MOAT"
    TRACTION = "TRACTION"
    TEAM = "TEAM"
    FINANCIAL_PROJECTIONS = "FINANCIAL_PROJECTIONS"
    OTHER = "OTHER"


class MarketInflationStatus(str, Enum):
    PLAUSIBLE = "PLAUSIBLE"                          # Inflation factor <= 1.25x
    MODERATELY_STRETCHED = "MODERATELY_STRETCHED"    # 1.25x - 2.5x
    EXTREMELY_INFLATED = "EXTREMELY_INFLATED"        # 2.5x - 5.0x
    IMPOSSIBLE_METRIC = "IMPOSSIBLE_METRIC"          # > 5.0x or exceeds total country GDP


class MoatDefensibilityTier(str, Enum):
    GENUINE_DEFENSIBLE_MOAT = "GENUINE_DEFENSIBLE_MOAT"    # 80-100: Real IP, Decree 20-254 moat, network lock-in
    MODERATE_DEFENSIBILITY = "MODERATE_DEFENSIBILITY"      # 50-79: Moderate switching costs, first-mover edge
    WEAK_MOAT = "WEAK_MOAT"                                # 25-49: Easily reproducible features
    BUZZWORD_ILLUSION = "BUZZWORD_ILLUSION"                # 0-24: Pure hype ("AI", "no competition")


class EvidenceStatus(str, Enum):
    EVIDENCE_VERIFIED = "EVIDENCE_VERIFIED"                # Primary document provided (INAPI, bank, contract)
    EVIDENCE_PARTIAL = "EVIDENCE_PARTIAL"                  # Secondary or draft evidence (MOU, mockups)
    EVIDENCE_UNSUBSTANTIATED = "EVIDENCE_UNSUBSTANTIATED"  # Zero verifiable proof provided


class DeckClaim(BaseModel):
    claimId: str = Field(..., description="Unique claim identifier")
    statement: str = Field(..., description="Verbatim founder claim from slide")
    evidenceProvided: Optional[str] = Field(None, description="Description of document or reference provided")
    evidenceType: Optional[str] = Field("NONE", description="Type: CONTRACT, INAPI_PATENT, BANK_SLIP, MOU, NONE")
    status: EvidenceStatus = Field(default=EvidenceStatus.EVIDENCE_UNSUBSTANTIATED)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class DeckSlide(BaseModel):
    slideNumber: int = Field(..., ge=1, description="Slide index in pitch deck")
    title: str = Field(..., description="Slide headline title")
    archetype: SlideArchetype = Field(..., description="Slide category")
    content: str = Field(..., description="Text content or transcription of slide")
    claims: List[DeckClaim] = Field(default_factory=list, description="Extracted claims to audit")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Key numerical metrics found on slide")


class TAMAnalysis(BaseModel):
    claimedTamUsd: float = Field(..., ge=0)
    claimedSamUsd: float = Field(..., ge=0)
    claimedSomUsd: float = Field(..., ge=0)
    benchmarkReference: str = Field(..., description="Benchmark source (ONS, World Bank, Central Bank)")
    benchmarkTamUsd: float = Field(..., ge=0)
    inflationFactor: float = Field(..., description="Ratio of claimed market to empirical economic ceiling")
    inflationStatus: MarketInflationStatus
    critique: str


class MoatAnalysis(BaseModel):
    moatTier: MoatDefensibilityTier
    score: float = Field(..., ge=0, le=100)
    dimensions: Dict[str, float] = Field(..., description="Scores across IP, Network Effects, Regulation, Switching Costs")
    buzzwordsDetected: List[str] = Field(default_factory=list)
    critique: str


class SlideAuditResult(BaseModel):
    slideNumber: int
    title: str
    archetype: SlideArchetype
    integrityScore: float = Field(..., ge=0, le=100)
    redFlags: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    recommendation: str


class DeckAuditRequest(BaseModel):
    startupId: str
    deckTitle: str
    sector: str = Field(..., description="Sector (e.g. Agritech, Fintech, Healthtech, Logistics, E-Commerce, SaaS)")
    targetMarketGeo: Optional[str] = Field("ALGERIA", description="Target geography (ALGERIA, MENA, GLOBAL)")
    slides: List[DeckSlide] = Field(..., min_length=1)


class DeckAuditResponse(BaseModel):
    startupId: str
    deckTitle: str
    overallIntegrityScore: float = Field(..., ge=0, le=100)
    provenanceIndex: float = Field(..., ge=0, le=100, description="Percentage of claims backed by primary verification")
    verifiedClaimsRatio: float = Field(..., ge=0, le=1.0)
    tamAnalysis: Optional[TAMAnalysis] = None
    moatAnalysis: Optional[MoatAnalysis] = None
    slideResults: List[SlideAuditResult]
    summary: str


class TAMCheckRequest(BaseModel):
    sector: str
    targetMarketGeo: Optional[str] = "ALGERIA"
    claimedTamUsd: float = Field(..., ge=0)
    claimedSamUsd: float = Field(..., ge=0)
    claimedSomUsd: float = Field(..., ge=0)


class TAMCheckResponse(BaseModel):
    sector: str
    targetMarketGeo: str
    benchmarkTamUsd: float
    inflationFactor: float
    inflationStatus: MarketInflationStatus
    critique: str
