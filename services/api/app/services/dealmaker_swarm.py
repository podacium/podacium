"""
TamWheel Sovereign Ethical Agentic Venture OS — Autonomous AI-to-AI Dealmaking & Due Diligence Swarm.
Implements:
1. Multi-Agent Due Diligence Swarm (Al-Mu'assis, Al-Muhaqqiq, Al-Muqawil, Al-Mizan) with Jadara Scoring & Valuation Sanity.
2. Autonomous AI-to-AI Negotiation Agent using Multi-Attribute Utility Theory (MAUT) & Nash Bargaining Solution.
"""

from __future__ import annotations

import enum
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & CONSTANTS
# =============================================================================

class TournamentTier(str, enum.Enum):
    SANDBOX = "SANDBOX"                     # [0 - 49]
    SIMULATION_LEAGUE = "SIMULATION_LEAGUE" # [50 - 69]
    PUBLIC_LISTING = "PUBLIC_LISTING"       # [70 - 84]
    PRIVATE_SYNDICATE = "PRIVATE_SYNDICATE" # [85 - 100]


class AntiDilutionRatchet(str, enum.Enum):
    BROAD_BASED_WEIGHTED_AVERAGE = "BROAD_BASED_WEIGHTED_AVERAGE"
    NARROW_BASED_WEIGHTED_AVERAGE = "NARROW_BASED_WEIGHTED_AVERAGE"
    FULL_RATCHET = "FULL_RATCHET"
    NONE = "NONE"


class NegotiationStatus(str, enum.Enum):
    AGREED = "AGREED"
    DEADLOCK = "DEADLOCK"
    IN_PROGRESS = "IN_PROGRESS"


# =============================================================================
# SCHEMAS FOR MULTI-AGENT DUE DILIGENCE
# =============================================================================

class StartupProfileInput(BaseModel):
    startup_name: str
    sector: str
    wilaya: int = Field(default=16, ge=1, le=58, description="Algerian Wilaya code (1-58)")
    pitch_summary: str
    arr_dzd: float = Field(default=0.0, ge=0)
    mrr_growth_rate_pct: float = Field(default=0.0, description="Month-over-month growth rate percentage")
    burn_rate_dzd: float = Field(default=0.0, ge=0, description="Monthly net burn rate in DZD")
    runway_months: float = Field(default=12.0, ge=0, description="Cash runway in months")
    cac_dzd: float = Field(default=15_000.0, ge=0, description="Customer acquisition cost in DZD")
    ltv_dzd: float = Field(default=60_000.0, ge=0, description="Customer lifetime value in DZD")
    valuation_ask_dzd: float = Field(..., gt=0, description="Founder requested post-money valuation in DZD")
    target_raise_dzd: float = Field(..., gt=0, description="Target investment round in DZD")
    has_asf_label: bool = Field(default=False, description="National Startup Label (Executive Decree 20-254)")
    tech_stack: List[str] = Field(default_factory=list)


class FounderCopilotSynthesis(BaseModel):
    agent_name: str = "Al-Mu'assis (المؤسس - Founder Co-Pilot)"
    growth_narrative: str
    market_opportunity: str
    localized_gtm_strategy: str
    asf_regulatory_readiness: str


class DueDiligenceSynthesis(BaseModel):
    agent_name: str = "Al-Muhaqqiq (المحقق - Due Diligence Analyst)"
    ltv_to_cac_ratio: float
    payback_period_months: float
    burn_multiple: float
    valuation_sanity_verdict: str
    implied_arr_multiple: Optional[float]
    benchmark_multiple_range: str = "5.0x - 12.0x ARR"
    risk_flags: List[str]


class MilestoneEscrowSynthesis(BaseModel):
    agent_name: str = "Al-Muqawil (المقاول - Milestone & Escrow Agent)"
    technical_feasibility_score: float = Field(..., ge=0, le=100)
    suggested_escrow_tranches: List[Dict[str, Any]]
    s4e_sweat_equity_recommendation: str


class RefereeTournamentSynthesis(BaseModel):
    agent_name: str = "Al-Mizan (الميزان - Tournament & Referee Agent)"
    jadara_index_score: float = Field(..., ge=0, le=100)
    tier: TournamentTier
    verdict: str
    score_breakdown: Dict[str, float]


class SwarmAnalysisResponse(BaseModel):
    startup_name: str
    executive_summary: str
    founder_copilot: FounderCopilotSynthesis
    due_diligence: DueDiligenceSynthesis
    milestone_escrow: MilestoneEscrowSynthesis
    referee_verdict: RefereeTournamentSynthesis
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SCHEMAS FOR DEALMAKER NEGOTIATION
# =============================================================================

