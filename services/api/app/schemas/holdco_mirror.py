"""
Pydantic Schemas for Cross-Border Dual HoldCo / OpCo Mirroring Engine.
Governs international Holding Companies (ADGM, Delaware, UK TopCo) mirrored
to Algerian SPAS Operating Companies under Law 22-09, Banque d'Algérie Regulation 07-01
capital account transfers, FDI compliance, and Transfer Pricing / IP Licensing (Ijarah).
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class HoldCoJurisdiction(str, Enum):
    ADGM = "ADGM"  # Abu Dhabi Global Market (Common Law, English Court)
    DELAWARE_CCORP = "DELAWARE_CCORP"  # Delaware, USA (General Corporation Law DGCL)
    UK_TOPCO = "UK_TOPCO"  # UK Companies Act TopCo (London)
    DIFC = "DIFC"  # Dubai International Financial Centre
    SINGAPORE = "SINGAPORE"  # ACRA Pte. Ltd.


class HoldCoShareClass(str, Enum):
    ORDINARY = "ORDINARY"
    SERIES_SEED_PREFERRED = "SERIES_SEED_PREFERRED"
    SERIES_A_PREFERRED = "SERIES_A_PREFERRED"
    SERIES_B_PREFERRED = "SERIES_B_PREFERRED"
    GROWTH_PREFERRED = "GROWTH_PREFERRED"
    ESOP_RESERVE = "ESOP_RESERVE"


class OpCoShareClass(str, Enum):
    ACTIONS_ORDINAIRES = "ACTIONS_ORDINAIRES"
    ACTIONS_PREFERENCE_CAT_A = "ACTIONS_PREFERENCE_CAT_A"
    ACTIONS_PREFERENCE_CAT_B = "ACTIONS_PREFERENCE_CAT_B"
    BSA_AIR_WARRANTS = "BSA_AIR_WARRANTS"
    RESERVE_ESOP_ACTIONS = "RESERVE_ESOP_ACTIONS"


class BanqueAlgerieFilingStatus(str, Enum):
    DRAFT = "DRAFT"
    AAPI_REGISTERED = "AAPI_REGISTERED"  # Registered with Algerian Investment Promotion Agency (AAPI)
    PENDING_CENTRAL_BANK = "PENDING_CENTRAL_BANK"  # Submitted to Authorized Intermediary Bank
    RETROCESSION_OBTAINED = "RETROCESSION_OBTAINED"  # Foreign currency retroceded & credited in DZD
    REGULATION_07_01_COMPLIANT = "REGULATION_07_01_COMPLIANT"  # Full clearance under BA Reg. 07-01
    AUDIT_FLAGGED = "AUDIT_FLAGGED"


class TransferPricingAgreementType(str, Enum):
    IP_LICENSING_IJARAH = "IP_LICENSING_IJARAH"  # Usufruct / Manfa'ah licensing of intellectual property
    CENTRALIZED_MANAGEMENT_SERVICES = "CENTRALIZED_MANAGEMENT_SERVICES"  # Strategic & administrative services
    COST_PLUS_RD_DEVELOPMENT = "COST_PLUS_RD_DEVELOPMENT"  # OpCo software engineering cost-plus model


class ShariaContractStructure(str, Enum):
    IJARAH_MANFAAH = "IJARAH_MANFAAH"  # Compliant lease of intangible rights / software IP usufruct
    WAKALAH_BIL_UJRAH = "WAKALAH_BIL_UJRAH"  # Agency with defined fee for commercialization
    MURABAHA_COST_PLUS = "MURABAHA_COST_PLUS"  # Cost-plus benchmarked service delivery


class HoldCoMirrorSetupRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str = Field(..., description="Unique ID of the Algerian SPAS OpCo")
    holdco_name: str = Field(..., description="Legal registered name of offshore HoldCo")
    jurisdiction: HoldCoJurisdiction = Field(default=HoldCoJurisdiction.ADGM)
    registration_number: str = Field(..., description="Offshore commercial registry number")
    currency: str = Field(default="USD", description="Functional currency of HoldCo (USD, EUR, AED, GBP)")
    fx_rate_to_dzd: Decimal = Field(default=Decimal("134.50"), gt=0, description="FX rate against DZD")
    opco_shares_per_holdco_share: Decimal = Field(
        default=Decimal("1.0"),
        gt=0,
        description="Mirror calibration ratio (N OpCo SPAS shares per 1 HoldCo share)",
    )
    total_authorized_shares_holdco: int = Field(default=10000000, gt=0)
    par_value_foreign: Decimal = Field(default=Decimal("0.0001"), gt=0)
    par_value_opco_dzd: Decimal = Field(default=Decimal("1000.00"), gt=0)


class HoldCoShareIssuanceRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    stakeholder_id: str
    stakeholder_name: str
    stakeholder_email: Optional[str] = None
    diaspora_country: str = Field(default="France", description="Country of tax residence / diaspora")
    holdco_share_class: HoldCoShareClass = Field(default=HoldCoShareClass.ORDINARY)
    shares_issued_holdco: int = Field(..., gt=0)
    issue_price_foreign: Decimal = Field(..., gt=0)
    investment_round: str = Field(default="Seed Round")
    issue_date: Optional[str] = None


class MirrorShareholderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stakeholder_id: str
    name: str
    diaspora_country: str
    holdco_share_class: str
    holdco_shares: int
    mirrored_opco_shares: int
    issue_price_foreign: Decimal
    total_invested_foreign: Decimal
    total_invested_dzd: Decimal
    ownership_percentage_holdco: Decimal
    ownership_percentage_opco: Decimal
    parity_verified: bool


class CrossBorderMirrorStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    holdco_name: str
    jurisdiction: HoldCoJurisdiction
    registration_number: str
    currency: str
    fx_rate_to_dzd: Decimal
    mirror_ratio: Decimal  # opco_shares_per_holdco_share
    total_holdco_issued_shares: int
    total_opco_mirrored_shares: int
    implied_valuation_foreign: Decimal
    implied_valuation_dzd: Decimal
    parity_verified: bool
    equity_leakage_detected: bool
    shareholders: List[MirrorShareholderSummary]
    banque_algerie_compliance_summary: str
    created_at: str
    last_synced_at: str


class FDIRegulatoryFilingRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    capital_imported_foreign: Decimal = Field(..., gt=0)
    currency: str = Field(default="USD")
    commercial_bank_domiciliation: str = Field(
        default="Banque Nationale d'Algérie (BNA) - Agence Alger Centre",
        description="Algerian primary authorized intermediary bank handling foreign exchange",
    )
    aapi_investment_code: Optional[str] = Field(None, description="AAPI / ANDI registered certificate number")
    customs_or_treasury_ref: Optional[str] = None
    statutory_deadline_days: int = Field(default=60, description="Notice window in calendar days under BA rules")


class FDIRegulatoryFilingRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filing_id: str
    startup_id: str
    capital_imported_foreign: Decimal
    currency: str
    fx_rate_applied: Decimal
    retrocession_amount_dzd: Decimal
    commercial_bank_domiciliation: str
    aapi_investment_code: str
    regulation_07_01_reference: str
    compliance_status: BanqueAlgerieFilingStatus
    filing_date: str
    statutory_deadline: str
    is_compliant: bool
    checklist_status: Dict[str, bool]
    official_notification_memo: str


class TransferPricingAgreementRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    agreement_type: TransferPricingAgreementType = Field(
        default=TransferPricingAgreementType.IP_LICENSING_IJARAH
    )
    sharia_structure: ShariaContractStructure = Field(
        default=ShariaContractStructure.IJARAH_MANFAAH
    )
    royalty_rate_percent: Decimal = Field(
        default=Decimal("5.0"),
        ge=0,
        le=30,
        description="Arm's length IP license royalty percentage on net revenue",
    )
    cost_plus_markup_percent: Optional[Decimal] = Field(
        default=Decimal("10.0"),
        description="Mark-up percentage for cost-plus R&D services under Art. 169 bis CIDTA",
    )
    effective_date: Optional[str] = None
    term_years: int = Field(default=5, ge=1, le=20)
    apply_double_tax_treaty: bool = Field(
        default=True,
        description="Apply DTT withholding tax rates (e.g. Algeria-UAE 0-10% vs CIDTA Art. 156 24%)",
    )


class TransferPricingAgreementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agreement_id: str
    startup_id: str
    holdco_name: str
    opco_name: str
    agreement_type: TransferPricingAgreementType
    sharia_structure: ShariaContractStructure
    sharia_compliance_certificate: str
    royalty_rate_percent: Decimal
    cost_plus_markup_percent: Optional[Decimal]
    arm_length_benchmark_justification: str
    cidta_article_169_bis_compliance: bool
    withholding_tax_rate_percent: Decimal
    bilateral_treaty_citation: str
    generated_contract_markdown: str
    effective_date: str
    expiration_date: str
    audit_hash_sha256: str
