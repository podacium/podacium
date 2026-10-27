"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Share2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  CreditCard,
  Landmark,
  BadgeDollarSign,
} from "lucide-react";
import { useTranslations, useLocale, useTextDirection } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

const CTX = "shared";

interface SharedHealthData {
  score: number;
  color: string;
  status: string;
  metrics: {
    margin?: number;
    revenue?: number;
    expenses?: number;
    debt?: number;
    buffer?: number;
  };
  trend?: { delta: number; direction: "up" | "down" | "flat" };
  shared_at?: string;
  shared_token?: string;
}

type HealthColor = "green" | "yellow" | "red";

const COLOR_CONFIG: Record<
  HealthColor,
  {
    text: string;
    ring: string;
    bg: string;
    soft: string;
    border: string;
    gradient: string;
    badgeText: string;
    badgeBg: string;
    dot: string;
  }
> = {
  green: {
    text: "text-emerald-600",
    ring: "text-emerald-500",
    bg: "bg-emerald-50",
    soft: "bg-emerald-50/50",
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-teal-400",
    badgeText: "text-emerald-700",
    badgeBg: "bg-emerald-100",
    dot: "bg-emerald-500",
  },
  yellow: {
    text: "text-amber-600",
    ring: "text-amber-500",
    bg: "bg-amber-50",
    soft: "bg-amber-50/50",
    border: "border-amber-200",
    gradient: "from-amber-500 to-orange-400",
    badgeText: "text-amber-700",
    badgeBg: "bg-amber-100",
    dot: "bg-amber-500",
  },
  red: {
    text: "text-red-600",
    ring: "text-red-500",
    bg: "bg-red-50",
    soft: "bg-red-50/50",
    border: "border-red-200",
    gradient: "from-red-500 to-rose-400",
    badgeText: "text-red-700",
    badgeBg: "bg-red-100",
    dot: "bg-red-500",
  },
};

