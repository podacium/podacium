"""
Collaboration schemas for BI dashboards (comments, spatial pins, bookmarks, snapshots, share links).
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import Field

from .common import BaseModel as BaseSchema


# --- Comments & Spatial Annotations ---

class DashboardCommentCreate(BaseSchema):
    """Schema for creating a dashboard comment or spatial pin annotation."""
    widget_id: Optional[int] = Field(None, description="Optional target widget ID")
    parent_id: Optional[int] = Field(None, description="Optional parent comment ID for threaded replies")
    content: str = Field(..., min_length=1, max_length=2000, description="Comment text content")
    position_x: Optional[float] = Field(None, description="Spatial X percentage coordinate (0-100%) on dashboard or widget canvas")
    position_y: Optional[float] = Field(None, description="Spatial Y percentage coordinate (0-100%) on dashboard or widget canvas")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional annotation metadata (e.g. highlighted metric value)")


class DashboardCommentUpdate(BaseSchema):
    """Schema for updating a dashboard comment."""
    content: Optional[str] = Field(None, min_length=1, max_length=2000)
    is_resolved: Optional[bool] = Field(None, description="Set comment thread resolution status")
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class DashboardCommentResponse(BaseSchema):
    """Schema for returning dashboard comment details."""
    id: int
    dashboard_id: int
    widget_id: Optional[int] = None
    author_id: int
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    parent_id: Optional[int] = None
    content: str
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    is_resolved: bool = False
    resolved_by_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    replies_count: int = 0


# --- Dashboard Bookmarks ---

class DashboardBookmarkCreate(BaseSchema):
    """Schema for creating a saved dashboard view bookmark."""
    name: str = Field(..., min_length=1, max_length=120, description="Bookmark preset name")
    description: Optional[str] = Field(None, max_length=255)
    is_shared: bool = Field(False, description="Whether this bookmark is visible to organization team members")
    is_default: bool = Field(False, description="Set as current user's default view for this dashboard")
    filter_state: Dict[str, Any] = Field(..., description="Captured widget/dashboard filter values")
    layout_state: Optional[Dict[str, Any]] = Field(None, description="Captured widget positions & layout overrides")


class DashboardBookmarkUpdate(BaseSchema):
    """Schema for updating a dashboard bookmark."""
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = None
    is_shared: Optional[bool] = None
    is_default: Optional[bool] = None
    filter_state: Optional[Dict[str, Any]] = None
    layout_state: Optional[Dict[str, Any]] = None


class DashboardBookmarkResponse(BaseSchema):
    """Schema for returning bookmark details."""
    id: int
    dashboard_id: int
    user_id: int
    name: str
    description: Optional[str] = None
    is_shared: bool
    is_default: bool
    filter_state: Dict[str, Any]
    layout_state: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# --- Point-in-Time Snapshots ---

class DashboardSnapshotCreate(BaseSchema):
    """Schema for creating a frozen aggregate dashboard snapshot."""
    name: str = Field(..., min_length=1, max_length=160, description="Snapshot title")
    notes: Optional[str] = Field(None, max_length=1000, description="Context notes for frozen snapshot")
    filter_state: Dict[str, Any] = Field(..., description="Active filters when snapshot was taken")
    frozen_data: Dict[str, Any] = Field(..., description="Frozen aggregate metric values per widget")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail screenshot URL if rendered")


class DashboardSnapshotResponse(BaseSchema):
    """Schema for returning dashboard snapshot details."""
    id: int
    dashboard_id: int
    created_by_id: int
    creator_name: Optional[str] = None
    name: str
    notes: Optional[str] = None
    filter_state: Dict[str, Any]
    frozen_data: Dict[str, Any]
    thumbnail_url: Optional[str] = None
    created_at: datetime


# --- Share Links ---

class DashboardShareLinkCreate(BaseSchema):
    """Schema for generating a share link with optional password and expiry."""
    password: Optional[str] = Field(None, min_length=6, max_length=64, description="Optional password protection")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Link validity duration in days")
    max_views: Optional[int] = Field(None, ge=1, le=10000, description="Maximum view limit")
    can_filter: bool = Field(True, description="Allow guest user to interact with dashboard filters")
    can_export: bool = Field(False, description="Allow guest user to download CSV/PDF exports")
    default_filters: Optional[Dict[str, Any]] = Field(None, description="Preset filter state for guests")


class DashboardShareLinkVerify(BaseSchema):
    """Schema for verifying a password-protected share token."""
    token: str = Field(..., max_length=64)
    password: Optional[str] = Field(None, max_length=64)


class DashboardShareLinkResponse(BaseSchema):
    """Schema for returning share link configuration."""
    id: int
    dashboard_id: int
    token: str
    share_url: str
    has_password: bool
    expires_at: Optional[datetime] = None
    max_views: Optional[int] = None
    view_count: int
    can_filter: bool
    can_export: bool
    default_filters: Optional[Dict[str, Any]] = None
    is_revoked: bool
    created_at: datetime
