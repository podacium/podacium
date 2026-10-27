"""
Pedagogy Engine: 4-Level Pedagogical Hierarchy, DAG Prerequisite Validation & Progression Velocity Analytics.
Conforms to Coursera/edX academic rigor and 1EdTech standards.
"""

import math
from collections import defaultdict, deque
from typing import Dict, List, Set, Tuple, Any, Optional
from pydantic import BaseModel, Field


class PedagogicalNode(BaseModel):
    id: str
    title: str
    level: str = Field(description="PROGRAM, COURSE, MODULE, or LESSON")
    parent_id: Optional[str] = None
    order: int = 0
    estimated_minutes: int = 30
    prerequisites: List[str] = Field(
        default_factory=list, description="IDs of prerequisite nodes"
    )


class PrerequisiteGraphValidator:
    """
    Validates DAG integrity for Course and Lesson prerequisite structures.
    Uses Kahn's Algorithm for topological ordering and cycle detection.
    Time Complexity: O(V + E)
    Space Complexity: O(V + E)
    """

    def __init__(self, node_ids: List[str], edges: List[Tuple[str, str]]):
        """
        node_ids: List of unique node identifiers
        edges: List of (prerequisite_id, target_id) directed dependencies
        """
        self.nodes = list(set(node_ids))
        self.edges = edges

    def validate_dag(self) -> Tuple[bool, List[str], List[str]]:
        """
        Validates whether the dependency graph is a valid Directed Acyclic Graph (DAG).
        Returns: (is_valid_dag, topological_order, cycle_nodes)
        """
        if not self.nodes:
            return True, [], []

        in_degree: Dict[str, int] = {node: 0 for node in self.nodes}
        adj: Dict[str, List[str]] = defaultdict(list)

        for prereq, target in self.edges:
            if prereq in in_degree and target in in_degree:
                adj[prereq].append(target)
                in_degree[target] += 1

        # Queue nodes with 0 in-degree (root concepts)
        queue = deque([node for node in self.nodes if in_degree[node] == 0])
        topo_order: List[str] = []

        while queue:
            curr = queue.popleft()
            topo_order.append(curr)

            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # If topological ordering includes all nodes, graph is acyclic
        if len(topo_order) == len(self.nodes):
            return True, topo_order, []

        # Graph contains at least one cycle: identify unresolved nodes
        cycle_nodes = [node for node in self.nodes if in_degree[node] > 0]
        return False, [], cycle_nodes


class NodeAccessEvaluator:
    """Evaluates whether a student has unlocked a lesson or module based on prerequisite satisfaction."""

    @staticmethod
    def can_student_access_node(
        target_node_id: str,
        prerequisite_graph: Dict[str, List[str]],
        completed_node_ids: Set[str],
    ) -> Tuple[bool, List[str]]:
        """
        Determines if student can access target node.
        Returns: (is_unlocked, missing_prerequisite_ids)
        """
        direct_prereqs = prerequisite_graph.get(target_node_id, [])
        missing = [
            prereq for prereq in direct_prereqs if prereq not in completed_node_ids
        ]
        if missing:
            return False, missing
        return True, []


class VelocityRecord(BaseModel):
    user_id: int
    completed_effort_minutes: float
    active_days: int = 14


class StudentRetentionNudge(BaseModel):
    user_id: int
    velocity_hours_per_day: float
    cohort_mean_velocity: float
    cohort_std_velocity: float
    z_score: float
    requires_retention_nudge: bool
    recommended_action: str


class ProgressionVelocityAnalytics:
    """
    Analyzes cohort learning velocity over a rolling window.
    Identifies students whose progress velocity drops > 2.5 sigma below cohort mean.
    """

    @staticmethod
    def calculate_cohort_velocity(
        records: List[VelocityRecord],
        window_days: int = 14,
        z_threshold: float = -2.5,
    ) -> Dict[str, Any]:
        """
        Computes student velocities, cohort mean, std dev, and flags at-risk learners.
        """
        if not records:
            return {
                "cohort_size": 0,
                "mean_velocity_hours_per_day": 0.0,
                "std_velocity": 0.0,
                "at_risk_students": [],
            }

        # Velocity in standard curriculum hours per day
        student_velocities: Dict[int, float] = {}
        for r in records:
            eff_days = max(1, r.active_days or window_days)
            hours_per_day = (r.completed_effort_minutes / 60.0) / eff_days
            student_velocities[r.user_id] = hours_per_day

        v_values = list(student_velocities.values())
        n = len(v_values)
        mean_v = sum(v_values) / n

        variance = sum((x - mean_v) ** 2 for x in v_values) / max(1, n - 1)
        std_v = math.sqrt(variance)

        at_risk: List[StudentRetentionNudge] = []
        if std_v > 1e-4:
            for uid, v in student_velocities.items():
                z = (v - mean_v) / std_v
                if z < z_threshold:
                    at_risk.append(
                        StudentRetentionNudge(
                            user_id=uid,
                            velocity_hours_per_day=round(v, 3),
                            cohort_mean_velocity=round(mean_v, 3),
                            cohort_std_velocity=round(std_v, 3),
                            z_score=round(z, 2),
                            requires_retention_nudge=True,
                            recommended_action="WHATSAPP_CONCIERGE_NUDGE",
                        )
                    )

        return {
            "cohort_size": n,
            "mean_velocity_hours_per_day": round(mean_v, 3),
            "std_velocity": round(std_v, 3),
            "at_risk_count": len(at_risk),
            "at_risk_students": [s.model_dump() for s in at_risk],
        }


pedagogy_service = ProgressionVelocityAnalytics()
