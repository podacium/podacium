"use client";
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Database,
  BarChart3,
  Zap,
  ChevronRight,
  Layers,
  PieChart,
  ArrowRight,
  Shield,
  Clock,
  FileText,
  Info,
  RefreshCw,
  Building2,
  Plus,
  Smartphone,
  LineChart,
} from "lucide-react";
import { useBiHealth, useBiInsights } from "@/hooks/useBi";
import Link from "next/link";
import { formatDZD } from "@/lib/formatDZD";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";
import { ShareButton } from "./ShareButton";
import { BiAiCopilotBar } from "@/components/bi/analytics/BiAiCopilotBar";

type HealthColor = "green" | "yellow" | "red";

const COLOR_MAP: Record<
  HealthColor,
  {
    ring: string;
    text: string;
    bg: string;
    glow: string;
    badge: string;
    gradient: string;
  }
> = {
  green: {
    ring: "#22c55e",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    glow: "shadow-emerald-500/20",
    badge:
      "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
    gradient: "from-emerald-500 to-teal-400",
  },
  yellow: {
    ring: "#eab308",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    glow: "shadow-amber-500/20",
    badge:
      "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
    gradient: "from-amber-500 to-orange-400",
  },
  red: {
    ring: "#ef4444",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    glow: "shadow-red-500/20",
    badge: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300",
    gradient: "from-red-500 to-rose-400",
  },
};

const INSIGHT_SEVERITY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; icon: any }
> = {
  critical: {
    bg: "bg-red-50/50",
    border: "border-red-500",
    text: "text-red-700",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-amber-50/50",
    border: "border-amber-500",
    text: "text-amber-700",
    icon: AlertCircle,
  },
  opportunity: {
    bg: "bg-emerald-50/50",
    border: "border-emerald-500",
    text: "text-emerald-700",
    icon: TrendingUp,
  },
  info: {
    bg: "bg-blue-50/50",
    border: "border-blue-500",
    text: "text-blue-700",
    icon: Info,
  },
};

