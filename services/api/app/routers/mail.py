"""
FastAPI Router for Podacium Mail Suite (/api/v1/mail).

Thin HTTP layer routing requests to MailSuiteService and security layers.
Protected by get_current_admin_user dependency.
"""

import hmac
import hashlib
import ipaddress
import json
import logging
import socket
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, quote

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)

from app.core.auth import get_current_admin_user, get_current_user_optional
from app.core.prisma import prisma
from app.core.redis import get_redis
from app.schemas.mail import (
    ComposeEmailRequest,
    CreateMailAccountRequest,
    LinkCrmEntityRequest,
    MailAccountResponse,
    MailMessageResponse,
    MailThreadResponse,
    PaginatedThreadsResponse,
    PresenceHeartbeatRequest,
    ThreadActionRequest,
    ThreadPresenceResponse,
    ThreadPresenceUser,
)
from app.services.html_sanitizer import generate_image_proxy_signature
from app.services.mail_attachment_scanner import mail_attachment_scanner
from app.services.mail_suite_service import mail_suite_service
from app.services.storage import storage_manager

TRANSPARENT_PIXEL = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"

logger = logging.getLogger("podacium.routers.mail")

router = APIRouter(prefix="/mail", tags=["Mail Suite"])


async def _is_super_admin(user: Any) -> bool:
    """True only if user is platform root or has clearanceLevel >= 10 in SUPER_ADMIN department."""
    try:
        if getattr(user, "isSuperuser", False):
            return True

        # Fast path if adminProfile / profile is already attached on user object
        user_profile = getattr(user, "adminProfile", None)
        if user_profile is None or not hasattr(user_profile, "clearanceLevel"):
            user_profile = getattr(user, "profile", None)

        if user_profile is not None and hasattr(user_profile, "clearanceLevel"):
            clearance = getattr(user_profile, "clearanceLevel", 0)
            if isinstance(clearance, (int, float)) and clearance >= 10:
                department = str(getattr(user_profile, "department", "") or "")
                if department == "SUPER_ADMIN":
                    return True
            role_assignments = getattr(user_profile, "roleAssignments", None) or []
            if isinstance(role_assignments, (list, tuple)):
                if any(
                    ra.role and getattr(ra.role, "slug", "") == "super-admin"
                    for ra in role_assignments
                ):
                    return True
            return False

        user_id = getattr(user, "id", None)
        if not user_id or not isinstance(user_id, int):
            return False
        profile = await prisma.adminprofile.find_unique(
            where={"userId": user_id},
            include={"roleAssignments": {"include": {"role": True}}},
        )
        if not profile:
            return False
        if profile.clearanceLevel >= 10 and profile.department == "SUPER_ADMIN":
            return True
        if any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (profile.roleAssignments or [])
        ):
            return True
    except Exception as e:
        logger.warning(f"Failed resolving super admin profile: {e}")
    return False


async def check_account_access(
    account: Any,
    admin_id: int,
    is_super: bool,
    required_permission: str = "read",
) -> bool:
    """Unified Zero-Trust delegated access check for corporate mailboxes."""
    if is_super:
        return True
    if getattr(account, "userId", None) == admin_id:
        return True

    assignment = await prisma.mailaccountadminassignment.find_first(
        where={
            "mailAccountId": getattr(account, "id", None),
            "adminProfile": {"userId": admin_id},
        }
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.mail.unauthorized_account_access",
        )

    perm_map = {
        "read": "canRead",
        "send": "canSend",
        "manage": "canManage",
    }
    field = perm_map.get(required_permission, f"can_{required_permission}")
    has_perm = getattr(assignment, field, None)
    if has_perm is None:
        has_perm = getattr(assignment, f"can_{required_permission}", False)

    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"errors.mail.unauthorized_{required_permission}_access",
        )
    return True


async def _verify_account_access(
    account_id: str,
    admin_id: int,
    is_super: bool,
    required_permission: str = "read",
    require_send: bool = False,
    require_manage: bool = False,
) -> Any:
    account = await prisma.mailaccount.find_unique(where={"accountId": account_id})
    if not account or account.deletedAt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.account_not_found",
        )

    perm = required_permission
    if require_manage:
        perm = "manage"
    elif require_send:
        perm = "send"

    await check_account_access(account, admin_id, is_super, required_permission=perm)
    return account


# -----------------------------------------------------------------------------
# Account Endpoints
# -----------------------------------------------------------------------------


