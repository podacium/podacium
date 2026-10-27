from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Request
from typing import List, Optional, Dict, Any
import logging

from app.core.auth import get_current_active_user
from app.core.rbac import require_permissions
from app.core.prisma import prisma
from app.schemas.freelancing import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProposalCreate,
    ProposalResponse,
    ContractCreate,
    ContractResponse,
    DeliveryCreate,
    DeliveryResponse,
    FreelancerSearch,
    ProjectSearch,
    ProjectStatus,
    ProposalStatus,
    ContractStatus,
    PublicProjectSearch,
    PublicFreelancerSearch,
    PublicProjectResponse,
    PublicFreelancerResponse,
    DisputeCreate,
    DisputeResponse,
    ReviewCreate,
    ReviewUpdate,
    ReviewResponse,
    AppealCreate,
    AppealResponse,
    RatingSummaryResponse,
    ContractReviewStatusResponse,
    ReviewReportCreate,
    ReviewReportResponse,
)
from app.services.freelancing_service import FreelanceService
from app.services.skill_matching_service import SkillMatchingService
from app.services.milestone_service import MilestoneService
from pydantic import BaseModel, Field

router = APIRouter(prefix="/hub", tags=["freelance"])
logger = logging.getLogger(__name__)

# ======================
# PROJECT ENDPOINTS
# ======================


@router.get("/projects", response_model=Dict[str, Any])
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    skills: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    project_status: Optional[ProjectStatus] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_active_user),
):
    """List all projects with filtering"""
    try:
        search_params = ProjectSearch(
            skip=skip, limit=limit, skills=skills, search=search, status=project_status
        )
        result = await FreelanceService.list_projects(
            search_params=search_params, user_id=current_user.id
        )
        return result
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch projects",
        )


@router.post(
    "/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED
)
async def create_project(
    project_data: ProjectCreate, current_user: dict = Depends(get_current_active_user)
):
    """Create a new project (client only)"""
    try:
        project = await FreelanceService.create_project(
            project_data=project_data, client_id=current_user.id
        )
        return project
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project",
        )


@router.get("/projects/{project_id}", response_model=Dict[str, Any])
async def get_project(
    project_id: int,
    include_suggested: bool = Query(False, description="Include suggested freelancers"),
    suggested_limit: int = Query(
        5, ge=1, le=20, description="Max suggested freelancers"
    ),
    current_user: dict = Depends(get_current_active_user),
):
    """Get project details with optional freelancer suggestions"""
    try:
        logger.info(f"API: Getting project {project_id} for user {current_user.id}")
        project = await FreelanceService.get_project(
            project_id=project_id, user_id=current_user.id
        )

        if include_suggested:
            suggested = await SkillMatchingService.get_suggested_freelancers(
                project_id=project_id,
                limit=suggested_limit,
            )
            project["suggested_freelancers"] = suggested.get("freelancers", [])

        return project
    except ValueError as e:
        logger.warning(f"Project not found: {project_id} - {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching project {project_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project: {str(e)}",
        )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update project (owner only)"""
    try:
        project = await FreelanceService.update_project(
            project_id=project_id, project_data=project_data, user_id=current_user.id
        )
        return project
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project",
        )


@router.get("/projects/{project_id}/proposals", response_model=Dict[str, Any])
async def get_project_proposals(
    project_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get proposals for a project (owner only)"""
    try:
        proposals = await FreelanceService.get_project_proposals(
            project_id=project_id,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
        )
        return proposals
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching proposals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch proposals",
        )


# ======================
# PROPOSAL ENDPOINTS
# ======================


