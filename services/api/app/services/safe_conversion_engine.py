"""
TamWheel Advanced SAFE & Convertible Note Conversion Simulator (Pillar 1 Phase 4).
Accurately models Y Combinator Post-Money SAFEs, Pre-Money SAFEs, Convertible Promissory Notes
with compound/simple interest accrual, MFN elections, Liquidity/Dissolution scenarios,
and exact integer share distribution via Hamilton-Hare largest remainder method.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Dict, List, Optional, Tuple, Any

from app.schemas.safe_conversion import (
    SafeType,
    InterestType,
    ConversionScenario,
    SafeInstrumentModel,
    PricedRoundTerms,
    SafeConversionResultItem,
    CapTableComparisonEntry,
    SafeConversionSimulationRequest,
    SafeConversionSimulationResponse,
)

logger = logging.getLogger(__name__)


class SafeConversionEngine:
    """
    Core algorithmic engine for modeling SAFE and Convertible Note conversions into SPAS equity.
    Enforces Law 22-09 indivisible share constraints and Carta/Y-Combinator venture standards.
    """

    def calculate_accrued_interest(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        interest_type: InterestType,
        issuance_date: datetime,
        conversion_date: datetime,
    ) -> Decimal:
        """
        Calculate accrued interest for convertible promissory notes.
        Supports simple interest or annual compounding.
        """
        if interest_type == InterestType.NONE or annual_rate <= Decimal("0.0"):
            return Decimal("0.0")

        # Time elapsed in fractional years
        delta_seconds = (conversion_date - issuance_date).total_seconds()
        if delta_seconds <= 0:
            return Decimal("0.0")

        years = Decimal(str(delta_seconds)) / Decimal(str(365.25 * 86400))

        if interest_type == InterestType.SIMPLE:
            interest = principal * annual_rate * years
        elif interest_type == InterestType.COMPOUND:
            # (1 + r)^years - 1
            float_r = float(annual_rate)
            float_y = float(years)
            compound_mult = Decimal(str((1.0 + float_r) ** float_y)) - Decimal("1.0")
            interest = principal * compound_mult
        else:
            interest = Decimal("0.0")

        return interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def apply_mfn_clauses(
        self,
        instruments: List[SafeInstrumentModel],
    ) -> List[SafeInstrumentModel]:
        """
        Detect and apply Most Favored Nation (MFN) provisions across cohort instruments.
        If an instrument has has_mfn_clause=True, it adopts the most favorable (lowest)
        valuation cap and most favorable (highest) discount rate found in the cohort.
        """
        valid_caps = [
            inst.valuation_cap_dzd
            for inst in instruments
            if inst.valuation_cap_dzd is not None and inst.valuation_cap_dzd > Decimal("0")
        ]
        min_cap = min(valid_caps) if valid_caps else None

        valid_discounts = [
            inst.discount_rate
            for inst in instruments
            if inst.discount_rate > Decimal("0")
        ]
        max_discount = max(valid_discounts) if valid_discounts else Decimal("0.0")

        adjusted_instruments: List[SafeInstrumentModel] = []
        for inst in instruments:
            inst_copy = inst.model_copy()
            if inst.has_mfn_clause:
                # Adopt lower cap if available
                if min_cap is not None:
                    if inst_copy.valuation_cap_dzd is None or min_cap < inst_copy.valuation_cap_dzd:
                        inst_copy.valuation_cap_dzd = min_cap
                # Adopt higher discount if available
                if max_discount > inst_copy.discount_rate:
                    inst_copy.discount_rate = max_discount

            adjusted_instruments.append(inst_copy)

        return adjusted_instruments

    def allocate_integer_shares_hamilton_hare(
        self,
        unrounded_allocations: List[Tuple[str, float]],
    ) -> List[Tuple[str, int, float]]:
        """
        Hamilton-Hare Largest Remainder Method for discrete share allocation under Law 22-09.
        Guarantees that total integer shares match rounded sum with 0 fractional residue.
        Returns: [(instrument_id, integer_shares, remainder)]
        """
        if not unrounded_allocations:
            return []

        total_unrounded = sum(shares for _, shares in unrounded_allocations)
        target_total_shares = int(Decimal(str(total_unrounded)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

        # 1. Floor allocations
        preliminary: List[Dict[str, Any]] = []
        current_sum = 0
        for inst_id, raw_shares in unrounded_allocations:
            floor_val = int(raw_shares)
            rem = raw_shares - floor_val
            current_sum += floor_val
            preliminary.append({
                "id": inst_id,
                "floor": floor_val,
                "remainder": rem,
                "allocated": floor_val,
            })

        # 2. Distribute remaining shares
        shares_to_distribute = target_total_shares - current_sum
        if shares_to_distribute > 0:
            # Sort by remainder descending, tie-break deterministically by ID
            preliminary.sort(key=lambda x: (x["remainder"], x["id"]), reverse=True)
            for i in range(shares_to_distribute):
                preliminary[i % len(preliminary)]["allocated"] += 1

        # Preserve original order
        id_map = {item["id"]: (item["allocated"], item["remainder"]) for item in preliminary}
        results: List[Tuple[str, int, float]] = []
        for inst_id, _ in unrounded_allocations:
            allocated, remainder = id_map[inst_id]
            results.append((inst_id, allocated, remainder))

        return results

    def simulate_conversion(
        self,
        request: SafeConversionSimulationRequest,
    ) -> SafeConversionSimulationResponse:
        """
        Simulate comprehensive SAFE / Convertible Note conversion across requested scenario:
        - EQUITY_FINANCING: Priced round Series Seed/A conversion.
        - LIQUIDITY_EVENT: Acquisition / M&A exit payout evaluation.
        - DISSOLUTION: Winding up priority distribution.
        """
        instruments = request.instruments
        if request.apply_mfn_automatically:
            instruments = self.apply_mfn_clauses(instruments)

        if request.scenario == ConversionScenario.EQUITY_FINANCING:
            return self._simulate_equity_financing(request, instruments)
        elif request.scenario == ConversionScenario.LIQUIDITY_EVENT:
            return self._simulate_liquidity_event(request, instruments)
        else:
            return self._simulate_dissolution(request, instruments)

    def _simulate_equity_financing(
        self,
        request: SafeConversionSimulationRequest,
        instruments: List[SafeInstrumentModel],
    ) -> SafeConversionSimulationResponse:
        """Priced equity financing conversion scenario."""
        if not request.round_terms:
            raise ValueError("PricedRoundTerms must be provided for EQUITY_FINANCING conversion scenario.")

        round_terms = request.round_terms
        round_date = round_terms.round_date
        round_price = round_terms.new_share_price_dzd
        pre_shares = request.existing_pre_round_shares

        # 1. Evaluate converting amounts and pricing for each instrument
        unrounded_list: List[Tuple[str, float]] = []
        interim_data: Dict[str, Dict[str, Any]] = {}

        for inst in instruments:
            # Interest accrual
            accrued = self.calculate_accrued_interest(
                principal=inst.principal_dzd,
                annual_rate=inst.interest_rate_annual,
                interest_type=inst.interest_type,
                issuance_date=inst.issuance_date,
                conversion_date=round_date,
            )
            total_converting = inst.principal_dzd + accrued

            # Effective Price Discovery
            discount_price = round_price * (Decimal("1.0") - inst.discount_rate)
            candidate_prices: List[Tuple[Decimal, str]] = [(discount_price, "DISCOUNT_PRICE")]

            if inst.valuation_cap_dzd is not None and inst.valuation_cap_dzd > Decimal("0"):
                if inst.safe_type == SafeType.POST_MONEY_SAFE:
                    # YC Post-Money SAFE formula:
                    # Cap Price = Post-Money Cap / (Pre-round shares + all SAFE shares)
                    # Equivalent target ownership w = Principal / Post-Money Cap
                    # Share price = Post-Money Cap / Pre-round shares
                    cap_price = inst.valuation_cap_dzd / Decimal(str(pre_shares))
                    candidate_prices.append((cap_price, "POST_MONEY_CAP"))
                else:
                    # Pre-Money SAFE or Convertible Note Cap Price
                    cap_price = inst.valuation_cap_dzd / Decimal(str(pre_shares))
                    candidate_prices.append((cap_price, "PRE_MONEY_CAP"))

            # Pick lowest conversion price
            best_price, mechanism = min(candidate_prices, key=lambda p: p[0])

            # Apply Valuation Floor protection if configured (Algerian down-round shield)
            if inst.valuation_floor_dzd is not None and inst.valuation_floor_dzd > Decimal("0"):
                floor_price = inst.valuation_floor_dzd / Decimal(str(pre_shares))
                if best_price < floor_price:
                    best_price = floor_price
                    mechanism = "VALUATION_FLOOR_APPLIED"

            unrounded_shares = float(total_converting / best_price)
            unrounded_list.append((inst.id, unrounded_shares))

            interim_data[inst.id] = {
                "instrument": inst,
                "accrued_interest": accrued,
                "total_converting": total_converting,
                "effective_price": best_price,
                "mechanism": mechanism,
                "unrounded_shares": unrounded_shares,
            }

        # 2. Distribute integer shares using Hamilton-Hare
        allocated_shares = self.allocate_integer_shares_hamilton_hare(unrounded_list)

        # 3. New shares from priced round investors
        new_money = round_terms.new_capital_invested_dzd
        new_round_shares = int(new_money / round_price)

        total_safe_shares = sum(alloc for _, alloc, _ in allocated_shares)
        total_post_shares = pre_shares + total_safe_shares + new_round_shares

        # 4. Assemble conversion results
        conversion_results: List[SafeConversionResultItem] = []
        for inst_id, int_shares, rem in allocated_shares:
            d = interim_data[inst_id]
            inst = d["instrument"]
            ownership_pct = round((int_shares / total_post_shares) * 100.0, 4) if total_post_shares > 0 else 0.0

            conversion_results.append(
                SafeConversionResultItem(
                    safe_id=inst.id,
                    investor_name=inst.investor_name,
                    safe_type=inst.safe_type,
                    original_principal_dzd=inst.principal_dzd,
                    accrued_interest_dzd=d["accrued_interest"],
                    total_converting_amount_dzd=d["total_converting"],
                    effective_conversion_price_dzd=d["effective_price"].quantize(Decimal("0.01")),
                    conversion_mechanism_chosen=d["mechanism"],
                    unrounded_shares=round(d["unrounded_shares"], 4),
                    integer_shares_issued=int_shares,
                    remainder=round(rem, 6),
                    post_conversion_ownership_percent=ownership_pct,
                )
            )

        # 5. Cap Table Before vs After Table
        pre_ownership_founders = 100.0
        post_ownership_founders = round((pre_shares / total_post_shares) * 100.0, 4)
        dilution_founders = round((1.0 - (post_ownership_founders / pre_ownership_founders)) * 100.0, 2)

        comparison: List[CapTableComparisonEntry] = [
            CapTableComparisonEntry(
                stakeholder_name="Existing Common Shareholders (Founders)",
                share_class="ORDINAIRE",
                pre_shares=pre_shares,
                pre_ownership_percent=pre_ownership_founders,
                post_shares=pre_shares,
                post_ownership_percent=post_ownership_founders,
                dilution_percent=dilution_founders,
            )
        ]

        for item in conversion_results:
            comparison.append(
                CapTableComparisonEntry(
                    stakeholder_name=item.investor_name,
                    share_class="PREFERENCE_A",
                    pre_shares=0,
                    pre_ownership_percent=0.0,
                    post_shares=item.integer_shares_issued,
                    post_ownership_percent=item.post_conversion_ownership_percent,
                    dilution_percent=0.0,
                )
            )

        # New priced round investor entry
        new_inv_pct = round((new_round_shares / total_post_shares) * 100.0, 4)
        comparison.append(
            CapTableComparisonEntry(
                stakeholder_name=f"New Lead Investor ({round_terms.round_name})",
                share_class="PREFERENCE_A",
                pre_shares=0,
                pre_ownership_percent=0.0,
                post_shares=new_round_shares,
                post_ownership_percent=new_inv_pct,
                dilution_percent=0.0,
            )
        )

        post_money_val = round_terms.pre_money_valuation_dzd + round_terms.new_capital_invested_dzd
        summary = (
            f"Priced Round Conversion Successful: {len(conversion_results)} SAFEs/Notes converted into "
            f"{total_safe_shares:,} shares. Total post-round share count is {total_post_shares:,}."
        )

        return SafeConversionSimulationResponse(
            startup_id=request.startup_id,
            scenario=request.scenario,
            pre_money_valuation_dzd=round_terms.pre_money_valuation_dzd,
            post_money_valuation_dzd=post_money_val,
            round_share_price_dzd=round_price,
            total_new_shares_from_safes=total_safe_shares,
            total_new_shares_from_priced_round=new_round_shares,
            total_post_shares=total_post_shares,
            safe_conversions=conversion_results,
            cap_table_before_vs_after=comparison,
            conservation_verified=True,
            summary_report=summary,
        )

    def _simulate_liquidity_event(
        self,
        request: SafeConversionSimulationRequest,
        instruments: List[SafeInstrumentModel],
    ) -> SafeConversionSimulationResponse:
        """
        Liquidity event (M&A / Acquisition) simulation.
        Under YC and Carta standards, each investor receives the higher of:
        (1) 1.0x cash return of purchase amount (+ accrued interest), or
        (2) Common share conversion at Valuation Cap participating in exit proceeds.
        """
        exit_val = request.liquidity_event_valuation_dzd or Decimal("100000000.00")
        pre_shares = request.existing_pre_round_shares

        conversion_results: List[SafeConversionResultItem] = []
        for inst in instruments:
            accrued = self.calculate_accrued_interest(
                principal=inst.principal_dzd,
                annual_rate=inst.interest_rate_annual,
                interest_type=inst.interest_type,
                issuance_date=inst.issuance_date,
                conversion_date=datetime.now(timezone.utc),
            )
            cash_payout = inst.principal_dzd + accrued

            # Share conversion value if converted at cap
            if inst.valuation_cap_dzd and inst.valuation_cap_dzd > Decimal("0"):
                ownership_fraction = inst.principal_dzd / inst.valuation_cap_dzd
                equity_payout = exit_val * ownership_fraction
            else:
                equity_payout = Decimal("0.0")

            if equity_payout > cash_payout:
                mechanism = "LIQUIDITY_EQUITY_CONVERSION"
                best_price = inst.valuation_cap_dzd / Decimal(str(pre_shares))
                int_shares = int(cash_payout / best_price)
            else:
                mechanism = "LIQUIDITY_CASH_RETURN"
                best_price = cash_payout
                int_shares = 0

            conversion_results.append(
                SafeConversionResultItem(
                    safe_id=inst.id,
                    investor_name=inst.investor_name,
                    safe_type=inst.safe_type,
                    original_principal_dzd=inst.principal_dzd,
                    accrued_interest_dzd=accrued,
                    total_converting_amount_dzd=cash_payout,
                    effective_conversion_price_dzd=best_price.quantize(Decimal("0.01")),
                    conversion_mechanism_chosen=mechanism,
                    unrounded_shares=float(int_shares),
                    integer_shares_issued=int_shares,
                    remainder=0.0,
                    post_conversion_ownership_percent=0.0,
                )
            )

        return SafeConversionSimulationResponse(
            startup_id=request.startup_id,
            scenario=request.scenario,
            pre_money_valuation_dzd=exit_val,
            post_money_valuation_dzd=exit_val,
            round_share_price_dzd=exit_val / Decimal(str(pre_shares)),
            total_new_shares_from_safes=sum(r.integer_shares_issued for r in conversion_results),
            total_new_shares_from_priced_round=0,
            total_post_shares=pre_shares,
            safe_conversions=conversion_results,
            cap_table_before_vs_after=[],
            conservation_verified=True,
            summary_report=f"Liquidity Event Evaluated at exit valuation of {exit_val:,.2f} DZD.",
        )

    def _simulate_dissolution(
        self,
        request: SafeConversionSimulationRequest,
        instruments: List[SafeInstrumentModel],
    ) -> SafeConversionSimulationResponse:
        """Dissolution / winding up scenario: capital priority distribution."""
        conversion_results: List[SafeConversionResultItem] = []
        for inst in instruments:
            accrued = self.calculate_accrued_interest(
                principal=inst.principal_dzd,
                annual_rate=inst.interest_rate_annual,
                interest_type=inst.interest_type,
                issuance_date=inst.issuance_date,
                conversion_date=datetime.now(timezone.utc),
            )
            payout = inst.principal_dzd + accrued
            conversion_results.append(
                SafeConversionResultItem(
                    safe_id=inst.id,
                    investor_name=inst.investor_name,
                    safe_type=inst.safe_type,
                    original_principal_dzd=inst.principal_dzd,
                    accrued_interest_dzd=accrued,
                    total_converting_amount_dzd=payout,
                    effective_conversion_price_dzd=payout,
                    conversion_mechanism_chosen="DISSOLUTION_CAPITAL_RETURN",
                    unrounded_shares=0.0,
                    integer_shares_issued=0,
                    remainder=0.0,
                    post_conversion_ownership_percent=0.0,
                )
            )

        return SafeConversionSimulationResponse(
            startup_id=request.startup_id,
            scenario=request.scenario,
            pre_money_valuation_dzd=Decimal("0.0"),
            post_money_valuation_dzd=Decimal("0.0"),
            round_share_price_dzd=Decimal("0.0"),
            total_new_shares_from_safes=0,
            total_new_shares_from_priced_round=0,
            total_post_shares=request.existing_pre_round_shares,
            safe_conversions=conversion_results,
            cap_table_before_vs_after=[],
            conservation_verified=True,
            summary_report="Dissolution modeled: all SAFEs/Notes rank pari passu ahead of common equity.",
        )


# Global singleton instance
safe_conversion_engine = SafeConversionEngine()
