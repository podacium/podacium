"""
Pydantic Schemas for Virtual Data Room (VDR) & Dynamic Document Watermarking (Pillar 3 & 10).
Carta, SecureDocs, and Datasite-compliant tiered permissions, clickwrap NDA lifecycle,
and forensic watermarking telemetry.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class VDRDocumentTier(str, Enum):
    TIER_1_PUBLIC_TEASER = "TIER_1_PUBLIC_TEASER"
    TIER_2_NDA_FINANCIALS = "TIER_2_NDA_FINANCIALS"
    TIER_3_CONFIRMATORY_CAPTABLE = "TIER_3_CONFIRMATORY_CAPTABLE"


class VDRDocumentCategory(str, Enum):
    TEASER = "TEASER"
    FINANCIALS_G50 = "FINANCIALS_G50"
    CAP_TABLE_ESOP = "CAP_TABLE_ESOP"
    LEGAL_CONTRACTS = "LEGAL_CONTRACTS"
    INTELLECTUAL_PROPERTY = "INTELLECTUAL_PROPERTY"
    GOVERNANCE_MINUTES = "GOVERNANCE_MINUTES"
    TAX_COMPLIANCE = "TAX_COMPLIANCE"


class VDRAccessStatus(str, Enum):
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class AuditLogAction(str, Enum):
    VIEW = "VIEW"
    DOWNLOAD_ATTEMPT = "DOWNLOAD_ATTEMPT"
    EXPORT = "EXPORT"
    PRINT_ATTEMPT = "PRINT_ATTEMPT"
    NDA_SIGNED = "NDA_SIGNED"
    ACCESS_REQUESTED = "ACCESS_REQUESTED"
    ACCESS_APPROVED = "ACCESS_APPROVED"
    ACCESS_REJECTED = "ACCESS_REJECTED"
    ACCESS_REVOKED = "ACCESS_REVOKED"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"


class ClickwrapNDAAgreement(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    accepted: bool = True
    ip_address: str
    user_agent: str
    signed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    legal_disclaimer: str
    nda_hash: str


class VDRDocument(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    startup_id: str
    title: str
    category: VDRDocumentCategory
    tier: VDRDocumentTier
    file_url: str
    file_size_bytes: int
    mime_type: str = "application/pdf"
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: Optional[str] = None
    content_hash: str
    encrypted: bool = True
    page_count: int = 1


class VDRDocumentCreateRequest(BaseModel):
    title: str
    category: VDRDocumentCategory
    tier: VDRDocumentTier
    file_url: str
    file_size_bytes: int
    mime_type: str = "application/pdf"
    description: Optional[str] = None
    content_hash: Optional[str] = None
    page_count: int = 1


class VDRDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document: VDRDocument
    is_accessible: bool
    required_tier: VDRDocumentTier
    user_highest_tier: Optional[VDRDocumentTier] = None


class VDRAccessApplyRequest(BaseModel):
    requested_tier: VDRDocumentTier
    user_email: str
    organization_name: Optional[str] = None
    intended_use: Optional[str] = None
    accept_nda: bool = True


class VDRAccessReviewRequest(BaseModel):
    status: VDRAccessStatus  # APPROVED or REJECTED
    granted_tier: Optional[VDRDocumentTier] = None
    rejection_reason: Optional[str] = None
    validity_days: int = 90


class VDRAccessRevokeRequest(BaseModel):
    reason: Optional[str] = "Revoked by startup founder"


class VDRAccessRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    startup_id: str
    user_id: str
    user_email: str
    organization_name: Optional[str] = None
    intended_use: Optional[str] = None
    requested_tier: VDRDocumentTier
    granted_tier: Optional[VDRDocumentTier] = None
    status: VDRAccessStatus
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    revoked_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    nda_agreement: Optional[ClickwrapNDAAgreement] = None


class WatermarkOverlay(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    watermark_text: str
    viewer_email: str
    viewer_ip: str
    timestamp_iso: str
    token_hash: str
    confidentiality_notice: str
    svg_overlay: str
    css_text_watermark: str


class VDRWatermarkedDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document: VDRDocument
    watermark: WatermarkOverlay
    secure_access_token: str
    access_expires_at: datetime


class VDRLogViewRequest(BaseModel):
    action: AuditLogAction = AuditLogAction.VIEW
    view_duration_seconds: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VDRAuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    startup_id: str
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    user_id: str
    user_email: str
    action: AuditLogAction
    view_duration_seconds: int
    ip_address: str
    user_agent: str
    watermark_token: Optional[str] = None
    timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VDRAnalyticsSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    startup_id: str
    total_documents: int
    total_storage_bytes: int
    total_views: int
    total_download_attempts: int
    unique_viewers: int
    average_view_duration_seconds: float
    top_viewed_documents: List[Dict[str, Any]]
    recent_activities: List[VDRAuditLogResponse]
