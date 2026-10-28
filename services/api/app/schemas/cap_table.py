"""
TamWheel Cap-Table & Corporate Law Pydantic Schemas.
Implements Algerian Law 22-09 SPAS corporate framework, multi-class equity securities,
BSA-AIR convertible warrants, Hamilton-Hare nominee discretization, and exit waterfalls.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================

class ShareClassType(str, Enum):
    ORDINAIRE = "ORDINAIRE"
    PREFERENCE_A = "PREFERENCE_A"
    PREFERENCE_B = "PREFERENCE_B"
    BSPCE = "BSPCE"
    WARRANT = "WARRANT"


class StakeholderRole(str, Enum):
    FOUNDER = "FOUNDER"
    INVESTOR_ANGEL = "INVESTOR_ANGEL"
    INVESTOR_VC = "INVESTOR_VC"
    NOMINEE_SPAS = "NOMINEE_SPAS"
    EMPLOYEE = "EMPLOYEE"
    ADVISOR = "ADVISOR"


class ConvertibleInstrumentType(str, Enum):
    BSA_AIR = "BSA_AIR"
    SAFE_PRE_MONEY = "SAFE_PRE_MONEY"
    SAFE_POST_MONEY = "SAFE_POST_MONEY"
    CONVERTIBLE_NOTE = "CONVERTIBLE_NOTE"


class OptionPoolTiming(str, Enum):
    PRE_ROUND = "PRE_ROUND"
    POST_ROUND = "POST_ROUND"


class LiquidationPreferenceType(str, Enum):
    NON_PARTICIPATING = "NON_PARTICIPATING"
    PARTICIPATING = "PARTICIPATING"
    CAPPED_PARTICIPATING = "CAPPED_PARTICIPATING"


# =============================================================================
# CORE CAP-TABLE MODELS
# =============================================================================

class ShareClassModel(BaseModel):
    classId: str
    className: ShareClassType
    parValueDzd: float
    authorizedShares: int
    issuedShares: int
    liquidationPreferenceMultiple: float = 1.0
    liquidationType: LiquidationPreferenceType = LiquidationPreferenceType.NON_PARTICIPATING
    participationCapMultiple: Optional[float] = None
    seniority: int = 1
    isVoting: bool = True
    conversionRatio: float = 1.0


class ShareClassCreateRequest(BaseModel):
    className: ShareClassType
    parValueDzd: float = Field(100.0, gt=0)
    authorizedShares: int = Field(..., gt=0)
    liquidationPreferenceMultiple: float = Field(1.0, ge=1.0, le=5.0)
    liquidationType: LiquidationPreferenceType = LiquidationPreferenceType.NON_PARTICIPATING
    participationCapMultiple: Optional[float] = None
    seniority: int = Field(1, ge=1, le=10)
    isVoting: bool = True
    conversionRatio: float = Field(1.0, gt=0)


class StakeholderModel(BaseModel):
    stakeholderId: str
    name: str
    role: StakeholderRole
    taxIdNif: Optional[str] = None
    email: Optional[str] = None


class StakeholderCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    role: StakeholderRole = StakeholderRole.FOUNDER
    taxIdNif: Optional[str] = None
    email: Optional[str] = None


class ShareIssuanceModel(BaseModel):
    issuanceId: str
    classId: str
    stakeholderId: str
    certificateNumber: str
    sharesIssued: int
    issuePriceDzd: float
    isNomineeBlock: bool = False
    notarialDeedRef: Optional[str] = None
    issueDate: str


class ShareIssuanceCreateRequest(BaseModel):
    classId: str
    stakeholderId: str
    sharesIssued: int = Field(..., gt=0)
    issuePriceDzd: float = Field(..., ge=0)
    certificateNumber: Optional[str] = None
    isNomineeBlock: bool = False
    notarialDeedRef: Optional[str] = None


class ConvertibleInstrumentItem(BaseModel):
    instrumentId: Optional[str] = None
    instrumentType: str = "BSA_AIR"
    investorId: Optional[str] = None
    investorName: Optional[str] = None
    principalAmountDzd: int = Field(..., gt=0)
    valuationCapDzd: Optional[int] = Field(None, gt=0)
    valuationFloorDzd: Optional[int] = Field(None, gt=0)
    discountRate: float = Field(0.20, ge=0.0, le=0.50)
    hasMfnClause: bool = False
    maturityMonths: Optional[int] = 18


class OptionPoolModel(BaseModel):
    poolId: str
    authorizedOptions: int
    grantedOptions: int
    availableOptions: int
    poolPct: float


class PledgeItem(BaseModel):
    investorId: str
    amountDzd: int = Field(..., gt=0)
    investorName: Optional[str] = None


class ConvertibleConversionItem(BaseModel):
    instrumentType: str
    principalAmountDzd: int
    conversionPriceDzd: float
    sharesIssued: int
    dilutionPct: float
    appliedCapOrDiscount: str = "DISCOUNT"


class NomineeBeneficialItem(BaseModel):
    investorId: str
    amountDzd: int
    beneficialUnitsExact: float
    discretizedShares: int
    ownershipPct: float
    remainderExact: float = 0.0


class NomineeAllocationResponse(BaseModel):
    totalNomineeShares: int
    totalNomineeAmountDzd: int
    allocations: List[NomineeBeneficialItem]
    exactZeroLossInvariantVerified: bool
    unallocatedShares: int = 0


class StakeholderLedgerEntry(BaseModel):
    stakeholderId: str
    name: str
    role: str
    sharesByClass: Dict[str, int]
    totalIssuedShares: int
    fullyDilutedShares: int
    undilutedOwnershipPct: float
    fullyDilutedOwnershipPct: float
    votingPowerPct: float
    totalCapitalInvestedDzd: float


class CapTableSummaryResponse(BaseModel):
    startupId: str
    companyName: str
    totalAuthorizedShares: int
    totalIssuedShares: int
    totalOptionPoolReserved: int
    totalFullyDilutedShares: int
    shareClasses: List[ShareClassModel]
    stakeholders: List[StakeholderLedgerEntry]
    activeConvertiblesCount: int
    totalConvertiblePrincipalDzd: int
    lastNotarialFilingDate: Optional[str] = None


# =============================================================================
# DILUTION & ROUND SIMULATION SCHEMAS
# =============================================================================

class CapTableSimulateRequest(BaseModel):
    preMoneyValuationDzd: int = Field(..., gt=0)
    investmentAmountDzd: int = Field(..., gt=0)
    preMoneyShares: int = Field(100000, gt=0)
    shareClass: ShareClassType = ShareClassType.ORDINAIRE
    optionPoolExpansionPct: float = Field(0.0, ge=0.0, le=0.40)
    optionPoolTiming: OptionPoolTiming = OptionPoolTiming.PRE_ROUND
    convertibles: Optional[List[ConvertibleInstrumentItem]] = None
    pledges: Optional[List[PledgeItem]] = None


class CapTableSimulateResponse(BaseModel):
    preMoneyValuationDzd: int
    investmentAmountDzd: int
    postMoneyValuationDzd: int
    sharePriceDzd: float
    effectiveSharePriceDzd: float
    newSharesIssued: int
    optionPoolSharesCreated: int = 0
    postRoundTotalShares: int
    postRoundFullyDilutedShares: int
    investorEquityPct: float
    founderDilutionFactor: float
    convertibleConversions: List[ConvertibleConversionItem]
    nomineeAllocation: Optional[NomineeAllocationResponse] = None
    stakeholdersPostRound: Optional[List[StakeholderLedgerEntry]] = None


# Alias for advanced dilution requests
DilutionSimulateRequest = CapTableSimulateRequest
DilutionSimulateResponse = CapTableSimulateResponse


# =============================================================================
# EXIT & WATERFALL SCHEMAS
# =============================================================================

class WaterfallClassPayout(BaseModel):
    className: str
    totalShares: int
    investedCapitalDzd: float
    preferencePayoutDzd: float
    participationPayoutDzd: float
    totalPayoutDzd: float
    payoutPerShareDzd: float
    moic: float
    convertedToOrdinary: bool
    percentageOfExit: float


class WaterfallStakeholderPayout(BaseModel):
    stakeholderId: str
    stakeholderName: str
    role: str
    totalShares: int
    investedCapitalDzd: float
    totalPayoutDzd: float
    moic: float
    percentageOfExit: float


class WaterfallSimulateRequest(BaseModel):
    exitValuationDzd: int = Field(..., gt=0)
    debtAmountDzd: int = Field(0, ge=0)
    shareClasses: Optional[List[ShareClassModel]] = None
    issuances: Optional[List[ShareIssuanceModel]] = None
    stakeholders: Optional[List[StakeholderModel]] = None


class WaterfallSimulateResponse(BaseModel):
    exitValuationDzd: int
    debtRepaymentDzd: int
    distributableProceedsDzd: int
    classPayouts: List[WaterfallClassPayout]
    stakeholderPayouts: List[WaterfallStakeholderPayout]
    commonShareValueDzd: float
    allPreferredConverted: bool


# =============================================================================
# NOMINEE SPAS & PORTAGE SCHEMAS
# =============================================================================

class CnrcFilingManifest(BaseModel):
    nomineeSpasName: str
    rcNumber: str
    nifNumber: str
    totalPooledDzd: int
    legalSharesCount: int
    nominalValueTotalDzd: float
    beneficialOwnersCount: int
    ledgerSha256: str
    statutoryReference: str
    notarialCertificateText: str


class NomineePoolRequest(BaseModel):
    startupId: str
    campaignId: Optional[str] = None
    totalLegalShares: int = Field(..., gt=0)
    pledges: List[PledgeItem]
    nomineeSpasName: str = "TamWheel Nominee SPAS I"
    parValueDzd: float = 100.0


class NomineePoolResponse(BaseModel):
    statutoryIssuanceId: str
    cnrcManifest: CnrcFilingManifest
    nomineeAllocation: NomineeAllocationResponse
    portageConventionSummary: str


# =============================================================================
# BSA-AIR CONTRACT GENERATION SCHEMAS
# =============================================================================

class BsaAirGenerateRequest(BaseModel):
    startupName: str
    startupRcNumber: Optional[str] = None
    startupWilaya: int = 16
    investorName: str
    investorNifOrNin: Optional[str] = None
    principalAmountDzd: int = Field(..., gt=0)
    valuationCapDzd: Optional[int] = None
    valuationFloorDzd: Optional[int] = None
    discountRate: float = Field(0.20, ge=0.0, le=0.50)
    qualifiedRoundThresholdDzd: int = Field(15000000, gt=0)
    maturityMonths: int = Field(18, ge=6, le=36)
    hasMfnClause: bool = True
    language: str = "fr"


class BsaAirContractResponse(BaseModel):
    contractId: str
    contractHashSha256: str
    governingLaw: str
    contractMarkdown: str
    statutorySummary: Dict[str, Any]


# =============================================================================
# SECONDARY LIQUIDITY & UNIFORM-PRICE DUTCH AUCTION SCHEMAS
# =============================================================================

class LiquidityWindowStatus(str, Enum):
    ANNOUNCED = "ANNOUNCED"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CLEARING = "CLEARING"
    SETTLED = "SETTLED"
    CANCELLED = "CANCELLED"


class SellerOrderRequest(BaseModel):
    sellerId: str
    sellerName: Optional[str] = None
    shareClass: ShareClassType = ShareClassType.ORDINAIRE
    sharesOffered: int = Field(..., gt=0)
    minPricePerShareDzd: float = Field(..., gt=0)
    costBasisPerShareDzd: float = Field(..., ge=0)
    isReinvestmentExemptCidta169: bool = False


class SellerOrderResult(BaseModel):
    orderId: str
    sellerId: str
    sharesOffered: int
    sharesSold: int
    minPriceDzd: float
    clearingPriceDzd: float
    grossProceedsDzd: float
    platformFeeDzd: float
    profitCarryDzd: float
    netPayoutDzd: float
    capitalGainDzd: float
    cidtaExemptionApplied: bool


class LiquidityWindowCreateRequest(BaseModel):
    quarter: str = "2026-Q4"
    minPriceDzd: float = Field(..., gt=0)
    maxPriceDzd: float = Field(..., gt=0)
    buyerPoolAvailableDzd: float = Field(..., gt=0)
    maxSharesToPurchase: Optional[int] = None
    openDate: str
    closeDate: str


class LiquidityAuctionClearResponse(BaseModel):
    windowId: str
    startupId: str
    quarter: str
    clearingPriceDzd: float
    totalSharesDemanded: int
    totalSharesSupplied: int
    totalSharesTransacted: int
    totalGrossVolumeDzd: float
    totalPlatformFeesDzd: float  # 1.5% fee
    totalProfitCarryDzd: float   # 5.0% carry
    totalNetDistributedDzd: float
    settledOrders: List[SellerOrderResult]
    clearingStatus: str
    settledAt: str


# =============================================================================
# DUAL-ENTITY CROSS-BORDER HOLDCO-OPCO MIRROR SCHEMAS
# =============================================================================

class HoldCoJurisdiction(str, Enum):
    ADGM = "ADGM"         # Abu Dhabi Global Market (Common Law)
    DELAWARE = "DELAWARE" # Delaware C-Corp (DGCL)
    DIFC = "DIFC"         # Dubai International Financial Centre


class HoldCoMirrorSetupRequest(BaseModel):
    holdcoName: str
    jurisdiction: HoldCoJurisdiction = HoldCoJurisdiction.ADGM
    holdcoRegistrationNumber: str
    currency: str = "USD"
    fxExchangeRateToDzd: float = Field(135.0, gt=0)
    totalAuthorizedShares: int = 1000000
    parValueForeign: float = 0.01


class HoldCoShareIssuanceRequest(BaseModel):
    stakeholderId: str
    stakeholderName: str
    diasporaCountry: str
    sharesIssued: int = Field(..., gt=0)
    shareClass: str = "Preferred Series Seed"
    issuePriceForeign: float = Field(..., gt=0)
    issueDate: Optional[str] = None


class CrossBorderMirrorResponse(BaseModel):
    holdcoName: str
    jurisdiction: str
    currency: str
    fxExchangeRateToDzd: float
    totalHoldCoShares: int
    impliedValuationForeign: float
    impliedValuationDzd: float
    opcoStartupId: str
    opcoTotalBeneficialShares: int
    mirrorParityVerified: bool
    diasporaHolders: List[Dict[str, Any]]
    regulatoryComplianceNote: str


# =============================================================================
# ESOP VESTING & ACCELERATION SCHEMAS
# =============================================================================

class AccelerationType(str, Enum):
    NONE = "NONE"
    SINGLE_TRIGGER = "SINGLE_TRIGGER"
    DOUBLE_TRIGGER = "DOUBLE_TRIGGER"


class EsopGrantCreateRequest(BaseModel):
    employeeId: str
    employeeName: str
    optionsGranted: int = Field(..., gt=0)
    strikePriceDzd: float = Field(..., gt=0)
    grantDate: str
    vestingScheduleMonths: int = 48
    cliffMonths: int = 12
    accelerationClause: AccelerationType = AccelerationType.DOUBLE_TRIGGER


class EsopVestingStatusResponse(BaseModel):
    grantId: str
    employeeId: str
    employeeName: str
    optionsGranted: int
    strikePriceDzd: float
    grantDate: str
    asOfDate: str
    monthsElapsed: int
    cliffReached: bool
    vestedOptions: int
    unvestedOptions: int
    exercisedOptions: int
    exercisableOptions: int
    vestedPercentage: float
    currentFmvDzd: float
    intrinsicValueDzd: float
    accelerationApplied: bool
    accelerationReason: Optional[str] = None


class EsopExerciseRequest(BaseModel):
    optionsToExercise: int = Field(..., gt=0)
    paymentMethod: str = "CASH" # CASH or NET_EXERCISE

