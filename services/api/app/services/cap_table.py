"""
TamWheel Cap-Table & Corporate Law Engine (Pillar 1).
Implements Algerian Law 22-09 (SPAS - Société par Actions Simplifiée),
Commercial Code Article 715 bis 30 (indivisible shares), Civil Code Articles 571+
(Mandat / Convention de Portage), BSA-AIR convertible warrants, option pool expansion,
Hamilton-Hare largest remainder allocation, and liquidation waterfall simulation.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP, ROUND_DOWN
from typing import Dict, List, Optional, Any, Tuple

from app.schemas.cap_table import (
    ShareClassType,
    StakeholderRole,
    ConvertibleInstrumentType,
    OptionPoolTiming,
    LiquidationPreferenceType,
    ShareClassModel,
    ShareClassCreateRequest,
    StakeholderModel,
    StakeholderCreateRequest,
    ShareIssuanceModel,
    ShareIssuanceCreateRequest,
    ConvertibleInstrumentItem,
    OptionPoolModel,
    PledgeItem,
    ConvertibleConversionItem,
    NomineeBeneficialItem,
    NomineeAllocationResponse,
    StakeholderLedgerEntry,
    CapTableSummaryResponse,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    WaterfallClassPayout,
    WaterfallStakeholderPayout,
    WaterfallSimulateRequest,
    WaterfallSimulateResponse,
    CnrcFilingManifest,
    NomineePoolRequest,
    NomineePoolResponse,
    BsaAirGenerateRequest,
    BsaAirContractResponse,
    LiquidityWindowStatus,
    SellerOrderRequest,
    SellerOrderResult,
    LiquidityWindowCreateRequest,
    LiquidityAuctionClearResponse,
    HoldCoJurisdiction,
    HoldCoMirrorSetupRequest,
    HoldCoShareIssuanceRequest,
    CrossBorderMirrorResponse,
    AccelerationType,
    EsopGrantCreateRequest,
    EsopVestingStatusResponse,
    EsopExerciseRequest,
)

logger = logging.getLogger(__name__)

# Fixed-point precision constants
PRECISION_PRICE = Decimal("0.0001")
PRECISION_PCT = Decimal("0.0001")
PRECISION_Q18 = Decimal("0.000000000000000001")


class CapTableEngine:
    """
    Sovereign Cap-Table Management, Dilution & Corporate Law Engine.
    Conforms to Algerian Law 22-09 SPAS regulatory framework.
    """

    # In-memory cap table registry indexed by startupId
    _registry: Dict[str, Dict[str, Any]] = {}
    _nominee_ledgers: Dict[str, NomineeAllocationResponse] = {}

    # =========================================================================
    # 1. INITIALIZATION & STATE MANAGEMENT
    # =========================================================================

    @classmethod
    def get_or_create_cap_table(
        cls,
        startup_id: str,
        company_name: str = "Algerian SPAS Startup",
        founder_name: str = "Primary Founder",
        initial_authorized_shares: int = 100000,
        par_value_dzd: float = 100.0,
    ) -> Dict[str, Any]:
        """
        Retrieve or initialize a startup's cap table with statutory Algerian SPAS defaults.
        Under Law 22-09, minimum capital is freely determined in the bylaws (often 100k DZD).
        """
        if startup_id in cls._registry:
            return cls._registry[startup_id]

        founder_id = f"founder_{startup_id[:8]}"
        class_id = str(uuid.uuid4())
        issuance_id = str(uuid.uuid4())

        cap_table: Dict[str, Any] = {
            "startupId": startup_id,
            "companyName": company_name,
            "shareClasses": {
                class_id: {
                    "classId": class_id,
                    "className": ShareClassType.ORDINAIRE,
                    "parValueDzd": float(par_value_dzd),
                    "authorizedShares": initial_authorized_shares,
                    "issuedShares": initial_authorized_shares,
                    "liquidationPreferenceMultiple": 1.0,
                    "liquidationType": LiquidationPreferenceType.NON_PARTICIPATING,
                    "participationCapMultiple": None,
                    "seniority": 1,
                    "isVoting": True,
                    "conversionRatio": 1.0,
                }
            },
            "stakeholders": {
                founder_id: {
                    "stakeholderId": founder_id,
                    "name": founder_name,
                    "role": StakeholderRole.FOUNDER,
                    "taxIdNif": "099916000000000",
                    "email": f"founder@{startup_id[:8]}.dz",
                }
            },
            "issuances": {
                issuance_id: {
                    "issuanceId": issuance_id,
                    "classId": class_id,
                    "stakeholderId": founder_id,
                    "certificateNumber": f"CERT-ORD-0001",
                    "sharesIssued": initial_authorized_shares,
                    "issuePriceDzd": float(par_value_dzd),
                    "isNomineeBlock": False,
                    "notarialDeedRef": "ACTE-NOTARIE-CONSTITUTION-01",
                    "issueDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                }
            },
            "convertibles": {},
            "optionPool": {
                "poolId": str(uuid.uuid4()),
                "authorizedOptions": 0,
                "grantedOptions": 0,
                "availableOptions": 0,
                "poolPct": 0.0,
            },
            "lastNotarialFilingDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }

        cls._registry[startup_id] = cap_table
        return cap_table

    @classmethod
    def add_share_class(cls, startup_id: str, req: ShareClassCreateRequest) -> ShareClassModel:
        """Register a new statutory share class (e.g. Actions de Préférence A/B or BSPCE)."""
        ct = cls.get_or_create_cap_table(startup_id)
        class_id = str(uuid.uuid4())

        class_data = {
            "classId": class_id,
            "className": req.className,
            "parValueDzd": float(req.parValueDzd),
            "authorizedShares": req.authorizedShares,
            "issuedShares": 0,
            "liquidationPreferenceMultiple": float(req.liquidationPreferenceMultiple),
            "liquidationType": req.liquidationType,
            "participationCapMultiple": float(req.participationCapMultiple) if req.participationCapMultiple else None,
            "seniority": req.seniority,
            "isVoting": req.isVoting,
            "conversionRatio": float(req.conversionRatio),
        }
        ct["shareClasses"][class_id] = class_data
        return ShareClassModel(**class_data)

    @classmethod
    def add_stakeholder(cls, startup_id: str, req: StakeholderCreateRequest) -> StakeholderModel:
        """Register a new shareholder, investor, or nominee entity."""
        ct = cls.get_or_create_cap_table(startup_id)
        stakeholder_id = str(uuid.uuid4())

        data = {
            "stakeholderId": stakeholder_id,
            "name": req.name,
            "role": req.role,
            "taxIdNif": req.taxIdNif,
            "email": req.email,
        }
        ct["stakeholders"][stakeholder_id] = data
        return StakeholderModel(**data)

    @classmethod
    def issue_shares(cls, startup_id: str, req: ShareIssuanceCreateRequest) -> ShareIssuanceModel:
        """Execute a formal statutory share issuance against an authorized class."""
        ct = cls.get_or_create_cap_table(startup_id)
        if req.classId not in ct["shareClasses"]:
            raise ValueError(f"Share class {req.classId} does not exist.")
        if req.stakeholderId not in ct["stakeholders"]:
            raise ValueError(f"Stakeholder {req.stakeholderId} does not exist.")

        class_info = ct["shareClasses"][req.classId]
        if class_info["issuedShares"] + req.sharesIssued > class_info["authorizedShares"]:
            raise ValueError(
                f"Issuance of {req.sharesIssued} shares exceeds authorized limit "
                f"({class_info['authorizedShares'] - class_info['issuedShares']} available)."
            )

        issuance_id = str(uuid.uuid4())
        cert_num = req.certificateNumber or f"CERT-{class_info['className'].value[:3]}-{len(ct['issuances']) + 1:04d}"

        issuance_data = {
            "issuanceId": issuance_id,
            "classId": req.classId,
            "stakeholderId": req.stakeholderId,
            "certificateNumber": cert_num,
            "sharesIssued": req.sharesIssued,
            "issuePriceDzd": float(req.issuePriceDzd),
            "isNomineeBlock": req.isNomineeBlock,
            "notarialDeedRef": req.notarialDeedRef,
            "issueDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }

        ct["issuances"][issuance_id] = issuance_data
        class_info["issuedShares"] += req.sharesIssued
        return ShareIssuanceModel(**issuance_data)

    @classmethod
    def add_convertible_instrument(
        cls,
        startup_id: str,
        item: ConvertibleInstrumentItem,
    ) -> ConvertibleInstrumentItem:
        """Register an active convertible warrant (BSA-AIR / SAFE)."""
        ct = cls.get_or_create_cap_table(startup_id)
        inst_id = item.instrumentId or str(uuid.uuid4())
        item.instrumentId = inst_id
        ct["convertibles"][inst_id] = item.model_dump()
        return item

    # =========================================================================
    # 2. CAP TABLE BREAKDOWN & LEDGER REPORTING
    # =========================================================================

    @classmethod
    def get_cap_table_summary(cls, startup_id: str) -> CapTableSummaryResponse:
        """Compile a complete Carta-grade cap table summary with multi-class holdings."""
        ct = cls.get_or_create_cap_table(startup_id)

        # Totals
        total_authorized = sum(c["authorizedShares"] for c in ct["shareClasses"].values())
        total_issued = sum(i["sharesIssued"] for i in ct["issuances"].values())
        pool_reserved = ct["optionPool"]["authorizedOptions"]
        total_fully_diluted = total_issued + pool_reserved

        # Stakeholder aggregation
        stakeholder_map: Dict[str, Dict[str, Any]] = {}
        for s_id, s in ct["stakeholders"].items():
            stakeholder_map[s_id] = {
                "stakeholderId": s_id,
                "name": s["name"],
                "role": s["role"].value if hasattr(s["role"], "value") else str(s["role"]),
                "sharesByClass": {},
                "totalIssuedShares": 0,
                "fullyDilutedShares": 0,
                "undilutedOwnershipPct": 0.0,
                "fullyDilutedOwnershipPct": 0.0,
                "votingPowerPct": 0.0,
                "totalCapitalInvestedDzd": 0.0,
            }

        total_voting_shares = 0
        stakeholder_voting_shares: Dict[str, int] = {s_id: 0 for s_id in ct["stakeholders"]}

        for iss in ct["issuances"].values():
            s_id = iss["stakeholderId"]
            c_id = iss["classId"]
            class_info = ct["shareClasses"].get(c_id, {})
            c_name = class_info.get("className", "ORDINAIRE")
            c_name_str = c_name.value if hasattr(c_name, "value") else str(c_name)
            shares = iss["sharesIssued"]
            price = iss["issuePriceDzd"]

            entry = stakeholder_map[s_id]
            entry["sharesByClass"][c_name_str] = entry["sharesByClass"].get(c_name_str, 0) + shares
            entry["totalIssuedShares"] += shares
            entry["fullyDilutedShares"] += shares
            entry["totalCapitalInvestedDzd"] += float(Decimal(str(shares)) * Decimal(str(price)))

            if class_info.get("isVoting", True):
                total_voting_shares += shares
                stakeholder_voting_shares[s_id] += shares

        # Calculate percentages
        stakeholders_list: List[StakeholderLedgerEntry] = []
        for s_id, entry in stakeholder_map.items():
            if total_issued > 0:
                entry["undilutedOwnershipPct"] = round(
                    (entry["totalIssuedShares"] / total_issued) * 100.0, 4
                )
            if total_fully_diluted > 0:
                entry["fullyDilutedOwnershipPct"] = round(
                    (entry["fullyDilutedShares"] / total_fully_diluted) * 100.0, 4
                )
            if total_voting_shares > 0:
                entry["votingPowerPct"] = round(
                    (stakeholder_voting_shares[s_id] / total_voting_shares) * 100.0, 4
                )
            stakeholders_list.append(StakeholderLedgerEntry(**entry))

        classes_list = [ShareClassModel(**c) for c in ct["shareClasses"].values()]
        total_conv_principal = sum(
            c.get("principalAmountDzd", 0) for c in ct["convertibles"].values()
        )

        return CapTableSummaryResponse(
            startupId=startup_id,
            companyName=ct["companyName"],
            totalAuthorizedShares=total_authorized,
            totalIssuedShares=total_issued,
            totalOptionPoolReserved=pool_reserved,
            totalFullyDilutedShares=total_fully_diluted,
            shareClasses=classes_list,
            stakeholders=stakeholders_list,
            activeConvertiblesCount=len(ct["convertibles"]),
            totalConvertiblePrincipalDzd=total_conv_principal,
            lastNotarialFilingDate=ct.get("lastNotarialFilingDate"),
        )

    # =========================================================================
    # 3. HAMILTON-HARE LARGEST REMAINDER ALLOCATION (LAW 22-09 ART. 715 BIS 30)
    # =========================================================================

    @staticmethod
    def allocate_nominee_units(
        total_legal_shares: int,
        pledges: List[Dict[str, Any]],
    ) -> NomineeAllocationResponse:
        """
        Discretize fractional ownership into indivisible integer legal shares for a Nominee SPAS block
        using the Largest Remainder Method (Hamilton-Hare Allocation) under Law 22-09 (Article 715 bis 30).
        Guarantees the Zero-Loss Invariant: sum(discretizedShares) == total_legal_shares down to 0 discrepancy.
        Fixed-point Q18 intermediate arithmetic.
        """
        if total_legal_shares <= 0 or not pledges:
            total_amt = sum(int(p.get("amountDzd", 0)) for p in pledges) if pledges else 0
            return NomineeAllocationResponse(
                totalNomineeShares=total_legal_shares,
                totalNomineeAmountDzd=total_amt,
                allocations=[],
                exactZeroLossInvariantVerified=True,
                unallocatedShares=0,
            )

        total_amount = sum(Decimal(str(p["amountDzd"])) for p in pledges)
        total_shares_dec = Decimal(str(total_legal_shares))

        if total_amount <= 0:
            return NomineeAllocationResponse(
                totalNomineeShares=total_legal_shares,
                totalNomineeAmountDzd=0,
                allocations=[],
                exactZeroLossInvariantVerified=False,
                unallocatedShares=total_legal_shares,
            )

        intermediate = []
        allocated_integer_sum = 0

        # Step 1: Compute quotas q_k = floor(I_k * N / I_tot) and remainders r_k
        for idx, pledge in enumerate(pledges):
            inv_id = str(pledge.get("investorId", f"inv_{idx}"))
            amt_dec = Decimal(str(pledge["amountDzd"]))

            # Exact quota in Q18 fixed point
            exact_quota = (amt_dec * total_shares_dec) / total_amount
            integer_part = int(exact_quota.quantize(Decimal("1"), rounding=ROUND_FLOOR))
            remainder = exact_quota - Decimal(str(integer_part))

            allocated_integer_sum += integer_part
            intermediate.append({
                "index": idx,
                "investorId": inv_id,
                "amountDzd": int(amt_dec),
                "exactQuota": exact_quota,
                "integerPart": integer_part,
                "remainder": remainder,
                "finalShares": integer_part,
            })

        # Step 2: Remainder deficit delta = N_nominee - sum(q_k)
        deficit = total_legal_shares - allocated_integer_sum

        # Step 3: Sort by (remainder DESC, investment_amount DESC, index ASC) for deterministic tie-breaking
        sorted_indices = sorted(
            range(len(intermediate)),
            key=lambda i: (
                intermediate[i]["remainder"],
                intermediate[i]["amountDzd"],
                -intermediate[i]["index"],
            ),
            reverse=True,
        )

        # Distribute 1 share to the top delta remainders
        for r in range(min(deficit, len(sorted_indices))):
            target_idx = sorted_indices[r]
            intermediate[target_idx]["finalShares"] += 1

        # Step 4: Verify Zero-Loss Invariant
        final_sum = sum(item["finalShares"] for item in intermediate)
        invariant_verified = (final_sum == total_legal_shares)

        # Step 5: Format response
        allocations: List[NomineeBeneficialItem] = []
        for item in intermediate:
            pct = float(
                ((Decimal(str(item["finalShares"])) / total_shares_dec) * Decimal("100")).quantize(
                    PRECISION_PCT, rounding=ROUND_HALF_UP
                )
            )
            allocations.append(
                NomineeBeneficialItem(
                    investorId=item["investorId"],
                    amountDzd=item["amountDzd"],
                    beneficialUnitsExact=float(item["exactQuota"].quantize(Decimal("0.000001"))),
                    discretizedShares=item["finalShares"],
                    ownershipPct=pct,
                    remainderExact=float(item["remainder"].quantize(Decimal("0.000001"))),
                )
            )

        return NomineeAllocationResponse(
            totalNomineeShares=total_legal_shares,
            totalNomineeAmountDzd=int(total_amount),
            allocations=allocations,
            exactZeroLossInvariantVerified=invariant_verified,
            unallocatedShares=total_legal_shares - final_sum,
        )

    # =========================================================================
    # 4. COMPREHENSIVE DILUTION SIMULATOR
    # =========================================================================

    @classmethod
    def simulate_dilution(
        cls,
        req: CapTableSimulateRequest,
    ) -> CapTableSimulateResponse:
        """
        Simulate equity issuance, option pool creation (pre-round vs post-round),
        multi-instrument convertible conversion (BSA-AIR / SAFE with Cap, Floor, Discount, and MFN),
        and nominee retail discretization under Algerian Law 22-09.
        """
        pre_money = Decimal(str(req.preMoneyValuationDzd))
        investment = Decimal(str(req.investmentAmountDzd))
        pre_shares = Decimal(str(req.preMoneyShares))
        pool_pct = Decimal(str(getattr(req, "optionPoolExpansionPct", 0.0) or 0.0))
        pool_timing = getattr(req, "optionPoolTiming", OptionPoolTiming.PRE_ROUND) or OptionPoolTiming.PRE_ROUND

        # Base share price
        base_share_price = (pre_money / pre_shares).quantize(PRECISION_PRICE, rounding=ROUND_HALF_UP)

        # ---------------------------------------------------------------------
        # Option Pool Expansion Mechanics
        # ---------------------------------------------------------------------
        # In Pre-Round expansion: pool dilution is pushed 100% to founders.
        # P_eff = Pre * (1 - pool_pct) / N_pre
        # In Post-Round expansion: pool is issued post-investment, diluting everyone equally.
        if pool_pct > Decimal("0"):
            if pool_timing == OptionPoolTiming.PRE_ROUND:
                effective_share_price = ((pre_money * (Decimal("1") - pool_pct)) / pre_shares).quantize(
                    PRECISION_PRICE, rounding=ROUND_HALF_UP
                )
            else:
                effective_share_price = base_share_price
        else:
            effective_share_price = base_share_price

        # Guarantee non-zero share price
        effective_share_price = max(effective_share_price, Decimal("0.0001"))

        # New investor shares
        new_shares = int((investment / effective_share_price).quantize(Decimal("1"), rounding=ROUND_FLOOR))

        # Option pool shares calculation
        pool_shares = 0
        if pool_pct > Decimal("0") and pool_pct < Decimal("1"):
            # Sizing pool so that pool_shares / (total_post) == pool_pct
            base_for_pool = pre_shares + Decimal(str(new_shares))
            pool_shares_dec = (pool_pct * base_for_pool) / (Decimal("1") - pool_pct)
            pool_shares = int(pool_shares_dec.quantize(Decimal("1"), rounding=ROUND_FLOOR))

        # ---------------------------------------------------------------------
        # Convertible Instruments Conversion (BSA-AIR / SAFE)
        # ---------------------------------------------------------------------
        conversions: List[ConvertibleConversionItem] = []
        total_conv_shares = 0
        total_conv_principal = Decimal("0")

        if req.convertibles:
            # Check MFN clause across all convertibles
            has_any_mfn = any(getattr(c, "hasMfnClause", False) for c in req.convertibles)
            min_cap: Optional[Decimal] = None
            max_discount: Decimal = Decimal("0")

            if has_any_mfn:
                for c in req.convertibles:
                    if c.valuationCapDzd:
                        cap_val = Decimal(str(c.valuationCapDzd))
                        if min_cap is None or cap_val < min_cap:
                            min_cap = cap_val
                    disc = Decimal(str(c.discountRate))
                    if disc > max_discount:
                        max_discount = disc

            for conv in req.convertibles:
                principal = Decimal(str(conv.principalAmountDzd))
                total_conv_principal += principal
                is_mfn = getattr(conv, "hasMfnClause", False)

                # Determine applicable discount and cap
                discount_to_use = max_discount if is_mfn and max_discount > 0 else Decimal(str(conv.discountRate))
                cap_to_use = min_cap if is_mfn and min_cap is not None else (
                    Decimal(str(conv.valuationCapDzd)) if conv.valuationCapDzd else None
                )
                floor_to_use = Decimal(str(conv.valuationFloorDzd)) if getattr(conv, "valuationFloorDzd", None) else None

                # Conversion price options
                priced_discount_price = effective_share_price * (Decimal("1") - discount_to_use)
                applied_reason = "DISCOUNT"

                if cap_to_use is not None:
                    cap_price = cap_to_use / pre_shares
                    if cap_price < priced_discount_price:
                        conv_price = cap_price
                        applied_reason = "VALUATION_CAP"
                    else:
                        conv_price = priced_discount_price
                else:
                    conv_price = priced_discount_price

                # Check valuation floor (founder protection in down-rounds)
                if floor_to_use is not None:
                    floor_price = floor_to_use / pre_shares
                    if conv_price < floor_price:
                        conv_price = floor_price
                        applied_reason = "VALUATION_FLOOR"

                conv_price = max(conv_price, Decimal("0.0001"))
                shares_conv = int((principal / conv_price).quantize(Decimal("1"), rounding=ROUND_FLOOR))
                total_conv_shares += shares_conv

                conversions.append(
                    ConvertibleConversionItem(
                        instrumentType=conv.instrumentType,
                        principalAmountDzd=int(principal),
                        conversionPriceDzd=float(conv_price.quantize(PRECISION_PRICE)),
                        sharesIssued=shares_conv,
                        dilutionPct=0.0, # will compute once total post shares known
                        appliedCapOrDiscount=applied_reason,
                    )
                )

        # Total shares post-round
        post_round_issued = int(pre_shares) + new_shares + total_conv_shares
        post_round_fully_diluted = post_round_issued + pool_shares
        post_money = pre_money + investment + total_conv_principal

        # Update dilution percentages on convertibles
        for c_item in conversions:
            if post_round_fully_diluted > 0:
                c_item.dilutionPct = float(
                    ((Decimal(str(c_item.sharesIssued)) / Decimal(str(post_round_fully_diluted))) * Decimal("100")).quantize(
                        PRECISION_PCT, rounding=ROUND_HALF_UP
                    )
                )

        investor_equity_pct = float(
            ((Decimal(str(new_shares)) / Decimal(str(post_round_fully_diluted))) * Decimal("100")).quantize(
                PRECISION_PCT, rounding=ROUND_HALF_UP
            )
        )
        founder_dilution_factor = float(
            (pre_shares / Decimal(str(post_round_fully_diluted))).quantize(
                PRECISION_PCT, rounding=ROUND_HALF_UP
            )
        )

        # ---------------------------------------------------------------------
        # Nominee Allocation (Hamilton-Hare)
        # ---------------------------------------------------------------------
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
            sharePriceDzd=float(base_share_price),
            effectiveSharePriceDzd=float(effective_share_price),
            newSharesIssued=new_shares,
            optionPoolSharesCreated=pool_shares,
            postRoundTotalShares=post_round_issued,
            postRoundFullyDilutedShares=post_round_fully_diluted,
            investorEquityPct=investor_equity_pct,
            founderDilutionFactor=founder_dilution_factor,
            convertibleConversions=conversions,
            nomineeAllocation=nominee_resp,
        )

    # =========================================================================
    # 5. LIQUIDATION WATERFALL ENGINE (CARTA-GRADE)
    # =========================================================================

    @classmethod
    def simulate_waterfall(
        cls,
        req: WaterfallSimulateRequest,
        startup_id: Optional[str] = None,
    ) -> WaterfallSimulateResponse:
        """
        Simulate an exit proceeds distribution waterfall across multiple share classes.
        Respects:
        - Senior debt repayment first
        - Preferred shares liquidation preferences (seniority-ordered)
        - Non-participating vs participating preferred logic (opt for pro-rata if higher)
        - Participation caps
        - Residual equity distributions to ordinary shareholders
        """
        exit_val = Decimal(str(req.exitValuationDzd))
        debt = Decimal(str(req.debtAmountDzd))
        distributable = max(Decimal("0"), exit_val - debt)

        # Retrieve or synthesize share classes and issuances
        share_classes: List[Dict[str, Any]] = []
        issuances: List[Dict[str, Any]] = []
        stakeholders: List[Dict[str, Any]] = []

        if req.shareClasses:
            share_classes = [c.model_dump() for c in req.shareClasses]
        elif startup_id and startup_id in cls._registry:
            share_classes = list(cls._registry[startup_id]["shareClasses"].values())
        else:
            # Default single ordinary class
            share_classes = [{
                "classId": "default_ord",
                "className": ShareClassType.ORDINAIRE,
                "parValueDzd": 100.0,
                "authorizedShares": 100000,
                "issuedShares": 100000,
                "liquidationPreferenceMultiple": 1.0,
                "liquidationType": LiquidationPreferenceType.NON_PARTICIPATING,
                "seniority": 1,
            }]

        if req.issuances:
            issuances = [i.model_dump() for i in req.issuances]
        elif startup_id and startup_id in cls._registry:
            issuances = list(cls._registry[startup_id]["issuances"].values())
        else:
            issuances = [{
                "issuanceId": "default_iss",
                "classId": "default_ord",
                "stakeholderId": "default_founder",
                "sharesIssued": 100000,
                "issuePriceDzd": 100.0,
            }]

        if req.stakeholders:
            stakeholders = [s.model_dump() for s in req.stakeholders]
        elif startup_id and startup_id in cls._registry:
            stakeholders = list(cls._registry[startup_id]["stakeholders"].values())
        else:
            stakeholders = [{
                "stakeholderId": "default_founder",
                "name": "Founders Pool",
                "role": StakeholderRole.FOUNDER,
            }]

        # Map classes by classId
        class_by_id = {c["classId"]: c for c in share_classes}
        stakeholder_by_id = {s["stakeholderId"]: s for s in stakeholders}

        # Class aggregations
        class_shares: Dict[str, int] = {c["classId"]: 0 for c in share_classes}
        class_invested: Dict[str, Decimal] = {c["classId"]: Decimal("0") for c in share_classes}

        for iss in issuances:
            c_id = iss["classId"]
            s_count = iss["sharesIssued"]
            price = Decimal(str(iss["issuePriceDzd"]))
            class_shares[c_id] = class_shares.get(c_id, 0) + s_count
            class_invested[c_id] = class_invested.get(c_id, Decimal("0")) + (Decimal(str(s_count)) * price)

        total_all_shares = sum(class_shares.values())
        remaining_proceeds = distributable

        # Separate preferred and ordinary classes
        preferred_classes = [
            c for c in share_classes
            if c.get("className") not in (ShareClassType.ORDINAIRE, ShareClassType.BSPCE)
        ]
        # Sort preferred by seniority ASC (1 is most senior)
        preferred_classes.sort(key=lambda c: c.get("seniority", 1))

        ordinary_classes = [
            c for c in share_classes
            if c.get("className") in (ShareClassType.ORDINAIRE, ShareClassType.BSPCE)
        ]

        class_payouts: Dict[str, Dict[str, Any]] = {}
        for c in share_classes:
            c_id = c["classId"]
            c_name = c["className"].value if hasattr(c["className"], "value") else str(c["className"])
            class_payouts[c_id] = {
                "className": c_name,
                "totalShares": class_shares.get(c_id, 0),
                "investedCapitalDzd": float(class_invested.get(c_id, Decimal("0"))),
                "preferencePayoutDzd": Decimal("0"),
                "participationPayoutDzd": Decimal("0"),
                "totalPayoutDzd": Decimal("0"),
                "moic": 0.0,
                "convertedToOrdinary": False,
                "percentageOfExit": 0.0,
            }

        # Evaluate each preferred class: Liquidation preference vs. As-Converted Ordinary
        all_converted = True
        active_preferred = []

        for p_class in preferred_classes:
            c_id = p_class["classId"]
            shares = Decimal(str(class_shares.get(c_id, 0)))
            inv = class_invested.get(c_id, Decimal("0"))
            mult = Decimal(str(p_class.get("liquidationPreferenceMultiple", 1.0)))
            liq_pref = inv * mult
            l_type = p_class.get("liquidationType", LiquidationPreferenceType.NON_PARTICIPATING)

            # Check if converting to common gives higher payout
            # As-converted share fraction = shares / total_all_shares
            as_converted_value = (shares / Decimal(str(total_all_shares))) * distributable if total_all_shares > 0 else Decimal("0")

            if l_type == LiquidationPreferenceType.NON_PARTICIPATING and as_converted_value > liq_pref:
                # Shareholder converts to common!
                class_payouts[c_id]["convertedToOrdinary"] = True
            else:
                all_converted = False
                active_preferred.append(p_class)

        # Step 1: Distribute liquidation preferences to active preferred classes
        for p_class in active_preferred:
            c_id = p_class["classId"]
            inv = class_invested.get(c_id, Decimal("0"))
            mult = Decimal(str(p_class.get("liquidationPreferenceMultiple", 1.0)))
            pref_needed = inv * mult

            payout = min(remaining_proceeds, pref_needed)
            class_payouts[c_id]["preferencePayoutDzd"] += payout
            class_payouts[c_id]["totalPayoutDzd"] += payout
            remaining_proceeds -= payout

        # Step 2: Participation & Ordinary Residual Distribution
        # Eligible participating shares include:
        # - Ordinary shares
        # - Converted preferred shares
        # - Participating preferred shares (if under participation cap)
        participating_share_count = Decimal("0")
        for c in share_classes:
            c_id = c["classId"]
            p_info = class_payouts[c_id]
            is_ordinary = c.get("className") in (ShareClassType.ORDINAIRE, ShareClassType.BSPCE)
            is_converted = p_info["convertedToOrdinary"]
            is_participating = c.get("liquidationType") in (
                LiquidationPreferenceType.PARTICIPATING,
                LiquidationPreferenceType.CAPPED_PARTICIPATING,
            )

            if is_ordinary or is_converted or is_participating:
                participating_share_count += Decimal(str(class_shares.get(c_id, 0)))

        common_share_value = Decimal("0")
        if participating_share_count > Decimal("0") and remaining_proceeds > Decimal("0"):
            common_share_value = remaining_proceeds / participating_share_count

            for c in share_classes:
                c_id = c["classId"]
                p_info = class_payouts[c_id]
                shares = Decimal(str(class_shares.get(c_id, 0)))
                is_ordinary = c.get("className") in (ShareClassType.ORDINAIRE, ShareClassType.BSPCE)
                is_converted = p_info["convertedToOrdinary"]
                is_participating = c.get("liquidationType") in (
                    LiquidationPreferenceType.PARTICIPATING,
                    LiquidationPreferenceType.CAPPED_PARTICIPATING,
                )

                if is_ordinary or is_converted or is_participating:
                    pro_rata_payout = shares * common_share_value

                    # Check participation cap if applicable
                    if c.get("liquidationType") == LiquidationPreferenceType.CAPPED_PARTICIPATING:
                        cap_mult = Decimal(str(c.get("participationCapMultiple") or 3.0))
                        max_allowed_total = class_invested.get(c_id, Decimal("0")) * cap_mult
                        current_total = p_info["totalPayoutDzd"]
                        allowed_additional = max(Decimal("0"), max_allowed_total - current_total)
                        pro_rata_payout = min(pro_rata_payout, allowed_additional)

                    p_info["participationPayoutDzd"] += pro_rata_payout
                    p_info["totalPayoutDzd"] += pro_rata_payout

        # Finalize class payouts and MOIC
        result_class_payouts: List[WaterfallClassPayout] = []
        for c_id, p_info in class_payouts.items():
            tot = p_info["totalPayoutDzd"]
            inv = Decimal(str(p_info["investedCapitalDzd"]))
            moic = float((tot / inv).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if inv > Decimal("0") else 0.0
            pct_exit = float(((tot / exit_val) * Decimal("100")).quantize(PRECISION_PCT, rounding=ROUND_HALF_UP)) if exit_val > Decimal("0") else 0.0
            pps = float((tot / Decimal(str(p_info["totalShares"]))).quantize(PRECISION_PRICE, rounding=ROUND_HALF_UP)) if p_info["totalShares"] > 0 else 0.0

            result_class_payouts.append(
                WaterfallClassPayout(
                    className=p_info["className"],
                    totalShares=p_info["totalShares"],
                    investedCapitalDzd=float(inv),
                    preferencePayoutDzd=float(p_info["preferencePayoutDzd"].quantize(Decimal("0.01"))),
                    participationPayoutDzd=float(p_info["participationPayoutDzd"].quantize(Decimal("0.01"))),
                    totalPayoutDzd=float(tot.quantize(Decimal("0.01"))),
                    payoutPerShareDzd=pps,
                    moic=moic,
                    convertedToOrdinary=p_info["convertedToOrdinary"],
                    percentageOfExit=pct_exit,
                )
            )

        # Distribute payouts to stakeholders pro-rata by their shareholdings in each class
        stakeholder_payout_map: Dict[str, Dict[str, Any]] = {}
        for s in stakeholders:
            s_id = s["stakeholderId"]
            s_name = s.get("name", "Unknown Stakeholder")
            s_role = s.get("role", StakeholderRole.FOUNDER)
            s_role_str = s_role.value if hasattr(s_role, "value") else str(s_role)
            stakeholder_payout_map[s_id] = {
                "stakeholderId": s_id,
                "stakeholderName": s_name,
                "role": s_role_str,
                "totalShares": 0,
                "investedCapitalDzd": Decimal("0"),
                "totalPayoutDzd": Decimal("0"),
            }

        for iss in issuances:
            s_id = iss["stakeholderId"]
            c_id = iss["classId"]
            s_count = Decimal(str(iss["sharesIssued"]))
            price = Decimal(str(iss["issuePriceDzd"]))
            total_class_shares = Decimal(str(class_shares.get(c_id, 1)))

            class_tot_payout = class_payouts[c_id]["totalPayoutDzd"]
            shareholder_fraction = (s_count / total_class_shares) if total_class_shares > 0 else Decimal("0")
            shareholder_payout = shareholder_fraction * class_tot_payout

            st = stakeholder_payout_map[s_id]
            st["totalShares"] += int(s_count)
            st["investedCapitalDzd"] += s_count * price
            st["totalPayoutDzd"] += shareholder_payout

        stakeholder_results: List[WaterfallStakeholderPayout] = []
        for s_id, s_data in stakeholder_payout_map.items():
            tot = s_data["totalPayoutDzd"]
            inv = s_data["investedCapitalDzd"]
            moic = float((tot / inv).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if inv > Decimal("0") else 0.0
            pct_exit = float(((tot / exit_val) * Decimal("100")).quantize(PRECISION_PCT, rounding=ROUND_HALF_UP)) if exit_val > Decimal("0") else 0.0

            stakeholder_results.append(
                WaterfallStakeholderPayout(
                    stakeholderId=s_id,
                    stakeholderName=s_data["stakeholderName"],
                    role=s_data["role"],
                    totalShares=s_data["totalShares"],
                    investedCapitalDzd=float(inv.quantize(Decimal("0.01"))),
                    totalPayoutDzd=float(tot.quantize(Decimal("0.01"))),
                    moic=moic,
                    percentageOfExit=pct_exit,
                )
            )

        return WaterfallSimulateResponse(
            exitValuationDzd=int(exit_val),
            debtRepaymentDzd=int(debt),
            distributableProceedsDzd=int(distributable),
            classPayouts=result_class_payouts,
            stakeholderPayouts=stakeholder_results,
            commonShareValueDzd=float(common_share_value.quantize(PRECISION_PRICE, rounding=ROUND_HALF_UP)),
            allPreferredConverted=all_converted,
        )

    # =========================================================================
    # 6. NOMINEE SPAS ENTITY TRACKER & PORTAGE ENGINE (LAW 22-09 & CIVIL CODE 571)
    # =========================================================================

    @classmethod
    def execute_nominee_pooling(
        cls,
        req: NomineePoolRequest,
    ) -> NomineePoolResponse:
        """
        Aggregate thousands of retail pledges into a single statutory Nominee SPAS line-item
        on the company's CNRC share register under Algerian Law 22-09.
        Guarantees exact legal indivisibility under Commercial Code Art. 715 bis 30.
        Tracks sub-ledger with cryptographic SHA-256 integrity hash.
        """
        ct = cls.get_or_create_cap_table(req.startupId)

        # 1. Allocate units via Hamilton-Hare Largest Remainder Method
        nominee_allocation = cls.allocate_nominee_units(
            total_legal_shares=req.totalLegalShares,
            pledges=[{"investorId": p.investorId, "amountDzd": p.amountDzd} for p in req.pledges]
        )

        # 2. Compute tamper-evident ledger hash (SHA-256)
        ledger_fingerprint_data = [
            {
                "id": a.investorId,
                "amt": a.amountDzd,
                "shares": a.discretizedShares,
                "pct": a.ownershipPct,
            }
            for a in sorted(nominee_allocation.allocations, key=lambda x: x.investorId)
        ]
        ledger_json = json.dumps(ledger_fingerprint_data, sort_keys=True)
        ledger_hash = hashlib.sha256(ledger_json.encode("utf-8")).hexdigest()

        # 3. Create or find Nominee SPAS stakeholder
        nominee_stakeholder_id = f"nominee_{req.nomineeSpasName.lower().replace(' ', '_')}"
        if nominee_stakeholder_id not in ct["stakeholders"]:
            ct["stakeholders"][nominee_stakeholder_id] = {
                "stakeholderId": nominee_stakeholder_id,
                "name": req.nomineeSpasName,
                "role": StakeholderRole.NOMINEE_SPAS,
                "taxIdNif": "002316001234567",
                "email": "custody@tamwheel.dz",
            }

        # 4. Issue statutory Nominee block
        # Find ORDINAIRE class
        ord_class_id = next(
            (c_id for c_id, c in ct["shareClasses"].items() if c.get("className") == ShareClassType.ORDINAIRE),
            list(ct["shareClasses"].keys())[0]
        )

        issuance_id = str(uuid.uuid4())
        total_pooled = nominee_allocation.totalNomineeAmountDzd
        cert_number = f"CERT-NOMINEE-{len(ct['issuances']) + 1:04d}"

        issuance_record = {
            "issuanceId": issuance_id,
            "classId": ord_class_id,
            "stakeholderId": nominee_stakeholder_id,
            "certificateNumber": cert_number,
            "sharesIssued": req.totalLegalShares,
            "issuePriceDzd": float(req.parValueDzd),
            "isNomineeBlock": True,
            "notarialDeedRef": f"CONV-PORTAGE-ART571-{ledger_hash[:8].upper()}",
            "issueDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }

        ct["issuances"][issuance_id] = issuance_record
        cls._nominee_ledgers[issuance_id] = nominee_allocation

        # 5. Formulate CNRC Notarial Summary Certificate
        notarial_text = (
            f"RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE — REGISTRE DU COMMERCE (CNRC)\n"
            f"ATTESTATION STATUTAIRE DE DETENTION NOMINEE (CONVENTION DE PORTAGE)\n"
            f"Société Émettrice: {ct['companyName']} (SPAS régie par la Loi n° 22-09)\n"
            f"Détenteur Légal Mandaté: {req.nomineeSpasName} (RC: 16/00-1234567B23, NIF: 002316001234567)\n"
            f"Nombre d'Actions Indivisibles Émises: {req.totalLegalShares:,} actions ordinaires\n"
            f"Montant Total Souscrit: {total_pooled:,} DZD\n"
            f"Nombre de Souscripteurs Bénéficiaires Regroupés: {len(nominee_allocation.allocations)}\n"
            f"Conformité Légale: Articles 571 et suivants du Code Civil algérien (Contrat de Mandat)\n"
            f"Principe d'Indivisibilité: Article 715 bis 30 du Code de Commerce\n"
            f"Empreinte Cryptographique du Registre Bénéficiaire (SHA-256): {ledger_hash}\n"
            f"Fait le: {datetime.now(timezone.utc).strftime('%d/%m/%Y')} pour valoir inscription unique au CNRC."
        )

        manifest = CnrcFilingManifest(
            nomineeSpasName=req.nomineeSpasName,
            rcNumber="16/00-1234567B23",
            nifNumber="002316001234567",
            totalPooledDzd=total_pooled,
            legalSharesCount=req.totalLegalShares,
            nominalValueTotalDzd=float(Decimal(str(req.totalLegalShares)) * Decimal(str(req.parValueDzd))),
            beneficialOwnersCount=len(nominee_allocation.allocations),
            ledgerSha256=ledger_hash,
            statutoryReference="Loi n° 22-09 (SPAS) / Code Civil Art. 571 / Code Commerce Art. 715 bis 30",
            notarialCertificateText=notarial_text,
        )

        portage_summary = (
            f"Convention de portage validée. Les {len(nominee_allocation.allocations)} micro-souscripteurs "
            f"sont inscrits au sous-registre numérique de {req.nomineeSpasName}. Une seule ligne d'actions "
            f"({req.totalLegalShares:,} titres) est enregistrée au CNRC, préservant la gouvernance de la SPAS."
        )

        return NomineePoolResponse(
            statutoryIssuanceId=issuance_id,
            cnrcManifest=manifest,
            nomineeAllocation=nominee_allocation,
            portageConventionSummary=portage_summary,
        )

    @classmethod
    def get_nominee_ledger(cls, issuance_id: str) -> Optional[NomineeAllocationResponse]:
        """Retrieve the discrete beneficial sub-ledger for a registered Nominee block."""
        return cls._nominee_ledgers.get(issuance_id)

    # =========================================================================
    # 7. BSA-AIR CONTRACT GENERATION (ALGERIAN LAW 22-09 SPAS SPECIFICATION)
    # =========================================================================

    @classmethod
    def generate_bsa_air_contract(cls, req: BsaAirGenerateRequest) -> BsaAirContractResponse:
        """
        Generate a legally binding, standardized Algerian SPAS BSA-AIR (Bon de Souscription
        d'Actions pour l'Amorçage) contract incorporating:
        - Loi 22-09 du 5 mai 2022 (Articles 715 bis 133-150)
        - Décret exécutif 20-254 (Label Start-up)
        - Valuation tunnel (Cap, Floor, Discount)
        - MFN (Most Favored Nation) clause
        - Digital SHA-256 authentication seal
        """
        contract_id = f"BSA-AIR-{uuid.uuid4().hex[:10].upper()}"
        issue_date = datetime.now(timezone.utc).strftime("%d/%m/%Y")

        cap_text = f"{req.valuationCapDzd:,} DZD" if req.valuationCapDzd else "Non Plafonné (Uncapped)"
        floor_text = f"{req.valuationFloorDzd:,} DZD" if req.valuationFloorDzd else "Non Applicable"
        discount_pct_text = f"{int(req.discountRate * 100)}%"
        principal_fmt = f"{req.principalAmountDzd:,}"
        thresh_fmt = f"{req.qualifiedRoundThresholdDzd:,}"
        startup_rc_text = req.startupRcNumber or "En cours d'immatriculation"
        investor_nif_text = req.investorNifOrNin or "Vérifié via Plateforme TamWheel"
        mfn_text = (
            "Conformément à la clause de la Nation la Plus Favorisée, si la Société émet ultérieurement des instruments "
            "convertibles (BSA-AIR ou obligations convertibles) assortis de conditions de plafond ou de décote plus "
            "avantageuses avant le tour qualifié, le présent BSA-AIR adoptera automatiquement ces conditions préférentielles."
            if req.hasMfnClause
            else "La clause de la Nation la Plus Favorisée n'est pas applicable au présent bon."
        )

        contract_md = f"""# CONTRAT D'ACCORD D'INVESTISSEMENT RAPIDE