@router.get("/accounts", response_model=List[MailAccountResponse])
async def list_mail_accounts(
    current_admin=Depends(get_current_admin_user),
):
    """Lists corporate mail accounts accessible to the current administrator."""
    is_super = await _is_super_admin(current_admin)
    return await mail_suite_service.list_accessible_accounts(
        admin_id=current_admin.id,
        is_super_admin=is_super,
    )


@router.post(
    "/accounts", response_model=MailAccountResponse, status_code=status.HTTP_201_CREATED
)
async def create_mail_account(
    data: CreateMailAccountRequest,
    current_admin=Depends(get_current_admin_user),
):
    """Registers and provisions a new corporate @podacium.com mail account."""
    is_super = await _is_super_admin(current_admin)
    if not is_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.mail.super_admin_required",
        )
    try:
        return await mail_suite_service.create_mail_account(
            data=data,
            current_admin_id=current_admin.id,
        )
    except ValueError as e:
        logger.warning(f"Mail account validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to create mail account: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.mail.account_create_failed",
        )


@router.get("/accounts/{account_id}", response_model=MailAccountResponse)
async def get_mail_account(
    account_id: str,
    current_admin=Depends(get_current_admin_user),
):
    """Fetches details for a specific corporate mail account."""
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(account_id, current_admin.id, is_super)
    acc = await mail_suite_service.get_account_by_id(account_id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.account_not_found",
        )
    return acc


@router.post("/accounts/{account_id}/sync")
async def sync_mail_account(
    account_id: str,
    current_admin=Depends(get_current_admin_user),
):
    """Triggers an on-demand IMAP synchronization cycle."""
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(account_id, current_admin.id, is_super)
    res = await mail_suite_service.sync_account(account_id)
    if res.get("status") == "error":
        # Details are logged server-side; never leak provider internals.
        logger.warning("Mail sync failed for %s: %s", account_id, res.get("message"))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="errors.mail.sync_failed",
        )
    return res


@router.post("/accounts/{account_id}/empty-trash")
async def empty_trash(
    account_id: str,
    request: Request,
    current_admin=Depends(get_current_admin_user),
):
    """Permanently purges all trashed messages and their threads for an account."""
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        account_id, current_admin.id, is_super, require_manage=True
    )
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        result = await mail_suite_service.empty_trash(
            account_id=account_id,
            current_admin_id=current_admin.id,
            client_ip=client_ip,
        )
        # Backwards-compatible key for older clients.
        result["purged_messages_count"] = result.get("purged_messages", 0)
        return result
    except ValueError as exc:
        logger.warning(f"Empty-trash validation/delivery error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Failed to empty trash: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.mail.empty_trash_failed",
        )


# -----------------------------------------------------------------------------
# Thread & Message Endpoints
# -----------------------------------------------------------------------------


