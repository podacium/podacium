# app/schemas/phone_verification.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class PhoneVerificationRequest(BaseModel):
    """Request phone verification"""

    phoneNumber: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")

    @field_validator("phoneNumber")
    @classmethod
    def validate_phone_number(cls, v: str) -> str:
        # Remove any non-digit characters except leading +
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        # Ensure it starts with country code for Algeria
        if cleaned.startswith("0"):
            cleaned = "213" + cleaned[1:]
        elif not cleaned.startswith("+") and not cleaned.startswith("213"):
            cleaned = "213" + cleaned
        return cleaned


class PhoneVerificationCodeRequest(BaseModel):
    """Submit verification code"""

    phoneNumber: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Code must contain only digits")
        return v


class PhoneVerificationResponse(BaseModel):
    """Verification response"""

    success: bool
    message: str
    verified: bool
    phoneNumber: str


class PhoneVerificationStatus(BaseModel):
    """Verification status"""

    exists: bool
    verified: bool
    expired: bool
    attempts: int
    expires_at: Optional[str] = None
    rate_limited: bool = False


class BulkPhoneVerificationRequest(BaseModel):
    """Bulk phone verification for multiple users"""

    phone_numbers: list[str] = Field(..., min_length=1, max_length=100)


class BulkPhoneVerificationResponse(BaseModel):
    """Bulk verification response"""

    total: int
    successful: int
    failed: int
    results: dict[str, PhoneVerificationResponse]


class PhoneUpdateRequest(BaseModel):
    """Update phone number with verification"""

    newPhoneNumber: str = Field(..., pattern=r"^\+?[1-9]\d{1,14}$")
    verificationCode: Optional[str] = None
