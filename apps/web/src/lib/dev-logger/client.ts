import type { DevErrorType, DevLogPayload } from "./types";

let isInitialized = false;
const recentErrorTimestamps = new Map<string, number>();
const DEDUPE_WINDOW_MS = 1500;

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function safeSerialize(arg: unknown): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
  }
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg, getCircularReplacer(), 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  };
}

export function sendDevLog(payload: DevLogPayload): void {
  if (!isDev() || typeof window === "undefined") return;

  const dedupeKey = `${payload.type}:${payload.message}:${(payload.stack || "").slice(0, 80)}`;
  const now = Date.now();
  const lastTime = recentErrorTimestamps.get(dedupeKey);

  if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
    return;
  }
  recentErrorTimestamps.set(dedupeKey, now);

  if (recentErrorTimestamps.size > 100) {
    for (const [key, timestamp] of recentErrorTimestamps.entries()) {
      if (now - timestamp > 10000) {
        recentErrorTimestamps.delete(key);
      }
    }
  }

  const enrichedPayload: DevLogPayload = {
    ...payload,
    url:
      payload.url ||
      (typeof window !== "undefined" ? window.location.href : undefined),
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  try {
    const body = JSON.stringify(enrichedPayload);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/dev-logger", blob);
      if (sent) return;
    }

    fetch("/api/dev-logger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Best-effort: ignore if server is reloading
    });
  } catch {
    // Prevent logging crashes from escalating
  }
}

export function reportDevError(options: {
  type: DevErrorType;
  message: string;
  error?: Error | unknown;
  stack?: string;
  componentStack?: string;
  details?: Record<string, unknown>;
  source?: { file?: string; line?: number; col?: number };
}): void {
  if (!isDev()) return;

  let stack = options.stack;
  if (!stack && options.error instanceof Error) {
    stack = options.error.stack;
  }

  sendDevLog({
    type: options.type,
    message: options.message,
    stack,
    componentStack: options.componentStack,
    details: options.details,
    source: options.source,
  });
}

export function initDevErrorReporter(): () => void {
  if (!isDev() || typeof window === "undefined" || isInitialized) {
    return () => {};
  }

  isInitialized = true;

  const originalConsoleError = window.console.error;
  const originalConsoleWarn = window.console.warn;

  window.console.error = (...args: unknown[]) => {
    try {
      originalConsoleError.apply(window.console, args);
    } catch {
      // Ignore console invocation error
    }

    const message = args.map(safeSerialize).join(" ");
    if (
      message.includes("Download the React DevTools") ||
      message.includes("[Fast Refresh]") ||
      message.includes("Extra attributes from the server")
    ) {
      return;
    }

    let stack: string | undefined;
    const firstError = args.find((a) => a instanceof Error) as
      Error | undefined;
    if (firstError?.stack) {
      stack = firstError.stack;
    } else {
      const err = new Error();
      stack = err.stack?.split("\n").slice(2).join("\n");
    }

    sendDevLog({
      type: "console.error",
      message,
      stack,
    });
  };

  window.console.warn = (...args: unknown[]) => {
    try {
      originalConsoleWarn.apply(window.console, args);
    } catch {
      // Ignore console invocation error
    }

    const message = args.map(safeSerialize).join(" ");
    if (
      message.includes("[Fast Refresh]") ||
      message.includes("React Router")
    ) {
      return;
    }

    sendDevLog({
      type: "console.warn",
      message,
    });
  };

  const handleErrorEvent = (event: ErrorEvent) => {
    const error = event.error;
    const message =
      event.message ||
      (error instanceof Error ? error.message : "Uncaught runtime error");
    const stack = error instanceof Error ? error.stack : undefined;

    sendDevLog({
      type: "runtime_error",
      message,
      stack,
      source: {
        file: event.filename,
        line: event.lineno,
        col: event.colno,
      },
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let message = "Unhandled Promise Rejection";
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === "string") {
      message = reason;
    } else if (reason !== null && typeof reason === "object") {
      message = safeSerialize(reason);
    }

    sendDevLog({
      type: "unhandled_rejection",
      message,
      stack,
    });
  };

  window.addEventListener("error", handleErrorEvent);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.console.error = originalConsoleError;
    window.console.warn = originalConsoleWarn;
    window.removeEventListener("error", handleErrorEvent);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    isInitialized = false;
  };
}
