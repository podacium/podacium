"""
Podacium Mail Suite Core Engine.

Manages corporate @podacium.com email operations:
1. Account lifecycle & envelope-encrypted credential management.
2. Synchronous & asynchronous IMAP folder discovery, sync, and delta fetching.
3. RFC 5322 MIME parsing (multi-part, headers, attachments, charset decoding).
4. Outbound SMTP sending via Port 465 SSL with auto-append to Sent IMAP mailbox.
5. Threading engine (Message-ID, In-Reply-To, References, and Subject normalization).
6. Platform CRM context detection & linking (User, Organization, Contract, Ticket, Dispute, Invoice).
7. Tamper-evident email audit logging.
"""

import asyncio
import email
from email.header import decode_header
from email.message import EmailMessage
import email.policy
from email.utils import make_msgid, parseaddr, parsedate_to_datetime
import hashlib
import hmac
import imaplib
import json
import logging
import os
import re
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, quote

from prisma.errors import UniqueViolationError

from app.core.config import setting
from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums
from app.generated.prisma import Json
from app.schemas.mail import (
    ComposeEmailRequest,
    CreateMailAccountRequest,
    CrmContextResponse,
    LinkCrmEntityRequest,
    MailAccountResponse,
    MailAccountStatusEnum,
    MailAccountTypeEnum,
    MailAttachmentResponse,
    MailMessageResponse,
    MailMessageStatusEnum,
    MailPriorityEnum,
    MailThreadResponse,
    MailboxResponse,
    MailboxTypeEnum,
    PaginatedThreadsResponse,
    ThreadActionRequest,
)
from app.services.envelope_encryption_service import envelope_encryption_service
from app.services.html_sanitizer import (
    generate_image_proxy_signature,
    html_to_plain_text,
    sanitize_email_html,
)
from app.services.mail_attachment_scanner import mail_attachment_scanner
from app.services.storage import storage_manager

logger = logging.getLogger("podacium.mail_suite")


def _decode_mime_header(header_value: Optional[str]) -> str:
    """Safely decodes RFC 2047 MIME encoded headers."""
    if not header_value:
        return ""
    try:
        decoded_parts = decode_header(header_value)
        result = []
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                enc = encoding or "utf-8"
                try:
                    result.append(part.decode(enc, errors="replace"))
                except LookupError:
                    result.append(part.decode("utf-8", errors="replace"))
            else:
                result.append(str(part))
        return "".join(result)
    except Exception:
        return str(header_value)


def _normalize_subject(subject: str) -> str:
    """Strips Re:, Fwd:, etc., for thread grouping fallback."""
    clean = re.sub(
        r"^(\s*(re|fwd|fw|رد|إعادة)\s*[:：\-_]\s*)+", "", subject, flags=re.IGNORECASE
    )
    return clean.strip()


