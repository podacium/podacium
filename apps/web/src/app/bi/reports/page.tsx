"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Edit3,
  Trash2,
  MoreHorizontal,
  Download,
  RefreshCw,
  Home,
  ChevronRight as ChevronRightIcon,
  FileText,
  FileSpreadsheet,
  File,
  Mail,
  Send,
  Calendar,
  Play,
  Pause,
  X,
  Settings,
  Clock3,
  Zap,
  History,
  ExternalLink,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, BiDashboardMetadata } from "@/lib/api";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Report {
  id: number;
  name: string;
  description?: string;
  dashboard_id: number;
  dashboard_name: string;
  format: ExportFormat;
  schedule_type: ScheduleType;
  schedule_cron?: string;
  schedule_interval?: number;
  recipients: string[];
  is_active: boolean;
  last_run?: ReportRun;
  next_run?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  created_by_name: string;
}

interface ReportRun {
  id: number;
  report_id: number;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  file_url?: string;
  file_size?: number;
  error_message?: string;
  recipient_count: number;
}

type ExportFormat = "pdf" | "csv" | "xlsx";
type ScheduleType = "manual" | "daily" | "weekly" | "monthly" | "cron";
type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface ReportFilters {
  format: ExportFormat | "all";
  status: RunStatus | "all";
  dashboard_id: string;
  search: string;
  is_active: boolean | "all";
}

// =============================================================================
// ANIMATION CONFIGURATIONS
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
} as const;

// =============================================================================
// BREADCRUMB COMPONENT
// =============================================================================

function Breadcrumb({ t, dir }: { t: (key: string) => string; dir: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-4 h-4" />
        <span>{t("nav.breadcrumb.home")}</span>
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("nav.breadcrumb.bi")}
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("nav.breadcrumb.reports")}
      </span>
    </nav>
  );
}

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

function StatusBadge({
  status,
  t,
}: {
  status: RunStatus;
  t: (key: string) => string;
}) {
  const config: Record<
    RunStatus,
    { bg: string; text: string; icon: React.ElementType }
  > = {
    pending: {
      bg: "bg-gray-100 dark:bg-slate-800",
      text: "text-gray-700 dark:text-slate-300",
      icon: Clock,
    },
    running: { bg: "bg-blue-100", text: "text-blue-700", icon: Loader2 },
    completed: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      icon: CheckCircle,
    },
    failed: { bg: "bg-red-100", text: "text-red-700", icon: AlertTriangle },
    cancelled: { bg: "bg-slate-100", text: "text-slate-700", icon: X },
  };

  const { bg, text, icon: Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      {status === "running" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Icon className="w-3 h-3" />
      )}
      {t(`status.${status}`)}
    </span>
  );
}

// =============================================================================
// FORMAT BADGE COMPONENT
// =============================================================================

function FormatBadge({ format }: { format: ExportFormat }) {
  const config: Record<
    ExportFormat,
    { bg: string; text: string; icon: React.ElementType }
  > = {
    pdf: { bg: "bg-red-100", text: "text-red-700", icon: FileText },
    csv: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      icon: FileSpreadsheet,
    },
    xlsx: { bg: "bg-green-100", text: "text-green-700", icon: File },
  };

  const { bg, text, icon: Icon } = config[format];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {format.toUpperCase()}
    </span>
  );
}

// =============================================================================
// FILTER BAR COMPONENT
// =============================================================================

