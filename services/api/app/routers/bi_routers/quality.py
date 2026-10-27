"""
BI Quality Router - Data quality issues management.
Uses Prisma ORM.
"""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from app.core.tenant import TenantContext, get_tenant_context
from app.core.prisma import prisma


router = APIRouter(prefix="/quality", tags=["BI Quality"])


# =============================================================================
# Pydantic Schemas
# =============================================================================


class QualityIssueResponse(BaseModel):
    id: int
    datasetId: int
    columnName: Optional[str]
    issueType: str
    severity: str
    description: str
    affectedRows: int
    percentage: float
    status: str
    resolvedAt: Optional[str]
    createdAt: str

    model_config = ConfigDict(from_attributes=True)


class QualityIssueResolve(BaseModel):
    resolution: Optional[str] = None  # Optional notes about the resolution


# =============================================================================
# API Endpoints
# =============================================================================


@router.get("/issues", response_model=List[QualityIssueResponse])
async def list_quality_issues(
    dataset_id: Optional[int] = Query(None, alias="datasetId"),
    status: Optional[str] = Query(None, pattern="^(open|resolved|ignored)$"),
    severity: Optional[str] = Query(None, pattern="^(critical|high|medium|low)$"),
    issue_type: Optional[str] = Query(
        None,
        alias="issueType",
        pattern="^(missing_values|duplicates|outliers|invalid_types|formatting|range_violations)$",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """List all quality issues for the organization."""
    org_id = ctx.organization_id

    # Get all datasets for the organization
    datasets = await prisma.dataset.find_many(
        where={"organizationId": org_id},
    )
    dataset_ids = [d.id for d in datasets]

    if not dataset_ids:
        return []

    # Build where clause
    where = {"datasetId": {"in": dataset_ids}}
    if dataset_id:
        where["datasetId"] = dataset_id
    if status:
        where["status"] = status
    if severity:
        where["severity"] = severity
    if issue_type:
        where["issueType"] = issue_type

    issues = await prisma.qualityissue.find_many(
        where=where,
        skip=offset,
        take=limit,
        order=[
            {"severity": "asc"},  # critical first
            {"createdAt": "desc"},
        ],
    )

    return [
        QualityIssueResponse(
            id=i.id,
            datasetId=i.datasetId,
            columnName=i.columnName,
            issueType=i.issueType,
            severity=i.severity,
            description=i.description,
            affectedRows=i.affectedRows,
            percentage=i.percentage,
            status=i.status,
            resolvedAt=i.resolvedAt.isoformat() if i.resolvedAt else None,
            createdAt=i.createdAt.isoformat() if i.createdAt else "",
        )
        for i in issues
    ]


@router.get("/datasets/{dataset_id}/issues", response_model=List[QualityIssueResponse])
async def get_dataset_quality_issues(
    dataset_id: int,
    status: Optional[str] = Query(None, pattern="^(open|resolved|ignored)$"),
    severity: Optional[str] = Query(None, pattern="^(critical|high|medium|low)$"),
    issue_type: Optional[str] = Query(
        None,
        alias="issueType",
        pattern="^(missing_values|duplicates|outliers|invalid_types|formatting|range_violations)$",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get quality issues for a specific dataset."""
    org_id = ctx.organization_id

    # Verify the dataset belongs to the organization
    dataset = await prisma.dataset.find_unique(
        where={"id": dataset_id},
    )

    if not dataset or dataset.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Build where clause
    where = {"datasetId": dataset_id}
    if status:
        where["status"] = status
    if severity:
        where["severity"] = severity
    if issue_type:
        where["issueType"] = issue_type

    issues = await prisma.qualityissue.find_many(
        where=where,
        skip=offset,
        take=limit,
        order=[
            {"severity": "asc"},
            {"createdAt": "desc"},
        ],
    )

    return [
        QualityIssueResponse(
            id=i.id,
            datasetId=i.datasetId,
            columnName=i.columnName,
            issueType=i.issueType,
            severity=i.severity,
            description=i.description,
            affectedRows=i.affectedRows,
            percentage=i.percentage,
            status=i.status,
            resolvedAt=i.resolvedAt.isoformat() if i.resolvedAt else None,
            createdAt=i.createdAt.isoformat() if i.createdAt else "",
        )
        for i in issues
    ]


@router.get("/issues/{issue_id}", response_model=QualityIssueResponse)
async def get_quality_issue(
    issue_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific quality issue."""
    org_id = ctx.organization_id

    issue = await prisma.qualityissue.find_unique(
        where={"id": issue_id},
    )

    if not issue:
        raise HTTPException(status_code=404, detail="Quality issue not found")

    # Verify the dataset belongs to the organization
    dataset = await prisma.dataset.find_unique(
        where={"id": issue.datasetId},
    )

    if not dataset or dataset.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Quality issue not found")

    return QualityIssueResponse(
        id=issue.id,
        datasetId=issue.datasetId,
        columnName=issue.columnName,
        issueType=issue.issueType,
        severity=issue.severity,
        description=issue.description,
        affectedRows=issue.affectedRows,
        percentage=issue.percentage,
        status=issue.status,
        resolvedAt=issue.resolvedAt.isoformat() if issue.resolvedAt else None,
        createdAt=issue.createdAt.isoformat() if issue.createdAt else "",
    )


@router.patch("/issues/{issue_id}/resolve", response_model=QualityIssueResponse)
async def resolve_quality_issue(
    issue_id: int,
    resolution: QualityIssueResolve = None,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Mark a quality issue as resolved."""
    org_id = ctx.organization_id

    issue = await prisma.qualityissue.find_unique(
        where={"id": issue_id},
    )

    if not issue:
        raise HTTPException(status_code=404, detail="Quality issue not found")

    # Verify the dataset belongs to the organization
    dataset = await prisma.dataset.find_unique(
        where={"id": issue.datasetId},
    )

    if not dataset or (org_id and dataset.organizationId != org_id):
        raise HTTPException(status_code=404, detail="Quality issue not found")

    updated = await prisma.qualityissue.update(
        where={"id": issue_id},
        data={
            "status": "resolved",
            "resolvedAt": datetime.now(timezone.utc),
        },
    )

    return QualityIssueResponse(
        id=updated.id,
        datasetId=updated.datasetId,
        columnName=updated.columnName,
        issueType=updated.issueType,
        severity=updated.severity,
        description=updated.description,
        affectedRows=updated.affectedRows,
        percentage=updated.percentage,
        status=updated.status,
        resolvedAt=updated.resolvedAt.isoformat() if updated.resolvedAt else None,
        createdAt=updated.createdAt.isoformat() if updated.createdAt else "",
    )


@router.patch("/issues/{issue_id}/ignore", response_model=QualityIssueResponse)
async def ignore_quality_issue(
    issue_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Ignore a quality issue."""
    org_id = ctx.organization_id

    issue = await prisma.qualityissue.find_unique(
        where={"id": issue_id},
    )

    if not issue:
        raise HTTPException(status_code=404, detail="Quality issue not found")

    # Verify the dataset belongs to the organization
    dataset = await prisma.dataset.find_unique(
        where={"id": issue.datasetId},
    )

    if not dataset or dataset.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Quality issue not found")

    updated = await prisma.qualityissue.update(
        where={"id": issue_id}, data={"status": "ignored"}
    )

    return QualityIssueResponse(
        id=updated.id,
        datasetId=updated.datasetId,
        columnName=updated.columnName,
        issueType=updated.issueType,
        severity=updated.severity,
        description=updated.description,
        affectedRows=updated.affectedRows,
        percentage=updated.percentage,
        status=updated.status,
        resolvedAt=updated.resolvedAt.isoformat() if updated.resolvedAt else None,
        createdAt=updated.createdAt.isoformat() if updated.createdAt else "",
    )


@router.post("/datasets/{dataset_id}/scan", status_code=202)
async def trigger_quality_scan(
    dataset_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Trigger a quality scan for a dataset."""
    org_id = ctx.organization_id

    dataset = await prisma.dataset.find_unique(
        where={"id": dataset_id},
    )

    if not dataset or dataset.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # TODO: In production, this would queue a background job
    # For now, return a success response
    return {
        "message": "Quality scan queued",
        "datasetId": dataset_id,
        "status": "pending",
    }


@router.get("/summary", response_model=dict)
async def get_quality_summary(
    dataset_id: Optional[int] = Query(None, alias="datasetId"),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a summary of quality issues."""
    org_id = ctx.organization_id

    # Get datasets
    base_filter = {"organizationId": org_id}
    if dataset_id:
        base_filter = {"id": dataset_id, "organizationId": org_id}

    datasets = await prisma.dataset.find_many(
        where=base_filter,
    )
    dataset_ids = [d.id for d in datasets]

    if not dataset_ids:
        return {
            "total": 0,
            "open": 0,
            "resolved": 0,
            "ignored": 0,
            "bySeverity": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "byType": {
                "missing_values": 0,
                "duplicates": 0,
                "outliers": 0,
                "invalid_types": 0,
                "formatting": 0,
                "range_violations": 0,
            },
        }

    # Get counts
    total_issues = await prisma.qualityissue.count(
        where={"datasetId": {"in": dataset_ids}}
    )

    open_issues = await prisma.qualityissue.count(
        where={"datasetId": {"in": dataset_ids}, "status": "open"}
    )

    resolved_issues = await prisma.qualityissue.count(
        where={"datasetId": {"in": dataset_ids}, "status": "resolved"}
    )

    ignored_issues = await prisma.qualityissue.count(
        where={"datasetId": {"in": dataset_ids}, "status": "ignored"}
    )

    # Count by severity (only open issues)
    by_severity = {}
    for severity in ["critical", "high", "medium", "low"]:
        count = await prisma.qualityissue.count(
            where={
                "datasetId": {"in": dataset_ids},
                "severity": severity,
                "status": "open",
            }
        )
        by_severity[severity] = count

    # Count by type (only open issues)
    by_type = {}
    for issue_type in [
        "missing_values",
        "duplicates",
        "outliers",
        "invalid_types",
        "formatting",
        "range_violations",
    ]:
        count = await prisma.qualityissue.count(
            where={
                "datasetId": {"in": dataset_ids},
                "issueType": issue_type,
                "status": "open",
            }
        )
        by_type[issue_type] = count

    return {
        "total": total_issues,
        "open": open_issues,
        "resolved": resolved_issues,
        "ignored": ignored_issues,
        "bySeverity": by_severity,
        "byType": by_type,
    }
