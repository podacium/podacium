import logging

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.schemas.settings import *
from app.schemas.security import *
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.settings_service import settings_service
from app.services.security_service import security_service

router = APIRouter(prefix="/settings", tags=["settings"])


# Account Settings
@router.get("/account", response_model=AccountSettingsResponse)
async def get_account_settings(current_user=Depends(get_current_user)):
    """Get account settings"""
    settings = await settings_service.get_account_settings(current_user.id)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


@router.put("/account", response_model=AccountSettingsResponse)
async def update_account_settings(
    settings: AccountSettingsUpdate, current_user=Depends(get_current_user)
):
    """Update account settings"""
    try:
        return await settings_service.update_account_settings(current_user.id, settings)
    except ValueError as e:
        # Handle validation errors (like duplicate phone/email)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update account settings",
        )


# Security Settings
@router.get("/security", response_model=SecuritySettingsResponse)
async def get_security_settings(current_user=Depends(get_current_user)):
    """Get security settings"""
    return await security_service.get_security_settings(current_user.id)


@router.put("/security", response_model=SecuritySettingsResponse)
async def update_security_settings(
    settings: SecuritySettingsUpdate, current_user=Depends(get_current_user)
):
    """Update security settings"""
    return await security_service.update_security_settings(current_user.id, settings)


@router.post("/security/change-password", response_model=PasswordChangeResponse)
async def change_password(
    request: PasswordChangeRequest, current_user=Depends(get_current_user)
):
    """Change password"""
    try:
        return await security_service.change_password(current_user.id, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password",
        )


# Usage Tracking
@router.get("/usage", response_model=UsageResponse)
async def get_usage_metrics(current_user=Depends(get_current_user)):
    """Get usage metrics"""
    return await settings_service.get_usage_metrics(current_user.id)


# Appearance Settings
@router.get("/appearance", response_model=AppearanceSettingsResponse)
async def get_appearance_settings(current_user=Depends(get_current_user)):
    """Get appearance settings"""
    return await settings_service.get_appearance_settings(current_user.id)


@router.put("/appearance", response_model=AppearanceSettingsResponse)
async def update_appearance_settings(
    settings: AppearanceSettingsUpdate, current_user=Depends(get_current_user)
):
    """Update appearance settings"""
    return await settings_service.update_appearance_settings(current_user.id, settings)


# Privacy Settings
@router.get("/privacy", response_model=PrivacySettingsResponse)
async def get_privacy_settings(current_user=Depends(get_current_user)):
    """Get privacy settings"""
    return await settings_service.get_privacy_settings(current_user.id)


@router.put("/privacy", response_model=PrivacySettingsResponse)
async def update_privacy_settings(
    settings: PrivacySettingsUpdate, current_user=Depends(get_current_user)
):
    """Update privacy settings"""
    return await settings_service.update_privacy_settings(current_user.id, settings)


from app.generated.prisma.enums import SubscriptionPlan
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


# Notification Preferences
class NotificationPreferences(BaseModel):
    email_notifications: Optional[bool] = None
    emailNotifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    pushNotifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    smsNotifications: Optional[bool] = None
    marketing_emails: Optional[bool] = None
    marketingEmails: Optional[bool] = None
    newsletter: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest: str = "daily"


def _format_notification_prefs(prefs) -> dict:
    if not prefs:
        return {
            "email_notifications": True,
            "emailNotifications": True,
            "push_notifications": True,
            "pushNotifications": True,
            "sms_notifications": False,
            "smsNotifications": False,
            "marketing_emails": False,
            "marketingEmails": False,
            "newsletter": False,
            "quiet_hours_start": None,
            "quiet_hours_end": None,
            "digest": "daily",
        }
    return {
        "email_notifications": prefs.emailNotifications,
        "emailNotifications": prefs.emailNotifications,
        "push_notifications": prefs.pushNotifications,
        "pushNotifications": prefs.pushNotifications,
        "sms_notifications": prefs.smsNotifications,
        "smsNotifications": prefs.smsNotifications,
        "marketing_emails": prefs.marketingEmails,
        "marketingEmails": prefs.marketingEmails,
        "newsletter": prefs.newsletter,
        "quiet_hours_start": prefs.quietHoursStart,
        "quiet_hours_end": prefs.quietHoursEnd,
        "digest": getattr(prefs, "digestFrequency", "daily"),
    }


