"""
Agent Supervisor: Two-Tier Router and Tool Selection Orchestrator.
Supports Multi-Domain Tool Blending, Role-Based Access Control (RBAC),
and Distributed Saga Execution.
"""

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.agent.context import AgentSecurityContext
from app.agent.router.classifier import IntentClassifier
from app.agent.saga.orchestrator import AgentSagaOrchestrator
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.tools.registry import tool_registry

logger = logging.getLogger(__name__)


class SupervisorPlan(BaseModel):
    domain: ToolDomain
    secondary_domain: Optional[ToolDomain] = None
    confidence: float
    selected_tool_names: List[str]
    is_hitl_required: bool = False


class AgentSupervisor:
    """
    Supervisor coordinating Intent Routing, Multi-Domain Tool Blending,
    and Distributed Saga Execution.
    """

    def __init__(self, registry=None):
        self.registry = registry or tool_registry

    def plan_tools(
        self,
        query: str,
        context: AgentSecurityContext,
        max_tools: int = 10,
    ) -> List[BaseTool]:
        """
        Classifies intent (with typo-tolerance and Arabic normalization)
        and returns domain-scoped tools filtered by user RBAC role.
        Blends tools from secondary domain if multi-intent is detected.
        """
        classification = IntentClassifier.classify(query)
        logger.info(
            f"[Supervisor] Query classified into {classification.primary_domain.value} "
            f"(secondary={classification.secondary_domain.value if classification.secondary_domain else 'None'}, "
            f"conf={classification.confidence})"
        )

        selected_tools: List[BaseTool] = []
        seen_tool_names: set = set()

        def add_tool(tool: BaseTool):
            if tool.name not in seen_tool_names and len(selected_tools) < max_tools:
                selected_tools.append(tool)
                seen_tool_names.add(tool.name)

        # 1. Fetch primary domain tools matching context role (up to 6)
        primary_tools = self.registry.get_tools_for_domain(
            domain=classification.primary_domain,
            role=context.role,
        )
        for t in primary_tools[:6]:
            add_tool(t)

        # 2. Fetch secondary domain tools if multi-domain intent detected (e.g. Freelancing + BI)
        if classification.secondary_domain:
            secondary_tools = self.registry.get_tools_for_domain(
                domain=classification.secondary_domain,
                role=context.role,
            )
            for t in secondary_tools[:3]:
                add_tool(t)

        # 3. Add essential core tools if domain is not CORE
        if classification.primary_domain != ToolDomain.CORE:
            core_tools = self.registry.get_tools_for_domain(
                domain=ToolDomain.CORE,
                role=context.role,
            )
            for ct in core_tools:
                if ct.name in ("search_knowledge_faq", "get_my_profile"):
                    add_tool(ct)

        return selected_tools[:max_tools]

    async def execute_tool(
        self,
        tool_name: str,
        raw_args: Dict[str, Any],
        context: AgentSecurityContext,
        saga: Optional[AgentSagaOrchestrator] = None,
    ) -> ToolResult:
        """
        Executes a named tool with security context, RBAC verification,
        and saga rollback tracking.
        """
        tool = self.registry.get_tool(tool_name)
        if not tool:
            return ToolResult(
                success=False, error=f"Tool '{tool_name}' not found in registry"
            )

        # In-Memory Self-Healing heuristic correction (<5ms)
        from app.agent.router.self_healer import ToolSelfHealer

        healed_args, was_repaired, repairs = ToolSelfHealer.auto_repair_args(
            args_schema=tool.args_schema,
            raw_args=raw_args,
        )

        # Execute through Saga if provided, otherwise directly via tool.call()
        try:
            if saga:
                return await saga.execute_tool_in_saga(tool, healed_args, context)
            return await tool.call(healed_args, context)
        except Exception as e:
            logger.exception(f"Execution error in tool '{tool_name}': {e}")
            return ToolResult(
                success=False,
                error=f"Error executing tool '{tool_name}': {str(e)}",
            )

    async def execute_dag_plan(
        self,
        tool_calls: List[Dict[str, Any]],
        context: AgentSecurityContext,
        saga: Optional[AgentSagaOrchestrator] = None,
    ) -> Dict[str, Any]:
        """
        Executes a plan of multiple tool calls using topological DAG parallelization.
        """
        from app.agent.router.dag_planner import SpeculativeDAGPlanner

        dag = SpeculativeDAGPlanner.build_plan_from_tool_calls(
            tool_calls, self.registry
        )
        return await SpeculativeDAGPlanner.execute_dag(dag, context, self, saga)
