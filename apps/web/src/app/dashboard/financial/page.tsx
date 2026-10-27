"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  ChevronRight,
  DollarSign,
  Wallet,
  Banknote,
  PieChart,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RoleGuard } from "@/components/dashboard/RoleGuard";
import { api } from "@/lib/api";
import {
  StatCard,
  SectionCard,
  EmptyState,
} from "@/components/SectionComponents";
import { formatCurrency, formatDate } from "@/lib/dashboard/utils";

interface FinancialStats {
  totalRevenue: number;
  pendingPayouts: number;
  availableBalance: number;
  revenueByPillar: {
    teaching: number;
    freelancing: number;
    business: number;
    other: number;
  };
  revenueTrend: number;
}

interface RevenueEntry {
  month: string;
  amount: number;
  pillar: string;
}

interface PayoutEntry {
  id: number;
  amount: number;
  status: string;
  date: string;
  method: string;
}

interface FinancialData {
  stats: FinancialStats;
  revenue: RevenueEntry[];
  payoutHistory: PayoutEntry[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const pillarConfig = [
  {
    key: "teaching" as const,
    label: "Teaching",
    color: "from-blue-500 to-blue-400",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    key: "freelancing" as const,
    label: "Freelancing",
    color: "from-emerald-500 to-teal-400",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    key: "business" as const,
    label: "Business",
    color: "from-purple-500 to-violet-400",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    key: "other" as const,
    label: "Other",
    color: "from-amber-500 to-orange-400",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

export default function FinancialDashboardPage() {
  const t = useTranslations("user");
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [financialRes, revenueRes] = await Promise.all([
        api.get<any>("/api/v1/dashboard/financial"),
        api.get<any>("/api/v1/dashboard/financial/revenue"),
      ]);
      const statsObj = financialRes?.stats || financialRes || {};
      const revenuePillars = statsObj.revenueByPillar ||
        statsObj.by_pillar || {
          teaching: 0,
          freelancing: 0,
          business: 0,
          other: 0,
        };
      const revenueList = Array.isArray(revenueRes)
        ? revenueRes
        : revenueRes?.by_month || revenueRes?.by_pillar || [];

      setData({
        stats: {
          totalRevenue: statsObj.totalRevenue ?? statsObj.total_revenue ?? 0,
          pendingPayouts:
            statsObj.pendingPayouts ?? statsObj.pending_payouts ?? 0,
          availableBalance:
            statsObj.availableBalance ?? statsObj.available_balance ?? 0,
          revenueByPillar: {
            teaching: revenuePillars.teaching ?? revenuePillars.education ?? 0,
            freelancing: revenuePillars.freelancing ?? 0,
            business: revenuePillars.business ?? 0,
            other: revenuePillars.other ?? 0,
          },
          revenueTrend: statsObj.revenueTrend ?? statsObj.revenue_trend ?? 0,
        },
        revenue: revenueList,
        payoutHistory: [],
      });
    } catch (err: any) {
      setError(err?.message || t("dashboard.financial.error.title"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (authLoading || loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
            <p className="text-gray-500 dark:text-slate-400">
              {t("dashboard.financial.loading")}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
              <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-gray-900 dark:text-slate-100 font-medium mb-2">
              {t("dashboard.financial.error.title")}
            </p>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              {error}
            </p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.financial.error.retry")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !data) return null;

  const { stats, revenue, payoutHistory } = data;

  const pillarTotal =
    (stats?.revenueByPillar
      ? Object.values(stats.revenueByPillar).reduce((a, b) => a + b, 0)
      : 0) || 1;

  return (
    <RoleGuard allowedRoles={["INSTRUCTOR", "BUSINESS", "FREELANCER", "ADMIN"]}>
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-8"
          >
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              <span>{t("dashboard.breadcrumb.home")}</span>
            </Link>
            <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            <Link
              href="/dashboard"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("dashboard.breadcrumb.dashboard")}
            </Link>
            <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            <span className="text-gray-900 dark:text-slate-100 font-medium">
              {t("dashboard.financial.breadcrumb")}
            </span>
          </motion.nav>

          <DashboardTabs />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {t("dashboard.financial.title")}
                  </h1>
                  <p className="text-gray-500 dark:text-slate-400 mt-1">
                    {t("dashboard.financial.description")}
                  </p>
                </div>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("dashboard.financial.refresh")}
                </button>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <StatCard
                icon={<DollarSign className="w-5 h-5" />}
                label={t("dashboard.financial.stats.totalRevenue")}
                value={formatCurrency(stats.totalRevenue)}
                gradient="from-emerald-600 to-emerald-400"
                delay={0.05}
                trend={
                  stats.revenueTrend
                    ? {
                        value: Math.abs(stats.revenueTrend),
                        isPositive: stats.revenueTrend >= 0,
                      }
                    : undefined
                }
              />
              <StatCard
                icon={<Wallet className="w-5 h-5" />}
                label={t("dashboard.financial.stats.pendingPayouts")}
                value={formatCurrency(stats.pendingPayouts)}
                gradient="from-amber-500 to-amber-400"
                delay={0.1}
              />
              <StatCard
                icon={<Banknote className="w-5 h-5" />}
                label={t("dashboard.financial.stats.availableBalance")}
                value={formatCurrency(stats.availableBalance)}
                gradient="from-blue-600 to-blue-400"
                delay={0.15}
              />
              <StatCard
                icon={<PieChart className="w-5 h-5" />}
                label={t("dashboard.financial.stats.revenueByPillar")}
                value={`${pillarConfig.length} ${t("dashboard.financial.stats.pillars", { count: String(pillarConfig.length) })}`}
                gradient="from-purple-600 to-violet-400"
                delay={0.2}
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <motion.div variants={itemVariants} className="lg:col-span-2">
                <SectionCard
                  title={t("dashboard.financial.revenueBreakdown.title")}
                  icon={<PieChart className="w-5 h-5" />}
                  description={t(
                    "dashboard.financial.revenueBreakdown.description",
                  )}
                >
                  <div className="space-y-5">
                    {pillarConfig.map((pillar, i) => {
                      const amount = stats.revenueByPillar[pillar.key];
                      const percentage = (amount / pillarTotal) * 100;
                      return (
                        <div key={pillar.key}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg bg-gradient-to-br ${pillar.color} shadow-sm`}
                              >
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d={pillar.icon}
                                  />
                                </svg>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                  {t(
                                    "dashboard.financial.pillars." + pillar.key,
                                  )}
                                </span>
                                <p className="text-xs text-gray-400">
                                  {percentage.toFixed(1)}
                                  {t(
                                    "dashboard.financial.revenueBreakdown.ofTotal",
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                          <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 }}
                              className={`h-full rounded-full bg-gradient-to-r ${pillar.color}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </motion.div>

              <motion.div variants={itemVariants}>
                <SectionCard
                  title={t("dashboard.financial.revenueSummary.title")}
                  icon={<DollarSign className="w-5 h-5" />}
                  description={t(
                    "dashboard.financial.revenueSummary.description",
                  )}
                >
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-50/50 dark:from-emerald-950/40 dark:to-emerald-950/20">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-emerald-500">
                          <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          {t("dashboard.financial.revenueSummary.totalRevenue")}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {formatCurrency(stats.totalRevenue)}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/40 dark:to-amber-950/20">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-500">
                          <Wallet className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          {t(
                            "dashboard.financial.revenueSummary.pendingPayouts",
                          )}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(stats.pendingPayouts)}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/40 dark:to-blue-950/20">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-500">
                          <Banknote className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          {t(
                            "dashboard.financial.revenueSummary.availableBalance",
                          )}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(stats.availableBalance)}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </motion.div>
            </div>

            <motion.div variants={itemVariants}>
              <SectionCard
                title={t("dashboard.financial.revenueOverTime.title")}
                icon={<TrendingUp className="w-5 h-5" />}
                description={t(
                  "dashboard.financial.revenueOverTime.description",
                )}
              >
                {revenue.length > 0 ? (
                  <div className="space-y-3">
                    {revenue.slice(-12).map((item, i) => {
                      const maxAmount = Math.max(
                        ...revenue.map((r) => r.amount),
                        1,
                      );
                      const barWidth = (item.amount / maxAmount) * 100;
                      return (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-sm text-gray-500 dark:text-slate-400 w-20 shrink-0">
                            {item.month}
                          </span>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05 }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-24 text-right">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.financial.revenueOverTime.empty.title")}
                    description={t(
                      "dashboard.financial.revenueOverTime.empty.description",
                    )}
                  />
                )}
              </SectionCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SectionCard
                title={t("dashboard.financial.payoutHistory.title")}
                icon={<Wallet className="w-5 h-5" />}
                description={t("dashboard.financial.payoutHistory.description")}
              >
                {payoutHistory.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {payoutHistory.map((payout, i) => (
                      <motion.div
                        key={payout.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              payout.status === "completed"
                                ? "bg-emerald-100"
                                : payout.status === "pending"
                                  ? "bg-amber-100"
                                  : "bg-gray-100 dark:bg-slate-800"
                            }`}
                          >
                            {payout.status === "completed" ? (
                              <ArrowUpRight
                                className={`w-4 h-4 ${
                                  payout.status === "completed"
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                                }`}
                              />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">
                              {formatCurrency(payout.amount)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {payout.method} &middot;{" "}
                              {new Date(payout.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            payout.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : payout.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                          }`}
                        >
                          {payout.status}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Wallet className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.financial.payoutHistory.empty.title")}
                    description={t(
                      "dashboard.financial.payoutHistory.empty.description",
                    )}
                  />
                )}
              </SectionCard>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </RoleGuard>
  );
}
