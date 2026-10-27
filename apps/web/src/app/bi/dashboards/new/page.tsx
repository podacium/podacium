"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Save,
  Eye,
  Settings,
  LayoutGrid,
  BarChart3,
  PieChart,
  LineChart,
  Table,
  Plus,
  Minus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  Edit3,
  GripVertical,
  RefreshCw,
  Sparkles,
  Home,
  ChevronDown,
  ChevronUp,
  Layers,
  Database,
  FileText,
  Calendar,
  Users,
  Globe,
  Lock,
  Building2,
  Wand2,
  Undo,
  Redo,
  Monitor,
  Smartphone,
  Tablet,
  Search,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  api,
  BiDatasetMetadata,
  BiDashboardCreate,
  BiDashboardResponse,
  WidgetType,
  LayoutType,
  DashboardConfig,
  DashboardLayout,
  BiWidget,
  BiWidgetCreate,
  DataSource,
  DatasetStatus,
} from "@/lib/api";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

type DashboardVisibility = "private" | "team" | "public";
type BuilderStep = "basic" | "dataset" | "widgets" | "layout" | "preview";

interface DashboardDraft {
  title: string;
  description: string;
  visibility: DashboardVisibility;
  datasetId: string | null;
  layoutType: LayoutType;
  config: DashboardConfig;
  layout: DashboardLayout;
  widgets: Partial<BiWidget>[];
}

interface ValidationErrors {
  title?: string;
  dataset?: string;
  widgets?: string;
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
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
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
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("nav.breadcrumb.bi")}
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi/dashboards"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("nav.breadcrumb.dashboards")}
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("nav.breadcrumb.create")}
      </span>
    </nav>
  );
}

// =============================================================================
// STEP INDICATOR COMPONENT
// =============================================================================

