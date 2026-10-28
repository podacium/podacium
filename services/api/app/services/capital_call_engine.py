"""
TamWheel Sovereign Ethical Agentic Venture OS — Institutional LP/GP Capital Call & Drawdown Engine.
Implements:
1. ILPA-Standard Institutional Venture Capital LP/GP Syndication Protocols.
2. Complete Capital Commitment Lifecycle: Soft Commitment -> Binding Subscription -> Called -> Funded.
3. Tranche-Based Pro-Rata Drawdown Notices:
   - Pro-rata allocations across all LPs based on committed capital.
   - 20-digit Algerian RIB (Relevé d'Identité Bancaire) for domestic settlement.
   - SWIFT/BIC & IBAN routing for international diaspora investors.
   - 10-business-day due date window with automated reminder sequences.
4. Delinquent LP Default Protocol (Sharia-Compliant):
   - Late payment penalty strictly routed to Charity/Waqf Innovation Pool (AAOIFI Standard No. 3, avoiding Riba/interest retention by GP).
   - Instant suspension of voting and information rights.
   - Mandatory haircut secondary transfer or non-defaulting LP step-in cure rights.
"""

from __future__ import annotations

import enum
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class CommitmentStatus(str, enum.Enum):
    SOFT_COMMITMENT = "SOFT_COMMITMENT"
    BINDING_SUBSCRIPTION = "BINDING_SUBSCRIPTION"
    PARTIALLY_CALLED = "PARTIALLY_CALLED"
    FULLY_CALLED = "FULLY_CALLED"
    DEFAULTED = "DEFAULTED"
    CANCELLED = "CANCELLED"


class CallNoticeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    FULLY_PAID = "FULLY_PAID"
    OVERDUE = "OVERDUE"
    DELINQUENT = "DELINQUENT"
    RESOLVED = "RESOLVED"


class LPPaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    LATE = "LATE"
    DEFAULTED = "DEFAULTED"
    CURED = "CURED"


class DefaultRemedyType(str, enum.Enum):
    NON_DEFAULTING_LP_CURE = "NON_DEFAULTING_LP_CURE"
    HAIRCUT_SECONDARY_TRANSFER = "HAIRCUT_SECONDARY_TRANSFER"
    FORFEITURE_AND_CANCELLATION = "FORFEITURE_AND_CANCELLATION"


# =============================================================================
# DATA SCHEMAS
# =============================================================================

class BankDetails(BaseModel):
    bank_name: str = "Banque Nationale d'Algérie (BNA) - Agence Alger Centre 00100"
    rib_20_digit: str = "00100012312345678904"  # 20-digit Algerian RIB format
    swift_bic: str = "BNPADZALXXX"
    iban: str = "DZ5000100012312345678904"
    beneficiary_name: str = "SPAS TamWheel Ventures Fund I Holding"
    account_currency: str = "DZD"
    settlement_reference_prefix: str = "CALL-TR"


class LPCommitment(BaseModel):
    commitment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    spv_id: str
    lp_id: str
    lp_name: str
    lp_email: str
    is_diaspora: bool = False
    residence_country: str = "DZ"
    committed_amount_dzd: float = Field(..., gt=0)
    called_amount_dzd: float = Field(default=0.0, ge=0)
    paid_amount_dzd: float = Field(default=0.0, ge=0)
    units_held: int = Field(default=0, ge=0)
    voting_rights_active: bool = True
    status: CommitmentStatus = CommitmentStatus.BINDING_SUBSCRIPTION
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @property
    def uncalled_dry_powder_dzd(self) -> float:
        return max(0.0, self.committed_amount_dzd - self.called_amount_dzd)

    @computed_field
    @property
    def outstanding_called_due_dzd(self) -> float:
        return max(0.0, self.called_amount_dzd - self.paid_amount_dzd)


class LPCapitalCallItem(BaseModel):
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lp_id: str
    lp_name: str
    lp_email: str
    is_diaspora: bool = False
    committed_amount_dzd: float
    pro_rata_share_pct: float
    call_amount_dzd: float
    paid_amount_dzd: float = 0.0
    payment_status: LPPaymentStatus = LPPaymentStatus.PENDING
    payment_reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    days_overdue: int = 0
    default_penalty_dzd: float = 0.0
    penalty_charity_destination: str = "TamWheel Waqf Innovation Endowment (حساب وقف الابتكار الجزائري)"

    @computed_field
    @property
    def balance_remaining_dzd(self) -> float:
        return max(0.0, self.call_amount_dzd - self.paid_amount_dzd)


