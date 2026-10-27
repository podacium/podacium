from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, List, Dict, Any


class ProfileUpdate(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    fullName: Optional[str] = Field(
        None, validation_alias=AliasChoices("fullName", "full_name"), max_length=100
    )
    bio: Optional[str] = Field(None, max_length=2000)
    headline: Optional[str] = Field(None, max_length=200)
    tagline: Optional[str] = Field(None, max_length=500)
    pronouns: Optional[str] = Field(None, max_length=50)
    displayName: Optional[Dict[str, str]] = Field(
        None, validation_alias=AliasChoices("displayName", "display_name")
    )
    coverImageUrl: Optional[str] = Field(
        None,
        validation_alias=AliasChoices("coverImageUrl", "cover_image_url"),
        max_length=500,
    )
    profilePictureUrl: Optional[str] = Field(
        None,
        validation_alias=AliasChoices(
            "profilePictureUrl", "profile_picture_url", "avatar_url"
        ),
        max_length=500,
    )
    socialLinks: Optional[Dict[str, Any]] = Field(
        None, validation_alias=AliasChoices("socialLinks", "social_links")
    )
    skills: Optional[List[str]] = Field(None)
    country: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    phoneNumber: Optional[str] = Field(
        None,
        validation_alias=AliasChoices("phoneNumber", "phone_number", "phone"),
        max_length=50,
    )
    availability: Optional[str] = Field(
        None, pattern=r"^(AVAILABLE|BUSY|LOOKING|NOT_AVAILABLE)$"
    )


class StudentProfileUpdate(BaseModel):
    headline: Optional[str] = Field(None, max_length=200)
    learningGoals: Optional[str] = Field(None, max_length=2000)
    careerPath: Optional[str] = Field(None, max_length=200)
    badges: Optional[List[Dict[str, Any]]] = None
    wishlist: Optional[List[int]] = None


class InstructorProfileUpdate(BaseModel):
    headline: Optional[str] = Field(None, max_length=200)
    languages: Optional[List[str]] = None
    credentials: Optional[List[Dict[str, Any]]] = None
    workExperience: Optional[List[Dict[str, Any]]] = None
    publications: Optional[List[Dict[str, Any]]] = None
    teachingCategories: Optional[List[str]] = None
    featuredCourseId: Optional[int] = None
    curriculumVitae: Optional[str] = Field(None, max_length=500)
    researchInterests: Optional[List[str]] = None


class CredentialCreate(BaseModel):
    type: str = Field(..., max_length=100)
    title: str = Field(..., max_length=200)
    institution: Optional[str] = Field(None, max_length=200)
    year: Optional[int] = None
    description: Optional[str] = Field(None, max_length=2000)


class BusinessProfileUpdate(BaseModel):
    headline: Optional[str] = Field(None, max_length=200)
    companyRole: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    companySize: Optional[str] = Field(None, max_length=50)
    yearsOfExperience: Optional[int] = Field(None, ge=0, le=100)
    areasOfExpertise: Optional[List[str]] = None
    linkedIn: Optional[str] = Field(None, max_length=500)
    portfolio: Optional[str] = Field(None, max_length=500)


class FreelancerProfileUpdate(BaseModel):
    tier: Optional[str] = None
    isVerified: Optional[bool] = None
    featured: Optional[bool] = None
    isPremium: Optional[bool] = None
    skillPassportVerified: Optional[bool] = None
    headline: Optional[str] = Field(None, max_length=200)
    overview: Optional[str] = Field(None, max_length=5000)
    englishLevel: Optional[str] = Field(
        None, pattern=r"^(basic|conversational|fluent|native)$"
    )
    languages: Optional[List[str]] = None
    hourlyRate: Optional[float] = Field(None, ge=0)
    availability: Optional[str] = Field(
        None, pattern=r"^(AVAILABLE|BUSY|NOT_AVAILABLE)$"
    )
    availableHoursPerWeek: Optional[int] = Field(None, ge=1, le=168)
    timezone: Optional[str] = None
    categories: Optional[List[str]] = None
    videoIntro: Optional[str] = Field(None, max_length=500)
    employmentHistory: Optional[List[Dict[str, Any]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    testScores: Optional[List[Dict[str, Any]]] = None


class ServiceCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=5000)
    category: str = Field(..., max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    pricingType: str = Field(..., pattern=r"^(hourly|fixed|package)$")
    price: Optional[float] = Field(None, ge=0)
    basicPrice: Optional[float] = Field(None, ge=0)
    basicDescription: Optional[str] = Field(None, max_length=1000)
    standardPrice: Optional[float] = Field(None, ge=0)
    standardDescription: Optional[str] = Field(None, max_length=1000)
    premiumPrice: Optional[float] = Field(None, ge=0)
    premiumDescription: Optional[str] = Field(None, max_length=1000)
    deliveryDays: Optional[int] = Field(None, ge=1, le=365)
    revisions: int = Field(default=0, ge=0, le=100)
    images: List[str] = Field(default_factory=list)
    video: Optional[str] = Field(None, max_length=500)
    isActive: bool = True
    tags: List[str] = Field(default_factory=list)
    faq: Optional[List[Dict[str, str]]] = None
    requirements: Optional[str] = Field(None, max_length=5000)


class ServiceUpdate(ServiceCreate):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    category: Optional[str] = Field(None, max_length=100)
    pricingType: Optional[str] = Field(None, pattern=r"^(hourly|fixed|package)$")


class PublicDashboardCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    thumbnailUrl: Optional[str] = Field(None, max_length=500)
    tags: List[str] = Field(default_factory=list)
    isPublic: bool = False
    embedUrl: Optional[str] = Field(None, max_length=500)
    organizationId: Optional[int] = None


class OrgProfileUpdate(BaseModel):
    specialties: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    competitors: Optional[List[str]] = None
    fundingRound: Optional[str] = None
    fundingAmount: Optional[float] = None
    revenueRange: Optional[str] = None
    products: Optional[List[Dict[str, Any]]] = None
    jobs: Optional[List[Dict[str, Any]]] = None
    culture: Optional[str] = Field(None, max_length=5000)
    benefits: Optional[str] = Field(None, max_length=5000)
    mission: Optional[str] = Field(None, max_length=2000)
    achievements: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
    mapLocation: Optional[Dict[str, float]] = None


class OrgReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=5000)
