"""
Collaboration & Annotation router for BI dashboards.
Handles comments, spatial pin annotations, bookmarks, point-in-time snapshots, and public share links.
"""

from datetime import datetime, timedelta, timezone
import secrets
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.auth import get_current_user
from app.core.prisma import prisma
from app.generated.prisma import Json

from app.schemas.bi_schemas.collaboration import (
    DashboardBookmarkCreate,
    DashboardBookmarkResponse,
    DashboardCommentCreate,
    DashboardCommentResponse,
    DashboardCommentUpdate,
    DashboardShareLinkCreate,
    DashboardShareLinkResponse,
    DashboardSnapshotCreate,
    DashboardSnapshotResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboards/{dashboard_id}", tags=["BI - Collaboration & Annotations"]
)


# --- COMMENTS & SPATIAL ANNOTATIONS ---


@router.get("/comments", response_model=List[DashboardCommentResponse])
async def list_dashboard_comments(
    dashboard_id: int,
    widget_id: Optional[int] = Query(None, description="Filter comments by widget"),
    include_resolved: bool = Query(True, description="Include resolved comments"),
    current_user=Depends(get_current_user),
):
    """List comments and spatial pin annotations for a dashboard."""
    where_clause = {
        "dashboardId": dashboard_id,
        "deletedAt": None,
    }
    if widget_id is not None:
        where_clause["widgetId"] = widget_id
    if not include_resolved:
        where_clause["isResolved"] = False

    comments = await prisma.dashboardcomment.find_many(
        where=where_clause,
        include={"author": True, "replies": True},
        order={"createdAt": "asc"},
    )

    result = []
    for c in comments:
        result.append(
            DashboardCommentResponse(
                id=c.id,
                dashboard_id=c.dashboardId,
                widget_id=c.widgetId,
                author_id=c.authorId,
                author_name=c.author.fullName if c.author else None,
                author_avatar=c.author.profilePictureUrl if c.author else None,
                parent_id=c.parentId,
                content=c.content,
                position_x=c.positionX,
                position_y=c.positionY,
                is_resolved=c.isResolved,
                resolved_by_id=c.resolvedById,
                resolved_at=c.resolvedAt,
                metadata=c.metadata if isinstance(c.metadata, dict) else None,
                created_at=c.createdAt,
                updated_at=c.updatedAt,
                replies_count=len(c.replies) if c.replies else 0,
            )
        )
    return result


