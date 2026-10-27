# services/api/app/schemas/admin.py
"""Pydantic schemas for admin panel API endpoints."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================


class AdminBulkAction(str, Enum):
    PUBLISH = "publish"
    UNPUBLISH = "unpublish"
    DELETE = "delete"


# =============================================================================
# DASHBOARD
# =============================================================================


class AdminDashboardStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    total_organizations: int = 0
    total_paths: int = 0
    total_modules: int = 0
    published_modules: int = 0
    total_lessons: int = 0
    total_quizzes: int = 0
    total_enrollments: int = 0
    total_revenue_cents: int = 0
    new_users_this_month: int = 0
    new_enrollments_this_month: int = 0


# =============================================================================
# USER MANAGEMENT
# =============================================================================


class AdminUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: Optional[str] = None
    full_name: str = Field(alias="fullName")
    role: str
    is_active: bool = Field(alias="isActive")
    is_deactivated: bool = Field(alias="isDeactivated")
    phone_verified: bool = Field(alias="phoneVerified")
    email_verified: bool = Field(alias="emailVerified")
    profile_picture_url: Optional[str] = Field(None, alias="profilePictureUrl")
    country: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    last_login_at: Optional[datetime] = Field(None, alias="lastLoginAt")
    login_count: int = Field(0, alias="loginCount")


class AdminUserDetail(AdminUserSummary):
    bio: Optional[str] = None
    phone_number: Optional[str] = Field(None, alias="phoneNumber")
    skills: List[str] = Field(default_factory=list)
    provider: Optional[str] = None
    updated_at: datetime = Field(alias="updatedAt")
    deactivated_at: Optional[datetime] = Field(None, alias="deactivatedAt")
    enrollment_count: int = 0
    certificate_count: int = 0


class AdminUserUpdate(BaseModel):
    # SECURITY: role is restricted to the known role allowlist so a
    # caller can never inject an arbitrary role string (e.g. an unknown high-
    # privilege role or a typo that maps to an internal superuser flag).
    role: Optional[Literal["ADMIN", "MODERATOR", "INSTRUCTOR", "STUDENT"]] = None
    is_deactivated: Optional[bool] = None
    is_active: Optional[bool] = None


class AdminUserListResponse(BaseModel):
    users: List[AdminUserSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# ORGANIZATION MANAGEMENT
# =============================================================================


class AdminOrgSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    sector: Optional[str] = None
    website: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    owner_id: Optional[int] = Field(None, alias="ownerId")
    owner_name: Optional[str] = None
    member_count: int = 0


class AdminOrgListResponse(BaseModel):
    organizations: List[AdminOrgSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# PATH MANAGEMENT
# =============================================================================


class AdminPathCreate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    featured: bool = False
    price: Optional[Dict[str, Any]] = None


class AdminPathUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    featured: Optional[bool] = None
    price: Optional[Dict[str, Any]] = None


class AdminPathSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    featured: bool = False
    created_at: datetime = Field(alias="createdAt")
    module_count: int = 0
    enrollment_count: int = 0
    price: Optional[Dict[str, Any]] = None


class AdminPathDetail(AdminPathSummary):
    updated_at: datetime = Field(alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")


class AdminPathListResponse(BaseModel):
    paths: List[AdminPathSummary]
    total: int


class AdminPathModuleAdd(BaseModel):
    module_id: str
    order: Optional[int] = None


class AdminPathModuleReorder(BaseModel):
    modules: List[Dict[str, Any]]  # [{"moduleId": "...", "order": 1}, ...]


# =============================================================================
# MODULE / COURSE MANAGEMENT
# =============================================================================


class AdminModuleCreate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    full_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    estimated_effort: Optional[str] = None
    total_lessons: Optional[int] = 0
    level: Optional[str] = None
    instructor_id: Optional[int] = None
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    price: Optional[Dict[str, Any]] = None
    featured: bool = False


class AdminModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    full_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    estimated_effort: Optional[str] = None
    total_lessons: Optional[int] = None
    level: Optional[str] = None
    instructor_id: Optional[int] = None
    skills: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    price: Optional[Dict[str, Any]] = None
    featured: Optional[bool] = None


class AdminModuleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    featured: bool = False
    total_lessons: Optional[int] = Field(0, alias="totalLessons")
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    instructor_id: Optional[int] = Field(None, alias="instructorId")
    instructor_name: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    enrollment_count: int = 0
    price: Optional[Dict[str, Any]] = None


class AdminModuleDetail(AdminModuleSummary):
    full_description: Optional[str] = Field(None, alias="fullDescription")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    estimated_effort: Optional[str] = Field(None, alias="estimatedEffort")
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    updated_at: datetime = Field(alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    last_updated: Optional[datetime] = Field(None, alias="lastUpdated")


class AdminModuleListResponse(BaseModel):
    modules: List[AdminModuleSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminBulkActionRequest(BaseModel):
    ids: List[str]
    action: AdminBulkAction


class AdminBulkActionResponse(BaseModel):
    success: int = 0
    failed: int = 0
    errors: List[str] = Field(default_factory=list)


# =============================================================================
# LESSON MANAGEMENT
# =============================================================================


class AdminLessonCreate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    module_id: str
    order: int
    duration_minutes: Optional[int] = None
    type: str = "text"
    video_url: Optional[str] = None
    storage_provider: str = "supabase"
    transcript: Optional[str] = None
    subtitles_path: Optional[str] = None
    subtitles_language: str = "ar"
    subtitles_enabled: bool = True
    thumbnail_url: Optional[str] = None
    learning_objectives: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)
    instructor_notes: Optional[str] = None
    estimated_completion_time: Optional[int] = None
    difficulty: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    related_resources: Optional[List[Dict[str, Any]]] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class AdminLessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    duration_minutes: Optional[int] = None
    type: Optional[str] = None
    video_url: Optional[str] = None
    storage_provider: Optional[str] = None
    transcript: Optional[str] = None
    subtitles_path: Optional[str] = None
    subtitles_language: Optional[str] = None
    subtitles_enabled: Optional[bool] = None
    thumbnail_url: Optional[str] = None
    learning_objectives: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    instructor_notes: Optional[str] = None
    estimated_completion_time: Optional[int] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None
    related_resources: Optional[List[Dict[str, Any]]] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class AdminLessonSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: Optional[str] = None
    module_id: str = Field(alias="moduleId")
    order: int
    type: str = "text"
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    difficulty: Optional[str] = None
    has_quiz: bool = False
    has_video: bool = False
    created_at: datetime = Field(alias="createdAt")


class AdminLessonDetail(AdminLessonSummary):
    video_url: Optional[str] = Field(None, alias="videoUrl")
    transcript: Optional[str] = None
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    learning_objectives: List[str] = Field(
        default_factory=list, alias="learningObjectives"
    )
    key_takeaways: List[str] = Field(default_factory=list, alias="keyTakeaways")
    instructor_notes: Optional[str] = Field(None, alias="instructorNotes")
    estimated_completion_time: Optional[int] = Field(
        None, alias="estimatedCompletionTime"
    )
    tags: List[str] = Field(default_factory=list)
    related_resources: Optional[List[Dict[str, Any]]] = Field(
        None, alias="relatedResources"
    )
    attachments: Optional[List[Dict[str, Any]]] = None
    updated_at: datetime = Field(alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")


class AdminLessonReorderRequest(BaseModel):
    lessons: List[Dict[str, Any]]  # [{"lessonId": "...", "order": 1}, ...]


# =============================================================================
# QUIZ MANAGEMENT
# =============================================================================


class AdminQuizQuestionCreate(BaseModel):
    question: str
    question_type: str = "MULTIPLE_CHOICE"
    options: Optional[List[Dict[str, Any]]] = None  # [{"id": "a", "text": "..."}, ...]
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    points: int = 10
    order: int = 0


class AdminQuizQuestionUpdate(BaseModel):
    question: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    points: Optional[int] = None
    order: Optional[int] = None


class AdminQuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    passing_score: int = 90
    time_limit_minutes: int = 30
    retake_cooldown_minutes: int = 60
    allow_retake: bool = True
    shuffle_questions: bool = True
    questions: List[AdminQuizQuestionCreate] = Field(default_factory=list)


class AdminQuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    passing_score: Optional[int] = None
    time_limit_minutes: Optional[int] = None
    retake_cooldown_minutes: Optional[int] = None
    allow_retake: Optional[bool] = None
    shuffle_questions: Optional[bool] = None


class AdminQuizQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    quiz_id: int = Field(alias="quizId")
    question: str
    question_type: str = Field(alias="questionType")
    options: Optional[List[Dict[str, Any]]] = None
    correct_answer: Optional[str] = Field(None, alias="correctAnswer")
    explanation: Optional[str] = None
    points: int = 10
    order: int = 0
    created_at: datetime = Field(alias="createdAt")


class AdminQuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lesson_id: Optional[str] = Field(None, alias="lessonId")
    title: str
    description: Optional[str] = None
    passing_score: int = Field(alias="passingScore")
    time_limit_minutes: int = Field(alias="timeLimitMinutes")
    retake_cooldown_minutes: int = Field(60, alias="retakeCooldownMinutes")
    allow_retake: bool = Field(alias="allowRetake")
    shuffle_questions: bool = Field(True, alias="shuffleQuestions")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    questions: List[AdminQuizQuestionResponse] = Field(default_factory=list)
    attempt_count: int = 0


# =============================================================================
# FREELANCING APPEALS MANAGEMENT
# =============================================================================


class AdminAppealResolve(BaseModel):
    status: str  # "APPROVED", "REJECTED", "INFO_REQUESTED"
    resolution_notes: Optional[str] = None


# =============================================================================
# FEATURE FLAGS
# =============================================================================


class FeatureFlagCreate(BaseModel):
    key: str
    enabled: bool = False
    rollout_percentage: int = Field(0, ge=0, le=100)
    target_user_ids: List[int] = Field(default_factory=list)
    target_org_ids: List[int] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FeatureFlagUpdate(BaseModel):
    enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = Field(None, ge=0, le=100)
    target_user_ids: Optional[List[int]] = None
    target_org_ids: Optional[List[int]] = None
    metadata: Optional[Dict[str, Any]] = None


class FeatureFlagResponse(BaseModel):
    key: str
    enabled: bool
    rollout_percentage: int
    target_user_ids: List[int]
    target_org_ids: List[int]
    metadata: Dict[str, Any]


# =============================================================================
# GOVERNANCE & DUAL APPROVAL
# =============================================================================


class CreatePendingActionRequest(BaseModel):
    action_type: str = Field(..., alias="actionType")
    target_resource: str = Field(..., alias="targetResource")
    target_id: Optional[str] = Field(None, alias="targetId")
    payload: Dict[str, Any]
    expires_in_hours: int = Field(24, alias="expiresInHours")

    model_config = ConfigDict(populate_by_name=True)


class ApprovalDecisionRequest(BaseModel):
    notes: Optional[str] = None
    rejection_reason: Optional[str] = Field(None, alias="rejectionReason")

    model_config = ConfigDict(populate_by_name=True)


class PendingActionResponse(BaseModel):
    id: str
    action_type: str = Field(alias="actionType")
    target_resource: str = Field(alias="targetResource")
    target_id: Optional[str] = Field(None, alias="targetId")
    payload: Optional[Dict[str, Any]] = None
    status: str
    initiator_id: int = Field(alias="initiatorId")
    initiator_name: str = Field(alias="initiatorName")
    initiator_email: str = Field(alias="initiatorEmail")
    approver_id: Optional[int] = Field(None, alias="approverId")
    approver_name: Optional[str] = Field(None, alias="approverName")
    approval_notes: Optional[str] = Field(None, alias="approvalNotes")
    rejection_reason: Optional[str] = Field(None, alias="rejectionReason")
    expires_at: str = Field(alias="expiresAt")
    executed_at: Optional[str] = Field(None, alias="executedAt")
    created_at: str = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)