@router.get("/accounts/{account_id}/threads", response_model=PaginatedThreadsResponse)
async def list_threads(
    account_id: str,
    mailbox_type: Optional[str] = Query(
        None, description="INBOX, SENT, DRAFTS, TRASH, SPAM, ARCHIVE, STARRED"
    ),
    q: Optional[str] = Query(
        None,
        max_length=100,
        description="Search query across subjects and snippets",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_admin=Depends(get_current_admin_user),
):
    """Retrieves paginated email threads matching folder or query filters."""
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(account_id, current_admin.id, is_super)
    return await mail_suite_service.list_threads(
        account_id=account_id,
        mailbox_type=mailbox_type,
        query=q,
        page=page,
        limit=limit,
    )


@router.get("/threads/{thread_id}", response_model=MailThreadResponse)
async def get_thread_detail(
    thread_id: str,
    request: Request,
    current_admin=Depends(get_current_admin_user),
):
    """Retrieves full email thread, marks unread messages read, and writes an audit log."""
    thread_record = await prisma.mailthread.find_unique(
        where={"threadId": thread_id},
        include={"mailAccount": True},
    )
    if not thread_record or not thread_record.mailAccount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        thread_record.mailAccount.accountId, current_admin.id, is_super
    )
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")
    thread = await mail_suite_service.get_thread_detail(
        thread_id=thread_id,
        current_admin_id=current_admin.id,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    return thread


@router.post("/threads/{thread_id}/actions")
async def execute_thread_action(
    thread_id: str,
    action_req: ThreadActionRequest,
    request: Request,
    current_admin=Depends(get_current_admin_user),
):
    """Executes actions on a thread: mark_read, mark_unread, star, unstar, archive, trash, restore, purge."""
    thread_record = await prisma.mailthread.find_unique(
        where={"threadId": thread_id},
        include={"mailAccount": True},
    )
    if not thread_record or not thread_record.mailAccount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        thread_record.mailAccount.accountId,
        current_admin.id,
        is_super,
        require_manage=(action_req.action in ("purge", "delete_permanently")),
    )
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        ok = await mail_suite_service.execute_thread_action(
            thread_id=thread_id,
            action_req=action_req,
            current_admin_id=current_admin.id,
            client_ip=client_ip,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    return {"status": "ok", "action": action_req.action}


@router.post("/threads/{thread_id}/crm-link")
async def link_crm_entity(
    thread_id: str,
    data: LinkCrmEntityRequest,
    current_admin=Depends(get_current_admin_user),
):
    """Binds an email thread to a Ticket, Contract, Dispute, or Invoice."""
    thread_record = await prisma.mailthread.find_unique(
        where={"threadId": thread_id},
        include={"mailAccount": True},
    )
    if not thread_record or not thread_record.mailAccount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        thread_record.mailAccount.accountId, current_admin.id, is_super
    )
    try:
        ok = await mail_suite_service.link_crm_entity(
            thread_id=thread_id,
            data=data,
            current_admin_id=current_admin.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    return {"status": "ok"}


# -----------------------------------------------------------------------------
# Outbound Dispatch
# -----------------------------------------------------------------------------


@router.post("/send", response_model=MailMessageResponse)
async def send_email(
    data: ComposeEmailRequest,
    request: Request,
    current_admin=Depends(get_current_admin_user),
):
    """Dispatches an outbound email via SMTP and records in Sent folder."""
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        data.account_id, current_admin.id, is_super, require_send=True
    )
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")
    try:
        return await mail_suite_service.send_email(
            data=data,
            current_admin_id=current_admin.id,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except ValueError as val_err:
        logger.warning(f"Mail send validation/delivery error: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        # Never surface SMTP/IMAP internals (hostnames, auth errors) to clients.
        logger.error(f"Failed to send email: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.mail.send_failed",
        )


# -----------------------------------------------------------------------------
# Attachments & Anti-Tracking Image Proxy
# -----------------------------------------------------------------------------


MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB max


@router.post("/attachments/upload")
async def upload_attachment(
    account_id: str = Form(...),
    file: UploadFile = File(...),
    current_admin=Depends(get_current_admin_user),
):
    """Uploads, scans, and registers an attachment for compose/send.

    The attachment is persisted immediately with its owning mailbox so it can
    survive navigation away from the composer and be authorised at send time.
    """
    is_super = await _is_super_admin(current_admin)
    account = await _verify_account_access(
        account_id, current_admin.id, is_super, require_send=True
    )

    chunks = []
    total_size = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_ATTACHMENT_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Attachment exceeds maximum allowed size of 25MB.",
            )
        chunks.append(chunk)
    content = b"".join(chunks)

    scan = await mail_attachment_scanner.scan_attachment(
        filename=file.filename or "attachment",
        content=content,
        declared_mime=file.content_type,
    )
    if not scan.is_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=scan.threat or "errors.mail.attachment_unsafe",
        )

    import uuid
    import hashlib

    att_id = str(uuid.uuid4())
    safe_name = (file.filename or "attachment").replace("/", "_").replace("\\", "_")
    storage_key = f"mail/draft_attachments/{att_id}/{safe_name}"
    driver = storage_manager.get_driver("attachments")
    await driver.upload_file(
        content=content,
        key=storage_key,
        content_type=scan.detected_mime
        or file.content_type
        or "application/octet-stream",
    )
    sha = hashlib.sha256(content).hexdigest()

    try:
        record = await prisma.mailattachment.create(
            data={
                "attachmentId": att_id,
                "mailAccountId": account.id,
                "fileName": safe_name,
                "mimeType": scan.detected_mime
                or file.content_type
                or "application/octet-stream",
                "fileSizeBytes": len(content),
                "storagePath": storage_key,
                "sha256Checksum": sha,
                "scanStatus": scan.scan_status,
                "scanEngine": scan.scan_engine,
            }
        )
    except Exception:
        # Do not leave orphaned bytes behind if the DB write fails.
        try:
            await driver.delete_file(storage_key)
        except Exception:
            pass
        raise

    return {
        "attachment_id": record.attachmentId,
        "file_name": record.fileName,
        "mime_type": record.mimeType,
        "file_size_bytes": record.fileSizeBytes,
        "sha256": sha,
        "scan_status": record.scanStatus,
    }


