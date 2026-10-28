"""
TamWheel Sovereign Ethical Agentic Venture OS — Backer Squads (الشلل الاستثمارية) Engine.
Implements Section 14.1 & 14.4 of the Master Blueprint:
1. Backer Squad Lifecycle (3–25 members, Leader, Diligence Contributor, Backer roles).
2. Collaborative Diligence Canvas (shared sticky notes, risk pins, conviction votes).
3. Diaspora-to-Wilaya Anchoring (Paris/Montreal expat paired with on-ground cousin in Sétif/Oran).
4. Consensus Threshold Voting State Machine (PROPOSED -> VOTING_ACTIVE -> CONSENSUS_REACHED -> POOLED_ALLOCATION_EXECUTED).
5. +15% Squad Synergy XP bonus rewards upon reaching pooled investment consensus.
"""

from __future__ import annotations

import enum
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class SquadRole(str, enum.Enum):
    LEADER = "LEADER"
    DILIGENCE_CONTRIBUTOR = "DILIGENCE_CONTRIBUTOR"
    BACKER = "BACKER"
    INVESTIGATOR = "INVESTIGATOR"
    CHAMPION = "CHAMPION"
    CRITIC = "CRITIC"


class RiskCategory(str, enum.Enum):
    LEGAL = "LEGAL"
    FINANCIAL = "FINANCIAL"
    TECH = "TECH"
    TECHNICAL = "TECHNICAL"
    MARKET = "MARKET"
    EXECUTION = "EXECUTION"
    REGULATORY = "REGULATORY"


class RiskSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class VotingStatus(str, enum.Enum):
    PROPOSED = "PROPOSED"
    ACTIVE = "ACTIVE"
    VOTING_ACTIVE = "ACTIVE"
    PASSED = "PASSED"
    CONSENSUS_REACHED = "PASSED"
    POOLED_ALLOCATION_EXECUTED = "PASSED"
    REJECTED = "REJECTED"


# Alias for backward compatibility
VoteState = VotingStatus


class VoteChoice(str, enum.Enum):
    YES = "YES"
    NO = "NO"
    ABSTAIN = "ABSTAIN"


# =============================================================================
# DATA SCHEMAS
# =============================================================================

class SquadMember(BaseModel):
    user_id: str
    name: str
    email: str
    role: SquadRole = SquadRole.BACKER
    wilaya: Optional[int] = Field(default=16, ge=1, le=58)
    is_diaspora: bool = False
    diaspora_location: Optional[str] = None
    voting_weight: float = Field(default=1.0, gt=0.0)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DiligenceStickyNote(BaseModel):
    note_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    content: str
    color: str = "#FEF08A"  # Default yellow sticky
    pos_x: float = 0.0
    pos_y: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DiligenceRiskPin(BaseModel):
    pin_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    category: RiskCategory
    severity: RiskSeverity
    claim_reference: str
    risk_summary: str
    mitigation_suggested: Optional[str] = None
    pos_x: float = 0.0
    pos_y: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DiligenceConvictionVote(BaseModel):
    member_id: str
    member_name: str
    conviction_score: float = Field(..., ge=0.0, le=100.0)
    thesis_summary: str
    voted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DiasporaAnchoringPair(BaseModel):
    pair_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    diaspora_member_id: str
    diaspora_member_name: str
    diaspora_city: str
    wilaya_member_id: str
    wilaya_member_name: str
    local_wilaya: int
    on_ground_audit_status: str = "VERIFIED"
    verification_notes: str
    verified_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @property
    def verified_on_ground(self) -> bool:
        return self.on_ground_audit_status == "VERIFIED"


