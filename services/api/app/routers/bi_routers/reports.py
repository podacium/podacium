"""
BI Reports Router - CRUD operations for Report records.
Uses Prisma ORM.
"""

from typing import List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict

from app.core.tenant import TenantContext, get_tenant_context
from app.core.prisma import prisma


router = APIRouter(prefix="/reports", tags=["BI Reports"])


# =============================================================================
# Pydantic Schemas
# =============================================================================


class ReportBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    dashboardId: Optional[int] = None
    format: str = Field(..., pattern="^(pdf|csv|xlsx)$")
    scheduleType: str = Field(
        default="manual", pattern="^(manual|daily|weekly|monthly|cron)$"
    )
    scheduleCron: Optional[str] = None
    scheduleInterval: Optional[int] = None
    recipients: List[str] = []


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    dashboardId: Optional[int] = None
    format: Optional[str] = Field(None, pattern="^(pdf|csv|xlsx)$")
    scheduleType: Optional[str] = Field(
        None, pattern="^(manual|daily|weekly|monthly|cron)$"
    )
    scheduleCron: Optional[str] = None
    scheduleInterval: Optional[int] = None
    recipients: Optional[List[str]] = None


class ReportRunResponse(BaseModel):
    id: int
    reportId: int
    status: str
    startedAt: str
    completedAt: Optional[str]
    fileUrl: Optional[str]
    fileSize: Optional[int]
    errorMessage: Optional[str]
    recipientCount: int

    model_config = ConfigDict(from_attributes=True)


class ReportResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dashboardId: Optional[int]
    format: str
    scheduleType: str
    scheduleCron: Optional[str]
    scheduleInterval: Optional[int]
    recipients: List[str]
    isActive: bool
    nextRun: Optional[str]
    createdById: int
    organizationId: int
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# API Endpoints
# =============================================================================


