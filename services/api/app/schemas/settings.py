from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime

# Account Settings
class AccountSettingsBase(BaseModel):
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    subscribe_newsletter: bool = False
    language: str = "en"
    timezone: str = "UTC"
    date_format: str = "MM/DD/YYYY"
    time_format: Literal["12h", "24h"] = "12h"
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None

class AccountSettingsUpdate(AccountSettingsBase):
    pass

class AccountSettingsResponse(AccountSettingsBase):
    email_verified: bool = False
    phone_verified: bool = False
    created_at: datetime
    updated_at: datetime

# Appearance Settings
class AppearanceSettingsBase(BaseModel):
    theme: Literal["light", "dark", "system"] = "system"
    reduced_motion: bool = False
    high_contrast: bool = False
    font_size: Literal["small", "medium", "large"] = "medium"
    density: Literal["compact", "comfortable", "spacious"] = "comfortable"

class AppearanceSettingsUpdate(AppearanceSettingsBase):
    pass

class AppearanceSettingsResponse(AppearanceSettingsBase):
    user_id: int
    created_at: datetime
    updated_at: datetime

# Privacy Settings
class PrivacySettingsBase(BaseModel):
    profile_visibility: Literal["public", "connections", "private"] = "public"
    search_visibility: bool = True
    activity_status: bool = True
    read_receipts: bool = True
    show_bio: str = "inherit"
    show_skills: str = "inherit"
    show_portfolio: str = "inherit"
    show_certificates: str = "inherit"
    show_reviews: str = "inherit"
    show_enrollments: str = "inherit"
    show_contact_info: str = "inherit"
    show_organization: str = "inherit"
    show_tagline: str = "inherit"
    show_headline: str = "inherit"
    show_pronouns: str = "inherit"
    show_availability: str = "inherit"
    show_rating: str = "inherit"
    show_email: bool = False
    show_phone: bool = False
    show_last_active: bool = True

class PrivacySettingsUpdate(PrivacySettingsBase):
    pass

class PrivacySettingsResponse(PrivacySettingsBase):
    user_id: int
    created_at: datetime
    updated_at: datetime

# Advanced Settings
class AdvancedSettingsBase(BaseModel):
    api_access: bool = False
    webhooks: bool = False
    data_export: bool = False
    debug_mode: bool = False
    performance_mode: bool = False
    cache_size: int = 500
    log_level: Literal["error", "warn", "info", "debug"] = "info"

class AdvancedSettingsUpdate(AdvancedSettingsBase):
    pass

class AdvancedSettingsResponse(AdvancedSettingsBase):
    user_id: int
    created_at: datetime
    updated_at: datetime

# Billing Settings
class BillingSettingsBase(BaseModel):
    plan: Literal["free", "pro", "enterprise"] = "free"
    billing_email: Optional[EmailStr] = None
    auto_renew: bool = True

class BillingSettingsUpdate(BillingSettingsBase):
    pass

class BillingSettingsResponse(BillingSettingsBase):
    user_id: int
    next_billing_date: Optional[datetime] = None
    payment_method_last4: Optional[str] = None
    payment_method_brand: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Usage Tracking
class UsageMetrics(BaseModel):
    storage: int
    storage_limit: int
    bandwidth: int
    bandwidth_limit: int
    projects: int
    projects_limit: int
    collaborators: int
    collaborators_limit: int

class UsageResponse(BaseModel):
    metrics: UsageMetrics
    period_start: datetime
    period_end: datetime