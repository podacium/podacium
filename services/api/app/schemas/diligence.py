"""
TamWheel Sovereign Ethical Agentic Venture OS — Community Due Diligence, AMA & FactGuard Schemas.
Implements multi-dimensional consensus scoring, threaded voice/text AMA,
FactGuard AI auditing, and Bayan Card viral sharing payloads per Blueprint Sections 8.4, 14, and 15.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.generated.prisma.enums import AnalystLevel
from app.services.factguard_ai import FactBadgeStatus, FactCategory


# =============================================================================
# MULTI-DIMENSIONAL DILIGENCE RATING SCHEMAS
# =============================================================================

class MultiDimensionalRatingRequest(BaseModel):
    marketScore: int = Field(..., ge=1, le=10, description="Product Utility & Market Need (1-10)")
    teamScore: int = Field(..., ge=1, le=10, description="Founder & Team Execution Capability (1-10)")
    tractionScore: int = Field(..., ge=1, le=10, description="Traction, ARR & User Engagement (1-10)")
    shariaScore: int = Field(default=10, ge=1, le=10, description="Sharia & Ethical Compliance Vector (1-10)")
    analystLevel: AnalystLevel = Field(default=AnalystLevel.NOVICE, description="Reputation tier of reviewer")
    feedback: Optional[str] = Field(None, max_length=1000, description="Written qualitative rationale")
    accountAgeDays: Optional[int] = Field(None, ge=0, description="Account longevity for anti-sybil weighting")


class MultiDimensionalRatingResponse(BaseModel):
    id: str
    startupId: str
    userId: int
    analystLevel: AnalystLevel
    marketScore: int
    teamScore: int
    tractionScore: int
    shariaScore: int
    compositeRawScore: float
    effectiveWeight: float
    feedback: Optional[str] = None
    createdAt: datetime


class DimensionConsensus(BaseModel):
    marketAvg: float
    teamAvg: float
    tractionAvg: float
    shariaAvg: float


class ConsensusBreakdownResponse(BaseModel):
    startupId: str
    hypeScore: float
    dimensions: DimensionConsensus
    totalRatingsCount: int
    effectiveWeightedVotes: float
    tierDistribution: Dict[str, int]
    narrativeBubbleWarning: bool
    divergenceRatio: float
    statusFlag: str
    warningMessage: Optional[str] = None


# =============================================================================
# THREADED AMA SCHEMAS
# =============================================================================

class AMAQuestionCreateRequest(BaseModel):
    questionText: str = Field(..., min_length=5, max_length=1000, description="Question submitted to founder")
    audioUrl: Optional[str] = Field(None, description="Optional 15-second voice note question URL")
    category: str = Field(default="GENERAL", description="Pillar category: TEAM, PRODUCT, TRACTION, SHARIA, FINANCIALS")


class AMAAnswerCreateRequest(BaseModel):
    answerText: str = Field(..., min_length=3, max_length=2000, description="Founder response")
    audioUrl: Optional[str] = Field(None, description="Optional audio response URL")


class AMAQuestionResponse(BaseModel):
    id: str
    startupId: str
    userId: int
    authorName: str
    authorTier: str
    questionText: str
    audioUrl: Optional[str] = None
    category: str
    upvotes: int
    isAnswered: bool
    answerText: Optional[str] = None
    answerAudioUrl: Optional[str] = None
    answeredAt: Optional[datetime] = None
    createdAt: datetime


# =============================================================================
# FACTGUARD AI SCHEMAS
# =============================================================================

class FactGuardAuditRequest(BaseModel):
    videoUrl: Optional[str] = None
    transcriptText: str = Field(..., min_length=10, description="Pitch reel spoken dialogue transcript")
    customClaims: Optional[List[Dict[str, Any]]] = None


class FactGuardClaimResponse(BaseModel):
    id: str
    timestamp: str
    category: str
    claimText: str
    claimedValue: Any
    badge: FactBadgeStatus
    registrySource: str
    verificationNotes: str
    confidence: float


class FactGuardOverlayResponse(BaseModel):
    timestamp: str
    badge: str
    pillText: str
    notes: str
    color: str


class FactGuardAuditResponse(BaseModel):
    startupId: str
    videoUrl: Optional[str] = None
    overallBadge: FactBadgeStatus
    overallScore: float
    totalClaims: int
    verifiedCount: int
    amberCount: int
    redCount: int
    summary: str
    claims: List[FactGuardClaimResponse]
    overlays: List[FactGuardOverlayResponse]
    auditedAt: str


# =============================================================================
# BAYAN CARD (1-PAGE MOBILE VIRAL INFOGRAPHIC PAYLOAD)
# =============================================================================

class SocialCaptionSet(BaseModel):
    ar: str
    fr: str
    en: str


class BayanCardMetadataResponse(BaseModel):
    startupId: str
    startupName: str
    tagline: str
    wilaya: int
    wilayaName: str
    sector: str
    hasAsfLabel: bool
    hypeScore: float
    reputationTierLabel: str
    consensus: DimensionConsensus
    factGuardBadge: str
    factGuardVerifiedClaimsCount: int
    narrativeBubbleWarning: bool
    divergenceRatio: float
    shareUrl: str
    qrPayload: str
    socialCaptions: SocialCaptionSet
    brandTokens: Dict[str, str]
