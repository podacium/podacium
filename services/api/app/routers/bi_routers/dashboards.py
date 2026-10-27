import logging

logger = logging.getLogger(__name__)
"""
Dashboard management routers.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.generated.prisma import Json

from app.core.tenant import TenantContext, get_tenant_context
from app.core.prisma import prisma
from app.schemas.bi_schemas.common import BaseResponse
from app.schemas.bi_schemas.dashboard import (
    DashboardCreate,
    DashboardListResponse,
    DashboardMetadata,
    DashboardResponse,
    DashboardUpdate,
    GenerateDashboardRequest,
    WidgetCreate,
)
from app.schemas.bi_schemas.views import ViewType
from app.services.bi_services import (
    DashboardService,
    IngestionService,
)
from app.services.bi_services.errors import DatasetNotFoundError

router = APIRouter(prefix="/dashboards", tags=["BI - Dashboards"])


@router.post(
    "",
    response_model=DashboardResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": dict},
        500: {"model": dict},
    },
)
async def create_dashboard(
    request: DashboardCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Create a new dashboard.

    - **name**: Dashboard name
    - **description**: Dashboard description
    - **layout_type**: Grid layout type
    - **dataset_id**: Optional linked dataset
    - **is_public**: Whether dashboard is public
    - **tags**: Dashboard tags
    - **config**: Dashboard configuration
    """
    try:
        org_id = ctx.organization_id

        # Create dashboard
        dashboard = await DashboardService.create_dashboard(
            name=request.title or request.name,
            description=request.description,
            organization_id=org_id,
            user_id=ctx.user_id,
            dataset_id=request.dataset_id,
            is_public=request.is_public,
            tags=request.tags,
        )

        # Update config if provided
        if request.config:
            dashboard["config"] = request.config.model_dump()
            try:
                await prisma.dashboard.update(
                    where={"id": dashboard["id"]},
                    data={"config": Json(request.config.model_dump())},
                )
            except Exception as db_error:
                logger.error(f"Operation failed: {db_error}")

        return DashboardResponse(
            dashboard=DashboardMetadata(**dashboard),
            message="bi.dashboards.success.created",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.createFailed",
                "type": "dashboard_creation_error",
                "errors": [str(e)],
            },
        )


@router.post(
    "/generate",
    response_model=DashboardResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def generate_auto_dashboard(
    request: GenerateDashboardRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Auto-generate dashboard from dataset.
    """
    try:
        org_id = ctx.organization_id

        # Get dataset
        try:
            dataset = await IngestionService.get_dataset(
                dataset_id=request.dataset_id,
                organization_id=str(org_id),
                user_id=str(ctx.user_id),
            )
        except DatasetNotFoundError:
            db_dataset = await prisma.dataset.find_unique(
                where={"id": request.dataset_id}
            )
            if not db_dataset or db_dataset.organizationId != org_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "detail": "bi.datasets.error.notFound",
                        "type": "dataset_not_found",
                    },
                )

            dataset = {
                "dataset_id": db_dataset.id,
                "name": db_dataset.name,
                "records": [],
                "columns": db_dataset.columns,
                "row_count": db_dataset.rowCount,
                "column_count": db_dataset.columnCount,
            }

        if not dataset.get("records"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "bi.dashboards.errors.emptyDataset",
                    "type": "empty_dataset",
                },
            )

        dashboard = await DashboardService.generate_auto_dashboard(
            dataset_id=request.dataset_id,
            name=request.name
            or f"Dashboard for {dataset.get('name', request.dataset_id)}",
            description=request.description
            or f"Auto-generated from {dataset.get('name', 'dataset')}",
            organization_id=org_id,
            user_id=ctx.user_id,
            dataset_data=dataset,
        )

        return DashboardResponse(
            dashboard=DashboardMetadata(**dashboard),
            widgets=dashboard.get("widgets", []),
            message="bi.dashboards.success.generated",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.generateFailed",
                "type": "dashboard_generation_error",
                "errors": [str(e)],
            },
        )


@router.get(
    "/{dashboard_id}",
    response_model=DashboardResponse,
    responses={
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def get_dashboard(
    dashboard_id: int,
    include_data: bool = Query(False, description="Include widget data"),
    view: ViewType = Query(
        ViewType.EXECUTIVE, description="View type: executive or analyst"
    ),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Get dashboard with widgets.
    """
    try:
        org_id = ctx.organization_id

        dashboard = await DashboardService.get_dashboard(
            dashboard_id=dashboard_id,
            organization_id=org_id,
            user_id=ctx.user_id,
            include_data=include_data,
        )

        return DashboardResponse(
            dashboard=DashboardMetadata(**dashboard),
            widgets=dashboard.get("widgets", []),
            config=dashboard.get("config", {}),
            message="bi.dashboards.success.retrieved",
        )

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "detail": str(e),
                    "type": "dashboard_not_found",
                },
            )
        elif "Permission denied" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "Access to dashboard denied",
                    "type": "access_denied",
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": str(e),
                    "type": "dashboard_error",
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.loadFailed",
                "type": "dashboard_fetch_error",
                "errors": [str(e)],
            },
        )


