export type WorkflowNodeType = "trigger" | "action" | "logic";

export type TriggerKind =
  | "contract.created"
  | "milestone.delivered"
  | "payment.received"
  | "course.completed";

export type ActionKind =
  | "send.whatsapp"
  | "create.ticket"
  | "generate.invoice"
  | "execute.webhook"
  | "execute_webhook"
  | "wasm_transform"
  | "send_whatsapp_alert"
  | "generate_anae_invoice"
  | "create_support_ticket";

export type LogicKind =
  | "filter.condition"
  | "delay.timer"
  | "split.branch"
  | "filter"
  | "delay"
  | "branch";

export type NodeKind = TriggerKind | ActionKind | LogicKind | string;

export type NodeExecutionStatus = "idle" | "running" | "completed" | "failed";

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  kind?: NodeKind;
  name?: string;
  label?: string;
  description?: string;
  triggerType?: string;
  actionType?: string;
  position: WorkflowNodePosition;
  x?: number;
  y?: number;
  status?: NodeExecutionStatus;
  config?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface CycleValidationResult {
  hasCycle: boolean;
  cycleNodes: string[];
  topologicalOrder: string[];
  message: string;
}

export interface ExecutionLogItem {
  id: string;
  nodeId: string;
  nodeLabel: string;
  status: "started" | "success" | "error";
  message: string;
  durationMs?: number;
  timestamp: string;
}

export interface StepResult {
  nodeId: string;
  status: "completed" | "failed" | "running" | "pending";
  durationMs?: number;
  output?: Record<string, any>;
  error?: string;
}

export interface WorkflowExecutionState {
  status: "idle" | "running" | "completed" | "failed";
  stepResults: Record<string, StepResult>;
  logs: string[];
}
