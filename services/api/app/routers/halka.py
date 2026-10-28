"""
TamWheel Sovereign Ethical Agentic Venture OS — "Halka" Family Syndicates (حلقة العائلة) Router.
Exposes endpoints for:
1. Kinship syndicate creation with designated "Amin" (الأمين) elder.
2. Family member onboarding (Youth diligence researchers and family contributors).
3. Multi-signature investment proposals.
4. Co-signing workflow among family members.
5. Sovereign Amin decision gate with Haptic Khatm ceremony payload (432 Hz tone, 80ms pulse, 72h cooling-off window).
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.halka_syndicate import (
    halka_syndicate_engine,
    HalkaFamilySyndicate,
    HalkaMember,
    HalkaInvestmentProposal,
    FamilyRole,
    HalkaStatus,
    ProposalApprovalState,
    HapticKhatmPayload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/halka", tags=["Halka Family Syndicates (حلقة العائلة)"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class CreateHalkaRequest(BaseModel):
    family_name: str
    wilaya: int = Field(default=16, ge=1, le=58)
    amin_id: str
    amin_name: str
    amin_relation: str = "Elder Uncle (العم الأكبر)"
    initial_vault_deposit_dzd: float = Field(default=0.0, ge=0.0)


class AddHalkaMemberRequest(BaseModel):
    member_id: str
    full_name: str
    kinship_relation: str
    role: FamilyRole = FamilyRole.FAMILY_CONTRIBUTOR
    pledge_dzd: float = Field(default=0.0, ge=0.0)


class CreateHalkaProposalRequest(BaseModel):
    startup_id: str
    startup_name: str
    investment_amount_dzd: float = Field(..., gt=0.0)
    proposer_id: str
    proposer_name: str
    diligence_summary: str
    required_co_signatures: int = Field(default=2, ge=1)


class CoSignProposalRequest(BaseModel):
    member_id: str


class AminDecisionRequest(BaseModel):
    amin_id: str
    approve: bool
    signature_token: Optional[str] = None
    rejection_reason: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/create",
    response_model=HalkaFamilySyndicate,
    summary="Create a new Halka Family Syndicate",
    description="Initializes a multi-generational kinship syndicate with a designated Amin elder.",
)
async def create_halka(
    req: CreateHalkaRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaFamilySyndicate:
    try:
        return halka_syndicate_engine.create_halka(
            family_name=req.family_name,
            wilaya=req.wilaya,
            amin_id=req.amin_id,
            amin_name=req.amin_name,
            amin_relation=req.amin_relation,
            initial_vault_deposit_dzd=req.initial_vault_deposit_dzd,
        )
    except Exception as e:
        logger.error(f"Error creating Halka: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{halka_id}",
    response_model=HalkaFamilySyndicate,
    summary="Get Halka Family Syndicate details",
)
async def get_halka(
    halka_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaFamilySyndicate:
    halka = halka_syndicate_engine.get_halka(halka_id)
    if not halka:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Halka '{halka_id}' not found.")
    return halka


@router.post(
    "/{halka_id}/members",
    response_model=HalkaFamilySyndicate,
    summary="Add a family member to the Halka",
    description="Registers a family member (e.g. Al-Shabab youth researcher or family contributor).",
)
async def add_family_member(
    halka_id: str,
    req: AddHalkaMemberRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaFamilySyndicate:
    try:
        return halka_syndicate_engine.add_family_member(
            halka_id=halka_id,
            member_id=req.member_id,
            full_name=req.full_name,
            kinship_relation=req.kinship_relation,
            role=req.role,
            pledge_dzd=req.pledge_dzd,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error adding Halka member: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{halka_id}/proposals",
    response_model=HalkaInvestmentProposal,
    summary="Submit an investment proposal for the Halka",
    description="Submits an investment proposal requiring family member co-signatures before reaching the Amin.",
)
async def create_halka_proposal(
    halka_id: str,
    req: CreateHalkaProposalRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaInvestmentProposal:
    try:
        return halka_syndicate_engine.create_proposal(
            halka_id=halka_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            investment_amount_dzd=req.investment_amount_dzd,
            proposer_id=req.proposer_id,
            proposer_name=req.proposer_name,
            diligence_summary=req.diligence_summary,
            required_co_signatures=req.required_co_signatures,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating Halka proposal: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/proposals/{proposal_id}",
    response_model=HalkaInvestmentProposal,
    summary="Get proposal details",
)
async def get_halka_proposal(
    proposal_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaInvestmentProposal:
    proposal = halka_syndicate_engine._proposals.get(proposal_id)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal '{proposal_id}' not found.")
    return proposal


@router.post(
    "/proposals/{proposal_id}/co-sign",
    response_model=HalkaInvestmentProposal,
    summary="Co-sign an investment proposal",
    description="Allows kinship members to co-sign an investment proposal to qualify it for Amin review.",
)
async def co_sign_proposal(
    proposal_id: str,
    req: CoSignProposalRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaInvestmentProposal:
    try:
        return halka_syndicate_engine.co_sign_proposal(
            proposal_id=proposal_id,
            member_id=req.member_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error co-signing proposal: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/proposals/{proposal_id}/amin-decision",
    response_model=HalkaInvestmentProposal,
    summary="Amin elder decision gate",
    description="Allows the designated Amin elder to grant final approval or veto to protect family honor (Nif) and avoid disgrace (Hchouma). On approval, triggers the Haptic Khatm ceremony.",
)
async def amin_decision(
    proposal_id: str,
    req: AminDecisionRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> HalkaInvestmentProposal:
    try:
        return halka_syndicate_engine.amin_decision(
            proposal_id=proposal_id,
            amin_id=req.amin_id,
            approve=req.approve,
            signature_token=req.signature_token,
            rejection_reason=req.rejection_reason,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error recording Amin decision: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