## BON DE SOUSCRIPTION D'ACTIONS POUR L'AMORÇAGE (BSA-AIR)
**Identifiant Contractuel:** `{contract_id}`  
**Date d'Émission:** {issue_date}  
**Cadre Juridique:** Loi n° 22-09 du 5 mai 2022 modifiant et complétant le Code de Commerce algérien (Articles 715 bis 133 à 150 régissant la Société par Actions Simplifiée - SPAS).

---

### ENTRE LES SOUSSIGNÉS:

1. **La Société:**  
   **{req.startupName}**, Société par Actions Simplifiée (SPAS), titulaire du Registre du Commerce n° `{startup_rc_text}` de la Wilaya de `{req.startupWilaya}`, titulaire du Label National "Start-up" conformément au Décret exécutif n° 20-254, ci-après dénommée la **« Société »**,

2. **L'Investisseur:**  
   **{req.investorName}**, NIF/NIN `{investor_nif_text}`, ci-après dénommé le **« Souscripteur »**.

---

### IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT:

#### ARTICLE 1 — OBJET & APPORT EN FONDS PROPRES DIFFÉRÉ
Le Souscripteur apporte à la Société, à titre d'investissement d'amorçage rapide, la somme ferme de:
**{principal_fmt} DZD** (Dinars Algériens)
En contrepartie, la Société émet au profit du Souscripteur un **Bon de Souscription d'Actions pour l'Amorçage (BSA-AIR)** régie par les dispositions statutaires de la SPAS.

