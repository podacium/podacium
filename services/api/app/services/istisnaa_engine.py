"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI Standard No. 10 Istisna'a Engine.
Implements:
1. AAOIFI Shariah Standard No. 10 (Istisna'a and Parallel Istisna'a / الاستصناع والاستصناع الموازي).
2. Milestone-staged progress financing for hardware, clean-tech, and infrastructure ventures:
   - Photovoltaic solar array fabrication (Adrar, Ouargla).
   - Commercial EV charging station hardware (Algiers, Oran).
   - IoT agritech sensory probes & automated drip valves (Biskra, Mitidja).
   - Cold-chain refrigeration units for agricultural produce.
3. Work-in-Progress (WIP) Certification:
   - Mandatory certified engineering inspection before disbursement of each tranche.
4. Defect Liability Period & Warranty Retention Fund (Kafalat al-Siyanah / كفالة الصيانة):
   - 5% to 10% retention withheld from tranches until Final Acceptance Certificate (Shahadat al-Qabul al-Niha'i).
   - Direct deduction from retention fund for non-cured manufacturer defects.
5. Permissible Sharia Liquidated Damages (Shart Jaza'i / الشرط الجزائي):
   - Pre-agreed compensation strictly tied to verified actual direct losses incurred from unexcused delay.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class IstisnaaAssetCategory(str, enum.Enum):
    SOLAR_PHOTOVOLTAIC_ARRAY = "SOLAR_PHOTOVOLTAIC_ARRAY"
    EV_CHARGING_INFRASTRUCTURE = "EV_CHARGING_INFRASTRUCTURE"
    IOT_AGRITECH_SENSORS = "IOT_AGRITECH_SENSORS"
    COLD_CHAIN_REFRIGERATION = "COLD_CHAIN_REFRIGERATION"
    ROBOTICS_AUTOMATION = "ROBOTICS_AUTOMATION"
    CLEANTECH_WATER_TREATMENT = "CLEANTECH_WATER_TREATMENT"


class IstisnaaStage(str, enum.Enum):
    CONTRACT_SIGNED = "CONTRACT_SIGNED"                   # Contract formed, milestones defined
    IN_MANUFACTURING = "IN_MANUFACTURING"                 # Construction in progress, WIP milestones
    PROVISIONAL_ACCEPTANCE = "PROVISIONAL_ACCEPTANCE"     # Hardware delivered, testing passed, retention held
    DEFECT_LIABILITY_ACTIVE = "DEFECT_LIABILITY_ACTIVE"   # Warranty period active (Kafalat al-Siyanah)
    FINAL_ACCEPTANCE = "FINAL_ACCEPTANCE"                 # Warranty ended, retention released, complete
    TERMINATED_DEFAULT = "TERMINATED_DEFAULT"             # Cancelled due to uncured breach


class MilestoneStatus(str, enum.Enum):
    PENDING = "PENDING"
    CERTIFIED = "CERTIFIED"                               # Engineer inspected & approved WIP
    DISBURSED = "DISBURSED"                               # Tranche paid to manufacturer


class DefectSeverity(str, enum.Enum):
    MINOR = "MINOR"
    MAJOR = "MAJOR"
    CRITICAL = "CRITICAL"


class DefectStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    RECTIFIED_BY_MANUFACTURER = "RECTIFIED_BY_MANUFACTURER"
    DEDUCTED_FROM_RETENTION = "DEDUCTED_FROM_RETENTION"


# =============================================================================
# SCHEMAS
# =============================================================================

class IstisnaaMilestoneSpec(BaseModel):
    milestone_index: int = Field(..., ge=1, description="Sequential phase number (1 to N)")
    milestone_name: str = Field(..., min_length=3, description="Milestone title (e.g. Inverter Procurement & PCB Fabrication)")
    completion_target_pct: float = Field(..., gt=0, le=100.0, description="Cumulative progress percentage")
    tranche_amount_dzd: float = Field(..., gt=0, description="Gross disbursement amount for this milestone in DZD")


class IstisnaaMilestone(BaseModel):
    milestone_index: int
    milestone_name: str
    completion_target_pct: float
    tranche_amount_dzd: float
    status: MilestoneStatus = Field(default=MilestoneStatus.PENDING)
    wip_certificate_ref: Optional[str] = None
    engineer_name: Optional[str] = None
    engineer_license: Optional[str] = None
    certified_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    disbursement_payment_ref: Optional[str] = None


class DefectClaim(BaseModel):
    defect_id: str
    defect_description: str
    severity: DefectSeverity
    estimated_repair_cost_dzd: float
    reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: DefectStatus = Field(default=DefectStatus.REPORTED)
    rectified_at: Optional[datetime] = None
    deduction_applied_dzd: float = 0.0


class IstisnaaContractRequest(BaseModel):
    startup_id: str = Field(..., description="Venture ordering the asset (Al-Mustasni')")
    startup_name: str = Field(..., description="Venture legal or brand name")
    manufacturer_id: str = Field(..., description="Manufacturer or fabricator contractor ID (Al-Sani')")
    manufacturer_name: str = Field(..., description="Manufacturer legal company name")
    asset_category: IstisnaaAssetCategory = Field(..., description="Hardware or infrastructure classification")
    asset_description: str = Field(..., min_length=10, description="Comprehensive engineering specifications of asset (Al-Masnu')")
    total_contract_price_dzd: float = Field(..., gt=0, description="Total agreed contract price in DZD")
    retention_rate_pct: float = Field(default=5.0, ge=2.0, le=20.0, description="Warranty retention fund percentage (Kafalat al-Siyanah)")
    defect_liability_months: int = Field(default=12, ge=3, le=36, description="Defect liability warranty duration in months")
    target_delivery_date: datetime = Field(..., description="Contractual delivery and commissioning deadline")
    milestones: List[IstisnaaMilestoneSpec] = Field(..., min_length=1, description="Work-in-progress milestone breakdown")


class WIPCertificationRequest(BaseModel):
    milestone_index: int = Field(..., ge=1, description="Milestone number being certified")
    engineer_name: str = Field(..., min_length=3, description="Certified engineer or technical auditor name")
    engineer_license: str = Field(..., min_length=4, description="Professional engineering chamber / Ordre des Ingénieurs license ID")
    measured_progress_pct: float = Field(..., gt=0, le=100.0, description="Physically verified cumulative progress percentage")
    quality_standards_verified: bool = Field(..., description="True if engineering materials comply with technical specifications")
    lab_inspection_report_ref: str = Field(..., min_length=3, description="Reference to technical audit / lab report document")


class DisburseMilestoneRequest(BaseModel):
    milestone_index: int = Field(..., ge=1, description="Milestone number to disburse")
    payment_reference: str = Field(..., min_length=4, description="Bank transfer or escrow payment release reference")


class ProvisionalAcceptanceRequest(BaseModel):
    handover_protocol_ref: str = Field(..., min_length=4, description="Provisional commissioning / handover protocol document reference")
    acceptance_notes: str = Field(default="Asset manufactured and delivered. Passed initial functional testing.")


class DefectReportRequest(BaseModel):
    defect_description: str = Field(..., min_length=5, description="Description of latent defect or performance malfunction")
    severity: DefectSeverity = Field(default=DefectSeverity.MINOR)
    estimated_repair_cost_dzd: float = Field(..., gt=0, description="Estimated cost to repair or replace defective components")


class ResolveDefectRequest(BaseModel):
    defect_id: str = Field(..., description="ID of defect claim")
    resolved_by_manufacturer: bool = Field(..., description="True if manufacturer repaired defect at their own cost")
    actual_deduction_dzd: float = Field(default=0.0, ge=0.0, description="Cost deducted from retention fund if client repaired")


class FinalAcceptanceRequest(BaseModel):
    client_signoff_confirmed: bool = Field(..., description="Confirmation that all defect claims have been cured")
    supervising_engineer_signoff: str = Field(..., min_length=3, description="Name and signature of supervising engineer")


class LiquidatedDamagesRequest(BaseModel):
    days_overdue: int = Field(..., ge=1, description="Number of days delivery was delayed past contractual deadline")
    verified_actual_direct_loss_dzd: float = Field(..., gt=0, description="Documented actual direct losses incurred (excluding lost profit)")
    delay_justification_evaluated: bool = Field(..., description="Confirmation that delay was not caused by force majeure / excusable events")


class RetentionFundStatus(BaseModel):
    total_retention_allocated_dzd: float
    total_deductions_applied_dzd: float
    remaining_retention_balance_dzd: float
    is_released: bool = False
    released_at: Optional[datetime] = None
    release_payment_ref: Optional[str] = None


class IstisnaaFacility(BaseModel):
    facility_id: str
    startup_id: str
    startup_name: str
    manufacturer_id: str
    manufacturer_name: str
    asset_category: IstisnaaAssetCategory
    asset_description: str
    total_contract_price_dzd: float
    retention_rate_pct: float
    retention_amount_dzd: float
    defect_liability_months: int
    target_delivery_date: datetime
    stage: IstisnaaStage
    milestones: List[IstisnaaMilestone]
    total_disbursed_dzd: float = 0.0
    retention_fund: RetentionFundStatus
    defect_claims: List[DefectClaim] = []
    liquidated_damages_dzd: float = 0.0
    provisional_acceptance_at: Optional[datetime] = None
    final_acceptance_at: Optional[datetime] = None
    sharia_standard_citation: str = "AAOIFI Shariah Standard No. 10 (Istisna'a and Parallel Istisna'a)"
    contract_cryptographic_seal: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# ISTISNA'A ENGINE IMPLEMENTATION
# =============================================================================

class IstisnaaEngine:
    """
    Automated AAOIFI Shariah Standard No. 10 Istisna'a Manufacturing & Hardware Engine.
    Ensures:
    - Structured milestone-based progress financing linked to verified WIP completion.
    - Mandatory engineering inspection certification before capital release.
    - Warranty retention fund (Kafalat al-Siyanah) protection during Defect Liability Period.
    - Sharia-compliant liquidated damages strictly limited to verified direct losses (AAOIFI Standard 10 Clause 3/6).
    - Release of retention fund upon issuance of Final Acceptance Certificate.
    """

    def __init__(self) -> None:
        self._facilities: Dict[str, IstisnaaFacility] = {}

    def create_istisnaa_contract(self, req: IstisnaaContractRequest) -> IstisnaaFacility:
        """
        Stage 1: Form Istisna'a manufacturing contract and initialize milestone schedule.
        """
        now = datetime.now(timezone.utc)
        if req.target_delivery_date <= now:
            raise ValueError("Target delivery date must be set in the future.")

        total_milestones_amount = sum(m.tranche_amount_dzd for m in req.milestones)
        if abs(total_milestones_amount - req.total_contract_price_dzd) > 1.0:
            raise ValueError(
                f"Sum of milestone tranches ({total_milestones_amount:,.2f} DZD) must equal "
                f"total contract price ({req.total_contract_price_dzd:,.2f} DZD)."
            )

        facility_id = f"IST-{hashlib.sha256(f'{req.startup_id}:{req.manufacturer_id}:{now.isoformat()}'.encode()).hexdigest()[:10].upper()}"

        retention_amount = round(req.total_contract_price_dzd * (req.retention_rate_pct / 100.0), 2)

        milestones = [
            IstisnaaMilestone(
                milestone_index=m.milestone_index,
                milestone_name=m.milestone_name,
                completion_target_pct=m.completion_target_pct,
                tranche_amount_dzd=m.tranche_amount_dzd,
                status=MilestoneStatus.PENDING,
            )
            for m in req.milestones
        ]

        retention_status = RetentionFundStatus(
            total_retention_allocated_dzd=retention_amount,
            total_deductions_applied_dzd=0.0,
            remaining_retention_balance_dzd=retention_amount,
            is_released=False,
        )

        seal_payload = {
            "facility_id": facility_id,
            "startup_id": req.startup_id,
            "manufacturer_id": req.manufacturer_id,
            "total_contract_price_dzd": req.total_contract_price_dzd,
            "retention_rate_pct": req.retention_rate_pct,
            "defect_liability_months": req.defect_liability_months,
            "target_delivery_date": req.target_delivery_date.isoformat(),
        }
        cryptographic_seal = hashlib.sha256(json.dumps(seal_payload, sort_keys=True).encode()).hexdigest()

        facility = IstisnaaFacility(
            facility_id=facility_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            manufacturer_id=req.manufacturer_id,
            manufacturer_name=req.manufacturer_name,
            asset_category=req.asset_category,
            asset_description=req.asset_description,
            total_contract_price_dzd=req.total_contract_price_dzd,
            retention_rate_pct=req.retention_rate_pct,
            retention_amount_dzd=retention_amount,
            defect_liability_months=req.defect_liability_months,
            target_delivery_date=req.target_delivery_date,
            stage=IstisnaaStage.CONTRACT_SIGNED,
            milestones=milestones,
            total_disbursed_dzd=0.0,
            retention_fund=retention_status,
            defect_claims=[],
            contract_cryptographic_seal=cryptographic_seal,
            created_at=now,
            updated_at=now,
        )

        self._facilities[facility_id] = facility
        return facility

    def certify_wip_milestone(self, facility_id: str, req: WIPCertificationRequest) -> IstisnaaFacility:
        """
        Stage 2 (Step A): Certified engineering inspection verifying Work-in-Progress (WIP)
        milestone completion before tranche release.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        target_m = next((m for m in facility.milestones if m.milestone_index == req.milestone_index), None)
        if not target_m:
            raise KeyError(f"Milestone #{req.milestone_index} not found in facility '{facility_id}'.")

        if target_m.status != MilestoneStatus.PENDING:
            raise ValueError(f"Milestone #{req.milestone_index} is in status '{target_m.status.value}', expected PENDING.")

        if not req.quality_standards_verified:
            raise ValueError("Cannot certify milestone: quality standards verification failed.")

        if req.measured_progress_pct < target_m.completion_target_pct:
            raise ValueError(
                f"Measured progress ({req.measured_progress_pct}%) is below target "
                f"requirement ({target_m.completion_target_pct}%)."
            )

        now = datetime.now(timezone.utc)
        cert_ref = f"WIP-CERT-{hashlib.sha256(f'{facility_id}:{req.milestone_index}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"

        target_m.status = MilestoneStatus.CERTIFIED
        target_m.wip_certificate_ref = cert_ref
        target_m.engineer_name = req.engineer_name
        target_m.engineer_license = req.engineer_license
        target_m.certified_at = now

        facility.stage = IstisnaaStage.IN_MANUFACTURING
        facility.updated_at = now
        return facility

    def disburse_milestone(self, facility_id: str, req: DisburseMilestoneRequest) -> IstisnaaFacility:
        """
        Stage 2 (Step B): Disburse certified progress payment to manufacturer.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        target_m = next((m for m in facility.milestones if m.milestone_index == req.milestone_index), None)
        if not target_m:
            raise KeyError(f"Milestone #{req.milestone_index} not found in facility '{facility_id}'.")

        if target_m.status != MilestoneStatus.CERTIFIED:
            raise ValueError(
                f"Milestone #{req.milestone_index} cannot be disbursed: status is '{target_m.status.value}', "
                f"must be CERTIFIED by an engineer first."
            )

        now = datetime.now(timezone.utc)
        target_m.status = MilestoneStatus.DISBURSED
        target_m.disbursed_at = now
        target_m.disbursement_payment_ref = req.payment_reference

        facility.total_disbursed_dzd = round(facility.total_disbursed_dzd + target_m.tranche_amount_dzd, 2)
        facility.updated_at = now
        return facility

    def grant_provisional_acceptance(self, facility_id: str, req: ProvisionalAcceptanceRequest) -> IstisnaaFacility:
        """
        Stage 3: Provisional Acceptance upon manufacturing completion and handover.
        Transitions facility into Defect Liability Period (Kafalat al-Siyanah).
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        # Ensure all milestones are disbursed or certified
        non_disbursed = [m for m in facility.milestones if m.status != MilestoneStatus.DISBURSED]
        if non_disbursed:
            raise ValueError(
                f"Cannot grant Provisional Acceptance: {len(non_disbursed)} milestone(s) are not yet disbursed."
            )

        now = datetime.now(timezone.utc)
        facility.stage = IstisnaaStage.DEFECT_LIABILITY_ACTIVE
        facility.provisional_acceptance_at = now
        facility.updated_at = now
        return facility

    def report_defect_claim(self, facility_id: str, req: DefectReportRequest) -> DefectClaim:
        """
        Reports a latent defect during the Defect Liability Period.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        if facility.stage != IstisnaaStage.DEFECT_LIABILITY_ACTIVE:
            raise ValueError(
                f"Defect claims can only be raised during Defect Liability Period. "
                f"Current stage is '{facility.stage.value}'."
            )

        now = datetime.now(timezone.utc)
        defect_id = f"DEFECT-{hashlib.sha256(f'{facility_id}:{len(facility.defect_claims)+1}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"

        claim = DefectClaim(
            defect_id=defect_id,
            defect_description=req.defect_description,
            severity=req.severity,
            estimated_repair_cost_dzd=req.estimated_repair_cost_dzd,
            reported_at=now,
            status=DefectStatus.REPORTED,
        )

        facility.defect_claims.append(claim)
        facility.updated_at = now
        return claim

    def resolve_defect_claim(self, facility_id: str, req: ResolveDefectRequest) -> IstisnaaFacility:
        """
        Resolves a defect claim: either repaired by manufacturer, or deducted from warranty retention fund.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        target_defect = next((d for d in facility.defect_claims if d.defect_id == req.defect_id), None)
        if not target_defect:
            raise KeyError(f"Defect claim '{req.defect_id}' not found in facility '{facility_id}'.")

        now = datetime.now(timezone.utc)

        if req.resolved_by_manufacturer:
            target_defect.status = DefectStatus.RECTIFIED_BY_MANUFACTURER
            target_defect.rectified_at = now
        else:
            # Deduct actual repair cost from warranty retention fund
            deduction = min(req.actual_deduction_dzd, facility.retention_fund.remaining_retention_balance_dzd)
            target_defect.status = DefectStatus.DEDUCTED_FROM_RETENTION
            target_defect.deduction_applied_dzd = deduction
            target_defect.rectified_at = now

            facility.retention_fund.total_deductions_applied_dzd = round(
                facility.retention_fund.total_deductions_applied_dzd + deduction, 2
            )
            facility.retention_fund.remaining_retention_balance_dzd = round(
                facility.retention_fund.remaining_retention_balance_dzd - deduction, 2
            )

        facility.updated_at = now
        return facility

    def apply_liquidated_damages(self, facility_id: str, req: LiquidatedDamagesRequest) -> IstisnaaFacility:
        """
        Applies Sharia-compliant liquidated damages (Shart Jaza'i) for unexcused delay.
        Under AAOIFI Standard No. 10 Clause 3/6, liquidated damages are permissible
        exclusively to cover verified actual direct loss.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        if not req.delay_justification_evaluated:
            raise ValueError(
                "Sharia compliance requires formal evaluation confirming the delay was not "
                "caused by force majeure / excusable impediment before assessing liquidated damages."
            )

        facility.liquidated_damages_dzd = round(req.verified_actual_direct_loss_dzd, 2)
        facility.updated_at = datetime.now(timezone.utc)
        return facility

    def grant_final_acceptance(self, facility_id: str, req: FinalAcceptanceRequest) -> IstisnaaFacility:
        """
        Stage 4: Final Acceptance Certificate (Shahadat al-Qabul al-Niha'i).
        Releases remaining warranty retention fund (Kafalat al-Siyanah) to manufacturer.
        """
        facility = self._facilities.get(facility_id)
        if not facility:
            raise KeyError(f"Istisna'a facility '{facility_id}' not found.")

        if facility.stage != IstisnaaStage.DEFECT_LIABILITY_ACTIVE:
            raise ValueError(
                f"Final acceptance requires facility to be in DEFECT_LIABILITY_ACTIVE stage. "
                f"Current stage is '{facility.stage.value}'."
            )

        if not req.client_signoff_confirmed:
            raise ValueError("Client signoff confirmation is required for Final Acceptance.")

        # Check for unresolved defect claims
        unresolved = [d for d in facility.defect_claims if d.status == DefectStatus.REPORTED]
        if unresolved:
            raise ValueError(f"Cannot grant final acceptance: {len(unresolved)} defect claim(s) remain unresolved.")

        now = datetime.now(timezone.utc)
        release_ref = f"RET-RELEASE-{hashlib.sha256(f'{facility_id}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"

        facility.retention_fund.is_released = True
        facility.retention_fund.released_at = now
        facility.retention_fund.release_payment_ref = release_ref

        facility.stage = IstisnaaStage.FINAL_ACCEPTANCE
        facility.final_acceptance_at = now
        facility.updated_at = now
        return facility

    def get_facility(self, facility_id: str) -> Optional[IstisnaaFacility]:
        return self._facilities.get(facility_id)

    def list_facilities(self, startup_id: Optional[str] = None) -> List[IstisnaaFacility]:
        if startup_id:
            return [f for f in self._facilities.values() if f.startup_id == startup_id]
        return list(self._facilities.values())


istisnaa_engine = IstisnaaEngine()
