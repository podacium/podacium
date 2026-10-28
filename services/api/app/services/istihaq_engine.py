"""
TamWheel Sovereign Ethical Agentic Venture OS — Istihaq & S4E Bounty Escrow Engine.
Implements:
1. Proof-of-Contribution (Touiza) S4E Task Smart Escrow.
2. Dual-Signature Independent Expert Peer Review Workflow.
3. Automated BSA-AIR Equity Warrant Certificate Issuance (Law 22-09 SPAS Nominee Governance).
4. Backward-compatible dynamic Istihaq sweat-equity pool and milestone vesting calculations.
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
# ENUMS & CONSTANTS
# =============================================================================

class MilestoneType(str, enum.Enum):
    CODE_PULL_REQUEST = "CODE_PULL_REQUEST"
    SECURITY_AUDIT = "SECURITY_AUDIT"
    AI_DATASET_LABELING = "AI_DATASET_LABELING"
    ARCHITECTURE_DESIGN = "ARCHITECTURE_DESIGN"
    REGULATORY_FILING = "REGULATORY_FILING"
    GROWTH_MARKETING = "GROWTH_MARKETING"
    UI_UX_DESIGN = "UI_UX_DESIGN"
    LOCALIZATION_DARIJA = "LOCALIZATION_DARIJA"


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REJECTED = "REJECTED"


class BountyStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLAIMED = "CLAIMED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    VERIFIED = "VERIFIED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    REJECTED = "REJECTED"
    DISPUTED = "DISPUTED"


class ExpertRoleTier(str, enum.Enum):
    SENIOR_SECURITY_AUDITOR = "SENIOR_SECURITY_AUDITOR"
    PRINCIPAL_SOFTWARE_ENGINEER = "PRINCIPAL_SOFTWARE_ENGINEER"
    LEGAL_COMPLIANCE_COUNSEL = "LEGAL_COMPLIANCE_COUNSEL"
    AI_RESEARCHER = "AI_RESEARCHER"
    PRODUCT_DESIGN_LEAD = "PRODUCT_DESIGN_LEAD"
    COMMUNITY_LEAD = "COMMUNITY_LEAD"


# Minimum and maximum BSA-AIR equity percentage per challenge
MIN_BSA_AIR_EQUITY_PCT = 0.05  # 0.05%
MAX_BSA_AIR_EQUITY_PCT = 1.00  # 1.00%

# Type multipliers for sweat equity labor valuation
MILESTONE_TYPE_MULTIPLIERS = {
    MilestoneType.CODE_PULL_REQUEST: 1.25,
    MilestoneType.SECURITY_AUDIT: 1.50,
    MilestoneType.AI_DATASET_LABELING: 1.10,
    MilestoneType.ARCHITECTURE_DESIGN: 1.35,
    MilestoneType.REGULATORY_FILING: 1.30,
    MilestoneType.GROWTH_MARKETING: 1.05,
    MilestoneType.UI_UX_DESIGN: 1.20,
    MilestoneType.LOCALIZATION_DARIJA: 1.25,
}

# Number of required independent expert reviews for milestone verification
REQUIRED_EXPERT_REVIEWS = 2
MINIMUM_COMPOSITE_SCORE_FOR_PASS = 75.0


# =============================================================================
# SCHEMAS FOR PEER REVIEW & BOUNTY ESCROW
# =============================================================================

class ExpertReview(BaseModel):
    review_id: str = Field(..., description="Unique review identifier")
    reviewer_id: str = Field(..., description="Unique ID of the evaluating expert")
    reviewer_name: str = Field(..., description="Display name / professional handle of reviewer")
    role_tier: ExpertRoleTier = Field(..., description="Expertise domain tier")
    technical_score: float = Field(..., ge=0, le=100, description="Code quality / technical rigor (0-100)")
    spec_compliance_score: float = Field(..., ge=0, le=100, description="Conformance to acceptance criteria (0-100)")
    security_sharia_score: float = Field(..., ge=0, le=100, description="Security & ethical soundness (0-100)")
    documentation_score: float = Field(..., ge=0, le=100, description="Documentation & test coverage (0-100)")
    composite_score: float = Field(..., ge=0, le=100, description="Weighted composite score (0-100)")
    approved: bool = Field(..., description="Whether the expert approves milestone release")
    feedback: str = Field(..., description="Detailed technical or operational feedback")
    review_hash: str = Field(..., description="Cryptographic SHA-256 seal of the review verdict")
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountySubmission(BaseModel):
    submission_id: str
    contributor_id: str
    contributor_name: str
    git_repo_url: Optional[str] = None
    git_commit_hash: Optional[str] = None
    pull_request_url: Optional[str] = None
    proof_description: str
    proof_hash: str = Field(..., description="SHA-256 hash representing contribution proof")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviews: List[ExpertReview] = Field(default_factory=list)


class BSAAirWarrantCertificate(BaseModel):
    warrant_id: str
    warrant_hash: str = Field(..., description="SHA-256 hash of legal warrant specifications")
    bounty_id: str
    startup_id: str
    startup_name: str
    beneficiary_id: str
    beneficiary_name: str
    equity_percentage: float = Field(..., description="Earned beneficial equity % on Nominee cap table")
    shares_allocated: int
    valuation_at_issuance_dzd: float
    share_price_dzd: float
    immediate_vest_shares: int = Field(..., description="80% vested immediately on verification")
    retention_lock_shares: int = Field(..., description="20% locked for 90 days retention period")
    retention_lock_days: int = 90
    statutory_framework: str = "Algerian Commercial Code (Law 22-09 SPAS) & Nominee Beneficial Governance"
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cryptographic_seal: str


class S4EBounty(BaseModel):
    bounty_id: str
    startup_id: str
    startup_name: str
    title: str
    description: str
    acceptance_criteria: List[str]
    milestone_type: MilestoneType
    complexity_weight: float = Field(default=1.0, ge=1.0, le=10.0)
    estimated_labor_value_dzd: float = Field(..., gt=0)
    equity_allocation_pct: float = Field(..., ge=MIN_BSA_AIR_EQUITY_PCT, le=MAX_BSA_AIR_EQUITY_PCT)
    post_money_valuation_dzd: float = Field(..., gt=0)
    total_shares_pool: int = Field(default=1_000_000, gt=0)
    status: BountyStatus = BountyStatus.OPEN
    contributor_id: Optional[str] = None
    contributor_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    claimed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    submission: Optional[BountySubmission] = None
    warrant: Optional[BSAAirWarrantCertificate] = None
    escrow_deposit_locked: bool = True


# =============================================================================
# BACKWARD COMPATIBLE SCHEMAS (FOR LEGACY CALCULATE_ISTIHAQ COMPATIBILITY)
# =============================================================================

class MilestoneDeliverable(BaseModel):
    milestone_id: str
    contributor_id: str
    title: str
    milestone_type: MilestoneType = MilestoneType.CODE_PULL_REQUEST
    complexity_weight: float = Field(default=1.0, ge=0.5, le=10.0, description="Effort multiplier (1-10)")
    estimated_labor_value_dzd: float = Field(..., gt=0, description="Estimated fiat market value in DZD")
    verification_status: VerificationStatus = VerificationStatus.PENDING_REVIEW
    proof_hash: Optional[str] = Field(None, description="Cryptographic SHA256 proof or Git commit hash")
    evaluator_signature: Optional[str] = Field(None, description="Signature from validator oracle")


class MilestoneAllocation(BaseModel):
    milestone_id: str
    title: str
    milestone_type: MilestoneType
    status: VerificationStatus
    labor_value_dzd: float
    adjusted_labor_value_dzd: float
    shares_allocated: int
    vested_shares: int
    unvested_shares: int
    equity_pct: float
    proof_hash: Optional[str] = None


class LegalWarrantPayload(BaseModel):
    warrant_id: str
    warrant_hash: str
    startup_id: str
    total_shares: int
    beneficial_holder: str
    jurisdiction: str = "Algeria — Commercial Code (Law 22-09 SPAS Nominee)"
    conversion_trigger: str = "Primary Round Close or Liquidity Event"
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IstihaqCalculationRequest(BaseModel):
    startup_id: str
    total_tokenized_shares: int = Field(1_000_000, gt=0)
    post_money_valuation_dzd: float = Field(..., gt=0)
    sweat_equity_pool_pct: float = Field(10.0, ge=1.0, le=30.0, description="Pool allocated for Istihaq sweat equity (1-30%)")
    allocated_shares_so_far: int = Field(0, ge=0)
    milestones: List[MilestoneDeliverable] = Field(default_factory=list)


class IstihaqCalculationResult(BaseModel):
    startup_id: str
    post_money_valuation_dzd: float
    share_price_dzd: float
    total_shares_allocated: int
    equity_percentage_earned: float
    monetary_equivalent_dzd: float
    vested_shares: int
    unvested_shares: int
    sweat_equity_pool_cap_shares: int
    remaining_pool_shares: int
    pool_utilization_pct: float
    milestones_summary: List[MilestoneAllocation]
    warrant_issuance: Optional[LegalWarrantPayload] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# S4E BOUNTY ESCROW & ISTIHAQ ENGINE
# =============================================================================

class IstihaqEngine:
    """
    Istihaq (Proof-of-Touiza) & S4E Bounty Smart Escrow Engine.
    Handles:
    - Bounty creation, lock, claim, submission, and peer-review escrow lifecycle.
    - Dual-signature milestone review with independent scoring.
    - Automated BSA-AIR warrant generation.
    - Legacy cap-table milestone calculation.
    """

    def __init__(self) -> None:
        self._bounties: Dict[str, S4EBounty] = {}

    def create_bounty(
        self,
        startup_id: str,
        startup_name: str,
        title: str,
        description: str,
        acceptance_criteria: List[str],
        milestone_type: MilestoneType,
        estimated_labor_value_dzd: float,
        equity_allocation_pct: float,
        post_money_valuation_dzd: float,
        complexity_weight: float = 1.0,
        total_shares_pool: int = 1_000_000,
    ) -> S4EBounty:
        """
        Creates and locks a new S4E challenge escrow with BSA-AIR equity allocation.
        Enforces 0.05% - 1.0% bounds.
        """
        if not (MIN_BSA_AIR_EQUITY_PCT <= equity_allocation_pct <= MAX_BSA_AIR_EQUITY_PCT):
            raise ValueError(
                f"BSA-AIR equity allocation ({equity_allocation_pct}%) must be between "
                f"{MIN_BSA_AIR_EQUITY_PCT}% and {MAX_BSA_AIR_EQUITY_PCT}%."
            )

        if estimated_labor_value_dzd <= 0:
            raise ValueError("Estimated labor value must be strictly positive.")

        if post_money_valuation_dzd <= 0:
            raise ValueError("Post-money valuation must be strictly positive.")

        hasher = hashlib.sha256()
        hasher.update(f"{startup_id}:{title}:{datetime.now(timezone.utc).isoformat()}".encode("utf-8"))
        bounty_id = f"BNTY-{startup_id[:6].upper()}-{hasher.hexdigest()[:8].upper()}"

        bounty = S4EBounty(
            bounty_id=bounty_id,
            startup_id=startup_id,
            startup_name=startup_name,
            title=title,
            description=description,
            acceptance_criteria=acceptance_criteria,
            milestone_type=milestone_type,
            complexity_weight=complexity_weight,
            estimated_labor_value_dzd=estimated_labor_value_dzd,
            equity_allocation_pct=equity_allocation_pct,
            post_money_valuation_dzd=post_money_valuation_dzd,
            total_shares_pool=total_shares_pool,
            status=BountyStatus.OPEN,
            escrow_deposit_locked=True,
        )

        self._bounties[bounty_id] = bounty
        return bounty

    def claim_bounty(
        self,
        bounty_id: str,
        contributor_id: str,
        contributor_name: str,
    ) -> S4EBounty:
        """
        Assigns an open bounty to a contributor.
        """
        bounty = self._bounties.get(bounty_id)
        if not bounty:
            raise KeyError(f"Bounty {bounty_id} not found.")

        if bounty.status != BountyStatus.OPEN:
            raise ValueError(f"Cannot claim bounty in state '{bounty.status.value}'. Must be OPEN.")

        bounty.contributor_id = contributor_id
        bounty.contributor_name = contributor_name
        bounty.status = BountyStatus.CLAIMED
        bounty.claimed_at = datetime.now(timezone.utc)
        return bounty

    def submit_bounty(
        self,
        bounty_id: str,
        contributor_id: str,
        contributor_name: str,
        proof_description: str,
        git_repo_url: Optional[str] = None,
        git_commit_hash: Optional[str] = None,
        pull_request_url: Optional[str] = None,
    ) -> S4EBounty:
        """
        Submits work deliverable with proof hash for peer review.
        """
        bounty = self._bounties.get(bounty_id)
        if not bounty:
            raise KeyError(f"Bounty {bounty_id} not found.")

        if bounty.status not in (BountyStatus.CLAIMED, BountyStatus.IN_PROGRESS, BountyStatus.REVISION_REQUESTED):
            raise ValueError(f"Cannot submit bounty in state '{bounty.status.value}'.")

        if bounty.contributor_id and bounty.contributor_id != contributor_id:
            raise PermissionError("Only the assigned contributor may submit this bounty.")

        now = datetime.now(timezone.utc)
        proof_raw = f"{bounty_id}:{contributor_id}:{git_commit_hash or ''}:{proof_description}:{now.isoformat()}"
        proof_hash = hashlib.sha256(proof_raw.encode("utf-8")).hexdigest()
        submission_id = f"SUB-{bounty_id[:10]}-{proof_hash[:8]}"

        bounty.submission = BountySubmission(
            submission_id=submission_id,
            contributor_id=contributor_id,
            contributor_name=contributor_name,
            git_repo_url=git_repo_url,
            git_commit_hash=git_commit_hash,
            pull_request_url=pull_request_url,
            proof_description=proof_description,
            proof_hash=proof_hash,
            submitted_at=now,
            reviews=[],
        )
        bounty.status = BountyStatus.SUBMITTED
        bounty.submitted_at = now
        return bounty

    def review_bounty(
        self,
        bounty_id: str,
        reviewer_id: str,
        reviewer_name: str,
        role_tier: ExpertRoleTier,
        technical_score: float,
        spec_compliance_score: float,
        security_sharia_score: float,
        documentation_score: float,
        approved: bool,
        feedback: str,
    ) -> S4EBounty:
        """
        Submits an independent expert review.
        Requires 2 independent reviews with approved=True and avg score >= 75 for VERIFIED transition.
        """
        bounty = self._bounties.get(bounty_id)
        if not bounty:
            raise KeyError(f"Bounty {bounty_id} not found.")

        if bounty.status not in (BountyStatus.SUBMITTED, BountyStatus.UNDER_REVIEW):
            raise ValueError(f"Bounty cannot be reviewed in status '{bounty.status.value}'.")

        if not bounty.submission:
            raise ValueError("No submission deliverable found for this bounty.")

        # Check self-review
        if reviewer_id == bounty.submission.contributor_id:
            raise ValueError("Contributor cannot review their own submission.")

        # Check duplicate reviewer
        for existing_rev in bounty.submission.reviews:
            if existing_rev.reviewer_id == reviewer_id:
                raise ValueError("Reviewer has already submitted a verdict for this bounty.")

        # Compute weighted composite score: 35% tech, 35% spec, 15% security, 15% docs
        composite_score = round(
            (technical_score * 0.35)
            + (spec_compliance_score * 0.35)
            + (security_sharia_score * 0.15)
            + (documentation_score * 0.15),
            2,
        )

        now = datetime.now(timezone.utc)
        rev_raw = f"{bounty_id}:{reviewer_id}:{composite_score}:{approved}:{now.isoformat()}"
        review_hash = hashlib.sha256(rev_raw.encode("utf-8")).hexdigest()
        review_id = f"REV-{bounty_id[:8]}-{review_hash[:8]}"

        review = ExpertReview(
            review_id=review_id,
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            role_tier=role_tier,
            technical_score=technical_score,
            spec_compliance_score=spec_compliance_score,
            security_sharia_score=security_sharia_score,
            documentation_score=documentation_score,
            composite_score=composite_score,
            approved=approved,
            feedback=feedback,
            review_hash=review_hash,
            reviewed_at=now,
        )

        bounty.submission.reviews.append(review)

        # Check if rejected or revision requested
        if not approved:
            if composite_score < 50.0:
                bounty.status = BountyStatus.REJECTED
            else:
                bounty.status = BountyStatus.REVISION_REQUESTED
            return bounty

        # Count approved reviews
        approved_reviews = [r for r in bounty.submission.reviews if r.approved]

        if len(approved_reviews) < REQUIRED_EXPERT_REVIEWS:
            bounty.status = BountyStatus.UNDER_REVIEW
        else:
            # 2 reviews reached! Check composite average
            avg_score = sum(r.composite_score for r in approved_reviews) / len(approved_reviews)
            if avg_score >= MINIMUM_COMPOSITE_SCORE_FOR_PASS:
                bounty.status = BountyStatus.VERIFIED
                bounty.verified_at = now
                # Automatically issue BSA-AIR Warrant Certificate!
                self._issue_warrant_certificate(bounty)
            else:
                bounty.status = BountyStatus.REVISION_REQUESTED

        return bounty

    def _issue_warrant_certificate(self, bounty: S4EBounty) -> None:
        """
        Mints and cryptographically seals a BSA-AIR equity warrant certificate upon milestone verification.
        """
        assert bounty.submission is not None
        share_price = bounty.post_money_valuation_dzd / bounty.total_shares_pool
        shares_allocated = int(bounty.total_shares_pool * (bounty.equity_allocation_pct / 100.0))
        immediate_vest = int(shares_allocated * 0.80)
        retention_lock = shares_allocated - immediate_vest

        now = datetime.now(timezone.utc)
        warrant_id = f"WRNT-BSA-AIR-{bounty.startup_id[:6].upper()}-{hashlib.md5(f'{bounty.bounty_id}:{bounty.submission.contributor_id}'.encode()).hexdigest()[:8].upper()}"

        warrant_data = {
            "warrant_id": warrant_id,
            "bounty_id": bounty.bounty_id,
            "startup_id": bounty.startup_id,
            "beneficiary_id": bounty.submission.contributor_id,
            "equity_percentage": bounty.equity_allocation_pct,
            "shares_allocated": shares_allocated,
            "share_price_dzd": round(share_price, 4),
            "issued_at": now.isoformat(),
        }

        canonical_bytes = json.dumps(warrant_data, sort_keys=True).encode("utf-8")
        warrant_hash = hashlib.sha256(canonical_bytes).hexdigest()

        seal_hasher = hashlib.sha256()
        seal_hasher.update(f"{warrant_id}:{warrant_hash}:TAMWHEEL_BSA_AIR_SPAS_SEAL".encode("utf-8"))
        seal = seal_hasher.hexdigest()

        bounty.warrant = BSAAirWarrantCertificate(
            warrant_id=warrant_id,
            warrant_hash=warrant_hash,
            bounty_id=bounty.bounty_id,
            startup_id=bounty.startup_id,
            startup_name=bounty.startup_name,
            beneficiary_id=bounty.submission.contributor_id,
            beneficiary_name=bounty.submission.contributor_name,
            equity_percentage=round(bounty.equity_allocation_pct, 4),
            shares_allocated=shares_allocated,
            valuation_at_issuance_dzd=bounty.post_money_valuation_dzd,
            share_price_dzd=round(share_price, 4),
            immediate_vest_shares=immediate_vest,
            retention_lock_shares=retention_lock,
            retention_lock_days=90,
            issued_at=now,
            cryptographic_seal=seal,
        )

    def get_bounty(self, bounty_id: str) -> Optional[S4EBounty]:
        return self._bounties.get(bounty_id)

    def list_bounties(
        self,
        status: Optional[BountyStatus] = None,
        startup_id: Optional[str] = None,
        category: Optional[MilestoneType] = None,
    ) -> List[S4EBounty]:
        results = list(self._bounties.values())
        if status:
            results = [b for b in results if b.status == status]
        if startup_id:
            results = [b for b in results if b.startup_id == startup_id]
        if category:
            results = [b for b in results if b.milestone_type == category]
        return results

    # =========================================================================
    # BACKWARD COMPATIBLE METHOD FOR EXISTING ISTIHAQ CALCULATIONS
    # =========================================================================

    def calculate_istihaq(self, req: IstihaqCalculationRequest) -> IstihaqCalculationResult:
        """
        Calculates dynamic Istihaq proof-of-contribution sweat equity vesting.
        Links verified milestone deliverables to tokenized cap-table shares and produces legal warrants.
        """
        share_price = req.post_money_valuation_dzd / req.total_tokenized_shares
        pool_cap_shares = int(req.total_tokenized_shares * (req.sweat_equity_pool_pct / 100.0))
        remaining_pool_shares = max(0, pool_cap_shares - req.allocated_shares_so_far)

        allocations: List[MilestoneAllocation] = []
        total_new_shares = 0
        total_vested_shares = 0
        total_unvested_shares = 0
        total_labor_value_dzd = 0.0

        for m in req.milestones:
            multiplier = MILESTONE_TYPE_MULTIPLIERS.get(m.milestone_type, 1.0)
            complexity_factor = 1.0 + ((m.complexity_weight - 1.0) * 0.08)
            adjusted_value = m.estimated_labor_value_dzd * multiplier * complexity_factor

            # Only VERIFIED deliverables convert into equity shares
            if m.verification_status == VerificationStatus.VERIFIED:
                shares = int(adjusted_value / share_price) if share_price > 0 else 0

                # Check pool bounds
                if total_new_shares + shares > remaining_pool_shares:
                    shares = max(0, remaining_pool_shares - total_new_shares)

                # Milestone completion vests 80% immediately, 20% subject to 90-day retention lock
                vested = int(shares * 0.80)
                unvested = shares - vested

                total_new_shares += shares
                total_vested_shares += vested
                total_unvested_shares += unvested
                total_labor_value_dzd += adjusted_value
                eq_pct = (shares / req.total_tokenized_shares) * 100.0
            else:
                shares = 0
                vested = 0
                unvested = 0
                eq_pct = 0.0

            allocations.append(
                MilestoneAllocation(
                    milestone_id=m.milestone_id,
                    title=m.title,
                    milestone_type=m.milestone_type,
                    status=m.verification_status,
                    labor_value_dzd=round(m.estimated_labor_value_dzd, 2),
                    adjusted_labor_value_dzd=round(adjusted_value, 2),
                    shares_allocated=shares,
                    vested_shares=vested,
                    unvested_shares=unvested,
                    equity_pct=round(eq_pct, 4),
                    proof_hash=m.proof_hash,
                )
            )

        updated_remaining_pool = max(0, remaining_pool_shares - total_new_shares)
        pool_utilization = (
            ((req.allocated_shares_so_far + total_new_shares) / pool_cap_shares) * 100.0
            if pool_cap_shares > 0
            else 0.0
        )
        total_equity_pct = (total_new_shares / req.total_tokenized_shares) * 100.0
        monetary_equivalent = total_new_shares * share_price

        # Generate cryptographic legal warrant payload
        beneficiary = req.milestones[0].contributor_id if req.milestones else "ANONYMOUS_CONTRIBUTOR"
        warrant_id = f"WRNT-{req.startup_id[:8].upper()}-{hashlib.md5(f'{beneficiary}:{total_new_shares}'.encode()).hexdigest()[:8].upper()}"

        hasher = hashlib.sha256()
        hasher.update(f"{warrant_id}:{req.startup_id}:{beneficiary}:{total_new_shares}:{total_equity_pct}".encode())
        warrant_hash = hasher.hexdigest()

        warrant_issuance = LegalWarrantPayload(
            warrant_id=warrant_id,
            warrant_hash=warrant_hash,
            startup_id=req.startup_id,
            total_shares=total_new_shares,
            beneficial_holder=beneficiary,
        )

        return IstihaqCalculationResult(
            startup_id=req.startup_id,
            post_money_valuation_dzd=req.post_money_valuation_dzd,
            share_price_dzd=round(share_price, 4),
            total_shares_allocated=total_new_shares,
            equity_percentage_earned=round(total_equity_pct, 4),
            monetary_equivalent_dzd=round(monetary_equivalent, 2),
            vested_shares=total_vested_shares,
            unvested_shares=total_unvested_shares,
            sweat_equity_pool_cap_shares=pool_cap_shares,
            remaining_pool_shares=updated_remaining_pool,
            pool_utilization_pct=round(pool_utilization, 2),
            milestones_summary=allocations,
            warrant_issuance=warrant_issuance,
        )


istihaq_engine = IstihaqEngine()
