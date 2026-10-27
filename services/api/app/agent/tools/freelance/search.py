"""
services/api/app/agent/tools/freelance/search.py
Tool 9: Search open freelance projects, RFPs, and job postings.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.freelancing_service import FreelanceService
from app.schemas.freelancing import ProjectSearch, ProjectStatus


class SearchFreelanceProjectsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    query: Optional[str] = Field(
        None, max_length=100, description="Keyword in project title or scope"
    )
    skills: Optional[List[str]] = Field(
        None, description="Filter by required technical skills"
    )
    budget_min_dzd: Optional[int] = Field(
        None, ge=1000, description="Minimum budget in DZD"
    )
    budget_max_dzd: Optional[int] = Field(
        None, ge=1000, description="Maximum budget in DZD"
    )
    limit: int = Field(default=10, ge=1, le=50, description="Max results")


class SearchFreelanceProjectsTool(BaseTool):
    name = "search_freelance_projects"
    description = "Search open freelance projects, RFPs, and missions on Podacium Hub by keyword, skills, or budget."
    domain = ToolDomain.FREELANCE
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    args_schema = SearchFreelanceProjectsArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: SearchFreelanceProjectsArgs = args
        search_params = ProjectSearch(
            skip=0,
            limit=typed_args.limit,
            skills=typed_args.skills,
            search=typed_args.query,
            status=ProjectStatus.OPEN,
        )

        res = await FreelanceService.list_projects(
            search_params=search_params, user_id=context.user_id
        )
        projects = res.get("projects", [])

        # Budget filtering
        if typed_args.budget_min_dzd or typed_args.budget_max_dzd:
            filtered = []
            for p in projects:
                b = p.get("budget") or 0
                if typed_args.budget_min_dzd and b < typed_args.budget_min_dzd:
                    continue
                if typed_args.budget_max_dzd and b > typed_args.budget_max_dzd:
                    continue
                filtered.append(p)
            projects = filtered

        summary_list = [
            {
                "id": p.get("id"),
                "title": p.get("title"),
                "budget_dzd": p.get("budget"),
                "skills": p.get("skills", []),
                "proposals_count": p.get("proposals_count", 0),
                "url": f"/hub/projects/{p.get('id')}",
            }
            for p in projects
        ]

        return ToolResult(
            success=True,
            data={"count": len(summary_list), "projects": summary_list},
            widget_payload={"type": "ProjectListingGrid", "projects": summary_list},
        )
