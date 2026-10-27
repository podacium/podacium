from pydantic import (
    BaseModel,
    EmailStr,
    field_validator,
    Field,
    model_validator,
    ConfigDict,
)
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import re


class AuthProvider(str, Enum):
    EMAIL = "EMAIL"
    GOOGLE = "GOOGLE"
    GITHUB = "GITHUB"
    LINKEDIN = "LINKEDIN"
    PHONE = "PHONE"


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    BUSINESS = "BUSINESS"
    FREELANCER = "FREELANCER"
    ADMIN = "ADMIN"
    INSTRUCTOR = "INSTRUCTOR"
    MODERATOR = "MODERATOR"


# Roles that users are allowed to self-assign during registration
SELF_ASSIGNABLE_ROLES = {UserRole.STUDENT, UserRole.BUSINESS, UserRole.FREELANCER}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = 1800  # 30 minutes


def _validate_password_complexity(password: str) -> str:
    """Shared password complexity validator."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]', password):
        raise ValueError(
            "Password must contain at least one special character (!@#$%^&*...)"
        )
    return password


class UserRegister(BaseModel):
    fullName: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$")
    password: str = Field(..., min_length=8)
    provider: AuthProvider = AuthProvider.EMAIL
    role: UserRole = UserRole.STUDENT
    acceptedTerms: bool = Field(False)
    subscribeNewsletter: bool = Field(False)
    locale: str = Field("en", min_length=2, max_length=5)
    honeypot: Optional[str] = None
    turnstileToken: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def email_or_phone_required(cls, values):
        """Ensure either email or phone number is provided."""
        email = values.get("email")
        phone_number = values.get("phoneNumber")

        if not email and not phone_number:
            raise ValueError("Either email or phone number is required")
        return values

    @field_validator("acceptedTerms")
    @classmethod
    def terms_must_be_accepted(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the terms and conditions")
        return v

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """Enforce password complexity rules."""
        return _validate_password_complexity(v)

    @field_validator("role")
    @classmethod
    def prevent_admin_self_assignment(cls, v: UserRole) -> UserRole:
        """Users cannot self-assign ADMIN or INSTRUCTOR roles."""
        if v not in SELF_ASSIGNABLE_ROLES:
            return UserRole.STUDENT
        return v


class UserLogin(BaseModel):
    model_config = {"extra": "ignore"}

    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = None
    password: str = Field(..., min_length=1)
    rememberMe: Optional[bool] = None
    turnstileToken: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def email_or_phone_required(cls, values):
        """Ensure either email or phone number is provided."""
        if not isinstance(values, dict):
            return values
        email = values.get("email")
        phone_number = values.get("phoneNumber")

        if not email and not phone_number:
            raise ValueError("Either email or phone number is required")
        return values


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """Enforce password complexity rules on reset too."""
        return _validate_password_complexity(v)


class EmailVerificationRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    fullName: str
    email: Optional[str]
    emailVerified: bool
    phoneNumber: Optional[str]
    phoneVerified: bool
    role: UserRole
    profilePictureUrl: Optional[str]
    bio: Optional[str]
    country: Optional[str]
    city: Optional[str]
    skills: List[str]
    socialLinks: Optional[Dict[str, str]] = None
    onboardingCompleted: bool = False
    has_password: bool = False
    createdAt: datetime
    updatedAt: datetime

    @model_validator(mode="before")
    @classmethod
    def set_computed_fields(cls, data: Any) -> Any:
        """Set has_password based on passwordHash and handle other computed fields."""
        password_hash = None
        if isinstance(data, dict):
            password_hash = data.get("passwordHash")
            data["has_password"] = bool(password_hash)
        else:
            password_hash = getattr(data, "passwordHash", None)
            try:
                setattr(data, "has_password", bool(password_hash))
            except (AttributeError, TypeError):
                # Fallback: if we can't set it (e.g. immutable object),
                # return a dict so Pydantic can still pick it up.
                if hasattr(data, "model_dump"):
                    data = data.model_dump()
                elif hasattr(data, "__dict__"):
                    data = dict(data.__dict__)

                if isinstance(data, dict):
                    data["has_password"] = bool(password_hash)

        return data

    model_config = ConfigDict(from_attributes=True)


# Aliases for compatibility
UserSignup = UserRegister
