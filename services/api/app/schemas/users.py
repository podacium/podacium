from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    ConfigDict,
    model_validator,
)
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.schemas.auth import UserRole
import re


# Public Profile Update Schema
class PublicProfileUpdate(BaseModel):
    fullName: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    profilePictureUrl: Optional[str] = Field(None, max_length=500)
    skills: Optional[List[str]] = Field(None, max_length=50)
    socialLinks: Optional[Dict[str, str]] = None

    @field_validator("socialLinks")
    @classmethod
    def validate_social_links(
        cls, v: Optional[Dict[str, str]]
    ) -> Optional[Dict[str, str]]:
        if v is not None:
            for platform, url in v.items():
                if not isinstance(platform, str) or not isinstance(url, str):
                    raise ValueError("Social links must be string key-value pairs")
                # Basic URL validation
                if not url.startswith(("http://", "https://")):
                    raise ValueError(
                        "Social links must be valid URLs starting with http:// or https://"
                    )
                if len(url) > 200:
                    raise ValueError("Social link URL too long")
        return v


# Private Settings Update Schema
class PrivateSettingsUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = None
    subscribeNewsletter: Optional[bool] = None

    @field_validator("phoneNumber", mode="before")
    @classmethod
    def normalize_phone(cls, v):
        if v is None or v == "":
            return None
        # Strip spaces, dashes, parens — keep leading + and digits
        cleaned = re.sub(r"[\s\-()]", "", str(v))
        if not re.match(r"^\+?[1-9]\d{1,14}$", cleaned):
            raise ValueError("Invalid phone number format")
        return cleaned


# Notification Preferences Schema
class NotificationPreferences(BaseModel):
    emailNotifications: bool = Field(default=True)
    pushNotifications: bool = Field(default=True)
    marketingEmails: bool = Field(default=False)
    projectUpdates: bool = Field(default=True)
    courseUpdates: bool = Field(default=True)
    securityAlerts: bool = Field(default=True)
    newsletter: bool = Field(default=False)


# Security Settings Schema
class SecuritySettings(BaseModel):
    twoFactorEnabled: bool = Field(default=False)
    loginAlerts: bool = Field(default=True)
    deviceManagement: bool = Field(default=True)
    sessionTimeout: int = Field(default=24, ge=1, le=720)  # hours


# Verification Requests
class EmailVerificationRequest(BaseModel):
    email: EmailStr


class PhoneVerificationRequest(BaseModel):
    phoneNumber: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$")

    # Make phoneNumber optional since we should use the user's current phone
    @model_validator(mode="before")
    @classmethod
    def validate_phone_number(cls, values):
        # If no phone number provided, that's OK - we'll use the user's current phone
        return values


# Password Change Request
class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(..., min_length=8)
    newPassword: str = Field(..., min_length=8)
    confirmPassword: str = Field(..., min_length=8)

    @field_validator("confirmPassword")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        values = info.data
        if "newPassword" in values and v != values["newPassword"]:
            raise ValueError("Passwords do not match")
        return v


# Account Deletion Request
class AccountDeletionRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)
    feedback: Optional[str] = Field(None, max_length=1000)
    password: str = Field(..., min_length=8)


# Complete User Update Schema (legacy/backward compatibility)
class UserUpdateData(BaseModel):
    # Public fields
    fullName: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    skills: Optional[List[str]] = None
    socialLinks: Optional[Dict[str, str]] = None
    role: Optional[str] = None

    # Private fields
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$")
    subscribeNewsletter: Optional[bool] = None


# Response Schemas
class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: Optional[str] = None
    emailVerified: bool
    phoneNumber: Optional[str] = None
    phoneVerified: bool
    role: UserRole
    fullName: str
    headline: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    skills: List[str]
    socialLinks: Optional[Dict[str, str]] = None
    subscribeNewsletter: bool
    isActive: bool
    lastLoginAt: Optional[datetime] = None
    loginCount: int
    createdAt: datetime
    updatedAt: datetime
    onboardingCompleted: bool = False
    ownedOrganization: Optional[Any] = None
    ownedOrganizations: Optional[List[Any]] = None
    primaryOrganization: Optional[Any] = None
    memberships: Optional[List[Any]] = None

    @model_validator(mode="after")
    def _populate_primary_owned_org(self) -> "UserProfileResponse":
        if self.ownedOrganization is None and self.ownedOrganizations:
            self.ownedOrganization = self.ownedOrganizations[0]
        return self


class PublicUserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fullName: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    skills: List[str]
    socialLinks: Optional[Dict[str, str]] = None
    role: UserRole
    createdAt: datetime
    certificates: List[Any] = []
    instructedModules: List[Any] = []
    skillsDetails: List[Any] = []


class UserSkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class UserSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    userId: int
    name: str
    createdAt: datetime


# Settings Response Schemas
class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notificationPreferences: NotificationPreferences
    securitySettings: SecuritySettings


# Verification Response Schemas
class VerificationResponse(BaseModel):
    message: str
    verification_sent: bool
    method: str
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PasswordChangeResponse(BaseModel):
    message: str
    success: bool


class AccountDeletionResponse(BaseModel):
    message: str
    deletionScheduled: bool
    scheduledAt: datetime


# Phone Verification Schemas
class PhoneVerificationCodeRequest(BaseModel):
    phoneNumber: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d+$")


class PhoneVerificationResponse(BaseModel):
    success: bool
    message: str
    verified: bool
    phoneNumber: str


class PhoneVerificationStore(BaseModel):
    phone_number: str
    verification_code: str
    expires_at: datetime
    attempts: int = 0
    verified: bool = False


class ContactFormRequest(BaseModel):
    """Schema for contact form submission"""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    message: str = Field(..., min_length=10, max_length=2000)
    phone: Optional[str] = Field(None, max_length=20)
    subject: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(
        None, description="general, support, sales, technical, feedback, partnership"
    )


class ContactFormResponse(BaseModel):
    """Response for contact form submission"""

    success: bool
    message: str
    submitted_at: datetime