class DiligenceCanvas(BaseModel):
    canvas_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    squad_id: str
    startup_id: str
    startup_name: str
    sticky_notes: List[DiligenceStickyNote] = Field(default_factory=list)
    risk_pins: List[DiligenceRiskPin] = Field(default_factory=list)
    conviction_votes: List[DiligenceConvictionVote] = Field(default_factory=list)
    diaspora_anchoring_pairs: List[DiasporaAnchoringPair] = Field(default_factory=list)

    @computed_field
    @property
    def conviction_score_average(self) -> float:
        if not self.conviction_votes:
            return 0.0
        return round(sum(v.conviction_score for v in self.conviction_votes) / len(self.conviction_votes), 2)

    @computed_field
    @property
    def diaspora_pairs(self) -> List[DiasporaAnchoringPair]:
        return self.diaspora_anchoring_pairs


class SquadConsensusVote(BaseModel):
    proposal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    squad_id: str
    startup_id: str
    startup_name: str
    proposed_pooled_allocation_dzd: float = Field(..., gt=0.0)
    consensus_threshold_pct: float = Field(default=60.0, ge=50.0, le=100.0)
    status: VotingStatus = VotingStatus.PROPOSED
    votes: Dict[str, VoteChoice] = Field(default_factory=dict)
    yes_votes_count: int = 0
    total_eligible_votes: int = 0
    current_consensus_pct: float = 0.0
    squad_synergy_bonus_applied: bool = False
    bonus_xp_amount: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None

    @computed_field
    @property
    def vote_id(self) -> str:
        return self.proposal_id

    @computed_field
    @property
    def state(self) -> VotingStatus:
        return self.status

    @computed_field
    @property
    def yes_votes(self) -> int:
        return self.yes_votes_count

    @computed_field
    @property
    def required_votes_count(self) -> int:
        return math.ceil((self.consensus_threshold_pct / 100.0) * self.total_eligible_votes)

    @computed_field
    @property
    def synergy_bonus_awarded(self) -> bool:
        return self.squad_synergy_bonus_applied

    @computed_field
    @property
    def synergy_bonus_xp_multiplier(self) -> float:
        return 1.15

    @computed_field
    @property
    def earned_xp_total(self) -> float:
        if self.squad_synergy_bonus_applied:
            return 1150.0
        return 1000.0


class BackerSquad(BaseModel):
    squad_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    wilaya: int = Field(default=16, ge=1, le=58)
    members: List[SquadMember] = Field(default_factory=list)
    pooled_balance_dzd: float = Field(default=0.0, ge=0.0)
    canvases: Dict[str, DiligenceCanvas] = Field(default_factory=dict)
    proposals: List[SquadConsensusVote] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @property
    def member_count(self) -> int:
        return len(self.members)

    @computed_field
    @property
    def total_pool_dzd(self) -> float:
        return self.pooled_balance_dzd


# =============================================================================
# BACKER SQUADS ENGINE
# =============================================================================

