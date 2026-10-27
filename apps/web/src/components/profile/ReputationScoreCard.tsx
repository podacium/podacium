"use client";

import React from "react";
import {
  ShieldCheck,
  Award,
  Star,
  Users,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumTooltip,
} from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface ReputationScoreCardProps {
  freelancerName: string;
  tier: "TIER_0_EMAIL" | "TIER_1_NIN" | "TIER_2_BIOMETRIC" | "TIER_3_ANAE";
  weightedRating: number;
  totalReviews: number;
  clientDiversityScore: number; // 0-100%
  onTimeDeliveryRate: number; // 0-100%
  completedContractsCount: number;
  anaeCardVerified?: boolean;
  className?: string;
}

export const ReputationScoreCard: React.FC<ReputationScoreCardProps> = ({
  freelancerName,
  tier,
  weightedRating,
  totalReviews,
  clientDiversityScore,
  onTimeDeliveryRate,
  completedContractsCount,
  anaeCardVerified = false,
  className,
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();

  const tierConfig = {
    TIER_0_EMAIL: {
      label: t("robustness.reputation.tier0"),
      badgeVariant: "secondary" as const,
      limitText: t("robustness.reputation.limitMonthly", { amount: "30 000" }),
    },
    TIER_1_NIN: {
      label: t("robustness.reputation.tier1"),
      badgeVariant: "outline" as const,
      limitText: t("robustness.reputation.limitMonthly", { amount: "150 000" }),
    },
    TIER_2_BIOMETRIC: {
      label: t("robustness.reputation.tier2"),
      badgeVariant: "default" as const,
      limitText: t("robustness.reputation.limitMonthly", { amount: "500 000" }),
    },
    TIER_3_ANAE: {
      label: t("robustness.reputation.tier3"),
      badgeVariant: "success" as const,
      limitText: t("robustness.reputation.limitUnlimited"),
    },
  }[tier] || {
    label: t("robustness.reputation.tier0"),
    badgeVariant: "secondary" as const,
    limitText: t("robustness.reputation.limitMonthly", { amount: "30 000" }),
  };

  return (
    <PodaciumCard className={`p-5 space-y-4 ${className || ""}`}>
      {/* Top Badge & Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base">
            {t("robustness.reputation.title") ||
              (isRTL
                ? "مؤشر الثقة والسمعة المهنية"
                : "Score de Réputation & Fiabilité")}
          </h3>
        </div>
        <PodaciumBadge
          variant={tierConfig.badgeVariant}
          className="text-xs font-semibold"
        >
          {tierConfig.label}
        </PodaciumBadge>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Rating */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-1 text-amber-500 mb-1">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span className="text-sm font-bold text-foreground">
              {weightedRating.toFixed(1)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("robustness.reputation.weightedReviews", {
              count: totalReviews,
            })}
          </p>
        </div>

        {/* Client Diversity */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-1 text-primary mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm font-bold text-foreground">
              {clientDiversityScore}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("robustness.reputation.clientDiversity")}
          </p>
        </div>

        {/* On Time Delivery */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-1 text-emerald-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-bold text-foreground">
              {onTimeDeliveryRate}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("robustness.reputation.onTimeDelivery")}
          </p>
        </div>

        {/* Completed Contracts */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-1 text-blue-500 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-bold text-foreground">
              {completedContractsCount}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("robustness.reputation.completedContracts")}
          </p>
        </div>
      </div>

      {/* ANAE Fiscal Badge */}
      {anaeCardVerified && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t("robustness.reputation.anaeVerified")}</span>
        </div>
      )}
    </PodaciumCard>
  );
};

export default ReputationScoreCard;