class ReminderScheduleItem(BaseModel):
    day_number: int
    reminder_title: str
    scheduled_date: datetime
    is_sent: bool = False
    recipient_count: int = 0


class CapitalCallNotice(BaseModel):
    notice_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    spv_id: str
    spv_name: str
    tranche_number: int = Field(default=1, ge=1)
    tranche_title: str
    purpose_description: str
    total_call_amount_dzd: float = Field(..., gt=0)
    total_called_so_far_dzd: float = 0.0
    issue_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: datetime
    grace_period_days: int = Field(default=5, ge=1)
    bank_details_domestic: BankDetails = Field(default_factory=BankDetails)
    bank_details_international: BankDetails = Field(default_factory=BankDetails)
    reminder_schedule: List[ReminderScheduleItem] = Field(default_factory=list)
    status: CallNoticeStatus = CallNoticeStatus.ISSUED
    lp_items: List[LPCapitalCallItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @property
    def total_collected_dzd(self) -> float:
        return sum(item.paid_amount_dzd for item in self.lp_items)

    @computed_field
    @property
    def collection_rate_pct(self) -> float:
        if self.total_call_amount_dzd <= 0:
            return 0.0
        return round((self.total_collected_dzd / self.total_call_amount_dzd) * 100.0, 2)


class DelinquentResolution(BaseModel):
    resolution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    notice_id: str
    delinquent_lp_id: str
    delinquent_lp_name: str
    shortfall_amount_dzd: float
    penalty_amount_dzd: float
    remedy_type: DefaultRemedyType
    haircut_percentage: float = 30.0  # e.g. 30% discount on unit value for secondary transfer
    cured_by_lps: Dict[str, float] = Field(default_factory=dict)
    units_transferred: int = 0
    resolved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    audit_notes: str


# =============================================================================
# CAPITAL CALL ENGINE
# =============================================================================

class CapitalCallEngine:
    """
    Manages institutional LP capital commitments, tranche-based capital call drawdowns,
    automated pro-rata allocations, domestic Algerian RIB & international SWIFT wire instructions,
    reminder schedules, and Sharia-compliant delinquent LP remedies.
    """

    def __init__(self):
        # In-memory stores (keyed by ID)
        self._commitments: Dict[str, List[LPCommitment]] = {}  # spv_id -> List[LPCommitment]
        self._notices: Dict[str, CapitalCallNotice] = {}         # notice_id -> CapitalCallNotice
        self._resolutions: Dict[str, DelinquentResolution] = {} # resolution_id -> DelinquentResolution

    # -------------------------------------------------------------------------
    # COMMITMENT MANAGEMENT
    # -------------------------------------------------------------------------

    def register_lp_commitment(
        self,
        spv_id: str,
        lp_id: str,
        lp_name: str,
        lp_email: str,
        committed_amount_dzd: float,
        is_diaspora: bool = False,
        residence_country: str = "DZ",
        units_allocated: int = 0,
        status: CommitmentStatus = CommitmentStatus.BINDING_SUBSCRIPTION,
    ) -> LPCommitment:
        """
        Registers an LP's binding subscription commitment to an SPV fund.
        """
        if committed_amount_dzd <= 0:
            raise ValueError("Committed capital must be strictly positive.")

        if spv_id not in self._commitments:
            self._commitments[spv_id] = []

        # Check existing
        existing = next((c for c in self._commitments[spv_id] if c.lp_id == lp_id), None)
        if existing:
            existing.committed_amount_dzd += committed_amount_dzd
            existing.units_held += units_allocated
            return existing

        commitment = LPCommitment(
            spv_id=spv_id,
            lp_id=lp_id,
            lp_name=lp_name,
            lp_email=lp_email,
            is_diaspora=is_diaspora,
            residence_country=residence_country,
            committed_amount_dzd=committed_amount_dzd,
            units_held=units_allocated,
            status=status,
        )
        self._commitments[spv_id].append(commitment)
        logger.info(f"Registered commitment of {committed_amount_dzd:,.0f} DZD for LP {lp_name} in SPV {spv_id}")
        return commitment

    def get_commitments(self, spv_id: str) -> List[LPCommitment]:
        return self._commitments.get(spv_id, [])

    def get_spv_commitment_summary(self, spv_id: str) -> Dict[str, Any]:
        commitments = self.get_commitments(spv_id)
        total_committed = sum(c.committed_amount_dzd for c in commitments)
        total_called = sum(c.called_amount_dzd for c in commitments)
        total_paid = sum(c.paid_amount_dzd for c in commitments)
        uncalled_dry_powder = total_committed - total_called

        return {
            "spv_id": spv_id,
            "total_lps_count": len(commitments),
            "total_committed_dzd": round(total_committed, 2),
            "total_called_dzd": round(total_called, 2),
            "total_paid_dzd": round(total_paid, 2),
            "uncalled_dry_powder_dzd": round(uncalled_dry_powder, 2),
            "overall_called_pct": round((total_called / total_committed) * 100.0, 2) if total_committed > 0 else 0.0,
        }

    # -------------------------------------------------------------------------
    # CAPITAL CALL NOTICE GENERATION
    # -------------------------------------------------------------------------

    def create_capital_call_notice(
        self,
        spv_id: str,
        spv_name: str,
        total_call_amount_dzd: float,
        tranche_title: str,
        purpose_description: str,
        tranche_number: int = 1,
        due_date_business_days: int = 10,
        grace_period_days: int = 5,
        domestic_rib: Optional[str] = None,
        swift_bic: Optional[str] = None,
        iban: Optional[str] = None,
    ) -> CapitalCallNotice:
        """
        Generates a tranche-based capital call notice calculating pro-rata quotas
        for all active LPs based on ILPA best practices and Algerian banking standards.
        """
        commitments = self.get_commitments(spv_id)
        if not commitments:
            raise ValueError(f"No LP commitments found for SPV '{spv_id}'. Cannot issue capital call.")

        total_committed = sum(c.committed_amount_dzd for c in commitments)
        if total_committed <= 0:
            raise ValueError("Total fund commitment is zero.")

        total_uncalled = sum(c.uncalled_dry_powder_dzd for c in commitments)
        if total_call_amount_dzd > total_uncalled:
            raise ValueError(
                f"Capital call amount ({total_call_amount_dzd:,.0f} DZD) exceeds total remaining "
                f"uncalled dry powder ({total_uncalled:,.0f} DZD)."
            )

        now = datetime.now(timezone.utc)
        # Approximate 10 business days as ~14 calendar days
        calendar_days = int(math.ceil(due_date_business_days * (7.0 / 5.0)))
        due_date = now + timedelta(days=calendar_days)

        # Setup Bank Details
        bank_dom = BankDetails()
        if domestic_rib:
            bank_dom.rib_20_digit = domestic_rib

        bank_intl = BankDetails()
        if swift_bic:
            bank_intl.swift_bic = swift_bic
        if iban:
            bank_intl.iban = iban

        # Reminder Sequence: Day 3, Day 7, Day 10 (Due Date)
        reminders = [
            ReminderScheduleItem(
                day_number=3,
                reminder_title="First Gentle Follow-Up Notice (تذكير أول باستدعاء رأس المال)",
                scheduled_date=now + timedelta(days=3),
                recipient_count=len(commitments),
            ),
            ReminderScheduleItem(
                day_number=7,
                reminder_title="Urgent Execution Reminder (تذكير عاجل قبل انقضاء الأجل)",
                scheduled_date=now + timedelta(days=7),
                recipient_count=len(commitments),
            ),
            ReminderScheduleItem(
                day_number=calendar_days,
                reminder_title="Final Due Date Payment Alert (تنبيه يوم الاستحقاق النهائي)",
                scheduled_date=due_date,
                recipient_count=len(commitments),
            ),
        ]

        # Calculate pro-rata per LP
        lp_items: List[LPCapitalCallItem] = []
        for c in commitments:
            quota_pct = (c.committed_amount_dzd / total_committed) * 100.0
            lp_call_amount = round(total_call_amount_dzd * (c.committed_amount_dzd / total_committed), 2)

            item = LPCapitalCallItem(
                lp_id=c.lp_id,
                lp_name=c.lp_name,
                lp_email=c.lp_email,
                is_diaspora=c.is_diaspora,
                committed_amount_dzd=c.committed_amount_dzd,
                pro_rata_share_pct=round(quota_pct, 4),
                call_amount_dzd=lp_call_amount,
                payment_status=LPPaymentStatus.PENDING,
            )
            lp_items.append(item)

            # Update LP commitment called balance
            c.called_amount_dzd += lp_call_amount
            if c.called_amount_dzd >= c.committed_amount_dzd:
                c.status = CommitmentStatus.FULLY_CALLED
            else:
                c.status = CommitmentStatus.PARTIALLY_CALLED

        notice = CapitalCallNotice(
            spv_id=spv_id,
            spv_name=spv_name,
            tranche_number=tranche_number,
            tranche_title=tranche_title,
            purpose_description=purpose_description,
            total_call_amount_dzd=round(total_call_amount_dzd, 2),
            issue_date=now,
            due_date=due_date,
            grace_period_days=grace_period_days,
            bank_details_domestic=bank_dom,
            bank_details_international=bank_intl,
            reminder_schedule=reminders,
            lp_items=lp_items,
            status=CallNoticeStatus.ISSUED,
        )

        self._notices[notice.notice_id] = notice
        logger.info(
            f"Issued Capital Call Notice {notice.notice_id} for SPV '{spv_name}': "
            f"{total_call_amount_dzd:,.0f} DZD across {len(lp_items)} LPs."
        )
        return notice

    def get_notice(self, notice_id: str) -> Optional[CapitalCallNotice]:
        return self._notices.get(notice_id)

    def record_lp_payment(
        self,
        notice_id: str,
        lp_id: str,
        amount_paid_dzd: float,
        payment_reference: str,
        paid_at: Optional[datetime] = None,
    ) -> CapitalCallNotice:
        """
        Records a wire settlement from an LP against a capital call notice.
        """
        notice = self.get_notice(notice_id)
        if not notice:
            raise ValueError(f"Capital call notice '{notice_id}' not found.")

        item = next((i for i in notice.lp_items if i.lp_id == lp_id), None)
        if not item:
            raise ValueError(f"LP '{lp_id}' is not part of notice '{notice_id}'.")

        item.paid_amount_dzd += amount_paid_dzd
        item.payment_reference = payment_reference
        item.paid_at = paid_at or datetime.now(timezone.utc)

        if item.paid_amount_dzd >= item.call_amount_dzd:
            item.payment_status = LPPaymentStatus.PAID
        else:
            item.payment_status = LPPaymentStatus.PENDING

        # Update LP commitment record
        commitments = self.get_commitments(notice.spv_id)
        c = next((c for c in commitments if c.lp_id == lp_id), None)
        if c:
            c.paid_amount_dzd += amount_paid_dzd

        # Update overall notice status
        all_paid = all(i.payment_status == LPPaymentStatus.PAID for i in notice.lp_items)
        any_paid = any(i.paid_amount_dzd > 0 for i in notice.lp_items)

        if all_paid:
            notice.status = CallNoticeStatus.FULLY_PAID
        elif any_paid:
            notice.status = CallNoticeStatus.PARTIALLY_PAID

        return notice

    # -------------------------------------------------------------------------
    # DELINQUENT LP DEFAULT PROTOCOL (SHARIA-COMPLIANT)
    # -------------------------------------------------------------------------

    def evaluate_and_flag_delinquencies(
        self,
        notice_id: str,
        current_time: Optional[datetime] = None,
        annualized_penalty_rate_pct: float = 8.0,
    ) -> List[LPCapitalCallItem]:
        """
        Audits a capital call notice past its due date + grace period.
        If an LP has not remitted funds, flags them as DELINQUENT, suspends voting rights,
        and calculates late default penalties routed to the Charity/Waqf Innovation Pool.
        """
        notice = self.get_notice(notice_id)
        if not notice:
            raise ValueError(f"Notice '{notice_id}' not found.")

        now = current_time or datetime.now(timezone.utc)
        grace_cutoff = notice.due_date + timedelta(days=notice.grace_period_days)

        delinquents: List[LPCapitalCallItem] = []
        commitments = self.get_commitments(notice.spv_id)

        for item in notice.lp_items:
            if item.paid_amount_dzd < item.call_amount_dzd and now > grace_cutoff:
                item.payment_status = LPPaymentStatus.DEFAULTED
                days_overdue = (now - notice.due_date).days
                item.days_overdue = max(0, days_overdue)

                # Sharia-compliant penalty calculation: routed to charity, NOT GP revenue
                shortfall = item.call_amount_dzd - item.paid_amount_dzd
                daily_penalty_rate = (annualized_penalty_rate_pct / 100.0) / 365.0
                item.default_penalty_dzd = round(shortfall * daily_penalty_rate * item.days_overdue, 2)

                # Suspend LP voting rights in SPV
                c = next((c for c in commitments if c.lp_id == item.lp_id), None)
                if c:
                    c.voting_rights_active = False
                    c.status = CommitmentStatus.DEFAULTED

                delinquents.append(item)

        if delinquents:
            notice.status = CallNoticeStatus.DELINQUENT
            logger.warning(
                f"Flagged {len(delinquents)} delinquent LPs in Notice {notice_id}. "
                "Voting rights suspended and penalties allocated to Waqf Endowment."
            )

        return delinquents

    def resolve_delinquent_lp_secondary_haircut(
        self,
        notice_id: str,
        delinquent_lp_id: str,
        curing_lp_contributions: Dict[str, float],
        haircut_discount_pct: float = 30.0,
    ) -> DelinquentResolution:
        """
        Executes institutional remedy: Non-defaulting LPs step in to fund the delinquent shortfall
        pro-rata, receiving the delinquent LP's corresponding SPV units at a mandatory haircut discount.
        """
        notice = self.get_notice(notice_id)
        if not notice:
            raise ValueError(f"Notice '{notice_id}' not found.")

        item = next((i for i in notice.lp_items if i.lp_id == delinquent_lp_id), None)
        if not item:
            raise ValueError(f"LP '{delinquent_lp_id}' not found in notice.")

        if item.payment_status != LPPaymentStatus.DEFAULTED:
            raise ValueError(f"LP '{delinquent_lp_id}' is not in DEFAULTED status.")

        shortfall = item.call_amount_dzd - item.paid_amount_dzd
        total_cured = sum(curing_lp_contributions.values())

        if total_cured < shortfall:
            raise ValueError(
                f"Total curing contributions ({total_cured:,.0f} DZD) do not cover the shortfall ({shortfall:,.0f} DZD)."
            )

        commitments = self.get_commitments(notice.spv_id)
        delinquent_comm = next((c for c in commitments if c.lp_id == delinquent_lp_id), None)

        # Calculate unit reallocation with haircut discount
        # At 30% haircut, units are transferred at 70% of book cost
        units_to_transfer = 0
        if delinquent_comm and delinquent_comm.units_held > 0:
            haircut_ratio = (1.0 - (haircut_discount_pct / 100.0))
            units_to_transfer = int(math.floor(delinquent_comm.units_held * haircut_ratio))
            delinquent_comm.units_held -= units_to_transfer

            # Distribute units to curing LPs pro-rata
            for cure_lp_id, amt in curing_lp_contributions.items():
                ratio = amt / total_cured
                cure_comm = next((c for c in commitments if c.lp_id == cure_lp_id), None)
                if cure_comm:
                    cure_comm.units_held += int(round(units_to_transfer * ratio))
                    cure_comm.paid_amount_dzd += amt

        # Update notice item status
        item.paid_amount_dzd += shortfall
        item.payment_status = LPPaymentStatus.CURED

        resolution = DelinquentResolution(
            notice_id=notice_id,
            delinquent_lp_id=delinquent_lp_id,
            delinquent_lp_name=item.lp_name,
            shortfall_amount_dzd=shortfall,
            penalty_amount_dzd=item.default_penalty_dzd,
            remedy_type=DefaultRemedyType.HAIRCUT_SECONDARY_TRANSFER,
            haircut_percentage=haircut_discount_pct,
            curing_lps=curing_lp_contributions,
            units_transferred=units_to_transfer,
            audit_notes=(
                f"Delinquent LP {item.lp_name} cured via secondary haircut transfer. "
                f"{units_to_transfer} units reallocated at a {haircut_discount_pct}% discount. "
                f"Penalty of {item.default_penalty_dzd:,.2f} DZD irrevocably credited to Waqf pool."
            ),
        )

        self._resolutions[resolution.resolution_id] = resolution
        logger.info(f"Delinquent LP {item.lp_name} successfully resolved via secondary cure.")
        return resolution


capital_call_engine = CapitalCallEngine()
