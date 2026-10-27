/**
 * Type definitions for Podacium Agent Streaming Wire Protocol (PUSP v1)
 * and client-side conversational message state.
 */

export interface StreamTokenFrame {
  type: "token";
  token: string;
}

export interface StreamToolCallFrame {
  type: "tool_call";
  tool_call: {
    name: string;
    id?: string;
    status?: "running" | "completed" | "failed";
    arguments?: Record<string, unknown>;
  };
}

export interface StreamWidgetFrame {
  type: "widget";
  widget: {
    widgetType: string;
    props?: Record<string, unknown>;
    id?: string;
    [key: string]: unknown;
  };
}

export interface ActionConfirmationPayload {
  intent_id: string;
  token: string;
  tool_name: string;
  prepared_params: Record<string, unknown>;
  risk_score: number;
  expires_at?: number;
  expires_at_unix?: number;
  description?: string;
  is_mutating?: boolean;
  widgetType?: string;
}

export interface StreamActionConfirmationFrame {
  type: "action_confirmation";
  action_confirmation: ActionConfirmationPayload;
}

export interface CanvasSyncPayload {
  artifact_id: string;
  type: "code" | "markdown" | "table" | "form";
  title: string;
  content: string;
  language?: string;
}

export interface StreamCanvasSyncFrame {
  type: "canvas_sync";
  canvas_sync: CanvasSyncPayload;
}

export interface StreamDoneFrame {
  type: "done";
  done: true;
  session_id: string;
  domain?: string;
  tools_executed?: string[];
  engine?: string;
  category?: string;
  tokens_used?: {
    prompt: number;
    completion: number;
  };
}

export interface StreamErrorFrame {
  type: "error";
  code: string;
  message: string;
}

export type StreamFrame =
  | StreamTokenFrame
  | StreamToolCallFrame
  | StreamWidgetFrame
  | StreamActionConfirmationFrame
  | StreamCanvasSyncFrame
  | StreamDoneFrame
  | StreamErrorFrame;

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "streaming" | "completed" | "error" | "stopped";
  toolCalls?: Array<{
    name: string;
    status?: "running" | "completed" | "failed";
    arguments?: Record<string, unknown>;
  }>;
  widget?: StreamWidgetFrame["widget"] | ActionConfirmationPayload;
  widgets?: Array<StreamWidgetFrame["widget"] | ActionConfirmationPayload>;
  actionConfirmation?: ActionConfirmationPayload;
  canvasArtifact?: CanvasSyncPayload;
  isStreaming?: boolean;
  stopped?: boolean;
  category?: string;
  error?: string;
}
