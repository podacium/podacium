"""Pydantic schemas for Live Sessions."""

from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, field_validator


VALID_VISIBILITIES = {"PUBLIC", "UNLISTED", "PRIVATE"}
VALID_STATUSES = {"SCHEDULED", "LIVE", "ENDED", "CANCELLED"}


class LiveSessionType(str, Enum):
    COURSE = "COURSE"
    MEETING = "MEETING"


# ─── Request Schemas ────────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    sessionType: LiveSessionType = LiveSessionType.COURSE
    contractId: Optional[int] = None
    orgOnly: bool = False
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    category: Optional[str] = None
    tags: list[str] = []
    visibility: str = "PUBLIC"
    scheduledAt: datetime
    maxParticipants: Optional[int] = Field(None, ge=1)
    priceAmount: Optional[int] = Field(None, ge=0)
    currency: str = "DZD"
    moduleId: Optional[str] = None
    lessonId: Optional[str] = None
    earlyBirdPrice: Optional[int] = Field(None, ge=0)
    earlyBirdDeadline: Optional[str] = None
    chatMode: Optional[str] = None
    moderationThreshold: Optional[int] = Field(None, ge=0)
    organizationId: Optional[int] = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        if v not in VALID_VISIBILITIES:
            raise ValueError(
                f"Invalid visibility: {v}. Must be one of {VALID_VISIBILITIES}"
            )
        return v


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    visibility: Optional[str] = None
    scheduledAt: Optional[datetime] = None
    maxParticipants: Optional[int] = Field(None, ge=1)
    priceAmount: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = None
    earlyBirdPrice: Optional[int] = Field(None, ge=0)
    earlyBirdDeadline: Optional[str] = None
    chatMode: Optional[str] = None
    moderationThreshold: Optional[int] = Field(None, ge=0)
    organizationId: Optional[int] = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_VISIBILITIES:
            raise ValueError(
                f"Invalid visibility: {v}. Must be one of {VALID_VISIBILITIES}"
            )
        return v


class BookSessionRequest(BaseModel):
    transactionId: Optional[int] = None
    hostCode: Optional[str] = None


# ─── Response Schemas ───────────────────────────────────────────────


class LiveSessionOwnerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LiveSessionResponse(BaseModel):
    id: str
    type: LiveSessionType = LiveSessionType.COURSE
    title: str
    description: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    category: Optional[str] = None
    tags: list[str] = []
    status: str
    visibility: str
    ownerId: int
    owner: Optional[LiveSessionOwnerResponse] = None
    scheduledAt: Optional[str] = None
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    durationMinutes: Optional[int] = None
    maxParticipants: Optional[int] = None
    priceAmount: Optional[int] = None
    currency: str = "DZD"
    earlyBirdPrice: Optional[int] = None
    earlyBirdDeadline: Optional[str] = None
    chatMode: Optional[str] = None
    moderationThreshold: Optional[int] = None
    organizationId: Optional[int] = None
    roomName: Optional[str] = None
    hasRecording: bool = False
    approvedAt: Optional[str] = None
    rejectedAt: Optional[str] = None
    rejectionReason: Optional[str] = None
    moduleId: Optional[str] = None
    lessonId: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    participantCount: int = 0
    bookingCount: int = 0

    model_config = ConfigDict(from_attributes=True)


class LiveSessionListResponse(BaseModel):
    items: list[LiveSessionResponse]
    total: int
    skip: int = 0
    limit: int = 20


class LiveSessionBookingResponse(BaseModel):
    id: int
    liveSessionId: str
    userId: int
    transactionId: Optional[int] = None
    status: str
    attended: Optional[bool] = None
    createdAt: str
    session: Optional[LiveSessionResponse] = None

    model_config = ConfigDict(from_attributes=True)


class LiveSessionBookingListResponse(BaseModel):
    items: list[LiveSessionBookingResponse]
    total: int
    skip: int = 0
    limit: int = 20


class BookingResultResponse(BaseModel):
    id: int
    liveSessionId: str
    userId: int
    status: str
    createdAt: str


class ParticipantResponse(BaseModel):
    id: int
    userId: int
    role: str
    joinedAt: Optional[str] = None
    leftAt: Optional[str] = None
    attendancePct: Optional[float] = None


class WaitlistResponse(BaseModel):
    id: int
    liveSessionId: str
    userId: int
    position: int = 0
    createdAt: str


class CoHostResponse(BaseModel):
    id: int
    userId: int
    permissions: str


class JoinTokenResponse(BaseModel):
    token: str
    roomName: str
    serverUrl: str


class TrendingSessionResponse(BaseModel):
    items: list[LiveSessionResponse]


class AdminStatsResponse(BaseModel):
    total: int
    live: int
    scheduled: int
    ended: int
    cancelled: int
    totalBookings: int
    totalParticipants: int
    upcoming24h: int


class ErrorResponse(BaseModel):
    message: str
    code: str


# ─── Approval Schemas ────────────────────────────────────────────────


class ApproveSessionRequest(BaseModel):
    pass


class RejectSessionRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)


# ─── Chat Message Schemas ────────────────────────────────────────────


class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    messageType: str = "chat"


class ChatMessageResponse(BaseModel):
    id: int
    liveSessionId: str
    userId: int
    message: str
    messageType: str
    createdAt: str
    user: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageResponse]
    total: int


# ─── Review Schemas ──────────────────────────────────────────────────


class LiveSessionReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class LiveSessionReviewResponse(BaseModel):
    id: int
    liveSessionId: str
    userId: int
    rating: int
    comment: Optional[str] = None
    createdAt: str
    updatedAt: str
    user: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class LiveSessionReviewListResponse(BaseModel):
    items: list[LiveSessionReviewResponse]
    total: int
    averageRating: float = 0.0