@router.post(
    "/comments",
    response_model=DashboardCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard_comment(
    dashboard_id: int,
    payload: DashboardCommentCreate,
    current_user=Depends(get_current_user),
):
    """Create a new spatial pin comment or threaded reply."""
    dashboard = await prisma.dashboard.find_unique(where={"id": dashboard_id})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    created = await prisma.dashboardcomment.create(
        data={
            "dashboardId": dashboard_id,
            "widgetId": payload.widget_id,
            "parentId": payload.parent_id,
            "authorId": current_user.id,
            "content": payload.content,
            "positionX": payload.position_x,
            "positionY": payload.position_y,
            "metadata": Json(payload.metadata or {}),
        },
        include={"author": True},
    )

    response = DashboardCommentResponse(
        id=created.id,
        dashboard_id=created.dashboardId,
        widget_id=created.widgetId,
        author_id=created.authorId,
        author_name=created.author.fullName
        if created.author
        else current_user.fullName,
        author_avatar=created.author.profilePictureUrl
        if created.author
        else current_user.profilePictureUrl,
        parent_id=created.parentId,
        content=created.content,
        position_x=created.positionX,
        position_y=created.positionY,
        is_resolved=created.isResolved,
        metadata=created.metadata if isinstance(created.metadata, dict) else None,
        created_at=created.createdAt,
        updated_at=created.updatedAt,
        replies_count=0,
    )

    try:
        from app.services.bi_services.collaboration import DashboardCollaborationService

        await DashboardCollaborationService.broadcast_annotation(
            event_type="annotation_created",
            dashboard_id=dashboard_id,
            comment_data=response.model_dump(mode="json"),
            user_id=current_user.id,
        )
    except Exception as e:
        logger.warning(f"Failed to broadcast annotation creation: {e}")

    return response


@router.patch("/comments/{comment_id}", response_model=DashboardCommentResponse)
async def update_dashboard_comment(
    dashboard_id: int,
    comment_id: int,
    payload: DashboardCommentUpdate,
    current_user=Depends(get_current_user),
):
    """Update comment text content or mark thread as resolved/unresolved."""
    comment = await prisma.dashboardcomment.find_unique(
        where={"id": comment_id},
        include={"author": True},
    )
    if not comment or comment.dashboardId != dashboard_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    update_data: Dict[str, Any] = {}
    if payload.content is not None:
        update_data["content"] = payload.content
    if payload.position_x is not None:
        update_data["positionX"] = payload.position_x
    if payload.position_y is not None:
        update_data["positionY"] = payload.position_y
    if payload.is_resolved is not None:
        update_data["isResolved"] = payload.is_resolved
        if payload.is_resolved:
            update_data["resolvedById"] = current_user.id
            update_data["resolvedAt"] = datetime.now(timezone.utc)
        else:
            update_data["resolvedById"] = None
            update_data["resolvedAt"] = None

    updated = await prisma.dashboardcomment.update(
        where={"id": comment_id},
        data=update_data,
        include={"author": True},
    )

    response = DashboardCommentResponse(
        id=updated.id,
        dashboard_id=updated.dashboardId,
        widget_id=updated.widgetId,
        author_id=updated.authorId,
        author_name=updated.author.fullName if updated.author else None,
        author_avatar=updated.author.profilePictureUrl if updated.author else None,
        parent_id=updated.parentId,
        content=updated.content,
        position_x=updated.positionX,
        position_y=updated.positionY,
        is_resolved=updated.isResolved,
        resolved_by_id=updated.resolvedById,
        resolved_at=updated.resolvedAt,
        metadata=updated.metadata if isinstance(updated.metadata, dict) else None,
        created_at=updated.createdAt,
        updated_at=updated.updatedAt,
    )

    try:
        from app.services.bi_services.collaboration import DashboardCollaborationService

        evt = (
            "annotation_resolved"
            if payload.is_resolved is not None
            else "annotation_updated"
        )
        await DashboardCollaborationService.broadcast_annotation(
            event_type=evt,
            dashboard_id=dashboard_id,
            comment_data=response.model_dump(mode="json"),
            user_id=current_user.id,
        )
    except Exception as e:
        logger.warning(f"Failed to broadcast annotation update: {e}")

    return response


# --- LIVE CURSORS & REAL-TIME COLLABORATORS ---

from pydantic import BaseModel, Field


class LiveCursorUpdate(BaseModel):
    position_x: float = Field(
        ..., ge=0.0, le=100.0, description="Spatial X % on canvas"
    )
    position_y: float = Field(
        ..., ge=0.0, le=100.0, description="Spatial Y % on canvas"
    )
    widget_id: Optional[int] = Field(None, description="Optional active widget ID")


@router.post("/cursor", status_code=status.HTTP_200_OK)
async def update_dashboard_cursor(
    dashboard_id: int,
    payload: LiveCursorUpdate,
    current_user=Depends(get_current_user),
):
    """Broadcast live cursor movement frame across Redis Pub/Sub channels."""
    from app.services.bi_services.collaboration import DashboardCollaborationService

    user_name = getattr(current_user, "fullName", None) or f"User #{current_user.id}"
    avatar = getattr(current_user, "profilePictureUrl", None) or getattr(
        current_user, "avatarUrl", None
    )

    await DashboardCollaborationService.broadcast_live_cursor(
        dashboard_id=dashboard_id,
        user_id=current_user.id,
        user_name=user_name,
        position_x=payload.position_x,
        position_y=payload.position_y,
        widget_id=payload.widget_id,
        avatar_url=avatar,
    )
    return {"status": "ok"}


@router.get("/collaborators", response_model=List[Dict[str, Any]])
async def list_dashboard_collaborators(
    dashboard_id: int,
    current_user=Depends(get_current_user),
):
    """Retrieve currently active collaborators and their live cursor positions."""
    from app.services.bi_services.collaboration import DashboardCollaborationService

    return await DashboardCollaborationService.get_active_collaborators(dashboard_id)


# --- DASHBOARD BOOKMARKS ---


@router.get("/bookmarks", response_model=List[DashboardBookmarkResponse])
async def list_dashboard_bookmarks(
    dashboard_id: int,
    current_user=Depends(get_current_user),
):
    """List saved bookmarks (user presets & shared team bookmarks)."""
    bookmarks = await prisma.dashboardbookmark.find_many(
        where={
            "dashboardId": dashboard_id,
            "OR": [
                {"userId": current_user.id},
                {"isShared": True},
            ],
        },
        order={"updatedAt": "desc"},
    )

    return [
        DashboardBookmarkResponse(
            id=b.id,
            dashboard_id=b.dashboardId,
            user_id=b.userId,
            name=b.name,
            description=b.description,
            is_shared=b.isShared,
            is_default=b.isDefault,
            filter_state=b.filterState if isinstance(b.filterState, dict) else {},
            layout_state=b.layoutState if isinstance(b.layoutState, dict) else None,
            created_at=b.createdAt,
            updated_at=b.updatedAt,
        )
        for b in bookmarks
    ]


@router.post(
    "/bookmarks",
    response_model=DashboardBookmarkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard_bookmark(
    dashboard_id: int,
    payload: DashboardBookmarkCreate,
    current_user=Depends(get_current_user),
):
    """Save current dashboard filters & layout state as a bookmark preset."""
    if payload.is_default:
        # Clear existing default flag for this user & dashboard
        await prisma.dashboardbookmark.update_many(
            where={"dashboardId": dashboard_id, "userId": current_user.id},
            data={"isDefault": False},
        )

    bookmark = await prisma.dashboardbookmark.create(
        data={
            "dashboardId": dashboard_id,
            "userId": current_user.id,
            "name": payload.name,
            "description": payload.description,
            "isShared": payload.is_shared,
            "isDefault": payload.is_default,
            "filterState": Json(payload.filter_state),
            "layoutState": Json(payload.layout_state or {}),
        }
    )

    return DashboardBookmarkResponse(
        id=bookmark.id,
        dashboard_id=bookmark.dashboardId,
        user_id=bookmark.userId,
        name=bookmark.name,
        description=bookmark.description,
        is_shared=bookmark.isShared,
        is_default=bookmark.isDefault,
        filter_state=bookmark.filterState
        if isinstance(bookmark.filterState, dict)
        else {},
        layout_state=bookmark.layoutState
        if isinstance(bookmark.layoutState, dict)
        else None,
        created_at=bookmark.createdAt,
        updated_at=bookmark.updatedAt,
    )


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_bookmark(
    dashboard_id: int,
    bookmark_id: int,
    current_user=Depends(get_current_user),
):
    """Delete a saved bookmark."""
    bookmark = await prisma.dashboardbookmark.find_unique(where={"id": bookmark_id})
    if (
        not bookmark
        or bookmark.dashboardId != dashboard_id
        or bookmark.userId != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await prisma.dashboardbookmark.delete(where={"id": bookmark_id})
    return None


# --- POINT-IN-TIME SNAPSHOTS ---


@router.get("/snapshots", response_model=List[DashboardSnapshotResponse])
async def list_dashboard_snapshots(
    dashboard_id: int,
    current_user=Depends(get_current_user),
):
    """List point-in-time frozen metric snapshots."""
    snapshots = await prisma.dashboardsnapshot.find_many(
        where={"dashboardId": dashboard_id},
        include={"createdBy": True},
        order={"createdAt": "desc"},
    )

    return [
        DashboardSnapshotResponse(
            id=s.id,
            dashboard_id=s.dashboardId,
            created_by_id=s.createdById,
            creator_name=s.createdBy.fullName if s.createdBy else None,
            name=s.name,
            notes=s.notes,
            filter_state=s.filterState if isinstance(s.filterState, dict) else {},
            frozen_data=s.frozenData if isinstance(s.frozenData, dict) else {},
            thumbnail_url=s.thumbnailUrl,
            created_at=s.createdAt,
        )
        for s in snapshots
    ]


@router.post(
    "/snapshots",
    response_model=DashboardSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard_snapshot(
    dashboard_id: int,
    payload: DashboardSnapshotCreate,
    current_user=Depends(get_current_user),
):
    """Capture point-in-time frozen metric state for historical comparison."""
    snapshot = await prisma.dashboardsnapshot.create(
        data={
            "dashboardId": dashboard_id,
            "createdById": current_user.id,
            "name": payload.name,
            "notes": payload.notes,
            "filterState": Json(payload.filter_state),
            "frozenData": Json(payload.frozen_data),
            "thumbnailUrl": payload.thumbnail_url,
        },
        include={"createdBy": True},
    )

    return DashboardSnapshotResponse(
        id=snapshot.id,
        dashboard_id=snapshot.dashboardId,
        created_by_id=snapshot.createdById,
        creator_name=snapshot.createdBy.fullName
        if snapshot.createdBy
        else current_user.fullName,
        name=snapshot.name,
        notes=snapshot.notes,
        filter_state=snapshot.filterState
        if isinstance(snapshot.filterState, dict)
        else {},
        frozen_data=snapshot.frozenData
        if isinstance(snapshot.frozenData, dict)
        else {},
        thumbnail_url=snapshot.thumbnailUrl,
        created_at=snapshot.createdAt,
    )


from app.core.auth import verify_organization_access
from app.core.security import get_password_hash, verify_password
from app.schemas.bi_schemas.collaboration import DashboardShareLinkVerify

# --- SHARE LINKS ---


@router.post(
    "/share-links",
    response_model=DashboardShareLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_share_link(
    dashboard_id: int,
    payload: DashboardShareLinkCreate,
    current_user=Depends(get_current_user),
):
    """Generate a cryptographic share link with optional expiry & view limit."""
    # Verify dashboard exists and belongs to current user's organization
    dashboard = await prisma.dashboard.find_unique(where={"id": dashboard_id})
    if not dashboard or dashboard.deletedAt is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bi.dashboards.errors.dashboardNotFound",
        )
    if dashboard.organizationId:
        await verify_organization_access(dashboard.organizationId, current_user)
    elif dashboard.ownerId != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="bi.dashboards.errors.forbidden",
        )

    token = secrets.token_urlsafe(32)
    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=payload.expires_in_days
        )

    # Hash password if provided using Argon2/bcrypt
    password_hash = get_password_hash(payload.password) if payload.password else None

    share_link = await prisma.dashboardsharelink.create(
        data={
            "dashboardId": dashboard_id,
            "createdById": current_user.id,
            "token": token,
            "passwordHash": password_hash,
            "expiresAt": expires_at,
            "maxViews": payload.max_views,
            "canFilter": payload.can_filter,
            "canExport": payload.can_export,
            "defaultFilters": Json(payload.default_filters or {}),
        }
    )

    return DashboardShareLinkResponse(
        id=share_link.id,
        dashboard_id=share_link.dashboardId,
        token=share_link.token,
        share_url=f"/bi/dashboards/share/{share_link.token}",
        has_password=bool(payload.password),
        expires_at=share_link.expiresAt,
        max_views=share_link.maxViews,
        view_count=share_link.viewCount,
        can_filter=share_link.canFilter,
        can_export=share_link.canExport,
        default_filters=share_link.defaultFilters
        if isinstance(share_link.defaultFilters, dict)
        else None,
        is_revoked=share_link.isRevoked,
        created_at=share_link.createdAt,
    )


@router.get("/share-links", response_model=List[DashboardShareLinkResponse])
async def list_dashboard_share_links(
    dashboard_id: int,
    current_user=Depends(get_current_user),
):
    """List all share links for this dashboard."""
    dashboard = await prisma.dashboard.find_unique(where={"id": dashboard_id})
    if not dashboard or dashboard.deletedAt is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bi.dashboards.errors.dashboardNotFound",
        )
    if dashboard.organizationId:
        await verify_organization_access(dashboard.organizationId, current_user)
    elif dashboard.ownerId != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="bi.dashboards.errors.forbidden",
        )

    links = await prisma.dashboardsharelink.find_many(
        where={"dashboardId": dashboard_id},
        order={"createdAt": "desc"},
    )
    return [
        DashboardShareLinkResponse(
            id=link.id,
            dashboard_id=link.dashboardId,
            token=link.token,
            share_url=f"/bi/dashboards/share/{link.token}",
            has_password=bool(link.passwordHash),
            expires_at=link.expiresAt,
            max_views=link.maxViews,
            view_count=link.viewCount,
            can_filter=link.canFilter,
            can_export=link.canExport,
            default_filters=link.defaultFilters
            if isinstance(link.defaultFilters, dict)
            else None,
            is_revoked=link.isRevoked,
            created_at=link.createdAt,
        )
        for link in links
    ]


