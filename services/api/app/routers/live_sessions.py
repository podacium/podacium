"""Live Sessions router — LiveKit-powered streaming sessions."""

import logging
from datetime import datetime, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.auth import (
    get_current_active_user,
    get_current_user_optional,
)
from app.core.rbac import require_permissions
from app.core.config import setting
from app.core.prisma import prisma
from app.generated.prisma import Json
from prisma.errors import UniqueViolationError
from app.schemas.live_sessions import (
    CreateSessionRequest,
    UpdateSessionRequest,
    BookSessionRequest,
    LiveSessionResponse,
    LiveSessionListResponse,
    LiveSessionBookingResponse,
    LiveSessionBookingListResponse,
    BookingResultResponse,
    ParticipantResponse,
    WaitlistResponse,
    CoHostResponse,
    JoinTokenResponse,
    TrendingSessionResponse,
    AdminStatsResponse,
    LiveSessionReviewCreate,
    LiveSessionReviewResponse,
    LiveSessionReviewListResponse,
    ApproveSessionRequest,
    RejectSessionRequest,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatMessageListResponse,
)
from app.services.live_session_service import (
    check_feature_enabled,
    create_session,
    get_session,
    update_session,
    delete_session,
    list_my_sessions,
    list_public_sessions,
    get_trending_sessions,
    get_upcoming_sessions,
    start_session,
    end_session,
    book_session,
    cancel_booking,
    list_my_bookings,
    list_session_bookings,
    join_session,
    leave_session,
    kick_participant,
    list_participants,
    join_waitlist,
    leave_waitlist,
    get_waitlist_status,
    add_co_host,
    remove_co_host,
    get_join_token,
    refresh_join_token,
    get_replay_token,
    get_replay_access,
    get_recording_download,
    store_replay_recording,
    generate_host_codes,
    validate_host_code,
    transfer_booking,
    accept_transfer,
    HOST_MONTHLY_FREE_CODES,
    create_review,
    get_session_reviews,
    get_user_review,
    approve_session,
    reject_session,
    get_pending_approval_count,
    save_chat_message,
    get_chat_messages,
    get_live_ecosystem_context,
    admin_list_sessions,
    admin_get_stats,
    start_recording,
    stop_recording,
)
from app.services.livekit_service import verify_webhook
from app.middleware.rate_limit import check_entity_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/live-sessions", tags=["Live Sessions"])

_CHAT_MESSAGE_TYPES = frozenset({"chat", "system", "announcement", "question"})

# Per-entity rate limits (B5):
# - joining a room is 10 requests/min per session (a busy participant spamming
#   re-join during a reconnect storm could otherwise hammer the token service)
# - booking is 5 requests/min per user (prevents scripted seat-grabbing)
_JOIN_RATE_LIMIT = 10
_BOOK_RATE_LIMIT = 5


async def _join_rate_limit_dep(
    request: Request, current_user: dict = Depends(get_current_active_user)
):
    user_id = getattr(current_user, "id", None) or (
        current_user.get("id") if isinstance(current_user, dict) else "unknown"
    )
    session_id = request.path_params.get("session_id", "unknown")
    await check_entity_rate_limit(
        request,
        f"rl:live_join:{user_id}:{session_id}",
        _JOIN_RATE_LIMIT,
    )


async def _book_rate_limit_dep(
    request: Request, current_user: dict = Depends(get_current_active_user)
):
    await check_entity_rate_limit(
        request,
        f"rl:live_book:{current_user.id}",
        _BOOK_RATE_LIMIT,
    )


async def _require_feature():
    if not await check_feature_enabled():
        raise HTTPException(
            status_code=404,
            detail={"message": "Feature not available", "code": "FEATURE_DISABLED"},
        )


# ─── Public / Discovery ──────────────────────────────────────────────