@router.get("", response_model=List[ReportResponse])
async def list_reports(
    is_active: Optional[bool] = Query(None, alias="isActive"),
    schedule_type: Optional[str] = Query(
        None, alias="scheduleType", pattern="^(manual|daily|weekly|monthly|cron)$"
    ),
    dashboard_id: Optional[int] = Query(None, alias="dashboardId"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """List all reports for the organization."""
    org_id = ctx.organization_id

    # Build where clause
    where = {"organizationId": org_id}
    if is_active is not None:
        where["isActive"] = is_active
    if schedule_type:
        where["scheduleType"] = schedule_type
    if dashboard_id:
        where["dashboardId"] = dashboard_id
    if search:
        where["name"] = {"contains": search}

    reports = await prisma.report.find_many(
        where=where, skip=offset, take=limit, order={"createdAt": "desc"}
    )

    return [
        ReportResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            dashboardId=r.dashboardId,
            format=r.format,
            scheduleType=r.scheduleType,
            scheduleCron=r.scheduleCron,
            scheduleInterval=r.scheduleInterval,
            recipients=r.recipients or [],
            isActive=r.isActive,
            nextRun=r.nextRun.isoformat() if r.nextRun else None,
            createdById=r.createdById,
            organizationId=r.organizationId,
            createdAt=r.createdAt.isoformat() if r.createdAt else "",
            updatedAt=r.updatedAt.isoformat() if r.updatedAt else "",
        )
        for r in reports
    ]


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    report: ReportCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new report."""
    org_id = ctx.organization_id

    # Calculate next run based on schedule
    next_run = None
    if report.scheduleType != "manual":
        next_run = _calculate_next_run(report.scheduleType, report.scheduleInterval)

    db_report = await prisma.report.create(
        {
            "name": report.name,
            "description": report.description,
            "dashboardId": report.dashboardId,
            "format": report.format,
            "scheduleType": report.scheduleType,
            "scheduleCron": report.scheduleCron,
            "scheduleInterval": report.scheduleInterval,
            "recipients": report.recipients,
            "createdById": ctx.user_id,
            "organizationId": org_id,
            "isActive": True,
            "nextRun": next_run,
        }
    )

    return ReportResponse(
        id=db_report.id,
        name=db_report.name,
        description=db_report.description,
        dashboardId=db_report.dashboardId,
        format=db_report.format,
        scheduleType=db_report.scheduleType,
        scheduleCron=db_report.scheduleCron,
        scheduleInterval=db_report.scheduleInterval,
        recipients=db_report.recipients or [],
        isActive=db_report.isActive,
        nextRun=db_report.nextRun.isoformat() if db_report.nextRun else None,
        createdById=db_report.createdById,
        organizationId=db_report.organizationId,
        createdAt=db_report.createdAt.isoformat() if db_report.createdAt else "",
        updatedAt=db_report.updatedAt.isoformat() if db_report.updatedAt else "",
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific report by ID."""
    org_id = ctx.organization_id

    report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not report or report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse(
        id=report.id,
        name=report.name,
        description=report.description,
        dashboardId=report.dashboardId,
        format=report.format,
        scheduleType=report.scheduleType,
        scheduleCron=report.scheduleCron,
        scheduleInterval=report.scheduleInterval,
        recipients=report.recipients or [],
        isActive=report.isActive,
        nextRun=report.nextRun.isoformat() if report.nextRun else None,
        createdById=report.createdById,
        organizationId=report.organizationId,
        createdAt=report.createdAt.isoformat() if report.createdAt else "",
        updatedAt=report.updatedAt.isoformat() if report.updatedAt else "",
    )


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: int,
    report: ReportUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a report."""
    org_id = ctx.organization_id

    db_report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not db_report or db_report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = report.model_dump(exclude_unset=True)
    if update_data:
        # Recalculate next run if schedule changed
        if "scheduleType" in update_data or "scheduleInterval" in update_data:
            schedule_type = update_data.get("scheduleType", db_report.scheduleType)
            schedule_interval = update_data.get(
                "scheduleInterval", db_report.scheduleInterval
            )
            if schedule_type != "manual":
                update_data["nextRun"] = _calculate_next_run(
                    schedule_type, schedule_interval
                )
            else:
                update_data["nextRun"] = None

        updated = await prisma.report.update(where={"id": report_id}, data=update_data)
        db_report = updated

    return ReportResponse(
        id=db_report.id,
        name=db_report.name,
        description=db_report.description,
        dashboardId=db_report.dashboardId,
        format=db_report.format,
        scheduleType=db_report.scheduleType,
        scheduleCron=db_report.scheduleCron,
        scheduleInterval=db_report.scheduleInterval,
        recipients=db_report.recipients or [],
        isActive=db_report.isActive,
        nextRun=db_report.nextRun.isoformat() if db_report.nextRun else None,
        createdById=db_report.createdById,
        organizationId=db_report.organizationId,
        createdAt=db_report.createdAt.isoformat() if db_report.createdAt else "",
        updatedAt=db_report.updatedAt.isoformat() if db_report.updatedAt else "",
    )


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a report."""
    org_id = ctx.organization_id

    db_report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not db_report or db_report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    await prisma.report.delete(where={"id": report_id})

    return None


@router.patch("/{report_id}/toggle", response_model=ReportResponse)
async def toggle_report_active(
    report_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Toggle a report's active status."""
    org_id = ctx.organization_id

    db_report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not db_report or db_report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    new_is_active = not db_report.isActive

    # Recalculate next run
    next_run = None
    if new_is_active and db_report.scheduleType != "manual":
        next_run = _calculate_next_run(
            db_report.scheduleType, db_report.scheduleInterval
        )

    update_data = {"isActive": new_is_active}
    if next_run is not None:
        update_data["nextRun"] = next_run

    updated = await prisma.report.update(where={"id": report_id}, data=update_data)

    return ReportResponse(
        id=updated.id,
        name=updated.name,
        description=updated.description,
        dashboardId=updated.dashboardId,
        format=updated.format,
        scheduleType=updated.scheduleType,
        scheduleCron=updated.scheduleCron,
        scheduleInterval=updated.scheduleInterval,
        recipients=updated.recipients or [],
        isActive=updated.isActive,
        nextRun=updated.nextRun.isoformat() if updated.nextRun else None,
        createdById=updated.createdById,
        organizationId=updated.organizationId,
        createdAt=updated.createdAt.isoformat() if updated.createdAt else "",
        updatedAt=updated.updatedAt.isoformat() if updated.updatedAt else "",
    )


@router.post("/{report_id}/run", response_model=ReportRunResponse)
async def run_report(
    report_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Run a report immediately."""
    org_id = ctx.organization_id

    db_report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not db_report or db_report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    # Create a new report run
    recipient_count = len(db_report.recipients) if db_report.recipients else 0
    run = await prisma.reportrun.create(
        {
            "reportId": report_id,
            "status": "running",
            "recipientCount": recipient_count,
        }
    )

    try:
        from app.services.bi_services.report_exporter import ReportExporter

        result = await ReportExporter.generate_report_file(run.id)

        run = await prisma.reportrun.update(
            where={"id": run.id},
            data={
                "status": "completed",
                "completedAt": datetime.now(timezone.utc),
                "fileUrl": result["file_url"],
                "fileSize": result["file_size"],
            },
        )
    except Exception as e:
        run = await prisma.reportrun.update(
            where={"id": run.id},
            data={
                "status": "failed",
                "completedAt": datetime.now(timezone.utc),
                "errorMessage": str(e),
            },
        )

    # Update next run for scheduled reports
    if db_report.scheduleType != "manual":
        next_run = _calculate_next_run(
            db_report.scheduleType, db_report.scheduleInterval
        )
        await prisma.report.update(where={"id": report_id}, data={"nextRun": next_run})

    return ReportRunResponse(
        id=run.id,
        reportId=run.reportId,
        status=run.status,
        startedAt=run.startedAt.isoformat() if run.startedAt else "",
        completedAt=run.completedAt.isoformat() if run.completedAt else None,
        fileUrl=run.fileUrl,
        fileSize=run.fileSize,
        errorMessage=run.errorMessage,
        recipientCount=run.recipientCount,
    )


@router.get("/{report_id}/runs/{run_id}/download")
async def download_report_run(
    report_id: int,
    run_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Download generated report file for a given ReportRun."""
    from fastapi.responses import Response
    from app.services.bi_services.report_exporter import ReportExporter

    db_report = await prisma.report.find_unique(where={"id": report_id})
    if not db_report or db_report.organizationId != ctx.organization_id:
        raise HTTPException(status_code=404, detail="Report not found")

    run = await prisma.reportrun.find_unique(where={"id": run_id})
    if not run or run.reportId != report_id:
        raise HTTPException(
            status_code=404, detail="Report run not found for this report"
        )

    result = await ReportExporter.generate_report_file(run_id)
    filename = f"report_{report_id}_run_{run_id}.{result['filename_ext']}"

    return Response(
        content=result["file_bytes"],
        media_type=result["content_type"],
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{report_id}/runs", response_model=List[ReportRunResponse])
async def get_report_runs(
    report_id: int,
    status: Optional[str] = Query(
        None, pattern="^(pending|running|completed|failed|cancelled)$"
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get all runs for a report."""
    org_id = ctx.organization_id

    report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not report or report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    where = {"reportId": report_id}
    if status:
        where["status"] = status

    runs = await prisma.reportrun.find_many(
        where=where, skip=offset, take=limit, order={"startedAt": "desc"}
    )

    return [
        ReportRunResponse(
            id=r.id,
            reportId=r.reportId,
            status=r.status,
            startedAt=r.startedAt.isoformat() if r.startedAt else "",
            completedAt=r.completedAt.isoformat() if r.completedAt else None,
            fileUrl=r.fileUrl,
            fileSize=r.fileSize,
            errorMessage=r.errorMessage,
            recipientCount=r.recipientCount,
        )
        for r in runs
    ]


@router.get("/{report_id}/runs/{run_id}", response_model=ReportRunResponse)
async def get_report_run(
    report_id: int,
    run_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific report run."""
    org_id = ctx.organization_id

    report = await prisma.report.find_unique(
        where={"id": report_id},
    )

    if not report or report.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Report not found")

    run = await prisma.reportrun.find_unique(
        where={"id": run_id},
    )

    if not run or run.reportId != report_id:
        raise HTTPException(status_code=404, detail="Report run not found")

    return ReportRunResponse(
        id=run.id,
        reportId=run.reportId,
        status=run.status,
        startedAt=run.startedAt.isoformat() if run.startedAt else "",
        completedAt=run.completedAt.isoformat() if run.completedAt else None,
        fileUrl=run.fileUrl,
        fileSize=run.fileSize,
        errorMessage=run.errorMessage,
        recipientCount=run.recipientCount,
    )


# =============================================================================
# Helper Functions
# =============================================================================


def _calculate_next_run(schedule_type: str, interval: Optional[int] = None) -> datetime:
    """Calculate the next run time based on schedule type."""
    now = datetime.now(timezone.utc)

    if schedule_type == "daily":
        return now + timedelta(days=interval or 1)
    elif schedule_type == "weekly":
        return now + timedelta(weeks=interval or 1)
    elif schedule_type == "monthly":
        # Approximate month as 30 days
        return now + timedelta(days=(interval or 1) * 30)
    elif schedule_type == "cron":
        # For cron, we'd need a cron parser library
        # For now, return None
        return None

    return None
