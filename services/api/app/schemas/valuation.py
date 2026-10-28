"""
TamWheel Sovereign Ethical Agentic Venture OS — Algorithmic Valuation Pydantic Schemas.
Implements:
- Modified Berkus Method (Calibrated to Algeria, capped at 20M - 50M DZD)
- Scorecard (Bill Payne) Method with MENA Weights
- Risk Factor Summation Method (RFSM) across 12 emerging market vectors
- Venture Capital (VC) Method & First Chicago DCF
- Stage-Based Composite Weighting Vector (Stages 0, 1, 2, 3)
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class StartupVentureStage(str, Enum):
    STAGE_0_PRE_MVP = "STAGE_0_PRE_MVP"
    STAGE_1_EARLY_MVP = "STAGE_1_EARLY_MVP"
    STAGE_2_EARLY_REVENUE = "STAGE_2_EARLY_REVENUE"    # Revenue < 10M DZD
    STAGE_3_GROWTH_SCALE = "STAGE_3_GROWTH_SCALE"      # Revenue > 10M DZD


class BerkusBlockInputs(BaseModel):
    soundIdea: float = Field(0.8, ge=0.0, le=1.0, description="Sound Idea & Problem-Solution Fit (0.0 to 1.0)")
    teamQuality: float = Field(0.8, ge=0.0, le=1.0, description="Founding Team Grit & Technical Competence (0.0 to 1.0)")
    workingPrototype: float = Field(0.5, ge=0.0, le=1.0, description="Functional MVP / Working Technology (0.0 to 1.0)")
    strategicAlliances: float = Field(0.4, ge=0.0, le=1.0, description="Strategic Partnerships / Commercial Traction (0.0 to 1.0)")
    startupLabelMoat: float = Field(0.5, ge=0.0, le=1.0, description="Official Startup Label (Decree 20-254) Regulatory Moat (0.0 to 1.0)")
    maxCapDzd: Optional[float] = Field(20000000.0, gt=0, description="Maximum pre-money valuation cap for Berkus method")


class ScorecardFactorInputs(BaseModel):
    team: float = Field(1.1, ge=0.5, le=1.5, description="Team Strength vs Algerian Seed Baseline (0.5 to 1.5, 1.0 = average)")
    opportunitySize: float = Field(1.0, ge=0.5, le=1.5, description="Market Size & Growth Potential")
    productTechnology: float = Field(1.0, ge=0.5, le=1.5, description="Product Quality & Tech Defensibility")
    competitiveEnvironment: float = Field(1.0, ge=0.5, le=1.5, description="Competitive Advantage")
    marketingPartnerships: float = Field(0.9, ge=0.5, le=1.5, description="Go-to-Market Channels & Strategic Alliances")
    capitalIntensity: float = Field(1.0, ge=0.5, le=1.5, description="Need for Additional Funding & Capex Efficiency")
    startupLabelDecree: float = Field(1.2, ge=0.5, le=1.5, description="Statutory Decree 20-254 Label Status")
    baselineValuationDzd: Optional[float] = Field(25000000.0, gt=0, description="Median seed valuation benchmark in Algeria")


class RFSMFactorGrades(BaseModel):
    managementRisk: int = Field(1, ge=-2, le=2, description="Management competence (-2 to +2)")
    stageOfBusiness: int = Field(0, ge=-2, le=2)
    legislationPoliticalRisk: int = Field(1, ge=-2, le=2, description="COSOB / Bank of Algeria regulatory exposure")
    supplyChainCustomsRisk: int = Field(-1, ge=-2, le=2, description="Port & Customs import exposure")
    salesDistributionRisk: int = Field(0, ge=-2, le=2)
    fundingCapitalRaiseRisk: int = Field(0, ge=-2, le=2)
    competitionRisk: int = Field(0, ge=-2, le=2)
    technologyIpRisk: int = Field(1, ge=-2, le=2, description="INAPI patent / proprietary software")
    litigationLegalRisk: int = Field(1, ge=-2, le=2, description="Clean Law 22-09 SPAS corporate setup")
    internationalFxRisk: int = Field(-1, ge=-2, le=2, description="Square Port-Said vs official FX spread")
    reputationRisk: int = Field(1, ge=-2, le=2)
    exitOpportunityRisk: int = Field(0, ge=-2, le=2)
    deltaQuantumDzd: Optional[float] = Field(2000000.0, gt=0, description="Monetary delta per grade point")
    baselineValuationDzd: Optional[float] = Field(25000000.0, gt=0)


class VCMethodInputs(BaseModel):
    projectedExitValuationDzd: float = Field(250000000.0, gt=0, description="Forecasted terminal exit valuation")
    exitHorizonYears: int = Field(5, ge=2, le=10, description="Expected time to exit in years")
    targetAnnualIrrPct: float = Field(45.0, ge=20.0, le=80.0, description="Target Investor IRR %")
    investmentRequiredDzd: float = Field(15000000.0, gt=0, description="Round investment amount")
    retentionDilutionFactor: float = Field(0.75, ge=0.3, le=1.0, description="Future dilution retention (1 - dilution)")


class DCFScenarioInputs(BaseModel):
    projected5YearFcffDzd: List[float] = Field(
        default_factory=lambda: [500000.0, 2500000.0, 6000000.0, 12000000.0, 20000000.0],
        description="Forecasted 5-year Free Cash Flow to Firm (FCFF)"
    )
    discountRatePct: float = Field(30.0, ge=15.0, le=50.0, description="MENA emerging market discount rate (incl. country risk premium)")
    terminalGrowthRatePct: float = Field(4.0, ge=1.0, le=8.0, description="Perpetual terminal growth rate %")


class ValuationCalculationRequest(BaseModel):
    stage: StartupVentureStage = StartupVentureStage.STAGE_1_EARLY_MVP
    berkus: Optional[BerkusBlockInputs] = None
    scorecard: Optional[ScorecardFactorInputs] = None
    rfsm: Optional[RFSMFactorGrades] = None
    vcMethod: Optional[VCMethodInputs] = None
    dcf: Optional[DCFScenarioInputs] = None


class ValuationMethodResult(BaseModel):
    methodName: str
    preMoneyValuationDzd: float
    weightInComposite: float
    details: Dict[str, Any]


class SensitivityRangeItem(BaseModel):
    scenario: str
    preMoneyValuationDzd: float
    deviationPct: float


class ValuationReportResponse(BaseModel):
    stage: StartupVentureStage
    compositePreMoneyValuationDzd: float
    confidenceIntervalLowDzd: float
    confidenceIntervalHighDzd: float
    methodBreakdown: List[ValuationMethodResult]
    stageWeightingVector: Dict[str, float]
    sensitivityAnalysis: List[SensitivityRangeItem]
    statutoryCapWarning: Optional[str] = None
    generatedAt: str
