from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


# Password Change
class PasswordChangeRequest(BaseModel):
    currentPassword: str
    newPassword: str
    confirmPassword: str


class PasswordChangeResponse(BaseModel):
    message: str
    changed_at: datetime


# Security Settings
class SecuritySettingsBase(BaseModel):
    two_factor_enabled: bool = False
    login_alerts: bool = True
    device_management: bool = True
    session_timeout: int = 24


class SecuritySettingsUpdate(SecuritySettingsBase):
    pass


class SecuritySettingsResponse(SecuritySettingsBase):
    user_id: int
    last_password_change: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# Device Management — Fingerprint-based
class DeviceItem(BaseModel):
    id: int
    fingerprint_hash: str = Field(..., alias="fingerprintHash")
    platform: Optional[str] = None
    browser_name: Optional[str] = Field(None, alias="browserName")
    browser_version: Optional[str] = Field(None, alias="browserVersion")
    os_version: Optional[str] = Field(None, alias="osVersion")
    device_model: Optional[str] = Field(None, alias="deviceModel")
    screen_resolution: Optional[str] = Field(None, alias="screenResolution")
    last_known_wilaya: Optional[str] = Field(None, alias="lastKnownWilaya")
    last_active_at: str = Field(..., alias="lastActiveAt")
    first_seen_at: str = Field(..., alias="firstSeenAt")
    login_count: int = Field(..., alias="loginCount")
    is_trusted: bool = Field(..., alias="isTrusted")
    is_primary: bool = Field(..., alias="isPrimary")

    model_config = {"populate_by_name": True, "from_attributes": True}


class DeviceListResponse(BaseModel):
    devices: list[DeviceItem]
    current_device_id: Optional[int] = Field(None, alias="currentDeviceId")

    model_config = {"populate_by_name": True}


class DeviceResponse(BaseModel):
    id: int
    is_trusted: Optional[bool] = Field(None, alias="isTrusted")
    is_primary: Optional[bool] = Field(None, alias="isPrimary")

    model_config = {"populate_by_name": True}


class DeviceTrustToggleRequest(BaseModel):
    is_trusted: Optional[bool] = Field(None, alias="isTrusted")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = {"populate_by_name": True}


class SecurityEventResponse(BaseModel):
    id: int
    event_type: str = Field(..., alias="eventType")
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: str = Field(..., alias="createdAt")
    wilaya: Optional[str] = None

    model_config = {"populate_by_name": True}


class EscrowEligibilityResponse(BaseModel):
    allowed: bool
    cooldown_expires_at: Optional[str] = Field(None, alias="cooldownExpiresAt")
    requires_2fa_bypass: bool = Field(..., alias="requires2faBypass")

    model_config = {"populate_by_name": True}


# Two-Factor Authentication
class TwoFactorSetupRequest(BaseModel):
    enable: bool


class TwoFactorSetupResponse(BaseModel):
    qr_code_url: Optional[str] = None
    backup_codes: list[str] = []
    message: str


class TwoFactorVerifyRequest(BaseModel):
    code: str
