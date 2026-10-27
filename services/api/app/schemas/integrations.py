from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class IntegrationResponse(BaseModel):
    id: int
    user_id: int
    provider: str
    provider_id: Optional[str] = None
    account_label: Optional[str] = None
    status: str = "ACTIVE"
    expires_at: Optional[datetime] = None
    connected_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None

class IntegrationsListResponse(BaseModel):
    integrations: List[IntegrationResponse]

class ConnectIntegrationRequest(BaseModel):
    provider: str
    access_token: str
    provider_id: Optional[str] = None
    account_label: Optional[str] = None
    refresh_token: Optional[str] = None
    scopes: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = None

class DisconnectIntegrationResponse(BaseModel):
    success: bool
    provider: str
    message: Optional[str] = "Integration disconnected successfully"