@router.get("/diagnostics/deliverability")
async def get_email_deliverability_diagnostics(
    admin_user=Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """Inspect and validate SPF, DKIM, and DMARC DNS health for podacium.com."""
    from app.services.email_deliverability_service import deliverability_service

    return deliverability_service.full_audit()


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    current_admin=Depends(get_current_admin_user),
):
    """Downloads an attachment securely with BOLA authorization check."""
    att = await prisma.mailattachment.find_unique(
        where={"attachmentId": attachment_id},
        include={
            "mailMessage": {"include": {"mailAccount": True}},
            "mailAccount": True,
        },
    )
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.attachment_not_found",
        )

    owning_account = att.mailAccount or (
        att.mailMessage.mailAccount
        if att.mailMessage and att.mailMessage.mailAccount
        else None
    )
    if not owning_account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.mail.attachment_unowned",
        )
    is_super = await _is_super_admin(current_admin)
    await check_account_access(
        owning_account,
        current_admin.id,
        is_super,
        required_permission="read",
    )

    driver = storage_manager.get_driver("attachments")
    content = await driver.read_file_bytes(att.storagePath)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.attachment_file_missing",
        )
    if att.sha256Checksum and hashlib.sha256(content).hexdigest() != att.sha256Checksum:
        logger.error("Attachment checksum mismatch on download: %s", attachment_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.mail.attachment_checksum_mismatch",
        )

    safe_ascii_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", att.fileName)
    utf8_filename = quote(att.fileName)

    return Response(
        content=content,
        media_type=att.mimeType or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_ascii_filename}\"; filename*=UTF-8''{utf8_filename}",
            "Content-Length": str(len(content)),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.get("/messages/{message_id}/attachments/cid/{cid:path}")
async def get_message_cid_attachment(
    request: Request,
    message_id: str,
    cid: str,
    sig: Optional[str] = Query(None, description="HMAC signature for CID attachment"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
):
    """
    Streams an inline CID attachment embedded in an email message.
    Strictly authenticated and verified against mailbox authorization.
    """
    is_authorized = False

    if sig:
        expected_sig = generate_image_proxy_signature(f"cid:{cid}@{message_id}")
        if hmac.compare_digest(sig, expected_sig):
            is_authorized = True

    # A valid signature is a capability for one CID; otherwise a signed-in user
    # must pass the same mailbox authorization as a regular download. Merely
    # having *an* admin session is not sufficient.
    if not is_authorized and not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.mail.unauthorized",
        )

    msg = await prisma.mailmessage.find_unique(
        where={"messageId": message_id},
        include={"mailAccount": True},
    )
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.message_not_found",
        )

    if current_user and msg.mailAccount:
        is_super = await _is_super_admin(current_user)
        await check_account_access(
            msg.mailAccount,
            current_user.id,
            is_super,
            required_permission="read",
        )

    clean_cid = cid.strip("<>")
    att = await prisma.mailattachment.find_first(
        where={
            "mailMessageId": msg.id,
            "OR": [
                {"contentId": clean_cid},
                {"contentId": f"<{clean_cid}>"},
                {"fileName": clean_cid},
            ],
        }
    )
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.attachment_not_found",
        )

    driver = storage_manager.get_driver("attachments")
    content = await driver.read_file_bytes(att.storagePath)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.attachment_file_missing",
        )

    safe_inline_mimes = {"image/png", "image/jpeg", "image/gif", "image/webp"}
    media_type = (
        att.mimeType
        if att.mimeType in safe_inline_mimes
        else "application/octet-stream"
    )
    disposition_type = "inline" if att.mimeType in safe_inline_mimes else "attachment"

    safe_ascii_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", att.fileName)
    utf8_filename = quote(att.fileName)

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"{disposition_type}; filename=\"{safe_ascii_filename}\"; filename*=UTF-8''{utf8_filename}",
            "Content-Length": str(len(content)),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.get("/proxy/image")
