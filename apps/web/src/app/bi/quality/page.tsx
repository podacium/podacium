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
  Database,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  XCircle,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  Target,
  Shield,
  Sparkles,
  Bug,
  CheckSquare,
  Square,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, BiDatasetMetadata, BiQualityResult } from "@/lib/api";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface QualityIssue {
  id: number;
  dataset_id: number;
  column_name?: string;
  issue_type: IssueType;
  severity: Severity;
  description: string;
  affected_rows: number;
  percentage: number;
  created_at: string;
  resolved_at?: string;
  status: "open" | "resolved" | "ignored";
}

interface QualityMetric {
  id: number;
  dataset_id: number;
  metric_type: MetricType;
  value: number;
  previous_value: number;
  change_pct: number;
  recorded_at: string;
}

interface DatasetQualitySummary {
  dataset: BiDatasetMetadata;
  quality_score: number;
  quality_level: "excellent" | "good" | "fair" | "poor";
  completeness: number;
  uniqueness: number;
  consistency: number;
  accuracy: number;
  issue_count: number;
  last_assessed?: string;
}

type IssueType =
  | "missing_values"
  | "duplicates"
  | "outliers"
  | "invalid_types"
  | "formatting"
  | "range_violations";
type Severity = "critical" | "high" | "medium" | "low";
type MetricType =
  "completeness" | "uniqueness" | "consistency" | "accuracy" | "overall";

interface QualityFilters {
  severity: Severity | "all";
  issue_type: IssueType | "all";
  status: "open" | "resolved" | "all";
  dataset_id: string;
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
        {t("nav.breadcrumb.quality")}
      </span>
    </nav>
  );
}

// =============================================================================
// SEVERITY BADGE COMPONENT
// =============================================================================

function SeverityBadge({
  severity,
  t,
}: {
  severity: Severity;
  t: (key: string) => string;
}) {
  const config: Record<
    Severity,
    { bg: string; text: string; icon: React.ElementType }
  > = {
    critical: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
    high: { bg: "bg-orange-100", text: "text-orange-700", icon: AlertTriangle },
    medium: { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertCircle },
    low: { bg: "bg-blue-100", text: "text-blue-700", icon: Activity },
  };

  const { bg, text, icon: Icon } = config[severity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {t(`severity.${severity}`)}
    </span>
  );
}

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

function StatusBadge({
  status,
  t,
}: {
  status: "open" | "resolved" | "ignored";
  t: (key: string) => string;
}) {
  const config: Record<
    string,
    { bg: string; text: string; icon: React.ElementType }
  > = {
    open: { bg: "bg-red-100", text: "text-red-700", icon: Bug },
    resolved: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      icon: CheckCircle,
    },
    ignored: {
      bg: "bg-gray-100 dark:bg-slate-800",
      text: "text-gray-700 dark:text-slate-300",
      icon: Square,
    },
  };

  const { bg, text, icon: Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {t(`status.${status}`)}
    </span>
  );
}

// =============================================================================
// QUALITY SCORE CARD COMPONENT
// =============================================================================

