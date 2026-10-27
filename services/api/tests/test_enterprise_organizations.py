"""
Comprehensive test suite for Enterprise Organizations, Multi-Tenancy,
Algerian Regulatory Compliance (CNRC, NIF, Article 169 CIDTA), and IAM Security.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.core.algerian_validators import (
    validate_cnrc_format,
    validate_algerian_nif_checksum,
    generate_valid_nif,
    validate_article_imposition,
    validate_nis_format,
)
from app.services.kyb_service import KybService
from app.services.maker_checker_service import (
    MakerCheckerService,
    ACTION_CORPORATE_ESCROW_RELEASE,
)
from app.services.proforma_service import ProformaService, PODACIUM_CORPORATE_IDENTITY
from app.core.tenant import (
    TenantContext,
    ROLE_PERMISSIONS,
    require_org_permission,
)
from app.services.freelancing_service import FreelanceService


# =============================================================================
# 1. Statutory Identifier Validation Tests (CNRC, NIF, NIS, Article d'Imposition)
# =============================================================================


def test_cnrc_format_validation():
    # Valid CNRC: 2 digits (wilaya) + A/B + 7 digits
    assert validate_cnrc_format("16B0012345") is True  # Algiers corporate
    assert validate_cnrc_format("31A0098765") is True  # Oran sole trader
    assert validate_cnrc_format(" 16-B/0012345 ") is True  # Cleaned spacing/punctuation
    assert validate_cnrc_format("58B0000001") is True  # In Guezzam corporate

    # Invalid CNRC
    assert validate_cnrc_format("99B0012345") is False  # Invalid wilaya (>58)
    assert validate_cnrc_format("00B0012345") is False  # Invalid wilaya (00)
    assert (
        validate_cnrc_format("16C0012345") is False
    )  # Invalid entity letter (not A or B)
    assert validate_cnrc_format("16B001234") is False  # Too short
    assert validate_cnrc_format("") is False
    assert validate_cnrc_format(None) is False


def test_algerian_nif_checksum_validation():
    # Generate and verify valid NIFs across multiple wilayas
    for wilaya in [16, 31, 25, 9, 1]:
        valid_nif = generate_valid_nif(wilaya=wilaya, year=2021, seq=4567)
        assert len(valid_nif) == 15
        assert validate_algerian_nif_checksum(valid_nif) is True

    # Corrupt last check digit
    corrupted_nif = valid_nif[:-1] + str((int(valid_nif[-1]) + 5) % 10)
    assert validate_algerian_nif_checksum(corrupted_nif) is False

    # Invalid lengths or formats
    assert validate_algerian_nif_checksum("12345") is False
    assert validate_algerian_nif_checksum("") is False
    assert validate_algerian_nif_checksum(None) is False
    assert validate_algerian_nif_checksum("990020210004567") is False  # Wilaya 99 > 58


def test_article_imposition_and_nis_validation():
    assert validate_article_imposition("16012345678") is True
    assert validate_article_imposition("1601234567") is False  # 10 digits
    assert validate_article_imposition("160123456789") is False  # 12 digits

    assert validate_nis_format("002016012345678") is True  # 15 digits
    assert (
        validate_nis_format("002016012345678001") is True
    )  # 18 digits (secondary branch)
    assert validate_nis_format("12345") is False


# =============================================================================
# 2. KYB Service & Anti-Fraud Heuristics Tests
# =============================================================================


def test_cnrc_qr_url_verification():
    # Official domains
    res_valid = KybService.verify_cnrc_qr_url(
        "https://sidjilcom.cnrc.dz/verify?id=16B0012345"
    )
    assert res_valid["valid"] is True
    assert "cnrc.dz" in res_valid["domain"]

    res_portal = KybService.verify_cnrc_qr_url(
        "https://cnrc.dz/verification/receipt/789"
    )
    assert res_portal["valid"] is True

    # Untrusted domain / phishing attempt
    res_fraud = KybService.verify_cnrc_qr_url(
        "https://phishing-cnrc-algeria.com/verify?id=123"
    )
    assert res_fraud["valid"] is False
    assert "Untrusted CNRC domain" in res_fraud["reason"]


def test_kyb_risk_score_calculation():
    # Low-risk entity with valid NIF, matching Wilaya, and verified QR
    valid_nif = generate_valid_nif(wilaya=16, year=2020, seq=100)
    low_risk_data = {
        "rcNumber": "16B0012345",
        "rcWilayaCode": "16",
        "nifNumber": valid_nif,
    }
    score_clean = KybService.calculate_kyb_risk_score(
        low_risk_data, has_qr_verified=True, documents_count=3
    )
    assert score_clean <= 20  # Very low risk

    # High-risk entity with invalid NIF, mismatching wilaya, no QR
    bad_data = {
        "rcNumber": "INVALID_RC",
        "rcWilayaCode": "31",
        "nifNumber": "999999999999999",
    }
    score_fraud = KybService.calculate_kyb_risk_score(
        bad_data, has_qr_verified=False, documents_count=0
    )
    assert score_fraud >= 80  # High risk alert


from app.generated.prisma import enums as p_enums
from datetime import datetime, timezone, timedelta


# =============================================================================
# 3. Two-Person Integrity (Maker-Checker) Escrow Governance Tests
# =============================================================================


@pytest.mark.asyncio
async def test_maker_checker_two_person_integrity_violation():
    """Separation of duties: An initiator/maker CANNOT approve their own action."""
    now = datetime.now(timezone.utc)
    mock_action = MagicMock(
        id="act_123",
        actionType=ACTION_CORPORATE_ESCROW_RELEASE,
        initiatorId=42,  # User 42 is the maker
        status=p_enums.PendingActionStatus.PENDING_APPROVAL,
        expiresAt=now + timedelta(hours=24),
        payload={"milestoneId": 10, "amountDzd": 50000.0},
    )

    with patch("app.services.maker_checker_service.prisma") as mock_prisma:
        mock_prisma.pendingadminaction.find_unique = AsyncMock(return_value=mock_action)

        # Attempt to approve with the SAME user ID (42)
        with pytest.raises(HTTPException) as exc_info:
            await MakerCheckerService.approve_and_execute(
                action_id="act_123",
                approver_id=42,
            )

        assert exc_info.value.status_code == 400
        assert "Two-Person Integrity violation" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_maker_checker_valid_dual_approval():
    """Valid execution when approver is distinct from initiator."""
    now = datetime.now(timezone.utc)
    mock_action = MagicMock(
        id="act_456",
        actionType=ACTION_CORPORATE_ESCROW_RELEASE,
        initiatorId=42,  # Maker
        status=p_enums.PendingActionStatus.PENDING_APPROVAL,
        expiresAt=now + timedelta(hours=24),
        payload={"milestoneId": 15, "amountDzd": 75000.0},
    )

    with (
        patch("app.services.maker_checker_service.prisma") as mock_prisma,
        patch(
            "app.services.maker_checker_service.AuditTrailService.log_action",
            AsyncMock(),
        ),
    ):
        mock_prisma.pendingadminaction.find_unique = AsyncMock(return_value=mock_action)
        mock_prisma.pendingadminaction.update = AsyncMock()

        # Mock transaction for contract milestone update
        mock_tx = AsyncMock()
        mock_milestone = MagicMock(id=15)
        mock_tx.contractmilestone.find_unique = AsyncMock(return_value=mock_milestone)
        mock_tx.contractmilestone.update = AsyncMock()

        class MockTxContext:
            async def __aenter__(self):
                return mock_tx

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        mock_prisma.tx.return_value = MockTxContext()

        # Approver 99 (DAF) approves Maker 42's request
        result = await MakerCheckerService.approve_and_execute(
            action_id="act_456",
            approver_id=99,
            approval_notes="Facture ANAE & PV de réception vérifiés",
        )

        assert result["success"] is True
        assert result["status"] == "EXECUTED"
        assert result["initiatorId"] == 42
        assert result["approverId"] == 99


# =============================================================================
# 4. Proforma & Article 169 CIDTA Tax Shield Tests
# =============================================================================


@pytest.mark.asyncio
async def test_proforma_generation_article_169_tax_shield():
    mock_org = MagicMock(
        id=7,
        name="Algeria Data Corp SARL",
        deletedAt=None,
        rcNumber="16B0012345",
        nifNumber="002016012345678",
        nisNumber="002016012345678",
        articleImposition="16012345678",
    )
    mock_invoice = MagicMock(id=101)

    with (
        patch("app.services.proforma_service.prisma") as mock_prisma,
        patch(
            "app.services.proforma_service.AuditTrailService.log_action", AsyncMock()
        ),
    ):
        mock_prisma.organization.find_unique = AsyncMock(return_value=mock_org)
        mock_prisma.invoice.create = AsyncMock(return_value=mock_invoice)

        items = [
            {
                "description": "Podacium BI Enterprise 10-Seat License",
                "unitPriceDzd": 100000.0,
                "quantity": 1,
            },
            {
                "description": "AI Query Analytics Module",
                "unitPriceDzd": 50000.0,
                "quantity": 1,
            },
        ]

        proforma = await ProformaService.generate_proforma(
            organization_id=7,
            requester_id=1,
            items=items,
            article_169_eligible=True,
        )

        assert proforma["organizationId"] == 7
        assert proforma["subtotalDzd"] == 150000.0
        assert proforma["tvaDzd"] == 0.0  # Exempt under Article 169
        assert proforma["totalDzd"] == 150000.0
        assert proforma["article169Eligible"] is True
        assert "Art. 169 & 224 du CIDTA" in proforma["taxExemptionClause"]
        assert (
            proforma["bankWireInstructions"]["rip"]
            == PODACIUM_CORPORATE_IDENTITY["bankRip"]
        )


# =============================================================================
# 5. Cross-Pillar Dual-Ownership Tests (Freelancing & Project Management)
# =============================================================================


@pytest.mark.asyncio
async def test_can_manage_project_dual_ownership():
    # Case 1: Creator owner can manage
    project_individual = MagicMock(ownerId=10, organizationId=None)
    assert (
        await FreelanceService.can_manage_project(project_individual, user_id=10)
        is True
    )
    assert (
        await FreelanceService.can_manage_project(project_individual, user_id=99)
        is False
    )

    # Case 2: Corporate project where original poster left, but org ADMIN can manage
    project_corporate = MagicMock(ownerId=50, organizationId=5)

    with patch("app.services.freelancing_service.prisma") as mock_prisma:
        mock_org = MagicMock(id=5, ownerId=1)
        mock_prisma.organization.find_first = AsyncMock(return_value=mock_org)

        # Non-member cannot manage
        mock_prisma.organizationmember.find_first = AsyncMock(return_value=None)
        assert (
            await FreelanceService.can_manage_project(project_corporate, user_id=99)
            is False
        )

        # Member with HIRING_MANAGER role can manage
        mock_membership = MagicMock(role="HIRING_MANAGER")
        mock_prisma.organizationmember.find_first = AsyncMock(
            return_value=mock_membership
        )
        assert (
            await FreelanceService.can_manage_project(project_corporate, user_id=77)
            is True
        )


# =============================================================================
# 6. Enterprise IAM Tenant Isolation & RBAC Matrix Tests
# =============================================================================


def test_tenant_context_role_permissions():
    owner_perms = ROLE_PERMISSIONS["OWNER"]
    assert "*" in owner_perms

    admin_perms = ROLE_PERMISSIONS["ADMIN"]
    assert "org:update" in admin_perms
    assert "bi:*" in admin_perms

    hiring_perms = ROLE_PERMISSIONS["HIRING_MANAGER"]
    assert "contracts:create" in hiring_perms
    assert "escrow:release" in hiring_perms
    assert "bi:*" not in hiring_perms

    analyst_perms = ROLE_PERMISSIONS["ANALYST"]
    assert "bi:dashboards:view" in analyst_perms
    assert "contracts:create" not in analyst_perms


@pytest.mark.asyncio
async def test_require_org_permission_checker():
    # Owner passes any permission
    ctx_owner = TenantContext(
        organization_id=1, user_id=10, role="OWNER", is_owner=True
    )
    checker = require_org_permission("bi:dashboards:edit")
    assert await checker(ctx_owner) == ctx_owner

    # Viewer passes view permission, blocked from edit
    ctx_viewer = TenantContext(
        organization_id=1, user_id=20, role="VIEWER", is_owner=False
    )
    checker_view = require_org_permission("bi:dashboards:view")
    assert await checker_view(ctx_viewer) == ctx_viewer

    checker_edit = require_org_permission("bi:dashboards:edit")
    with pytest.raises(HTTPException) as exc_info:
        await checker_edit(ctx_viewer)
    assert exc_info.value.status_code == 403


# =============================================================================
# 7. Phase 7.1 Canonical Audit Gate Test Suite
# =============================================================================


@pytest.mark.asyncio
async def test_serial_founder_multiple_organizations():
    """Verify a single user (Serial Founder / Holding Director) can own >1 Organization."""
    from app.routers.organizations import create_organization
    from app.schemas.organizations import OrganizationCreate

    user = MagicMock(id=77, primaryOrganizationId=None)
    now = datetime.now(timezone.utc)
    org1 = MagicMock(id=101, ownerId=77)
    org1.dict.return_value = {
        "id": 101,
        "name": "Holding Alpha SARL",
        "slug": "holding-alpha",
        "ownerId": 77,
        "country": "ALGERIA",
        "city": "ALGIERS",
        "sector": "BANKING_AND_FINANCIAL_SERVICES",
        "createdAt": now,
        "updatedAt": now,
    }
    org2 = MagicMock(id=102, ownerId=77)
    org2.dict.return_value = {
        "id": 102,
        "name": "Venture Beta SPA",
        "slug": "venture-beta",
        "ownerId": 77,
        "country": "ALGERIA",
        "city": "ORAN",
        "sector": "TECHNOLOGY_AND_SOFTWARE",
        "createdAt": now,
        "updatedAt": now,
    }

    mock_tx = AsyncMock()
    mock_tx.organization.create = AsyncMock(side_effect=[org1, org2])
    mock_tx.organizationmember.create = AsyncMock()
    mock_tx.user.update = AsyncMock()

    class MockTxContext:
        async def __aenter__(self):
            return mock_tx

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_unique = AsyncMock(return_value=None)
        mock_prisma.tx.return_value = MockTxContext()

        res1 = await create_organization(
            OrganizationCreate(
                name="Holding Alpha SARL",
                country="ALGERIA",
                city="ALGIERS",
                sector="BANKING_AND_FINANCIAL_SERVICES",
            ),
            current_user=user,
        )
        user.primaryOrganizationId = 101
        res2 = await create_organization(
            OrganizationCreate(
                name="Venture Beta SPA",
                country="ALGERIA",
                city="ORAN",
                sector="TECHNOLOGY_AND_SOFTWARE",
            ),
            current_user=user,
        )

        assert res1["id"] == 101
        assert res2["id"] == 102
        assert res1["ownerId"] == 77
        assert res2["ownerId"] == 77


@pytest.mark.asyncio
async def test_create_organization_atomic_membership():
    """Verify POST /organizations atomically creates Organization AND OrganizationMember(role='OWNER')."""
    from app.routers.organizations import create_organization
    from app.schemas.organizations import OrganizationCreate

    user = MagicMock(id=88, primaryOrganizationId=None)
    now = datetime.now(timezone.utc)
    org = MagicMock(id=205, ownerId=88)
    org.dict.return_value = {
        "id": 205,
        "name": "Oran AI Lab",
        "slug": "oran-ai-lab",
        "ownerId": 88,
        "country": "ALGERIA",
        "city": "ORAN",
        "sector": "TECHNOLOGY_AND_SOFTWARE",
        "createdAt": now,
        "updatedAt": now,
    }

    mock_tx = AsyncMock()
    mock_tx.organization.create = AsyncMock(return_value=org)
    mock_tx.organizationmember.create = AsyncMock()
    mock_tx.user.update = AsyncMock()

    class MockTxContext:
        async def __aenter__(self):
            return mock_tx

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_unique = AsyncMock(return_value=None)
        mock_prisma.tx.return_value = MockTxContext()

        res = await create_organization(
            OrganizationCreate(
                name="Oran AI Lab",
                country="ALGERIA",
                city="ORAN",
                sector="TECHNOLOGY_AND_SOFTWARE",
            ),
            current_user=user,
        )

        assert res["id"] == 205
        assert res["userRole"] == "OWNER"
        mock_tx.organizationmember.create.assert_awaited_once_with(
            data={
                "organizationId": 205,
                "userId": 88,
                "role": "OWNER",
            }
        )


@pytest.mark.asyncio
async def test_bi_router_tenant_isolation_idor_blocked():
    """Verify User A (Org 1) attempting to access Org 2 via X-Organization-Id receives HTTP 403."""
    from app.core.tenant import get_tenant_context

    user_a = MagicMock(id=10, role="USER", primaryOrganizationId=1)

    with patch("app.core.tenant.prisma") as mock_prisma:
        mock_org_2 = MagicMock(id=2, ownerId=99, deletedAt=None, members=[])
        mock_prisma.organization.find_first = AsyncMock(return_value=mock_org_2)

        with pytest.raises(HTTPException) as exc_info:
            await get_tenant_context(
                x_organization_id="2",
                current_user=user_a,
            )

        assert exc_info.value.status_code == 403
        assert "Forbidden" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_freelance_project_corporate_dual_ownership():
    """Verify corporate ADMIN/HIRING_MANAGER can manage an org-owned project even if original creator left."""
    await test_can_manage_project_dual_ownership()


@pytest.mark.asyncio
async def test_maker_checker_two_person_integrity():
    """Verify Maker-Checker Two-Person Integrity blocks self-approval and permits dual approval."""
    await test_maker_checker_two_person_integrity_violation()
    await test_maker_checker_valid_dual_approval()


# =============================================================================
# 8. Remaining 7 Master Blueprint Items Verification Tests
# =============================================================================


def test_all_six_bi_routers_standardized_to_tenant_context():
    """Verify all 6 BI routers depend on get_tenant_context and none use legacy verify_organization_access."""
    import inspect
    from app.routers.bi_routers import (
        widgets,
        dashboards,
        analytics,
        reports,
        quality,
        decisions,
    )

    for module in (widgets, dashboards, analytics, reports, quality, decisions):
        src = inspect.getsource(module)
        assert (
            "get_tenant_context" in src
        ), f"{module.__name__} missing get_tenant_context"
        assert (
            "verify_organization_access" not in src
        ), f"{module.__name__} still references legacy verify_organization_access"


@pytest.mark.asyncio
async def test_rls_query_engine_full_pipeline_integration(tmp_path):
    """Verify QueryEngine.query_dataset_with_rls compiles RowLevelPolicy rules and filters DuckDB rows."""
    from app.services.bi_services.query_engine import QueryEngine

    csv_file = tmp_path / "sales_wilaya.csv"
    csv_file.write_text(
        "id,wilaya,revenue_dzd\n1,ALGIERS,120000\n2,ORAN,95000\n3,ALGIERS,80000\n",
        encoding="utf-8",
    )

    mock_policy = MagicMock(
        columnName="wilaya",
        operator="=",
        valuePredicate="ALGIERS",
        isActive=True,
    )

    with patch.object(
        QueryEngine, "fetch_rls_policies", AsyncMock(return_value=[mock_policy])
    ):
        rows = await QueryEngine.query_dataset_with_rls(
            file_path=str(csv_file),
            query="SELECT * FROM dataset",
            dataset_id=10,
            organization_id=1,
        )
        assert len(rows) == 2
        assert all(r["wilaya"] == "ALGIERS" for r in rows)


@pytest.mark.asyncio
async def test_optical_qr_scanner_and_kyb_document_pipeline():
    """Verify KybService optical QR extraction and scan_and_verify_document_qr pipeline."""
    pdf_bytes = b"%PDF-1.4\n% Fake CNRC Extrait with embedded QR URL: https://sidjilcom.cnrc.dz/verify?rc=16B0012345\n%%EOF"
    extracted = KybService.extract_qr_from_image_bytes(pdf_bytes, "application/pdf")
    assert extracted == "https://sidjilcom.cnrc.dz/verify?rc=16B0012345"

    valid_nif = generate_valid_nif(wilaya=16, year=2022, seq=123)
    mock_kyb = MagicMock(
        id=5,
        rcNumber="16B0012345",
        nifNumber=valid_nif,
        rcWilayaCode="16",
        documents=[MagicMock(id=99, qrCodeVerified=False)],
    )
    mock_doc = MagicMock(
        id=99,
        mimeType="application/pdf",
        qrCodeRawData=None,
        kyb=mock_kyb,
    )
    updated_doc = MagicMock(id=99, qrCodeVerified=True)

    with patch("app.services.kyb_service.prisma") as mock_prisma:
        mock_prisma.corporatedocument.find_unique = AsyncMock(return_value=mock_doc)
        mock_prisma.corporatedocument.update = AsyncMock(return_value=updated_doc)
        mock_prisma.organizationkyb.update = AsyncMock()

        res = await KybService.scan_and_verify_document_qr(
            document_id=99, file_bytes=pdf_bytes
        )
        assert res["qrCodeVerified"] is True
        assert res["verification"]["valid"] is True
        mock_prisma.organizationkyb.update.assert_awaited_once()


@pytest.mark.asyncio
async def test_high_value_escrow_requires_hardware_webauthn_step_up():
    """Verify corporate escrow release > 100,000 DZD blocks without WebAuthn step-up and succeeds with WebAuthn."""
    now = datetime.now(timezone.utc)
    mock_action = MagicMock(
        id="act_high_val",
        actionType=ACTION_CORPORATE_ESCROW_RELEASE,
        initiatorId=42,
        status=p_enums.PendingActionStatus.PENDING_APPROVAL,
        expiresAt=now + timedelta(hours=24),
        payload={
            "milestoneId": 22,
            "contractId": 8,
            "amountDzd": 250000.0,
            "isHighValue": True,
        },
    )

    with (
        patch("app.services.maker_checker_service.prisma") as mock_prisma,
        patch(
            "app.services.maker_checker_service.AuditTrailService.log_action",
            AsyncMock(),
        ),
    ):
        mock_prisma.pendingadminaction.find_unique = AsyncMock(return_value=mock_action)
        mock_prisma.pendingadminaction.update = AsyncMock()

        # 1. Without WebAuthn step-up -> HTTP 403 WEBAUTHN_STEP_UP_REQUIRED
        with pytest.raises(HTTPException) as exc_info:
            await MakerCheckerService.approve_and_execute(
                action_id="act_high_val",
                approver_id=99,
                webauthn_verified=False,
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "WEBAUTHN_STEP_UP_REQUIRED"

        # 2. With hardware WebAuthn step-up -> succeeds
        mock_tx = AsyncMock()
        mock_tx.contractmilestone.find_unique = AsyncMock(return_value=MagicMock(id=22))
        mock_tx.contractmilestone.update = AsyncMock()

        class MockTxContext:
            async def __aenter__(self):
                return mock_tx

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        mock_prisma.tx.return_value = MockTxContext()

        res = await MakerCheckerService.approve_and_execute(
            action_id="act_high_val",
            approver_id=99,
            webauthn_verified=True,
        )
        assert res["success"] is True
        assert res["executionResult"]["webauthnStepUpVerified"] is True


@pytest.mark.asyncio
async def test_discrete_benchmark_models_crud():
    """Verify CompanyCaseStudy, CompanyLeadership, and CompanyReview endpoints."""
    from app.routers.organizations import (
        create_company_case_study,
        create_company_leadership,
        create_company_review,
    )
    from app.schemas.organizations import (
        CompanyCaseStudyCreate,
        CompanyLeadershipCreate,
        CompanyReviewCreate,
    )

    now = datetime.now(timezone.utc)
    admin_user = MagicMock(id=1)
    reviewer_user = MagicMock(id=55)

    with (
        patch("app.routers.organizations.get_org_with_permission", AsyncMock()),
        patch("app.routers.organizations.prisma") as mock_prisma,
    ):
        mock_prisma.companycasestudy.find_first = AsyncMock(return_value=None)
        mock_prisma.companycasestudy.create = AsyncMock(
            return_value=MagicMock(
                id=1,
                organizationId=10,
                title="Sonatrach BI Migration",
                slug="sonatrach-bi-migration",
                clientName="Sonatrach",
                industry="Energy",
                problemStatement="Legacy spreadsheets",
                solutionSummary="Automated DuckDB pipelines",
                roiMetrics=[{"label": "Speedup", "value": "10x"}],
                technologies=["DuckDB", "Next.js"],
                isFeatured=True,
                publishedAt=now,
                createdAt=now,
                updatedAt=now,
            )
        )

        study = await create_company_case_study(
            org_id=10,
            data=CompanyCaseStudyCreate(
                title="Sonatrach BI Migration",
                clientName="Sonatrach",
                industry="Energy",
                problemStatement="Legacy spreadsheets",
                solutionSummary="Automated DuckDB pipelines",
                roiMetrics=[{"label": "Speedup", "value": "10x"}],
                technologies=["DuckDB", "Next.js"],
                isFeatured=True,
            ),
            current_user=admin_user,
        )
        assert study.slug == "sonatrach-bi-migration"

        mock_prisma.companyleadership.create = AsyncMock(
            return_value=MagicMock(
                id=2,
                organizationId=10,
                fullName="Amine Benali",
                roleTitle="Directeur Administratif et Financier (DAF)",
                displayOrder=1,
                isExecutive=True,
                createdAt=now,
                updatedAt=now,
            )
        )
        leader = await create_company_leadership(
            org_id=10,
            data=CompanyLeadershipCreate(
                fullName="Amine Benali",
                roleTitle="Directeur Administratif et Financier (DAF)",
                displayOrder=1,
            ),
            current_user=admin_user,
        )
        assert leader.fullName == "Amine Benali"

        mock_prisma.organization.find_unique = AsyncMock(
            return_value=MagicMock(id=10, ownerId=1)
        )
        mock_prisma.contract.find_unique = AsyncMock(
            return_value=MagicMock(id=900, freelancerId=55, clientId=1)
        )
        mock_prisma.companyreview.create = AsyncMock(
            return_value=MagicMock(
                id=3,
                organizationId=10,
                reviewerId=55,
                contractId=900,
                reviewerType="FREELANCER",
                overallRating=4.9,
                paymentPromptnessRating=5.0,
                scopeClarityRating=4.8,
                communicationRating=5.0,
                isVerifiedContract=True,
                createdAt=now,
                updatedAt=now,
            )
        )
        rev = await create_company_review(
            org_id=10,
            data=CompanyReviewCreate(
                contractId=900,
                reviewerType="FREELANCER",
                overallRating=4.9,
                paymentPromptnessRating=5.0,
                scopeClarityRating=4.8,
                communicationRating=5.0,
                title="Fast escrow release",
            ),
            current_user=reviewer_user,
        )
        assert rev.isVerifiedContract is True


@pytest.mark.asyncio
async def test_scim_v2_provisioning_and_deprovisioning_revokes_seats():
    """Verify SCIM 2.0 user provisioning and active=False deprovisioning with automatic seat reclamation."""
    from app.routers.scim import (
        scim_provision_user,
        scim_patch_user,
        ScimUserCreateRequest,
        ScimPatchRequest,
        ScimPatchOperation,
    )

    now = datetime.now(timezone.utc)
    ctx = TenantContext(organization_id=10, user_id=1, role="OWNER", is_owner=True)

    with patch("app.routers.scim.prisma") as mock_prisma:
        mock_user = MagicMock(
            id=77, email="karim@enterprise.dz", fullName="Karim Mansouri"
        )
        mock_member = MagicMock(
            id=501,
            organizationId=10,
            userId=77,
            role="ANALYST",
            deletedAt=None,
            departmentId=None,
            createdAt=now,
        )
        mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)
        mock_prisma.organizationmember.find_unique = AsyncMock(return_value=None)
        mock_prisma.organizationmember.create = AsyncMock(return_value=mock_member)

        provisioned = await scim_provision_user(
            payload=ScimUserCreateRequest(
                userName="karim@enterprise.dz",
                displayName="Karim Mansouri",
                role="ANALYST",
            ),
            ctx=ctx,
        )
        assert provisioned["id"] == "77"
        assert provisioned["active"] is True

        # Deprovision via SCIM PatchOp active=False and verify seat reclamation
        deprovisioned_member = MagicMock(
            id=501,
            organizationId=10,
            userId=77,
            role="ANALYST",
            deletedAt=now,
            createdAt=now,
        )
        mock_prisma.organizationmember.find_unique = AsyncMock(return_value=mock_member)
        mock_prisma.organizationmember.update = AsyncMock(
            return_value=deprovisioned_member
        )
        mock_pool = MagicMock(id=30, organizationId=10, allocatedSeats=4)
        mock_prisma.teamlicensepool.find_many = AsyncMock(return_value=[mock_pool])
        mock_prisma.seatallocation.find_first = AsyncMock(
            return_value=MagicMock(id=88, poolId=30, userId=77, revokedAt=None)
        )
        mock_prisma.seatallocation.update = AsyncMock()
        mock_prisma.teamlicensepool.update = AsyncMock()

        patched = await scim_patch_user(
            user_id=77,
            payload=ScimPatchRequest(
                Operations=[
                    ScimPatchOperation(op="replace", path="active", value=False)
                ]
            ),
            ctx=ctx,
        )
        assert patched["active"] is False
        mock_prisma.seatallocation.update.assert_awaited_once()
        mock_prisma.teamlicensepool.update.assert_awaited_once_with(
            where={"id": 30}, data={"allocatedSeats": 3}
        )


# =============================================================================
# 8. Enterprise Firmographics, Public Directory & Slug Profile Retrieval Tests
# =============================================================================


@pytest.mark.asyncio
async def test_enterprise_firmographics_create_and_update_storage():
    """Verify create_organization and update_organization store all 12 firmographics and Layer 2 fields."""
    from app.routers.organizations import create_organization, update_organization
    from app.schemas.organizations import OrganizationCreate, OrganizationUpdate
    from app.generated.prisma import Json
    from app.generated.prisma.enums import Country, City, OrganizationSector

    user = MagicMock(id=99, primaryOrganizationId=None)
    now = datetime.now(timezone.utc)

    firmographics_data = {
        "tagline": "Algérie Telecom Solutions Leader",
        "companySizeBracket": "ENTERPRISE_500_PLUS",
        "operationalScale": "NATIONAL_58_WILAYAS",
        "primaryLanguages": ["FRENCH", "ARABIC", "ENGLISH"],
        "isPublic": True,
        "internalBulletin": "# Bienvenue au portail interne\nRèglement intérieur 2026",
        "timeZone": "Africa/Algiers",
        "keyContacts": [{"name": "Amine", "role": "Champion", "email": "amine@org.dz"}],
        "hqAddress": "Route Nationale 5, Bab Ezzouar, Alger",
        "brandAccentColor": "#1B4D3E",
        "coverBannerUrl": "https://cdn.podacium.com/banners/org.jpg",
        "socialLinks": {"linkedin": "https://linkedin.com/company/telecom-dz"},
    }

    mock_created_org = MagicMock(id=301, ownerId=99)
    created_dict = {
        "id": 301,
        "name": "Telecom Enterprise SPA",
        "slug": "telecom-enterprise-spa",
        "ownerId": 99,
        "country": Country.ALGERIA,
        "city": City.ALGIERS,
        "sector": OrganizationSector.TELECOMMUNICATIONS,
        "createdAt": now,
        "updatedAt": now,
        **firmographics_data,
    }
    mock_created_org.dict.return_value = created_dict

    mock_tx = AsyncMock()
    mock_tx.organization.create = AsyncMock(return_value=mock_created_org)
    mock_tx.organizationmember.create = AsyncMock()
    mock_tx.user.update = AsyncMock()

    class MockTxContext:
        async def __aenter__(self):
            return mock_tx

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_unique = AsyncMock(return_value=None)
        mock_prisma.tx.return_value = MockTxContext()

        create_payload = OrganizationCreate(
            name="Telecom Enterprise SPA",
            country=Country.ALGERIA,
            city=City.ALGIERS,
            sector=OrganizationSector.TELECOMMUNICATIONS,
            **firmographics_data,
        )

        res = await create_organization(create_payload, current_user=user)

        assert res["id"] == 301
        assert res["tagline"] == "Algérie Telecom Solutions Leader"
        assert res["companySizeBracket"] == "ENTERPRISE_500_PLUS"
        assert res["operationalScale"] == "NATIONAL_58_WILAYAS"
        assert res["primaryLanguages"] == ["FRENCH", "ARABIC", "ENGLISH"]
        assert res["isPublic"] is True
        assert (
            res["internalBulletin"]
            == "# Bienvenue au portail interne\nRèglement intérieur 2026"
        )
        assert res["timeZone"] == "Africa/Algiers"
        assert res["hqAddress"] == "Route Nationale 5, Bab Ezzouar, Alger"
        assert res["brandAccentColor"] == "#1B4D3E"
        assert res["coverBannerUrl"] == "https://cdn.podacium.com/banners/org.jpg"
        assert res["keyContacts"] == [
            {"name": "Amine", "role": "Champion", "email": "amine@org.dz"}
        ]
        assert res["socialLinks"] == {
            "linkedin": "https://linkedin.com/company/telecom-dz"
        }

        # Verify tx.organization.create was called with Json-wrapped keyContacts and socialLinks
        create_call_args = mock_tx.organization.create.call_args[1]["data"]
        assert isinstance(create_call_args["keyContacts"], Json)
        assert isinstance(create_call_args["socialLinks"], Json)

    # Now verify update_organization
    updated_dict = dict(created_dict)
    updated_dict["tagline"] = "Updated Tagline for 2026"
    updated_dict["brandAccentColor"] = "#0D2818"
    mock_updated_org = MagicMock(id=301, ownerId=99)
    mock_updated_org.dict.return_value = updated_dict

    with (
        patch("app.routers.organizations.get_org_with_permission", AsyncMock()),
        patch("app.routers.organizations.prisma") as mock_prisma,
    ):
        mock_prisma.organization.find_unique = AsyncMock(return_value=mock_created_org)
        mock_prisma.organization.update = AsyncMock(return_value=mock_updated_org)
        mock_prisma.organizationmember.count = AsyncMock(return_value=5)

        update_payload = OrganizationUpdate(
            tagline="Updated Tagline for 2026",
            brandAccentColor="#0D2818",
            keyContacts=[{"name": "Karim", "role": "CTO"}],
        )

        update_res = await update_organization(
            org_id=301, data=update_payload, current_user=user
        )

        assert update_res["tagline"] == "Updated Tagline for 2026"
        assert update_res["brandAccentColor"] == "#0D2818"
        update_call_args = mock_prisma.organization.update.call_args[1]["data"]
        assert isinstance(update_call_args["keyContacts"], Json)


@pytest.mark.asyncio
async def test_public_organization_directory_filtering():
    """Verify GET /organizations/public/directory supports sector, city, size bracket, and search filtering."""
    from app.routers.organizations import list_public_organizations
    from app.generated.prisma.enums import Country, City, OrganizationSector

    now = datetime.now(timezone.utc)

    mock_kyb = MagicMock(status="APPROVED", riskScore=5.0)
    mock_review_1 = MagicMock(overallRating=5.0)
    mock_review_2 = MagicMock(overallRating=4.0)
    mock_case_study = MagicMock(id=1, title="Case 1")

    mock_org = MagicMock(
        id=401,
        slug="sonatrach-digital-spa",
        city=City.ALGIERS,
        country=Country.ALGERIA,
        sector=OrganizationSector.ENERGY_AND_OIL_AND_GAS,
        website="https://sonatrach.dz",
        tagline="National Hydrocarbons AI Transformation",
        companySizeBracket="ENTERPRISE_500_PLUS",
        operationalScale="NATIONAL_58_WILAYAS",
        primaryLanguages=["FRENCH", "ARABIC"],
        brandAccentColor="#E67E22",
        coverBannerUrl="https://cdn.podacium.com/sonatrach.jpg",
        kyb=mock_kyb,
        rcNumber="16B0099999",
        nifNumber="000116009999999",
        companyReviews=[mock_review_1, mock_review_2],
        caseStudies=[mock_case_study],
        createdAt=now,
    )
    mock_org.name = "Sonatrach Digital SPA"

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_many = AsyncMock(return_value=[mock_org])

        results = await list_public_organizations(
            sector=OrganizationSector.ENERGY_AND_OIL_AND_GAS,
            city=City.ALGIERS,
            search="Hydrocarbons",
            companySizeBracket="ENTERPRISE_500_PLUS",
            limit=10,
            offset=0,
        )

        assert len(results) == 1
        summary = results[0]
        assert summary.id == 401
        assert summary.slug == "sonatrach-digital-spa"
        assert summary.name == "Sonatrach Digital SPA"
        assert summary.city == City.ALGIERS
        assert summary.sector == OrganizationSector.ENERGY_AND_OIL_AND_GAS
        assert summary.tagline == "National Hydrocarbons AI Transformation"
        assert summary.companySizeBracket == "ENTERPRISE_500_PLUS"
        assert summary.operationalScale == "NATIONAL_58_WILAYAS"
        assert summary.primaryLanguages == ["FRENCH", "ARABIC"]
        assert summary.brandAccentColor == "#E67E22"
        assert summary.isKybVerified is True
        assert summary.kybStatus == "APPROVED"
        assert summary.averageRating == 4.5
        assert summary.reviewCount == 2
        assert summary.caseStudyCount == 1

        # Check where clause passed to prisma.organization.find_many
        called_where = mock_prisma.organization.find_many.call_args[1]["where"]
        assert called_where["isPublic"] is True
        assert called_where["deletedAt"] is None
        assert called_where["sector"] == OrganizationSector.ENERGY_AND_OIL_AND_GAS
        assert called_where["city"] == City.ALGIERS
        assert called_where["companySizeBracket"] == "ENTERPRISE_500_PLUS"
        assert "OR" in called_where


@pytest.mark.asyncio
async def test_public_organization_by_slug_profile_retrieval():
    """Verify GET /organizations/by-slug/{slug} returns rich public profile with reviews, kyb, and leadership."""
    from app.routers.organizations import get_organization_by_slug
    from app.generated.prisma.enums import Country, City, OrganizationSector

    now = datetime.now(timezone.utc)

    mock_kyb = MagicMock(status="APPROVED", riskScore=12.0)
    mock_review = MagicMock(
        id=1,
        organizationId=501,
        reviewerId=10,
        contractId=20,
        reviewerType="FREELANCER",
        overallRating=4.8,
        paymentPromptnessRating=5.0,
        scopeClarityRating=4.6,
        communicationRating=4.8,
        title="Excellent Client",
        comment="Paid escrow immediately",
        isVerifiedContract=True,
        createdAt=now,
        updatedAt=now,
    )
    mock_case_study = MagicMock(
        id=1,
        organizationId=501,
        title="Enterprise Data Warehouse",
        slug="enterprise-data-warehouse",
        clientName="BNA Bank",
        industry="Banking",
        problemStatement="Data fragmentation across branches",
        solutionSummary="Unified data mart with automated reconciliation",
        roiMetrics={"timeSavings": "70%"},
        technologies=["PostgreSQL", "DuckDB", "FastAPI"],
        isFeatured=True,
        publishedAt=now,
        createdAt=now,
        updatedAt=now,
    )
    mock_leader = MagicMock(
        id=1,
        organizationId=501,
        fullName="Yacine Meziane",
        roleTitle="Chief Executive Officer",
        bio="15+ years scaling tech companies in North Africa",
        avatarUrl="https://cdn.podacium.com/avatars/yacine.png",
        linkedinUrl="https://linkedin.com/in/yacine-meziane",
        displayOrder=1,
        isExecutive=True,
        createdAt=now,
        updatedAt=now,
    )

    mock_org = MagicMock(
        id=501,
        name="Algeria FinTech Solutions",
        slug="algeria-fintech-solutions",
        description="Pioneering payments & analytics in Algeria",
        city=City.ALGIERS,
        country=Country.ALGERIA,
        sector=OrganizationSector.BANKING_AND_FINANCIAL_SERVICES,
        website="https://algeriafintech.dz",
        tagline="Next-gen financial infrastructure",
        companySizeBracket="MID_51_200",
        operationalScale="NATIONAL_58_WILAYAS",
        primaryLanguages=["FRENCH", "ARABIC", "ENGLISH"],
        brandAccentColor="#0F382C",
        coverBannerUrl="https://cdn.podacium.com/fintech-banner.png",
        isPublic=True,
        internalBulletin=None,
        timeZone="Africa/Algiers",
        keyContacts=None,
        hqAddress="Didouche Mourad, Alger Centre",
        socialLinks={"linkedin": "https://linkedin.com/company/algeriafintech"},
        rcNumber="16B0011223",
        nifNumber="000216001122344",
        nisNumber="002016001122344",
        articleImposition="16011223344",
        taxRegime="REEL_NORMAL",
        kyb=mock_kyb,
        orgProfile=None,
        companyReviews=[mock_review],
        caseStudies=[mock_case_study],
        leadership=[mock_leader],
        createdAt=now,
        updatedAt=now,
    )
    mock_org.dict.return_value = {
        "id": 501,
        "name": "Algeria FinTech Solutions",
        "slug": "algeria-fintech-solutions",
        "description": "Pioneering payments & analytics in Algeria",
        "city": City.ALGIERS,
        "country": Country.ALGERIA,
        "sector": OrganizationSector.BANKING_AND_FINANCIAL_SERVICES,
        "website": "https://algeriafintech.dz",
        "tagline": "Next-gen financial infrastructure",
        "companySizeBracket": "MID_51_200",
        "operationalScale": "NATIONAL_58_WILAYAS",
        "primaryLanguages": ["FRENCH", "ARABIC", "ENGLISH"],
        "brandAccentColor": "#0F382C",
        "coverBannerUrl": "https://cdn.podacium.com/fintech-banner.png",
        "isPublic": True,
        "internalBulletin": None,
        "timeZone": "Africa/Algiers",
        "keyContacts": None,
        "hqAddress": "Didouche Mourad, Alger Centre",
        "socialLinks": {"linkedin": "https://linkedin.com/company/algeriafintech"},
        "rcNumber": "16B0011223",
        "nifNumber": "000216001122344",
        "nisNumber": "002016001122344",
        "articleImposition": "16011223344",
        "taxRegime": "REEL_NORMAL",
        "createdAt": now,
        "updatedAt": now,
        "caseStudies": [mock_case_study],
        "leadership": [mock_leader],
        "companyReviews": [mock_review],
        "orgProfile": None,
    }

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_first = AsyncMock(return_value=mock_org)
        mock_prisma.organizationmember.count = AsyncMock(return_value=12)

        profile = await get_organization_by_slug("algeria-fintech-solutions")

        assert profile["id"] == 501
        assert profile["slug"] == "algeria-fintech-solutions"
        assert profile["name"] == "Algeria FinTech Solutions"
        assert profile["isKybVerified"] is True
        assert profile["kybStatus"] == "APPROVED"
        assert profile["kybRiskScore"] == 12.0
        assert profile["averageRating"] == 4.8
        assert profile["reviewCount"] == 1
        assert len(profile["caseStudies"]) == 1
        assert len(profile["leadership"]) == 1
        assert len(profile["companyReviews"]) == 1
        assert profile["memberCount"] == 13

        # Test 404 error when not found
        mock_prisma.organization.find_first = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await get_organization_by_slug("non-existent-org")
        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_is_kyb_verified_strictly_requires_approved_status():
    """VULN-W2-04: Ensure isKybVerified strictly requires kyb_rec.status == 'APPROVED'.
    Eliminates the bypass where having rcNumber and nifNumber falsely marked org as verified.
    """
    from app.routers.organizations import (
        list_public_organizations,
        get_organization_by_slug,
    )
    from datetime import datetime, timezone
    from app.generated.prisma.enums import City, Country, OrganizationSector

    now = datetime.now(timezone.utc)

    # 1. Org has RC and NIF, but NO KYB submission -> must NOT be verified
    org_no_kyb = MagicMock(
        id=701,
        slug="unverified-org-1",
        city=City.ALGIERS,
        country=Country.ALGERIA,
        sector=OrganizationSector.TECHNOLOGY,
        website=None,
        tagline="Tech Startup",
        companySizeBracket="MICRO_1_10",
        operationalScale="NATIONAL_58_WILAYAS",
        primaryLanguages=["FRENCH"],
        brandAccentColor="#1B4D3E",
        coverBannerUrl=None,
        rcNumber="16B0011111",
        nifNumber="000116001111111",
        kyb=None,
        companyReviews=[],
        caseStudies=[],
        leadership=[],
        orgProfile=None,
        createdAt=now,
    )
    org_no_kyb.name = "Unverified Org 1"
    org_no_kyb.dict = MagicMock(
        return_value={
            "id": 701,
            "name": "Unverified Org 1",
            "slug": "unverified-org-1",
            "city": City.ALGIERS,
            "country": Country.ALGERIA,
            "sector": OrganizationSector.TECHNOLOGY,
            "website": None,
            "rcNumber": "16B0011111",
            "nifNumber": "000116001111111",
            "createdAt": now,
            "updatedAt": now,
            "orgProfile": None,
        }
    )

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_many = AsyncMock(return_value=[org_no_kyb])
        mock_prisma.organization.find_first = AsyncMock(return_value=org_no_kyb)
        mock_prisma.organizationmember.count = AsyncMock(return_value=1)

        summaries = await list_public_organizations()
        assert len(summaries) == 1
        assert summaries[0].isKybVerified is False
        assert summaries[0].kybStatus == "NOT_SUBMITTED"

        profile = await get_organization_by_slug("unverified-org-1")
        assert profile["isKybVerified"] is False
        assert profile["kybStatus"] == "NOT_SUBMITTED"

    # 2. Org has RC and NIF, but KYB is PENDING_VERIFICATION -> must NOT be verified
    pending_kyb = MagicMock(status="PENDING_VERIFICATION", riskScore=45.0)
    org_pending = MagicMock(
        id=702,
        slug="pending-org",
        city=City.ORAN,
        country=Country.ALGERIA,
        sector=OrganizationSector.FINANCE_AND_BANKING,
        website=None,
        tagline="Pending Org",
        companySizeBracket="MICRO_1_10",
        operationalScale="NATIONAL_58_WILAYAS",
        primaryLanguages=["ARABIC"],
        brandAccentColor="#1B4D3E",
        coverBannerUrl=None,
        rcNumber="31B0022222",
        nifNumber="000131002222222",
        kyb=pending_kyb,
        companyReviews=[],
        caseStudies=[],
        leadership=[],
        orgProfile=None,
        createdAt=now,
    )
    org_pending.name = "Pending Org"
    org_pending.dict = MagicMock(
        return_value={
            "id": 702,
            "name": "Pending Org",
            "slug": "pending-org",
            "city": City.ORAN,
            "country": Country.ALGERIA,
            "sector": OrganizationSector.FINANCE_AND_BANKING,
            "website": None,
            "rcNumber": "31B0022222",
            "nifNumber": "000131002222222",
            "createdAt": now,
            "updatedAt": now,
            "orgProfile": None,
        }
    )

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_many = AsyncMock(return_value=[org_pending])
        mock_prisma.organization.find_first = AsyncMock(return_value=org_pending)
        mock_prisma.organizationmember.count = AsyncMock(return_value=2)

        summaries = await list_public_organizations()
        assert summaries[0].isKybVerified is False
        assert summaries[0].kybStatus == "PENDING_VERIFICATION"

        profile = await get_organization_by_slug("pending-org")
        assert profile["isKybVerified"] is False
        assert profile["kybStatus"] == "PENDING_VERIFICATION"

    # 3. Org has APPROVED KYB -> must be verified
    approved_kyb = MagicMock(status="APPROVED", riskScore=10.0)
    org_approved = MagicMock(
        id=703,
        slug="approved-org",
        city=City.ALGIERS,
        country=Country.ALGERIA,
        sector=OrganizationSector.FINANCE_AND_BANKING,
        website=None,
        tagline="Approved Org",
        companySizeBracket="MID_51_200",
        operationalScale="NATIONAL_58_WILAYAS",
        primaryLanguages=["FRENCH", "ARABIC"],
        brandAccentColor="#1B4D3E",
        coverBannerUrl=None,
        rcNumber="16B0033333",
        nifNumber="000116003333333",
        kyb=approved_kyb,
        companyReviews=[],
        caseStudies=[],
        leadership=[],
        orgProfile=None,
        createdAt=now,
    )
    org_approved.name = "Approved Org"
    org_approved.dict = MagicMock(
        return_value={
            "id": 703,
            "name": "Approved Org",
            "slug": "approved-org",
            "city": City.ALGIERS,
            "country": Country.ALGERIA,
            "sector": OrganizationSector.FINANCE_AND_BANKING,
            "website": None,
            "rcNumber": "16B0033333",
            "nifNumber": "000116003333333",
            "createdAt": now,
            "updatedAt": now,
            "orgProfile": None,
        }
    )

    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.organization.find_many = AsyncMock(return_value=[org_approved])
        mock_prisma.organization.find_first = AsyncMock(return_value=org_approved)
        mock_prisma.organizationmember.count = AsyncMock(return_value=5)

        summaries = await list_public_organizations()
        assert summaries[0].isKybVerified is True
        assert summaries[0].kybStatus == "APPROVED"

        profile = await get_organization_by_slug("approved-org")
        assert profile["isKybVerified"] is True
        assert profile["kybStatus"] == "APPROVED"


@pytest.mark.asyncio
async def test_admin_kyb_review_with_maker_checker_governance():
    """Verify @router.post('/admin/kyb/{id}/review') wires with Maker-Checker controls."""
    from app.routers.organizations import review_organization_kyb_admin
    from app.schemas.organizations import OrganizationKybReviewRequest
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    mock_kyb = MagicMock(
        id=88,
        organizationId=101,
        legalName="Algerian Sovereign Logistics EURL",
        status="PENDING_VERIFICATION",
        riskScore=25,
        documents=[],
        verificationLogs=[],
        createdAt=now,
        updatedAt=now,
    )

    admin_user = MagicMock(id=1, role="ADMIN")

    # 1. Non-admin is blocked with 403
    regular_user = MagicMock(id=99, role="MEMBER")
    with patch("app.routers.organizations.prisma") as mock_prisma:
        mock_prisma.adminprofile.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await review_organization_kyb_admin(
                id=88,
                data=OrganizationKybReviewRequest(decision="APPROVED"),
                current_user=regular_user,
            )
        assert exc_info.value.status_code == 403

    # 2. Maker requests dual approval -> creates pending action
    with (
        patch("app.routers.organizations.prisma") as mock_prisma,
        patch(
            "app.routers.organizations.MakerCheckerService.create_kyb_approval_request"
        ) as mock_create_pending,
    ):
        mock_prisma.organizationkyb.find_unique = AsyncMock(return_value=mock_kyb)
        mock_create_pending.return_value = {
            "actionId": "act-kyb-123",
            "actionType": "APPROVE_KYB",
            "status": "PENDING_APPROVAL",
        }

        res = await review_organization_kyb_admin(
            id=88,
            data=OrganizationKybReviewRequest(
                decision="APPROVED",
                requestDualApproval=True,
                notes="KYB review dossier verified",
            ),
            current_user=admin_user,
        )
        assert res.success is True
        assert res.requires_approval is True
        assert res.message == "kyb_review_requires_dual_approval"
        assert res.pendingAction["actionId"] == "act-kyb-123"
        mock_create_pending.assert_awaited_once_with(
            maker_id=1,
            kyb_id=88,
            organization_id=101,
            decision="APPROVED",
            reason=None,
            notes="KYB review dossier verified",
        )

    # 3. Checker approves with actionId -> executes pending action
    checker_user = MagicMock(id=2, role="ADMIN")
    with (
        patch("app.routers.organizations.prisma") as mock_prisma,
        patch(
            "app.routers.organizations.MakerCheckerService.approve_and_execute"
        ) as mock_approve_exec,
    ):
        mock_prisma.organizationkyb.find_unique = AsyncMock(return_value=mock_kyb)
        mock_approve_exec.return_value = {
            "kybId": 88,
            "status": "APPROVED",
            "twoPersonIntegritySatisfied": True,
        }

        res = await review_organization_kyb_admin(
            id=88,
            data=OrganizationKybReviewRequest(
                actionId="act-kyb-123", decision="APPROVED"
            ),
            current_user=checker_user,
        )
        assert res.success is True
        assert res.requires_approval is False
        assert res.message == "kyb_approved_via_dual_authorization"
        mock_approve_exec.assert_awaited_once_with(
            action_id="act-kyb-123",
            approver_id=2,
            approval_notes=None,
        )
