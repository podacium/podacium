"""
AI Support Chat Router.

Provides an intelligent, grounded conversational assistant endpoint for Podacium visitors
and registered members. Integrates seamlessly with HelpLauncher.tsx.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.core.auth import get_current_user, security_optional
from app.services.ai_support_service import (
    ask_podacium_ai,
    stream_podacium_ai,
    generate_escalation_dossier,
)

router = APIRouter(prefix="/support", tags=["Support AI Assistant"])


async def get_chat_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[Any]:
    """Extract authenticated user if present and valid; otherwise gracefully return None."""
    if not credentials and not (
        request
        and (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
        )
    ):
        return None
    try:
        return await get_current_user(request, credentials=credentials)
    except Exception:
        return None


class MessageTurn(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'/'model'")
    content: str = Field(..., min_length=1, max_length=4000)


class SupportChatRequest(BaseModel):
    message: str = Field(
        ..., min_length=1, max_length=2000, description="User question or query"
    )
    locale: str = Field(
        default="fr",
        max_length=10,
        description="Active UI locale ('fr', 'ar', 'en', 'kab')",
    )
    history: Optional[List[MessageTurn]] = Field(
        default=[], description="Previous conversation turns"
    )
    session_id: Optional[str] = Field(
        default=None, description="Optional persistent AiSession ID"
    )


class SupportChatResponse(BaseModel):
    reply: str
    category: str
    suggested_ticket: bool
    engine: str
    session_id: Optional[str] = None


@router.post(
    "/chat",
    response_model=SupportChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with Podacium AI Assistant",
)
async def chat_with_assistant(
    req: SupportChatRequest,
    current_user: Optional[Any] = Depends(get_chat_user_optional),
) -> SupportChatResponse:
    """
    Generate an intelligent response grounded in Podacium's course library,
    EDAHABIA/CIB payments, and freelance escrow policies.
    """
    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    formatted_history = [
        {"role": turn.role, "content": turn.content} for turn in (req.history or [])
    ]

    result = await ask_podacium_ai(
        message=clean_msg,
        locale=req.locale,
        history=formatted_history,
        current_user=current_user,
        session_id=req.session_id,
    )

    return SupportChatResponse(
        reply=result["reply"],
        category=result["category"],
        suggested_ticket=result["suggested_ticket"],
        engine=result["engine"],
        session_id=result.get("session_id"),
    )


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="Stream response from Podacium AI Assistant (SSE)",
)
async def stream_chat_with_assistant(
    req: SupportChatRequest,
    current_user: Optional[Any] = Depends(get_chat_user_optional),
) -> StreamingResponse:
    """
    Stream token-by-token response using Server-Sent Events (SSE).
    """
    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    formatted_history = [
        {"role": turn.role, "content": turn.content} for turn in (req.history or [])
    ]

    return StreamingResponse(
        stream_podacium_ai(
            message=clean_msg,
            locale=req.locale,
            history=formatted_history,
            current_user=current_user,
            session_id=req.session_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class HandoffDossierRequest(BaseModel):
    messages: List[MessageTurn] = Field(
        ..., min_length=1, description="Full conversation transcript"
    )
    locale: str = Field(default="fr", max_length=10)
    client_context: Optional[Dict[str, Any]] = Field(
        default={}, description="Browser context, route, user agent"
    )


class HandoffDossierResponse(BaseModel):
    user_intent: str
    detected_sentiment: str
    summary: str
    category: str
    recommended_action: str
    formatted_markdown: str


@router.post(
    "/dossier",
    response_model=HandoffDossierResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate structured escalation dossier for human ticketing",
)
async def create_escalation_dossier(
    req: HandoffDossierRequest,
) -> HandoffDossierResponse:
    """
    Generate an Executive Handoff Dossier summarizing the issue and recommended staff actions.
    """
    formatted_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    dossier = generate_escalation_dossier(formatted_messages, req.client_context)
    return HandoffDossierResponse(**dossier)
