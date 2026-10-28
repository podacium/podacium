"""
Pydantic Schemas for Institutional Side Letter Registry & Statutory CNRC Filing Exporter (Pillar 1 Phase 4).
Tracks special investor covenants (Information Rights, Pro-Rata, Board Observer, MFN, Sharia compliance),
flags conflicts with Algerian Law 22-09 SPAS Statuts, and formats CNRC share register filings.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CovenantType(str, Enum):
    INFORMATION_RIGHTS = "INFORMATION_RIGHTS"
    PRO_RATA_RIGHTS = "PRO_RATA_RIGHTS"
    BOARD_OBSERVER = "BOARD_OBSERVER"
    ADVISORY_BOARD_SEAT = "ADVISORY_BOARD_SEAT"
    MOST_FAVORED_NATION = "MOST_FAVORED_NATION"
    SHARIA_COMPLIANCE = "SHARIA_COMPLIANCE"
    KEY_PERSON_COVENANT = "KEY_PERSON_COVENANT"
    RESTRICTED_TRANSFERS = "RESTRICTED_TRANSFERS"


class SideLetterStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    TERMINATED = "TERMINATED"


class SideLetterCovenant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    covenant_type: CovenantType
    description: str
    threshold_shares_required: int = 0
    reporting_frequency_days: Optional[int] = None
    is_statutory_compliant: bool = True
    specific_terms: Dict[str, Any] = Field(default_factory=dict)


class SideLetterModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    startup_id: str
    investor_id: str
    investor_name: str
    execution_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: SideLetterStatus = SideLetterStatus.ACTIVE
    covenants: List[SideLetterCovenant]
    legal_signatories: List[str]
    statuts_conflict_notes: Optional[List[str]] = None


class SideLetterCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    investor_id: str
    investor_name: str
    execution_date: Optional[datetime] = None
    covenants: List[SideLetterCovenant]
    legal_signatories: List[str]


class StatutsConflictReport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    has_conflicts: bool
    conflicts_count: int
    flagged_covenants: List[Dict[str, Any]]
    recommendations: List[str]


class MfnElectionRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_side_letter_id: str
    target_side_letter_id: str
    adopted_covenant_types: List[CovenantType]


class MfnElectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    side_letter_id: str
    updated_covenants_count: int
    new_terms_summary: str
    effective_date: datetime


class CnrcShareholderFilingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shareholder_name: str
    nationality: str = "Algérienne"
    national_id_or_nif: str
    shares_count: int
    capital_nominal_dzd: Decimal
    ownership_percentage: float
    voting_rights_count: int
    share_class: str = "ORDINAIRE"


class CnrcFilingExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    company_legal_name: str
    commercial_register_num: str  # Numéro RC (CNRC)
    tax_id_num: str  # NIF
    legal_form: str = "SPAS (Société par Actions Simplifiée - Loi 22-09)"
    capital_social_initial_dzd: Decimal
    capital_social_nouveau_dzd: Decimal
    augmentation_capital_dzd: Decimal
    actions_total_nouvelles: int
    valeur_nominale_action_dzd: Decimal
    shareholders_register: List[CnrcShareholderFilingItem]
    notarial_pv_extract_text: str
    export_timestamp: datetime
    filing_hash_sha256: str
