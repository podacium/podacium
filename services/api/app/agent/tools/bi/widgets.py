"""
BI Widget Tools: AddChartWidgetTool.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.generated.prisma.enums import WidgetType


class AddChartWidgetArgs(BaseModel):
    dashboard_id: int = Field(description="Target dashboard ID")
    name: str = Field(min_length=2, max_length=100, description="Widget display name")
    widget_type: str = Field(
        default="BAR", description="Type: KPI, BAR, LINE, AREA, PIE, TABLE, CHART"
    )
    dataset_id: Optional[int] = Field(
        default=None, description="Optional dataset ID backing this widget"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Widget configuration / query / series config"
    )


class AddChartWidgetTool(BaseTool):
    name = "add_chart_widget"
    description = "Add a new chart or analytical metric widget to a dashboard."
    domain = ToolDomain.BI
    access_roles = ["ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = False
    args_schema: Type[BaseModel] = AddChartWidgetArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, AddChartWidgetArgs)

        dashboard = await prisma.dashboard.find_unique(
            where={"id": typed_args.dashboard_id}
        )
        if not dashboard or dashboard.deletedAt is not None:
            return ToolResult(
                success=False, error=f"Dashboard {typed_args.dashboard_id} not found"
            )

        if (
            context.organization_id
            and dashboard.organizationId != context.organization_id
        ):
            if not context.has_role("ADMIN"):
                return ToolResult(
                    success=False, error="Unauthorized access to dashboard"
                )

        try:
            wt = WidgetType(typed_args.widget_type.upper())
        except Exception:
            wt = WidgetType.CHART

        # Determine widget order
        existing_count = await prisma.widget.count(
            where={"dashboardId": typed_args.dashboard_id, "deletedAt": None}
        )

        widget_data: Dict[str, Any] = {
            "dashboardId": typed_args.dashboard_id,
            "name": typed_args.name,
            "type": wt,
            "config": typed_args.config,
            "order": existing_count,
            "w": 6,
            "h": 4,
            "x": (existing_count * 6) % 12,
            "y": (existing_count // 2) * 4,
        }
        if typed_args.dataset_id:
            widget_data["datasetId"] = typed_args.dataset_id

        created_widget = await prisma.widget.create(data=widget_data)

        async def rollback_widget() -> bool:
            try:
                await prisma.widget.update(
                    where={"id": created_widget.id},
                    data={"deletedAt": datetime.now(timezone.utc)},
                )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "widget_id": created_widget.id,
                "dashboard_id": created_widget.dashboardId,
                "name": created_widget.name,
                "type": str(created_widget.type),
            },
            widget_payload={
                "widgetType": "chart_widget_added_card",
                "widgetId": created_widget.id,
                "dashboardId": created_widget.dashboardId,
                "widgetName": created_widget.name,
            },
            compensating_action=rollback_widget,
        )