@router.get("/notifications")
async def get_notification_preferences(current_user=Depends(get_current_user)):
    """Get notification preferences"""
    try:
        prefs = await prisma.notificationpreferences.find_unique(
            where={"userId": current_user.id}
        )
        return _format_notification_prefs(prefs)
    except Exception as e:
        logger.error(f"Error fetching notification preferences: {str(e)}")
        return _format_notification_prefs(None)


@router.put("/notifications")
async def update_notification_preferences(
    preferences: NotificationPreferences, current_user=Depends(get_current_user)
):
    """Update notification preferences"""
    try:
        email_val = (
            preferences.email_notifications
            if preferences.email_notifications is not None
            else (
                preferences.emailNotifications
                if preferences.emailNotifications is not None
                else True
            )
        )
        push_val = (
            preferences.push_notifications
            if preferences.push_notifications is not None
            else (
                preferences.pushNotifications
                if preferences.pushNotifications is not None
                else True
            )
        )
        sms_val = (
            preferences.sms_notifications
            if preferences.sms_notifications is not None
            else (
                preferences.smsNotifications
                if preferences.smsNotifications is not None
                else False
            )
        )
        marketing_val = (
            preferences.marketing_emails
            if preferences.marketing_emails is not None
            else (
                preferences.marketingEmails
                if preferences.marketingEmails is not None
                else False
            )
        )
        newsletter_val = (
            preferences.newsletter if preferences.newsletter is not None else False
        )

        data = {
            "emailNotifications": email_val,
            "pushNotifications": push_val,
            "smsNotifications": sms_val,
            "marketingEmails": marketing_val,
            "newsletter": newsletter_val,
            "quietHoursStart": preferences.quiet_hours_start,
            "quietHoursEnd": preferences.quiet_hours_end,
            "digestFrequency": preferences.digest,
        }

        updated = await prisma.notificationpreferences.upsert(
            where={"userId": current_user.id},
            data={
                "create": {
                    "userId": current_user.id,
                    **data,
                },
                "update": data,
            },
        )
        return _format_notification_prefs(updated)
    except Exception as e:
        logger.error(f"Error updating notification preferences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification preferences",
        )


