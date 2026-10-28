"""
TamWheel Sovereign Ethical Agentic Venture OS — Smart Escrow Vault & Dual-Key Release Engine.
Implements:
1. Multi-Key Smart Escrow Vault for venture campaigns and participatory finance.
2. Tranche lifecycle: PENDING_PROOF -> SUBMITTED (Key 1) -> AUDITED (Key 2) -> RELEASED (Key 3).
3. Automated pro-rata investor refund execution upon milestone breach or deadline default.
4. Cryptographic SHA-256 tranche and vault verification seals.
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
# ENUMS & MODELS
# =============================================================================

class TrancheStatus(str, enum.Enum):
    PENDING_PROOF = "PENDING_PROOF"
    SUBMITTED = "SUBMITTED"
    AUDITED = "AUDITED"
    RELEASED = "RELEASED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    DISPUTED = "DISPUTED"
    REFUNDED = "REFUNDED"


class TrancheVerificationType(str, enum.Enum):
    DIRECT_RELEASE = "DIRECT_RELEASE"
    ZK_TLS_ATTESTATION = "ZK_TLS_ATTESTATION"
    DUAL_AGENT_CONSENSUS = "DUAL_AGENT_CONSENSUS"
    MULTI_KEY_AUDIT = "MULTI_KEY_AUDIT"


class FounderProofPayload(BaseModel):
    proof_description: str
    proof_hash: str = Field(..., description="Git commit hash, zkTLS proof, or IPFS CID")
    deliverable_url: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    key_1_signed: bool = True


class AuditorReviewPayload(BaseModel):
    auditor_id: str
    auditor_name: str
    technical_score: float = Field(..., ge=0, le=100)
    spec_compliance_score: float = Field(..., ge=0, le=100)
    composite_score: float = Field(..., ge=0, le=100)
    approved: bool
    audit_notes: str
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    key_2_signed: bool = True


class RefereeApprovalPayload(BaseModel):
    referee_id: str
    referee_name: str = "Al-Mizan Sovereign Compliance Referee"
    release_decision: str = "APPROVED_FOR_DISBURSEMENT"
    signed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    key_3_signed: bool = True


class EscrowTranche(BaseModel):
    tranche_id: str
    tranche_number: int
    title: str
    deliverable_criteria: str
    percentage_of_total: float = Field(..., ge=0.05, le=1.0)
    amount_dzd: float = Field(..., gt=0)
    verification_type: TrancheVerificationType = TrancheVerificationType.MULTI_KEY_AUDIT
    deadline_days: int
    kpi_gate: str
    status: TrancheStatus = TrancheStatus.PENDING_PROOF
    founder_proof: Optional[FounderProofPayload] = None
    auditor_review: Optional[AuditorReviewPayload] = None
    referee_approval: Optional[RefereeApprovalPayload] = None
    released_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    tranche_seal_hash: Optional[str] = None


class InvestorPledge(BaseModel):
    investor_id: str
    investor_name: str
    amount_dzd: float = Field(..., gt=0)
    share_pct: float = Field(..., description="Fraction of total round funded by this investor")


class ProRataRefundItem(BaseModel):
    investor_id: str
    investor_name: str
    initial_pledge_dzd: float
    refund_amount_dzd: float
    pro_rata_share_pct: float


class ProRataRefundReceipt(BaseModel):
    refund_id: str
    vault_id: str
    tranche_id: str
    total_refunded_amount_dzd: float
    investor_refunds: List[ProRataRefundItem]
    reason: str
    refund_audit_hash: str
    refunded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EscrowVault(BaseModel):
    vault_id: str
    campaign_id: str
    startup_id: str
    startup_name: str
    total_raised_dzd: float
    total_locked_dzd: float
    total_released_dzd: float = 0.0
    total_refunded_dzd: float = 0.0
    tranches: List[EscrowTranche]
    investors: List[InvestorPledge]
    vault_seal_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Request schemas
class CreateVaultTrancheItem(BaseModel):
    tranche_number: int = Field(..., ge=1)
    title: str
    deliverable_criteria: str
    percentage_of_total: float = Field(..., ge=0.05, le=1.0)
    deadline_days: int = Field(..., ge=7)
    kpi_gate: str
    verification_type: TrancheVerificationType = TrancheVerificationType.MULTI_KEY_AUDIT


class CreateVaultInvestorItem(BaseModel):
    investor_id: str
    investor_name: str
    amount_dzd: float = Field(..., gt=0)


class CreateVaultRequest(BaseModel):
    campaign_id: str
    startup_id: str
    startup_name: str
    total_raised_dzd: float = Field(..., gt=0)
    tranches: List[CreateVaultTrancheItem] = Field(..., min_length=1)
    investors: List[CreateVaultInvestorItem] = Field(..., min_length=1)


class SubmitProofRequest(BaseModel):
    proof_description: str = Field(..., min_length=10)
    proof_hash: str = Field(..., min_length=16)
    deliverable_url: Optional[str] = None


class AuditorReviewRequest(BaseModel):
    auditor_id: str
    auditor_name: str
    technical_score: float = Field(..., ge=0, le=100)
    spec_compliance_score: float = Field(..., ge=0, le=100)
    approved: bool
    audit_notes: str = Field(..., min_length=5)


class RefereeReleaseRequest(BaseModel):
    referee_id: str = "REF-AL-MIZAN-001"
    referee_name: str = "Al-Mizan Compliance Referee"
    compliance_notes: str = "Verified multi-key consensus criteria satisfied."


class RefundTriggerRequest(BaseModel):
    reason: str = Field(..., min_length=5)


# =============================================================================
# SMART ESCROW VAULT ENGINE
# =============================================================================

class SmartEscrowVaultEngine:
    """
    Manages cryptographic multi-key milestone escrow vaults for participatory finance.
    Key 1: Founder deliverable proof
    Key 2: Independent auditor review
    Key 3: Platform compliance referee release
    Automated Pro-Rata refund calculator upon milestone breach.
    """

    def __init__(self) -> None:
        self._vaults: Dict[str, EscrowVault] = {}

    def create_vault(self, req: CreateVaultRequest) -> EscrowVault:
        # Validate tranche percentages sum to ~1.0 (with small float tolerance)
        total_pct = sum(t.percentage_of_total for t in req.tranches)
        if not (0.99 <= total_pct <= 1.01):
            raise ValueError(f"Tranche percentages must sum to 100% (currently {total_pct * 100:.1f}%).")

        # Validate total investor pledges match total raised
        total_pledged = sum(inv.amount_dzd for inv in req.investors)
        if abs(total_pledged - req.total_raised_dzd) > 1.0:
            raise ValueError(
                f"Total investor pledges ({total_pledged:,.2f} DZD) must match total raised ({req.total_raised_dzd:,.2f} DZD)."
            )

        now = datetime.now(timezone.utc)
        vault_seed = f"{req.campaign_id}:{req.startup_id}:{req.total_raised_dzd}:{now.isoformat()}"
        vault_seal = hashlib.sha256(vault_seed.encode("utf-8")).hexdigest()
        vault_id = f"VAULT-{req.campaign_id[:6].upper()}-{vault_seal[:8].upper()}"

        # Build investor pledges with fractional share
        pledges: List[InvestorPledge] = []
        for inv in req.investors:
            share = inv.amount_dzd / req.total_raised_dzd
            pledges.append(
                InvestorPledge(
                    investor_id=inv.investor_id,
                    investor_name=inv.investor_name,
                    amount_dzd=inv.amount_dzd,
                    share_pct=round(share, 6),
                )
            )

        # Build tranches
        built_tranches: List[EscrowTranche] = []
        for t in req.tranches:
            t_amount = round(req.total_raised_dzd * t.percentage_of_total, 2)
            t_id = f"TRNCH-{vault_id[:10]}-T{t.tranche_number}"
            built_tranches.append(
                EscrowTranche(
                    tranche_id=t_id,
                    tranche_number=t.tranche_number,
                    title=t.title,
                    deliverable_criteria=t.deliverable_criteria,
                    percentage_of_total=t.percentage_of_total,
                    amount_dzd=t_amount,
                    verification_type=t.verification_type,
                    deadline_days=t.deadline_days,
                    kpi_gate=t.kpi_gate,
                    status=TrancheStatus.PENDING_PROOF,
                )
            )

        vault = EscrowVault(
            vault_id=vault_id,
            campaign_id=req.campaign_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            total_raised_dzd=req.total_raised_dzd,
            total_locked_dzd=req.total_raised_dzd,
            total_released_dzd=0.0,
            total_refunded_dzd=0.0,
            tranches=built_tranches,
            investors=pledges,
            vault_seal_hash=vault_seal,
        )

        self._vaults[vault_id] = vault
        return vault

    def submit_founder_proof(
        self, vault_id: str, tranche_id: str, req: SubmitProofRequest
    ) -> EscrowTranche:
        vault = self._vaults.get(vault_id)
        if not vault:
            raise KeyError(f"Escrow vault '{vault_id}' not found.")

        tranche = next((t for t in vault.tranches if t.tranche_id == tranche_id), None)
        if not tranche:
            raise KeyError(f"Tranche '{tranche_id}' not found in vault.")

        if tranche.status not in (TrancheStatus.PENDING_PROOF, TrancheStatus.REVISION_REQUESTED):
            raise ValueError(f"Cannot submit proof for tranche in status '{tranche.status.value}'.")

        tranche.founder_proof = FounderProofPayload(
            proof_description=req.proof_description,
            proof_hash=req.proof_hash,
            deliverable_url=req.deliverable_url,
            key_1_signed=True,
        )
        tranche.status = TrancheStatus.SUBMITTED
        return tranche

    def verify_auditor(
        self, vault_id: str, tranche_id: str, req: AuditorReviewRequest
    ) -> EscrowTranche:
        vault = self._vaults.get(vault_id)
        if not vault:
            raise KeyError(f"Escrow vault '{vault_id}' not found.")

        tranche = next((t for t in vault.tranches if t.tranche_id == tranche_id), None)
        if not tranche:
            raise KeyError(f"Tranche '{tranche_id}' not found in vault.")

        if tranche.status != TrancheStatus.SUBMITTED:
            raise ValueError(f"Tranche must be in 'SUBMITTED' status to be audited (currently '{tranche.status.value}').")

        composite = (req.technical_score * 0.5) + (req.spec_compliance_score * 0.5)

        tranche.auditor_review = AuditorReviewPayload(
            auditor_id=req.auditor_id,
            auditor_name=req.auditor_name,
            technical_score=req.technical_score,
            spec_compliance_score=req.spec_compliance_score,
            composite_score=round(composite, 2),
            approved=req.approved,
            audit_notes=req.audit_notes,
            key_2_signed=True,
        )

        if req.approved and composite >= 70.0:
            tranche.status = TrancheStatus.AUDITED
        else:
            tranche.status = TrancheStatus.REVISION_REQUESTED

        return tranche

    def release_by_referee(
        self, vault_id: str, tranche_id: str, req: RefereeReleaseRequest
    ) -> EscrowTranche:
        vault = self._vaults.get(vault_id)
        if not vault:
            raise KeyError(f"Escrow vault '{vault_id}' not found.")

        tranche = next((t for t in vault.tranches if t.tranche_id == tranche_id), None)
        if not tranche:
            raise KeyError(f"Tranche '{tranche_id}' not found in vault.")

        if tranche.status != TrancheStatus.AUDITED:
            raise ValueError(
                f"Tranche must be verified and approved by auditor (AUDITED status) "
                f"before referee release (currently '{tranche.status.value}')."
            )

        now = datetime.now(timezone.utc)
        tranche.referee_approval = RefereeApprovalPayload(
            referee_id=req.referee_id,
            referee_name=req.referee_name,
            release_decision="APPROVED_FOR_DISBURSEMENT",
            key_3_signed=True,
        )

        # Multi-key seal computation
        assert tranche.founder_proof is not None
        assert tranche.auditor_review is not None
        seal_raw = f"{vault_id}:{tranche_id}:{tranche.founder_proof.proof_hash}:{tranche.auditor_review.auditor_id}:{req.referee_id}:{now.isoformat()}"
        tranche.tranche_seal_hash = hashlib.sha256(seal_raw.encode("utf-8")).hexdigest()

        tranche.status = TrancheStatus.RELEASED
        tranche.released_at = now

        # Update vault balance metrics
        vault.total_locked_dzd = max(0.0, vault.total_locked_dzd - tranche.amount_dzd)
        vault.total_released_dzd += tranche.amount_dzd

        return tranche

    def trigger_pro_rata_refund(
        self, vault_id: str, tranche_id: str, req: RefundTriggerRequest
    ) -> ProRataRefundReceipt:
        vault = self._vaults.get(vault_id)
        if not vault:
            raise KeyError(f"Escrow vault '{vault_id}' not found.")

        tranche = next((t for t in vault.tranches if t.tranche_id == tranche_id), None)
        if not tranche:
            raise KeyError(f"Tranche '{tranche_id}' not found in vault.")

        if tranche.status in (TrancheStatus.RELEASED, TrancheStatus.REFUNDED):
            raise ValueError(f"Cannot refund tranche in status '{tranche.status.value}'.")

        refund_amount = tranche.amount_dzd
        refund_items: List[ProRataRefundItem] = []

        for inv in vault.investors:
            inv_refund = round(refund_amount * inv.share_pct, 2)
            refund_items.append(
                ProRataRefundItem(
                    investor_id=inv.investor_id,
                    investor_name=inv.investor_name,
                    initial_pledge_dzd=inv.amount_dzd,
                    refund_amount_dzd=inv_refund,
                    pro_rata_share_pct=round(inv.share_pct * 100.0, 4),
                )
            )

        now = datetime.now(timezone.utc)
        receipt_seed = f"{vault_id}:{tranche_id}:{refund_amount}:{req.reason}:{now.isoformat()}"
        receipt_hash = hashlib.sha256(receipt_seed.encode("utf-8")).hexdigest()
        receipt_id = f"REFUND-{tranche_id[:12]}-{receipt_hash[:8].upper()}"

        tranche.status = TrancheStatus.REFUNDED
        tranche.refunded_at = now

        vault.total_locked_dzd = max(0.0, vault.total_locked_dzd - refund_amount)
        vault.total_refunded_dzd += refund_amount

        return ProRataRefundReceipt(
            refund_id=receipt_id,
            vault_id=vault_id,
            tranche_id=tranche_id,
            total_refunded_amount_dzd=refund_amount,
            investor_refunds=refund_items,
            reason=req.reason,
            refund_audit_hash=receipt_hash,
            refunded_at=now,
        )

    def get_vault(self, vault_id: str) -> Optional[EscrowVault]:
        return self._vaults.get(vault_id)

    def list_vaults(self) -> List[EscrowVault]:
        return list(self._vaults.values())


smart_escrow_engine = SmartEscrowVaultEngine()
