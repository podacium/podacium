"""
TamWheel Sovereign Ethical Agentic Venture OS — Multi-Method Algorithmic Valuation Engine.
Implements:
1. Modified Berkus Method calibrated to Algeria (5 building blocks, capped at 20M - 50M DZD)
2. Scorecard (Bill Payne) Valuation Method with MENA Weights
3. Risk Factor Summation Method (RFSM) across 12 emerging market vectors
4. Venture Capital (VC) Method & First Chicago DCF with emerging market sovereign risk premium
5. Stage-Based Composite Weighting Vector (Stages 0, 1, 2, 3)
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from app.schemas.valuation import (
    StartupVentureStage,
    BerkusBlockInputs,
    ScorecardFactorInputs,
    RFSMFactorGrades,
    VCMethodInputs,
    DCFScenarioInputs,
    ValuationCalculationRequest,
    ValuationMethodResult,
    ValuationReportResponse,
    SensitivityRangeItem,
)

logger = logging.getLogger("tamwheel.valuation_engine")

# Stage-specific weighting vectors per Master Blueprint Section 8.2
STAGE_WEIGHT_VECTORS: Dict[StartupVentureStage, Dict[str, float]] = {
    StartupVentureStage.STAGE_0_PRE_MVP: {
        "berkus": 0.40,
        "scorecard": 0.40,
        "rfsm": 0.20,
        "vcMethod": 0.00,
        "dcf": 0.00,
    },
    StartupVentureStage.STAGE_1_EARLY_MVP: {
        "berkus": 0.30,
        "scorecard": 0.30,
        "rfsm": 0.25,
        "vcMethod": 0.15,
        "dcf": 0.00,
    },
    StartupVentureStage.STAGE_2_EARLY_REVENUE: {
        "berkus": 0.10,
        "scorecard": 0.15,
        "rfsm": 0.15,
        "vcMethod": 0.30,
        "dcf": 0.30,
    },
    StartupVentureStage.STAGE_3_GROWTH_SCALE: {
        "berkus": 0.00,
        "scorecard": 0.05,
        "rfsm": 0.05,
        "vcMethod": 0.30,
        "dcf": 0.60,
    },
}

# Scorecard baseline weights for Algeria / MENA
SCORECARD_WEIGHTS: Dict[str, float] = {
    "team": 0.35,
    "opportunitySize": 0.20,
    "productTechnology": 0.15,
    "competitiveEnvironment": 0.10,
    "marketingPartnerships": 0.10,
    "capitalIntensity": 0.05,
    "startupLabelDecree": 0.05,
}


class MultiMethodValuationEngine:
    """
    Multi-Method Algorithmic Valuation Engine calibrated for emerging markets.
    Synthesizes qualitative scorecards, macroeconomic risk penalties, and DCF/VC models.
    """

    # =========================================================================
    # 1. MODIFIED BERKUS METHOD
    # =========================================================================

    @staticmethod
    def calculate_berkus(inputs: BerkusBlockInputs) -> ValuationMethodResult:
        """
        Modified Berkus Method calibrated to Algeria:
        Pre = Sum(omega_i * beta_i) capped at maxCapDzd.
        Each of the 5 building blocks accounts for 20% of the maximum cap:
        - beta_1: Sound Idea (max 20% of cap)
        - beta_2: Quality Team (max 20% of cap)
        - beta_3: Working Prototype (max 20% of cap)
        - beta_4: Strategic Alliances (max 20% of cap)
        - beta_5: Official Startup Label Moat (max 20% of cap)
        """
        cap = inputs.maxCapDzd or 20_000_000.0
        unit_block = cap / 5.0

        b1 = inputs.soundIdea * unit_block
        b2 = inputs.teamQuality * unit_block
        b3 = inputs.workingPrototype * unit_block
        b4 = inputs.strategicAlliances * unit_block
        b5 = inputs.startupLabelMoat * unit_block

        total_berkus = min(cap, b1 + b2 + b3 + b4 + b5)

        return ValuationMethodResult(
            methodName="Modified Berkus Method (Algeria Calibrated)",
            preMoneyValuationDzd=round(total_berkus, 2),
            weightInComposite=0.0,
            details={
                "capDzd": cap,
                "buildingBlocksDzd": {
                    "soundIdea": round(b1, 2),
                    "teamQuality": round(b2, 2),
                    "workingPrototype": round(b3, 2),
                    "strategicAlliances": round(b4, 2),
                    "startupLabelMoat": round(b5, 2),
                },
                "totalScorePct": round((total_berkus / cap) * 100.0, 1),
            },
        )

    # =========================================================================
    # 2. SCORECARD (BILL PAYNE) METHOD
    # =========================================================================

    @staticmethod
    def calculate_scorecard(inputs: ScorecardFactorInputs) -> ValuationMethodResult:
        """
        Scorecard Valuation Method:
        Val = V_base * Sum(W_j * S_j)
        """
        base = inputs.baselineValuationDzd or 25_000_000.0

        factors = {
            "team": inputs.team,
            "opportunitySize": inputs.opportunitySize,
            "productTechnology": inputs.productTechnology,
            "competitiveEnvironment": inputs.competitiveEnvironment,
            "marketingPartnerships": inputs.marketingPartnerships,
            "capitalIntensity": inputs.capitalIntensity,
            "startupLabelDecree": inputs.startupLabelDecree,
        }

        weighted_factor_sum = sum(SCORECARD_WEIGHTS[k] * factors[k] for k in SCORECARD_WEIGHTS)
        val_scorecard = base * weighted_factor_sum

        return ValuationMethodResult(
            methodName="Scorecard (Bill Payne) Valuation Method",
            preMoneyValuationDzd=round(val_scorecard, 2),
            weightInComposite=0.0,
            details={
                "baselineValuationDzd": base,
                "compositeFactorMultiplier": round(weighted_factor_sum, 4),
                "factorScores": factors,
                "factorWeights": SCORECARD_WEIGHTS,
            },
        )

    # =========================================================================
    # 3. RISK FACTOR SUMMATION METHOD (RFSM)
    # =========================================================================

    @staticmethod
    def calculate_rfsm(inputs: RFSMFactorGrades) -> ValuationMethodResult:
        """
        Risk Factor Summation Method across 12 emerging market vectors:
        Val = V_base + Sum(Grade_k * delta)
        """
        base = inputs.baselineValuationDzd or 25_000_000.0
        delta = inputs.deltaQuantumDzd or 2_000_000.0

        grades = {
            "managementRisk": inputs.managementRisk,
            "stageOfBusiness": inputs.stageOfBusiness,
            "legislationPoliticalRisk": inputs.legislationPoliticalRisk,
            "supplyChainCustomsRisk": inputs.supplyChainCustomsRisk,
            "salesDistributionRisk": inputs.salesDistributionRisk,
            "fundingCapitalRaiseRisk": inputs.fundingCapitalRaiseRisk,
            "competitionRisk": inputs.competitionRisk,
            "technologyIpRisk": inputs.technologyIpRisk,
            "litigationLegalRisk": inputs.litigationLegalRisk,
            "internationalFxRisk": inputs.internationalFxRisk,
            "reputationRisk": inputs.reputationRisk,
            "exitOpportunityRisk": inputs.exitOpportunityRisk,
        }

        total_grade_sum = sum(grades.values())
        adjustment = total_grade_sum * delta
        val_rfsm = max(5_000_000.0, base + adjustment)

        return ValuationMethodResult(
            methodName="Risk Factor Summation Method (RFSM)",
            preMoneyValuationDzd=round(val_rfsm, 2),
            weightInComposite=0.0,
            details={
                "baselineValuationDzd": base,
                "deltaQuantumDzd": delta,
                "totalGradesSum": total_grade_sum,
                "netAdjustmentDzd": round(adjustment, 2),
                "grades": grades,
            },
        )

    # =========================================================================
    # 4. VENTURE CAPITAL (VC) METHOD
    # =========================================================================

    @staticmethod
    def calculate_vc_method(inputs: VCMethodInputs) -> ValuationMethodResult:
        """
        Venture Capital (VC) Method:
        Post_0 = (V_exit * Retention) / (1 + IRR)^T
        Pre_0 = Post_0 - Investment
        """
        irr_dec = inputs.targetAnnualIrrPct / 100.0
        t = inputs.exitHorizonYears
        compound_discount = (1.0 + irr_dec) ** t

        post_money = (inputs.projectedExitValuationDzd * inputs.retentionDilutionFactor) / compound_discount
        pre_money = max(1_000_000.0, post_money - inputs.investmentRequiredDzd)

        return ValuationMethodResult(
            methodName="Venture Capital (VC) Method",
            preMoneyValuationDzd=round(pre_money, 2),
            weightInComposite=0.0,
            details={
                "projectedExitValuationDzd": inputs.projectedExitValuationDzd,
                "exitHorizonYears": t,
                "targetIrrPct": inputs.targetAnnualIrrPct,
                "investmentRequiredDzd": inputs.investmentRequiredDzd,
                "retentionDilutionFactor": inputs.retentionDilutionFactor,
                "postMoneyValuationDzd": round(post_money, 2),
            },
        )

    # =========================================================================
    # 5. FIRST CHICAGO / DISCOUNTED CASH FLOW (DCF)
    # =========================================================================

    @staticmethod
    def calculate_dcf(inputs: DCFScenarioInputs) -> ValuationMethodResult:
        """
        First Chicago DCF Model:
        Val = 0.20 * Bull + 0.60 * Base + 0.20 * Bear
        Where Base discounts 5-year FCFF and perpetual terminal value at r_MENA.
        """
        r = inputs.discountRatePct / 100.0
        g = inputs.terminalGrowthRatePct / 100.0

        pv_cash_flows = 0.0
        for year, cf in enumerate(inputs.projected5YearFcffDzd, start=1):
            pv_cash_flows += cf / ((1.0 + r) ** year)

        # Terminal value calculation (Gordon Growth Model discounted from year 5)
        cf_last = inputs.projected5YearFcffDzd[-1]
        denom = max(0.02, r - g)
        terminal_value = (cf_last * (1.0 + g)) / denom
        pv_terminal_value = terminal_value / ((1.0 + r) ** len(inputs.projected5YearFcffDzd))

        base_val = pv_cash_flows + pv_terminal_value
        bull_val = base_val * 1.35
        bear_val = base_val * 0.60

        expected_val = max(1_000_000.0, 0.20 * bull_val + 0.60 * base_val + 0.20 * bear_val)

        return ValuationMethodResult(
            methodName="First Chicago Scenario DCF Model",
            preMoneyValuationDzd=round(expected_val, 2),
            weightInComposite=0.0,
            details={
                "discountRatePct": inputs.discountRatePct,
                "terminalGrowthRatePct": inputs.terminalGrowthRatePct,
                "pvOperatingCashFlowsDzd": round(pv_cash_flows, 2),
                "pvTerminalValueDzd": round(pv_terminal_value, 2),
                "baseScenarioDzd": round(base_val, 2),
                "bullScenarioDzd": round(bull_val, 2),
                "bearScenarioDzd": round(bear_val, 2),
            },
        )

    # =========================================================================
    # 6. UNIFIED STAGE-BASED COMPOSITE VALUATION
    # =========================================================================

    @classmethod
    def calculate_composite_valuation(cls, request: ValuationCalculationRequest) -> ValuationReportResponse:
        """
        Execute unified multi-method valuation across all applicable methods,
        apply stage-specific weight vector, and produce comprehensive sensitivity bounds.
        """
        stage = request.stage
        weights = STAGE_WEIGHT_VECTORS.get(stage, STAGE_WEIGHT_VECTORS[StartupVentureStage.STAGE_1_EARLY_MVP])

        # Execute individual methods
        berkus_res = cls.calculate_berkus(request.berkus or BerkusBlockInputs())
        scorecard_res = cls.calculate_scorecard(request.scorecard or ScorecardFactorInputs())
        rfsm_res = cls.calculate_rfsm(request.rfsm or RFSMFactorGrades())
        vc_res = cls.calculate_vc_method(request.vcMethod or VCMethodInputs())
        dcf_res = cls.calculate_dcf(request.dcf or DCFScenarioInputs())

        # Assign weights
        berkus_res.weightInComposite = weights["berkus"]
        scorecard_res.weightInComposite = weights["scorecard"]
        rfsm_res.weightInComposite = weights["rfsm"]
        vc_res.weightInComposite = weights["vcMethod"]
        dcf_res.weightInComposite = weights["dcf"]

        # Calculate composite weighted sum
        composite_val = (
            berkus_res.preMoneyValuationDzd * weights["berkus"]
            + scorecard_res.preMoneyValuationDzd * weights["scorecard"]
            + rfsm_res.preMoneyValuationDzd * weights["rfsm"]
            + vc_res.preMoneyValuationDzd * weights["vcMethod"]
            + dcf_res.preMoneyValuationDzd * weights["dcf"]
        )

        composite_val = round(composite_val, 2)

        # Confidence intervals (+/- 15%)
        ci_low = round(composite_val * 0.85, 2)
        ci_high = round(composite_val * 1.15, 2)

        # Sensitivity ranges
        sensitivity = [
            SensitivityRangeItem(scenario="Severe Bear (-20%)", preMoneyValuationDzd=round(composite_val * 0.80, 2), deviationPct=-20.0),
            SensitivityRangeItem(scenario="Conservative (-10%)", preMoneyValuationDzd=round(composite_val * 0.90, 2), deviationPct=-10.0),
            SensitivityRangeItem(scenario="Base Expected", preMoneyValuationDzd=composite_val, deviationPct=0.0),
            SensitivityRangeItem(scenario="Optimistic (+10%)", preMoneyValuationDzd=round(composite_val * 1.10, 2), deviationPct=10.0),
            SensitivityRangeItem(scenario="High Growth (+20%)", preMoneyValuationDzd=round(composite_val * 1.20, 2), deviationPct=20.0),
        ]

        # Statutory check under Algerian COSOB Regulation 23-01
        warning = None
        if composite_val > 50_000_000.0 and stage in (StartupVentureStage.STAGE_0_PRE_MVP, StartupVentureStage.STAGE_1_EARLY_MVP):
            warning = "Valuation exceeds 50M DZD seed baseline. Recommend additional Virtual Data Room substantiation."

        return ValuationReportResponse(
            stage=stage,
            compositePreMoneyValuationDzd=composite_val,
            confidenceIntervalLowDzd=ci_low,
            confidenceIntervalHighDzd=ci_high,
            methodBreakdown=[berkus_res, scorecard_res, rfsm_res, vc_res, dcf_res],
            stageWeightingVector=weights,
            sensitivityAnalysis=sensitivity,
            statutoryCapWarning=warning,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )


valuation_engine = MultiMethodValuationEngine()