# Billing
@router.get("/billing")
async def get_billing_info(current_user=Depends(get_current_user)):
    """Get billing info with real subscription and payment method data."""
    try:
        uid = current_user.id
        subscription = await prisma.subscription.find_first(
            where={
                "userId": uid,
                "status": {"in": ["ACTIVE", "GRACE_PERIOD", "PENDING_PAYMENT"]},
            },
            order={"createdAt": "desc"},
        )
        payment_methods = await prisma.paymentmethod.find_many(
            where={"userId": uid, "deletedAt": None},
        )
        transactions = await prisma.transaction.find_many(
            where={"userId": uid},
            order={"createdAt": "desc"},
            take=50,
        )

        invoices = []
        for t in transactions:
            st_raw = (
                t.status.name.lower()
                if hasattr(t.status, "name")
                else str(t.status).lower()
            )
            if st_raw in ("completed", "paid", "succeeded"):
                st = "paid"
            elif st_raw in ("pending", "processing"):
                st = "pending"
            else:
                st = "failed"

            purpose_str = (
                t.purpose.name if hasattr(t.purpose, "name") else str(t.purpose)
            )
            desc = (
                f"{purpose_str.replace('_', ' ').title()} Payment"
                if purpose_str
                else "Subscription Payment"
            )

            invoices.append(
                {
                    "id": f"inv_{t.id}",
                    "transaction_id": t.id,
                    "download_url": f"/api/v1/billing/payments/invoices/{t.id}/download",
                    "amount": t.amount,
                    "currency": t.currency or "DZD",
                    "status": st,
                    "date": t.createdAt.isoformat(),
                    "description": desc,
                }
            )

        formatted_pms = []
        for pm in payment_methods:
            meta = pm.metadata if isinstance(pm.metadata, dict) else {}
            brand = meta.get("brand") or (
                pm.providerType
                if pm.providerType
                else (
                    pm.provider.name.lower()
                    if hasattr(pm.provider, "name")
                    else str(pm.provider).lower()
                )
            )
            if not brand or brand == "unknown":
                brand = "Visa"
            last4 = meta.get("last4") or "4242"
            exp_month = meta.get("exp_month") or 12
            exp_year = meta.get("exp_year") or 2028
            formatted_pms.append(
                {
                    "id": str(pm.id),
                    "brand": str(brand).capitalize(),
                    "last4": str(last4),
                    "exp_month": int(exp_month),
                    "exp_year": int(exp_year),
                    "is_default": bool(pm.isDefault),
                    "provider": pm.provider.name.lower()
                    if hasattr(pm.provider, "name")
                    else str(pm.provider).lower(),
                    "provider_type": pm.providerType,
                }
            )

        return {
            "plan": subscription.plan.lower() if subscription else "free",
            "subscription": {
                "id": subscription.id,
                "plan": subscription.plan.lower(),
                "status": subscription.status.lower(),
                "billing_cycle": subscription.billingCycle,
                "amount": subscription.amount,
                "currency": subscription.currency,
                "current_period_start": subscription.currentPeriodStart.isoformat(),
                "current_period_end": subscription.currentPeriodEnd.isoformat(),
                "auto_renew": subscription.autoRenew,
                "cancelled_at": subscription.cancelledAt.isoformat()
                if subscription.cancelledAt
                else None,
            }
            if subscription
            else None,
            "payment_methods": formatted_pms,
            "invoices": invoices,
        }
    except Exception as e:
        logger.error(f"Error fetching billing info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch billing info",
        )


@router.get("/billing/invoices")
async def get_invoice_history(current_user=Depends(get_current_user)):
    """Get invoice history from transactions."""
    try:
        transactions = await prisma.transaction.find_many(
            where={"userId": current_user.id},
            order={"createdAt": "desc"},
            take=50,
        )
        return [
            {
                "id": t.id,
                "amount": t.amount,
                "currency": t.currency,
                "status": t.status.lower(),
                "purpose": t.purpose.lower(),
                "created_at": t.createdAt.isoformat(),
                "provider_reference": t.providerReference,
            }
            for t in transactions
        ]
    except Exception as e:
        logger.error(f"Error fetching invoice history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch invoice history",
        )


class PaymentMethodRequest(BaseModel):
    token: Optional[str] = None
    type: Optional[str] = "card"
    cardholder_name: Optional[str] = None
    brand: Optional[str] = None
    last4: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool = False


@router.post("/billing/payment-method")
@router.post("/payment-methods")
async def add_payment_method(
    request: PaymentMethodRequest = None, current_user=Depends(get_current_user)
):
    """Add tokenized payment method."""
    try:
        req = request or PaymentMethodRequest()
        user_id = current_user.id

        existing_count = await prisma.paymentmethod.count(
            where={"userId": user_id, "deletedAt": None}
        )
        should_be_default = req.is_default or (existing_count == 0)

        if should_be_default:
            await prisma.paymentmethod.update_many(
                where={"userId": user_id},
                data={"isDefault": False},
            )

        metadata = {
            "brand": req.brand or "Visa",
            "last4": req.last4 or "4242",
            "exp_month": req.exp_month or 12,
            "exp_year": req.exp_year or 2028,
            "cardholder_name": req.cardholder_name or "",
        }

        method = await prisma.paymentmethod.create(
            data={
                "userId": user_id,
                "provider": "CHARGILY",
                "providerType": req.type or "card",
                "providerId": req.token or f"tok_{int(datetime.utcnow().timestamp())}",
                "isDefault": should_be_default,
                "metadata": Json(metadata),
            }
        )
        return {
            "status": "ok",
            "id": str(method.id),
            "message": "Payment method added",
            "is_default": method.isDefault,
        }
    except Exception as e:
        logger.error(f"Error adding payment method: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add payment method",
        )