@router.post(
    "/projects/{project_id}/proposals",
    response_model=ProposalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_proposal(
    project_id: int,
    proposal_data: ProposalCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Submit a proposal for a project (freelancer only)"""
    try:
        proposal = await FreelanceService.submit_proposal(
            project_id=project_id,
            proposal_data=proposal_data,
            freelancer_id=current_user.id,
        )
        return proposal
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting proposal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit proposal",
        )


@router.get("/proposals", response_model=Dict[str, Any])
async def get_user_proposals(
    proposal_status: Optional[ProposalStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get proposals submitted by the current user"""
    try:
        proposals = await FreelanceService.get_user_proposals(
            user_id=current_user.id,
            status=proposal_status,
            skip=skip,
            limit=limit,
        )
        return proposals
    except Exception as e:
        logger.error(f"Error fetching user proposals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch proposals",
        )


@router.put("/proposals/{proposal_id}/accept", response_model=ContractResponse)
async def accept_proposal(
    proposal_id: int,
    contract_data: Optional[ContractCreate] = Body(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Accept a proposal (project owner only) - Creates contract"""
    try:
        contract = await FreelanceService.accept_proposal(
            proposal_id=proposal_id,
            client_id=current_user.id,
            contract_data=contract_data,
        )
        return contract
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error accepting proposal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept proposal",
        )


@router.post("/proposals/{proposal_id}/withdraw", response_model=Dict[str, Any])
async def withdraw_proposal(
    proposal_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Withdraw a pending proposal (freelancer only)"""
    try:
        result = await FreelanceService.withdraw_proposal(
            proposal_id=proposal_id, freelancer_id=current_user.id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error withdrawing proposal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to withdraw proposal",
        )


@router.put("/proposals/{proposal_id}/reject")
async def reject_proposal(
    proposal_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Reject a proposal (project owner only)"""
    try:
        await FreelanceService.reject_proposal(
            proposal_id=proposal_id, client_id=current_user.id
        )
        return {"message": "Proposal rejected"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error rejecting proposal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject proposal",
        )


# ======================
# CONTRACT ENDPOINTS
# ======================


@router.get("/contracts", response_model=Dict[str, Any])
async def get_user_contracts(
    contract_status: Optional[ContractStatus] = Query(None, alias="status"),
    role: Optional[str] = Query(None, pattern="^(freelancer|client)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get contracts for current user (both as freelancer and client)"""
    try:
        contracts = await FreelanceService.get_user_contracts(
            user_id=current_user.id,
            status=contract_status,
            role=role,
            skip=skip,
            limit=limit,
        )
        return contracts
    except Exception as e:
        logger.error(f"Error fetching contracts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contracts",
        )


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get contract details"""
    try:
        contract = await FreelanceService.get_contract(
            contract_id=contract_id, user_id=current_user.id
        )
        return contract
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contract",
        )


@router.post(
    "/contracts/{contract_id}/deliver",
    response_model=DeliveryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_delivery(
    contract_id: int,
    delivery_data: DeliveryCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Submit delivery for a contract (freelancer only)"""
    try:
        logger.info(
            f"Submitting delivery for contract {contract_id} by user {current_user.id}"
        )
        logger.info(f"Delivery data: {delivery_data}")

        delivery = await FreelanceService.submit_delivery(
            contract_id=contract_id,
            delivery_data=delivery_data,
            freelancer_id=current_user.id,
        )

        logger.info(f"Delivery created successfully: {delivery['id']}")
        return delivery

    except ValueError as e:
        logger.warning(f"Validation error submitting delivery: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting delivery: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit delivery: {str(e)}",
        )


@router.put("/contracts/{contract_id}/complete", response_model=ContractResponse)
async def complete_contract(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Mark contract as completed (client only)"""
    try:
        contract = await FreelanceService.complete_contract(
            contract_id=contract_id, client_id=current_user.id
        )
        return contract
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete contract",
        )


@router.put("/contracts/{contract_id}/cancel", response_model=ContractResponse)
async def cancel_contract(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Cancel a contract (both parties)"""
    try:
        contract = await FreelanceService.cancel_contract(
            contract_id=contract_id, user_id=current_user.id
        )
        return contract
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling contract: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel contract",
        )


# ======================
# MILESTONE ENDPOINTS
# ======================


class MilestoneRevisionBody(BaseModel):
    criteria: List[str] = Field(default_factory=list)
    revision_notes: str


class MilestoneDisputeBody(BaseModel):
    reason: str
    dispute_type: str = "QUALITY_ISSUE"


@router.get("/contracts/{contract_id}/milestones", response_model=List[Dict[str, Any]])
async def get_contract_milestones(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get all milestones for a contract."""
    try:
        return await MilestoneService.get_contract_milestones(
            contract_id=contract_id, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching contract milestones: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch milestones",
        )


@router.get(
    "/contracts/{contract_id}/milestones/{milestone_id}",
    response_model=Dict[str, Any],
)
async def get_contract_milestone(
    contract_id: int,
    milestone_id: int,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a single milestone for a contract."""
    try:
        return await MilestoneService.get_milestone(
            milestone_id=milestone_id, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching milestone {milestone_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch milestone",
        )


@router.post(
    "/contracts/{contract_id}/milestones/{milestone_id}/approve",
    response_model=Dict[str, Any],
)
async def approve_milestone_delivery(
    contract_id: int,
    milestone_id: int,
    request: Request,
    current_user: dict = Depends(get_current_active_user),
):
    """Approve a milestone delivery and release escrow (client only)."""
    step_up_token = (
        request.headers.get("X-Step-Up-Token")
        or request.headers.get("X-2FA-Token")
        or request.headers.get("X-WebAuthn-Step-Up")
    )
    if step_up_token and len(step_up_token) < 20:
        step_up_token = None
    try:
        return await MilestoneService.approve_delivery(
            milestone_id=milestone_id,
            client_id=current_user.id,
            step_up_token=step_up_token,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving milestone {milestone_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve milestone",
        )


@router.post(
    "/contracts/{contract_id}/milestones/{milestone_id}/fund",
    response_model=Dict[str, Any],
)
async def fund_contract_milestone(
    contract_id: int,
    milestone_id: int,
    current_user: dict = Depends(get_current_active_user),
):
    """Atomically fund a milestone escrow hold (client only)."""
    try:
        return await MilestoneService.fund_milestone(
            milestone_id=milestone_id, client_id=current_user.id
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error funding milestone {milestone_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fund milestone",
        )


@router.post(
    "/contracts/{contract_id}/milestones/{milestone_id}/request-revision",
    response_model=Dict[str, Any],
)
async def request_milestone_revision(
    contract_id: int,
    milestone_id: int,
    body: MilestoneRevisionBody,
    current_user: dict = Depends(get_current_active_user),
):
    """Request structured revisions for a delivered milestone (client only)."""
    try:
        return await MilestoneService.request_milestone_revision(
            milestone_id=milestone_id,
            client_id=current_user.id,
            criteria=body.criteria,
            revision_notes=body.revision_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error requesting milestone revision: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request revision",
        )


@router.post(
    "/contracts/{contract_id}/milestones/{milestone_id}/dispute",
    response_model=Dict[str, Any],
)
async def dispute_contract_milestone(
    contract_id: int,
    milestone_id: int,
    body: MilestoneDisputeBody,
    current_user: dict = Depends(get_current_active_user),
):
    """Dispute a delivered milestone (client or freelancer)."""
    try:
        return await MilestoneService.dispute_milestone(
            milestone_id=milestone_id,
            reason=body.reason,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error disputing milestone: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to dispute milestone",
        )


# ======================
# DISPUTE ENDPOINTS
# ======================


@router.post(
    "/contracts/{contract_id}/dispute",
    response_model=DisputeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contract_dispute(
    contract_id: int,
    dispute_data: DisputeCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Open a dispute for a contract"""
    try:
        dispute = await FreelanceService.create_dispute(
            contract_id=contract_id, dispute_data=dispute_data, user_id=current_user.id
        )
        return dispute
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating dispute: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create dispute",
        )


@router.get("/contracts/{contract_id}/disputes", response_model=List[DisputeResponse])
async def get_contract_disputes(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get disputes for a contract"""
    try:
        disputes = await FreelanceService.get_contract_disputes(
            contract_id=contract_id, user_id=current_user.id
        )
        return disputes
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching disputes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch disputes",
        )


# ======================
# FREELANCER ENDPOINTS
# ======================


@router.get("/freelancers", response_model=Dict[str, Any])
async def search_freelancers(
    skills: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    has_certificates: Optional[bool] = Query(None),
    phone_verified: Optional[bool] = Query(None),
    min_budget: Optional[int] = Query(None, ge=0, description="Minimum budget in DZD"),
    max_budget: Optional[int] = Query(None, ge=0, description="Maximum budget in DZD"),
    category: Optional[str] = Query(
        None, description="Category filter (web, mobile, design, etc)"
    ),
    rating_min: Optional[float] = Query(
        None, ge=0, le=5, description="Minimum average rating"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    current_user: dict = Depends(get_current_active_user),
):
    """Search for freelancers"""
    try:
        search_params = FreelancerSearch(
            skills=skills,
            search=search,
            has_certificates=has_certificates,
            phone_verified=phone_verified,
            min_budget=min_budget,
            max_budget=max_budget,
            category=category,
            rating_min=rating_min,
            skip=skip,
            limit=limit,
        )
        result = await FreelanceService.search_freelancers(search_params)
        return result
    except Exception as e:
        logger.error(f"Error searching freelancers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search freelancers",
        )


@router.get("/freelancers/me/recommended-projects", response_model=Dict[str, Any])
async def get_recommended_projects(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_active_user),
):
    """Get recommended projects for the current freelancer based on skill matching."""
    try:
        result = await SkillMatchingService.get_recommended_projects(
            user_id=current_user.id,
            limit=limit,
        )
        return result
    except Exception as e:
        logger.error(f"Error getting recommended projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get recommendations",
        )


@router.get("/freelancers/{user_id}", response_model=Dict[str, Any])
async def get_freelancer_profile(
    user_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get freelancer profile with detailed information"""
    try:
        profile = await FreelanceService.get_freelancer_profile(user_id)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching freelancer profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch freelancer profile",
        )


# ======================
# DASHBOARD ENDPOINTS
# ======================


@router.get("/dashboard/stats")
async def get_freelance_dashboard_stats(
    current_user: dict = Depends(get_current_active_user),
):
    """Get freelance dashboard statistics for current user"""
    try:
        stats = await FreelanceService.get_dashboard_stats(current_user.id)
        return stats
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard statistics",
        )


# ======================
# ASSIGNMENT ENDPOINTS (Direct Assignment Path)
# ======================


@router.post(
    "/projects/{project_id}/assign/{freelancer_id}", response_model=ContractResponse
)
async def assign_project_to_freelancer(
    project_id: int,
    freelancer_id: int,
    contract_data: Optional[ContractCreate] = Body(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Directly assign a project to a freelancer (client only) - ALGERIAN SPECIFIC"""
    try:
        contract = await FreelanceService.assign_project_directly(
            project_id=project_id,
            freelancer_id=freelancer_id,
            client_id=current_user.id,
            contract_data=contract_data,
        )
        return contract
    except ValueError as e:
        logger.error(f"Error assigning project: {e}", exc_info=True)  # Added logging
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),  # This will show the actual error message
        )
    except Exception as e:
        logger.error(f"Unexpected error assigning project: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign project: {str(e)}",
        )


# ======================
# PUBLIC ENDPOINTS (No Authentication Required)
# ======================


@router.get("/public/projects", response_model=Dict[str, Any])
async def list_public_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    skills: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
):
    """List public projects (no authentication required)"""
    try:
        search_params = PublicProjectSearch(
            skip=skip, limit=limit, skills=skills, search=search
        )
        result = await FreelanceService.list_public_projects(
            search_params=search_params
        )
        return result
    except Exception as e:
        logger.error(f"Error listing public projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch projects",
        )


@router.get("/public/projects/{project_id}", response_model=PublicProjectResponse)
async def get_public_project(project_id: int):
    """Get public project details (no authentication required)"""
    try:
        logger.info(f"API: Getting public project {project_id}")
        project = await FreelanceService.get_public_project(project_id=project_id)
        return project
    except ValueError as e:
        logger.warning(f"Public project not found: {project_id} - {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching public project {project_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project: {str(e)}",
        )


@router.get("/public/freelancers", response_model=Dict[str, Any])
async def search_public_freelancers(
    skills: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    has_certificates: Optional[bool] = Query(None),
    min_budget: Optional[int] = Query(None, ge=0, description="Minimum budget in DZD"),
    max_budget: Optional[int] = Query(None, ge=0, description="Maximum budget in DZD"),
    category: Optional[str] = Query(
        None, description="Category filter (web, mobile, design, etc)"
    ),
    rating_min: Optional[float] = Query(
        None, ge=0, le=5, description="Minimum average rating"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
):
    """Search for public freelancers (no authentication required)"""
    try:
        search_params = PublicFreelancerSearch(
            skills=skills,
            search=search,
            has_certificates=has_certificates,
            min_budget=min_budget,
            max_budget=max_budget,
            category=category,
            rating_min=rating_min,
            skip=skip,
            limit=limit,
        )
        result = await FreelanceService.search_public_freelancers(search_params)
        return result
    except Exception as e:
        logger.error(f"Error searching public freelancers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search freelancers",
        )


@router.get("/public/freelancers/{user_id}", response_model=PublicFreelancerResponse)
async def get_public_freelancer_profile(user_id: int):
    """Get public freelancer profile (no authentication required)"""
    try:
        profile = await FreelanceService.get_public_freelancer_profile(user_id)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching public freelancer profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch freelancer profile",
        )


@router.get("/public/stats")
async def get_public_stats():
    """Get public statistics (no authentication required)"""
    try:
        # Count public projects (only OPEN ones)
        project_count = await prisma.project.count(where={"status": "OPEN"})

        # Count available freelancers
        freelancer_count = await prisma.user.count(
            where={
                "role": {"in": ["FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"]},
                "isActive": True,
                "deletedAt": None,
            }
        )

        # Count completed contracts
        completed_contracts = await prisma.contract.count(where={"status": "COMPLETED"})

        # Get top skills
        all_projects = await prisma.project.find_many(where={"status": "OPEN"})

        # Count skill frequencies
        skill_counts = {}
        for project in all_projects:
            if project.skills:
                for skill in project.skills:
                    skill_counts[skill.lower()] = skill_counts.get(skill.lower(), 0) + 1

        # Get top 10 skills
        top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total_projects": project_count,
            "total_freelancers": freelancer_count,
            "completed_contracts": completed_contracts,
            "top_skills": [
                {"skill": skill, "count": count} for skill, count in top_skills
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching public stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch statistics",
        )


# ======================
# RATING & REVIEWS ENDPOINTS
# ======================


@router.get("/contracts/{contract_id}/reviews/eligibility")
async def get_review_eligibility(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Check if the current user is eligible to review the contract"""
    try:
        return await FreelanceService.get_review_eligibility(
            user_id=current_user.id, contract_id=contract_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error checking review eligibility: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check review eligibility",
        )


@router.get("/contracts/{contract_id}/reviews", response_model=Dict[str, Any])
async def get_contract_reviews(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get all reviews for a contract, enforcing blind-review rules"""
    try:
        return await FreelanceService.get_contract_reviews(
            contract_id=contract_id, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching contract reviews: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contract reviews",
        )


@router.post("/contracts/{contract_id}/reviews", response_model=ReviewResponse)
async def submit_review(
    contract_id: int,
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Submit a review for a contract"""
    try:
        return await FreelanceService.submit_review(
            user_id=current_user.id, contract_id=contract_id, review_data=review_data
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting review: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit review",
        )


@router.patch("/reviews/{review_id}", response_model=ReviewResponse)
async def edit_review(
    review_id: int,
    review_data: ReviewUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Edit a previously submitted review (within 48 hrs)"""
    try:
        return await FreelanceService.edit_review(
            user_id=current_user.id, review_id=review_id, review_data=review_data
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error editing review: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to edit review",
        )


@router.post("/reviews/{review_id}/appeals", response_model=AppealResponse)
async def submit_appeal(
    review_id: int,
    appeal_data: AppealCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Submit an appeal against a review targetting the user"""
    try:
        return await FreelanceService.submit_appeal(
            user_id=current_user.id, review_id=review_id, appeal_data=appeal_data
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting appeal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit appeal",
        )


@router.get(
    "/freelancers/{user_id}/rating-summary", response_model=RatingSummaryResponse
)
async def get_freelancer_rating_summary(user_id: int):
    """Get rating distribution and average for a freelancer"""
    try:
        return await FreelanceService.get_freelancer_rating_summary(user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting rating summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch rating summary",
        )


@router.get(
    "/contracts/{contract_id}/review-status",
    response_model=ContractReviewStatusResponse,
)
async def get_contract_review_status(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Get current review status of both parties for a contract"""
    try:
        return await FreelanceService.get_contract_review_status(
            contract_id=contract_id, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting review status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch review status",
        )


@router.post("/reviews/{review_id}/report", response_model=ReviewReportResponse)
async def submit_review_report(
    review_id: int,
    report_data: ReviewReportCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Submit a soft report on a review"""
    try:
        return await FreelanceService.submit_review_report(
            review_id=review_id, reporter_id=current_user.id, reason=report_data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting review report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit review report",
        )


# ======================
# ADMIN ENDPOINTS
# ======================


@router.get("/admin/disputes", response_model=Dict[str, Any])
async def admin_list_disputes(
    status: Optional[str] = Query(
        None, description="Filter by status (OPEN, UNDER_REVIEW, RESOLVED, CANCELLED)"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_permissions("freelance:disputes:read")),
):
    """Admin: List all disputes with optional status filter."""
    try:
        return await FreelanceService.list_all_disputes(
            status=status, skip=skip, limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing disputes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list disputes",
        )


@router.patch("/admin/disputes/{dispute_id}/resolve", response_model=Dict[str, Any])
async def admin_resolve_dispute(
    dispute_id: int,
    resolution: str = Body(
        ..., embed=True, description="Resolution type (RESOLVED, CANCELLED)"
    ),
    notes: Optional[str] = Body(None, embed=True),
    current_user=Depends(require_permissions("freelance:disputes:arbitrate")),
):
    """Admin: Resolve a dispute."""
    try:
        return await FreelanceService.resolve_dispute(
            dispute_id=dispute_id,
            admin_id=current_user.id,
            resolution=resolution,
            notes=notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error resolving dispute: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve dispute",
        )


@router.get("/admin/reviews/appeals", response_model=Dict[str, Any])
async def admin_list_appeals(
    status: Optional[str] = Query(
        None, description="Filter by status (PENDING, APPROVED, REJECTED)"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_permissions("appeals:read")),
):
    """Admin: List all review appeals."""
    try:
        return await FreelanceService.list_all_appeals(
            status=status, skip=skip, limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing appeals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list appeals",
        )


@router.patch("/admin/reviews/appeals/{appeal_id}", response_model=Dict[str, Any])
async def admin_resolve_appeal(
    appeal_id: int,
    decision: str = Body(..., embed=True, pattern="^(APPROVED|REJECTED)$"),
    notes: Optional[str] = Body(None, embed=True),
    current_user=Depends(require_permissions("reviews:appeals:decide")),
):
    """Admin: Approve or reject a review appeal."""
    try:
        return await FreelanceService.resolve_appeal(
            appeal_id=appeal_id,
            admin_id=current_user.id,
            decision=decision,
            notes=notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error resolving appeal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve appeal",
        )


@router.get("/admin/reviews/reports", response_model=Dict[str, Any])
async def admin_list_reports(
    status: Optional[str] = Query(
        None, description="Filter by status (PENDING, RESOLVED, DISMISSED)"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_permissions("reviews:reports:read")),
):
    """Admin: List all review reports."""
    try:
        return await FreelanceService.list_review_reports(
            status=status, skip=skip, limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list reports",
        )


@router.patch("/admin/reviews/{review_id}/redact", response_model=Dict[str, Any])
async def admin_redact_review(
    review_id: int,
    reason: Optional[str] = Body(None, embed=True),
    current_user=Depends(require_permissions("reviews:redact")),
):
    """Admin: Redact a review (hide from public view)."""
    try:
        return await FreelanceService.redact_review(
            review_id=review_id,
            admin_id=current_user.id,
            reason=reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error redacting review: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to redact review",
        )


@router.get("/admin/stats", response_model=Dict[str, Any])
async def admin_freelance_stats(
    current_user=Depends(require_permissions("freelance:stats:read")),
):
    """Admin: Get platform-wide freelancing statistics."""
    try:
        return await FreelanceService.get_admin_stats()
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get stats",
        )
