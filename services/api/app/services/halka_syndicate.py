"""
TamWheel Sovereign Ethical Agentic Venture OS — "Halka" Family Syndicates (حلقة العائلة) Engine.
Implements Section 11.3 & 12 of the Master Blueprint:
1. Culturally tailored Algerian kinship syndicates with multi-signature governance.
2. Designated "Amin" (الأمين) elder role with final commitment release sign-off
   to preserve family dignity (Nif) and avoid familial financial disgrace (Hchouma).
3. Youth Diligence ("Al-Shabab") + Family Contributor co-signing workflow.
4. Sovereign Haptic Khatm (digital wax seal) ceremony payload with 72-hour cooling-off window.
"""

from __future__ import annotations

import enum
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class FamilyRole(str, enum.Enum):
    AMIN = "AMIN"                           # Designated trusted elder / final multi-sig veto
    RESEARCHER_YOUTH = "RESEARCHER_YOUTH"   # Tech-savvy young family researcher
    FAMILY_CONTRIBUTOR = "FAMILY_CONTRIBUTOR" # Family member contributing savings


class HalkaStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    DISSOLVED = "DISSOLVED"


class ProposalApprovalState(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_CO_SIGNATURES = "PENDING_CO_SIGNATURES"
    PENDING_AMIN_APPROVAL = "PENDING_AMIN_APPROVAL"
    APPROVED_BY_AMIN = "APPROVED_BY_AMIN"
    EXECUTED_WITH_KHATM = "EXECUTED_WITH_KHATM"
    REJECTED_BY_AMIN = "REJECTED_BY_AMIN"


# =============================================================================
# SCHEMAS & DATA MODELS
# =============================================================================

class HalkaMember(BaseModel):
    member_id: str
    full_name: str
    kinship_relation: str # e.g. "Elder Uncle / العم الأكبر", "Cousin / ابن العم"
    role: FamilyRole
    pledged_savings_dzd: float = Field(default=0.0, ge=0.0)
    is_amin: bool = False
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HapticKhatmPayload(BaseModel):
    seal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ceremony_name: str = "Haptic Khatm Sovereign Wax Stamp"
    acoustic_tone_frequency_hz: float = 432.0   # Resonant grounding frequency
    tactile_haptic_pulse_ms: int = 80           # 80ms tactile pulse
    mandatory_reflection_seconds: int = 3       # 3-second ethical reflection slider
    cooling_off_window_hours: int = 72          # 72-hour cooling-off window to prevent Hchouma
    digital_wax_seal_hash: str
    blessing_invocation: str = "بارَكَ اللهُ لكُم في هذا الاستثمار وحَفِظَ مالَ وعِزَّةَ العائلة"
    stamped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HalkaInvestmentProposal(BaseModel):
    proposal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    halka_id: str
    startup_id: str
    startup_name: str
    investment_amount_dzd: float = Field(..., gt=0)
    proposed_by_member_id: str
    proposed_by_name: str
    diligence_summary: str
    state: ProposalApprovalState = ProposalApprovalState.PENDING_CO_SIGNATURES
    co_signatures_collected: List[str] = Field(default_factory=list)
    required_co_signatures: int = Field(default=2, ge=1)
    amin_signature: Optional[str] = None
    amin_signed_at: Optional[datetime] = None
    amin_rejection_reason: Optional[str] = None
    khatm_ceremony: Optional[HapticKhatmPayload] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HalkaFamilySyndicate(BaseModel):
    halka_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_name: str
    wilaya: int = Field(default=19, ge=1, le=58)
    designated_amin_id: str
    designated_amin_name: str
    members: List[HalkaMember] = Field(default_factory=list)
    total_vault_balance_dzd: float = Field(default=0.0, ge=0.0)
    proposals: List[HalkaInvestmentProposal] = Field(default_factory=list)
    status: HalkaStatus = HalkaStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field
    @computed_field
    @property
    def member_count(self) -> int:
        return len(self.members)


# =============================================================================
# HALKA FAMILY SYNDICATE ENGINE
# =============================================================================

class HalkaFamilySyndicateEngine:
    """
    Engine for multi-generational Algerian family syndicates:
    - Kinship member management with designated Amin elder role.
    - Multi-signature proposal workflow.
    - Amin final authorization gate protecting family dignity (Nif) and honor.
    - Haptic Khatm ceremony generation.
    """

    def __init__(self):
        self._halkas: Dict[str, HalkaFamilySyndicate] = {}
        self._proposals: Dict[str, HalkaInvestmentProposal] = {}

    def create_halka(
        self,
        family_name: str,
        wilaya: int,
        amin_id: str,
        amin_name: str,
        amin_relation: str = "Elder Uncle (العم الأكبر)",
        initial_vault_deposit_dzd: float = 0.0,
    ) -> HalkaFamilySyndicate:
        """
        Creates a new Halka Family Syndicate with the designated Amin elder.
        """
        amin_member = HalkaMember(
            member_id=amin_id,
            full_name=amin_name,
            kinship_relation=amin_relation,
            role=FamilyRole.AMIN,
            pledged_savings_dzd=initial_vault_deposit_dzd,
            is_amin=True,
        )

        halka = HalkaFamilySyndicate(
            family_name=family_name,
            wilaya=wilaya,
            designated_amin_id=amin_id,
            designated_amin_name=amin_name,
            members=[amin_member],
            total_vault_balance_dzd=initial_vault_deposit_dzd,
        )
        self._halkas[halka.halka_id] = halka
        logger.info(f"Registered Halka Family Syndicate '{family_name}' with Amin {amin_name}")
        return halka

    def get_halka(self, halka_id: str) -> Optional[HalkaFamilySyndicate]:
        return self._halkas.get(halka_id)

    def add_family_member(
        self,
        halka_id: str,
        member_id: str,
        full_name: str,
        kinship_relation: str,
        role: FamilyRole = FamilyRole.FAMILY_CONTRIBUTOR,
        pledge_dzd: float = 0.0,
    ) -> HalkaFamilySyndicate:
        """
        Adds a family member to the Halka.
        """
        halka = self._halkas.get(halka_id)
        if not halka:
            raise ValueError(f"Halka '{halka_id}' not found.")

        if any(m.member_id == member_id for m in halka.members):
            raise ValueError(f"Family member '{member_id}' is already registered in this Halka.")

        member = HalkaMember(
            member_id=member_id,
            full_name=full_name,
            kinship_relation=kinship_relation,
            role=role,
            pledged_savings_dzd=pledge_dzd,
            is_amin=(role == FamilyRole.AMIN),
        )
        halka.members.append(member)
        halka.total_vault_balance_dzd += pledge_dzd
        return halka

    def create_proposal(
        self,
        halka_id: str,
        startup_id: str,
        startup_name: str,
        investment_amount_dzd: float,
        proposer_id: str,
        proposer_name: str,
        diligence_summary: str,
        required_co_signatures: int = 2,
    ) -> HalkaInvestmentProposal:
        """
        Creates an investment proposal requiring family co-signatures
        before being submitted to the Amin elder.
        """
        halka = self._halkas.get(halka_id)
        if not halka:
            raise ValueError(f"Halka '{halka_id}' not found.")

        if investment_amount_dzd > halka.total_vault_balance_dzd:
            raise ValueError(
                f"Proposed investment of {investment_amount_dzd:,.0f} DZD exceeds Halka vault balance "
                f"of {halka.total_vault_balance_dzd:,.0f} DZD."
            )

        proposal = HalkaInvestmentProposal(
            halka_id=halka_id,
            startup_id=startup_id,
            startup_name=startup_name,
            investment_amount_dzd=investment_amount_dzd,
            proposed_by_member_id=proposer_id,
            proposed_by_name=proposer_name,
            diligence_summary=diligence_summary,
            required_co_signatures=required_co_signatures,
            state=ProposalApprovalState.PENDING_CO_SIGNATURES,
            co_signatures_collected=[proposer_id],  # Proposer automatically co-signs
        )

        # If only 1 co-signature was required, immediately escalate to Amin
        if len(proposal.co_signatures_collected) >= proposal.required_co_signatures:
            proposal.state = ProposalApprovalState.PENDING_AMIN_APPROVAL

        halka.proposals.append(proposal)
        self._proposals[proposal.proposal_id] = proposal
        return proposal

    def co_sign_proposal(self, proposal_id: str, member_id: str) -> HalkaInvestmentProposal:
        """
        Records a family member's co-signature on the proposal.
        """
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.state != ProposalApprovalState.PENDING_CO_SIGNATURES:
            raise ValueError(
                f"Proposal is not currently accepting co-signatures (State: {proposal.state.value})."
            )

        halka = self._halkas.get(proposal.halka_id)
        if not halka or not any(m.member_id == member_id for m in halka.members):
            raise ValueError(f"Member '{member_id}' is not part of this Halka.")

        if member_id in proposal.co_signatures_collected:
            raise ValueError("Member has already co-signed this proposal.")

        proposal.co_signatures_collected.append(member_id)

        # Check if threshold reached for Amin escalation
        if len(proposal.co_signatures_collected) >= proposal.required_co_signatures:
            proposal.state = ProposalApprovalState.PENDING_AMIN_APPROVAL
            logger.info(
                f"Proposal {proposal_id} reached {len(proposal.co_signatures_collected)} co-signatures. "
                f"Escalated to Amin {halka.designated_amin_name} for final review."
            )

        return proposal

    def amin_decision(
        self,
        proposal_id: str,
        amin_id: str,
        approve: bool,
        signature_token: Optional[str] = None,
        rejection_reason: Optional[str] = None,
    ) -> HalkaInvestmentProposal:
        """
        The critical multi-signature gate: The designated Amin elder approves or rejects
        the investment release to protect family honor (Nif) and avoid financial disgrace (Hchouma).
        """
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.state != ProposalApprovalState.PENDING_AMIN_APPROVAL:
            raise ValueError(
                f"Proposal is not pending Amin review (Current State: {proposal.state.value})."
            )

        halka = self._halkas.get(proposal.halka_id)
        if not halka or halka.designated_amin_id != amin_id:
            raise ValueError(
                f"Unauthorized: Only designated Amin '{halka.designated_amin_name if halka else 'Unknown'}' "
                "holds the authority to sign off on family capital release."
            )

        if not approve:
            proposal.state = ProposalApprovalState.REJECTED_BY_AMIN
            proposal.amin_rejection_reason = rejection_reason or "Vetoed by Amin to protect family capital."
            logger.warning(
                f"Amin {halka.designated_amin_name} vetoed proposal {proposal_id} for startup {proposal.startup_name}: "
                f"{proposal.amin_rejection_reason}"
            )
            return proposal

        # Approve and execute Haptic Khatm ceremony
        sig = signature_token or f"AMIN-SIG-{uuid.uuid4().hex[:12].upper()}"
        seal_content = f"{proposal.proposal_id}:{halka.halka_id}:{amin_id}:{proposal.investment_amount_dzd}"
        seal_hash = f"0x{hashlib.sha256(seal_content.encode()).hexdigest()[:32]}"

        khatm = HapticKhatmPayload(
            digital_wax_seal_hash=seal_hash,
            cooling_off_window_hours=72,
        )

        proposal.amin_signature = sig
        proposal.amin_signed_at = datetime.now(timezone.utc)
        proposal.khatm_ceremony = khatm
        proposal.state = ProposalApprovalState.EXECUTED_WITH_KHATM

        # Deduct from Halka vault
        halka.total_vault_balance_dzd = max(0.0, halka.total_vault_balance_dzd - proposal.investment_amount_dzd)

        logger.info(
            f"Amin {halka.designated_amin_name} signed off on {proposal.investment_amount_dzd:,.0f} DZD "
            f"for {proposal.startup_name}. Haptic Khatm ceremony generated with 72h cooling-off window."
        )
        return proposal


halka_syndicate_engine = HalkaFamilySyndicateEngine()