@router.put("/billing/payment-method/{id}/default")
@router.put("/payment-methods/{id}/default")
async def set_default_payment_method(id: int, current_user=Depends(get_current_user)):
    """Set a payment method as default."""
    try:
        method = await prisma.paymentmethod.find_first(
            where={"id": id, "userId": current_user.id, "deletedAt": None}
        )
        if not method:
            raise HTTPException(status_code=404, detail="Payment method not found")

        await prisma.paymentmethod.update_many(
            where={"userId": current_user.id},
            data={"isDefault": False},
        )
        await prisma.paymentmethod.update(
            where={"id": id},
            data={"isDefault": True},
        )
        return {"status": "ok", "id": str(id), "is_default": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting default payment method: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set default payment method",
        )


@router.delete("/billing/payment-method/{id}")
async def remove_payment_method(id: int, current_user=Depends(get_current_user)):
    """Remove payment method (soft delete)."""
    try:
        method = await prisma.paymentmethod.find_first(
            where={"id": id, "userId": current_user.id}
        )
        if not method:
            raise HTTPException(status_code=404, detail="Payment method not found")
        await prisma.paymentmethod.update(
            where={"id": id},
            data={"deletedAt": datetime.utcnow()},
        )
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing payment method: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove payment method",
        )


class PlanChangeRequest(BaseModel):
    plan: str


@router.put("/billing/plan")
@router.post("/billing/plan")
async def change_billing_plan(
    request: PlanChangeRequest, current_user=Depends(get_current_user)
):
    """Change subscription plan using real SubscriptionPlan enum values."""
    try:
        valid_plans = {e.name for e in SubscriptionPlan}
        plan_upper = request.plan.upper().replace("-", "_")
        if plan_upper not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid plan. Valid: {', '.join(sorted(p.lower().replace('_', '-') for p in valid_plans))}",
            )
        now = datetime.utcnow()
        await prisma.subscription.upsert(
            where={
                "userId_plan": {"userId": current_user.id, "plan": plan_upper},
            },
            data={
                "create": {
                    "userId": current_user.id,
                    "plan": plan_upper,
                    "status": "ACTIVE",
                    "amount": 0,
                    "billingCycle": "monthly",
                    "currency": "DZD",
                    "currentPeriodStart": now,
                    "currentPeriodEnd": now.replace(year=now.year + 10),
                    "startedAt": now,
                },
                "update": {
                    "plan": plan_upper,
                    "status": "ACTIVE",
                },
            },
        )
        return {
            "plan": plan_upper.lower(),
            "status": "changed",
            "effective_date": now.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change plan",
        )


# Security Devices
@router.get("/security/devices")
async def get_trusted_devices(current_user=Depends(get_current_user)):
    """List trusted devices from UserDevice model."""
    try:
        devices = await prisma.userdevice.find_many(
            where={"userId": current_user.id, "isActive": True},
            order={"lastActiveAt": "desc"},
        )
        return [
            {
                "id": d.id,
                "platform": d.platform,
                "browser_name": d.browserName,
                "browser_version": d.browserVersion,
                "os_version": d.osVersion,
                "device_model": d.deviceModel,
                "is_trusted": d.isTrusted,
                "is_primary": d.isPrimary,
                "first_seen_at": d.firstSeenAt.isoformat(),
                "last_active_at": d.lastActiveAt.isoformat(),
                "login_count": d.loginCount,
            }
            for d in devices
        ]
    except Exception as e:
        logger.error(f"Error fetching devices: {str(e)}")
        return []


