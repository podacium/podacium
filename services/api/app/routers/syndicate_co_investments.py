"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate Co-Investments Router.
Exposes endpoints for:
1. Creating side-car co-investment deals alongside lead syndicate SPVs.
2. Managing institutional fee and carry tiers (Zero-Fee/Zero-Carry Anchor LPs).
3. Expressing LP co-investment commitments and dry powder pledges.
4. Running capacity prioritization, pro-rata allocation, and iterative excess reallocation.
5. Managing syndicate closing milestones (Initial Close -> Interim -> Final Close -> Oversubscription).
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.co_investment_engine import (
    co_investment_engine,
    CoInvestmentDeal,
    CoInvestmentRequest,
    CoInvestmentMilestone,
    CoInvestmentFeeTier,
    RequestStatus,
    AllocationRunResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/syndicates/co-investments", tags=["Syndicate Co-Investment Rights & Allocations"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class CreateDealRequest(BaseModel):
    spv_id: str
    deal_name: str
    target_startup_id: str
    target_startup_name: str
    total_co_investment_capacity_dzd: float = Field(..., gt=0.0)
    soft_cap_dzd: float = Field(..., gt=0.0)
    hard_cap_dzd: float = Field(..., gt=0.0)
    initial_close_target_dzd: float = Field(..., gt=0.0)
    minimum_ticket_dzd: float = Field(default=1_000_000.0, gt=0.0)
    maximum_ticket_dzd: Optional[float] = None
    deal_id: Optional[str] = None


class SubmitCoInvestmentRequest(BaseModel):
    lp_id: str
    lp_name: str
    lp_email: str
    main_spv_commitment_dzd: float = Field(..., ge=0.0)
    requested_amount_dzd: float = Field(..., gt=0.0)
    custom_tier: Optional[CoInvestmentFeeTier] = None


class RunAllocationRequest(BaseModel):
    allow_greenshoe: bool = False


class AdvanceMilestoneRequest(BaseModel):
    target_milestone: CoInvestmentMilestone
    authorization_notes: str = ""


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/deals",
    response_model=CoInvestmentDeal,
    summary="Create Side-Car Co-Investment Deal",
    description="Creates a new co-investment vehicle with institutional capacity limits, soft/hard caps, and closing milestones alongside a lead SPV.",
)
def create_deal(
    body: CreateDealRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> CoInvestmentDeal:
    try:
        deal = co_investment_engine.create_co_investment_deal(
            spv_id=body.spv_id,
            deal_name=body.deal_name,
            target_startup_id=body.target_startup_id,
            target_startup_name=body.target_startup_name,
            total_co_investment_capacity_dzd=body.total_co_investment_capacity_dzd,
            soft_cap_dzd=body.soft_cap_dzd,
            hard_cap_dzd=body.hard_cap_dzd,
            initial_close_target_dzd=body.initial_close_target_dzd,
            minimum_ticket_dzd=body.minimum_ticket_dzd,
            maximum_ticket_dzd=body.maximum_ticket_dzd,
            deal_id=body.deal_id,
        )
        return deal
    except Exception as exc:
        logger.error(f"Failed to create co-investment deal: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deal creation failed: {str(exc)}",
        )


@router.get(
    "/deals",
    response_model=List[CoInvestmentDeal],
    summary="List All Co-Investment Deals",
    description="Lists all registered side-car co-investment opportunities and their milestone statuses.",
)
def list_deals(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> List[CoInvestmentDeal]:
    return co_investment_engine.list_deals()


@router.get(
    "/deals/{deal_id}",
    response_model=CoInvestmentDeal,
    summary="Get Co-Investment Deal Details",
    description="Retrieves co-investment deal metadata, capacity utilization, and closing milestone history.",
)
def get_deal(
    deal_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> CoInvestmentDeal:
    deal = co_investment_engine.get_deal(deal_id)
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Co-investment deal '{deal_id}' not found.",
        )
    return deal


@router.post(
    "/deals/{deal_id}/requests",
    response_model=CoInvestmentRequest,
    summary="Submit LP Co-Investment Request (EOI)",
    description="Records LP co-investment pledge. Automatically assigns institutional fee tier (Tier 1 Anchor: 0% fee/0% carry for commitments >= 10M DZD).",
)
def submit_request(
    deal_id: str,
    body: SubmitCoInvestmentRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> CoInvestmentRequest:
    try:
        req = co_investment_engine.submit_co_investment_request(
            deal_id=deal_id,
            lp_id=body.lp_id,
            lp_name=body.lp_name,
            lp_email=body.lp_email,
            main_spv_commitment_dzd=body.main_spv_commitment_dzd,
            requested_amount_dzd=body.requested_amount_dzd,
            custom_tier=body.custom_tier,
        )
        return req
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Failed to submit co-investment request: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Submission failed: {str(exc)}",
        )


@router.post(
    "/deals/{deal_id}/allocate",
    response_model=AllocationRunResult,
    summary="Execute Capacity Allocation & Excess Reallocation",
    description="Executes pro-rata entitlement allocation with dynamic water-filling excess reallocation. Advances closing milestone based on allocated capital.",
)
def run_allocation(
    deal_id: str,
    body: RunAllocationRequest = RunAllocationRequest(),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> AllocationRunResult:
    try:
        res = co_investment_engine.run_allocation(
            deal_id=deal_id,
            allow_greenshoe=body.allow_greenshoe,
        )
        return res
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Failed to run allocation: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Allocation run failed: {str(exc)}",
        )


@router.post(
    "/deals/{deal_id}/milestones/advance",
    response_model=CoInvestmentDeal,
    summary="Advance Syndicate Closing Milestone",
    description="Transitions deal through closing milestones (Initial Close -> Interim Close -> Final Close) and verifies capital deployment authorization.",
)
def advance_milestone(
    deal_id: str,
    body: AdvanceMilestoneRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> CoInvestmentDeal:
    try:
        deal = co_investment_engine.advance_closing_milestone(
            deal_id=deal_id,
            target_milestone=body.target_milestone,
            authorization_notes=body.authorization_notes,
        )
        return deal
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Failed to advance milestone: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Milestone advancement failed: {str(exc)}",
        )


@router.get(
    "/deals/{deal_id}/allocations",
    response_model=List[CoInvestmentRequest],
    summary="Get Deal Allocations",
    description="Retrieves all LP requests, scaled back amounts, and allocated amounts for a deal.",
)
def get_deal_allocations(
    deal_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> List[CoInvestmentRequest]:
    return co_investment_engine.get_deal_allocations(deal_id)


@router.get(
    "/lp/{lp_id}/allocations",
    response_model=List[CoInvestmentRequest],
    summary="Get LP Co-Investment Allocations",
    description="Retrieves all co-investment allocations across all deals for a specific LP.",
)
def get_lp_co_investments(
    lp_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> List[CoInvestmentRequest]:
    return co_investment_engine.get_lp_co_investments(lp_id)
