"""
TamWheel Sovereign Ethical Agentic Venture OS — Consumer Protection & Vulnerable Investor Schemas.
Implements:
- 6-Month Liquid Living Expense Reserve Diagnostic
- Vulnerable Investor Classification & Mandatory Ticket Capping (max 5,000 DA)
- MiFID II & COSOB Regulation 23-01 Investor Suitability Scoring
- Ethical Risk Waiver Generation (Multi-language text and cryptographic declaration hash)
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class InvestorSuitabilityTier(str, Enum):
    VULNERABLE_INVESTOR = "VULNERABLE_INVESTOR"
    SUITABLE_RETAIL_INVESTOR = "SUITABLE_RETAIL_INVESTOR"
    ACCREDITED_ANGEL = "ACCREDITED_ANGEL"
    INSTITUTIONAL_QUALIFIED = "INSTITUTIONAL_QUALIFIED"


class LiquidityDiagnosticRequest(BaseModel):
    monthlyHouseholdExpenseDzd: float = Field(..., gt=0, description="Monthly basic household living expenses in DZD")
    liquidSavingsDzd: float = Field(..., ge=0, description="Readily available liquid bank / cash savings in DZD")
    netWorthDzd: float = Field(default=1000000.0, ge=0, description="Total estimated net worth excluding primary residence")
    knowledgeScoreK: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Understanding of startup illiquidity and total loss risk (0-100)")
    lossBearingCapacityC: Optional[float] = Field(65.0, ge=0.0, le=100.0, description="Loss absorption capacity score (0-100)")
    behavioralRiskB: Optional[float] = Field(60.0, ge=0.0, le=100.0, description="Behavioral drawdown resilience score (0-100)")


class LiquidityDiagnosticResponse(BaseModel):
    isVulnerable: bool
    suitabilityTier: InvestorSuitabilityTier
    reserveCoverageMonths: float
    requiredReserveDzd: float
    liquidSavingsDzd: float
    compositeSuitabilityScore: float
    maxPermittedTicketDzd: float
    requiresEthicalWaiver: bool
    riskWarning: Optional[str] = None
    regulatoryNotes: str
    evaluatedAt: str


class EthicalWaiverGenerateRequest(BaseModel):
    investorId: int = Field(..., gt=0)
    proposedPledgeAmountDzd: float = Field(..., gt=0)
    monthlyHouseholdExpenseDzd: float = Field(..., gt=0)
    liquidSavingsDzd: float = Field(..., ge=0)


class EthicalWaiverDocumentResponse(BaseModel):
    waiverId: str
    investorId: int
    proposedPledgeAmountDzd: float
    cappedPledgeAmountDzd: float
    isVulnerable: bool
    declarationHash: str
    waiverTextAr: str
    waiverTextFr: str
    waiverTextEn: str
    statutoryCoolingOffDays: int
    coolingOffDeadline: str
    issuedAt: str
