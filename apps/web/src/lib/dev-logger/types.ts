export type DevErrorType =
  | "runtime_error"
  | "unhandled_rejection"
  | "react_error"
  | "console.error"
  | "console.warn"
  | "query_error"
  | "api_error";

export interface DevLogPayload {
  type: DevErrorType;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  timestamp?: string;
  source?: {
    file?: string;
    line?: number;
    col?: number;
  };
  details?: Record<string, unknown>;
}
