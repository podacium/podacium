"""
Router registration module.
Centralizes all route mounting to keep main.py clean.
"""

from fastapi import FastAPI

from app.routers import (
    admin,
    admin_iam,
    appeals,
    auth,
    users,
    profiles_v2,
    profiles_extras,
    organizations,
    startups,
    payment,
    files,
    settings,
    security,
    notifications,
    payouts,
    subscriptions,
    wallet,
    features,
    phone_verification,
    messaging,
    integrations,
    onboarding,
    websocket,
    search,
    tickets,
    crisp_webhook,
    content_moderation,
    data_privacy,
    device_fingerprint,
    mfa,
    newsletter,
    waitlist,
    api_keys,
    webhooks,
    subtitles,
    trending,
    health,
    initial_data,
    tus_router,
    webhooks_video,
    invoices,
    kyc,
    ai_support,
    mail,
    agent_actions,
    scim,
    sharia,
    bounties,
    simulation_ws,
    curriculum,
    diagnostic,
    diligence,
    dealmaking,
    cap_table,
)
from app.routers import billing_routers
from app.routers.shared import router as shared_router
from app.core.config import setting, FinancialMode

# Versioned API prefix
API_V1 = "/api/v1"

# Legacy prefix (backward compatibility — remove after frontend migration to /api/v1)
LEGACY = "/api"

# Base routers with their tags
_ROUTERS = [
    (auth.router, "Authentication"),
    (users.router, "Users"),
    (startups.router, "Startups & Simulation"),
    (cap_table.router, "Cap Table & Law 22-09 SPAS"),
    (curriculum.router, "Financial Literacy & Curriculum"),
    (diagnostic.router, "Startup Label Diagnostic Decree 20-254"),
    (diligence.router, "Community Diligence & FactGuard"),
    (api_keys.router, "Developer API Keys"),
    (webhooks.router, "Developer Webhooks"),
    (content_moderation.router, "Content Moderation"),
    (organizations.router, "Organizations"),
    (scim.router, "Enterprise SCIM 2.0 & SAML SSO"),
    (payment.router, "Payments"),
    (invoices.router, "Invoices"),
    (kyc.router, "KYC"),
    (files.router, "Files"),
    (settings.router, "Settings"),
    (integrations.router, "Integrations"),
    (security.router, "Security"),
    (notifications.router, "Notifications"),
    (subscriptions.router, "Subscriptions"),
    (wallet.router, "Wallet"),
    (features.router, "Features"),
    (phone_verification.router, "Phone Verification"),
    (messaging.router, "Messaging"),
    (onboarding.router, "Onboarding"),
    (admin.router, "Admin"),
    (admin_iam.router, "Admin IAM"),
    (appeals.router, "Appeals"),
    (appeals.admin_router, "Admin Appeals"),
    (data_privacy.router, "Data Privacy & GDPR & Law 18-07 Compliance"),
    (device_fingerprint.router, "Device Fingerprinting"),
    (mfa.router, "Multi-Factor Authentication"),
    (newsletter.router, "Newsletter"),
    (waitlist.router, "Waitlist"),
    (trending.router, "Trending"),
    (health.router, "Health"),
    (profiles_v2.router, "Profiles"),
    (profiles_v2.org_router, "Profiles"),
    (profiles_extras.router, "Profile Extras"),
    (initial_data.router, "Initial Data"),
    (tus_router.router, "TUS Resumable Uploads"),
    (webhooks_video.router, "Video Webhooks"),
    (ai_support.router, "Support AI Assistant"),
    (mail.router, "Corporate Mail Suite"),
    (sharia.router, "Sharia & AI Swarms"),
    (bounties.router, "S4E Bounties & Istihaq Escrow"),
    (dealmaking.router, "Dealmaker Swarm & MAUT Negotiation"),
]

# In LICENSED_PSP mode, mount custodial payout endpoints
if (
    getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
    == FinancialMode.LICENSED_PSP
):
    _ROUTERS.append((payouts.router, "Payouts"))

_BILLING_ROUTERS = [
    billing_routers.webhook_router,
    billing_routers.entitlement_router,
    billing_routers.payment_router,
    billing_routers.subscription_router,
    billing_routers.fintech_router,
]


def register_routes(app: FastAPI) -> None:
    """Register all API routers on the FastAPI app."""

    # Versioned routes (primary)
    for router, tag in _ROUTERS:
        app.include_router(router, prefix=API_V1, tags=[tag])
        # Mount legacy unversioned prefix for backward compatibility
        app.include_router(router, prefix=LEGACY, tags=[tag], include_in_schema=False)

    for router in _BILLING_ROUTERS:
        app.include_router(router, prefix=API_V1)
        app.include_router(router, prefix=LEGACY, include_in_schema=False)

    # WebSocket (not versioned — protocol-level)
    app.include_router(websocket.router)
    app.include_router(simulation_ws.router)

    # Search (has its own prefix /api/v1/search)
    app.include_router(search.router)

    # Support tickets (has its own prefix /api/v1/tickets)
    app.include_router(tickets.router)

    # Crisp live chat webhook (has its own prefix /api/v1/webhooks/crisp)
    app.include_router(crisp_webhook.router)

    # Public shared insights (no auth required — token-based access)
    app.include_router(shared_router, prefix=API_V1, tags=["Shared Insights"])
    app.include_router(shared_router, prefix=LEGACY, include_in_schema=False)

    # Subtitles (public VTT serving — no auth, it's just text)
    app.include_router(subtitles.router, prefix=API_V1)
    app.include_router(subtitles.router, prefix=LEGACY, include_in_schema=False)

    # Agent Actions (Two-Phase HITL Safety Gate controller)
    app.include_router(agent_actions.router)
