"""
services/api/app/agent/router/dag_planner.py
Topological DAG Execution Planner with Speculative Parallel Branch Execution (<200ms).
Transforms multi-step tool calls into parallelizable DAG batches, executing independent
read/analysis branches concurrently with asyncio.gather.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolResult
from app.agent.router.self_healer import ToolSelfHealer
from app.agent.saga.orchestrator import AgentSagaOrchestrator

logger = logging.getLogger("podacium.agent.dag_planner")


class DAGNode(BaseModel):
    node_id: str
    tool_name: str
    raw_args: Dict[str, Any]
    dependencies: List[str] = Field(default_factory=list)
    is_mutating: bool = False
    status: str = "PENDING"  # PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
    result: Optional[ToolResult] = None
    execution_duration_ms: float = 0.0
    healed_repairs: List[str] = Field(default_factory=list)


class ExecutionDAG:
    """
    Directed Acyclic Graph orchestrating multi-tool dependencies and
    computing parallelizable execution batches via topological sort.
    """

    def __init__(self):
        self.nodes: Dict[str, DAGNode] = {}
        self.edges: List[Tuple[str, str]] = []  # (parent_node_id, child_node_id)

    def add_node(self, node: DAGNode) -> None:
        self.nodes[node.node_id] = node

    def add_dependency(self, parent_id: str, child_id: str) -> None:
        if parent_id in self.nodes and child_id in self.nodes:
            self.edges.append((parent_id, child_id))
            if parent_id not in self.nodes[child_id].dependencies:
                self.nodes[child_id].dependencies.append(parent_id)

    def compute_parallel_batches(self) -> List[List[DAGNode]]:
        """
        Groups nodes into sequential execution stages where all nodes within a stage
        have no inter-dependencies and can execute concurrently in parallel (asyncio.gather).
        """
        in_degree: Dict[str, int] = {
            nid: len(node.dependencies) for nid, node in self.nodes.items()
        }
        completed: Set[str] = set()
        batches: List[List[DAGNode]] = []

        while len(completed) < len(self.nodes):
            # Find all nodes with in_degree == 0 among non-completed nodes
            current_batch: List[DAGNode] = [
                node
                for nid, node in self.nodes.items()
                if nid not in completed and in_degree[nid] == 0
            ]

            if not current_batch:
                # Cycle detected or unreachable dependency; break gracefully
                remaining = [
                    node for nid, node in self.nodes.items() if nid not in completed
                ]
                batches.append(remaining)
                break

            batches.append(current_batch)

            # Mark current batch completed and decrement in_degree for dependent children
            for node in current_batch:
                completed.add(node.node_id)
                for parent, child in self.edges:
                    if parent == node.node_id and child in in_degree:
                        in_degree[child] = max(0, in_degree[child] - 1)

        return batches


class SpeculativeDAGPlanner:
    """
    Constructs and executes speculative DAG plans with automatic self-healing.
    """

    @classmethod
    def build_plan_from_tool_calls(
        cls,
        tool_calls: List[Dict[str, Any]],
        registry: Any,
    ) -> ExecutionDAG:
        """
        Parses an incoming list of tool calls into an ExecutionDAG.
        Detects data-flow dependencies based on parameter references ($node_id.data...).
        """
        dag = ExecutionDAG()

        for idx, call in enumerate(tool_calls):
            node_id = call.get("id") or f"step_{idx + 1}"
            tool_name = call.get("name") or call.get("tool_name", "")
            raw_args = call.get("arguments") or call.get("args") or {}

            tool: Optional[BaseTool] = registry.get_tool(tool_name)
            is_mutating = tool.is_mutating if tool else False

            # Scan for explicit dependency tokens (e.g. {{step_1.result...}})
            dependencies: List[str] = []
            args_str = str(raw_args)
            for prev_idx in range(idx):
                prev_id = f"step_{prev_idx + 1}"
                if prev_id in args_str:
                    dependencies.append(prev_id)

            # Rule: Mutating actions on the same entity depend on prior read actions
            if is_mutating and idx > 0 and not dependencies:
                # Chain mutating tools after preceding reads
                prev_node_id = f"step_{idx}"
                dependencies.append(prev_node_id)

            node = DAGNode(
                node_id=node_id,
                tool_name=tool_name,
                raw_args=raw_args,
                dependencies=dependencies,
                is_mutating=is_mutating,
            )
            dag.add_node(node)
            for dep in dependencies:
                dag.add_dependency(dep, node_id)

        return dag

    @classmethod
    async def execute_dag(
        cls,
        dag: ExecutionDAG,
        context: AgentSecurityContext,
        supervisor: Any,
        saga: Optional[AgentSagaOrchestrator] = None,
    ) -> Dict[str, Any]:
        """
        Executes DAG batches with parallel speculative branches and automatic self-healing.
        """
        start_time = time.perf_counter()
        batches = dag.compute_parallel_batches()
        node_outputs: Dict[str, Any] = {}

        async def _execute_single_node(node: DAGNode) -> None:
            node_start = time.perf_counter()
            tool: Optional[BaseTool] = supervisor.registry.get_tool(node.tool_name)

            if not tool:
                node.status = "FAILED"
                node.result = ToolResult(
                    success=False, error=f"Tool '{node.tool_name}' not registered"
                )
                node.execution_duration_ms = (time.perf_counter() - node_start) * 1000
                return

            # Check if any dependencies failed
            failed_deps = [
                dep
                for dep in node.dependencies
                if dag.nodes[dep].status in ("FAILED", "SKIPPED")
            ]
            if failed_deps:
                node.status = "SKIPPED"
                node.result = ToolResult(
                    success=False,
                    error=f"Skipped execution because upstream dependencies failed: {failed_deps}",
                )
                node.execution_duration_ms = (time.perf_counter() - node_start) * 1000
                return

            # 1. In-Memory Self-Healing Dry-Run
            healed_args, was_repaired, repairs = ToolSelfHealer.auto_repair_args(
                args_schema=tool.args_schema,
                raw_args=node.raw_args,
            )
            node.healed_repairs = repairs

            # 2. Execute via Supervisor with Saga tracking
            node.status = "RUNNING"
            try:
                res = await supervisor.execute_tool(
                    tool_name=node.tool_name,
                    raw_args=healed_args,
                    context=context,
                    saga=saga,
                )
                node.result = res
                node.status = "COMPLETED" if res.success else "FAILED"
                if res.success:
                    node_outputs[node.node_id] = res.data
            except Exception as e:
                logger.exception(
                    f"Error executing DAG node {node.node_id} ({node.tool_name}): {e}"
                )
                node.status = "FAILED"
                node.result = ToolResult(success=False, error=str(e))

            node.execution_duration_ms = (time.perf_counter() - node_start) * 1000

        # Execute each topological batch in parallel
        for batch in batches:
            await asyncio.gather(*[_execute_single_node(node) for node in batch])

        total_duration_ms = (time.perf_counter() - start_time) * 1000

        return {
            "success": all(
                n.status == "COMPLETED"
                for n in dag.nodes.values()
                if not n.is_mutating or n.status != "FAILED"
            ),
            "total_duration_ms": round(total_duration_ms, 2),
            "nodes_count": len(dag.nodes),
            "batches_count": len(batches),
            "node_states": {nid: n.model_dump() for nid, n in dag.nodes.items()},
            "outputs": node_outputs,
        }
