"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Database,
  Upload,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Trash2,
  Edit3,
  Download,
  Plus,
  FileSpreadsheet,
  FileJson,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  BarChart2,
  Calendar,
  HardDrive,
  Sparkles,
  Rows3,
  Columns,
  X,
  Home,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { api, BiDatasetMetadata, BiDatasetListResponse } from "@/lib/api";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// ===========================================================================
// UTILITY FUNCTIONS
// ===========================================================================

function formatFileSize(bytes: number | undefined, locale?: string): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNumber(num: number | undefined, locale?: string): string {
  if (num === undefined || num === null) return "—";
  return num.toLocaleString();
}

function formatDate(dateString: string | undefined, locale?: string): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString(locale || undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusConfig(status: string) {
  switch (status.toLowerCase()) {
    case "ready":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        border: "border-emerald-200",
        icon: CheckCircle,
      };
    case "processing":
      return {
        bg: "bg-amber-100",
        text: "text-amber-700",
        border: "border-amber-200",
        icon: Loader2,
      };
    case "pending":
      return {
        bg: "bg-gray-100 dark:bg-slate-800",
        text: "text-gray-700 dark:text-slate-300",
        border: "border-gray-200 dark:border-slate-800",
        icon: Clock,
      };
    case "error":
      return {
        bg: "bg-red-100",
        text: "text-red-700",
        border: "border-red-200",
        icon: XCircle,
      };
    default:
      return {
        bg: "bg-gray-100 dark:bg-slate-800",
        text: "text-gray-700 dark:text-slate-300",
        border: "border-gray-200 dark:border-slate-800",
        icon: Clock,
      };
  }
}

