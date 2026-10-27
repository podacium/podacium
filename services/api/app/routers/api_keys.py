from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.schemas.api_keys import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyRotateRequest,
)
from app.services.api_key_service import api_key_service

router = APIRouter(prefix="/api-keys", tags=["Developer API Keys"])


@router.post("", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_api_key(request: ApiKeyCreate, current_user=Depends(get_current_user)):
    """Generate a new developer API Key. Plaintext secret is revealed ONCE."""
    return await api_key_service.create_api_key(current_user.id, request)


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(current_user=Depends(get_current_user)):
    """List all active and revoked API Keys for the current user."""
    return await api_key_service.list_api_keys(current_user.id)


@router.delete("/{key_id}")
async def revoke_api_key(key_id: int, current_user=Depends(get_current_user)):
    """Revoke an API Key instantly."""
    success = await api_key_service.revoke_api_key(current_user.id, key_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found or already revoked",
        )
    return {"success": True, "message": "API key revoked successfully"}


@router.post("/{key_id}/rotate", response_model=ApiKeyCreatedResponse)
async def rotate_api_key(
    key_id: int,
    body: Optional[ApiKeyRotateRequest] = None,
    current_user=Depends(get_current_user),
):
    """Rotate an API Key and receive a new raw secret with a 7-day grace period."""
    grace_hours = body.grace_hours if body and body.grace_hours is not None else 168
    try:
        return await api_key_service.rotate_api_key_with_grace_period(
            current_user.id, key_id, grace_hours=grace_hours
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{key_id}/analytics")
async def get_key_analytics(key_id: int, current_user=Depends(get_current_user)):
    """Fetch usage analytics and error rate metrics for an API key."""
    try:
        return await api_key_service.get_api_key_analytics(current_user.id, key_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
