"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  GitFork,
  ArrowDown,
  Terminal,
  Cpu,
  Eye,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { WorkflowDagArtifact, WorkflowDagNode } from "@/types/copilot";

export interface WorkflowDagViewerProps {
  artifact: WorkflowDagArtifact;
  onEmitPrompt?: (prompt: string) => void;
  onNodeSelect?: (nodeId: string) => void;
}

export function WorkflowDagViewer({
  artifact,
  onEmitPrompt,
  onNodeSelect,
}: WorkflowDagViewerProps) {
  const { t } = useTranslations();
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    artifact.currentStepId || artifact.nodes[0]?.id || "",
  );

  useEffect(() => {
    if (artifact.currentStepId) {
      setSelectedNodeId(artifact.currentStepId);
    }
  }, [artifact.currentStepId]);

  const selectedNode = artifact.nodes.find((n) => n.id === selectedNodeId);
  const completedCount = artifact.nodes.filter(
    (n) => n.status === "completed",
  ).length;
  const runningNode = artifact.nodes.find((n) => n.status === "running");

  const handleSelectNode = (node: WorkflowDagNode) => {
    setSelectedNodeId(node.id);
    onNodeSelect?.(node.id);
  };

  const getStatusIcon = (status: WorkflowDagNode["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "pending":
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: WorkflowDagNode["status"]) => {
    switch (status) {
      case "completed":
        return (
          <PodaciumBadge variant="success" className="text-[10px]">
            {t("component.copilot.dag.completed")}
          </PodaciumBadge>
        );
      case "running":
        return (
          <PodaciumBadge
            variant="default"
            className="text-[10px] animate-pulse"
          >
            {t("component.copilot.dag.running")}
          </PodaciumBadge>
        );
      case "failed":
        return (
          <PodaciumBadge variant="destructive" className="text-[10px]">
            {t("component.copilot.dag.failed")}
          </PodaciumBadge>
        );
      case "pending":
      default:
        return (
          <PodaciumBadge
            variant="outline"
            className="text-[10px] text-muted-foreground"
          >
            {t("component.copilot.dag.pending")}
          </PodaciumBadge>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <GitFork className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground tracking-tight">
              {artifact.title || t("component.copilot.dag.title")}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {t("component.copilot.dag.stepsProgress", {
                completed: completedCount,
                total: artifact.nodes.length,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {runningNode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{runningNode.label}</span>
            </div>
          )}
          <PodaciumBadge variant="outline" className="font-mono text-xs">
            {Math.round((completedCount / (artifact.nodes.length || 1)) * 100)}%
          </PodaciumBadge>
        </div>
      </div>

      {/* Main DAG Canvas and Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Nodes Visual Flow Column */}
        <div className="lg:col-span-2 space-y-3 relative">
          {artifact.nodes.map((node, index) => {
            const isSelected = node.id === selectedNodeId;
            const isRunning = node.status === "running";
            const outgoingEdge = artifact.edges.find((e) => e.from === node.id);
            const isEdgeAnimated = outgoingEdge?.animated ?? isRunning;

            return (
              <div
                key={node.id}
                className="relative flex flex-col items-center"
              >
                {/* Node Card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectNode(node)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleSelectNode(node);
                  }}
                  className={cn(
                    "w-full cursor-pointer transition-all duration-200 text-start rounded-xl border p-4 bg-card hover:border-primary/50 relative group",
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-md shadow-primary/10 bg-primary/5"
                      : "border-border/80 hover:shadow-xs",
                    isRunning &&
                      "border-primary/60 shadow-sm shadow-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(node.status)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-muted-foreground">
                            #{node.stepNumber ?? index + 1}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {node.label}
                          </span>
                        </div>
                        {node.toolName && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground font-mono">
                            <Terminal className="h-3 w-3 text-primary/70" />
                            <span>{node.toolName}</span>
                            {node.durationMs !== undefined && (
                              <>
                                <span>•</span>
                                <span>{node.durationMs}ms</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>{getStatusBadge(node.status)}</div>
                  </div>
                </div>

                {/* Animated Edge connector to next step if not last */}
                {index < artifact.nodes.length - 1 && (
                  <div className="my-1.5 flex flex-col items-center justify-center relative w-full h-7">
                    <svg
                      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="50%"
                        y1="0"
                        x2="50%"
                        y2="100%"
                        className={cn(
                          "stroke-border transition-colors",
                          isEdgeAnimated && "stroke-primary",
                        )}
                        strokeWidth="2"
                        strokeDasharray={isEdgeAnimated ? "4 4" : undefined}
                      >
                        {isEdgeAnimated && (
                          <animate
                            attributeName="stroke-dashoffset"
                            values="8;0"
                            dur="0.8s"
                            repeatCount="indefinite"
                          />
                        )}
                      </line>
                    </svg>
                    <div
                      className={cn(
                        "z-10 rounded-full p-0.5 bg-background border",
                        isEdgeAnimated
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Drawer */}
        <div className="space-y-4">
          <PodaciumCard className="p-4 border border-border h-full flex flex-col justify-between">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {t("component.copilot.dag.nodeDetails")}
                    </span>
                  </div>
                  {getStatusBadge(selectedNode.status)}
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("component.copilot.dag.stepLabel")}
                  </div>
                  <div className="text-xs font-medium text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
                    {selectedNode.label}
                  </div>
                </div>

                {selectedNode.toolName && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {t("component.copilot.dag.toolExecuted")}
                    </div>
                    <div className="text-xs font-mono text-foreground bg-secondary/50 p-2.5 rounded-lg border border-border/60 flex items-center justify-between">
                      <span>{selectedNode.toolName}</span>
                      {selectedNode.durationMs !== undefined && (
                        <span className="text-muted-foreground text-[10px]">
                          {selectedNode.durationMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode.details && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {t("component.copilot.dag.outputLogs")}
                    </div>
                    <pre className="text-[11px] font-mono text-muted-foreground bg-slate-950 text-slate-200 p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {selectedNode.details}
                    </pre>
                  </div>
                )}

                {onEmitPrompt && (
                  <div className="pt-2">
                    <PodaciumButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onEmitPrompt(
                          `Explique l'étape #${selectedNode.stepNumber ?? 1} (${selectedNode.label}) et propose une optimisation pour le workflow.`,
                        )
                      }
                      className="w-full text-xs gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{t("component.copilot.dag.askExplanation")}</span>
                    </PodaciumButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                {t("component.copilot.dag.selectPrompt")}
              </div>
            )}
          </PodaciumCard>
        </div>
      </div>
    </div>
  );
}
