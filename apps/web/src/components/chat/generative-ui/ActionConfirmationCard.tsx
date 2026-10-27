"use client";

import React, { useState, useEffect, useCallback, useId, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Receipt,
  ArrowRight,
  Fingerprint,
  CreditCard,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import type { ActionConfirmationPayload, HITLActionState } from "./types";

export interface ActionConfirmationCardProps {
  payload: ActionConfirmationPayload;
  onExecutionComplete?: (result: {
    status: HITLActionState;
    data?: unknown;
  }) => void;
  className?: string;
  requireBiometrics?: boolean;
}

export function ActionConfirmationCard({
  payload,
  onExecutionComplete,
  className,
  requireBiometrics = false,
}: ActionConfirmationCardProps) {
  const { t } = useTranslations();
  const generatedId = useId();
  const idempotencyKey =
    payload.idempotency_key || `hitl_card_${generatedId}_${Date.now()}`;
  const [state, setState] = useState<HITLActionState>("PENDING");
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricVerified, setBiometricVerified] = useState<boolean>(
    !requireBiometrics && payload.risk_score <= 0.85,
  );
  const [isVerifyingBio, setIsVerifyingBio] = useState(false);

  // Expiration countdown
  useEffect(() => {
    if (state !== "PENDING") return;

    const rawExpires =
      payload.expires_at ??
      payload.expires_at_unix ??
      Math.floor(Date.now() / 1000) + 300;

    const checkExpiration = () => {
      const expiresEpoch =
        rawExpires > 10000000000 ? rawExpires : rawExpires * 1000;
      const nowEpoch = Date.now();
      const remainingSec = Math.max(
        0,
        Math.floor((expiresEpoch - nowEpoch) / 1000),
      );
      setTimeLeftSec(remainingSec);

      if (remainingSec <= 0 && state === "PENDING") {
        setState("EXPIRED");
        onExecutionComplete?.({ status: "EXPIRED" });
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 1000);
    return () => clearInterval(interval);
  }, [payload.expires_at, payload.expires_at_unix, state, onExecutionComplete]);

  // Execute confirmed action via POST
  const handleConfirm = useCallback(async () => {
    if (state !== "PENDING") return;
    if (
      !biometricVerified &&
      (requireBiometrics || payload.risk_score > 0.85)
    ) {
      setErrorMessage(
        t("component.generativeUi.actionConfirmation.biometricVerify"),
      );
      return;
    }

    setState("EXECUTING");
    setErrorMessage(null);

    try {
      const res = (await api.post("/api/v1/agent/execute-confirmed-action", {
        intent_id: payload.intent_id,
        token: payload.token,
        idempotency_key: idempotencyKey,
        biometric_authenticated: biometricVerified,
      })) as { success: boolean; data?: unknown; error?: string };

      if (!res.success) {
        throw new Error(res.error || "L'exécution de l'action a échoué.");
      }

      setState("CONFIRMED");
      onExecutionComplete?.({ status: "CONFIRMED", data: res.data });
    } catch (err: unknown) {
      const msg =
        (err as Error).message || "Erreur lors de l'exécution sécurisée";
      setErrorMessage(msg);
      setState("FAILED");
      onExecutionComplete?.({ status: "FAILED", data: { error: msg } });
    }
  }, [
    state,
    biometricVerified,
    requireBiometrics,
    payload.risk_score,
    payload.intent_id,
    payload.token,
    idempotencyKey,
    onExecutionComplete,
    t,
  ]);

  const handleReject = useCallback(() => {
    setState("REJECTED");
    onExecutionComplete?.({ status: "REJECTED" });
  }, [onExecutionComplete]);

  const handleSimulateBiometricAuth = () => {
    setIsVerifyingBio(true);
    setTimeout(() => {
      setBiometricVerified(true);
      setIsVerifyingBio(false);
      setErrorMessage(null);
    }, 600);
  };

  const formattedTimeLeft = useMemo(() => {
    const mins = Math.floor(timeLeftSec / 60);
    const secs = timeLeftSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, [timeLeftSec]);

  const financialImpact = payload.financial_impact_dzd;
  const isUrgent = timeLeftSec > 0 && timeLeftSec < 60;

  return (
    <PodaciumCard
      className={cn(
        "my-3 w-full max-w-lg border text-sm transition-all overflow-hidden shadow-sm",
        state === "CONFIRMED" && "border-emerald-500/40 bg-emerald-500/5",
        state === "EXPIRED" && "border-muted bg-muted/10 opacity-70",
        state === "PENDING" && "border-amber-500/40 bg-amber-500/5",
        state === "FAILED" && "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      {/* Header Banner */}
      <div
        className={cn(
          "px-4 py-2.5 flex items-center justify-between border-b text-xs font-medium",
          state === "PENDING" &&
            (isUrgent
              ? "bg-destructive/15 border-destructive/30 text-destructive animate-pulse"
              : "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200"),
          state === "EXECUTING" &&
            "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200",
          state === "CONFIRMED" &&
            "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200",
          state === "REJECTED" &&
            "bg-muted/40 border-border text-muted-foreground",
          state === "EXPIRED" &&
            "bg-destructive/10 border-destructive/20 text-destructive",
          state === "FAILED" &&
            "bg-destructive/15 border-destructive/30 text-destructive",
        )}
      >
        <div className="flex items-center gap-2">
          {state === "PENDING" && (
            <ShieldAlert
              className={cn(
                "w-4 h-4 shrink-0",
                isUrgent
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400",
              )}
            />
          )}
          {state === "EXECUTING" && (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}
          {state === "CONFIRMED" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {state === "REJECTED" && (
            <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          {state === "EXPIRED" && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          {state === "FAILED" && (
            <XCircle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {state === "PENDING" &&
              t("component.generativeUi.actionConfirmation.statusPending")}
            {state === "EXECUTING" &&
              t("component.generativeUi.actionConfirmation.statusExecuting")}
            {state === "CONFIRMED" &&
              t("component.generativeUi.actionConfirmation.statusConfirmed")}
            {state === "REJECTED" &&
              t("component.generativeUi.actionConfirmation.statusRejected")}
            {state === "EXPIRED" &&
              t("component.generativeUi.actionConfirmation.statusExpired")}
            {state === "FAILED" &&
              t("component.generativeUi.actionConfirmation.statusFailed")}
          </span>
        </div>

        {state === "PENDING" && (
          <div
            className={cn(
              "flex items-center gap-1 font-mono",
              isUrgent
                ? "text-destructive font-bold"
                : "text-amber-700 dark:text-amber-300",
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formattedTimeLeft}</span>
            {isUrgent && (
              <span className="ms-1 text-[10px] uppercase font-sans">
                ({t("component.generativeUi.actionConfirmation.urgentExpiry")})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-3.5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground text-sm tracking-tight">
              {payload.title ||
                `${t("component.generativeUi.actionConfirmation.actionPrefix")}: ${payload.tool_name}`}
            </h4>
            <PodaciumBadge
              variant={payload.risk_score > 0.7 ? "destructive" : "warning"}
              className="text-[10px]"
            >
              {payload.risk_score > 0.7
                ? t("component.generativeUi.actionConfirmation.highRisk")
                : t("component.generativeUi.actionConfirmation.modifying")}
            </PodaciumBadge>
          </div>
          {payload.summary && (
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              {payload.summary}
            </p>
          )}
        </div>

        {/* Parameters preview table */}
        <div className="rounded-xl bg-secondary/50 dark:bg-slate-800/60 p-3 border border-border/50 space-y-1.5 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            {t("component.generativeUi.actionConfirmation.preparedParams")}
          </div>
          {Object.entries(payload.prepared_params || {}).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center py-0.5">
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}:
              </span>
              <span className="font-mono font-medium text-foreground truncate max-w-[200px]">
                {typeof val === "object" ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>

        {/* Financial Impact & Chargily Pay EDAHABIA / CIB Badges */}
        {typeof financialImpact === "number" && financialImpact > 0 && (
          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-300">
                <Receipt className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {t(
                    "component.generativeUi.actionConfirmation.financialImpact",
                  )}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-primary">
                {financialImpact.toLocaleString()} DZD
              </span>
            </div>

            {/* Chargily Pay Payment Rails Badges */}
            <div className="pt-2 border-t border-blue-200/50 dark:border-blue-900/40 flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>
                  {t("component.generativeUi.actionConfirmation.chargilyPay")}
                </span>
                <div className="flex items-center gap-1">
                  {/* EDAHABIA Badge */}
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold text-[10px] tracking-wider">
                    {t(
                      "component.generativeUi.actionConfirmation.edahabiaBadge",
                    )}
                  </span>
                  {/* CIB Badge */}
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10px] tracking-wider">
                    {t("component.generativeUi.actionConfirmation.cibBadge")}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>
                  {t(
                    "component.generativeUi.actionConfirmation.chargilyPayEscrow",
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Biometric Verification Switch if High Risk */}
        {(requireBiometrics || payload.risk_score > 0.85) &&
          state === "PENDING" && (
            <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    biometricVerified
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600 animate-pulse",
                  )}
                >
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {biometricVerified
                      ? t(
                          "component.generativeUi.actionConfirmation.biometricVerified",
                        )
                      : t(
                          "component.generativeUi.actionConfirmation.biometricVerify",
                        )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {biometricVerified
                      ? t(
                          "component.generativeUi.actionConfirmation.tokenValid",
                        )
                      : t(
                          "component.generativeUi.actionConfirmation.biometricMethods",
                        )}
                  </div>
                </div>
              </div>

              {!biometricVerified && (
                <PodaciumButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateBiometricAuth}
                  disabled={isVerifyingBio}
                  className="text-xs h-7 px-2.5"
                >
                  {isVerifyingBio ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    t(
                      "component.generativeUi.actionConfirmation.biometricAuthorize",
                    )
                  )}
                </PodaciumButton>
              )}
            </div>
          )}

        {/* Error notification */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          {state === "PENDING" && (
            <>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <XCircle className="me-1 h-3.5 w-3.5" />
                {t("component.generativeUi.actionConfirmation.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                className="text-xs px-4"
              >
                {t(
                  "component.generativeUi.actionConfirmation.confirmAndExecute",
                )}
                <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
              </PodaciumButton>
            </>
          )}

          {state === "EXECUTING" && (
            <div className="w-full flex items-center justify-center gap-2 py-1 text-xs text-primary font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {t("component.generativeUi.actionConfirmation.hmacValidating")}
              </span>
            </div>
          )}

          {state === "CONFIRMED" && (
            <div className="w-full flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t(
                  "component.generativeUi.actionConfirmation.operationSuccess",
                )}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                ID: {payload.intent_id.slice(0, 8)}
              </span>
            </div>
          )}

          {(state === "REJECTED" || state === "EXPIRED") && (
            <div className="w-full text-end text-xs text-muted-foreground italic">
              {state === "REJECTED"
                ? t("component.generativeUi.actionConfirmation.rejectedByUser")
                : t("component.generativeUi.actionConfirmation.tokenExpired")}
            </div>
          )}

          {state === "FAILED" && (
            <div className="w-full flex items-center justify-between text-xs">
              <span className="text-destructive font-medium">
                {t("component.generativeUi.actionConfirmation.statusFailed")}
              </span>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setState("PENDING");
                  setErrorMessage(null);
                }}
                className="text-xs"
              >
                {t("component.generativeUi.actionConfirmation.retry")}
              </PodaciumButton>
            </div>
          )}
        </div>
      </div>
    </PodaciumCard>
  );
}

export default ActionConfirmationCard;
