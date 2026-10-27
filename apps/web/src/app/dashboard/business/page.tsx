"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  ChevronRight,
  BarChart3,
  Database,
  Brain,
  LayoutDashboard,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Layout,
  GraduationCap,
  Briefcase,
  Building2,
  DollarSign,
  Award,
} from "lucide-react";

import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RoleGuard } from "@/components/dashboard/RoleGuard";
import { api } from "@/lib/api";
import {
  StatCard,
  SectionCard,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface BusinessStats {
  total_datasets: number;
  total_ml_models: number;
  total_dashboards: number;
  total_queries: number;
}

interface BusinessDashboard {
  id: number;
  title: string;
  description?: string;
  updated_at: string;
  widget_count: number;
}

interface BusinessDataset {
  id: number;
  name: string;
  rows: number;
  status: string;
  created_at: string;
}

interface BusinessMLModel {
  id: number;
  name: string;
  type: string;
  accuracy?: number;
  status: string;
  updated_at: string;
}

interface BusinessDashboardData {
  stats: BusinessStats;
  dashboards: BusinessDashboard[];
  datasets: BusinessDataset[];
  ml_models: BusinessMLModel[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function formatDate(dateStr: string, locale = "en") {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BusinessDashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const t = useTranslations("user");
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const [data, setData] = useState<BusinessDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [businessRes, dashboardsRes] = await Promise.all([
        api.get<any>("/api/v1/dashboard/business"),
        api.get<any>("/api/v1/dashboard/business/dashboards"),
      ]);
      const statsObj = businessRes?.stats || businessRes || {};
      const dashboardsList = Array.isArray(dashboardsRes)
        ? dashboardsRes
        : dashboardsRes?.dashboards || businessRes?.dashboards || [];

      setData({
        stats: {
          total_datasets:
            statsObj.total_datasets ?? statsObj.totalDatasets ?? 0,
          total_ml_models:
            statsObj.total_ml_models ?? statsObj.totalMlModels ?? 0,
          total_dashboards:
            statsObj.total_dashboards ?? statsObj.totalDashboards ?? 0,
          total_queries: statsObj.total_queries ?? statsObj.totalQueries ?? 0,
        },
        dashboards: dashboardsList,
        datasets: businessRes?.datasets || [],
        ml_models: businessRes?.ml_models || [],
      });
    } catch (err: any) {
      setError(err?.message || t("dashboard.business.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-4"
        dir={dir}
      >
        <LoadingState text={t("dashboard.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-4"
        dir={dir}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {t("dashboard.business.loadError")}
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md text-center">
              {error}
            </p>
            <PodaciumButton
              onClick={fetchData}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.business.retry")}
            </PodaciumButton>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !data) {
    return <div />;
  }

  const { stats, dashboards, datasets, ml_models } = data;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
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
            <span>{t("dashboard.breadcrumb.dashboard")}</span>
          </Link>
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("dashboard.business.breadcrumb")}
          </span>
        </nav>

        <DashboardTabs />

        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {t("dashboard.business.title")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1">
              {t("dashboard.business.description")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PodaciumButton
              variant="outline"
              onClick={fetchData}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.business.refresh")}
            </PodaciumButton>
            <Link href="/dashboard/business/dashboards/new">
              <PodaciumButton className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                {t("dashboard.business.newDashboard")}
              </PodaciumButton>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <StatCard
              value={stats.total_datasets}
              label={t("dashboard.business.stats.totalDatasets")}
              icon={<Database className="w-5 h-5" />}
              gradient="from-blue-500 to-indigo-500"
              delay={0}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              value={stats.total_ml_models}
              label={t("dashboard.business.stats.totalModels")}
              icon={<Brain className="w-5 h-5" />}
              gradient="from-purple-500 to-pink-500"
              delay={0.1}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              value={stats.total_dashboards}
              label={t("dashboard.business.stats.totalDashboards")}
              icon={<LayoutDashboard className="w-5 h-5" />}
              gradient="from-emerald-500 to-teal-500"
              delay={0.2}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard
              value={stats.total_queries}
              label={t("dashboard.business.stats.totalQueries")}
              icon={<BarChart3 className="w-5 h-5" />}
              gradient="from-orange-500 to-amber-500"
              delay={0.3}
            />
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <SectionCard
              title={t("dashboard.business.dashboards.title")}
              icon={
                <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              }
              description={t("dashboard.business.dashboards.description")}
              action={
                <Link href="/dashboard/business/dashboards">
                  <span className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
                    {t("dashboard.business.dashboards.viewAll")}
                  </span>
                </Link>
              }
            >
              {dashboards.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t("dashboard.business.dashboards.empty")}</p>
                  <Link href="/dashboard/business/dashboards/new">
                    <span className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium mt-2 inline-block">
                      {t("dashboard.business.dashboards.createFirst")}
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboards.slice(0, 5).map((db, i) => (
                    <motion.div
                      key={db.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={`/dashboard/business/dashboards/${db.id}`}
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex-shrink-0">
                            <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                              {db.title}
                            </p>
                            {db.description && (
                              <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                                {db.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                          <span className="text-xs text-gray-400">
                            {formatDate(db.updated_at)}
                          </span>
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            {t("dashboard.business.widgets", {
                              count: String(db.widget_count),
                            })}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 dark:text-blue-400 transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title={t("dashboard.business.datasets.title")}
              icon={
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              }
              description={t("dashboard.business.datasets.description")}
              action={
                <Link href="/dashboard/business/datasets">
                  <span className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
                    {t("dashboard.business.datasets.viewAll")}
                  </span>
                </Link>
              }
            >
              {datasets.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t("dashboard.business.datasets.empty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {datasets.map((ds, i) => (
                    <motion.div
                      key={ds.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={`/dashboard/business/datasets/${ds.id}`}
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 flex-shrink-0">
                            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                              {ds.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {t("dashboard.business.rows", {
                                count: String(ds.rows),
                              })}{" "}
                              - {formatDate(ds.created_at)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg flex-shrink-0 ml-4 ${
                            ds.status === "ready"
                              ? "bg-emerald-100 text-emerald-700"
                              : ds.status === "processing"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                          }`}
                        >
                          {ds.status}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-8">
            <SectionCard
              title={t("dashboard.business.models.title")}
              icon={
                <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              }
              description={t("dashboard.business.models.description")}
              action={
                <Link href="/dashboard/business/models">
                  <span className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
                    {t("dashboard.business.models.viewAll")}
                  </span>
                </Link>
              }
            >
              {ml_models.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t("dashboard.business.models.empty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ml_models.map((model, i) => (
                    <motion.div
                      key={model.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={`/dashboard/business/models/${model.id}`}
                        className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 flex-shrink-0">
                            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                              {model.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {model.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                              model.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : model.status === "training"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                            }`}
                          >
                            {model.status}
                          </span>
                          {model.accuracy != null && (
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              {t("dashboard.business.accuracy", {
                                accuracy: `${(model.accuracy * 100).toFixed(1)}`,
                              })}
                            </span>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title={t("dashboard.business.insights.title")}
              icon={
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-1">
                    <BarChart3 className="w-4 h-4" />
                    {t("dashboard.business.insights.totalQueries")}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {stats.total_queries}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-medium mb-1">
                    <Database className="w-4 h-4" />
                    {t("dashboard.business.insights.datasetsLoaded")}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {stats.total_datasets}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium mb-1">
                    <Brain className="w-4 h-4" />
                    {t("dashboard.business.insights.modelsActive")}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {ml_models.filter((m) => m.status === "active").length}
                  </p>
                </div>
              </div>
            </SectionCard>

            <Link href="/dashboard/business/reports">
              <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100">
                      {t("dashboard.business.reports.title")}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {t("dashboard.business.reports.description")}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
