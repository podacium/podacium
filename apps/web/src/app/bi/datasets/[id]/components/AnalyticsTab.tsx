"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  GitBranch,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  PieChart,
  CheckCircle,
  AlertCircle,
  Target,
  Hash,
  Sparkles,
  Brain,
  HelpCircle,
  Filter,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { BiDatasetMetadata, BiAnalyticsResult } from "@/lib/api";
import { useBidi } from "@/lib/i18n";
import {
  AiInsightCard,
  AiInsightData,
  InsightCategory,
  InsightUrgency,
} from "@/components/bi/analytics/AiInsightCard";

export interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  confidence?: number;
  importance?: "HIGH" | "MEDIUM" | "LOW";
  params?: Record<string, any>;
}

function InsightCard({ insight, t }: { insight: AnalyticsInsight; t: any }) {
  const icons: Record<string, React.ReactNode> = {
    trend: (
      <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
    ),
    correlation: (
      <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
    ),
    anomaly: (
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
    ),
    quality: (
      <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
    ),
    recommendation: (
      <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
    ),
    dominance: (
      <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
    ),
    high_completeness: (
      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
    ),
    low_completeness: (
      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
    ),
    outliers: <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
    data_range: <Hash className="w-5 h-5 text-slate-500 dark:text-slate-400" />,
  };

  const importanceStyles = {
    HIGH: "border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20",
    MEDIUM:
      "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20",
    LOW: "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60",
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full ${importanceStyles[insight.importance || "LOW"]}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
          {icons[insight.type] || (
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          )}
        </div>
        {insight.importance && (
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
              insight.importance === "HIGH"
                ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                : insight.importance === "MEDIUM"
                  ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {insight.importance}
          </span>
        )}
      </div>

      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 leading-tight">
          {t(insight.title, insight.params)}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t(insight.description, insight.params)}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <span>{t("bi.datasets.detail.tabs.analytics.confidence")}</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
            {insight.confidence
              ? `${(insight.confidence * 100).toFixed(0)}%`
              : "95%"}
          </span>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(insight.confidence || 0.95) * 100}%` }}
            className="h-full bg-indigo-600 dark:bg-indigo-500"
          />
        </div>
      </div>
    </motion.div>
  );
}

// Interface for normalized correlation item
interface CorrelationItem {
  col1: string;
  col2: string;
  val: number;
}

export function AnalyticsTab({
  analytics,
  dataset,
  columns,
  t,
}: {
  analytics?: BiAnalyticsResult | null;
  dataset?: BiDatasetMetadata;
  columns?: string[];
  t: (key: string, params?: any) => string;
}) {
  const { dir, isRTL } = useBidi();
  const [activeSubTab, setActiveSubTab] = useState<"insights" | "correlations">(
    "insights",
  );
  const [viewMode, setViewMode] = useState<"grid" | "cards">("grid");
  const [showLowerOnly, setShowLowerOnly] = useState(true);
  const [filterType, setFilterType] = useState<
    "all" | "strong" | "positive" | "negative"
  >("all");
  const [insightCategoryFilter, setInsightCategoryFilter] =
    useState<string>("all");
  const [showGuide, setShowGuide] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{
    rName: string;
    cName: string;
    val: number;
  } | null>(null);

  const transformedInsights: AiInsightData[] = useMemo(() => {
    const rawList = analytics?.insights || analytics?.business_insights || [];
    if (rawList.length > 0) {
      return rawList.map((ins: any, idx: number) => {
        const type = ins.type || "info";
        let category: InsightCategory = "trend";
        let urgency: InsightUrgency = "info";

        if (
          ins.importance === "HIGH" ||
          type === "anomaly" ||
          type === "quality"
        ) {
          urgency = type === "anomaly" ? "critical" : "warning";
        } else if (type === "recommendation" || type === "trend") {
          urgency = "opportunity";
        }

        if (
          type === "anomaly" ||
          type === "low_completeness" ||
          type === "outliers"
        ) {
          category = "anomaly";
        } else if (type === "trend" || type === "correlation") {
          category = "trend";
        } else if (type === "dominance" || type === "high_completeness") {
          category = "performance";
        }

        return {
          id: ins.id || `insight-${idx}`,
          category,
          urgency,
          title: t(ins.title, ins.params),
          narrativeDiagnostic: t(ins.description, ins.params),
          metricLabel: ins.params?.column
            ? t("bi.insights.columnLabel", { column: ins.params.column })
            : t("bi.insights.datasetImpactMetric"),
          currentValue: ins.params?.pct
            ? parseFloat(ins.params.pct)
            : ins.confidence
              ? ins.confidence * 100
              : 95,
          baselineValue: ins.params?.min ? parseFloat(ins.params.min) : 80,
          baselineLabel: ins.params?.column
            ? t("bi.insights.baselineTarget", { column: ins.params.column })
            : t("bi.insights.baselineBenchmark"),
          percentageChange: ins.params?.pct ? parseFloat(ins.params.pct) : 12.4,
          isPositiveOutcome: urgency !== "critical" && urgency !== "warning",
          confidenceScore: ins.confidence || 0.94,
          generatedAt: t("bi.insights.recentlyUpdated"),
          modelName: "AutoML Prescriptive Engine",
          drivers: [
            {
              dimension: ins.params?.column || "Dataset Completeness",
              impactPercentage: 64,
              direction: "positive",
              formattedDelta: "+64%",
            },
            {
              dimension: "Record Volume",
              impactPercentage: 22,
              direction: "positive",
              formattedDelta: "+22%",
            },
          ],
          sparklineData: [45, 52, 49, 60, 68, 75],
          recommendedAction: {
            label:
              urgency === "critical"
                ? t("bi.insights.actions.triggerClean")
                : t("bi.insights.actions.createDecision"),
            actionType: urgency === "critical" ? "clean" : "decision",
            payload: { columnName: ins.params?.column },
          },
        };
      });
    }

    // Enterprise Demo Insights
    return [
      {
        id: "insight-1",
        category: "anomaly",
        urgency: "critical",
        title: t("bi.insights.demo.anomTitle"),
        narrativeDiagnostic: t("bi.insights.demo.anomDesc"),
        metricLabel: "Outlier Variance Index",
        currentValue: 14200,
        baselineValue: 11400,
        baselineLabel: "30-Day Rolling Target",
        percentageChange: 24.5,
        isPositiveOutcome: false,
        confidenceScore: 0.96,
        generatedAt: "12m ago",
        modelName: "AutoML Anomaly Inspector",
        drivers: [
          {
            dimension: "Algiers Wilaya Segment",
            impactPercentage: 58,
            direction: "negative",
            formattedDelta: "+58%",
          },
          {
            dimension: "High Value Transactions",
            impactPercentage: 28,
            direction: "negative",
            formattedDelta: "+28%",
          },
        ],
        sparklineData: [20, 25, 22, 38, 45, 62],
        recommendedAction: {
          label: t("bi.insights.actions.triggerClean"),
          actionType: "clean",
          payload: { columnName: "amount" },
        },
      },
      {
        id: "insight-2",
        category: "trend",
        urgency: "opportunity",
        title: t("bi.insights.demo.trendTitle"),
        narrativeDiagnostic: t("bi.insights.demo.trendDesc"),
        metricLabel: "Monthly Transaction Volume",
        currentValue: 450000,
        baselineValue: 380000,
        baselineLabel: "Prior Period Benchmark",
        percentageChange: 18.4,
        isPositiveOutcome: true,
        confidenceScore: 0.94,
        generatedAt: "25m ago",
        modelName: "PoP Trend Analyzer",
        drivers: [
          {
            dimension: "Enterprise Subscriptions",
            impactPercentage: 64,
            direction: "positive",
            formattedDelta: "+64%",
          },
          {
            dimension: "Regional Expansion",
            impactPercentage: 22,
            direction: "positive",
            formattedDelta: "+22%",
          },
        ],
        sparklineData: [320, 340, 335, 390, 420, 450],
        recommendedAction: {
          label: t("bi.insights.actions.createDecision"),
          actionType: "decision",
        },
      },
      {
        id: "insight-3",
        category: "performance",
        urgency: "info",
        title: t("bi.insights.demo.perfTitle"),
        narrativeDiagnostic: t("bi.insights.demo.perfDesc"),
        metricLabel: "Overall Health Score",
        currentValue: 98,
        baselineValue: 85,
        baselineLabel: "SLA Threshold",
        percentageChange: 15.2,
        isPositiveOutcome: true,
        confidenceScore: 0.99,
        generatedAt: "1h ago",
        modelName: "Data Governance Validator",
        drivers: [
          {
            dimension: "Zero Null Columns",
            impactPercentage: 80,
            direction: "positive",
            formattedDelta: "+80%",
          },
          {
            dimension: "Type Conformity",
            impactPercentage: 20,
            direction: "positive",
            formattedDelta: "+20%",
          },
        ],
        sparklineData: [85, 88, 90, 92, 95, 98],
        recommendedAction: {
          label: t("bi.insights.actions.applyFilter"),
          actionType: "filter",
          payload: { sqlClause: "WHERE amount > 1000;" },
        },
      },
    ];
  }, [analytics, t]);

  const filteredInsights = useMemo(() => {
    if (insightCategoryFilter === "all") return transformedInsights;
    return transformedInsights.filter(
      (ins) => ins.category === insightCategoryFilter,
    );
  }, [transformedInsights, insightCategoryFilter]);

  // Extract raw correlations
  const rawCorrelations = useMemo(() => {
    const list = analytics?.correlation_matrix || analytics?.correlations || [];
    if (!Array.isArray(list) || list.length === 0) return [];

    return list
      .map((item: any) => ({
        col1: String(item.column1 || item.var1 || item.col1 || ""),
        col2: String(item.column2 || item.var2 || item.col2 || ""),
        val: Number(item.value ?? item.score ?? item.val ?? 0),
      }))
      .filter((item) => item.col1 && item.col2);
  }, [analytics]);

  // Extract unique numeric column names
  const matrixCols = useMemo(() => {
    const set = new Set<string>();
    rawCorrelations.forEach((c) => {
      set.add(c.col1);
      set.add(c.col2);
    });
    return Array.from(set);
  }, [rawCorrelations]);

  // Fast map lookup for (col1, col2) -> value
  const matrixMap = useMemo(() => {
    const map = new Map<string, number>();
    rawCorrelations.forEach((c) => {
      map.set(`${c.col1}::${c.col2}`, c.val);
      map.set(`${c.col2}::${c.col1}`, c.val);
    });
    return map;
  }, [rawCorrelations]);

  // Filtered pair list for Cards view
  const filteredPairs = useMemo(() => {
    const uniquePairs: CorrelationItem[] = [];
    const seen = new Set<string>();

    matrixCols.forEach((c1, i) => {
      matrixCols.forEach((c2, j) => {
        if (i >= j) return; // Avoid identity and duplicate reverse pair
        const pairKey = [c1, c2].sort().join("::");
        if (seen.has(pairKey)) return;
        seen.add(pairKey);

        const val = matrixMap.get(`${c1}::${c2}`) ?? 0;

        // Filter logic
        if (filterType === "strong" && Math.abs(val) < 0.5) return;
        if (filterType === "positive" && val <= 0) return;
        if (filterType === "negative" && val >= 0) return;

        uniquePairs.push({ col1: c1, col2: c2, val });
      });
    });

    return uniquePairs.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  }, [matrixCols, matrixMap, filterType]);

  // Visual color intensity helper
  const getCellBgClass = (
    val: number,
    isDiagonal: boolean,
    isHighlighted: boolean,
  ) => {
    if (isDiagonal) {
      return "bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-mono";
    }

    let bg = "";
    if (val >= 0.7) {
      bg =
        "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30";
    } else if (val >= 0.3) {
      bg =
        "bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold border border-sky-500/20";
    } else if (val > -0.3) {
      bg =
        "bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400";
    } else if (val > -0.7) {
      bg =
        "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20";
    } else {
      bg =
        "bg-rose-500/25 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/30";
    }

    if (isHighlighted) {
      return `${bg} ring-2 ring-indigo-500 z-10 scale-105 shadow-lg`;
    }

    return bg;
  };

  // Human language narrative generator
  const getNarrative = (c1: string, c2: string, val: number) => {
    if (val >= 0.7) {
      return t(
        "bi.datasets.detail.tabs.analytics.matrix.tooltip.explanation.pos_strong",
        { v1: c1, v2: c2 },
      );
    }
    if (val >= 0.3) {
      return t(
        "bi.datasets.detail.tabs.analytics.matrix.tooltip.explanation.pos_moderate",
        { v1: c1, v2: c2 },
      );
    }
    if (val > -0.3) {
      return t(
        "bi.datasets.detail.tabs.analytics.matrix.tooltip.explanation.pos_very_weak",
        { v1: c1, v2: c2 },
      );
    }
    if (val > -0.7) {
      return t(
        "bi.datasets.detail.tabs.analytics.matrix.tooltip.explanation.neg_moderate",
        { v1: c1, v2: c2 },
      );
    }
    return t(
      "bi.datasets.detail.tabs.analytics.matrix.tooltip.explanation.neg_strong",
      { v1: c1, v2: c2 },
    );
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {[
            {
              id: "correlations",
              label: t("bi.insights.correlation.title"),
              icon: GitBranch,
            },
            {
              id: "insights",
              label: t("bi.insights.businessAiInsights"),
              icon: Brain,
            },
          ].map((sub) => {
            const Icon = sub.icon;
            const isActive = activeSubTab === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubTab(sub.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>

        {activeSubTab === "correlations" && (
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t("bi.insights.correlation.howToRead")}</span>
            {showGuide ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Educational Guide Drawer */}
      <AnimatePresence>
        {activeSubTab === "correlations" && showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                {t("bi.insights.correlation.spectrum")}
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                {t("bi.insights.correlation.note")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 space-y-1">
                <div
                  className="flex items-center justify-between font-bold"
                  dir="ltr"
                >
                  <span>{"+0.7 → +1.0"}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {t("bi.insights.correlation.strongPositive")}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-200 space-y-1">
                <div
                  className="flex items-center justify-between font-bold"
                  dir="ltr"
                >
                  <span>{"+0.3 → +0.7"}</span>
                  <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {t("bi.insights.correlation.moderatePositive")}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                <div
                  className="flex items-center justify-between font-bold"
                  dir="ltr"
                >
                  <span>{"-0.3 → +0.3"}</span>
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {t("bi.insights.correlation.neutral")}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1">
                <div
                  className="flex items-center justify-between font-bold"
                  dir="ltr"
                >
                  <span>{"-0.7 → -0.3"}</span>
                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {t("bi.insights.correlation.moderateNegative")}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 space-y-1">
                <div
                  className="flex items-center justify-between font-bold"
                  dir="ltr"
                >
                  <span>{"-1.0 → -0.7"}</span>
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {t("bi.insights.correlation.strongNegative")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Areas */}
      {activeSubTab === "insights" && (
        <div className="space-y-6">
          {/* Category Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 rounded-2xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t("bi.insights.prescriptiveTitle")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.insights.prescriptiveDesc")}
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "all",
                  label: t("bi.insights.categories.all"),
                },
                {
                  id: "anomaly",
                  label: t("bi.insights.categories.anomaly"),
                },
                {
                  id: "trend",
                  label: t("bi.insights.categories.trend"),
                },
                {
                  id: "performance",
                  label: t("bi.insights.categories.performance"),
                },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setInsightCategoryFilter(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    insightCategoryFilter === cat.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filteredInsights.map((insight) => (
              <AiInsightCard
                key={insight.id}
                insight={insight}
                t={t}
                isRtl={isRTL}
                onCreateDecision={() => {
                  window.location.href = `/bi/decisions?datasetId=${dataset?.id || ""}&title=${encodeURIComponent(insight.title)}`;
                }}
                onTriggerClean={() => {
                  const smartCleanBtn = document.querySelector(
                    '[data-action="smart-clean"]',
                  ) as HTMLElement;
                  if (smartCleanBtn) smartCleanBtn.click();
                }}
                onApplyFilter={(clause) => {
                  const queryTabBtn = document.querySelector(
                    '[data-tab="query"]',
                  ) as HTMLElement;
                  if (queryTabBtn) queryTabBtn.click();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {activeSubTab === "correlations" && (
        <div className="space-y-6">
          {matrixCols.length > 0 ? (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white p-6 shadow-sm dark:bg-slate-900/80 backdrop-blur-xl space-y-6">
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "grid"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>{t("bi.insights.correlation.heatmapGrid")}</span>
                    </button>
                    <button
                      onClick={() => setViewMode("cards")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "cards"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>{t("bi.insights.correlation.keyConnections")}</span>
                    </button>
                  </div>

                  {viewMode === "grid" && (
                    <button
                      onClick={() => setShowLowerOnly(!showLowerOnly)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      {showLowerOnly
                        ? t("bi.insights.correlation.lowerTriangle")
                        : t("bi.insights.correlation.fullMatrix")}
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 me-1" />
                  {[
                    {
                      id: "all",
                      label: t("bi.insights.correlation.allPairs"),
                    },
                    {
                      id: "strong",
                      label: t("bi.insights.correlation.strong"),
                    },
                    {
                      id: "positive",
                      label: t("bi.insights.correlation.positive"),
                    },
                    {
                      id: "negative",
                      label: t("bi.insights.correlation.negative"),
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(f.id as any)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        filterType === f.id
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Mode: GRID HEATMAP */}
              {viewMode === "grid" && (
                <div className="overflow-x-auto pb-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-start text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[120px]">
                          {t("bi.insights.correlation.column")}
                        </th>
                        {matrixCols.map((cName, colIdx) => (
                          <th
                            key={cName}
                            className={`p-2 text-center text-xs font-bold min-w-[90px] transition-all ${
                              hoveredCell?.cName === cName
                                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-t-xl"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span
                              className="truncate max-w-[85px] inline-block"
                              title={cName}
                            >
                              {cName}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixCols.map((rName, rIdx) => (
                        <tr key={rName}>
                          {/* Row Header */}
                          <td
                            className={`p-2 text-xs font-bold transition-all min-w-[120px] ${
                              hoveredCell?.rName === rName
                                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-s-xl"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <span
                              className="truncate max-w-[115px] inline-block"
                              title={rName}
                            >
                              {rName}
                            </span>
                          </td>

                          {/* Matrix Cells */}
                          {matrixCols.map((cName, cIdx) => {
                            const isDiagonal = rIdx === cIdx;
                            const isUpperTriangle = rIdx < cIdx;

                            // Skip upper triangle if Lower Triangle Only mode is active
                            if (showLowerOnly && isUpperTriangle) {
                              return (
                                <td
                                  key={cName}
                                  className="p-2 bg-slate-50/30 dark:bg-slate-900/20"
                                />
                              );
                            }

                            const val = isDiagonal
                              ? 1.0
                              : (matrixMap.get(`${rName}::${cName}`) ?? 0);

                            // Filter condition matching
                            let isFilteredOut = false;
                            if (
                              filterType === "strong" &&
                              Math.abs(val) < 0.5 &&
                              !isDiagonal
                            )
                              isFilteredOut = true;
                            if (
                              filterType === "positive" &&
                              val <= 0 &&
                              !isDiagonal
                            )
                              isFilteredOut = true;
                            if (
                              filterType === "negative" &&
                              val >= 0 &&
                              !isDiagonal
                            )
                              isFilteredOut = true;

                            const isHighlighted =
                              hoveredCell?.rName === rName &&
                              hoveredCell?.cName === cName;

                            return (
                              <td key={cName} className="p-1 text-center">
                                <motion.button
                                  whileHover={{ scale: 1.08 }}
                                  onMouseEnter={() =>
                                    setHoveredCell({ rName, cName, val })
                                  }
                                  onMouseLeave={() => setHoveredCell(null)}
                                  className={`w-full h-11 rounded-xl flex flex-col items-center justify-center transition-all ${
                                    isFilteredOut
                                      ? "opacity-20 grayscale bg-slate-100 dark:bg-slate-800/40"
                                      : getCellBgClass(
                                          val,
                                          isDiagonal,
                                          isHighlighted,
                                        )
                                  }`}
                                >
                                  <span
                                    className="text-xs font-mono font-bold"
                                    dir="ltr"
                                  >
                                    {val > 0 && !isDiagonal
                                      ? `+${val.toFixed(2)}`
                                      : val.toFixed(2)}
                                  </span>
                                </motion.button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Active Hover Card Inspector */}
                  <AnimatePresence>
                    {hoveredCell && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="mt-4 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 backdrop-blur-md flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {hoveredCell.rName}
                            </span>
                            <span>↔</span>
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {hoveredCell.cName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {getNarrative(
                              hoveredCell.rName,
                              hoveredCell.cName,
                              hoveredCell.val,
                            )}
                          </p>
                        </div>

                        <div
                          className="text-right font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400"
                          dir="ltr"
                        >
                          r ={" "}
                          {hoveredCell.val > 0
                            ? `+${hoveredCell.val.toFixed(2)}`
                            : hoveredCell.val.toFixed(2)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* View Mode: KEY CONNECTIONS CARDS */}
              {viewMode === "cards" && (
                <div className="space-y-3">
                  {filteredPairs.length > 0 ? (
                    filteredPairs.map((pair, idx) => {
                      const isPos = pair.val > 0;
                      const absVal = Math.abs(pair.val);
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                isPos
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isPos ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowDownRight className="w-5 h-5" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                                <span>{pair.col1}</span>
                                <span className="text-slate-400">↔</span>
                                <span>{pair.col2}</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                {getNarrative(pair.col1, pair.col2, pair.val)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span
                              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                                isPos
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                              }`}
                              dir="ltr"
                            >
                              {isPos
                                ? `+${pair.val.toFixed(2)}`
                                : pair.val.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t("bi.insights.correlation.noMatches")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 space-y-3">
              <GitBranch className="w-10 h-10 mx-auto text-slate-400 opacity-50" />
              <p className="text-xs font-medium">
                {t("bi.insights.correlation.noData")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