@router.get("/sessions", response_model=LiveSessionListResponse)
async def list_sessions(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    tags: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
):
    await _require_feature()
    tag_list = tags.split(",") if tags else None
    items, total = await list_public_sessions(
        category=category,
        status=status,
        search=search,
        tags=tag_list,
        min_price=min_price,
        max_price=max_price,
        skip=skip,
        limit=limit,
    )
    return LiveSessionListResponse(
        items=[LiveSessionResponse(**i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/sessions/{session_id}", response_model=LiveSessionResponse)
async def get_session_endpoint(
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    await _require_feature()
    user_id = current_user.id if current_user else None
    session = await get_session(session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    return LiveSessionResponse(**session)


@router.get("/trending", response_model=TrendingSessionResponse)
async def trending_sessions():
    await _require_feature()
    items = await get_trending_sessions()
    return TrendingSessionResponse(items=[LiveSessionResponse(**i) for i in items])


@router.get("/upcoming", response_model=LiveSessionListResponse)
async def upcoming_sessions(limit: int = 20):
    await _require_feature()
    items = await get_upcoming_sessions(limit=limit)
    return LiveSessionListResponse(
        items=[LiveSessionResponse(**i) for i in items],
        total=len(items),
        skip=0,
        limit=limit,
    )


# ─── Host Operations ─────────────────────────────────────────────────


@router.post(
    "/sessions", response_model=LiveSessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session_endpoint(
    body: CreateSessionRequest, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()

    # ── Role-based branching with descriptive error codes ──
    role = current_user.role
    session_type = body.sessionType.value if body.sessionType else "COURSE"

    if role == "STUDENT":
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Students cannot create live sessions. Upgrade to FREELANCER, BUSINESS, or INSTRUCTOR.",
                "code": "STUDENT_ONLY",
                "upgradePath": "/profile",
            },
        )
    if role == "FREELANCER":
        if session_type != "MEETING":
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Freelancers can only create MEETING-type sessions. Use sessionType=MEETING with a valid contractId.",
                    "code": "FREELANCER_ONLY",
                },
            )
    elif role == "BUSINESS":
        if session_type != "MEETING":
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Business accounts can only create MEETING-type sessions. Use sessionType=MEETING with orgOnly=true.",
                    "code": "BUSINESS_ONLY",
                },
            )

    result = await create_session(
        owner_id=current_user.id,
        title=body.title,
        scheduled_at=body.scheduledAt,
        session_type=session_type,
        contract_id=body.contractId,
        org_only=body.orgOnly,
        description=body.description,
        thumbnail_url=body.thumbnailUrl,
        category=body.category,
        tags=body.tags,
        visibility=body.visibility,
        max_participants=body.maxParticipants,
        price_amount=body.priceAmount,
        currency=body.currency,
        module_id=body.moduleId,
        lesson_id=body.lessonId,
        early_bird_price=body.earlyBirdPrice,
        early_bird_deadline=body.earlyBirdDeadline,
        chat_mode=body.chatMode,
        moderation_threshold=body.moderationThreshold,
        organization_id=body.organizationId,
    )
    return LiveSessionResponse(**result)


@router.put("/sessions/{session_id}", response_model=LiveSessionResponse)
async def update_session_endpoint(
    session_id: str,
    body: UpdateSessionRequest,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    result = await update_session(
        session_id=session_id,
        owner_id=current_user.id,
        title=body.title,
        description=body.description,
        thumbnail_url=body.thumbnailUrl,
        category=body.category,
        tags=body.tags,
        visibility=body.visibility,
        max_participants=body.maxParticipants,
        price_amount=body.priceAmount,
        currency=body.currency,
        early_bird_price=body.earlyBirdPrice,
        early_bird_deadline=body.earlyBirdDeadline,
        chat_mode=body.chatMode,
        moderation_threshold=body.moderationThreshold,
        organization_id=body.organizationId,
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    return LiveSessionResponse(**result)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    ok = await delete_session(session_id=session_id, owner_id=current_user.id)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )


@router.get("/my-sessions", response_model=LiveSessionListResponse)
async def my_sessions(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    items, total = await list_my_sessions(
        owner_id=current_user.id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return LiveSessionListResponse(
        items=[LiveSessionResponse(**i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/sessions/{session_id}/start", response_model=LiveSessionResponse)
async def start_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await start_session(session_id=session_id, owner_id=current_user.id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    return LiveSessionResponse(**result)


@router.post("/sessions/{session_id}/end", response_model=LiveSessionResponse)
async def end_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await end_session(session_id=session_id, owner_id=current_user.id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    return LiveSessionResponse(**result)


# ─── Host Codes ──────────────────────────────────────────────────────


@router.post("/sessions/{session_id}/host-codes")
async def generate_host_codes_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    session = await prisma.livesession.find_unique(where={"id": session_id})
    if not session or session.deletedAt:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    if session.ownerId != current_user.id:
        raise HTTPException(
            status_code=403, detail={"message": "Not your session", "code": "FORBIDDEN"}
        )
    codes = await generate_host_codes(creator_id=current_user.id)
    return {"codes": codes, "remaining": max(0, HOST_MONTHLY_FREE_CODES - len(codes))}


@router.post("/sessions/{session_id}/validate-host-code")
async def validate_host_code_endpoint(session_id: str, body: dict):
    code = body.get("code", "")
    session = await prisma.livesession.find_unique(where={"id": session_id})
    if not session or session.deletedAt:
        return {"valid": False}
    valid = await validate_host_code(code, session.ownerId)
    return {"valid": valid}


# ─── Booking ─────────────────────────────────────────────────────────


@router.post(
    "/sessions/{session_id}/book",
    response_model=BookingResultResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_book_rate_limit_dep)],
)
async def book_session_endpoint(
    session_id: str,
    body: BookSessionRequest,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    try:
        result = await book_session(
            session_id=session_id,
            user_id=current_user.id,
            transaction_id=body.transactionId,
            host_code=body.hostCode,
        )
    except UniqueViolationError:
        # Two concurrent bookings hit the same unique constraint — the user is
        # either already booked or the session filled up in the meantime.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Session is full or you are already booked",
                "code": "BOOKING_CONFLICT",
            },
        )
    return BookingResultResponse(**result)


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking_endpoint(
    booking_id: int, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await cancel_booking(booking_id=booking_id, user_id=current_user.id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"message": "Booking not found", "code": "NOT_FOUND"},
        )
    return result


@router.post("/bookings/{booking_id}/transfer")
async def transfer_booking_endpoint(
    booking_id: int, body: dict, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    recipient_email = body.get("recipient_email", "")
    if not recipient_email:
        raise HTTPException(
            status_code=422,
            detail={"message": "recipient_email required", "code": "MISSING_FIELD"},
        )
    result = await transfer_booking(
        booking_id=booking_id,
        from_user_id=current_user.id,
        recipient_email=recipient_email,
    )
    return result


@router.post("/bookings/transfer/accept")
async def accept_transfer_endpoint(
    body: dict, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    transfer_token = body.get("token", "")
    if not transfer_token:
        raise HTTPException(
            status_code=422,
            detail={"message": "token required", "code": "MISSING_FIELD"},
        )
    result = await accept_transfer(token=transfer_token, user_id=current_user.id)
    return result


@router.get("/bookings", response_model=LiveSessionBookingListResponse)
async def my_bookings(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    items, total = await list_my_bookings(
        user_id=current_user.id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return LiveSessionBookingListResponse(
        items=[LiveSessionBookingResponse(**i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/sessions/{session_id}/bookings", response_model=LiveSessionBookingListResponse
)
async def session_bookings(
    session_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    is_admin = getattr(current_user, "role", "") == "ADMIN"
    items, total = await list_session_bookings(
        session_id=session_id,
        owner_id=current_user.id,
        status=status,
        skip=skip,
        limit=limit,
        is_admin=is_admin,
    )
    return LiveSessionBookingListResponse(
        items=[LiveSessionBookingResponse(**i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


# ─── Live Session Participation ──────────────────────────────────────


@router.post(
    "/sessions/{session_id}/join",
    response_model=JoinTokenResponse,
    dependencies=[Depends(_join_rate_limit_dep)],
)
async def join_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    user_role = getattr(current_user, "role", None)
    token = await join_session(
        session_id=session_id, user_id=current_user.id, user_role=user_role
    )
    if not token:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )

    session = await get_session(session_id)
    return JoinTokenResponse(
        token=token,
        roomName=session["roomName"] or "",
        serverUrl=setting.LIVEKIT_URL or "",
    )


@router.post("/sessions/{session_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    await leave_session(session_id=session_id, user_id=current_user.id)


@router.post(
    "/sessions/{session_id}/participants/{user_id}/kick",
    status_code=status.HTTP_200_OK,
)
async def kick_participant_endpoint(
    session_id: str,
    user_id: int,
    is_banned: bool = True,
    current_user: dict = Depends(get_current_active_user),
):
    """Host moderation: kick/ban participant from active room and prevent reconnection."""
    await _require_feature()
    await kick_participant(
        session_id=session_id,
        host_user_id=current_user.id,
        target_user_id=user_id,
        is_banned=is_banned,
    )
    return {"status": "kicked", "userId": user_id, "isBanned": is_banned}


@router.get(
    "/sessions/{session_id}/participants", response_model=list[ParticipantResponse]
)
async def list_participants_endpoint(session_id: str):
    await _require_feature()
    participants = await list_participants(session_id=session_id)
    return [ParticipantResponse(**p) for p in participants]


@router.get("/sessions/{session_id}/context/{user_id}")
async def get_session_ecosystem_context_endpoint(
    session_id: str,
    user_id: int,
    locale: str = "en",
    current_user: dict = Depends(get_current_active_user),
):
    """Ecosystem panel: Business Health Score + Skill Passport for a participant."""
    await _require_feature()
    return await get_live_ecosystem_context(
        session_id=session_id,
        requester_id=current_user.id,
        target_user_id=user_id,
        locale=locale,
    )


@router.get("/sessions/{session_id}/token", response_model=JoinTokenResponse)
async def get_token_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    user_role = getattr(current_user, "role", None)
    token = await get_join_token(
        session_id=session_id, user_id=current_user.id, user_role=user_role
    )
    if not token:
        raise HTTPException(
            status_code=403, detail={"message": "Not authorized", "code": "FORBIDDEN"}
        )

    session = await get_session(session_id)
    return JoinTokenResponse(
        token=token,
        roomName=session["roomName"] or "",
        serverUrl=setting.LIVEKIT_URL or "",
    )


# ─── Waitlist ────────────────────────────────────────────────────────


@router.post(
    "/sessions/{session_id}/waitlist",
    response_model=WaitlistResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_waitlist_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await join_waitlist(session_id=session_id, user_id=current_user.id)
    return WaitlistResponse(**result)


@router.get(
    "/sessions/{session_id}/waitlist", response_model=Optional[WaitlistResponse]
)
async def get_waitlist_status_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await get_waitlist_status(session_id=session_id, user_id=current_user.id)
    if not result:
        return None
    return WaitlistResponse(**result)


@router.delete(
    "/sessions/{session_id}/waitlist", status_code=status.HTTP_204_NO_CONTENT
)
async def leave_waitlist_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    await leave_waitlist(session_id=session_id, user_id=current_user.id)


# ─── Co-Hosts ────────────────────────────────────────────────────────


@router.post(
    "/sessions/{session_id}/co-hosts",
    response_model=CoHostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_co_host_endpoint(
    session_id: str, user_id: int, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await add_co_host(
        session_id=session_id, owner_id=current_user.id, user_id=user_id
    )
    return CoHostResponse(**result)


@router.delete(
    "/sessions/{session_id}/co-hosts/{co_host_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_co_host_endpoint(
    session_id: str,
    co_host_user_id: int,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    ok = await remove_co_host(
        session_id=session_id, owner_id=current_user.id, co_host_user_id=co_host_user_id
    )
    if not ok:
        raise HTTPException(
            status_code=404,
            detail={"message": "Co-host not found", "code": "NOT_FOUND"},
        )


# ─── Recording ───────────────────────────────────────────────────────


@router.post("/sessions/{session_id}/recording/start")
async def start_recording_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await start_recording(session_id=session_id, user_id=current_user.id)
    return result


@router.post("/sessions/{session_id}/recording/stop")
async def stop_recording_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    result = await stop_recording(session_id=session_id, user_id=current_user.id)
    return result


@router.post("/sessions/{session_id}/token/refresh", response_model=JoinTokenResponse)
async def refresh_token_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    user_role = getattr(current_user, "role", None)
    token = await refresh_join_token(
        session_id=session_id, user_id=current_user.id, user_role=user_role
    )
    if not token:
        raise HTTPException(
            status_code=403, detail={"message": "Not authorized", "code": "FORBIDDEN"}
        )

    session = await get_session(session_id)
    return JoinTokenResponse(
        token=token,
        roomName=session["roomName"] or "",
        serverUrl=setting.LIVEKIT_URL or "",
    )


@router.get("/sessions/{session_id}/recording/download")
async def download_recording_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    url = await get_recording_download(session_id=session_id, user_id=current_user.id)
    if not url:
        raise HTTPException(
            status_code=404,
            detail={"message": "No recording available", "code": "NOT_FOUND"},
        )
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url=url)


# ─── Replay ──────────────────────────────────────────────────────────


@router.get("/sessions/{session_id}/replay-token")
async def get_replay_token_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    url = await get_replay_access(session_id=session_id, user_id=current_user.id)
    if not url:
        raise HTTPException(
            status_code=403,
            detail={"message": "Replay not available", "code": "REPLAY_UNAVAILABLE"},
        )
    return {"url": url}


@router.get("/sessions/{session_id}/replay", response_model=JoinTokenResponse)
async def get_replay_endpoint(
    session_id: str, current_user: dict = Depends(get_current_active_user)
):
    await _require_feature()
    token = await get_replay_token(session_id=session_id, user_id=current_user.id)
    if not token:
        raise HTTPException(
            status_code=403,
            detail={"message": "Replay not available", "code": "REPLAY_UNAVAILABLE"},
        )

    session = await get_session(session_id)
    return JoinTokenResponse(
        token=token,
        roomName=session["roomName"] or "",
        serverUrl=setting.LIVEKIT_URL or "",
    )


# ─── Webhook ─────────────────────────────────────────────────────────
# Separate prefix-less router for the webhook endpoint
# (included directly at /api/v1/webhooks/livekit in routes.py)

webhook_router = APIRouter(prefix="/api/v1/webhooks", tags=["Live Sessions Webhooks"])


@webhook_router.post("/livekit")
async def livekit_webhook(request: Request):
    auth_header = request.headers.get("Authorization", "")
    body = await request.body()

    event = verify_webhook(auth_header, body)
    if not event:
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Invalid webhook signature",
                "code": "INVALID_SIGNATURE",
            },
        )

    logger.info(
        f"LiveKit webhook received: event={event.event} room={event.room and event.room.name}"
    )

    if event.event == "room_finished" and event.room:
        session = await prisma.livesession.find_first(
            where={"roomName": event.room.name}
        )
        if session and session.deletedAt is None and session.status != "ENDED":
            ended_at = datetime.now(timezone.utc)
            if session.startedAt:
                duration = max(
                    0, ceil((ended_at - session.startedAt).total_seconds() / 60)
                )
            else:
                duration = 0
            metadata = dict(session.roomMetadata) if session.roomMetadata else {}
            # Mark paid sessions as payout-ready: the room_finished webhook is
            # the only guaranteed end-of-life signal (a host may close the tab
            # without ever hitting /end), so hosts must still get paid.
            if session.priceAmount and session.priceAmount > 0:
                metadata["payoutReady"] = True
            await prisma.livesession.update(
                where={"id": session.id},
                data={
                    "status": "ENDED",
                    "endedAt": ended_at,
                    "durationMinutes": duration,
                    "roomMetadata": Json(metadata),
                },
            )

            # Reconcile participants still active when room was closed to record full attendance
            active_participants = await prisma.livesessionparticipant.find_many(
                where={"liveSessionId": session.id, "leftAt": None}
            )
            for p in active_participants:
                p_meta = dict(p.metadata) if p.metadata else {}
                current_joined_iso = p_meta.get("currentJoinedAt")
                if current_joined_iso:
                    try:
                        cj = datetime.fromisoformat(current_joined_iso)
                        if cj.tzinfo is None:
                            cj = cj.replace(tzinfo=timezone.utc)
                        interval = max(0.0, (ended_at - cj).total_seconds())
                    except Exception:
                        interval = 0.0
                elif p.joinedAt:
                    ja = p.joinedAt
                    if ja.tzinfo is None:
                        ja = ja.replace(tzinfo=timezone.utc)
                    interval = max(0.0, (ended_at - ja).total_seconds())
                else:
                    interval = 0.0

                prev_total = float(p_meta.get("totalDurationSeconds") or 0.0)
                tot_seconds = prev_total + interval
                p_meta["totalDurationSeconds"] = tot_seconds
                p_meta.pop("currentJoinedAt", None)
                expected_secs = (session.durationMinutes or duration or 60) * 60
                att_pct = min(100.0, (tot_seconds / max(1, expected_secs)) * 100)
                await prisma.livesessionparticipant.update(
                    where={"id": p.id},
                    data={
                        "leftAt": ended_at,
                        "attendancePct": att_pct,
                        "metadata": Json(p_meta),
                    },
                )

    elif event.event == "participant_joined" and event.room and event.participant:
        session = await prisma.livesession.find_first(
            where={"roomName": event.room.name}
        )
        if session:
            user_id_str = event.participant.identity.replace("user_", "")
            if user_id_str.isdigit():
                uid = int(user_id_str)
                now = datetime.now(timezone.utc)
                existing_p = await prisma.livesessionparticipant.find_unique(
                    where={
                        "liveSessionId_userId": {
                            "liveSessionId": session.id,
                            "userId": uid,
                        }
                    }
                )
                if existing_p:
                    metadata = dict(existing_p.metadata) if existing_p.metadata else {}
                    metadata["currentJoinedAt"] = now.isoformat()
                    await prisma.livesessionparticipant.update(
                        where={"id": existing_p.id},
                        data={
                            "joinedAt": existing_p.joinedAt or now,
                            "leftAt": None,
                            "metadata": Json(metadata),
                        },
                    )
                else:
                    await prisma.livesessionparticipant.create(
                        data={
                            "liveSessionId": session.id,
                            "userId": uid,
                            "role": "PARTICIPANT",
                            "joinedAt": now,
                            "metadata": Json(
                                {
                                    "currentJoinedAt": now.isoformat(),
                                    "totalDurationSeconds": 0,
                                }
                            ),
                        }
                    )

    elif event.event == "participant_left" and event.room and event.participant:
        session = await prisma.livesession.find_first(
            where={"roomName": event.room.name}
        )
        if session:
            user_id_str = event.participant.identity.replace("user_", "")
            if user_id_str.isdigit():
                participant = await prisma.livesessionparticipant.find_unique(
                    where={
                        "liveSessionId_userId": {
                            "liveSessionId": session.id,
                            "userId": int(user_id_str),
                        }
                    }
                )
                if participant:
                    now = datetime.now(timezone.utc)
                    metadata = (
                        dict(participant.metadata) if participant.metadata else {}
                    )
                    current_joined_iso = metadata.get("currentJoinedAt")
                    if current_joined_iso:
                        try:
                            current_joined = datetime.fromisoformat(current_joined_iso)
                            if current_joined.tzinfo is None:
                                current_joined = current_joined.replace(
                                    tzinfo=timezone.utc
                                )
                            interval = max(0.0, (now - current_joined).total_seconds())
                        except Exception:
                            interval = 0.0
                    elif participant.joinedAt:
                        joined_at = participant.joinedAt
                        if joined_at.tzinfo is None:
                            joined_at = joined_at.replace(tzinfo=timezone.utc)
                        interval = max(0.0, (now - joined_at).total_seconds())
                    else:
                        interval = 0.0

                    prev_total = float(metadata.get("totalDurationSeconds") or 0.0)
                    total_seconds = prev_total + interval
                    metadata["totalDurationSeconds"] = total_seconds
                    metadata.pop("currentJoinedAt", None)

                    expected_seconds = (session.durationMinutes or 60) * 60
                    attendance_pct = min(
                        100.0, (total_seconds / expected_seconds) * 100
                    )
                    await prisma.livesessionparticipant.update(
                        where={"id": participant.id},
                        data={
                            "leftAt": now,
                            "attendancePct": attendance_pct,
                            "metadata": Json(metadata),
                        },
                    )

    elif event.event in ("egress_ended", "recording_complete"):
        room_name = (
            event.room.name
            if event.room
            else getattr(event.egress_info, "room_name", None)
            if event.egress_info
            else None
        )
        if room_name:
            session = await prisma.livesession.find_first(where={"roomName": room_name})
            if session:
                egress_id = (
                    getattr(event.egress_info, "egress_id", None)
                    if event.egress_info
                    else None
                )
                # Only accept the egress this session actually started; a stale or
                # cross-room egress event must not overwrite this session's replay.
                if (
                    session.recordingEgressId
                    and egress_id
                    and egress_id != session.recordingEgressId
                ):
                    return {"ok": True}

                url = None
                if event.egress_info:
                    if getattr(event.egress_info, "url", None):
                        url = event.egress_info.url
                    elif (
                        getattr(event.egress_info, "file_results", None)
                        and len(event.egress_info.file_results) > 0
                    ):
                        url = getattr(
                            event.egress_info.file_results[0], "location", None
                        ) or getattr(
                            event.egress_info.file_results[0], "filename", None
                        )
                    elif getattr(event.egress_info, "file", None):
                        url = getattr(
                            event.egress_info.file, "location", None
                        ) or getattr(event.egress_info.file, "filename", None)

                if url:
                    await store_replay_recording(session, url)

    return {"ok": True}


# ─── Reviews ─────────────────────────────────────────────────────────


@router.post(
    "/sessions/{session_id}/reviews",
    response_model=LiveSessionReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review_endpoint(
    session_id: str,
    body: LiveSessionReviewCreate,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    result = await create_review(
        session_id=session_id,
        user_id=current_user.id,
        rating=body.rating,
        comment=body.comment,
    )
    return LiveSessionReviewResponse(**result)


@router.get(
    "/sessions/{session_id}/reviews", response_model=LiveSessionReviewListResponse
)
async def get_session_reviews_endpoint(
    session_id: str,
    skip: int = 0,
    limit: int = 20,
):
    await _require_feature()
    result = await get_session_reviews(session_id=session_id, skip=skip, limit=limit)
    return LiveSessionReviewListResponse(**result)


@router.get(
    "/sessions/{session_id}/reviews/me",
    response_model=Optional[LiveSessionReviewResponse],
)
async def get_my_review_endpoint(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    result = await get_user_review(session_id=session_id, user_id=current_user.id)
    if not result:
        return None
    return LiveSessionReviewResponse(**result)


# ─── Chat Messages ───────────────────────────────────────────────────


@router.post(
    "/sessions/{session_id}/chat",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_chat_endpoint(
    session_id: str,
    body: ChatMessageCreate,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    result = await save_chat_message(
        session_id=session_id,
        user_id=current_user.id,
        message=body.message,
        message_type=body.messageType,
    )
    return ChatMessageResponse(**result)


@router.get("/sessions/{session_id}/chat", response_model=ChatMessageListResponse)
async def get_chat_endpoint(
    session_id: str,
    message_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    await _require_feature()
    if message_type is not None and message_type not in _CHAT_MESSAGE_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Unsupported message type",
                "code": "INVALID_MESSAGE_TYPE",
            },
        )
    result = await get_chat_messages(
        session_id=session_id,
        message_type=message_type,
        skip=skip,
        limit=limit,
    )
    return ChatMessageListResponse(**result)


# ─── Approval ────────────────────────────────────────────────────────


@router.post("/sessions/{session_id}/approve")
async def approve_session_endpoint(
    session_id: str,
    body: ApproveSessionRequest,
    current_user=Depends(require_permissions("live:sessions:approve")),
):
    ok = await approve_session(session_id)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    await prisma.auditlog.create(
        data={
            "eventType": "admin_approved_live_session",
            "entityType": "LiveSession",
            "entityId": session_id,
            "actorId": current_user.id,
        }
    )
    return {"ok": True}


@router.post("/sessions/{session_id}/reject")
async def reject_session_endpoint(
    session_id: str,
    body: RejectSessionRequest,
    current_user=Depends(require_permissions("live:sessions:approve")),
):
    ok = await reject_session(session_id, body.reason)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found", "code": "NOT_FOUND"},
        )
    await prisma.auditlog.create(
        data={
            "eventType": "admin_rejected_live_session",
            "entityType": "LiveSession",
            "entityId": session_id,
            "actorId": current_user.id,
            "metadata": Json({"reason": body.reason}),
        }
    )
    return {"ok": True}


@router.get("/admin/pending-count")
async def pending_approval_count(
    current_user=Depends(require_permissions("live:sessions:read")),
):
    count = await get_pending_approval_count()
    return {"count": count}


# ─── Admin ───────────────────────────────────────────────────────────


@router.get("/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(
    current_user=Depends(require_permissions("live:stats:read")),
):
    stats = await admin_get_stats()
    return AdminStatsResponse(**stats)


@router.get("/admin/sessions", response_model=LiveSessionListResponse)
async def admin_sessions(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(require_permissions("live:sessions:read")),
):
    items, total = await admin_list_sessions(status=status, skip=skip, limit=limit)

    # Audit log
    await prisma.auditlog.create(
        data={
            "eventType": "admin_viewed_live_sessions",
            "entityType": "Admin",
            "entityId": str(current_user.id),
            "actorId": current_user.id,
            "metadata": Json({"status": status, "total": total}),
        }
    )

    return LiveSessionListResponse(
        items=[LiveSessionResponse(**i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )
