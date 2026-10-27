"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Upload,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export interface AlgerianKybCardProps {
  status?: string;
  rcNumber?: string | null;
  nifNumber?: string | null;
  nisNumber?: string | null;
  articleImposition?: string | null;
  legalStructure?: string | null;
  onOpenKybModal?: () => void;
  className?: string;
}

export function AlgerianKybCard({
  status = "NOT_SUBMITTED",
  rcNumber,
  nifNumber,
  nisNumber,
  articleImposition,
  legalStructure,
  onOpenKybModal,
  className,
}: AlgerianKybCardProps) {
  const t = useTranslations();

  const statusConfig = {
    APPROVED: {
      variant: "success" as const,
      icon: CheckCircle2,
      label: t("kyb.approved"),
    },
    PENDING_VERIFICATION: {
      variant: "warning" as const,
      icon: Clock,
      label: t("kyb.pending"),
    },
    REQUIRES_CLARIFICATION: {
      variant: "warning" as const,
      icon: ShieldAlert,
      label: t("kyb.clarification"),
    },
    REJECTED: {
      variant: "destructive" as const,
      icon: ShieldAlert,
      label: t("kyb.rejected"),
    },
    NOT_SUBMITTED: {
      variant: "secondary" as const,
      icon: FileText,
      label: t("kyb.notSubmitted"),
    },
  }[status] || {
    variant: "secondary" as const,
    icon: FileText,
    label: status,
  };

  const StatusIcon = statusConfig.icon;

  return (
    <PodaciumCard className={className} data-testid="algerian-kyb-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("kyb.title")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("kyb.subtitle")}</p>
          </div>
        </div>

        <PodaciumBadge
          variant={statusConfig.variant}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{statusConfig.label}</span>
        </PodaciumBadge>
      </div>

      {/* Statutory Fiscal Identifiers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-4">
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {t("kyb.rc")}
          </div>
          <div
            className="text-xs font-mono font-semibold text-foreground"
            dir="ltr"
          >
            {rcNumber || "—"}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {t("kyb.nif")}
          </div>
          <div
            className="text-xs font-mono font-semibold text-foreground"
            dir="ltr"
          >
            {nifNumber || "—"}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {t("kyb.nis")}
          </div>
          <div
            className="text-xs font-mono font-semibold text-foreground"
            dir="ltr"
          >
            {nisNumber || "—"}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {t("kyb.article")}
          </div>
          <div
            className="text-xs font-mono font-semibold text-foreground"
            dir="ltr"
          >
            {articleImposition || "—"}
          </div>
        </div>
      </div>

      {/* Footer Info & Upload Trigger */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
        <div className="text-xs text-muted-foreground">
          {legalStructure && (
            <span>
              {t("kyb.structure")}:{" "}
              <strong className="text-foreground">{legalStructure}</strong>
            </span>
          )}
        </div>

        {onOpenKybModal && (
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={onOpenKybModal}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            {status === "APPROVED"
              ? t("kyb.viewDossier")
              : t("kyb.submitDossier")}
          </PodaciumButton>
        )}
      </div>
    </PodaciumCard>
  );
}

export default AlgerianKybCard;
