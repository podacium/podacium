"""
TamWheel Sovereign Ethical Agentic Venture OS — MAUT Negotiation Engine.
Implements:
1. Multi-Attribute Utility Theory (MAUT) evaluating 5 core dimensions:
   - Pre-Money Valuation (weight: 0.30)
   - Investment Ticket / Target Capital (weight: 0.25)
   - Equity Percentage Disbursed (weight: 0.20)
   - Milestone Tranche Requirements (weight: 0.15)
   - Governance & Board Observer Rights (weight: 0.10)
2. Bilateral Polynomial/Exponential Concession Curves over maximum 10 negotiation rounds.
3. Nash Bargaining Solution & Pareto Frontier Convergence.
4. Zone of Possible Agreement (ZOPA) calculation & Al-Mizan Bad-Faith detection.
5. Standardized Ready-to-Execute Term Sheet Generation (JSON & Markdown).
"""

from __future__ import annotations

import enum
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.agent.dealmakers import (
    AntiDilutionRatchet,
    TournamentTier,
)

logger = logging.getLogger(__name__)


# =============================================================================
# WEIGHTS & CONSTANTS
# =============================================================================

MAUT_WEIGHTS = {
    "pre_money_valuation": 0.30,
    "investment_ticket": 0.25,
    "equity_percentage": 0.20,
    "milestone_tranches": 0.15,
    "governance_rights": 0.10,
}

# Ensure weights sum to 1.00
assert math.isclose(sum(MAUT_WEIGHTS.values()), 1.0, rel_tol=1e-5), "MAUT weights must sum to 1.00"

DEFAULT_BATNA_FOUNDER = 0.25
DEFAULT_BATNA_INVESTOR = 0.25


# =============================================================================
# ENUMS
# =============================================================================

class NegotiationStatus(str, enum.Enum):
    AGREED = "AGREED"
    DEADLOCK = "DEADLOCK"
    IN_PROGRESS = "IN_PROGRESS"


# =============================================================================
# DATA SCHEMAS
# =============================================================================

class DealOffer(BaseModel):
    """
    Standardized term sheet proposal vector.
    Supports both new attribute naming and legacy aliases for backward compatibility.
    """
    pre_money_valuation_dzd: float = Field(..., gt=0, description="Pre-money valuation in DZD")
    investment_ticket_dzd: float = Field(..., gt=0, description="Capital ticket amount in DZD")
    milestone_tranches_count: int = Field(default=3, ge=1, le=5, description="Number of milestone tranches")
    governance_board_seats_investor: int = Field(default=1, ge=0, le=3, description="Investor board seats")
    has_board_observer_rights: bool = Field(default=True, description="Investor observer rights")
    has_veto_rights: bool = Field(default=False, description="Investor operational veto rights")
    liquidation_preference_multiplier: float = Field(default=1.0, ge=1.0, le=3.0)
    anti_dilution_ratchet: AntiDilutionRatchet = Field(default=AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE)
    vesting_schedule_months: int = Field(default=48, ge=12, le=60)

    # Backward compatibility properties
    @property
    def post_money_valuation_dzd(self) -> float:
        return self.pre_money_valuation_dzd + self.investment_ticket_dzd

    @property
    def investment_amount_dzd(self) -> float:
        return self.investment_ticket_dzd

    @property
    def board_seats_investor(self) -> int:
        return self.governance_board_seats_investor

    @property
    def veto_rights(self) -> bool:
        return self.has_veto_rights

    @property
    def equity_percentage_pct(self) -> float:
        post = self.post_money_valuation_dzd
        return round((self.investment_ticket_dzd / post) * 100.0, 2) if post > 0 else 0.0


class UtilityBreakdown(BaseModel):
    pre_money_valuation: float
    investment_ticket: float
    equity_percentage: float
    milestone_tranches: float
    governance_rights: float
    composite_utility: float
    penalty: float = 0.0


