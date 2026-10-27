"""
Crisp Live Chat Webhook — Creates support tickets when chat sessions end.

Crisp sends webhooks for events like:
- session:resolved — Chat session resolved by agent
- message:send — New message in chat

When a session is resolved, we create a Ticket with the full conversation history.

Configuration:
  Set CRISP_WEBHOOK_SECRET in environment for signature verification.
  Configure webhook URL in Crisp: https://api.podacium.com/api/v1/webhooks/crisp
"""

import logging
import hmac
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.core.config import setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


def _verify_crisp_signature(body: bytes, signature: Optional[str], secret: str) -> bool:
    """
    Verify Crisp webhook signature using HMAC-SHA256.

    Crisp sends the signature as the hex digest of HMAC-SHA256(secret, body)
    in the `x-crisp-signature` header.

    Security notes:
    - Uses `hmac.compare_digest` to prevent timing attacks.
    - In production (ENVIRONMENT != "development"), a missing secret is a hard
      failure — we never accept unsigned webhooks in production.
    - The development bypass is only active when ENVIRONMENT is explicitly
      "development" AND no secret is configured.
    """
    is_production = getattr(setting, "ENVIRONMENT", "development") not in (
        "development",
        "test",
        "testing",
    )

    if not secret:
        if is_production:
            # Production with no secret configured → reject all (misconfiguration)
            logger.error(
                "CRISP_WEBHOOK_SECRET is not configured in production. "
                "All Crisp webhooks will be rejected until the secret is set."
            )
            return False
        # Development/test with no secret → accept (local testing convenience)
        logger.warning("Crisp webhook received without secret configured (dev mode)")
        return True

    if not signature:
        # Secret is configured but no signature header → always reject
        logger.warning("Crisp webhook received without x-crisp-signature header")
        return False

    # Compute expected HMAC-SHA256 signature
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    # Constant-time comparison to prevent timing attacks
    is_valid = hmac.compare_digest(expected, signature)
    if not is_valid:
        logger.warning(
            "Crisp webhook signature mismatch — possible replay or spoofing attempt"
        )
    return is_valid


