"""
Comprehensive Test Suite for Virtual Data Room (VDR), Watermarking & SaaS OS Engine (Phase 3).
Covers:
- VirtualDataRoomEngine unit tests (3-tier permissions, dynamic forensic watermarking, clickwrap NDA lifecycle, audit logs, analytics)
- SaaSSubscriptionEngine unit tests (Genesis, Seed OS, Growth OS, Enterprise OS, stakeholder limits, VDR storage limits, feature gating)
- FastAPI Router integration tests for /vdr and /subscriptions/saas endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.services.vdr_engine import VirtualDataRoomEngine
from app.services.saas_subscription import SaaSSubscriptionEngine
from app.schemas.vdr import (
    VDRDocumentTier,
    VDRDocumentCategory,
    VDRAccessStatus,
    AuditLogAction,
    VDRDocumentCreateRequest,
    VDRAccessApplyRequest,
    VDRAccessReviewRequest,
    VDRAccessRevokeRequest,
    VDRLogViewRequest,
)
from app.schemas.saas_subscription import (
    SaaSTier,
    BillingCycle,
    SaaSFeature,
    SaaSPlanUpgradeRequest,
    ValidateStakeholdersRequest,
    ValidateStorageRequest,
)


class MockUser:
    def __init__(self, user_id=1, email="admin@tamwheel.dz", role="ADMIN"):
        self.id = user_id
        self.email = email
        self.role = role


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_active_user] = lambda: MockUser()
    yield
    app.dependency_overrides.clear()


# =========================================================================
# 1. VirtualDataRoomEngine Unit Tests
# =========================================================================

def test_vdr_document_upload_and_tier_classification():
    engine = VirtualDataRoomEngine()
    startup_id = "startup_vdr_001"

    # Upload Tier 1 Public Teaser
    doc1 = engine.upload_document(
        startup_id=startup_id,
        req=VDRDocumentCreateRequest(
            title="Executive Pitch Teaser",
            category=VDRDocumentCategory.TEASER,
            tier=VDRDocumentTier.TIER_1_PUBLIC_TEASER,
            file_url="https://s3.tamwheel.dz/vdr/teaser.pdf",
            file_size_bytes=1024 * 500,  # 500 KB
        ),
        uploader_id="user_founder_1",
        uploader_email="founder@startup.dz",
    )
    assert doc1.id.startswith("doc_")
    assert doc1.tier == VDRDocumentTier.TIER_1_PUBLIC_TEASER
    assert doc1.content_hash is not None

    # Upload Tier 2 NDA Financials
    doc2 = engine.upload_document(
        startup_id=startup_id,
        req=VDRDocumentCreateRequest(
            title="G50 Tax Returns & P&L Statement 2025",
            category=VDRDocumentCategory.FINANCIALS_G50,
            tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
            file_url="https://s3.tamwheel.dz/vdr/g50.pdf",
            file_size_bytes=1024 * 1024 * 2,  # 2 MB
        ),
    )
    assert doc2.tier == VDRDocumentTier.TIER_2_NDA_FINANCIALS

    # Upload Tier 3 Confirmatory Cap Table
    doc3 = engine.upload_document(
        startup_id=startup_id,
        req=VDRDocumentCreateRequest(
            title="Statutory Shareholder Ledger & BSA-AIR Warrants",
            category=VDRDocumentCategory.CAP_TABLE_ESOP,
            tier=VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE,
            file_url="https://s3.tamwheel.dz/vdr/captable.pdf",
            file_size_bytes=1024 * 1024 * 5,  # 5 MB
        ),
    )
    assert doc3.tier == VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE


def test_vdr_dynamic_watermark_generation():
    engine = VirtualDataRoomEngine()
    watermark = engine.generate_watermark_overlay(
        viewer_email="investor@algeria-ventures.dz",
        viewer_ip="197.200.45.12",
        document_id="doc_xyz789",
    )

    assert "investor@algeria-ventures.dz" in watermark.watermark_text
    assert "197.200.45.12" in watermark.watermark_text
    assert "TOKEN:" in watermark.watermark_text
    assert len(watermark.token_hash) == 16
    assert "LAW 18-07" in watermark.confidentiality_notice
    assert "PENAL CODE ART. 301" in watermark.confidentiality_notice
    assert "<svg" in watermark.svg_overlay
    assert "rotate(-35deg)" in watermark.css_text_watermark


def test_vdr_access_request_clickwrap_nda_and_founder_approval_lifecycle():
    engine = VirtualDataRoomEngine()
    startup_id = "startup_vdr_002"
    user_id = "investor_user_88"
    user_email = "karim.investor@diaspora.fr"

    # Upload Tier 2 document
    doc = engine.upload_document(
        startup_id=startup_id,
        req=VDRDocumentCreateRequest(
            title="Monthly MRR & Unit Economics",
            category=VDRDocumentCategory.FINANCIALS_G50,
            tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
            file_url="https://s3.tamwheel.dz/vdr/mrr.pdf",
            file_size_bytes=1024 * 800,
        ),
    )

    # 1. Unapproved user should NOT have access to Tier 2
    docs_view = engine.list_documents(startup_id=startup_id, user_id=user_id, is_founder=False)
    doc_entry = next(d for d in docs_view if d.document.id == doc.id)
    assert doc_entry.is_accessible is False

    # Attempting to fetch watermarked doc directly should fail with access error
    resp, err = engine.get_watermarked_document(
        startup_id=startup_id,
        document_id=doc.id,
        user_id=user_id,
        viewer_email=user_email,
        client_ip="82.120.10.5",
        user_agent="Mozilla/5.0",
        is_founder=False,
    )
    assert resp is None
    assert "Access Denied" in err

    # 2. Applying without NDA must fail
    with pytest.raises(ValueError, match="Must accept clickwrap NDA agreement"):
        engine.apply_for_access(
            startup_id=startup_id,
            user_id=user_id,
            req=VDRAccessApplyRequest(
                requested_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
                user_email=user_email,
                accept_nda=False,
            ),
            client_ip="82.120.10.5",
            user_agent="Mozilla/5.0",
        )

    # 3. Apply with clickwrap NDA accepted
    access_req = engine.apply_for_access(
        startup_id=startup_id,
        user_id=user_id,
        req=VDRAccessApplyRequest(
            requested_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
            user_email=user_email,
            organization_name="Diaspora Angel Syndicate",
            intended_use="Seed round due diligence",
            accept_nda=True,
        ),
        client_ip="82.120.10.5",
        user_agent="Mozilla/5.0",
    )
    assert access_req.status == VDRAccessStatus.REQUESTED
    assert access_req.nda_agreement is not None
    assert access_req.nda_agreement.accepted is True
    assert "Loi n° 18-07" in access_req.nda_agreement.legal_disclaimer

    # 4. Founder reviews and approves access
    reviewed = engine.review_access_request(
        startup_id=startup_id,
        request_id=access_req.id,
        reviewer_id="founder_1",
        review=VDRAccessReviewRequest(
            status=VDRAccessStatus.APPROVED,
            granted_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
            validity_days=60,
        ),
    )
    assert reviewed.status == VDRAccessStatus.APPROVED
    assert reviewed.granted_tier == VDRDocumentTier.TIER_2_NDA_FINANCIALS
    assert reviewed.expires_at is not None

    # 5. User can now access watermarked Tier 2 document
    watermarked_doc, err = engine.get_watermarked_document(
        startup_id=startup_id,
        document_id=doc.id,
        user_id=user_id,
        viewer_email=user_email,
        client_ip="82.120.10.5",
        user_agent="Mozilla/5.0",
        is_founder=False,
    )
    assert err is None
    assert watermarked_doc is not None
    assert user_email in watermarked_doc.watermark.watermark_text
    assert watermarked_doc.secure_access_token is not None

    # 6. Founder revokes access
    revoked = engine.revoke_access(
        startup_id=startup_id,
        request_id=access_req.id,
        reviewer_id="founder_1",
        reason="Diligence window expired",
    )
    assert revoked.status == VDRAccessStatus.REVOKED

    # Re-access should now be denied
    resp_after, err_after = engine.get_watermarked_document(
        startup_id=startup_id,
        document_id=doc.id,
        user_id=user_id,
        viewer_email=user_email,
        client_ip="82.120.10.5",
        user_agent="Mozilla/5.0",
        is_founder=False,
    )
    assert resp_after is None
    assert "Access Denied" in err_after


def test_vdr_audit_logs_and_analytics_telemetry():
    engine = VirtualDataRoomEngine()
    startup_id = "startup_vdr_003"

    doc = engine.upload_document(
        startup_id=startup_id,
        req=VDRDocumentCreateRequest(
            title="Tech Architecture Deep Dive",
            category=VDRDocumentCategory.INTELLECTUAL_PROPERTY,
            tier=VDRDocumentTier.TIER_1_PUBLIC_TEASER,
            file_url="https://s3.tamwheel.dz/vdr/tech.pdf",
            file_size_bytes=1024 * 1024 * 3,
        ),
    )

    # Log several views and an attempted download
    engine.log_activity(
        startup_id=startup_id,
        document_id=doc.id,
        user_id="user_investor_1",
        user_email="inv1@fund.dz",
        action=AuditLogAction.VIEW,
        view_duration_seconds=120,
    )
    engine.log_activity(
        startup_id=startup_id,
        document_id=doc.id,
        user_id="user_investor_2",
        user_email="inv2@fund.dz",
        action=AuditLogAction.VIEW,
        view_duration_seconds=180,
    )
    engine.log_activity(
        startup_id=startup_id,
        document_id=doc.id,
        user_id="user_investor_2",
        user_email="inv2@fund.dz",
        action=AuditLogAction.DOWNLOAD_ATTEMPT,
        view_duration_seconds=0,
    )

    audit_trail = engine.get_audit_trail(startup_id)
    assert len(audit_trail) >= 3

    analytics = engine.get_analytics_summary(startup_id)
    assert analytics.total_documents == 1
    assert analytics.total_views == 2
    assert analytics.total_download_attempts == 1
    assert analytics.unique_viewers == 2
    assert analytics.average_view_duration_seconds == 150.0
    assert len(analytics.top_viewed_documents) == 1
    assert analytics.top_viewed_documents[0]["view_count"] == 2


# =========================================================================
# 2. SaaSSubscriptionEngine Unit Tests
# =========================================================================

def test_saas_plan_catalog_and_defaults():
    engine = SaaSSubscriptionEngine()
    catalog = engine.get_plan_catalog()

    tiers = [p.tier for p in catalog.plans]
    assert SaaSTier.GENESIS in tiers
    assert SaaSTier.SEED_OS in tiers
    assert SaaSTier.GROWTH_OS in tiers
    assert SaaSTier.ENTERPRISE_OS in tiers

    # Default startup initialization
    sub = engine.get_subscription("startup_saas_001")
    assert sub.tier == SaaSTier.GENESIS
    assert sub.is_active is True


def test_saas_stakeholder_capacity_limits():
    engine = SaaSSubscriptionEngine()
    startup_id = "startup_saas_002"

    # Genesis tier: max 10 stakeholders
    res_allowed = engine.validate_stakeholder_capacity(startup_id, candidate_count=8)
    assert res_allowed.allowed is True

    res_blocked = engine.validate_stakeholder_capacity(startup_id, candidate_count=12)
    assert res_blocked.allowed is False
    assert res_blocked.upgrade_required is True
    assert res_blocked.suggested_tier == SaaSTier.SEED_OS

    # Upgrade to Seed OS: max 25 stakeholders
    engine.upgrade_subscription(startup_id, SaaSTier.SEED_OS)
    res_seed_ok = engine.validate_stakeholder_capacity(startup_id, candidate_count=18)
    assert res_seed_ok.allowed is True

    res_seed_exceeded = engine.validate_stakeholder_capacity(startup_id, candidate_count=28)
    assert res_seed_exceeded.allowed is False
    assert res_seed_exceeded.suggested_tier == SaaSTier.GROWTH_OS

    # Upgrade to Growth OS: unlimited stakeholders (-1)
    engine.upgrade_subscription(startup_id, SaaSTier.GROWTH_OS)
    res_growth_unlimited = engine.validate_stakeholder_capacity(startup_id, candidate_count=500)
    assert res_growth_unlimited.allowed is True
    assert res_growth_unlimited.limit == -1


def test_saas_vdr_tier_and_storage_entitlements():
    engine = SaaSSubscriptionEngine()
    startup_id = "startup_saas_003"

    # Genesis tier only allows Tier 1 documents
    res_tier1 = engine.validate_vdr_storage_capacity(
        startup_id,
        additional_bytes=1024 * 1024,
        document_tier=VDRDocumentTier.TIER_1_PUBLIC_TEASER,
    )
    assert res_tier1.allowed is True

    res_tier2_blocked = engine.validate_vdr_storage_capacity(
        startup_id,
        additional_bytes=1024 * 1024,
        document_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
    )
    assert res_tier2_blocked.allowed is False
    assert res_tier2_blocked.suggested_tier == SaaSTier.SEED_OS

    # Upgrade to Seed OS (allows Tier 2, max 5 GB)
    engine.upgrade_subscription(startup_id, SaaSTier.SEED_OS)
    res_seed_tier2 = engine.validate_vdr_storage_capacity(
        startup_id,
        additional_bytes=1024 * 1024 * 5,
        document_tier=VDRDocumentTier.TIER_2_NDA_FINANCIALS,
    )
    assert res_seed_tier2.allowed is True

    # Seed OS blocks Tier 3 confirmatory cap-table docs
    res_seed_tier3 = engine.validate_vdr_storage_capacity(
        startup_id,
        additional_bytes=1024 * 1024 * 2,
        document_tier=VDRDocumentTier.TIER_3_CONFIRMATORY_CAPTABLE,
    )
    assert res_seed_tier3.allowed is False
    assert res_seed_tier3.suggested_tier == SaaSTier.GROWTH_OS


def test_saas_advanced_feature_flags():
    engine = SaaSSubscriptionEngine()
    startup_id = "startup_saas_004"

    # Genesis: no valuation, no HoldCo
    assert engine.validate_feature_access(startup_id, SaaSFeature.VALUATION_DILUTION_MODELING).allowed is False
    assert engine.validate_feature_access(startup_id, SaaSFeature.HOLDCO_CROSS_BORDER_MIRROR).allowed is False
    assert engine.validate_feature_access(startup_id, SaaSFeature.VDR_WATERMARKING).allowed is False

    # Upgrade to Seed OS: unlocks watermarking and compliance alerts
    engine.upgrade_subscription(startup_id, SaaSTier.SEED_OS)
    assert engine.validate_feature_access(startup_id, SaaSFeature.VDR_WATERMARKING).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.TAX_CNAS_COMPLIANCE_ALERTS).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.VALUATION_DILUTION_MODELING).allowed is False

    # Upgrade to Growth OS: unlocks valuation modeling, S4E contracts, multi-currency
    engine.upgrade_subscription(startup_id, SaaSTier.GROWTH_OS)
    assert engine.validate_feature_access(startup_id, SaaSFeature.VALUATION_DILUTION_MODELING).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.S4E_CONTRACT_BUILDER).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.MULTI_CURRENCY).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.HOLDCO_CROSS_BORDER_MIRROR).allowed is False

    # Upgrade to Enterprise OS: unlocks HoldCo cross-border mirroring & secondary market
    engine.upgrade_subscription(startup_id, SaaSTier.ENTERPRISE_OS)
    assert engine.validate_feature_access(startup_id, SaaSFeature.HOLDCO_CROSS_BORDER_MIRROR).allowed is True
    assert engine.validate_feature_access(startup_id, SaaSFeature.SECONDARY_LIQUIDITY_ENGINE).allowed is True


# =========================================================================
# 3. FastAPI HTTP Router Integration Tests
# =========================================================================

@pytest.mark.asyncio
async def test_router_vdr_document_lifecycle():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_vdr"
    startup_id = "startup_http_vdr_001"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Upload Tier 1 document
        doc_payload = {
            "title": "One-Page Pitch Teaser",
            "category": "TEASER",
            "tier": "TIER_1_PUBLIC_TEASER",
            "file_url": "https://s3.tamwheel.dz/vdr/teaser_one.pdf",
            "file_size_bytes": 1024 * 200,
            "mime_type": "application/pdf",
            "page_count": 2,
        }
        res_upload = await client.post(
            f"/api/v1/vdr/startups/{startup_id}/documents",
            json=doc_payload,
            headers=headers,
        )
        assert res_upload.status_code == 201
        uploaded_doc = res_upload.json()["document"]
        doc_id = uploaded_doc["id"]

        # 2. List documents
        res_list = await client.get(f"/api/v1/vdr/startups/{startup_id}/documents")
        assert res_list.status_code == 200
        docs_list = res_list.json()
        assert len(docs_list) >= 1
        assert docs_list[0]["is_accessible"] is True

        # 3. Get watermarked document
        res_doc = await client.get(f"/api/v1/vdr/startups/{startup_id}/documents/{doc_id}")
        assert res_doc.status_code == 200
        watermarked = res_doc.json()
        assert "watermark" in watermarked
        assert "secure_access_token" in watermarked

        # 4. Log view activity
        res_log = await client.post(
            f"/api/v1/vdr/startups/{startup_id}/documents/{doc_id}/log-view",
            json={"action": "VIEW", "view_duration_seconds": 75},
            headers=headers,
        )
        assert res_log.status_code == 200
        assert res_log.json()["view_duration_seconds"] == 75

        # 5. Fetch audit trail and analytics
        res_audit = await client.get(f"/api/v1/vdr/startups/{startup_id}/audit-logs")
        assert res_audit.status_code == 200
        assert len(res_audit.json()) >= 2

        res_analytics = await client.get(f"/api/v1/vdr/startups/{startup_id}/analytics")
        assert res_analytics.status_code == 200
        analytics = res_analytics.json()
        assert analytics["total_views"] >= 1


@pytest.mark.asyncio
async def test_router_vdr_access_request_and_clickwrap_nda():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_vdr_nda"
    startup_id = "startup_http_vdr_002"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Apply for Tier 2 access with clickwrap NDA
        apply_payload = {
            "requested_tier": "TIER_2_NDA_FINANCIALS",
            "user_email": "diaspora_angel@investor.dz",
            "organization_name": "Algiers Venture Club",
            "intended_use": "Evaluating Series Seed syndication",
            "accept_nda": True,
        }
        res_apply = await client.post(
            f"/api/v1/vdr/startups/{startup_id}/access-requests",
            json=apply_payload,
            headers=headers,
        )
        assert res_apply.status_code == 201
        req_data = res_apply.json()
        req_id = req_data["id"]
        assert req_data["status"] == "REQUESTED"
        assert req_data["nda_agreement"]["accepted"] is True

        # 2. List access requests
        res_reqs = await client.get(f"/api/v1/vdr/startups/{startup_id}/access-requests")
        assert res_reqs.status_code == 200
        assert len(res_reqs.json()) >= 1

        # 3. Founder approves access request
        res_review = await client.post(
            f"/api/v1/vdr/startups/{startup_id}/access-requests/{req_id}/review",
            json={
                "status": "APPROVED",
                "granted_tier": "TIER_2_NDA_FINANCIALS",
                "validity_days": 45,
            },
            headers=headers,
        )
        assert res_review.status_code == 200
        assert res_review.json()["status"] == "APPROVED"

        # 4. Founder revokes access
        res_revoke = await client.post(
            f"/api/v1/vdr/startups/{startup_id}/access-requests/{req_id}/revoke",
            json={"reason": "Syndicate diligence completed"},
            headers=headers,
        )
        assert res_revoke.status_code == 200
        assert res_revoke.json()["status"] == "REVOKED"


@pytest.mark.asyncio
async def test_router_saas_subscription_endpoints():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_saas"
    startup_id = "startup_http_saas_001"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Get SaaS catalog plans
        res_plans = await client.get("/api/v1/subscriptions/saas/plans")
        assert res_plans.status_code == 200
        plans = res_plans.json()["plans"]
        assert len(plans) == 4

        # 2. Get startup subscription (defaults to Genesis)
        res_sub = await client.get(f"/api/v1/subscriptions/saas/startups/{startup_id}")
        assert res_sub.status_code == 200
        sub_data = res_sub.json()
        assert sub_data["subscription"]["tier"] == "GENESIS"

        # 3. Validate stakeholder capacity on Genesis
        res_valid_ok = await client.post(
            f"/api/v1/subscriptions/saas/startups/{startup_id}/validate-stakeholders",
            json={"candidate_count": 5},
            headers=headers,
        )
        assert res_valid_ok.status_code == 200
        assert res_valid_ok.json()["allowed"] is True

        res_valid_exceeded = await client.post(
            f"/api/v1/subscriptions/saas/startups/{startup_id}/validate-stakeholders",
            json={"candidate_count": 15},
            headers=headers,
        )
        assert res_valid_exceeded.status_code == 200
        assert res_valid_exceeded.json()["allowed"] is False
        assert res_valid_exceeded.json()["upgrade_required"] is True

        # 4. Check feature entitlement (VALUATION_DILUTION_MODELING is locked on Genesis)
        res_ent = await client.get(
            f"/api/v1/subscriptions/saas/startups/{startup_id}/entitlements/VALUATION_DILUTION_MODELING"
        )
        assert res_ent.status_code == 200
        assert res_ent.json()["allowed"] is False

        # 5. Upgrade plan to Growth OS
        res_upgrade = await client.post(
            f"/api/v1/subscriptions/saas/startups/{startup_id}/upgrade",
            json={
                "target_tier": "GROWTH_OS",
                "billing_cycle": "ANNUAL",
                "payment_method": "CHARGILY",
            },
            headers=headers,
        )
        assert res_upgrade.status_code == 200
        assert res_upgrade.json()["subscription"]["tier"] == "GROWTH_OS"

        # 6. Check feature entitlement now unlocked
        res_ent_unlocked = await client.get(
            f"/api/v1/subscriptions/saas/startups/{startup_id}/entitlements/VALUATION_DILUTION_MODELING"
        )
        assert res_ent_unlocked.status_code == 200
        assert res_ent_unlocked.json()["allowed"] is True
