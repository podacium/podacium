"""
TamWheel Virtual Data Room (VDR) & Dynamic Document Watermarking Engine (Pillars 3 & 10).
Conforms to Carta, SecureDocs, and Datasite standards for multi-tiered confidentiality,
dynamic forensic watermarking, clickwrap NDA enforcement, and granular access audit trails.
"""

from collections import defaultdict
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import logging
import uuid
from typing import Dict, List, Optional, Tuple, Any

from app.schemas.vdr import (
    VDRDocument,
    VDRDocumentCreateRequest,
    VDRDocumentTier,
    VDRDocumentCategory,
    VDRAccessStatus,
    AuditLogAction,
    ClickwrapNDAAgreement,
    VDRAccessApplyRequest,
    VDRAccessReviewRequest,
    VDRAccessRequestResponse,
    WatermarkOverlay,
    VDRWatermarkedDocumentResponse,
    VDRDocumentResponse,
    VDRAuditLogResponse,
    VDRAnalyticsSummaryResponse,
)

logger = logging.getLogger(__name__)

# Standard Algerian clickwrap NDA template citing statutory protections
ALGERIAN_VDR_NDA_TEMPLATE = (
    "ENGAGEMENT DE CONFIDENTIALITÉ ET D'USAGE EXCLUSIF (ACCORD CLICKWRAP)\n"
    "Conformément à la Loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques "
    "dans le traitement des données à caractère personnel, à l'article 301 du Code Pénal algérien relatif "
    "au secret professionnel, et aux obligations de loyauté contractuelle (Article 106 du Code Civil algérien), "
    "le consultant/investisseur soussigné reconnaît et accepte expressément que:\n"
    "1. L'ensemble des documents financiers (déclarations G50, bilans comptables), données de cap table, "
    "plans d'affaires et contrats légaux mis à disposition dans la présente Virtual Data Room constituent "
    "des secrets d'affaires protégés et la propriété exclusive de la société émettrice.\n"
    "2. Toute copie, extraction, capture d'écran, diffusion, rétro-ingénierie ou transmission à des tiers "
    "sans l'accord écrit préalable du gérant/fondateur est strictement prohibée et engage la responsabilité "
    "civile et pénale du contrevenant.\n"
    "3. Chaque accès et visualisation fait l'objet d'un marquage forensique dynamique (filigrane nominatif "
    "et horodaté avec adresse IP traçable)."
)

WATERMARK_SECRET_KEY = b"tamwheel-sovereign-vdr-watermark-key-2026"


