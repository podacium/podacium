"""
Widget management routers.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.tenant import TenantContext, get_tenant_context
from app.services.bi_services.widget_service import WidgetService
from app.services.bi_services.errors import BIError
from app.schemas.bi_schemas.dashboard import (
    WidgetCreateDirect,
    WidgetUpdate,
    WidgetPositionUpdate,
)
from app.core.prisma import prisma

router = APIRouter(prefix="/widgets", tags=["BI - Widgets"])


@router.post(
    "",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def create_widget(
    request: WidgetCreateDirect,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Create a widget directly under a dashboard.
    """
    try:
        org_id = ctx.organization_id
        widget = await WidgetService.create_widget(
            request.model_dump(exclude_unset=True),
            organization_id=org_id,
        )
        return widget
    except BIError as e:
        if e.code in ("missing_dashboard_id", "invalid_type"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        elif e.code in ("dashboard_not_found", "dataset_not_found"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        elif e.code == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget creation failed: {str(e)}",
        )


@router.get(
    "/{widget_id}",
    response_model=Dict[str, Any],
    responses={
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def get_widget(
    widget_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get widget details.
    """
    try:
        org_id = ctx.organization_id
        widget = await WidgetService.get_widget(widget_id, organization_id=org_id)
        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="bi.dashboards.errors.widgetNotFound",
            )
        return widget
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="bi.dashboards.errors.widgetError",
        )


@router.put(
    "/{widget_id}",
    response_model=Dict[str, Any],
    responses={
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def update_widget(
    widget_id: int,
    request: WidgetUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Update widget title, chart type, metrics, and grid layout.
    """
    try:
        org_id = ctx.organization_id
        widget = await WidgetService.update_widget(
            widget_id=widget_id,
            data=request.model_dump(exclude_unset=True),
            organization_id=org_id,
        )
        return widget
    except BIError as e:
        if e.code in ("widget_not_found", "dataset_not_found"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        elif e.code == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget update failed: {str(e)}",
        )


@router.patch(
    "/{widget_id}/position",
    response_model=Dict[str, Any],
    responses={
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def update_widget_position(
    widget_id: int,
    position: WidgetPositionUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Lightweight endpoint for drag-and-drop grid coordinate updates.
    """
    try:
        org_id = ctx.organization_id
        widget = await WidgetService.update_widget_position(
            widget_id=widget_id,
            position=position.model_dump(exclude_unset=True),
            organization_id=org_id,
        )
        return widget
    except BIError as e:
        if e.code == "widget_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        elif e.code == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Widget position update failed: {str(e)}",
        )


@router.get(
    "/{widget_id}/data",
    response_model=List[Dict[str, Any]],
    responses={
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def get_widget_data(
    widget_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get data for a specific widget.
    """
    try:
        org_id = ctx.organization_id
        data = await WidgetService.get_widget_data(widget_id, organization_id=org_id)
        return data
    except Exception as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=404, detail="bi.dashboards.errors.widgetNotFound"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="bi.dashboards.errors.widgetError",
        )


@router.delete(
    "/{widget_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_widget(
    widget_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Delete a widget (soft delete).
    """
    try:
        org_id = ctx.organization_id
        # Check ownership/access
        widget = await prisma.widget.find_unique(
            where={"id": widget_id}, include={"dashboard": True}
        )
        if not widget or widget.deletedAt is not None:
            raise HTTPException(
                status_code=404, detail="bi.dashboards.errors.widgetNotFound"
            )

        # Strict check: User must belong to the organization that owns the dashboard
        if widget.dashboard and widget.dashboard.organizationId != org_id:
            raise HTTPException(status_code=403, detail="Unauthorized widget deletion")

        await prisma.widget.update(
            where={"id": widget_id},
            data={"deletedAt": datetime.now(timezone.utc)},
        )
        return {"success": True, "message": "bi.dashboards.success.widgetDeleted"}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="bi.dashboards.errors.widgetError",
        )
