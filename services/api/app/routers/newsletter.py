"""
Newsletter Router — handles subscription and confirmation emails.

POST /api/v1/newsletter/subscribe
  Accepts email + locale, stores preference, sends confirmation email.
  No authentication required (public signup from footer).
"""

import logging
from pydantic import BaseModel, EmailStr, field_validator
from fastapi import APIRouter

from app.core.prisma import prisma
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/newsletter", tags=["Newsletter"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    email: EmailStr
    locale: str = "en"
    name: str = ""

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: str) -> str:
        if v not in ("en", "fr", "ar"):
            return "en"
        return v


class SubscribeResponse(BaseModel):
    ok: bool = True
    message: str = "Subscribed successfully"


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe_to_newsletter(body: SubscribeRequest):
    """Subscribe an email to the Podacium newsletter.

    - Creates or updates a user's newsletter preference
    - Sends a localized confirmation email
    """
    email = body.email.strip().lower()

    # Try to find existing user
    user = await prisma.user.find_first(where={"email": email})

    if user:
        await prisma.user.update(
            where={"id": user.id},
            data={"subscribeNewsletter": True},
        )
        name = body.name or user.fullName or user.email.split("@")[0]
    else:
        name = body.name or email.split("@")[0]

    # Send confirmation email (fire-and-forget style)
    try:
        sent = await email_service.send_newsletter_subscription_email(
            email=email,
            name=name,
            locale=body.locale,
        )
        if not sent:
            logger.warning(f"Newsletter confirmation email not sent to {email} (SMTP may be unconfigured)")
    except Exception as e:
        logger.error(f"Failed to send newsletter confirmation to {email}: {e}")

    return SubscribeResponse(ok=True, message="Subscribed successfully")
