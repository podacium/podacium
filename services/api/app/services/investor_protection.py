"""
TamWheel Sovereign Ethical Agentic Venture OS — Consumer Protection & Vulnerable Investor Engine.
Implements:
1. 6-Month Liquid Living Expense Reserve Diagnostic (COSOB & MiFID II Consumer Protection)
2. Vulnerable Investor Ticket Capping (max 5,000 DA statutory limit)
3. Investor Suitability Scoring (S = 0.40*K + 0.35*C + 0.25*B)
4. Cryptographic Ethical Risk Waiver Generation (Multi-language copy & 4-day cooling-off period)
"""

from datetime import datetime, timezone, timedelta
import hashlib
import logging
from typing import Any, Dict, Optional
import uuid

from app.schemas.protection import (
    InvestorSuitabilityTier,
    LiquidityDiagnosticRequest,
    LiquidityDiagnosticResponse,
    EthicalWaiverGenerateRequest,
    EthicalWaiverDocumentResponse,
)

logger = logging.getLogger("tamwheel.investor_protection")

# Statutory limits under COSOB Regulation 23-01 & Blueprint Section 8.3
VULNERABLE_INVESTOR_TICKET_CAP_DZD = 5000.0   # Statutory Micro-Backer Ticket Ceiling
STATUTORY_COOLING_OFF_DAYS = 4                # 4-Day Reflection Period (Droit de rétractation)