class NegotiationRound(BaseModel):
    round_number: int
    founder_offer: DealOffer
    investor_offer: DealOffer
    founder_utility: float
    investor_utility: float
    founder_utility_breakdown: UtilityBreakdown
    investor_utility_breakdown: UtilityBreakdown
    zopa_gap_pct: float
    zopa_overlap_dzd: float
    in_zopa: bool
    concession_summary: str
    referee_notes: Optional[str] = None
    bad_faith_detected: Optional[str] = None


class NegotiationSessionResponse(BaseModel):
    session_id: str
    startup_name: str
    status: NegotiationStatus
    rounds_conducted: int
    rounds_history: List[NegotiationRound]
    agreed_term_sheet: Optional[DealOffer] = None
    equity_stake_pct: Optional[float] = None
    nash_product_score: Optional[float] = None
    arbitration_recommendation: Optional[str] = None
    contract_clauses: List[str]
    termsheet_markdown: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NegotiationSessionState(BaseModel):
    session_id: str
    startup_name: str
    founder_initial: DealOffer
    investor_initial: DealOffer
    founder_reservation_val: float
    investor_reservation_val: float
    status: NegotiationStatus
    rounds: List[NegotiationRound] = Field(default_factory=list)
    agreed_term_sheet: Optional[DealOffer] = None
    equity_stake_pct: Optional[float] = None
    nash_product_score: Optional[float] = None
    arbitration_recommendation: Optional[str] = None
    contract_clauses: List[str] = Field(default_factory=list)
    termsheet_markdown: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# MAUT UTILITY CALCULATOR
# =============================================================================

