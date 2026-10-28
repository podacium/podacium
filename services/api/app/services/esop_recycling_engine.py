"""
Dynamic ESOP Pool Rebalancing, Forfeiture Recycling & Algerian IRG Tax Engine.
Implements:
1. Standard 48-month statutory vesting schedule with 12-month cliff.
2. Automated recycling of forfeited unvested shares upon employee departure back
   into the unallocated ESOP reserve pool.
3. Anti-dilution rebalancing of option strike prices upon down-round financings
   (Full Ratchet, Broad-Based Weighted Average BBWA, Value Parity).
4. Algerian IRG (Impôt sur le Revenu Global) tax withholding calculation on stock
   option exercise discount spread under CIDTA Art. 67 and Art. 104.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR
import logging
from typing import Dict, List, Optional, Any, Tuple
import uuid

from app.schemas.esop_recycling import (
    TerminationType,
    AntiDilutionMethod,
    GrantStatus,
    EsopPoolInitRequest,
    EsopPoolStatusResponse,
    EsopGrantCreateRequest,
    EsopGrantDetailResponse,
    ForfeitureRecycleRequest,
    ForfeitureRecycleResponse,
    DownRoundAntiDilutionRequest,
    DownRoundAntiDilutionResponse,
    AdjustedGrantSummary,
    IrgTaxCalculationRequest,
    IrgTaxCalculationResponse,
    IrgTaxBracketBreakdown,
)

logger = logging.getLogger(__name__)


# CIDTA Article 104 Monthly Progressive IRG Brackets (Official Barème)
IRG_MONTHLY_BRACKETS: List[Tuple[Decimal, Optional[Decimal], Decimal]] = [
    (Decimal("0.0"), Decimal("20000.0"), Decimal("0.0")),        # 0 - 20,000 DZD: 0%
    (Decimal("20000.0"), Decimal("40000.0"), Decimal("23.0")),   # 20,001 - 40,000 DZD: 23%
    (Decimal("40000.0"), Decimal("80000.0"), Decimal("27.0")),   # 40,001 - 80,000 DZD: 27%
    (Decimal("80000.0"), Decimal("160000.0"), Decimal("30.0")),  # 80,001 - 160,000 DZD: 30%
    (Decimal("160000.0"), Decimal("320000.0"), Decimal("33.0")), # 160,001 - 320,000 DZD: 33%
    (Decimal("320000.0"), None, Decimal("35.0")),                # > 320,000 DZD: 35%
]


class EsopRecyclingEngine:
    """
    Manages ESOP pool life-cycle, vesting cliffs, automated forfeiture recycling,
    strike repricing upon down-rounds, and statutory Algerian tax withholding.
    """

    def __init__(self) -> None:
        # In-memory storage for pools, grants, and recycle audit events
        self._pools: Dict[str, Dict[str, Any]] = {}
        self._grants: Dict[str, Dict[str, Any]] = {}
        self._recycle_events: Dict[str, Dict[str, Any]] = {}

    # =========================================================================
    # 1. POOL INITIALIZATION & STATUS
    # =========================================================================

    def initialize_pool(self, req: EsopPoolInitRequest) -> EsopPoolStatusResponse:
        """Initializes or configures an ESOP option pool for a startup."""
        startup_id = req.startup_id
        pool = {
            "startup_id": startup_id,
            "pool_name": req.pool_name,
            "total_authorized_pool_shares": req.total_authorized_pool_shares,
            "allocated_granted_shares": 0,
            "unallocated_reserve_shares": req.total_authorized_pool_shares,
            "exercised_shares_total": 0,
            "forfeited_recycled_shares_total": 0,
            "par_value_dzd": req.par_value_dzd,
            "grant_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._pools[startup_id] = pool
        logger.info(f"Initialized ESOP pool for {startup_id}: {req.total_authorized_pool_shares} shares authorized")
        return self.get_pool_status(startup_id)

    def get_or_create_pool(self, startup_id: str) -> Dict[str, Any]:
        """Retrieves existing pool or initializes a default 100,000 shares pool."""
        if startup_id not in self._pools:
            self.initialize_pool(
                EsopPoolInitRequest(
                    startup_id=startup_id,
                    total_authorized_pool_shares=100000,
                    pool_name=f"SPAS {startup_id.upper()} ESOP Pool 2026",
                )
            )
        return self._pools[startup_id]

    def get_pool_status(self, startup_id: str) -> EsopPoolStatusResponse:
        """Returns the real-time status of the ESOP reserve pool."""
        pool = self.get_or_create_pool(startup_id)
        grant_ids = pool.get("grant_ids", [])
        active_grants = [self._grants[gid] for gid in grant_ids if gid in self._grants]

        vested_total = 0
        unvested_total = 0
        exercised_total = pool["exercised_shares_total"]

        for g in active_grants:
            if g["status"] in (GrantStatus.ACTIVE, GrantStatus.PARTIALLY_EXERCISED):
                status = self._compute_vesting_detail(g)
                vested_total += status["vested_options"]
                unvested_total += status["unvested_options"]

        total_auth = pool["total_authorized_pool_shares"]
        allocated = pool["allocated_granted_shares"]
        unallocated = pool["unallocated_reserve_shares"]

        utilization = (
            (Decimal(str(allocated)) / Decimal(str(total_auth)) * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if total_auth > 0
            else Decimal("0.0")
        )

        avail_pct = (
            (Decimal(str(unallocated)) / Decimal(str(total_auth)) * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if total_auth > 0
            else Decimal("0.0")
        )

        return EsopPoolStatusResponse(
            startup_id=startup_id,
            pool_name=pool["pool_name"],
            total_authorized_pool_shares=total_auth,
            allocated_granted_shares=allocated,
            unallocated_reserve_shares=unallocated,
            vested_shares_total=vested_total,
            unvested_shares_total=unvested_total,
            exercised_shares_total=exercised_total,
            forfeited_recycled_shares_total=pool["forfeited_recycled_shares_total"],
            pool_utilization_rate=utilization,
            available_pool_percentage=avail_pct,
            active_grants_count=len(
                [g for g in active_grants if g["status"] in (GrantStatus.ACTIVE, GrantStatus.PARTIALLY_EXERCISED)]
            ),
        )

    # =========================================================================
    # 2. GRANT CREATION & 48-MONTH / 12-MONTH CLIFF VESTING
    # =========================================================================

    def create_grant(self, req: EsopGrantCreateRequest) -> EsopGrantDetailResponse:
        """
        Creates an ESOP option grant deducted from the unallocated reserve pool,
        subordinated to a 48-month linear vesting schedule with a 12-month cliff.
        """
        pool = self.get_or_create_pool(req.startup_id)
        if pool["unallocated_reserve_shares"] < req.options_granted:
            raise ValueError(
                f"Insufficient unallocated pool shares. Requested: {req.options_granted}, "
                f"Available: {pool['unallocated_reserve_shares']}"
            )

        grant_id = f"ESOP-{uuid.uuid4().hex[:8].upper()}"
        now_str = datetime.now(timezone.utc).isoformat()

        grant_data = {
            "grant_id": grant_id,
            "startup_id": req.startup_id,
            "employee_id": req.employee_id,
            "employee_name": req.employee_name,
            "employee_email": req.employee_email,
            "role_title": req.role_title,
            "options_granted": req.options_granted,
            "strike_price_dzd": req.strike_price_dzd,
            "grant_date": req.grant_date,
            "vesting_schedule_months": req.vesting_schedule_months,
            "cliff_months": req.cliff_months,
            "exercised_options": 0,
            "status": GrantStatus.ACTIVE,
            "created_at": now_str,
        }

        # Deduct from unallocated reserve pool
        pool["unallocated_reserve_shares"] -= req.options_granted
        pool["allocated_granted_shares"] += req.options_granted
        pool["grant_ids"].append(grant_id)

        self._grants[grant_id] = grant_data
        logger.info(
            f"Created ESOP grant {grant_id} for {req.employee_name} ({req.options_granted} options @ {req.strike_price_dzd} DZD)"
        )
        return self.get_grant_detail(grant_id)

    def _compute_vesting_detail(
        self, grant: Dict[str, Any], as_of_date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """Internal helper computing exact elapsed months and cliff vesting."""
        g_date = datetime.strptime(grant["grant_date"], "%Y-%m-%d").date()
        if as_of_date_str:
            as_of = datetime.strptime(as_of_date_str, "%Y-%m-%d").date()
        else:
            as_of = datetime.now(timezone.utc).date()

        months_elapsed = (as_of.year - g_date.year) * 12 + (as_of.month - g_date.month)
        if as_of.day < g_date.day:
            months_elapsed -= 1
        months_elapsed = max(0, months_elapsed)

        total_opts = grant["options_granted"]
        cliff_m = grant["cliff_months"]
        sched_m = grant["vesting_schedule_months"]

        if months_elapsed < cliff_m:
            vested = 0
            cliff_reached = False
        else:
            cliff_reached = True
            months_effective = min(sched_m, months_elapsed)
            # Standard 48-month integer linear vesting
            vested = int(
                (Decimal(str(total_opts)) * Decimal(str(months_effective)) / Decimal(str(sched_m))).quantize(
                    Decimal("1"), rounding=ROUND_FLOOR
                )
            )

        exercised = grant.get("exercised_options", 0)
        exercisable = max(0, vested - exercised)
        unvested = max(0, total_opts - vested)
        vested_pct = (
            (Decimal(str(vested)) / Decimal(str(total_opts)) * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if total_opts > 0
            else Decimal("0.0")
        )

        strike = grant["strike_price_dzd"]
        fmv_estimated = strike * Decimal("2.0")
        intrinsic_val = max(Decimal("0.0"), (fmv_estimated - strike) * Decimal(str(vested)))

        return {
            "months_elapsed": months_elapsed,
            "cliff_reached": cliff_reached,
            "vested_options": vested,
            "unvested_options": unvested,
            "exercised_options": exercised,
            "exercisable_options": exercisable,
            "vested_percentage": vested_pct,
            "intrinsic_value_dzd": intrinsic_val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "as_of_date": as_of.strftime("%Y-%m-%d"),
        }

    def get_grant_detail(
        self, grant_id: str, as_of_date: Optional[str] = None
    ) -> EsopGrantDetailResponse:
        """Retrieves real-time vesting progression of an individual ESOP grant."""
        grant = self._grants.get(grant_id)
        if not grant:
            raise ValueError(f"ESOP grant '{grant_id}' not found.")

        vesting = self._compute_vesting_detail(grant, as_of_date)

        return EsopGrantDetailResponse(
            grant_id=grant["grant_id"],
            startup_id=grant["startup_id"],
            employee_id=grant["employee_id"],
            employee_name=grant["employee_name"],
            role_title=grant["role_title"],
            options_granted=grant["options_granted"],
            strike_price_dzd=grant["strike_price_dzd"],
            grant_date=grant["grant_date"],
            as_of_date=vesting["as_of_date"],
            months_elapsed=vesting["months_elapsed"],
            cliff_months=grant["cliff_months"],
            cliff_reached=vesting["cliff_reached"],
            vesting_schedule_months=grant["vesting_schedule_months"],
            vested_options=vesting["vested_options"],
            unvested_options=vesting["unvested_options"],
            exercised_options=vesting["exercised_options"],
            exercisable_options=vesting["exercisable_options"],
            vested_percentage=vesting["vested_percentage"],
            grant_status=grant["status"],
            intrinsic_value_dzd=vesting["intrinsic_value_dzd"],
        )

    # =========================================================================
    # 3. AUTOMATED FORFEITURE RECYCLING ENGINE
    # =========================================================================

    def recycle_forfeited_options(
        self, req: ForfeitureRecycleRequest
    ) -> ForfeitureRecycleResponse:
        """
        Executes automated recycling of unvested or unexercised options upon employee departure.
        Restores forfeited options directly back into the startup's unallocated ESOP reserve pool.
        """
        grant = self._grants.get(req.grant_id)
        if not grant:
            raise ValueError(f"ESOP grant '{req.grant_id}' not found.")

        startup_id = grant["startup_id"]
        pool = self.get_or_create_pool(startup_id)

        # Snapshot before recycling
        prev_unallocated = pool["unallocated_reserve_shares"]
        prev_auth = pool["total_authorized_pool_shares"]
        prev_utilization = (
            (Decimal(str(pool["allocated_granted_shares"])) / Decimal(str(prev_auth)) * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if prev_auth > 0
            else Decimal("0.0")
        )

        vesting_at_departure = self._compute_vesting_detail(grant, req.departure_date)
        total_granted = grant["options_granted"]
        months_active = vesting_at_departure["months_elapsed"]
        cliff_reached = vesting_at_departure["cliff_reached"]
        vested_at_departure = vesting_at_departure["vested_options"]
        exercised_prior = grant.get("exercised_options", 0)

        # Unvested portion is ALWAYS forfeited immediately
        unvested_forfeited = vesting_at_departure["unvested_options"]

        # Vested portion handling based on termination type & PTEW
        vested_recycled = 0
        remaining_exercisable_ptew = 0
        ptew_exp_date: Optional[str] = None

        if req.termination_type == TerminationType.TERMINATION_FOR_CAUSE or req.voluntary_release_vested:
            # Bad leaver or voluntary release: 100% of unexercised options forfeited & recycled
            vested_recycled = max(0, vested_at_departure - exercised_prior)
            remaining_exercisable_ptew = 0
        else:
            # Good leaver: Vested options remain exercisable for ptew_days window
            remaining_exercisable_ptew = max(0, vested_at_departure - exercised_prior)
            dep_date = datetime.strptime(req.departure_date, "%Y-%m-%d").date()
            ptew_exp_date = (dep_date + timedelta(days=req.ptew_days)).strftime("%Y-%m-%d")

        total_recycled = unvested_forfeited + vested_recycled

        # RESTORE TO UNALLOCATED POOL
        pool["unallocated_reserve_shares"] += total_recycled
        pool["allocated_granted_shares"] -= total_recycled
        pool["forfeited_recycled_shares_total"] += total_recycled

        new_unallocated = pool["unallocated_reserve_shares"]
        new_utilization = (
            (Decimal(str(pool["allocated_granted_shares"])) / Decimal(str(prev_auth)) * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if prev_auth > 0
            else Decimal("0.0")
        )

        # Update grant status
        if remaining_exercisable_ptew == 0:
            grant["status"] = GrantStatus.TERMINATED_RECYCLED
        else:
            grant["status"] = GrantStatus.PARTIALLY_EXERCISED

        recycle_id = f"RECYCLE-{uuid.uuid4().hex[:8].upper()}"
        now_ts = datetime.now(timezone.utc).isoformat()

        audit_memo = (
            f"AUTOMATED ESOP RECYCLING AUDIT NOTICE:\n"
            f"Grant ID: {req.grant_id} | Employee: {grant['employee_name']} (ID: {grant['employee_id']})\n"
            f"Departure Date: {req.departure_date} | Reason: {req.termination_type.value} | Active: {months_active} months\n"
            f"Cliff Reached: {'YES' if cliff_reached else 'NO (100% Forfeited)'}\n"
            f"Shares Recycled to Pool: {total_recycled} (Unvested: {unvested_forfeited}, Vested: {vested_recycled})\n"
            f"Pool Available Shares: {prev_unallocated} -> {new_unallocated} (Utilization: {prev_utilization}% -> {new_utilization}%)\n"
            f"Governed under Law 22-09 SPAS Option Plan Regulations."
        )

        response = ForfeitureRecycleResponse(
            recycle_event_id=recycle_id,
            grant_id=req.grant_id,
            startup_id=startup_id,
            employee_id=grant["employee_id"],
            employee_name=grant["employee_name"],
            departure_date=req.departure_date,
            termination_type=req.termination_type,
            months_active=months_active,
            cliff_reached=cliff_reached,
            options_granted=total_granted,
            vested_options_at_departure=vested_at_departure,
            exercised_prior_to_departure=exercised_prior,
            unvested_forfeited_options=unvested_forfeited,
            vested_recycled_options=vested_recycled,
            total_recycled_to_pool=total_recycled,
            remaining_exercisable_during_ptew=remaining_exercisable_ptew,
            ptew_expiration_date=ptew_exp_date,
            previous_unallocated_pool_shares=prev_unallocated,
            new_unallocated_pool_shares=new_unallocated,
            previous_utilization_rate=prev_utilization,
            new_utilization_rate=new_utilization,
            audit_memo=audit_memo,
            timestamp=now_ts,
        )

        self._recycle_events[recycle_id] = response.model_dump()
        logger.info(
            f"Recycled {total_recycled} options from grant {req.grant_id} into pool {startup_id} "
            f"(New unallocated: {new_unallocated})"
        )
        return response

    # =========================================================================
    # 4. DOWN-ROUND ANTI-DILUTION STRIKE PRICE REBALANCING
    # =========================================================================

    def rebalance_down_round_grants(
        self, req: DownRoundAntiDilutionRequest
    ) -> DownRoundAntiDilutionResponse:
        """
        Rebalances and reprices employee option strike prices upon a down-round financing,
        restoring incentive alignment and retaining talent without violating Law 22-09 SPAS equity rules.
        """
        startup_id = req.startup_id
        pool = self.get_or_create_pool(startup_id)
        grant_ids = pool.get("grant_ids", [])

        if req.new_down_round_share_price_dzd >= req.previous_round_share_price_dzd:
            raise ValueError("New share price must be strictly lower than previous round share price (down-round).")

        haircut_pct = (
            (req.previous_round_share_price_dzd - req.new_down_round_share_price_dzd)
            / req.previous_round_share_price_dzd
            * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Repricing ratio computation
        if req.rebalancing_method == AntiDilutionMethod.FULL_RATCHET:
            repricing_ratio = (
                req.new_down_round_share_price_dzd / req.previous_round_share_price_dzd
            ).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        elif req.rebalancing_method == AntiDilutionMethod.BROAD_BASED_WEIGHTED_AVERAGE:
            # BBWA Formula: P_repriced = P_old * (S_pre + NewInvestment/P_old) / (S_pre + N_issued)
            s_pre = Decimal(str(req.shares_outstanding_pre_round))
            n_issued = Decimal(str(req.new_shares_issued_in_round))
            investment = n_issued * req.new_down_round_share_price_dzd
            shares_at_old_price = investment / req.previous_round_share_price_dzd

            bbwa_price = req.previous_round_share_price_dzd * (
                (s_pre + shares_at_old_price) / (s_pre + n_issued)
            )
            repricing_ratio = (bbwa_price / req.previous_round_share_price_dzd).quantize(
                Decimal("0.000001"), rounding=ROUND_HALF_UP
            )
        else:  # VALUE_PARITY_OPTION_EXCHANGE
            # Preserves total market value: strike reduced, option quantity constant
            repricing_ratio = (
                req.new_down_round_share_price_dzd / req.previous_round_share_price_dzd
            ).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

        adjusted_summaries: List[AdjustedGrantSummary] = []
        total_options_affected = 0

        for gid in grant_ids:
            g = self._grants.get(gid)
            if not g or g["status"] not in (GrantStatus.ACTIVE, GrantStatus.PARTIALLY_EXERCISED):
                continue

            old_strike = g["strike_price_dzd"]
            new_strike = (old_strike * repricing_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Ensure new strike does not drop below par value (e.g. 1000 DZD)
            par_val = pool.get("par_value_dzd", Decimal("1000.00"))
            if new_strike < par_val:
                new_strike = par_val

            g["strike_price_dzd"] = new_strike
            total_options_affected += g["options_granted"]

            adjusted_summaries.append(
                AdjustedGrantSummary(
                    grant_id=gid,
                    employee_id=g["employee_id"],
                    employee_name=g["employee_name"],
                    options_count_before=g["options_granted"],
                    options_count_after=g["options_granted"],
                    old_strike_price_dzd=old_strike,
                    new_strike_price_dzd=new_strike,
                    repricing_factor=repricing_ratio,
                    economic_retention_preserved=True,
                )
            )

        resolution_text = (
            f"DÉCISION COLLECTIVE DU PRÉSIDENT & DES ASSOCIÉS DE LA SPAS {startup_id.upper()}\n"
            f"Vu la Loi n° 22-09 du 24 juillet 2022 régissant la Société par Actions Simplifiée ;\n"
            f"Constatant la réalisation d'un tour de financement à la baisse (Down-Round) au prix unitaire de "
            f"{req.new_down_round_share_price_dzd} DZD (contre {req.previous_round_share_price_dzd} DZD précédemment, "
            f"décote constatée de {haircut_pct}%) ;\n"
            f"Il a été décidé, au titre du mécanisme anti-dilution {req.rebalancing_method.value}, "
            f"d'ajuster le prix d'exercice (Strike Price) des options de souscription d'actions attribuées aux salariés clés "
            f"par application d'un coefficient multiplicateur de {repricing_ratio}, afin de préserver l'alignement des intérêts "
            f"et la rétention des compétences stratégiques de l'entreprise."
        )

        return DownRoundAntiDilutionResponse(
            startup_id=startup_id,
            previous_share_price_dzd=req.previous_round_share_price_dzd,
            down_round_share_price_dzd=req.new_down_round_share_price_dzd,
            valuation_haircut_percentage=haircut_pct,
            rebalancing_method=req.rebalancing_method,
            total_active_grants_repriced=len(adjusted_summaries),
            total_options_affected=total_options_affected,
            adjusted_grants=adjusted_summaries,
            statutory_spas_board_resolution_text=resolution_text,
        )

    # =========================================================================
    # 5. ALGERIAN IRG TAX WITHHOLDING ENGINE (CIDTA ART. 67 / 104)
    # =========================================================================

    def calculate_irg_tax_withholding(
        self, req: IrgTaxCalculationRequest
    ) -> IrgTaxCalculationResponse:
        """
        Calculates Algerian IRG (Impôt sur le Revenu Global) tax withholding on stock option exercise
        discount spread pursuant to Article 67 and Article 104 of the Code des Impôts Directs et
        Taxes Assimilées (CIDTA).
        """
        if req.fair_market_value_dzd <= req.strike_price_dzd:
            discount_spread_per_share = Decimal("0.0")
            total_gross_spread = Decimal("0.0")
        else:
            discount_spread_per_share = req.fair_market_value_dzd - req.strike_price_dzd
            total_gross_spread = Decimal(str(req.options_to_exercise)) * discount_spread_per_share

        total_exercise_cost = Decimal(str(req.options_to_exercise)) * req.strike_price_dzd
        gross_market_val = Decimal(str(req.options_to_exercise)) * req.fair_market_value_dzd

        # Social Security (CNAS) assessment: 9% employee contribution on salary-linked fringe benefits
        if req.apply_social_security_cnas and total_gross_spread > Decimal("0.0"):
            cnas_deduction = (total_gross_spread * Decimal("0.09")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            cnas_deduction = Decimal("0.0")

        taxable_gain_base = max(Decimal("0.0"), total_gross_spread - cnas_deduction)

        bracket_breakdowns: List[IrgTaxBracketBreakdown] = []
        irg_tax_total = Decimal("0.0")

        if req.is_spas_bspce_flat_regime:
            # Special incentive regime: 15% flat final withholding tax
            irg_tax_total = (taxable_gain_base * Decimal("0.15")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            bracket_breakdowns.append(
                IrgTaxBracketBreakdown(
                    bracket_index=1,
                    bracket_range_dzd="SPAS Startup Label Incentive Flat Rate",
                    taxable_amount_in_bracket_dzd=taxable_gain_base,
                    bracket_rate_percent=Decimal("15.0"),
                    tax_generated_dzd=irg_tax_total,
                )
            )
            legal_basis = (
                "Régime fiscal dérogatoire des Bons de Souscription de Parts de Créateur d'Entreprise (BSPCE) "
                "et des Sociétés par Actions Simplifiées (Loi 22-09 & Décret exécutif n° 20-254) : Retenue à la source libératoire de 15%."
            )
        else:
            # Standard Progressive Scale under Article 104 CIDTA
            # We calculate progressive tax across monthly income brackets
            rem_income = taxable_gain_base
            for idx, (b_min, b_max, rate) in enumerate(IRG_MONTHLY_BRACKETS):
                if rem_income <= Decimal("0.0"):
                    break

                if b_max is not None:
                    bracket_capacity = b_max - b_min
                    taxable_in_b = min(rem_income, bracket_capacity)
                    range_label = f"{b_min:,.0f} - {b_max:,.0f} DZD"
                else:
                    taxable_in_b = rem_income
                    range_label = f"> {b_min:,.0f} DZD"

                tax_in_b = (taxable_in_b * (rate / Decimal("100"))).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                irg_tax_total += tax_in_b
                rem_income -= taxable_in_b

                bracket_breakdowns.append(
                    IrgTaxBracketBreakdown(
                        bracket_index=idx + 1,
                        bracket_range_dzd=range_label,
                        taxable_amount_in_bracket_dzd=taxable_in_b.quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        ),
                        bracket_rate_percent=rate,
                        tax_generated_dzd=tax_in_b,
                    )
                )

            # Apply Article 104 abatement if applicable (40% abatement, max 1,500 DZD per month)
            # For exceptional lump-sum exercise gains, statutory ceiling applies
            abatement = min((irg_tax_total * Decimal("0.40")), Decimal("1500.00")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            irg_tax_total = max(Decimal("0.0"), irg_tax_total - abatement)

            legal_basis = (
                "Articles 67 et 104 du Code des Impôts Directs et Taxes Assimilées (CIDTA) : "
                "Le gain de levée d'options (différence entre la valeur réelle des actions au jour de la levée et le prix d'exercice) "
                "constitue un complément de rémunération imposable au barème progressif de l'IRG dans la catégorie des traitements et salaires."
            )

        total_deductions = irg_tax_total + cnas_deduction
        net_take_home = max(Decimal("0.0"), total_gross_spread - total_deductions)

        effective_rate = (
            (irg_tax_total / total_gross_spread * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if total_gross_spread > Decimal("0.0")
            else Decimal("0.0")
        )

        g50_line_item = {
            "declaration_form": "Série G n° 50",
            "section": "Traitements et Salaires - Retenues IRG",
            "nature_du_versement": "Avantage en nature / Levée de Stock-Options (Art. 67 CIDTA)",
            "montant_brut_imposable_dzd": float(taxable_gain_base),
            "montant_retenue_irg_dzd": float(irg_tax_total),
            "cotisation_cnas_9pct_dzd": float(cnas_deduction),
            "code_compte_tresor": "IRG-SALAIRES-G50-104",
        }

        return IrgTaxCalculationResponse(
            options_exercised=req.options_to_exercise,
            strike_price_dzd=req.strike_price_dzd,
            fair_market_value_dzd=req.fair_market_value_dzd,
            total_exercise_cost_dzd=total_exercise_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            gross_market_value_dzd=gross_market_val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            discount_spread_per_share_dzd=discount_spread_per_share.quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            ),
            gross_exercise_gain_dzd=total_gross_spread.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            taxable_gain_base_dzd=taxable_gain_base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            irg_tax_withheld_dzd=irg_tax_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            effective_irg_rate_percent=effective_rate,
            cnas_social_security_dzd=cnas_deduction.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            total_statutory_deductions_dzd=total_deductions.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            net_employee_take_home_value_dzd=net_take_home.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            cidta_legal_basis=legal_basis,
            g50_filing_line_item=g50_line_item,
            bracket_breakdown=bracket_breakdowns,
        )


# Global singleton instance
esop_recycling_engine = EsopRecyclingEngine()
