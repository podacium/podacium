"use client";

import React from "react";
import { useTranslations } from "@/lib/i18n";
import { WorkflowExecutionState, StepResult } from "./types";
import {
  Terminal,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { PodaciumButton, PodaciumBadge } from "@/components/design-system";

interface WorkflowExecutionLogsProps {
  executionState: WorkflowExecutionState;
  onRunTest: () => void;
  onClearLogs: () => void;
  isRunning?: boolean;
}

export function WorkflowExecutionLogs({
  executionState,
  onRunTest,
  onClearLogs,
  isRunning = false,
}: WorkflowExecutionLogsProps) {
  const t = useTranslations();
  const steps: StepResult[] = Object.values(executionState.stepResults);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
      {/* Terminal Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-semibold text-slate-200">
            {t("developer.workflows.logs.outputTitle")}
          </span>
          <PodaciumBadge
            variant={
              executionState.status === "completed"
                ? "success"
                : executionState.status === "failed"
                  ? "destructive"
                  : executionState.status === "running"
                    ? "warning"
                    : "secondary"
            }
          >
            {executionState.status.toUpperCase()}
          </PodaciumBadge>
        </div>

        <div className="flex items-center gap-2">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={onClearLogs}
            className="text-xs text-slate-400"
          >
            <RotateCcw className="w-3.5 h-3.5 me-1" />{" "}
            {t("developer.workflows.logs.clearBtn")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            onClick={onRunTest}
            disabled={isRunning}
            className="text-xs"
          >
            <Play className="w-3.5 h-3.5 me-1" />{" "}
            {isRunning
              ? t("developer.workflows.logs.executing")
              : t("developer.workflows.logs.testWorkflow")}
          </PodaciumButton>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {executionState.logs.length === 0 ? (
          <div className="text-slate-500 py-6 text-center italic">
            {t("developer.workflows.logs.noLogs")}
          </div>
        ) : (
          <>
            {/* Step execution timeline */}
            {steps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pb-3 border-b border-slate-800">
                {steps.map((step) => (
                  <div
                    key={step.nodeId}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="truncate">
                      <span className="text-[11px] text-slate-300 font-sans truncate block">
                        {t("common.uiLabels.nodePrefix")} {step.nodeId}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {step.durationMs}ms
                      </span>
                    </div>
                    {step.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Line-by-line logs */}
            <div className="space-y-1">
              {executionState.logs.map((log: string, idx: number) => (
                <div key={idx} className="leading-relaxed text-slate-300">
                  <span className="text-slate-500">
                    [{new Date().toLocaleTimeString()}]
                  </span>{" "}
                  {log.includes("FAILED") || log.includes("Error") ? (
                    <span className="text-rose-400">{log}</span>
                  ) : log.includes("SUCCESS") || log.includes("Completed") ? (
                    <span className="text-emerald-400">{log}</span>
                  ) : log.includes("Wasm") || log.includes("transform") ? (
                    <span className="text-purple-400">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
