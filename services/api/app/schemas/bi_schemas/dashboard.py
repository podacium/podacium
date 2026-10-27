"""
Dashboard schemas.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import Field

from .common import BaseModel as BaseSchema  # Consistent with other schemas


class WidgetType(str, Enum):
    """Widget types for dashboards"""

    KPI = "kpi"
    METRIC = "metric"
    BAR = "bar"
    LINE = "line"
    AREA = "area"
    PIE = "pie"
    SCATTER = "scatter"
    BUBBLE = "bubble"
    HISTOGRAM = "histogram"
    TABLE = "table"
    HEATMAP = "heatmap"
    SANKEY = "sankey"
    RADAR = "radar"
    FUNNEL = "funnel"
    MAP = "map"
    TREEMAP = "treemap"
    GAUGE = "gauge"
    CUSTOM = "custom"
    CHART = "chart"


class LayoutType(str, Enum):
    """Dashboard layout types"""

    GRID = "grid"
    FREEFORM = "freeform"
    REPORT = "report"
    PRESENTATION = "presentation"


class WidgetPosition(BaseSchema):
    """Widget position in dashboard grid"""

    x: int = Field(0, ge=0, le=100, description="X position in grid units")
    y: int = Field(0, ge=0, le=100, description="Y position in grid units")
    w: int = Field(4, ge=1, le=24, description="Width in grid units")
    h: int = Field(3, ge=1, le=12, description="Height in grid units")
    minW: Optional[int] = Field(None, ge=1, le=24)
    minH: Optional[int] = Field(None, ge=1, le=12)
    maxW: Optional[int] = Field(None, ge=1, le=24)
    maxH: Optional[int] = Field(None, ge=1, le=12)
    static: bool = Field(False, description="Whether widget is static (not draggable)")


class WidgetStyle(BaseSchema):
    """Widget styling options"""

    background_color: str = Field("#FFFFFF", description="Background color")
    border_color: Optional[str] = Field(None, description="Border color")
    border_width: int = Field(1, ge=0, le=10)
    border_radius: str = Field("4px", description="Border radius")
    padding: str = Field("12px", description="Padding")
    margin: str = Field("0px", description="Margin")
    box_shadow: Optional[str] = Field(None, description="CSS box shadow")
    font_family: Optional[str] = Field(None, description="Font family")
    font_size: Optional[str] = Field(None, description="Font size")
    text_color: Optional[str] = Field(None, description="Text color")


class WidgetInteractivity(BaseSchema):
    """Widget interactivity options"""

    clickable: bool = Field(True, description="Whether widget is clickable")
    drilldown: bool = Field(False, description="Enable drill-down functionality")
    tooltip: bool = Field(True, description="Show tooltips")
    hover_effect: bool = Field(True, description="Enable hover effects")
    zoom: bool = Field(False, description="Enable zoom")
    pan: bool = Field(False, description="Enable pan")
    export: bool = Field(True, description="Allow data export")
    refresh: bool = Field(False, description="Allow manual refresh")


class DataSource(BaseSchema):
    """Data source for widget"""

    type: str = Field(..., description="dataset/query/api")
    dataset_id: Optional[str] = Field(None, description="Dataset ID")
    query: Optional[str] = Field(None, description="SQL or query string")
    api_endpoint: Optional[str] = Field(None, description="API endpoint")
    filters: Optional[Dict[str, Any]] = Field(None, description="Data filters")
    aggregation: Optional[Dict[str, Any]] = Field(
        None, description="Aggregation settings"
    )
    refresh_interval: Optional[int] = Field(
        None, ge=0, description="Refresh interval in seconds"
    )


class Widget(BaseSchema):
    """Dashboard widget"""

    id: int = Field(..., description="Widget unique ID")
    type: WidgetType = Field(..., description="Widget type")
    title: str = Field(..., max_length=200, description="Widget title")
    description: Optional[str] = Field(None, max_length=500)

    # Data and configuration
    data_source: DataSource = Field(..., description="Data source configuration")
    visualization: Dict[str, Any] = Field(
        ..., description="Visualization configuration"
    )
    filters: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Legacy or extended configuration"
    )

    # Layout and style (Flattened to match Prisma)
    x: int = Field(0, ge=0)
    y: int = Field(0, ge=0)
    w: int = Field(4, ge=1)
    h: int = Field(4, ge=1)
    minW: Optional[int] = Field(None, ge=1)
    minH: Optional[int] = Field(None, ge=1)

    style: WidgetStyle = Field(default_factory=WidgetStyle)
    interactivity: WidgetInteractivity = Field(default_factory=WidgetInteractivity)

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[int] = Field(None, description="User ID of creator")

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "widget_123",
                "type": "bar",
                "title": "Sales by Region",
                "data_source": {
                    "type": "dataset",
                    "dataset_id": "ds_123",
                    "filters": {"region": ["North", "South"]},
                },
                "position": {"x": 0, "y": 0, "w": 6, "h": 4},
            }
        }
    }


class DashboardTheme(BaseSchema):
    """Dashboard theme configuration"""

    mode: str = Field("light", pattern="^(light|dark|system)$", description="Mode")
    primary_color: str = Field("#6366F1", description="Primary color")
    background_color: str = Field("#F3F4F6", description="Background color")
    card_background: str = Field("#FFFFFF", description="Card background")
    text_primary: str = Field("#111827", description="Primary text")
    font_family: str = Field("Inter, sans-serif", description="Font family")


class DashboardLayout(BaseSchema):
    """Dashboard layout configuration"""

    columns: int = Field(12, ge=1, le=24, description="Grid columns")
    row_height: int = Field(100, ge=50, le=200, description="Row height")
    gap: int = Field(16, description="Gap in pixels")
    breakpoints: Dict[str, int] = Field(
        default_factory=lambda: {"lg": 1200, "md": 996, "sm": 768, "xs": 480},
        description="Responsive breakpoints",
    )


class DashboardConfig(BaseSchema):
    """Legacy Dashboard configuration (kept for compatibility)"""

    columns: int = Field(12, ge=1, le=24)
    row_height: int = Field(100, ge=50, le=200)
    background_color: str = Field("#FFFFFF")
    theme: str = Field("light")
    allow_edit: bool = Field(True)
    allow_share: bool = Field(True)
    auto_refresh: Optional[int] = Field(None)


class DashboardCreate(BaseSchema):
    """Dashboard creation request"""

    title: str = Field(..., min_length=1, max_length=200, description="Dashboard title")
    name: Optional[str] = Field(None, description="Alias for title")
    description: Optional[str] = Field(None, max_length=1000)
    layout_type: LayoutType = Field(LayoutType.GRID)
    dataset_id: Optional[str] = Field(None, description="Linked dataset ID")
    is_public: bool = Field(False)
    tags: List[str] = Field(default_factory=list, max_length=20)
    config: Optional[DashboardConfig] = None
    layout: Optional[DashboardLayout] = None
    theme: Optional[DashboardTheme] = None
    widgets: List[Dict[str, Any]] = Field(default_factory=list)


class DashboardUpdate(BaseSchema):
    """Dashboard update request"""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    name: Optional[str] = Field(None, description="Alias for title")
    description: Optional[str] = Field(None, max_length=1000)
    layout_type: Optional[LayoutType] = None
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = Field(None, max_length=20)
    config: Optional[DashboardConfig] = None
    layout: Optional[DashboardLayout] = None
    theme: Optional[DashboardTheme] = None
    widgets: Optional[List[Dict[str, Any]]] = None


class WidgetCreate(BaseSchema):
    """Widget creation request"""

    type: WidgetType = Field(...)
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)

    # Visualization configuration
    visualization_type: str = Field(..., description="Type of visualization")
    visualization_config: Dict[str, Any] = Field(
        ..., description="Visualization configuration"
    )

    # Data source
    data_source: DataSource = Field(...)

    # Layout
    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 4
    minW: Optional[int] = None
    minH: Optional[int] = None
    position: Optional[WidgetPosition] = None

    # Optional styling
    style: Optional[WidgetStyle] = None
    interactivity: Optional[WidgetInteractivity] = None
    config: Optional[Dict[str, Any]] = None


class WidgetCreateDirect(BaseSchema):
    """Direct widget creation request via /api/bi/widgets"""

    dashboard_id: int = Field(..., description="Target dashboard ID")
    type: WidgetType = Field(...)
    title: str = Field(..., min_length=1, max_length=200)
    name: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    dataset_id: Optional[int] = None
    semantic_model_id: Optional[int] = None
    data_source: Optional[DataSource] = None
    visualization_type: Optional[str] = None
    visualization_config: Optional[Dict[str, Any]] = None
    visualization: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    style: Optional[WidgetStyle] = None
    interactivity: Optional[WidgetInteractivity] = None
    config: Optional[Dict[str, Any]] = None
    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 4
    minW: Optional[int] = None
    minH: Optional[int] = None
    order: int = 0
    position: Optional[WidgetPosition] = None


class WidgetUpdate(BaseSchema):
    """Widget update request"""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    name: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    type: Optional[WidgetType] = None
    dataset_id: Optional[int] = None
    semantic_model_id: Optional[int] = None
    data_source: Optional[DataSource] = None
    visualization_type: Optional[str] = None
    visualization_config: Optional[Dict[str, Any]] = None
    visualization: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    style: Optional[WidgetStyle] = None
    interactivity: Optional[WidgetInteractivity] = None
    config: Optional[Dict[str, Any]] = None
    x: Optional[int] = Field(None, ge=0)
    y: Optional[int] = Field(None, ge=0)
    w: Optional[int] = Field(None, ge=1)
    h: Optional[int] = Field(None, ge=1)
    minW: Optional[int] = None
    minH: Optional[int] = None
    order: Optional[int] = None
    position: Optional[WidgetPosition] = None


class WidgetPositionUpdate(BaseSchema):
    """Lightweight position & layout update request"""

    x: Optional[int] = Field(None, ge=0)
    y: Optional[int] = Field(None, ge=0)
    w: Optional[int] = Field(None, ge=1)
    h: Optional[int] = Field(None, ge=1)
    minW: Optional[int] = None
    minH: Optional[int] = None
    order: Optional[int] = None


class WidgetReorderItem(BaseSchema):
    """Item for batch reordering widgets"""

    id: int
    order: int
    x: Optional[int] = None
    y: Optional[int] = None
    w: Optional[int] = None
    h: Optional[int] = None


class WidgetReorderRequest(BaseSchema):
    """Batch reorder request"""

    widgets: List[WidgetReorderItem]


class DashboardMetadata(BaseSchema):
    """Dashboard metadata (without full widgets)"""

    id: int = Field(..., description="Dashboard ID")
    title: str = Field(..., description="Dashboard title")
    name: Optional[str] = Field(None, description="Alias for title")
    description: Optional[str] = None
    organization_id: int = Field(..., description="Organization ID")
    owner_id: int = Field(..., description="User ID of owner")
    dataset_id: Optional[int] = None
    layout_type: LayoutType = Field(LayoutType.GRID)
    is_public: bool = Field(False)
    tags: List[str] = Field(default_factory=list)
    widget_count: int = Field(0, ge=0)
    created_at: datetime
    updated_at: datetime
    version: int = Field(1, ge=1)

    # Optional fields
    created_by_name: Optional[str] = None
    dataset_info: Optional[Dict[str, Any]] = None
    layout: Optional[DashboardLayout] = None
    theme: Optional[DashboardTheme] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "dash_123",
                "name": "Sales Dashboard",
                "description": "Q4 Sales Performance",
                "organization_id": 123,
                "widget_count": 6,
                "tags": ["sales", "q4", "performance"],
                "created_at": "2024-01-15T10:30:00Z",
            }
        }
    }


class DashboardResponse(BaseSchema):
    """Full dashboard response"""

    dashboard: DashboardMetadata
    widgets: List[Dict[str, Any]] = Field(
        default_factory=list, description="Widgets data"
    )
    config: DashboardConfig = Field(default_factory=DashboardConfig)
    success: bool = True
    message: Optional[str] = None


class DashboardListResponse(BaseSchema):
    """Dashboard list response"""

    dashboards: List[DashboardMetadata]
    total: int = Field(0, ge=0)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)
    has_more: bool = False


class GenerateDashboardRequest(BaseSchema):
    """Request to auto-generate dashboard"""

    dataset_id: str = Field(..., description="Dataset to use")
    name: Optional[str] = Field(None, description="Dashboard name")
    description: Optional[str] = None
    layout_type: LayoutType = Field(LayoutType.GRID)
    max_widgets: int = Field(8, ge=1, le=20, description="Maximum widgets to generate")
    include_types: List[str] = Field(
        default_factory=lambda: [
            "metric",
            "bar",
            "line",
            "pie",
            "scatter",
            "histogram",
        ],
        description="Types of visualizations to include",
    )


class DashboardExportRequest(BaseSchema):
    """Dashboard export request"""

    format: str = Field(
        "json", pattern="^(json|pdf|png|html)$", description="Export format"
    )
    include_data: bool = Field(True, description="Include data in export")
    include_config: bool = Field(True, description="Include configuration")
    width: Optional[int] = Field(
        None, ge=100, le=5000, description="Export width for images"
    )
    height: Optional[int] = Field(
        None, ge=100, le=5000, description="Export height for images"
    )
