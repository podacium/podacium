"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Fraud & Anomaly Detection Engine.
Implements:
1. Cross-check of statutory tax declarations (Algerian G50) vs self-reported/pitch deck revenue.
2. Cross-check of social security slips (CNAS) vs declared headcount and payroll wage bill.
3. Graph-based phantom supplier and circular transaction (round-tripping) detection.
4. Cash-burn vs Bank Statement ledger reconciliation (continuous balance verification & runway divergence).
5. Composite Fraud Risk Score [0.0, 100.0] with breakdown and prioritized Forensic Red-Flag matrix.
"""

from datetime import datetime, timezone
import logging
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.forensic_fraud import (
    FraudRiskLevel,
    RedFlagSeverity,
    RedFlagCategory,
    G50TaxDeclaration,
    CNASDeclaration,
    TransactionEdge,
    BankStatementMonth,
    ClaimedFinancials,
    CircularLoopResult,
    ForensicRedFlag,
    ForensicFraudScoreBreakdown,
    ForensicAuditRequest,
    ForensicAuditResponse,
    CircularCheckRequest,
    CircularCheckResponse,
    CashReconciliationRequest,
    CashReconciliationResponse,
)

logger = logging.getLogger("tamwheel.forensic_fraud")

# Statutory Algerian Social Security contribution rate: 34.5% (25% Employer + 9% Employee + 0.5% Social Fund)
ALGERIAN_CNAS_STANDARD_RATE = 0.345
CNAS_RATE_TOLERANCE = 0.05


class ForensicFraudDetector:
    """
    Forensic Corporate Accounting & Anomaly Detection Engine.
    Detects revenue fabrication, undeclared/phantom payroll, circular invoice round-tripping,
    and cash runway falsification in early-stage venture audits.
    """

    def __init__(self):
        logger.info("Initializing TamWheel Forensic Fraud & Anomaly Detection Engine")

    def audit_startup(self, req: ForensicAuditRequest) -> ForensicAuditResponse:
        """
        Conduct a comprehensive forensic audit cross-referencing G50 tax returns,
        CNAS social declarations, invoice transaction graphs, and bank statements.
        """
        red_flags: List[ForensicRedFlag] = []

        # 1. Tax Discrepancy Audit (G50 vs Claimed Revenue)
        tax_score, tax_flags, tax_discrepancy = self.check_tax_discrepancies(
            claimed=req.claimedFinancials,
            g50s=req.g50Declarations,
        )
        red_flags.extend(tax_flags)

        # 2. Payroll & Headcount Discrepancy Audit (CNAS vs Claimed)
        payroll_score, payroll_flags, payroll_discrepancy = self.check_payroll_cnas_discrepancies(
            claimed=req.claimedFinancials,
            cnas_slips=req.cnasDeclarations,
        )
        red_flags.extend(payroll_flags)

        # 3. Circular Transaction Graph & Phantom Supplier Audit
        circular_score, circular_loops, phantom_suppliers, circular_flags = self.detect_circular_transactions(
            transactions=req.transactions,
            target_entity=req.companyName,
        )
        red_flags.extend(circular_flags)

        # 4. Bank Statement & Cash Burn Reconciliation
        cash_score, cash_flags, actual_burn, actual_runway, runway_delta = self.reconcile_cash_burn(
            statements=req.bankStatements,
            claimed_burn=req.claimedFinancials.claimedMonthlyBurnDzd,
            claimed_runway=req.claimedFinancials.claimedRunwayMonths,
        )
        red_flags.extend(cash_flags)

        # 5. Composite Fraud Score Calculation
        overall_score = (
            0.30 * tax_score +
            0.25 * payroll_score +
            0.25 * circular_score +
            0.20 * cash_score
        )

        # Critical red flag amplification: multiple critical findings escalate to critical fraud alert
        critical_count = sum(1 for f in red_flags if f.severity == RedFlagSeverity.CRITICAL)
        if critical_count >= 2:
            overall_score = max(overall_score, 80.0)
        elif critical_count >= 1:
            overall_score = max(overall_score, 65.0)

        overall_score = round(min(100.0, max(0.0, overall_score)), 1)

        if overall_score >= 75.0:
            risk_level = FraudRiskLevel.CRITICAL_FRAUD_ALERT
        elif overall_score >= 50.0:
            risk_level = FraudRiskLevel.HIGH_RISK
        elif overall_score >= 25.0:
            risk_level = FraudRiskLevel.MODERATE_RISK
        else:
            risk_level = FraudRiskLevel.LOW_RISK

        score_breakdown = ForensicFraudScoreBreakdown(
            taxInconsistencyScore=round(tax_score, 1),
            payrollMismatchScore=round(payroll_score, 1),
            circularLoopScore=round(circular_score, 1),
            cashReconciliationScore=round(cash_score, 1),
            overallFraudScore=overall_score,
            riskLevel=risk_level,
        )

        critical_count = sum(1 for f in red_flags if f.severity == RedFlagSeverity.CRITICAL)
        high_count = sum(1 for f in red_flags if f.severity == RedFlagSeverity.HIGH)

        summary = (
            f"Forensic corporate audit completed for {req.companyName}. "
            f"Overall Fraud Risk: {overall_score}/100 ({risk_level.value}). "
            f"Identified {len(red_flags)} total anomalies ({critical_count} CRITICAL, {high_count} HIGH). "
            f"Circular Loops: {len(circular_loops)}. "
            f"Tax Discrepancy: {tax_discrepancy:,.0f} DZD. "
            f"Runway Gap: {runway_delta:.1f} months."
        )

        return ForensicAuditResponse(
            startupId=req.startupId,
            auditTimestamp=datetime.now(timezone.utc).isoformat(),
            scoreBreakdown=score_breakdown,
            redFlags=red_flags,
            circularLoopsDetected=circular_loops,
            taxDiscrepancyDzd=round(tax_discrepancy, 2),
            payrollDiscrepancyDzd=round(payroll_discrepancy, 2),
            runwayDiscrepancyMonths=round(runway_delta, 1),
            summary=summary,
            status="AUDIT_COMPLETED",
        )

    # =========================================================================
    # 1. TAX DECLARATION (G50) CROSS-CHECK
    # =========================================================================

    def check_tax_discrepancies(
        self,
        claimed: ClaimedFinancials,
        g50s: List[G50TaxDeclaration],
    ) -> Tuple[float, List[ForensicRedFlag], float]:
        """
        Cross-check claimed annual revenue against statutory G50 taxable turnover.
        Returns: (tax_risk_score, list_of_red_flags, absolute_tax_discrepancy_dzd)
        """
        flags: List[ForensicRedFlag] = []

        if not g50s:
            # If startup claims revenue > 1M DZD but has zero G50s filed, that is a severe omission
            if claimed.annualDeclaredRevenueDzd > 1_000_000.0:
                flags.append(
                    ForensicRedFlag(
                        code="FLG_TAX_NO_G50_FILINGS",
                        category=RedFlagCategory.TAX_INCONSISTENCY,
                        severity=RedFlagSeverity.CRITICAL,
                        title="Missing Statutory G50 Tax Filings",
                        description=(
                            f"Startup claims {claimed.annualDeclaredRevenueDzd:,.0f} DZD in annual revenue "
                            "but submitted zero official G50 tax declarations."
                        ),
                        evidence={"claimedRevenueDzd": claimed.annualDeclaredRevenueDzd, "g50Count": 0},
                        suggestedRemediation="Require stamped G50 monthly returns from Direction Générale des Impôts (DGI).",
                    )
                )
                return 85.0, flags, claimed.annualDeclaredRevenueDzd
            return 10.0, flags, 0.0

        total_g50_turnover = sum(g.turnoverReportedDzd for g in g50s)
        total_tva_collected = sum(g.tvaCollectedDzd for g in g50s)

        # Scale G50 to annual if fewer than 12 monthly periods provided
        period_count = len(g50s)
        annualized_g50_turnover = total_g50_turnover
        if 0 < period_count < 12:
            annualized_g50_turnover = (total_g50_turnover / period_count) * 12

        discrepancy = abs(claimed.annualDeclaredRevenueDzd - annualized_g50_turnover)
        max_base = max(claimed.annualDeclaredRevenueDzd, annualized_g50_turnover, 1.0)
        gap_ratio = discrepancy / max_base

        score = 0.0

        if gap_ratio > 0.50:
            score = 90.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_TAX_MASSIVE_GAP",
                    category=RedFlagCategory.TAX_INCONSISTENCY,
                    severity=RedFlagSeverity.CRITICAL,
                    title="Severe Revenue vs Tax Filing Discrepancy (>50%)",
                    description=(
                        f"Claimed revenue of {claimed.annualDeclaredRevenueDzd:,.0f} DZD diverges by "
                        f"{gap_ratio*100:.1f}% from annualized G50 reported turnover of {annualized_g50_turnover:,.0f} DZD."
                    ),
                    evidence={
                        "claimedRevenueDzd": claimed.annualDeclaredRevenueDzd,
                        "annualizedG50Dzd": annualized_g50_turnover,
                        "gapRatio": gap_ratio,
                    },
                    suggestedRemediation="Reconcile fiscal ledger with DGI filings. Founder may be exaggerating traction or under-reporting taxes.",
                )
            )
        elif gap_ratio > 0.20:
            score = 60.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_TAX_SIGNIFICANT_UNDERREPORT",
                    category=RedFlagCategory.TAX_INCONSISTENCY,
                    severity=RedFlagSeverity.HIGH,
                    title="Significant Revenue vs G50 Variance (>20%)",
                    description=(
                        f"Claimed revenue diverges by {gap_ratio*100:.1f}% from annualized G50 declarations."
                    ),
                    evidence={
                        "claimedRevenueDzd": claimed.annualDeclaredRevenueDzd,
                        "annualizedG50Dzd": annualized_g50_turnover,
                    },
                    suggestedRemediation="Request fiscal accountant review and quarterly DGI settlement receipts.",
                )
            )
        elif gap_ratio > 0.05:
            score = 30.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_TAX_MODERATE_VARIANCE",
                    category=RedFlagCategory.TAX_INCONSISTENCY,
                    severity=RedFlagSeverity.MEDIUM,
                    title="Moderate Tax Variance (5-20%)",
                    description="Minor timing or accrual differences between deck claims and G50 records.",
                    evidence={"gapRatio": gap_ratio},
                    suggestedRemediation="Verify accrual vs cash-basis accounting discrepancies with company CFO.",
                )
            )
        else:
            score = 5.0

        # TVA Check: If turnover is positive but zero TVA collected across all filings
        if total_g50_turnover > 500_000.0 and total_tva_collected == 0:
            score = min(100.0, score + 20.0)
            flags.append(
                ForensicRedFlag(
                    code="FLG_TAX_ZERO_TVA_IRREGULARITY",
                    category=RedFlagCategory.TAX_INCONSISTENCY,
                    severity=RedFlagSeverity.MEDIUM,
                    title="Zero TVA Declared on Commercial Turnover",
                    description="Positive taxable turnover reported with zero VAT (TVA) remitted. Unless company holds valid Decree 20-254 Startup Label tax exemption, this is irregular.",
                    evidence={"totalTurnoverDzd": total_g50_turnover, "tvaCollectedDzd": total_tva_collected},
                    suggestedRemediation="Confirm valid Label Startup or Label Projet Innovant certificate granting fiscal exoneration.",
                )
            )

        return score, flags, discrepancy

    # =========================================================================
    # 2. PAYROLL & CNAS SOCIAL SECURITY CROSS-CHECK
    # =========================================================================

    def check_payroll_cnas_discrepancies(
        self,
        claimed: ClaimedFinancials,
        cnas_slips: List[CNASDeclaration],
    ) -> Tuple[float, List[ForensicRedFlag], float]:
        """
        Cross-check claimed employee headcount and monthly wage bill against official CNAS declarations.
        Returns: (payroll_risk_score, list_of_red_flags, monthly_payroll_discrepancy_dzd)
        """
        flags: List[ForensicRedFlag] = []

        if not cnas_slips:
            if claimed.claimedHeadcount > 3:
                flags.append(
                    ForensicRedFlag(
                        code="FLG_CNAS_NO_DECLARATION",
                        category=RedFlagCategory.PAYROLL_MISMATCH,
                        severity=RedFlagSeverity.HIGH,
                        title="No CNAS Social Security Registrations Found",
                        description=(
                            f"Startup claims a team of {claimed.claimedHeadcount} employees with "
                            f"{claimed.claimedMonthlyPayrollDzd:,.0f} DZD monthly payroll, but has zero CNAS records. "
                            "Indicates undeclared labor (marché informel) or phantom team inflation."
                        ),
                        evidence={"claimedHeadcount": claimed.claimedHeadcount, "cnasSlips": 0},
                        suggestedRemediation="Mandate submission of CNAS Form 302 and active employee social security numbers.",
                    )
                )
                return 75.0, flags, claimed.claimedMonthlyPayrollDzd
            return 5.0, flags, 0.0

        latest_cnas = cnas_slips[-1]
        declared_cnas_count = latest_cnas.activeEmployeesCount
        declared_cnas_gross = latest_cnas.declaredGrossSalaryDzd

        headcount_delta = claimed.claimedHeadcount - declared_cnas_count
        payroll_discrepancy = abs(claimed.claimedMonthlyPayrollDzd - declared_cnas_gross)

        score = 0.0

        # Headcount Ghost Check
        if declared_cnas_count == 0 and claimed.claimedHeadcount > 0:
            score += 50.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_PAYROLL_GHOST_TEAM",
                    category=RedFlagCategory.PAYROLL_MISMATCH,
                    severity=RedFlagSeverity.CRITICAL,
                    title="Phantom Headcount: Zero Declared CNAS Workers",
                    description=(
                        f"Pitch claims {claimed.claimedHeadcount} team members, but CNAS records show 0 insured employees."
                    ),
                    evidence={"claimedHeadcount": claimed.claimedHeadcount, "cnasEmployees": declared_cnas_count},
                    suggestedRemediation="Verify employment contracts and contractor vs employee legal status.",
                )
            )
        elif declared_cnas_count > 0 and (claimed.claimedHeadcount / declared_cnas_count) >= 2.0:
            score += 40.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_PAYROLL_UNDECLARED_LABOR",
                    category=RedFlagCategory.PAYROLL_MISMATCH,
                    severity=RedFlagSeverity.HIGH,
                    title="Substantial Undeclared Labor / Headcount Inflation (>2x)",
                    description=(
                        f"Claimed team of {claimed.claimedHeadcount} is over 2x larger than CNAS declared workers ({declared_cnas_count})."
                    ),
                    evidence={"claimed": claimed.claimedHeadcount, "cnas": declared_cnas_count},
                    suggestedRemediation="Audit freelancer contractor agreements vs regular salaried payroll.",
                )
            )

        # Wage Bill Discrepancy
        if declared_cnas_gross > 0:
            wage_ratio = claimed.claimedMonthlyPayrollDzd / declared_cnas_gross
            if wage_ratio > 2.5:
                score += 40.0
                flags.append(
                    ForensicRedFlag(
                        code="FLG_PAYROLL_WAGE_DIVERGENCE",
                        category=RedFlagCategory.PAYROLL_MISMATCH,
                        severity=RedFlagSeverity.HIGH,
                        title="Massive Payroll Wage Bill Divergence",
                        description=(
                            f"Claimed monthly wage bill of {claimed.claimedMonthlyPayrollDzd:,.0f} DZD is {wage_ratio:.1f}x higher "
                            f"than CNAS gross declared payroll of {declared_cnas_gross:,.0f} DZD."
                        ),
                        evidence={"claimedPayroll": claimed.claimedMonthlyPayrollDzd, "cnasGross": declared_cnas_gross},
                        suggestedRemediation="Examine potential off-the-books payments or exaggerated founder salary claims.",
                    )
                )

        # Contribution Rate Verification (Statutory 34.5%)
        if declared_cnas_gross > 0 and latest_cnas.contributionsPaidDzd > 0:
            effective_rate = latest_cnas.contributionsPaidDzd / declared_cnas_gross
            if abs(effective_rate - ALGERIAN_CNAS_STANDARD_RATE) > CNAS_RATE_TOLERANCE:
                score += 15.0
                flags.append(
                    ForensicRedFlag(
                        code="FLG_CNAS_RATE_ANOMALY",
                        category=RedFlagCategory.PAYROLL_MISMATCH,
                        severity=RedFlagSeverity.MEDIUM,
                        title="Non-Standard CNAS Contribution Ratio",
                        description=(
                            f"CNAS contributions paid ({latest_cnas.contributionsPaidDzd:,.0f} DZD) represent "
                            f"{effective_rate*100:.1f}% of gross wages (statutory standard is 34.5%)."
                        ),
                        evidence={"effectiveRate": effective_rate, "standardRate": ALGERIAN_CNAS_STANDARD_RATE},
                        suggestedRemediation="Verify if company benefits from specific youth employment or ANSEJ/NESDA subsidies.",
                    )
                )

        score = min(100.0, score)
        return score, flags, payroll_discrepancy

    # =========================================================================
    # 3. PHANTOM SUPPLIER & CIRCULAR TRANSACTION GRAPH DETECTION
    # =========================================================================

    def detect_circular_transactions(
        self,
        transactions: List[TransactionEdge],
        target_entity: Optional[str] = None,
    ) -> Tuple[float, List[CircularLoopResult], List[Dict[str, Any]], List[ForensicRedFlag]]:
        """
        Identify closed circular transaction cycles (e.g. A -> B -> C -> A) and phantom suppliers.
        Returns: (circular_risk_score, list_of_loops, list_of_phantom_suppliers, list_of_red_flags)
        """
        flags: List[ForensicRedFlag] = []
        loops: List[CircularLoopResult] = []
        phantom_suppliers: List[Dict[str, Any]] = []

        if not transactions:
            return 0.0, [], [], []

        # 1. Build directed graph adjacency list
        adj: Dict[str, List[Tuple[str, float, str, bool]]] = {}
        all_nodes: Set[str] = set()
        supplier_nifs: Dict[str, Optional[str]] = {}

        for tx in transactions:
            all_nodes.add(tx.sourceEntity)
            all_nodes.add(tx.targetEntity)
            if tx.sourceEntity not in adj:
                adj[tx.sourceEntity] = []
            adj[tx.sourceEntity].append((tx.targetEntity, tx.amountDzd, tx.transactionId, tx.isRelatedParty))

            supplier_nifs[tx.sourceEntity] = tx.sourceNif
            supplier_nifs[tx.targetEntity] = tx.targetNif

        # 2. Cycle Detection via DFS
        visited: Set[str] = set()
        rec_stack: List[str] = []
        tx_stack: List[str] = []
        cycle_signatures: Set[Tuple[str, ...]] = set()

        def dfs(node: str):
            visited.add(node)
            rec_stack.append(node)

            for neighbor, amount, tx_id, is_rel in adj.get(node, []):
                if neighbor in rec_stack:
                    # Cycle found!
                    idx = rec_stack.index(neighbor)
                    cycle_nodes = rec_stack[idx:]
                    involved_edges = tx_stack[idx:] + [tx_id]

                    # Canonical cycle representation to avoid duplicates
                    min_idx = cycle_nodes.index(min(cycle_nodes))
                    canon_cycle = tuple(cycle_nodes[min_idx:] + cycle_nodes[:min_idx])

                    if canon_cycle not in cycle_signatures:
                        cycle_signatures.add(canon_cycle)
                        total_volume = 0.0
                        # Sum transaction volume in cycle
                        for t in transactions:
                            if t.transactionId in involved_edges:
                                total_volume += t.amountDzd

                        desc = f"Circular transaction cycle detected: {' -> '.join(cycle_nodes)} -> {neighbor}"
                        loops.append(
                            CircularLoopResult(
                                cycleEntities=cycle_nodes + [neighbor],
                                totalCycleVolumeDzd=total_volume,
                                cycleLength=len(cycle_nodes),
                                edgesInvolved=involved_edges,
                                description=desc,
                            )
                        )
                elif neighbor not in visited:
                    tx_stack.append(tx_id)
                    dfs(neighbor)
                    if tx_stack:
                        tx_stack.pop()

            rec_stack.pop()

        for node in list(all_nodes):
            if node not in visited:
                dfs(node)

        # 3. Check for Phantom Suppliers (Missing NIF or suspicious invoicing)
        for entity in all_nodes:
            if target_entity and entity.lower() == target_entity.lower():
                continue
            nif = supplier_nifs.get(entity)
            entity_inflow = sum(tx.amountDzd for tx in transactions if tx.targetEntity == entity)

            # In Algeria, NIF is a 15-digit or 20-digit unique fiscal number
            is_nif_missing = not nif or len(str(nif).strip()) < 9
            if is_nif_missing and entity_inflow > 1_000_000.0:
                phantom_suppliers.append({
                    "entity": entity,
                    "inflowDzd": entity_inflow,
                    "reason": "Missing or invalid NIF on high-value supplier invoices (>1M DZD)",
                })
                flags.append(
                    ForensicRedFlag(
                        code="FLG_PHANTOM_SUPPLIER_SUSPECT",
                        category=RedFlagCategory.PHANTOM_SUPPLIER,
                        severity=RedFlagSeverity.HIGH,
                        title=f"Potential Phantom Supplier: {entity}",
                        description=(
                            f"Supplier '{entity}' received {entity_inflow:,.0f} DZD without a verified "
                            "Numéro d'Identification Fiscale (NIF). Risk of fictitious shell company invoicing."
                        ),
                        evidence={"entity": entity, "totalInflowDzd": entity_inflow, "nif": nif},
                        suggestedRemediation="Verify Registre du Commerce (CNRC) and active fiscal card for supplier.",
                    )
                )

        # 4. Generate Red Flags for Circular Loops
        if loops:
            total_circular_vol = sum(c.totalCycleVolumeDzd for c in loops)
            flags.append(
                ForensicRedFlag(
                    code="FLG_CIRCULAR_ROUND_TRIPPING",
                    category=RedFlagCategory.CIRCULAR_TRANSACTION,
                    severity=RedFlagSeverity.CRITICAL,
                    title=f"Circular Transaction Loops Detected ({len(loops)} Cycles)",
                    description=(
                        f"Found {len(loops)} closed round-tripping cycles with cumulative volume of "
                        f"{total_circular_vol:,.0f} DZD. Indicates fictitious turnover inflation."
                    ),
                    evidence={"cyclesCount": len(loops), "totalVolumeDzd": total_circular_vol},
                    suggestedRemediation="Subpoena bank wire proofs and customs clearance bills for goods traded in cycle.",
                )
            )
            score = min(100.0, 50.0 + len(loops) * 20.0 + (10.0 if phantom_suppliers else 0.0))
        elif phantom_suppliers:
            score = 40.0
        else:
            score = 5.0

        return score, loops, phantom_suppliers, flags

    # =========================================================================
    # 4. BANK STATEMENT RECONCILIATION & RUNWAY DIVERGENCE
    # =========================================================================

    def reconcile_cash_burn(
        self,
        statements: List[BankStatementMonth],
        claimed_burn: float,
        claimed_runway: float,
    ) -> Tuple[float, List[ForensicRedFlag], float, float, float]:
        """
        Verify internal mathematical integrity of monthly bank balances and reconcile
        actual average net burn rate against founder claimed runway.
        Returns: (cash_score, list_of_red_flags, actual_burn_dzd, actual_runway_months, runway_delta_months)
        """
        flags: List[ForensicRedFlag] = []

        if not statements:
            if claimed_runway > 6.0:
                flags.append(
                    ForensicRedFlag(
                        code="FLG_BANK_NO_STATEMENTS",
                        category=RedFlagCategory.CASH_RECONCILIATION,
                        severity=RedFlagSeverity.HIGH,
                        title="No Bank Statements Submitted for Runway Validation",
                        description=f"Founder claims {claimed_runway:.1f} months runway without official bank statement proofs.",
                        evidence={"claimedRunwayMonths": claimed_runway},
                        suggestedRemediation="Require authenticated monthly bank account statements.",
                    )
                )
                return 65.0, flags, claimed_burn, 0.0, claimed_runway
            return 5.0, flags, claimed_burn, claimed_runway, 0.0

        # 1. Statement Mathematical Continuity Checks
        ledger_discrepancy_sum = 0.0
        burn_rates: List[float] = []

        for i, stmt in enumerate(statements):
            expected_closing = stmt.openingBalanceDzd + stmt.totalDepositsDzd - stmt.totalWithdrawalsDzd
            month_discrepancy = abs(stmt.closingBalanceDzd - expected_closing)
            ledger_discrepancy_sum += month_discrepancy

            if month_discrepancy > 100.0:
                flags.append(
                    ForensicRedFlag(
                        code=f"FLG_BANK_MATH_DISCREPANCY_{stmt.period}",
                        category=RedFlagCategory.CASH_RECONCILIATION,
                        severity=RedFlagSeverity.CRITICAL,
                        title=f"Bank Ledger Math Tampering: Period {stmt.period}",
                        description=(
                            f"Closing balance ({stmt.closingBalanceDzd:,.0f} DZD) does not equal "
                            f"Opening ({stmt.openingBalanceDzd:,.0f}) + Deposits ({stmt.totalDepositsDzd:,.0f}) "
                            f"- Withdrawals ({stmt.totalWithdrawalsDzd:,.0f}). Discrepancy: {month_discrepancy:,.0f} DZD."
                        ),
                        evidence={"period": stmt.period, "discrepancyDzd": month_discrepancy},
                        suggestedRemediation="Inspect raw electronic bank statements for document forgery.",
                    )
                )

            # Month-to-month opening/closing continuity
            if i > 0:
                prev_closing = statements[i - 1].closingBalanceDzd
                continuity_gap = abs(stmt.openingBalanceDzd - prev_closing)
                if continuity_gap > 100.0:
                    flags.append(
                        ForensicRedFlag(
                            code=f"FLG_BANK_CONTINUITY_GAP_{stmt.period}",
                            category=RedFlagCategory.CASH_RECONCILIATION,
                            severity=RedFlagSeverity.CRITICAL,
                            title=f"Bank Opening Balance Discontinuity: Period {stmt.period}",
                            description=(
                                f"Period {stmt.period} opening balance ({stmt.openingBalanceDzd:,.0f} DZD) diverges from "
                                f"previous period closing balance ({prev_closing:,.0f} DZD) by {continuity_gap:,.0f} DZD."
                            ),
                            evidence={"period": stmt.period, "gapDzd": continuity_gap},
                            suggestedRemediation="Verify if unlisted bank accounts exist or statements were manipulated.",
                        )
                    )

            # Monthly net burn: net outflows
            net_burn = max(0.0, stmt.totalWithdrawalsDzd - stmt.totalDepositsDzd)
            burn_rates.append(net_burn)

        # 2. Runway Reconciliation
        actual_avg_burn = sum(burn_rates) / max(len(burn_rates), 1)
        latest_cash_balance = statements[-1].closingBalanceDzd

        effective_burn = actual_avg_burn if actual_avg_burn > 0 else (claimed_burn if claimed_burn > 0 else 1.0)
        actual_runway = max(0.0, latest_cash_balance / effective_burn)

        runway_delta = claimed_runway - actual_runway
        score = 0.0

        if ledger_discrepancy_sum > 500.0:
            score += 50.0

        if runway_delta > 6.0:
            score += 45.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_RUNWAY_EXAGGERATION_CRITICAL",
                    category=RedFlagCategory.CASH_RECONCILIATION,
                    severity=RedFlagSeverity.CRITICAL,
                    title=f"Severe Cash Runway Exaggeration (+{runway_delta:.1f} Months)",
                    description=(
                        f"Founder claims {claimed_runway:.1f} months of runway, but actual bank cash "
                        f"({latest_cash_balance:,.0f} DZD) at average burn ({actual_avg_burn:,.0f} DZD/mo) "
                        f"yields only {actual_runway:.1f} months of liquidity."
                    ),
                    evidence={
                        "claimedRunwayMonths": claimed_runway,
                        "actualRunwayMonths": actual_runway,
                        "cashBalanceDzd": latest_cash_balance,
                        "avgMonthlyBurnDzd": actual_avg_burn,
                    },
                    suggestedRemediation="Enforce immediate capital injection conditions or adjust bridge valuation downward.",
                )
            )
        elif runway_delta > 3.0:
            score += 25.0
            flags.append(
                ForensicRedFlag(
                    code="FLG_RUNWAY_VARIANCE_MODERATE",
                    category=RedFlagCategory.CASH_RECONCILIATION,
                    severity=RedFlagSeverity.MEDIUM,
                    title=f"Noticeable Runway Variance (+{runway_delta:.1f} Months)",
                    description="Actual bank cash suggests a shorter runway than stated in investor materials.",
                    evidence={"claimedRunway": claimed_runway, "actualRunway": actual_runway},
                    suggestedRemediation="Review 6-month projected working capital forecast.",
                )
            )
        else:
            score = max(5.0, score)

        score = min(100.0, score)
        return score, flags, actual_avg_burn, actual_runway, runway_delta


# Global singleton instance
forensic_fraud_detector = ForensicFraudDetector()