class TermSheetVector(BaseModel):
    post_money_valuation_dzd: float
    investment_amount_dzd: float
    liquidation_preference_multiplier: float = 1.0
    board_seats_investor: int = 1
    veto_rights: bool = False
    anti_dilution_ratchet: AntiDilutionRatchet = AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE
    vesting_schedule_months: int = 48


class NegotiationRequest(BaseModel):
    startup_name: str
    founder_ask: TermSheetVector
    investor_offer: TermSheetVector
    max_rounds: int = Field(default=5, ge=1, le=10)


class NegotiationRound(BaseModel):
    round_number: int
    founder_offer: TermSheetVector
    investor_offer: TermSheetVector
    founder_utility: float
    investor_utility: float
    concession_summary: str


class NegotiationResponse(BaseModel):
    startup_name: str
    status: NegotiationStatus
    rounds_conducted: int
    rounds_history: List[NegotiationRound]
    agreed_term_sheet: Optional[TermSheetVector]
    equity_stake_pct: Optional[float]
    nash_product_score: Optional[float]
    arbitration_recommendation: Optional[str] = None
    contract_clauses: List[str]


# =============================================================================
# DEALMAKER SWARM IMPLEMENTATION
# =============================================================================

class DealmakerSwarmService:
    """
    Multi-Agent Due Diligence and Autonomous Negotiation Swarm.
    """

    # -------------------------------------------------------------------------
    # 1. MULTI-AGENT DUE DILIGENCE PIPELINE
    # -------------------------------------------------------------------------

    def analyze_startup(self, p: StartupProfileInput) -> SwarmAnalysisResponse:
        """
        Executes multi-agent swarm evaluation across Al-Mu'assis, Al-Muhaqqiq, Al-Muqawil, and Al-Mizan.
        """
        # --- 1. Al-Mu'assis (Founder Co-Pilot) ---
        label_status = (
            "Fully Certified with National Startup Label (Decree 20-254) — Exempt from TAP/IBS taxes."
            if p.has_asf_label
            else "Pending Algerian Startup Label — Recommend expedited dossier submission via startup.dz."
        )
        founder_copilot = FounderCopilotSynthesis(
            growth_narrative=(
                f"{p.startup_name} positions as an ethical technology leader in {p.sector}, leveraging "
                f"Algerian digital infrastructure with {p.mrr_growth_rate_pct:.1f}% monthly momentum."
            ),
            market_opportunity=(
                f"Targeting high-demand verticals across Wilaya {p.wilaya} and national enterprise modernization, "
                f"aiming for dominant market share before pan-African or Maghreb expansion."
            ),
            localized_gtm_strategy=(
                f"Multi-channel localized GTM combining university incubation hubs, Darija-first visual demos, "
                f"and strategic B2B distribution partnerships across industrial hubs."
            ),
            asf_regulatory_readiness=label_status,
        )

        # --- 2. Al-Muhaqqiq (Due Diligence Analyst) ---
        ltv_cac = p.ltv_dzd / p.cac_dzd if p.cac_dzd > 0 else 0.0
        payback = (p.cac_dzd / (p.ltv_dzd / 12.0)) if p.ltv_dzd > 0 else 12.0
        burn_multiple = (
            (p.burn_rate_dzd * 12.0) / (p.arr_dzd * (p.mrr_growth_rate_pct / 100.0 + 0.01))
            if p.arr_dzd > 0
            else 2.5
        )

        risk_flags: List[str] = []
        if p.runway_months < 6.0:
            risk_flags.append(f"CRITICAL RUNWAY: Only {p.runway_months:.1f} months of cash runway remaining.")
        if ltv_cac < 3.0:
            risk_flags.append(f"UNIT ECONOMICS STRETCH: LTV/CAC ratio is {ltv_cac:.2f}x (industry target is >= 3.0x).")
        if not p.has_asf_label:
            risk_flags.append("REGULATORY GAP: Lacks formal Label Start-up certification.")
        if p.burn_rate_dzd > (p.arr_dzd / 12.0) * 3 and p.arr_dzd > 0:
            risk_flags.append("HIGH CASH BURN: Monthly burn rate exceeds 3x monthly revenue.")

        # Valuation Sanity Check
        implied_multiple = (p.valuation_ask_dzd / p.arr_dzd) if p.arr_dzd > 0 else None
        if implied_multiple is None:
            valuation_verdict = (
                "PRE-REVENUE VALUATION SANITY: Valuation based on team, IP, and market TAM. Requires milestone escrow."
            )
        elif implied_multiple > 15.0:
            valuation_verdict = (
                f"OVERVALUATION ALERT: Ask of {p.valuation_ask_dzd:,.0f} DZD implies {implied_multiple:.1f}x ARR, "
                f"significantly above regional peer benchmark of 5x - 12x ARR."
            )
            risk_flags.append(f"VALUATION PREMIUM: Implied multiple is {implied_multiple:.1f}x ARR.")
        elif implied_multiple < 4.0:
            valuation_verdict = (
                f"HIGHLY ATTRACTIVE / UNDERVALUED: Implied {implied_multiple:.1f}x ARR represents favorable entry."
            )
        else:
            valuation_verdict = (
                f"FAIR VALUATION: Implied {implied_multiple:.1f}x ARR aligns with MENA high-growth benchmarks."
            )

        due_diligence = DueDiligenceSynthesis(
            ltv_to_cac_ratio=round(ltv_cac, 2),
            payback_period_months=round(payback, 1),
            burn_multiple=round(burn_multiple, 2),
            valuation_sanity_verdict=valuation_verdict,
            implied_arr_multiple=round(implied_multiple, 2) if implied_multiple else None,
            risk_flags=risk_flags,
        )

        # --- 3. Al-Muqawil (Milestone & Escrow Agent) ---
        tech_score = 85.0 if len(p.tech_stack) >= 3 else 70.0
        escrow_tranches = [
            {
                "tranche": 1,
                "percentage": 35.0,
                "amount_dzd": p.target_raise_dzd * 0.35,
                "unlock_condition": "Deployment of core production architecture & security review sign-off",
            },
            {
                "tranche": 2,
                "percentage": 35.0,
                "amount_dzd": p.target_raise_dzd * 0.35,
                "unlock_condition": f"Traction milestone: 25% ARR growth and verified user retention in Wilaya {p.wilaya}",
            },
            {
                "tranche": 3,
                "percentage": 30.0,
                "amount_dzd": p.target_raise_dzd * 0.30,
                "unlock_condition": "Scale milestone: National expansion and positive unit economics",
            },
        ]
        s4e_recommendation = (
            f"Reserve 10.0% of cap-table in Istihaq S4E sweat-equity pool for open-source engineering, "
            f"security audits, and community AI labeling."
        )
        milestone_escrow = MilestoneEscrowSynthesis(
            technical_feasibility_score=tech_score,
            suggested_escrow_tranches=escrow_tranches,
            s4e_sweat_equity_recommendation=s4e_recommendation,
        )

        # --- 4. Al-Mizan (Tournament & Referee Agent) ---
        # Jadara Index calculation (0 - 100)
        market_score = 18.0 if p.sector in ["Fintech", "Healthtech", "AI", "Agtech", "Logistics"] else 14.0
        traction_score = min(25.0, max(5.0, (p.mrr_growth_rate_pct * 1.5) + (10.0 if p.arr_dzd > 0 else 2.0)))
        economics_score = min(25.0, max(5.0, ltv_cac * 5.0))
        team_reg_score = 15.0 if p.has_asf_label else 8.0
        ethical_score = 15.0  # Assumes baseline ethical screening passed

        jadara_index = market_score + traction_score + economics_score + team_reg_score + ethical_score
        jadara_index = min(100.0, max(0.0, jadara_index))

        if jadara_index >= 85.0:
            tier = TournamentTier.PRIVATE_SYNDICATE
            verdict = "APPROVED FOR PRIVATE SYNDICATE: Institutional grade fundamentals."
        elif jadara_index >= 70.0:
            tier = TournamentTier.PUBLIC_LISTING
            verdict = "APPROVED FOR PUBLIC SIMULATION LISTING: High retail interest potential."
        elif jadara_index >= 50.0:
            tier = TournamentTier.SIMULATION_LEAGUE
            verdict = "SIMULATION LEAGUE TIER: Suitable for fantasy venture competition and community diligence."
        else:
            tier = TournamentTier.SANDBOX
            verdict = "SANDBOX NURTURE: Needs acceleration before public venture exposure."

        referee_verdict = RefereeTournamentSynthesis(
            jadara_index_score=round(jadara_index, 1),
            tier=tier,
            verdict=verdict,
            score_breakdown={
                "market_viability": round(market_score, 1),
                "growth_traction": round(traction_score, 1),
                "unit_economics": round(economics_score, 1),
                "team_and_regulatory": round(team_reg_score, 1),
                "ethical_alignment": round(ethical_score, 1),
            },
        )

        exec_summary = (
            f"Multi-Agent Swarm Due Diligence for {p.startup_name}: Al-Jadara Index rated at {jadara_index:.1f}/100 "
            f"({tier.value}). {valuation_verdict} Escrow disbursement partitioned into 3 tranches to secure backer capital."
        )

        return SwarmAnalysisResponse(
            startup_name=p.startup_name,
            executive_summary=exec_summary,
            founder_copilot=founder_copilot,
            due_diligence=due_diligence,
            milestone_escrow=milestone_escrow,
            referee_verdict=referee_verdict,
        )

    # -------------------------------------------------------------------------
    # 2. AUTONOMOUS AI-TO-AI MAUT NEGOTIATION & NASH BARGAINING
    # -------------------------------------------------------------------------

    def _calc_founder_utility(self, x: TermSheetVector, reservation_val: float) -> float:
        """
        Founder Utility Function U_F(X):
        Higher valuation (+), Lower liquidation preference (+), Fewer investor board seats (+),
        No veto rights (+), Weighted average ratchet (+), Fair vesting schedule (+).
        """
        # Valuation utility
        val_ratio = x.post_money_valuation_dzd / max(reservation_val, 1.0)
        u_val = min(1.0, max(0.0, val_ratio / 1.5)) * 0.40

        # Liquidation pref utility (1.0x is ideal for founder, 2.0x is painful)
        u_liq = max(0.0, 1.0 - (x.liquidation_preference_multiplier - 1.0)) * 0.20

        # Board seat utility (0 or 1 seat is manageable, >=2 reduces autonomy)
        u_board = (0.15 if x.board_seats_investor <= 1 else 0.05)

        # Veto rights penalty
        u_veto = (0.0 if x.veto_rights else 0.10)

        # Anti-dilution ratchet utility
        ratchet_scores = {
            AntiDilutionRatchet.NONE: 0.15,
            AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE: 0.12,
            AntiDilutionRatchet.NARROW_BASED_WEIGHTED_AVERAGE: 0.07,
            AntiDilutionRatchet.FULL_RATCHET: 0.0,
        }
        u_ratchet = ratchet_scores.get(x.anti_dilution_ratchet, 0.10)

        return round(u_val + u_liq + u_board + u_veto + u_ratchet, 4)

    def _calc_investor_utility(self, x: TermSheetVector, reservation_val: float) -> float:
        """
        Investor Utility Function U_I(X):
        Lower valuation (+ entry multiple), Higher liquidation preference (+),
        Board representation (+), Veto rights (+), Stronger anti-dilution protection (+).
        """
        # Valuation utility (cheaper is better for investor)
        val_ratio = reservation_val / max(x.post_money_valuation_dzd, 1.0)
        u_val = min(1.0, max(0.0, val_ratio)) * 0.35

        # Liquidation preference utility
        u_liq = min(1.0, x.liquidation_preference_multiplier / 2.0) * 0.20

        # Board representation
        u_board = (0.15 if x.board_seats_investor >= 1 else 0.0)

        # Veto rights
        u_veto = (0.15 if x.veto_rights else 0.0)

        # Anti-dilution protection
        ratchet_scores = {
            AntiDilutionRatchet.FULL_RATCHET: 0.15,
            AntiDilutionRatchet.NARROW_BASED_WEIGHTED_AVERAGE: 0.12,
            AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE: 0.09,
            AntiDilutionRatchet.NONE: 0.0,
        }
        u_ratchet = ratchet_scores.get(x.anti_dilution_ratchet, 0.09)

        return round(u_val + u_liq + u_board + u_veto + u_ratchet, 4)

    def negotiate_term_sheet(self, req: NegotiationRequest) -> NegotiationResponse:
        """
        Simulates iterative bilateral bargaining between Founder and Investor agents.
        Convergences on Nash Bargaining Solution if ZOPA exists, else triggers arbitration.
        """
        founder_res_val = req.founder_ask.post_money_valuation_dzd * 0.70
        investor_res_val = req.investor_offer.post_money_valuation_dzd * 1.30

        curr_founder = req.founder_ask.model_copy()
        curr_investor = req.investor_offer.model_copy()

        rounds: List[NegotiationRound] = []
        agreed_vector: Optional[TermSheetVector] = None
        nash_score: Optional[float] = None
        status = NegotiationStatus.IN_PROGRESS

        for r in range(1, req.max_rounds + 1):
            # Compute utilities of current proposals
            u_founder = self._calc_founder_utility(curr_investor, founder_res_val)
            u_investor = self._calc_investor_utility(curr_founder, investor_res_val)

            # Check if valuation gap has closed into ZOPA
            val_gap = abs(curr_founder.post_money_valuation_dzd - curr_investor.post_money_valuation_dzd)
            midpoint_val = (curr_founder.post_money_valuation_dzd + curr_investor.post_money_valuation_dzd) / 2.0
            gap_pct = val_gap / midpoint_val

            if gap_pct <= 0.08:
                # ZOPA reached! Converge on Nash compromise
                agreed_val = (curr_founder.post_money_valuation_dzd + curr_investor.post_money_valuation_dzd) / 2.0
                agreed_inv = (curr_founder.investment_amount_dzd + curr_investor.investment_amount_dzd) / 2.0

                agreed_vector = TermSheetVector(
                    post_money_valuation_dzd=round(agreed_val, -3),
                    investment_amount_dzd=round(agreed_inv, -3),
                    liquidation_preference_multiplier=1.0,  # Standard clean 1x non-participating
                    board_seats_investor=1,                 # 1 Observer/Director seat compromise
                    veto_rights=False,                     # Founder preserves operational freedom
                    anti_dilution_ratchet=AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE,
                    vesting_schedule_months=48,
                )
                nash_score = round(u_founder * u_investor, 4)
                status = NegotiationStatus.AGREED
                rounds.append(
                    NegotiationRound(
                        round_number=r,
                        founder_offer=curr_founder,
                        investor_offer=curr_investor,
                        founder_utility=u_founder,
                        investor_utility=u_investor,
                        concession_summary="ZOPA agreement reached via Nash Bargaining compromise along Pareto frontier.",
                    )
                )
                break

            # Iterative concessions: move proposals 30% closer
            founder_concession = val_gap * 0.25
            investor_concession = val_gap * 0.25

            curr_founder.post_money_valuation_dzd = max(
                founder_res_val,
                curr_founder.post_money_valuation_dzd - founder_concession,
            )
            curr_investor.post_money_valuation_dzd = min(
                investor_res_val,
                curr_investor.post_money_valuation_dzd + investor_concession,
            )

            rounds.append(
                NegotiationRound(
                    round_number=r,
                    founder_offer=curr_founder.model_copy(),
                    investor_offer=curr_investor.model_copy(),
                    founder_utility=u_founder,
                    investor_utility=u_investor,
                    concession_summary=(
                        f"Round {r}: Founder valuation adjusted to {curr_founder.post_money_valuation_dzd:,.0f} DZD; "
                        f"Investor offer adjusted to {curr_investor.post_money_valuation_dzd:,.0f} DZD."
                    ),
                )
            )

        # Fallback if no deal reached
        if agreed_vector is None:
            status = NegotiationStatus.DEADLOCK
            arbitration_msg = (
                "Deadlock reached outside ZOPA. Recommended Tier 1 TEE algorithmic mediation, "
                "or Tier 2 AI Judicial Tribunal review under Algerian SPAS commercial norms."
            )
            clauses = [
                "Clause: Mandatory mediation period of 14 business days before formal dispute registration.",
                "Clause: Non-binding valuation re-appraisal via certified independent accountant (Commissaire aux Comptes).",
            ]
            equity_stake = None
        else:
            arbitration_msg = None
            equity_stake = round(
                (agreed_vector.investment_amount_dzd / agreed_vector.post_money_valuation_dzd) * 100.0,
                2,
            )
            clauses = [
                f"Valuation: Agreed post-money valuation set at {agreed_vector.post_money_valuation_dzd:,.0f} DZD.",
                f"Equity Stake: Investor acquires {equity_stake:.2f}% equity stake for {agreed_vector.investment_amount_dzd:,.0f} DZD.",
                f"Liquidation Preference: {agreed_vector.liquidation_preference_multiplier}x Non-Participating.",
                "Governance: 1 Investor Board Seat with standard minority information rights.",
                f"Anti-Dilution: {agreed_vector.anti_dilution_ratchet.value}.",
                f"Vesting: {agreed_vector.vesting_schedule_months} months with 12-month cliff.",
            ]

        return NegotiationResponse(
            startup_name=req.startup_name,
            status=status,
            rounds_conducted=len(rounds),
            rounds_history=rounds,
            agreed_term_sheet=agreed_vector,
            equity_stake_pct=equity_stake,
            nash_product_score=nash_score,
            arbitration_recommendation=arbitration_msg,
            contract_clauses=clauses,
        )


dealmaker_swarm = DealmakerSwarmService()
