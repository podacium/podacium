from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from app.core.auth import get_current_user
from app.schemas.integrations import ConnectIntegrationRequest, DisconnectIntegrationResponse, IntegrationsListResponse, IntegrationResponse
from app.services.integrations_service import integrations_service

router = APIRouter(prefix="/integrations", tags=["integrations"])

@router.get("", response_model=IntegrationsListResponse)
async def get_integrations(current_user = Depends(get_current_user)):
    """Get all connected integrations for current user"""
    return await integrations_service.get_user_integrations(current_user.id)

@router.post("", response_model=IntegrationResponse)
async def connect_integration(
    request: ConnectIntegrationRequest,
    current_user = Depends(get_current_user)
):
    """Connect a new integration"""
    result = await integrations_service.connect_integration(current_user.id, request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect integration"
        )
    return result

@router.get("/{provider}/authorize")
async def authorize_integration(
    provider: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get OAuth authorization URL for an integration provider"""
    # Assuming the frontend wants to return to the settings page after
    redirect_uri = request.query_params.get("redirect_uri")
    if not redirect_uri:
        # Construct a default callback URI targeting the backend directly
        # The backend callback will then redirect back to the frontend
        # The request.url.components can help build the base
        base_url = f"{request.url.scheme}://{request.url.netloc}"
        redirect_uri = f"{base_url}/api/integrations/{provider}/callback"

    try:
        url = await integrations_service.get_oauth_authorization_url(
            user_id=current_user.id,
            provider=provider,
            redirect_uri=redirect_uri
        )
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{provider}/callback")
async def integration_oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request
):
    """Handle OAuth callback for integration provider"""
    # Usually the callback redirect_uri needs to match exactly what was sent in /authorize
    # Reconstruct the default callback URI
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    redirect_uri = f"{base_url}/api/integrations/{provider}/callback"
    
    try:
        await integrations_service.handle_oauth_callback(
            provider=provider,
            code=code,
            state=state,
            redirect_uri=redirect_uri
        )
        
        # Redirect back to the frontend settings page
        from app.core.config import setting
        frontend_url = setting.FRONTEND_URL
        if not frontend_url:
            frontend_url = "http://localhost:3000"
            
        return RedirectResponse(f"{frontend_url}/settings?tab=integrations&success=true&provider={provider}")
    except Exception:
        # Redirect back with error
        from app.core.config import setting
        frontend_url = getattr(setting, 'FRONTEND_URL', "http://localhost:3000")
        if not frontend_url:
            frontend_url = "http://localhost:3000"
        return RedirectResponse(f"{frontend_url}/settings?tab=integrations&error=auth_failed&provider={provider}")

@router.delete("/{provider}", response_model=DisconnectIntegrationResponse)
async def disconnect_integration(
    provider: str,
    current_user = Depends(get_current_user)
):
    """Disconnect an integration"""
    result = await integrations_service.disconnect_integration(current_user.id, provider)
    if not result or not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect {provider} integration"
        )
    return result
