"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate Co-Investment Rights & Allocation Engine.
Implements:
1. Side-Car Co-Investment Vehicles:
   - Co-investment rights granted alongside lead syndicate SPVs.
   - Institutional Fee Tiers:
     - Tier 1 Anchor LPs (Commitment >= 10M DZD): 0.0% Management Fee, 0.0% Carried Interest ("Zero-Fee, Zero-Carry").
     - Tier 2 Strategic LPs (Commitment >= 5M DZD): 1.0% Management Fee, 10.0% Carried Interest.
     - Tier 3 Standard LPs: 2.0% Management Fee, 20.0% Carried Interest.
2. Capacity & Prioritization Allocations:
   - Pro-rata entitlement based on LP commitment in the lead syndicate SPV.
   - Dynamic water-filling excess capacity re-allocation algorithm when some LPs take less than pro-rata.
   - Greenshoe oversubscription expansion up to hard cap.
3. Multi-Tier Syndicate Closing Milestones:
   - Initial Close (Target threshold met -> Startup Tranche 1 deployment unlocked).
   - Interim Close (Soft cap reached).
   - Final Close / Oversubscribed Close (Full syndicate allocation finalized).
"""

from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class CoInvestmentMilestone(str, enum.Enum):
    DRAFT = "DRAFT"
    INITIAL_CLOSE = "INITIAL_CLOSE"
    INTERIM_CLOSE = "INTERIM_CLOSE"
    FINAL_CLOSE = "FINAL_CLOSE"
    OVERSUBSCRIBED = "OVERSUBSCRIBED"
    CLOSED = "CLOSED"


class CoInvestmentFeeTier(str, enum.Enum):
    TIER_1_ANCHOR = "TIER_1_ANCHOR"          # 0% Fee / 0% Carry
    TIER_2_STRATEGIC = "TIER_2_STRATEGIC"    # 1% Fee / 10% Carry
    TIER_3_STANDARD = "TIER_3_STANDARD"      # 2% Fee / 20% Carry
    CUSTOM_EXEMPT = "CUSTOM_EXEMPT"


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ALLOCATED = "ALLOCATED"
    SCALED_BACK = "SCALED_BACK"
    REJECTED = "REJECTED"
    CONFIRMED = "CONFIRMED"


# =============================================================================
# SCHEMAS FOR MILESTONES & ALLOCATIONS
# =============================================================================

class MilestoneEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    milestone: CoInvestmentMilestone
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cumulative_allocated_dzd: float
    participating_lps_count: int
    deployment_authorized: bool = False
    notes: str = ""


class CoInvestmentRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deal_id: str
    lp_id: str
    lp_name: str
    lp_email: str
    main_spv_commitment_dzd: float = Field(..., ge=0.0)
    requested_amount_dzd: float = Field(..., gt=0.0)

    # Fee economics
    fee_tier: CoInvestmentFeeTier = CoInvestmentFeeTier.TIER_3_STANDARD
    management_fee_rate_pct: float = 2.0
    carry_rate_pct: float = 20.0

    # Allocation results
    pro_rata_entitlement_dzd: float = 0.0
    allocated_amount_dzd: float = 0.0
    scaled_back_amount_dzd: float = 0.0
    status: RequestStatus = RequestStatus.PENDING
    submission_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CoInvestmentDeal(BaseModel):
    deal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    spv_id: str
    deal_name: str
    target_startup_id: str
    target_startup_name: str
    currency: str = "DZD"

    # Capacity Limits
    total_co_investment_capacity_dzd: float = Field(..., gt=0.0)
    soft_cap_dzd: float = Field(..., gt=0.0)
    hard_cap_dzd: float = Field(..., gt=0.0)
    initial_close_target_dzd: float = Field(..., gt=0.0)
    minimum_ticket_dzd: float = Field(default=1_000_000.0, gt=0.0)
    maximum_ticket_dzd: Optional[float] = None

    # Status & Progress
    milestone_status: CoInvestmentMilestone = CoInvestmentMilestone.DRAFT
    greenshoe_activated: bool = False
    total_requested_dzd: float = 0.0
    total_allocated_dzd: float = 0.0
    milestone_history: List[MilestoneEvent] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @property
    def remaining_capacity_dzd(self) -> float:
        cap = self.hard_cap_dzd if self.greenshoe_activated else self.total_co_investment_capacity_dzd
        return max(0.0, round(cap - self.total_allocated_dzd, 2))

    @computed_field
    @property
    def subscription_coverage_ratio(self) -> float:
        return round(self.total_requested_dzd / max(1.0, self.total_co_investment_capacity_dzd), 2)


class AllocationRunResult(BaseModel):
    deal_id: str
    deal_name: str
    capacity_available_dzd: float
    total_requested_dzd: float
    total_allocated_dzd: float
    excess_reallocated_dzd: float
    is_oversubscribed: bool
    greenshoe_used: bool
    resulting_milestone: CoInvestmentMilestone
    allocations: List[CoInvestmentRequest]


# =============================================================================
# CO-INVESTMENT ENGINE
# =============================================================================

class CoInvestmentEngine:
    """
    Syndicate Side-Car Co-Investment Rights & Capacity Allocation Engine.
    """

    def __init__(self) -> None:
        self._deals: Dict[str, CoInvestmentDeal] = {}
        self._requests: Dict[str, List[CoInvestmentRequest]] = {}  # deal_id -> List[Request]

    def create_co_investment_deal(
        self,
        spv_id: str,
        deal_name: str,
        target_startup_id: str,
        target_startup_name: str,
        total_co_investment_capacity_dzd: float,
        soft_cap_dzd: float,
        hard_cap_dzd: float,
        initial_close_target_dzd: float,
        minimum_ticket_dzd: float = 1_000_000.0,
        maximum_ticket_dzd: Optional[float] = None,
        deal_id: Optional[str] = None,
    ) -> CoInvestmentDeal:
        """Creates a new side-car co-investment opportunity alongside an SPV."""
        d_id = deal_id or str(uuid.uuid4())
        deal = CoInvestmentDeal(
            deal_id=d_id,
            spv_id=spv_id,
            deal_name=deal_name,
            target_startup_id=target_startup_id,
            target_startup_name=target_startup_name,
            total_co_investment_capacity_dzd=total_co_investment_capacity_dzd,
            soft_cap_dzd=soft_cap_dzd,
            hard_cap_dzd=hard_cap_dzd,
            initial_close_target_dzd=initial_close_target_dzd,
            minimum_ticket_dzd=minimum_ticket_dzd,
            maximum_ticket_dzd=maximum_ticket_dzd,
            milestone_status=CoInvestmentMilestone.DRAFT,
            milestone_history=[
                MilestoneEvent(
                    milestone=CoInvestmentMilestone.DRAFT,
                    cumulative_allocated_dzd=0.0,
                    participating_lps_count=0,
                    deployment_authorized=False,
                    notes=f"Side-car co-investment syndication opened for {target_startup_name}.",
                )
            ],
        )
        self._deals[d_id] = deal
        self._requests[d_id] = []
        return deal

    def get_deal(self, deal_id: str) -> Optional[CoInvestmentDeal]:
        """Fetch co-investment deal by ID."""
        return self._deals.get(deal_id)

    def list_deals(self) -> List[CoInvestmentDeal]:
        """List all registered co-investment deals."""
        return list(self._deals.values())

    def _determine_fee_tier(
        self,
        main_spv_commitment_dzd: float,
        custom_tier: Optional[CoInvestmentFeeTier] = None,
    ) -> tuple[CoInvestmentFeeTier, float, float]:
        """
        Determines fee tier and economics:
        Tier 1 Anchor (>= 10M DZD): 0% Fee / 0% Carry
        Tier 2 Strategic (>= 5M DZD): 1% Fee / 10% Carry
        Tier 3 Standard (< 5M DZD): 2% Fee / 20% Carry
        """
        if custom_tier:
            if custom_tier == CoInvestmentFeeTier.TIER_1_ANCHOR:
                return CoInvestmentFeeTier.TIER_1_ANCHOR, 0.0, 0.0
            elif custom_tier == CoInvestmentFeeTier.TIER_2_STRATEGIC:
                return CoInvestmentFeeTier.TIER_2_STRATEGIC, 1.0, 10.0
            elif custom_tier == CoInvestmentFeeTier.CUSTOM_EXEMPT:
                return CoInvestmentFeeTier.CUSTOM_EXEMPT, 0.0, 0.0
            else:
                return CoInvestmentFeeTier.TIER_3_STANDARD, 2.0, 20.0

        if main_spv_commitment_dzd >= 10_000_000.0:
            return CoInvestmentFeeTier.TIER_1_ANCHOR, 0.0, 0.0
        elif main_spv_commitment_dzd >= 5_000_000.0:
            return CoInvestmentFeeTier.TIER_2_STRATEGIC, 1.0, 10.0
        else:
            return CoInvestmentFeeTier.TIER_3_STANDARD, 2.0, 20.0

    def submit_co_investment_request(
        self,
        deal_id: str,
        lp_id: str,
        lp_name: str,
        lp_email: str,
        main_spv_commitment_dzd: float,
        requested_amount_dzd: float,
        custom_tier: Optional[CoInvestmentFeeTier] = None,
    ) -> CoInvestmentRequest:
        """
        Submits an LP Expression of Interest (EOI) for side-car co-investment.
        Assigns institutional fee and carry tier based on main SPV commitment.
        """
        deal = self._deals.get(deal_id)
        if not deal:
            raise ValueError(f"Co-investment deal '{deal_id}' not found.")

        if requested_amount_dzd < deal.minimum_ticket_dzd:
            raise ValueError(
                f"Requested amount ({requested_amount_dzd:,.2f} DZD) is below minimum ticket "
                f"({deal.minimum_ticket_dzd:,.2f} DZD)."
            )

        if deal.maximum_ticket_dzd and requested_amount_dzd > deal.maximum_ticket_dzd:
            raise ValueError(
                f"Requested amount ({requested_amount_dzd:,.2f} DZD) exceeds maximum ticket cap "
                f"({deal.maximum_ticket_dzd:,.2f} DZD)."
            )

        tier, mgmt_rate, carry_rate = self._determine_fee_tier(main_spv_commitment_dzd, custom_tier)

        req = CoInvestmentRequest(
            deal_id=deal_id,
            lp_id=lp_id,
            lp_name=lp_name,
            lp_email=lp_email,
            main_spv_commitment_dzd=main_spv_commitment_dzd,
            requested_amount_dzd=requested_amount_dzd,
            fee_tier=tier,
            management_fee_rate_pct=mgmt_rate,
            carry_rate_pct=carry_rate,
            status=RequestStatus.PENDING,
        )

        # Remove previous pending request from same LP if exists
        self._requests[deal_id] = [r for r in self._requests[deal_id] if r.lp_id != lp_id]
        self._requests[deal_id].append(req)

        # Update total requested
        deal.total_requested_dzd = round(sum(r.requested_amount_dzd for r in self._requests[deal_id]), 2)
        deal.updated_at = datetime.now(timezone.utc)

        return req

    def run_allocation(
        self,
        deal_id: str,
        allow_greenshoe: bool = False,
    ) -> AllocationRunResult:
        """
        Executes capacity prioritization and allocation algorithm:
        1. Pro-rata entitlement calculation based on LP commitment in lead syndicate SPV.
        2. Unsubscribed case: 100% fill for all LPs.
        3. Oversubscribed case:
           - First pass: fill requests up to pro-rata entitlement.
           - Unused entitlement from LPs requesting less than pro-rata forms an 'excess pool'.
           - Second pass: dynamic water-filling reallocation of excess pool to LPs with unmet demand.
        4. Triggers milestone progression (Initial Close, Interim Close, Final Close).
        """
        deal = self._deals.get(deal_id)
        if not deal:
            raise ValueError(f"Co-investment deal '{deal_id}' not found.")

        requests = self._requests.get(deal_id, [])
        if not requests:
            return AllocationRunResult(
                deal_id=deal_id,
                deal_name=deal.deal_name,
                capacity_available_dzd=deal.total_co_investment_capacity_dzd,
                total_requested_dzd=0.0,
                total_allocated_dzd=0.0,
                excess_reallocated_dzd=0.0,
                is_oversubscribed=False,
                greenshoe_used=False,
                resulting_milestone=deal.milestone_status,
                allocations=[],
            )

        total_requested = sum(r.requested_amount_dzd for r in requests)
        is_oversubscribed = total_requested > deal.total_co_investment_capacity_dzd

        # Determine target capacity
        greenshoe_used = False
        if is_oversubscribed and allow_greenshoe and deal.hard_cap_dzd > deal.total_co_investment_capacity_dzd:
            target_capacity = min(total_requested, deal.hard_cap_dzd)
            greenshoe_used = True
            deal.greenshoe_activated = True
        else:
            target_capacity = deal.total_co_investment_capacity_dzd

        total_main_commitment = sum(r.main_spv_commitment_dzd for r in requests)
        # Avoid division by zero
        if total_main_commitment <= 0:
            total_main_commitment = float(len(requests))
            for r in requests:
                r.main_spv_commitment_dzd = 1.0

        # Calculate base pro-rata entitlement
        for r in requests:
            pro_rata_share = r.main_spv_commitment_dzd / total_main_commitment
            r.pro_rata_entitlement_dzd = round(target_capacity * pro_rata_share, 2)

        excess_reallocated = 0.0

        if not is_oversubscribed or total_requested <= target_capacity:
            # Case A: 100% allocation
            for r in requests:
                r.allocated_amount_dzd = r.requested_amount_dzd
                r.scaled_back_amount_dzd = 0.0
                r.status = RequestStatus.ALLOCATED
        else:
            # Case B: Oversubscribed with iterative excess capacity reallocation
            excess_pool = 0.0
            unmet_requests: List[CoInvestmentRequest] = []

            # First pass: allocate min(requested, entitlement)
            for r in requests:
                if r.requested_amount_dzd <= r.pro_rata_entitlement_dzd:
                    r.allocated_amount_dzd = r.requested_amount_dzd
                    unused = r.pro_rata_entitlement_dzd - r.requested_amount_dzd
                    excess_pool += unused
                    r.scaled_back_amount_dzd = 0.0
                    r.status = RequestStatus.ALLOCATED
                else:
                    r.allocated_amount_dzd = r.pro_rata_entitlement_dzd
                    unmet_requests.append(r)

            # Second pass: reallocate excess pool to unmet requests weighted by main commitment
            initial_excess = excess_pool
            iterations = 0
            while excess_pool > 1.0 and unmet_requests and iterations < 50:
                iterations += 1
                unmet_commitments = sum(r.main_spv_commitment_dzd for r in unmet_requests)
                if unmet_commitments <= 0:
                    break

                still_unmet: List[CoInvestmentRequest] = []
                pool_to_distribute = excess_pool
                distributed_in_round = 0.0

                for r in unmet_requests:
                    share = r.main_spv_commitment_dzd / unmet_commitments
                    portion = pool_to_distribute * share
                    needed = r.requested_amount_dzd - r.allocated_amount_dzd

                    grant = min(portion, needed)
                    r.allocated_amount_dzd += grant
                    distributed_in_round += grant

                    if (r.requested_amount_dzd - r.allocated_amount_dzd) > 1.0:
                        still_unmet.append(r)

                excess_pool -= distributed_in_round
                unmet_requests = still_unmet

            excess_reallocated = round(initial_excess - excess_pool, 2)

            # Finalize statuses and scaled back amounts
            for r in requests:
                r.allocated_amount_dzd = round(r.allocated_amount_dzd, 2)
                r.scaled_back_amount_dzd = max(0.0, round(r.requested_amount_dzd - r.allocated_amount_dzd, 2))
                if r.scaled_back_amount_dzd == 0.0:
                    r.status = RequestStatus.ALLOCATED
                elif r.allocated_amount_dzd > 0.0:
                    r.status = RequestStatus.SCALED_BACK
                else:
                    r.status = RequestStatus.REJECTED

        total_allocated = round(sum(r.allocated_amount_dzd for r in requests), 2)
        deal.total_allocated_dzd = total_allocated
        deal.total_requested_dzd = round(total_requested, 2)

        # Determine resulting milestone
        new_milestone = deal.milestone_status
        if total_allocated >= target_capacity:
            new_milestone = CoInvestmentMilestone.OVERSUBSCRIBED if is_oversubscribed else CoInvestmentMilestone.FINAL_CLOSE
        elif total_allocated >= deal.soft_cap_dzd:
            new_milestone = CoInvestmentMilestone.INTERIM_CLOSE
        elif total_allocated >= deal.initial_close_target_dzd:
            new_milestone = CoInvestmentMilestone.INITIAL_CLOSE

        if new_milestone != deal.milestone_status:
            deal.milestone_status = new_milestone
            deal.milestone_history.append(
                MilestoneEvent(
                    milestone=new_milestone,
                    cumulative_allocated_dzd=total_allocated,
                    participating_lps_count=len([r for r in requests if r.allocated_amount_dzd > 0]),
                    deployment_authorized=(new_milestone in [
                        CoInvestmentMilestone.INITIAL_CLOSE,
                        CoInvestmentMilestone.INTERIM_CLOSE,
                        CoInvestmentMilestone.FINAL_CLOSE,
                        CoInvestmentMilestone.OVERSUBSCRIBED,
                    ]),
                    notes=f"Syndicate reached milestone {new_milestone.value} with {total_allocated:,.2f} DZD allocated.",
                )
            )

        deal.updated_at = datetime.now(timezone.utc)

        return AllocationRunResult(
            deal_id=deal_id,
            deal_name=deal.deal_name,
            capacity_available_dzd=target_capacity,
            total_requested_dzd=total_requested,
            total_allocated_dzd=total_allocated,
            excess_reallocated_dzd=excess_reallocated,
            is_oversubscribed=is_oversubscribed,
            greenshoe_used=greenshoe_used,
            resulting_milestone=new_milestone,
            allocations=requests,
        )

    def advance_closing_milestone(
        self,
        deal_id: str,
        target_milestone: CoInvestmentMilestone,
        authorization_notes: str = "",
    ) -> CoInvestmentDeal:
        """
        Manually or procedurally advances syndicate closing milestone.
        Validates minimum threshold rules before unlocking capital deployment.
        """
        deal = self._deals.get(deal_id)
        if not deal:
            raise ValueError(f"Co-investment deal '{deal_id}' not found.")

        if target_milestone == CoInvestmentMilestone.INITIAL_CLOSE:
            if deal.total_allocated_dzd < deal.initial_close_target_dzd:
                raise ValueError(
                    f"Cannot execute Initial Close: Allocated capital ({deal.total_allocated_dzd:,.2f} DZD) "
                    f"is below Initial Close target ({deal.initial_close_target_dzd:,.2f} DZD)."
                )
        elif target_milestone == CoInvestmentMilestone.INTERIM_CLOSE:
            if deal.total_allocated_dzd < deal.soft_cap_dzd:
                raise ValueError(
                    f"Cannot execute Interim Close: Allocated capital ({deal.total_allocated_dzd:,.2f} DZD) "
                    f"is below soft cap ({deal.soft_cap_dzd:,.2f} DZD)."
                )

        deal.milestone_status = target_milestone
        deal.milestone_history.append(
            MilestoneEvent(
                milestone=target_milestone,
                cumulative_allocated_dzd=deal.total_allocated_dzd,
                participating_lps_count=len([r for r in self._requests.get(deal_id, []) if r.allocated_amount_dzd > 0]),
                deployment_authorized=(target_milestone in [
                    CoInvestmentMilestone.INITIAL_CLOSE,
                    CoInvestmentMilestone.INTERIM_CLOSE,
                    CoInvestmentMilestone.FINAL_CLOSE,
                    CoInvestmentMilestone.OVERSUBSCRIBED,
                ]),
                notes=authorization_notes or f"Milestone advanced to {target_milestone.value}.",
            )
        )
        deal.updated_at = datetime.now(timezone.utc)
        return deal

    def get_deal_allocations(self, deal_id: str) -> List[CoInvestmentRequest]:
        """Fetch all allocations for a given co-investment deal."""
        return self._requests.get(deal_id, [])

    def get_lp_co_investments(self, lp_id: str) -> List[CoInvestmentRequest]:
        """Fetch all co-investment requests and allocations for a specific LP."""
        results: List[CoInvestmentRequest] = []
        for reqs in self._requests.values():
            for r in reqs:
                if r.lp_id == lp_id:
                    results.append(r)
        return results


# Global singleton instance
co_investment_engine = CoInvestmentEngine()