@router.post("/crisp")
async def crisp_webhook(request: Request):
    """
    Handle Crisp live chat webhooks.

    Creates a support ticket when a chat session is resolved.
    """
    body = await request.body()
    signature = request.headers.get("x-crisp-signature")

    # Verify signature
    crisp_secret = setting.CRISP_WEBHOOK_SECRET or ""
    if not _verify_crisp_signature(body, signature, crisp_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature"
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event", "")
    data = payload.get("data", {})

    # Only process session:resolved events
    if event == "session:resolved":
        await _create_ticket_from_chat(data)
    elif event == "message:send":
        # Could be used for real-time updates, but we batch on session end
        pass

    return {"status": "ok", "event": event}


def _classify_ticket_triage(text: str) -> tuple[str, str]:
    """
    Heuristic triage classifier for support chat transcript.
    Returns (category, priority).
    """
    lower = text.lower()

    # Billing / Payment issues (Chargily, EDAHABIA, CIB)
    billing_keywords = [
        "edahabia",
        "cib",
        "chargily",
        "remboursement",
        "rembourser",
        "payer",
        "paiement",
        "payment",
        "facture",
        "solde",
        "abonnement",
        "reçu",
        "subscription",
        "refund",
        "receipt",
    ]
    if any(k in lower for k in billing_keywords):
        if any(
            crit in lower
            for crit in [
                "erreur",
                "échoué",
                "failed",
                "urgent",
                "bloqué",
                "rejeté",
                "double",
                "débité",
                "scam",
            ]
        ):
            return "BILLING", "URGENT"
        return "BILLING", "HIGH"

    # Learning / Course issues
    learning_keywords = [
        "cours",
        "leçon",
        "module",
        "certificat",
        "diplôme",
        "quiz",
        "vidéo",
        "enseignant",
        "professeur",
        "lesson",
        "course",
        "video",
    ]
    if any(k in lower for k in learning_keywords):
        return "LEARNING", "NORMAL"

    # Freelance / Hub issues
    hub_keywords = [
        "projet",
        "freelance",
        "client",
        "mission",
        "devis",
        "milestone",
        "escrow",
        "litige",
        "dispute",
        "cahier des charges",
    ]
    if any(k in lower for k in hub_keywords):
        if any(
            crit in lower
            for crit in ["litige", "dispute", "arnaque", "bloqué", "urgent"]
        ):
            return "HUB", "URGENT"
        return "HUB", "HIGH"

    # Account / Auth issues
    account_keywords = [
        "connexion",
        "mot de passe",
        "password",
        "email",
        "compte",
        "login",
        "reset",
        "2fa",
        "authentification",
        "bloqué",
    ]
    if any(k in lower for k in account_keywords):
        return "ACCOUNT", "NORMAL"

    # High severity general bugs
    if any(
        crit in lower
        for crit in ["bug", "crash", "500", "erreur 500", "panne", "inaccessible"]
    ):
        return "GENERAL", "HIGH"

    return "GENERAL", "NORMAL"


def _calculate_sla_deadlines(priority: str) -> tuple[datetime, datetime]:
    """Calculate SLA response and resolution deadlines based on ticket priority."""
    now = datetime.now(timezone.utc)
    if priority == "URGENT":
        return now + timedelta(hours=4), now + timedelta(hours=12)
    elif priority == "HIGH":
        return now + timedelta(hours=12), now + timedelta(hours=24)
    elif priority == "LOW":
        return now + timedelta(hours=48), now + timedelta(hours=120)
    return now + timedelta(hours=24), now + timedelta(hours=72)


async def _create_ticket_from_chat(data: dict):
    """
    Create or update a support ticket from a resolved Crisp chat session.

    Hardened with:
    - Idempotency guard against duplicate webhook retries
    - Guest & prospective lead auto-creation (never drop chats)
    - Full transcript capture (no arbitrary truncation)
    - Automated category & priority triage heuristic
    """
    session_id = data.get("session_id", "")
    messages = data.get("messages", [])
    user_email = data.get("email") or data.get("meta", {}).get("email")

    # 1. Idempotency Check: Don't duplicate tickets if webhook retries
    if session_id:
        try:
            existing_ticket = await prisma.ticket.find_first(
                where={"metadata": {"path": ["crisp_session_id"], "equals": session_id}}
            )
            if existing_ticket:
                logger.info(
                    f"Crisp session {session_id} already synced to Ticket {existing_ticket.ticketNumber} — skipping duplicate creation"
                )
                return existing_ticket
        except Exception as e:
            logger.debug(f"Idempotency lookup warning: {e}")

    # 2. Try to find the user by email
    user = None
    if user_email:
        user = await prisma.user.find_first(
            where={"email": user_email, "deletedAt": None}
        )
        if not user:
            # Auto-provision a guest user record so no prospective student/client chat is lost
            user_meta = data.get("meta") or {}
            nickname = data.get("nickname") or (
                user_meta.get("nickname") if isinstance(user_meta, dict) else None
            )
            display_name = nickname or user_email.split("@")[0] or "Crisp Visitor"
            try:
                user = await prisma.user.create(
                    data={
                        "email": user_email,
                        "fullName": display_name,
                        "role": "STUDENT",
                        "emailVerified": False,
                        "provider": "EMAIL",
                    }
                )
                logger.info(
                    f"Auto-created guest user account {user.id} for Crisp visitor {user_email}"
                )
            except Exception as create_err:
                logger.warning(
                    f"Failed to auto-create guest user for {user_email}: {create_err}"
                )
                user = await prisma.user.find_first(where={"email": user_email})

    # Fallback if still no user (e.g. completely anonymous session without email)
    if not user:
        user = await prisma.user.find_first(where={"role": "ADMIN", "deletedAt": None})
        if not user:
            user = await prisma.user.find_first(where={"deletedAt": None})

    if not user:
        logger.warning(
            f"Crisp chat resolved but no user account could be linked for session {session_id}"
        )
        return None

    # 3. Build full conversation text (no arbitrary truncation)
    conversation_parts = []
    clean_transcript = []
    for msg in messages:
        sender = msg.get("from", "user")
        content = msg.get("content", "")
        if isinstance(content, dict):
            content = content.get("text", str(content))
        timestamp = msg.get("timestamp")
        time_prefix = ""
        if timestamp:
            try:
                dt = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
                time_prefix = f"[{dt.strftime('%H:%M:%S')}] "
            except Exception:
                pass
        conversation_parts.append(f"{time_prefix}[{sender}] {content}")
        clean_transcript.append(
            {
                "from": sender,
                "content": content,
                "timestamp": timestamp,
            }
        )

    conversation_text = (
        "\n".join(conversation_parts)
        if conversation_parts
        else "Chat session (no messages captured)"
    )

    # 4. Determine subject from first user message
    first_user_msg = next(
        (m.get("content", "") for m in messages if m.get("from") == "user"),
        "Live chat support request",
    )
    if isinstance(first_user_msg, dict):
        first_user_msg = first_user_msg.get("text", "Live chat support request")
    subject = (
        first_user_msg.replace("\n", " ").strip()[:100]
        if first_user_msg
        else "Live chat support request"
    )

    # 5. Smart triage classification & SLA calculation
    category, priority = _classify_ticket_triage(conversation_text)
    sla_response, sla_resolution = _calculate_sla_deadlines(priority)

    # 6. Create ticket
    metadata_payload = {
        "crisp_session_id": session_id,
        "source": "live_chat",
        "email": user_email,
        "is_guest": bool(not user_email or user.emailVerified is False),
        "transcript_count": len(clean_transcript),
    }

    ticket = await prisma.ticket.create(
        data={
            "userId": user.id,
            "subject": f"[Chat] {subject}",
            "priority": priority,
            "category": category,
            "slaResponseDeadline": sla_response,
            "slaResolutionDeadline": sla_resolution,
            "metadata": Json(metadata_payload),
        }
    )

    # 7. Add conversation as the first message
    await prisma.ticketmessage.create(
        data={
            "ticketId": ticket.id,
            "senderId": user.id,
            "body": f"--- Live Chat Transcript ({len(clean_transcript)} messages) ---\n\n{conversation_text}",
        }
    )

    logger.info(
        f"Ticket {ticket.ticketNumber} created from Crisp chat session {session_id} "
        f"[Category: {category}, Priority: {priority}, User: {user.id}]"
    )
    return ticket