class MailSuiteService:
    """Core enterprise email engine for Podacium."""

    # -------------------------------------------------------------------------
    # Account Management
    # -------------------------------------------------------------------------

    async def create_mail_account(
        self,
        data: CreateMailAccountRequest,
        current_admin_id: int,
    ) -> MailAccountResponse:
        """Creates and initializes a new corporate @podacium.com mail account."""
        account_uuid = str(uuid.uuid4())

        # Encrypt credentials using envelope encryption
        ct, wrapped_dek, nonce = (
            envelope_encryption_service.encrypt_credentials_triplet(
                password=data.password,
                account_id=account_uuid,
                email=data.email_address,
            )
        )

        account = await prisma.mailaccount.create(
            data={
                "accountId": account_uuid,
                "emailAddress": data.email_address,
                "displayName": data.display_name,
                "type": getattr(p_enums.MailAccountType, data.account_type.value),
                "status": p_enums.MailAccountStatus.ACTIVE,
                "imapHost": data.imap_host,
                "imapPort": data.imap_port,
                "imapUseSsl": data.imap_use_ssl,
                "smtpHost": data.smtp_host,
                "smtpPort": data.smtp_port,
                "smtpUseSsl": data.smtp_use_ssl,
                "encryptedPassword": ct,
                "dekWrapped": wrapped_dek,
                "dekNonce": nonce,
                "signatureHtml": data.signature_html,
                "userId": current_admin_id
                if data.account_type == MailAccountTypeEnum.PERSONAL
                else None,
            }
        )

        # Initialize standard mailboxes
        default_mailboxes = [
            ("Inbox", "INBOX", p_enums.MailboxType.INBOX),
            ("Sent", "Sent", p_enums.MailboxType.SENT),
            ("Drafts", "Drafts", p_enums.MailboxType.DRAFTS),
            ("Trash", "Trash", p_enums.MailboxType.TRASH),
            ("Spam", "Junk", p_enums.MailboxType.SPAM),
            ("Archive", "Archive", p_enums.MailboxType.ARCHIVE),
        ]

        created_mailboxes = []
        for name, remote_name, mb_type in default_mailboxes:
            mb = await prisma.mailbox.create(
                data={
                    "mailboxId": str(uuid.uuid4()),
                    "mailAccountId": account.id,
                    "name": name,
                    "remoteName": remote_name,
                    "type": mb_type,
                    "unreadCount": 0,
                    "totalCount": 0,
                }
            )
            created_mailboxes.append(mb)

        return await self._format_account_response(account.id)

    async def list_accessible_accounts(
        self,
        admin_id: int,
        is_super_admin: bool = False,
    ) -> List[MailAccountResponse]:
        """Lists mail accounts accessible to the current administrator."""
        if is_super_admin:
            accounts = await prisma.mailaccount.find_many(
                where={"deletedAt": None},
                include={"mailboxes": True},
                order={"createdAt": "asc"},
            )
        else:
            # Personal accounts or assigned departmental accounts
            accounts = await prisma.mailaccount.find_many(
                where={
                    "deletedAt": None,
                    "OR": [
                        {"userId": admin_id},
                        {
                            "adminAssignments": {
                                "some": {
                                    "adminProfile": {"userId": admin_id},
                                    "canRead": True,
                                }
                            }
                        },
                    ],
                },
                include={"mailboxes": True},
                order={"createdAt": "asc"},
            )

        responses = []
        for acc in accounts:
            responses.append(await self._format_account_record(acc))
        return responses

    async def check_account_permission(
        self,
        account_id: str,
        admin_id: int,
        required: str = "read",
    ) -> bool:
        """Server-side mailbox permission check.

        Used by non-HTTP entry points (agent tools, background jobs) so they
        cannot bypass the router's authorization.
        """
        account = await prisma.mailaccount.find_unique(where={"accountId": account_id})
        if not account or account.deletedAt:
            return False
        if getattr(account, "userId", None) == admin_id:
            return True

        user = await prisma.user.find_unique(where={"id": admin_id})
        if user and getattr(user, "isSuperuser", False):
            return True

        profile = await prisma.adminprofile.find_first(
            where={"userId": admin_id},
            include={"roleAssignments": {"include": {"role": True}}},
        )
        if not profile:
            return False
        if (
            getattr(profile, "clearanceLevel", 0) >= 10
            and getattr(profile, "department", "") == "SUPER_ADMIN"
        ):
            return True
        if any(
            getattr(assignment.role, "slug", "") == "super-admin"
            for assignment in (getattr(profile, "roleAssignments", None) or [])
            if getattr(assignment, "role", None)
        ):
            return True

        assignment = await prisma.mailaccountadminassignment.find_first(
            where={
                "mailAccountId": account.id,
                "adminProfileId": profile.id,
            }
        )
        if not assignment:
            return False
        field = {
            "read": "canRead",
            "send": "canSend",
            "manage": "canManage",
        }.get(required, f"can_{required}")
        return bool(getattr(assignment, field, False))

    async def get_account_by_id(
        self,
        account_id: str,
    ) -> Optional[MailAccountResponse]:
        """Fetches account details by public UUID."""
        account = await prisma.mailaccount.find_unique(
            where={"accountId": account_id},
            include={"mailboxes": True},
        )
        if not account or account.deletedAt:
            return None
        return await self._format_account_record(account)

    async def _format_account_record(self, acc: Any) -> MailAccountResponse:
        mailboxes_resp = [
            MailboxResponse(
                id=mb.id,
                mailbox_id=mb.mailboxId,
                name=mb.name,
                remote_name=mb.remoteName,
                type=MailboxTypeEnum(mb.type),
                unread_count=mb.unreadCount,
                total_count=mb.totalCount,
            )
            for mb in (acc.mailboxes or [])
        ]
        return MailAccountResponse(
            id=acc.id,
            account_id=acc.accountId,
            email_address=acc.emailAddress,
            display_name=acc.displayName,
            type=MailAccountTypeEnum(acc.type),
            status=MailAccountStatusEnum(acc.status),
            quota_bytes=int(acc.quotaBytes) if acc.quotaBytes is not None else None,
            used_bytes=int(acc.usedBytes) if acc.usedBytes is not None else 0,
            signature_html=acc.signatureHtml,
            last_sync_at=acc.lastSyncAt,
            last_sync_error=acc.lastSyncError,
            mailboxes=mailboxes_resp,
        )

    async def _format_account_response(self, account_db_id: int) -> MailAccountResponse:
        acc = await prisma.mailaccount.find_unique(
            where={"id": account_db_id},
            include={"mailboxes": True},
        )
        if not acc:
            raise ValueError("Account not found")
        return await self._format_account_record(acc)

    # -------------------------------------------------------------------------
    # IMAP Synchronization
    # -------------------------------------------------------------------------

    async def sync_account(self, account_id: str) -> Dict[str, Any]:
        """
        Synchronizes an account's mailboxes with the remote IMAP server (Purelymail).
        Runs blocking IMAP socket I/O in a background thread.
        """
        account = await prisma.mailaccount.find_unique(
            where={"accountId": account_id},
            include={"mailboxes": True},
        )
        if not account or account.deletedAt:
            raise ValueError("Account not found")

        # Decrypt password
        try:
            password = envelope_encryption_service.decrypt_credentials_triplet(
                ciphertext_b64=account.encryptedPassword,
                dek_wrapped_b64=account.dekWrapped,
                iv_b64=account.dekNonce,
                account_id=account.accountId,
                email=account.emailAddress,
            )
        except Exception as e:
            logger.error(
                f"Failed to decrypt credentials for {account.emailAddress}: {e}"
            )
            await prisma.mailaccount.update(
                where={"id": account.id},
                data={
                    "status": p_enums.MailAccountStatus.AUTH_ERROR,
                    "lastSyncError": "Decryption failed",
                },
            )
            return {"status": "error", "message": "Credential decryption failed"}

        try:
            await prisma.mailaccount.update(
                where={"id": account.id},
                data={"status": p_enums.MailAccountStatus.SYNCING},
            )

            # Fetch remote messages via blocking IMAP in a background thread
            fetched_data = await asyncio.to_thread(
                self._fetch_remote_imap_messages,
                account.imapHost,
                account.imapPort,
                account.emailAddress,
                password,
            )

            # Persist fetched messages using the active async event loop and Prisma client
            new_count = await self._persist_synced_messages(
                account_id=account.id,
                mailbox_remote_name="INBOX",
                messages=fetched_data.get("messages", []),
                total_in_mailbox=fetched_data.get("total_messages", 0),
            )
            sync_result = {
                "inbox_count": fetched_data.get("total_messages", 0),
                "new_messages": new_count,
            }

            await prisma.mailaccount.update(
                where={"id": account.id},
                data={
                    "status": p_enums.MailAccountStatus.ACTIVE,
                    "lastSyncAt": datetime.now(timezone.utc),
                    "lastSyncError": None,
                },
            )

            # Notify assigned admins and account owner via real-time WebSocket
            try:
                assigned_user_ids = []
                if account.userId:
                    assigned_user_ids.append(account.userId)
                assignments = await prisma.mailaccountadminassignment.find_many(
                    where={"mailAccountId": account.id},
                    include={"adminProfile": True},
                )
                for ass in assignments:
                    if ass.adminProfile and ass.adminProfile.userId:
                        assigned_user_ids.append(ass.adminProfile.userId)

                unique_ids = list(set(assigned_user_ids))
                if unique_ids:
                    from app.routers.websocket import manager as ws_manager

                    new_count = (
                        sync_result.get("new_messages", 0)
                        if isinstance(sync_result, dict)
                        else 0
                    )
                    ws_payload = {
                        "type": "notification",
                        "data": {
                            "type": "MAIL_SYNC",
                            "accountId": account.accountId,
                            "emailAddress": account.emailAddress,
                            "newMessages": new_count,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                    await ws_manager.broadcast_to_users(unique_ids, ws_payload)
            except Exception as ws_err:
                logger.debug(f"Could not dispatch mail sync websocket event: {ws_err}")

            return {"status": "ok", "synced": sync_result}

        except Exception as exc:
            logger.warning(f"IMAP sync failed for {account.emailAddress}: {exc}")
            is_auth_failure = (
                "authentication failed" in str(exc).lower()
                or "invalid credentials" in str(exc).lower()
            )
            new_status = (
                p_enums.MailAccountStatus.AUTH_ERROR
                if is_auth_failure
                else p_enums.MailAccountStatus.ACTIVE
            )
            await prisma.mailaccount.update(
                where={"id": account.id},
                data={
                    "status": new_status,
                    "lastSyncError": str(exc)[:255],
                },
            )
            return {"status": "error", "message": str(exc)}

    def _fetch_remote_imap_messages(
        self,
        host: str,
        port: int,
        user: str,
        pwd: str,
    ) -> Dict[str, Any]:
        client = imaplib.IMAP4_SSL(host, port, timeout=10)
        try:
            client.login(user, pwd)
            # Select INBOX
            status, count_data = client.select("INBOX", readonly=True)
            if status != "OK":
                try:
                    client.logout()
                except Exception:
                    pass
                return {"total_messages": 0, "messages": []}

            total_messages = int(
                count_data[0].decode() if count_data and count_data[0] else 0
            )

            # Get recent UIDs (e.g., last 30 messages)
            typ, uid_data = client.uid("search", "ALL")
            uids = uid_data[0].split() if uid_data and uid_data[0] else []
            recent_uids = uids[-30:] if len(uids) > 30 else uids

            fetched_messages = []
            for uid_bytes in reversed(recent_uids):
                uid_str = uid_bytes.decode()
                typ, msg_data = client.uid("fetch", uid_str, "(RFC822 FLAGS)")
                if typ == "OK" and msg_data and isinstance(msg_data[0], tuple):
                    raw_email = msg_data[0][1]
                    flags = (
                        msg_data[0][0].decode()
                        if isinstance(msg_data[0][0], bytes)
                        else str(msg_data[0][0])
                    )
                    is_seen = "\\Seen" in flags
                    parsed = email.message_from_bytes(
                        raw_email, policy=email.policy.default
                    )
                    fetched_messages.append((int(uid_str), parsed, is_seen))

            try:
                client.logout()
            except Exception:
                pass
            return {"total_messages": total_messages, "messages": fetched_messages}
        except Exception as e:
            logger.debug(f"IMAP operation for '{user}' failed: {e}")
            try:
                client.close()
            except Exception:
                pass
            raise e

    def extract_body_and_attachments(
        self, msg: Any
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """Extracts plain text, HTML body, and attachment payloads from a parsed email Message."""
        body_text = ""
        body_html = ""
        attachments_to_create = []

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get_content_disposition() or "")
                filename = part.get_filename()
                cid = part.get("Content-Id")
                if (
                    disposition == "attachment" or filename or cid
                ) and content_type not in (
                    "text/plain",
                    "text/html",
                ):
                    raw_payload = part.get_payload(decode=True)
                    if raw_payload and (filename or cid):
                        clean_cid = cid.strip("<>") if cid else None
                        if not filename and clean_cid:
                            filename = f"{clean_cid}.png"
                        elif not filename:
                            filename = f"inline-{uuid.uuid4().hex[:8]}.png"
                        filename = _decode_mime_header(filename)
                        attachments_to_create.append(
                            {
                                "filename": filename,
                                "mime": content_type,
                                "payload": raw_payload,
                                "cid": clean_cid,
                            }
                        )
                elif content_type == "text/plain" and not body_text:
                    body_text = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", errors="replace"
                    )
                elif content_type == "text/html" and not body_html:
                    body_html = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", errors="replace"
                    )
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                text_decoded = payload.decode(
                    msg.get_content_charset() or "utf-8", errors="replace"
                )
                if msg.get_content_type() == "text/html":
                    body_html = text_decoded
                else:
                    body_text = text_decoded

        if not body_text and body_html:
            body_text = html_to_plain_text(body_html)

        return body_text, body_html, attachments_to_create

    async def _persist_synced_messages(
        self,
        account_id: int,
        mailbox_remote_name: str,
        messages: List[Tuple[int, EmailMessage, bool]],
        total_in_mailbox: int,
    ) -> int:
        """Persists incoming parsed MIME messages and links them into threads."""
        mailbox = await prisma.mailbox.find_first(
            where={"mailAccountId": account_id, "remoteName": mailbox_remote_name}
        )
        if not mailbox:
            # Fallback to INBOX
            mailbox = await prisma.mailbox.find_first(
                where={"mailAccountId": account_id, "type": p_enums.MailboxType.INBOX}
            )
        if not mailbox:
            return 0

        created_count = 0
        for uid_val, msg, is_seen in messages:
            internet_msg_id = msg.get("Message-ID", "")
            subject = _decode_mime_header(msg.get("Subject", "(No Subject)"))
            from_hdr = msg.get("From", "")
            from_name, from_addr = parseaddr(from_hdr)
            from_name = _decode_mime_header(from_name)

            to_hdrs = msg.get_all("To", [])
            to_addrs = [parseaddr(t)[1] for t in to_hdrs if parseaddr(t)[1]]

            cc_hdrs = msg.get_all("Cc", [])
            cc_addrs = [parseaddr(c)[1] for c in cc_hdrs if parseaddr(c)[1]]

            in_reply_to = msg.get("In-Reply-To", "")
            references = msg.get_all("References", [])
            ref_list: List[str] = []
            for r in references:
                ref_list.extend(r.split())

            date_hdr = msg.get("Date")
            msg_dt = datetime.now(timezone.utc)
            if date_hdr:
                try:
                    msg_dt = parsedate_to_datetime(date_hdr)
                except Exception:
                    pass

            # Extract body text and html
            body_text, body_html, attachments_to_create = (
                self.extract_body_and_attachments(msg)
            )

            # Recipient resolution for multi-mailbox domain catch-all routing
            candidate_recipients: List[str] = []
            for hdr_name in ["Delivered-To", "X-Original-To", "Envelope-To"]:
                val = msg.get(hdr_name)
                if val:
                    candidate_recipients.append(parseaddr(val)[1].lower().strip())
            for t in to_addrs:
                candidate_recipients.append(t.lower().strip())
            for c in cc_addrs:
                candidate_recipients.append(c.lower().strip())

            dest_account_id = account_id
            for cand in candidate_recipients:
                if cand and cand.endswith("@podacium.com"):
                    matched_acc = await prisma.mailaccount.find_unique(
                        where={"emailAddress": cand}
                    )
                    if matched_acc and not matched_acc.deletedAt:
                        dest_account_id = matched_acc.id
                        break

            target_mb = await prisma.mailbox.find_first(
                where={
                    "mailAccountId": dest_account_id,
                    "remoteName": mailbox_remote_name,
                }
            )
            if not target_mb:
                target_mb = await prisma.mailbox.find_first(
                    where={
                        "mailAccountId": dest_account_id,
                        "type": p_enums.MailboxType.INBOX,
                    }
                )
            if not target_mb:
                target_mb = mailbox
                dest_account_id = account_id

            # Check if message already exists in dest_account_id
            existing = await prisma.mailmessage.find_first(
                where={
                    "mailAccountId": dest_account_id,
                    "OR": [
                        {"internetMessageId": internet_msg_id}
                        if internet_msg_id
                        else {"id": -1},
                        {"uid": uid_val, "mailboxId": target_mb.id},
                    ],
                }
            )
            if existing:
                continue

            # Thread matching logic
            norm_subj = _normalize_subject(subject)
            thread = None

            # Try matching via In-Reply-To or References
            search_ids = [in_reply_to] + ref_list
            valid_search_ids = [x.strip() for x in search_ids if x and x.strip()]
            if valid_search_ids:
                matched_msg = await prisma.mailmessage.find_first(
                    where={
                        "mailAccountId": dest_account_id,
                        "internetMessageId": {"in": valid_search_ids},
                    },
                    include={"thread": True},
                )
                if matched_msg and matched_msg.thread:
                    thread = matched_msg.thread

            # Fallback: match by *exact* normalized subject. `contains` merged
            # unrelated conversations ("Invoice" vs "Invoice for March").
            if not thread and norm_subj:
                thread = await prisma.mailthread.find_first(
                    where={
                        "mailAccountId": dest_account_id,
                        "subject": {"equals": norm_subj, "mode": "insensitive"},
                    },
                    order={"lastMessageAt": "desc"},
                )

            snippet = (body_text[:200] if body_text else "").replace("\n", " ").strip()
            has_attachments = len(attachments_to_create) > 0

            if not thread:
                thread = await prisma.mailthread.create(
                    data={
                        "threadId": str(uuid.uuid4()),
                        "mailAccountId": dest_account_id,
                        "subject": subject,
                        "snippet": snippet,
                        "lastMessageAt": msg_dt,
                        "messageCount": 1,
                        "hasAttachments": has_attachments,
                        "isUnread": not is_seen,
                    }
                )
            else:
                await prisma.mailthread.update(
                    where={"id": thread.id},
                    data={
                        "snippet": snippet,
                        "lastMessageAt": msg_dt,
                        "messageCount": {"increment": 1},
                        "hasAttachments": thread.hasAttachments or has_attachments,
                        "isUnread": True if not is_seen else thread.isUnread,
                    },
                )

            # Create message record
            msg_id = str(uuid.uuid4())
            clean_html = (
                sanitize_email_html(body_html, message_id=msg_id) if body_html else None
            )
            try:
                created_msg = await prisma.mailmessage.create(
                    data={
                        "messageId": msg_id,
                        "internetMessageId": internet_msg_id or None,
                        "inReplyTo": in_reply_to or None,
                        "references": ref_list,
                        "mailAccountId": dest_account_id,
                        "mailboxId": target_mb.id,
                        "threadId": thread.id,
                        "uid": uid_val,
                        "fromAddress": from_addr,
                        "fromName": from_name,
                        "toAddresses": to_addrs,
                        "ccAddresses": cc_addrs,
                        "subject": subject,
                        "snippet": snippet,
                        "bodyText": body_text,
                        "bodyHtml": clean_html,
                        "status": p_enums.MailMessageStatus.RECEIVED,
                        "priority": p_enums.MailPriority.NORMAL,
                        "isRead": is_seen,
                        "hasAttachments": has_attachments,
                        "receivedAt": msg_dt,
                    }
                )
            except UniqueViolationError:
                # Concurrent sync (manual + cron) already inserted it.
                logger.info(
                    "Skipping duplicate message %s for account %s",
                    internet_msg_id or uid_val,
                    dest_account_id,
                )
                continue

            # Process attachments
            driver = storage_manager.get_driver("attachments")
            for att in attachments_to_create:
                scan = await mail_attachment_scanner.scan_attachment(
                    filename=att["filename"],
                    content=att["payload"],
                    declared_mime=att["mime"],
                )
                if not scan.is_safe:
                    logger.warning(
                        f"Rejected unsafe attachment {att['filename']}: {scan.threat}"
                    )
                    continue

                storage_key = (
                    f"mail/{dest_account_id}/{created_msg.messageId}/{att['filename']}"
                )
                await driver.upload_file(
                    content=att["payload"],
                    key=storage_key,
                    content_type=scan.detected_mime or att["mime"],
                )
                sha = hashlib.sha256(att["payload"]).hexdigest()

                await prisma.mailattachment.create(
                    data={
                        "attachmentId": str(uuid.uuid4()),
                        "mailMessageId": created_msg.id,
                        "mailAccountId": dest_account_id,
                        "fileName": att["filename"],
                        "mimeType": scan.detected_mime or att["mime"],
                        "fileSizeBytes": len(att["payload"]),
                        "contentId": att["cid"],
                        "storagePath": storage_key,
                        "sha256Checksum": sha,
                        "scanStatus": scan.scan_status,
                        "scanEngine": scan.scan_engine,
                    }
                )

            # Auto-detect CRM entity link
            await self._auto_link_crm_entities(thread.id, from_addr, to_addrs)
            created_count += 1

        # Update the mailbox that actually received the messages (the catch-all
        # destination), not necessarily the connected source mailbox.
        recipient_mailbox_id = target_mb.id if messages else mailbox.id
        unread_count = await prisma.mailmessage.count(
            where={"mailboxId": recipient_mailbox_id, "isRead": False}
        )
        total_count = await prisma.mailmessage.count(
            where={"mailboxId": recipient_mailbox_id}
        )
        await prisma.mailbox.update(
            where={"id": recipient_mailbox_id},
            data={"unreadCount": unread_count, "totalCount": total_count},
        )

        return created_count

    async def _auto_link_crm_entities(
        self,
        thread_id: int,
        sender_email: str,
        recipient_emails: List[str],
    ) -> None:
        """Finds matching User, Contract, Ticket, Dispute, or Invoice for 360-degree CRM context."""
        emails_to_check = [sender_email] + recipient_emails
        clean_emails = [e.lower().strip() for e in emails_to_check if e]

        matched_user = await prisma.user.find_first(
            where={"email": {"in": clean_emails}}
        )
        if not matched_user:
            return

        # Find active contract, ticket, or invoice
        contract = await prisma.contract.find_first(
            where={
                "OR": [
                    {"clientId": matched_user.id},
                    {"freelancerId": matched_user.id},
                ]
            },
            order={"createdAt": "desc"},
        )
        ticket = await prisma.ticket.find_first(
            where={"userId": matched_user.id},
            order={"createdAt": "desc"},
        )
        invoice = await prisma.invoice.find_first(
            where={
                "OR": [
                    {"recipientId": matched_user.id},
                    {"issuerId": matched_user.id},
                ]
            },
            order={"createdAt": "desc"},
        )

        update_data: Dict[str, Any] = {}
        if contract:
            update_data["contractId"] = contract.id
        if ticket:
            update_data["ticketId"] = ticket.id
        if invoice:
            update_data["invoiceId"] = invoice.id

        if update_data:
            await prisma.mailthread.update(
                where={"id": thread_id},
                data=update_data,
            )

    # -------------------------------------------------------------------------
    # Outbound SMTP Sending
    # -------------------------------------------------------------------------

    async def send_email(
        self,
        data: ComposeEmailRequest,
        current_admin_id: int,
        client_ip: str = "127.0.0.1",
        user_agent: str = "Podacium-Webmail",
    ) -> MailMessageResponse:
        """
        Sends an email via Purelymail SMTP on Port 465 (Implicit SSL),
        and automatically appends a copy with \\Seen to the remote IMAP Sent folder.
        """
        account = await prisma.mailaccount.find_unique(
            where={"accountId": data.account_id},
            include={"mailboxes": True},
        )
        if not account or account.deletedAt:
            raise ValueError("Mail account not found")

        # Decrypt account password
        password = envelope_encryption_service.decrypt_credentials_triplet(
            ciphertext_b64=account.encryptedPassword,
            dek_wrapped_b64=account.dekWrapped,
            iv_b64=account.dekNonce,
            account_id=account.accountId,
            email=account.emailAddress,
        )

        # Resolve and authorise the thread *before* any bytes leave the server.
        # Without this an admin with send rights on account A could append a
        # message to a thread owned by account B (cross-tenant write).
        thread = None
        if data.thread_id:
            thread = await prisma.mailthread.find_unique(
                where={"threadId": data.thread_id}
            )
            if not thread:
                raise ValueError("errors.mail.thread_not_found")
            if thread.mailAccountId != account.id:
                raise ValueError("errors.mail.thread_not_owned")

        # Build RFC 5322 MIME message
        msg = EmailMessage()
        domain = account.emailAddress.split("@")[-1]
        internet_msg_id = make_msgid(domain=domain)

        clean_subject = data.subject.replace("\r", " ").replace("\n", " ").strip()
        clean_display_name = (
            account.displayName.replace("\r", "").replace("\n", "").strip()
        )

        msg["Subject"] = clean_subject
        msg["From"] = f"{clean_display_name} <{account.emailAddress}>"
        msg["To"] = ", ".join(data.to_addresses)
        if data.cc_addresses:
            msg["Cc"] = ", ".join(data.cc_addresses)
        if data.bcc_addresses:
            msg["Bcc"] = ", ".join(data.bcc_addresses)
        msg["Message-ID"] = internet_msg_id
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["MIME-Version"] = "1.0"
        msg["User-Agent"] = "Podacium Mail Suite/1.0 (https://podacium.com)"
        msg["X-Mailer"] = "Podacium Corporate Webmail Client/1.0"

        if data.in_reply_to:
            clean_in_reply_to = (
                data.in_reply_to.replace("\r", "").replace("\n", "").strip()
            )
            msg["In-Reply-To"] = clean_in_reply_to
        if data.references:
            clean_references = [
                r.replace("\r", "").replace("\n", "").strip() for r in data.references
            ]
            msg["References"] = " ".join(clean_references)

        # Set body
        text_content = data.body_text or (
            html_to_plain_text(data.body_html) if data.body_html else ""
        )
        msg.set_content(text_content)

        if data.body_html:
            # If signature exists on account and not in html, append signature
            full_html = data.body_html
            if account.signatureHtml and account.signatureHtml not in full_html:
                full_html = f"{full_html}<br/><br/>{account.signatureHtml}"
            msg.add_alternative(full_html, subtype="html")

        # Attachments if provided. Every attachment must belong to this mailbox:
        # attachment ids are opaque UUIDs and must never be usable as a
        # cross-account exfiltration primitive.
        attachments_records = []
        if data.attachment_ids:
            driver = storage_manager.get_driver("attachments")
            for att_id in data.attachment_ids:
                att = await prisma.mailattachment.find_unique(
                    where={"attachmentId": att_id},
                    include={"mailMessage": True},
                )
                if not att:
                    raise ValueError("errors.mail.attachment_not_found")

                owner_account_id = att.mailAccountId or (
                    att.mailMessage.mailAccountId if att.mailMessage else None
                )
                if owner_account_id != account.id:
                    raise ValueError("errors.mail.attachment_not_owned")
                if (
                    att.mailMessageId is not None
                    and att.mailMessage is not None
                    and not att.mailMessage.isDraft
                ):
                    raise ValueError("errors.mail.attachment_already_sent")

                content = await driver.read_file_bytes(att.storagePath)
                if not content:
                    raise ValueError("errors.mail.attachment_content_missing")
                if (
                    att.sha256Checksum
                    and hashlib.sha256(content).hexdigest() != att.sha256Checksum
                ):
                    logger.error(
                        "Attachment checksum mismatch for %s (%s)",
                        att_id,
                        att.storagePath,
                    )
                    raise ValueError("errors.mail.attachment_checksum_mismatch")

                maintype, subtype = (
                    att.mimeType.split("/", 1)
                    if "/" in att.mimeType
                    else ("application", "octet-stream")
                )
                msg.add_attachment(
                    content,
                    maintype=maintype,
                    subtype=subtype,
                    filename=att.fileName,
                )
                attachments_records.append(att)

        raw_bytes = msg.as_bytes()

        # Execute SMTP send + IMAP Sent append in thread
        sent_ok = await asyncio.to_thread(
            self._send_smtp_and_append_sent,
            account.smtpHost,
            account.smtpPort,
            bool(account.smtpUseSsl),
            account.emailAddress,
            password,
            msg,
            account.imapHost,
            account.imapPort,
            bool(account.imapUseSsl),
            raw_bytes,
        )

        if not sent_ok:
            raise ValueError("errors.mail.smtp_send_failed")

        # Find or create thread
        if not thread:
            thread = await prisma.mailthread.create(
                data={
                    "threadId": str(uuid.uuid4()),
                    "mailAccountId": account.id,
                    "subject": data.subject,
                    "snippet": text_content[:200].replace("\n", " "),
                    "lastMessageAt": datetime.now(timezone.utc),
                    "messageCount": 1,
                    "hasAttachments": len(attachments_records) > 0,
                    "isUnread": False,
                }
            )
        else:
            await prisma.mailthread.update(
                where={"id": thread.id},
                data={
                    "snippet": text_content[:200].replace("\n", " "),
                    "lastMessageAt": datetime.now(timezone.utc),
                    "messageCount": {"increment": 1},
                    "hasAttachments": thread.hasAttachments
                    or len(attachments_records) > 0,
                },
            )

        # Find the Sent mailbox. Never fall back to an arbitrary mailbox id:
        # doing so filed messages into another tenant's mailbox.
        sent_mailbox = await prisma.mailbox.find_first(
            where={"mailAccountId": account.id, "type": p_enums.MailboxType.SENT}
        )
        if not sent_mailbox:
            sent_mailbox = await prisma.mailbox.create(
                data={
                    "mailboxId": str(uuid.uuid4()),
                    "mailAccountId": account.id,
                    "name": "Sent",
                    "remoteName": "Sent",
                    "type": p_enums.MailboxType.SENT,
                }
            )

        # Record message in database
        message_record = await prisma.mailmessage.create(
            data={
                "messageId": str(uuid.uuid4()),
                "internetMessageId": internet_msg_id,
                "inReplyTo": data.in_reply_to,
                "references": data.references,
                "mailAccountId": account.id,
                "mailboxId": sent_mailbox.id,
                "threadId": thread.id,
                "fromAddress": account.emailAddress,
                "fromName": account.displayName,
                "toAddresses": [str(a) for a in data.to_addresses],
                "ccAddresses": [str(a) for a in data.cc_addresses],
                "bccAddresses": [str(a) for a in data.bcc_addresses],
                "subject": data.subject,
                "snippet": text_content[:200],
                "bodyText": text_content,
                "bodyHtml": data.body_html,
                "status": p_enums.MailMessageStatus.SENT,
                "priority": getattr(p_enums.MailPriority, data.priority.value),
                "isRead": True,
                "isDraft": False,
                "hasAttachments": len(attachments_records) > 0,
                "sentAt": datetime.now(timezone.utc),
            }
        )

        # Re-parent the uploaded draft attachments onto the sent message so they
        # are no longer ownerless and cannot be reused by another send.
        for att in attachments_records:
            try:
                await prisma.mailattachment.update(
                    where={"id": att.id},
                    data={
                        "mailMessageId": message_record.id,
                        "mailAccountId": account.id,
                    },
                )
            except Exception as att_exc:
                logger.warning(
                    "Could not link attachment %s to message %s: %s",
                    att.attachmentId,
                    message_record.messageId,
                    att_exc,
                )

        # Audit log
        await self._create_audit_log(
            thread_id=thread.threadId,
            message_id=message_record.messageId,
            actor_id=current_admin_id,
            action="SEND_EMAIL",
            client_ip=client_ip,
            user_agent=user_agent,
            details={
                "to": [str(a) for a in data.to_addresses],
                "subject": data.subject,
            },
        )

        return self._format_message_record(message_record, attachments_records)

    @staticmethod
    def _discover_sent_folder(imap_client: imaplib.IMAP4) -> str:
        """Finds the server's Sent folder via the \\Sent flag or common names."""
        try:
            _typ, folders = imap_client.list()
        except Exception:
            return "Sent"
        for raw in folders or []:
            if not isinstance(raw, (bytes, bytearray)):
                continue
            match = re.match(
                rb'\((?P<flags>[^)]*)\)\s+"(?P<delim>[^"]*)"\s+(?P<name>.+)$',
                bytes(raw).strip(),
            )
            if not match:
                continue
            # IMAP mailbox names are modified UTF-7, which is ASCII-safe.
            name = match.group("name").decode("ascii", errors="replace").strip()
            if name.startswith('"') and name.endswith('"'):
                name = name[1:-1]
            flags = match.group("flags").decode("ascii", errors="ignore")
            if "\\Sent" in flags or name.strip().lower() in {
                "sent",
                "sent items",
                "sent messages",
                "sent mail",
            }:
                return name
        return "Sent"

    def _send_smtp_and_append_sent(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_use_ssl: bool,
        username: str,
        password: str,
        msg: EmailMessage,
        imap_host: str,
        imap_port: int,
        imap_use_ssl: bool,
        raw_bytes: bytes,
    ) -> bool:
        """Delivers via SMTP (implicit TLS or STARTTLS) and appends to IMAP Sent.

        ``smtplib.send_message`` strips ``Bcc``/``Resent-Bcc`` from the
        transmitted copy, while ``raw_bytes`` retains them for the Sent folder
        copy (matching the behaviour of mainstream mail clients).
        """
        # 1. SMTP dispatch
        server: Any
        try:
            if smtp_use_ssl or smtp_port == 465:
                server = smtplib.SMTP_SSL(
                    smtp_host,
                    smtp_port,
                    timeout=30,
                    context=ssl.create_default_context(),
                )
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            try:
                server.login(username, password)
                server.send_message(msg)
            finally:
                try:
                    server.quit()
                except Exception:
                    pass
        except Exception as e:
            simulate = os.getenv("MAIL_DEV_SIMULATE", "false").lower() in {
                "1",
                "true",
                "yes",
            }
            if (
                getattr(setting, "ENVIRONMENT", "development") != "production"
                and simulate
            ):
                logger.warning(
                    "⚠️ [MAIL_DEV_SIMULATE] SMTP delivery failed (%s); "
                    "simulating success. Never enable this in production.",
                    e,
                )
            else:
                logger.error(f"SMTP delivery failed for '{username}': {e}")
                raise ValueError(
                    f"Failed to reach SMTP server ({smtp_host}:{smtp_port}): {e}"
                )

        # 2. IMAP append to Sent
        imap_client: Any
        try:
            if imap_use_ssl:
                imap_client = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=20)
            else:
                imap_client = imaplib.IMAP4(imap_host, imap_port, timeout=20)
                try:
                    imap_client.starttls(ssl_context=ssl.create_default_context())
                except Exception:
                    logger.debug("IMAP server did not offer STARTTLS")
            imap_client.login(username, password)
            sent_folder_name = self._discover_sent_folder(imap_client)
            imap_client.append(
                sent_folder_name,
                "\\Seen",
                imaplib.Time2Internaldate(datetime.now(timezone.utc)),
                raw_bytes,
            )
            try:
                imap_client.logout()
            except Exception:
                pass
        except Exception as imap_exc:
            logger.warning(
                f"Could not append sent message to IMAP Sent folder using "
                f"'{username}': {imap_exc}"
            )

        return True

    @staticmethod
    def _delete_remote_messages_sync(
        imap_host: str,
        imap_port: int,
        imap_use_ssl: bool,
        username: str,
        password: str,
        internet_message_ids: List[str],
    ) -> int:
        """Deletes messages from the IMAP server by Message-ID.

        Messages are moved between local mailboxes without touching the remote
        server, so the original folder is unknown at purge time. We therefore
        search the folders that can hold a message after local triage.
        """
        ids = [mid for mid in internet_message_ids if mid]
        if not ids:
            return 0

        if imap_use_ssl:
            client: Any = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=20)
        else:
            client = imaplib.IMAP4(imap_host, imap_port, timeout=20)
            try:
                client.starttls(ssl_context=ssl.create_default_context())
            except Exception:
                pass

        deleted = 0
        try:
            client.login(username, password)
            _typ, folders = client.list()
            candidates: List[str] = []
            for raw in folders or []:
                if not isinstance(raw, (bytes, bytearray)):
                    continue
                match = re.match(
                    rb'\((?P<flags>[^)]*)\)\s+"(?P<delim>[^"]*)"\s+(?P<name>.+)$',
                    bytes(raw).strip(),
                )
                if not match:
                    continue
                flags = match.group("flags").decode("ascii", errors="ignore")
                name = match.group("name").decode("ascii", errors="replace").strip()
                if name.startswith('"') and name.endswith('"'):
                    name = name[1:-1]
                if "\\Noselect" in flags:
                    continue
                candidates.append(name)

            # Prefer the folders a triaged message can live in.
            preferred = ["INBOX", "Trash", "Archive", "Sent", "Junk", "Spam"]
            ordered = [f for f in preferred if f in candidates] + [
                f for f in candidates if f not in preferred
            ]
            remote_errors: List[str] = []

            for folder in ordered:
                try:
                    typ, _ = client.select(folder, readonly=False)
                    if typ != "OK":
                        continue
                except Exception:
                    continue

                for mid in ids:
                    try:
                        typ, data = client.search(
                            None, "HEADER", "Message-ID", f'"{mid}"'
                        )
                    except Exception as exc:
                        remote_errors.append(f"search {folder}/{mid}: {exc}")
                        continue
                    if typ != "OK":
                        remote_errors.append(f"search {folder}/{mid}: {typ}")
                        continue
                    if not data or not data[0]:
                        continue
                    for uid in data[0].split():
                        try:
                            typ, _ = client.store(uid, "+FLAGS", "\\Deleted")
                            if typ != "OK":
                                remote_errors.append(
                                    f"store {folder}/{uid.decode(errors='replace')}: {typ}"
                                )
                            else:
                                deleted += 1
                        except Exception as exc:
                            remote_errors.append(f"store {folder}/{uid}: {exc}")
                try:
                    typ, _ = client.expunge()
                    if typ != "OK":
                        remote_errors.append(f"expunge {folder}: {typ}")
                except Exception as exc:
                    remote_errors.append(f"expunge {folder}: {exc}")

            if remote_errors:
                # Never purge locally when the server rejected part of the
                # deletion: the next sync would resurrect those messages.
                raise RuntimeError("; ".join(remote_errors[:3]))
        finally:
            try:
                client.logout()
            except Exception:
                pass

        return deleted

    # -------------------------------------------------------------------------
    # Thread & Message Retrieval
    # -------------------------------------------------------------------------

    async def list_threads(
        self,
        account_id: str,
        mailbox_type: Optional[str] = None,
        query: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
    ) -> PaginatedThreadsResponse:
        """Lists paginated threads for an account/mailbox."""
        account = await prisma.mailaccount.find_unique(where={"accountId": account_id})
        if not account:
            return PaginatedThreadsResponse(
                threads=[], total=0, page=page, limit=limit, has_more=False
            )

        where_clause: Dict[str, Any] = {"mailAccountId": account.id}

        if mailbox_type:
            mb_enum = getattr(p_enums.MailboxType, mailbox_type.upper(), None)
            if mb_enum == p_enums.MailboxType.STARRED:
                where_clause["isStarred"] = True
            elif mb_enum:
                # Filter by threads that have messages in this mailbox
                where_clause["messages"] = {"some": {"mailbox": {"type": mb_enum}}}

        if query:
            clean_query = query.strip()
            escaped_query = (
                clean_query.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            where_clause["OR"] = [
                {"subject": {"contains": escaped_query, "mode": "insensitive"}},
                {"snippet": {"contains": escaped_query, "mode": "insensitive"}},
            ]

        skip = (page - 1) * limit
        total = await prisma.mailthread.count(where=where_clause)
        threads = await prisma.mailthread.find_many(
            where=where_clause,
            include={
                "messages": {
                    "include": {"attachments": True},
                },
                "contract": True,
                "dispute": True,
                "ticket": True,
                "invoice": True,
            },
            order={"lastMessageAt": "desc"},
            skip=skip,
            take=limit,
        )

        # List view must not ship full HTML bodies/attachments for every
        # message in 50 threads; the detail endpoint provides those.
        formatted_threads = [
            self._format_thread_record(t, include_bodies=False) for t in threads
        ]
        return PaginatedThreadsResponse(
            threads=formatted_threads,
            total=total,
            page=page,
            limit=limit,
            has_more=(skip + len(threads)) < total,
        )

    async def get_thread_detail(
        self,
        thread_id: str,
        current_admin_id: int,
        client_ip: str = "127.0.0.1",
        user_agent: str = "Podacium-Webmail",
    ) -> Optional[MailThreadResponse]:
        """Retrieves a full thread with messages, marks unread messages as read, and audit logs."""
        thread = await prisma.mailthread.find_unique(
            where={"threadId": thread_id},
            include={
                "messages": {
                    "include": {"attachments": True},
                },
                "contract": True,
                "dispute": True,
                "ticket": True,
                "invoice": True,
            },
        )
        if not thread:
            return None

        # Mark messages and thread as read
        was_unread = bool(thread.isUnread)
        if was_unread:
            await prisma.mailthread.update(
                where={"id": thread.id},
                data={"isUnread": False},
            )
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id, "isRead": False},
                data={"isRead": True},
            )
            # Re-read so the response reflects the new state instead of the
            # stale pre-update object (which reported is_unread=true).
            refreshed = await prisma.mailthread.find_unique(
                where={"threadId": thread_id},
                include={
                    "messages": {"include": {"attachments": True}},
                    "contract": True,
                    "dispute": True,
                    "ticket": True,
                    "invoice": True,
                },
            )
            if refreshed:
                thread = refreshed

        # Audit the first open only: logging every polled GET amplified the
        # audit table without adding signal.
        if was_unread:
            await self._create_audit_log(
                thread_id=thread.threadId,
                actor_id=current_admin_id,
                action="READ_THREAD",
                client_ip=client_ip,
                user_agent=user_agent,
                details={"subject": thread.subject},
            )

        return self._format_thread_record(thread)

    async def execute_thread_action(
        self,
        thread_id: str,
        action_req: ThreadActionRequest,
        current_admin_id: int,
        client_ip: str = "127.0.0.1",
    ) -> bool:
        """Executes thread actions (mark_read, mark_unread, star, trash, archive)."""
        thread = await prisma.mailthread.find_unique(where={"threadId": thread_id})
        if not thread:
            return False

        # Canonicalise the action vocabulary. The UI historically sent
        # ``read``/``unread``/``inbox`` and the backend silently no-oped them.
        aliases = {
            "read": "mark_read",
            "unread": "mark_unread",
            "inbox": "restore",
            "delete": "trash",
            "delete_permanently": "purge",
        }
        action = aliases.get(
            action_req.action.strip().lower(), action_req.action.strip().lower()
        )
        allowed = {
            "mark_read",
            "mark_unread",
            "star",
            "unstar",
            "trash",
            "archive",
            "restore",
            "spam",
            "purge",
        }
        if action not in allowed:
            raise ValueError("errors.mail.unknown_action")

        if action == "mark_read":
            await prisma.mailthread.update(
                where={"id": thread.id}, data={"isUnread": False}
            )
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id}, data={"isRead": True}
            )
        elif action == "mark_unread":
            await prisma.mailthread.update(
                where={"id": thread.id}, data={"isUnread": True}
            )
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id}, data={"isRead": False}
            )
        elif action == "star":
            await prisma.mailthread.update(
                where={"id": thread.id}, data={"isStarred": True}
            )
        elif action == "unstar":
            await prisma.mailthread.update(
                where={"id": thread.id}, data={"isStarred": False}
            )
        elif action == "trash":
            # Move messages to TRASH mailbox
            trash_mb = await prisma.mailbox.find_first(
                where={
                    "mailAccountId": thread.mailAccountId,
                    "type": p_enums.MailboxType.TRASH,
                }
            )
            if not trash_mb:
                raise ValueError("errors.mail.mailbox_not_found")
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id},
                data={"mailboxId": trash_mb.id},
            )
        elif action == "archive":
            archive_mb = await prisma.mailbox.find_first(
                where={
                    "mailAccountId": thread.mailAccountId,
                    "type": p_enums.MailboxType.ARCHIVE,
                }
            )
            if not archive_mb:
                raise ValueError("errors.mail.mailbox_not_found")
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id},
                data={"mailboxId": archive_mb.id},
            )
        elif action == "restore":
            # Move messages back to INBOX mailbox
            inbox_mb = await prisma.mailbox.find_first(
                where={
                    "mailAccountId": thread.mailAccountId,
                    "type": p_enums.MailboxType.INBOX,
                }
            )
            if not inbox_mb:
                raise ValueError("errors.mail.mailbox_not_found")
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id},
                data={"mailboxId": inbox_mb.id},
            )
        elif action == "spam":
            spam_mb = await prisma.mailbox.find_first(
                where={
                    "mailAccountId": thread.mailAccountId,
                    "type": p_enums.MailboxType.SPAM,
                }
            )
            if not spam_mb:
                raise ValueError("errors.mail.mailbox_not_found")
            await prisma.mailmessage.update_many(
                where={"threadId": thread.id},
                data={"mailboxId": spam_mb.id},
            )
        elif action == "purge":
            await self._purge_thread_internal(thread)
            await self._create_audit_log(
                thread_id=thread.threadId,
                actor_id=current_admin_id,
                action="THREAD_PURGE",
                client_ip=client_ip,
                details={"action": "purge"},
            )
            return True

        await self._create_audit_log(
            thread_id=thread.threadId,
            actor_id=current_admin_id,
            action=f"THREAD_{action.upper()}",
            client_ip=client_ip,
            details={"action": action},
        )
        return True

    async def _delete_remote_for_account(
        self, account: Any, messages: List[Any]
    ) -> int:
        """Deletes the given messages from the IMAP server before local removal.

        Purging only the local rows would let the next sync resurrect the mail,
        because IMAP still holds it.
        """
        # A message that came from IMAP must be addressable there; otherwise the
        # next sync would recreate it after we deleted the local row.
        if any(
            not m.internetMessageId and not getattr(m, "isDraft", False)
            for m in messages
        ):
            raise ValueError("errors.mail.remote_delete_failed")
        ids = [m.internetMessageId for m in messages if m.internetMessageId]
        if not ids:
            return 0
        if getattr(account, "deletedAt", None):
            logger.warning(
                "Skipping remote delete for deleted account %s", account.accountId
            )
            return 0

        try:
            password = envelope_encryption_service.decrypt_credentials_triplet(
                ciphertext_b64=account.encryptedPassword,
                dek_wrapped_b64=account.dekWrapped,
                iv_b64=account.dekNonce,
                account_id=account.accountId,
                email=account.emailAddress,
            )
        except Exception as exc:
            raise ValueError("errors.mail.credentials_unavailable") from exc

        try:
            return await asyncio.to_thread(
                self._delete_remote_messages_sync,
                account.imapHost,
                account.imapPort,
                bool(account.imapUseSsl),
                account.emailAddress,
                password,
                ids,
            )
        except Exception as exc:
            logger.error(
                "Remote IMAP delete failed for account %s: %s",
                account.accountId,
                exc,
            )
            raise ValueError("errors.mail.remote_delete_failed") from exc

    async def _purge_thread_internal(self, thread: Any) -> None:
        """Permanently purges a thread, its messages, and unlinks/removes attachments."""
        messages = await prisma.mailmessage.find_many(
            where={"threadId": thread.id},
            include={"attachments": True},
        )

        account = await prisma.mailaccount.find_unique(
            where={"id": thread.mailAccountId}
        )
        if account and messages:
            await self._delete_remote_for_account(account, messages)

        driver = storage_manager.get_driver("attachments")
        for msg in messages:
            for att in msg.attachments or []:
                if att.storagePath:
                    try:
                        await driver.delete_file(att.storagePath)
                    except Exception as e:
                        logger.warning(f"Could not delete attachment file: {e}")
                try:
                    await prisma.mailattachment.delete(where={"id": att.id})
                except Exception:
                    pass
        await prisma.mailmessage.delete_many(where={"threadId": thread.id})
        await prisma.mailthread.delete(where={"id": thread.id})

    async def empty_trash(
        self,
        account_id: str,
        current_admin_id: int,
        client_ip: str = "127.0.0.1",
    ) -> Dict[str, Any]:
        """Permanently purges all trashed messages and their threads for an account."""
        account = await prisma.mailaccount.find_unique(where={"accountId": account_id})
        if not account:
            raise ValueError("Account not found")

        trash_mb = await prisma.mailbox.find_first(
            where={
                "mailAccountId": account.id,
                "type": p_enums.MailboxType.TRASH,
            }
        )
        if not trash_mb:
            return {"purged_messages": 0, "purged_threads": 0}

        trashed_messages = await prisma.mailmessage.find_many(
            where={"mailboxId": trash_mb.id},
            include={"attachments": True},
        )
        if not trashed_messages:
            return {"purged_messages": 0, "purged_threads": 0}

        # Delete remotely first: if IMAP is unreachable, abort instead of
        # reporting success and letting the next sync restore the messages.
        await self._delete_remote_for_account(account, trashed_messages)

        thread_ids = set()
        driver = storage_manager.get_driver("attachments")
        for msg in trashed_messages:
            if msg.threadId:
                thread_ids.add(msg.threadId)
            for att in msg.attachments or []:
                if att.storagePath:
                    try:
                        await driver.delete_file(att.storagePath)
                    except Exception as e:
                        logger.warning(f"Could not delete attachment file: {e}")
                try:
                    await prisma.mailattachment.delete(where={"id": att.id})
                except Exception:
                    pass

        # Delete trashed messages
        await prisma.mailmessage.delete_many(where={"mailboxId": trash_mb.id})

        # Purge threads that now have zero remaining messages
        purged_threads = 0
        for tid in thread_ids:
            remaining = await prisma.mailmessage.count(where={"threadId": tid})
            if remaining == 0:
                await prisma.mailthread.delete(where={"id": tid})
                purged_threads += 1

        await self._create_audit_log(
            thread_id=account.accountId,
            actor_id=current_admin_id,
            action="EMPTY_TRASH",
            client_ip=client_ip,
            details={
                "purged_messages": len(trashed_messages),
                "purged_threads": purged_threads,
            },
        )
        return {
            "purged_messages": len(trashed_messages),
            "purged_threads": purged_threads,
        }

    async def link_crm_entity(
        self,
        thread_id: str,
        data: LinkCrmEntityRequest,
        current_admin_id: int,
    ) -> bool:
        """Explicitly links or updates CRM platform associations on a thread."""
        thread = await prisma.mailthread.find_unique(where={"threadId": thread_id})
        if not thread:
            return False

        # Validate the referenced entities exist; a bad id must be a 400, not a
        # raw FK 500, and must not leak another tenant's data via the drawer.
        entity_checks = (
            ("contract", data.contract_id),
            ("dispute", data.dispute_id),
            ("ticket", data.ticket_id),
            ("invoice", data.invoice_id),
            ("module", data.module_id),
        )
        for model_name, entity_id in entity_checks:
            if entity_id is None:
                continue
            model = getattr(prisma, model_name)
            found = await model.find_unique(where={"id": entity_id})
            if not found:
                raise ValueError("errors.mail.crm_entity_not_found")

        update_data: Dict[str, Any] = {}
        if data.contract_id is not None:
            update_data["contractId"] = data.contract_id
        if data.dispute_id is not None:
            update_data["disputeId"] = data.dispute_id
        if data.ticket_id is not None:
            update_data["ticketId"] = data.ticket_id
        if data.invoice_id is not None:
            update_data["invoiceId"] = data.invoice_id
        if data.module_id is not None:
            update_data["moduleId"] = data.module_id

        await prisma.mailthread.update(
            where={"id": thread.id},
            data=update_data,
        )
        return True

    # -------------------------------------------------------------------------
    # Formatters & Helpers
    # -------------------------------------------------------------------------

    def _format_thread_record(
        self, thread: Any, *, include_bodies: bool = True
    ) -> MailThreadResponse:
        crm = None
        if any([thread.contract, thread.dispute, thread.ticket, thread.invoice]):
            crm = CrmContextResponse(
                contract={
                    "id": thread.contract.id,
                    "title": getattr(thread.contract, "title", None)
                    or getattr(thread.contract, "terms", None)
                    or f"Contract #{thread.contract.id}",
                    "status": thread.contract.status,
                }
                if thread.contract
                else None,
                dispute={
                    "id": thread.dispute.id,
                    "reason": thread.dispute.reason,
                    "status": thread.dispute.status,
                }
                if thread.dispute
                else None,
                ticket={
                    "id": thread.ticket.id,
                    "subject": thread.ticket.subject,
                    "status": thread.ticket.status,
                }
                if thread.ticket
                else None,
                invoice={
                    "id": thread.invoice.id,
                    "invoiceNumber": thread.invoice.invoiceNumber,
                    "status": thread.invoice.status,
                }
                if thread.invoice
                else None,
            )

        sorted_messages = sorted(
            thread.messages or [],
            key=lambda m: getattr(m, "createdAt", None)
            or datetime.min.replace(tzinfo=timezone.utc),
        )
        messages_resp = [
            self._format_message_record(
                m,
                (m.attachments or []) if include_bodies else [],
                include_body=include_bodies,
            )
            for m in sorted_messages
        ]

        return MailThreadResponse(
            id=thread.id,
            thread_id=thread.threadId,
            subject=thread.subject,
            snippet=thread.snippet,
            last_message_at=thread.lastMessageAt,
            message_count=thread.messageCount,
            has_attachments=thread.hasAttachments,
            is_unread=thread.isUnread,
            is_starred=thread.isStarred,
            crm_context=crm,
            messages=messages_resp,
        )

    def _prepare_body_html_for_view(
        self, body_html: Optional[str], message_id: str
    ) -> Optional[str]:
        """
        Ensures body HTML is ready for viewer display:
        1. Ensures all /proxy/image URLs have a valid HMAC signature.
        2. Rewrites any un-rewritten cid: references to the message's CID endpoint.
        """
        if not body_html:
            return None

        content = body_html

        # 1. Resolve raw cid: references
        if "cid:" in content.lower():

            def replace_cid(match):
                raw_cid = unquote(match.group(1).strip("<>"))
                # A signed capability URL is required because <img> requests
                # cannot carry the admin's Authorization header.
                sig = generate_image_proxy_signature(f"cid:{raw_cid}@{message_id}")
                safe_cid = quote(raw_cid)
                return (
                    f'src="/api/v1/mail/messages/{message_id}/attachments/'
                    f'cid/{safe_cid}?sig={sig}"'
                )

            content = re.sub(
                r'src=["\']cid:([^"\']+)["\']',
                replace_cid,
                content,
                flags=re.IGNORECASE,
            )

        # 2. Ensure /proxy/image URLs have valid HMAC sig
        if "/api/v1/mail/proxy/image" in content:

            def sign_proxy_match(match):
                full_val = match.group(0)
                if "sig=" in full_val:
                    return full_val
                # Extract URL from ?url=...
                m_url = re.search(r"[?&]url=([^&\"'\s>]+)", full_val)
                if m_url:
                    raw_url = unquote(m_url.group(1))
                    sig = generate_image_proxy_signature(raw_url)
                    sep = "&" if "?" in full_val else "?"
                    return f"{full_val}{sep}sig={sig}"
                return full_val

            content = re.sub(
                r'/api/v1/mail/proxy/image\?[^"\'\s>]+', sign_proxy_match, content
            )

        return content

    def _format_message_record(
        self, msg: Any, attachments: List[Any], include_body: bool = True
    ) -> MailMessageResponse:
        att_resp = [
            MailAttachmentResponse(
                attachment_id=a.attachmentId,
                file_name=a.fileName,
                mime_type=a.mimeType,
                file_size_bytes=a.fileSizeBytes,
                content_id=a.contentId,
                scan_status=getattr(a, "scanStatus", "unknown"),
                download_url=f"/api/v1/mail/attachments/{a.attachmentId}/download",
            )
            for a in attachments
        ]

        return MailMessageResponse(
            id=msg.id,
            message_id=msg.messageId,
            internet_message_id=msg.internetMessageId,
            from_address=msg.fromAddress,
            from_name=msg.fromName,
            to_addresses=msg.toAddresses or [],
            cc_addresses=msg.ccAddresses or [],
            bcc_addresses=msg.bccAddresses or [],
            subject=msg.subject,
            snippet=msg.snippet,
            body_text=msg.bodyText if include_body else None,
            body_html=(
                self._prepare_body_html_for_view(msg.bodyHtml, msg.messageId)
                if include_body
                else None
            ),
            status=MailMessageStatusEnum(msg.status),
            priority=MailPriorityEnum(msg.priority),
            is_read=msg.isRead,
            is_starred=msg.isStarred,
            is_draft=msg.isDraft,
            has_attachments=msg.hasAttachments,
            received_at=msg.receivedAt,
            sent_at=msg.sentAt,
            created_at=msg.createdAt,
            attachments=att_resp,
        )

    async def _create_audit_log(
        self,
        thread_id: str,
        actor_id: int,
        action: str,
        client_ip: str,
        user_agent: Optional[str] = None,
        message_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Records a tamper-evident audit log for Law 25-11 and internal security compliance."""
        last_log = await prisma.emailauditlog.find_first(order={"id": "desc"})
        prev_hash = last_log.entryHash if last_log else "0" * 64
        now_iso = datetime.now(timezone.utc).isoformat()
        # Bind the details and message id into the hash as well: previously they
        # could be edited without breaking the "tamper-evident" chain.
        details_json = json.dumps(details or {}, sort_keys=True, separators=(",", ":"))
        payload_str = (
            f"{thread_id}|{actor_id}|{action}|{client_ip}|{now_iso}|{prev_hash}"
            f"|{message_id or ''}|{details_json}"
        )
        entry_hash = hmac.new(
            setting.SECRET_KEY.encode("utf-8"),
            payload_str.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        try:
            await prisma.emailauditlog.create(
                data={
                    "threadId": thread_id,
                    "messageId": message_id,
                    "actorId": actor_id,
                    "action": action,
                    "ipAddress": client_ip,
                    "userAgent": user_agent,
                    "details": Json(details or {}),
                    "previousHash": prev_hash,
                    "entryHash": entry_hash,
                }
            )
        except Exception as e:
            logger.warning(f"Could not persist email audit log: {e}")

    async def verify_audit_chain(self, limit: int = 5000) -> Dict[str, Any]:
        """Recomputes the HMAC chain and reports the first broken entry.

        Entries written before details/message-id were hashed are also accepted
        via their legacy payload shape, so the historical chain stays valid
        while every new entry is bound to its full content.
        """
        logs = await prisma.emailauditlog.find_many(order={"id": "asc"}, take=limit)
        prev = "0" * 64
        for index, entry in enumerate(logs, start=1):
            created = entry.createdAt
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            created_iso = created.isoformat()

            raw_details = entry.details
            if hasattr(raw_details, "data"):
                raw_details = raw_details.data
            details_json = json.dumps(
                raw_details or {}, sort_keys=True, separators=(",", ":")
            )

            payloads = (
                f"{entry.threadId}|{entry.actorId}|{entry.action}|"
                f"{entry.ipAddress}|{created_iso}|{prev}|"
                f"{entry.messageId or ''}|{details_json}",
                f"{entry.threadId}|{entry.actorId}|{entry.action}|"
                f"{entry.ipAddress}|{created_iso}|{prev}",
            )
            valid_hashes = {
                hmac.new(
                    setting.SECRET_KEY.encode("utf-8"),
                    payload.encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()
                for payload in payloads
            }
            if entry.previousHash != prev or entry.entryHash not in valid_hashes:
                return {
                    "valid": False,
                    "checked": index - 1,
                    "broken_at": entry.id,
                }
            prev = entry.entryHash
        return {"valid": True, "checked": len(logs)}


mail_suite_service = MailSuiteService()
