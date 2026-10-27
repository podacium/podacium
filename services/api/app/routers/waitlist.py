import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, status
from pydantic import EmailStr
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.schemas.waitlist import (
    WaitlistRegisterRequest, WaitlistRegisterResponse,
    WaitlistEntryResponse, WaitlistStatsResponse,
    WaitlistPositionResponse, WaitlistLeaderboardEntry,
    WaitlistLeaderboardResponse, WaitlistStatusResponse,
    normalize_email, generate_referral_code,
    DISPOSABLE_DOMAINS, BLOCKED_LOCAL_PARTS, WaitlistValidateReferralResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/waitlist", tags=["Waitlist"])


# ─── Helpers ─────────────────────────────────────────────────────

def _truncate_name(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[0] if parts else full_name


async def _get_queue_position(entry_id: int, created_at: datetime) -> int:
    return await prisma.waitlistentry.count(
        where={
            "createdAt": {"lte": created_at},
            "status": {"notIn": ["UNSUBSCRIBED", "BOUNCED"]},
        }
    )


async def _get_total_count() -> int:
    return await prisma.waitlistentry.count(
        where={"status": {"notIn": ["UNSUBSCRIBED", "BOUNCED"]}}
    )


def _build_metadata(request: Request, body: WaitlistRegisterRequest, suspected_cgnat: bool, rapid_referral: bool) -> dict:
    meta = {}
    if body.fingerprint:
        meta["fingerprint"] = body.fingerprint
    if request.client:
        meta["ip"] = request.client.host
    if body.userAgent:
        meta["userAgent"] = body.userAgent
    if body.screenSize:
        meta["screenSize"] = body.screenSize
    meta["suspectedCGNAT"] = suspected_cgnat
    meta["rapidReferral"] = rapid_referral
    return meta


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/register", response_model=WaitlistRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: WaitlistRegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    if body.honeypot is not None:
        logger.info(f"Honeypot triggered from {request.client.host if request.client else 'unknown'}")
        raise HTTPException(400, detail={"message": "Bot detected", "code": "BOT_DETECTED"})

    email = normalize_email(str(body.email))

    domain = email.split('@')[1]
    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(400, detail={"message": "Disposable email not allowed", "code": "DISPOSABLE_EMAIL"})

    local_part = email.split('@')[0]
    if local_part in BLOCKED_LOCAL_PARTS:
        raise HTTPException(400, detail={"message": "Role-based email not allowed", "code": "ROLE_BASED_EMAIL"})

    existing = await prisma.waitlistentry.find_unique(where={"email": email})
    if existing:
        if existing.status in ("BOUNCED", "UNSUBSCRIBED"):
            raise HTTPException(409, detail={"message": "Email previously bounced or unsubscribed", "code": "ALREADY_BOUNCED"})
        position = await _get_queue_position(existing.id, existing.createdAt)
        return WaitlistRegisterResponse(
            ok=True,
            entry=WaitlistEntryResponse.model_validate(existing),
            queuePosition=position,
            alreadyRegistered=True,
        )

    if body.fingerprint:
        recent_entries = await prisma.waitlistentry.find_many(
            where={
                "createdAt": {"gte": datetime.utcnow() - timedelta(hours=1)},
            },
            order={"createdAt": "desc"},
        )
        for recent in recent_entries:
            meta = recent.metadata
            if isinstance(meta, dict) and meta.get("fingerprint") == body.fingerprint:
                raise HTTPException(429, detail={"message": "Too many attempts", "code": "RATE_LIMITED"})

    referrer_entry = None
    suspected_cgnat = False
    rapid_referral = False

    if body.referralCode:
        referrer_entry = await prisma.waitlistentry.find_unique(
            where={"referralCode": body.referralCode}
        )
        if not referrer_entry:
            raise HTTPException(400, detail={"message": "Invalid referral code", "code": "INVALID_REFERRAL"})

        if body.fingerprint and referrer_entry.metadata:
            ref_fp = referrer_entry.metadata.get("fingerprint") if isinstance(referrer_entry.metadata, dict) else None
            if ref_fp and ref_fp == body.fingerprint:
                raise HTTPException(409, detail={"message": "Cannot refer yourself", "code": "SELF_REFERRAL"})

        if request.client and referrer_entry.metadata:
            ref_ip = referrer_entry.metadata.get("ip") if isinstance(referrer_entry.metadata, dict) else None
            if ref_ip and ref_ip == request.client.host:
                ref_ua = referrer_entry.metadata.get("userAgent") if isinstance(referrer_entry.metadata, dict) else None
                ref_ss = referrer_entry.metadata.get("screenSize") if isinstance(referrer_entry.metadata, dict) else None
                if ref_ua and ref_ua == body.userAgent and ref_ss and ref_ss == body.screenSize:
                    raise HTTPException(409, detail={"message": "Cannot refer yourself", "code": "SELF_REFERRAL"})
                suspected_cgnat = True

        if referrer_entry.createdAt > datetime.utcnow() - timedelta(minutes=5):
            rapid_referral = True

    referral_code = generate_referral_code()
    while await prisma.waitlistentry.find_unique(where={"referralCode": referral_code}):
        referral_code = generate_referral_code()

    metadata = _build_metadata(request, body, suspected_cgnat, rapid_referral)

    create_data: dict = {
        "fullName": body.fullName,
        "email": email,
        "referralCode": referral_code,
        "utmSource": body.utmSource,
        "utmMedium": body.utmMedium,
        "utmCampaign": body.utmCampaign,
        "locale": body.locale,
        "metadata": Json(metadata),
    }
    if referrer_entry:
        create_data["referredById"] = referrer_entry.id

    new_entry = await prisma.waitlistentry.create(
        data=create_data,
    )

    if referrer_entry:
        await prisma.waitlistentry.update(
            where={"id": referrer_entry.id},
            data={"friendsReferredCount": {"increment": 1}},
        )

    position = await _get_queue_position(new_entry.id, new_entry.createdAt)
    await _get_total_count()

    try:
        from app.services.email_service import email_service
        await email_service.send_waitlist_confirmation_email(
            email=new_entry.email,
            name=new_entry.fullName,
            referral_code=new_entry.referralCode,
            queue_position=position,
            locale=new_entry.locale,
        )
    except Exception as e:
        logger.error(f"Failed to send waitlist confirmation to {new_entry.email}: {e}")

    return WaitlistRegisterResponse(
        ok=True,
        entry=WaitlistEntryResponse.model_validate(new_entry),
        queuePosition=position,
    )


@router.get("/validate-referral", response_model=WaitlistValidateReferralResponse)
async def validate_referral(code: str):
    code = code.strip().upper()
    valid_chars = set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    if len(code) != 8 or not all(c in valid_chars for c in code):
        return WaitlistValidateReferralResponse(valid=False)
    entry = await prisma.waitlistentry.find_unique(
        where={"referralCode": code}
    )
    if not entry:
        return WaitlistValidateReferralResponse(valid=False)
    return WaitlistValidateReferralResponse(
        valid=True,
        inviterName=entry.fullName.split()[0] if entry.fullName else None,
    )


@router.get("/position", response_model=WaitlistPositionResponse)
async def get_position(email: EmailStr):
    normalized = normalize_email(email)
    entry = await prisma.waitlistentry.find_unique(where={"email": normalized})
    if not entry:
        raise HTTPException(404, detail={"message": "Email not found on waitlist", "code": "NOT_FOUND"})
    position = await _get_queue_position(entry.id, entry.createdAt)
    total = await _get_total_count()
    return WaitlistPositionResponse(position=position, totalCount=total)


@router.get("/leaderboard", response_model=WaitlistLeaderboardResponse)
async def get_leaderboard():
    entries = await prisma.waitlistentry.find_many(
        where={"status": {"notIn": ["UNSUBSCRIBED", "BOUNCED"]}},
        order={"friendsReferredCount": "desc"},
        take=100,
    )
    total = await _get_total_count()
    return WaitlistLeaderboardResponse(
        entries=[
            WaitlistLeaderboardEntry(
                fullName=_truncate_name(e.fullName),
                friendsReferredCount=e.friendsReferredCount,
                createdAt=e.createdAt,
            )
            for e in entries
        ],
        totalCount=total,
    )


@router.get("/stats", response_model=WaitlistStatsResponse)
async def get_stats():
    total = await _get_total_count()
    return WaitlistStatsResponse(totalCount=total)


@router.get("/status", response_model=WaitlistStatusResponse)
async def get_status(email: EmailStr):
    normalized = normalize_email(email)
    entry = await prisma.waitlistentry.find_unique(where={"email": normalized})
    if not entry:
        return WaitlistStatusResponse(registered=False)
    return WaitlistStatusResponse(
        registered=True,
        entry=WaitlistEntryResponse.model_validate(entry),
    )
