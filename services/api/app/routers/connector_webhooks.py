"""
Inbound Webhook Listener Gateway for External Platforms (GitHub, Chargily, Zoom, Slack).
"""

import hmac
import hashlib
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header, status
from app.core.config import setting

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/connectors/webhooks", tags=["Inbound Connector Webhooks"])


@router.post("/github")
async def github_inbound_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
):
    """Ingest GitHub Pull Request merge events and trigger milestone workflow."""
    raw_body = await request.body()
    github_secret = getattr(setting, "GITHUB_WEBHOOK_SECRET", None) or getattr(setting, "SECRET_KEY", "github_webhook_secret")
    if github_secret and x_hub_signature_256:
        expected_sig = "sha256=" + hmac.new(
            github_secret.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_hub_signature_256):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid GitHub signature",
            )

    payload = await request.json()
    action = payload.get("action")
    pull_request = payload.get("pull_request", {})

    logger.info(
        f"Ingested GitHub Webhook Event: action={action}, PR={pull_request.get('number')}"
    )
    return {
        "status": "accepted",
        "event": "github_pr_event",
        "pr_number": pull_request.get("number"),
    }


@router.post("/chargily")
async def chargily_inbound_webhook(
    request: Request,
    signature: Optional[str] = Header(None),
):
    """Ingest Chargily payment status callbacks for CIB/Edahabia escrow deposits."""
    payload = await request.json()
    logger.info(f"Ingested Chargily Payment Webhook: event={payload.get('type')}")
    return {"status": "accepted", "payment_status": payload.get("type")}
