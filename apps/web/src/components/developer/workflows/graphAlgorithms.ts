import { WorkflowNode, WorkflowEdge, CycleValidationResult } from "./types";

/**
 * Kahn's Algorithm for Topological Sort and Cycle Detection in O(V + E) time.
 * Identifies if the workflow DAG contains directed circular dependencies.
 */
export function detectCycleAndSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): CycleValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  // Filter edges to only valid existing nodes
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  for (const edge of validEdges) {
    const targets = adjList.get(edge.source) ?? [];
    targets.push(edge.target);
    adjList.set(edge.source, targets);

    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Find all nodes with zero in-degree (entry points / roots)
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const topologicalOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    topologicalOrder.push(current);

    const neighbors = adjList.get(current) ?? [];
    for (const neighbor of neighbors) {
      const updatedDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (topologicalOrder.length === nodes.length) {
    return {
      hasCycle: false,
      cycleNodes: [],
      topologicalOrder,
      message: "Valid Directed Acyclic Graph (DAG) with no cycles.",
    };
  }

  // Nodes that never reached in-degree 0 are part of or trapped in a cycle
  const cycleNodes = nodes
    .map((n) => n.id)
    .filter((id) => !topologicalOrder.includes(id));

  return {
    hasCycle: true,
    cycleNodes,
    topologicalOrder: [],
    message: `Infinite loop detected involving ${cycleNodes.length} node(s): ${cycleNodes.join(", ")}`,
  };
}

export const detectCyclesAndTopologicalSort = detectCycleAndSort;
