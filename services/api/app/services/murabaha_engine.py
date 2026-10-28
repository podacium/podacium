"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI Standard No. 8 Murabaha Engine.
Implements:
1. AAOIFI Shariah Standard No. 8 (Murabaha to the Purchase Orderer / المرابحة للآمر بالشراء).
2. Four-stage lifecycle progression:
   - STAGE 1: PROMISE (Wa'd bi al-Shira') - Unilateral binding purchase promise.
   - STAGE 2: GOODS_ACQUIRED (Qabd & Daman) - Physical/constructive possession & risk-bearing.
   - STAGE 3: SALE_EXECUTED (Bay' al-Murabaha) - Explicit cost + markup disclosure & contract seal.
   - STAGE 4: REPAYING & COMPLETED - Equal installment amortization schedule tracking.
3. Sharia Late Payment Penalty Rule:
   - Under AAOIFI Standard No. 8 Clause 5/6, late fees CANNOT be booked as income or profit (prohibited Riba).
   - Late penalty commitment (Iltizam bi al-Tasadduq) is routed 100% directly to accredited charities via Tathir routing.
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

class MurabahaStage(str, enum.Enum):
    PROMISE = "PROMISE"
    GOODS_ACQUIRED = "GOODS_ACQUIRED"
    SALE_EXECUTED = "SALE_EXECUTED"
    REPAYING = "REPAYING"
    COMPLETED = "COMPLETED"
    DEFAULTED = "DEFAULTED"


class MurabahaAssetCategory(str, enum.Enum):
    IT_HARDWARE_SERVERS = "IT_HARDWARE_SERVERS"
    INDUSTRIAL_EQUIPMENT = "INDUSTRIAL_EQUIPMENT"
    RAW_MATERIALS_INVENTORY = "RAW_MATERIALS_INVENTORY"
    SOLAR_ENERGY_SYSTEMS = "SOLAR_ENERGY_SYSTEMS"
    COMMERCIAL_VEHICLES = "COMMERCIAL_VEHICLES"
    AGRITECH_MACHINERY = "AGRITECH_MACHINERY"


class PossessionType(str, enum.Enum):
    PHYSICAL = "PHYSICAL"          # Physical warehousing / inspection
    CONSTRUCTIVE = "CONSTRUCTIVE"  # Qabd Hukmi via title deed / bill of lading / electronic warehouse receipt


class AmortizationFrequency(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"


class InstallmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"


# =============================================================================
# MODELS
# =============================================================================

class InstallmentTranche(BaseModel):
    installment_index: int = Field(..., ge=1, description="Installment number (1 to N)")
    due_date: datetime = Field(..., description="Maturity due date of tranche")
    installment_amount_dzd: float = Field(..., gt=0, description="Total equal installment amount in DZD")
    principal_component_dzd: float = Field(..., ge=0, description="Cost recovery principal component")
    profit_component_dzd: float = Field(..., ge=0, description="Agreed Murabaha markup profit component")
    status: InstallmentStatus = Field(default=InstallmentStatus.PENDING)
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    late_fee_dzd: float = Field(default=0.0, ge=0)
    charity_receipt_id: Optional[str] = None


class MurabahaPurchaseOrderRequest(BaseModel):
    startup_id: str = Field(..., description="Unique client/startup ID")
    startup_name: str = Field(..., description="Client/startup legal or commercial name")
    supplier_id: str = Field(..., description="Third-party vendor/supplier ID")
    supplier_name: str = Field(..., description="Supplier company name")
    goods_description: str = Field(..., min_length=5, description="Specifications of goods/equipment/inventory")
    category: MurabahaAssetCategory = Field(..., description="Asset classification")
    cost_price_dzd: float = Field(..., gt=0, description="Estimated acquisition cost in DZD")
    markup_rate_pct: float = Field(..., gt=0, le=100.0, description="Agreed profit markup rate percentage (e.g. 8.5%)")
    tenor_months: int = Field(..., ge=1, le=60, description="Financing duration in months")
    amortization_frequency: AmortizationFrequency = Field(
        default=AmortizationFrequency.MONTHLY,
        description="Repayment cadence",
    )
    unilateral_promise_confirmed: bool = Field(
        True,
        description="Affirmation of unilateral binding promise to purchase (Wa'd bi al-Shira')",
    )


class GoodsPossessionConfirmationRequest(BaseModel):
    supplier_invoice_ref: str = Field(..., min_length=3, description="Supplier invoice reference number")
    actual_cost_dzd: float = Field(..., gt=0, description="Actual purchase cost paid to supplier in DZD")
    possession_type: PossessionType = Field(default=PossessionType.CONSTRUCTIVE, description="PHYSICAL or CONSTRUCTIVE (Qabd Hukmi)")
    warehouse_or_delivery_ref: str = Field(..., min_length=3, description="Warehouse receipt or electronic delivery proof reference")


class MurabahaSaleExecutionRequest(BaseModel):
    client_acceptance_confirmed: bool = Field(
        True,
        description="Client confirms acceptance of the acquired goods after inspection",
    )


class RecordInstallmentPaymentRequest(BaseModel):
    installment_index: int = Field(..., ge=1, description="Tranche index to pay")
    payment_amount_dzd: float = Field(..., gt=0, description="Payment amount in DZD")
    payment_reference: str = Field(..., min_length=3, description="Bank transfer or ledger transaction reference")


class ApplyLatePenaltyRequest(BaseModel):
    installment_index: int = Field(..., ge=1, description="Delinquent installment tranche")
    late_fee_amount_dzd: float = Field(..., gt=0, description="Late penalty fee to cleanse")
    charity_id: str = Field(..., description="Accredited Algerian charity to receive penalty funds")
    days_overdue: int = Field(..., ge=1, description="Number of days elapsed past due date")


class MurabahaFacility(BaseModel):
    order_id: str
    startup_id: str
    startup_name: str
    supplier_id: str
    supplier_name: str
    goods_description: str
    category: MurabahaAssetCategory
    stage: MurabahaStage
    cost_price_dzd: float
    actual_cost_dzd: Optional[float] = None
    markup_rate_pct: float
    markup_amount_dzd: Optional[float] = None
    total_sale_price_dzd: Optional[float] = None
    tenor_months: int
    amortization_frequency: AmortizationFrequency
    unilateral_promise_confirmed: bool
    supplier_invoice_ref: Optional[str] = None
    possession_type: Optional[PossessionType] = None
    warehouse_or_delivery_ref: Optional[str] = None
    possession_proof_hash: Optional[str] = None
    acquired_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    execution_contract_hash: Optional[str] = None
    installments: List[InstallmentTranche] = Field(default_factory=list)
    total_principal_paid_dzd: float = Field(default=0.0)
    total_profit_paid_dzd: float = Field(default=0.0)
    total_repaid_dzd: float = Field(default=0.0)
    total_charity_cleansed_dzd: float = Field(default=0.0)
    charity_receipts: List[TathirReceipt] = Field(default_factory=list)
    sharia_standard_citation: str = "AAOIFI Shariah Standard No. 8 (Murabaha to the Purchase Orderer)"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# ENGINE IMPLEMENTATION
# =============================================================================

class MurabahaEngine:
    """
    Automated AAOIFI Shariah Standard No. 8 Murabaha working capital facility engine.
    Ensures:
    - Clear demarcation between Promise and Sale execution.
    - True acquisition and risk-bearing (Qabd & Daman) before contract of sale.
    - Full transparency of cost price and declared profit markup.
    - Late penalties strictly routed to charity (Tathir) with verifiable receipts.
    """

    def __init__(self) -> None:
        self._facilities: Dict[str, MurabahaFacility] = {}

    def initiate_purchase_order(self, req: MurabahaPurchaseOrderRequest) -> MurabahaFacility:
        """Stage 1: Client submits unilateral binding purchase promise (Wa'd bi al-Shira')."""
        if not req.unilateral_promise_confirmed:
            raise ValueError(
                "Sharia compliance under AAOIFI Standard No. 8 requires client's confirmation "
                "of unilateral binding promise (Wa'd bi al-Shira')."
            )

        order_id = f"MUR-{hashlib.sha256(f'{req.startup_id}:{req.supplier_id}:{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:10].upper()}"

        facility = MurabahaFacility(
            order_id=order_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            supplier_id=req.supplier_id,
            supplier_name=req.supplier_name,
            goods_description=req.goods_description,
            category=req.category,
            stage=MurabahaStage.PROMISE,
            cost_price_dzd=req.cost_price_dzd,
            markup_rate_pct=req.markup_rate_pct,
            tenor_months=req.tenor_months,
            amortization_frequency=req.amortization_frequency,
            unilateral_promise_confirmed=req.unilateral_promise_confirmed,
        )

        self._facilities[order_id] = facility
        return facility

    create_purchase_order = initiate_purchase_order

    def confirm_goods_possession(
        self,
        order_id: str,
        req: GoodsPossessionConfirmationRequest,
    ) -> MurabahaFacility:
        """
        Stage 2: Financier acquires goods from third-party supplier, establishing title,
        constructive/physical possession (Qabd), and bearing risk of destruction/loss (Daman).
        """
        facility = self._facilities.get(order_id)
        if not facility:
            raise KeyError(f"Murabaha facility '{order_id}' not found.")

        if facility.stage != MurabahaStage.PROMISE:
            raise ValueError(
                f"Cannot confirm goods acquisition: facility is currently in stage '{facility.stage.value}', "
                f"expected '{MurabahaStage.PROMISE.value}'."
            )

        now = datetime.now(timezone.utc)
        proof_payload = {
            "order_id": order_id,
            "supplier_id": facility.supplier_id,
            "supplier_invoice_ref": req.supplier_invoice_ref,
            "actual_cost_dzd": req.actual_cost_dzd,
            "possession_type": req.possession_type.value,
            "warehouse_or_delivery_ref": req.warehouse_or_delivery_ref,
            "acquired_at": now.isoformat(),
        }
        proof_hash = hashlib.sha256(json.dumps(proof_payload, sort_keys=True).encode()).hexdigest()

        facility.stage = MurabahaStage.GOODS_ACQUIRED
        facility.supplier_invoice_ref = req.supplier_invoice_ref
        facility.actual_cost_dzd = req.actual_cost_dzd
        facility.possession_type = req.possession_type
        facility.warehouse_or_delivery_ref = req.warehouse_or_delivery_ref
        facility.possession_proof_hash = proof_hash
        facility.acquired_at = now
        facility.updated_at = now

        return facility

    def execute_murabaha_sale(
        self,
        order_id: str,
        req: MurabahaSaleExecutionRequest,
    ) -> MurabahaFacility:
        """
        Stage 3: Murabaha contract of sale executed with explicit cost + declared profit markup disclosure.
        Generates equal installment amortization schedule and transitions to REPAYING.
        """
        facility = self._facilities.get(order_id)
        if not facility:
            raise KeyError(f"Murabaha facility '{order_id}' not found.")

        if facility.stage != MurabahaStage.GOODS_ACQUIRED:
            raise ValueError(
                f"Cannot execute Murabaha sale: goods must first be acquired by financier (current stage: '{facility.stage.value}'). "
                "AAOIFI Standard No. 8 strictly prohibits selling what one does not possess (Bay' ma la Yamlik)."
            )

        if not req.client_acceptance_confirmed:
            raise ValueError("Client must confirm acceptance and satisfaction with the acquired goods.")

        cost = facility.actual_cost_dzd or facility.cost_price_dzd
        markup_amount = round(cost * (facility.markup_rate_pct / 100.0), 2)
        total_sale_price = round(cost + markup_amount, 2)

        facility.markup_amount_dzd = markup_amount
        facility.total_sale_price_dzd = total_sale_price

        # Calculate installment count
        if facility.amortization_frequency == AmortizationFrequency.MONTHLY:
            num_tranches = facility.tenor_months
            day_interval = 30
        else:  # QUARTERLY
            num_tranches = max(1, facility.tenor_months // 3)
            day_interval = 90

        # Equal installment amortization schedule
        # Total sale price is split into equal installments.
        raw_installment = round(total_sale_price / num_tranches, 2)
        raw_principal = round(cost / num_tranches, 2)
        raw_profit = round(markup_amount / num_tranches, 2)

        installments: List[InstallmentTranche] = []
        exec_time = datetime.now(timezone.utc)
        cumulative_installment_allocated = 0.0
        cumulative_principal_allocated = 0.0
        cumulative_profit_allocated = 0.0

        for i in range(1, num_tranches + 1):
            due = exec_time + timedelta(days=i * day_interval)
            if i == num_tranches:
                # Last tranche absorbs rounding cents to ensure exact sum
                inst_amount = round(total_sale_price - cumulative_installment_allocated, 2)
                princ_amount = round(cost - cumulative_principal_allocated, 2)
                prof_amount = round(markup_amount - cumulative_profit_allocated, 2)
            else:
                inst_amount = raw_installment
                princ_amount = raw_principal
                prof_amount = raw_profit
                cumulative_installment_allocated += inst_amount
                cumulative_principal_allocated += princ_amount
                cumulative_profit_allocated += prof_amount

            installments.append(
                InstallmentTranche(
                    installment_index=i,
                    due_date=due,
                    installment_amount_dzd=inst_amount,
                    principal_component_dzd=princ_amount,
                    profit_component_dzd=prof_amount,
                    status=InstallmentStatus.PENDING,
                )
            )

        contract_payload = {
            "order_id": order_id,
            "cost_price_dzd": cost,
            "markup_rate_pct": facility.markup_rate_pct,
            "markup_amount_dzd": markup_amount,
            "total_sale_price_dzd": total_sale_price,
            "num_installments": num_tranches,
            "executed_at": exec_time.isoformat(),
        }
        contract_hash = hashlib.sha256(json.dumps(contract_payload, sort_keys=True).encode()).hexdigest()

        facility.stage = MurabahaStage.REPAYING
        facility.executed_at = exec_time
        facility.execution_contract_hash = contract_hash
        facility.installments = installments
        facility.updated_at = exec_time

        return facility

    def record_installment_payment(
        self,
        order_id: str,
        req: RecordInstallmentPaymentRequest,
    ) -> MurabahaFacility:
        """
        Stage 4: Records payment of an installment tranche.
        When all tranches are paid in full, transitions facility to COMPLETED.
        """
        facility = self._facilities.get(order_id)
        if not facility:
            raise KeyError(f"Murabaha facility '{order_id}' not found.")

        if facility.stage not in (MurabahaStage.REPAYING, MurabahaStage.SALE_EXECUTED):
            raise ValueError(f"Cannot record installment for facility in stage '{facility.stage.value}'.")

        target_tranche: Optional[InstallmentTranche] = None
        for tranche in facility.installments:
            if tranche.installment_index == req.installment_index:
                target_tranche = tranche
                break

        if not target_tranche:
            raise KeyError(f"Installment tranche {req.installment_index} not found for order '{order_id}'.")

        if target_tranche.status == InstallmentStatus.PAID:
            raise ValueError(f"Installment tranche {req.installment_index} has already been paid.")

        if req.payment_amount_dzd < target_tranche.installment_amount_dzd:
            raise ValueError(
                f"Payment amount ({req.payment_amount_dzd:,.2f} DZD) is less than required installment amount "
                f"({target_tranche.installment_amount_dzd:,.2f} DZD)."
            )

        now = datetime.now(timezone.utc)
        target_tranche.status = InstallmentStatus.PAID
        target_tranche.paid_at = now
        target_tranche.payment_reference = req.payment_reference

        facility.total_principal_paid_dzd = round(
            facility.total_principal_paid_dzd + target_tranche.principal_component_dzd, 2
        )
        facility.total_profit_paid_dzd = round(
            facility.total_profit_paid_dzd + target_tranche.profit_component_dzd, 2
        )
        facility.total_repaid_dzd = round(
            facility.total_repaid_dzd + target_tranche.installment_amount_dzd, 2
        )
        facility.updated_at = now

        # Check if all installments are satisfied
        if all(t.status == InstallmentStatus.PAID for t in facility.installments):
            facility.stage = MurabahaStage.COMPLETED

        return facility

    def apply_late_fee_to_charity(
        self,
        order_id: str,
        req: ApplyLatePenaltyRequest,
    ) -> TathirReceipt:
        """
        Applies a late penalty fee to a delinquent installment and immediately routes 100% of the funds
        to an accredited charity via the Tathir routing service, issuing an immutable TathirReceipt.
        Strict AAOIFI Standard No. 8 requirement: late fees cannot be recognized as platform income.
        """
        facility = self._facilities.get(order_id)
        if not facility:
            raise KeyError(f"Murabaha facility '{order_id}' not found.")

        target_tranche: Optional[InstallmentTranche] = None
        for tranche in facility.installments:
            if tranche.installment_index == req.installment_index:
                target_tranche = tranche
                break

        if not target_tranche:
            raise KeyError(f"Installment tranche {req.installment_index} not found.")

        # Disburse to charity via Tathir service
        disburse_req = TathirDisbursementRequest(
            donor_id=facility.startup_id,
            donor_name=facility.startup_name,
            charity_id=req.charity_id,
            amount_dzd=req.late_fee_amount_dzd,
            source_description=(
                f"AAOIFI Murabaha Standard No. 8 late payment penalty commitment (Iltizam bi al-Tasadduq) "
                f"for order '{order_id}', installment #{req.installment_index} ({req.days_overdue} days overdue)."
            ),
            confirm_non_tax_deductible=True,
        )

        receipt = tathir_routing_service.disburse_purification(disburse_req)

        # Update tranche & facility
        target_tranche.late_fee_dzd = round(target_tranche.late_fee_dzd + req.late_fee_amount_dzd, 2)
        target_tranche.charity_receipt_id = receipt.receipt_id
        if target_tranche.status == InstallmentStatus.PENDING:
            target_tranche.status = InstallmentStatus.OVERDUE

        facility.total_charity_cleansed_dzd = round(
            facility.total_charity_cleansed_dzd + req.late_fee_amount_dzd, 2
        )
        facility.charity_receipts.append(receipt)
        facility.updated_at = datetime.now(timezone.utc)

        return receipt

    def get_facility(self, order_id: str) -> Optional[MurabahaFacility]:
        return self._facilities.get(order_id)

    def list_facilities(self, startup_id: Optional[str] = None) -> List[MurabahaFacility]:
        facilities = list(self._facilities.values())
        if startup_id:
            facilities = [f for f in facilities if f.startup_id == startup_id]
        return facilities


murabaha_engine = MurabahaEngine()
