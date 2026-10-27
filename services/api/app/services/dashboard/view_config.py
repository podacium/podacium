from app.schemas.auth import UserRole
from app.schemas.dashboard import ViewConfig, SectionConfig


def get_view_config(role: UserRole) -> ViewConfig:
    configs = {
        UserRole.STUDENT: ViewConfig(
            sections=[
                SectionConfig(id="learning_progress", priority=1, grid="main"),
                SectionConfig(id="certificates", priority=3, grid="main"),
            ],
            show_quick_actions=True,
            show_wallet=True,
            show_skills=True,
            show_recommendations=True,
        ),
        UserRole.FREELANCER: ViewConfig(
            sections=[
                SectionConfig(id="active_projects", priority=1, grid="main"),
                SectionConfig(id="proposals", priority=2, grid="main"),
                SectionConfig(id="active_contracts", priority=3, grid="main"),
                SectionConfig(id="earnings_chart", priority=4, grid="main"),
            ],
            show_quick_actions=True,
            show_wallet=True,
            show_skills=True,
            show_recommendations=True,
        ),
        UserRole.BUSINESS: ViewConfig(
            sections=[
                SectionConfig(id="job_listings", priority=1, grid="main"),
                SectionConfig(id="applicants", priority=2, grid="main"),
                SectionConfig(id="team_overview", priority=3, grid="main"),
            ],
            show_quick_actions=True,
            show_wallet=True,
            show_skills=False,
            show_recommendations=True,
        ),
        UserRole.ADMIN: ViewConfig(
            sections=[
                SectionConfig(id="platform_metrics", priority=0, grid="full"),
                SectionConfig(id="user_growth", priority=1, grid="main"),
                SectionConfig(id="revenue", priority=2, grid="main"),
                SectionConfig(id="recent_users", priority=3, grid="main"),
                SectionConfig(id="system_alerts", priority=4, grid="full"),
            ],
            show_quick_actions=True,
            show_wallet=False,
            show_skills=False,
            show_recommendations=False,
        ),
        UserRole.INSTRUCTOR: ViewConfig(
            sections=[
                SectionConfig(id="learning_progress", priority=1, grid="main"),
            ],
            show_quick_actions=True,
            show_wallet=True,
            show_skills=False,
            show_recommendations=True,
        ),
    }
    return configs.get(role, configs[UserRole.STUDENT])
