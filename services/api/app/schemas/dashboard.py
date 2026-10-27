from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime


class DashboardStats(BaseModel):
    total_courses: int = Field(ge=0)
    completed_courses: int = Field(ge=0)
    active_projects: int = Field(ge=0)
    completed_projects: int = Field(ge=0)
    datasets_count: int = Field(ge=0)
    certifications_count: int = Field(ge=0)
    total_earnings: float = Field(ge=0.0)
    skill_level: str

    @field_validator("completed_courses")
    def validate_completed_courses(cls, v, info):
        total_courses = info.data.get("total_courses")
        if total_courses is not None and v > total_courses:
            raise ValueError("Completed courses cannot exceed total courses")
        return v


class RecentActivity(BaseModel):
    id: int
    type: str
    title: str
    description: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class CourseProgress(BaseModel):
    id: str
    title: str
    progress: float
    module_count: int
    completed_modules: int
    next_lesson: Optional[str]
    estimated_completion: Optional[datetime]
    thumbnail_url: Optional[str]


class ProjectStatus(BaseModel):
    id: int
    title: str
    status: str
    client: Optional[str]
    deadline: Optional[datetime]
    progress: float
    amount: Optional[float]


class DatasetInfo(BaseModel):
    id: int
    name: str
    size: str
    last_accessed: datetime
    record_count: int
    processing_status: str


# ── New role-specific schemas ─────────────────────────────────────

class ProposalSummary(BaseModel):
    id: int
    project_title: str
    status: str
    amount: float
    submitted_at: datetime
    client_name: Optional[str] = None


class ContractSummary(BaseModel):
    id: int
    project_title: str
    client_name: Optional[str] = None
    status: str
    amount: float
    start_date: datetime
    end_date: Optional[datetime] = None


class EarningsSummary(BaseModel):
    total_earned: float = 0
    pending_payments: float = 0
    this_month: float = 0
    last_month: float = 0
    average_per_project: float = 0


class JobListingSummary(BaseModel):
    id: int
    title: str
    applicants_count: int = 0
    status: str
    created_at: datetime
    budget_range: Optional[str] = None


class PlatformMetrics(BaseModel):
    total_users: int = 0
    users_growth: float = 0
    total_revenue: float = 0
    revenue_growth: float = 0
    active_courses: int = 0
    active_projects: int = 0
    total_transactions: int = 0
    system_uptime: float = 100.0


class UserSummary(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    role: str
    joined_at: datetime
    is_active: bool = True


class SystemAlert(BaseModel):
    id: int
    type: str  # warning | error | info
    message: str
    timestamp: datetime
    acknowledged: bool = False


# ── View configuration (informs frontend rendering) ────────────────

class SectionConfig(BaseModel):
    id: str
    priority: int = 0
    grid: str = "main"


class ViewConfig(BaseModel):
    sections: List[SectionConfig] = []
    show_quick_actions: bool = True
    show_wallet: bool = True
    show_skills: bool = True
    show_recommendations: bool = True


# ── Dashboard state (unified, role-agnostic) ───────────────────────

class DashboardState(BaseModel):
    user_stats: Optional[DashboardStats] = None
    recent_activities: List[RecentActivity] = []
    recommendations: List[Dict[str, Any]] = []
    skill_breakdown: Dict[str, float] = {}
    ongoing_courses: List[CourseProgress] = []
    learning_streak: Optional[int] = None
    certificates_earned: int = 0
    active_projects: List[ProjectStatus] = []
    proposals: List[ProposalSummary] = []
    active_contracts: List[ContractSummary] = []
    freelance_earnings: Optional[EarningsSummary] = None
    job_listings: List[JobListingSummary] = []
    total_applications: int = 0
    total_hires: int = 0
    team_members: int = 0
    platform_stats: Optional[PlatformMetrics] = None
    recent_users: List[UserSummary] = []
    pending_reports: int = 0
    system_alerts: List[SystemAlert] = []
    datasets: List[DatasetInfo] = []


class DashboardResponse(BaseModel):
    role: str
    view_config: ViewConfig
    state: DashboardState