class InvestorProtectionEngine:
    """
    Consumer Protection and Investor Suitability Engine.
    Guarantees that vulnerable citizens with less than 6 months of living expenses
    are prevented from over-committing capital to high-risk early-stage ventures.
    """

    @classmethod
    def evaluate_liquidity_reserve(cls, request: LiquidityDiagnosticRequest) -> LiquidityDiagnosticResponse:
        """
        Evaluate 6-month household liquid reserve diagnostic.
        If liquidSavings < 6 * monthlyHouseholdExpense, investor is classified as VULNERABLE_INVESTOR.
        """
        monthly_exp = max(1000.0, request.monthlyHouseholdExpenseDzd)
        liquid_savings = request.liquidSavingsDzd
        required_reserve = 6.0 * monthly_exp
        coverage_months = round(liquid_savings / monthly_exp, 2)

        # Suitability Score: S = 0.40*K + 0.35*C + 0.25*B
        k = request.knowledgeScoreK if request.knowledgeScoreK is not None else 70.0
        c = request.lossBearingCapacityC if request.lossBearingCapacityC is not None else 65.0
        b = request.behavioralRiskB if request.behavioralRiskB is not None else 60.0
        suitability_score = round(0.40 * k + 0.35 * c + 0.25 * b, 1)

        is_vulnerable = coverage_months < 6.0

        if is_vulnerable:
            tier = InvestorSuitabilityTier.VULNERABLE_INVESTOR
            max_ticket = VULNERABLE_INVESTOR_TICKET_CAP_DZD
            requires_waiver = True
            risk_warning = (
                f"Your liquid personal savings cover {coverage_months:.1f} months of household expenses "
                f"(minimum required: 6.0 months = {required_reserve:,.0f} DZD). "
                f"Under COSOB / MiFID II consumer protection rules, you are flagged as a VULNERABLE INVESTOR. "
                f"Your pledge is strictly capped at the statutory micro-backer limit of {max_ticket:,.0f} DA, "
                "and an explicit ethical risk waiver is required."
            )
            notes = "Safety Intervention Active: 6-month living expense reserve not met. Ticket capped at 5,000 DA."
        else:
            requires_waiver = False
            risk_warning = None
            if request.netWorthDzd >= 10_000_000.0 and suitability_score >= 75.0:
                tier = InvestorSuitabilityTier.ACCREDITED_ANGEL
                max_ticket = min(20_000_000.0, request.netWorthDzd * 0.20)
                notes = "Accredited Angel Status: High loss-bearing capacity and robust 6-month reserve coverage."
            else:
                tier = InvestorSuitabilityTier.SUITABLE_RETAIL_INVESTOR
                max_ticket = min(2_000_000.0, request.netWorthDzd * 0.10)
                notes = "Retail Investor: 6-month living expense reserve verified. Statutory 10% net worth limit applies."

        return LiquidityDiagnosticResponse(
            isVulnerable=is_vulnerable,
            suitabilityTier=tier,
            reserveCoverageMonths=coverage_months,
            requiredReserveDzd=round(required_reserve, 2),
            liquidSavingsDzd=round(liquid_savings, 2),
            compositeSuitabilityScore=suitability_score,
            maxPermittedTicketDzd=round(max_ticket, 2),
            requiresEthicalWaiver=requires_waiver,
            riskWarning=risk_warning,
            regulatoryNotes=notes,
            evaluatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def generate_ethical_waiver(cls, request: EthicalWaiverGenerateRequest) -> EthicalWaiverDocumentResponse:
        """
        Generate cryptographic ethical risk waiver with multilingual disclosure texts
        and 4-day statutory reflection deadline.
        """
        diagnostic_req = LiquidityDiagnosticRequest(
            monthlyHouseholdExpenseDzd=request.monthlyHouseholdExpenseDzd,
            liquidSavingsDzd=request.liquidSavingsDzd,
        )
        diag = cls.evaluate_liquidity_reserve(diagnostic_req)

        # Enforce statutory cap if vulnerable
        capped_amount = (
            min(request.proposedPledgeAmountDzd, VULNERABLE_INVESTOR_TICKET_CAP_DZD)
            if diag.isVulnerable
            else request.proposedPledgeAmountDzd
        )

        waiver_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        deadline = now + timedelta(days=STATUTORY_COOLING_OFF_DAYS)

        # Compute cryptographic declaration hash
        raw_hash_input = f"{waiver_id}:{request.investorId}:{capped_amount}:{now.isoformat()}"
        decl_hash = hashlib.sha256(raw_hash_input.encode("utf-8")).hexdigest()

        # Multilingual statutory disclosure texts
        text_ar = (
            f"إقرار وتنازل أخلاقي عن مخاطر الاستثمار (رقم {waiver_id[:8]}):\n"
            f"أقر أنا المستثمر رقم {request.investorId} بأنني على دراية تامة بأن الاستثمار في الشركات الناشئة "
            f"ينطوي على مخاطر عالية لفقدان كامل رأس المال المخصص ({capped_amount:,.0f} د.ج)، "
            "وأن الأسهم لا تتمتع بسيولة فورية، وتخضع لفترة تروي قانونية مدتها 4 أيام طبقاً لنظام COSOB 23-01."
        )

        text_fr = (
            f"Déclaration et Renonciation Éthique aux Risques (ID {waiver_id[:8]}):\n"
            f"Je soussigné, investisseur #{request.investorId}, reconnais expressément que l'investissement dans des "
            f"entreprises innovantes non cotées comporte un risque de perte totale du capital alloué ({capped_amount:,.0f} DZD). "
            f"Conformément au Règlement COSOB 23-01, je bénéficie d'un délai légal de rétractation de {STATUTORY_COOLING_OFF_DAYS} jours."
        )

        text_en = (
            f"Ethical Risk Disclosure & Statutory Waiver (Ref {waiver_id[:8]}):\n"
            f"I, investor #{request.investorId}, explicitly acknowledge that equity crowdfunding in early-stage ventures "
            f"carries a material risk of 100% loss of pledged funds ({capped_amount:,.0f} DZD). "
            f"Under COSOB Regulation 23-01, an irrevocable {STATUTORY_COOLING_OFF_DAYS}-day statutory cooling-off window is active."
        )

        return EthicalWaiverDocumentResponse(
            waiverId=waiver_id,
            investorId=request.investorId,
            proposedPledgeAmountDzd=request.proposedPledgeAmountDzd,
            cappedPledgeAmountDzd=capped_amount,
            isVulnerable=diag.isVulnerable,
            declarationHash=decl_hash,
            waiverTextAr=text_ar,
            waiverTextFr=text_fr,
            waiverTextEn=text_en,
            statutoryCoolingOffDays=STATUTORY_COOLING_OFF_DAYS,
            coolingOffDeadline=deadline.isoformat(),
            issuedAt=now.isoformat(),
        )


investor_protection_engine = InvestorProtectionEngine()
