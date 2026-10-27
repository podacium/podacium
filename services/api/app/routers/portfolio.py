from fastapi import APIRouter, Depends, HTTPException, status, Query
import logging

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate, PortfolioResponse, PortfolioListResponse
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PortfolioListResponse)
async def list_own_portfolio(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    current_user: dict = Depends(get_current_active_user)
):
    """List current user's portfolio items (paginated)."""
    try:
        skip = (page - 1) * page_size
        items = await prisma.portfolioitem.find_many(
            where={"userId": current_user.id},
            order=[{"createdAt": "desc"}],
            skip=skip,
            take=page_size,
        )
        total = await prisma.portfolioitem.count(
            where={"userId": current_user.id}
        )
        return PortfolioListResponse(
            items=[PortfolioResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
        )
    except Exception as e:
        logger.error(f"Error listing portfolio: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch portfolio items"
        )


@router.get("/{user_id}", response_model=PortfolioListResponse)
async def list_user_portfolio(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
):
    """List a user's public portfolio items."""
    try:
        skip = (page - 1) * page_size
        items = await prisma.portfolioitem.find_many(
            where={"userId": user_id},
            order=[{"createdAt": "desc"}],
            skip=skip,
            take=page_size,
        )
        total = await prisma.portfolioitem.count(
            where={"userId": user_id}
        )
        return PortfolioListResponse(
            items=[PortfolioResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
        )
    except Exception as e:
        logger.error(f"Error listing user portfolio: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch portfolio items"
        )


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio_item(
    data: PortfolioCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a portfolio item for the current user."""
    try:
        links = None
        if data.links:
            links = [link.model_dump() for link in data.links]

        item = await prisma.portfolioitem.create(
            data={
                "userId": current_user.id,
                "title": data.title,
                "description": data.description,
                "mediaUrls": data.media_urls,
                "tags": data.tags,
                "links": links,
            }
        )
        return item
    except Exception as e:
        logger.error(f"Error creating portfolio item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create portfolio item"
        )


@router.put("/{item_id}", response_model=PortfolioResponse)
async def update_portfolio_item(
    item_id: int,
    data: PortfolioUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update a portfolio item (owner only)."""
    try:
        existing = await prisma.portfolioitem.find_unique(where={"id": item_id})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio item not found"
            )
        if existing.userId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own portfolio items"
            )

        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.media_urls is not None:
            update_data["mediaUrls"] = data.media_urls
        if data.tags is not None:
            update_data["tags"] = data.tags
        if data.links is not None:
            update_data["links"] = [link.model_dump() for link in data.links]

        item = await prisma.portfolioitem.update(
            where={"id": item_id},
            data=update_data,
        )
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating portfolio item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update portfolio item"
        )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio_item(
    item_id: int,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a portfolio item (owner only)."""
    try:
        existing = await prisma.portfolioitem.find_unique(where={"id": item_id})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio item not found"
            )
        if existing.userId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own portfolio items"
            )

        await prisma.portfolioitem.delete(where={"id": item_id})
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting portfolio item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete portfolio item"
        )
