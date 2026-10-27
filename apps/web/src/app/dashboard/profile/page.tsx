"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  ChevronRight,
  Eye,
  Heart,
  Share2,
  Search,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  StatCard,
  SectionCard,
  EmptyState,
} from "@/components/SectionComponents";

interface ProfileStats {
  totalViews: number;
  totalFollows: number;
  totalShares: number;
  totalSearches: number;
  viewTrend: number;
  followTrend: number;
}

interface ViewTrend {
  date: string;
  views: number;
  unique: number;
}

interface FollowerGrowth {
  month: string;
  followers: number;
  newFollowers: number;
}

interface ProfileData {
  stats: ProfileStats;
  viewTrends: ViewTrend[];
  followerGrowth: FollowerGrowth[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function formatCompact(value?: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatTrend(value?: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export default function ProfileDashboardPage() {
  const t = useTranslations("user");
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, viewsRes] = await Promise.all([
        api.get<any>("/api/v1/dashboard/profile"),
        api.get<any>("/api/v1/dashboard/profile/views"),
      ]);
      const statsObj = profileRes?.stats || profileRes || {};
      const viewsList = Array.isArray(viewsRes)
        ? viewsRes
        : viewsRes?.daily || [];

      setData({
        stats: {
          totalViews: statsObj.totalViews ?? statsObj.total_views ?? 0,
          totalFollows: statsObj.totalFollows ?? statsObj.total_follows ?? 0,
          totalShares: statsObj.totalShares ?? statsObj.total_shares ?? 0,
          totalSearches: statsObj.totalSearches ?? statsObj.total_searches ?? 0,
          viewTrend: statsObj.viewTrend ?? statsObj.view_trend ?? 0,
          followTrend: statsObj.followTrend ?? statsObj.follow_trend ?? 0,
        },
        viewTrends: viewsList,
        followerGrowth: [],
      });
    } catch (err: any) {
      setError(err?.message || t("dashboard.profile.error.title"));
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
              {t("dashboard.profile.loading")}
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
              {t("dashboard.profile.error.title")}
            </p>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              {error}
            </p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.profile.error.retry")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !data) return null;

  const { stats, viewTrends, followerGrowth } = data;

  return (
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
            {t("dashboard.profile.breadcrumb")}
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
                  {t("dashboard.profile.title")}
                </h1>
                <p className="text-gray-500 dark:text-slate-400 mt-1">
                  {t("dashboard.profile.description")}
                </p>
              </div>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("dashboard.profile.refresh")}
              </button>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard
              icon={<Eye className="w-5 h-5" />}
              label={t("dashboard.profile.stats.totalViews")}
              value={formatCompact(stats.totalViews)}
              gradient="from-blue-600 to-blue-400"
              delay={0.05}
              trend={
                stats.viewTrend
                  ? {
                      value: Math.abs(stats.viewTrend),
                      isPositive: stats.viewTrend >= 0,
                    }
                  : undefined
              }
            />
            <StatCard
              icon={<Heart className="w-5 h-5" />}
              label={t("dashboard.profile.stats.totalFollows")}
              value={formatCompact(stats.totalFollows)}
              gradient="from-rose-500 to-pink-400"
              delay={0.1}
              trend={
                stats.followTrend
                  ? {
                      value: Math.abs(stats.followTrend),
                      isPositive: stats.followTrend >= 0,
                    }
                  : undefined
              }
            />
            <StatCard
              icon={<Share2 className="w-5 h-5" />}
              label={t("dashboard.profile.stats.totalShares")}
              value={formatCompact(stats.totalShares)}
              gradient="from-emerald-600 to-teal-400"
              delay={0.15}
            />
            <StatCard
              icon={<Search className="w-5 h-5" />}
              label={t("dashboard.profile.stats.totalSearches")}
              value={formatCompact(stats.totalSearches)}
              gradient="from-purple-600 to-violet-400"
              delay={0.2}
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <SectionCard
                title={t("dashboard.profile.viewTrends.title")}
                icon={<Eye className="w-5 h-5" />}
                description={t("dashboard.profile.viewTrends.description")}
              >
                {(viewTrends || []).length > 0 ? (
                  <div className="space-y-3">
                    {(viewTrends || []).slice(-14).map((item, i) => {
                      const maxViews = Math.max(
                        ...(viewTrends || []).map((v) => v.views),
                        1,
                      );
                      const barWidth = (item.views / maxViews) * 100;
                      return (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-sm text-gray-500 dark:text-slate-400 w-24 shrink-0">
                            {item.date}
                          </span>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, delay: i * 0.03 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 text-right">
                            {item.views}
                          </span>
                          <span className="text-xs text-gray-400 w-16 text-right">
                            ({item.unique} unique)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Eye className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.profile.viewTrends.empty.title")}
                    description={t(
                      "dashboard.profile.viewTrends.empty.description",
                    )}
                  />
                )}
              </SectionCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SectionCard
                title={t("dashboard.profile.followerGrowth.title")}
                icon={<Users className="w-5 h-5" />}
                description={t("dashboard.profile.followerGrowth.description")}
              >
                {(followerGrowth || []).length > 0 ? (
                  <div className="space-y-4">
                    {(followerGrowth || []).map((item, i) => {
                      const maxFollowers = Math.max(
                        ...(followerGrowth || []).map((f) => f.followers),
                        1,
                      );
                      const barWidth = (item.followers / maxFollowers) * 100;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-gray-600 dark:text-slate-400 font-medium">
                              {item.month}
                            </span>
                            <span className="text-gray-900 dark:text-slate-100 font-semibold">
                              {item.followers}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.6, delay: i * 0.1 }}
                              className="h-full bg-gradient-to-r from-rose-400 to-pink-400 rounded-full"
                            />
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            {item.newFollowers >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />
                            )}
                            <span
                              className={
                                item.newFollowers >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }
                            >
                              {item.newFollowers >= 0 ? "+" : ""}
                              {item.newFollowers}{" "}
                              {t("dashboard.profile.engagement.new")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Users className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.profile.followerGrowth.empty.title")}
                    description={t(
                      "dashboard.profile.followerGrowth.empty.description",
                    )}
                  />
                )}
              </SectionCard>
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <SectionCard
              title={t("dashboard.profile.engagement.title")}
              icon={<TrendingUp className="w-5 h-5" />}
              description={t("dashboard.profile.engagement.description")}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: t("dashboard.profile.stats.totalViews"),
                    value: formatCompact(stats.totalViews),
                    icon: Eye,
                    color: "from-blue-500 to-blue-400",
                  },
                  {
                    label: t("dashboard.profile.stats.totalFollows"),
                    value: formatCompact(stats.totalFollows),
                    icon: Heart,
                    color: "from-rose-500 to-pink-400",
                  },
                  {
                    label: t("dashboard.profile.stats.totalShares"),
                    value: formatCompact(stats.totalShares),
                    icon: Share2,
                    color: "from-emerald-500 to-teal-400",
                  },
                  {
                    label: t("dashboard.profile.stats.totalSearches"),
                    value: formatCompact(stats.totalSearches),
                    icon: Search,
                    color: "from-purple-500 to-violet-400",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-800/60 text-center"
                  >
                    <div
                      className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${item.color} shadow-sm mb-2`}
                    >
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      {item.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {item.label}
                    </p>
                  </motion.div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
