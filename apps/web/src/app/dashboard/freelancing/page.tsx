"use client";

import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  Briefcase,
  DollarSign,
  Star,
  Users,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Layout,
  GraduationCap,
  Building2,
  Award,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { RoleGuard } from "@/components/dashboard/RoleGuard";
import { formatCurrency, formatDate } from "@/lib/dashboard/utils";
import { cn } from "@/lib/utils";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

interface FreelancingStats {
  active_projects: number;
  completed_projects: number;
  total_earnings: number;
  pending_proposals: number;
  avg_rating: number;
  response_rate: number;
}

interface EarningsData {
  monthly: { month: string; amount: number }[];
  total: number;
  pending: number;
  withdrawn: number;
}

interface RecentProposal {
  id: number;
  project_title: string;
  amount: number;
  status: string;
  created_at: string;
}

interface ProjectStatusBreakdown {
  open: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

interface FreelancingDashboardData {
  stats: FreelancingStats;
  earnings: EarningsData;
  recent_proposals: RecentProposal[];
  project_status: ProjectStatusBreakdown;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function formatPercent(value?: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatRating(value?: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0.0";
  return value.toFixed(1);
}

export default function FreelancingDashboardPage() {
  const t = useTranslations("user");
  const { user } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const statCards = [
    {
      key: "active_projects",
      label: t("dashboard.freelancing.stats.activeProjects"),
      icon: Briefcase,
      color: "from-blue-500 to-blue-600",
    },
    {
      key: "completed_projects",
      label: t("dashboard.freelancing.stats.completedProjects"),
      icon: CheckCircle,
      color: "from-green-500 to-green-600",
    },
    {
      key: "total_earnings",
      label: t("dashboard.freelancing.stats.totalEarnings"),
      icon: DollarSign,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      key: "pending_proposals",
      label: t("dashboard.freelancing.stats.pendingProposals"),
      icon: FileText,
      color: "from-amber-500 to-amber-600",
    },
    {
      key: "avg_rating",
      label: t("dashboard.freelancing.stats.avgRating"),
      icon: Star,
      color: "from-purple-500 to-purple-600",
    },
    {
      key: "response_rate",
      label: t("dashboard.freelancing.stats.responseRate"),
      icon: TrendingUp,
      color: "from-rose-500 to-rose-600",
    },
  ];
  const [data, setData] = useState<FreelancingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, earningsResult] = await Promise.all([
        api.get<any>("/api/v1/dashboard/freelancing"),
        api.get<any>("/api/v1/dashboard/freelancing/earnings"),
      ]);
      const statsObj = statsResult?.stats || statsResult || {};
      setData({
        stats: {
          active_projects:
            statsObj.active_projects ?? statsObj.activeProjects ?? 0,
          completed_projects:
            statsObj.completed_projects ?? statsObj.completedProjects ?? 0,
          total_earnings:
            statsObj.total_earnings ?? statsObj.totalEarnings ?? 0,
          pending_proposals:
            statsObj.pending_proposals ?? statsObj.pendingProposals ?? 0,
          avg_rating:
            statsObj.avg_rating ??
            statsObj.average_rating ??
            statsObj.avgRating ??
            0,
          response_rate: statsObj.response_rate ?? statsObj.responseRate ?? 0,
        },
        earnings: earningsResult || {
          monthly: [],
          total: 0,
          pending: 0,
          withdrawn: 0,
        },
        recent_proposals: [],
        project_status: { open: 0, in_progress: 0, completed: 0, cancelled: 0 },
      });
    } catch (err: any) {
      setError(err?.message || t("dashboard.freelancing.error.title"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
            <p className="text-gray-500 dark:text-slate-400">
              {t("dashboard.freelancing.loading")}
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
              {t("dashboard.freelancing.error.title")}
            </p>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              {error}
            </p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.freelancing.error.retry")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const { stats, earnings, recent_proposals, project_status } = data;

  const displayValue = (key: string): string => {
    if (!stats) return "0";
    switch (key) {
      case "total_earnings":
        return formatCurrency(stats.total_earnings || 0, locale);
      case "avg_rating":
        return formatRating(stats.avg_rating);
      case "response_rate":
        return formatPercent(stats.response_rate);
      default:
        return String(stats[key as keyof FreelancingStats] ?? 0);
    }
  };

  return (
    <RoleGuard allowedRoles={["FREELANCER", "BUSINESS", "ADMIN", "MODERATOR"]}>
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
              {t("dashboard.freelancing.breadcrumb")}
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
                    {t("dashboard.freelancing.title")}
                  </h1>
                  <p className="text-gray-500 dark:text-slate-400 mt-1">
                    {t("dashboard.freelancing.description")}
                  </p>
                </div>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("dashboard.freelancing.refresh")}
                </button>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
            >
              {statCards.map((card) => (
                <div key={card.key} className="relative group cursor-pointer">
                  <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color} shadow-sm`}
                      >
                        <card.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                      {displayValue(card.key)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {card.label}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <motion.div variants={itemVariants} className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                          {t("dashboard.freelancing.earningsOverview.title")}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {t(
                            "dashboard.freelancing.earningsOverview.description",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {formatCurrency(earnings.total)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t(
                          "dashboard.freelancing.earningsOverview.totalEarned",
                        )}
                      </p>
                    </div>
                  </div>

                  {earnings.monthly && earnings.monthly.length > 0 ? (
                    <div className="space-y-3">
                      {earnings.monthly.slice(-6).map((item, i) => {
                        const maxAmount = Math.max(
                          ...earnings.monthly.map((m) => m.amount),
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
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
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
                    <div className="text-center py-8">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">
                        {t("dashboard.freelancing.earningsOverview.empty")}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {formatCurrency(earnings.total)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("dashboard.freelancing.earningsOverview.total")}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(earnings.pending)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("dashboard.freelancing.earningsOverview.pending")}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(earnings.withdrawn)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("dashboard.freelancing.earningsOverview.withdrawn")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                          {t("dashboard.freelancing.projectStatus.title")}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {t("dashboard.freelancing.projectStatus.description")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        label: t("dashboard.freelancing.projectStatus.open"),
                        value: project_status.open,
                        color: "bg-blue-500",
                      },
                      {
                        label: t(
                          "dashboard.freelancing.projectStatus.inProgress",
                        ),
                        value: project_status.in_progress,
                        color: "bg-amber-500",
                      },
                      {
                        label: t(
                          "dashboard.freelancing.projectStatus.completed",
                        ),
                        value: project_status.completed,
                        color: "bg-green-500",
                      },
                      {
                        label: t(
                          "dashboard.freelancing.projectStatus.cancelled",
                        ),
                        value: project_status.cancelled,
                        color: "bg-gray-400",
                      },
                    ].map((item) => {
                      const total =
                        Object.values(project_status).reduce(
                          (a, b) => a + b,
                          0,
                        ) || 1;
                      const pct = (item.value / total) * 100;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-gray-600 dark:text-slate-400">
                              {item.label}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-slate-100">
                              {item.value}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6 }}
                              className={`h-full ${item.color} rounded-full`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div variants={itemVariants}>
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                        {t("dashboard.freelancing.recentProposals.title")}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        {t("dashboard.freelancing.recentProposals.description")}
                      </p>
                    </div>
                  </div>
                </div>

                {(recent_proposals || []).length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {(recent_proposals || []).map((proposal) => (
                      <div
                        key={proposal.id}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                            {proposal.project_title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            {new Date(proposal.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatCurrency(proposal.amount)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              proposal.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : proposal.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {proposal.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400">
                      {t("dashboard.freelancing.recentProposals.empty")}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t("dashboard.freelancing.recentProposals.emptyHint")}
                    </p>
                    <Link
                      href="/hub/projects"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      {t(
                        "dashboard.freelancing.recentProposals.browseProjects",
                      )}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </RoleGuard>
  );
}
