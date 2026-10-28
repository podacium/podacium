"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Fraud & Anomaly Schemas.
Implements data models for:
- Algerian G50 Statutory Tax Declarations cross-check (VAT/TAP vs Declared Revenue)
- CNAS Social Security Slips cross-check (Headcount & Wage Bill vs Declared Payroll)
- Phantom Supplier & Circular Transaction Graph Detection (Round-tripping cycles)
- Bank Statement Balance & Cash Burn Reconciliation
- Composite Fraud Risk Scoring & Red-Flag Audit Matrix
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FraudRiskLevel(str, Enum):
    LOW_RISK = "LOW_RISK"                    # Score < 25
    MODERATE_RISK = "MODERATE_RISK"          # Score 25 - 49
    HIGH_RISK = "HIGH_RISK"                  # Score 50 - 74
    CRITICAL_FRAUD_ALERT = "CRITICAL_FRAUD_ALERT"  # Score >= 75


class RedFlagSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RedFlagCategory(str, Enum):
    TAX_INCONSISTENCY = "TAX_INCONSISTENCY"
    PAYROLL_MISMATCH = "PAYROLL_MISMATCH"
    CIRCULAR_TRANSACTION = "CIRCULAR_TRANSACTION"
    CASH_RECONCILIATION = "CASH_RECONCILIATION"
    PHANTOM_SUPPLIER = "PHANTOM_SUPPLIER"


class G50TaxDeclaration(BaseModel):
    period: str = Field(..., description="Tax period (e.g. '2026-01' or '2026-Q1')")
    turnoverReportedDzd: float = Field(..., ge=0, description="Taxable Turnover (Chiffre d'affaires) reported on G50")
    tvaCollectedDzd: float = Field(default=0.0, ge=0, description="TVA collected on sales (typically 19% or 9%)")
    tapReportedDzd: Optional[float] = Field(default=0.0, ge=0, description="Taxe sur l'Activité Professionnelle (TAP)")
    submissionDate: Optional[str] = Field(None, description="Official filing date at Direction des Impôts")
    receiptNumber: Optional[str] = Field(None, description="Official G50 receipt number")


class CNASDeclaration(BaseModel):
    period: str = Field(..., description="CNAS reporting period (e.g. '2026-Q1')")
    activeEmployeesCount: int = Field(..., ge=0, description="Number of declared active salaried employees")
    declaredGrossSalaryDzd: float = Field(..., ge=0, description="Total gross wages declared on CNAS slip")
    contributionsPaidDzd: float = Field(default=0.0, ge=0, description="Total social security contributions paid (34.5%)")
    cnasSlipRef: Optional[str] = Field(None, description="CNAS borderau reference number")


class TransactionEdge(BaseModel):
    transactionId: str = Field(..., description="Unique invoice or transaction identifier")
    sourceEntity: str = Field(..., description="Originating entity (payor / customer)")
    targetEntity: str = Field(..., description="Receiving entity (payee / vendor)")
    amountDzd: float = Field(..., gt=0, description="Transaction amount in Algerian Dinars")
    invoiceDate: str = Field(..., description="Invoice date (YYYY-MM-DD)")
    description: Optional[str] = Field(None, description="Invoice description / service rendered")
    isRelatedParty: bool = Field(default=False, description="Whether entity shares founders/directors/relatives")
    sourceNif: Optional[str] = Field(None, description="Numéro d'Identification Fiscale (NIF) of source")
    targetNif: Optional[str] = Field(None, description="Numéro d'Identification Fiscale (NIF) of target")


class BankStatementMonth(BaseModel):
    period: str = Field(..., description="Statement month (YYYY-MM)")
    openingBalanceDzd: float = Field(..., description="Opening bank balance in DZD")
    totalDepositsDzd: float = Field(..., ge=0, description="Total cash inflows / credits")
    totalWithdrawalsDzd: float = Field(..., ge=0, description="Total cash outflows / debits")
    closingBalanceDzd: float = Field(..., description="Closing bank balance in DZD")


