"""
Pydantic Schemas for Podacium Mail Suite.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class MailAccountTypeEnum(str, Enum):
    PERSONAL = "PERSONAL"
    DEPARTMENTAL = "DEPARTMENTAL"
    SHARED = "SHARED"


class MailAccountStatusEnum(str, Enum):
    ACTIVE = "ACTIVE"
    DISCONNECTED = "DISCONNECTED"
    AUTH_ERROR = "AUTH_ERROR"
    SYNCING = "SYNCING"
    DISABLED = "DISABLED"


class MailboxTypeEnum(str, Enum):
    INBOX = "INBOX"
    SENT = "SENT"
    DRAFTS = "DRAFTS"
    TRASH = "TRASH"
    SPAM = "SPAM"
    ARCHIVE = "ARCHIVE"
    STARRED = "STARRED"
    CUSTOM = "CUSTOM"


class MailMessageStatusEnum(str, Enum):
    RECEIVED = "RECEIVED"
    QUEUED = "QUEUED"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    DRAFT = "DRAFT"
    BOUNCED = "BOUNCED"


class MailPriorityEnum(str, Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


# -----------------------------------------------------------------------------
# Requests
# -----------------------------------------------------------------------------


class CreateMailAccountRequest(BaseModel):
    email_address: EmailStr
    display_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=1)
    account_type: MailAccountTypeEnum = MailAccountTypeEnum.PERSONAL
    imap_host: str = "imap.purelymail.com"
    imap_port: int = 993
    imap_use_ssl: bool = True
    smtp_host: str = "smtp.purelymail.com"
    smtp_port: int = 465
    smtp_use_ssl: bool = True
    signature_html: Optional[str] = None

    @field_validator("display_name")
    @classmethod
    def reject_crlf_display_name(cls, v: str) -> str:
        if v and any(c in v for c in ("\r", "\n", "\x00", "\u2028", "\u2029")):
            raise ValueError(
                "Display name contains illegal newline or control characters."
            )
        return v.strip()


class UpdateMailAccountRequest(BaseModel):
    display_name: Optional[str] = None
    signature_html: Optional[str] = None
    status: Optional[MailAccountStatusEnum] = None

    @field_validator("display_name")
    @classmethod
    def reject_crlf_display_name(cls, v: Optional[str]) -> Optional[str]:
        if v and any(c in v for c in ("\r", "\n", "\x00", "\u2028", "\u2029")):
            raise ValueError(
                "Display name contains illegal newline or control characters."
            )
        return v.strip() if v else None


class AssignAdminRequest(BaseModel):
    admin_profile_id: int
    can_read: bool = True
    can_send: bool = False
    can_manage: bool = False


class ComposeEmailRequest(BaseModel):
    account_id: str
    to_addresses: List[EmailStr] = Field(..., min_length=1, max_length=50)
    cc_addresses: List[EmailStr] = Field(default_factory=list, max_length=50)
    bcc_addresses: List[EmailStr] = Field(default_factory=list, max_length=50)
    subject: str = Field(..., min_length=1, max_length=500)
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: List[str] = Field(default_factory=list, max_length=50)
    thread_id: Optional[str] = None
    priority: MailPriorityEnum = MailPriorityEnum.NORMAL
    attachment_ids: List[str] = Field(default_factory=list, max_length=20)
    is_draft: bool = False

    @field_validator("subject", "in_reply_to")
    @classmethod
    def reject_crlf(cls, v: Optional[str]) -> Optional[str]:
        if v and any(c in v for c in ("\r", "\n", "\x00", "\u2028", "\u2029")):
            raise ValueError(
                "Header injection detected: carriage return and newline characters are disallowed."
            )
        return v

    @field_validator("references")
    @classmethod
    def reject_crlf_list(cls, v: List[str]) -> List[str]:
        for item in v:
            if item and any(
                c in item for c in ("\r", "\n", "\x00", "\u2028", "\u2029")
            ):
                raise ValueError(
                    "Header injection detected in references: carriage return and newline characters are disallowed."
                )
        return v


class ThreadActionRequest(BaseModel):
    action: str = Field(
        ...,
        description=(
            "One of: mark_read (alias read), mark_unread (alias unread), "
            "star, unstar, archive, trash (alias delete), spam, restore "
            "(alias inbox), purge (alias delete_permanently)"
        ),
    )
    target_mailbox_id: Optional[str] = None


class LinkCrmEntityRequest(BaseModel):
    ticket_id: Optional[int] = None
    contract_id: Optional[int] = None
    dispute_id: Optional[int] = None
    invoice_id: Optional[int] = None
    module_id: Optional[str] = None


class PresenceHeartbeatRequest(BaseModel):
    thread_id: str
    status: str = Field("viewing", description="'viewing' or 'drafting'")


# -----------------------------------------------------------------------------
# Responses
# -----------------------------------------------------------------------------


class MailAttachmentResponse(BaseModel):
    attachment_id: str
    file_name: str
    mime_type: str
    file_size_bytes: int
    content_id: Optional[str] = None
    scan_status: str = "unknown"
    download_url: str


class MailMessageResponse(BaseModel):
    id: int
    message_id: str
    internet_message_id: Optional[str] = None
    from_address: str
    from_name: Optional[str] = None
    to_addresses: List[str]
    cc_addresses: List[str] = Field(default_factory=list)
    bcc_addresses: List[str] = Field(default_factory=list)
    subject: str
    snippet: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    status: MailMessageStatusEnum
    priority: MailPriorityEnum
    is_read: bool
    is_starred: bool
    is_draft: bool
    has_attachments: bool
    received_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    attachments: List[MailAttachmentResponse] = Field(default_factory=list)


class CrmContextResponse(BaseModel):
    user: Optional[Dict[str, Any]] = None
    contract: Optional[Dict[str, Any]] = None
    dispute: Optional[Dict[str, Any]] = None
    ticket: Optional[Dict[str, Any]] = None
    invoice: Optional[Dict[str, Any]] = None


class MailboxResponse(BaseModel):
    id: int
    mailbox_id: str
    name: str
    remote_name: str
    type: MailboxTypeEnum
    unread_count: int
    total_count: int


class MailThreadResponse(BaseModel):
    id: int
    thread_id: str
    subject: str
    snippet: Optional[str] = None
    last_message_at: datetime
    message_count: int
    has_attachments: bool
    is_unread: bool
    is_starred: bool
    crm_context: Optional[CrmContextResponse] = None
    messages: List[MailMessageResponse] = Field(default_factory=list)


class MailAccountResponse(BaseModel):
    id: int
    account_id: str
    email_address: str
    display_name: str
    type: MailAccountTypeEnum
    status: MailAccountStatusEnum
    quota_bytes: Optional[int] = None
    used_bytes: Optional[int] = None
    signature_html: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    last_sync_error: Optional[str] = None
    mailboxes: List[MailboxResponse] = Field(default_factory=list)


class PaginatedThreadsResponse(BaseModel):
    threads: List[MailThreadResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class ThreadPresenceUser(BaseModel):
    admin_id: int
    admin_name: str
    admin_email: str
    status: str
    updated_at: datetime


class ThreadPresenceResponse(BaseModel):
    thread_id: str
    active_admins: List[ThreadPresenceUser]