async def proxy_remote_image(
    request: Request,
    url: str = Query(..., description="External image URL to proxy"),
    sig: Optional[str] = Query(
        None, description="HMAC signature for email image display"
    ),
    current_user: Optional[Any] = Depends(get_current_user_optional),
):
    """
    Zero-trust SSRF-protected image proxy for email remote assets.
    Prevents IP exfiltration and tracking pixel logging.
    Allows signed URLs from SafeMailHTMLParser or active admin sessions.
    """
    # 1. Authorization: check HMAC signature or active admin session
    is_authorized = False
    if sig:
        expected_sig = generate_image_proxy_signature(url)
        if hmac.compare_digest(sig, expected_sig):
            is_authorized = True

    if (
        not is_authorized
        and current_user
        and getattr(current_user, "role", "") == "ADMIN"
    ):
        is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.mail.proxy_unauthorized",
        )

    # 2. URL and Anti-SSRF Validation
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")

    hostname = parsed.hostname.lower()
    if hostname in (
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "internal",
        "metadata.google.internal",
        "169.254.169.254",
    ):
        raise HTTPException(status_code=400, detail="Disallowed target host")

    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise HTTPException(status_code=400, detail="Disallowed target host")
    except ValueError:
        # Check resolved IPs to prevent DNS rebinding SSRF
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for _, _, _, _, sockaddr in addr_info:
                resolved_ip_str = sockaddr[0]
                resolved_ip = ipaddress.ip_address(resolved_ip_str)
                if (
                    resolved_ip.is_private
                    or resolved_ip.is_loopback
                    or resolved_ip.is_link_local
                ):
                    raise HTTPException(
                        status_code=400, detail="Disallowed target host"
                    )
        except socket.gaierror:
            # Domain cannot be resolved, return transparent pixel
            return Response(
                content=TRANSPARENT_PIXEL,
                media_type="image/gif",
                headers={"Cache-Control": "public, max-age=3600"},
            )

    # 3. Fetch image with timeout and error fallback
    try:
        MAX_IMAGE_BYTES = 5 * 1024 * 1024
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            resp = await client.get(
                url, headers={"User-Agent": "Podacium-ImageProxy/1.0"}
            )
            if resp.status_code != 200:
                # Return transparent pixel instead of 502 to avoid broken icon boxes in email
                return Response(
                    content=TRANSPARENT_PIXEL,
                    media_type="image/gif",
                    headers={"Cache-Control": "public, max-age=3600"},
                )

            content_type = (
                resp.headers.get("content-type", "image/png")
                .split(";")[0]
                .strip()
                .lower()
            )
            # Block SVG to prevent script execution
            if content_type == "image/svg+xml":
                return Response(
                    content=TRANSPARENT_PIXEL,
                    media_type="image/gif",
                    headers={"Cache-Control": "public, max-age=3600"},
                )

            if not (
                content_type.startswith("image/")
                or content_type == "application/octet-stream"
            ):
                raise HTTPException(
                    status_code=400, detail="Fetched resource is not an image"
                )

            if content_type == "application/octet-stream":
                content_type = "image/png"

            content_bytes = resp.content
            if len(content_bytes) > MAX_IMAGE_BYTES:
                raise HTTPException(
                    status_code=413, detail="Image exceeds 5MB size limit"
                )

            return Response(
                content=content_bytes,
                media_type=content_type,
                headers={
                    "Cache-Control": "private, max-age=86400",
                    "X-Content-Type-Options": "nosniff",
                    "Content-Security-Policy": "default-src 'none'; sandbox",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Image proxy failed for URL {url}: {exc}")
        return Response(
            content=TRANSPARENT_PIXEL,
            media_type="image/gif",
            headers={"Cache-Control": "public, max-age=3600"},
        )


@router.get("/audit/verify")
async def verify_mail_audit_chain(
    current_admin=Depends(get_current_admin_user),
):
    """Recomputes the audit hash chain (super-admin only)."""
    is_super = await _is_super_admin(current_admin)
    if not is_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.mail.super_admin_required",
        )
    return await mail_suite_service.verify_audit_chain()


# -----------------------------------------------------------------------------
# Collision Detection & Presence
# -----------------------------------------------------------------------------

_PRESENCE_TTL_SECONDS = 25
# Fallback for single-process deployments without Redis.
_THREAD_PRESENCE: Dict[str, Dict[str, Dict[str, str]]] = {}


def _presence_key(thread_id: str) -> str:
    return f"mail:presence:{thread_id}"


async def _presence_write(
    thread_id: str,
    admin_id: int,
    name: str,
    email: str,
    status: str,
) -> None:
    payload: Dict[str, Any] = {
        "admin_id": admin_id,
        "admin_name": name,
        "admin_email": email,
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    redis: Any = await get_redis()
    if redis:
        key = _presence_key(thread_id)
        await redis.hset(key, str(admin_id), json.dumps(payload))
        await redis.expire(key, _PRESENCE_TTL_SECONDS)
        return
    _THREAD_PRESENCE.setdefault(thread_id, {})[str(admin_id)] = payload


async def _presence_read(thread_id: str) -> List[Dict[str, Any]]:
    redis: Any = await get_redis()
    now = datetime.now(timezone.utc)
    if redis:
        raw = await redis.hgetall(_presence_key(thread_id))
        entries = []
        for value in raw.values():
            try:
                payload = json.loads(value)
                updated = datetime.fromisoformat(payload["updated_at"])
            except Exception:
                continue
            # A single active writer refreshes the whole hash TTL, so stale
            # entries must be filtered individually.
            if (now - updated).total_seconds() > _PRESENCE_TTL_SECONDS:
                continue
            entries.append(payload)
        return entries

    entries = []
    bucket = _THREAD_PRESENCE.get(thread_id, {})
    for key, payload in list(bucket.items()):
        try:
            updated = datetime.fromisoformat(payload["updated_at"])
        except Exception:
            bucket.pop(key, None)
            continue
        if (now - updated).total_seconds() > _PRESENCE_TTL_SECONDS:
            bucket.pop(key, None)
            continue
        entries.append(payload)
    return entries


async def _presence_authorized_admin_ids(account: Any) -> set:
    """Admins allowed to see activity on this mailbox."""
    allowed = set()
    if getattr(account, "userId", None):
        allowed.add(account.userId)
    assignments = await prisma.mailaccountadminassignment.find_many(
        where={"mailAccountId": account.id},
        include={"adminProfile": True},
    )
    for assignment in assignments:
        profile = getattr(assignment, "adminProfile", None)
        if profile and getattr(profile, "userId", None):
            allowed.add(profile.userId)
    super_admins = await prisma.adminprofile.find_many(
        where={
            "OR": [
                {"department": "SUPER_ADMIN"},
                {"clearanceLevel": {"gte": 10}},
            ]
        }
    )
    for profile in super_admins:
        if getattr(profile, "userId", None):
            allowed.add(profile.userId)
    return allowed


async def _load_presence_thread(thread_id: str, current_admin: Any) -> Any:
    thread = await prisma.mailthread.find_unique(
        where={"threadId": thread_id},
        include={"mailAccount": True},
    )
    if not thread or not thread.mailAccount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.mail.thread_not_found",
        )
    is_super = await _is_super_admin(current_admin)
    await _verify_account_access(
        thread.mailAccount.accountId, current_admin.id, is_super
    )
    return thread


@router.post("/presence/heartbeat")
async def report_presence_heartbeat(
    data: PresenceHeartbeatRequest,
    current_admin=Depends(get_current_admin_user),
):
    """Reports viewing or typing presence on an email thread to prevent collision."""
    await _load_presence_thread(data.thread_id, current_admin)

    admin_name = (
        getattr(current_admin, "fullName", None)
        or getattr(current_admin, "name", None)
        or "Admin"
    )
    admin_email = getattr(current_admin, "email", "admin@podacium.com")
    await _presence_write(
        data.thread_id,
        current_admin.id,
        admin_name,
        admin_email,
        data.status,
    )
    return {"status": "ok", "thread_id": data.thread_id}


@router.get("/presence/{thread_id}", response_model=ThreadPresenceResponse)
async def get_thread_presence(
    thread_id: str,
    current_admin=Depends(get_current_admin_user),
):
    """Retrieves active admins (with mailbox access) viewing this thread."""
    thread = await _load_presence_thread(thread_id, current_admin)

    allowed_ids = await _presence_authorized_admin_ids(thread.mailAccount)
    active = []
    for payload in await _presence_read(thread_id):
        try:
            admin_id = int(payload["admin_id"])
            updated_at = datetime.fromisoformat(payload["updated_at"])
        except (KeyError, TypeError, ValueError):
            continue
        if admin_id == current_admin.id or admin_id not in allowed_ids:
            continue
        active.append(
            ThreadPresenceUser(
                admin_id=admin_id,
                admin_name=payload.get("admin_name", "Admin"),
                admin_email=payload.get("admin_email", ""),
                status=payload.get("status", "viewing"),
                updated_at=updated_at,
            )
        )

    return ThreadPresenceResponse(thread_id=thread_id, active_admins=active)