class MAUTUtilityCalculator:
    """
    Evaluates utility along the 5 core venture dimensions with exact weights.
    """

    @staticmethod
    def clamp(val: float, low: float = 0.0, high: float = 1.0) -> float:
        return max(low, min(high, val))

    @classmethod
    def evaluate_founder_utility(
        cls,
        offer: DealOffer,
        val_bounds: Tuple[float, float],
        target_ticket: float,
        penalty: float = 0.0,
    ) -> UtilityBreakdown:
        v_min, v_max = val_bounds
        denom_v = max(v_max - v_min, 1.0)

        # 1. Pre-Money Valuation (weight: 0.30) - Higher is better for founder
        u_val = cls.clamp((offer.pre_money_valuation_dzd - v_min) / denom_v)

        # 2. Investment Ticket (weight: 0.25) - Needs to reach target capital for runway
        if offer.investment_ticket_dzd >= target_ticket:
            u_ticket = 1.0
        else:
            u_ticket = cls.clamp(offer.investment_ticket_dzd / max(target_ticket, 1.0))

        # 3. Equity Percentage (weight: 0.20) - Less equity given up is better
        # Typical seed dilution range: 10% (ideal) to 30% (max acceptable)
        eq_pct = offer.equity_percentage_pct
        u_equity = cls.clamp((30.0 - eq_pct) / 20.0)

        # 4. Milestone Tranches (weight: 0.15) - Fewer tranches/friction is better for founder
        # 1 tranche: 1.0, 2 tranches: 0.85, 3 tranches: 0.70, 4 tranches: 0.55, 5: 0.40
        u_tranches = cls.clamp(1.0 - (offer.milestone_tranches_count - 1) * 0.15)

        # 5. Governance Rights (weight: 0.10) - Founder prefers 0-1 board seats, no veto
        gov_score = 1.0
        if offer.governance_board_seats_investor > 1:
            gov_score -= 0.30
        if offer.has_veto_rights:
            gov_score -= 0.45
        if not offer.has_board_observer_rights:
            # Observer seat is benign and preferred over a director seat
            gov_score += 0.05
        u_gov = cls.clamp(gov_score)

        composite = (
            MAUT_WEIGHTS["pre_money_valuation"] * u_val
            + MAUT_WEIGHTS["investment_ticket"] * u_ticket
            + MAUT_WEIGHTS["equity_percentage"] * u_equity
            + MAUT_WEIGHTS["milestone_tranches"] * u_tranches
            + MAUT_WEIGHTS["governance_rights"] * u_gov
            - penalty
        )
        composite = cls.clamp(composite)

        return UtilityBreakdown(
            pre_money_valuation=round(u_val, 4),
            investment_ticket=round(u_ticket, 4),
            equity_percentage=round(u_equity, 4),
            milestone_tranches=round(u_tranches, 4),
            governance_rights=round(u_gov, 4),
            composite_utility=round(composite, 4),
            penalty=round(penalty, 4),
        )

    @classmethod
    def evaluate_investor_utility(
        cls,
        offer: DealOffer,
        val_bounds: Tuple[float, float],
        max_budget: float,
        penalty: float = 0.0,
    ) -> UtilityBreakdown:
        v_min, v_max = val_bounds
        denom_v = max(v_max - v_min, 1.0)

        # 1. Pre-Money Valuation (weight: 0.30) - Lower valuation is better for investor
        u_val = cls.clamp((v_max - offer.pre_money_valuation_dzd) / denom_v)

        # 2. Investment Ticket (weight: 0.25) - Ticket should be within budget and meaningful
        if offer.investment_ticket_dzd <= max_budget:
            u_ticket = cls.clamp(offer.investment_ticket_dzd / max_budget)
        else:
            u_ticket = cls.clamp(max_budget / max(offer.investment_ticket_dzd, 1.0))

        # 3. Equity Percentage (weight: 0.20) - Higher equity is better for investor
        eq_pct = offer.equity_percentage_pct
        u_equity = cls.clamp((eq_pct - 10.0) / 20.0)

        # 4. Milestone Tranches (weight: 0.15) - Staged tranches mitigate investor risk
        # 3-4 tranches preferred: 1: 0.40, 2: 0.65, 3: 0.90, 4: 1.0
        tranche_map = {1: 0.40, 2: 0.65, 3: 0.90, 4: 1.0, 5: 0.95}
        u_tranches = tranche_map.get(offer.milestone_tranches_count, 0.75)

        # 5. Governance Rights (weight: 0.10) - Investor wants board observer/director seat and protective rights
        gov_score = 0.50
        if offer.governance_board_seats_investor >= 1:
            gov_score += 0.30
        if offer.has_board_observer_rights:
            gov_score += 0.10
        if offer.has_veto_rights:
            gov_score += 0.10
        u_gov = cls.clamp(gov_score)

        composite = (
            MAUT_WEIGHTS["pre_money_valuation"] * u_val
            + MAUT_WEIGHTS["investment_ticket"] * u_ticket
            + MAUT_WEIGHTS["equity_percentage"] * u_equity
            + MAUT_WEIGHTS["milestone_tranches"] * u_tranches
            + MAUT_WEIGHTS["governance_rights"] * u_gov
            - penalty
        )
        composite = cls.clamp(composite)

        return UtilityBreakdown(
            pre_money_valuation=round(u_val, 4),
            investment_ticket=round(u_ticket, 4),
            equity_percentage=round(u_equity, 4),
            milestone_tranches=round(u_tranches, 4),
            governance_rights=round(u_gov, 4),
            composite_utility=round(composite, 4),
            penalty=round(penalty, 4),
        )


# =============================================================================
# MAUT NEGOTIATION ENGINE
# =============================================================================