function FilterBar({
  filters,
  updateFilters,
  dashboards,
  t,
  dir,
}: {
  filters: ReportFilters;
  updateFilters: (updates: Partial<ReportFilters>) => void;
  dashboards: BiDashboardMetadata[];
  t: (key: string) => string;
  dir: string;
}) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.format !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.dashboard_id) count++;
    if (filters.is_active !== "all") count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder={t("search.placeholder")}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            dir={dir}
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
            showFilters || activeFilterCount > 0
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          <Filter className="w-4 h-4" />
          {t("filters.title")}
          {activeFilterCount > 0 && (
            <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={() =>
            updateFilters({
              format: "all",
              status: "all",
              dashboard_id: "",
              is_active: "all",
            })
          }
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700 transition-colors"
        >
          {t("filters.clear")}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-slate-800"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.format.label")}
              </label>
              <select
                value={filters.format}
                onChange={(e) =>
                  updateFilters({
                    format: e.target.value as ExportFormat | "all",
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">{t("filters.all")}</option>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.status.label")}
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  updateFilters({ status: e.target.value as RunStatus | "all" })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">{t("filters.all")}</option>
                <option value="pending">{t("status.pending")}</option>
                <option value="running">{t("status.running")}</option>
                <option value="completed">{t("status.completed")}</option>
                <option value="failed">{t("status.failed")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.dashboard.label")}
              </label>
              <select
                value={filters.dashboard_id}
                onChange={(e) =>
                  updateFilters({ dashboard_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{t("filters.all")}</option>
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.active.label")}
              </label>
              <select
                value={
                  filters.is_active === true
                    ? "true"
                    : filters.is_active === false
                      ? "false"
                      : "all"
                }
                onChange={(e) =>
                  updateFilters({
                    is_active:
                      e.target.value === "all"
                        ? "all"
                        : e.target.value === "true",
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">{t("filters.active.all")}</option>
                <option value="true">{t("filters.active.yes")}</option>
                <option value="false">{t("filters.active.no")}</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// REPORT CARD COMPONENT
// =============================================================================

function ReportCard({
  report,
  onRun,
  onToggleActive,
  onDelete,
  onViewHistory,
  t,
  dir,
}: {
  report: Report;
  onRun: (id: number) => void;
  onToggleActive: (id: number) => void;
  onDelete: (id: number) => void;
  onViewHistory: (report: Report) => void;
  t: (key: string) => string;
  dir: string;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-xl ${
              report.format === "pdf"
                ? "bg-red-100 dark:bg-red-900/50"
                : report.format === "csv"
                  ? "bg-emerald-100"
                  : "bg-green-100"
            }`}
          >
            {report.format === "pdf" ? (
              <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
            ) : report.format === "csv" ? (
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <File className="w-6 h-6 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">
              {report.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {report.dashboard_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FormatBadge format={report.format} />
          {report.is_active ? (
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded">
              {t("table.active")}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-xs font-medium rounded">
              {t("table.inactive")}
            </span>
          )}
        </div>
      </div>

      {report.description && (
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 line-clamp-2">
          {report.description}
        </p>
      )}

      {/* Schedule Info */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Clock3 className="w-4 h-4" />
          {report.schedule_type === "manual" ? (
            <span>{t("schedule.manual")}</span>
          ) : (
            <span>{t(`schedule.${report.schedule_type}`)}</span>
          )}
        </div>

        {report.recipients.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-4 h-4" />
            <span>
              {report.recipients.length} {t("recipients")}
            </span>
          </div>
        )}
      </div>

      {/* Last Run */}
      {report.last_run && (
        <div className="bg-gray-50 dark:bg-slate-900/60 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
              {t("table.lastRun")}
            </span>
            <StatusBadge status={report.last_run.status} t={t} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-slate-400">
              {formatDate(report.last_run.started_at)}
            </span>
            {report.last_run.file_size && (
              <span className="text-gray-500 dark:text-slate-400">
                {formatFileSize(report.last_run.file_size)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onRun(report.id)}
          disabled={!report.is_active}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          {t("actions.run")}
        </motion.button>

        <button
          onClick={() => onToggleActive(report.id)}
          className={`p-2 rounded-lg border transition-colors ${
            report.is_active
              ? "border-gray-200 dark:border-slate-800 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              : "border-gray-200 dark:border-slate-800 text-emerald-500 hover:bg-emerald-50"
          }`}
          title={
            report.is_active ? t("actions.deactivate") : t("actions.activate")
          }
        >
          {report.is_active ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={() => onViewHistory(report)}
          className="p-2 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
          title={t("actions.history")}
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={() => onDelete(report.id)}
          className="p-2 rounded-lg border border-gray-200 dark:border-slate-800 text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-500 dark:text-red-400 hover:border-red-200 dark:border-red-800/80 transition-colors"
          title={t("actions.delete")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// CREATE REPORT MODAL COMPONENT
// =============================================================================

function CreateReportModal({
  dashboards,
  onClose,
  onCreate,
  t,
  dir,
}: {
  dashboards: BiDashboardMetadata[];
  onClose: () => void;
  onCreate: (data: Partial<Report>) => void;
  t: (key: string) => string;
  dir: string;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dashboard_id: "",
    format: "pdf" as ExportFormat,
    schedule_type: "manual" as ScheduleType,
    schedule_interval: 1,
    recipients: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate({
        ...formData,
        dashboard_id: parseInt(formData.dashboard_id),
        recipients: formData.recipients
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {t("create.title")}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.name")}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  dir={dir}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.description")}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  dir={dir}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.dashboard")}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={formData.dashboard_id}
                  onChange={(e) =>
                    setFormData({ ...formData, dashboard_id: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">{t("create.selectDashboard")}</option>
                  {dashboards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("create.format")}
                  </label>
                  <select
                    value={formData.format}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        format: e.target.value as ExportFormat,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("create.schedule")}
                  </label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_type: e.target.value as ScheduleType,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="manual">{t("schedule.manual")}</option>
                    <option value="daily">{t("schedule.daily")}</option>
                    <option value="weekly">{t("schedule.weekly")}</option>
                    <option value="monthly">{t("schedule.monthly")}</option>
                  </select>
                </div>
              </div>

              {formData.schedule_type !== "manual" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("create.interval")}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {t("create.every")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={formData.schedule_interval}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          schedule_interval: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-20 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {formData.schedule_type === "daily"
                        ? t("create.days")
                        : formData.schedule_type === "weekly"
                          ? t("create.weeks")
                          : t("create.months")}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.recipients")}
                </label>
                <textarea
                  value={formData.recipients}
                  onChange={(e) =>
                    setFormData({ ...formData, recipients: e.target.value })
                  }
                  placeholder={t("create.recipientsPlaceholder")}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  dir={dir}
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {t("create.recipientsHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-blue-500 dark:text-blue-400 focus:ring-blue-500"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm text-gray-700 dark:text-slate-300"
                >
                  {t("create.active")}
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  {t("create.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={
                    loading || !formData.name.trim() || !formData.dashboard_id
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  {t("create.submit")}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// =============================================================================
// REPORT HISTORY MODAL COMPONENT
// =============================================================================

function ReportHistoryModal({
  report,
  runs,
  onClose,
  onRetry,
  onDownload,
  t,
  dir,
}: {
  report: Report | null;
  runs: ReportRun[];
  onClose: () => void;
  onRetry: (runId: number) => void;
  onDownload: (run: ReportRun) => void;
  t: (key: string) => string;
  dir: string;
}) {
  if (!report) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {t("history.title")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {report.name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {runs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">
                    {t("history.empty")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <StatusBadge status={run.status} t={t} />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatDate(run.started_at)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {run.recipient_count} {t("history.recipients")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {run.file_size && (
                          <span className="text-sm text-gray-500 dark:text-slate-400">
                            {formatFileSize(run.file_size)}
                          </span>
                        )}

                        {run.status === "failed" && (
                          <button
                            onClick={() => onRetry(run.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {t("history.retry")}
                          </button>
                        )}

                        {run.status === "completed" && run.file_url && (
                          <button
                            onClick={() => onDownload(run)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            {t("history.download")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ReportsPage() {
  const router = useRouter();
  const t = useTranslations("bi.reports");
  const { dir } = useBidi();

  // State
  const [reports, setReports] = useState<Report[]>([]);
  const [dashboards, setDashboards] = useState<BiDashboardMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>({
    format: "all",
    status: "all",
    dashboard_id: "",
    search: "",
    is_active: "all",
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [historyRuns, setHistoryRuns] = useState<ReportRun[]>([]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const dashboardsRes = (await api.listDashboards()) as any;
      if (Array.isArray(dashboardsRes)) {
        setDashboards(dashboardsRes);
      } else if (dashboardsRes && dashboardsRes.dashboards) {
        setDashboards(dashboardsRes.dashboards);
      }

      const reportsRes = await api.listReports(1, 100, {
        format: filters.format !== "all" ? filters.format : undefined,
        dashboard_id: filters.dashboard_id || undefined,
        is_active: filters.is_active !== "all" ? filters.is_active : undefined,
        search: filters.search || undefined,
      });

      setReports(reportsRes.reports);
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = useCallback((updates: Partial<ReportFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleRun = async (id: number) => {
    try {
      await api.runReport(id);
      await loadData();
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await api.toggleReportActive(id);
      await loadData();
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(t("delete.confirm"))) {
      try {
        await api.deleteReport(id);
        await loadData();
      } catch (error) {
        // Error handling done via toast notification
      }
    }
  };

  const handleViewHistory = async (report: Report) => {
    setSelectedReport(report);
    try {
      const runs = await api.listReportRuns(report.id);
      setHistoryRuns(runs);
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleRetry = async (runId: number) => {
    if (!selectedReport) return;
    try {
      await api.retryReportRun(selectedReport.id, runId);
      const runs = await api.listReportRuns(selectedReport.id);
      setHistoryRuns(runs);
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleDownload = (run: ReportRun) => {
    if (run.file_url) {
      window.open(run.file_url, "_blank");
    }
  };

  const handleCreate = async (data: Partial<Report>) => {
    try {
      await api.createReport({
        name: data.name || "",
        description: data.description,
        dashboard_id: parseInt(data.dashboard_id as any),
        format: data.format || "pdf",
        schedule_type: data.schedule_type || "manual",
        schedule_interval: data.schedule_interval,
        recipients: data.recipients || [],
        is_active: data.is_active ?? true,
      });
      await loadData();
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  // Filter reports
  const filteredReports = useMemo(() => {
    return (reports || []).filter((report) => {
      if (filters.format !== "all" && report.format !== filters.format)
        return false;
      if (
        filters.dashboard_id &&
        report.dashboard_id !== parseInt(filters.dashboard_id)
      )
        return false;
      if (filters.is_active !== "all" && report.is_active !== filters.is_active)
        return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (
          !report.name.toLowerCase().includes(query) &&
          !report.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reports, filters]);

  // Stats
  const stats = useMemo(
    () => ({
      total: (reports || []).length,
      active: (reports || []).filter((r) => r.is_active).length,
      completed: (reports || []).filter(
        (r) => r.last_run?.status === "completed",
      ).length,
      failed: (reports || []).filter((r) => r.last_run?.status === "failed")
        .length,
    }),
    [reports],
  );

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-24"
      dir={dir}
    >
      <React.Suspense
        fallback={
          <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
        }
      >
        <Navbar />
      </React.Suspense>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100 dark:bg-indigo-950/60 dark:bg-indigo-900/50 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 dark:bg-purple-950/60 dark:bg-purple-900/50 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <Breadcrumb t={t} dir={dir} />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {t("title")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1">
              {t("subtitle")}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            {t("createButton")}
          </motion.button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4"
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {stats.total}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("stats.total")}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4"
          >
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("stats.active")}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4"
          >
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.completed}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("stats.completed")}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4"
          >
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.failed}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("stats.failed")}
            </div>
          </motion.div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            filters={filters}
            updateFilters={updateFilters}
            dashboards={dashboards}
            t={t}
            dir={dir}
          />
        </div>

        {/* Reports Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-100 dark:bg-slate-800 rounded w-2/3 mb-4" />
                <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400">{t("empty")}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {t("createFirst")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ReportCard
                  report={report}
                  onRun={handleRun}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                  onViewHistory={handleViewHistory}
                  t={t}
                  dir={dir}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReportModal
          dashboards={dashboards}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          t={t}
          dir={dir}
        />
      )}

      {/* History Modal */}
      {selectedReport && (
        <ReportHistoryModal
          report={selectedReport}
          runs={historyRuns}
          onClose={() => setSelectedReport(null)}
          onRetry={handleRetry}
          onDownload={handleDownload}
          t={t}
          dir={dir}
        />
      )}

      <React.Suspense
        fallback={<div className="h-32 bg-gray-50 dark:bg-slate-900/60" />}
      >
        <Footer />
      </React.Suspense>
    </main>
  );
}
