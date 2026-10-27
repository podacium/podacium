import { describe, it, expect } from "vitest";
import { detectCyclesAndTopologicalSort } from "./graphAlgorithms";
import { computeCubicBezierPath } from "./bezierMath";
import { WorkflowNode, WorkflowEdge } from "./types";

describe("Workflow DAG Algorithms & Math", () => {
  it("detects a valid linear DAG and returns topological sort order", () => {
    const nodes: WorkflowNode[] = [
      {
        id: "trigger",
        type: "trigger",
        name: "Trigger",
        position: { x: 0, y: 0 },
      },
      {
        id: "transform",
        type: "action",
        name: "Wasm Transform",
        position: { x: 100, y: 0 },
      },
      {
        id: "webhook",
        type: "action",
        name: "Dispatch Webhook",
        position: { x: 200, y: 0 },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: "e1", source: "trigger", target: "transform" },
      { id: "e2", source: "transform", target: "webhook" },
    ];

    const result = detectCyclesAndTopologicalSort(nodes, edges);

    expect(result.hasCycle).toBe(false);
    expect(result.cycleNodes).toEqual([]);
    expect(result.topologicalOrder).toEqual([
      "trigger",
      "transform",
      "webhook",
    ]);
  });

  it("detects simple 2-node cycle (A -> B -> A)", () => {
    const nodes: WorkflowNode[] = [
      { id: "A", type: "trigger", name: "A", position: { x: 0, y: 0 } },
      { id: "B", type: "action", name: "B", position: { x: 100, y: 0 } },
    ];

    const edges: WorkflowEdge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "A" },
    ];

    const result = detectCyclesAndTopologicalSort(nodes, edges);

    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toContain("A");
    expect(result.cycleNodes).toContain("B");
    expect(result.topologicalOrder).not.toContain("A");
  });

  it("detects indirect 3-node cycle with branch (A -> B -> C -> A)", () => {
    const nodes: WorkflowNode[] = [
      { id: "N1", type: "trigger", name: "N1", position: { x: 0, y: 0 } },
      { id: "N2", type: "action", name: "N2", position: { x: 100, y: 0 } },
      { id: "N3", type: "logic", name: "N3", position: { x: 200, y: 0 } },
    ];

    const edges: WorkflowEdge[] = [
      { id: "e1", source: "N1", target: "N2" },
      { id: "e2", source: "N2", target: "N3" },
      { id: "e3", source: "N3", target: "N1" },
    ];

    const result = detectCyclesAndTopologicalSort(nodes, edges);

    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes.length).toBe(3);
  });

  it("computes smooth cubic Bézier curve paths and midpoints", () => {
    const source = { x: 100, y: 150 };
    const target = { x: 400, y: 250 };

    const curve = computeCubicBezierPath(source, target);

    expect(curve.path).toMatch(/^M 100\.0 150\.0 C/);
    expect(curve.path).toContain("400.0 250.0");
    expect(curve.midX).toBeGreaterThan(100);
    expect(curve.midX).toBeLessThan(400);
    expect(curve.lengthEstimate).toBeGreaterThan(0);
  });
});