class VirtualDataRoomEngine:
    """
    Core Virtual Data Room engine supporting 3-tier document gating,
    cryptographic forensic watermarking, and immutable audit logs.
    """

    def __init__(self):
        # startup_id -> {document_id -> VDRDocument}
        self._documents: Dict[str, Dict[str, VDRDocument]] = defaultdict(dict)
        # startup_id -> {request_id -> VDRAccessRequestResponse}
        self._access_requests: Dict[str, Dict[str, VDRAccessRequestResponse]] = defaultdict(dict)
        # startup_id -> {user_id -> VDRAccessRequestResponse} (active grants)
        self._user_grants: Dict[str, Dict[str, VDRAccessRequestResponse]] = defaultdict(dict)
        # startup_id -> List[VDRAuditLogResponse]
        self._audit_logs: Dict[str, List[VDRAuditLogResponse]] = defaultdict(list)

    def _tier_rank(self, tier: VDRDocumentTier) -> int:
        ranks = {
            VDRDocumentTier.TIER_1_PUBLIC_TEASER: 1,
            VDRDocumentTier.TIER_2_NDA_FINANCIALS: 2,
            VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE: 3,
        }
        return ranks.get(tier, 1)

    def upload_document(
        self,
        startup_id: str,
        req: VDRDocumentCreateRequest,
        uploader_id: str = "founder",
        uploader_email: str = "founder@startup.dz",
        client_ip: str = "127.0.0.1",
        user_agent: str = "TamWheel-VDR/1.0",
    ) -> VDRDocument:
        """Upload and register a new document in the VDR under a designated security tier."""
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"
        
        # Calculate content hash if not provided
        if not req.content_hash:
            payload = f"{startup_id}:{doc_id}:{req.title}:{req.file_url}".encode("utf-8")
            content_hash = hashlib.sha256(payload).hexdigest()
        else:
            content_hash = req.content_hash

        doc = VDRDocument(
            id=doc_id,
            startup_id=startup_id,
            title=req.title,
            category=req.category,
            tier=req.tier,
            file_url=req.file_url,
            file_size_bytes=req.file_size_bytes,
            mime_type=req.mime_type,
            uploaded_at=datetime.now(timezone.utc),
            description=req.description,
            content_hash=content_hash,
            encrypted=True,
            page_count=req.page_count,
        )

        self._documents[startup_id][doc_id] = doc

        # Log upload in audit logs
        log_entry = VDRAuditLogResponse(
            id=f"log_{uuid.uuid4().hex[:12]}",
            startup_id=startup_id,
            document_id=doc_id,
            document_title=doc.title,
            user_id=uploader_id,
            user_email=uploader_email,
            action=AuditLogAction.DOCUMENT_UPLOADED,
            view_duration_seconds=0,
            ip_address=client_ip,
            user_agent=user_agent,
            watermark_token=None,
            timestamp=datetime.now(timezone.utc),
            metadata={"tier": req.tier.value, "category": req.category.value, "size_bytes": req.file_size_bytes},
        )
        self._audit_logs[startup_id].append(log_entry)

        return doc

    def get_document(self, startup_id: str, document_id: str) -> Optional[VDRDocument]:
        """Fetch raw document record by id."""
        return self._documents.get(startup_id, {}).get(document_id)

    def get_user_granted_tier(self, startup_id: str, user_id: str, is_founder: bool = False) -> Optional[VDRDocumentTier]:
        """Determine highest tier accessible by user."""
        if is_founder:
            return VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE

        grant = self._user_grants.get(startup_id, {}).get(user_id)
        if not grant or grant.status != VDRAccessStatus.APPROVED:
            return None

        # Check expiration
        if grant.expires_at and datetime.now(timezone.utc) > grant.expires_at:
            grant.status = VDRAccessStatus.EXPIRED
            return None

        return grant.granted_tier

    def list_documents(
        self,
        startup_id: str,
        user_id: str,
        is_founder: bool = False,
    ) -> List[VDRDocumentResponse]:
        """
        List all documents in the VDR with accessibility flags based on the user's
        granted clearance level.
        """
        user_tier = self.get_user_granted_tier(startup_id, user_id, is_founder=is_founder)
        user_rank = self._tier_rank(user_tier) if user_tier else 1

        results: List[VDRDocumentResponse] = []
        docs = self._documents.get(startup_id, {}).values()

        for doc in sorted(docs, key=lambda d: (self._tier_rank(d.tier), d.title)):
            doc_rank = self._tier_rank(doc.tier)
            # Tier 1 is always accessible to everyone
            if doc_rank == 1:
                is_accessible = True
            else:
                is_accessible = is_founder or (user_tier is not None and user_rank >= doc_rank)

            results.append(
                VDRDocumentResponse(
                    document=doc,
                    is_accessible=is_accessible,
                    required_tier=doc.tier,
                    user_highest_tier=user_tier,
                )
            )

        return results

    def generate_watermark_overlay(
        self,
        viewer_email: str,
        viewer_ip: str,
        document_id: str,
        timestamp: Optional[datetime] = None,
    ) -> WatermarkOverlay:
        """
        Generate dynamic forensic watermark overlay metadata and SVG stamp
        containing viewer identity, IP, timestamp, and legal notice.
        """
        ts = timestamp or datetime.now(timezone.utc)
        ts_iso = ts.strftime("%Y-%m-%d %H:%M:%S UTC")

        # Cryptographic tracking token HMAC
        msg = f"{viewer_email}:{viewer_ip}:{document_id}:{ts_iso}".encode("utf-8")
        token_hash = hmac.new(WATERMARK_SECRET_KEY, msg, hashlib.sha256).hexdigest()[:16].upper()

        watermark_text = f"CONFIDENTIAL • {viewer_email} • IP:{viewer_ip} • {ts_iso} • TOKEN:{token_hash}"
        confidentiality_notice = (
            "TAMWHEEL VDR CONFIDENTIAL - STRICTLY FOR INTENDED RECIPIENT - "
            "UNAUTHORIZED DISCLOSURE PROHIBITED UNDER LAW 18-07 & PENAL CODE ART. 301"
        )

        # Scalable Vector Graphics (SVG) diagonal pattern watermark overlay
        svg_overlay = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">'
            f'<text x="50" y="200" fill="rgba(180, 0, 0, 0.15)" font-family="Arial, sans-serif" font-size="14" '
            f'font-weight="bold" transform="rotate(-30 50,200)">'
            f'{watermark_text}'
            f'</text>'
            f'</svg>'
        )

        css_text_watermark = (
            f"position: absolute; pointer-events: none; opacity: 0.18; "
            f"transform: rotate(-35deg); font-size: 13px; font-weight: 700; "
            f"color: #dc2626; text-transform: uppercase;"
        )

        return WatermarkOverlay(
            watermark_text=watermark_text,
            viewer_email=viewer_email,
            viewer_ip=viewer_ip,
            timestamp_iso=ts_iso,
            token_hash=token_hash,
            confidentiality_notice=confidentiality_notice,
            svg_overlay=svg_overlay,
            css_text_watermark=css_text_watermark,
        )

    def get_watermarked_document(
        self,
        startup_id: str,
        document_id: str,
        user_id: str,
        viewer_email: str,
        client_ip: str,
        user_agent: str,
        is_founder: bool = False,
    ) -> Tuple[Optional[VDRWatermarkedDocumentResponse], Optional[str]]:
        """
        Authorize access and deliver a dynamically watermarked document payload.
        Returns (response, error_message).
        """
        doc = self.get_document(startup_id, document_id)
        if not doc:
            return None, "Document not found in Virtual Data Room"

        doc_rank = self._tier_rank(doc.tier)

        # Check access permission if not Public Tier 1 and not Founder
        if doc_rank > 1 and not is_founder:
            user_tier = self.get_user_granted_tier(startup_id, user_id, is_founder=False)
            if not user_tier or self._tier_rank(user_tier) < doc_rank:
                return (
                    None,
                    f"Access Denied: Document requires {doc.tier.value} clearance and signed clickwrap NDA.",
                )

        # Generate watermark overlay
        watermark = self.generate_watermark_overlay(
            viewer_email=viewer_email,
            viewer_ip=client_ip,
            document_id=document_id,
        )

        # Log audit entry
        log_entry = VDRAuditLogResponse(
            id=f"log_{uuid.uuid4().hex[:12]}",
            startup_id=startup_id,
            document_id=doc.id,
            document_title=doc.title,
            user_id=user_id,
            user_email=viewer_email,
            action=AuditLogAction.VIEW,
            view_duration_seconds=0,
            ip_address=client_ip,
            user_agent=user_agent,
            watermark_token=watermark.token_hash,
            timestamp=datetime.now(timezone.utc),
            metadata={"tier": doc.tier.value, "category": doc.category.value},
        )
        self._audit_logs[startup_id].append(log_entry)

        # Temporary access token valid for 4 hours
        token_payload = f"{user_id}:{doc.id}:{watermark.token_hash}".encode("utf-8")
        secure_token = hashlib.sha256(token_payload).hexdigest()

        response = VDRWatermarkedDocumentResponse(
            document=doc,
            watermark=watermark,
            secure_access_token=secure_token,
            access_expires_at=datetime.now(timezone.utc) + timedelta(hours=4),
        )

        return response, None

    def apply_for_access(
        self,
        startup_id: str,
        user_id: str,
        req: VDRAccessApplyRequest,
        client_ip: str,
        user_agent: str,
    ) -> VDRAccessRequestResponse:
        """
        Submit an access request for Tier 2 or Tier 3 data room clearance
        with mandatory clickwrap NDA acceptance.
        """
        req_id = f"vdr_req_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        # Build clickwrap NDA if tier requires it
        nda_agreement = None
        if req.requested_tier != VDRDocumentTier.TIER_1_PUBLIC_TEASER:
            if not req.accept_nda:
                raise ValueError("Must accept clickwrap NDA agreement for Tier 2 or Tier 3 VDR access.")

            nda_text_hash = hashlib.sha256(ALGERIAN_VDR_NDA_TEMPLATE.encode("utf-8")).hexdigest()
            nda_agreement = ClickwrapNDAAgreement(
                accepted=True,
                ip_address=client_ip,
                user_agent=user_agent,
                signed_at=now,
                legal_disclaimer=ALGERIAN_VDR_NDA_TEMPLATE,
                nda_hash=nda_text_hash,
            )

            # Log NDA execution in audit logs
            self._audit_logs[startup_id].append(
                VDRAuditLogResponse(
                    id=f"log_{uuid.uuid4().hex[:12]}",
                    startup_id=startup_id,
                    document_id=None,
                    document_title=None,
                    user_id=user_id,
                    user_email=req.user_email,
                    action=AuditLogAction.NDA_SIGNED,
                    view_duration_seconds=0,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    watermark_token=None,
                    timestamp=now,
                    metadata={"nda_hash": nda_text_hash, "requested_tier": req.requested_tier.value},
                )
            )

        # Public Tier 1 is auto-approved; Tier 2 and Tier 3 require founder approval
        if req.requested_tier == VDRDocumentTier.TIER_1_PUBLIC_TEASER:
            status = VDRAccessStatus.APPROVED
            granted_tier = VDRDocumentTier.TIER_1_PUBLIC_TEASER
            expires_at = now + timedelta(days=365)
        else:
            status = VDRAccessStatus.REQUESTED
            granted_tier = None
            expires_at = None

        access_req = VDRAccessRequestResponse(
            id=req_id,
            startup_id=startup_id,
            user_id=user_id,
            user_email=req.user_email,
            organization_name=req.organization_name,
            intended_use=req.intended_use,
            requested_tier=req.requested_tier,
            granted_tier=granted_tier,
            status=status,
            requested_at=now,
            reviewed_at=now if status == VDRAccessStatus.APPROVED else None,
            reviewer_id="system" if status == VDRAccessStatus.APPROVED else None,
            expires_at=expires_at,
            nda_agreement=nda_agreement,
        )

        self._access_requests[startup_id][req_id] = access_req
        if status == VDRAccessStatus.APPROVED:
            self._user_grants[startup_id][user_id] = access_req

        # Log request action
        self._audit_logs[startup_id].append(
            VDRAuditLogResponse(
                id=f"log_{uuid.uuid4().hex[:12]}",
                startup_id=startup_id,
                document_id=None,
                document_title=None,
                user_id=user_id,
                user_email=req.user_email,
                action=AuditLogAction.ACCESS_REQUESTED,
                view_duration_seconds=0,
                ip_address=client_ip,
                user_agent=user_agent,
                watermark_token=None,
                timestamp=now,
                metadata={"requested_tier": req.requested_tier.value},
            )
        )

        return access_req

    def review_access_request(
        self,
        startup_id: str,
        request_id: str,
        reviewer_id: str,
        review: VDRAccessReviewRequest,
        reviewer_email: str = "founder@startup.dz",
        client_ip: str = "127.0.0.1",
        user_agent: str = "TamWheel-Admin/1.0",
    ) -> Optional[VDRAccessRequestResponse]:
        """Review, approve, or reject an investor's VDR access request."""
        access_req = self._access_requests.get(startup_id, {}).get(request_id)
        if not access_req:
            return None

        now = datetime.now(timezone.utc)
        access_req.reviewed_at = now
        access_req.reviewer_id = reviewer_id
        access_req.status = review.status

        if review.status == VDRAccessStatus.APPROVED:
            granted_tier = review.granted_tier or access_req.requested_tier
            access_req.granted_tier = granted_tier
            access_req.expires_at = now + timedelta(days=review.validity_days)
            self._user_grants[startup_id][access_req.user_id] = access_req

            # Audit log
            self._audit_logs[startup_id].append(
                VDRAuditLogResponse(
                    id=f"log_{uuid.uuid4().hex[:12]}",
                    startup_id=startup_id,
                    document_id=None,
                    document_title=None,
                    user_id=access_req.user_id,
                    user_email=access_req.user_email,
                    action=AuditLogAction.ACCESS_APPROVED,
                    view_duration_seconds=0,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    watermark_token=None,
                    timestamp=now,
                    metadata={"granted_tier": granted_tier.value, "validity_days": review.validity_days},
                )
            )
        elif review.status == VDRAccessStatus.REJECTED:
            access_req.rejection_reason = review.rejection_reason or "Request rejected by founder."
            if access_req.user_id in self._user_grants.get(startup_id, {}):
                del self._user_grants[startup_id][access_req.user_id]

            self._audit_logs[startup_id].append(
                VDRAuditLogResponse(
                    id=f"log_{uuid.uuid4().hex[:12]}",
                    startup_id=startup_id,
                    document_id=None,
                    document_title=None,
                    user_id=access_req.user_id,
                    user_email=access_req.user_email,
                    action=AuditLogAction.ACCESS_REJECTED,
                    view_duration_seconds=0,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    watermark_token=None,
                    timestamp=now,
                    metadata={"reason": access_req.rejection_reason},
                )
            )

        return access_req

    def revoke_access(
        self,
        startup_id: str,
        request_id: str,
        reviewer_id: str,
        reason: Optional[str] = "Access revoked by administrator",
        client_ip: str = "127.0.0.1",
        user_agent: str = "TamWheel-Admin/1.0",
    ) -> Optional[VDRAccessRequestResponse]:
        """Immediately revoke an existing VDR access grant."""
        access_req = self._access_requests.get(startup_id, {}).get(request_id)
        if not access_req:
            return None

        now = datetime.now(timezone.utc)
        access_req.status = VDRAccessStatus.REVOKED
        access_req.revoked_at = now
        access_req.rejection_reason = reason

        if access_req.user_id in self._user_grants.get(startup_id, {}):
            del self._user_grants[startup_id][access_req.user_id]

        self._audit_logs[startup_id].append(
            VDRAuditLogResponse(
                id=f"log_{uuid.uuid4().hex[:12]}",
                startup_id=startup_id,
                document_id=None,
                document_title=None,
                user_id=access_req.user_id,
                user_email=access_req.user_email,
                action=AuditLogAction.ACCESS_REVOKED,
                view_duration_seconds=0,
                ip_address=client_ip,
                user_agent=user_agent,
                watermark_token=None,
                timestamp=now,
                metadata={"reason": reason},
            )
        )

        return access_req

    def list_access_requests(self, startup_id: str) -> List[VDRAccessRequestResponse]:
        """List all historical and active access requests for this startup VDR."""
        return list(self._access_requests.get(startup_id, {}).values())

    def log_activity(
        self,
        startup_id: str,
        document_id: Optional[str],
        user_id: str,
        user_email: str,
        action: AuditLogAction,
        view_duration_seconds: int = 0,
        client_ip: str = "127.0.0.1",
        user_agent: str = "TamWheel-Client/1.0",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> VDRAuditLogResponse:
        """Record forensic telemetry (e.g. view duration, download attempts)."""
        doc = self.get_document(startup_id, document_id) if document_id else None
        
        log_entry = VDRAuditLogResponse(
            id=f"log_{uuid.uuid4().hex[:12]}",
            startup_id=startup_id,
            document_id=document_id,
            document_title=doc.title if doc else None,
            user_id=user_id,
            user_email=user_email,
            action=action,
            view_duration_seconds=view_duration_seconds,
            ip_address=client_ip,
            user_agent=user_agent,
            watermark_token=None,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata or {},
        )
        self._audit_logs[startup_id].append(log_entry)
        return log_entry

    def get_audit_trail(self, startup_id: str) -> List[VDRAuditLogResponse]:
        """Retrieve full forensic audit trail for the startup VDR."""
        return sorted(self._audit_logs.get(startup_id, []), key=lambda l: l.timestamp, reverse=True)

    def get_analytics_summary(self, startup_id: str) -> VDRAnalyticsSummaryResponse:
        """Aggregate VDR usage telemetry, popular documents, and engagement duration."""
        docs = list(self._documents.get(startup_id, {}).values())
        logs = self._audit_logs.get(startup_id, [])

        total_storage_bytes = sum(d.file_size_bytes for d in docs)
        views = [l for l in logs if l.action == AuditLogAction.VIEW]
        downloads = [l for l in logs if l.action == AuditLogAction.DOWNLOAD_ATTEMPT]
        unique_viewers = len(set(l.user_id for l in views))

        avg_duration = (
            sum(l.view_duration_seconds for l in views) / len(views)
            if views
            else 0.0
        )

        # Tally views per document
        doc_view_counts: Dict[str, int] = defaultdict(int)
        for v in views:
            if v.document_id:
                doc_view_counts[v.document_id] += 1

        top_viewed = []
        for doc in docs:
            top_viewed.append({
                "document_id": doc.id,
                "title": doc.title,
                "tier": doc.tier.value,
                "view_count": doc_view_counts.get(doc.id, 0),
            })
        top_viewed.sort(key=lambda x: x["view_count"], reverse=True)

        return VDRAnalyticsSummaryResponse(
            startup_id=startup_id,
            total_documents=len(docs),
            total_storage_bytes=total_storage_bytes,
            total_views=len(views),
            total_download_attempts=len(downloads),
            unique_viewers=unique_viewers,
            average_view_duration_seconds=round(avg_duration, 2),
            top_viewed_documents=top_viewed[:5],
            recent_activities=sorted(logs, key=lambda l: l.timestamp, reverse=True)[:10],
        )


# Global singleton instance
vdr_engine = VirtualDataRoomEngine()