// ===========================================================================
// ANIMATION CONFIGS
// ===========================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function Breadcrumb({ t, dir }: { t: (key: string) => string; dir: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-4 h-4" />
        <span>{t("bi.datasets.nav.breadcrumb.home")}</span>
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("bi.datasets.nav.breadcrumb.bi")}
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("bi.datasets.nav.breadcrumb.datasets")}
      </span>
    </nav>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}
    >
      <Icon
        className={`w-3 h-3 ${status.toLowerCase() === "processing" ? "animate-spin" : ""}`}
      />
      {t(`bi.datasets.list.status.${status.toLowerCase()}`) || status}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient}`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {value}
          </div>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {label}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({
  t,
  onUpload,
}: {
  t: (key: string) => string;
  onUpload: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16"
    >
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
        <Database className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {t("bi.datasets.list.empty.title")}
      </h3>
      <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
        {t("bi.datasets.list.empty.description")}
      </p>
      <motion.button
        onClick={onUpload}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
      >
        <Upload className="w-5 h-5" />
        {t("bi.datasets.list.empty.action")}
      </motion.button>
    </motion.div>
  );
}

function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  datasetName,
  count = 1,
  isDeleting,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  datasetName?: string;
  count?: number;
  isDeleting: boolean;
  t: (key: string) => string;
}) {
  if (!isOpen) return null;

  const isBulk = count > 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-800"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {isBulk
                  ? t("bi.datasets.list.bulkDelete.confirmTitle").replace(
                      "{count}",
                      String(count),
                    )
                  : t("bi.datasets.modals.delete.title")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("bi.datasets.modals.delete.subtitle")}
              </p>
            </div>
          </div>
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            {isBulk
              ? t("bi.datasets.list.bulkDelete.confirmMessage").replace(
                  "{count}",
                  String(count),
                )
              : t("bi.datasets.modals.delete.message").replace(
                  "{name}",
                  datasetName || "",
                )}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t("bi.datasets.modals.delete.cancel")}
            </button>
            <motion.button
              onClick={onConfirm}
              disabled={isDeleting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isBulk
                    ? t("bi.datasets.list.bulkDelete.deleting").replace(
                        "{count}",
                        String(count),
                      )
                    : t("bi.datasets.modals.delete.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {isBulk
                    ? t("bi.datasets.list.bulkDelete.button").replace(
                        "{count}",
                        String(count),
                      )
                    : t("bi.datasets.modals.delete.confirm")}
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DatasetRow({
  dataset,
  selected,
  onSelect,
  onView,
  onDelete,
  onExport,
  t,
  dir,
  locale,
}: {
  dataset: BiDatasetMetadata;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onView: () => void;
  onDelete: () => void;
  onExport?: () => void;
  t: (key: string) => string;
  dir: string;
  locale?: string;
}) {
  const [showActions, setShowActions] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 0,
    right: 0,
    bottom: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      });
    }
  }, []);

  const toggleActions = () => {
    if (!showActions) {
      updateCoords();
    }
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (showActions) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [showActions, updateCoords]);

  const getDropdownStyles = () => {
    const menuWidth = 176; // w-44
    const menuHeight = 160;
    const margin = 10;

    let top = (coords.bottom || 0) + 4;
    let left =
      dir === "rtl" ? coords.left || 0 : (coords.right || 0) - menuWidth;

    if (typeof window !== "undefined") {
      if (top + menuHeight > window.innerHeight - margin) {
        top = (coords.top || 0) - menuHeight - 4;
      }
      if (left + menuWidth > window.innerWidth - margin) {
        left = window.innerWidth - menuWidth - margin;
      }
      if (left < margin) {
        left = margin;
      }
    }
    return { top, left };
  };

  const dropdownStyles = getDropdownStyles();

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`border-b border-gray-100 dark:border-slate-800 transition-colors ${selected ? "bg-blue-50/80 dark:bg-blue-950/60" : "hover:bg-gray-50/50 dark:hover:bg-slate-800/60"}`}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-700 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <button
              onClick={onView}
              className="font-medium text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-start"
            >
              {dataset.name}
            </button>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-xs">
              {dataset.description || "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={dataset.status || "PENDING"} t={t} />
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
        {formatNumber(dataset.row_count, locale)}
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
        {dataset.column_count}
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
        {formatFileSize(dataset.file_size, locale)}
      </td>
      <td className="px-6 py-4 text-gray-500 dark:text-slate-400 text-sm">
        {formatDate(dataset.updated_at, locale)}
      </td>
      <td className="px-6 py-4">
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={toggleActions}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {mounted &&
            typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {showActions && coords.top !== 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-[9998] bg-black/5 backdrop-blur-[1px]"
                      onClick={() => setShowActions(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ duration: 0.2, ease: "circOut" }}
                      className="fixed w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl z-[9999] py-1 overflow-hidden pointer-events-auto"
                      style={{
                        top: dropdownStyles.top,
                        left: dropdownStyles.left,
                        transformOrigin: "top center",
                      }}
                    >
                      <button
                        onClick={() => {
                          onView();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 text-start"
                      >
                        <Eye className="w-4 h-4 text-blue-500 dark:text-blue-400" />{" "}
                        {t("bi.datasets.list.table.actions.view")}
                      </button>
                      <button
                        onClick={() => {
                          onExport?.();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 text-start"
                      >
                        <Download className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />{" "}
                        {t("bi.datasets.list.table.actions.export")}
                      </button>
                      <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                      <button
                        onClick={() => {
                          onDelete();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 text-start"
                      >
                        <Trash2 className="w-4 h-4" />{" "}
                        {t("bi.datasets.list.table.actions.delete")}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body,
            )}
        </div>
      </td>
    </motion.tr>
  );
}

// ===========================================================================
// MAIN PAGE
// ===========================================================================

function DatasetsPageContent() {
  const router = useRouter();
  const t = useTranslations();
  const { i18n } = useTranslations();
  const locale = i18n.language;
  const { dir } = useBidi();
  const { user } = useAuth();
  const {
    isAuthenticated,
    loading: authGuardLoading,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
  } = useAuthGuard({ redirectTo: "/auth/login", showModal: true });

  // State
  const [datasets, setDatasets] = useState<BiDatasetMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    dataset: BiDatasetMetadata | null;
    isDeleting: boolean;
    isBulk?: boolean;
  }>({
    isOpen: false,
    dataset: null,
    isDeleting: false,
    isBulk: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load datasets
  useEffect(() => {
    if (!isAuthenticated || authGuardLoading) return;

    const loadDatasets = async () => {
      try {
        setIsLoading(true);
        const response = await api.listDatasets();
        if (response && response.datasets) {
          setDatasets(response.datasets);
        }
      } catch (err) {
        console.error("Failed to load datasets:", err);
        setError(t("bi.datasets.errors.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    loadDatasets();
  }, [isAuthenticated, authGuardLoading]);

  // Filtered datasets
  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      const matchesSearch =
        !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDomain = !domainFilter || d.domain === domainFilter;
      const matchesStatus = !statusFilter || d.status === statusFilter;
      return matchesSearch && matchesDomain && matchesStatus;
    });
  }, [datasets, searchQuery, domainFilter, statusFilter]);

  // Paginated datasets
  const paginatedDatasets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDatasets.slice(start, start + itemsPerPage);
  }, [filteredDatasets, currentPage]);

  const totalPages = Math.ceil(filteredDatasets.length / itemsPerPage);

  // Stats
  const stats = useMemo(
    () => ({
      total: datasets.length,
      totalRows: datasets.reduce((sum, d) => sum + (d.row_count || 0), 0),
      avgQuality:
        datasets.length > 0
          ? Math.round(
              datasets.reduce((sum, d) => sum + (d.quality_score || 0), 0) /
                datasets.length,
            )
          : 0,
      totalSize: datasets.reduce((sum, d) => sum + (d.file_size || 0), 0),
    }),
    [datasets],
  );

  // Handlers
  const handleView = useCallback(
    (id: string) => router.push(`/bi/datasets/${id}`),
    [router],
  );

  const handleExport = useCallback(
    async (id: string) => {
      try {
        await api.exportDataset(id);
        toast.success(t("bi.datasets.detail.toasts.exported"));
      } catch (e) {
        console.error("Failed to export dataset", e);
        toast.error(t("bi.datasets.detail.errors.exportFailed"));
      }
    },
    [t],
  );
  const handleUpload = useCallback(
    () => router.push("/bi/datasets/upload"),
    [router],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(filteredDatasets.map((d) => d.dataset_id));
      } else {
        setSelectedIds([]);
      }
    },
    [filteredDatasets],
  );

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    }
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteModal({
      isOpen: true,
      dataset: null,
      isDeleting: false,
      isBulk: true,
    });
  }, [selectedIds]);

  const handleDelete = useCallback(async () => {
    if (!deleteModal.isOpen) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      if (deleteModal.isBulk) {
        const results = await Promise.allSettled(
          selectedIds.map((id) => api.deleteDataset(id)),
        );
        const successfulIds = results
          .map((r, i) => (r.status === "fulfilled" ? selectedIds[i] : null))
          .filter(Boolean) as string[];

        setDatasets((prev) =>
          prev.filter((d) => !successfulIds.includes(d.dataset_id)),
        );
        setSelectedIds((prev) =>
          prev.filter((id) => !successfulIds.includes(id)),
        );
      } else if (deleteModal.dataset) {
        await api.deleteDataset(deleteModal.dataset.dataset_id);
        setDatasets((prev) =>
          prev.filter((d) => d.dataset_id !== deleteModal.dataset?.dataset_id),
        );
      }
      setDeleteModal({
        isOpen: false,
        dataset: null,
        isDeleting: false,
        isBulk: false,
      });
      toast.success(t("bi.datasets.detail.toasts.deleted"));
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error(t("bi.datasets.detail.errors.deleteFailed"));
    } finally {
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteModal, selectedIds, t]);

  // Loading state
  if (authGuardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <Suspense
        fallback={
          <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800"></div>
        }
      >
        <Navbar />
      </Suspense>

      {/* Auth Required Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />

      {/* Main content */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Breadcrumb t={t} dir={dir} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("bi.datasets.list.title")}
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
              {t("bi.datasets.list.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                {t("bi.datasets.list.bulkDelete.button").replace(
                  "{count}",
                  String(selectedIds.length),
                )}
              </motion.button>
            )}
            <motion.button
              onClick={handleUpload}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              <Upload className="w-5 h-5" />
              {t("bi.datasets.list.actions.upload")}
            </motion.button>
          </div>
        </motion.div>

        {/* Quick Actions - New Mature UI Element */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <button
            onClick={() => router.push("/bi/datasets/upload?tab=file")}
            className="flex items-center gap-4 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 dark:border-blue-800/80 hover:shadow-md transition-all group text-start"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span className="block font-semibold text-gray-900 dark:text-slate-100">
                {t("bi.datasets.list.quickActions.upload")}
              </span>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {t("bi.datasets.list.quickActions.uploadDesc")}
              </span>
            </div>
          </button>
          <button
            onClick={() => router.push("/bi/datasets/upload?tab=whatsapp")}
            className="flex items-center gap-4 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-green-200 dark:border-emerald-800/80 hover:shadow-md transition-all group text-start"
          >
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-emerald-950/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-green-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
              </svg>
            </div>
            <div>
              <span className="block font-semibold text-gray-900 dark:text-slate-100">
                {t("bi.datasets.list.quickActions.whatsapp")}
              </span>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {t("bi.datasets.list.quickActions.whatsappDesc")}
              </span>
            </div>
          </button>
          <button
            onClick={() => router.push("/bi/datasets/upload?tab=manual")}
            className="flex items-center gap-4 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200 dark:border-indigo-800/80 hover:shadow-md transition-all group text-start"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <span className="block font-semibold text-gray-900 dark:text-slate-100">
                {t("bi.datasets.list.quickActions.manual")}
              </span>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {t("bi.datasets.list.quickActions.manualDesc")}
              </span>
            </div>
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Database}
            label={t("bi.datasets.list.stats.total")}
            value={formatNumber(stats.total, locale)}
            gradient="from-blue-500 to-indigo-600"
          />
          <StatCard
            icon={Rows3}
            label={t("bi.datasets.list.stats.rows")}
            value={formatNumber(stats.totalRows, locale)}
            gradient="from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={Sparkles}
            label={t("bi.datasets.list.stats.quality")}
            value={`${stats.avgQuality}%`}
            gradient="from-amber-500 to-orange-600"
          />
          <StatCard
            icon={HardDrive}
            label={t("bi.datasets.list.stats.storage")}
            value={formatFileSize(stats.totalSize, locale)}
            gradient="from-purple-500 to-pink-600"
          />
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-4 mb-6 sticky top-24 z-30"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("bi.datasets.list.filters.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("bi.datasets.list.filters.domain")}</option>
              <option value="finance">
                {t("bi.datasets.list.domains.finance")}
              </option>
              <option value="marketing">
                {t("bi.datasets.list.domains.marketing")}
              </option>
              <option value="sales">
                {t("bi.datasets.list.domains.sales")}
              </option>
              <option value="operations">
                {t("bi.datasets.list.domains.operations")}
              </option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("bi.datasets.list.filters.status")}</option>
              <option value="ready">
                {t("bi.datasets.list.status.ready")}
              </option>
              <option value="processing">
                {t("bi.datasets.list.status.processing")}
              </option>
              <option value="pending">
                {t("bi.datasets.list.status.pending")}
              </option>
              <option value="error">
                {t("bi.datasets.list.status.error")}
              </option>
            </select>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-slate-400">{error}</p>
            </div>
          ) : filteredDatasets.length === 0 ? (
            <EmptyState t={t} onUpload={handleUpload} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80 dark:bg-slate-800/80">
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      <th className="px-6 py-4 w-12">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={
                              filteredDatasets.length > 0 &&
                              selectedIds.length === filteredDatasets.length
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-700 rounded focus:ring-blue-500"
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.name")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.status")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.rows")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.columns")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.size")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.updated")}
                      </th>
                      <th className="px-6 py-4 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("bi.datasets.list.table.actions.title")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDatasets.map((dataset) => (
                      <DatasetRow
                        key={dataset.dataset_id}
                        dataset={dataset}
                        selected={selectedIds.includes(dataset.dataset_id)}
                        onSelect={(checked) =>
                          handleSelectRow(dataset.dataset_id, checked)
                        }
                        onView={() => handleView(dataset.dataset_id)}
                        onExport={() => handleExport(dataset.dataset_id)}
                        onDelete={() =>
                          setDeleteModal({
                            isOpen: true,
                            dataset,
                            isDeleting: false,
                          })
                        }
                        t={t}
                        dir={dir}
                        locale={locale}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60">
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {t("bi.datasets.list.pagination.showing")
                      .replace(
                        "{start}",
                        String((currentPage - 1) * itemsPerPage + 1),
                      )
                      .replace(
                        "{end}",
                        String(
                          Math.min(
                            currentPage * itemsPerPage,
                            filteredDatasets.length,
                          ),
                        ),
                      )
                      .replace("{total}", String(filteredDatasets.length))}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      <ChevronLeft
                        className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
                      />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === i + 1
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                      <ChevronRight
                        className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>

      <Suspense
        fallback={<div className="h-64 bg-gray-50 dark:bg-slate-900/60"></div>}
      >
        <Footer />
      </Suspense>

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, dataset: null, isDeleting: false })
        }
        onConfirm={handleDelete}
        datasetName={deleteModal.dataset?.name || ""}
        count={deleteModal.isBulk ? selectedIds.length : 1}
        isDeleting={deleteModal.isDeleting}
        t={t}
      />
    </div>
  );
}

export default function DatasetsPage() {
  return <DatasetsPageContent />;
}
