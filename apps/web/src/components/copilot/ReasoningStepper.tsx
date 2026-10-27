"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  XCircle,
  Copy,
  Check,
  Terminal,
  Cpu,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system";
import {
  MOTION_GRID_STATES,
  PodaciumMotionGrid,
  PodaciumMotionGridCells,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export interface ToolCallLogItem {
  id?: string;
  name: string;
  status?: "running" | "completed" | "failed";
  arguments?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
}

export interface ReasoningStepperProps {
  isStreaming?: boolean;
  toolCalls?: ToolCallLogItem[];
  activeTool?: string | null;
  durationSeconds?: number;
  thinkingText?: string;
  category?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export function ReasoningStepper({
  isStreaming = false,
  toolCalls = [],
  activeTool = null,
  durationSeconds,
  thinkingText,
  category,
  className,
  defaultExpanded = false,
}: ReasoningStepperProps) {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"stepper" | "logs">("stepper");

  // Timer calculation
  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    return durationSeconds ? durationSeconds * 1000 : 0;
  });
  const elapsedMsRef = useRef(elapsedMs);
  elapsedMsRef.current = elapsedMs;
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now() - elapsedMsRef.current;
      }
      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedMs(Date.now() - startTimeRef.current);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
    }
  }, [isStreaming]);

  const formattedDuration = useMemo(() => {
    if (typeof durationSeconds === "number" && !isStreaming) {
      return `${durationSeconds.toFixed(1)}s`;
    }
    const sec = elapsedMs / 1000;
    return `${sec.toFixed(1)}s`;
  }, [durationSeconds, isStreaming, elapsedMs]);

  // Overall reasoning status
  const hasFailedTool = toolCalls.some((c) => c.status === "failed");
  const isExecutingTools = isStreaming || Boolean(activeTool);

  const statusLabel = useMemo(() => {
    if (isExecutingTools) {
      return t("component.copilot.reasoning.statusThinking");
    }
    if (hasFailedTool) {
      return t("component.copilot.reasoning.statusFailed");
    }
    return t("component.copilot.reasoning.statusCompleted");
  }, [isExecutingTools, hasFailedTool, t]);

  const handleCopyParams = (idx: number, args?: Record<string, unknown>) => {
    if (!args) return;
    navigator.clipboard.writeText(JSON.stringify(args, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Build sequential execution steps
  const steps = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      status: "completed" | "running" | "pending" | "failed";
      detail?: string;
    }> = [];

    // Step 1: Intent Analysis
    list.push({
      id: "step_intent",
      title: t("component.copilot.reasoning.stepIntentAnalysis"),
      status:
        toolCalls.length > 0 || !isStreaming
          ? "completed"
          : isStreaming
            ? "running"
            : "completed",
      detail: category ? `Domain: ${category}` : undefined,
    });

    // Step 2..N: Tool executions
    toolCalls.forEach((tc, idx) => {
      const isCurrentActive =
        activeTool === tc.name && isStreaming && tc.status !== "completed";
      list.push({
        id: `step_tool_${idx}`,
        title: `${t("component.copilot.reasoning.stepToolExecution")}: ${tc.name}`,
        status:
          tc.status === "failed"
            ? "failed"
            : tc.status === "completed"
              ? "completed"
              : isCurrentActive || tc.status === "running"
                ? "running"
                : "completed",
        detail: tc.arguments ? Object.keys(tc.arguments).join(", ") : undefined,
      });
    });

    // If activeTool is set but not yet in toolCalls list
    if (
      activeTool &&
      !toolCalls.some((tc) => tc.name === activeTool) &&
      isStreaming
    ) {
      list.push({
        id: "step_active_tool",
        title: `${t("component.copilot.reasoning.stepToolExecution")}: ${activeTool}`,
        status: "running",
      });
    }

    // Final Step: Synthesis
    list.push({
      id: "step_synthesis",
      title: t("component.copilot.reasoning.stepSynthesis"),
      status: isStreaming
        ? toolCalls.length > 0 && !activeTool
          ? "running"
          : "pending"
        : hasFailedTool
          ? "failed"
          : "completed",
    });

    return list;
  }, [toolCalls, isStreaming, activeTool, category, hasFailedTool, t]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/70 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden text-xs transition-all shadow-xs my-2.5",
        isStreaming && "border-blue-500/40 bg-blue-500/5",
        hasFailedTool && "border-destructive/30 bg-destructive/5",
        className,
      )}
    >
      {/* Header Bar / Collapsible Trigger */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-secondary/30 dark:bg-slate-800/30 border-b border-border/60">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 text-foreground hover:text-primary transition-colors cursor-pointer text-start flex-1"
          aria-expanded={isExpanded}
        >
          {/* Activity glyph: a live dot-matrix when tools run, a calm dot otherwise */}
          <div className="relative flex h-4 w-4 items-center justify-center shrink-0">
            {isExecutingTools ? (
              <PodaciumMotionGrid
                key={activeTool ? "busy" : "thinking"}
                frames={
                  activeTool
                    ? MOTION_GRID_STATES.busy.frames
                    : MOTION_GRID_STATES.thinking.frames
                }
                interval={
                  activeTool
                    ? MOTION_GRID_STATES.busy.interval
                    : MOTION_GRID_STATES.thinking.interval
                }
                cellSize={2}
                gap={1.5}
                className="text-primary"
              >
                <PodaciumMotionGridCells />
              </PodaciumMotionGrid>
            ) : (
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2.5 w-2.5 transition-all",
                  !hasFailedTool &&
                    "bg-emerald-500 shadow-xs shadow-emerald-500/30",
                  hasFailedTool &&
                    "bg-destructive shadow-xs shadow-destructive/30",
                )}
              />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              {t("component.copilot.reasoning.title")}
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              • {statusLabel}
            </span>
          </div>
        </button>

        {/* Right Info: Duration Timer + Expand toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <PodaciumBadge
            variant={isExecutingTools ? "outline" : "secondary"}
            className="font-mono text-[10px] px-2 py-0.5 h-5 bg-background/80"
          >
            {formattedDuration}
          </PodaciumBadge>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-expanded={isExpanded}
            title={
              isExpanded
                ? t("component.copilot.reasoning.hideLogs")
                : t("component.copilot.reasoning.showLogs")
            }
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Drawer Body */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 animate-in fade-in-50 duration-200">
          {/* Navigation Sub-Tabs */}
          <div
            role="tablist"
            aria-label={t("component.copilot.reasoning.title")}
            className="flex items-center gap-1 border-b border-border/50 pb-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "stepper"}
              onClick={() => setActiveTab("stepper")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                activeTab === "stepper"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              {t("component.copilot.reasoning.title")}
            </button>
            {toolCalls.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "logs"}
                onClick={() => setActiveTab("logs")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                  activeTab === "logs"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <Terminal className="h-3 w-3" />
                <span>
                  {t("component.copilot.reasoning.logsCount", {
                    count: toolCalls.length,
                  })}
                </span>
              </button>
            )}
          </div>

          {/* Stepper View */}
          {activeTab === "stepper" && (
            <div className="space-y-2 relative before:absolute before:start-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-start gap-3 relative z-10 text-xs"
                >
                  {/* Status Icon */}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border/90 shrink-0 shadow-xs">
                    {step.status === "running" && (
                      <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                    )}
                    {step.status === "completed" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {step.status === "failed" && (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {step.status === "pending" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 pt-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          step.status === "running" &&
                            "text-blue-600 dark:text-blue-400 font-semibold",
                          step.status === "completed" && "text-foreground",
                          step.status === "failed" &&
                            "text-destructive font-semibold",
                          step.status === "pending" &&
                            "text-muted-foreground/70",
                        )}
                      >
                        {step.title}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">
                        {step.status === "running" &&
                          t("component.copilot.reasoning.running")}
                        {step.status === "completed" &&
                          t("component.copilot.reasoning.done")}
                        {step.status === "failed" &&
                          t("component.copilot.reasoning.failed")}
                      </span>
                    </div>

                    {step.detail && (
                      <p className="text-[11px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Optional thinking text snippet */}
              {thinkingText && (
                <div className="mt-3 p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                  {thinkingText}
                </div>
              )}
            </div>
          )}

          {/* DM Mono Tool Logs View */}
          {activeTab === "logs" && (
            <div className="space-y-2.5">
              {toolCalls.map((tc, idx) => (
                <div
                  key={tc.id || idx}
                  className="rounded-xl border border-border/80 bg-slate-950 text-slate-100 p-3 font-mono text-xs space-y-2 shadow-inner"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Terminal className="h-3 w-3" />
                      <span className="font-semibold">{tc.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                          tc.status === "completed" &&
                            "bg-emerald-500/20 text-emerald-300",
                          tc.status === "running" &&
                            "bg-blue-500/20 text-blue-300 animate-pulse",
                          tc.status === "failed" &&
                            "bg-destructive/20 text-destructive",
                        )}
                      >
                        {tc.status || "completed"}
                      </span>

                      {tc.arguments && (
                        <button
                          type="button"
                          onClick={() => handleCopyParams(idx, tc.arguments)}
                          className="text-slate-400 hover:text-white transition-colors p-1"
                          title={t("component.copilot.reasoning.copyParams")}
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input parameters */}
                  {tc.arguments && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        {t("component.copilot.reasoning.toolInput")}:
                      </div>
                      <pre className="text-[11px] text-slate-300 bg-slate-900/90 p-2 rounded-lg overflow-x-auto">
                        {JSON.stringify(tc.arguments, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Tool execution output */}
                  {tc.result !== undefined && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        {t("component.copilot.reasoning.toolOutput")}:
                      </div>
                      <pre className="text-[11px] text-emerald-300 bg-slate-900/90 p-2 rounded-lg overflow-x-auto max-h-36">
                        {typeof tc.result === "object"
                          ? JSON.stringify(tc.result, null, 2)
                          : String(tc.result)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReasoningStepper;
