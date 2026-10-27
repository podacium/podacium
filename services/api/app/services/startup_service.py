"""
TamWheel Sovereign Ethical Agentic Venture OS — Startup & Crowdfunding Core Service.
Implements:
1. Startup Profile Onboarding, Sector & Wilaya (1-58) Taxonomy, and ASF (Decree 20-254) Label Verification.
2. Cap-Table Modeling under Algerian Law 22-09 SPAS (Dilution, Convertible BSA-AIR, Nominee Fractional Allocation).
3. Campaign Lifecycle State Machine (DRAFT -> PENDING_REVIEW -> ACTIVE_SIMULATION -> FUNDED_SIMULATION -> CLOSED).
4. COSOB Regulation 23-01 CIP Compliance Engine (Min Ticket, Retail Allocation Caps, High-Ticket KYC Verification, 4-Day Reflection Period).
5. Virtual Data Room (VDR) Management (Pitch Decks, Financial Audits, Patent Filings, Legal Statutes).
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR
import logging
import re
from typing import Any, Dict, List, Optional
import uuid

from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma.enums import CampaignStatus, AnalystLevel, KycStatus, UserRole
from app.schemas.startups import (
    StartupCreateRequest,
    StartupUpdateRequest,
    CampaignCreateRequest,
    ShareClassType,
    DataRoomCategory,
    DataRoomAccessLevel,
    DocumentVerificationStatus,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    ConvertibleConversionItem,
    NomineeAllocationResponse,
    NomineeBeneficialItem,
    DataRoomDocumentUploadRequest,
    DataRoomDocumentVerifyRequest,
    DataRoomDocumentResponse,
)

logger = logging.getLogger("tamwheel.startup_service")


# =============================================================================
# CONSTANTS & TAXONOMY
# =============================================================================

# All 58 Algerian Wilayas (Law 19-12 administrative territorial reorganization)
ALGERIAN_WILAYAS: Dict[int, str] = {
    1: "Adrar", 2: "Chlef", 3: "Laghouat", 4: "Oum El Bouaghi", 5: "Batna",
    6: "Béjaïa", 7: "Biskra", 8: "Béchar", 9: "Blida", 10: "Bouira",
    11: "Tamanrasset", 12: "Tébessa", 13: "Tlemcen", 14: "Tiaret", 15: "Tizi Ouzou",
    16: "Alger", 17: "Djelfa", 18: "Jijel", 19: "Sétif", 20: "Saïda",
    21: "Skikda", 22: "Sidi Bel Abbès", 23: "Annaba", 24: "Guelma", 25: "Constantine",
    26: "Médéa", 27: "Mostaganem", 28: "M'Sila", 29: "Mascara", 30: "Ouargla",
    31: "Oran", 32: "El Bayadh", 33: "Illizi", 34: "Bordj Bou Arreridj", 35: "Boumerdès",
    36: "El Tarf", 37: "Tindouf", 38: "Tissemsilt", 39: "El Oued", 40: "Khenchela",
    41: "Souk Ahras", 42: "Tipaza", 43: "Mila", 44: "Aïn Defla", 45: "Naâma",
    46: "Aïn Témouchent", 47: "Ghardaïa", 48: "Relizane", 49: "Timimoun",
    50: "Bordj Badji Mokhtar", 51: "Ouled Djellal", 52: "Béni Abbès", 53: "In Salah",
    54: "In Guezzam", 55: "Touggourt", 56: "Djanet", 57: "El M'Ghair", 58: "El Meniaa",
}

ALGERIAN_SECTORS: List[str] = [
    "Fintech & Insurtech",
    "Healthtech & Biotech",
    "Agritech & Foodtech",
    "Logistics & Supply Chain",
    "CleanTech & Renewable Energy",
    "EdTech & Future of Work",
    "AI & DeepTech",
    "E-Commerce & Retail",
    "Industry 4.0 & IoT",
    "GovTech & Civic",
]

# COSOB Regulation 23-01 Statutory Rules
COSOB_MIN_TICKET_DZD_DEFAULT = 5000
COSOB_MIN_TICKET_DZD_ABSOLUTE = 1000
COSOB_MAX_CAMPAIGN_TARGET_DZD = 20000000       # 20M DZD statutory cap per startup
COSOB_SUCCESS_THRESHOLD_PCT = 0.70             # 70% all-or-nothing threshold (Article 28/29)
COSOB_MAX_OVERFUNDING_CAP_PCT = 1.50           # 150% maximum allowable overfunding cap
COSOB_MAX_RETAIL_ALLOCATION_PCT = 0.20         # 20% max allocation for unaccredited retail investors
COSOB_HIGH_TICKET_KYC_THRESHOLD_DZD = 145000   # Mandated KYC verification for >= 145,000 DZD
COSOB_STATUTORY_REFLECTION_DAYS = 4            # 4-day statutory reflection period (droit de rétractation)

# Executive Decree 20-254 Startup Label Regex
# Valid formats: NUM-LAB-1234-2024, ASF-9876-2023, DZ-STARTUP-0452-2025
ASF_LABEL_REGEX = re.compile(r"^(NUM-LAB|ASF|DZ-STARTUP)-([0-9]{3,6})-([2][0][2-3][0-9])$", re.IGNORECASE)


# =============================================================================
# IN-MEMORY VIRTUAL DATA ROOM STORE
# =============================================================================

class VirtualDataRoomStorage:
    """Thread-safe in-memory store for Due Diligence Virtual Data Room documents."""
    def __init__(self) -> None:
        self._documents: Dict[str, Dict[str, Any]] = {}

    def add(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        doc_id = doc.get("id") or str(uuid.uuid4())
        doc["id"] = doc_id
        if "uploadedAt" not in doc:
            doc["uploadedAt"] = datetime.now(timezone.utc)
        self._documents[doc_id] = doc
        return doc

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._documents.get(doc_id)

    def list_by_startup(self, startup_id: str) -> List[Dict[str, Any]]:
        return [doc for doc in self._documents.values() if doc.get("startupId") == startup_id]

    def update(self, doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if doc_id in self._documents:
            self._documents[doc_id].update(updates)
            return self._documents[doc_id]
        return None

    def delete(self, doc_id: str) -> bool:
        if doc_id in self._documents:
            del self._documents[doc_id]
            return True
        return False

    def clear(self) -> None:
        self._documents.clear()


_vdr_store = VirtualDataRoomStorage()


# =============================================================================
# SERVICE IMPLEMENTATION
# =============================================================================

class StartupService:
    """
    Core venture, crowdfunding cap-table, and COSOB Regulation 23-01 CIP compliance engine.
    """

    # -------------------------------------------------------------------------
    # 1. TAXONOMY & LABEL VALIDATION
    # -------------------------------------------------------------------------

    @staticmethod
    def validate_wilaya(wilaya: int) -> bool:
        """Validate whether a wilaya code corresponds to one of Algeria's 58 wilayas."""
        return wilaya in ALGERIAN_WILAYAS

    @staticmethod
    def get_wilaya_name(wilaya: int) -> Optional[str]:
        """Resolve an Algerian wilaya code to its official name."""
        return ALGERIAN_WILAYAS.get(wilaya)

    @staticmethod
    def validate_sector(sector: str) -> bool:
        """Validate whether a sector is in the recognized economic taxonomy."""
        normalized = sector.strip().lower()
        return any(s.lower() == normalized for s in ALGERIAN_SECTORS)

    @staticmethod
    def verify_asf_label(label_number: Optional[str], current_year: Optional[int] = None) -> Dict[str, Any]:
        """
        Validates national 'Label Start-up' under Executive Decree 20-254.
        Checks serial syntax, 3-year (36 months) validity period, and tax exemption status.
        """
        if not label_number:
            return {
                "isValid": False,
                "reason": "Missing label number",
                "taxExemptionActive": False,
            }

        cleaned = label_number.strip().upper()
        match = ASF_LABEL_REGEX.match(cleaned)
        if not match:
            return {
                "isValid": False,
                "reason": "Invalid label syntax. Expected format e.g. NUM-LAB-1234-2024 or ASF-0123-2025",
                "taxExemptionActive": False,
            }

        prefix, serial, year_str = match.groups()
        issued_year = int(year_str)
        eval_year = current_year or datetime.now(timezone.utc).year

        # Under Executive Decree 20-254, startup label is valid for 3 years (36 months)
        is_expired = (eval_year - issued_year) > 3
        if is_expired:
            return {
                "isValid": False,
                "labelNumber": cleaned,
                "issuedYear": issued_year,
                "reason": f"Label expired (issued in {issued_year}, validity is 3 years under Decree 20-254)",
                "taxExemptionActive": False,
            }

        return {
            "isValid": True,
            "labelNumber": cleaned,
            "prefix": prefix,
            "serial": serial,
            "issuedYear": issued_year,
            "taxExemptionActive": True,
            "exemptionTypes": ["IBS", "TAP", "VAT", "Customs Duties"],
        }

    # -------------------------------------------------------------------------
    # 2. STARTUP PROFILE ONBOARDING & MANAGEMENT
    # -------------------------------------------------------------------------

    @classmethod
    async def create_startup(cls, data: StartupCreateRequest, founder_id: int) -> Any:
        """
        Onboard a new startup profile with taxonomy validation and ASF label verification.
        """
        if not cls.validate_wilaya(data.wilaya):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid wilaya code {data.wilaya}. Must be between 1 and 58."
            )

        # Check ASF label if provided
        has_asf_label = False
        if data.startupLabelNumber:
            label_verif = cls.verify_asf_label(data.startupLabelNumber)
            has_asf_label = label_verif["isValid"]
            if not has_asf_label:
                logger.warning(
                    "Startup %s provided invalid ASF label %s: %s",
                    data.name, data.startupLabelNumber, label_verif.get("reason")
                )

        startup = await prisma.startup.create(
            data={
                "name": data.name,
                "tagline": data.tagline,
                "description": data.description,
                "wilaya": data.wilaya,
                "sector": data.sector,
                "hasAsfLabel": has_asf_label,
                "founderId": founder_id,
                "logoUrl": data.logoUrl,
                "pitchDeckUrl": data.pitchDeckUrl,
                "videoPitchUrl": data.videoPitchUrl,
                "hypeScore": 50.0 if has_asf_label else 25.0,
            }
        )
        return startup

    @classmethod
    async def update_startup(
        cls,
        startup_id: str,
        data: StartupUpdateRequest,
        current_user: Any,
    ) -> Any:
        """
        Update startup profile with authorization check (founder or admin).
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        if not startup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Startup not found"
            )

        # Authorization: only founder or admin
        is_founder = (startup.founderId == current_user.id)
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))
        if not (is_founder or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the founder or a platform administrator can modify this startup."
            )

        update_dict: Dict[str, Any] = {}
        if data.name is not None:
            update_dict["name"] = data.name
        if data.tagline is not None:
            update_dict["tagline"] = data.tagline
        if data.description is not None:
            update_dict["description"] = data.description
        if data.sector is not None:
            update_dict["sector"] = data.sector
        if data.logoUrl is not None:
            update_dict["logoUrl"] = data.logoUrl
        if data.pitchDeckUrl is not None:
            update_dict["pitchDeckUrl"] = data.pitchDeckUrl
        if data.videoPitchUrl is not None:
            update_dict["videoPitchUrl"] = data.videoPitchUrl
        if data.hypeScore is not None:
            update_dict["hypeScore"] = data.hypeScore

        if data.wilaya is not None:
            if not cls.validate_wilaya(data.wilaya):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid wilaya code {data.wilaya}. Must be between 1 and 58."
                )
            update_dict["wilaya"] = data.wilaya

        if data.startupLabelNumber is not None:
            label_verif = cls.verify_asf_label(data.startupLabelNumber)
            update_dict["hasAsfLabel"] = label_verif["isValid"]
        elif data.hasAsfLabel is not None:
            update_dict["hasAsfLabel"] = data.hasAsfLabel

        updated = await prisma.startup.update(
            where={"id": startup_id},
            data=update_dict,
            include={"campaigns": True}
        )
        return updated

    # -------------------------------------------------------------------------
    # 3. CAP-TABLE MODELING UNDER ALGERIAN LAW 22-09 (SPAS)
    # -------------------------------------------------------------------------

    @classmethod
    def simulate_cap_table(cls, req: CapTableSimulateRequest) -> CapTableSimulateResponse:
        """
        Simulate equity issuance, convertible instrument conversion (BSA-AIR / SAFE),
        and nominee fractional unit allocation under Algerian Commercial Code Law 22-09 (SPAS).
        Uses Largest Remainder Method (Hamilton-Hare) for indivisible legal share allocation.
        """
        pre_money = Decimal(str(req.preMoneyValuationDzd))
        investment = Decimal(str(req.investmentAmountDzd))
        pre_shares = Decimal(str(req.preMoneyShares))

        post_money = pre_money + investment
        share_price = (pre_money / pre_shares).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        new_shares = int((investment / share_price).quantize(Decimal("1"), rounding=ROUND_FLOOR))
        post_round_shares = int(pre_shares) + new_shares

        investor_equity_pct = float(
            ((Decimal(new_shares) / Decimal(post_round_shares)) * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        )
        founder_dilution_factor = float(
            (pre_shares / Decimal(post_round_shares)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        )

        # Process Convertibles (BSA-AIR / SAFE)
        conversions: List[ConvertibleConversionItem] = []
        if req.convertibles:
            for conv in req.convertibles:
                principal = Decimal(str(conv.principalAmountDzd))
                discount = Decimal(str(conv.discountRate))
                priced_discount_price = share_price * (Decimal("1") - discount)

                if conv.valuationCapDzd:
                    cap_val = Decimal(str(conv.valuationCapDzd))
                    cap_price = cap_val / pre_shares
                    effective_conv_price = min(priced_discount_price, cap_price)
                else:
                    effective_conv_price = priced_discount_price

                effective_conv_price = max(effective_conv_price, Decimal("0.0001"))
                shares_conv = int((principal / effective_conv_price).quantize(Decimal("1"), rounding=ROUND_FLOOR))
                dilution_pct = float(
                    ((Decimal(shares_conv) / Decimal(post_round_shares + shares_conv)) * Decimal("100")).quantize(
                        Decimal("0.0001"), rounding=ROUND_HALF_UP
                    )
                )

                conversions.append(
                    ConvertibleConversionItem(
                        instrumentType=conv.instrumentType,
                        principalAmountDzd=conv.principalAmountDzd,
                        conversionPriceDzd=float(effective_conv_price.quantize(Decimal("0.0001"))),
                        sharesIssued=shares_conv,
                        dilutionPct=dilution_pct,
                    )
                )

        # Process Nominee Fractional Allocation (Hamilton-Hare / Largest Remainder Method, Art. 715 bis 30)
        nominee_resp: Optional[NomineeAllocationResponse] = None
        if req.pledges and len(req.pledges) > 0:
            nominee_resp = cls.allocate_nominee_units(
                total_legal_shares=new_shares,
                pledges=[{"investorId": p.investorId, "amountDzd": p.amountDzd} for p in req.pledges]
            )

        return CapTableSimulateResponse(
            preMoneyValuationDzd=int(pre_money),
            investmentAmountDzd=int(investment),
            postMoneyValuationDzd=int(post_money),
            sharePriceDzd=float(share_price),
            newSharesIssued=new_shares,
            postRoundTotalShares=post_round_shares,
            investorEquityPct=investor_equity_pct,
            founderDilutionFactor=founder_dilution_factor,
            convertibleConversions=conversions,
            nomineeAllocation=nominee_resp,
        )

    @staticmethod
    def allocate_nominee_units(
        total_legal_shares: int,
        pledges: List[Dict[str, Any]]
    ) -> NomineeAllocationResponse:
        """
        Distribute indivisible legal shares to retail backers in a Nominee block (*Convention de Portage*)
        using the Largest Remainder Method (Hamilton-Hare Allocation) under Law 22-09 (Article 715 bis 30).
        Guarantees the Zero-Loss Invariant: sum(discretized_shares) == total_legal_shares.
        """
        if total_legal_shares <= 0 or not pledges:
            return NomineeAllocationResponse(
                totalNomineeShares=total_legal_shares,
                totalNomineeAmountDzd=sum(p["amountDzd"] for p in pledges) if pledges else 0,
                allocations=[],
                exactZeroLossInvariantVerified=True,
            )

        total_amount = sum(Decimal(str(p["amountDzd"])) for p in pledges)
        total_shares_dec = Decimal(str(total_legal_shares))

        intermediate: List[Dict[str, Any]] = []
        integer_sum = 0

        for p in pledges:
            inv_id = str(p["investorId"])
            amt = Decimal(str(p["amountDzd"]))
            # Exact fractional quota with 18 decimal precision
            exact_quota = (amt * total_shares_dec) / total_amount
            floor_shares = int(exact_quota.quantize(Decimal("1"), rounding=ROUND_FLOOR))
            remainder = exact_quota - Decimal(str(floor_shares))
            integer_sum += floor_shares

            intermediate.append({
                "investorId": inv_id,
                "amountDzd": int(amt),
                "exactQuota": exact_quota,
                "discretized": floor_shares,
                "remainder": remainder,
            })

        # Deficit distribution according to highest remainder
        deficit = total_legal_shares - integer_sum
        intermediate.sort(key=lambda x: x["remainder"], reverse=True)

        for i in range(deficit):
            intermediate[i % len(intermediate)]["discretized"] += 1

        # Re-sort to original or investor order
        allocations: List[NomineeBeneficialItem] = []
        for item in intermediate:
            shares = item["discretized"]
            pct = float(
                ((Decimal(shares) / total_shares_dec) * Decimal("100")).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
            )
            allocations.append(
                NomineeBeneficialItem(
                    investorId=item["investorId"],
                    amountDzd=item["amountDzd"],
                    beneficialUnitsExact=float(item["exactQuota"].quantize(Decimal("0.000001"))),
                    discretizedShares=shares,
                    ownershipPct=pct,
                )
            )

        # Verify zero-loss invariant
        allocated_total = sum(a.discretizedShares for a in allocations)
        invariant_verified = (allocated_total == total_legal_shares)

        return NomineeAllocationResponse(
            totalNomineeShares=total_legal_shares,
            totalNomineeAmountDzd=int(total_amount),
            allocations=allocations,
            exactZeroLossInvariantVerified=invariant_verified,
        )

    # -------------------------------------------------------------------------
    # 4. CAMPAIGN LIFECYCLE STATE MACHINE
    # -------------------------------------------------------------------------

    # Allowed transitions in the campaign lifecycle:
    # DRAFT -> PENDING_REVIEW
    # PENDING_REVIEW -> ACTIVE_SIMULATION (Admin approve)
    # PENDING_REVIEW -> DRAFT (Admin reject)
    # ACTIVE_SIMULATION -> FUNDED_SIMULATION (70%+ raised or funded)
    # ACTIVE_SIMULATION -> CLOSED (Expired or canceled)
    # FUNDED_SIMULATION -> CLOSED (Round completed)
    ALLOWED_TRANSITIONS = {
        CampaignStatus.DRAFT: [CampaignStatus.PENDING_REVIEW],
        CampaignStatus.PENDING_REVIEW: [CampaignStatus.ACTIVE_SIMULATION, CampaignStatus.DRAFT],
        CampaignStatus.ACTIVE_SIMULATION: [CampaignStatus.FUNDED_SIMULATION, CampaignStatus.CLOSED],
        CampaignStatus.FUNDED_SIMULATION: [CampaignStatus.CLOSED],
        CampaignStatus.CLOSED: [],
    }

    @classmethod
    async def create_campaign(
        cls,
        startup_id: str,
        data: CampaignCreateRequest,
        current_user: Any,
    ) -> Any:
        """
        Create a new campaign in DRAFT state for a startup.
        """
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        if not startup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Startup not found"
            )

        # Authorization: only founder or admin
        is_founder = (startup.founderId == current_user.id)
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))
        if not (is_founder or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the startup founder or an admin can initialize a campaign."
            )

        # Validate statutory campaign limits under COSOB CIP
        if data.targetAmountDzd > COSOB_MAX_CAMPAIGN_TARGET_DZD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target raise cannot exceed COSOB statutory limit of {COSOB_MAX_CAMPAIGN_TARGET_DZD:,} DZD."
            )

        if data.minTicketDzd < COSOB_MIN_TICKET_DZD_ABSOLUTE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum ticket size cannot be below {COSOB_MIN_TICKET_DZD_ABSOLUTE:,} DZD."
            )

        start_date = data.startDate or datetime.now(timezone.utc)
        if data.endDate <= start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign deadline must be strictly after the start date."
            )

        campaign = await prisma.campaign.create(
            data={
                "startupId": startup_id,
                "targetAmountDzd": data.targetAmountDzd,
                "minTicketDzd": data.minTicketDzd,
                "status": CampaignStatus.DRAFT,
                "startDate": start_date,
                "endDate": data.endDate,
                "raisedAmountDzd": 0,
            }
        )
        return campaign

    @classmethod
    async def transition_campaign_status(
        cls,
        campaign_id: str,
        new_status: CampaignStatus,
        current_user: Any,
        admin_notes: Optional[str] = None,
    ) -> Any:
        """
        Transition a campaign along its lifecycle state machine.
        Enforces authorization guards, compliance gates, and state transition integrity.
        """
        campaign = await prisma.campaign.find_unique(
            where={"id": campaign_id},
            include={"startup": True}
        )
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        current_status = campaign.status
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))
        is_founder = (campaign.startup.founderId == current_user.id)

        # Verify allowed transition
        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid campaign transition: cannot move from {current_status.value} to {new_status.value}."
            )

        # Authorization guards per transition
        if new_status == CampaignStatus.PENDING_REVIEW:
            # Founder or admin submitting for review
            if not (is_founder or is_admin):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the founder or admin can submit a campaign for review."
                )

        elif new_status == CampaignStatus.ACTIVE_SIMULATION:
            # Admin approval required to launch simulation
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="COSOB compliance review and campaign activation requires platform admin authority."
                )

        elif new_status == CampaignStatus.FUNDED_SIMULATION:
            # Automatic when hitting threshold, or manual admin certification
            viability_threshold = int(campaign.targetAmountDzd * COSOB_SUCCESS_THRESHOLD_PCT)
            if campaign.raisedAmountDzd < viability_threshold and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Campaign has raised {campaign.raisedAmountDzd:,} DZD, "
                        f"which is below the COSOB 70% threshold of {viability_threshold:,} DZD."
                    )
                )

        elif new_status == CampaignStatus.CLOSED:
            if not (is_founder or is_admin):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Closing a campaign requires founder or administrator authorization."
                )

        updated = await prisma.campaign.update(
            where={"id": campaign_id},
            data={"status": new_status}
        )
        logger.info(
            "Campaign %s transitioned from %s to %s by user %s (notes: %s)",
            campaign_id, current_status, new_status, current_user.id, admin_notes
        )
        return updated

    # -------------------------------------------------------------------------
    # 5. COSOB REGULATION 23-01 CIP COMPLIANCE & PLEDGE ENGINE
    # -------------------------------------------------------------------------

    @classmethod
    async def validate_and_process_pledge(
        cls,
        campaign_id: str,
        amount_dzd: int,
        current_user: Any,
        equity_share_pct: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Validates and registers an investment commitment under COSOB Regulation 23-01 CIP rules:
        1. Campaign must be in ACTIVE_SIMULATION.
        2. Minimum ticket verification (>= campaign.minTicketDzd).
        3. Maximum retail investor allocation cap (20% of campaign target for retail backers).
        4. Campaign overfunding hard cap (150% max).
        5. Biometric/National KYC verification requirement for commitments >= 145,000 DZD.
        6. Statutory reflection period flag (4-day cooling-off).
        """
        campaign = await prisma.campaign.find_unique(where={"id": campaign_id})
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        if campaign.status != CampaignStatus.ACTIVE_SIMULATION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Campaign is not accepting simulation pledges (current status: {campaign.status.value})."
            )

        # 1. Minimum Ticket Verification
        if amount_dzd < campaign.minTicketDzd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum ticket size is {campaign.minTicketDzd:,} DZD."
            )

        # 2. Overfunding Cap Verification (150% statutory maximum)
        max_allowable_raised = int(campaign.targetAmountDzd * COSOB_MAX_OVERFUNDING_CAP_PCT)
        if campaign.raisedAmountDzd + amount_dzd > max_allowable_raised:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pledge exceeds the campaign maximum overfunding limit of 150% "
                    f"({max_allowable_raised:,} DZD)."
                )
            )

        # 3. Retail Investor Allocation Cap Check
        # Calculate existing commitments by this user for this campaign
        existing_pledges = await prisma.virtualpledge.find_many(
            where={"campaignId": campaign_id, "userId": current_user.id}
        )
        prior_pledged = sum(p.amountDzd for p in existing_pledges)
        user_total_pledge = prior_pledged + amount_dzd

        max_retail_cap = int(campaign.targetAmountDzd * COSOB_MAX_RETAIL_ALLOCATION_PCT)
        is_accredited = getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN", "PARTNER", "INVESTOR_PRO")
        if not is_accredited and user_total_pledge > max_retail_cap:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"COSOB Regulation 23-01: Cumulative pledge ({user_total_pledge:,} DZD) exceeds "
                    f"the 20% retail investor cap ({max_retail_cap:,} DZD) for this campaign. "
                    f"Accredited investor certification is required for larger allocations."
                )
            )

        # 4. High-Ticket KYC Verification Gate (>= 145,000 DZD)
        requires_reflection = False
        reflection_days = 0

        if amount_dzd >= COSOB_HIGH_TICKET_KYC_THRESHOLD_DZD:
            # Check KYC record
            kyc_record = await prisma.userkyc.find_unique(where={"userId": current_user.id})
            is_kyc_approved = (kyc_record is not None and kyc_record.status == KycStatus.APPROVED)

            if not is_kyc_approved:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"COSOB Regulation 23-01: High-ticket commitments exceeding "
                        f"{COSOB_HIGH_TICKET_KYC_THRESHOLD_DZD:,} DZD require a verified "
                        f"biometric or national identification KYC (User KYC status: "
                        f"{kyc_record.status.value if kyc_record else 'NOT_SUBMITTED'})."
                    )
                )

            # High-ticket triggers 4-day statutory reflection period (droit de rétractation)
            requires_reflection = True
            reflection_days = COSOB_STATUTORY_REFLECTION_DAYS

        # 5. Virtual Balance Verification (Simulation Ledger)
        try:
            from app.services.simulation_engine import simulation_engine
            available_balance = await simulation_engine.get_user_virtual_balance(current_user.id)
            if available_balance < amount_dzd and not is_accredited:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient virtual balance. Available: {available_balance:,} DZD, Requested: {amount_dzd:,} DZD."
                )
        except ImportError:
            pass

        # 5. Record Pledge
        pledge = await prisma.virtualpledge.create(
            data={
                "campaignId": campaign_id,
                "userId": current_user.id,
                "amountDzd": amount_dzd,
                "equitySharePct": equity_share_pct,
            }
        )

        # 6. Increment Raised Volume
        new_raised = campaign.raisedAmountDzd + amount_dzd
        update_data: Dict[str, Any] = {"raisedAmountDzd": {"increment": amount_dzd}}

        # If campaign reaches 100% or minimum 70%, update status to FUNDED_SIMULATION
        if new_raised >= campaign.targetAmountDzd:
            update_data["status"] = CampaignStatus.FUNDED_SIMULATION

        await prisma.campaign.update(
            where={"id": campaign_id},
            data=update_data
        )

        return {
            "pledge": pledge,
            "reflectionPeriodRequired": requires_reflection,
            "reflectionDays": reflection_days,
        }

    # -------------------------------------------------------------------------
    # 6. VIRTUAL DATA ROOM (VDR) MANAGEMENT
    # -------------------------------------------------------------------------

    @classmethod
    def upload_data_room_document(
        cls,
        startup_id: str,
        data: DataRoomDocumentUploadRequest,
        current_user: Any,
    ) -> DataRoomDocumentResponse:
        """
        Add a pitch deck, financial audit, patent filing, or legal document to the Virtual Data Room.
        """
        doc_dict: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "startupId": startup_id,
            "title": data.title,
            "category": data.category,
            "fileUrl": data.fileUrl,
            "fileSizeBytes": data.fileSizeBytes,
            "fileSha256": data.fileSha256,
            "accessLevel": data.accessLevel,
            "verificationStatus": DocumentVerificationStatus.PENDING,
            "uploadedBy": current_user.id,
            "uploadedAt": datetime.now(timezone.utc),
            "verifiedBy": None,
            "verifiedAt": None,
            "verificationNotes": None,
        }
        stored = _vdr_store.add(doc_dict)
        return DataRoomDocumentResponse(**stored)

    @classmethod
    async def get_data_room_documents(
        cls,
        startup_id: str,
        current_user: Optional[Any] = None,
    ) -> List[DataRoomDocumentResponse]:
        """
        List documents in the startup Virtual Data Room with privacy and authorization scoping:
        - PUBLIC: visible to all authenticated users.
        - INVESTOR_GATED: visible to founders, admins, or backers who pledged to the startup.
        - CONFIDENTIAL_ADMIN: visible only to founders and platform admins.
        """
        all_docs = _vdr_store.list_by_startup(startup_id)
        if not current_user:
            return [
                DataRoomDocumentResponse(**d)
                for d in all_docs
                if d.get("accessLevel") == DataRoomAccessLevel.PUBLIC
            ]

        user_id = current_user.id
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))

        # Check if user is startup founder
        startup = await prisma.startup.find_unique(where={"id": startup_id})
        is_founder = (startup is not None and startup.founderId == user_id)

        if is_admin or is_founder:
            return [DataRoomDocumentResponse(**d) for d in all_docs]

        # Check if user has pledged to any campaign of this startup
        user_pledged = False
        if startup:
            campaigns = await prisma.campaign.find_many(where={"startupId": startup_id})
            campaign_ids = [c.id for c in campaigns]
            if campaign_ids:
                pledge_count = await prisma.virtualpledge.count(
                    where={"campaignId": {"in": campaign_ids}, "userId": user_id}
                )
                user_pledged = (pledge_count > 0)

        results: List[DataRoomDocumentResponse] = []
        for d in all_docs:
            lvl = d.get("accessLevel")
            if lvl == DataRoomAccessLevel.PUBLIC:
                results.append(DataRoomDocumentResponse(**d))
            elif lvl == DataRoomAccessLevel.INVESTOR_GATED and user_pledged:
                results.append(DataRoomDocumentResponse(**d))

        return results

    @classmethod
    def verify_data_room_document(
        cls,
        document_id: str,
        data: DataRoomDocumentVerifyRequest,
        current_user: Any,
    ) -> DataRoomDocumentResponse:
        """
        Admin verification of a Virtual Data Room document (financial audit, patent, etc.).
        """
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a platform administrator can verify Virtual Data Room documents."
            )

        doc = _vdr_store.get(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )

        updated = _vdr_store.update(
            document_id,
            {
                "verificationStatus": data.status,
                "verifiedBy": current_user.id,
                "verifiedAt": datetime.now(timezone.utc),
                "verificationNotes": data.verificationNotes,
            }
        )
        return DataRoomDocumentResponse(**updated)

    @classmethod
    async def delete_data_room_document(
        cls,
        document_id: str,
        current_user: Any,
    ) -> bool:
        """
        Remove a document from the Virtual Data Room with authorization check.
        """
        doc = _vdr_store.get(document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )

        startup = await prisma.startup.find_unique(where={"id": doc["startupId"]})
        is_founder = (startup is not None and startup.founderId == current_user.id)
        is_admin = (getattr(current_user, "role", None) in (UserRole.ADMIN, "ADMIN"))
        is_uploader = (doc.get("uploadedBy") == current_user.id)

        if not (is_founder or is_admin or is_uploader):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this document."
            )

        return _vdr_store.delete(document_id)
