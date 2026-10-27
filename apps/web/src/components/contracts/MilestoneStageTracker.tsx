"use client";

import React, { useMemo } from "react";
import {
  ShieldCheck,
  Code2,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
} from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export type MilestoneStage =
  | "FUNDED"
  | "IN_DEVELOPMENT"
  | "SUBMITTED"
  | "UNDER_INSPECTION"
  | "RELEASED"
  | "DISPUTED";

export interface MilestoneStageTrackerProps {
  milestoneId: number;
  milestoneTitle: string;
  amountDzd: number;
  status: "PENDING" | "DELIVERED" | "APPROVED" | "DISPUTED" | "RELEASED";
  deliveredAt?: string | null;
  approvedAt?: string | null;
  disputedAt?: string | null;
  autoApproveDays?: number;
  isClient?: boolean;
  onApprove?: () => void;
  onRequestRevisions?: () => void;
  onDispute?: () => void;
  onViewIpDeed?: () => void;
  className?: string;
}

export const MilestoneStageTracker: React.FC<MilestoneStageTrackerProps> = ({
  milestoneId,
  milestoneTitle,
  amountDzd,
  status,
  deliveredAt,
  approvedAt,
  disputedAt,
  autoApproveDays = 14,
  isClient = true,
  onApprove,
  onRequestRevisions,
  onDispute,
  onViewIpDeed,
  className = "",
}) => {
  const t = useTranslations();
  const { isRTL } = useBidi();

  // Determine active visual stage
  const currentStage: MilestoneStage = useMemo(() => {
    if (status === "APPROVED" || status === "RELEASED") return "RELEASED";
    if (status === "DISPUTED") return "DISPUTED";
    if (status === "DELIVERED") return "UNDER_INSPECTION";
    if (deliveredAt) return "SUBMITTED";
    return "IN_DEVELOPMENT";
  }, [status, deliveredAt]);

  // Inspection timeline & countdown calculations
  const inspectionDetails = useMemo(() => {
    if (!deliveredAt || status !== "DELIVERED") return null;

    const deliveredDate = new Date(deliveredAt);
    const deadlineDate = new Date(deliveredDate);
    deadlineDate.setDate(deadlineDate.getDate() + autoApproveDays);

    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const remainingDays = Math.max(
      0,
      Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
    );
    const remainingHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

    return {
      deliveredFormatted: deliveredDate.toLocaleDateString("fr-DZ", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      deadlineFormatted: deadlineDate.toLocaleDateString("fr-DZ", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      remainingDays,
      remainingHours,
      isImminent: remainingDays <= 3,
    };
  }, [deliveredAt, status, autoApproveDays]);

  const stages = useMemo(
    () => [
      {
        key: "FUNDED",
        label: t("contracts.detail.stageTracker.stages.funded"),
        icon: ShieldCheck,
      },
      {
        key: "IN_DEVELOPMENT",
        label: t("contracts.detail.stageTracker.stages.inDevelopment"),
        icon: Code2,
      },
      {
        key: "SUBMITTED",
        label: t("contracts.detail.stageTracker.stages.submitted"),
        icon: Send,
      },
      {
        key: "UNDER_INSPECTION",
        label: t("contracts.detail.stageTracker.stages.underInspection", {
          days: autoApproveDays,
        }),
        icon: Clock,
      },
      {
        key: status === "DISPUTED" ? "DISPUTED" : "RELEASED",
        label:
          status === "DISPUTED"
            ? t("contracts.detail.stageTracker.stages.disputed")
            : t("contracts.detail.stageTracker.stages.released"),
        icon: status === "DISPUTED" ? AlertTriangle : CheckCircle2,
      },
    ],
    [status, autoApproveDays, t],
  );

  const getStageIndex = (stageKey: string) => {
    switch (stageKey) {
      case "FUNDED":
        return 0;
      case "IN_DEVELOPMENT":
        return 1;
      case "SUBMITTED":
        return 2;
      case "UNDER_INSPECTION":
        return 3;
      case "RELEASED":
      case "DISPUTED":
        return 4;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <PodaciumCard
      variant="default"
      className={`overflow-hidden border border-border/80 ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gray-50/70 px-5 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
            #{milestoneId}
          </span>
          <h4 className="text-sm font-semibold text-foreground">
            {milestoneTitle}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("contracts.detail.stageTracker.budgetLabel")}
          </span>
          <PodaciumBadge variant="gradient" className="font-mono font-bold">
            {amountDzd.toLocaleString()} DZD
          </PodaciumBadge>
          {status === "APPROVED" && (
            <PodaciumBadge variant="success" className="text-xs">
              {t("contracts.detail.stageTracker.approvedReleased")}
            </PodaciumBadge>
          )}
          {status === "DISPUTED" && (
            <PodaciumBadge variant="destructive" className="text-xs">
              {t("contracts.detail.stageTracker.inArbitration")}
            </PodaciumBadge>
          )}
        </div>
      </div>

      {/* Visual stage pipeline */}
      <div className="px-5 py-6">
        <div className="relative flex items-center justify-between">
          {/* Background rail */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-gray-200" />

          {/* Active progress rail */}
          <div
            className={`absolute left-6 top-1/2 -translate-y-1/2 h-1 transition-all duration-500 ${
              status === "DISPUTED"
                ? "bg-red-500"
                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"
            }`}
            style={{
              width: `calc(${(currentIndex / 4) * 100}% - 24px)`,
            }}
          />

          {stages.map((st, idx) => {
            const Icon = st.icon;
            const isCompleted =
              idx < currentIndex ||
              (idx === 4 && (status === "APPROVED" || status === "RELEASED"));
            const isCurrent = idx === currentIndex;
            const isDisputed = st.key === "DISPUTED";

            return (
              <div
                key={st.key}
                className="relative z-10 flex flex-col items-center"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isDisputed
                      ? "border-red-500 bg-red-50 text-red-600 shadow-md shadow-red-500/20"
                      : isCompleted
                        ? "border-primary bg-primary text-white shadow-md shadow-primary/20"
                        : isCurrent
                          ? "border-indigo-600 bg-white text-indigo-600 shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-100"
                          : "border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`mt-2 text-center text-[11px] font-medium leading-tight max-w-[90px] ${
                    isDisputed
                      ? "text-red-700 font-semibold"
                      : isCurrent
                        ? "text-indigo-700 font-bold"
                        : isCompleted
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prominent Silence = Acceptance Rule Countdown Banner */}
      {status === "DELIVERED" && inspectionDetails && (
        <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-sm font-bold text-amber-950">
                  {t("contracts.detail.stageTracker.tacitRule", {
                    days: autoApproveDays,
                  })}
                </h5>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
                  </span>
                  {t("contracts.detail.stageTracker.remainingCountdown", {
                    days: inspectionDetails.remainingDays,
                    hours: inspectionDetails.remainingHours,
                  })}
                </span>
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                {t("contracts.detail.stageTracker.inspectionNotice", {
                  delivered: inspectionDetails.deliveredFormatted,
                  deadline: inspectionDetails.deadlineFormatted,
                  amount: amountDzd.toLocaleString(),
                })}
              </p>
            </div>
          </div>

          {/* Action buttons for Client */}
          {isClient && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-amber-200/70">
              {onDispute && (
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={onDispute}
                  className="text-destructive hover:bg-destructive/10 border-red-200"
                >
                  <AlertTriangle className="h-4 w-4 me-1.5" />
                  {t("contracts.detail.stageTracker.openDispute")}
                </PodaciumButton>
              )}
              {onRequestRevisions && (
                <PodaciumButton
                  variant="secondary"
                  size="sm"
                  onClick={onRequestRevisions}
                >
                  {t("contracts.detail.stageTracker.requestRevisions")}
                </PodaciumButton>
              )}
              {onApprove && (
                <PodaciumButton
                  variant="gradient"
                  size="sm"
                  glow
                  onClick={onApprove}
                >
                  <CheckCircle2 className="h-4 w-4 me-1.5" />
                  {t("contracts.detail.stageTracker.approveReleaseEscrow")}
                </PodaciumButton>
              )}
            </div>
          )}
        </div>
      )}

      {/* Post-Approval Protected State Banner */}
      {(status === "APPROVED" || status === "RELEASED") && (
        <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {t("contracts.detail.stageTracker.approvedSuccess")}
                </p>
                <p className="text-[11px] text-emerald-800">
                  {t("contracts.detail.stageTracker.antiDisputeNotice")}
                </p>
              </div>
            </div>
            {onViewIpDeed && (
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={onViewIpDeed}
                className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50 text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 me-1 text-emerald-600" />
                {t("contracts.detail.stageTracker.ipDeedButton")}
              </PodaciumButton>
            )}
          </div>
        </div>
      )}
    </PodaciumCard>
  );
};

export default MilestoneStageTracker;
