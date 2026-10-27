import logging

logger = logging.getLogger(__name__)
"""
Dashboard Service
Creates and manages BI dashboards with multiple visualizations.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.bi_services.visualization_service import VisualizationService
from app.services.bi_services.errors import BIError


class DashboardError(BIError):
    """Dashboard-specific errors"""
    pass


class DashboardService:
    """Service for creating and managing dashboards"""
    
    @classmethod
    async def create_dashboard(
        cls,
        name: str,
        description: Optional[str],
        organization_id: int,
        user_id: int,
        dataset_id: Optional[int] = None,
        layout_type: str = "grid",
        is_public: bool = False,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a new dashboard"""
        try:
            db_dashboard = await prisma.dashboard.create(
                data={
                    "title": name,
                    "description": description,
                    "organizationId": organization_id,
                    "ownerId": user_id,
                    "layout": Json({}),
                    "theme": Json({"palette": "default"}),
                    "isPublic": is_public,
                    "tags": tags or [],
                }
            )
            
            try:
                from app.middleware.metrics import FLYWHEEL_FREELANCING_TO_BI
                completed_projects = await prisma.contract.count(
                    where={"freelancerId": user_id, "status": "COMPLETED"}
                )
                if completed_projects > 0:
                    FLYWHEEL_FREELANCING_TO_BI.inc()
            except Exception:
                pass

            # Return formatted data matching the schema
            return {
                "id": db_dashboard.id,
                "title": db_dashboard.title,
                "description": db_dashboard.description,
                "organization_id": db_dashboard.organizationId,
                "owner_id": db_dashboard.ownerId,
                "created_at": db_dashboard.createdAt,
                "updated_at": db_dashboard.updatedAt,
                "is_public": db_dashboard.isPublic,
                "tags": db_dashboard.tags,
                "widgets": []
            }
        except Exception as db_error:
            logger.exception("Failed to create dashboard: %s", str(db_error))
            raise DashboardError(f"Failed to create dashboard: {str(db_error)}") from db_error
    
    @classmethod
    async def add_widget_to_dashboard(
        cls,
        dashboard_id: int,
        widget_type: str,
        widget_config: Dict[str, Any],
        organization_id: int,
        user_id: int,
        position: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """Add a widget to dashboard"""
        try:
            # Verify dashboard exists and user has access
            db_dashboard = await prisma.dashboard.find_unique(
                where={"id": dashboard_id}
            )
            
            if not db_dashboard:
                raise DashboardError(f"Dashboard {dashboard_id} not found")
            
            if db_dashboard.organizationId != organization_id:
                raise DashboardError("Permission denied: Organization mismatch")

            # Create widget entry in database
            db_widget = await prisma.widget.create(
                data={
                    "dashboardId": dashboard_id,
                    "type": widget_type.upper(),
                    "config": Json(widget_config),
                    "order": 0 # Default order
                }
            )
            
            return {
                "id": db_widget.id,
                "type": db_widget.type,
                "config": widget_config,
                "createdAt": db_widget.createdAt,
                "updatedAt": db_widget.updatedAt
            }
        except Exception as db_error:
            logger.exception("Failed to add widget: %s", str(db_error))
            raise DashboardError(f"Failed to add widget: {str(db_error)}") from db_error
        
        # The previous logic of updating a 'widgets' JSON field was incorrect 
        # as 'widgets' is a relation in the current schema. 
        # Widgets are already created and linked via 'dashboardId'.
        return {
            "id": db_widget.id,
            "type": db_widget.type,
            "config": widget_config,
            "createdAt": db_widget.createdAt,
            "updatedAt": db_widget.updatedAt
        }
    
    @classmethod
    async def generate_auto_dashboard(
        cls,
        dataset_id: str,
        name: str,
        description: Optional[str],
        organization_id: int,
        user_id: int,
        dataset_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Automatically generate a dashboard from dataset"""
        # Create dashboard
        dashboard = await cls.create_dashboard(
            name=name or f"Dashboard for {dataset_id}",
            description=description or "Automatically generated dashboard",
            organization_id=organization_id,
            user_id=user_id,
            dataset_id=dataset_id,
            layout_type="grid",
            is_public=False,
            tags=["auto-generated", "dataset"]
        )
        
        # Get data and analytics
        records = dataset_data.get("records", [])
        columns = dataset_data.get("columns", [])
        
        # Get analytics result if available
        analytics_result = dataset_data.get("analytics_result")
        
        # Auto-generate visualizations
        visualizations = VisualizationService.auto_generate_visualizations(
            data=records,
            columns=columns,
            analytics_result=analytics_result
        )
        
        # Add each visualization as a widget
        positions = [
            {"x": 0, "y": 0, "w": 4, "h": 3},   # Top-left: Metric card
            {"x": 4, "y": 0, "w": 4, "h": 3},   # Top-middle: Metric card
            {"x": 8, "y": 0, "w": 4, "h": 3},   # Top-right: Metric card
            {"x": 0, "y": 3, "w": 6, "h": 5},   # Middle-left: Bar/Line chart
            {"x": 6, "y": 3, "w": 6, "h": 5},   # Middle-right: Pie chart
            {"x": 0, "y": 8, "w": 12, "h": 5},  # Bottom: Scatter/Histogram
        ]
        
        for i, viz in enumerate(visualizations[:6]):  # Limit to 6 widgets
            if i < len(positions):
                position = positions[i]
            else:
                # Calculate grid position
                row = (i - 6) // 3
                col = (i - 6) % 3
                position = {
                    "x": col * 4,
                    "y": 8 + (row * 4),
                    "w": 4,
                    "h": 4
                }
            
            widget_config = {
                "title": viz.get("title", f"Widget {i+1}"),
                "visualization": viz,
                "data_source": {
                    "dataset_id": dataset_id,
                    "type": "dataset"
                },
                "filters": {},
                "style": {
                    "background_color": "#FFFFFF",
                    "border_radius": "8px",
                    "padding": "16px",
                    "box_shadow": "0 1px 3px rgba(0,0,0,0.1)"
                },
                "interactivity": {
                    "clickable": True,
                    "drilldown": True,
                    "tooltip": True
                }
            }
            
            await cls.add_widget_to_dashboard(
                dashboard_id=dashboard["id"],
                widget_type=viz["type"],
                widget_config=widget_config,
                organization_id=organization_id,
                user_id=user_id,
                position=position
            )
        
        # Get updated dashboard with widgets
        try:
            db_dashboard = await prisma.dashboard.find_unique(
                where={"id": dashboard["id"]},
                include={"createdBy": True, "dataset": True}
            )
            
            if db_dashboard:
                # Widgets are a relation, already included or fetched separately
                dashboard["widgets"] = [] # Populated by the caller if needed
                # config is a Json field, handled by the client
                dashboard["config"] = db_dashboard.config
                dashboard["widget_count"] = await prisma.widget.count(where={"dashboardId": dashboard["id"]})
        except Exception as db_error:
            logger.exception("Failed to enrich dashboard: %s", str(db_error))
        
        return dashboard
    
    @classmethod
    async def get_dashboard(
        cls,
        dashboard_id: int,
        organization_id: int,
        user_id: int,
        include_data: bool = False
    ) -> Dict[str, Any]:
        """Get dashboard with widgets"""
        try:
            db_dashboard = await prisma.dashboard.find_unique(
                where={"id": dashboard_id},
                include={"ownerUser": True, "widgets": True}
            )
            
            if not db_dashboard:
                raise DashboardError(f"Dashboard {dashboard_id} not found")
            
            # Check permissions - allow access if public or same org
            if db_dashboard.organizationId != organization_id and not db_dashboard.isPublic:
                raise DashboardError("Permission denied: Organization mismatch")
            
            dashboard_data = {
                "id": db_dashboard.id,
                "title": db_dashboard.title,
                "description": db_dashboard.description,
                "organization_id": db_dashboard.organizationId,
                "owner_id": db_dashboard.ownerId,
                "created_at": db_dashboard.createdAt,
                "updated_at": db_dashboard.updatedAt,
                "is_public": db_dashboard.isPublic,
                "tags": db_dashboard.tags,
                "widgets": [
                    {
                        "id": w.id,
                        "type": w.type.lower() if hasattr(w.type, 'lower') else str(w.type).lower(),
                        "title": w.name or (json.loads(w.config) if isinstance(w.config, str) else w.config or {}).get("title"),
                        "description": w.description,
                        "position": {
                            "x": w.x,
                            "y": w.y,
                            "w": w.w,
                            "h": w.h,
                            "minW": w.minW,
                            "minH": w.minH
                        },
                        "config": json.loads(w.config) if isinstance(w.config, str) else w.config or {},
                        # Merge nested config for compatibility
                        **(json.loads(w.config) if isinstance(w.config, str) else w.config or {})
                    }
                    for w in db_dashboard.widgets
                ],
                "layout": json.loads(db_dashboard.layout) if isinstance(db_dashboard.layout, str) else db_dashboard.layout,
                "theme": json.loads(db_dashboard.theme) if isinstance(db_dashboard.theme, str) else db_dashboard.theme,
            }
            
            if db_dashboard.ownerUser:
                dashboard_data["owner"] = {
                    "id": db_dashboard.ownerUser.id,
                    "name": db_dashboard.ownerUser.fullName
                }
            
            return dashboard_data
            
        except DashboardError:
            raise
        except Exception as e:
            logger.exception("Error getting dashboard: %s", str(e))
            raise DashboardError(f"Error getting dashboard: {str(e)}") from e
    
    @classmethod
    async def list_dashboards(
        cls,
        organization_id: int,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
        tags: Optional[List[str]] = None,
        is_public: Optional[bool] = None
    ) -> Dict[str, Any]:
        """List dashboards for organization"""
        try:
            # Build where clause
            where_clause = {
                "OR": [
                    {"organizationId": organization_id},
                    {"isPublic": True}
                ]
            }
            
            if is_public is not None:
                if is_public:
                    # Show all public dashboards (cross-org)
                    where_clause = {"isPublic": True}
                else:
                    # Show only private dashboards for this org
                    where_clause = {"isPublic": False, "organizationId": organization_id}
            
            if tags:
                where_clause["tags"] = {"hasEvery": tags}
            
            skip = (page - 1) * per_page
            
            db_dashboards = await prisma.dashboard.find_many(
                where=where_clause,
                skip=skip,
                take=per_page,
                order={"updatedAt": "desc"},
                include={"ownerUser": True, "widgets": True}
            )
            
            total = await prisma.dashboard.count(where=where_clause)
            
            dashboards = []
            for db_dashboard in db_dashboards:
                dashboard_data = {
                    "id": db_dashboard.id,
                    "title": db_dashboard.title,
                    "description": db_dashboard.description,
                    "organization_id": db_dashboard.organizationId,
                    "owner_id": db_dashboard.ownerId,
                    "created_at": db_dashboard.createdAt,
                    "updated_at": db_dashboard.updatedAt,
                    "is_public": db_dashboard.isPublic,
                    "tags": db_dashboard.tags,
                    "widget_count": len(db_dashboard.widgets)
                }
                
                if db_dashboard.ownerUser:
                    dashboard_data["owner"] = {
                        "id": db_dashboard.ownerUser.id,
                        "name": db_dashboard.ownerUser.fullName
                    }
                
                dashboards.append(dashboard_data)
            
            return {
                "dashboards": dashboards,
                "total": total,
                "page": page,
                "per_page": per_page,
                "has_more": skip + len(dashboards) < total
            }
            
        except Exception as e:
            logger.exception("Failed to list dashboards: %s", str(e))
            return {
                "dashboards": [],
                "total": 0,
                "page": page,
                "per_page": per_page,
                "has_more": False
            }
    
    @classmethod
    async def update_dashboard(
        cls,
        dashboard_id: int,
        updates: Dict[str, Any],
        organization_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """Update dashboard"""
        try:
            # Get current dashboard
            db_dashboard = await prisma.dashboard.find_unique(
                where={"id": dashboard_id}
            )
            
            if not db_dashboard:
                raise DashboardError(f"Dashboard {dashboard_id} not found")
            
            # Check permissions
            if db_dashboard.organizationId != organization_id:
                raise DashboardError("Permission denied")
            
            # Prepare update data
            update_data = {"updatedAt": datetime.now(timezone.utc)}
            
            if "title" in updates:
                update_data["title"] = updates["title"]
            elif "name" in updates: # Compatibility
                update_data["title"] = updates["name"]
                
            if "description" in updates:
                update_data["description"] = updates["description"]
            if "layout" in updates:
                update_data["layout"] = Json(updates["layout"])
            if "theme" in updates:
                update_data["theme"] = Json(updates["theme"])
            if "is_public" in updates:
                update_data["isPublic"] = updates["is_public"]
            if "tags" in updates:
                update_data["tags"] = updates["tags"]
            
            # Handle widgets update if provided
            if "widgets" in updates:
                widgets_to_process = updates["widgets"]
                for w_data in widgets_to_process:
                    w_id = w_data.get("id")
                    w_type = w_data.get("type", "bar").upper()
                    # Ensure position is flattened if it comes as nested object from frontend
                    pos = w_data.get("position", {})
                    
                    # Construct config from various fields if needed
                    # Or just use the config provided
                    w_config = w_data.get("config", {})
                    # Add visualization and data_source to config if they are top-level
                    if "visualization" in w_data:
                        w_config["visualization"] = w_data["visualization"]
                    if "data_source" in w_data:
                        w_config["data_source"] = w_data["data_source"]
                    if "style" in w_data:
                        w_config["style"] = w_data["style"]
                    if "interactivity" in w_data:
                        w_config["interactivity"] = w_data["interactivity"]

                    # Construct data for saving
                    data_to_save: Dict[str, Any] = {
                        "type": w_type,
                        "name": w_data.get("title", f"Widget {w_id}"),
                        "description": w_data.get("description"),
                        "x": pos.get("x", 0),
                        "y": pos.get("y", 0),
                        "w": pos.get("w", 4),
                        "h": pos.get("h", 4),
                        "minW": pos.get("minW", 2),
                        "minH": pos.get("minH", 2),
                        "config": Json(w_config),
                    }

                    # Handle dataset connection
                    dataset_id = w_data.get("data_source", {}).get("dataset_id")
                    if dataset_id:
                        try:
                            data_to_save["dataset"] = {"connect": {"id": int(dataset_id)}}
                        except (ValueError, TypeError):
                            logger.debug("Operation processed")

                    if w_id and int(w_id) > 0:
                        # Update existing
                        await prisma.widget.update(
                            where={"id": int(w_id)},
                            data={
                                **data_to_save,
                                "updatedAt": datetime.now(timezone.utc)
                            }
                        )
                    else:
                        # Create new - use relation for dashboard
                        await prisma.widget.create(
                            data={
                                **data_to_save,
                                "dashboard": {"connect": {"id": dashboard_id}}
                            }
                        )

            # Update dashboard metadata
            updated = await prisma.dashboard.update(
                where={"id": dashboard_id},
                data=update_data
            )
            
            return {
                "id": updated.id,
                "title": updated.title,
                "description": updated.description,
                "updatedAt": updated.updatedAt
            }
            
        except DashboardError:
            raise
        except Exception as e:
            logger.exception("Error updating dashboard: %s", str(e))
            raise DashboardError(f"Error updating dashboard: {str(e)}") from e
    
    @classmethod
    async def delete_dashboard(
        cls,
        dashboard_id: int,
        organization_id: int,
        user_id: int
    ) -> bool:
        """Delete dashboard"""
        try:
            # Get dashboard to check permissions
            db_dashboard = await prisma.dashboard.find_unique(
                where={"id": dashboard_id}
            )
            
            if not db_dashboard:
                return False
            
            # Check permissions
            if db_dashboard.organizationId != organization_id:
                return False
            
            # Soft delete by setting deletedAt
            await prisma.dashboard.update(
                where={"id": dashboard_id},
                data={"deletedAt": datetime.now(timezone.utc)}
            )
            return True
            
        except Exception as e:
            logger.exception("Failed to delete dashboard: %s", str(e))
            return False