function AnimatedCounter({
  value,
  duration = 1.2,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      setDisplay(Math.round(p * value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{display}</>;
}

function HealthGauge({
  score,
  color,
  trend,
}: {
  score: number;
  color: HealthColor;
  trend?: { delta: number; direction: "up" | "down" | "flat" };
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.yellow;
  const r = 54,
    circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative w-44 h-44 mx-auto flex-shrink-0">
      <svg
        className="w-full h-full -rotate-90 drop-shadow-md"
        viewBox="0 0 120 120"
      >
        <defs>
          <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.ring} stopOpacity="1" />
            <stop offset="100%" stopColor={c.ring} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#hg)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-slate-100 tabular-nums">
          <AnimatedCounter value={score} />
        </span>
        {trend && trend.delta !== 0 ? (
          <div
            className={`flex items-center gap-0.5 text-[10px] font-bold ${trend.direction === "up" ? "text-emerald-500 dark:text-emerald-400" : "text-red-500"} bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-full shadow-sm mt-1 -mb-2 z-10`}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trend.delta > 0 ? "+" : ""}
            {trend.delta}
          </div>
        ) : (
          <span
            className={`text-xs font-bold uppercase tracking-widest mt-1 ${c.text}`}
          >
            / 100
          </span>
        )}
      </div>
    </div>
  );
}

const IMPACT_COLORS: Record<string, string> = {
  critical: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300",
  high: "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300",
  medium: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  low: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400",
  review:
    "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  approved:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  implemented:
    "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  archived: "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400",
};

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
  delay,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 p-4 sm:p-5 hover:shadow-lg hover:border-blue-200 dark:border-blue-800/50 dark:border-blue-800/80 transition-all duration-300 overflow-hidden"
    >
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br opacity-[0.04] -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"
        style={{
          backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
        }}
      />
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0`}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1">
            {label}
          </p>
          <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight truncate">
            {value}
          </p>
          {sub && (
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium truncate">
              {sub}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function NoOrganizationState({ locale, t }: { locale: string; t: any }) {
  const isRTL = locale === "ar";

  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center p-6 text-center ${isRTL ? "font-arabic" : ""}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full"
      >
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-100 dark:bg-blue-900/50 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100 mb-4 tracking-tight">
          {t("onboarding.noOrgTitle")}
        </h1>
        <p className="text-lg text-gray-600 dark:text-slate-400 mb-12 leading-relaxed">
          {t("onboarding.noOrgSubtitle")}
        </p>

        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow text-start">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/50">
              <Plus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("onboarding.createTitle")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
              {t("onboarding.createDesc")}
            </p>
            <Link
              href="/bi/organizations"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:gap-3 transition-all"
            >
              {t("onboarding.createCta")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow text-start">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900/50">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("onboarding.joinTitle")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
              {t("onboarding.joinDesc")}
            </p>
            <Link
              href="/settings/organizations"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:gap-3 transition-all"
            >
              {t("onboarding.joinCta")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="bg-gray-50/50 dark:bg-slate-800/60 rounded-3xl p-8 border border-gray-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">
            {t("onboarding.infoTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-start">
            {[
              {
                id: 1,
                icon: Database,
                color: "text-blue-500",
                bg: "bg-blue-50",
              },
              {
                id: 2,
                icon: Brain,
                color: "text-purple-500",
                bg: "bg-purple-50",
              },
              {
                id: 3,
                icon: Smartphone,
                color: "text-emerald-500",
                bg: "bg-emerald-50",
              },
              {
                id: 4,
                icon: LineChart,
                color: "text-rose-500",
                bg: "bg-rose-50",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm"
                >
                  <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t(`onboarding.info${item.id}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function AuthenticatedBIHome({
  onNeedsSetup,
}: {
  onNeedsSetup?: () => void;
}) {
  const t = useTranslations("bi");
  const locale = t.i18n.language;
  const healthQuery = useBiHealth(undefined, locale);
  const insightsQuery = useBiInsights(locale);
  const data = healthQuery.data;
  const insights = insightsQuery.data?.insights || [];
  const loading = healthQuery.isLoading || insightsQuery.isLoading;
  const refreshingInsights = insightsQuery.isFetching;

  const healthError: any = healthQuery.error;
  const error = (() => {
    if (!healthError) return null;
    const isMissingOrg =
      healthError.code === "missing_organization_id" ||
      healthError.message === "bi.analytics.error.missingOrgId" ||
      healthError.details?.detail?.type === "missing_organization_id";
    return isMissingOrg
      ? "missing_organization_id"
      : healthError?.message || t("error.healthScoreFailed");
  })();

  const handleRetry = () => {
    healthQuery.refetch();
    insightsQuery.refetch();
  };

  const pipelineCounts = useMemo(() => {
    const s = data?.decisions?.byStatus ?? {};
    return [
      {
        label: t("decisions.status.draft"),
        count: s.draft ?? 0,
        color: "bg-gray-400",
      },
      {
        label: t("decisions.status.review"),
        count: s.review ?? 0,
        color: "bg-amber-400",
      },
      {
        label: t("decisions.status.approved"),
        count: s.approved ?? 0,
        color: "bg-emerald-400",
      },
      {
        label: t("decisions.status.implemented"),
        count: s.implemented ?? 0,
        color: "bg-blue-400",
      },
    ];
  }, [data?.decisions?.byStatus, t]);

  const handleRefreshInsights = async () => {
    if (refreshingInsights) return;
    try {
      await insightsQuery.refetch();
      toast.success(t("home.insights.refreshed"));
    } catch (e) {
      console.error("Failed to refresh insights", e);
      toast.error(t("home.insights.refreshFailed"));
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900/50 rounded-full animate-spin border-t-blue-600" />
          <Brain className="w-7 h-7 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">
          {t("accessibility.loadingAnalytics")}
        </p>
      </div>
    );

  if (error === "missing_organization_id") {
    return <NoOrganizationState locale={locale} t={t} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/60">
          <AlertCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t("error.loadFailed")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md text-center">
          {t("error.loadFailedDesc")}
        </p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t("retry")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const score = data?.score ?? 50;
  const color: HealthColor = (
    ["green", "yellow", "red"].includes(data?.color) ? data.color : "yellow"
  ) as HealthColor;
  const statusLabel = data?.status ?? "Unknown";
  const m = data?.metrics ?? {};
  const ds = data?.datasets ?? { total: 0, recent: [] };
  const dec = data?.decisions ?? { total: 0, byStatus: {}, recent: [] };
  const c = COLOR_MAP[color];
  const margin = m.margin ?? 0;
  const trend = data?.trend;
  const season = data?.season;

  const pipelineTotal = pipelineCounts.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 sm:mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              {t("home.header.badge")}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            {t("home.header.title")}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-1 font-medium">
            {t("home.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <Link
            href="/bi/datasets"
            className="flex-1 lg:flex-none justify-center group flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 text-gray-700 dark:text-slate-300 rounded-xl hover:border-blue-300 dark:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all text-xs sm:text-sm font-bold shadow-sm"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t("hero.integrations.datasets")}
            </span>
            <span className="sm:hidden">{t("hero.integrations.datasets")}</span>
          </Link>
          <Link
            href="/bi/dashboards"
            className="flex-1 lg:flex-none justify-center group flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-md hover:shadow-blue-500/20 transition-all text-xs sm:text-sm font-bold"
          >
            <BarChart3 className="w-4 h-4" />
            {t("hero.integrations.dashboards")}
            <ArrowRight className="w-3.5 h-3.5 hidden sm:inline group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </motion.div>

      {/* AI Copilot & Natural Language Query Search Bar */}
      <BiAiCopilotBar />

      {/* ── KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <KPICard
          icon={TrendingUp}
          label={t("home.kpi.revenue")}
          value={formatDZD(m.revenue ?? 0, { compact: true })}
          gradient="from-emerald-500 to-teal-400"
          delay={0.05}
        />
        <KPICard
          icon={ArrowDownRight}
          label={t("home.kpi.expenses")}
          value={formatDZD(m.expenses ?? 0, { compact: true })}
          gradient="from-rose-500 to-pink-400"
          delay={0.1}
        />
        <KPICard
          icon={Layers}
          label={t("home.kpi.datasets")}
          value={ds.total.toString()}
          sub={t("home.kpi.records", {
            count: (m.totalRecords ?? 0).toLocaleString(),
          })}
          gradient="from-violet-500 to-purple-400"
          delay={0.15}
        />
        <KPICard
          icon={Target}
          label={t("home.kpi.decisions")}
          value={dec.total.toString()}
          sub={t("home.kpi.approved", {
            count: dec.byStatus?.approved ?? 0,
          })}
          gradient="from-blue-500 to-indigo-400"
          delay={0.2}
        />
      </div>

      {/* ── Main Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Health Score Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.15,
            type: "spring",
            stiffness: 200,
            damping: 24,
          }}
          className={`col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-200/50 dark:border-slate-800/50 p-5 sm:p-7 shadow-sm hover:shadow-md ${c.glow} transition-all duration-300 flex flex-col`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
              {t("home.health.title")}
            </h2>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${c.badge}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <HealthGauge score={score} color={color} trend={trend} />

            {season && season.season !== "normal" && (
              <div className="mt-4 mx-auto max-w-[200px] text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/50">
                  <Activity className="w-3 h-3" /> {t("home.health.season")}:{" "}
                  {season.season}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-6 sm:mt-8">
              <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-3 sm:p-4 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("home.health.margin")}
                </p>
                <p className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                  {margin}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-3 sm:p-4 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("home.health.cashBuffer")}
                </p>
                <p className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                  {formatDZD(m.buffer ?? 0, {
                    compact: true,
                    showSymbol: false,
                  })}
                </p>
              </div>
            </div>

            {(m.debt ?? 0) > 0 && (
              <div className="mt-3 sm:mt-4 flex items-start sm:items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/40 dark:bg-red-950/60 rounded-xl border border-red-100 dark:border-red-900/50 dark:border-red-900/50">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-[11px] sm:text-xs font-bold text-red-700 dark:text-red-300 leading-tight">
                  {t("home.health.informalDebt", {
                    amount: formatDZD(m.debt, { compact: true }),
                  })}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-4 sm:gap-6">
          {/* Insights */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-200/50 dark:border-slate-800/50 p-5 sm:p-6 shadow-sm flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-200 uppercase tracking-widest">
                  {t("home.insights.title")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton />
                <button
                  onClick={handleRefreshInsights}
                  disabled={refreshingInsights}
                  aria-label={t("home.health.refresh")}
                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors disabled:opacity-50"
                  title={t("home.health.refresh")}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshingInsights ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            {insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 flex-1">
                {insights.slice(0, 4).map((ins: any, i: number) => {
                  const severityConfig =
                    INSIGHT_SEVERITY_COLORS[ins.severity || "info"] ||
                    INSIGHT_SEVERITY_COLORS.info;
                  const IconEl = severityConfig.icon;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className={`border border-l-4 ${severityConfig.bg} ${severityConfig.border} rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 dark:border-slate-800 ${severityConfig.text}`}
                      >
                        <IconEl className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 mb-1">
                          {ins.title}
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                          {ins.body}
                        </p>
                        {ins.action && (
                          <div className="mt-2 pt-2 border-t border-black/5">
                            <p
                              className={`text-[10px] sm:text-[11px] font-bold ${severityConfig.text}`}
                            >
                              → {ins.action}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 flex-1 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-800/60">
                <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 text-center px-4">
                  {t("home.insights.emptyTitle")}
                </p>
                <Link
                  href="/bi/datasets"
                  className="mt-4 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors shadow-sm"
                >
                  {t("home.insights.emptyCta")}
                </Link>
              </div>
            )}
          </motion.div>

          {/* Decision Pipeline + Recent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Pipeline */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-200/50 dark:border-slate-800/50 p-5 sm:p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                  {t("home.pipeline.title")}
                </h2>
                <Link
                  href="/bi/decisions"
                  className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {t("home.pipeline.viewAll")}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex rounded-full overflow-hidden h-2.5 sm:h-3 mb-4 bg-gray-100 dark:bg-slate-800">
                {pipelineCounts.map(
                  (p, i) =>
                    p.count > 0 && (
                      <motion.div
                        key={i}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(p.count / pipelineTotal) * 100}%`,
                        }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                        className={`${p.color} first:rounded-l-full last:rounded-r-full`}
                      />
                    ),
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {pipelineCounts.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[10px] sm:text-xs"
                  >
                    <div
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${p.color}`}
                    />
                    <span className="text-gray-500 dark:text-slate-400 font-medium truncate">
                      {p.label}
                    </span>
                    <span className="ml-auto font-bold text-gray-900 dark:text-slate-100">
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Decisions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-200/50 dark:border-slate-800/50 p-5 sm:p-6 shadow-sm"
            >
              <h2 className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4 sm:mb-5">
                {t("home.pipeline.recentTitle")}
              </h2>
              {(dec.recent?.length ?? 0) > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {dec.recent.slice(0, 3).map((d: any, i: number) => (
                    <Link
                      key={d.id}
                      href={`/bi/decisions`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-blue-400 to-blue-200 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {d.title}
                        </p>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase ${STATUS_COLORS[d.status] ?? "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}
                          >
                            {t(`decisions.status.${d.status}`)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase ${IMPACT_COLORS[d.impactLevel] ?? "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}
                          >
                            {t(`decisions.impact.${d.impactLevel}`)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-blue-500 dark:text-blue-400 transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 sm:py-6">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[11px] sm:text-xs text-gray-400 font-bold">
                    {t("home.pipeline.emptyTitle")}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
