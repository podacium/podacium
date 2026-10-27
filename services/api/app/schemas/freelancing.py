from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ======================
# ENUMS
# ======================


class ProjectStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ProposalStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class ContractStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


class DisputeStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class DisputeReason(str, Enum):
    NON_DELIVERY = "NON_DELIVERY"
    POOR_QUALITY = "POOR_QUALITY"
    INCOMPLETE_REQUIREMENTS = "INCOMPLETE_REQUIREMENTS"
    OTHER = "OTHER"


class ReviewStatus(str, Enum):
    ACTIVE = "ACTIVE"
    REDACTED = "REDACTED"
    PENDING_APPEAL = "PENDING_APPEAL"


class AppealStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    INFO_REQUESTED = "INFO_REQUESTED"


class ReviewType(str, Enum):
    CLIENT_TO_FREELANCER = "CLIENT_TO_FREELANCER"
    FREELANCER_TO_CLIENT = "FREELANCER_TO_CLIENT"


# ======================
# SEARCH SCHEMAS
# ======================


class ProjectSearch(BaseModel):
    skip: int = 0
    limit: int = 20
    skills: Optional[List[str]] = None
    search: Optional[str] = None
    status: Optional[ProjectStatus] = None


class FreelancerSearch(BaseModel):
    skills: Optional[List[str]] = None
    search: Optional[str] = None
    has_certificates: Optional[bool] = None
    phone_verified: Optional[bool] = None
    min_budget: Optional[int] = Field(None, ge=0, description="Minimum budget in DZD")
    max_budget: Optional[int] = Field(None, ge=0, description="Maximum budget in DZD")
    category: Optional[str] = Field(
        None,
        description="Category filter (web, mobile, design, data, devops, marketing, writing)",
    )
    rating_min: Optional[float] = Field(
        None, ge=0, le=5, description="Minimum average rating"
    )
    skip: int = 0
    limit: int = 20


class PublicProjectSearch(BaseModel):
    skip: int = 0
    limit: int = 20
    skills: Optional[List[str]] = None
    search: Optional[str] = None


class PublicFreelancerSearch(BaseModel):
    skills: Optional[List[str]] = None
    search: Optional[str] = None
    has_certificates: Optional[bool] = None
    min_budget: Optional[int] = Field(None, ge=0, description="Minimum budget in DZD")
    max_budget: Optional[int] = Field(None, ge=0, description="Maximum budget in DZD")
    category: Optional[str] = Field(
        None,
        description="Category filter (web, mobile, design, data, devops, marketing, writing)",
    )
    rating_min: Optional[float] = Field(
        None, ge=0, le=5, description="Minimum average rating"
    )
    skip: int = 0
    limit: int = 20


# Update the ProjectResponse to include only public fields
class PublicProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    skills: List[str] = []
    status: str
    createdAt: datetime

    # Limited owner info for public view
    owner: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PublicFreelancerResponse(BaseModel):
    id: int
    fullName: str
    bio: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    skills: List[str] = []
    city: Optional[str] = None
    country: Optional[str] = None

    # Trust indicators for public view
    certificates_count: int = 0
    completed_projects: int = 0
    phone_verified: bool = False

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# PROJECT SCHEMAS
# ======================


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    skills: List[str] = Field(default_factory=list)
    organizationId: Optional[int] = Field(
        None, description="Optional Organization ID for corporate projects"
    )

    # Algerian context: Store budget in description
    budget_range_min: Optional[int] = Field(
        None, ge=0, description="Minimum budget in Algerian Dinar cents"
    )
    budget_range_max: Optional[int] = Field(
        None, ge=0, description="Maximum budget in Algerian Dinar cents"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Développement d'un site web e-commerce",
                "description": "Création d'un site e-commerce avec React et Node.js pour une boutique algérienne",
                "skills": ["react", "node.js", "postgresql", "e-commerce"],
                "budget_range_min": 50000,  # 500 DA in cents
                "budget_range_max": 200000,  # 2000 DA in cents
            }
        }
    )


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    skills: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None
    organizationId: Optional[int] = None


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    ownerId: Optional[int] = Field(None, alias="ownerId")
    organizationId: Optional[int] = None
    skills: List[str] = []
    status: str
    createdAt: datetime
    updatedAt: Optional[datetime] = None

    # Owner info (included via query)
    owner: Optional[Dict[str, Any]] = None

    # User-specific info (calculated)
    has_applied: bool = False
    is_owner: bool = False

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# PROPOSAL SCHEMAS
# ======================


class ProposalCreate(BaseModel):
    message: str = Field(..., min_length=10, max_length=2000)
    amount: int = Field(..., ge=1000, description="Bid amount in DZD (min 1000 DA)")
    estimated_days: Optional[int] = Field(
        None, ge=1, le=365, description="Estimated days to complete"
    )
    certificateId: Optional[str] = Field(
        None, description="Optional certificate/passport ID to link"
    )


class ProposalResponse(BaseModel):
    id: int
    projectId: int
    freelancerId: Optional[int] = None
    message: Optional[str] = None
    amount: Optional[int] = None
    status: str
    createdAt: datetime

    # Freelancer info (included via query)
    freelancer: Optional[Dict[str, Any]] = None

    # Project info (included via query)
    project: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# CONTRACT SCHEMAS
# ======================