function formatCurrency(
  value: number | undefined | null,
  locale: string,
): string {
  if (value == null) return "—";
  // Format in thousands with locale-aware formatting
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${abs.toLocaleString(locale)}`;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

function MetricCard({
  icon,
  label,
  value,
  color = "text-gray-900 dark:text-slate-100",
}: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function SharedInsightPage() {
  const params = useParams();
  const token = params?.token as string;
  const [data, setData] = useState<SharedHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const dir = useTextDirection();
  const ct = useTranslations();

  useEffect(() => {
    if (!token) return;
    loadSharedInsight();
  }, [token]);

  const loadSharedInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SharedHealthData>(`/api/shared/${token}`);
      setData(res);
    } catch (e: any) {
      if (e?.status === 410) setError("expired");
      else if (e?.status === 404) setError("notFound");
      else setError("loadFailed");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = ct("shared.card.shareInsight");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Podacium BI", text, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
  };

  const sharedT = (key: string, fallback: string) =>
    ct(`shared.${key}`, {}, fallback);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col"
        dir={dir}
      >
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-[80px] p-6">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-blue-100 dark:border-blue-900/50 rounded-full animate-spin border-t-blue-600" />
            <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
              {sharedT("loading", "Loading shared insight...")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    const isExpired = error === "expired";
    const title = isExpired
      ? sharedT("expired.title", "Insight Expired")
      : sharedT("notFoundTitle", "Insight Unavailable");
    const message = isExpired
      ? sharedT(
          "expired.message",
          "This shared insight is no longer available.",
        )
      : sharedT("expired.message", "We couldn't find this shared insight.");
    const hint = isExpired
      ? sharedT("expired.askSender", "Ask the sender to generate a new one.")
      : sharedT("card.publicNote", "");

    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col"
        dir={dir}
      >
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-[80px] p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50">
              {isExpired ? (
                <AlertCircle className="h-8 w-8 text-amber-500 dark:text-amber-400" />
              ) : (
                <BookOpen className="h-8 w-8 text-amber-500 dark:text-amber-400" />
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
            {hint && <p className="text-xs text-gray-400 mt-3">{hint}</p>}
          </motion.div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const score = data.score ?? 50;
  const color = (
    ["green", "yellow", "red"].includes(data.color) ? data.color : "yellow"
  ) as HealthColor;
  const c = COLOR_CONFIG[color];
  const m = data.metrics ?? {};
  const trend = data.trend;

  const trendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
        ? TrendingDown
        : Minus;
  const TrendIcon = trendIcon;
  const trendLabel =
    trend?.direction === "up"
      ? sharedT("card.trendUp", "Up")
      : trend?.direction === "down"
        ? sharedT("card.trendDown", "Down")
        : sharedT("card.trendFlat", "Stable");

  // Animated SVG circle — compute circumference once
  const R = 52;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col"
      dir={dir}
    >
      <Navbar />

      <main className="flex-1 pt-[80px] p-4 sm:p-6 lg:p-8">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* ── Top branding ─────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-md">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {sharedT("card.title", "Business Health")}
                  </h1>
                  <p className="text-xs text-gray-400">
                    {sharedT("card.subtitle", "Shared insight")}
                  </p>
                </div>
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-blue-200 dark:border-blue-800/80 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
                title={sharedT("card.shareInsight", "Share this insight")}
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {sharedT("card.shareButton", "Share")}
                </span>
              </button>
            </div>

            {/* ── Main Score Card ──────────────────────────────────── */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl border ${c.border} p-6 sm:p-8 mb-4`}
            >
              {/* Score gauge */}
              <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                <div className="relative w-36 h-36 flex-shrink-0">
                  <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={R}
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r={R}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      initial={{ strokeDashoffset: CIRC }}
                      animate={{ strokeDashoffset: CIRC * (1 - score / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={c.ring}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${c.text}`}>
                      {score}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                      {sharedT("card.scoreLabel", "Health Score")}
                    </span>
                  </div>
                </div>

                {/* Status + Trend */}
                <div className="flex-1 text-center sm:text-left">
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${c.badgeBg} ${c.badgeText} text-sm font-semibold mb-3`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`}
                    />
                    {sharedT(
                      `labels.${data.color || "average"}`,
                      data.status || "Average",
                    )}
                  </div>

                  {trend && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                      <TrendIcon
                        className={`h-4 w-4 ${trend.direction === "up" ? "text-emerald-500 dark:text-emerald-400" : trend.direction === "down" ? "text-red-500" : "text-gray-400"}`}
                      />
                      <span>{trendLabel}</span>
                      {trend.delta !== 0 && (
                        <span
                          className={`font-semibold ${trend.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {trend.delta > 0 ? "+" : ""}
                          {trend.delta}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  icon={<BadgeDollarSign className="h-5 w-5" />}
                  label={sharedT("card.margin", "Margin")}
                  value={`${m.margin ?? 0}%`}
                  color={c.text}
                />
                <MetricCard
                  icon={<DollarSign className="h-5 w-5" />}
                  label={sharedT("card.revenue", "Revenue")}
                  value={formatCurrency(m.revenue, locale)}
                />
                <MetricCard
                  icon={<CreditCard className="h-5 w-5" />}
                  label={sharedT("card.expenses", "Expenses")}
                  value={formatCurrency(m.expenses, locale)}
                />
                <MetricCard
                  icon={<Landmark className="h-5 w-5" />}
                  label={sharedT("card.debt", "Debt")}
                  value={formatCurrency(m.debt, locale)}
                  color={
                    m.debt
                      ? "text-red-600"
                      : "text-gray-900 dark:text-slate-100"
                  }
                />
              </div>
            </div>

            {/* ── Footer ────────────────────────────────────────────── */}
            <div className="text-center space-y-2">
              <p className="text-xs text-gray-400">
                {sharedT("card.sharedOn", "Shared on")}{" "}
                {data.shared_at
                  ? new Date(data.shared_at).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </p>
              <p className="text-xs text-gray-300">
                {sharedT("card.poweredBy", "Powered by Podacium BI")}
              </p>
              <p className="text-[11px] text-gray-300">
                {sharedT(
                  "card.publicNote",
                  "This is a publicly shared insight. Anyone with this link can view it.",
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
