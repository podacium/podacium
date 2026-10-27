"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { HitlDiffInspector } from "./HitlDiffInspector";

export interface ActionIntent {
  intentId: string;
  actionToken: string;
  toolName: string;
  domain?: string;
  riskScore: number;
  parameters: Record<string, any>;
  previousParameters?: Record<string, any> | null;
  summary?: string;
  expiresAt?: string | number;
}

export interface HitlActionCardProps {
  intent: ActionIntent;
  onApprove?: (intent: ActionIntent) => Promise<void> | void;
  onReject?: (intent: ActionIntent, reason?: string) => Promise<void> | void;
  className?: string;
}

export function HitlActionCard({
  intent,
  onApprove,
  onReject,
  className,
}: HitlActionCardProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<
    | "pending"
    | "approving"
    | "approved"
    | "rejected"
    | "replay_conflict"
    | "error"
  >("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHighRisk =
    intent.riskScore > 0.7 ||
    intent.toolName.includes("refund") ||
    intent.toolName.includes("delete") ||
    intent.toolName.includes("cancel") ||
    intent.toolName.includes("escrow");

  const riskLabel = isHighRisk ? "High Risk" : "Medium Risk";
  const riskBadgeVariant = isHighRisk ? "destructive" : "warning";

  const handleApprove = async () => {
    setStatus("approving");
    setErrorMessage(null);
    try {
      if (onApprove) {
        await onApprove(intent);
      } else {
        // Default execution flow
        const resp = await fetch("/api/v1/agent/execute-confirmed-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent_id: intent.intentId,
            action_token: intent.actionToken,
          }),
        });

        if (resp.status === 409) {
          setStatus("replay_conflict");
          setErrorMessage(t("copilot.hitl.action.replayError"));
          return;
        }

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(
            errData.detail || `Action execution failed (${resp.status})`,
          );
        }
      }
      setStatus("approved");
    } catch (err: any) {
      if (err?.message?.includes("409") || err?.status === 409) {
        setStatus("replay_conflict");
        setErrorMessage(t("copilot.hitl.action.replayError"));
      } else {
        setStatus("error");
        setErrorMessage(err?.message || "Execution failed. Please try again.");
      }
    }
  };

  const handleReject = async () => {
    setStatus("rejected");
    try {
      if (onReject) {
        await onReject(intent, "Rejected by user");
      }
    } catch {
      // User reject notification error can be silent
    }
  };

  return (
    <div
      data-testid="hitl-action-card"
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-md transition-all overflow-hidden",
        isHighRisk
          ? "border-red-300 dark:border-red-900/60 shadow-red-500/5"
          : "border-amber-300 dark:border-amber-900/60 shadow-amber-500/5",
        className,
      )}
    >
      {/* Card Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isHighRisk
            ? "bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-900/50"
            : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50",
        )}
      >
        <div className="flex items-center gap-2">
          {isHighRisk ? (
            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {t("copilot.hitl.action.confirmationRequired", {
                toolName: intent.toolName,
              })}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("copilot.hitl.action.intentHash", {
                  id: intent.intentId.slice(0, 8),
                })}
              </span>
              {intent.domain && <span>• {intent.domain}</span>}
            </div>
          </div>
        </div>

        <PodaciumBadge
          data-testid="hitl-risk-badge"
          variant={riskBadgeVariant}
          className="uppercase tracking-wider text-[10px] font-bold px-2 py-0.5"
        >
          {riskLabel.toUpperCase()} ({Math.round(intent.riskScore * 100)}%)
        </PodaciumBadge>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3">
        {intent.summary && (
          <p className="text-sm text-foreground/90 font-medium">
            {intent.summary}
          </p>
        )}

        {/* Visual Diff Inspector */}
        <HitlDiffInspector
          before={intent.previousParameters || {}}
          after={intent.parameters}
          title={t("copilot.hitl.action.proposedChangesTitle")}
        />

        {/* Status Feedbacks */}
        {status === "approved" && (
          <div
            data-testid="hitl-success-banner"
            className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-emerald-800 dark:text-emerald-200 text-xs font-medium"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{t("copilot.hitl.action.actionApproved")}</span>
          </div>
        )}

        {status === "replay_conflict" && (
          <div
            data-testid="hitl-conflict-banner"
            className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-red-800 dark:text-red-200 text-xs font-medium"
          >
            <RotateCcw className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === "rejected" && (
          <div
            data-testid="hitl-rejected-banner"
            className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-border p-3 text-muted-foreground text-xs font-medium"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{t("copilot.hitl.action.actionRejected")}</span>
          </div>
        )}

        {status === "error" && (
          <div
            data-testid="hitl-error-banner"
            className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-red-800 dark:text-red-200 text-xs font-medium"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        {(status === "pending" || status === "approving") && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <PodaciumButton
              data-testid="hitl-reject-btn"
              variant="outline"
              size="sm"
              disabled={status === "approving"}
              onClick={handleReject}
            >
              {t("copilot.hitl.action.rejectBtn")}
            </PodaciumButton>
            <PodaciumButton
              data-testid="hitl-approve-btn"
              variant={isHighRisk ? "destructive" : "primary"}
              size="sm"
              loading={status === "approving"}
              onClick={handleApprove}
            >
              {t("copilot.hitl.action.approveBtn")}
            </PodaciumButton>
          </div>
        )}
      </div>
    </div>
  );
}

export default HitlActionCard;
