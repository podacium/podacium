"""
Widget Service
Handles widget data retrieval and query execution.
"""

from typing import Any, Dict, Optional
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.bi_services.errors import BIError
from app.services.bi_services.query_engine import QueryEngine


class WidgetService:
    """Service for managing dashboard widgets and their data"""

    @staticmethod
    def format_widget(widget: Any) -> Dict[str, Any]:
        """Format a Prisma widget record into standardized API response"""
        config = widget.config if isinstance(widget.config, dict) else {}
        w_type = (
            widget.type.name.lower()
            if hasattr(widget.type, "name")
            else str(widget.type).lower()
        )
        title = widget.name or config.get("title", f"Widget {widget.id}")
        return {
            "id": widget.id,
            "dashboard_id": widget.dashboardId,
            "dataset_id": widget.datasetId,
            "semantic_model_id": getattr(widget, "semanticModelId", None),
            "type": w_type,
            "title": title,
            "name": title,
            "description": widget.description or config.get("description"),
            "data_source": config.get(
                "data_source",
                {
                    "type": "dataset",
                    "dataset_id": str(widget.datasetId) if widget.datasetId else None,
                },
            ),
            "visualization": config.get("visualization", {}),
            "position": {
                "x": widget.x,
                "y": widget.y,
                "w": widget.w,
                "h": widget.h,
                "minW": widget.minW,
                "minH": widget.minH,
            },
            "x": widget.x,
            "y": widget.y,
            "w": widget.w,
            "h": widget.h,
            "minW": widget.minW,
            "minH": widget.minH,
            "order": widget.order,
            "style": config.get("style", {}),
            "interactivity": config.get("interactivity", {}),
            "filters": config.get("filters", {}),
            "config": config,
            "created_at": widget.createdAt,
            "updated_at": widget.updatedAt,
        }

    @staticmethod
    async def get_widget(
        widget_id: int, organization_id: int
    ) -> Optional[Dict[str, Any]]:
        """Get widget metadata"""
        widget = await prisma.widget.find_unique(
            where={"id": widget_id}, include={"dashboard": True, "dataset": True}
        )

        if not widget or widget.deletedAt is not None:
            return None

        # Security check: organizationId mismatch
        if widget.dashboard and widget.dashboard.organizationId != int(organization_id):
            return None

        return WidgetService.format_widget(widget)

    @staticmethod
    async def create_widget(
        data: Dict[str, Any], organization_id: int
    ) -> Dict[str, Any]:
        """Create a new widget with tenant validation"""
        dashboard_id = data.get("dashboard_id") or data.get("dashboardId")
        if not dashboard_id:
            raise BIError("dashboard_id is required", "missing_dashboard_id")

        dashboard = await prisma.dashboard.find_unique(where={"id": int(dashboard_id)})
        if not dashboard or dashboard.deletedAt is not None:
            raise BIError(f"Dashboard {dashboard_id} not found", "dashboard_not_found")

        if dashboard.organizationId != int(organization_id):
            raise BIError("Unauthorized dashboard access", "unauthorized")

        dataset_id = data.get("dataset_id") or data.get("datasetId")
        if dataset_id:
            dataset = await prisma.dataset.find_unique(where={"id": int(dataset_id)})
            if not dataset or dataset.deletedAt is not None:
                raise BIError(f"Dataset {dataset_id} not found", "dataset_not_found")
            if dataset.organizationId and dataset.organizationId != int(
                organization_id
            ):
                raise BIError("Unauthorized dataset access", "unauthorized")

        # Type normalization
        raw_type = str(data.get("type", "chart")).upper()
        # Fallback if invalid
        valid_types = {
            "KPI",
            "METRIC",
            "BAR",
            "LINE",
            "AREA",
            "PIE",
            "SCATTER",
            "BUBBLE",
            "HISTOGRAM",
            "TABLE",
            "HEATMAP",
            "SANKEY",
            "RADAR",
            "FUNNEL",
            "MAP",
            "TREEMAP",
            "GAUGE",
            "CUSTOM",
            "CHART",
        }
        if raw_type not in valid_types:
            raw_type = "CHART"

        # Position handling
        pos = data.get("position") or {}
        x = pos.get("x", data.get("x", 0))
        y = pos.get("y", data.get("y", 0))
        w = pos.get("w", data.get("w", 4))
        h = pos.get("h", data.get("h", 4))
        min_w = pos.get("minW", data.get("minW"))
        min_h = pos.get("minH", data.get("minH"))

        title = data.get("title") or data.get("name") or "New Widget"
        description = data.get("description")

        # Build config object
        raw_cfg = data.get("config")
        config: Dict[str, Any] = dict(raw_cfg) if isinstance(raw_cfg, dict) else {}
        if "data_source" in data and isinstance(data["data_source"], dict):
            config["data_source"] = data["data_source"]
        elif dataset_id and "data_source" not in config:
            config["data_source"] = {"type": "dataset", "dataset_id": str(dataset_id)}

        if "visualization" in data and isinstance(data["visualization"], dict):
            config["visualization"] = data["visualization"]
        elif "visualization_type" in data:
            vis_cfg = data.get("visualization_config")
            vis_dict: Dict[str, Any] = (
                dict(vis_cfg) if isinstance(vis_cfg, dict) else {}
            )
            vis_data: Dict[str, Any] = {"type": data["visualization_type"]}
            vis_data.update(vis_dict)
            config["visualization"] = vis_data

        if "style" in data and isinstance(data["style"], dict):
            config["style"] = data["style"]
        if "interactivity" in data and isinstance(data["interactivity"], dict):
            config["interactivity"] = data["interactivity"]
        if "filters" in data and isinstance(data["filters"], dict):
            config["filters"] = data["filters"]

        created = await prisma.widget.create(
            data={
                "dashboardId": int(dashboard_id),
                "datasetId": int(dataset_id) if dataset_id else None,
                "name": title,
                "description": description,
                "type": raw_type,
                "config": Json(config),
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
                "minW": int(min_w) if min_w is not None else None,
                "minH": int(min_h) if min_h is not None else None,
                "order": int(data.get("order", 0)),
            }
        )

        return WidgetService.format_widget(created)

    @staticmethod
    async def update_widget(
        widget_id: int, data: Dict[str, Any], organization_id: int
    ) -> Dict[str, Any]:
        """Update widget with tenant ownership verification"""
        widget = await prisma.widget.find_unique(
            where={"id": widget_id}, include={"dashboard": True}
        )
        if not widget or widget.deletedAt is not None:
            raise BIError(f"Widget {widget_id} not found", "widget_not_found")

        if widget.dashboard and widget.dashboard.organizationId != int(organization_id):
            raise BIError("Unauthorized widget update", "unauthorized")

        update_fields: Dict[str, Any] = {}

        if "title" in data and data["title"] is not None:
            update_fields["name"] = data["title"]
        elif "name" in data and data["name"] is not None:
            update_fields["name"] = data["name"]

        if "description" in data:
            update_fields["description"] = data["description"]

        if "type" in data and data["type"] is not None:
            t = str(data["type"]).upper()
            valid_types = {
                "KPI",
                "METRIC",
                "BAR",
                "LINE",
                "AREA",
                "PIE",
                "SCATTER",
                "BUBBLE",
                "HISTOGRAM",
                "TABLE",
                "HEATMAP",
                "SANKEY",
                "RADAR",
                "FUNNEL",
                "MAP",
                "TREEMAP",
                "GAUGE",
                "CUSTOM",
                "CHART",
            }
            if t in valid_types:
                update_fields["type"] = t

        if "dataset_id" in data:
            new_dataset_id = data["dataset_id"]
            if new_dataset_id:
                dataset = await prisma.dataset.find_unique(
                    where={"id": int(new_dataset_id)}
                )
                if not dataset or dataset.deletedAt is not None:
                    raise BIError(
                        f"Dataset {new_dataset_id} not found", "dataset_not_found"
                    )
                if dataset.organizationId and dataset.organizationId != int(
                    organization_id
                ):
                    raise BIError("Unauthorized dataset access", "unauthorized")
            update_fields["datasetId"] = int(new_dataset_id) if new_dataset_id else None

        pos = data.get("position") or {}
        for key in ["x", "y", "w", "h", "minW", "minH"]:
            val = pos.get(key) if key in pos else data.get(key)
            if val is not None:
                update_fields[key] = int(val)

        if "order" in data and data["order"] is not None:
            update_fields["order"] = int(data["order"])

        # Merge config
        existing_config: Dict[str, Any] = (
            dict(widget.config) if isinstance(widget.config, dict) else {}
        )
        raw_new_cfg = data.get("config")
        new_config: Dict[str, Any] = (
            dict(raw_new_cfg) if isinstance(raw_new_cfg, dict) else {}
        )
        merged_config: Dict[str, Any] = {**existing_config, **new_config}

        for sub_key in [
            "data_source",
            "visualization",
            "style",
            "interactivity",
            "filters",
        ]:
            if sub_key in data and isinstance(data[sub_key], dict):
                merged_config[sub_key] = data[sub_key]

        if "visualization_type" in data and data["visualization_type"]:
            vis = merged_config.get("visualization", {})
            vis_dict: Dict[str, Any] = dict(vis) if isinstance(vis, dict) else {}
            vis_dict["type"] = data["visualization_type"]
            vis_cfg = data.get("visualization_config")
            if isinstance(vis_cfg, dict):
                vis_dict.update(vis_cfg)
            merged_config["visualization"] = vis_dict

        update_fields["config"] = Json(merged_config)

        updated = await prisma.widget.update(
            where={"id": widget_id},
            data=update_fields,
        )

        # Invalidate cache
        try:
            from app.services.bi_services.bi_cache_service import BICacheService

            await BICacheService.invalidate_widget_cache(widget_id)
        except Exception:
            pass

        return WidgetService.format_widget(updated)

    @staticmethod
    async def update_widget_position(
        widget_id: int, position: Dict[str, Any], organization_id: int
    ) -> Dict[str, Any]:
        """Lightweight update for drag & drop grid layout"""
        return await WidgetService.update_widget(
            widget_id, {"position": position}, organization_id
        )

    @staticmethod
    async def get_widget_data(widget_id: int, organization_id: int) -> Any:
        """
        Get data for a specific widget.
        """
        widget = await prisma.widget.find_unique(
            where={"id": widget_id}, include={"dataset": True, "dashboard": True}
        )

        if not widget:
            raise BIError(f"Widget {widget_id} not found", "widget_not_found")

        # Security check: organizationId mismatch
        if widget.dashboard.organizationId != int(organization_id):
            raise BIError("Unauthorized widget data access", "unauthorized")

        if not widget.dataset:
            raise BIError("Widget has no associated dataset", "missing_dataset")

        file_path = widget.dataset.filePath
        if not file_path:
            raise BIError("Dataset file not found", "missing_file")

        config = widget.config or {}

        # 0. Check Redis Cache
        from app.services.bi_services.bi_cache_service import BICacheService

        cached_data = await BICacheService.get_cached_widget_data(widget_id, config)
        if cached_data is not None:
            return cached_data

        data_source = config.get("data_source", {})
        visualization = config.get("visualization", {})

        # 1. Check for raw query
        if data_source.get("query"):
            result = await QueryEngine.query_dataset_with_rls(
                file_path,
                data_source["query"],
                dataset_id=widget.dataset.id,
                organization_id=int(organization_id),
            )
            await BICacheService.set_cached_widget_data(widget_id, config, result)
            return result

        # 2. Check for configured aggregations
        # Enhanced to support multiple series/metrics from visualization or data_source
        x_axis = visualization.get("xAxis") or data_source.get("xAxis")

        # Multiple metrics support
        metrics = visualization.get("metrics") or data_source.get("metrics")

        # Legacy single metric fallback
        y_axis = visualization.get("yAxis") or data_source.get("yAxis")
        aggregation = visualization.get("aggregation") or data_source.get("aggregation")

        if x_axis and (metrics or (y_axis and aggregation)):
            result = QueryEngine.compute_aggregations(
                file_path=file_path,
                group_by=x_axis,
                agg_col=y_axis,
                agg_func=aggregation,
                metrics=metrics,
                filters=config.get("filters"),
                sort_by=visualization.get("sortBy"),
                sort_desc=visualization.get("sortDesc", True),
                limit=visualization.get("limit", 100),
            )
            await BICacheService.set_cached_widget_data(widget_id, config, result)
            return result

        # 3. Default: Preview first 100 rows
        result = await QueryEngine.query_dataset_with_rls(
            file_path,
            None,
            dataset_id=widget.dataset.id,
            organization_id=int(organization_id),
        )
        await BICacheService.set_cached_widget_data(widget_id, config, result)
        return result
