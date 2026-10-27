"use client";

import {
  Rows3,
  Columns,
  ShieldCheck,
  Activity,
  Brain,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  BiDatasetMetadata,
  BiQualityResult,
  BiAnalyticsResult,
} from "@/lib/api";
import {
  BI_DOMAINS,
  TabId,
  formatNumber,
  formatDate,
  getDomainLabel,
} from "./types";

export function OverviewTab({
  dataset,
  quality,
  analytics,
  t,
  onNavigateTab,
  onOpenCleanModal,
  locale,
}: {
  dataset: BiDatasetMetadata;
  quality?: BiQualityResult | null;
  analytics?: BiAnalyticsResult | null;
  t: (key: string, params?: any) => string;
  onNavigateTab?: (tab: TabId) => void;
  onOpenCleanModal?: () => void;
  locale?: string;
}) {
  const domainLabel = getDomainLabel(dataset.domain, t);
  const columnsList = dataset.columns || [];

  const completeness =
    dataset.quality_metrics?.completeness_score ??
    quality?.summary?.completeness ??
    96;
  const duplicateRatio = dataset.quality_metrics?.duplicate_ratio ?? 0;
  const uniqueness = Math.round(100 - duplicateRatio);

  const issuesCount = quality?.issues?.length || 0;
  const issuesText = issuesCount
    ? t("bi.datasets.detail.tabs.overview.aiSummary.issuesDetected", {
        count: issuesCount,
      })
    : t("bi.datasets.detail.tabs.overview.aiSummary.noIssues");

  return (
    <div className="space-y-6">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>
              {t("bi.datasets.detail.tabs.overview.metrics.completeness")}
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {completeness}%
          </span>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>
              {t("bi.datasets.detail.tabs.quality.metrics.uniqueness")}
            </span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {uniqueness}%
          </span>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${uniqueness}%` }}
            />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>{t("bi.datasets.detail.tabs.overview.metrics.columns")}</span>
            <Columns className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {columnsList.length}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            {t("bi.datasets.detail.tabs.schema.columnsCount")}
          </span>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>{t("bi.datasets.detail.tabs.overview.info.domain")}</span>
            <Rows3 className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate block">
            {domainLabel}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            {t("bi.datasets.detail.tabs.overview.info.title")}
          </span>
        </div>
      </div>

      {/* Details & AI Executive Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t("bi.datasets.detail.tabs.overview.info.title")}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.overview.info.format")}
              </span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100 uppercase">
                {dataset.format || "CSV"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.overview.info.domain")}
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {domainLabel}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.overview.info.created")}
              </span>
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {formatDate(dataset.created_at, true, locale)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.overview.info.updated")}
              </span>
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {formatDate(dataset.updated_at, true, locale)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t("bi.datasets.detail.tabs.overview.aiSummary.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t("bi.datasets.detail.tabs.overview.aiSummary.narrative", {
                rows: formatNumber(dataset.row_count, locale),
                columns: columnsList.length,
                score: dataset.quality_score ?? 85,
                issuesText,
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {onOpenCleanModal && (
              <button
                onClick={onOpenCleanModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t("bi.datasets.detail.tabs.overview.aiSummary.cleanData")}
              </button>
            )}
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab("analytics")}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                {t("bi.datasets.detail.tabs.overview.aiSummary.viewAnalytics")}{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
