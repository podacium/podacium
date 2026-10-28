"""
TamWheel Sovereign Ethical Agentic Venture OS — Executive Vetting & Officer Disqualification Schemas.
Implements data models for:
- Algerian NIN (Numéro d'Identification Nationale) format & identity verification
- CNRC Official Disqualification Register (Fichier National des Fraudeurs / Interdictions de Gérer - Law 04-08)
- Commercial Court Bankruptcy & Judicial Liquidation decrees (Code de Commerce Art. 800+)
- Undisclosed concurrent directorships and conflict-of-interest holding structures (Art. 615 & 569)
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DisqualificationType(str, Enum):
    INTERDICTION_DE_GERER = "INTERDICTION_DE_GERER"               # Court ordered managing ban
    FAILLITE_PERSONNELLE = "FAILLITE_PERSONNELLE"                 # Personal bankruptcy
    INFRACTION_FISCALE_MAJEURE = "INFRACTION_FISCALE_MAJEURE"     # Serious tax evasion / fraudulent billing
    FRAUDE_DOUANIERE = "FRAUDE_DOUANIERE"                         # Customs fraud / illicit capital transfer
    CHEQUE_SANS_PROVISION = "CHEQUE_SANS_PROVISION"               # Bad cheques under Penal Code Art. 374
    FAUX_ET_USAGE_DE_FAUX = "FAUX_ET_USAGE_DE_FAUX"               # Corporate forgery
    NONE = "NONE"


class CNRCRegisterStatus(str, Enum):
    AUCUNE_INSCRIPTION = "AUCUNE_INSCRIPTION"                     # Clean record
    INSCRIT_INTERDIT = "INSCRIT_INTERDIT"                         # Active disqualification
    REHABILITE = "REHABILITE"                                     # Judicially rehabilitated
    SUSPENDU_SOUS_RECOURS = "SUSPENDU_SOUS_RECOURS"               # Under stay of execution appeal


class InsolvencyStatus(str, Enum):
    CLEAN = "CLEAN"
    CESSATION_DES_PAIEMENTS = "CESSATION_DES_PAIEMENTS"           # Default / insolvency declared
    REGLEMENT_JUDICIAIRE = "REGLEMENT_JUDICIAIRE"                 # Court debt workout
    LIQUIDATION_JUDICIAIRE = "LIQUIDATION_JUDICIAIRE"             # Compulsory liquidation
    FAILLITE_FRAUDULEUSE = "FAILLITE_FRAUDULEUSE"                 # Fraudulent bankruptcy


class CorporateEntityType(str, Enum):
    SPA = "SPA"       # Société par Actions (max 5 mandates under Art. 615)
    SARL = "SARL"     # Société à Responsabilité Limitée (non-compete duty under Art. 569)
    EURL = "EURL"     # Entreprise Unipersonnelle à Responsabilité Limitée
    SNC = "SNC"       # Société en Nom Collectif
    OFFSHORE = "OFFSHORE"


class ExecutiveVerdict(str, Enum):
    APPROVED = "APPROVED"                                         # Low risk, no legal impediments
    FLAGGED_CONDITIONAL = "FLAGGED_CONDITIONAL"                   # Governance conflict or required mitigation
    DISQUALIFIED = "DISQUALIFIED"                                 # Statutory legal ban active; prohibited from managing


# -----------------------------------------------------------------------------
# SUB-MODELS
# -----------------------------------------------------------------------------

class CNRCDisqualificationRecord(BaseModel):
    recordId: str = Field(..., description="CNRC disqualification register docket number")
    status: CNRCRegisterStatus = Field(..., description="Registration status")
    disqualificationType: DisqualificationType = Field(..., description="Type of disqualification")
    courtName: str = Field(..., description="Issuing tribunal / cour de justice")
    judgmentDate: str = Field(..., description="Date of sentence or decree (YYYY-MM-DD)")
    expiryDate: Optional[str] = Field(None, description="Expiry date of ban, or None if perpetual")
    legalBasis: str = Field(..., description="Statutory reference (e.g. 'Loi 04-08 Art. 34 / Code de Commerce Art. 805')")
    notes: Optional[str] = Field(None, description="Official court or CNRC commentary")


class BankruptcyHistoryRecord(BaseModel):
    companyName: str = Field(..., description="Name of insolvent legal entity")
    commercialRegisterNumber: str = Field(..., description="Numéro du Registre de Commerce (RC)")
    roleHeld: str = Field(..., description="Executive position held (Gérant, PDG, Administrateur)")
    insolvencyType: InsolvencyStatus = Field(..., description="Court decree nature")
    judgmentDate: str = Field(..., description="Date of court ruling")
    lookbackYears: float = Field(..., description="Years elapsed since judgment")
    managerLiabilityDecreed: bool = Field(
        default=False,
        description="Whether court decreed personal manager liability / comblement de passif",
    )
    isWithinLookbackWindow: bool = Field(
        default=True,
        description="True if within the 5-year commercial diligence window",
    )


class DirectorshipMandate(BaseModel):
    companyName: str = Field(..., description="Commercial entity name")
    companyRcNumber: Optional[str] = Field(None, description="CNRC registration number")
    entityType: CorporateEntityType = Field(..., description="Corporate form (SPA, SARL, etc.)")
    role: str = Field(..., description="Role title (e.g. 'Gérant', 'Administrateur', 'PDG')")
    appointmentDate: Optional[str] = Field(None, description="Date mandate began")
    isCurrent: bool = Field(default=True, description="Whether currently active")
    sector: Optional[str] = Field(None, description="Industry sector (e.g. 'Fintech', 'Logistics')")
    isDirectCompetitor: bool = Field(default=False, description="Whether competitor to target startup")
    sharesOwnedPercentage: float = Field(default=0.0, ge=0.0, le=100.0, description="Equity holding percentage")


class GovernanceConflictFlag(BaseModel):
    conflictType: str = Field(..., description="NATURE_OF_CONFLICT: SPA_MANDATE_LIMIT_EXCEEDED, SARL_COMPETITOR_GERANT, UNDISCLOSED_HOLDING")
    severity: str = Field(..., description="HIGH, MEDIUM, or CRITICAL")
    description: str = Field(..., description="Detailed explanation of the governance or statutory clash")
    statutoryArticle: str = Field(..., description="Algerian Commercial Code reference (e.g. 'Art. 615', 'Art. 569')")
    mitigationRequired: str = Field(..., description="Required remedial action before capital disbursement")


# -----------------------------------------------------------------------------
# REQUEST & RESPONSE MODELS
# -----------------------------------------------------------------------------

class ExecutiveVettingRequest(BaseModel):
    officerId: Optional[str] = Field(None, description="Internal user or officer identifier")
    fullName: str = Field(..., min_length=2, description="Full legal name (e.g. 'Kamel Benabderrahmane')")
    nationalIdNumber: Optional[str] = Field(None, description="18-digit Algerian NIN or biometric passport number")
    dateOfBirth: Optional[str] = Field(None, description="YYYY-MM-DD")
    wilayaOfBirth: Optional[str] = Field(None, description="Wilaya code 01-58 or name")
    intendedRoleInStartup: str = Field(default="Gérant", description="Role to assume (Gérant, PDG, Administrateur, CTO)")
    targetStartupSector: Optional[str] = Field(None, description="Industry sector of the target venture")
    targetStartupEntityType: CorporateEntityType = Field(default=CorporateEntityType.SARL)
    knownMandates: List[DirectorshipMandate] = Field(default_factory=list, description="Claimed or discovered corporate directorships")


class ExecutiveVettingResponse(BaseModel):
    vettingId: str = Field(..., description="Unique executive background audit identifier")
    officerName: str = Field(..., description="Name of vetted officer")
    ninValidated: bool = Field(..., description="Whether NIN follows official 18-digit Algerian format")
    overallVerdict: ExecutiveVerdict = Field(..., description="APPROVED, FLAGGED_CONDITIONAL, or DISQUALIFIED")
    executiveRiskScore: float = Field(..., ge=0.0, le=100.0, description="Composite executive risk index [0, 100]")
    cnrcDisqualificationRecord: CNRCDisqualificationRecord = Field(..., description="Fichier National des Fraudeurs check")
    bankruptcyHistory: List[BankruptcyHistoryRecord] = Field(default_factory=list, description="Prior insolvencies")
    activeMandatesCount: int = Field(..., ge=0, description="Total active directorships")
    spaMandatesCount: int = Field(..., ge=0, description="Active SPA mandates (max 5 statutory limit)")
    governanceConflicts: List[GovernanceConflictFlag] = Field(default_factory=list, description="Statutory governance conflicts detected")
    covenantsAndMitigations: List[str] = Field(default_factory=list, description="Conditions precedent for term sheet execution")
    timestamp: str = Field(..., description="ISO 8601 vetting timestamp")


class DisqualificationCheckRequest(BaseModel):
    fullName: str = Field(..., min_length=2)
    nationalId: Optional[str] = Field(None)


class DisqualificationCheckResponse(BaseModel):
    candidateName: str
    isDisqualified: bool
    record: CNRCDisqualificationRecord


class MandatesCheckRequest(BaseModel):
    officerName: str = Field(..., min_length=2)
    currentMandates: List[DirectorshipMandate]
    proposedNewRole: str = Field(default="Gérant")
    targetEntityType: CorporateEntityType = Field(default=CorporateEntityType.SARL)
    targetSector: Optional[str] = Field(None)


class MandatesCheckResponse(BaseModel):
    officerName: str
    spaMandatesCount: int
    isSpaLimitExceeded: bool
    hasSarlConflictOfInterest: bool
    governanceConflicts: List[GovernanceConflictFlag]
    status: str
