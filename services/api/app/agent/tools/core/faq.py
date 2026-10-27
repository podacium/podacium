"""
Core FAQ & Knowledge Tools: SearchKnowledgeFaqTool.
"""

from typing import Any, Dict, List, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.services.support_knowledge import PODACIUM_GROUNDING_PROMPT


class SearchKnowledgeFaqArgs(BaseModel):
    query: str = Field(
        min_length=2,
        description="Search term or question regarding platform policies, founders, billing, or features",
    )
    top_k: int = Field(
        default=3, ge=1, le=5, description="Number of relevant sections to retrieve"
    )


class SearchKnowledgeFaqTool(BaseTool):
    name = "search_knowledge_faq"
    description = (
        "Search Podacium's authoritative internal grounding knowledge base for platform policies, "
        "MESRS Arrêté 1275, ANAE Law 22-23, CIDTA Article 169 tax shields, and company details."
    )
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = SearchKnowledgeFaqArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, SearchKnowledgeFaqArgs)

        query_terms = [t.lower() for t in typed_args.query.split() if len(t) > 2]
        sections = PODACIUM_GROUNDING_PROMPT.split("### ")

        scored_sections: List[Dict[str, Any]] = []
        for sec in sections:
            sec_text = sec.strip()
            if not sec_text:
                continue
            lines = sec_text.splitlines()
            title = lines[0].strip() if lines else "General"
            content = "\n".join(lines[1:]).strip() if len(lines) > 1 else sec_text

            score = 0
            sec_lower = sec_text.lower()
            for term in query_terms:
                if term in title.lower():
                    score += 5
                if term in sec_lower:
                    score += sec_lower.count(term)

            if score > 0 or not query_terms:
                scored_sections.append(
                    {
                        "title": title,
                        "content": content[:800],
                        "score": score,
                    }
                )

        scored_sections.sort(key=lambda x: x["score"], reverse=True)
        top_matches = scored_sections[: typed_args.top_k]

        return ToolResult(
            success=True,
            data=top_matches,
            widget_payload={
                "widgetType": "faq_knowledge_card",
                "query": typed_args.query,
                "matches": [
                    {"title": m["title"], "snippet": m["content"][:200]}
                    for m in top_matches
                ],
            },
        )
