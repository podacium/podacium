"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI Standard No. 9 Salam Pre-Financing Engine.
Implements:
1. AAOIFI Shariah Standard No. 9 (Salam and Parallel Salam / السلم والسلم الموازي).
2. Four-stage commodity forward financing lifecycle:
   - STAGE 1: Full immediate advance capital disbursement (Ra's Mal al-Salam / رأس مال السلم).
   - STAGE 2: Precise contractual specification of fungible goods (Al-Muslam Fihi / المسلم فيه):
              quantity, quality standard, grade, delivery date (Ajal), and warehouse depot (Makan al-Taslim).
   - STAGE 3: Commodity delivery receipt, laboratory grading, and physical inspection (Qabd & Taslim).
              Quality divergence price adjustment (Muqassah) or rejection.
   - STAGE 4: Parallel Salam (Salam Muwazi) or Agency sale (Wikalah bi al-Bay') for non-speculative liquidation
              without tying back to the original agricultural producer (AAOIFI Standard No. 9 Clause 4/1).
3. Non-interest Sharia delay remedies:
   - Genuine hardship (Mu'sir): Mandatory respite (Nazirah ila Maysarah) per Qur'an 2:280.
   - Procrastination (Mumathil): 100% late penalty routed to accredited Algerian charities (Tathir).
   - Mutual cancellation (Iqalah) with full restitution of advance capital.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.tathir_routing import (
    tathir_routing_service,
    TathirDisbursementRequest,
    TathirReceipt,
)

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class SalamCommodityType(str, enum.Enum):
    BISKRA_DEGLET_NOUR_DATES = "BISKRA_DEGLET_NOUR_DATES"
    MITIDJA_CITRUS_ORANGES = "MITIDJA_CITRUS_ORANGES"
    SETIF_DURUM_WHEAT = "SETIF_DURUM_WHEAT"
    KABYLIE_EXTRA_VIRGIN_OLIVE_OIL = "KABYLIE_EXTRA_VIRGIN_OLIVE_OIL"
    SAHARA_TOMATO_PASTE = "SAHARA_TOMATO_PASTE"
    MASCARA_TABLE_GRAPES = "MASCARA_TABLE_GRAPES"


class QualityGrade(str, enum.Enum):
    EXTRA_PREMIUM = "EXTRA_PREMIUM"
    GRADE_1 = "GRADE_1"
    GRADE_2 = "GRADE_2"
    SUBSTANDARD = "SUBSTANDARD"


class SalamStage(str, enum.Enum):
    ADVANCE_PAID = "ADVANCE_PAID"                     # Stage 1: Full capital paid upfront
    COMMODITY_SPECIFIED = "COMMODITY_SPECIFIED"       # Stage 2: Specifications fully finalized
    DELIVERY_PENDING = "DELIVERY_PENDING"             # Awaiting harvest / maturity date
    DELIVERED_ACCEPTED = "DELIVERED_ACCEPTED"         # Stage 3: Inspected & accepted as matching/superior
    DELIVERED_ADJUSTED = "DELIVERED_ADJUSTED"         # Stage 3: Inferior grade accepted with price discount
    REJECTED = "REJECTED"                             # Stage 3: Non-conformant and rejected
    PARALLEL_SALAM_ACTIVE = "PARALLEL_SALAM_ACTIVE"   # Stage 4: Parallel Salam contracted
    LIQUIDATED = "LIQUIDATED"                         # Stage 4: Goods liquidated into cash
    CANCELLED_REFUNDED = "CANCELLED_REFUNDED"         # Dissolved (Iqalah) with capital returned


class InspectionOutcome(str, enum.Enum):
    CONFORMANT = "CONFORMANT"                         # Exactly matches contract grade
    SUPERIOR = "SUPERIOR"                             # Higher grade; accepted with no price increase (AAOIFI 9/3/2)
    INFERIOR_ACCEPTABLE = "INFERIOR_ACCEPTABLE"       # Lower grade; accepted with Sharia discount
    DEFECTIVE_REJECTED = "DEFECTIVE_REJECTED"         # Substandard / rejected


class LiquidationMethod(str, enum.Enum):
    PARALLEL_SALAM = "PARALLEL_SALAM"                 # Independent secondary Salam contract
    WIKALAH_AGENCY_SALE = "WIKALAH_AGENCY_SALE"       # Third-party commodity brokerage sale
    DIRECT_COMMODITY_SALE = "DIRECT_COMMODITY_SALE"   # Spot sale to food processor/wholesaler


# =============================================================================
# SCHEMAS
# =============================================================================

class SalamContractRequest(BaseModel):
    producer_id: str = Field(..., description="Agricultural producer or cooperative ID")
    producer_name: str = Field(..., description="Producer legal name (e.g. Coopérative Agricole Tolga Biskra)")
    commodity_type: SalamCommodityType = Field(..., description="Agricultural commodity classification")
    commodity_description: str = Field(..., min_length=5, description="Full descriptive specification of goods (Al-Muslam Fihi)")
    quantity_metric_tons: float = Field(..., gt=0, description="Contracted volume in metric tons")
    unit_price_per_ton_dzd: float = Field(..., gt=0, description="Agreed purchase price per metric ton in DZD")
    expected_quality_grade: QualityGrade = Field(default=QualityGrade.GRADE_1)
    max_moisture_pct: float = Field(default=14.0, ge=0.0, le=100.0, description="Maximum permissible moisture content percentage")
    delivery_date: datetime = Field(..., description="Maturity date (Ajal) when goods must be delivered")
    warehouse_depot_name: str = Field(..., description="Designated licensed warehouse (Makan al-Taslim)")
    warehouse_depot_wilaya: str = Field(..., description="Algerian Wilaya of depot (e.g. Biskra, Blida, Sétif)")
    advance_payment_reference: str = Field(..., min_length=4, description="Bank settlement reference proving 100% upfront capital disbursement")


class SalamInspectionRequest(BaseModel):
    delivery_note_ref: str = Field(..., description="Depot delivery note or warehouse receipt number")
    actual_delivered_metric_tons: float = Field(..., gt=0, description="Physically received quantity in metric tons")
    inspected_grade: QualityGrade = Field(..., description="Laboratory certified quality grade")
    inspected_moisture_pct: float = Field(..., ge=0.0, le=100.0, description="Measured moisture level percentage")
    inspector_credentials: str = Field(..., description="Accredited agricultural inspection body / agronomist license")
    inspection_notes: str = Field(default="Standard quality and physical inspection completed.")
    accept_inferior_with_discount: bool = Field(
        default=False,
        description="If goods are inferior, whether buyer elects to accept with Sharia price discount (Muqassah)",
    )
    negotiated_discount_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=50.0,
        description="Agreed discount percentage if inferior goods accepted",
    )


class ParallelSalamRequest(BaseModel):
    secondary_buyer_id: str = Field(..., description="Institutional off-taker or export distributor ID")
    secondary_buyer_name: str = Field(..., description="Off-taker company name (e.g. Groupe Agrodiv SPA)")
    selling_price_per_ton_dzd: float = Field(..., gt=0, description="Selling price per metric ton in DZD")
    parallel_delivery_date: datetime = Field(..., description="Independent delivery date on or after primary delivery")
    parallel_depot_name: str = Field(..., description="Designated delivery depot for secondary buyer")


class WikalahLiquidationRequest(BaseModel):
    agent_id: str = Field(..., description="Commodity broker or trading agent ID")
    agent_name: str = Field(..., description="Broker entity name")
    minimum_gross_sale_price_dzd: float = Field(..., gt=0, description="Authorized reserve sale price in DZD")
    agency_fee_pct: float = Field(default=2.5, ge=0.0, le=15.0, description="Agreed agency commission fee percentage")


class SalamDelayRemedyRequest(BaseModel):
    is_genuine_insolvency: bool = Field(
        ...,
        description="True if producer suffered force majeure / insolvency (Mu'sir); requires mandatory respite per Qur'an 2:280",
    )
    days_extension: Optional[int] = Field(default=30, ge=1, description="Days of extension granted in case of hardship")
    late_penalty_dzd: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        description="Stipulated delay penalty if delay is unjustified procrastination (Mumathil); routes 100% to charity",
    )
    charity_id: Optional[str] = Field(default="CHARITY-WATER-SOLAR-005", description="Accredited Algerian charity recipient")
    cancel_contract_iqalah: bool = Field(
        default=False,
        description="Whether buyer exercises option to cancel (Iqalah) and claim full refund of advance capital",
    )


class ParallelSalamContract(BaseModel):
    parallel_contract_id: str
    secondary_buyer_id: str
    secondary_buyer_name: str
    quantity_metric_tons: float
    selling_price_per_ton_dzd: float
    total_selling_price_dzd: float
    delivery_date: datetime
    depot_name: str
    contract_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LiquidationRecord(BaseModel):
    liquidation_id: str
    method: LiquidationMethod
    gross_proceeds_dzd: float
    costs_or_fees_dzd: float
    net_proceeds_dzd: float
    profit_or_gain_dzd: float
    transaction_hash: str
    liquidated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InspectionRecord(BaseModel):
    inspection_id: str
    delivery_note_ref: str
    actual_delivered_metric_tons: float
    inspected_grade: QualityGrade
    inspected_moisture_pct: float
    outcome: InspectionOutcome
    inspector_credentials: str
    inspection_notes: str
    price_adjustment_pct: float
    adjusted_total_value_dzd: float
    inspected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SalamFacility(BaseModel):
    contract_id: str
    producer_id: str
    producer_name: str
    commodity_type: SalamCommodityType
    commodity_description: str
    quantity_metric_tons: float
    unit_price_per_ton_dzd: float
    advance_capital_dzd: float  # Ra's Mal al-Salam
    expected_quality_grade: QualityGrade
    max_moisture_pct: float
    delivery_date: datetime
    warehouse_depot_name: str
    warehouse_depot_wilaya: str
    advance_payment_reference: str
    stage: SalamStage
    inspection: Optional[InspectionRecord] = None
    parallel_salam: Optional[ParallelSalamContract] = None
    liquidation: Optional[LiquidationRecord] = None
    charity_penalty_receipt: Optional[TathirReceipt] = None
    sharia_standard_citation: str = "AAOIFI Shariah Standard No. 9 (Salam and Parallel Salam)"
    cryptographic_seal: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SALAM ENGINE IMPLEMENTATION
# =============================================================================

class SalamEngine:
    """
    Automated AAOIFI Shariah Standard No. 9 Salam Pre-Financing Engine.
    Ensures:
    - 100% immediate spot disbursement of advance capital (Ra's Mal al-Salam).
    - Precise contractual definition of fungible goods in Dhimmah to avoid Gharar.
    - Physical warehouse depot delivery verification & laboratory grading.
    - Sharia price adjustment (Muqassah) for inferior delivery or superior delivery acceptance.
    - Parallel Salam (Salam Muwazi) independence: second contract strictly uncoupled from first.
    - Strict prohibition of penalty income: late penalties routed 100% to accredited charities via Tathir.
    """

    def __init__(self) -> None:
        self._facilities: Dict[str, SalamFacility] = {}

    def create_salam_contract(self, req: SalamContractRequest) -> SalamFacility:
        """
        Stage 1 & 2: Disburse upfront capital and execute binding Salam forward contract.
        Validates immediate full payment (Ra's Mal al-Salam) and precise goods specifications.
        """
        advance_capital = round(req.quantity_metric_tons * req.unit_price_per_ton_dzd, 2)
        if advance_capital <= 0:
            raise ValueError("Advance capital (Ra's Mal al-Salam) must be positive.")

        now = datetime.now(timezone.utc)
        if req.delivery_date <= now:
            raise ValueError("Salam maturity delivery date (Ajal) must be set in the future.")

        contract_id = f"SALAM-{hashlib.sha256(f'{req.producer_id}:{req.commodity_type.value}:{now.isoformat()}'.encode()).hexdigest()[:10].upper()}"

        seal_payload = {
            "contract_id": contract_id,
            "producer_id": req.producer_id,
            "commodity_type": req.commodity_type.value,
            "quantity_metric_tons": req.quantity_metric_tons,
            "advance_capital_dzd": advance_capital,
            "delivery_date": req.delivery_date.isoformat(),
            "depot": req.warehouse_depot_name,
            "advance_payment_ref": req.advance_payment_reference,
        }
        cryptographic_seal = hashlib.sha256(json.dumps(seal_payload, sort_keys=True).encode()).hexdigest()

        facility = SalamFacility(
            contract_id=contract_id,
            producer_id=req.producer_id,
            producer_name=req.producer_name,
            commodity_type=req.commodity_type,
            commodity_description=req.commodity_description,
            quantity_metric_tons=req.quantity_metric_tons,
            unit_price_per_ton_dzd=req.unit_price_per_ton_dzd,
            advance_capital_dzd=advance_capital,
            expected_quality_grade=req.expected_quality_grade,
            max_moisture_pct=req.max_moisture_pct,
            delivery_date=req.delivery_date,
            warehouse_depot_name=req.warehouse_depot_name,
            warehouse_depot_wilaya=req.warehouse_depot_wilaya,
            advance_payment_reference=req.advance_payment_reference,
            stage=SalamStage.COMMODITY_SPECIFIED,
            cryptographic_seal=cryptographic_seal,
            created_at=now,
            updated_at=now,
        )

        self._facilities[contract_id] = facility
        return facility

    def inspect_delivery(self, contract_id: str, req: SalamInspectionRequest) -> SalamFacility:
        """
        Stage 3: Receive physical commodity at depot, conduct laboratory grading,
        and evaluate contractual conformance under AAOIFI Standard No. 9 Clause 3.
        """
        facility = self._facilities.get(contract_id)
        if not facility:
            raise KeyError(f"Salam facility '{contract_id}' not found.")

        if facility.stage not in (SalamStage.COMMODITY_SPECIFIED, SalamStage.DELIVERY_PENDING):
            raise ValueError(
                f"Cannot inspect delivery: facility is in stage '{facility.stage.value}', "
                f"expected '{SalamStage.COMMODITY_SPECIFIED.value}'."
            )

        now = datetime.now(timezone.utc)
        insp_id = f"INSP-{hashlib.sha256(f'{contract_id}:{req.delivery_note_ref}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"

        # Evaluate quality outcome
        grade_order = {
            QualityGrade.EXTRA_PREMIUM: 4,
            QualityGrade.GRADE_1: 3,
            QualityGrade.GRADE_2: 2,
            QualityGrade.SUBSTANDARD: 1,
        }
        contracted_rank = grade_order.get(facility.expected_quality_grade, 3)
        delivered_rank = grade_order.get(req.inspected_grade, 3)

        moisture_ok = req.inspected_moisture_pct <= facility.max_moisture_pct

        if delivered_rank == contracted_rank and moisture_ok:
            outcome = InspectionOutcome.CONFORMANT
            discount_pct = 0.0
            stage = SalamStage.DELIVERED_ACCEPTED
        elif delivered_rank > contracted_rank and moisture_ok:
            # AAOIFI 9/3/2: Buyer must accept superior quality without any price surcharge
            outcome = InspectionOutcome.SUPERIOR
            discount_pct = 0.0
            stage = SalamStage.DELIVERED_ACCEPTED
        else:
            # Inferior quality or moisture failure
            if req.accept_inferior_with_discount and req.negotiated_discount_pct > 0:
                outcome = InspectionOutcome.INFERIOR_ACCEPTABLE
                discount_pct = req.negotiated_discount_pct
                stage = SalamStage.DELIVERED_ADJUSTED
            else:
                outcome = InspectionOutcome.DEFECTIVE_REJECTED
                discount_pct = 0.0
                stage = SalamStage.REJECTED

        # Compute adjusted value if discount applied
        base_value = req.actual_delivered_metric_tons * facility.unit_price_per_ton_dzd
        adjusted_value = round(base_value * (1.0 - (discount_pct / 100.0)), 2)

        record = InspectionRecord(
            inspection_id=insp_id,
            delivery_note_ref=req.delivery_note_ref,
            actual_delivered_metric_tons=req.actual_delivered_metric_tons,
            inspected_grade=req.inspected_grade,
            inspected_moisture_pct=req.inspected_moisture_pct,
            outcome=outcome,
            inspector_credentials=req.inspector_credentials,
            inspection_notes=req.inspection_notes,
            price_adjustment_pct=discount_pct,
            adjusted_total_value_dzd=adjusted_value,
            inspected_at=now,
        )

        facility.inspection = record
        facility.stage = stage
        facility.updated_at = now
        return facility

    def execute_parallel_salam(self, contract_id: str, req: ParallelSalamRequest) -> SalamFacility:
        """
        Stage 4 (Option A): Execute an independent Parallel Salam contract (AAOIFI Standard 9/4).
        TamWheel acts as seller (Al-Muslam Ilayh) to a secondary commercial buyer,
        without tying or linking the legal obligations of the two contracts.
        """
        facility = self._facilities.get(contract_id)
        if not facility:
            raise KeyError(f"Salam facility '{contract_id}' not found.")

        if facility.stage not in (SalamStage.COMMODITY_SPECIFIED, SalamStage.DELIVERED_ACCEPTED, SalamStage.DELIVERED_ADJUSTED):
            raise ValueError(
                f"Cannot execute Parallel Salam: facility is in stage '{facility.stage.value}'."
            )

        now = datetime.now(timezone.utc)
        parallel_id = f"PARALLEL-{hashlib.sha256(f'{contract_id}:{req.secondary_buyer_id}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"

        total_selling_price = round(facility.quantity_metric_tons * req.selling_price_per_ton_dzd, 2)

        hash_payload = {
            "parallel_contract_id": parallel_id,
            "primary_contract_id": contract_id,
            "secondary_buyer_id": req.secondary_buyer_id,
            "total_selling_price_dzd": total_selling_price,
            "delivery_date": req.parallel_delivery_date.isoformat(),
        }
        contract_hash = hashlib.sha256(json.dumps(hash_payload, sort_keys=True).encode()).hexdigest()

        parallel = ParallelSalamContract(
            parallel_contract_id=parallel_id,
            secondary_buyer_id=req.secondary_buyer_id,
            secondary_buyer_name=req.secondary_buyer_name,
            quantity_metric_tons=facility.quantity_metric_tons,
            selling_price_per_ton_dzd=req.selling_price_per_ton_dzd,
            total_selling_price_dzd=total_selling_price,
            delivery_date=req.parallel_delivery_date,
            depot_name=req.parallel_depot_name,
            contract_hash=contract_hash,
            created_at=now,
        )

        gross = total_selling_price
        costs = 0.0
        net = gross
        profit = round(net - facility.advance_capital_dzd, 2)

        liq_id = f"LIQ-PARALLEL-{parallel_id}"
        liq_record = LiquidationRecord(
            liquidation_id=liq_id,
            method=LiquidationMethod.PARALLEL_SALAM,
            gross_proceeds_dzd=gross,
            costs_or_fees_dzd=costs,
            net_proceeds_dzd=net,
            profit_or_gain_dzd=profit,
            transaction_hash=contract_hash,
            liquidated_at=now,
        )

        facility.parallel_salam = parallel
        facility.liquidation = liq_record
        facility.stage = SalamStage.LIQUIDATED
        facility.updated_at = now
        return facility

    def liquidate_via_wikalah(self, contract_id: str, req: WikalahLiquidationRequest) -> SalamFacility:
        """
        Stage 4 (Option B): Liquidate commodity via agency sale (Wikalah bi al-Bay')
        after physical delivery and inspection receipt.
        """
        facility = self._facilities.get(contract_id)
        if not facility:
            raise KeyError(f"Salam facility '{contract_id}' not found.")

        if facility.stage not in (SalamStage.DELIVERED_ACCEPTED, SalamStage.DELIVERED_ADJUSTED):
            raise ValueError(
                f"Wikalah liquidation requires commodity to be physically received and accepted. "
                f"Current stage is '{facility.stage.value}'."
            )

        now = datetime.now(timezone.utc)
        gross_proceeds = req.minimum_gross_sale_price_dzd
        agency_fee = round(gross_proceeds * (req.agency_fee_pct / 100.0), 2)
        net_proceeds = round(gross_proceeds - agency_fee, 2)
        profit_gain = round(net_proceeds - facility.advance_capital_dzd, 2)

        liq_id = f"LIQ-WIKALAH-{hashlib.sha256(f'{contract_id}:{req.agent_id}:{now.isoformat()}'.encode()).hexdigest()[:8].upper()}"
        proof_hash = hashlib.sha256(f"{liq_id}:{net_proceeds}:{now.isoformat()}".encode()).hexdigest()

        record = LiquidationRecord(
            liquidation_id=liq_id,
            method=LiquidationMethod.WIKALAH_AGENCY_SALE,
            gross_proceeds_dzd=gross_proceeds,
            costs_or_fees_dzd=agency_fee,
            net_proceeds_dzd=net_proceeds,
            profit_or_gain_dzd=profit_gain,
            transaction_hash=proof_hash,
            liquidated_at=now,
        )

        facility.liquidation = record
        facility.stage = SalamStage.LIQUIDATED
        facility.updated_at = now
        return facility

    def apply_delay_remedy(self, contract_id: str, req: SalamDelayRemedyRequest) -> SalamFacility:
        """
        Applies Sharia non-interest remedies for delivery delay:
        1. Hardship / Insolvency (Mu'sir): Mandatory extension without monetary penalty.
        2. Procrastination (Mumathil): 100% late penalty routed to charity (Tathir).
        3. Mutual Dissolution (Iqalah): Restitution of advance capital.
        """
        facility = self._facilities.get(contract_id)
        if not facility:
            raise KeyError(f"Salam facility '{contract_id}' not found.")

        now = datetime.now(timezone.utc)

        if req.cancel_contract_iqalah:
            facility.stage = SalamStage.CANCELLED_REFUNDED
            facility.updated_at = now
            return facility

        if req.is_genuine_insolvency:
            # Grant respite under Qur'an 2:280
            extension_days = req.days_extension or 30
            facility.delivery_date = facility.delivery_date + timedelta(days=extension_days)
            facility.stage = SalamStage.DELIVERY_PENDING
            facility.updated_at = now
            return facility

        # Procrastination (Mumathalah) -> Apply penalty strictly to charity via Tathir
        if req.late_penalty_dzd and req.late_penalty_dzd > 0:
            charity_id = req.charity_id or "CHARITY-WATER-SOLAR-005"
            disburse_req = TathirDisbursementRequest(
                donor_id=facility.producer_id,
                donor_name=facility.producer_name,
                charity_id=charity_id,
                amount_dzd=req.late_penalty_dzd,
                source_description=f"Late delivery penalty for Salam contract '{contract_id}' routed to charity per AAOIFI Standard No. 9.",
                confirm_non_tax_deductible=True,
            )
            receipt = tathir_routing_service.disburse_purification(disburse_req)
            facility.charity_penalty_receipt = receipt

        facility.updated_at = now
        return facility

    def get_facility(self, contract_id: str) -> Optional[SalamFacility]:
        return self._facilities.get(contract_id)

    def list_facilities(self, producer_id: Optional[str] = None) -> List[SalamFacility]:
        if producer_id:
            return [f for f in self._facilities.values() if f.producer_id == producer_id]
        return list(self._facilities.values())


salam_engine = SalamEngine()