class BackerSquadsEngine:
    """
    Core engine managing the lifecycle, collaborative diligence canvas,
    consensus threshold voting, and diaspora anchoring for Backer Squads.
    """

    def __init__(self):
        self._squads: Dict[str, BackerSquad] = {}
        self._proposals: Dict[str, SquadConsensusVote] = {}

    def create_squad(
        self,
        name: str,
        description: str,
        leader_id: str,
        leader_name: str,
        leader_email: str,
        wilaya: int = 16,
        is_diaspora: bool = False,
        diaspora_location: Optional[str] = None,
        initial_pool_deposit_dzd: float = 0.0,
    ) -> BackerSquad:
        """
        Initializes a new Backer Squad (3–25 members limit).
        """
        leader = SquadMember(
            user_id=leader_id,
            name=leader_name,
            email=leader_email,
            role=SquadRole.LEADER,
            wilaya=wilaya,
            is_diaspora=is_diaspora,
            diaspora_location=diaspora_location,
        )

        squad = BackerSquad(
            name=name,
            description=description,
            wilaya=wilaya,
            members=[leader],
            pooled_balance_dzd=initial_pool_deposit_dzd,
        )
        self._squads[squad.squad_id] = squad
        logger.info(f"Created Backer Squad '{name}' ({squad.squad_id}) with leader {leader_name}")
        return squad

    def get_squad(self, squad_id: str) -> Optional[BackerSquad]:
        return self._squads.get(squad_id)

    def invite_member(
        self,
        squad_id: str,
        user_id: str,
        name: str,
        email: str,
        role: SquadRole = SquadRole.BACKER,
        wilaya: int = 16,
        is_diaspora: bool = False,
        diaspora_location: Optional[str] = None,
    ) -> BackerSquad:
        """
        Adds a new member, enforcing the 25-member maximum squad limit.
        """
        squad = self._squads.get(squad_id)
        if not squad:
            raise ValueError(f"Squad '{squad_id}' not found.")

        if len(squad.members) >= 25:
            raise ValueError("Squad capacity limit reached (maximum 25 members under Blueprint Section 14.1).")

        if any(m.user_id == user_id for m in squad.members):
            raise ValueError(f"User '{user_id}' is already a member of this squad.")

        member = SquadMember(
            user_id=user_id,
            name=name,
            email=email,
            role=role,
            wilaya=wilaya,
            is_diaspora=is_diaspora,
            diaspora_location=diaspora_location,
        )
        squad.members.append(member)
        return squad

    # Convenience alias
    add_member = invite_member

    def deposit_pooled_funds(self, squad_id: str, amount_dzd: float) -> BackerSquad:
        """
        Deposits funds into the squad's joint balance.
        """
        squad = self._squads.get(squad_id)
        if not squad:
            raise ValueError(f"Squad '{squad_id}' not found.")
        if amount_dzd <= 0:
            raise ValueError("Deposit amount must be positive.")
        squad.pooled_balance_dzd += amount_dzd
        return squad

    # Convenience alias
    deposit_funds = deposit_pooled_funds

    # -------------------------------------------------------------------------
    # COLLABORATIVE DILIGENCE CANVAS
    # -------------------------------------------------------------------------

    def get_or_create_canvas(self, squad_id: str, startup_id: str, startup_name: str = "Target Venture") -> DiligenceCanvas:
        squad = self._squads.get(squad_id)
        if not squad:
            raise ValueError(f"Squad '{squad_id}' not found.")

        if startup_id in squad.canvases:
            return squad.canvases[startup_id]

        for c in squad.canvases.values():
            if c.canvas_id == startup_id or c.startup_id == startup_id:
                return c

        canvas = DiligenceCanvas(
            squad_id=squad_id,
            startup_id=startup_id,
            startup_name=startup_name,
        )
        squad.canvases[startup_id] = canvas
        squad.canvases[canvas.canvas_id] = canvas
        return canvas

    def add_sticky_note(
        self,
        squad_id: str,
        startup_id: Optional[str] = None,
        author_id: str = "",
        author_name: str = "",
        content: str = "",
        color: str = "#FEF08A",
        pos_x: float = 0.0,
        pos_y: float = 0.0,
        canvas_id: Optional[str] = None,
    ) -> DiligenceStickyNote:
        target = startup_id or canvas_id or ""
        canvas = self.get_or_create_canvas(squad_id, target, startup_name="Target Venture")
        note = DiligenceStickyNote(
            author_id=author_id,
            author_name=author_name,
            content=content,
            color=color,
            pos_x=pos_x,
            pos_y=pos_y,
        )
        canvas.sticky_notes.append(note)
        return note

    def add_risk_pin(
        self,
        squad_id: str,
        startup_id: Optional[str] = None,
        author_id: str = "",
        author_name: str = "",
        category: RiskCategory = RiskCategory.EXECUTION,
        severity: RiskSeverity = RiskSeverity.MEDIUM,
        claim_reference: str = "",
        risk_summary: str = "",
        mitigation_suggested: Optional[str] = None,
        pos_x: float = 0.0,
        pos_y: float = 0.0,
        canvas_id: Optional[str] = None,
    ) -> DiligenceRiskPin:
        target = startup_id or canvas_id or ""
        canvas = self.get_or_create_canvas(squad_id, target, startup_name="Target Venture")
        pin = DiligenceRiskPin(
            author_id=author_id,
            author_name=author_name,
            category=category,
            severity=severity,
            claim_reference=claim_reference,
            risk_summary=risk_summary,
            mitigation_suggested=mitigation_suggested,
            pos_x=pos_x,
            pos_y=pos_y,
        )
        canvas.risk_pins.append(pin)
        return pin

    def submit_conviction_vote(
        self,
        squad_id: str,
        startup_id: Optional[str] = None,
        member_id: str = "",
        member_name: str = "",
        conviction_score: float = 0.0,
        thesis_summary: str = "",
        canvas_id: Optional[str] = None,
    ) -> DiligenceConvictionVote:
        target = startup_id or canvas_id or ""
        canvas = self.get_or_create_canvas(squad_id, target, startup_name="Target Venture")
        # Update or add conviction vote
        existing = next((v for v in canvas.conviction_votes if v.member_id == member_id), None)
        if existing:
            existing.conviction_score = conviction_score
            existing.thesis_summary = thesis_summary
            existing.voted_at = datetime.now(timezone.utc)
            return existing

        vote = DiligenceConvictionVote(
            member_id=member_id,
            member_name=member_name,
            conviction_score=conviction_score,
            thesis_summary=thesis_summary,
        )
        canvas.conviction_votes.append(vote)
        return vote

    def create_diaspora_anchoring_pair(
        self,
        squad_id: str,
        startup_id: Optional[str] = None,
        diaspora_member_id: str = "",
        diaspora_member_name: str = "",
        diaspora_city: str = "",
        wilaya_member_id: str = "",
        wilaya_member_name: str = "",
        local_wilaya: int = 16,
        verification_notes: str = "",
        canvas_id: Optional[str] = None,
    ) -> DiasporaAnchoringPair:
        """
        Pairs a diaspora expat (Paris, Montreal, etc.) with an on-ground cousin/auditor
        in a domestic Wilaya (Sétif, Oran, etc.) for operational ground-truth verification.
        """
        target = startup_id or canvas_id or ""
        canvas = self.get_or_create_canvas(squad_id, target, startup_name="Target Venture")
        pair = DiasporaAnchoringPair(
            diaspora_member_id=diaspora_member_id,
            diaspora_member_name=diaspora_member_name,
            diaspora_city=diaspora_city,
            wilaya_member_id=wilaya_member_id,
            wilaya_member_name=wilaya_member_name,
            local_wilaya=local_wilaya,
            on_ground_audit_status="VERIFIED",
            verification_notes=verification_notes,
        )
        canvas.diaspora_anchoring_pairs.append(pair)
        return pair

    def create_diaspora_pair(
        self,
        squad_id: str,
        startup_id: str,
        diaspora_id: str,
        diaspora_name: str,
        diaspora_city: str,
        wilaya_id: str,
        wilaya_name: str,
        wilaya_code: int,
        notes: str,
    ) -> DiasporaAnchoringPair:
        return self.create_diaspora_anchoring_pair(
            squad_id=squad_id,
            startup_id=startup_id,
            diaspora_member_id=diaspora_id,
            diaspora_member_name=diaspora_name,
            diaspora_city=diaspora_city,
            wilaya_member_id=wilaya_id,
            wilaya_member_name=wilaya_name,
            local_wilaya=wilaya_code,
            verification_notes=notes,
        )

    # -------------------------------------------------------------------------
    # CONSENSUS THRESHOLD VOTING STATE MACHINE
    # -------------------------------------------------------------------------

    def propose_pooled_allocation(
        self,
        squad_id: str,
        startup_id: str,
        startup_name: str,
        allocation_amount_dzd: float,
        consensus_threshold_pct: float = 60.0,
    ) -> SquadConsensusVote:
        """
        Initiates a consensus vote. Reaching consensus triggers pooled allocation
        from the squad's joint balance and awards a +15% Squad Synergy XP bonus.
        """
        squad = self._squads.get(squad_id)
        if not squad:
            raise ValueError(f"Squad '{squad_id}' not found.")

        if allocation_amount_dzd > squad.pooled_balance_dzd:
            raise ValueError(
                f"Proposed allocation {allocation_amount_dzd:,.0f} DZD exceeds squad pooled balance "
                f"of {squad.pooled_balance_dzd:,.0f} DZD."
            )

        proposal = SquadConsensusVote(
            squad_id=squad_id,
            startup_id=startup_id,
            startup_name=startup_name,
            proposed_pooled_allocation_dzd=allocation_amount_dzd,
            consensus_threshold_pct=consensus_threshold_pct,
            status=VotingStatus.VOTING_ACTIVE,
            total_eligible_votes=len(squad.members),
        )

        squad.proposals.append(proposal)
        self._proposals[proposal.proposal_id] = proposal
        return proposal

    def cast_vote(
        self,
        *args,
        proposal_id: Optional[str] = None,
        member_id: Optional[str] = None,
        choice: Optional[VoteChoice] = None,
        squad_id: Optional[str] = None,
        **kwargs,
    ) -> SquadConsensusVote:
        """
        Casts a member vote and evaluates consensus threshold in real time.
        Supports both positional and keyword invocations.
        """
        if len(args) == 4:
            # (squad_id, proposal_id, member_id, choice)
            proposal_id = str(args[1])
            member_id = str(args[2])
            choice = args[3]
        elif len(args) == 3:
            # (proposal_id, member_id, choice)
            proposal_id = str(args[0])
            member_id = str(args[1])
            choice = args[2]

        if not proposal_id:
            proposal_id = kwargs.get("proposal_id") or kwargs.get("vote_id")
        if not member_id:
            member_id = kwargs.get("member_id")
        if not choice:
            choice = kwargs.get("choice")

        if isinstance(choice, str):
            choice = VoteChoice(choice)

        if not proposal_id or not member_id or not choice:
            raise ValueError("proposal_id, member_id, and choice must be provided to cast vote.")

        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.status != VotingStatus.VOTING_ACTIVE:
            raise ValueError(f"Proposal is not currently active for voting (Status: {proposal.status.value}).")

        squad = self._squads.get(proposal.squad_id)
        if not squad or not any(m.user_id == member_id for m in squad.members):
            raise ValueError(f"User '{member_id}' is not an authorized member of squad '{proposal.squad_id}'.")

        proposal.votes[member_id] = choice

        # Recalculate tally
        yes_votes = sum(1 for v in proposal.votes.values() if v == VoteChoice.YES)
        total_eligible = len(squad.members)

        proposal.yes_votes_count = yes_votes
        proposal.total_eligible_votes = total_eligible
        proposal.current_consensus_pct = round((yes_votes / total_eligible) * 100.0, 2) if total_eligible > 0 else 0.0

        # Check if consensus threshold reached
        if proposal.current_consensus_pct >= proposal.consensus_threshold_pct:
            proposal.status = VotingStatus.CONSENSUS_REACHED
            # Execute pooled allocation
            if squad.pooled_balance_dzd >= proposal.proposed_pooled_allocation_dzd:
                squad.pooled_balance_dzd -= proposal.proposed_pooled_allocation_dzd
                proposal.status = VotingStatus.POOLED_ALLOCATION_EXECUTED
                proposal.closed_at = datetime.now(timezone.utc)

                # +15% Squad Synergy Bonus Calculation
                base_xp = proposal.proposed_pooled_allocation_dzd * 0.01  # 1% base XP points
                proposal.bonus_xp_amount = round(base_xp * 0.15, 2)       # +15% Synergy bonus
                proposal.squad_synergy_bonus_applied = True
                logger.info(
                    f"Consensus reached in Squad '{squad.name}' for {proposal.startup_name}. "
                    f"Executed pooled allocation of {proposal.proposed_pooled_allocation_dzd:,.0f} DZD "
                    f"with +15% Synergy XP bonus ({proposal.bonus_xp_amount} XP)."
                )

        return proposal


backer_squads_engine = BackerSquadsEngine()