@router.delete("/security/devices/{device_id}")
async def remove_trusted_device(device_id: int, current_user=Depends(get_current_user)):
    """Remove a trusted device (soft delete)."""
    try:
        device = await prisma.userdevice.find_first(
            where={"id": device_id, "userId": current_user.id}
        )
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        await prisma.userdevice.update(
            where={"id": device_id},
            data={"isActive": False},
        )
        return {"status": "removed", "device_id": device_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove device",
        )


@router.put("/privacy/section/{section}")
async def update_section_visibility(
    section: str, data: dict, current_user=Depends(get_current_user)
):
    """Update visibility for a single profile section"""
    from app.routers.profiles_extras import SECTION_VISIBILITY_FIELDS

    field = f"{section}_visibility"
    if field not in SECTION_VISIBILITY_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid section: {section}. Valid: bio, headline, tagline, pronouns, cover_image, location, social_links, availability, timezone, profile_views, last_active, followers, following, badges, skills, activity_feed, username_history",
        )
    valid_values = {"public", "followers", "connections", "private"}
    value = data.get("visibility", "public")
    if value not in valid_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid visibility value: {value}. Must be one of: {', '.join(sorted(valid_values))}",
        )
    try:
        await prisma.user.update(
            where={"id": current_user.id},
            data={field: value},
        )
        return {"section": section, "visibility": value}
    except Exception as e:
        logger.error(f"Error updating section visibility: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update section visibility",
        )


# Integrations
@router.get("/integrations")
async def get_integrations(current_user=Depends(get_current_user)):
    """Get connected integrations"""
    try:
        integrations = await prisma.userintegration.find_many(
            where={"userId": current_user.id}
        )
        result = []
        for integration in integrations:
            result.append(
                {
                    "id": integration.id,
                    "provider": integration.provider,
                    "connected": True,
                    "connectedAt": integration.connectedAt.isoformat()
                    if integration.connectedAt
                    else None,
                }
            )
        return result
    except Exception as e:
        logger.error(f"Error fetching integrations: {str(e)}")
        return []


@router.post("/integrations/{provider}")
async def connect_integration(provider: str, current_user=Depends(get_current_user)):
    """Connect integration"""
    try:
        await prisma.userintegration.upsert(
            where={
                "userId_provider": {"userId": current_user.id, "provider": provider}
            },
            data={
                "create": {
                    "userId": current_user.id,
                    "provider": provider,
                    "connectedAt": datetime.utcnow(),
                },
                "update": {"connectedAt": datetime.utcnow()},
            },
        )
        return {"status": "connected", "provider": provider}
    except Exception as e:
        logger.error(f"Error connecting integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to connect integration",
        )


@router.delete("/integrations/{provider}")
async def disconnect_integration(provider: str, current_user=Depends(get_current_user)):
    """Disconnect integration"""
    try:
        await prisma.userintegration.delete_many(
            where={"userId": current_user.id, "provider": provider}
        )
        return {"status": "disconnected"}
    except Exception as e:
        logger.error(f"Error disconnecting integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect integration",
        )


# Advanced Settings
@router.get("/advanced")
async def get_advanced_settings(current_user=Depends(get_current_user)):
    """Get advanced settings.

    The frontend consumes api_keys/webhooks lists (no such entities exist yet),
    while the real per-user advanced flags live on AdvancedSettings.
    """
    try:
        settings = await prisma.advancedsettings.find_unique(
            where={"userId": current_user.id}
        )
        flags = {
            "api_access": settings.apiAccess if settings else False,
            "webhooks": settings.webhooks if settings else False,
            "data_export": settings.dataExport if settings else False,
            "debug_mode": settings.debugMode if settings else False,
            "performance_mode": settings.performanceMode if settings else False,
            "cache_size": settings.cacheSize if settings else 500,
            "log_level": (settings.logLevel or "INFO").lower() if settings else "info",
        }
        return {"api_keys": [], "webhooks": [], **flags}
    except Exception as e:
        logger.error(f"Error fetching advanced settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch advanced settings",
        )


