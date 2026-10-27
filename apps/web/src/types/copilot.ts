export type ArtifactType =
  | "code_sql"
  | "document_markdown"
  | "bi_visualization"
  | "action_review"
  | "workflow_dag"
  | "camera_ocr";

export interface BaseArtifact {
  id: string;
  title: string;
  type: ArtifactType;
  version: number;
  createdAt: string;
  updatedAt: string;
  isReadOnly?: boolean;
}

export interface SqlArtifact extends BaseArtifact {
  type: "code_sql";
  language: "sql" | "python" | "typescript" | "json";
  code: string;
  datasetId?: number;
  lastExecutionResult?: {
    rowCount: number;
    columns: string[];
    rows: Record<string, unknown>[];
    durationMs: number;
  };
}

export interface DocumentArtifact extends BaseArtifact {
  type: "document_markdown";
  markdown: string;
  category?: "syllabus" | "proposal" | "contract" | "fiscal_shield";
}

export interface BiVisualizationArtifact extends BaseArtifact {
  type: "bi_visualization";
  chartType:
    | "bar"
    | "line"
    | "area"
    | "pie"
    | "table"
    | "wilaya_map"
    | "density_map"
    | "map";
  categoryKey: string;
  data: Record<string, unknown>[];
  metrics: { col: string; alias: string; func: string }[];
  claimCheckUrn?: string;
}

export interface ActionReviewArtifact extends BaseArtifact {
  type: "action_review";
  intentId: string;
  toolName: string;
  token: string;
  parameters: Record<string, unknown>;
  riskScore: number;
  status: "proposed" | "executing" | "executed" | "rejected";
}

export interface WorkflowDagNode {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  stepNumber?: number;
  toolName?: string;
  durationMs?: number;
  details?: string;
}

export interface WorkflowDagEdge {
  from: string;
  to: string;
  animated?: boolean;
}

export interface WorkflowDagArtifact extends BaseArtifact {
  type: "workflow_dag";
  nodes: WorkflowDagNode[];
  edges: WorkflowDagEdge[];
  currentStepId?: string;
}

export interface CameraOcrArtifact extends BaseArtifact {
  type: "camera_ocr";
  capturedImage?: string;
  receiptText?: string;
  receiptType?: "baridimob" | "ccp" | "edahabia" | "general_invoice";
  extractedFields?: Record<string, unknown>;
  confidence?: number;
  status?: "capturing" | "analyzing" | "scanned";
}

export type CanvasArtifact =
  | SqlArtifact
  | DocumentArtifact
  | BiVisualizationArtifact
  | ActionReviewArtifact
  | WorkflowDagArtifact
  | CameraOcrArtifact;