@router.delete("/share-links/{link_id}", status_code=status.HTTP_200_OK)
async def revoke_dashboard_share_link(
    dashboard_id: int,
    link_id: int,
    current_user=Depends(get_current_user),
):
    """Revoke a dashboard share link."""
    link = await prisma.dashboardsharelink.find_unique(
        where={"id": link_id},
        include={"dashboard": True},
    )
    if not link or link.dashboardId != dashboard_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bi.dashboards.errors.shareLinkNotFound",
        )
    if link.dashboard and link.dashboard.organizationId:
        await verify_organization_access(link.dashboard.organizationId, current_user)

    await prisma.dashboardsharelink.update(
        where={"id": link_id},
        data={"isRevoked": True},
    )
    return {"success": True, "message": "bi.dashboards.success.shareLinkRevoked"}


@router.post("/share-links/verify", response_model=DashboardShareLinkResponse)
async def verify_share_link(
    dashboard_id: int,
    payload: DashboardShareLinkVerify,
):
    """Verify access token & password for a shared dashboard link."""
    link = await prisma.dashboardsharelink.find_unique(
        where={"token": payload.token},
        include={"dashboard": True},
    )
    if not link or link.dashboardId != dashboard_id or link.isRevoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bi.dashboards.errors.shareLinkNotFound",
        )

    if link.expiresAt and link.expiresAt < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="bi.dashboards.errors.shareLinkExpired",
        )

    if link.maxViews is not None and link.viewCount >= link.maxViews:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="bi.dashboards.errors.shareLinkViewLimitReached",
        )

    if link.passwordHash:
        if not payload.password or not verify_password(
            payload.password, link.passwordHash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="bi.dashboards.errors.invalidPassword",
            )

    # Increment view count
    updated = await prisma.dashboardsharelink.update(
        where={"id": link.id},
        data={"viewCount": {"increment": 1}},
    )

    return DashboardShareLinkResponse(
        id=updated.id,
        dashboard_id=updated.dashboardId,
        token=updated.token,
        share_url=f"/bi/dashboards/share/{updated.token}",
        has_password=bool(updated.passwordHash),
        expires_at=updated.expiresAt,
        max_views=updated.maxViews,
        view_count=updated.viewCount,
        can_filter=updated.canFilter,
        can_export=updated.canExport,
        default_filters=updated.defaultFilters
        if isinstance(updated.defaultFilters, dict)
        else None,
        is_revoked=updated.isRevoked,
        created_at=updated.createdAt,
    )
