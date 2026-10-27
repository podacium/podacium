# services/api/app/schemas/education.py
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from app.schemas.users import UserProfileResponse
from typing import Optional, List, Dict, Any, Union
from app.generated.prisma import Json
from datetime import datetime
from enum import Enum
import json


class LessonType(str, Enum):
    VIDEO = "video"
    INTERACTIVE = "interactive"
    CASE_STUDY = "case-study"
    PROJECT = "project"
    TEXT = "text"
    QUIZ = "quiz"


class DifficultyLevel(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"
    EXPERT = "Expert"


class ModuleLevel(str, Enum):
    FOUNDATION = "Foundation"
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"
    EXPERT = "Expert"


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    BUSINESS = "BUSINESS"
    FREELANCER = "FREELANCER"
    ADMIN = "ADMIN"
    INSTRUCTOR = "INSTRUCTOR"
    MODERATOR = "MODERATOR"


# Helper functions for JSON field handling
def parse_json_field(value: Any, default: Any = None) -> Any:
    """Parse JSON field from database"""
    if value is None:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value) if value else default
    except:
        return default


def serialize_json_field(value: Any) -> Optional[Json]:
    """Serialize field to Json wrapper for database"""
    if value is None:
        return None
    return Json(value)


# Base Response Schemas
class InstructorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str = Field(alias="fullName")
    profile_picture_url: Optional[str] = Field(None, alias="profilePictureUrl")
    bio: Optional[str] = None
    role: UserRole = UserRole.INSTRUCTOR


class LessonAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    url: str
    type: str
    size: Optional[str] = None


class LessonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Required fields from database
    id: str
    title: str
    description: Optional[str] = None
    module_id: str = Field(alias="moduleId")
    order: int
    type: str = "text"

    # Optional fields from database
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    duration_seconds: Optional[int] = Field(None, alias="durationSeconds")
    video_url: Optional[str] = Field(None, alias="videoUrl")
    hls_path: Optional[str] = Field(None, alias="hlsPath")
    storage_provider: Optional[str] = Field("supabase", alias="storageProvider")
    raw_path: Optional[str] = Field(None, alias="rawPath")
    transcoding_status: Optional[str] = Field(None, alias="transcodingStatus")
    transcript: Optional[str] = None
    subtitles_url: Optional[str] = Field(None, alias="subtitlesUrl")
    subtitles_language: Optional[str] = Field(None, alias="subtitlesLanguage")
    subtitles_enabled: bool = Field(True, alias="subtitlesEnabled")
    attachments: Optional[List[Dict[str, Any]]] = None
    quiz_id: Optional[int] = Field(None, alias="quizId")
    required_pass_score: Optional[int] = Field(None, alias="requiredPassScore")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    thumbnail_blur_data_url: Optional[str] = Field(None, alias="thumbnailBlurDataURL")
    learning_objectives: List[str] = Field(
        default_factory=list, alias="learningObjectives"
    )
    key_takeaways: List[str] = Field(default_factory=list, alias="keyTakeaways")
    instructor_notes: Optional[str] = Field(None, alias="instructorNotes")
    estimated_completion_time: Optional[int] = Field(
        None, alias="estimatedCompletionTime"
    )
    difficulty: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    related_resources: Optional[List[Dict[str, Any]]] = Field(
        None, alias="relatedResources"
    )

    # Timestamps
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    # Preview & Access fields
    is_preview: bool = Field(False, alias="isPreview")

    # Computed fields (not in database)
    is_completed: bool = Field(False, alias="isCompleted")
    is_locked: bool = Field(True, alias="isLocked")
    has_access: bool = Field(False, alias="hasAccess")
    resources: int = Field(0, alias="resources")
    exercises: int = Field(0, alias="exercises")

    @field_validator("attachments", "related_resources", mode="before")
    @classmethod
    def parse_json_fields(cls, value):
        return parse_json_field(value, [])

    @property
    def duration(self) -> str:
        if self.duration_minutes:
            hours = self.duration_minutes // 60
            minutes = self.duration_minutes % 60
            if hours > 0:
                return f"{hours}h {minutes}min"
            return f"{minutes} min"
        return "Unknown"

    def model_dump(self, **kwargs):
        data = super().model_dump(**kwargs)
        data["duration"] = self.duration
        data["isCompleted"] = self.is_completed
        data["isLocked"] = self.is_locked
        data["hasAccess"] = self.has_access
        data["resources"] = self.resources
        data["exercises"] = self.exercises
        return data


class ModuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Database fields
    id: str
    title: str
    description: Optional[str] = None
    full_description: Optional[str] = Field(None, alias="fullDescription")
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    estimated_effort: Optional[str] = Field(None, alias="estimatedEffort")
    total_lessons: Optional[int] = Field(None, alias="totalLessons")
    level: Optional[str] = None
    instructor_id: Optional[int] = Field(None, alias="instructorId")
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    price_cents: Optional[int] = Field(None, alias="priceCents")
    price: Optional[Dict[str, Any]] = None
    featured: bool = False
    last_updated: Optional[datetime] = Field(None, alias="lastUpdated")

    # Timestamps
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    # Computed fields
    gradient: str = "from-blue-500 to-cyan-500"
    icon: str = "🌐"
    category: str = "Foundation"
    learning_objectives: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    completion_badge: Optional[str] = None
    what_you_get: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    target_audience: List[str] = Field(default_factory=list)
    instructor: Optional[InstructorResponse] = None
    lessons: List[LessonResponse] = []
    progress: float = 0.0
    is_enrolled: bool = False
    has_access: bool = Field(False, alias="hasAccess")
    rating: Optional[float] = None
    enrolled: int = 0
    is_new: bool = False
    total_duration: str = "Unknown"
    features: List[str] = Field(default_factory=list)

    # New metadata fields pulled from JSON
    prerequisites: List[str] = Field(default_factory=list)
    what_you_get: List[str] = Field(default_factory=list, alias="whatYouGet")
    requirements: List[str] = Field(default_factory=list)
    target_audience: List[str] = Field(default_factory=list, alias="targetAudience")
    paths: List[Any] = Field(default_factory=list)
    # Live sessions linked to this module
    live_sessions: List[Dict[str, Any]] = Field(
        default_factory=list, alias="liveSessions"
    )

    @field_validator("price", mode="before")
    @classmethod
    def parse_price_field(cls, value):
        return parse_json_field(value)

    @property
    def duration(self) -> str:
        if self.duration_minutes:
            hours = self.duration_minutes // 60
            minutes = self.duration_minutes % 60
            if hours > 0:
                return f"{hours} hours"
            return f"{minutes} min"
        return "Unknown"

    @property
    def computed_price(self) -> Dict[str, Optional[int]]:
        if self.price:
            return self.price
        return {"original": self.price_cents, "discounted": None}

    def model_dump(self, **kwargs):
        data = super().model_dump(**kwargs)
        data["duration"] = self.duration
        data["price"] = self.computed_price
        data["features"] = self.features
        data["progress"] = self.progress
        data["isEnrolled"] = self.is_enrolled
        data["hasAccess"] = self.has_access
        data["rating"] = self.rating
        data["enrolled"] = self.enrolled
        data["isNew"] = self.is_new
        data["lastUpdated"] = self.last_updated
        data["totalLessons"] = self.total_lessons
        data["totalDuration"] = self.total_duration
        data["liveSessions"] = self.live_sessions
        return data


class PathResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str] = None
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    # Computed fields
    modules: List[ModuleResponse] = []
    total_modules: int = 0
    total_duration: str = "Unknown"
    progress: float = 0.0
    is_enrolled: bool = False
    enrolled: int = 0
    estimated_completion_time: str = "Unknown"
    price: Optional[Dict[str, Any]] = None
    price_cents: Optional[int] = None


class PathModuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path_id: str = Field(alias="pathId")
    module_id: str = Field(alias="moduleId")
    order: Optional[int] = None
    module: Optional[ModuleResponse] = None
    path: Optional[PathResponse] = None


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int = Field(alias="userId")
    module_id: Optional[str] = Field(None, alias="moduleId")
    path_id: Optional[str] = Field(None, alias="pathId")
    progress: float = 0.0
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    started_at: datetime = Field(alias="startedAt")
    certificate_id: Optional[str] = Field(None, alias="certificateId")
    module: Optional[ModuleResponse] = None
    path: Optional[PathResponse] = None


class LessonProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int = Field(alias="userId")
    user: Optional[UserProfileResponse] = None  # If you need user info
    lesson_id: str = Field(alias="lessonId")
    is_completed: bool = Field(False, alias="isCompleted")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    progress: float = 0.0
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    lesson: Optional[LessonResponse] = None


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int = Field(alias="userId")
    module_id: Optional[str] = Field(None, alias="moduleId")
    file_url: str = Field(alias="fileUrl")
    issued_at: datetime = Field(alias="issuedAt")
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(alias="createdAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    module: Optional[ModuleResponse] = None

    @field_validator("metadata", mode="before")
    @classmethod
    def parse_metadata_field(cls, value):
        return parse_json_field(value)


# Progress Update Schemas
class ProgressUpdate(BaseModel):
    progress: float = Field(..., ge=0, le=100)
    completed: bool = False


class LessonCompleteRequest(BaseModel):
    lesson_id: str
    module_id: str


# Quiz Schemas
class QuizQuestionOption(BaseModel):
    id: str
    text: str


class MatchingPair(BaseModel):
    id: str
    left: str
    right: str


class FillInBlankPart(BaseModel):
    id: str
    type: str
    content: str


class QuizQuestion(BaseModel):
    id: str
    question: str
    type: str
    options: Optional[List[QuizQuestionOption]] = None
    matching_pairs: Optional[List[MatchingPair]] = Field(None, alias="matchingPairs")
    fill_in_blank_parts: Optional[List[FillInBlankPart]] = Field(
        None, alias="fillInBlankParts"
    )
    points: int
    hint: Optional[str] = None


class QuizResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    questions: List[QuizQuestion]
    time_limit_minutes: int = Field(alias="timeLimitMinutes")
    passing_score: int = Field(alias="passingScore")
    allow_retake: bool = Field(alias="allowRetake")


class QuizSubmission(BaseModel):
    answers: Dict[str, Any]  # question_id: selected_option(s)
    tab_switches_count: int = Field(0, alias="tabSwitchesCount")
    copy_paste_attempts: int = Field(0, alias="copyPasteAttempts")
    question_dwell_times: Dict[str, float] = Field(
        default_factory=dict, alias="questionDwellTimes"
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_answers(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "answers" in data and isinstance(data["answers"], dict):
                return data
            telemetry_keys = {
                "tab_switches_count",
                "tabSwitchesCount",
                "copy_paste_attempts",
                "copyPasteAttempts",
                "question_dwell_times",
                "questionDwellTimes",
            }
            answers = {k: v for k, v in data.items() if k not in telemetry_keys}
            return {
                "answers": answers,
                "tabSwitchesCount": data.get(
                    "tabSwitchesCount", data.get("tab_switches_count", 0)
                ),
                "copyPasteAttempts": data.get(
                    "copyPasteAttempts", data.get("copy_paste_attempts", 0)
                ),
                "questionDwellTimes": data.get(
                    "questionDwellTimes", data.get("question_dwell_times", {})
                ),
            }
        return data


class QuizAttemptResponse(BaseModel):
    id: int
    user_id: int = Field(alias="userId")
    quiz_id: int = Field(alias="quizId")
    score: float
    is_passed: bool = Field(alias="isPassed")
    time_spent: Optional[int] = Field(None, alias="timeSpent")
    started_at: datetime = Field(alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")

    model_config = ConfigDict(from_attributes=True)


# User Profile Schemas
class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: Optional[str] = None
    email_verified: bool = Field(alias="emailVerified")
    phone_number: Optional[str] = Field(None, alias="phoneNumber")
    phone_verified: bool = Field(alias="phoneVerified")
    role: str
    full_name: str = Field(alias="fullName")
    profile_picture_url: Optional[str] = Field(None, alias="profilePictureUrl")
    bio: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    social_links: Optional[Dict[str, str]] = Field(None, alias="socialLinks")
    subscribe_newsletter: bool = Field(alias="subscribeNewsletter")
    is_active: bool = Field(alias="isActive")
    last_login_at: Optional[datetime] = Field(None, alias="lastLoginAt")
    login_count: int = Field(alias="loginCount")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    # Related data
    certificates: List[CertificateResponse] = Field(default_factory=list)
    enrollments: List[EnrollmentResponse] = Field(default_factory=list)
    lesson_progresses: List[LessonProgressResponse] = Field(default_factory=list)
    instructed_modules: List[ModuleResponse] = Field(default_factory=list)

    @field_validator("social_links", mode="before")
    @classmethod
    def parse_social_links_field(cls, value):
        return parse_json_field(value)


# Create/Update Schemas
class ModuleCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    description: Optional[str] = None
    full_description: Optional[str] = Field(None, alias="fullDescription")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    estimated_effort: Optional[str] = Field(None, alias="estimatedEffort")
    total_lessons: Optional[int] = Field(None, alias="totalLessons")
    level: Optional[str] = None
    instructor_id: Optional[int] = Field(None, alias="instructorId")
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    price_cents: Optional[int] = Field(None, alias="priceCents")
    price: Optional[Union[Dict[str, Any], int, float]] = None
    featured: bool = False

    def model_dump_db(self, **kwargs):
        data = self.model_dump(**kwargs)
        if "price" in data:
            if data["price"] is None:
                del data["price"]
            elif isinstance(data["price"], (int, float)):
                data["price"] = serialize_json_field(
                    {
                        "amount": int(data["price"]),
                        "currency": "DZD",
                        "dzd": int(data["price"]),
                    }
                )
            elif isinstance(data["price"], dict):
                p = dict(data["price"])
                amount = int(
                    p.get("amount") if p.get("amount") is not None else p.get("dzd", 0)
                )
                p["amount"] = amount
                p["dzd"] = amount
                p.setdefault("currency", "DZD")
                data["price"] = serialize_json_field(p)

        if data.get("instructor_id"):
            data["instructor"] = {"connect": {"id": data.pop("instructor_id")}}
        elif "instructor_id" in data:
            del data["instructor_id"]

        # Map snake_case to camelCase
        mapping = {
            "full_description": "fullDescription",
            "duration_minutes": "durationMinutes",
            "estimated_effort": "estimatedEffort",
            "total_lessons": "totalLessons",
            "thumbnail_url": "thumbnailUrl",
        }
        for old_key, new_key in mapping.items():
            if old_key in data:
                data[new_key] = data.pop(old_key)

        # Remove fields not in database
        if "price_cents" in data:
            del data["price_cents"]

        return data


class InstructorModuleUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    description: Optional[str] = None
    full_description: Optional[str] = Field(None, alias="fullDescription")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    estimated_effort: Optional[str] = Field(None, alias="estimatedEffort")
    total_lessons: Optional[int] = Field(None, alias="totalLessons")
    level: Optional[str] = None
    skills: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    price_cents: Optional[int] = Field(None, alias="priceCents")
    price: Optional[Union[Dict[str, Any], int, float]] = None
    last_updated: Optional[datetime] = Field(None, alias="lastUpdated")

    def model_dump_db(self, **kwargs):
        data = self.model_dump(exclude_unset=True, **kwargs)
        if "price" in data:
            if data["price"] is None:
                # Free course pricing object instead of raw null to avoid Prisma Json null constraint
                data["price"] = serialize_json_field(
                    {
                        "amount": 0,
                        "currency": "DZD",
                        "dzd": 0,
                    }
                )
            elif isinstance(data["price"], (int, float)):
                data["price"] = serialize_json_field(
                    {
                        "amount": int(data["price"]),
                        "currency": "DZD",
                        "dzd": int(data["price"]),
                    }
                )
            elif isinstance(data["price"], dict):
                p = dict(data["price"])
                amount = int(
                    p.get("amount") if p.get("amount") is not None else p.get("dzd", 0)
                )
                p["amount"] = amount
                p["dzd"] = amount
                p.setdefault("currency", "DZD")
                data["price"] = serialize_json_field(p)

        # Map snake_case to camelCase
        mapping = {
            "full_description": "fullDescription",
            "duration_minutes": "durationMinutes",
            "estimated_effort": "estimatedEffort",
            "total_lessons": "totalLessons",
            "thumbnail_url": "thumbnailUrl",
            "last_updated": "lastUpdated",
        }
        for old_key, new_key in mapping.items():
            if old_key in data:
                data[new_key] = data.pop(old_key)

        # Remove fields not in database
        if "price_cents" in data:
            del data["price_cents"]

        return data


class AdminModuleUpdate(InstructorModuleUpdate):
    featured: Optional[bool] = None


class ModuleUpdate(InstructorModuleUpdate):
    featured: Optional[bool] = None


class VideoUploadResponse(BaseModel):
    success: bool = True
    lesson_id: str
    raw_path: str
    transcoding_status: str
    detected_duration_seconds: int
    detected_duration_minutes: int
    formatted_duration: str
    video_url: Optional[str] = None
    warning: Optional[str] = None


class LessonCreate(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    module_id: str
    order: int
    duration_minutes: Optional[int] = None
    duration_seconds: Optional[int] = None
    type: str = "text"
    video_url: Optional[str] = None
    transcript: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    quiz_id: Optional[int] = None
    required_pass_score: Optional[int] = None
    thumbnail_url: Optional[str] = None
    thumbnail_blur_data_url: Optional[str] = None
    learning_objectives: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)
    instructor_notes: Optional[str] = None
    estimated_completion_time: Optional[int] = None
    difficulty: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    related_resources: Optional[List[Dict[str, Any]]] = None
    is_preview: Optional[bool] = False

    def model_dump_db(self, **kwargs):
        data = self.model_dump(**kwargs)
        if "attachments" in data and data["attachments"] is not None:
            data["attachments"] = serialize_json_field(data["attachments"])
        elif "attachments" in data:
            del data["attachments"]
        if "related_resources" in data and data["related_resources"] is not None:
            data["related_resources"] = serialize_json_field(data["related_resources"])
        elif "related_resources" in data:
            del data["related_resources"]

        # Map snake_case to camelCase for Prisma
        if "module_id" in data:
            data["module"] = {"connect": {"id": data.pop("module_id")}}
        if "quiz_id" in data:
            data["quizId"] = data.pop("quiz_id")
        if "is_preview" in data and data["is_preview"] is not None:
            data["isPreview"] = data.pop("is_preview")
        if "duration_minutes" in data:
            data["durationMinutes"] = data.pop("duration_minutes")
        if "duration_seconds" in data:
            data["durationSeconds"] = data.pop("duration_seconds")
        if "video_url" in data:
            data["videoUrl"] = data.pop("video_url")
        if "thumbnail_url" in data:
            data["thumbnailUrl"] = data.pop("thumbnail_url")
        if "thumbnail_blur_data_url" in data:
            data["thumbnailBlurDataURL"] = data.pop("thumbnail_blur_data_url")
        if "learning_objectives" in data:
            data["learningObjectives"] = data.pop("learning_objectives")
        if "key_takeaways" in data:
            data["keyTakeaways"] = data.pop("key_takeaways")
        if "instructor_notes" in data:
            data["instructorNotes"] = data.pop("instructor_notes")
        if "estimated_completion_time" in data:
            data["estimatedCompletionTime"] = data.pop("estimated_completion_time")
        if "required_pass_score" in data:
            data["requiredPassScore"] = data.pop("required_pass_score")

        if not data.get("id"):
            import uuid

            data["id"] = f"lesson_{uuid.uuid4().hex[:12]}"

        return data


class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    duration_minutes: Optional[int] = None
    duration_seconds: Optional[int] = None
    type: Optional[str] = None
    video_url: Optional[str] = None
    transcript: Optional[str] = None
    difficulty: Optional[str] = None
    subtitles_path: Optional[str] = None
    subtitles_language: Optional[str] = None
    subtitles_enabled: Optional[bool] = None
    thumbnail_url: Optional[str] = None
    thumbnail_blur_data_url: Optional[str] = None
    learning_objectives: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    instructor_notes: Optional[str] = None
    estimated_completion_time: Optional[int] = None
    quiz_id: Optional[int] = None
    required_pass_score: Optional[int] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    related_resources: Optional[List[Dict[str, Any]]] = None
    is_preview: Optional[bool] = None

    def model_dump_db(self, **kwargs):
        data = self.model_dump(exclude_unset=True, **kwargs)
        if "attachments" in data and data["attachments"] is not None:
            data["attachments"] = serialize_json_field(data["attachments"])
        if "related_resources" in data and data["related_resources"] is not None:
            data["related_resources"] = serialize_json_field(data["related_resources"])

        # Map snake_case to camelCase for Prisma
        mapping = {
            "duration_minutes": "durationMinutes",
            "duration_seconds": "durationSeconds",
            "video_url": "videoUrl",
            "subtitles_path": "subtitlesPath",
            "subtitles_language": "subtitlesLanguage",
            "subtitles_enabled": "subtitlesEnabled",
            "thumbnail_url": "thumbnailUrl",
            "thumbnail_blur_data_url": "thumbnailBlurDataURL",
            "learning_objectives": "learningObjectives",
            "key_takeaways": "keyTakeaways",
            "instructor_notes": "instructorNotes",
            "estimated_completion_time": "estimatedCompletionTime",
            "quiz_id": "quizId",
            "required_pass_score": "requiredPassScore",
            "is_preview": "isPreview",
        }
        for old_key, new_key in mapping.items():
            if old_key in data:
                data[new_key] = data.pop(old_key)

        return data


class PathCreate(BaseModel):
    id: str
    title: str
    description: Optional[str] = None


class PathUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class PathModuleCreate(BaseModel):
    path_id: str
    module_id: str
    order: Optional[int] = None


class EnrollmentCreate(BaseModel):
    user_id: int
    module_id: Optional[str] = None
    path_id: Optional[str] = None
    progress: float = 0.0


class LessonProgressCreate(BaseModel):
    user_id: int
    lesson_id: str
    is_completed: bool = False
    progress: float = 0.0


class LessonProgressUpdate(BaseModel):
    is_completed: Optional[bool] = None
    progress: Optional[float] = None
    completed_at: Optional[datetime] = None


# Enhanced Response Schemas for Better UX
class ModuleListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    durationMinutes: Optional[int] = None
    total_lessons: Optional[int] = Field(None, alias="totalLessons")
    totalLessons: Optional[int] = None
    duration: Optional[str] = None
    thumbnail_url: Optional[Any] = Field(None, alias="thumbnailUrl")
    thumbnailUrl: Optional[Any] = None
    skills: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    price_cents: Optional[int] = None
    price: Optional[Dict[str, Any]] = None
    featured: bool = False
    gradient: str = "from-blue-500 to-cyan-500"
    icon: str = "🌐"
    category: str = "Foundation"
    progress: float = 0.0
    is_enrolled: bool = Field(False, alias="isEnrolled")
    isEnrolled: bool = False
    rating: Optional[float] = None
    enrolled: int = 0
    is_new: bool = Field(False, alias="isNew")
    isNew: bool = False
    instructor: Optional[InstructorResponse] = None
    paths: List[Any] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PathListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    description: Optional[str] = None
    total_modules: int = Field(0, alias="totalModules")
    totalModules: int = 0
    total_lessons: int = Field(0, alias="totalLessons")
    totalLessons: int = 0
    total_duration: str = Field("Unknown", alias="totalDuration")
    totalDuration: str = "Unknown"
    progress: float = 0.0
    is_enrolled: bool = Field(False, alias="isEnrolled")
    isEnrolled: bool = False
    enrolled: int = 0
    estimated_completion_time: str = Field("Unknown", alias="estimatedCompletionTime")
    estimatedCompletionTime: str = "Unknown"
    featured: bool = False
    level: Optional[str] = None
    thumbnail_url: Optional[Any] = Field(None, alias="thumbnailUrl")
    thumbnailUrl: Optional[Any] = None
    featured_modules: List[ModuleListResponse] = Field(default_factory=list)
    price: Optional[Dict[str, Any]] = None
    price_cents: Optional[int] = None
    created_at: Optional[str] = Field(None, alias="createdAt")
    updated_at: Optional[str] = Field(None, alias="updatedAt")


class UserLearningStats(BaseModel):
    total_modules_enrolled: int = 0
    total_lessons_completed: int = 0
    total_learning_time: int = 0  # in minutes
    current_streak: int = 0
    certificates_earned: int = 0
    favorite_category: Optional[str] = None
    average_progress: float = 0.0
    average_quiz_score: float = 0.0


class LearningPathRecommendation(BaseModel):
    path: PathResponse
    modules: List[ModuleResponse]
    match_score: float
    reason: str
    # Actionable navigation metadata — lets the frontend render a direct link
    # to the relevant edit/enroll form without constructing URLs itself.
    target_url: str = ""  # e.g. "/learn/paths/42" or "/learn/courses/7"
    target_id: int = 0  # Primary entity ID (path.id or module.id)
    target_type: str = "path"  # "path" | "module"


# Search and Filter Schemas
class ModuleFilter(BaseModel):
    level: Optional[List[str]] = None
    category: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    duration_min: Optional[int] = None
    duration_max: Optional[int] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    featured: Optional[bool] = None
    instructor_id: Optional[int] = None


class SearchQuery(BaseModel):
    query: str
    filters: Optional[ModuleFilter] = None
    sort_by: str = "relevance"
    page: int = 1
    page_size: int = 20


class SearchResults(BaseModel):
    modules: List[ModuleResponse]
    paths: List[PathResponse]
    total_modules: int
    total_paths: int
    page: int
    page_size: int
    total_pages: int


# Course Review Schemas
class CourseReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=2000)


# ─── Instructor Lesson/Quiz Management Schemas ────────────────────────────────


class QuizQuestionCreate(BaseModel):
    question: str
    question_type: str = "MULTIPLE_CHOICE"
    options: Optional[List[Dict[str, Any]]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    points: int = 10
    order: int = 0


class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    passing_score: int = 90
    time_limit_minutes: int = 30
    retake_cooldown_minutes: int = 60
    allow_retake: bool = True
    shuffle_questions: bool = True
    questions: List[QuizQuestionCreate] = Field(default_factory=list)


class LessonReorderItem(BaseModel):
    lessonId: str
    order: int


class LessonReorderRequest(BaseModel):
    lessons: List[LessonReorderItem]


# ─── Instructor Learning Path Management Schemas ─────────────────────────────


class InstructorPathCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    price: Optional[Dict[str, Any]] = None


class InstructorPathUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    price: Optional[Dict[str, Any]] = None
    featured: Optional[bool] = None


class AdminPathUpdate(InstructorPathUpdate):
    featured: Optional[bool] = None


class InstructorPathModuleAdd(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    module_id: str = Field(alias="moduleId")
    order: Optional[int] = None


class InstructorPathModuleReorderItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    module_id: str = Field(alias="moduleId")
    order: int


class InstructorPathModuleReorder(BaseModel):
    modules: List[InstructorPathModuleReorderItem]


class CourseReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int = Field(alias="userId")
    module_id: str = Field(alias="moduleId")
    rating: int
    comment: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    # User display info (populated by service)
    user_full_name: str = ""
    user_profile_picture_url: Optional[str] = None


class PaginatedReviewsResponse(BaseModel):
    reviews: List[CourseReviewResponse]
    total: int
    page: int
    page_size: int
    average_rating: Optional[float] = None


# =============================================================================
# LIVE SESSION INTEGRATION SCHEMAS
# =============================================================================


class LiveSessionModuleLinkCreate(BaseModel):
    module_id: str
    session_id: str
    order: int = 0
    is_required: bool = True


class LiveSessionModuleLinkResponse(BaseModel):
    id: int
    module_id: str
    live_session_id: str
    order: int
    is_required: bool
    created_at: datetime
    updated_at: datetime
    session: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class ModuleWithLiveSessionsResponse(ModuleResponse):
    live_sessions: List[LiveSessionModuleLinkResponse] = []


# =============================================================================
# CODE EXECUTION & MICROVM EVALUATOR SCHEMAS
# =============================================================================


class CodeExecutionRequest(BaseModel):
    code: str
    language: str = "python"
    test_code: Optional[str] = None
    template_code: Optional[str] = None
    problem_id: Optional[str] = None


class CodeExecutionResponse(BaseModel):
    passed: bool
    output: str
    error: Optional[str] = None
    duration_ms: float
    memory_mb: float
    similarity_score: float = 0.0
    plagiarism_flagged: bool = False
