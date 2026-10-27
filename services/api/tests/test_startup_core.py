"""
Unit and Integration Tests for TamWheel Venture Core & COSOB Regulation 23-01 CIP Compliance Engine.
Tests:
- Wilaya (1-58) & Economic Sector Taxonomy
- Executive Decree 20-254 / ASF Startup Label Verification
- Law 22-09 SPAS Cap-Table Modeling (Dilution, Convertible BSA-AIR, Hamilton-Hare Nominee Allocation)
- Campaign Lifecycle State Machine (DRAFT -> PENDING_REVIEW -> ACTIVE_SIMULATION -> FUNDED_SIMULATION -> CLOSED)
- COSOB Regulation 23-01 CIP Compliance Engine (Min Ticket, Retail Caps, High-Ticket KYC Gate, 4-Day Cooling-off)
- Due Diligence Virtual Data Room (VDR) Scoping & Admin Verification
- FastAPI Router API Endpoints with Authorization Guards
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException, status
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.generated.prisma.enums import CampaignStatus, AnalystLevel, KycStatus, UserRole
from app.schemas.startups import (
    StartupCreateRequest,
    StartupUpdateRequest,
    CampaignCreateRequest,
    CapTableSimulateRequest,
    ConvertibleInstrumentItem,
    PledgeItem,
    ShareClassType,
    DataRoomCategory,
    DataRoomAccessLevel,
    DocumentVerificationStatus,
    DataRoomDocumentUploadRequest,
    DataRoomDocumentVerifyRequest,
)
from app.services.startup_service import (
    StartupService,
    ALGERIAN_WILAYAS,
    ALGERIAN_SECTORS,
    COSOB_MIN_TICKET_DZD_DEFAULT,
    COSOB_MAX_CAMPAIGN_TARGET_DZD,
    COSOB_HIGH_TICKET_KYC_THRESHOLD_DZD,
    COSOB_STATUTORY_REFLECTION_DAYS,
    _vdr_store,
)


# =============================================================================
# FIXTURES & HELPERS
# =============================================================================

class MockUser:
    def __init__(self, user_id=1, role=UserRole.STUDENT, email="founder@tamwheel.dz", full_name="Karim Founder"):
        self.id = user_id
        self.role = role
        self.email = email
        self.fullName = full_name
        self.isActive = True


class MockAdmin:
    def __init__(self, user_id=99, role=UserRole.ADMIN, email="admin@tamwheel.dz", full_name="Admin COSOB"):
        self.id = user_id
        self.role = role
        self.email = email
        self.fullName = full_name
        self.isActive = True


@pytest.fixture(autouse=True)
def clean_vdr_store():
    """Clear in-memory Virtual Data Room before and after each test."""
    _vdr_store.clear()
    yield
    _vdr_store.clear()


@pytest.fixture
def mock_founder():
    return MockUser(user_id=10, role=UserRole.STUDENT, full_name="Founder 1")


@pytest.fixture
def mock_admin_user():
    return MockAdmin(user_id=99, role=UserRole.ADMIN, full_name="Admin Compliance")


@pytest.fixture
def mock_retail_backer():
    return MockUser(user_id=42, role=UserRole.STUDENT, full_name="Retail Backer")


@pytest.fixture
def api_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# =============================================================================
# 1. TAXONOMY & LABEL VALIDATION TESTS
# =============================================================================

def test_wilaya_taxonomy():
    """Verify all 58 Algerian Wilayas are valid and non-wilayas are rejected."""
    assert len(ALGERIAN_WILAYAS) == 58
    assert StartupService.validate_wilaya(1) is True
    assert StartupService.get_wilaya_name(1) == "Adrar"
    assert StartupService.validate_wilaya(16) is True
    assert StartupService.get_wilaya_name(16) == "Alger"
    assert StartupService.validate_wilaya(31) is True
    assert StartupService.get_wilaya_name(31) == "Oran"
    assert StartupService.validate_wilaya(58) is True
    assert StartupService.get_wilaya_name(58) == "El Meniaa"

    # Invalid wilayas
    assert StartupService.validate_wilaya(0) is False
    assert StartupService.validate_wilaya(59) is False
    assert StartupService.validate_wilaya(-5) is False
    assert StartupService.get_wilaya_name(99) is None


def test_sector_taxonomy():
    """Verify recognized Algerian economic sectors."""
    assert StartupService.validate_sector("Fintech & Insurtech") is True
    assert StartupService.validate_sector("AI & DeepTech") is True
    assert StartupService.validate_sector("agritech & foodtech") is True  # Case insensitive
    assert StartupService.validate_sector("Random Speculative Token") is False


def test_asf_label_verification_valid():
    """Verify valid Executive Decree 20-254 / ASF label formats."""
    # Current or recent valid label
    current_year = datetime.now(timezone.utc).year
    res = StartupService.verify_asf_label(f"NUM-LAB-4521-{current_year}")
    assert res["isValid"] is True
    assert res["taxExemptionActive"] is True
    assert res["issuedYear"] == current_year
    assert "IBS" in res["exemptionTypes"]

    res_asf = StartupService.verify_asf_label("ASF-1029-2025", current_year=2026)
    assert res_asf["isValid"] is True

    res_dz = StartupService.verify_asf_label("DZ-STARTUP-0872-2024", current_year=2026)
    assert res_dz["isValid"] is True


def test_asf_label_verification_expired():
    """Verify expired label exceeding 3-year statutory validity under Decree 20-254."""
    res = StartupService.verify_asf_label("NUM-LAB-1234-2020", current_year=2026)
    assert res["isValid"] is False
    assert res["taxExemptionActive"] is False
    assert "expired" in res["reason"].lower()


def test_asf_label_verification_malformed():
    """Verify malformed and empty label numbers are safely rejected."""
    assert StartupService.verify_asf_label("")["isValid"] is False
    assert StartupService.verify_asf_label(None)["isValid"] is False
    assert StartupService.verify_asf_label("INVALID-SYNTAX-99")["isValid"] is False


# =============================================================================
# 2. CAP-TABLE & LAW 22-09 SPAS MODELING TESTS
# =============================================================================

def test_cap_table_equity_round_dilution():
    """Test standard equity round valuation, dilution, and share price calculation."""
    # 30,000,000 DZD pre-money valuation, 10,000,000 DZD investment, 100,000 pre-money shares
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=30000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        shareClass=ShareClassType.ORDINAIRE,
    )
    res = StartupService.simulate_cap_table(req)

    assert res.preMoneyValuationDzd == 30000000
    assert res.investmentAmountDzd == 10000000
    assert res.postMoneyValuationDzd == 40000000
    # Share price: 30,000,000 / 100,000 = 300.00 DZD
    assert res.sharePriceDzd == 300.0
    # New shares: 10,000,000 / 300 = 33,333 shares
    assert res.newSharesIssued == 33333
    assert res.postRoundTotalShares == 133333
    # Investor ownership: 33,333 / 133,333 ≈ 25.0%
    assert abs(res.investorEquityPct - 25.0) < 0.1
    # Founder dilution factor: 100,000 / 133,333 ≈ 0.75
    assert abs(res.founderDilutionFactor - 0.75) < 0.01


def test_cap_table_convertible_bsa_air_conversion():
    """Test convertible instrument conversion with discount rate and valuation cap."""
    req = CapTableSimulateRequest(
        preMoneyValuationDzd=40000000,
        investmentAmountDzd=10000000,
        preMoneyShares=100000,
        shareClass=ShareClassType.ORDINAIRE,
        convertibles=[
            ConvertibleInstrumentItem(
                instrumentType="BSA_AIR",
                principalAmountDzd=2000000,
                valuationCapDzd=30000000,   # Lower cap triggers conversion at cap price
                discountRate=0.20,
            ),
            ConvertibleInstrumentItem(
                instrumentType="SAFE_UNCAPPED",
                principalAmountDzd=1000000,
                valuationCapDzd=None,       # Uncapped, uses 20% discount on share price
                discountRate=0.20,
            ),
        ]
    )
    res = StartupService.simulate_cap_table(req)

    assert len(res.convertibleConversions) == 2
    bsa = res.convertibleConversions[0]
    # Cap price = 30,000,000 / 100,000 = 300 DZD
    # Discount price = 400 * 0.80 = 320 DZD
    # Min is cap price (300 DZD)
    assert bsa.conversionPriceDzd == 300.0
    assert bsa.sharesIssued == int(2000000 / 300)

    safe = res.convertibleConversions[1]
    # Discount price = 400 * 0.80 = 320 DZD
    assert safe.conversionPriceDzd == 320.0
    assert safe.sharesIssued == int(1000000 / 320)


def test_nominee_beneficial_units_largest_remainder_hamilton_hare():
    """
    Test indivisible legal share allocation via the Largest Remainder Method (Hamilton-Hare)
    under Law 22-09 SPAS (Article 715 bis 30).
    Guarantees the Zero-Loss Invariant: sum(discretized_shares) == total_legal_shares.
    """
    total_legal_shares = 100
    pledges = [
        {"investorId": "investor_A", "amountDzd": 33333},
        {"investorId": "investor_B", "amountDzd": 33333},
        {"investorId": "investor_C", "amountDzd": 33334},
    ]

    res = StartupService.allocate_nominee_units(total_legal_shares, pledges)

    assert res.totalNomineeShares == 100
    assert res.totalNomineeAmountDzd == 100000
    assert res.exactZeroLossInvariantVerified is True

    # Sum of discretized shares must exactly equal total legal shares
    discretized_sum = sum(a.discretizedShares for a in res.allocations)
    assert discretized_sum == 100

    # Verification of ownership percentages summing to 100%
    pct_sum = sum(a.ownershipPct for a in res.allocations)
    assert abs(pct_sum - 100.0) < 0.01


# =============================================================================
# 3. STARTUP PROFILE SERVICE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_create_startup_valid(mock_founder):
    """Test creating a valid startup profile with sector and wilaya."""
    req = StartupCreateRequest(
        name="El-Djazair Robotics",
        tagline="Autonomous Agricultural Drones for Algerian Oases",
        description="Comprehensive deep-tech robotics manufacturing based in Biskra.",
        wilaya=7,  # Biskra
        sector="Agritech & Foodtech",
        startupLabelNumber="NUM-LAB-9921-2025",
    )

    with patch("app.core.prisma.prisma.startup.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = MagicMock(
            id="startup-uuid-1",
            name="El-Djazair Robotics",
            wilaya=7,
            sector="Agritech & Foodtech",
            hasAsfLabel=True,
            founderId=mock_founder.id,
            hypeScore=50.0,
        )

        startup = await StartupService.create_startup(req, mock_founder.id)
        assert startup.id == "startup-uuid-1"
        assert startup.hasAsfLabel is True
        mock_create.assert_called_once()


@pytest.mark.asyncio
async def test_create_startup_invalid_wilaya_raises_400(mock_founder):
    """Test creating a startup with invalid wilaya code raises 400."""
    req = StartupCreateRequest.model_construct(
        name="Invalid Wilaya Startup",
        tagline="Some valid tagline here",
        description="A sufficiently detailed description of the innovative venture.",
        wilaya=99,  # Invalid
        sector="Fintech & Insurtech",
    )

    with pytest.raises(HTTPException) as exc:
        await StartupService.create_startup(req, mock_founder.id)
    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid wilaya code" in exc.value.detail


@pytest.mark.asyncio
async def test_update_startup_authorization(mock_founder, mock_retail_backer, mock_admin_user):
    """Test that only founder or admin can update startup profile."""
    mock_db_startup = MagicMock(
        id="startup-uuid-1",
        founderId=mock_founder.id,
        wilaya=16,
    )
    mock_db_startup.name = "Initial Name"

    mock_upd_obj = MagicMock(id="startup-uuid-1")
    mock_upd_obj.name = "Updated Name"

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find, \
         patch("app.core.prisma.prisma.startup.update", new_callable=AsyncMock) as mock_update:

        mock_find.return_value = mock_db_startup
        mock_update.return_value = mock_upd_obj

        # 1. Founder can update
        upd = await StartupService.update_startup(
            "startup-uuid-1",
            StartupUpdateRequest(name="Updated Name"),
            current_user=mock_founder,
        )
        assert upd.name == "Updated Name"

        # 2. Admin can update
        upd_admin = await StartupService.update_startup(
            "startup-uuid-1",
            StartupUpdateRequest(name="Admin Update"),
            current_user=mock_admin_user,
        )
        assert upd_admin is not None

        # 3. Third-party user is rejected with 403
        with pytest.raises(HTTPException) as exc:
            await StartupService.update_startup(
                "startup-uuid-1",
                StartupUpdateRequest(name="Malicious Hijack"),
                current_user=mock_retail_backer,
            )
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# 4. CAMPAIGN LIFECYCLE STATE MACHINE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_create_campaign_statutory_limits(mock_founder):
    """Test campaign creation statutory limits under COSOB CIP."""
    mock_startup = MagicMock(id="startup-1", founderId=mock_founder.id)

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find_startup, \
         patch("app.core.prisma.prisma.campaign.create", new_callable=AsyncMock) as mock_create_campaign:

        mock_find_startup.return_value = mock_startup

        # Exceeds statutory cap of 20M DZD
        req_too_high = CampaignCreateRequest.model_construct(
            targetAmountDzd=25000000,
            minTicketDzd=5000,
            endDate=datetime.now(timezone.utc) + timedelta(days=30),
        )
        with pytest.raises(HTTPException) as exc1:
            await StartupService.create_campaign("startup-1", req_too_high, mock_founder)
        assert exc1.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "statutory limit" in exc1.value.detail

        # Ticket below absolute min
        req_ticket_low = CampaignCreateRequest.model_construct(
            targetAmountDzd=5000000,
            minTicketDzd=500,  # Below 1,000 DZD absolute minimum
            endDate=datetime.now(timezone.utc) + timedelta(days=30),
        )
        with pytest.raises(HTTPException) as exc2:
            await StartupService.create_campaign("startup-1", req_ticket_low, mock_founder)
        assert exc2.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Minimum ticket size" in exc2.value.detail


@pytest.mark.asyncio
async def test_campaign_state_machine_transitions(mock_founder, mock_admin_user, mock_retail_backer):
    """
    Test campaign lifecycle progression:
    DRAFT -> PENDING_REVIEW -> ACTIVE_SIMULATION -> FUNDED_SIMULATION -> CLOSED.
    """
    mock_campaign = MagicMock(
        id="camp-1",
        status=CampaignStatus.DRAFT,
        targetAmountDzd=10000000,
        raisedAmountDzd=0,
        startup=MagicMock(founderId=mock_founder.id),
    )

    with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_find, \
         patch("app.core.prisma.prisma.campaign.update", new_callable=AsyncMock) as mock_update:

        mock_find.return_value = mock_campaign

        # 1. DRAFT -> PENDING_REVIEW (by founder)
        mock_update.return_value = MagicMock(id="camp-1", status=CampaignStatus.PENDING_REVIEW)
        t1 = await StartupService.transition_campaign_status(
            "camp-1", CampaignStatus.PENDING_REVIEW, current_user=mock_founder
        )
        assert t1.status == CampaignStatus.PENDING_REVIEW

        # 2. PENDING_REVIEW -> ACTIVE_SIMULATION requires admin authority
        mock_campaign.status = CampaignStatus.PENDING_REVIEW
        with pytest.raises(HTTPException) as exc_non_admin:
            await StartupService.transition_campaign_status(
                "camp-1", CampaignStatus.ACTIVE_SIMULATION, current_user=mock_founder
            )
        assert exc_non_admin.value.status_code == status.HTTP_403_FORBIDDEN

        # Admin executes activation
        mock_update.return_value = MagicMock(id="camp-1", status=CampaignStatus.ACTIVE_SIMULATION)
        t2 = await StartupService.transition_campaign_status(
            "camp-1", CampaignStatus.ACTIVE_SIMULATION, current_user=mock_admin_user
        )
        assert t2.status == CampaignStatus.ACTIVE_SIMULATION

        # 3. Invalid jump: DRAFT directly to CLOSED raises 400
        mock_campaign.status = CampaignStatus.DRAFT
        with pytest.raises(HTTPException) as exc_jump:
            await StartupService.transition_campaign_status(
                "camp-1", CampaignStatus.CLOSED, current_user=mock_founder
            )
        assert exc_jump.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid campaign transition" in exc_jump.value.detail


# =============================================================================
# 5. COSOB 23-01 CIP COMPLIANCE & PLEDGE ENGINE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_pledge_campaign_inactive_rejected(mock_retail_backer):
    """Pledges are rejected if campaign is not in ACTIVE_SIMULATION state."""
    mock_camp = MagicMock(
        id="camp-draft",
        status=CampaignStatus.DRAFT,
        targetAmountDzd=5000000,
        raisedAmountDzd=0,
        minTicketDzd=5000,
    )
    with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_camp
        with pytest.raises(HTTPException) as exc:
            await StartupService.validate_and_process_pledge("camp-draft", 10000, mock_retail_backer)
        assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "not accepting simulation pledges" in exc.value.detail


@pytest.mark.asyncio
async def test_pledge_below_minimum_ticket_rejected(mock_retail_backer):
    """Pledge below campaign min ticket is rejected."""
    mock_camp = MagicMock(
        id="camp-active",
        status=CampaignStatus.ACTIVE_SIMULATION,
        targetAmountDzd=5000000,
        raisedAmountDzd=0,
        minTicketDzd=5000,
    )
    with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = mock_camp
        with pytest.raises(HTTPException) as exc:
            await StartupService.validate_and_process_pledge("camp-active", 2000, mock_retail_backer)
        assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Minimum ticket size is 5,000 DZD" in exc.value.detail


@pytest.mark.asyncio
async def test_pledge_retail_investor_20_percent_cap_enforced(mock_retail_backer):
    """Retail/unaccredited backer cannot exceed 20% of target amount."""
    mock_camp = MagicMock(
        id="camp-active",
        status=CampaignStatus.ACTIVE_SIMULATION,
        targetAmountDzd=1000000,  # 20% cap = 200,000 DZD
        raisedAmountDzd=0,
        minTicketDzd=5000,
    )
    with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_find_camp, \
         patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_find_pledges:

        mock_find_camp.return_value = mock_camp
        mock_find_pledges.return_value = []

        # Attempt to pledge 250,000 DZD (25% > 20% cap)
        with pytest.raises(HTTPException) as exc:
            await StartupService.validate_and_process_pledge("camp-active", 250000, mock_retail_backer)
        assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "retail investor cap" in exc.value.detail


@pytest.mark.asyncio
async def test_pledge_high_ticket_kyc_gate(mock_retail_backer):
    """
    Commitments >= 145,000 DZD require verified biometric/national KYC under COSOB 23-01.
    If KYC is unverified, commitment must be blocked with 403 Forbidden.
    If verified, 4-day statutory reflection period is triggered.
    """
    mock_camp = MagicMock(
        id="camp-active",
        status=CampaignStatus.ACTIVE_SIMULATION,
        targetAmountDzd=10000000,  # 20% cap = 2,000,000 DZD
        raisedAmountDzd=500000,
        minTicketDzd=5000,
    )

    with patch("app.core.prisma.prisma.campaign.find_unique", new_callable=AsyncMock) as mock_find_camp, \
         patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_find_pledges, \
         patch("app.core.prisma.prisma.userkyc.find_unique", new_callable=AsyncMock) as mock_find_kyc, \
         patch("app.core.prisma.prisma.virtualpledge.create", new_callable=AsyncMock) as mock_create_pledge, \
         patch("app.core.prisma.prisma.campaign.update", new_callable=AsyncMock) as mock_update_camp, \
         patch("app.services.simulation_engine.simulation_engine.get_user_virtual_balance", new_callable=AsyncMock) as mock_bal:

        mock_find_camp.return_value = mock_camp
        mock_find_pledges.return_value = []
        mock_bal.return_value = 500000

        # 1. Backer without approved KYC commits 150,000 DZD -> BLOCKED
        mock_find_kyc.return_value = None  # No KYC
        with pytest.raises(HTTPException) as exc_no_kyc:
            await StartupService.validate_and_process_pledge("camp-active", 150000, mock_retail_backer)
        assert exc_no_kyc.value.status_code == status.HTTP_403_FORBIDDEN
        assert "High-ticket commitments exceeding" in exc_no_kyc.value.detail

        # 2. Backer with approved KYC commits 150,000 DZD -> SUCCEEDS with 4-day reflection flag
        mock_find_kyc.return_value = MagicMock(status=KycStatus.APPROVED)
        mock_created = MagicMock(
            id="pledge-uuid-99",
            campaignId="camp-active",
            userId=mock_retail_backer.id,
            amountDzd=150000,
            equitySharePct=1.5,
            createdAt=datetime.now(timezone.utc),
        )
        mock_create_pledge.return_value = mock_created

        res = await StartupService.validate_and_process_pledge("camp-active", 150000, mock_retail_backer)
        assert res["pledge"].id == "pledge-uuid-99"
        assert res["reflectionPeriodRequired"] is True
        assert res["reflectionDays"] == COSOB_STATUTORY_REFLECTION_DAYS


# =============================================================================
# 6. VIRTUAL DATA ROOM (VDR) DUE DILIGENCE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_vdr_upload_and_access_control(mock_founder, mock_retail_backer, mock_admin_user):
    """Test Virtual Data Room upload, access levels (PUBLIC, INVESTOR_GATED, CONFIDENTIAL), and verification."""
    # 1. Upload public pitch deck
    doc_public = StartupService.upload_data_room_document(
        startup_id="startup-vdr-1",
        data=DataRoomDocumentUploadRequest(
            title="Executive Pitch Deck Q1 2026",
            category=DataRoomCategory.PITCH_DECK,
            fileUrl="https://storage.tamwheel.dz/vdr/pitch_deck_v1.pdf",
            fileSizeBytes=5242880,
            fileSha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            accessLevel=DataRoomAccessLevel.PUBLIC,
        ),
        current_user=mock_founder,
    )
    assert doc_public.verificationStatus == DocumentVerificationStatus.PENDING

    # 2. Upload investor-gated financial audit
    doc_gated = StartupService.upload_data_room_document(
        startup_id="startup-vdr-1",
        data=DataRoomDocumentUploadRequest(
            title="Certified Financial Audit 2025",
            category=DataRoomCategory.FINANCIAL_AUDIT,
            fileUrl="https://storage.tamwheel.dz/vdr/audit_2025.pdf",
            fileSizeBytes=10485760,
            fileSha256="ca978112ca1bbdcafac231b39a23dc4da7860814197343a6f110f721f935f7aa",
            accessLevel=DataRoomAccessLevel.INVESTOR_GATED,
        ),
        current_user=mock_founder,
    )

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find_startup, \
         patch("app.core.prisma.prisma.campaign.find_many", new_callable=AsyncMock) as mock_find_camps, \
         patch("app.core.prisma.prisma.virtualpledge.count", new_callable=AsyncMock) as mock_count_pledges:

        mock_find_startup.return_value = MagicMock(id="startup-vdr-1", founderId=mock_founder.id)
        mock_find_camps.return_value = [MagicMock(id="camp-1")]

        # Non-pledged backer sees only PUBLIC document
        mock_count_pledges.return_value = 0
        docs_unpledged = await StartupService.get_data_room_documents("startup-vdr-1", current_user=mock_retail_backer)
        assert len(docs_unpledged) == 1
        assert docs_unpledged[0].accessLevel == DataRoomAccessLevel.PUBLIC

        # Pledged backer sees PUBLIC and INVESTOR_GATED
        mock_count_pledges.return_value = 1
        docs_pledged = await StartupService.get_data_room_documents("startup-vdr-1", current_user=mock_retail_backer)
        assert len(docs_pledged) == 2

        # 3. Admin verification
        verified_doc = StartupService.verify_data_room_document(
            document_id=doc_gated.id,
            data=DataRoomDocumentVerifyRequest(
                status=DocumentVerificationStatus.VERIFIED,
                verificationNotes="Validated by KPMG Algiers.",
            ),
            current_user=mock_admin_user,
        )
        assert verified_doc.verificationStatus == DocumentVerificationStatus.VERIFIED
        assert verified_doc.verifiedBy == mock_admin_user.id


# =============================================================================
# 7. ROUTER INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_router_create_startup(api_client, mock_founder):
    """Integration test for POST /startups."""
    from types import SimpleNamespace
    app.dependency_overrides[get_current_active_user] = lambda: mock_founder

    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    mock_obj = SimpleNamespace(
        id="st-test-1",
        name="Sovereign Agro",
        tagline="Precision farming for the High Plateaus",
        description="IoT soil sensors deployed across Sétif and Tiaret.",
        wilaya=19,
        sector="Agritech & Foodtech",
        hasAsfLabel=False,
        founderId=mock_founder.id,
        hypeScore=25.0,
        logoUrl=None,
        pitchDeckUrl=None,
        videoPitchUrl=None,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
        campaigns=[],
    )

    with patch("app.core.prisma.prisma.startup.create", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_obj

        resp = await api_client.post(
            "/api/v1/startups",
            json={
                "name": "Sovereign Agro",
                "tagline": "Precision farming for the High Plateaus",
                "description": "IoT soil sensors deployed across Sétif and Tiaret.",
                "wilaya": 19,
                "sector": "Agritech & Foodtech",
            },
            headers=headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "Sovereign Agro"
        assert data["wilaya"] == 19

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_router_simulate_cap_table(api_client, mock_founder):
    """Integration test for POST /startups/{startup_id}/cap-table/simulate."""
    app.dependency_overrides[get_current_active_user] = lambda: mock_founder

    csrf_token = "test_csrf_token_value_32_chars_123"
    api_client.cookies.set("csrf_token", csrf_token)
    headers = {"x-csrf-token": csrf_token}

    with patch("app.core.prisma.prisma.startup.find_unique", new_callable=AsyncMock) as mock_find:
        mock_find.return_value = MagicMock(id="st-test-1")

        resp = await api_client.post(
            "/api/v1/startups/st-test-1/cap-table/simulate",
            json={
                "preMoneyValuationDzd": 20000000,
                "investmentAmountDzd": 5000000,
                "preMoneyShares": 100000,
                "shareClass": "ORDINAIRE",
                "pledges": [
                    {"investorId": "inv-1", "amountDzd": 2500000},
                    {"investorId": "inv-2", "amountDzd": 2500000},
                ]
            },
            headers=headers,
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["postMoneyValuationDzd"] == 25000000
        assert data["newSharesIssued"] == 25000
        assert data["nomineeAllocation"]["exactZeroLossInvariantVerified"] is True

    app.dependency_overrides.clear()
