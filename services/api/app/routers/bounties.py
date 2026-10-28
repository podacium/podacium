"""
TamWheel Sovereign Ethical Agentic Venture OS — S4E Bounty Escrow & Istihaq Router.
Exposes endpoints for:
1. Listing and searching Proof-of-Touiza bounties (`GET /bounties`)
2. Creating and locking new S4E bounties with BSA-AIR equity allocations (`POST /bounties`)
3. Fetching single bounty details with reviews and submission (`GET /bounties/{bounty_id}`)
4. Claiming an open bounty (`POST /bounties/{bounty_id}/claim`)
5. Submitting completed work and proof artifacts (`POST /bounties/{bounty_id}/submit`)
6. Submitting dual-signature independent expert reviews (`POST /bounties/{bounty_id}/review`)
7. Retrieving issued BSA-AIR legal warrant certificates (`GET /bounties/{bounty_id}/warrant`)
"""

from __future__ import annotations

import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.istihaq_engine import (
    istihaq_engine,
    S4EBounty,
    BountyStatus,
    MilestoneType,
    ExpertRoleTier,
    BSAAirWarrantCertificate,
    MIN_BSA_AIR_EQUITY_PCT,
    MAX_BSA_AIR_EQUITY_PCT,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bounties", tags=["S4E Bounties & Istihaq Escrow"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class CreateBountyRequest(BaseModel):
    startup_id: str = Field(..., description="Unique startup identifier")
    startup_name: str = Field(..., description="Startup legal or trade name")
    title: str = Field(..., min_length=5, max_length=150, description="Title of the technical/business challenge")
    description: str = Field(..., min_length=20, description="Full specification and scope of work")
    acceptance_criteria: List[str] = Field(..., min_length=1, description="List of verifiable delivery criteria")
    milestone_type: MilestoneType = Field(default=MilestoneType.CODE_PULL_REQUEST)
    complexity_weight: float = Field(default=1.0, ge=1.0, le=10.0, description="Effort rating (1-10)")
    estimated_labor_value_dzd: float = Field(..., gt=0, description="Estimated market compensation in DZD")
    equity_allocation_pct: float = Field(
        ...,
        ge=MIN_BSA_AIR_EQUITY_PCT,
        le=MAX_BSA_AIR_EQUITY_PCT,
        description="BSA-AIR equity allocation percentage (0.05% - 1.00%)",
    )
    post_money_valuation_dzd: float = Field(..., gt=0, description="Current post-money implied valuation in DZD")
    total_shares_pool: int = Field(default=1_000_000, gt=0, description="Total tokenized share capital base")


class ClaimBountyRequest(BaseModel):
    contributor_id: str = Field(..., description="Claimant user ID")
    contributor_name: str = Field(..., description="Claimant display name / professional handle")


class SubmitBountyRequest(BaseModel):
    contributor_id: str = Field(..., description="Contributor user ID")
    contributor_name: str = Field(..., description="Contributor name")
    proof_description: str = Field(..., min_length=10, description="Summary of work completed and verification instructions")
    git_repo_url: Optional[str] = Field(None, description="Repository URL (e.g. GitHub/GitLab)")
    git_commit_hash: Optional[str] = Field(None, description="Target commit SHA")
    pull_request_url: Optional[str] = Field(None, description="Pull Request URL")


class ReviewBountyRequest(BaseModel):
    reviewer_id: str = Field(..., description="Unique ID of the evaluating expert")
    reviewer_name: str = Field(..., description="Name / handle of reviewer")
    role_tier: ExpertRoleTier = Field(..., description="Expertise domain tier")
    technical_score: float = Field(..., ge=0, le=100, description="Code quality / engineering rigor (0-100)")
    spec_compliance_score: float = Field(..., ge=0, le=100, description="Fulfillment of acceptance criteria (0-100)")
    security_sharia_score: float = Field(..., ge=0, le=100, description="Security posture and ethical compliance (0-100)")
    documentation_score: float = Field(..., ge=0, le=100, description="Documentation clarity and test suite (0-100)")
    approved: bool = Field(..., description="Pass/Fail decision on milestone payout")
    feedback: str = Field(..., min_length=5, description="Constructive feedback or remediation notes")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get(
    "",
    response_model=List[S4EBounty],
    summary="List all S4E Proof-of-Touiza bounties",
    description="Retrieve all active or historical bounties with optional filtering by status, startup, or category.",
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None, description="Filter by escrow status"),
    startup_id: Optional[str] = Query(None, description="Filter by startup ID"),
    category: Optional[MilestoneType] = Query(None, description="Filter by milestone category"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[S4EBounty]:
    """List S4E bounties from smart escrow."""
    return istihaq_engine.list_bounties(status=status, startup_id=startup_id, category=category)


@router.post(
    "",
    response_model=S4EBounty,
    status_code=status.HTTP_201_CREATED,
    summary="Create and lock a new S4E challenge escrow",
    description="Startups post a technical, legal, marketing, or design challenge locked with BSA-AIR equity warrants (0.05% - 1.0%).",
)
async def create_bounty(
    req: CreateBountyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> S4EBounty:
    """Create a new S4E bounty."""
    try:
        return istihaq_engine.create_bounty(
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            title=req.title,
            description=req.description,
            acceptance_criteria=req.acceptance_criteria,
            milestone_type=req.milestone_type,
            complexity_weight=req.complexity_weight,
            estimated_labor_value_dzd=req.estimated_labor_value_dzd,
            equity_allocation_pct=req.equity_allocation_pct,
            post_money_valuation_dzd=req.post_money_valuation_dzd,
            total_shares_pool=req.total_shares_pool,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating bounty: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bounty escrow: {str(e)}",
        )


@router.get(
    "/{bounty_id}",
    response_model=S4EBounty,
    summary="Get single bounty escrow details",
    description="Retrieve full details for an S4E bounty including submission state, peer reviews, and issued warrant.",
)
async def get_bounty_by_id(
    bounty_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> S4EBounty:
    """Fetch bounty by ID."""
    bounty = istihaq_engine.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bounty '{bounty_id}' not found.",
        )
    return bounty


@router.post(
    "/{bounty_id}/claim",
    response_model=S4EBounty,
    summary="Claim an open bounty challenge",
    description="Contributor claims an OPEN bounty to begin work.",
)
async def claim_bounty(
    bounty_id: str,
    req: ClaimBountyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> S4EBounty:
    """Claim open bounty."""
    try:
        return istihaq_engine.claim_bounty(
            bounty_id=bounty_id,
            contributor_id=req.contributor_id,
            contributor_name=req.contributor_name,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bounty '{bounty_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{bounty_id}/submit",
    response_model=S4EBounty,
    summary="Submit deliverable for peer review",
    description="Contributor submits completed milestone deliverable with cryptographic proof hash for dual-signature peer review.",
)
async def submit_bounty(
    bounty_id: str,
    req: SubmitBountyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> S4EBounty:
    """Submit bounty deliverable."""
    try:
        return istihaq_engine.submit_bounty(
            bounty_id=bounty_id,
            contributor_id=req.contributor_id,
            contributor_name=req.contributor_name,
            proof_description=req.proof_description,
            git_repo_url=req.git_repo_url,
            git_commit_hash=req.git_commit_hash,
            pull_request_url=req.pull_request_url,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bounty '{bounty_id}' not found.")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{bounty_id}/review",
    response_model=S4EBounty,
    summary="Submit expert peer review verdict",
    description=(
        "Independent domain expert submits review. Requires 2 independent reviews "
        "with approval and average composite score >= 75 to verify and unlock BSA-AIR warrant certificate."
    ),
)
async def review_bounty(
    bounty_id: str,
    req: ReviewBountyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> S4EBounty:
    """Submit expert peer review."""
    try:
        return istihaq_engine.review_bounty(
            bounty_id=bounty_id,
            reviewer_id=req.reviewer_id,
            reviewer_name=req.reviewer_name,
            role_tier=req.role_tier,
            technical_score=req.technical_score,
            spec_compliance_score=req.spec_compliance_score,
            security_sharia_score=req.security_sharia_score,
            documentation_score=req.documentation_score,
            approved=req.approved,
            feedback=req.feedback,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bounty '{bounty_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{bounty_id}/warrant",
    response_model=BSAAirWarrantCertificate,
    summary="Get verified BSA-AIR equity warrant certificate",
    description="Retrieve the cryptographically sealed BSA-AIR warrant certificate issued upon 2-peer verification.",
)
async def get_bounty_warrant(
    bounty_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> BSAAirWarrantCertificate:
    """Get issued warrant certificate."""
    bounty = istihaq_engine.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bounty '{bounty_id}' not found.")
    if not bounty.warrant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bounty '{bounty_id}' has not been verified yet (status: {bounty.status.value}). Warrant not issued.",
        )
    return bounty.warrant
