from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from datetime import datetime
from ..generated.prisma.enums import Country, City, OrganizationSector


class OrgRoleEnum(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    BILLING_ADMIN = "BILLING_ADMIN"
    HIRING_MANAGER = "HIRING_MANAGER"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"
    AUDITOR = "AUDITOR"


class OrgProfileSchema(BaseModel):
    longDescription: Optional[str] = None
    specialties: List[str] = []
    technologies: List[str] = []
    competitors: List[str] = []
    fundingRound: Optional[str] = None
    fundingAmount: Optional[float] = None
    revenueRange: Optional[str] = None
    culture: Optional[str] = None
    benefits: Optional[str] = None
    mission: Optional[str] = None
    certifications: List[str] = []
    algerianHealthScore: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


SECTOR_ALIAS_MAP: Dict[str, str] = {
    "TECHNOLOGY": "TECHNOLOGY_AND_SOFTWARE",
    "SOFTWARE": "TECHNOLOGY_AND_SOFTWARE",
    "IT": "TECHNOLOGY_AND_SOFTWARE",
    "EDUCATION": "EDUCATION_AND_EDTECH",
    "EDTECH": "EDUCATION_AND_EDTECH",
    "CONSULTING": "CONSULTING_AND_PROFESSIONAL_SERVICES",
    "PROFESSIONAL_SERVICES": "CONSULTING_AND_PROFESSIONAL_SERVICES",
    "FINANCE": "BANKING_AND_FINANCIAL_SERVICES",
    "BANKING": "BANKING_AND_FINANCIAL_SERVICES",
    "FINTECH": "BANKING_AND_FINANCIAL_SERVICES",
    "HEALTHCARE": "HEALTHCARE_AND_PHARMACEUTICALS",
    "PHARMA": "HEALTHCARE_AND_PHARMACEUTICALS",
    "ENERGY": "ENERGY_AND_OIL_AND_GAS",
    "OIL_AND_GAS": "ENERGY_AND_OIL_AND_GAS",
    "RENEWABLE_ENERGY": "RENEWABLE_ENERGY_AND_CLEANTECH",
    "CLEANTECH": "RENEWABLE_ENERGY_AND_CLEANTECH",
    "MANUFACTURING": "AUTOMOTIVE_AND_MANUFACTURING",
    "AUTOMOTIVE": "AUTOMOTIVE_AND_MANUFACTURING",
    "ECOMMERCE": "RETAIL_AND_CONSUMER_GOODS",
    "RETAIL": "RETAIL_AND_CONSUMER_GOODS",
    "GOVERNMENT": "PUBLIC_SECTOR_AND_ADMINISTRATION",
    "PUBLIC_SECTOR": "PUBLIC_SECTOR_AND_ADMINISTRATION",
    "CONSTRUCTION": "CONSTRUCTION_AND_REAL_ESTATE",
    "REAL_ESTATE": "CONSTRUCTION_AND_REAL_ESTATE",
    "MEDIA": "MEDIA_AND_CREATIVE_INDUSTRIES",
    "CREATIVE": "MEDIA_AND_CREATIVE_INDUSTRIES",
    "TOURISM": "TOURISM_AND_HOSPITALITY",
    "HOSPITALITY": "TOURISM_AND_HOSPITALITY",
    "MINING": "MINING_AND_METALLURGY",
    "TEXTILES": "TEXTILES_AND_APPAREL",
    "NGO": "NON_PROFIT_AND_NGO",
    "NON_PROFIT": "NON_PROFIT_AND_NGO",
    "AGRICULTURE": "AGRICULTURE_AND_FOOD_PRODUCTION",
    "AGRIFOOD": "AGRICULTURE_AND_FOOD_PRODUCTION",
    "LOGISTICS": "TRANSPORTATION_AND_LOGISTICS",
    "TRANSPORTATION": "TRANSPORTATION_AND_LOGISTICS",
    "AEROSPACE": "AEROSPACE_AND_DEFENSE",
    "DEFENSE": "AEROSPACE_AND_DEFENSE",
    "OTHER": "OTHER",
}


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    country: Country
    city: City
    website: Optional[str] = None
    sector: OrganizationSector

    @field_validator("sector", mode="before")
    @classmethod
    def _normalize_sector(cls, v: Any) -> Any:
        if isinstance(v, str):
            upper = v.strip().upper()
            return SECTOR_ALIAS_MAP.get(upper, upper)
        return v

    # Algerian Statutory Fiscal Fields
    rcNumber: Optional[str] = Field(
        None, max_length=50, description="Registre de Commerce"
    )
    nifNumber: Optional[str] = Field(
        None, max_length=30, description="Numéro d'Identification Fiscale (15 digits)"
    )
    nisNumber: Optional[str] = Field(
        None,
        max_length=30,
        description="Numéro d'Identification Statistique (15 digits)",
    )
    articleImposition: Optional[str] = Field(
        None, max_length=30, description="Article d'Imposition (11 digits)"
    )
    taxRegime: Optional[str] = Field(
        None, max_length=50, description="Régime Fiscal (Réel Normal, IFU, etc.)"
    )
    # Enterprise Firmographics & Layer 2 Context
    tagline: Optional[str] = Field(
        None, max_length=160, description="Elevator pitch / Tagline (<160 chars)"
    )
    companySizeBracket: Optional[str] = Field(
        "MICRO_1_10",
        description="MICRO_1_10, SMALL_11_50, MID_51_200, LARGE_201_500, ENTERPRISE_500_PLUS",
    )
    operationalScale: Optional[str] = Field(
        "NATIONAL_58_WILAYAS",
        description="LOCAL, REGIONAL, NATIONAL_58_WILAYAS, MULTINATIONAL",
    )
    primaryLanguages: List[str] = Field(
        default=["FRENCH", "ARABIC"], description="Supported operating languages"
    )
    isPublic: bool = Field(
        True, description="Whether the organization is listed in the public directory"
    )
    internalBulletin: Optional[str] = Field(
        None, description="Markdown bulletin / handbook for internal employees"
    )
    timeZone: Optional[str] = Field(
        "Africa/Algiers", description="Primary organizational timezone"
    )
    keyContacts: Optional[Any] = Field(
        None, description="JSON object of key internal champions and helpdesk"
    )
    hqAddress: Optional[str] = Field(
        None, description="Headquarters street and postal address"
    )
    brandAccentColor: Optional[str] = Field(
        "#1B4D3E", description="Primary brand accent color hex code"
    )
    coverBannerUrl: Optional[str] = Field(
        None, description="Corporate cover banner image URL"
    )
    socialLinks: Optional[Any] = Field(
        None, description="Corporate social links (LinkedIn, X, GitHub, Facebook)"
    )


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    country: Optional[Country] = None
    city: Optional[City] = None
    website: Optional[str] = None
    sector: Optional[OrganizationSector] = None

    @field_validator("sector", mode="before")
    @classmethod
    def _normalize_sector(cls, v: Any) -> Any:
        if isinstance(v, str):
            upper = v.strip().upper()
            return SECTOR_ALIAS_MAP.get(upper, upper)
        return v

    rcNumber: Optional[str] = None
    nifNumber: Optional[str] = None
    nisNumber: Optional[str] = None
    articleImposition: Optional[str] = None
    taxRegime: Optional[str] = None
    tagline: Optional[str] = None
    companySizeBracket: Optional[str] = None
    operationalScale: Optional[str] = None
    primaryLanguages: Optional[List[str]] = None
    isPublic: Optional[bool] = None
    internalBulletin: Optional[str] = None
    timeZone: Optional[str] = None
    keyContacts: Optional[Any] = None
    hqAddress: Optional[str] = None
    brandAccentColor: Optional[str] = None
    coverBannerUrl: Optional[str] = None
    socialLinks: Optional[Any] = None


class OrganizationMemberUser(BaseModel):
    id: int
    fullName: str
    email: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberResponse(BaseModel):
    id: int
    organizationId: int
    userId: int
    role: Optional[str] = None
    createdAt: datetime
    user: OrganizationMemberUser
    model_config = ConfigDict(from_attributes=True)


class InvitationResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    status: str
    createdAt: datetime
    expiresAt: datetime
    organizationId: int
    inviterId: int
    token: Optional[str] = None
    organization: Optional[OrganizationBase] = None
    inviter: Optional[OrganizationMemberUser] = None
    model_config = ConfigDict(from_attributes=True)


class OrganizationResponse(OrganizationBase):
    id: int
    slug: Optional[str] = None
    ownerId: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime
    memberCount: int = 0
    isOwner: bool = False
    userRole: Optional[str] = None
    members: List[OrganizationMemberResponse] = []
    invitations: Optional[List[InvitationResponse]] = []
    orgProfile: Optional[OrgProfileSchema] = None
    isKybVerified: bool = False
    kybStatus: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class OrganizationListResponse(BaseModel):
    organizations: List[OrganizationResponse]
    total: int


class MemberInviteRequest(BaseModel):
    email: EmailStr
    role: OrgRoleEnum = OrgRoleEnum.VIEWER

    @field_validator("role")
    def prevent_owner_invite(cls, v: OrgRoleEnum) -> OrgRoleEnum:
        if v == OrgRoleEnum.OWNER:
            raise ValueError(
                "Cannot invite user as OWNER. Use explicit ownership transfer."
            )
        return v


class MemberUpdateRequest(BaseModel):
    role: OrgRoleEnum


# ---------------------------------------------------------
# Enterprise Extensions: Departments & Branches
# ---------------------------------------------------------


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = None
    code: Optional[str] = Field(
        None, max_length=50, description="Cost Center Code / Centre de coût"
    )
    description: Optional[str] = Field(None, max_length=255)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    code: Optional[str] = None
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: int
    organizationId: int
    name: str
    slug: str
    code: Optional[str] = None
    description: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    model_config = ConfigDict(from_attributes=True)


class BranchCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    wilayaCode: int = Field(..., ge=1, le=69)
    city: City
    address: Optional[str] = Field(None, max_length=255)
    phoneNumber: Optional[str] = Field(None, max_length=30)
    isHeadquarters: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    wilayaCode: Optional[int] = Field(None, ge=1, le=69)
    city: Optional[City] = None
    address: Optional[str] = None
    phoneNumber: Optional[str] = None
    isHeadquarters: Optional[bool] = None


class BranchResponse(BaseModel):
    id: int
    organizationId: int
    name: str
    code: Optional[str] = None
    wilayaCode: int
    city: City
    address: Optional[str] = None
    phoneNumber: Optional[str] = None
    isHeadquarters: bool = False
    createdAt: datetime
    updatedAt: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# EdTech: Corporate Multi-Seat License Pools
# ---------------------------------------------------------


class TeamLicensePoolCreate(BaseModel):
    moduleId: Optional[str] = None
    pathId: Optional[str] = None
    totalSeats: int = Field(..., gt=0, le=5000)
    expiresAt: Optional[datetime] = None


class SeatAllocationResponse(BaseModel):
    id: int
    poolId: int
    userId: int
    assignedAt: datetime
    revokedAt: Optional[datetime] = None
    user: Optional[OrganizationMemberUser] = None
    model_config = ConfigDict(from_attributes=True)


class TeamLicensePoolResponse(BaseModel):
    id: int
    organizationId: int
    moduleId: Optional[str] = None
    pathId: Optional[str] = None
    totalSeats: int
    allocatedSeats: int
    purchasedAt: datetime
    expiresAt: Optional[datetime] = None
    createdAt: datetime
    allocations: List[SeatAllocationResponse] = []
    model_config = ConfigDict(from_attributes=True)


class SeatAllocateRequest(BaseModel):
    email: EmailStr


# ---------------------------------------------------------
# Corporate KYB & Regulatory Verification
# ---------------------------------------------------------


class CorporateDocumentResponse(BaseModel):
    id: int
    kybId: int
    documentType: str
    fileName: str
    mimeType: str
    fileSize: int
    fileSha256: str
    isEncrypted: bool
    qrCodeVerified: bool = False
    qrCodeRawData: Optional[str] = None
    uploadedAt: datetime
    verifiedAt: Optional[datetime] = None
    downloadUrl: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class OrganizationKybCreate(BaseModel):
    legalName: str = Field(..., min_length=2, max_length=150)
    tradeName: Optional[str] = Field(None, max_length=150)
    legalStructure: str = Field(
        ..., description="SARL, EURL, SPA, SNC, AUTO_ENTREPRENEUR"
    )
    shareCapitalDzd: Optional[int] = Field(None, ge=0)
    rcNumber: str = Field(..., min_length=5, max_length=50)
    rcWilayaCode: str = Field(..., min_length=2, max_length=5)
    rcDateImmatriculation: Optional[datetime] = None
    nifNumber: str = Field(..., min_length=15, max_length=20)
    nisNumber: Optional[str] = Field(None, max_length=25)
    articleImposition: Optional[str] = Field(None, max_length=25)
    taxRegime: Optional[str] = Field(None, max_length=50)
    headquartersAddress: str = Field(..., min_length=5, max_length=255)
    city: City = City.ALGIERS


class OrganizationKybUpdate(BaseModel):
    legalName: Optional[str] = None
    tradeName: Optional[str] = None
    legalStructure: Optional[str] = None
    shareCapitalDzd: Optional[int] = None
    rcNumber: Optional[str] = None
    rcWilayaCode: Optional[str] = None
    rcDateImmatriculation: Optional[datetime] = None
    nifNumber: Optional[str] = None
    nisNumber: Optional[str] = None
    articleImposition: Optional[str] = None
    taxRegime: Optional[str] = None
    headquartersAddress: Optional[str] = None
    city: Optional[City] = None


class OrganizationKybResponse(BaseModel):
    id: int
    organizationId: int
    legalName: str
    tradeName: Optional[str] = None
    legalStructure: str
    shareCapitalDzd: Optional[int] = None
    rcNumber: str
    rcWilayaCode: str
    rcDateImmatriculation: Optional[datetime] = None
    nifNumber: str
    nisNumber: Optional[str] = None
    articleImposition: Optional[str] = None
    taxRegime: Optional[str] = None
    headquartersAddress: str
    city: City
    status: str
    riskScore: int = 0
    rejectionReason: Optional[str] = None
    verifiedAt: Optional[datetime] = None
    verifiedBy: Optional[int] = None
    qrVerifiedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    documents: List[CorporateDocumentResponse] = []
    model_config = ConfigDict(from_attributes=True)


class OrganizationKybReviewRequest(BaseModel):
    decision: str = Field(
        ..., description="APPROVED | REJECTED | REQUIRES_CLARIFICATION"
    )
    reason: Optional[str] = None
    requestDualApproval: bool = False
    actionId: Optional[str] = None
    notes: Optional[str] = None


class OrganizationKybReviewResponse(BaseModel):
    success: bool
    requires_approval: bool = False
    message: str
    kyb: Optional[OrganizationKybResponse] = None
    pendingAction: Optional[Dict[str, Any]] = None
    executionResult: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------
# Enterprise Profile Benchmarks (Case Studies, Leadership, 2-Sided Reviews)
# ---------------------------------------------------------


class CompanyCaseStudyCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    slug: Optional[str] = Field(None, max_length=160)
    clientName: Optional[str] = Field(None, max_length=120)
    industry: Optional[str] = Field(None, max_length=80)
    problemStatement: str = Field(..., min_length=10)
    solutionSummary: str = Field(..., min_length=10)
    roiMetrics: Optional[Any] = None
    technologies: List[str] = []
    isFeatured: bool = False


class CompanyCaseStudyResponse(BaseModel):
    id: int
    organizationId: int
    title: str
    slug: str
    clientName: Optional[str] = None
    industry: Optional[str] = None
    problemStatement: str
    solutionSummary: str
    roiMetrics: Optional[Any] = None
    technologies: List[str] = []
    isFeatured: bool = False
    publishedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    model_config = ConfigDict(from_attributes=True)


class CompanyLeadershipCreate(BaseModel):
    fullName: str = Field(..., min_length=2, max_length=120)
    roleTitle: str = Field(..., min_length=2, max_length=120)
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    linkedinUrl: Optional[str] = None
    displayOrder: int = 0
    isExecutive: bool = True


class CompanyLeadershipResponse(BaseModel):
    id: int
    organizationId: int
    fullName: str
    roleTitle: str
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    linkedinUrl: Optional[str] = None
    displayOrder: int = 0
    isExecutive: bool = True
    createdAt: datetime
    updatedAt: datetime
    model_config = ConfigDict(from_attributes=True)


class CompanyReviewCreate(BaseModel):
    contractId: Optional[int] = None
    reviewerType: str = Field(
        default="FREELANCER", pattern="^(FREELANCER|CLIENT|CORPORATE_LEARNER)$"
    )
    overallRating: float = Field(..., ge=1.0, le=5.0)
    paymentPromptnessRating: Optional[float] = Field(None, ge=1.0, le=5.0)
    scopeClarityRating: Optional[float] = Field(None, ge=1.0, le=5.0)
    communicationRating: Optional[float] = Field(None, ge=1.0, le=5.0)
    title: Optional[str] = Field(None, max_length=150)
    comment: Optional[str] = None


class CompanyReviewResponse(BaseModel):
    id: int
    organizationId: int
    reviewerId: int
    contractId: Optional[int] = None
    reviewerType: str
    overallRating: float
    paymentPromptnessRating: Optional[float] = None
    scopeClarityRating: Optional[float] = None
    communicationRating: Optional[float] = None
    title: Optional[str] = None
    comment: Optional[str] = None
    isVerifiedContract: bool = False
    createdAt: datetime
    updatedAt: datetime
    model_config = ConfigDict(from_attributes=True)


class EscrowReleaseRequestCreate(BaseModel):
    contractId: int
    milestoneId: int
    amountDzd: float = Field(..., gt=0)
    notes: Optional[str] = None


class EscrowApproveRequest(BaseModel):
    approvalNotes: Optional[str] = None
    authMethod: Optional[str] = None
    webauthnVerified: bool = False
    stepUpToken: Optional[str] = None
    assertionResponse: Optional[dict] = None


class SsoDomainConfigUpdate(BaseModel):
    verifiedDomains: Optional[List[str]] = None
    samlEntityId: Optional[str] = None
    samlMetadataUrl: Optional[str] = None
    scimEnabled: Optional[bool] = None


class SsoDomainConfigResponse(BaseModel):
    organizationId: int
    verifiedDomains: List[str] = []
    samlEntityId: Optional[str] = None
    samlMetadataUrl: Optional[str] = None
    scimEnabled: bool = False


class PublicOrganizationSummaryResponse(BaseModel):
    id: int
    name: str
    slug: str
    city: City
    country: Country
    sector: OrganizationSector
    website: Optional[str] = None
    tagline: Optional[str] = None
    companySizeBracket: Optional[str] = "MICRO_1_10"
    operationalScale: Optional[str] = "NATIONAL_58_WILAYAS"
    primaryLanguages: List[str] = []
    brandAccentColor: Optional[str] = "#1B4D3E"
    coverBannerUrl: Optional[str] = None
    isKybVerified: bool = False
    kybStatus: Optional[str] = None
    averageRating: float = 0.0
    reviewCount: int = 0
    caseStudyCount: int = 0
    createdAt: datetime
    model_config = ConfigDict(from_attributes=True)


class PublicOrganizationProfileResponse(OrganizationBase):
    id: int
    slug: str
    createdAt: datetime
    updatedAt: datetime
    memberCount: int = 0
    isKybVerified: bool = False
    kybStatus: Optional[str] = None
    kybRiskScore: Optional[float] = None
    orgProfile: Optional[OrgProfileSchema] = None
    caseStudies: List[CompanyCaseStudyResponse] = []
    leadership: List[CompanyLeadershipResponse] = []
    companyReviews: List[CompanyReviewResponse] = []
    averageRating: float = 0.0
    reviewCount: int = 0
    model_config = ConfigDict(from_attributes=True)


class ProformaItemRequest(BaseModel):
    description: str = Field(..., min_length=2, max_length=250)
    quantity: int = Field(1, ge=1)
    unitPriceDzd: float = Field(..., ge=0.0)


class ProformaGenerateRequest(BaseModel):
    items: List[ProformaItemRequest] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=500)
    article169Eligible: bool = True