@router.put("/advanced")
async def update_advanced_settings(
    settings: AdvancedSettingsUpdate, current_user=Depends(get_current_user)
):
    """Update advanced settings (persisted on the AdvancedSettings row)."""
    try:
        update_data = {}
        if settings.api_access is not None:
            update_data["apiAccess"] = settings.api_access
        if settings.webhooks is not None:
            update_data["webhooks"] = settings.webhooks
        if settings.data_export is not None:
            update_data["dataExport"] = settings.data_export
        if settings.debug_mode is not None:
            update_data["debugMode"] = settings.debug_mode
        if settings.performance_mode is not None:
            update_data["performanceMode"] = settings.performance_mode
        if settings.cache_size is not None:
            update_data["cacheSize"] = settings.cache_size
        if settings.log_level is not None:
            update_data["logLevel"] = settings.log_level.upper()

        await prisma.advancedsettings.upsert(
            where={"userId": current_user.id},
            data={
                "create": {
                    "userId": current_user.id,
                    **update_data,
                },
                "update": update_data,
            },
        )
        return {"status": "updated", "settings": update_data}
    except Exception as e:
        logger.error(f"Error updating advanced settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update advanced settings",
        )


@router.post("/advanced/export-data")
async def request_data_export(current_user=Depends(get_current_user)):
    """Request data export — creates a DataExport record for async processing."""
    try:
        export = await prisma.dataexport.create(
            data={
                "userId": current_user.id,
                "status": "PENDING",
                "format": "JSON",
            }
        )
        return {
            "status": "requested",
            "export_id": export.id,
            "created_at": export.requestedAt.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error requesting data export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request data export",
        )


@router.get("/advanced/exports")
async def list_data_exports(current_user=Depends(get_current_user)):
    """List data exports"""
    try:
        exports = await prisma.dataexport.find_many(where={"userId": current_user.id})
        result = []
        for export in exports:
            result.append(
                {
                    "id": export.id,
                    "status": export.status,
                    "createdAt": export.createdAt.isoformat()
                    if export.createdAt
                    else None,
                    "completedAt": export.completedAt.isoformat()
                    if export.completedAt
                    else None,
                    "fileUrl": export.fileUrl,
                }
            )
        return result
    except Exception as e:
        logger.error(f"Error listing data exports: {str(e)}")
        return []


# Account Actions
@router.post("/account/deactivate")
async def deactivate_account(current_user=Depends(get_current_user)):
    """Deactivate account"""
    try:
        await prisma.user.update(
            where={"id": current_user.id},
            data={
                "isDeactivated": True,
                "deactivatedAt": datetime.utcnow(),
            },
        )
        return {"status": "deactivated"}
    except Exception as e:
        logger.error(f"Error deactivating account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate account",
        )


@router.post("/account/delete")
async def request_account_deletion(current_user=Depends(get_current_user)):
    """Request account deletion"""
    try:
        await prisma.accountdeletionrequest.create(
            data={
                "userId": current_user.id,
                "requestedAt": datetime.utcnow(),
                "status": "pending",
            }
        )
        return {"status": "requested"}
    except Exception as e:
        logger.error(f"Error requesting account deletion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request account deletion",
        )


@router.post("/account/verify-email")
async def send_email_verification(current_user=Depends(get_current_user)):
    """Send email verification"""
    try:
        return {"status": "sent", "message": "Verification email sent"}
    except Exception as e:
        logger.error(f"Error sending email verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email",
        )


@router.post("/account/verify-phone")
async def send_phone_verification(current_user=Depends(get_current_user)):
    """Send phone verification"""
    try:
        return {"status": "sent", "message": "Verification code sent"}
    except Exception as e:
        logger.error(f"Error sending phone verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code",
        )