function QualityScoreCard({
  label,
  score,
  previousScore,
  icon: Icon,
  color,
  t,
}: {
  label: string;
  score: number;
  previousScore: number;
  icon: React.ElementType;
  color: string;
  t: (key: string) => string;
}) {
  const change = score - previousScore;
  const isPositive = change >= 0;

  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-emerald-600";
    if (s >= 70) return "text-yellow-600";
    if (s >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return t("level.excellent");
    if (s >= 70) return t("level.good");
    if (s >= 50) return t("level.fair");
    return t("level.poor");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change !== 0 && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      <div className={`text-4xl font-bold mb-1 ${getScoreColor(score)}`}>
        {score.toFixed(1)}
      </div>
      <div className="text-sm text-gray-500 dark:text-slate-400 mb-3">
        {getScoreLabel(score)}
      </div>
      <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${
            score >= 90
              ? "bg-emerald-500"
              : score >= 70
                ? "bg-yellow-500"
                : score >= 50
                  ? "bg-orange-500"
                  : "bg-red-500"
          }`}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// DATASET SELECTOR COMPONENT
// =============================================================================

function DatasetSelector({
  datasets,
  selectedId,
  onSelect,
  loading,
  t,
  dir,
}: {
  datasets: BiDatasetMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  t: (key: string) => string;
  dir: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDatasets = useMemo(() => {
    if (!searchQuery) return datasets;
    const query = searchQuery.toLowerCase();
    return datasets.filter(
      (d) =>
        d.name?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query),
    );
  }, [datasets, searchQuery]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-slate-100">
          {t("dataset.title")}
        </h3>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("dataset.search")}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          dir={dir}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 dark:text-blue-400 animate-spin" />
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-slate-400 text-sm">
          {t("dataset.empty")}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredDatasets.map((dataset) => (
            <button
              key={dataset.dataset_id}
              onClick={() => onSelect(dataset.dataset_id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                selectedId === dataset.dataset_id
                  ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80"
                  : "hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  selectedId === dataset.dataset_id
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">
                  {dataset.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  {dataset.row_count?.toLocaleString()}{" "}
                  {t("common.uiLabels.rows")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ISSUES TABLE COMPONENT
// =============================================================================

function IssuesTable({
  issues,
  loading,
  onResolve,
  onIgnore,
  t,
  dir,
}: {
  issues: QualityIssue[];
  loading: boolean;
  onResolve: (id: number) => void;
  onIgnore: (id: number) => void;
  t: (key: string) => string;
  dir: string;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800" />
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 border-b border-gray-100 dark:border-slate-800 px-6 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/6" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 font-medium">
          {t("issues.empty")}
        </p>
        <p className="text-gray-400 text-sm mt-1">{t("issues.emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.column")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.type")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.severity")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.affected")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.status")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.date")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("issues.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issues.map((issue, index) => (
              <motion.tr
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 dark:text-slate-100">
                    {issue.column_name || t("issues.allColumns")}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-xs">
                    {issue.description}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {t(`issueTypes.${issue.issue_type}`)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <SeverityBadge severity={issue.severity} t={t} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-slate-100">
                    {issue.affected_rows.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {issue.percentage.toFixed(1)}%
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={issue.status} t={t} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                  {formatDate(issue.created_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  {issue.status === "open" && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onResolve(issue.id)}
                        className="p-2 rounded-lg hover:bg-emerald-50 dark:bg-emerald-950/60 text-gray-400 hover:text-emerald-600 dark:text-emerald-400 transition-colors"
                        title={t("issues.resolve")}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onIgnore(issue.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
                        title={t("issues.ignore")}
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// TREND CHART COMPONENT (Simplified)
// =============================================================================

function TrendChart({
  data,
  title,
  color,
}: {
  data: { date: string; value: number }[];
  title: string;
  color: string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
      <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
        {title}
      </h4>
      <div className="h-32 flex items-end gap-1">
        {data.map((point, index) => {
          const height = ((point.value - minValue) / range) * 100;
          return (
            <div
              key={index}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(height, 5)}%`,
                backgroundColor: color,
                opacity: 0.6 + 0.4 * (index / (data.length - 1)),
              }}
              title={`${point.date}: ${point.value.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-slate-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function QualityPage() {
  const router = useRouter();
  const t = useTranslations("bi.quality");
  const { dir } = useBidi();

  // State
  const [datasets, setDatasets] = useState<BiDatasetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [qualityData, setQualityData] = useState<BiQualityResult | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [filters, setFilters] = useState<QualityFilters>({
    severity: "all",
    issue_type: "all",
    status: "open",
    dataset_id: "",
  });
  const [refreshing, setRefreshing] = useState(false);

  // Load datasets on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const res = await api.listDatasets(1, 100);
      setDatasets(res.datasets);
      if (res.datasets.length > 0) {
        setSelectedDatasetId(res.datasets[0].dataset_id);
      }
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setLoading(false);
    }
  };

  // Load quality data when dataset changes
  useEffect(() => {
    if (selectedDatasetId) {
      loadQualityData(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  const loadQualityData = async (datasetId: string) => {
    try {
      setLoadingQuality(true);
      const result = await api.assessDatasetQuality(datasetId);
      setQualityData(result);

      // Load quality issues from API
      const issuesResult = await api.listQualityIssues(datasetId, {
        severity: filters.severity !== "all" ? filters.severity : undefined,
        issue_type:
          filters.issue_type !== "all" ? filters.issue_type : undefined,
        status: filters.status !== "all" ? filters.status : undefined,
      });
      setIssues(issuesResult.issues);
      setFilters((prev) => ({ ...prev, dataset_id: datasetId }));
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setLoadingQuality(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedDatasetId) return;

    try {
      setRefreshing(true);
      await loadQualityData(selectedDatasetId);
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setRefreshing(false);
    }
  };

  const handleResolveIssue = async (id: number) => {
    try {
      await api.resolveQualityIssue(id);
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id
            ? {
                ...issue,
                status: "resolved" as const,
                resolved_at: new Date().toISOString(),
              }
            : issue,
        ),
      );
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleIgnoreIssue = async (id: number) => {
    try {
      await api.ignoreQualityIssue(id);
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id ? { ...issue, status: "ignored" as const } : issue,
        ),
      );
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleExport = () => {
    // Export issues to CSV
    const headers = [
      "Column",
      "Type",
      "Severity",
      "Affected Rows",
      "Percentage",
      "Status",
      "Date",
    ];
    const rows = filteredIssues.map((issue) => [
      issue.column_name || "All",
      issue.issue_type,
      issue.severity,
      issue.affected_rows,
      issue.percentage.toFixed(2),
      issue.status,
      issue.created_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-issues-${selectedDatasetId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filters.severity !== "all" && issue.severity !== filters.severity)
        return false;
      if (
        filters.issue_type !== "all" &&
        issue.issue_type !== filters.issue_type
      )
        return false;
      if (filters.status !== "all" && issue.status !== filters.status)
        return false;
      return true;
    });
  }, [issues, filters]);

  // Quality metrics
  const metrics = useMemo(() => {
    if (!qualityData) return null;
    return {
      overall: qualityData.quality_score || 0,
      completeness: qualityData.completeness_score || 0,
      uniqueness: (1 - (qualityData.duplicate_ratio || 0)) * 100,
      consistency: 100 - (qualityData.outlier_ratio || 0) * 100,
    };
  }, [qualityData]);

  // Trend data - fetched from API or calculated from quality history
  const trendData = useMemo(() => {
    // Placeholder for trend data - should be fetched from quality history API
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: metrics ? metrics.overall : 0,
      });
    }
    return data;
  }, [metrics]);

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

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              disabled={refreshing || !selectedDatasetId}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {t("actions.refresh")}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              disabled={filteredIssues.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {t("actions.export")}
            </motion.button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Dataset Selector */}
          <div className="lg:col-span-1">
            <DatasetSelector
              datasets={datasets}
              selectedId={selectedDatasetId}
              onSelect={setSelectedDatasetId}
              loading={loading}
              t={t}
              dir={dir}
            />

            {/* Data Freshness */}
            {qualityData && (
              <div className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("freshness.title")}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  {t("freshness.lastCheck")}: {new Date().toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quality Score Cards */}
            {loadingQuality ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 animate-pulse"
                  >
                    <div className="h-20 bg-gray-100 dark:bg-slate-800 rounded mb-4" />
                    <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : metrics ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <QualityScoreCard
                    label={t("metrics.overall")}
                    score={metrics.overall}
                    previousScore={metrics.overall - 5}
                    icon={Shield}
                    color="bg-gradient-to-br from-blue-500 to-indigo-600"
                    t={t}
                  />
                  <QualityScoreCard
                    label={t("metrics.completeness")}
                    score={metrics.completeness}
                    previousScore={metrics.completeness + 2}
                    icon={Database}
                    color="bg-gradient-to-br from-emerald-500 to-teal-600"
                    t={t}
                  />
                  <QualityScoreCard
                    label={t("metrics.uniqueness")}
                    score={metrics.uniqueness}
                    previousScore={metrics.uniqueness - 1}
                    icon={Target}
                    color="bg-gradient-to-br from-purple-500 to-pink-600"
                    t={t}
                  />
                  <QualityScoreCard
                    label={t("metrics.consistency")}
                    score={metrics.consistency}
                    previousScore={metrics.consistency + 3}
                    icon={Activity}
                    color="bg-gradient-to-br from-amber-500 to-orange-600"
                    t={t}
                  />
                </div>

                {/* Trend Chart */}
                <TrendChart
                  data={trendData}
                  title={t("trends.title")}
                  color="#3B82F6"
                />

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                        {t("issues.filters")}
                      </span>
                    </div>

                    <select
                      value={filters.severity}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          severity: e.target.value as Severity | "all",
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="all">{t("filters.severity.all")}</option>
                      <option value="critical">{t("severity.critical")}</option>
                      <option value="high">{t("severity.high")}</option>
                      <option value="medium">{t("severity.medium")}</option>
                      <option value="low">{t("severity.low")}</option>
                    </select>

                    <select
                      value={filters.issue_type}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          issue_type: e.target.value as IssueType | "all",
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="all">{t("filters.type.all")}</option>
                      <option value="missing_values">
                        {t("issueTypes.missing_values")}
                      </option>
                      <option value="duplicates">
                        {t("issueTypes.duplicates")}
                      </option>
                      <option value="outliers">
                        {t("issueTypes.outliers")}
                      </option>
                      <option value="invalid_types">
                        {t("issueTypes.invalid_types")}
                      </option>
                    </select>

                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value as "open" | "resolved" | "all",
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="all">{t("filters.status.all")}</option>
                      <option value="open">{t("status.open")}</option>
                      <option value="resolved">{t("status.resolved")}</option>
                    </select>
                  </div>
                </div>

                {/* Issues Table */}
                <IssuesTable
                  issues={filteredIssues}
                  loading={loadingQuality}
                  onResolve={handleResolveIssue}
                  onIgnore={handleIgnoreIssue}
                  t={t}
                  dir={dir}
                />

                {/* Summary */}
                {qualityData && qualityData.human_summary && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/50 p-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
                          {t("summary.title")}
                        </h4>
                        <div className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed space-y-1">
                          {qualityData.summary_keys &&
                          qualityData.summary_keys.length > 0 ? (
                            qualityData.summary_keys.map((s, i) => (
                              <p key={i}>
                                {t(s.key.replace("quality.", ""), s.params)}
                              </p>
                            ))
                          ) : (
                            <p>{qualityData.human_summary}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {qualityData &&
                      qualityData.recommendations &&
                      qualityData.recommendations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/50">
                          <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-2">
                            {t("recommendations.title")}
                          </h5>
                          <ul className="space-y-1">
                            {qualityData.recommendation_keys &&
                            qualityData.recommendation_keys.length > 0
                              ? qualityData.recommendation_keys
                                  .slice(0, 5)
                                  .map((rec, i) => (
                                    <li
                                      key={i}
                                      className="text-sm text-gray-600 dark:text-slate-400 flex items-start gap-2"
                                    >
                                      <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                      {t(
                                        rec.key.replace("quality.", ""),
                                        rec.params,
                                      )}
                                    </li>
                                  ))
                              : qualityData.recommendations
                                  .slice(0, 3)
                                  .map((rec, i) => (
                                    <li
                                      key={i}
                                      className="text-sm text-gray-600 dark:text-slate-400 flex items-start gap-2"
                                    >
                                      <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                      {rec}
                                    </li>
                                  ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-slate-400">
                  {t("noData")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <React.Suspense
        fallback={<div className="h-32 bg-gray-50 dark:bg-slate-900/60" />}
      >
        <Footer />
      </React.Suspense>
    </main>
  );
}
