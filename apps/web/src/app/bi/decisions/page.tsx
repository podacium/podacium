"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function cleanBiDiText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/[\u2066-\u2069\u202A-\u202E\u200E\u200F]/g, "").trim();
}
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
  Calendar,
  User,
  Target,
  TrendingUp,
  MessageSquare,
  History,
  X,
  Download,
  RefreshCw,
  Home,
  ChevronRight as ChevronRightIcon,
  Layers,
  Zap,
  Shield,
  Archive,
  Send,
  XCircle,
  PlayCircle,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Decision {
  id: number;
  title: string;
  description: string;
  status: DecisionStatus;
  impact_level: ImpactLevel;
  owner_id: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
  dataset_id?: number;
  dataset_name?: string;
  rationale?: string;
  expected_outcome?: string;
  actual_outcome?: string;
  tags: string[];
}

interface DecisionHistory {
  id: number;
  decision_id: number;
  status: DecisionStatus;
  changed_by: number;
  changed_by_name: string;
  changed_at: string;
  notes?: string;
}

interface DecisionComment {
  id: number;
  decision_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

type DecisionStatus =
  "draft" | "review" | "approved" | "implemented" | "archived";
type ImpactLevel = "low" | "medium" | "high" | "critical";

interface DecisionFilters {
  status: DecisionStatus | "all";
  impact_level: ImpactLevel | "all";
  date_from: string;
  date_to: string;
  owner_id: string;
  search: string;
}

// =============================================================================
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
        {t("nav.breadcrumb.decisions")}
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
  status: DecisionStatus;
  t: (key: string) => string;
}) {
  const config: Record<
    DecisionStatus,
    { bg: string; text: string; icon: React.ElementType }
  > = {
    draft: {
      bg: "bg-gray-100 dark:bg-slate-800",
      text: "text-gray-700 dark:text-slate-300",
      icon: Edit3,
    },
    review: {
      bg: "bg-amber-100 dark:bg-amber-950/60",
      text: "text-amber-700 dark:text-amber-300",
      icon: Eye,
    },
    approved: {
      bg: "bg-blue-100 dark:bg-blue-950/60",
      text: "text-blue-700 dark:text-blue-300",
      icon: CheckCircle,
    },
    implemented: {
      bg: "bg-emerald-100 dark:bg-emerald-950/60",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: Zap,
    },
    archived: {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      icon: Archive,
    },
  };

  const { bg, text, icon: Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {t(`status.${status}`)}
    </span>
  );
}

// =============================================================================
// IMPACT BADGE COMPONENT
// =============================================================================

function ImpactBadge({
  level,
  t,
}: {
  level: ImpactLevel;
  t: (key: string) => string;
}) {
  const config: Record<ImpactLevel, { bg: string; text: string }> = {
    low: { bg: "bg-green-100", text: "text-green-700" },
    medium: { bg: "bg-yellow-100", text: "text-yellow-700" },
    high: { bg: "bg-orange-100", text: "text-orange-700" },
    critical: { bg: "bg-red-100", text: "text-red-700" },
  };

  const { bg, text } = config[level];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      {t(`impact.${level}`)}
    </span>
  );
}

// =============================================================================
// FILTER BAR COMPONENT
// =============================================================================