class ContractCreate(BaseModel):
    terms: Optional[str] = Field(None, max_length=5000)
    amount: Optional[int] = Field(
        None, ge=1000, description="Contract amount in DZD (min 1000 DA)"
    )
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ContractResponse(BaseModel):
    id: int
    projectId: int
    freelancerId: Optional[int] = None
    clientId: Optional[int] = None
    terms: Optional[str] = None
    amount: Optional[int] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    status: str
    createdAt: datetime

    # Relations (included via query)
    project: Optional[Dict[str, Any]] = None
    freelancer: Optional[Dict[str, Any]] = None
    client: Optional[Dict[str, Any]] = None
    deliveries: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# DELIVERY SCHEMAS
# ======================


class DeliveryCreate(BaseModel):
    description: str = Field(..., min_length=10, max_length=2000)
    file_urls: Optional[List[str]] = Field(default_factory=list)


class DeliveryResponse(BaseModel):
    id: int
    contractId: int
    description: Optional[str] = None
    deliveredAt: datetime
    files: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# DISPUTE SCHEMAS
# ======================


class DisputeCreate(BaseModel):
    reason: DisputeReason
    description: str = Field(..., min_length=10, max_length=5000)


class DisputeResponse(BaseModel):
    id: int
    contractId: int
    creatorId: int
    opponentId: int
    reason: DisputeReason
    description: str
    status: DisputeStatus
    metadata: Optional[Dict[str, Any]] = None
    resolutionNotes: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# RATING & REVIEWS SCHEMAS
# ======================


class SubRatingsClientRequirements(BaseModel):
    requirements_clarity: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    fairness: int = Field(..., ge=1, le=5)
    payment_promptness: int = Field(..., ge=1, le=5)


class SubRatingsFreelancerQuality(BaseModel):
    work_quality: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    timeliness: int = Field(..., ge=1, le=5)
    professionalism: int = Field(..., ge=1, le=5)


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    subRatings: Dict[str, int]
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    subRatings: Optional[Dict[str, int]] = None
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewResponse(BaseModel):
    id: int
    contractId: int
    authorId: int
    targetId: int
    reviewType: ReviewType
    rating: int
    subRatings: Dict[str, int]
    comment: Optional[str] = None
    isPublic: bool
    status: ReviewStatus
    editCount: int
    lastEditedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    author: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AppealCreate(BaseModel):
    reason: str = Field(..., min_length=10, max_length=2000)
    evidenceUrls: Optional[List[str]] = None


class AppealResponse(BaseModel):
    id: int
    reviewId: int
    appealerId: int
    reason: str
    evidenceUrls: Optional[List[str]] = None
    status: AppealStatus
    resolutionNotes: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    resolvedById: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ReviewReportCreate(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)


class ReviewReportResponse(BaseModel):
    id: int
    reviewId: int
    reporterId: int
    reason: str
    status: str
    adminNotes: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RatingSummaryResponse(BaseModel):
    totalReviews: int
    averageRating: float
    ratingDistribution: Dict[int, int]
    responseRate: float


class ContractReviewStatusResponse(BaseModel):
    clientReviewStatus: Optional[ReviewStatus] = None
    freelancerReviewStatus: Optional[ReviewStatus] = None
    isBlind: bool
    canEdit: bool = False


# ======================
# USER PROFILE SCHEMAS
# ======================


class UserProfileUpdate(BaseModel):
    bio: Optional[str] = Field(None, max_length=1000)
    skills: Optional[List[str]] = None
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)

    # Algerian specific
    hourly_rate: Optional[int] = Field(
        None, ge=0, description="Hourly rate in Algerian Dinar cents"
    )
    availability: Optional[str] = Field(
        None, pattern="^(FULL_TIME|PART_TIME|CONTRACT)$"
    )


class FreelancerProfileResponse(BaseModel):
    id: int
    fullName: str
    bio: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    skills: List[str] = []
    city: Optional[str] = None
    country: Optional[str] = None
    phoneVerified: bool = False
    role: str

    # Trust indicators (Algerian context)
    certificates_count: int = 0
    completed_projects: int = 0
    avg_rating: Optional[float] = None

    # Stats
    total_earnings: int = 0  # In DZD

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ======================
# SKILL MATCHING SCHEMAS
# ======================


class MatchBreakdown(BaseModel):
    skill_overlap: float = 0.0
    category_match: float = 0.0
    budget_compatibility: Optional[float] = None
    already_applied: Optional[bool] = None
    recency: Optional[float] = None
    rating: Optional[float] = None
    experience: Optional[float] = None
    portfolio: Optional[float] = None


class RecommendedProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    skills: List[str] = []
    budget: Optional[int] = None
    currency: str = "DZD"
    status: str
    createdAt: Optional[str] = None
    owner: Optional[Dict[str, Any]] = None
    match_score: float = 0.0
    match_breakdown: MatchBreakdown

    model_config = ConfigDict(from_attributes=True)


class SuggestedFreelancerResponse(BaseModel):
    id: int
    fullName: str
    bio: Optional[str] = None
    profilePictureUrl: Optional[str] = None
    skills: List[str] = []
    city: Optional[str] = None
    country: Optional[str] = None
    phoneVerified: bool = False
    certificates_count: int = 0
    completed_projects: int = 0
    avg_rating: Optional[float] = None
    match_score: float = 0.0
    match_breakdown: MatchBreakdown

    model_config = ConfigDict(from_attributes=True)
