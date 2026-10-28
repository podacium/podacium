"""
TamWheel Sovereign Ethical Agentic Venture OS — Sanctions & Adverse Media Schemas.
Implements data models for:
- International & Domestic Sanctions screening (UNSC, OFAC, EU, CTRF Algerian National Freeze List)
- Algerian Transliteration Phonetic & Fuzzy Name Matching (Levenshtein & Jaro-Winkler)
- Politically Exposed Persons (PEP) detection under Algerian Law 05-01 / Law 23-01
- Automated Adverse Media scanning for corporate financial crimes and court disputes
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SanctionRegime(str, Enum):
    UN_CONSOLIDATED = "UN_CONSOLIDATED"             # UN Security Council Resolutions
    US_OFAC_SDN = "US_OFAC_SDN"                     # US Office of Foreign Assets Control
    EU_FINANCIAL_SANCTIONS = "EU_FINANCIAL_SANCTIONS" # EU Common Foreign & Security Policy
    ALGERIA_CTRF_NATIONAL = "ALGERIA_CTRF_NATIONAL" # Commission Nationale / CTRF Arrêté Gel


class SanctionRiskLevel(str, Enum):
    CLEAN = "CLEAN"                                 # No hit found
    LOW_SUSPICION = "LOW_SUSPICION"                 # Low fuzzy score (< 0.70)
    POTENTIAL_MATCH = "POTENTIAL_MATCH"             # Score 0.70 - 0.84 (Requires compliance review)
    CONFIRMED_SANCTION = "CONFIRMED_SANCTION"       # Score >= 0.85 or Exact Hit (Immediate Freeze)


class PEPType(str, Enum):
    NOT_PEP = "NOT_PEP"
    NATIONAL_PEP = "NATIONAL_PEP"                   # Algerian Minister, Wali, MP, General, Magistrate, SOE PDG
    FOREIGN_PEP = "FOREIGN_PEP"                     # Foreign Head of State, Minister, Ambassador
    INTERNATIONAL_ORG_PEP = "INTERNATIONAL_ORG_PEP" # Senior Official at UN, AU, Arab League, IMF
    RCA_PEP = "RCA_PEP"                             # Relative or Close Associate of a PEP


class PEPRiskTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AdverseMediaCategory(str, Enum):
    MONEY_LAUNDERING_FINANCIAL_CRIME = "MONEY_LAUNDERING_FINANCIAL_CRIME"
    BRIBERY_PUBLIC_CORRUPTION = "BRIBERY_PUBLIC_CORRUPTION"
    TAX_EVASION_CUSTOMS_FRAUD = "TAX_EVASION_CUSTOMS_FRAUD"
    COMMERCIAL_DISPUTE_INSOLVENCY = "COMMERCIAL_DISPUTE_INSOLVENCY"
    ILLEGAL_CAPITAL_FLIGHT = "ILLEGAL_CAPITAL_FLIGHT"


class AdverseMediaSeverity(str, Enum):
    CLEAN = "CLEAN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# -----------------------------------------------------------------------------
# SUB-MODELS
# -----------------------------------------------------------------------------

class SanctionHit(BaseModel):
    regime: SanctionRegime = Field(..., description="Sanctioning authority or regime")
    listReferenceId: str = Field(..., description="Official designation ID in the sanctions list")
    matchedEntityName: str = Field(..., description="Target name as registered in the sanctions list")
    queryName: str = Field(..., description="Input query name searched")
    matchScore: float = Field(..., ge=0.0, le=1.0, description="Composite fuzzy similarity score [0.0, 1.0]")
    matchConfidence: str = Field(..., description="EXACT, HIGH_CONFIDENCE, or FUZZY_POSSIBLE")
    designationDate: Optional[str] = Field(None, description="Date placed on sanctions register")
    legalBasis: Optional[str] = Field(None, description="Legal act, decree, or resolution number")
    programs: List[str] = Field(default_factory=list, description="Sanctions programs / reasons")
    countryOfOrigin: Optional[str] = Field(None, description="Country associated with sanctioned entity")


class PEPHit(BaseModel):
    isPep: bool = Field(..., description="Whether person meets PEP statutory definitions")
    pepType: PEPType = Field(default=PEPType.NOT_PEP, description="Categorization of PEP")
    pepRoleTitle: Optional[str] = Field(None, description="Statutory office or political role held")
    institutionName: Optional[str] = Field(None, description="Government ministry, state organ, or SOE")
    riskTier: PEPRiskTier = Field(default=PEPRiskTier.LOW, description="AML risk tier")
    isCurrentlyInOffice: bool = Field(default=True, description="Whether currently serving or in cooling-off period")
    exitYear: Optional[int] = Field(None, description="Year vacated office if former PEP")
    enhancedDueDiligenceMandatory: bool = Field(default=False, description="Whether Law 05-01 / 23-01 triggers mandatory EDD")
    statutoryLegalCitation: str = Field(..., description="Law reference (e.g. 'Law 05-01 Art. 2 & Law 23-01')")


class AdverseMediaArticle(BaseModel):
    title: str = Field(..., description="Article or legal publication headline")
    source: str = Field(..., description="Media outlet, Joradp, or registry source")
    publicationDate: Optional[str] = Field(None, description="Publication date (YYYY-MM-DD)")
    category: AdverseMediaCategory = Field(..., description="Class of adverse finding")
    severity: AdverseMediaSeverity = Field(..., description="Severity of adverse risk")
    snippet: str = Field(..., description="Excerpt or snippet containing the matched keywords")
    sentimentScore: float = Field(..., ge=-1.0, le=1.0, description="Sentiment polarity (-1.0 negative to +1.0 positive)")
    keywordsMatched: List[str] = Field(default_factory=list, description="Specific crime or dispute keywords detected")


class FuzzyMatchDetail(BaseModel):
    tokenSimilarity: float = Field(..., ge=0.0, le=1.0, description="Token set ratio")
    levenshteinRatio: float = Field(..., ge=0.0, le=1.0, description="Normalized Levenshtein ratio")
    jaroWinklerScore: float = Field(..., ge=0.0, le=1.0, description="Jaro-Winkler prefix-weighted score")
    phoneticMatch: bool = Field(..., description="Whether Algerian transliteration phonetic roots match")
    compositeScore: float = Field(..., ge=0.0, le=1.0, description="Weighted composite match score [0.0, 1.0]")


# -----------------------------------------------------------------------------
# REQUEST & RESPONSE MODELS
# -----------------------------------------------------------------------------

class SanctionsScreeningRequest(BaseModel):
    entityName: str = Field(..., min_length=2, description="Individual full name or legal company name")
    aliases: List[str] = Field(default_factory=list, description="Known transliterations or trade aliases")
    dateOfBirth: Optional[str] = Field(None, description="DOB in YYYY-MM-DD format if individual")
    nationalId: Optional[str] = Field(None, description="NIN or passport number")
    countryCode: str = Field(default="DZ", description="ISO 2-letter country code")
    includeAdverseMedia: bool = Field(default=True, description="Whether to execute automated adverse media scanning")
    includePepCheck: bool = Field(default=True, description="Whether to execute PEP registry cross-check")


class SanctionsScreeningResponse(BaseModel):
    screeningId: str = Field(..., description="Unique diligence screening audit UUID")
    entityQueried: str = Field(..., description="Normalized queried name")
    riskLevel: SanctionRiskLevel = Field(..., description="Overall screening verdict")
    compositeRiskScore: float = Field(..., ge=0.0, le=100.0, description="Composite sanctions risk index [0, 100]")
    sanctionsHits: List[SanctionHit] = Field(default_factory=list, description="Matches in international/domestic sanctions lists")
    pepAssessment: PEPHit = Field(..., description="PEP status assessment")
    adverseMediaSummary: List[AdverseMediaArticle] = Field(default_factory=list, description="Flagged negative media records")
    algerianFreezeListHit: bool = Field(default=False, description="True if matched against Algerian CTRF National Freeze List")
    mandatoryReportingRequired: bool = Field(default=False, description="Whether report must be filed with CTRF under Law 05-01")
    recommendedAction: str = Field(..., description="Compliance recommendation (e.g. BLOCK_FUNDS, ENHANCED_DUE_DILIGENCE, CLEAR)")
    timestamp: str = Field(..., description="ISO 8601 screening timestamp")


class FuzzyMatchRequest(BaseModel):
    queryName: str = Field(..., min_length=2, description="Name to match (e.g. 'Mohamed Cherif')")
    targetName: str = Field(..., min_length=2, description="Candidate name to test against (e.g. 'Mouhamed Cherif')")


class FuzzyMatchResponse(BaseModel):
    queryNormalized: str
    targetNormalized: str
    matchDetails: FuzzyMatchDetail
    isMatch: bool = Field(..., description="True if compositeScore >= 0.75 or phonetic match")


class PEPScreeningRequest(BaseModel):
    fullName: str = Field(..., min_length=2, description="Full legal name of candidate")
    nationalId: Optional[str] = Field(None, description="Algerian NIN or national identity number")
    knownRoles: List[str] = Field(default_factory=list, description="Known public positions or corporate titles")
    affiliations: List[str] = Field(default_factory=list, description="Known family or business ties")


class PEPScreeningResponse(BaseModel):
    candidateName: str
    pepHit: PEPHit
    recommendedMitigations: List[str] = Field(default_factory=list, description="AML governance conditions for onboarding")


class AdverseMediaScanRequest(BaseModel):
    entityName: str = Field(..., min_length=2, description="Name of founder, executive, or company")
    additionalKeywords: List[str] = Field(default_factory=list, description="Specific terms to include")
    customCorpus: Optional[List[Dict[str, Any]]] = Field(None, description="Optional extra media feeds or articles to scan")


class AdverseMediaScanResponse(BaseModel):
    entityName: str
    overallSeverity: AdverseMediaSeverity
    articlesFlagged: List[AdverseMediaArticle]
    totalArticlesAnalyzed: int
    riskSummary: str
