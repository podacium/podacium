"use client";

import React, { useState, useMemo } from "react";
import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowExecutionState,
} from "./types";
import { detectCyclesAndTopologicalSort } from "./graphAlgorithms";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowStepDrawer } from "./WorkflowStepDrawer";
import { WorkflowExecutionLogs } from "./WorkflowExecutionLogs";
import {
  Save,
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
} from "lucide-react";
import { PodaciumButton } from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: "trigger_contract",
    type: "trigger",
    name: "Contract Signed",
    triggerType: "contract.created",
    position: { x: 50, y: 140 },
    config: {},
  },
  {
    id: "action_wasm",
    type: "action",
    name: "Extism Payload Transformer",
    actionType: "wasm_transform",
    position: { x: 380, y: 140 },
    config: {
      transformScript:
        "function transform(payload) {\n  return {\n    invoice_ref: 'ANAE-' + payload.id,\n    amount_dzd: payload.amount,\n    deductible_shield_169: true\n  };\n}",
    },
  },
  {
    id: "action_webhook",
    type: "action",
    name: "Dispatch Standard Webhook",
    actionType: "execute_webhook",
    position: { x: 710, y: 140 },
    config: {
      url: "https://api.partner.dz/v1/invoices/podacium",
    },
  },
];

const INITIAL_EDGES: WorkflowEdge[] = [
  {
    id: "e1",
    source: "trigger_contract",
    target: "action_wasm",
  },
  {
    id: "e2",
    source: "action_wasm",
    target: "action_webhook",
  },
];

export function WorkflowBuilder() {
  const t = useTranslations();
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<WorkflowEdge[]>(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionState, setExecutionState] = useState<WorkflowExecutionState>({
    status: "idle",
    stepResults: {},
    logs: [],
  });

  // Real-time topological sort & cycle detection (O(V+E))
  const { hasCycle, cycleNodes, topologicalOrder } = useMemo(() => {
    return detectCyclesAndTopologicalSort(nodes, edges);
  }, [nodes, edges]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const handleAddNode = (type: WorkflowNodeType, actionType?: string) => {
    const newId = `node_${Date.now()}`;
    const xPos = 80 + (nodes.length % 3) * 320;
    const yPos = 80 + Math.floor(nodes.length / 3) * 160;

    let defaultName = "New Step";
    if (type === "trigger") defaultName = "Incoming Event Trigger";
    else if (actionType === "wasm_transform")
      defaultName = "Wasm Data Transform";
    else if (actionType === "execute_webhook") defaultName = "Outbound Webhook";
    else if (type === "logic") defaultName = "Branch / Filter Condition";

    const newNode: WorkflowNode = {
      id: newId,
      type,
      name: defaultName,
      actionType,
      position: { x: xPos, y: yPos },
      config: {},
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  const handleUpdateNode = (updated: WorkflowNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Run topological simulation test
  const handleRunTest = async () => {
    if (hasCycle) {
      alert(t("developer.workflows.builder.cycleAlert"));
      return;
    }

    setIsRunning(true);
    setExecutionState({
      status: "running",
      stepResults: {},
      logs: [
        `Starting DAG pipeline dry-run...`,
        `Topological execution order computed: [${topologicalOrder.join(" -> ")}]`,
      ],
    });

    for (let i = 0; i < topologicalOrder.length; i++) {
      const stepId = topologicalOrder[i];
      const node = nodes.find((n) => n.id === stepId);
      if (!node) continue;

      // Simulate step latency
      const duration = Math.floor(Math.random() * 25) + 12;
      await new Promise((res) => setTimeout(res, 300));

      setExecutionState((prev) => ({
        ...prev,
        stepResults: {
          ...prev.stepResults,
          [stepId]: {
            nodeId: stepId,
            status: "completed",
            durationMs: duration,
            output: { status: "ok", timestamp: new Date().toISOString() },
          },
        },
        logs: [
          ...prev.logs,
          `Step "${node.name}" (${node.type}:${node.actionType || node.triggerType || ""}) executed successfully in ${duration}ms`,
        ],
      }));
    }

    setExecutionState((prev) => ({
      ...prev,
      status: "completed",
      logs: [
        ...prev.logs,
        `Workflow DAG execution finished successfully across ${topologicalOrder.length} steps.`,
      ],
    }));
    setIsRunning(false);
  };

  const handleClearLogs = () => {
    setExecutionState({
      status: "idle",
      stepResults: {},
      logs: [],
    });
  };

  const handleExportDAG = () => {
    const dagData = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([dagData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `podacium_workflow_dag_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDAG = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
          }
        } catch (err) {
          alert(t("developer.workflows.builder.invalidJsonAlert"));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {t("developer.workflows.builder.orchestratorTitle")}
          </h2>
          <p className="text-xs text-slate-400">
            {t("developer.workflows.builder.orchestratorDesc")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleExportDAG}
            className="text-xs text-slate-300"
            title={t("developer.workflows.builder.exportJsonTitle")}
          >
            <Download className="w-3.5 h-3.5 me-1" />{" "}
            {t("developer.workflows.builder.exportJsonBtn")}
          </PodaciumButton>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleImportDAG}
            className="text-xs text-slate-300"
            title={t("developer.workflows.builder.importJsonTitle")}
          >
            <Upload className="w-3.5 h-3.5 me-1" />{" "}
            {t("developer.workflows.builder.importJsonBtn")}
          </PodaciumButton>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleRunTest}
            disabled={isRunning || hasCycle}
            className="text-xs"
          >
            <Play className="w-4 h-4 me-1.5 text-emerald-400" />
            {t("developer.workflows.builder.dryRunBtn")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            disabled={hasCycle}
            className="text-xs"
          >
            <Save className="w-4 h-4 me-1.5" />
            {t("developer.workflows.builder.deployBtn")}
          </PodaciumButton>
        </div>
      </div>

      {/* Visual Canvas */}
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        executionState={executionState}
        hasCycle={hasCycle}
        cycleNodes={cycleNodes}
        onSelectNode={setSelectedNodeId}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onAddNode={handleAddNode}
      />

      {/* Slide-Over Step Config Drawer */}
      <WorkflowStepDrawer
        node={selectedNode}
        isOpen={Boolean(selectedNodeId)}
        onClose={() => setSelectedNodeId(null)}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
      />

      {/* Live Logs Terminal */}
      <WorkflowExecutionLogs
        executionState={executionState}
        onRunTest={handleRunTest}
        onClearLogs={handleClearLogs}
        isRunning={isRunning}
      />
    </div>
  );
}
