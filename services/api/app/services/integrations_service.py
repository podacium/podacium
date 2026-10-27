import logging
import json
import httpx
import urllib.parse
from typing import Optional, Dict, Any
from app.generated.prisma import Json
from app.core.prisma import prisma
from app.core.config import setting
from app.core.security import create_access_token, verify_token, encrypt_vault_secret, decrypt_vault_secret
from app.schemas.integrations import (
    IntegrationResponse,
    IntegrationsListResponse,
    ConnectIntegrationRequest,
    DisconnectIntegrationResponse,
)

logger = logging.getLogger(__name__)


class IntegrationsService:
    def __init__(self):
        self.db = prisma

    async def get_user_integrations(self, user_id: int) -> IntegrationsListResponse:
        """Get all connected integrations for a user"""
        try:
            integrations = await self.db.userintegration.find_many(
                where={"userId": user_id}
            )

            integration_responses = []
            for integration in integrations:
                metadata_dict = {}
                if integration.metadata:
                    if isinstance(integration.metadata, str):
                        try:
                            metadata_dict = json.loads(integration.metadata)
                        except json.JSONDecodeError:
                            metadata_dict = {}
                    elif isinstance(integration.metadata, dict):
                        metadata_dict = integration.metadata

                # Derive account label if missing
                label = integration.accountLabel
                if not label:
                    if "email" in metadata_dict:
                        label = f"{integration.provider.title()} ({metadata_dict['email']})"
                    elif "login" in metadata_dict:
                        label = f"{integration.provider.title()} (@{metadata_dict['login']})"
                    elif "name" in metadata_dict:
                        label = f"{integration.provider.title()} ({metadata_dict['name']})"
                    else:
                        label = f"{integration.provider.title()} Account"

                integration_responses.append(
                    IntegrationResponse(
                        id=integration.id,
                        user_id=integration.userId,
                        provider=integration.provider,
                        provider_id=integration.providerId,
                        account_label=label,
                        status=integration.status or "ACTIVE",
                        expires_at=integration.expiresAt,
                        connected_at=integration.connectedAt,
                        updated_at=integration.updatedAt,
                        metadata=metadata_dict,
                    )
                )

            return IntegrationsListResponse(integrations=integration_responses)
        except Exception as e:
            logger.error(f"Error fetching user integrations: {str(e)}")
            return IntegrationsListResponse(integrations=[])

    async def connect_integration(
        self, user_id: int, request: ConnectIntegrationRequest
    ) -> Optional[IntegrationResponse]:
        """Connect a new integration for a user with vault encryption"""
        try:
            metadata_val = request.metadata if request.metadata else {}
            
            # Derive account label
            account_label = request.account_label
            if not account_label:
                if "email" in metadata_val:
                    account_label = f"{request.provider.title()} ({metadata_val['email']})"
                elif "login" in metadata_val:
                    account_label = f"{request.provider.title()} (@{metadata_val['login']})"
                elif "name" in metadata_val:
                    account_label = f"{request.provider.title()} ({metadata_val['name']})"
                else:
                    account_label = f"{request.provider.title()} Account"

            encrypted_access = encrypt_vault_secret(request.access_token)
            encrypted_refresh = encrypt_vault_secret(request.refresh_token)

            data_payload = {
                "userId": user_id,
                "provider": request.provider.lower(),
                "providerId": request.provider_id,
                "accountLabel": account_label,
                "accessToken": encrypted_access,
                "refreshToken": encrypted_refresh,
                "scopes": request.scopes or [],
                "status": "ACTIVE",
                "metadata": Json(metadata_val),
            }

            integration = await self.db.userintegration.upsert(
                where={"userId_provider": {"userId": user_id, "provider": request.provider.lower()}},
                data={
                    "create": data_payload,
                    "update": data_payload,
                },
            )

            meta_dict = metadata_val
            return IntegrationResponse(
                id=integration.id,
                user_id=integration.userId,
                provider=integration.provider,
                provider_id=integration.providerId,
                account_label=integration.accountLabel or account_label,
                status=integration.status or "ACTIVE",
                expires_at=integration.expiresAt,
                connected_at=integration.connectedAt,
                updated_at=integration.updatedAt,
                metadata=meta_dict,
            )
        except Exception as e:
            logger.error(f"Error connecting integration: {str(e)}")
            return None

    async def disconnect_integration(
        self, user_id: int, provider: str
    ) -> DisconnectIntegrationResponse:
        """Disconnect an integration for a user with optional upstream revocation"""
        try:
            provider_clean = provider.lower()
            integration = await self.db.userintegration.find_unique(
                where={"userId_provider": {"userId": user_id, "provider": provider_clean}}
            )

            if integration:
                # Upstream revocation attempt
                if integration.accessToken:
                    raw_token = decrypt_vault_secret(integration.accessToken)
                    if provider_clean == "google" and raw_token:
                        try:
                            async with httpx.AsyncClient(timeout=5.0) as client:
                                await client.post(
                                    "https://oauth2.googleapis.com/revoke",
                                    params={"token": raw_token},
                                )
                        except Exception as rev_err:
                            logger.warning(f"Google upstream revocation notice: {rev_err}")

                await self.db.userintegration.delete(
                    where={"userId_provider": {"userId": user_id, "provider": provider_clean}}
                )

            return DisconnectIntegrationResponse(
                success=True, provider=provider_clean, message=f"{provider_clean.title()} disconnected"
            )
        except Exception as e:
            logger.error(f"Error disconnecting integration {provider}: {str(e)}")
            return DisconnectIntegrationResponse(success=False, provider=provider)

    async def get_oauth_authorization_url(
        self, user_id: int, provider: str, redirect_uri: Optional[str] = None
    ) -> str:
        """Get OAuth authorization URL for frontend redirect for integrations."""
        state_data = {
            "userId": user_id,
            "provider": provider.upper(),
            "redirect_uri": redirect_uri,
        }
        state_token = create_access_token(state_data)
        prov = provider.upper()

        if prov == "GOOGLE":
            client_id = setting.GOOGLE_CLIENT_ID
            if not client_id:
                raise ValueError("Google integration is not configured on the server (missing GOOGLE_CLIENT_ID).")
            effective_redirect = setting.GOOGLE_REDIRECT_URI or redirect_uri
            base_url = "https://accounts.google.com/o/oauth2/v2/auth"
            params = {
                "client_id": client_id,
                "redirect_uri": effective_redirect,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive openid email profile",
                "state": state_token,
                "access_type": "offline",
                "prompt": "consent",
            }
        elif prov == "GITHUB":
            client_id = setting.GITHUB_CLIENT_ID
            if not client_id:
                raise ValueError("GitHub integration is not configured on the server (missing GITHUB_CLIENT_ID).")
            effective_redirect = setting.GITHUB_REDIRECT_URI or redirect_uri
            base_url = "https://github.com/login/oauth/authorize"
            params = {
                "client_id": client_id,
                "redirect_uri": effective_redirect,
                "scope": "repo user",
                "state": state_token,
            }
        elif prov == "SLACK":
            client_id = getattr(setting, "SLACK_CLIENT_ID", None)
            if not client_id:
                raise ValueError("Slack integration is not configured on the server (missing SLACK_CLIENT_ID).")
            base_url = "https://slack.com/oauth/v2/authorize"
            params = {
                "client_id": client_id,
                "user_scope": "channels:read chat:write",
                "state": state_token,
            }
            if redirect_uri:
                params["redirect_uri"] = redirect_uri
        elif prov == "ZOOM":
            client_id = getattr(setting, "ZOOM_CLIENT_ID", None)
            if not client_id:
                raise ValueError("Zoom integration is not configured on the server (missing ZOOM_CLIENT_ID).")
            base_url = "https://zoom.us/oauth/authorize"
            params = {
                "response_type": "code",
                "client_id": client_id,
                "state": state_token,
            }
            if redirect_uri:
                params["redirect_uri"] = redirect_uri
        else:
            raise ValueError(f"Unsupported integration provider: {provider}")

        query_string = urllib.parse.urlencode(params)
        return f"{base_url}?{query_string}"

    async def handle_oauth_callback(
        self, provider: str, code: str, state: str, redirect_uri: Optional[str] = None
    ) -> IntegrationResponse:
        """Handle OAuth callback and save integration tokens."""
        payload = verify_token(state)
        if not payload:
            raise ValueError("Invalid or expired state token")

        user_id = payload.get("userId")
        if not user_id:
            raise ValueError("State token missing user_id")

        prov = provider.upper()
        access_token = None
        refresh_token = None
        provider_id = None
        userinfo: Dict[str, Any] = {}

        async with httpx.AsyncClient(timeout=10.0) as client:
            if prov == "GOOGLE":
                token_url = "https://oauth2.googleapis.com/token"
                effective_redirect = redirect_uri or setting.GOOGLE_REDIRECT_URI
                token_response = await client.post(
                    token_url,
                    data={
                        "code": code,
                        "client_id": setting.GOOGLE_CLIENT_ID,
                        "client_secret": setting.GOOGLE_CLIENT_SECRET,
                        "redirect_uri": effective_redirect,
                        "grant_type": "authorization_code",
                    },
                )
                if token_response.status_code != 200:
                    raise ValueError(f"Google token exchange failed: {token_response.text}")

                token_data = token_response.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")

                userinfo_res = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if userinfo_res.status_code == 200:
                    userinfo = userinfo_res.json()
                    provider_id = userinfo.get("sub")

            elif prov == "GITHUB":
                token_url = "https://github.com/login/oauth/access_token"
                token_response = await client.post(
                    token_url,
                    headers={"Accept": "application/json"},
                    data={
                        "code": code,
                        "client_id": setting.GITHUB_CLIENT_ID,
                        "client_secret": setting.GITHUB_CLIENT_SECRET,
                        "redirect_uri": redirect_uri or setting.GITHUB_REDIRECT_URI,
                    },
                )
                if token_response.status_code != 200:
                    raise ValueError(f"GitHub token exchange failed: {token_response.text}")

                token_data = token_response.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")

                userinfo_res = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json",
                    },
                )
                if userinfo_res.status_code == 200:
                    userinfo = userinfo_res.json()
                    provider_id = str(userinfo.get("id"))

            elif prov == "SLACK":
                token_url = "https://slack.com/api/oauth.v2.access"
                slack_client_id = getattr(setting, "SLACK_CLIENT_ID", None)
                slack_client_secret = getattr(setting, "SLACK_CLIENT_SECRET", None)
                data = {
                    "code": code,
                    "client_id": slack_client_id,
                    "client_secret": slack_client_secret,
                }
                if redirect_uri:
                    data["redirect_uri"] = redirect_uri

                token_response = await client.post(token_url, data=data)
                if token_response.status_code != 200:
                    raise ValueError(f"Slack token exchange failed: {token_response.text}")

                token_data = token_response.json()
                if not token_data.get("ok"):
                    raise ValueError(f"Slack token error: {token_data.get('error')}")

                authed_user = token_data.get("authed_user", {})
                access_token = authed_user.get("access_token") or token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")
                provider_id = authed_user.get("id")
                userinfo = token_data

            elif prov == "ZOOM":
                token_url = "https://zoom.us/oauth/token"
                zoom_client_id = getattr(setting, "ZOOM_CLIENT_ID", None)
                zoom_client_secret = getattr(setting, "ZOOM_CLIENT_SECRET", None)
                token_response = await client.post(
                    token_url,
                    auth=(zoom_client_id, zoom_client_secret),
                    data={
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": redirect_uri,
                    },
                )
                if token_response.status_code != 200:
                    raise ValueError(f"Zoom token exchange failed: {token_response.text}")

                token_data = token_response.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")
                userinfo = token_data

            else:
                raise ValueError(f"Unsupported provider: {provider}")

        if not access_token:
            raise ValueError(f"Failed to get access token from {provider}")

        request = ConnectIntegrationRequest(
            provider=provider.lower(),
            provider_id=provider_id or "unknown",
            access_token=access_token,
            refresh_token=refresh_token,
            scopes=userinfo.get("scope", "").split()
            if isinstance(userinfo.get("scope"), str)
            else [],
            metadata=userinfo,
        )

        result = await self.connect_integration(int(user_id), request)
        if not result:
            raise ValueError("Failed to save integration")

        return result


integrations_service = IntegrationsService()
