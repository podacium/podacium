import { NextRequest, NextResponse } from "next/server";
import type { DevErrorType, DevLogPayload } from "@/lib/dev-logger/types";

// ANSI escape codes
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgBlue: "\x1b[44m",
};

interface BadgeConfig {
  title: string;
  badgeBg: string;
  textColor: string;
  icon: string;
}

const BADGES: Record<DevErrorType, BadgeConfig> = {
  runtime_error: {
    title: "FRONTEND RUNTIME ERROR",
    badgeBg: ANSI.bgRed,
    textColor: ANSI.white,
    icon: "🔴",
  },
  react_error: {
    title: "REACT COMPONENT ERROR",
    badgeBg: ANSI.bgMagenta,
    textColor: ANSI.white,
    icon: "⚛️ ",
  },
  unhandled_rejection: {
    title: "UNHANDLED PROMISE REJECTION",
    badgeBg: ANSI.bgRed,
    textColor: ANSI.white,
    icon: "🚨",
  },
  "console.error": {
    title: "BROWSER CONSOLE.ERROR",
    badgeBg: ANSI.bgYellow,
    textColor: "\x1b[30m", // black text on yellow
    icon: "⚠️ ",
  },
  "console.warn": {
    title: "BROWSER CONSOLE.WARN",
    badgeBg: ANSI.bgYellow,
    textColor: "\x1b[30m",
    icon: "🟡",
  },
  query_error: {
    title: "TANSTACK QUERY ERROR",
    badgeBg: ANSI.bgCyan,
    textColor: "\x1b[30m",
    icon: "⚡",
  },
  api_error: {
    title: "API CLIENT ERROR",
    badgeBg: ANSI.bgRed,
    textColor: ANSI.white,
    icon: "🌐",
  },
};

export function formatDevError(payload: DevLogPayload): string {
  const badge = BADGES[payload.type] || {
    title: "FRONTEND LOG",
    badgeBg: ANSI.bgBlue,
    textColor: ANSI.white,
    icon: "ℹ️ ",
  };

  const lines: string[] = [];
  const border = "─".repeat(70);

  lines.push(`\n${ANSI.dim}┌${border}${ANSI.reset}`);
  lines.push(
    `${ANSI.dim}│${ANSI.reset} ${badge.icon} ${badge.badgeBg}${badge.textColor}${ANSI.bold} [${badge.title}] ${ANSI.reset}`,
  );

  // Message
  if (payload.message) {
    const formattedMessage = payload.message.trim();
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}💬 Message:${ANSI.reset} ${ANSI.red}${formattedMessage}${ANSI.reset}`,
    );
  }

  // URL / Page
  if (payload.url) {
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}📍 URL:${ANSI.reset} ${ANSI.cyan}${payload.url}${ANSI.reset}`,
    );
  }

  // Source info
  if (payload.source && (payload.source.file || payload.source.line)) {
    const file = payload.source.file || "unknown";
    const line =
      payload.source.line !== undefined ? `:${payload.source.line}` : "";
    const col =
      payload.source.col !== undefined ? `:${payload.source.col}` : "";
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}📂 Source:${ANSI.reset} ${ANSI.yellow}${file}${line}${col}${ANSI.reset}`,
    );
  }

  // Component Stack
  if (payload.componentStack) {
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}🧩 Component Stack:${ANSI.reset}`,
    );
    const stackLines = payload.componentStack.trim().split("\n");
    for (const stackLine of stackLines.slice(0, 10)) {
      lines.push(
        `${ANSI.dim}│${ANSI.reset}   ${ANSI.magenta}${stackLine.trim()}${ANSI.reset}`,
      );
    }
  }

  // Details
  if (payload.details && Object.keys(payload.details).length > 0) {
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}📊 Details:${ANSI.reset} ${ANSI.yellow}${JSON.stringify(payload.details, null, 2).replace(/\n/g, `\n${ANSI.dim}│${ANSI.reset}   `)}${ANSI.reset}`,
    );
  }

  // JavaScript Stack Trace
  if (payload.stack) {
    lines.push(
      `${ANSI.dim}│${ANSI.reset} ${ANSI.bold}📜 Stack Trace:${ANSI.reset}`,
    );
    const stackLines = payload.stack.trim().split("\n");
    for (const stackLine of stackLines.slice(0, 12)) {
      const isInternal =
        stackLine.includes("node_modules") ||
        stackLine.includes("webpack-internal") ||
        stackLine.includes(".next");
      const color = isInternal ? ANSI.gray : ANSI.white;
      lines.push(
        `${ANSI.dim}│${ANSI.reset}   ${color}${stackLine.trim()}${ANSI.reset}`,
      );
    }
  }

  lines.push(`${ANSI.dim}└${border}${ANSI.reset}\n`);

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const payload = (await request.json()) as DevLogPayload;
    if (!payload || !payload.type) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const formatted = formatDevError(payload);
    // Write directly to stderr so it stands out immediately in terminal
    process.stderr.write(formatted);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process log" },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ status: "ok", service: "dev-logger" });
}
