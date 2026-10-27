"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  PodaciumButton,
  PodaciumCard,
  PodaciumBadge,
} from "@/components/design-system";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import type { ActionReviewArtifact } from "@/types/copilot";

export interface ActionReviewArtifactViewerProps {
  artifact: ActionReviewArtifact;
  onConfirm?: (intentId: string, token: string) => Promise<void>;
}

export function ActionReviewArtifactViewer({
  artifact,
  onConfirm,
}: ActionReviewArtifactViewerProps) {
  const { t } = useTranslations();
  const [status, setStatus] = useState(artifact.status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setStatus("executing");
    setErrorMessage(null);
    try {
      if (onConfirm) {
        await onConfirm(artifact.intentId, artifact.token);
      } else {
        const res = (await api.post("/api/v1/agent/execute-confirmed-action", {
          intent_id: artifact.intentId,
          token: artifact.token,
          idempotency_key: `canvas_exec_${artifact.intentId}_${Date.now()}`,
        })) as { success: boolean; error?: string };

        if (!res.success)
          throw new Error(res.error || "Action execution failed.");
      }
      setStatus("executed");
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Erreur lors de l'exécution");
      setStatus("proposed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("component.copilot.actionReview.title")}
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {t("component.copilot.tool")}: {artifact.toolName}
            </span>
          </div>
        </div>
        <PodaciumBadge
          variant={artifact.riskScore > 0.7 ? "destructive" : "warning"}
        >
          {artifact.riskScore > 0.7
            ? t("component.copilot.actionReview.highRisk")
            : t("component.copilot.actionReview.modifying")}
        </PodaciumBadge>
      </div>

      {/* Detail Card */}
      <PodaciumCard className="p-6 border border-border space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t("component.copilot.actionReview.paramsInspection")}
          </h4>
          <div className="rounded-lg bg-secondary/40 p-4 border border-border/60 divide-y divide-border/50 text-xs">
            {Object.entries(artifact.parameters).map(([key, val]) => (
              <div key={key} className="py-2 flex justify-between items-center">
                <span className="font-medium text-foreground capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-primary font-semibold">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
          {status === "proposed" && (
            <>
              <PodaciumButton
                variant="outline"
                size="default"
                onClick={() => setStatus("rejected" as any)}
                className="text-xs px-4"
              >
                {t("component.copilot.actionReview.rejectAction")}
              </PodaciumButton>
              <PodaciumButton
                variant="primary"
                size="default"
                onClick={handleConfirm}
                className="text-xs px-6"
              >
                {t("component.copilot.actionReview.authorizeAndExecute")}
                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </PodaciumButton>
            </>
          )}

          {status === "executing" && (
            <div className="flex items-center gap-2 text-xs text-primary font-medium py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("component.copilot.actionReview.executing")}</span>
            </div>
          )}

          {status === "executed" && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium py-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("component.copilot.actionReview.success")}</span>
            </div>
          )}

          {(status as string) === "rejected" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium py-2">
              <span>{t("component.copilot.actionReview.rejected")}</span>
            </div>
          )}
        </div>
      </PodaciumCard>
    </div>
  );
}
