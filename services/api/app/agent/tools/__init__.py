"""
services/api/app/agent/tools/__init__.py
Tools package aggregator for Podacium Agentic AI Engine with comprehensive 60+ tool inventory.
"""

from typing import List

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.tools.claim_check import ClaimCheckManager, offload_to_claim_check
from app.agent.tools.registry import ToolRegistry, tool_registry

# Import all 5 domain tool packages (13 tools each = 65 tools)
from app.agent.tools.edtech import EDTECH_TOOLS
from app.agent.tools.freelance import FREELANCE_TOOLS
from app.agent.tools.bi import BI_TOOLS
from app.agent.tools.fintech import FINTECH_TOOLS
from app.agent.tools.core import CORE_TOOLS

ALL_TOOLS: List[BaseTool] = (
    EDTECH_TOOLS + FREELANCE_TOOLS + BI_TOOLS + FINTECH_TOOLS + CORE_TOOLS
)

# Backward-compatibility alias
ALL_40_TOOLS: List[BaseTool] = ALL_TOOLS

# Auto-register all tools into the singleton registry
tool_registry.register_all(ALL_TOOLS)

__all__ = [
    "BaseTool",
    "ToolDomain",
    "ToolResult",
    "ToolRegistry",
    "tool_registry",
    "ClaimCheckManager",
    "offload_to_claim_check",
    "EDTECH_TOOLS",
    "FREELANCE_TOOLS",
    "BI_TOOLS",
    "FINTECH_TOOLS",
    "CORE_TOOLS",
    "ALL_TOOLS",
    "ALL_40_TOOLS",
]