function FilterBar({
  filters,
  updateFilters,
  t,
  dir,
}: {
  filters: DecisionFilters;
  updateFilters: (updates: Partial<DecisionFilters>) => void;
  t: (key: string) => string;
  dir: string;
}) {
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions: { id: DecisionStatus | "all"; label: string }[] = [
    { id: "all", label: t("filters.status.all") },
    { id: "draft", label: t("status.draft") },
    { id: "review", label: t("status.review") },
    { id: "approved", label: t("status.approved") },
    { id: "implemented", label: t("status.implemented") },
    { id: "archived", label: t("status.archived") },
  ];

  const impactOptions: { id: ImpactLevel | "all"; label: string }[] = [
    { id: "all", label: t("filters.impact.all") },
    { id: "low", label: t("impact.low") },
    { id: "medium", label: t("impact.medium") },
    { id: "high", label: t("impact.high") },
    { id: "critical", label: t("impact.critical") },
  ];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.impact_level !== "all") count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (filters.owner_id) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 space-y-4">
      {/* Search and Quick Filters */}
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
              status: "all",
              impact_level: "all",
              date_from: "",
              date_to: "",
              owner_id: "",
            })
          }
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700 transition-colors"
        >
          {t("filters.clear")}
        </button>
      </div>

      {/* Expanded Filters */}
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
                {t("filters.status.label")}
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  updateFilters({
                    status: e.target.value as DecisionStatus | "all",
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.impact.label")}
              </label>
              <select
                value={filters.impact_level}
                onChange={(e) =>
                  updateFilters({
                    impact_level: e.target.value as ImpactLevel | "all",
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {impactOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.dateFrom")}
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilters({ date_from: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t("filters.dateTo")}
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilters({ date_to: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// DECISION TABLE COMPONENT
// =============================================================================

function DecisionTable({
  decisions,
  loading,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  t,
}: {
  decisions: Decision[];
  loading: boolean;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  onRowClick: (decision: Decision) => void;
  t: (key: string) => string;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const columns = [
    { key: "title", label: t("table.title"), sortable: true },
    { key: "status", label: t("filters.status.label"), sortable: true },
    { key: "impact_level", label: t("filters.impact.label"), sortable: true },
    { key: "owner_name", label: t("table.owner"), sortable: true },
    { key: "updated_at", label: t("table.updated"), sortable: true },
  ];

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
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/3" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-20" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
        <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">{t("table.empty")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSort(col.key)}
                  className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider ${
                    col.sortable
                      ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {decisions.map((decision, index) => (
              <motion.tr
                key={decision.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onRowClick(decision)}
                className="hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-xs">
                    {decision.title}
                  </div>
                  {decision.description && (
                    <div className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                      {decision.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={decision.status} t={t} />
                </td>
                <td className="px-6 py-4">
                  <ImpactBadge level={decision.impact_level} t={t} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {decision.owner_name?.charAt(0) || "?"}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {decision.owner_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                  {formatDate(decision.updated_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowClick(decision);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
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
// DECISION DETAIL DRAWER COMPONENT
// =============================================================================

function DecisionDrawer({
  decision,
  history,
  onClose,
  onUpdateStatus,
  t,
  dir,
}: {
  decision: Decision | null;
  history: DecisionHistory[];
  onClose: () => void;
  onUpdateStatus: (status: DecisionStatus) => void;
  t: (key: string) => string;
  // Drives the comment textarea direction (user-typed content must follow the UI).
  dir: string;
}) {
  const [activeTab, setActiveTab] = useState<
    "details" | "history" | "comments"
  >("details");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<DecisionComment[]>([]);

  const handleAddComment = async () => {
    if (!comment.trim() || !decision) return;
    try {
      const newComment: DecisionComment = {
        id: Date.now(),
        decision_id: decision.id,
        user_id: 1,
        user_name: "Current User",
        content: comment.trim(),
        created_at: new Date().toISOString(),
      };
      setComments((prev) => [newComment, ...prev]);
      setComment("");
      await api.addDecisionComment(decision.id, comment.trim());
    } catch (err) {
      console.error("Failed to post decision comment:", err);
    }
  };

  if (!decision) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusWorkflow: DecisionStatus[] = [
    "draft",
    "review",
    "approved",
    "implemented",
    "archived",
  ];
  const currentStatusIndex = statusWorkflow.indexOf(decision.status);

  const canTransitionTo = (status: DecisionStatus) => {
    const idx = statusWorkflow.indexOf(status);
    return idx === currentStatusIndex + 1;
  };

  return (
    <PodaciumDrawer
      isOpen={Boolean(decision)}
      onClose={onClose}
      position="end"
      size="lg"
    >
      <DrawerContent
        className="w-full max-w-2xl"
        overlayClassName="bg-black/20"
      >
        {/* Header */}
        <DrawerHeader className="items-center border-gray-100 px-6 py-4 dark:border-slate-800">
          <div>
            <DrawerTitle className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {decision.title}
            </DrawerTitle>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {t("drawer.id")} #{decision.id}
            </p>
          </div>
          <DrawerClose className="rounded-lg p-2 text-gray-400" />
        </DrawerHeader>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 px-6">
          {(["details", "history", "comments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
              }`}
            >
              {t(`drawer.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* Content */}
        <DrawerBody className="p-6">
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Status and Impact */}
              <div className="flex flex-wrap gap-3">
                <StatusBadge status={decision.status} t={t} />
                <ImpactBadge level={decision.impact_level} t={t} />
              </div>

              {/* Description */}
              {decision.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                    {t("drawer.description")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                    {decision.description}
                  </p>
                </div>
              )}

              {/* Rationale */}
              {decision.rationale && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                    {t("drawer.rationale")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                    {decision.rationale}
                  </p>
                </div>
              )}

              {/* Expected Outcome */}
              {decision.expected_outcome && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                    {t("drawer.expectedOutcome")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                    {decision.expected_outcome}
                  </p>
                </div>
              )}

              {/* Actual Outcome */}
              {decision.actual_outcome && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                    {t("drawer.actualOutcome")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                    {decision.actual_outcome}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t("drawer.created")}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {formatDate(decision.created_at)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t("drawer.updated")}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {formatDate(decision.updated_at)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t("drawer.owner")}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {decision.owner_name || t("drawer.unknown")}
                  </div>
                </div>
                {decision.dataset_name && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {t("drawer.dataset")}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {decision.dataset_name}
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {decision.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                    {t("drawer.tags")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {decision.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  {t("drawer.noHistory")}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute start-4 top-0 bottom-0 w-0.5 bg-gray-100 dark:bg-slate-800" />
                  {history.map((item, index) => (
                    <div key={item.id} className="relative ps-10 pb-6">
                      <div className="absolute start-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                      <div className="bg-gray-50 dark:bg-slate-900/60 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <StatusBadge status={item.status} t={t} />
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {formatDate(item.changed_at)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-slate-400">
                          {t("drawer.changedBy")} {item.changed_by_name}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "comments" && (
            <div className="space-y-4">
              {/* Comment Input */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Y
                  </span>
                </div>
                <div className="flex-1">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("drawer.addComment")}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    dir={dir}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!comment.trim()}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4 inline mr-1" />
                    {t("drawer.send")}
                  </button>
                </div>
              </div>

              {/* Comments List */}
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  {t("drawer.noComments")}
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-gray-600 dark:text-slate-400">
                          {c.user_name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {c.user_name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DrawerBody>

        {/* Footer Actions */}
        <DrawerFooter className="border-gray-100 bg-gray-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap gap-2">
            {statusWorkflow.slice(currentStatusIndex + 1).map(
              (status) =>
                canTransitionTo(status) && (
                  <button
                    key={status}
                    onClick={() => onUpdateStatus(status)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    {t(`drawer.transitionTo.${status}`)}
                  </button>
                ),
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </PodaciumDrawer>
  );
}

// =============================================================================
// CREATE DECISION MODAL COMPONENT
// =============================================================================

function CreateDecisionModal({
  initialData,
  onClose,
  onCreate,
  t,
  dir,
}: {
  initialData?: {
    title?: string;
    description?: string;
    impact_level?: ImpactLevel;
    rationale?: string;
    expected_outcome?: string;
    dataset_id?: number;
  };
  onClose: () => void;
  onCreate: (data: Partial<Decision>) => void;
  t: (key: string) => string;
  dir: string;
}) {
  const [formData, setFormData] = useState({
    title: cleanBiDiText(initialData?.title),
    description: cleanBiDiText(initialData?.description),
    impact_level: initialData?.impact_level || ("medium" as ImpactLevel),
    rationale: cleanBiDiText(initialData?.rationale),
    expected_outcome: cleanBiDiText(initialData?.expected_outcome),
    dataset_id: initialData?.dataset_id,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: cleanBiDiText(initialData.title),
        description: cleanBiDiText(initialData.description),
        impact_level: initialData.impact_level || "medium",
        rationale: cleanBiDiText(initialData.rationale),
        expected_outcome: cleanBiDiText(initialData.expected_outcome),
        dataset_id: initialData.dataset_id,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate(formData);
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
                  {t("create.titleLabel")}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
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
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  dir={dir}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.impact")}
                </label>
                <select
                  value={formData.impact_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      impact_level: e.target.value as ImpactLevel,
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="low">{t("impact.low")}</option>
                  <option value="medium">{t("impact.medium")}</option>
                  <option value="high">{t("impact.high")}</option>
                  <option value="critical">{t("impact.critical")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.rationale")}
                </label>
                <textarea
                  value={formData.rationale}
                  onChange={(e) =>
                    setFormData({ ...formData, rationale: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  dir={dir}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("create.expectedOutcome")}
                </label>
                <textarea
                  value={formData.expected_outcome}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_outcome: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  dir={dir}
                />
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
                  disabled={loading || !formData.title.trim()}
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
// PAGINATION COMPONENT
// =============================================================================

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  t,
  dir,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
  dir: string;
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
      <div className="text-sm text-gray-500 dark:text-slate-400">
        {t("pagination.page")} {currentPage} {t("pagination.of")} {totalPages}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft
            className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
        </button>
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-sm transition-colors"
            >
              1
            </button>
            {startPage > 2 && <span className="px-1">...</span>}
          </>
        )}
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              page === currentPage
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-100 dark:hover:bg-slate-800"
            }`}
          >
            {page}
          </button>
        ))}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-sm transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight
            className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export function DecisionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("bi.decisions");
  const { dir } = useBidi();

  const {
    isAuthenticated,
    loading: authGuardLoading,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
  } = useAuthGuard();

  // State
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const [sortField, setSortField] = useState("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<DecisionFilters>({
    status: "all",
    impact_level: "all",
    date_from: "",
    date_to: "",
    owner_id: "",
    search: "",
  });
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(
    null,
  );
  const [history, setHistory] = useState<DecisionHistory[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialData, setCreateInitialData] = useState<{
    title?: string;
    description?: string;
    impact_level?: ImpactLevel;
    rationale?: string;
    expected_outcome?: string;
    dataset_id?: number;
  }>({});

  // Parse URL search parameters to pre-fill template and open modal automatically
  useEffect(() => {
    if (!searchParams) return;
    const titleParam = searchParams.get("title");
    const datasetIdParam =
      searchParams.get("datasetId") || searchParams.get("dataset_id");
    const rationaleParam = searchParams.get("rationale");
    const descriptionParam = searchParams.get("description");
    const expectedOutcomeParam =
      searchParams.get("expected_outcome") ||
      searchParams.get("expectedOutcome");
    const impactParam =
      searchParams.get("impact") || searchParams.get("impact_level");

    const cleanedTitle = cleanBiDiText(titleParam);
    const cleanedRationale = cleanBiDiText(rationaleParam);
    const cleanedDescription = cleanBiDiText(descriptionParam);
    const cleanedOutcome = cleanBiDiText(expectedOutcomeParam);
    const parsedDatasetId =
      datasetIdParam && datasetIdParam.trim() !== ""
        ? parseInt(datasetIdParam, 10)
        : undefined;
    const validImpact: ImpactLevel | undefined =
      impactParam && ["low", "medium", "high", "critical"].includes(impactParam)
        ? (impactParam as ImpactLevel)
        : undefined;

    const hasPrefillData =
      Boolean(cleanedTitle) ||
      Boolean(cleanedRationale) ||
      Boolean(cleanedDescription) ||
      Boolean(cleanedOutcome) ||
      (parsedDatasetId !== undefined && !isNaN(parsedDatasetId));

    if (hasPrefillData) {
      setCreateInitialData({
        title: cleanedTitle,
        description: cleanedDescription,
        rationale: cleanedRationale,
        expected_outcome: cleanedOutcome,
        dataset_id:
          parsedDatasetId && !isNaN(parsedDatasetId)
            ? parsedDatasetId
            : undefined,
        impact_level: validImpact || "medium",
      });
      setShowCreateModal(true);
    }
  }, [searchParams]);

  // Fetch decisions from API
  useEffect(() => {
    if (isAuthenticated) {
      loadDecisions();
    } else if (!authGuardLoading) {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    authGuardLoading,
    currentPage,
    sortField,
    sortDirection,
    filters,
  ]);

  const loadDecisions = async () => {
    try {
      setLoading(true);

      const response = await api.listDecisions(currentPage, perPage, {
        status: filters.status !== "all" ? filters.status : undefined,
        impact_level:
          filters.impact_level !== "all" ? filters.impact_level : undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        owner_id: filters.owner_id || undefined,
        search: filters.search || undefined,
      });

      setDecisions(response.decisions || []);
      setTotal(response.total || 0);
    } catch (error) {
      // Error handling done via toast notification
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = useCallback((updates: Partial<DecisionFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1);
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRowClick = async (decision: Decision) => {
    setSelectedDecision(decision);
    try {
      const history = await api.listDecisionHistory(decision.id);
      setHistory(history);
    } catch (error) {
      setHistory([]);
    }
  };

  const handleUpdateStatus = async (status: DecisionStatus) => {
    if (!selectedDecision) return;

    try {
      await api.updateDecisionStatus(selectedDecision.id, status);
      await loadDecisions();
      setSelectedDecision((prev) =>
        prev ? { ...prev, status, updated_at: new Date().toISOString() } : null,
      );
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const handleCreate = async (data: Partial<Decision>) => {
    try {
      await api.createDecision({
        title: data.title || "",
        description: data.description,
        impact_level: data.impact_level || "medium",
        rationale: data.rationale,
        expected_outcome: data.expected_outcome,
        dataset_id: data.dataset_id,
        tags: data.tags,
      });
      await loadDecisions();
    } catch (error) {
      // Error handling done via toast notification
    }
  };

  const totalPages = Math.ceil(total / perPage);

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
            onClick={() => {
              setCreateInitialData({});
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            {t("createButton")}
          </motion.button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(
            ["draft", "review", "approved", "implemented"] as DecisionStatus[]
          ).map((status) => {
            const count = (decisions || []).filter(
              (d) => d.status === status,
            ).length;
            return (
              <motion.div
                key={status}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4"
              >
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {count}
                </div>
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  {t(`status.${status}`)}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            filters={filters}
            updateFilters={updateFilters}
            t={t}
            dir={dir}
          />
        </div>

        {/* Decision Table */}
        <DecisionTable
          decisions={decisions}
          loading={loading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          t={t}
        />

        {/* Pagination */}
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            t={t}
            dir={dir}
          />
        </div>
      </div>

      {/* Decision Drawer */}
      <DecisionDrawer
        decision={selectedDecision}
        history={history}
        onClose={() => setSelectedDecision(null)}
        onUpdateStatus={handleUpdateStatus}
        t={t}
        dir={dir}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <CreateDecisionModal
          initialData={createInitialData}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          t={t}
          dir={dir}
        />
      )}

      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />

      <React.Suspense
        fallback={<div className="h-32 bg-gray-50 dark:bg-slate-900/60" />}
      >
        <Footer />
      </React.Suspense>
    </main>
  );
}

export default function DecisionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <DecisionsPageContent />
    </Suspense>
  );
}
