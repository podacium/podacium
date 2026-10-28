"""
TamWheel Sovereign Ethical Agentic Venture OS — INAPI IP Provenance & Moat Schemas.
Implements data models for:
- Algerian INAPI Patent Application formatting (DZ/P/YYYY/XXXXXX, Ordinance 03-07)
- Publication Gazette (BOPI - Bulletin Officiel de la Propriété Industrielle) dates & validation
- Priority claim validation (Paris Convention 12-month rule)
- Annual maintenance fee (Annuités de maintien en vigueur) 20-year term & grace periods
- Trademark provenance (Nice Classification 1-45, 10-year term, Ordinance 03-06)
- IP Moat Index [0.0 - 100.0] and Badges for investor data rooms
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PatentStatus(str, Enum):
    GRANTED_ACTIVE = "GRANTED_ACTIVE"                             # Fully granted, current on fees
    PENDING_EXAMINATION = "PENDING_EXAMINATION"                   # Officially published in BOPI, under exam
    LAPSED_UNPAID_ANNUITY = "LAPSED_UNPAID_ANNUITY"               # Missed annuity + past 6-month grace
    IN_GRACE_PERIOD = "IN_GRACE_PERIOD"                           # Within 6-month surcharge window
    EXPIRED_STATUTORY_TERM = "EXPIRED_STATUTORY_TERM"             # 20 years elapsed since filing
    REJECTED_OR_ABANDONED = "REJECTED_OR_ABANDONED"
    INVALID_FORMAT = "INVALID_FORMAT"


class TrademarkStatus(str, Enum):
    REGISTERED_ACTIVE = "REGISTERED_ACTIVE"                       # Registered, in 10-year protection window
    PENDING_OPPOSITION = "PENDING_OPPOSITION"                     # Published in BOPI, opposition window open
    EXPIRED_RENEWAL_DUE = "EXPIRED_RENEWAL_DUE"                   # Past 10 years without renewal
    CANCELLED = "CANCELLED"
    INVALID_FORMAT = "INVALID_FORMAT"


class IPMoatTier(str, Enum):
    IP_MOAT_DEEP_TECH_TIER_1 = "IP_MOAT_DEEP_TECH_TIER_1"         # Score >= 80: Granted patent + broad claims + clean title
    IP_MOAT_DEFENSIBLE = "IP_MOAT_DEFENSIBLE"                     # Score 60-79: Strong pending or multiple registered marks
    IP_MOAT_MODEST = "IP_MOAT_MODEST"                             # Score 40-59: Trademarks or provisional filing only
    IP_MOAT_UNPROTECTED = "IP_MOAT_UNPROTECTED"                   # Score < 40: Lapsed, invalid, or zero filed IP


class IPMoatBadge(str, Enum):
    INAPI_VERIFIED_PATENT = "INAPI_VERIFIED_PATENT"
    INAPI_PENDING_EXAMINATION = "INAPI_PENDING_EXAMINATION"
    INAPI_REGISTERED_TRADEMARK = "INAPI_REGISTERED_TRADEMARK"
    INAPI_PCT_INTERNATIONAL_PHASE = "INAPI_PCT_INTERNATIONAL_PHASE"
    INAPI_LAPSED_FEE_WARNING = "INAPI_LAPSED_FEE_WARNING"
    INAPI_INVALID_OR_FABRICATED = "INAPI_INVALID_OR_FABRICATED"
    INAPI_UNASSIGNED_FOUNDER_RISK = "INAPI_UNASSIGNED_FOUNDER_RISK"


# -----------------------------------------------------------------------------
# SUB-MODELS
# -----------------------------------------------------------------------------

class AnnuityPaymentRecord(BaseModel):
    annuityYear: int = Field(..., ge=1, le=20, description="Year number (e.g. 1st to 20th year)")
    dueDate: str = Field(..., description="Annual due date (anniversary of filing)")
    isPaid: bool = Field(..., description="Whether payment has been recorded at INAPI")
    paymentDate: Optional[str] = Field(None, description="Actual payment date")
    receiptRef: Optional[str] = Field(None, description="INAPI cashier receipt reference")
    inGracePeriod: bool = Field(default=False, description="Whether currently within 6-month late surcharge window")
    isDelinquent: bool = Field(default=False, description="Whether past grace period without payment")


class PatentClaimRecord(BaseModel):
    patentNumber: str = Field(..., description="Application or Patent number (e.g. DZ/P/2023/000142)")
    title: str = Field(..., description="Invention title (Arabic/French/English)")
    filingDate: str = Field(..., description="Filing date at INAPI (YYYY-MM-DD)")
    ipcClassification: str = Field(..., description="IPC / CIB class code (e.g. 'G06F 17/00')")
    bopiNumber: Optional[str] = Field(None, description="BOPI publication gazette number (e.g. 'BOPI N° 342/2024')")
    bopiPublicationDate: Optional[str] = Field(None, description="BOPI gazette issue date")
    priorityCountry: Optional[str] = Field(None, description="Country of first foreign filing under Paris Convention")
    priorityFilingDate: Optional[str] = Field(None, description="First filing date in priority country")
    priorityNumber: Optional[str] = Field(None, description="First priority application number")
    pctApplicationNumber: Optional[str] = Field(None, description="WIPO / PCT application number if international")
    assignedToStartup: bool = Field(
        default=True,
        description="Whether invention is formally assigned to the startup entity vs retained by individual founder",
    )
    currentAnnuityYear: int = Field(default=1, ge=1, le=20, description="Current year of patent life")
    lastPaidAnnuityYear: int = Field(default=1, ge=0, le=20, description="Highest paid annuity year")
    monthsSinceFiling: int = Field(default=0, ge=0, description="Months elapsed since filing date")


class TrademarkClaimRecord(BaseModel):
    registrationNumber: str = Field(..., description="INAPI trademark number (e.g. 'DZ/M/2022/000512')")
    markName: str = Field(..., description="Word mark, logo, or combined brand name")
    filingDate: str = Field(..., description="Date of filing (YYYY-MM-DD)")
    niceClasses: List[int] = Field(..., description="List of Nice Classification classes (1-45)")
    bopiGazetteRef: Optional[str] = Field(None, description="Publication in BOPI Marques")
    assignedToStartup: bool = Field(default=True, description="Whether title registered under company name")
    isRenewed: bool = Field(default=True, description="Whether renewed if past 10-year term")


# -----------------------------------------------------------------------------
# REQUEST & RESPONSE MODELS
# -----------------------------------------------------------------------------

class PatentVerificationRequest(BaseModel):
    patent: PatentClaimRecord = Field(..., description="Claimed patent details")
    asOfDate: Optional[str] = Field(None, description="Evaluation date (YYYY-MM-DD), default current")


class PatentVerificationResponse(BaseModel):
    patentNumber: str
    isFormatValid: bool = Field(..., description="Matches official DZ/P/YYYY/XXXXXX or legacy regex")
    status: PatentStatus = Field(..., description="Active, Pending, Lapsed, or Expired")
    isPriorityClaimValid: bool = Field(..., description="Within 12-month Paris Convention window if claimed")
    annuityStatusSummary: str = Field(..., description="Human-readable annuity status breakdown")
    isAnnuityCurrent: bool = Field(..., description="Whether fees are fully paid")
    isInGracePeriod: bool = Field(..., description="Whether 6-month surcharge grace is running")
    yearsRemainingOfProtection: int = Field(..., ge=0, le=20, description="Years left before 20-year term expiration")
    bopiVerified: bool = Field(..., description="Whether published in official gazette")
    assignedToCompany: bool = Field(..., description="Whether title is held by startup entity")
    badgesIssued: List[IPMoatBadge] = Field(default_factory=list, description="Verified IP badges awarded")
    riskFlags: List[str] = Field(default_factory=list, description="Defects or warning flags")


class TrademarkVerificationRequest(BaseModel):
    trademark: TrademarkClaimRecord
    asOfDate: Optional[str] = Field(None)


class TrademarkVerificationResponse(BaseModel):
    registrationNumber: str
    markName: str
    isFormatValid: bool
    status: TrademarkStatus
    niceClassesValidated: List[int]
    techRelevantClassesPresent: bool = Field(..., description="Contains Class 9, 36, 38, or 42")
    yearsRemainingOfProtection: int
    badgesIssued: List[IPMoatBadge]
    riskFlags: List[str]


class IPOldPortfolioAuditRequest(BaseModel):
    startupId: str
    companyName: str
    patents: List[PatentClaimRecord] = Field(default_factory=list)
    trademarks: List[TrademarkClaimRecord] = Field(default_factory=list)
    asOfDate: Optional[str] = Field(None)


class IPOldPortfolioAuditResponse(BaseModel):
    startupId: str
    companyName: str
    ipMoatIndex: float = Field(..., ge=0.0, le=100.0, description="Defensibility & moat index [0, 100]")
    ipMoatTier: IPMoatTier
    activePatentsCount: int
    pendingPatentsCount: int
    lapsedPatentsCount: int
    activeTrademarksCount: int
    portfolioBadges: List[IPMoatBadge]
    criticalIpRisks: List[str]
    investorMoatSummary: str
