"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon,
  AlertTriangle,
  Sparkles,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Wand2,
  Filter,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberDZ, formatPercentageDZ } from "@/lib/formatDZD";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";

// =============================================================================
// TYPES
// =============================================================================

export type InsightUrgency = "critical" | "warning" | "opportunity" | "info";
export type InsightCategory = "anomaly" | "trend" | "forecast" | "performance";

export interface DriverAttribution {
  dimension: string;
  impactPercentage: number;
  direction: "positive" | "negative";
  formattedDelta: string;
}

export interface AiInsightData {
  id: string | number;
  category: InsightCategory;
  urgency: InsightUrgency;
  title: string;
  narrativeDiagnostic: string;
  metricLabel: string;
  currentValue: number;
  baselineValue: number;
  baselineLabel: string; // e.g. "vs. 30d Rolling Avg"
  percentageChange: number;
  isPositiveOutcome: boolean; // Controls whether positive change is green or red
  confidenceScore: number; // e.g. 0.94 -> 94%
  generatedAt: string; // e.g. "12m ago"
  modelName?: string; // e.g. "AutoML Driver Decomposition"
  drivers?: DriverAttribution[];
  sparklineData?: number[];
  recommendedAction?: {
    label: string;
    actionType: "decision" | "clean" | "filter" | "alert";
    payload?: any;
  };
}

