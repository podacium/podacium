"""
services/api/app/agent/tools/registry.py
Domain-Partitioned Static Tool Registry with O(1) Lookups and RBAC Filtering.
"""

from typing import Dict, List, Optional, Any
from app.schemas.auth import UserRole
from app.agent.tools.base import BaseTool, ToolDomain
from app.agent.schemas import ToolDefinition


class ToolRegistry:
    """
    High-performance tool catalog maintaining O(1) lookups and domain-sliced static sets.
    """

    def __init__(self):
        self._tools_by_name: Dict[str, BaseTool] = {}
        self._tools_by_domain: Dict[ToolDomain, Dict[str, BaseTool]] = {
            domain: {} for domain in ToolDomain
        }

    def register(self, tool: BaseTool) -> None:
        """Registers a tool into global and domain-specific indexes."""
        if tool.name in self._tools_by_name:
            # Idempotent re-registration for reloaders
            self._tools_by_domain[tool.domain][tool.name] = tool
            self._tools_by_name[tool.name] = tool
            return

        self._tools_by_name[tool.name] = tool
        self._tools_by_domain[tool.domain][tool.name] = tool

    def register_all(self, tools: List[BaseTool]) -> None:
        """Registers a list of tools into global and domain-specific indexes."""
        for tool in tools:
            self.register(tool)

    def list_tools(self) -> List[BaseTool]:
        """Alias for get_all_tools."""
        return self.get_all_tools()

    def get_tools_for_domain(
        self, domain: ToolDomain, role: Optional[UserRole] = None
    ) -> List[BaseTool]:
        """Alias for get_domain_tools."""
        return self.get_domain_tools(domain, role)

    def get_tool(self, name: str) -> Optional[BaseTool]:
        """O(1) lookup by tool name."""
        return self._tools_by_name.get(name)

    def get_all_tools(self) -> List[BaseTool]:
        """Returns all registered tools across all domains."""
        return list(self._tools_by_name.values())

    def get_domain_tools(
        self, domain: ToolDomain, role: Optional[UserRole] = None
    ) -> List[BaseTool]:
        """
        Retrieves static tools for the target domain.
        If role is specified, filters out tools that the role cannot execute.
        """
        domain_dict = self._tools_by_domain.get(domain, {})
        tools = list(domain_dict.values())
        if role is not None:
            tools = [t for t in tools if t.is_accessible_by(role)]
        return tools

    def get_openai_domain_definitions(
        self, domain: ToolDomain, role: Optional[UserRole] = None
    ) -> List[ToolDefinition]:
        """Prepares OpenAI-compatible tool definitions for LLM invocation."""
        tools = self.get_domain_tools(domain, role)
        return [tool.get_openai_schema() for tool in tools]

    def get_gemini_domain_declarations(
        self, domain: ToolDomain, role: Optional[UserRole] = None
    ) -> List[Dict[str, Any]]:
        """Prepares Google Gemini functionDeclaration dicts for REST v1beta."""
        tools = self.get_domain_tools(domain, role)
        return [tool.get_gemini_schema() for tool in tools]


# Global Singleton Registry Instance
tool_registry = ToolRegistry()
