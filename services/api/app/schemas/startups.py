"""
TamWheel Venture Core & Crowdfunding Pydantic Schemas.
Implements COSOB Regulation 23-01 CIP compliance, Law 22-09 SPAS Cap-Table,
and Virtual Data Room schemas.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.generated.prisma.enums import CampaignStatus, AnalystLevel


# =============================================================================
# ENUMS
# =============================================================================

from app.schemas.cap_table import (
    ShareClassType,
    StakeholderRole,
    ConvertibleInstrumentType,
    OptionPoolTiming,
    LiquidationPreferenceType,
    ShareClassModel,
    ShareClassCreateRequest,
    StakeholderModel,
    StakeholderCreateRequest,
    ShareIssuanceModel,
    ShareIssuanceCreateRequest,
    ConvertibleInstrumentItem,
    OptionPoolModel,
    PledgeItem,
    ConvertibleConversionItem,
    NomineeBeneficialItem,
    NomineeAllocationResponse,
    StakeholderLedgerEntry,
    CapTableSummaryResponse,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    DilutionSimulateRequest,
    DilutionSimulateResponse,
    WaterfallClassPayout,
    WaterfallStakeholderPayout,
    WaterfallSimulateRequest,
    WaterfallSimulateResponse,
    CnrcFilingManifest,
    NomineePoolRequest,
    NomineePoolResponse,
    BsaAirGenerateRequest,
    BsaAirContractResponse,
)


class DataRoomCategory(str, Enum):
    PITCH_DECK = "PITCH_DECK"
    FINANCIAL_AUDIT = "FINANCIAL_AUDIT"
    PATENT_FILING = "PATENT_FILING"
    LEGAL_STATUTES = "LEGAL_STATUTES"
    TECHNICAL_SPEC = "TECHNICAL_SPEC"


class DataRoomAccessLevel(str, Enum):
    PUBLIC = "PUBLIC"
    INVESTOR_GATED = "INVESTOR_GATED"
    CONFIDENTIAL_ADMIN = "CONFIDENTIAL_ADMIN"


class DocumentVerificationStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


# =============================================================================
# STARTUP SCHEMAS
# =============================================================================

class StartupCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    tagline: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    wilaya: int = Field(..., ge=1, le=58, description="Algerian Wilaya code (1 to 58)")
    sector: str = Field(..., min_length=2, max_length=80)
    startupLabelNumber: Optional[str] = Field(None, description="Executive Decree 20-254 / ASF label number")
    logoUrl: Optional[str] = None
    pitchDeckUrl: Optional[str] = None
    videoPitchUrl: Optional[str] = None


class StartupUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    tagline: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20)
    wilaya: Optional[int] = Field(None, ge=1, le=58)
    sector: Optional[str] = None
    startupLabelNumber: Optional[str] = None
    logoUrl: Optional[str] = None
    pitchDeckUrl: Optional[str] = None
    videoPitchUrl: Optional[str] = None
    hasAsfLabel: Optional[bool] = None
    hypeScore: Optional[float] = None


class CampaignResponse(BaseModel):
    id: str
    startupId: str
    targetAmountDzd: int
    raisedAmountDzd: int
    minTicketDzd: int
    status: CampaignStatus
    startDate: datetime
    endDate: datetime


class StartupResponse(BaseModel):
    id: str
    name: str
    tagline: str
    description: str
    logoUrl: Optional[str] = None
    pitchDeckUrl: Optional[str] = None
    videoPitchUrl: Optional[str] = None
    founderId: int
    wilaya: int
    sector: str
    hasAsfLabel: bool
    hypeScore: float
    narrativeBubbleWarning: bool = False
    factGuardBadge: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    campaigns: Optional[List[CampaignResponse]] = None


# =============================================================================
# CAMPAIGN SCHEMAS
# =============================================================================

class CampaignCreateRequest(BaseModel):
    targetAmountDzd: int = Field(..., ge=50000, le=20000000, description="Target raise up to 20M DZD statutory cap under COSOB CIP")
    minTicketDzd: int = Field(default=5000, ge=1000, description="Minimum investment ticket size (COSOB default 5,000 DZD)")
    startDate: Optional[datetime] = None
    endDate: datetime = Field(..., description="Campaign deadline")


class CampaignTransitionRequest(BaseModel):
    newStatus: CampaignStatus
    adminNotes: Optional[str] = None


# =============================================================================
# CAP-TABLE & LAW 22-09 SPAS SCHEMAS (Imported and re-exported from app.schemas.cap_table)
# =============================================================================



# =============================================================================
# VIRTUAL DATA ROOM SCHEMAS
# =============================================================================

class DataRoomDocumentUploadRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    category: DataRoomCategory
    fileUrl: str
    fileSizeBytes: int = Field(..., gt=0)
    fileSha256: str = Field(..., min_length=64, max_length=64)
    accessLevel: DataRoomAccessLevel = DataRoomAccessLevel.INVESTOR_GATED


class DataRoomDocumentVerifyRequest(BaseModel):
    status: DocumentVerificationStatus
    verificationNotes: Optional[str] = None


class DataRoomDocumentResponse(BaseModel):
    id: str
    startupId: str
    title: str
    category: DataRoomCategory
    fileUrl: str
    fileSizeBytes: int
    fileSha256: str
    accessLevel: DataRoomAccessLevel
    verificationStatus: DocumentVerificationStatus
    uploadedBy: int
    uploadedAt: datetime
    verifiedBy: Optional[int] = None
    verifiedAt: Optional[datetime] = None
    verificationNotes: Optional[str] = None


# =============================================================================
# PLEDGE & COMPLIANCE SCHEMAS
# =============================================================================

class VirtualPledgeRequest(BaseModel):
    amountDzd: int = Field(..., ge=1000, description="Virtual DZD amount to pledge")
    equitySharePct: Optional[float] = None


class VirtualPledgeResponse(BaseModel):
    id: str
    campaignId: str
    userId: int
    amountDzd: int
    equitySharePct: Optional[float] = None
    reflectionPeriodRequired: bool = False
    reflectionDays: int = 0
    createdAt: datetime


# =============================================================================
# COMMUNITY & LEAGUE SCHEMAS
# =============================================================================

class CommunityScoreRequest(BaseModel):
    analystLevel: AnalystLevel = AnalystLevel.NOVICE
    marketScore: int = Field(..., ge=1, le=10)
    teamScore: int = Field(..., ge=1, le=10)
    tractionScore: int = Field(..., ge=1, le=10)
    shariaScore: Optional[int] = Field(default=10, ge=1, le=10, description="Sharia & Ethics Vector (1-10)")
    feedback: Optional[str] = None


class CommunityScoreResponse(BaseModel):
    id: str
    startupId: str
    userId: int
    analystLevel: AnalystLevel
    marketScore: int
    teamScore: int
    tractionScore: int
    shariaScore: Optional[int] = 10
    feedback: Optional[str] = None
    createdAt: datetime


class LeaderboardEntryResponse(BaseModel):
    userId: int
    fullName: str
    portfolioValueDzd: int
    successfulPledgesCount: int
    analystBadge: str
    rank: int
    roiPct: Optional[float] = None


class FinancialQuizRequest(BaseModel):
    moduleIndex: int
    score: int = Field(..., ge=0, le=100)
    passed: bool


class FinancialQuizResponse(BaseModel):
    id: str
    userId: int
    moduleIndex: int
    score: int
    passed: bool
    completedAt: datetime
