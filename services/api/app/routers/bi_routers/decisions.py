"""
BI Decisions Router - CRUD operations for Decision records.
Uses Prisma ORM.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict

from app.core.tenant import TenantContext, get_tenant_context
from app.core.prisma import prisma

router = APIRouter(prefix="/decisions", tags=["BI Decisions"])


# =============================================================================
# Pydantic Schemas
# =============================================================================


class DecisionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    impactLevel: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    rationale: Optional[str] = None
    expectedOutcome: Optional[str] = None
    datasetId: Optional[int] = None
    tags: List[str] = []


class DecisionCreate(DecisionBase):
    pass


class DecisionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    impactLevel: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    rationale: Optional[str] = None
    expectedOutcome: Optional[str] = None
    actualOutcome: Optional[str] = None
    datasetId: Optional[int] = None
    tags: Optional[List[str]] = None


class DecisionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|review|approved|implemented|archived)$")
    notes: Optional[str] = None


class DecisionHistoryResponse(BaseModel):
    id: int
    decisionId: int
    status: str
    changedById: int
    notes: Optional[str]
    changedAt: str

    model_config = ConfigDict(from_attributes=True)


class DecisionCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class DecisionCommentResponse(BaseModel):
    id: int
    decisionId: int
    userId: int
    content: str
    createdAt: str

    model_config = ConfigDict(from_attributes=True)


class DecisionResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    impactLevel: str
    rationale: Optional[str]
    expectedOutcome: Optional[str]
    actualOutcome: Optional[str]
    datasetId: Optional[int]
    ownerId: int
    organizationId: int
    tags: List[str]
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(from_attributes=True)


class PaginatedDecisionResponse(BaseModel):
    decisions: List[DecisionResponse]
    total: int
    page: int
    per_page: int


# =============================================================================
# API Endpoints
# =============================================================================


@router.get("", response_model=PaginatedDecisionResponse)
async def list_decisions(
    status: Optional[str] = Query(
        None, pattern="^(draft|review|approved|implemented|archived)$"
    ),
    impact_level: Optional[str] = Query(
        None, alias="impactLevel", pattern="^(low|medium|high|critical)$"
    ),
    dataset_id: Optional[int] = Query(None, alias="datasetId"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(
        50, ge=1, le=200, alias="per_page", description="Items per page"
    ),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """List all decisions for the organization."""
    # Convert page to offset
    offset = (page - 1) * per_page
    limit = per_page

    org_id = ctx.organization_id

    # Build where clause
    where = {"organizationId": org_id}
    if status:
        where["status"] = status
    if impact_level:
        where["impactLevel"] = impact_level
    if dataset_id:
        where["datasetId"] = dataset_id
    if search:
        where["title"] = {"contains": search}

    decisions = await prisma.decision.find_many(
        where=where, skip=offset, take=limit, order={"createdAt": "desc"}
    )

    # Get total count for pagination
    total = await prisma.decision.count(where=where)

    # Convert datetime to ISO string
    return {
        "decisions": [
            DecisionResponse(
                id=d.id,
                title=d.title,
                description=d.description,
                status=d.status,
                impactLevel=d.impactLevel,
                rationale=d.rationale,
                expectedOutcome=d.expectedOutcome,
                actualOutcome=d.actualOutcome,
                datasetId=d.datasetId,
                ownerId=d.ownerId,
                organizationId=d.organizationId,
                tags=d.tags or [],
                createdAt=d.createdAt.isoformat() if d.createdAt else "",
                updatedAt=d.updatedAt.isoformat() if d.updatedAt else "",
            )
            for d in decisions
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("", response_model=DecisionResponse, status_code=201)
async def create_decision(
    decision: DecisionCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new decision."""
    org_id = ctx.organization_id

    db_decision = await prisma.decision.create(
        {
            "title": decision.title,
            "description": decision.description,
            "impactLevel": decision.impactLevel,
            "rationale": decision.rationale,
            "expectedOutcome": decision.expectedOutcome,
            "datasetId": decision.datasetId,
            "tags": decision.tags,
            "ownerId": ctx.user_id,
            "organizationId": org_id,
            "status": "draft",
        }
    )

    # Create initial history entry
    await prisma.decisionhistory.create(
        {
            "decisionId": db_decision.id,
            "status": "draft",
            "changedById": ctx.user_id,
            "notes": "Decision created",
        }
    )

    return DecisionResponse(
        id=db_decision.id,
        title=db_decision.title,
        description=db_decision.description,
        status=db_decision.status,
        impactLevel=db_decision.impactLevel,
        rationale=db_decision.rationale,
        expectedOutcome=db_decision.expectedOutcome,
        actualOutcome=db_decision.actualOutcome,
        datasetId=db_decision.datasetId,
        ownerId=db_decision.ownerId,
        organizationId=db_decision.organizationId,
        tags=db_decision.tags or [],
        createdAt=db_decision.createdAt.isoformat() if db_decision.createdAt else "",
        updatedAt=db_decision.updatedAt.isoformat() if db_decision.updatedAt else "",
    )


