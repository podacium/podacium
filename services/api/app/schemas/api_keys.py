from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(
        ..., min_length=1, max_length=100, description="Friendly key identifier"
    )
    scopes: Optional[List[str]] = Field(
        default_factory=list, description="Permitted API scopes"
    )
    environment: str = Field(
        "production", description="Key environment (production or sandbox)"
    )
    expires_days: Optional[int] = Field(
        None, description="Optional key validity in days"
    )


class ApiKeyRotateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    grace_hours: Optional[int] = Field(
        168, description="Grace period in hours (default 168 = 7 days)"
    )


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    user_id: int
    name: str
    key_prefix: str
    masked_key: Optional[str] = None
    scopes: List[str]
    environment: str
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    grace_expires_at: Optional[datetime] = None
    successor_key_id: Optional[int] = None
    replaced_key_id: Optional[int] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None


class ApiKeyCreatedResponse(ApiKeyResponse):
    secret_key: str = Field(..., description="Plaintext secret key (revealed ONCE)")


class ApiKeyListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    api_keys: List[ApiKeyResponse]
