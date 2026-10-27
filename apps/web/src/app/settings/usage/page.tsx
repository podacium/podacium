"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  HardDrive,
  Wifi,
  FolderKanban,
  Users,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface UsageMetrics {
  storage: number;
  storage_limit: number;
  bandwidth: number;
  bandwidth_limit: number;
  projects: number;
  projects_limit: number;
  collaborators: number;
  collaborators_limit: number;
}

interface UsageData {
  metrics: UsageMetrics;
  period_start: string;
  period_end: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const formatFileSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

const UsageBar: React.FC<{
  value: number;
  max: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  formatValue?: (v: number) => string;
}> = ({
  value,
  max,
  label,
  icon,
  color,
  bgColor,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const { t } = useTranslations("user");
  const pct = Math.round(
    Math.min(100, Math.max(0, (value / (max || 1)) * 100)),
  );
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${bgColor} ${color}`}>{icon}</div>
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
            {label}
          </span>
        </div>
        <div className="text-end">
          <span className="text-sm font-black text-gray-900 dark:text-slate-100">
            {formatValue(value)}
          </span>
          <span className="text-xs text-gray-400 dark:text-slate-500 ms-1">
            / {formatValue(max)}
          </span>
          <span
            className={`ms-2 text-xs font-black px-2 py-0.5 rounded-full ${
              isAtLimit
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                : isNearLimit
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
            }`}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full transition-all ${
            isAtLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-amber-500"
                : "bg-blue-600"
          }`}
        />
      </div>
      {isNearLimit && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">
          {isAtLimit
            ? t("settings.usage.atLimit")
            : t("settings.usage.nearLimit")}
        </p>
      )}
    </div>
  );
};

const UsagePage = () => {
  const { t } = useTranslations("user");
  const { isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<UsageData>("/api/v1/settings/usage");
      setData(result);
    } catch {
      setError(t("settings.usage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("settings.usage.loading")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <p className="text-gray-700 dark:text-slate-300 font-medium">{error}</p>
        <PodaciumButton onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 me-2" />
          {t("settings.usage.retry")}
        </PodaciumButton>
      </div>
    );
  }

  const metrics = data?.metrics;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      dir={dir}
    >
      <motion.div variants={itemVariants}>
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <Link
            href="/settings"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t("settings.title")}
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("settings.tabs.usage")}
          </span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {t("settings.usage.title")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
              {t("settings.usage.subtitle")}
            </p>
          </div>
          {data?.period_start && data?.period_end && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-400 bg-gray-100/80 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-gray-200/60 dark:border-slate-800/80 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {new Date(data.period_start).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(data.period_end).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Meter Cards */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {t("settings.usage.resourceGroup")}
            </h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {metrics && (
            <>
              <UsageBar
                value={metrics.storage}
                max={metrics.storage_limit}
                label={t("settings.usage.storage")}
                icon={<HardDrive className="h-5 w-5" />}
                color="text-blue-600"
                bgColor="bg-blue-100/70"
                formatValue={formatFileSize}
              />
              <UsageBar
                value={metrics.bandwidth}
                max={metrics.bandwidth_limit}
                label={t("settings.usage.bandwidth")}
                icon={<Wifi className="h-5 w-5" />}
                color="text-purple-600"
                bgColor="bg-purple-100/70"
                formatValue={formatFileSize}
              />
              <UsageBar
                value={metrics.projects}
                max={metrics.projects_limit}
                label={t("settings.usage.projects")}
                icon={<FolderKanban className="h-5 w-5" />}
                color="text-amber-600"
                bgColor="bg-amber-100/70"
              />
              <UsageBar
                value={metrics.collaborators}
                max={metrics.collaborators_limit}
                label={t("settings.usage.collaborators")}
                icon={<Users className="h-5 w-5" />}
                color="text-emerald-600"
                bgColor="bg-emerald-100/70"
              />
            </>
          )}
        </div>
      </motion.div>

      {/* Summary Grid */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {t("settings.usage.summaryGroup")}
            </h2>
          </div>
        </div>
        <div className="p-6">
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
                <p className="text-2xl font-black text-gray-900 dark:text-slate-100">
                  {Math.round(
                    Math.min(
                      100,
                      Math.max(
                        0,
                        (metrics.storage / (metrics.storage_limit || 1)) * 100,
                      ),
                    ),
                  )}
                  %
                </p>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                  {t("settings.usage.storage")}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
                <p className="text-2xl font-black text-gray-900 dark:text-slate-100">
                  {Math.round(
                    Math.min(
                      100,
                      Math.max(
                        0,
                        (metrics.bandwidth / (metrics.bandwidth_limit || 1)) *
                          100,
                      ),
                    ),
                  )}
                  %
                </p>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                  {t("settings.usage.bandwidth")}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
                <p className="text-2xl font-black text-gray-900 dark:text-slate-100">
                  {metrics.projects}/{metrics.projects_limit}
                </p>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                  {t("settings.usage.projects")}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
                <p className="text-2xl font-black text-gray-900 dark:text-slate-100">
                  {metrics.collaborators}/{metrics.collaborators_limit}
                </p>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1">
                  {t("settings.usage.collaborators")}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UsagePage;