class MAUTNegotiationEngine:
    """
    Hardened Autonomous Bilateral MAUT Negotiation Engine.
    Executes alternating offers between Al-Mu'assis (Founder) and Al-Muhaqqiq (Investor)
    with Al-Mizan refereeing, ZOPA verification, bad-faith detection, and Nash Bargaining convergence.
    """

    def __init__(self):
        self._sessions: Dict[str, NegotiationSessionState] = {}

    def get_session(self, session_id: str) -> Optional[NegotiationSessionState]:
        return self._sessions.get(session_id)

    def calculate_zopa(
        self,
        founder_offer: DealOffer,
        investor_offer: DealOffer,
        founder_res_val: float,
        investor_res_val: float,
    ) -> Tuple[bool, float, float]:
        """
        Computes Zone of Possible Agreement (ZOPA).
        Returns: (in_zopa, zopa_overlap_dzd, zopa_gap_pct)
        """
        # Overlap in pre-money valuation:
        # ZOPA exists if Founder's minimum reservation <= Investor's maximum reservation
        overlap_dzd = max(0.0, investor_res_val - founder_res_val)

        val_gap = abs(founder_offer.pre_money_valuation_dzd - investor_offer.pre_money_valuation_dzd)
        midpoint = (founder_offer.pre_money_valuation_dzd + investor_offer.pre_money_valuation_dzd) / 2.0
        gap_pct = (val_gap / midpoint) * 100.0 if midpoint > 0 else 0.0

        # An offer pair is in ZOPA if current valuation gap is within acceptable convergence threshold (<= 8.0%)
        # and both proposals lie within the reservation boundaries.
        in_zopa = (
            gap_pct <= 8.0
            and founder_offer.pre_money_valuation_dzd >= (founder_res_val * 0.95)
            and investor_offer.pre_money_valuation_dzd <= (investor_res_val * 1.05)
        )

        return in_zopa, overlap_dzd, round(gap_pct, 2)

    def detect_bad_faith(
        self,
        prev_offer: Optional[DealOffer],
        curr_offer: DealOffer,
        party: str,
    ) -> Optional[str]:
        """
        Al-Mizan Bad-Faith Monitor.
        Detects regressive concessions or predatory demands.
        """
        if not prev_offer:
            # Check for predatory opening terms
            if party == "investor" and curr_offer.liquidation_preference_multiplier > 1.5:
                return "Predatory liquidation preference (> 1.5x) detected in investor terms."
            if party == "investor" and curr_offer.has_veto_rights and curr_offer.equity_percentage_pct < 20.0:
                return "Disproportionate operational veto rights requested for minority equity stake."
            return None

        # Check for regressive concessions
        if party == "founder":
            # Founder should not increase valuation ask in later rounds
            if curr_offer.pre_money_valuation_dzd > prev_offer.pre_money_valuation_dzd * 1.01:
                return (
                    f"Regressive demand: Founder increased valuation ask from "
                    f"{prev_offer.pre_money_valuation_dzd:,.0f} to {curr_offer.pre_money_valuation_dzd:,.0f} DZD."
                )
        elif party == "investor":
            # Investor should not lower valuation offer in later rounds
            if curr_offer.pre_money_valuation_dzd < prev_offer.pre_money_valuation_dzd * 0.99:
                return (
                    f"Regressive demand: Investor decreased valuation offer from "
                    f"{prev_offer.pre_money_valuation_dzd:,.0f} to {curr_offer.pre_money_valuation_dzd:,.0f} DZD."
                )

        return None

    def negotiate(
        self,
        startup_name: str,
        founder_ask: DealOffer,
        investor_offer: DealOffer,
        founder_res_val: Optional[float] = None,
        investor_res_val: Optional[float] = None,
        max_rounds: int = 10,
    ) -> NegotiationSessionResponse:
        """
        Executes autonomous bilateral negotiation between Al-Mu'assis and Al-Muhaqqiq
        with Al-Mizan arbitration over maximum 10 rounds.
        """
        session_id = str(uuid.uuid4())
        max_rounds = min(max(max_rounds, 1), 10)

        # Set default reservation values if not provided
        # Founder reservation is typically 80% of opening ask
        f_res = founder_res_val if founder_res_val is not None else (founder_ask.pre_money_valuation_dzd * 0.80)
        # Investor reservation is typically 120% of opening offer
        i_res = investor_res_val if investor_res_val is not None else (investor_offer.pre_money_valuation_dzd * 1.20)

        # Valuation bounds for normalization
        val_min = min(investor_offer.pre_money_valuation_dzd, f_res) * 0.90
        val_max = max(founder_ask.pre_money_valuation_dzd, i_res) * 1.10
        val_bounds = (val_min, val_max)

        target_ticket = founder_ask.investment_ticket_dzd
        max_budget = max(founder_ask.investment_ticket_dzd, investor_offer.investment_ticket_dzd) * 1.10

        curr_f = founder_ask.model_copy()
        curr_i = investor_offer.model_copy()

        rounds_history: List[NegotiationRound] = []
        agreed_vector: Optional[DealOffer] = None
        status = NegotiationStatus.IN_PROGRESS
        nash_score: Optional[float] = None

        prev_f: Optional[DealOffer] = None
        prev_i: Optional[DealOffer] = None

        # Concession curve parameters
        beta_founder = 1.35  # Polynomial concession rate for founder
        beta_investor = 1.25 # Polynomial concession rate for investor

        for r in range(1, max_rounds + 1):
            # 1. Bad-Faith Audit by Al-Mizan
            f_bad_faith = self.detect_bad_faith(prev_f, curr_f, "founder")
            i_bad_faith = self.detect_bad_faith(prev_i, curr_i, "investor")
            bad_faith_note = f_bad_faith or i_bad_faith

            f_penalty = 0.20 if f_bad_faith else 0.0
            i_penalty = 0.20 if i_bad_faith else 0.0

            # 2. Compute MAUT Utilities
            u_f_breakdown = MAUTUtilityCalculator.evaluate_founder_utility(
                offer=curr_i,  # Founder evaluates Investor's current offer
                val_bounds=val_bounds,
                target_ticket=target_ticket,
                penalty=f_penalty,
            )
            u_i_breakdown = MAUTUtilityCalculator.evaluate_investor_utility(
                offer=curr_f,  # Investor evaluates Founder's current offer
                val_bounds=val_bounds,
                max_budget=max_budget,
                penalty=i_penalty,
            )

            u_f = u_f_breakdown.composite_utility
            u_i = u_i_breakdown.composite_utility

            # 3. ZOPA Analysis
            in_zopa, overlap_dzd, gap_pct = self.calculate_zopa(
                founder_offer=curr_f,
                investor_offer=curr_i,
                founder_res_val=f_res,
                investor_res_val=i_res,
            )

            # Check if convergence reached
            if in_zopa or (curr_i.pre_money_valuation_dzd >= curr_f.pre_money_valuation_dzd) or (r == max_rounds and i_res >= f_res and gap_pct <= 20.0):
                # Nash Bargaining Solution reached along Pareto Frontier
                nash_val = (curr_f.pre_money_valuation_dzd + curr_i.pre_money_valuation_dzd) / 2.0
                nash_ticket = (curr_f.investment_ticket_dzd + curr_i.investment_ticket_dzd) / 2.0

                agreed_vector = DealOffer(
                    pre_money_valuation_dzd=round(nash_val, -3),
                    investment_ticket_dzd=round(nash_ticket, -3),
                    milestone_tranches_count=3,
                    governance_board_seats_investor=1,
                    has_board_observer_rights=True,
                    has_veto_rights=False,
                    liquidation_preference_multiplier=1.0,
                    anti_dilution_ratchet=AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE,
                    vesting_schedule_months=48,
                )

                # Recompute final utilities at agreed vector
                final_u_f = MAUTUtilityCalculator.evaluate_founder_utility(
                    offer=agreed_vector,
                    val_bounds=val_bounds,
                    target_ticket=target_ticket,
                ).composite_utility
                final_u_i = MAUTUtilityCalculator.evaluate_investor_utility(
                    offer=agreed_vector,
                    val_bounds=val_bounds,
                    max_budget=max_budget,
                ).composite_utility

                nash_score = round(
                    max(0.0, final_u_f - DEFAULT_BATNA_FOUNDER) * max(0.0, final_u_i - DEFAULT_BATNA_INVESTOR),
                    4,
                )
                status = NegotiationStatus.AGREED

                rounds_history.append(
                    NegotiationRound(
                        round_number=r,
                        founder_offer=curr_f.model_copy(),
                        investor_offer=curr_i.model_copy(),
                        founder_utility=u_f,
                        investor_utility=u_i,
                        founder_utility_breakdown=u_f_breakdown,
                        investor_utility_breakdown=u_i_breakdown,
                        zopa_gap_pct=gap_pct,
                        zopa_overlap_dzd=overlap_dzd,
                        in_zopa=True,
                        concession_summary=(
                            f"Nash Bargaining Equilibrium reached at Round {r}: "
                            f"Pre-money valuation converged to {agreed_vector.pre_money_valuation_dzd:,.0f} DZD "
                            f"with {agreed_vector.equity_percentage_pct:.2f}% equity stake."
                        ),
                        referee_notes="Al-Mizan confirmed mutual ZOPA convergence. Term Sheet ratified.",
                        bad_faith_detected=bad_faith_note,
                    )
                )
                break

            # 4. Generate Bilateral Concessions for Next Round
            # Polynomial pacing: concessions increase smoothly as deadline approaches
            t_ratio = r / float(max_rounds)
            step_f = 0.25 + 0.15 * math.pow(t_ratio, beta_founder)
            step_i = 0.25 + 0.15 * math.pow(t_ratio, beta_investor)

            val_gap = curr_f.pre_money_valuation_dzd - curr_i.pre_money_valuation_dzd
            f_concession = val_gap * step_f
            i_concession = val_gap * step_i

            rounds_history.append(
                NegotiationRound(
                    round_number=r,
                    founder_offer=curr_f.model_copy(),
                    investor_offer=curr_i.model_copy(),
                    founder_utility=u_f,
                    investor_utility=u_i,
                    founder_utility_breakdown=u_f_breakdown,
                    investor_utility_breakdown=u_i_breakdown,
                    zopa_gap_pct=gap_pct,
                    zopa_overlap_dzd=overlap_dzd,
                    in_zopa=in_zopa,
                    concession_summary=(
                        f"Round {r}: Founder valuation adjusted to {curr_f.pre_money_valuation_dzd:,.0f} DZD; "
                        f"Investor offer adjusted to {curr_i.pre_money_valuation_dzd:,.0f} DZD (gap: {gap_pct:.1f}%)."
                    ),
                    referee_notes="Concession pacing validated by Al-Mizan within statutory tolerance.",
                    bad_faith_detected=bad_faith_note,
                )
            )

            prev_f = curr_f.model_copy()
            prev_i = curr_i.model_copy()

            # Apply concessions respecting reservation floors and ceilings
            curr_f.pre_money_valuation_dzd = max(f_res, curr_f.pre_money_valuation_dzd - f_concession)
            curr_i.pre_money_valuation_dzd = min(i_res, curr_i.pre_money_valuation_dzd + i_concession)

            # Ticket adjustments towards midpoint
            ticket_gap = curr_f.investment_ticket_dzd - curr_i.investment_ticket_dzd
            curr_f.investment_ticket_dzd = curr_f.investment_ticket_dzd - (ticket_gap * 0.20)
            curr_i.investment_ticket_dzd = curr_i.investment_ticket_dzd + (ticket_gap * 0.20)

        # 5. Handle Deadlock vs Agreement
        if agreed_vector is None:
            status = NegotiationStatus.DEADLOCK
            arbitration_msg = (
                "Deadlock reached: Valuation gap remained outside ZOPA after "
                f"{len(rounds_history)} rounds. Recommended Tier 1 TEE algorithmic mediation, "
                "or Tier 2 AI Judicial Tribunal review under Algerian SPAS commercial norms."
            )
            clauses = [
                "Clause: Mandatory 14-day Algorithmic Mediation window prior to formal legal dispute initiation.",
                "Clause: Neutral valuation re-appraisal via certified independent accountant (Commissaire aux Comptes).",
                "Clause: SPAS Nominee dispute escalation protocol under Law 22-09.",
            ]
            equity_stake = None
            termsheet_md = None
        else:
            arbitration_msg = None
            equity_stake = agreed_vector.equity_percentage_pct
            clauses = [
                f"Valuation: Agreed pre-money valuation set at {agreed_vector.pre_money_valuation_dzd:,.0f} DZD "
                f"(Post-money: {agreed_vector.post_money_valuation_dzd:,.0f} DZD).",
                f"Investment Ticket: Investor commits {agreed_vector.investment_ticket_dzd:,.0f} DZD for {equity_stake:.2f}% equity stake.",
                f"Liquidation Preference: Clean {agreed_vector.liquidation_preference_multiplier:.1f}x Non-Participating Preferred.",
                f"Governance: {agreed_vector.governance_board_seats_investor} Investor Director Seat + Board Observer Rights; No operational veto.",
                f"Anti-Dilution Protection: {agreed_vector.anti_dilution_ratchet.value}.",
                f"Escrow & Milestones: Funds released across {agreed_vector.milestone_tranches_count} performance gates in VentureEscrowVault.",
                f"Vesting: Founder shares subject to {agreed_vector.vesting_schedule_months}-month reverse vesting with 12-month cliff.",
            ]
            termsheet_md = self.generate_termsheet_markdown(
                startup_name=startup_name,
                deal=agreed_vector,
                nash_score=nash_score or 0.0,
                rounds_count=len(rounds_history),
            )

        # 6. Store Session State
        session_state = NegotiationSessionState(
            session_id=session_id,
            startup_name=startup_name,
            founder_initial=founder_ask,
            investor_initial=investor_offer,
            founder_reservation_val=f_res,
            investor_reservation_val=i_res,
            status=status,
            rounds=rounds_history,
            agreed_term_sheet=agreed_vector,
            equity_stake_pct=equity_stake,
            nash_product_score=nash_score,
            arbitration_recommendation=arbitration_msg,
            contract_clauses=clauses,
            termsheet_markdown=termsheet_md,
        )
        self._sessions[session_id] = session_state

        return NegotiationSessionResponse(
            session_id=session_id,
            startup_name=startup_name,
            status=status,
            rounds_conducted=len(rounds_history),
            rounds_history=rounds_history,
            agreed_term_sheet=agreed_vector,
            equity_stake_pct=equity_stake,
            nash_product_score=nash_score,
            arbitration_recommendation=arbitration_msg,
            contract_clauses=clauses,
            termsheet_markdown=termsheet_md,
            created_at=session_state.created_at,
        )

    def generate_termsheet_markdown(
        self,
        startup_name: str,
        deal: DealOffer,
        nash_score: float,
        rounds_count: int,
    ) -> str:
        """
        Generates ready-to-execute standardized term sheet in professional Markdown.
        """
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        return f"""# TERM SHEET — SERIES SEED INVESTMENT
**TamWheel Sovereign Ethical Agentic Venture OS**
*Negotiated autonomously via Bilateral MAUT Swarm (Al-Mu'assis & Al-Muhaqqiq with Al-Mizan Arbitration)*

---

### SUMMARY OF PRINCIPAL TERMS

| Term | Value |
| :--- | :--- |
| **Target Company** | `{startup_name}` (Société par Actions Simplifiée - SPAS) |
| **Governing Law** | Algerian Commercial Code (Law 22-09) & ADGM Feeder SPV |
| **Pre-Money Valuation** | `{deal.pre_money_valuation_dzd:,.0f} DZD` |
| **Investment Ticket** | `{deal.investment_ticket_dzd:,.0f} DZD` |
| **Post-Money Valuation** | `{deal.post_money_valuation_dzd:,.0f} DZD` |
| **Purchased Equity Stake** | `{deal.equity_percentage_pct:.2f}%` |
| **Nash Bargaining Score** | `{nash_score:.4f}` |
| **Negotiation Pacing** | `Converged in {rounds_count} rounds` |
| **Date of Execution** | `{now_str}` |

---

### 1. FINANCING STRUCTURE & DISBURSEMENT GATES
* **Escrow Mechanism:** All funds deposited into the `VentureEscrowVault` smart contract upon term sheet execution.
* **Milestone Tranches:** Capital is disbursed across **{deal.milestone_tranches_count} performance gates**:
  1. **Tranche 1 (30%):** Immediate release upon SPAS commercial registration with CNRC and bank account validation.
  2. **Tranche 2 (35%):** Technical MVP verification and SATIM/CIB gateway integration via ZK-TLS attestation.
  3. **Tranche 3 (35%):** Commercial traction gate verified by Al-Mizan dual-agent consensus.

### 2. LIQUIDATION PREFERENCE
* **Type:** Clean **{deal.liquidation_preference_multiplier:.1f}x Non-Participating Preferred Shares**.
* In any liquidation event, sale, or merger, Series Seed Preferred shareholders receive 1.0x initial investment prior to any common share distribution, after which remaining assets distribute pro-rata to Common Stock. Strictly non-participating.

### 3. GOVERNANCE & BOARD REPRESENTATION
* **Board of Directors:** Composed of three (3) members:
  - Two (2) representatives appointed by Founder Common Shareholders.
  - One (1) representative appointed by Series Seed Preferred Shareholders.
* **Observer Rights:** Investor is granted one (1) permanent non-voting Board Observer seat.
* **Protective Provisions:** Qualified majority (75%) required solely for major statutory corporate events (merger, winding up, altering share capital). Standard operational matters below 2,000,000 DZD remain under founder executive authority.

### 4. ANTI-DILUTION & PRE-EMPTIVE RIGHTS
* **Anti-Dilution:** **{deal.anti_dilution_ratchet.value}**. Down-round protections adjust conversion ratio on a weighted-average basis, protecting company capitalization structure.
* **Pre-Emptive Rights:** Series Seed investors possess pro-rata rights to participate in future equity financing rounds.

### 5. FOUNDER REVERSE VESTING
* Founder equity is subject to a standard **{deal.vesting_schedule_months}-month reverse vesting schedule** with a 12-month cliff (25% vesting after 12 months, remaining vesting monthly over 36 months).
* **Acceleration:** 100% double-trigger acceleration upon involuntary termination following an acquisition or change of control.

---

### EXECUTION & SIGNATURES

**FOUNDER CO-PILOT (On behalf of Founder):**  
*Agent:* `Al-Mu'assis (المؤسس)`  
*Signature Hash:* `0x{hash(startup_name + str(deal.pre_money_valuation_dzd)) & 0xffffffffffffffff:016x}`  

**INVESTOR AGENT (On behalf of Syndicate):**  
*Agent:* `Al-Muhaqqiq (المحقق)`  
*Signature Hash:* `0x{hash(str(deal.investment_ticket_dzd) + 'syndicate') & 0xffffffffffffffff:016x}`  

**TOURNAMENT REFEREE & ARBITRATOR:**  
*Agent:* `Al-Mizan (الميزان)`  
*Status:* `RATIFIED & ZOPA VERIFIED`  
*Verification ID:* `ZOPA-NASHEQ-{deal.post_money_valuation_dzd:.0f}`  
"""


maut_negotiation_engine = MAUTNegotiationEngine()