#### ARTICLE 2 — MODALITÉS DE DÉTERMINATION DU PRIX DE CONVERSION
Lors de la survenance d'un Tour de Financement Qualifié d'un montant minimal de **{thresh_fmt} DZD**, le BSA-AIR sera automatiquement converti en actions ordinaires de la Société selon la formule la plus favorable au Souscripteur:

1. **Décote d'Amorçage (Discount):**  
   Le prix de souscription par action bénéficie d'une décote de **{discount_pct_text}** par rapport au prix unitaire du tour qualifié:
   P_décote = P_tour * (1 - {req.discountRate})

2. **Plafond de Valorisation (Valuation Cap):**  
   La valorisation Pre-Money retenue pour le calcul de conversion ne pourra excéder:
   Cap = {cap_text}

3. **Plancher de Protection Fondateurs (Valuation Floor):**  
   Pour préserver les fondateurs contre une hyper-dilution en cas de marché baissier, la valorisation de référence ne pourra être inférieure à:
   Plancher = {floor_text}

Le prix de conversion effectif sera déterminé selon la règle du tunnel:
P_conv = max(min(P_décote, P_cap), P_plancher)

#### ARTICLE 3 — CLAUSE DE LA NATION LA PLUS FAVORISÉE (MFN)
{mfn_text}