function StepIndicator({
  currentStep,
  steps,
  t,
}: {
  currentStep: BuilderStep;
  steps: { id: BuilderStep; label: string }[];
  t: (key: string) => string;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted
                    ? "bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600 text-white shadow-xs"
                    : isActive
                      ? "bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white shadow-sm ring-2 ring-blue-500/20"
                      : "bg-gray-100 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" />
                ) : isActive ? (
                  <span className="text-white font-bold">{index + 1}</span>
                ) : (
                  <span className="text-gray-500 dark:text-slate-400 font-medium">
                    {index + 1}
                  </span>
                )}
              </motion.div>
              <span
                className={`mt-2 text-xs ${
                  isActive
                    ? "font-bold text-blue-600 dark:text-blue-400"
                    : isCompleted
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "font-medium text-gray-500 dark:text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-2 rounded-full transition-colors ${
                  index < currentIndex
                    ? "bg-emerald-500 dark:bg-emerald-400 shadow-xs"
                    : "bg-gray-200 dark:bg-slate-800"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =============================================================================
// BASIC INFO STEP
// =============================================================================

function BasicInfoStep({
  draft,
  updateDraft,
  errors,
  t,
}: {
  draft: DashboardDraft;
  updateDraft: (updates: Partial<DashboardDraft>) => void;
  errors: ValidationErrors;
  t: (key: string) => string;
}) {
  const { dir } = useBidi();

  const visibilityOptions = [
    {
      id: "private" as const,
      icon: Lock,
      label: t("form.visibility.private"),
      desc: t("form.visibility.privateDesc"),
    },
    {
      id: "team" as const,
      icon: Building2,
      label: t("form.visibility.team"),
      desc: t("form.visibility.teamDesc"),
    },
    {
      id: "public" as const,
      icon: Globe,
      label: t("form.visibility.public"),
      desc: t("form.visibility.publicDesc"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
          {t("form.title.label")}{" "}
          <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => updateDraft({ title: e.target.value })}
          placeholder={t("form.title.placeholder")}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
            errors.title
              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/60"
              : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
          dir={dir}
        />
        {errors.title && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.title}
          </p>
        )}
        <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
          {t("form.title.hint")}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
          {t("form.description.label")}
        </label>
        <textarea
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          placeholder={t("form.description.placeholder")}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          dir={dir}
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
          {t("form.description.hint")}
        </p>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.visibility.label")}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibilityOptions.map((option) => (
            <motion.button
              key={option.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateDraft({ visibility: option.id })}
              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                draft.visibility === option.id
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-sm"
              }`}
            >
              {draft.visibility === option.id && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <option.icon
                className={`w-6 h-6 mb-2 ${
                  draft.visibility === option.id
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400"
                }`}
              />
              <div
                className={`font-medium text-sm ${
                  draft.visibility === option.id
                    ? "text-gray-900 dark:text-slate-100"
                    : "text-gray-700 dark:text-slate-300"
                }`}
              >
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {option.desc}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// DATASET SELECTOR STEP
// =============================================================================

function DatasetSelectorStep({
  draft,
  updateDraft,
  errors,
  t,
}: {
  draft: DashboardDraft;
  updateDraft: (updates: Partial<DashboardDraft>) => void;
  errors: ValidationErrors;
  t: (key: string) => string;
}) {
  const { dir } = useBidi();
  const [datasets, setDatasets] = useState<BiDatasetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const res = await api.listDatasets(1, 100);
      setDatasets(
        res.datasets.filter(
          (d: BiDatasetMetadata) => d.status === DatasetStatus.PROCESSED,
        ),
      );
    } catch (error) {
      console.error("Failed to load datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDatasets = useMemo(() => {
    if (!searchQuery) return datasets;
    const query = searchQuery.toLowerCase();
    return datasets.filter(
      (d) =>
        d.name?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query),
    );
  }, [datasets, searchQuery]);

  const selectedDataset = datasets.find(
    (d) => d.dataset_id === draft.datasetId,
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("form.dataset.search")}
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          dir={dir}
        />
        <button
          onClick={loadDatasets}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {errors.dataset && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errors.dataset}
        </div>
      )}

      {/* Dataset List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/60 rounded-xl">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">
            {t("form.dataset.empty")}
          </p>
          <Link
            href="/bi/datasets/upload"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t("form.dataset.upload")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {filteredDatasets.map((dataset) => (
            <motion.button
              key={dataset.dataset_id}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => updateDraft({ datasetId: dataset.dataset_id })}
              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                draft.datasetId === dataset.dataset_id
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-sm"
              }`}
            >
              {draft.datasetId === dataset.dataset_id && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    draft.datasetId === dataset.dataset_id
                      ? "bg-blue-100 dark:bg-blue-900/50"
                      : "bg-gray-100 dark:bg-slate-800"
                  }`}
                >
                  <Database
                    className={`w-5 h-5 ${
                      draft.datasetId === dataset.dataset_id
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-slate-400"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-slate-100 truncate">
                    {dataset.name}
                  </div>
                  {dataset.description && (
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {dataset.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>
                      {dataset.row_count?.toLocaleString()}{" "}
                      {t("common.uiLabels.rows")}
                    </span>
                    <span>•</span>
                    <span>
                      {dataset.column_count} {t("common.uiLabels.columns")}
                    </span>
                    <span>•</span>
                    <span>{formatDate(dataset.created_at)}</span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Selected Dataset Info */}
      {selectedDataset && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl"
        >
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-2">
            <CheckCircle className="w-5 h-5" />
            {t("form.dataset.selected")}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            {selectedDataset.name}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// =============================================================================
// WIDGET SELECTION STEP
// =============================================================================

function WidgetTypeIcon({ type }: { type: WidgetType }) {
  const icons: Record<WidgetType, React.ReactNode> = {
    [WidgetType.METRIC]: <BarChart3 className="w-6 h-6" />,
    [WidgetType.KPI]: <BarChart3 className="w-6 h-6" />,
    [WidgetType.BAR_CHART]: <BarChart3 className="w-6 h-6" />,
    [WidgetType.LINE_CHART]: <LineChart className="w-6 h-6" />,
    [WidgetType.AREA_CHART]: <LineChart className="w-6 h-6" />,
    [WidgetType.PIE_CHART]: <PieChart className="w-6 h-6" />,
    [WidgetType.SCATTER_PLOT]: (
      <div className="w-6 h-6 flex items-center justify-center text-xs font-bold">
        ●
      </div>
    ),
    [WidgetType.BUBBLE]: (
      <div className="w-6 h-6 flex items-center justify-center text-xs font-bold">
        ●
      </div>
    ),
    [WidgetType.HISTOGRAM]: (
      <div className="w-6 h-6 flex items-center justify-center text-xs font-bold">
        ▂
      </div>
    ),
    [WidgetType.TABLE]: <Table className="w-6 h-6" />,
    [WidgetType.HEATMAP]: (
      <div className="w-6 h-6 grid grid-cols-3 gap-0.5">
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
      </div>
    ),
    [WidgetType.SANKEY]: (
      <div className="w-6 h-6 flex items-end justify-center gap-0.5">
        <div className="w-1 bg-current rounded-t" />
        <div className="w-2 bg-current rounded-t" />
        <div className="w-1 bg-current rounded-t" />
      </div>
    ),
    [WidgetType.RADAR]: (
      <div className="w-6 h-6 border-2 border-current rounded-full" />
    ),
    [WidgetType.FUNNEL]: (
      <div className="w-6 h-6 flex flex-col items-center justify-center gap-0.5">
        <div className="w-4 h-1 bg-current rounded" />
        <div className="w-3 h-1 bg-current rounded" />
        <div className="w-2 h-1 bg-current rounded" />
      </div>
    ),
    [WidgetType.MAP]: <Globe className="w-6 h-6" />,
    [WidgetType.TREEMAP]: (
      <div className="w-6 h-6 grid grid-cols-2 gap-0.5 p-0.5">
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm" />
        <div className="bg-current rounded-sm col-span-2" />
      </div>
    ),
    [WidgetType.GAUGE]: (
      <div className="w-6 h-6 border-4 border-current rounded-full border-t-transparent" />
    ),
    [WidgetType.CUSTOM]: <Settings className="w-6 h-6" />,
  };

  return icons[type] || <BarChart3 className="w-6 h-6" />;
}

function WidgetsStep({
  draft,
  updateDraft,
  errors,
  t,
}: {
  draft: DashboardDraft;
  updateDraft: (updates: Partial<DashboardDraft>) => void;
  errors: ValidationErrors;
  t: (key: string) => string;
}) {
  const { dir } = useBidi();

  const widgetTypes = [
    {
      type: WidgetType.METRIC,
      label: t("types.metric"),
      desc: t("types.metricDesc"),
    },
    {
      type: WidgetType.BAR_CHART,
      label: t("types.bar"),
      desc: t("types.barDesc"),
    },
    {
      type: WidgetType.LINE_CHART,
      label: t("types.line"),
      desc: t("types.lineDesc"),
    },
    {
      type: WidgetType.PIE_CHART,
      label: t("types.pie"),
      desc: t("types.pieDesc"),
    },
    {
      type: WidgetType.TABLE,
      label: t("types.table"),
      desc: t("types.tableDesc"),
    },
    {
      type: WidgetType.HEATMAP,
      label: t("types.heatmap"),
      desc: t("types.heatmapDesc"),
    },
  ];

  const addWidget = (type: WidgetType) => {
    const newWidget: Partial<BiWidget> = {
      type,
      title: `New ${type} widget`,
      data_source: {
        type: "dataset",
        dataset_id: draft.datasetId || undefined,
      },
      position: { x: 0, y: 0, w: 4, h: 3 },
      style: {
        background_color: "#ffffff",
        border_radius: "8px",
      },
      interactivity: {
        clickable: true,
        tooltip: true,
        hover_effect: true,
      },
      visualization: {},
      filters: {},
    };

    updateDraft({ widgets: [...draft.widgets, newWidget] });
  };

  const removeWidget = (index: number) => {
    const newWidgets = [...draft.widgets];
    newWidgets.splice(index, 1);
    updateDraft({ widgets: newWidgets });
  };

  const updateWidgetTitle = (index: number, title: string) => {
    const newWidgets = [...draft.widgets];
    newWidgets[index] = { ...newWidgets[index], title };
    updateDraft({ widgets: newWidgets });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Widget Type Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.widgets.select")}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {widgetTypes.map((widget) => (
            <motion.button
              key={widget.type}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => addWidget(widget.type)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-all duration-200"
            >
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                <WidgetTypeIcon type={widget.type} />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300 text-center">
                {widget.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Selected Widgets List */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.widgets.selected")} ({draft.widgets.length})
        </label>

        {draft.widgets.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-slate-900/60 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-800">
            <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {t("form.widgets.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {draft.widgets.map((widget, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              >
                <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                  <WidgetTypeIcon type={widget.type!} />
                </div>
                <input
                  type="text"
                  value={widget.title || ""}
                  onChange={(e) => updateWidgetTitle(index, e.target.value)}
                  placeholder={t("form.widgets.titlePlaceholder")}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  dir={dir}
                />
                <button
                  type="button"
                  onClick={() => removeWidget(index)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {errors.widgets && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errors.widgets}
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// LAYOUT STEP
// =============================================================================

function LayoutStep({
  draft,
  updateDraft,
  t,
}: {
  draft: DashboardDraft;
  updateDraft: (updates: Partial<DashboardDraft>) => void;
  t: (key: string) => string;
}) {
  const { dir } = useBidi();

  const layoutTypes = [
    {
      id: LayoutType.GRID,
      icon: LayoutGrid,
      label: t("form.layout.types.grid"),
    },
    {
      id: LayoutType.FREEFORM,
      icon: Layers,
      label: t("form.layout.types.freeform"),
    },
    {
      id: LayoutType.REPORT,
      icon: FileText,
      label: t("form.layout.types.report"),
    },
    {
      id: LayoutType.PRESENTATION,
      icon: Monitor,
      label: t("form.layout.types.presentation"),
    },
  ];

  const layoutPresets = [
    {
      columns: 2,
      rowHeight: 100,
      gap: 16,
      label: t("form.layout.presets.compact"),
    },
    {
      columns: 3,
      rowHeight: 150,
      gap: 20,
      label: t("form.layout.presets.standard"),
    },
    {
      columns: 4,
      rowHeight: 200,
      gap: 24,
      label: t("form.layout.presets.spacious"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Layout Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.layout.type")}
        </label>
        <div className="grid grid-colsgrid-cols-4 gap-3-2 md:">
          {layoutTypes.map((layout) => (
            <motion.button
              key={layout.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                updateDraft({
                  layoutType: layout.id,
                  layout: {
                    ...draft.layout,
                    columns: 3,
                    row_height: 150,
                    gap: 20,
                  },
                });
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                draft.layoutType === layout.id
                  ? "border-blue-500 bg-blue-50/50 shadow-md"
                  : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
              }`}
            >
              <layout.icon
                className={`w-6 h-6 ${
                  draft.layoutType === layout.id
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-slate-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  draft.layoutType === layout.id
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-600 dark:text-slate-400"
                }`}
              >
                {layout.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Grid Settings */}
      {draft.layoutType === LayoutType.GRID && (
        <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl space-y-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
            {t("form.layout.grid")}
          </label>

          {/* Presets */}
          <div className="flex gap-2">
            {layoutPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  updateDraft({
                    layout: {
                      ...draft.layout,
                      columns: preset.columns,
                      row_height: preset.rowHeight,
                      gap: preset.gap,
                    },
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  draft.layout.columns === preset.columns
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                {t("form.layout.columns")}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={draft.layout.columns}
                onChange={(e) =>
                  updateDraft({
                    layout: {
                      ...draft.layout,
                      columns: parseInt(e.target.value) || 3,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                {t("form.layout.rowHeight")}
              </label>
              <input
                type="number"
                min={50}
                max={400}
                value={draft.layout.row_height}
                onChange={(e) =>
                  updateDraft({
                    layout: {
                      ...draft.layout,
                      row_height: parseInt(e.target.value) || 150,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                {t("form.layout.gap")}
              </label>
              <input
                type="number"
                min={0}
                max={48}
                value={draft.layout.gap}
                onChange={(e) =>
                  updateDraft({
                    layout: {
                      ...draft.layout,
                      gap: parseInt(e.target.value) || 20,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Grid */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.layout.preview")}
        </label>
        <div
          className="relative bg-gray-100 dark:bg-slate-800 rounded-xl p-4 overflow-hidden"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${draft.layout.columns}, 1fr)`,
            gap: `${draft.layout.gap}px`,
            minHeight: "200px",
          }}
        >
          {draft.widgets.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              {t("form.layout.previewEmpty")}
            </div>
          ) : (
            draft.widgets.slice(0, 6).map((widget, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                style={{
                  minHeight: `${draft.layout.row_height}px`,
                }}
              >
                <div className="text-center">
                  <WidgetTypeIcon type={widget.type!} />
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate max-w-full px-2">
                    {widget.title}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// PREVIEW STEP
// =============================================================================

function PreviewStep({
  draft,
  onPublish,
  onSaveDraft,
  publishing,
  saving,
  t,
}: {
  draft: DashboardDraft;
  onPublish: () => void;
  onSaveDraft: () => void;
  publishing: boolean;
  saving: boolean;
  t: (key: string) => string;
}) {
  const { dir } = useBidi();

  const visibilityLabels = {
    private: t("form.visibility.private"),
    team: t("form.visibility.team"),
    public: t("form.visibility.public"),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {t("form.preview.summary")}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t("form.preview.title")}
            </div>
            <div className="text-gray-900 dark:text-slate-100 font-medium">
              {draft.title || t("form.preview.untitled")}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t("form.preview.visibility")}
            </div>
            <div className="text-gray-900 dark:text-slate-100 font-medium">
              {visibilityLabels[draft.visibility]}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t("form.preview.widgets")}
            </div>
            <div className="text-gray-900 dark:text-slate-100 font-medium">
              {draft.widgets.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t("form.preview.layout")}
            </div>
            <div className="text-gray-900 dark:text-slate-100 font-medium">
              {draft.layoutType} ({draft.layout.columns} columns)
            </div>
          </div>
        </div>

        {draft.description && (
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/50">
            <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t("form.preview.description")}
            </div>
            <div className="text-gray-700 dark:text-slate-300">
              {draft.description}
            </div>
          </div>
        )}
      </div>

      {/* Widgets Preview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          {t("form.preview.widgetsPreview")}
        </h3>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(draft.layout.columns, 3)}, 1fr)`,
          }}
        >
          {draft.widgets.slice(0, 6).map((widget, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                  <WidgetTypeIcon type={widget.type!} />
                </div>
                <div className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
                  {widget.title}
                </div>
              </div>
              <div className="h-20 bg-gray-50 dark:bg-slate-900/60 rounded-lg flex items-center justify-center">
                <span className="text-xs text-gray-400">
                  {t("form.preview.widgetPreview")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSaveDraft}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {t("form.preview.saveDraft")}
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPublish}
          disabled={publishing}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {publishing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {t("form.preview.publish")}
        </motion.button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function NewDashboardPage() {
  const router = useRouter();
  const t = useTranslations("bi.dashboards.new");
  const { dir } = useBidi();

  // State
  const [currentStep, setCurrentStep] = useState<BuilderStep>("basic");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Draft state
  const [draft, setDraft] = useState<DashboardDraft>({
    title: "",
    description: "",
    visibility: "private",
    datasetId: null,
    layoutType: LayoutType.GRID,
    config: {
      columns: 3,
      row_height: 150,
      background_color: "#f9fafb",
      theme: "light",
      allow_edit: true,
      allow_share: false,
      auto_refresh: 0,
    },
    layout: {
      columns: 3,
      row_height: 150,
      gap: 20,
      breakpoints: {
        lg: 1200,
        md: 996,
        sm: 768,
        xs: 480,
      },
    },
    widgets: [],
  });

  // Autosave
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load draft from localStorage if available
    const savedDraft = localStorage.getItem("dashboard_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setDraft({ ...draft, ...parsed });
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, []);

  useEffect(() => {
    // Autosave to localStorage
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      localStorage.setItem("dashboard_draft", JSON.stringify(draft));
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draft]);

  // Steps
  const steps: { id: BuilderStep; label: string }[] = [
    { id: "basic", label: t("steps.basic") },
    { id: "dataset", label: t("steps.dataset") },
    { id: "widgets", label: t("steps.widgets") },
    { id: "layout", label: t("steps.layout") },
    { id: "preview", label: t("steps.preview") },
  ];

  // Validation
  const validateStep = (step: BuilderStep): boolean => {
    const newErrors: ValidationErrors = {};

    switch (step) {
      case "basic":
        if (!draft.title.trim()) {
          newErrors.title = t("form.title.required");
        }
        break;
      case "dataset":
        if (!draft.datasetId) {
          newErrors.dataset = t("form.dataset.required");
        }
        break;
      case "widgets":
        if (draft.widgets.length === 0) {
          newErrors.widgets = t("form.widgets.required");
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation
  const goToNextStep = () => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1].id;
      if (validateStep(currentStep)) {
        setCurrentStep(nextStep);
      }
    }
  };

  const goToPrevStep = () => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
      setErrors({});
    }
  };

  const goToStep = (step: BuilderStep) => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    const targetIndex = steps.findIndex((s) => s.id === step);

    // Can only go back or to next step if current is validated
    if (targetIndex <= currentIndex) {
      setCurrentStep(step);
      setErrors({});
    } else if (targetIndex === currentIndex + 1 && validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  // Update draft
  const updateDraft = useCallback((updates: Partial<DashboardDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setSaveSuccess(false);
  }, []);

  // Save draft
  const handleSaveDraft = async () => {
    try {
      setSaving(true);

      const dashboardData: BiDashboardCreate = {
        title: draft.title,
        description: draft.description,
        layout_type: draft.layoutType,
        dataset_id: draft.datasetId ? parseInt(draft.datasetId) : undefined,
        is_public: draft.visibility === "public",
        tags: [],
        config: draft.config,
        layout: draft.layout,
      };

      await api.createDashboard(dashboardData);

      localStorage.removeItem("dashboard_draft");
      setSaveSuccess(true);

      // Redirect after short delay
      setTimeout(() => {
        router.push("/bi/dashboards");
      }, 1500);
    } catch (error) {
      console.error("Failed to save draft:", error);
      setErrors({ title: t("detail.errors.createFailed") });
    } finally {
      setSaving(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setPublishing(true);

      const dashboardData: BiDashboardCreate = {
        title: draft.title,
        description: draft.description,
        layout_type: draft.layoutType,
        dataset_id: draft.datasetId ? parseInt(draft.datasetId) : undefined,
        is_public: draft.visibility === "public",
        tags: [],
        config: { ...draft.config, allow_share: true },
        layout: draft.layout,
        widgets: draft.widgets as any,
      };

      const response = await api.createDashboard(dashboardData);

      localStorage.removeItem("dashboard_draft");
      setPublishSuccess(true);

      // Redirect to the new dashboard
      setTimeout(() => {
        const redirectId = response.dashboard?.id || response.id;
        if (redirectId) {
          router.push(`/bi/dashboards/${redirectId}`);
        }
      }, 1500);
    } catch (error) {
      console.error("Failed to publish:", error);
      setErrors({ title: t("detail.errors.createFailed") });
    } finally {
      setPublishing(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case "basic":
        return (
          <BasicInfoStep
            draft={draft}
            updateDraft={updateDraft}
            errors={errors}
            t={t}
          />
        );
      case "dataset":
        return (
          <DatasetSelectorStep
            draft={draft}
            updateDraft={updateDraft}
            errors={errors}
            t={t}
          />
        );
      case "widgets":
        return (
          <WidgetsStep
            draft={draft}
            updateDraft={updateDraft}
            errors={errors}
            t={t}
          />
        );
      case "layout":
        return <LayoutStep draft={draft} updateDraft={updateDraft} t={t} />;
      case "preview":
        return (
          <PreviewStep
            draft={draft}
            onPublish={handlePublish}
            onSaveDraft={handleSaveDraft}
            publishing={publishing}
            saving={saving}
            t={t}
          />
        );
    }
  };

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
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-100 dark:bg-blue-950/60 dark:bg-blue-900/50 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb t={t} dir={dir} />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            {t("title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-2">
            {t("subtitle")}
          </p>
        </div>

        {/* Success Messages */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle className="w-5 h-5" />
              {t("detail.success.created")}
            </motion.div>
          )}

          {publishSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl text-blue-700 dark:text-blue-300"
            >
              <Sparkles className="w-5 h-5" />
              {t("detail.success.generated")}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} t={t} />

        {/* Form Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-xl p-6 sm:p-8">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        {currentStep !== "preview" && (
          <div className="flex justify-between mt-8">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goToPrevStep}
              disabled={currentStep === "basic"}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                currentStep === "basic"
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
              dir={dir}
            >
              <ArrowLeft
                className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
              />
              {t("navigation.back")}
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goToNextStep}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
              dir={dir}
            >
              {t("navigation.next")}
              <ArrowRight
                className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`}
              />
            </motion.button>
          </div>
        )}
      </div>

      <React.Suspense
        fallback={<div className="h-32 bg-gray-50 dark:bg-slate-900/60" />}
      >
        <Footer />
      </React.Suspense>
    </main>
  );
}
