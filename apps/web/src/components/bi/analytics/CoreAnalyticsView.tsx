"use client";

import React from "react";
import { useTranslations } from "@/lib/i18n";
import { formatDZD } from "@/lib/formatDZD";
import { SmartChartLazy as SmartChart } from "@/components/bi/dashboards/SmartChartLazy";
import { AnalyticsCard } from "./AnalyticsCard";
import {
  TrendingUp,
  ArrowLeftRight,
  PieChart,
  Microscope,
  Sliders,
  LineChart,
  Network,
  AlertTriangle,
  Filter,
  Wallet,
  Sparkles,
  BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";

interface CoreAnalyticsViewProps {
  data: any;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectAnother?: () => void;
}

export function CoreAnalyticsView({
  data,
  loading,
  error,
  onRetry,
  onSelectAnother,
}: CoreAnalyticsViewProps) {
  const { t, i18n } = useTranslations("bi");
  const locale = i18n.language;

  if (loading) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-1"
        role="status"
        aria-busy="true"
        aria-label={t("accessibility.loadingAnalytics")}
      >
        <span
          className="sr-only"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            borderWidth: 0,
          }}
        >
          {t("accessibility.loadingAnalytics")}
        </span>
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="h-[420px] bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 animate-pulse shadow-sm"
              aria-hidden="true"
            />
          ))}
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 py-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-red-100 dark:border-red-900/50 rounded-[2rem] shadow-sm text-center"
        role="alert"
      >
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {error}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md font-medium">
          {t("analytics.errors.analysisFailedDesc")}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all text-sm uppercase tracking-wider"
            >
              <BarChart2 className="w-4 h-4" />
              {t("analytics.errors.retry")}
            </button>
          )}
          {onSelectAnother && (
            <button
              onClick={onSelectAnother}
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all text-sm uppercase tracking-wider"
            >
              {t("analytics.errors.selectAnother")}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 py-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-gray-100 dark:border-slate-800 rounded-[2rem] shadow-sm text-center"
      >
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center">
          <BarChart2 className="w-8 h-8 text-blue-500 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {t("analytics.empty.title")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md font-medium">
          {t("analytics.empty.description")}
        </p>
        {onSelectAnother && (
          <button
            onClick={onSelectAnother}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all text-sm uppercase tracking-wider mt-2"
          >
            {t("analytics.errors.selectAnother")}
          </button>
        )}
      </motion.div>
    );
  }

  const sections = [
    {
      key: "trend",
      icon: TrendingUp,
      colors: ["#3B82F6"],
      colSpan: "md:col-span-2",
      render: (d: any) => (
        <SmartChart
          type="area"
          data={d.data_points}
          categoryKey="period"
          dataKey="total_value"
          height="100%"
          colors={["#3B82F6"]}
          format={{ type: "number", decimals: 0 }}
          config={{ grid: { show: false } }}
        />
      ),
    },
    {
      key: "comparative",
      icon: ArrowLeftRight,
      render: (d: any) => (
        <div className="flex flex-col gap-4 h-full justify-center px-2">
          <div className="group bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100/60 dark:hover:bg-blue-900/60 transition-colors rounded-2xl p-6 relative overflow-hidden border border-blue-100 dark:border-blue-900/50">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
              {t("analytics.core.comparative.mom")}
            </div>
            <div
              className={`text-4xl font-black ${d.mom_growth_pct >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"}`}
            >
              {d.mom_growth_pct > 0 ? "+" : ""}
              {d.mom_growth_pct}%
            </div>
          </div>
          <div className="group bg-violet-50/50 hover:bg-violet-50 transition-colors rounded-2xl p-6 relative overflow-hidden border border-violet-100/50">
            <div className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">
              {t("analytics.core.comparative.yoy")}
            </div>
            <div
              className={`text-4xl font-black ${d.yoy_growth_pct >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"}`}
            >
              {d.yoy_growth_pct > 0 ? "+" : ""}
              {d.yoy_growth_pct}%
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "segmentation",
      icon: PieChart,
      render: (d: any) => (
        <SmartChart
          type="pie"
          data={d.segments[0]?.data || []}
          categoryKey="segment"
          dataKey="total"
          height="100%"
          colors={["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"]}
          format={{ type: "percentage", decimals: 1 }}
        />
      ),
    },
    {
      key: "root_cause",
      icon: Microscope,
      colSpan: "md:col-span-2",
      render: (d: any) => (
        <SmartChart
          type="bar"
          data={d.drivers}
          categoryKey="driver"
          dataKey="impact_score"
          height="100%"
          colors={["#EF4444"]}
          format={{ type: "number", decimals: 2 }}
        />
      ),
    },
    {
      key: "what_if",
      icon: Sliders,
      render: (d: any) => (
        <SmartChart
          type="bar"
          data={d.scenarios}
          categoryKey="label"
          dataKey="projected_value"
          height="100%"
          colors={["#F59E0B"]}
          format={{ type: "currency", decimals: 0 }}
        />
      ),
    },

    {
      key: "forecasting",
      icon: LineChart,
      colSpan: "md:col-span-2",
      render: (d: any) => (
        <SmartChart
          type="area"
          data={
            d.projections?.map((p: any) => ({
              ...p,
              period: t(`analytics.core.forecasting.periods.${p.period}`),
            })) || []
          }
          categoryKey="period"
          dataKey="prediction"
          height="100%"
          colors={["#10B981"]}
          format={{ type: "currency", decimals: 0 }}
        />
      ),
    },
    {
      key: "correlation",
      icon: Network,
      render: (d: any) => (
        <SmartChart
          type="table"
          data={Object.keys(d.matrix[0])
            .filter((k) => k !== "variable")
            .map((k) => ({
              variable: k,
              correlation: d.matrix[0][k],
            }))}
          categoryKey="variable"
          dataKey="correlation"
          height="100%"
          format={{ type: "number", decimals: 2 }}
        />
      ),
    },
    {
      key: "anomaly",
      icon: AlertTriangle,
      render: (d: any) => (
        <SmartChart
          type="table"
          data={d.top_anomalies?.slice(0, 5) || []}
          categoryKey="id"
          dataKey="z_score"
          height="100%"
          format={{ type: "number", decimals: 2 }}
        />
      ),
    },
    {
      key: "funnel",
      icon: Filter,
      render: (d: any) => (
        <SmartChart
          type="bar"
          data={d.stages}
          categoryKey="stage"
          dataKey="volume"
          height="100%"
          colors={["#6366F1"]}
        />
      ),
    },
    {
      key: "profitability",
      icon: Wallet,
      render: (d: any) => (
        <div className="flex flex-col gap-4 h-full justify-center px-2">
          {d.insight?.key === "missing" ? (
            <div className="bg-amber-50 dark:bg-amber-950/40 dark:bg-amber-950/60 rounded-2xl p-6 border border-amber-100 dark:border-amber-900/50 dark:border-amber-900/50 text-center">
              <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">
                {t("analytics.core.profitability.title")}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-400 font-medium italic">
                {t("analytics.core.profitability.insights.missing")}
              </div>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 dark:bg-emerald-950/60 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/50 dark:border-emerald-900/50">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                  {t("analytics.core.profitability.grossMargin")}
                </div>
                <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                  {d.metrics?.gross_margin_pct ?? 0}%
                </div>
              </div>
              <div className="bg-blue-50/80 dark:bg-blue-950/60 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/50">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                  {t("analytics.core.profitability.totalRevenue")}
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 truncate">
                  {formatDZD(d.metrics?.total_revenue ?? 0)}
                </div>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  const summary = data.summary;
  // We already have t from 'bi'

  return (
    <div className="space-y-8">
      {/* Executive Summary Card */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          role="region"
          aria-label={t("analytics.summary.title")}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 text-white shadow-2xl shadow-indigo-500/20"
        >
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -ml-32 -mb-32" />

          <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md ring-1 ring-white/20">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">
                  {t("analytics.summary.title")}
                </h3>
              </div>
              <p className="text-indigo-100 text-lg font-medium leading-relaxed mb-6 italic opacity-90">
                &ldquo;
                {t(`analytics.summary.insights.${summary.key}`, summary.params)}
                &rdquo;
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="px-4 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/15 text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-indigo-200">
                  <BarChart2 className="w-3.5 h-3.5" />
                  {data.metadata?.target_column}
                </div>
                <div className="px-4 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/15 text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-indigo-200">
                  <Filter className="w-3.5 h-3.5" />
                  {data.metadata?.categorical_count}{" "}
                  {t("analytics.analysis.generalDomain")}
                </div>
              </div>
            </div>

            {/* Health Score & Confidence Score Gauges */}
            <div className="flex flex-row gap-4">
              {/* Health Score Gauge */}
              <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
                <div className="relative w-24 h-24 mb-3">
                  <svg
                    className="w-full h-full -rotate-90"
                    role="img"
                    aria-label={t("accessibility.healthScore", {
                      score: summary.params?.health_score || 0,
                    })}
                  >
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke={
                        summary.params?.health_score >= 70
                          ? "#10B981"
                          : summary.params?.health_score >= 40
                            ? "#F59E0B"
                            : "#EF4444"
                      }
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={
                        251.2 * (1 - (summary.params?.health_score || 0) / 100)
                      }
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">
                    {summary.params?.health_score}%
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                  {t("analytics.summary.healthScore")}
                </span>
              </div>

              {/* Confidence Score Gauge */}
              <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
                <div className="relative w-24 h-24 mb-3">
                  <svg
                    className="w-full h-full -rotate-90"
                    role="img"
                    aria-label={t("accessibility.confidenceGauge", {
                      score: summary.params?.score || 0,
                    })}
                  >
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke="white"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={
                        251.2 * (1 - (summary.params?.score || 0) / 100)
                      }
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">
                    {summary.params?.score}%
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                  {t("analytics.summary.confidenceScore")}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20"
        role="region"
        aria-label={t("accessibility.analyticsCards")}
      >
        {sections.map((section, idx) => {
          const sectionData = data[section.key];
          if (!sectionData) return null;

          // Handle localized insight
          let localizedInsight = "";
          if (sectionData.insight && typeof sectionData.insight === "object") {
            const { key, params } = sectionData.insight;
            const finalParams = { ...params };

            // Specific handling for trajectory translation
            if (key === "trajectory" && params.trajectory) {
              finalParams.trajectory = t(
                `common.trajectories.${params.trajectory}`,
              );
            }

            localizedInsight = t(
              `analytics.core.${section.key}.insights.${key}`,
              finalParams,
            );
          } else {
            localizedInsight = sectionData.insight || "";
          }

          return (
            <motion.div
              key={section.key}
              className={section.colSpan || ""}
              layout
            >
              <AnalyticsCard
                title={t(`analytics.core.${section.key}.title`)}
                description={localizedInsight}
                icon={section.icon}
                delay={idx * 0.05}
                className="h-[400px]"
              >
                {section.render(sectionData)}
              </AnalyticsCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