interface AiInsightCardProps {
  insight: AiInsightData;
  t: (key: string, params?: any) => string;
  isRtl?: boolean;
  onThumbsUp?: (id: string | number) => void;
  onThumbsDown?: (id: string | number) => void;
  onCreateDecision?: (insight: AiInsightData) => void;
  onTriggerClean?: (columnName?: string) => void;
  onApplyFilter?: (sqlClause?: string) => void;
  onCreateAlert?: (insight: AiInsightData) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AiInsightCard({
  insight,
  t,
  isRtl = false,
  onThumbsUp,
  onThumbsDown,
  onCreateDecision,
  onTriggerClean,
  onApplyFilter,
  onCreateAlert,
  className,
}: AiInsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // 1. Urgency Styling & Badge Mapping
  const urgencyConfig = {
    critical: {
      badgeBg:
        "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80",
      accentBorder: "border-s-rose-500",
      icon: AlertOctagon,
      label: t("bi.insights.urgency.critical"),
    },
    warning: {
      badgeBg:
        "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80",
      accentBorder: "border-s-amber-500",
      icon: AlertTriangle,
      label: t("bi.insights.urgency.warning"),
    },
    opportunity: {
      badgeBg:
        "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80",
      accentBorder: "border-s-emerald-500",
      icon: Sparkles,
      label: t("bi.insights.urgency.opportunity"),
    },
    info: {
      badgeBg:
        "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80",
      accentBorder: "border-s-indigo-500",
      icon: Info,
      label: t("bi.insights.urgency.info"),
    },
  }[insight.urgency];

  const UrgencyIcon = urgencyConfig.icon;

  // 2. Trend Color Logic (Decoupling math sign from business value)
  const isUp = insight.percentageChange > 0;
  const isGood = isUp ? insight.isPositiveOutcome : !insight.isPositiveOutcome;
  const trendBg = isGood
    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";

  // Action Button Handler
  const handleActionClick = () => {
    if (!insight.recommendedAction) return;
    const { actionType, payload } = insight.recommendedAction;
    if (actionType === "decision" && onCreateDecision) {
      onCreateDecision(insight);
    } else if (actionType === "clean" && onTriggerClean) {
      onTriggerClean(payload?.columnName);
    } else if (actionType === "filter" && onApplyFilter) {
      onApplyFilter(payload?.sqlClause);
    } else if (actionType === "alert" && onCreateAlert) {
      onCreateAlert(insight);
    }
  };

  const getActionIcon = (actionType?: string) => {
    switch (actionType) {
      case "clean":
        return Wand2;
      case "filter":
        return Filter;
      case "alert":
        return ShieldAlert;
      case "decision":
      default:
        return FileCheck;
    }
  };

  const ActionIcon = getActionIcon(insight.recommendedAction?.actionType);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className={cn(
        // Base Slate Glass Surface
        "relative flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800/80",
        "border-t-white/80 dark:border-t-white/10",
        "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
        "shadow-xs hover:shadow-md dark:shadow-slate-950/40",
        "transition-all duration-200 text-start overflow-hidden",
        "border-s-4",
        urgencyConfig.accentBorder,
        className,
      )}
    >
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* TIER 1: CLASSIFICATION & METADATA BAR */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Urgency Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-2xs",
                urgencyConfig.badgeBg,
              )}
            >
              <UrgencyIcon className="h-3.5 w-3.5 shrink-0" />
              {urgencyConfig.label}
              {insight.urgency === "critical" && (
                <span className="relative ms-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
                </span>
              )}
            </span>

            {/* Category Pill */}
            <PodaciumBadge
              variant="secondary"
              className="py-0.5 text-[11px] capitalize"
            >
              {t(`bi.insights.categories.${insight.category}`) ||
                insight.category}
            </PodaciumBadge>
          </div>

          {/* ML Confidence Score */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-bold tracking-wider uppercase">
              {t("bi.insights.confidence")}:
            </span>
            <span
              dir="ltr"
              className="font-mono font-bold text-slate-900 dark:text-slate-100"
            >
              {(insight.confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* TIER 2: HEADLINE & DIAGNOSTIC NARRATIVE */}
        <div className="mb-4">
          <h3 className="text-base font-bold tracking-tight text-slate-900 leading-snug sm:text-lg dark:text-slate-100">
            {insight.title}
          </h3>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed sm:text-sm dark:text-slate-300">
            {insight.narrativeDiagnostic}
          </p>
        </div>

        {/* TIER 3: METRIC HERO & SPARKLINE CALLOUT */}
        <div className="mb-4 grid grid-cols-1 items-center gap-4 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5 sm:grid-cols-12 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="sm:col-span-7">
            <span className="mb-1 block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              {insight.metricLabel}
            </span>
            <div className="flex flex-wrap items-baseline gap-2.5">
              {/* LTR Encapsulated Metric */}
              <div className="flex items-baseline gap-1.5">
                <span
                  dir="ltr"
                  className="font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white"
                >
                  {formatNumberDZ(insight.currentValue)}
                </span>
              </div>

              {/* Delta Pill (Directional icon never flipped) */}
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-2xs",
                  trendBg,
                )}
              >
                {isUp ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <span dir="ltr" className="font-mono">
                  {isUp ? "+" : ""}
                  {formatPercentageDZ(insight.percentageChange)}
                </span>
              </div>
            </div>

            {/* Baseline Context Pill */}
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{insight.baselineLabel}:</span>
              <span
                dir="ltr"
                className="font-mono font-medium text-slate-700 dark:text-slate-300"
              >
                {formatNumberDZ(insight.baselineValue)}
              </span>
            </p>
          </div>

          {/* Micro Sparkline Preview */}
          {insight.sparklineData && insight.sparklineData.length > 1 && (
            <div
              className="flex h-10 w-full justify-end sm:col-span-5"
              role="img"
              aria-label="Metric Trend"
            >
              <svg
                className="h-full w-full max-w-[140px] overflow-visible"
                viewBox="0 0 100 30"
              >
                <line
                  x1="0"
                  y1="18"
                  x2="100"
                  y2="18"
                  className="stroke-slate-300 dark:stroke-slate-700 stroke-dasharray-[2,2]"
                  strokeWidth="1"
                />
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={isGood ? "text-emerald-500" : "text-rose-500"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,22 20,20 40,24 60,15 80,10 100,5"
                />
                <circle
                  cx="100"
                  cy="5"
                  r="3.5"
                  className={isGood ? "fill-emerald-500" : "fill-rose-500"}
                />
                <circle
                  cx="100"
                  cy="5"
                  r="6"
                  className={
                    isGood
                      ? "animate-ping fill-none stroke-emerald-400/50"
                      : "animate-ping fill-none stroke-rose-400/50"
                  }
                />
              </svg>
            </div>
          )}
        </div>

        {/* TIER 4: PROGRESSIVE DISCLOSURE (ROOT CAUSE ACCORDION) */}
        {insight.drivers && insight.drivers.length > 0 && (
          <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800/80">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-500 focus:outline-none dark:text-indigo-400"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                {t("bi.insights.whyDidThisHappen")}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform duration-200",
                  isExpanded && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="mt-3 space-y-2.5 overflow-hidden pt-1"
                >
                  <div className="space-y-2">
                    {insight.drivers.map((driver, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {driver.dimension}
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100"
                          >
                            {driver.formattedDelta} ({driver.impactPercentage}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              driver.direction === "positive"
                                ? "bg-emerald-500"
                                : "bg-rose-500",
                            )}
                            style={{
                              width: `${Math.min(driver.impactPercentage, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Model Lineage */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <span>
                      {insight.modelName || "AutoML Driver Decomposition"}
                    </span>
                    <span dir="ltr">{t("bi.insights.significanceStats")}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* TIER 5: ACTIONABLE FOOTER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{insight.generatedAt}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Feedback Loops */}
          <div className="me-1 flex items-center gap-1 border-e border-slate-200 pe-2 dark:border-slate-800">
            <button
              onClick={() => {
                setFeedback("up");
                onThumbsUp?.(insight.id);
              }}
              className={cn(
                "rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200",
                feedback === "up" &&
                  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
              )}
              title={t("bi.insights.feedback.helpful")}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setFeedback("down");
                onThumbsDown?.(insight.id);
              }}
              className={cn(
                "rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200",
                feedback === "down" &&
                  "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
              )}
              title={t("bi.insights.feedback.notHelpful")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Primary 1-Click Action Trigger */}
          {insight.recommendedAction && (
            <PodaciumButton
              variant="gradient"
              size="sm"
              className="h-7.5 gap-1.5 px-3 text-xs"
              onClick={handleActionClick}
            >
              <ActionIcon className="h-3.5 w-3.5" />
              <span>{insight.recommendedAction.label}</span>
              <ArrowRight className={cn("h-3 w-3", isRtl && "scale-x-[-1]")} />
            </PodaciumButton>
          )}
        </div>
      </div>
    </motion.article>
  );
}