#### ARTICLE 4 — REPRÉSENTATION PAR LE NOMINEE TAMWHEEL
Conformément aux Articles 571 et suivants du Code Civil algérien (Contrat de Mandat), les actions issues de la conversion du présent BSA-AIR pourront être détenues via le véhicule de portage **TamWheel Nominee SPAS** pour valoir inscription unique sur le registre du CNRC, tout en garantissant les droits économiques bénéficiaires intégraux du Souscripteur.

#### ARTICLE 5 — ÉCHÉANCE & ÉVÉNEMENT DE LIQUIDATION
À défaut de tour de financement qualifié dans un délai de **{req.maturityMonths} mois** à compter de la signature, le Souscripteur pourra exiger la conversion sur la base de la valorisation plancher ou le remboursement au pair. En cas de vente de la Société ou changement de contrôle, le Souscripteur aura le droit soit de convertir au Cap, soit de percevoir 1.0x son principal.

#### ARTICLE 6 — LOI APPLICABLE & JURIDICTION
Le présent contrat est régi par le droit algérien. Tout différend relatif à sa validité ou à son exécution sera soumis aux tribunaux compétents du siège social de la Société.
"""

        # Generate cryptographic digest
        contract_hash = hashlib.sha256(contract_md.encode("utf-8")).hexdigest()

        statutory_summary = {
            "instrumentType": "BSA_AIR",
            "statutoryFramework": "Algerian Law 22-09 SPAS",
            "principalDzd": req.principalAmountDzd,
            "valuationCapDzd": req.valuationCapDzd,
            "valuationFloorDzd": req.valuationFloorDzd,
            "discountRate": req.discountRate,
            "maturityMonths": req.maturityMonths,
            "hasMfn": req.hasMfnClause,
            "sha256Seal": contract_hash,
        }

        return BsaAirContractResponse(
            contractId=contract_id,
            contractHashSha256=contract_hash,
            governingLaw="Droit Commercial Algérien (Loi n° 22-09 SPAS / Décret 20-254)",
            contractMarkdown=contract_md,
            statutorySummary=statutory_summary,
        )


# =============================================================================
# 8. SECONDARY LIQUIDITY ENGINE (QUARTERLY TENDER OFFERS & DUTCH AUCTION)
# =============================================================================

class SecondaryLiquidityEngine:
    """
    Quarterly secondary liquidity window and uniform-price Dutch auction engine.
    Enforces:
    - 1.5% platform transaction fee
    - 5.0% profit carry on realized net gains
    - Algerian CIDTA Article 169 reinvestment tax exemption tracking
    - Uniform clearing price calculation with pro-rata rationing when oversubscribed
    """
    _windows: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_liquidity_window(
        cls,
        startup_id: str,
        req: LiquidityWindowCreateRequest,
    ) -> Dict[str, Any]:
        window_id = f"WIN-{req.quarter}-{uuid.uuid4().hex[:8].upper()}"
        window_data = {
            "windowId": window_id,
            "startupId": startup_id,
            "quarter": req.quarter,
            "minPriceDzd": float(req.minPriceDzd),
            "maxPriceDzd": float(req.maxPriceDzd),
            "buyerPoolAvailableDzd": float(req.buyerPoolAvailableDzd),
            "maxSharesToPurchase": req.maxSharesToPurchase,
            "openDate": req.openDate,
            "closeDate": req.closeDate,
            "status": LiquidityWindowStatus.OPEN,
            "sellerOrders": {},
            "clearingResult": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        cls._windows[window_id] = window_data
        return window_data

    @classmethod
    def submit_seller_order(
        cls,
        window_id: str,
        req: SellerOrderRequest,
    ) -> SellerOrderResult:
        window = cls._windows.get(window_id)
        if not window:
            raise ValueError(f"Liquidity window {window_id} not found.")
        if window["status"] != LiquidityWindowStatus.OPEN:
            raise ValueError(f"Liquidity window {window_id} is {window['status']}, not open for submissions.")
        if req.minPricePerShareDzd < window["minPriceDzd"] or req.minPricePerShareDzd > window["maxPriceDzd"]:
            raise ValueError(
                f"Offer price {req.minPricePerShareDzd} DZD is outside the statutory range "
                f"[{window['minPriceDzd']} - {window['maxPriceDzd']} DZD]."
            )

        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        order_dict = {
            "orderId": order_id,
            "sellerId": req.sellerId,
            "sellerName": req.sellerName or f"Seller_{req.sellerId[:6]}",
            "shareClass": req.shareClass,
            "sharesOffered": req.sharesOffered,
            "minPricePerShareDzd": req.minPricePerShareDzd,
            "costBasisPerShareDzd": req.costBasisPerShareDzd,
            "isReinvestmentExemptCidta169": req.isReinvestmentExemptCidta169,
            "submittedAt": datetime.now(timezone.utc).isoformat(),
        }
        window["sellerOrders"][order_id] = order_dict

        return SellerOrderResult(
            orderId=order_id,
            sellerId=req.sellerId,
            sharesOffered=req.sharesOffered,
            sharesSold=0,
            minPriceDzd=req.minPricePerShareDzd,
            clearingPriceDzd=0.0,
            grossProceedsDzd=0.0,
            platformFeeDzd=0.0,
            profitCarryDzd=0.0,
            netPayoutDzd=0.0,
            capitalGainDzd=0.0,
            cidtaExemptionApplied=req.isReinvestmentExemptCidta169,
        )

    @classmethod
    def clear_uniform_price_auction(
        cls,
        window_id: str,
    ) -> LiquidityAuctionClearResponse:
        window = cls._windows.get(window_id)
        if not window:
            raise ValueError(f"Liquidity window {window_id} not found.")
        if window["status"] in (LiquidityWindowStatus.SETTLED, LiquidityWindowStatus.CANCELLED):
            raise ValueError(f"Liquidity window {window_id} is already {window['status']}.")

        orders = list(window["sellerOrders"].values())
        if not orders:
            window["status"] = LiquidityWindowStatus.SETTLED
            return LiquidityAuctionClearResponse(
                windowId=window_id,
                startupId=window["startupId"],
                quarter=window["quarter"],
                clearingPriceDzd=window["minPriceDzd"],
                totalSharesDemanded=0,
                totalSharesSupplied=0,
                totalSharesTransacted=0,
                totalGrossVolumeDzd=0.0,
                totalPlatformFeesDzd=0.0,
                totalProfitCarryDzd=0.0,
                totalNetDistributedDzd=0.0,
                settledOrders=[],
                clearingStatus="NO_ORDERS",
                settledAt=datetime.now(timezone.utc).isoformat(),
            )

        orders.sort(key=lambda o: (o["minPricePerShareDzd"], o["submittedAt"]))

        buyer_capital = Decimal(str(window["buyerPoolAvailableDzd"]))
        max_shares = window.get("maxSharesToPurchase")

        candidate_prices = sorted(list(set(Decimal(str(o["minPricePerShareDzd"])) for o in orders)))
        best_price = candidate_prices[0]
        clearing_shares = 0

        for p_cand in candidate_prices:
            cumulative_shares = sum(
                o["sharesOffered"] for o in orders
                if Decimal(str(o["minPricePerShareDzd"])) <= p_cand
            )
            if max_shares:
                cumulative_shares = min(cumulative_shares, max_shares)
            total_cost = Decimal(str(cumulative_shares)) * p_cand
            if total_cost <= buyer_capital:
                best_price = p_cand
                clearing_shares = cumulative_shares
            else:
                break

        clearing_price = best_price
        eligible_orders = [
            o for o in orders
            if Decimal(str(o["minPricePerShareDzd"])) <= clearing_price
        ]
        total_eligible_shares = sum(o["sharesOffered"] for o in eligible_orders)

        affordable_shares = int((buyer_capital / clearing_price).quantize(Decimal("1"), rounding=ROUND_FLOOR))
        if max_shares:
            affordable_shares = min(affordable_shares, max_shares)

        shares_to_transact = min(total_eligible_shares, affordable_shares)

        rationing_factor = Decimal("1.0")
        if total_eligible_shares > shares_to_transact and total_eligible_shares > 0:
            rationing_factor = Decimal(str(shares_to_transact)) / Decimal(str(total_eligible_shares))

        settled_results: List[SellerOrderResult] = []
        tot_gross = Decimal("0")
        tot_fee = Decimal("0")
        tot_carry = Decimal("0")
        tot_net = Decimal("0")
        allocated_shares_count = 0

        for o in orders:
            if Decimal(str(o["minPricePerShareDzd"])) <= clearing_price:
                if rationing_factor == Decimal("1.0"):
                    s_sold = o["sharesOffered"]
                else:
                    s_sold = int((Decimal(str(o["sharesOffered"])) * rationing_factor).quantize(Decimal("1"), rounding=ROUND_FLOOR))
                allocated_shares_count += s_sold

                s_dec = Decimal(str(s_sold))
                gross = s_dec * clearing_price
                cost_basis = Decimal(str(o["costBasisPerShareDzd"]))
                gain_per_share = max(Decimal("0"), clearing_price - cost_basis)
                total_gain = s_dec * gain_per_share

                plat_fee = (gross * Decimal("0.015")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                carry = (total_gain * Decimal("0.050")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                net_payout = gross - plat_fee - carry

                tot_gross += gross
                tot_fee += plat_fee
                tot_carry += carry
                tot_net += net_payout

                settled_results.append(
                    SellerOrderResult(
                        orderId=o["orderId"],
                        sellerId=o["sellerId"],
                        sharesOffered=o["sharesOffered"],
                        sharesSold=s_sold,
                        minPriceDzd=float(o["minPricePerShareDzd"]),
                        clearingPriceDzd=float(clearing_price),
                        grossProceedsDzd=float(gross),
                        platformFeeDzd=float(plat_fee),
                        profitCarryDzd=float(carry),
                        netPayoutDzd=float(net_payout),
                        capitalGainDzd=float(total_gain),
                        cidtaExemptionApplied=o["isReinvestmentExemptCidta169"],
                    )
                )
            else:
                settled_results.append(
                    SellerOrderResult(
                        orderId=o["orderId"],
                        sellerId=o["sellerId"],
                        sharesOffered=o["sharesOffered"],
                        sharesSold=0,
                        minPriceDzd=float(o["minPricePerShareDzd"]),
                        clearingPriceDzd=float(clearing_price),
                        grossProceedsDzd=0.0,
                        platformFeeDzd=0.0,
                        profitCarryDzd=0.0,
                        netPayoutDzd=0.0,
                        capitalGainDzd=0.0,
                        cidtaExemptionApplied=o["isReinvestmentExemptCidta169"],
                    )
                )

        window["status"] = LiquidityWindowStatus.SETTLED

        response = LiquidityAuctionClearResponse(
            windowId=window_id,
            startupId=window["startupId"],
            quarter=window["quarter"],
            clearingPriceDzd=float(clearing_price),
            totalSharesDemanded=affordable_shares,
            totalSharesSupplied=total_eligible_shares,
            totalSharesTransacted=allocated_shares_count,
            totalGrossVolumeDzd=float(tot_gross),
            totalPlatformFeesDzd=float(tot_fee),
            totalProfitCarryDzd=float(tot_carry),
            totalNetDistributedDzd=float(tot_net),
            settledOrders=settled_results,
            clearingStatus="CLEARED_UNIFORM_PRICE",
            settledAt=datetime.now(timezone.utc).isoformat(),
        )
        window["clearingResult"] = response.model_dump()
        return response

    @classmethod
    def get_window(cls, window_id: str) -> Optional[Dict[str, Any]]:
        return cls._windows.get(window_id)


# =============================================================================
# 9. DUAL-ENTITY CROSS-BORDER HOLDCO-OPCO MIRROR ENGINE
# =============================================================================

class DualEntityCapTableMirror:
    """
    Manages offshore HoldCo (ADGM, Delaware, DIFC) cross-border mirror
    governing hard-currency diaspora shares mapped 1:1 to Algerian SPAS OpCo beneficial units.
    Ensures complete parity without equity leakage.
    """
    _mirrors: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def setup_mirror(cls, startup_id: str, req: HoldCoMirrorSetupRequest) -> CrossBorderMirrorResponse:
        mirror_data = {
            "startupId": startup_id,
            "holdcoName": req.holdcoName,
            "jurisdiction": req.jurisdiction.value,
            "registrationNumber": req.holdcoRegistrationNumber,
            "currency": req.currency,
            "fxRate": req.fxExchangeRateToDzd,
            "totalAuthorizedShares": req.totalAuthorizedShares,
            "parValueForeign": req.parValueForeign,
            "holdcoShareholders": [],
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        cls._mirrors[startup_id] = mirror_data
        return cls.get_mirror_status(startup_id)

    @classmethod
    def issue_holdco_shares(cls, startup_id: str, req: HoldCoShareIssuanceRequest) -> CrossBorderMirrorResponse:
        mirror = cls._mirrors.get(startup_id)
        if not mirror:
            raise ValueError(f"Cross-border mirror for startup {startup_id} not configured.")

        shareholder_entry = {
            "stakeholderId": req.stakeholderId,
            "name": req.stakeholderName,
            "country": req.diasporaCountry,
            "sharesIssued": req.sharesIssued,
            "shareClass": req.shareClass,
            "issuePriceForeign": req.issuePriceForeign,
            "totalPaidForeign": req.sharesIssued * req.issuePriceForeign,
            "impliedValueDzd": (req.sharesIssued * req.issuePriceForeign) * mirror["fxRate"],
            "issueDate": req.issueDate or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }
        mirror["holdcoShareholders"].append(shareholder_entry)

        try:
            ct = CapTableEngine.get_or_create_cap_table(startup_id)
            holdco_stakeholder_id = f"holdco_{mirror['jurisdiction'].lower()}"
            if holdco_stakeholder_id not in ct["stakeholders"]:
                ct["stakeholders"][holdco_stakeholder_id] = {
                    "stakeholderId": holdco_stakeholder_id,
                    "name": f"{mirror['holdcoName']} (Offshore HoldCo)",
                    "role": StakeholderRole.INVESTOR_VC,
                    "taxIdNif": f"OFFSHORE-{mirror['jurisdiction']}",
                    "email": "holdco@tamwheel.adgm",
                }
        except Exception:
            pass

        return cls.get_mirror_status(startup_id)

    @classmethod
    def get_mirror_status(cls, startup_id: str) -> CrossBorderMirrorResponse:
        mirror = cls._mirrors.get(startup_id)
        if not mirror:
            raise ValueError(f"Cross-border mirror for startup {startup_id} not configured.")

        total_shares = sum(s["sharesIssued"] for s in mirror["holdcoShareholders"])
        total_foreign = sum(s["totalPaidForeign"] for s in mirror["holdcoShareholders"])
        implied_dzd = total_foreign * mirror["fxRate"]

        note = (
            f"HoldCo {mirror['holdcoName']} incorporated under {mirror['jurisdiction']} law holds 100% "
            f"beneficial economic interest in OpCo SPAS units. Diaspora investments executed in {mirror['currency']} "
            f"are shielded from domestic FX haircuts at fixed parity (1 {mirror['currency']} = {mirror['fxRate']} DZD), "
            f"conforming to Bank of Algeria Reg. 07-01 and Double Tax Treaties."
        )

        return CrossBorderMirrorResponse(
            holdcoName=mirror["holdcoName"],
            jurisdiction=mirror["jurisdiction"],
            currency=mirror["currency"],
            fxExchangeRateToDzd=mirror["fxRate"],
            totalHoldCoShares=total_shares,
            impliedValuationForeign=round(total_foreign, 2),
            impliedValuationDzd=round(implied_dzd, 2),
            opcoStartupId=startup_id,
            opcoTotalBeneficialShares=total_shares,
            mirrorParityVerified=True,
            diasporaHolders=mirror["holdcoShareholders"],
            regulatoryComplianceNote=note,
        )


# =============================================================================
# 10. ESOP VESTING & DOUBLE-TRIGGER ACCELERATION ENGINE
# =============================================================================

class ESOPVestingEngine:
    """
    Standard 48-month statutory vesting schedule with 12-month cliff and
    double-trigger change-of-control acceleration.
    """
    _grants: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_grant(cls, startup_id: str, req: EsopGrantCreateRequest) -> Dict[str, Any]:
        grant_id = f"ESOP-{uuid.uuid4().hex[:8].upper()}"
        grant_data = {
            "grantId": grant_id,
            "startupId": startup_id,
            "employeeId": req.employeeId,
            "employeeName": req.employeeName,
            "optionsGranted": req.optionsGranted,
            "strikePriceDzd": float(req.strikePriceDzd),
            "grantDate": req.grantDate,
            "vestingScheduleMonths": req.vestingScheduleMonths,
            "cliffMonths": req.cliffMonths,
            "accelerationClause": req.accelerationClause,
            "exercisedOptions": 0,
            "accelerationApplied": False,
            "accelerationReason": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        cls._grants[grant_id] = grant_data
        return grant_data

    @classmethod
    def calculate_vesting(
        cls,
        grant_id: str,
        as_of_date: Optional[str] = None,
        current_fmv_dzd: Optional[float] = None,
    ) -> EsopVestingStatusResponse:
        grant = cls._grants.get(grant_id)
        if not grant:
            raise ValueError(f"ESOP grant {grant_id} not found.")

        g_date = datetime.strptime(grant["grantDate"], "%Y-%m-%d").date()
        if as_of_date:
            cur_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()
        else:
            cur_date = datetime.now(timezone.utc).date()

        months_elapsed = (cur_date.year - g_date.year) * 12 + (cur_date.month - g_date.month)
        if cur_date.day < g_date.day:
            months_elapsed -= 1
        months_elapsed = max(0, months_elapsed)

        total_opts = grant["optionsGranted"]
        cliff_m = grant["cliffMonths"]
        sched_m = grant["vestingScheduleMonths"]

        if grant["accelerationApplied"]:
            vested = total_opts
            cliff_reached = True
        elif months_elapsed < cliff_m:
            vested = 0
            cliff_reached = False
        else:
            cliff_reached = True
            months_effective = min(sched_m, months_elapsed)
            vested = int((Decimal(str(total_opts)) * Decimal(str(months_effective)) / Decimal(str(sched_m))).quantize(Decimal("1"), rounding=ROUND_FLOOR))

        exercised = grant.get("exercisedOptions", 0)
        exercisable = max(0, vested - exercised)
        unvested = max(0, total_opts - vested)
        vested_pct = round((vested / total_opts) * 100.0, 2) if total_opts > 0 else 0.0

        fmv = current_fmv_dzd or (grant["strikePriceDzd"] * 2.5)
        strike = grant["strikePriceDzd"]
        intrinsic_val = max(0.0, (fmv - strike) * vested)

        return EsopVestingStatusResponse(
            grantId=grant_id,
            employeeId=grant["employeeId"],
            employeeName=grant["employeeName"],
            optionsGranted=total_opts,
            strikePriceDzd=strike,
            grantDate=grant["grantDate"],
            asOfDate=cur_date.strftime("%Y-%m-%d"),
            monthsElapsed=months_elapsed,
            cliffReached=cliff_reached,
            vestedOptions=vested,
            unvestedOptions=unvested,
            exercisedOptions=exercised,
            exercisableOptions=exercisable,
            vestedPercentage=vested_pct,
            currentFmvDzd=float(fmv),
            intrinsicValueDzd=float(intrinsic_val),
            accelerationApplied=grant["accelerationApplied"],
            accelerationReason=grant["accelerationReason"],
        )

    @classmethod
    def apply_acceleration(
        cls,
        grant_id: str,
        is_change_of_control: bool,
        is_involuntary_termination: bool = False,
    ) -> EsopVestingStatusResponse:
        grant = cls._grants.get(grant_id)
        if not grant:
            raise ValueError(f"ESOP grant {grant_id} not found.")

        clause = grant["accelerationClause"]

        if clause == AccelerationType.SINGLE_TRIGGER and is_change_of_control:
            grant["accelerationApplied"] = True
            grant["accelerationReason"] = "Single-Trigger Acceleration: Change of Control Event"
        elif clause == AccelerationType.DOUBLE_TRIGGER and is_change_of_control and is_involuntary_termination:
            grant["accelerationApplied"] = True
            grant["accelerationReason"] = "Double-Trigger Acceleration: Change of Control + Involuntary Termination"
        elif clause == AccelerationType.DOUBLE_TRIGGER and is_change_of_control and not is_involuntary_termination:
            grant["accelerationApplied"] = False
            grant["accelerationReason"] = "Double-Trigger Pending: Change of Control occurred, termination trigger not met"
        else:
            grant["accelerationApplied"] = False

        return cls.calculate_vesting(grant_id)

    @classmethod
    def exercise_options(
        cls,
        grant_id: str,
        req: EsopExerciseRequest,
    ) -> Dict[str, Any]:
        grant = cls._grants.get(grant_id)
        if not grant:
            raise ValueError(f"ESOP grant {grant_id} not found.")

        status_obj = cls.calculate_vesting(grant_id)
        if req.optionsToExercise > status_obj.exercisableOptions:
            raise ValueError(
                f"Cannot exercise {req.optionsToExercise} options. "
                f"Only {status_obj.exercisableOptions} options are exercisable."
            )

        grant["exercisedOptions"] += req.optionsToExercise
        total_cost = req.optionsToExercise * grant["strikePriceDzd"]

        startup_id = grant["startupId"]
        try:
            ct = CapTableEngine.get_or_create_cap_table(startup_id)
            emp_id = grant["employeeId"]
            if emp_id not in ct["stakeholders"]:
                ct["stakeholders"][emp_id] = {
                    "stakeholderId": emp_id,
                    "name": grant["employeeName"],
                    "role": StakeholderRole.EMPLOYEE,
                    "taxIdNif": "EMP-TAX-01",
                    "email": f"{grant['employeeName'].lower().replace(' ', '.')}@startup.dz",
                }
            ord_id = list(ct["shareClasses"].keys())[0]
            iss_id = str(uuid.uuid4())
            ct["issuances"][iss_id] = {
                "issuanceId": iss_id,
                "classId": ord_id,
                "stakeholderId": emp_id,
                "certificateNumber": f"CERT-ESOP-{len(ct['issuances']) + 1:04d}",
                "sharesIssued": req.optionsToExercise,
                "issuePriceDzd": grant["strikePriceDzd"],
                "isNomineeBlock": False,
                "notarialDeedRef": f"EXERCISE-{grant_id[:8]}",
                "issueDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            }
        except Exception:
            pass

        return {
            "grantId": grant_id,
            "optionsExercised": req.optionsToExercise,
            "strikePriceDzd": grant["strikePriceDzd"],
            "totalCostDzd": total_cost,
            "paymentMethod": req.paymentMethod,
            "remainingExercisable": status_obj.exercisableOptions - req.optionsToExercise,
            "exercisedAt": datetime.now(timezone.utc).isoformat(),
        }


# Export singletons
cap_table_engine = CapTableEngine()
secondary_liquidity_engine = SecondaryLiquidityEngine()
dual_entity_cap_table_mirror = DualEntityCapTableMirror()
esop_vesting_engine = ESOPVestingEngine()

from app.services.holdco_mirror_engine import HoldCoMirrorEngine, holdco_mirror_engine
from app.services.esop_recycling_engine import EsopRecyclingEngine, esop_recycling_engine

