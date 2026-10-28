"""
TamWheel Sovereign Ethical Agentic Venture OS — Autonomous AI-to-AI Dealmaking & Due Diligence Swarm.
Bridge service module connecting to:
- app.agent.dealmakers (Al-Mu'assis, Al-Muhaqqiq, Al-Muqawil, Al-Mizan)
- app.services.maut_negotiation (Bilateral MAUT Negotiation Engine)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.agent.dealmakers import (
    dealmaker_swarm_instance,
    StartupProfileInput,
    FounderCopilotSynthesis,
    DueDiligenceSynthesis,
    MilestoneEscrowSynthesis,
    RefereeTournamentSynthesis,
    SwarmAnalysisResponse,
    TournamentTier,
    AntiDilutionRatchet,
    ValuationSanityVerdict,
)
from app.services.maut_negotiation import (
    maut_negotiation_engine,
    DealOffer,
    NegotiationStatus,
    NegotiationRound as MAUTRound,
)

logger = logging.getLogger(__name__)


# =============================================================================
# BACKWARD COMPATIBLE SCHEMAS
# =============================================================================

class TermSheetVector(BaseModel):
    post_money_valuation_dzd: float
    investment_amount_dzd: float
    liquidation_preference_multiplier: float = 1.0
    board_seats_investor: int = 1
    veto_rights: bool = False
    anti_dilution_ratchet: AntiDilutionRatchet = AntiDilutionRatchet.BROAD_BASED_WEIGHTED_AVERAGE
    vesting_schedule_months: int = 48

    @property
    def pre_money_valuation_dzd(self) -> float:
        return max(1.0, self.post_money_valuation_dzd - self.investment_amount_dzd)


class NegotiationRequest(BaseModel):
    startup_name: str
    founder_ask: TermSheetVector
    investor_offer: TermSheetVector
    founder_reservation_valuation_dzd: Optional[float] = None
    investor_reservation_valuation_dzd: Optional[float] = None
    max_rounds: int = Field(default=10, ge=1, le=10)


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
    agreed_term_sheet: Optional[TermSheetVector] = None
    equity_stake_pct: Optional[float] = None
    nash_product_score: Optional[float] = None
    arbitration_recommendation: Optional[str] = None
    contract_clauses: List[str]


# =============================================================================
# DEALMAKER SWARM SERVICE WRAPPER
# =============================================================================

class DealmakerSwarmService:
    """
    Service gateway bridging legacy API calls and routers to the hardened
    DealmakerSwarm and MAUTNegotiationEngine.
    """

    def analyze_startup(self, profile: StartupProfileInput) -> SwarmAnalysisResponse:
        """
        Executes 4-agent swarm due diligence analysis.
        """
        return dealmaker_swarm_instance.analyze_startup(profile)

    def negotiate_term_sheet(self, req: NegotiationRequest) -> NegotiationResponse:
        """
        Executes bilateral MAUT negotiation and converts result to TermSheetVector format.
        """
        founder_pre = max(1.0, req.founder_ask.post_money_valuation_dzd - req.founder_ask.investment_amount_dzd)
        investor_pre = max(1.0, req.investor_offer.post_money_valuation_dzd - req.investor_offer.investment_amount_dzd)

        founder_deal = DealOffer(
            pre_money_valuation_dzd=founder_pre,
            investment_ticket_dzd=req.founder_ask.investment_amount_dzd,
            milestone_tranches_count=3,
            governance_board_seats_investor=req.founder_ask.board_seats_investor,
            has_board_observer_rights=True,
            has_veto_rights=req.founder_ask.veto_rights,
            liquidation_preference_multiplier=req.founder_ask.liquidation_preference_multiplier,
            anti_dilution_ratchet=req.founder_ask.anti_dilution_ratchet,
            vesting_schedule_months=req.founder_ask.vesting_schedule_months,
        )

        investor_deal = DealOffer(
            pre_money_valuation_dzd=investor_pre,
            investment_ticket_dzd=req.investor_offer.investment_amount_dzd,
            milestone_tranches_count=3,
            governance_board_seats_investor=req.investor_offer.board_seats_investor,
            has_board_observer_rights=True,
            has_veto_rights=req.investor_offer.veto_rights,
            liquidation_preference_multiplier=req.investor_offer.liquidation_preference_multiplier,
            anti_dilution_ratchet=req.investor_offer.anti_dilution_ratchet,
            vesting_schedule_months=req.investor_offer.vesting_schedule_months,
        )

        founder_res_pre = None
        if req.founder_reservation_valuation_dzd:
            founder_res_pre = max(1.0, req.founder_reservation_valuation_dzd - req.founder_ask.investment_amount_dzd)

        investor_res_pre = None
        if req.investor_reservation_valuation_dzd:
            investor_res_pre = max(1.0, req.investor_reservation_valuation_dzd - req.investor_offer.investment_amount_dzd)

        session_resp = maut_negotiation_engine.negotiate(
            startup_name=req.startup_name,
            founder_ask=founder_deal,
            investor_offer=investor_deal,
            founder_res_val=founder_res_pre,
            investor_res_val=investor_res_pre,
            max_rounds=req.max_rounds,
        )

        # Convert rounds history
        legacy_rounds: List[NegotiationRound] = []
        for r in session_resp.rounds_history:
            f_vec = TermSheetVector(
                post_money_valuation_dzd=r.founder_offer.post_money_valuation_dzd,
                investment_amount_dzd=r.founder_offer.investment_ticket_dzd,
                liquidation_preference_multiplier=r.founder_offer.liquidation_preference_multiplier,
                board_seats_investor=r.founder_offer.governance_board_seats_investor,
                veto_rights=r.founder_offer.has_veto_rights,
                anti_dilution_ratchet=r.founder_offer.anti_dilution_ratchet,
                vesting_schedule_months=r.founder_offer.vesting_schedule_months,
            )
            i_vec = TermSheetVector(
                post_money_valuation_dzd=r.investor_offer.post_money_valuation_dzd,
                investment_amount_dzd=r.investor_offer.investment_ticket_dzd,
                liquidation_preference_multiplier=r.investor_offer.liquidation_preference_multiplier,
                board_seats_investor=r.investor_offer.governance_board_seats_investor,
                veto_rights=r.investor_offer.has_veto_rights,
                anti_dilution_ratchet=r.investor_offer.anti_dilution_ratchet,
                vesting_schedule_months=r.investor_offer.vesting_schedule_months,
            )
            legacy_rounds.append(
                NegotiationRound(
                    round_number=r.round_number,
                    founder_offer=f_vec,
                    investor_offer=i_vec,
                    founder_utility=r.founder_utility,
                    investor_utility=r.investor_utility,
                    concession_summary=r.concession_summary,
                )
            )

        agreed_vec = None
        if session_resp.agreed_term_sheet:
            ag = session_resp.agreed_term_sheet
            agreed_vec = TermSheetVector(
                post_money_valuation_dzd=ag.post_money_valuation_dzd,
                investment_amount_dzd=ag.investment_ticket_dzd,
                liquidation_preference_multiplier=ag.liquidation_preference_multiplier,
                board_seats_investor=ag.governance_board_seats_investor,
                veto_rights=ag.has_veto_rights,
                anti_dilution_ratchet=ag.anti_dilution_ratchet,
                vesting_schedule_months=ag.vesting_schedule_months,
            )

        return NegotiationResponse(
            startup_name=session_resp.startup_name,
            status=session_resp.status,
            rounds_conducted=session_resp.rounds_conducted,
            rounds_history=legacy_rounds,
            agreed_term_sheet=agreed_vec,
            equity_stake_pct=session_resp.equity_stake_pct,
            nash_product_score=session_resp.nash_product_score,
            arbitration_recommendation=session_resp.arbitration_recommendation,
            contract_clauses=session_resp.contract_clauses,
        )


dealmaker_swarm = DealmakerSwarmService()
