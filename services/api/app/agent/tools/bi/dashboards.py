"""
BI Dashboard Tools: ListDashboardsTool, GetDashboardWidgetsTool, CreateDashboardTool.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma


class ListDashboardsArgs(BaseModel):
    limit: int = Field(default=10, ge=1, le=50, description="Max dashboards to return")
    query: Optional[str] = Field(
        default=None, description="Search term for dashboard title"
    )


class ListDashboardsTool(BaseTool):
    name = "list_dashboards"
    description = (
        "List analytics dashboards belonging to the current organization or user."
    )
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = ListDashboardsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, ListDashboardsArgs)

        where_clause: Dict[str, Any] = {"deletedAt": None}
        if context.organization_id is not None:
            where_clause["organizationId"] = context.organization_id
        elif context.user_id is not None:
            where_clause["ownerId"] = context.user_id

        if typed_args.query:
            where_clause["title"] = {
                "contains": typed_args.query,
                "mode": "insensitive",
            }

        dashboards = await prisma.dashboard.find_many(
            where=where_clause,
            take=typed_args.limit,
            order={"updatedAt": "desc"},
        )

        results = [
            {
                "id": d.id,
                "title": d.title,
                "description": d.description,
                "is_public": d.isPublic,
                "updated_at": d.updatedAt.isoformat() if d.updatedAt else None,
            }
            for d in dashboards
        ]

        return ToolResult(
            success=True,
            data=results,
            widget_payload={"widgetType": "dashboard_list_card", "dashboards": results},
        )


class GetDashboardWidgetsArgs(BaseModel):
    dashboard_id: int = Field(description="ID of the dashboard")


class GetDashboardWidgetsTool(BaseTool):
    name = "get_dashboard_widgets"
    description = (
        "Retrieve all visual widgets, charts, and metrics configured on a dashboard."
    )
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GetDashboardWidgetsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GetDashboardWidgetsArgs)

        dashboard = await prisma.dashboard.find_unique(
            where={"id": typed_args.dashboard_id}
        )
        if not dashboard or dashboard.deletedAt is not None:
            return ToolResult(
                success=False, error=f"Dashboard {typed_args.dashboard_id} not found"
            )

        # Multi-tenant check
        if not context.has_role("ADMIN"):
            if dashboard.organizationId is not None:
                if context.organization_id != dashboard.organizationId:
                    return ToolResult(
                        success=False, error="Unauthorized access to this dashboard"
                    )
            else:
                if dashboard.ownerId != context.user_id:
                    return ToolResult(
                        success=False, error="Unauthorized access to this dashboard"
                    )

        widgets = await prisma.widget.find_many(
            where={"dashboardId": typed_args.dashboard_id, "deletedAt": None},
            order={"order": "asc"},
        )

        widget_list = [
            {
                "id": w.id,
                "name": w.name,
                "type": str(w.type),
                "config": w.config,
                "dataset_id": w.datasetId,
                "layout": {"w": w.w, "h": w.h, "x": w.x, "y": w.y},
            }
            for w in widgets
        ]

        return ToolResult(
            success=True,
            data={
                "dashboard_id": dashboard.id,
                "title": dashboard.title,
                "widgets": widget_list,
            },
            widget_payload={
                "widgetType": "dashboard_overview_card",
                "dashboardId": dashboard.id,
                "title": dashboard.title,
                "widgetCount": len(widget_list),
                "widgets": widget_list,
            },
        )


class CreateDashboardArgs(BaseModel):
    title: str = Field(
        min_length=2, max_length=120, description="Title of the new dashboard"
    )
    description: Optional[str] = Field(
        default=None, max_length=500, description="Optional description"
    )


class CreateDashboardTool(BaseTool):
    name = "create_dashboard"
    description = "Create a new business intelligence analytics dashboard (HITL-gated)."
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = CreateDashboardArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, CreateDashboardArgs)

        data: Dict[str, Any] = {
            "title": typed_args.title,
            "description": typed_args.description,
            "ownerId": context.user_id,
            "tags": [],
        }
        if context.organization_id is not None:
            data["organizationId"] = context.organization_id

        dashboard = await prisma.dashboard.create(data=data)

        async def rollback_created_dashboard() -> bool:
            try:
                await prisma.dashboard.update(
                    where={"id": dashboard.id},
                    data={"deletedAt": datetime.now(timezone.utc)},
                )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "dashboard_id": dashboard.id,
                "title": dashboard.title,
                "status": "CREATED",
            },
            widget_payload={
                "widgetType": "dashboard_created_card",
                "dashboardId": dashboard.id,
                "title": dashboard.title,
            },
            compensating_action=rollback_created_dashboard,
        )