@router.get(
    "",
    response_model=DashboardListResponse,
    responses={500: {"model": dict}},
)
async def list_dashboards(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    is_public: Optional[bool] = Query(None, description="Filter by public status"),
    dataset_id: Optional[str] = Query(None, description="Filter by dataset"),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    List dashboards for organization.
    """
    try:
        org_id = ctx.organization_id

        result = await DashboardService.list_dashboards(
            organization_id=org_id,
            user_id=ctx.user_id,
            page=page,
            per_page=per_page,
            tags=tags,
            is_public=is_public,
        )

        if dataset_id:
            filtered_dashboards = [
                d for d in result["dashboards"] if d.get("datasetId") == dataset_id
            ]
            result["dashboards"] = filtered_dashboards
            result["total"] = len(filtered_dashboards)
            result["has_more"] = False

        return DashboardListResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.listFailed",
                "type": "dashboard_list_error",
                "errors": [str(e)],
            },
        )


@router.put(
    "/{dashboard_id}",
    response_model=DashboardResponse,
    responses={
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def update_dashboard(
    dashboard_id: int,
    request: DashboardUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Update dashboard.
    """
    try:
        org_id = ctx.organization_id

        updates = {}
        if request.title is not None or request.name is not None:
            updates["name"] = request.title or request.name
        if request.description is not None:
            updates["description"] = request.description
        if request.layout_type is not None:
            updates["layout_type"] = request.layout_type.value
        if request.is_public is not None:
            updates["is_public"] = request.is_public
        if request.tags is not None:
            updates["tags"] = request.tags
        if request.config is not None:
            updates["config"] = request.config.model_dump()
        if request.widgets is not None:
            updates["widgets"] = request.widgets

        await DashboardService.update_dashboard(
            dashboard_id=dashboard_id,
            updates=updates,
            organization_id=org_id,
            user_id=ctx.user_id,
        )

        dashboard = await DashboardService.get_dashboard(
            dashboard_id=dashboard_id, organization_id=org_id, user_id=ctx.user_id
        )

        return DashboardResponse(
            dashboard=DashboardMetadata(**dashboard),
            widgets=dashboard.get("widgets", []),
            config=dashboard.get("config", {}),
            message="bi.dashboards.success.updated",
        )

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "detail": "bi.dashboards.errors.notFound",
                    "type": "dashboard_not_found",
                },
            )
        elif "Permission denied" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "bi.dashboards.errors.accessDenied",
                    "type": "access_denied",
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "bi.dashboards.errors.updateFailed",
                    "type": "dashboard_error",
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.updateFailed",
                "type": "dashboard_update_error",
                "errors": [str(e)],
            },
        )


@router.delete(
    "/{dashboard_id}",
    responses={
        200: {"model": BaseResponse},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def delete_dashboard(
    dashboard_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Delete dashboard.
    """
    try:
        org_id = ctx.organization_id

        success = await DashboardService.delete_dashboard(
            dashboard_id=dashboard_id, organization_id=org_id, user_id=ctx.user_id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "detail": "bi.dashboards.errors.notFoundOrPrivilege",
                    "type": "dashboard_not_found",
                },
            )

        return BaseResponse(
            success=True,
            message="bi.dashboards.success.deleted",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.deleteFailed",
                "type": "dashboard_delete_error",
                "errors": [str(e)],
            },
        )


@router.post(
    "/{dashboard_id}/widgets",
    responses={
        201: {"model": dict},
        400: {"model": dict},
        403: {"model": dict},
        404: {"model": dict},
        500: {"model": dict},
    },
)
async def add_widget_to_dashboard(
    dashboard_id: int,
    request: WidgetCreate,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Add widget to dashboard.
    """
    try:
        org_id = ctx.organization_id

        widget_config = {
            "title": request.title,
            "description": request.description,
            "visualization": {
                "type": request.visualization_type,
                **request.visualization_config,
            },
            "data_source": request.data_source.model_dump(),
            "filters": {},
            "style": request.style.model_dump() if request.style else {},
            "interactivity": request.interactivity.model_dump()
            if request.interactivity
            else {},
        }

        widget = await DashboardService.add_widget_to_dashboard(
            dashboard_id=dashboard_id,
            widget_type=request.type.value,
            widget_config=widget_config,
            organization_id=org_id,
            user_id=ctx.user_id,
            position=request.position.model_dump() if request.position else None,
        )

        return {
            "success": True,
            "widget": widget,
            "message": "bi.dashboards.success.widgetAdded",
        }

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "detail": "bi.dashboards.errors.notFound",
                    "type": "dashboard_not_found",
                },
            )
        elif "Permission denied" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": "bi.dashboards.errors.accessDenied",
                    "type": "access_denied",
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "bi.dashboards.errors.widgetError",
                    "type": "widget_error",
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": "bi.dashboards.errors.widgetAddFailed",
                "type": "widget_creation_error",
                "errors": [str(e)],
            },
        )


from app.schemas.bi_schemas.dashboard import WidgetReorderRequest


@router.post(
    "/{dashboard_id}/widgets/reorder",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
)
@router.put(
    "/{dashboard_id}/widgets/reorder",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
)
async def reorder_widgets(
    dashboard_id: int,
    request: WidgetReorderRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Batch reorder and re-position widgets on a dashboard.
    """
    org_id = ctx.organization_id
    dashboard = await prisma.dashboard.find_unique(where={"id": dashboard_id})
    if not dashboard or dashboard.deletedAt is not None:
        raise HTTPException(status_code=404, detail="bi.dashboards.errors.notFound")
    if dashboard.organizationId != org_id:
        raise HTTPException(status_code=403, detail="bi.dashboards.errors.accessDenied")

    for item in request.widgets:
        update_data: Dict[str, Any] = {"order": item.order}
        if item.x is not None:
            update_data["x"] = item.x
        if item.y is not None:
            update_data["y"] = item.y
        if item.w is not None:
            update_data["w"] = item.w
        if item.h is not None:
            update_data["h"] = item.h

        await prisma.widget.update_many(
            where={"id": item.id, "dashboardId": dashboard_id},
            data=update_data,
        )

    return {"success": True, "message": "bi.dashboards.success.widgetsReordered"}
