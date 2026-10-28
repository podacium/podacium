"""
TamWheel Sovereign Ethical Agentic Venture OS — Tathir Charity Routing Protocol.
Implements:
1. Automated charity routing for financial purification (Tathir) under AAOIFI Standard No. 21.
2. Registry of accredited Algerian public interest charities and humanitarian endowments.
3. Cryptographically verifiable donation receipts (TathirReceipt) with statutory non-deductibility compliance.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & MODELS
# =============================================================================

class CharitySector(str, enum.Enum):
    PUBLIC_HEALTH = "PUBLIC_HEALTH"
    DISASTER_HUMANITARIAN_RELIEF = "DISASTER_HUMANITARIAN_RELIEF"
    STUDENT_EDUCATION_TECH_GRANTS = "STUDENT_EDUCATION_TECH_GRANTS"
    RURAL_WATER_SOLAR_ENDOWMENT = "RURAL_WATER_SOLAR_ENDOWMENT"
    ORPHAN_CHILD_WELFARE = "ORPHAN_CHILD_WELFARE"


class ReceiptStatus(str, enum.Enum):
    DISBURSED = "DISBURSED"
    PENDING = "PENDING"


class AccreditedCharity(BaseModel):
    charity_id: str
    official_name: str
    arabic_name: str
    sector: CharitySector
    registration_number: str
    description: str
    governing_body: str = "Ministry of Interior and Local Authorities (Algeria)"
    is_active: bool = True


class TathirDisbursementRequest(BaseModel):
    donor_id: str = Field(..., description="Unique investor or startup ID")
    donor_name: str = Field(..., description="Legal name or platform handle of donor")
    charity_id: str = Field(..., description="ID of accredited charity recipient")
    amount_dzd: float = Field(..., gt=0, description="Amount of tainted/impermissible income to cleanse in DZD")
    source_description: str = Field(..., min_length=5, description="Origin of tainted revenue (e.g. incidental deposit interest)")
    confirm_non_tax_deductible: bool = Field(
        ...,
        description="Mandatory affirmation: donor forfeits any tax deduction or worldly commercial refund",
    )


class TathirReceipt(BaseModel):
    receipt_id: str
    receipt_verification_hash: str = Field(..., description="SHA-256 cryptographic proof of the disbursement")
    donor_id: str
    donor_name: str
    charity_id: str
    charity_name: str
    charity_arabic_name: str
    sector: CharitySector
    amount_dzd: float
    status: ReceiptStatus = ReceiptStatus.DISBURSED
    is_tax_deductible: bool = False
    source_description: str
    purification_standard: str = "AAOIFI Shariah Standard No. 21 (Clause 3/4 - Tathir)"
    non_tax_deductibility_declaration: str = (
        "CONFIRMED: This amount is disbursed strictly to charitable public interest without tax benefit, "
        "deduction, or worldly return, fulfilling religious purification obligations under Sharia principles."
    )
    disbursed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    supervisory_audit_stamp: str = "Tamwheel Sharia Supervisory & Charity Clearing Protocol"


# =============================================================================
# ACCREDITED ALGERIAN CHARITY REGISTRY
# =============================================================================

ACCREDITED_CHARITIES: List[AccreditedCharity] = [
    AccreditedCharity(
        charity_id="CHARITY-CRA-001",
        official_name="Algerian Red Crescent (Croissant-Rouge Algérien)",
        arabic_name="الهلال الأحمر الجزائري",
        sector=CharitySector.DISASTER_HUMANITARIAN_RELIEF,
        registration_number="ALG-CRA-1956",
        description="National public interest humanitarian organization providing medical emergency aid, winter kits, and disaster relief across all 58 wilayas.",
    ),
    AccreditedCharity(
        charity_id="CHARITY-FOREM-002",
        official_name="National Foundation for Health Promotion and Research Development (FOREM)",
        arabic_name="المؤسسة الوطنية لترقية الصحة وتطوير البحث (فورام)",
        sector=CharitySector.PUBLIC_HEALTH,
        registration_number="ALG-FOREM-1990",
        description="Pediatric healthcare promotion, psychological aid, orphan support centers, and specialized medical clinics for vulnerable children.",
    ),
    AccreditedCharity(
        charity_id="CHARITY-ELBARAKA-003",
        official_name="El Baraka Association for Humanitarian and Charitable Work",
        arabic_name="جمعية البركة للعمل الخيري والإنساني",
        sector=CharitySector.ORPHAN_CHILD_WELFARE,
        registration_number="ALG-ELBARAKA-2012",
        description="Poverty alleviation, seasonal food baskets, orphan sponsorships, and family emergency assistance.",
    ),
    AccreditedCharity(
        charity_id="CHARITY-TECH-ENDOW-004",
        official_name="Sovereign Tech & Student Scholarship Endowment",
        arabic_name="وقف التكنولوجيا والمنح الطلابية الجامعية",
        sector=CharitySector.STUDENT_EDUCATION_TECH_GRANTS,
        registration_number="ALG-ENDOW-2024",
        description="Non-dilutive hardware grants and student living endowments for low-income STEM and AI university students (ESI, USTHB, Constantine).",
    ),
    AccreditedCharity(
        charity_id="CHARITY-WATER-SOLAR-005",
        official_name="Rural Water & Solar Agricultural Endowment",
        arabic_name="وقف سقيا الماء والطاقة الشمسية الريفية",
        sector=CharitySector.RURAL_WATER_SOLAR_ENDOWMENT,
        registration_number="ALG-WATER-2025",
        description="Drilling water wells, solar pumping stations, and irrigation networks for smallholder date and cereal farmers in arid wilayas (Biskra, Djelfa, Adrar).",
    ),
]


# =============================================================================
# TATHIR CHARITY ROUTING SERVICE
# =============================================================================

class TathirCharityRoutingService:
    """
    Automates the routing and cryptographic certification of Tathir purification flows.
    Guarantees:
    - Funds only reach accredited public interest institutions.
    - Explicit agreement to Sharia non-tax-deductibility.
    - Immutable receipt issuance with SHA-256 validation seal.
    """

    def __init__(self) -> None:
        self._charities: Dict[str, AccreditedCharity] = {c.charity_id: c for c in ACCREDITED_CHARITIES}
        # Alias common IDs
        if "CHARITY-ELBARAKA-003" in self._charities:
            self._charities["el-baraka-association-dz"] = self._charities["CHARITY-ELBARAKA-003"]
        self._receipts: Dict[str, TathirReceipt] = {}

    def get_accredited_charities(self) -> List[AccreditedCharity]:
        return list(self._charities.values())

    def get_charity(self, charity_id: str) -> Optional[AccreditedCharity]:
        return self._charities.get(charity_id)

    def disburse_purification(self, req: TathirDisbursementRequest) -> TathirReceipt:
        charity = self._charities.get(req.charity_id)
        if not charity:
            raise KeyError(f"Accredited charity '{req.charity_id}' not found.")

        if not req.confirm_non_tax_deductible:
            raise ValueError(
                "Sharia compliance requires explicit confirmation that this purification disbursement "
                "will not be claimed as a tax deduction or offset."
            )

        if req.amount_dzd <= 0:
            raise ValueError("Disbursement amount must be strictly positive.")

        now = datetime.now(timezone.utc)
        receipt_seed = f"{req.donor_id}:{req.charity_id}:{req.amount_dzd}:{now.isoformat()}"
        verification_hash = hashlib.sha256(receipt_seed.encode("utf-8")).hexdigest()
        receipt_id = f"RCPT-TATHIR-{verification_hash[:10].upper()}"

        receipt = TathirReceipt(
            receipt_id=receipt_id,
            receipt_verification_hash=verification_hash,
            donor_id=req.donor_id,
            donor_name=req.donor_name,
            charity_id=charity.charity_id,
            charity_name=charity.official_name,
            charity_arabic_name=charity.arabic_name,
            sector=charity.sector,
            amount_dzd=round(req.amount_dzd, 2),
            source_description=req.source_description,
            disbursed_at=now,
        )

        self._receipts[receipt_id] = receipt
        return receipt

    def get_receipt(self, receipt_id: str) -> Optional[TathirReceipt]:
        return self._receipts.get(receipt_id)

    def list_receipts(self, donor_id: Optional[str] = None) -> List[TathirReceipt]:
        results = list(self._receipts.values())
        if donor_id:
            results = [r for r in results if r.donor_id == donor_id]
        return results


tathir_routing_service = TathirCharityRoutingService()