@router.get("/{decision_id}", response_model=DecisionResponse)
async def get_decision(
    decision_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific decision by ID."""
    org_id = ctx.organization_id

    decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not decision or decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    return DecisionResponse(
        id=decision.id,
        title=decision.title,
        description=decision.description,
        status=decision.status,
        impactLevel=decision.impactLevel,
        rationale=decision.rationale,
        expectedOutcome=decision.expectedOutcome,
        actualOutcome=decision.actualOutcome,
        datasetId=decision.datasetId,
        ownerId=decision.ownerId,
        organizationId=decision.organizationId,
        tags=decision.tags or [],
        createdAt=decision.createdAt.isoformat() if decision.createdAt else "",
        updatedAt=decision.updatedAt.isoformat() if decision.updatedAt else "",
    )


@router.put("/{decision_id}", response_model=DecisionResponse)
async def update_decision(
    decision_id: int,
    decision: DecisionUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a decision."""
    org_id = ctx.organization_id

    db_decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not db_decision or db_decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    update_data = decision.model_dump(exclude_unset=True)
    if update_data:
        updated = await prisma.decision.update(
            where={"id": decision_id}, data=update_data
        )
        db_decision = updated

    return DecisionResponse(
        id=db_decision.id,
        title=db_decision.title,
        description=db_decision.description,
        status=db_decision.status,
        impactLevel=db_decision.impactLevel,
        rationale=db_decision.rationale,
        expectedOutcome=db_decision.expectedOutcome,
        actualOutcome=db_decision.actualOutcome,
        datasetId=db_decision.datasetId,
        ownerId=db_decision.ownerId,
        organizationId=db_decision.organizationId,
        tags=db_decision.tags or [],
        createdAt=db_decision.createdAt.isoformat() if db_decision.createdAt else "",
        updatedAt=db_decision.updatedAt.isoformat() if db_decision.updatedAt else "",
    )


@router.delete("/{decision_id}", status_code=204)
async def delete_decision(
    decision_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a decision."""
    org_id = ctx.organization_id

    db_decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not db_decision or db_decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    await prisma.decision.delete(where={"id": decision_id})

    return None


@router.patch("/{decision_id}/status", response_model=DecisionResponse)
async def update_decision_status(
    decision_id: int,
    status_update: DecisionStatusUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Update the status of a decision."""
    org_id = ctx.organization_id

    db_decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not db_decision or db_decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    old_status = db_decision.status
    updated = await prisma.decision.update(
        where={"id": decision_id}, data={"status": status_update.status}
    )

    # Create history entry
    await prisma.decisionhistory.create(
        {
            "decisionId": decision_id,
            "status": status_update.status,
            "changedById": ctx.user_id,
            "notes": status_update.notes
            or f"Status changed from {old_status} to {status_update.status}",
        }
    )

    return DecisionResponse(
        id=updated.id,
        title=updated.title,
        description=updated.description,
        status=updated.status,
        impactLevel=updated.impactLevel,
        rationale=updated.rationale,
        expectedOutcome=updated.expectedOutcome,
        actualOutcome=updated.actualOutcome,
        datasetId=updated.datasetId,
        ownerId=updated.ownerId,
        organizationId=updated.organizationId,
        tags=updated.tags or [],
        createdAt=updated.createdAt.isoformat() if updated.createdAt else "",
        updatedAt=updated.updatedAt.isoformat() if updated.updatedAt else "",
    )


@router.get("/{decision_id}/history", response_model=List[DecisionHistoryResponse])
async def get_decision_history(
    decision_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get the history of a decision."""
    org_id = ctx.organization_id

    decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not decision or decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    history = await prisma.decisionhistory.find_many(
        where={"decisionId": decision_id}, order={"changedAt": "desc"}
    )

    return [
        DecisionHistoryResponse(
            id=h.id,
            decisionId=h.decisionId,
            status=h.status,
            changedById=h.changedById,
            notes=h.notes,
            changedAt=h.changedAt.isoformat() if h.changedAt else "",
        )
        for h in history
    ]


@router.post(
    "/{decision_id}/comments", response_model=DecisionCommentResponse, status_code=201
)
async def add_decision_comment(
    decision_id: int,
    comment: DecisionCommentCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Add a comment to a decision."""
    org_id = ctx.organization_id

    decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not decision or decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    db_comment = await prisma.decisioncomment.create(
        {
            "decisionId": decision_id,
            "userId": ctx.user_id,
            "content": comment.content,
        }
    )

    return DecisionCommentResponse(
        id=db_comment.id,
        decisionId=db_comment.decisionId,
        userId=db_comment.userId,
        content=db_comment.content,
        createdAt=db_comment.createdAt.isoformat() if db_comment.createdAt else "",
    )


@router.get("/{decision_id}/comments", response_model=List[DecisionCommentResponse])
async def get_decision_comments(
    decision_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get all comments for a decision."""
    org_id = ctx.organization_id

    decision = await prisma.decision.find_unique(
        where={"id": decision_id},
    )

    if not decision or decision.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Decision not found")

    comments = await prisma.decisioncomment.find_many(
        where={"decisionId": decision_id}, order={"createdAt": "asc"}
    )

    return [
        DecisionCommentResponse(
            id=c.id,
            decisionId=c.decisionId,
            userId=c.userId,
            content=c.content,
            createdAt=c.createdAt.isoformat() if c.createdAt else "",
        )
        for c in comments
    ]