class ClaimedFinancials(BaseModel):
    annualDeclaredRevenueDzd: float = Field(..., ge=0, description="Pitch deck or self-reported annual revenue")
    claimedMonthlyPayrollDzd: float = Field(..., ge=0, description="Claimed monthly wage bill")
    claimedHeadcount: int = Field(..., ge=0, description="Claimed total team headcount")
    claimedMonthlyBurnDzd: float = Field(..., ge=0, description="Claimed net monthly cash burn")
    claimedRunwayMonths: float = Field(..., ge=0, description="Claimed runway in months")


class CircularLoopResult(BaseModel):
    cycleEntities: List[str] = Field(..., description="Ordered list of entities in the detected cycle")
    totalCycleVolumeDzd: float = Field(..., description="Total cumulative DZD volume across the cycle")
    cycleLength: int = Field(..., description="Number of hops in the cycle")
    edgesInvolved: List[str] = Field(..., description="Transaction IDs in the circular loop")
    description: str = Field(..., description="Human-readable forensic summary")


class ForensicRedFlag(BaseModel):
    code: str = Field(..., description="Unique alphanumeric flag code (e.g. FLG_TAX_UNDERREPORT_CRIT)")
    category: RedFlagCategory
    severity: RedFlagSeverity
    title: str = Field(..., description="Short flag title")
    description: str = Field(..., description="Detailed explanation of the discrepancy")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Numerical proof and metadata")
    suggestedRemediation: str = Field(..., description="Prescribed action for auditors or founders")


class ForensicFraudScoreBreakdown(BaseModel):
    taxInconsistencyScore: float = Field(..., ge=0, le=100, description="Tax mismatch risk score (0-100)")
    payrollMismatchScore: float = Field(..., ge=0, le=100, description="Payroll / CNAS mismatch risk score (0-100)")
    circularLoopScore: float = Field(..., ge=0, le=100, description="Circular transaction / round-tripping score (0-100)")
    cashReconciliationScore: float = Field(..., ge=0, le=100, description="Cash burn & bank ledger divergence score (0-100)")
    overallFraudScore: float = Field(..., ge=0, le=100, description="Composite weighted fraud risk score (0-100)")
    riskLevel: FraudRiskLevel


class ForensicAuditRequest(BaseModel):
    startupId: str = Field(..., description="Target startup ID")
    companyName: str = Field(..., description="Legal company name")
    nif: Optional[str] = Field(None, description="Company NIF (Numéro d'Identification Fiscale)")
    claimedFinancials: ClaimedFinancials
    g50Declarations: List[G50TaxDeclaration] = Field(default_factory=list)
    cnasDeclarations: List[CNASDeclaration] = Field(default_factory=list)
    transactions: List[TransactionEdge] = Field(default_factory=list)
    bankStatements: List[BankStatementMonth] = Field(default_factory=list)


class ForensicAuditResponse(BaseModel):
    startupId: str
    auditTimestamp: str
    scoreBreakdown: ForensicFraudScoreBreakdown
    redFlags: List[ForensicRedFlag]
    circularLoopsDetected: List[CircularLoopResult]
    taxDiscrepancyDzd: float
    payrollDiscrepancyDzd: float
    runwayDiscrepancyMonths: float
    summary: str
    status: str


class CircularCheckRequest(BaseModel):
    transactions: List[TransactionEdge] = Field(..., min_length=1)
    targetEntity: Optional[str] = None


class CircularCheckResponse(BaseModel):
    cyclesFound: int
    circularLoops: List[CircularLoopResult]
    phantomSuppliers: List[Dict[str, Any]]
    circularRiskScore: float


class CashReconciliationRequest(BaseModel):
    bankStatements: List[BankStatementMonth] = Field(..., min_length=1)
    claimedMonthlyBurnDzd: float = Field(..., ge=0)
    claimedRunwayMonths: float = Field(..., ge=0)


class CashReconciliationResponse(BaseModel):
    isReconciled: bool
    reconciliationScore: float
    actualAverageMonthlyBurnDzd: float
    calculatedRunwayMonths: float
    claimedVsCalculatedRunwayDeltaMonths: float
    ledgerDiscrepancyTotalDzd: float
    redFlags: List[ForensicRedFlag]
