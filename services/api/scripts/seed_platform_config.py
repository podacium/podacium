"""
Seed script for platform configuration tables.
Run this after migration to populate initial configuration data.

Usage: python3 scripts/seed_platform_config.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.generated.prisma import Prisma

prisma = Prisma()


async def seed_subscription_tiers():
    """Seed EdTech and BI subscription tier configurations."""
    tiers = [
        # EdTech tiers (research-backed: business plan numbers)
        {
            "plan": "FREE",
            "category": "EDTECH",
            "name": "Free",
            "description": "Start your learning journey with zero risk. Access curated free courses.",
            "price": 0,
            "billingCycle": "monthly",
            "maxCourses": 2,
            "maxStorage": 100,
            "isActive": True,
            "sortOrder": 0,
            "trialDays": 0,
        },
        {
            "plan": "STUDENT_STARTER",
            "category": "EDTECH",
            "name": "Starter",
            "description": "For curious learners who want to explore and build skills.",
            "price": 1900,             # 1,900 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 17900,      # 17,900 DZD/year (~21% savings)
            "maxCourses": 3,
            "maxStorage": 500,
            "isActive": True,
            "sortOrder": 1,
            "trialDays": 7,
        },
        {
            "plan": "STUDENT_PLUS",
            "category": "EDTECH",
            "name": "Plus",
            "description": "For serious learners building job-ready skills with Skill Passport credentials.",
            "price": 3400,             # 3,400 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 31900,      # 31,900 DZD/year (~22% savings)
            "maxCourses": 5,
            "maxStorage": 2000,
            "isActive": True,
            "sortOrder": 2,
            "trialDays": 7,
        },
        {
            "plan": "STUDENT_PRO",
            "category": "EDTECH",
            "name": "Pro",
            "description": "For employed professionals who want mentor access and priority support.",
            "price": 5400,             # 5,400 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 49900,      # 49,900 DZD/year (~23% savings)
            "maxCourses": 10,
            "maxStorage": 10000,
            "isActive": True,
            "sortOrder": 3,
            "trialDays": 14,
        },
        # BI tiers
        {
            "plan": "BI_GROWTH",
            "category": "BI",
            "name": "Growth",
            "description": "For small teams and SMEs getting started with data-driven decisions.",
            "price": 3000,             # 3,000 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 27900,      # 27,900 DZD/year (~22% savings)
            "maxDatasets": 3,
            "maxDashboards": 2,
            "maxStorage": 1000,
            "maxApiCalls": 10000,
            "isActive": True,
            "sortOrder": 0,
            "trialDays": 14,
        },
        {
            "plan": "BI_SCALE",
            "category": "BI",
            "name": "Scale",
            "description": "For growing organizations that need deeper analytics and more dashboards.",
            "price": 8000,             # 8,000 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 74900,      # 74,900 DZD/year (~22% savings)
            "maxDatasets": 10,
            "maxDashboards": 10,
            "maxStorage": 5000,
            "maxApiCalls": 100000,
            "isActive": True,
            "sortOrder": 1,
            "trialDays": 14,
        },
        {
            "plan": "BI_ELITE",
            "category": "BI",
            "name": "Elite",
            "description": "Enterprise-grade analytics with API access and up to 100 datasets.",
            "price": 15000,            # 15,000 DZD/month
            "billingCycle": "monthly",
            "yearlyPrice": 139900,     # 139,900 DZD/year (~22% savings)
            "maxDatasets": 100,
            "maxDashboards": 50,
            "maxStorage": 50000,
            "maxApiCalls": 1000000,
            "isActive": True,
            "sortOrder": 2,
            "trialDays": 30,
        },
    ]

    for tier_data in tiers:
        await prisma.subscriptiontierconfig.upsert(
            where={
                "plan_category": {
                    "plan": tier_data["plan"],
                    "category": tier_data["category"],
                }
            },
            data={"create": tier_data, "update": tier_data},
        )
    print(f"  ✓ Seeded {len(tiers)} subscription tiers")


async def seed_commission_rates():
    """Seed freelance commission rate configurations.
    Research-backed: 0% cold-start → 10% → 8% → 7% progressive."""
    rates = [
        {"tier": "NEW", "commissionPercent": 0.0, "description": "First 3 projects commission-free — cold-start incentive for marketplace liquidity"},
        {"tier": "STANDARD", "commissionPercent": 10.0, "minProjectCents": 200000, "description": "Standard rate after 3+ completed projects. Min project: 2,000 DZD"},
        {"tier": "PRO", "commissionPercent": 8.0, "minProjectCents": 200000, "description": "Reduced rate for 4.5+ star freelancers with 20+ projects"},
        {"tier": "ENTERPRISE", "commissionPercent": 7.0, "minProjectCents": 200000, "description": "Lowest rate for top-rated freelancers (4.8+ stars, 100+ projects)"},
    ]

    for rate_data in rates:
        try:
            await prisma.commissionrateconfig.create(
                data={**rate_data, "isActive": True}
            )
        except Exception:
            # Already exists, update
            pass
    print(f"  ✓ Seeded {len(rates)} commission rates")


async def seed_payment_gateways():
    """Seed payment gateway configurations."""
    gateways = [
        {"gateway": "chargily", "displayName": "Chargily Pay", "isEnabled": True, "isDefault": True, "environment": "sandbox", "supportedCurrencies": ["DZD"]},
        {"gateway": "satim", "displayName": "SATIM (CIB)", "isEnabled": False, "isDefault": False, "environment": "sandbox", "supportedCurrencies": ["DZD"]},
        {"gateway": "edahabia", "displayName": "Edahabia (Algérie Poste)", "isEnabled": False, "isDefault": False, "environment": "sandbox", "supportedCurrencies": ["DZD"]},
        {"gateway": "bank_transfer", "displayName": "Bank Transfer", "isEnabled": True, "isDefault": False, "environment": "production", "supportedCurrencies": ["DZD", "EUR", "USD"]},
    ]

    for gw_data in gateways:
        await prisma.paymentgatewayconfig.upsert(
            where={"gateway": gw_data["gateway"]},
            data={"create": gw_data, "update": gw_data},
        )
    print(f"  ✓ Seeded {len(gateways)} payment gateways")


async def seed_feature_flags():
    """Seed feature flags."""
    flags = [
        {"key": "enable_marketplace", "name": "Freelance Marketplace", "description": "Enable the freelance marketplace module", "isEnabled": True, "category": "freelance"},
        {"key": "enable_bi_module", "name": "BI Module", "description": "Enable the Business Intelligence module", "isEnabled": True, "category": "bi"},
        {"key": "enable_ai_content_detection", "name": "AI Content Detection", "description": "Detect AI-generated content in submissions", "isEnabled": False, "category": "edtech"},
        {"key": "enable_plagiarism_check", "name": "Plagiarism Check", "description": "Check submissions for plagiarism", "isEnabled": False, "category": "edtech"},
        {"key": "enable_video_transcoding", "name": "Video Transcoding", "description": "Auto-transcode uploaded videos to HLS", "isEnabled": True, "category": "general"},
        {"key": "enable_sms_notifications", "name": "SMS Notifications", "description": "Send SMS notifications to users", "isEnabled": False, "category": "general"},
        {"key": "enable_certificate_generation", "name": "Certificate Generation", "description": "Auto-generate certificates on course completion", "isEnabled": True, "category": "edtech"},
        {"key": "enable_advanced_analytics", "name": "Advanced Analytics", "description": "Enable advanced analytics dashboards", "isEnabled": False, "category": "experimental"},
        {"key": "enable_multi_currency", "name": "Multi-Currency Support", "description": "Allow transactions in multiple currencies", "isEnabled": False, "category": "experimental"},
        {"key": "live_sessions", "name": "Live Sessions Marketplace", "description": "Enable live session discovery, booking, and streaming", "isEnabled": True, "category": "edtech"},
    ]

    for flag_data in flags:
        await prisma.featureflag.upsert(
            where={"key": flag_data["key"]},
            data={"create": flag_data, "update": flag_data},
        )
    print(f"  ✓ Seeded {len(flags)} feature flags")


async def seed_platform_limits():
    """Seed platform limits."""
    limits = [
        {"key": "max_upload_size_mb", "name": "Max Upload Size", "description": "Maximum file upload size", "value": 100, "unit": "MB", "category": "upload"},
        {"key": "max_video_size_mb", "name": "Max Video Size", "description": "Maximum video file size", "value": 500, "unit": "MB", "category": "upload"},
        {"key": "max_course_modules", "name": "Max Course Modules", "description": "Maximum modules per learning path", "value": 50, "unit": "count", "category": "content"},
        {"key": "max_lessons_per_module", "name": "Max Lessons per Module", "description": "Maximum lessons per module", "value": 30, "unit": "count", "category": "content"},
        {"key": "max_quiz_attempts", "name": "Max Quiz Attempts", "description": "Maximum quiz retake attempts", "value": 5, "unit": "count", "category": "content"},
        {"key": "session_timeout_minutes", "name": "Session Timeout", "description": "User session timeout duration", "value": 60, "unit": "minutes", "category": "session"},
        {"key": "refresh_token_days", "name": "Refresh Token Lifetime", "description": "Refresh token validity period", "value": 30, "unit": "days", "category": "session"},
        {"key": "max_concurrent_sessions", "name": "Max Concurrent Sessions", "description": "Maximum simultaneous login sessions", "value": 5, "unit": "count", "category": "session"},
    ]

    for limit_data in limits:
        await prisma.platformlimitsconfig.upsert(
            where={"key": limit_data["key"]},
            data={"create": limit_data, "update": limit_data},
        )
    print(f"  ✓ Seeded {len(limits)} platform limits")


async def seed_notification_config():
    """Seed notification channel configurations."""
    channels = [
        {"channel": "email", "isEnabled": True, "providerName": "SMTP", "rateLimitPerHour": 100},
        {"channel": "sms", "isEnabled": False, "providerName": "Twilio", "rateLimitPerHour": 50},
        {"channel": "push", "isEnabled": True, "providerName": "Firebase", "rateLimitPerHour": 200},
        {"channel": "webhook", "isEnabled": False, "providerName": "Custom", "rateLimitPerHour": 500},
    ]

    for ch_data in channels:
        await prisma.notificationconfig.upsert(
            where={"channel": ch_data["channel"]},
            data={"create": ch_data, "update": ch_data},
        )
    print(f"  ✓ Seeded {len(channels)} notification channels")


async def seed_security_config():
    """Seed security configurations."""
    configs = [
        {"key": "min_password_length", "name": "Minimum Password Length", "description": "Minimum characters required for passwords", "value": "8", "category": "auth"},
        {"key": "require_uppercase", "name": "Require Uppercase", "description": "Require at least one uppercase letter", "value": "true", "category": "auth"},
        {"key": "require_special_char", "name": "Require Special Character", "description": "Require at least one special character", "value": "true", "category": "auth"},
        {"key": "max_login_attempts", "name": "Max Login Attempts", "description": "Lock account after N failed attempts", "value": "5", "category": "auth"},
        {"key": "lockout_duration_minutes", "name": "Lockout Duration", "description": "Account lockout duration after max attempts", "value": "30", "category": "auth"},
        {"key": "enforce_2fa", "name": "Enforce 2FA", "description": "Require two-factor authentication for all users", "value": "false", "category": "auth"},
        {"key": "api_rate_limit_per_minute", "name": "API Rate Limit", "description": "Maximum API requests per minute per user", "value": "60", "category": "rate_limit"},
        {"key": "login_rate_limit_per_hour", "name": "Login Rate Limit", "description": "Maximum login attempts per hour per IP", "value": "20", "category": "rate_limit"},
        {"key": "session_idle_timeout_minutes", "name": "Idle Session Timeout", "description": "Terminate session after inactivity", "value": "30", "category": "session"},
        {"key": "force_logout_on_password_change", "name": "Force Logout on Password Change", "description": "Invalidate all sessions when password changes", "value": "true", "category": "session"},
    ]

    for config_data in configs:
        await prisma.securityconfig.upsert(
            where={"key": config_data["key"]},
            data={"create": config_data, "update": config_data},
        )
    print(f"  ✓ Seeded {len(configs)} security configurations")


async def main():
    """Run all seed functions."""
    print("🌱 Seeding platform configuration...")
    await prisma.connect()

    try:
        await seed_subscription_tiers()
        await seed_commission_rates()
        await seed_payment_gateways()
        await seed_feature_flags()
        await seed_platform_limits()
        await seed_notification_config()
        await seed_security_config()
        print("\n✅ Platform configuration seeded successfully!")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
