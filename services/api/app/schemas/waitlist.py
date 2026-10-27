import re
import secrets
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

DISPOSABLE_DOMAINS = {
    'tempmail.com', 'guerrillamail.com', 'yopmail.com', 'mailinator.com',
    'throwaway.email', 'temp-mail.org', 'guerrillamail.info', 'grr.la',
    'mohmal.com', 'emailondeck.com', 'getnada.com', '10minutemail.com',
    'mailnator.com', 'trashmail.com', 'sharklasers.com', 'boximail.com',
}

BLOCKED_LOCAL_PARTS = {
    'admin', 'postmaster', 'abuse', 'noreply', 'no-reply', 'donotreply',
    'do-not-reply', 'mailer-daemon', 'root', 'hostmaster', 'webmaster',
    'support', 'info', 'help', 'contact', 'sales', 'billing', 'security',
}

NAME_REGEX = re.compile(r'^[^\x00-\x1F]{2,80}$')
REFERRAL_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
REFERRAL_CODE_LENGTH = 8


def normalize_email(email: str) -> str:
    lower = email.strip().lower()
    at_idx = lower.index('@')
    local = lower[:at_idx]
    domain = lower[at_idx + 1:]
    plus_idx = local.find('+')
    if plus_idx != -1:
        local = local[:plus_idx]
    gmail_family = {'gmail.com', 'googlemail.com'}
    if domain in gmail_family:
        local = local.replace('.', '')
    return f'{local}@{domain}'


def generate_referral_code() -> str:
    return ''.join(secrets.choice(REFERRAL_CHARSET) for _ in range(REFERRAL_CODE_LENGTH))


class WaitlistRegisterRequest(BaseModel):
    fullName: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    referralCode: Optional[str] = None
    locale: str = 'en'
    utmSource: Optional[str] = None
    utmMedium: Optional[str] = None
    utmCampaign: Optional[str] = None
    fingerprint: Optional[str] = None
    userAgent: Optional[str] = None
    screenSize: Optional[str] = None
    honeypot: Optional[str] = None

    @field_validator('fullName')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not NAME_REGEX.match(v):
            raise ValueError('Name must be 2-80 characters')
        return v.strip()

    @field_validator('locale')
    @classmethod
    def validate_locale(cls, v: str) -> str:
        if v not in ('en', 'fr', 'ar'):
            return 'en'
        return v

    @field_validator('referralCode')
    @classmethod
    def validate_referral_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        code = v.strip().upper()
        valid_chars = set(REFERRAL_CHARSET)
        if len(code) != REFERRAL_CODE_LENGTH or not all(c in valid_chars for c in code):
            raise ValueError('Invalid referral code format')
        return code

    @field_validator('honeypot')
    @classmethod
    def validate_honeypot(cls, v: Optional[str]) -> Optional[str]:
        if v:
            raise ValueError('Bot detected')
        return v


class WaitlistEntryResponse(BaseModel):
    id: int
    fullName: str
    email: str
    referralCode: str
    friendsReferredCount: int
    status: str
    createdAt: datetime

    model_config = ConfigDict(from_attributes=True)


class WaitlistRegisterResponse(BaseModel):
    ok: bool = True
    entry: WaitlistEntryResponse
    queuePosition: int
    alreadyRegistered: bool = False


class WaitlistStatsResponse(BaseModel):
    totalCount: int


class WaitlistPositionResponse(BaseModel):
    position: int
    totalCount: int


class WaitlistLeaderboardEntry(BaseModel):
    fullName: str
    friendsReferredCount: int
    createdAt: datetime


class WaitlistLeaderboardResponse(BaseModel):
    entries: list[WaitlistLeaderboardEntry]
    totalCount: int


class WaitlistStatusResponse(BaseModel):
    registered: bool
    entry: Optional[WaitlistEntryResponse] = None


class WaitlistValidateReferralResponse(BaseModel):
    valid: bool
    inviterName: Optional[str] = None


class WaitlistAdminEntryResponse(WaitlistEntryResponse):
    metadata: Any = {}
    convertedToUserId: Optional[int] = None
    convertedAt: Optional[datetime] = None
    referralsCount: int = 0

    model_config = ConfigDict(from_attributes=True)


class WaitlistAdminStatsResponse(BaseModel):
    totalEntries: int
    pendingCount: int
    verifiedCount: int
    convertedCount: int
    bouncedCount: int
    unsubscribedCount: int
    conversionRate: float
    avgReferrals: float
    hourlySignups: list[dict] = []


class WaitlistReferralMilestoneResponse(BaseModel):
    id: int
    position: int
    referralsRequired: int
    reward: str
    rewardType: str
    isActive: bool

    model_config = ConfigDict(from_attributes=True)


class WaitlistMilestoneCreate(BaseModel):
    position: int
    referralsRequired: int
    reward: str
    rewardType: str = 'FREE_MONTH'
    isActive: bool = True
