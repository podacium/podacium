"use client";

import React, { useState, useMemo } from "react";
import {
  BiDashboardMetadata,
  BiWidget,
  WidgetType,
  BiDatasetMetadata,
  api,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Database,
  Plus,
  BarChart2,
  LineChart,
  PieChart,
  Activity,
  Save,
  Settings,
  Layout,
  Type,
  Filter,
  Palette,
  Maximize2,
  MousePointer2,
  Check,
  ChevronRight,
  Hash,
  DollarSign,
  Percent,
  Info,
  Loader2,
  Code2,
  Mail,
} from "lucide-react";
import { DashboardOverview } from "./DashboardOverview";
import { SmartChartLazy as SmartChart } from "./SmartChartLazy";
import { ChartType } from "./SmartChart";
import { BiMeasureBuilder } from "./BiMeasureBuilder";
import { ScheduledExportModal } from "./ScheduledExportModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

interface DashboardEditorProps {
  dashboard: BiDashboardMetadata;
  widgets: BiWidget[];
  datasets?: BiDatasetMetadata[];
  onUpdate?: (widgets: BiWidget[]) => void;
  onSave?: (widgets: BiWidget[]) => void;
  isSaving?: boolean;
}

type EditorTab = "data" | "design" | "format";

const WIDGET_REGISTRY: Record<
  string,
  {
    icon: any;
    nameKey: string;
    validate: (viz: any) => { valid: boolean; message: string };
  }
> = {
  bar: {
    icon: BarChart2,
    nameKey: "widgets.types.bar",
    validate: (viz) => {
      if (!viz.xAxis)
        return { valid: false, message: "semantic.required_dimension" };
      if (!viz.yAxis && (!viz.metrics || viz.metrics.length === 0))
        return { valid: false, message: "semantic.required_metric" };
      return { valid: true, message: "semantic.valid" };
    },
  },
  line: {
    icon: LineChart,
    nameKey: "widgets.types.line",
    validate: (viz) => {
      if (!viz.xAxis)
        return { valid: false, message: "semantic.required_dimension" };
      if (!viz.yAxis && (!viz.metrics || viz.metrics.length === 0))
        return { valid: false, message: "semantic.required_metric" };
      return { valid: true, message: "semantic.valid" };
    },
  },
  area: {
    icon: Activity,
    nameKey: "widgets.types.area",
    validate: (viz) => {
      if (!viz.xAxis)
        return { valid: false, message: "semantic.required_dimension" };
      if (!viz.yAxis && (!viz.metrics || viz.metrics.length === 0))
        return { valid: false, message: "semantic.required_metric" };
      return { valid: true, message: "semantic.valid" };
    },
  },
  pie: {
    icon: PieChart,
    nameKey: "widgets.types.pie",
    validate: (viz) => {
      if (!viz.xAxis)
        return { valid: false, message: "semantic.required_dimension" };
      const metricsCount = (viz.metrics?.length || 0) + (viz.yAxis ? 1 : 0);
      if (metricsCount === 0)
        return { valid: false, message: "semantic.required_metric" };
      if (metricsCount > 1)
        return { valid: false, message: "semantic.pie_limit" };
      return { valid: true, message: "semantic.valid" };
    },
  },
  kpi: {
    icon: Hash,
    nameKey: "widgets.types.kpi",
    validate: (viz) => {
      const metricsCount = (viz.metrics?.length || 0) + (viz.yAxis ? 1 : 0);
      if (metricsCount === 0)
        return { valid: false, message: "semantic.required_metric" };
      if (metricsCount > 1)
        return { valid: false, message: "semantic.kpi_limit" };
      return { valid: true, message: "semantic.valid" };
    },
  },
  table: {
    icon: Layout,
    nameKey: "widgets.types.table",
    validate: (viz) => {
      if (!viz.xAxis && (!viz.metrics || viz.metrics.length === 0))
        return { valid: false, message: "semantic.required_metric" };
      return { valid: true, message: "semantic.valid" };
    },
  },
};

export function DashboardEditor({
  dashboard,
  widgets: initialWidgets,
  datasets = [],
  onUpdate,
  onSave,
  isSaving = false,
}: DashboardEditorProps) {
  const { t } = useTranslations("bi");
  const [widgets, setWidgets] = useState<BiWidget[]>(initialWidgets);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("data");

  // Current Widget Draft State
  const [widgetDraft, setWidgetDraft] = useState<Partial<BiWidget>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false);

  // Close panel on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        setIsPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  // Memoize the widget being edited
  const currentWidget = useMemo(() => {
    if (editingWidgetId === null) return widgetDraft;
    return widgets.find((w) => w.id === editingWidgetId) || widgetDraft;
  }, [editingWidgetId, widgets, widgetDraft]);

  // Fetch columns when dataset changes
  React.useEffect(() => {
    const datasetId = widgetDraft.data_source?.dataset_id;
    if (datasetId) {
      setLoadingColumns(true);
      const ds = datasets.find((d) => d.dataset_id === datasetId);
      if (ds && ds.columns && ds.columns.length > 0) {
        setAvailableColumns(ds.columns);
        setLoadingColumns(false);
      } else {
        api
          .getDataset(datasetId)
          .then((res) => {
            const data = res.dataset;
            if (data && data.columns) {
              setAvailableColumns(data.columns);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch columns", err);
            toast.error(
              t("dashboards.detail.editor.errors.failedToLoadColumns"),
            );
          })
          .finally(() => setLoadingColumns(false));
      }
    } else {
      setAvailableColumns([]);
    }
  }, [widgetDraft.data_source?.dataset_id, datasets]);

  const handleOpenPanel = (widget?: BiWidget) => {
    if (widget) {
      setEditingWidgetId(widget.id);
      setWidgetDraft({ ...widget });
    } else {
      setEditingWidgetId(null);
      setWidgetDraft({
        id: -(Date.now() % 1000000), // Temporary ID
        type: WidgetType.BAR_CHART,
        title: "",
        description: "",
        data_source: {
          type: "dataset",
          dataset_id: datasets[0]?.dataset_id || "",
          query: "",
        },
        visualization: { type: "bar", xAxis: "", metrics: [] },
        filters: {},
        style: {
          background_color: "glass",
          border_radius: "24px",
          padding: "24px",
          margin: "0px",
          border_width: 0,
        },
        interactivity: {
          tooltip: true,
          hover_effect: true,
          clickable: true,
          drilldown: false,
          zoom: false,
          pan: false,
          export: true,
          refresh: false,
        },
        position: { x: 0, y: Infinity, w: 6, h: 8 },
        config: { format: { type: "auto", decimals: 0 } },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BiWidget);
    }
    setIsPanelOpen(true);
    setActiveTab("data");
  };

  const handleSaveWidget = () => {
    if (!widgetDraft.title && !editingWidgetId) {
      setWidgetDraft((prev) => ({
        ...prev,
        title: `Widget ${Date.now().toString().slice(-4)}`,
      }));
    }

    const finalWidget = {
      ...widgetDraft,
      id: editingWidgetId || -(Date.now() % 1000000),
      updated_at: new Date().toISOString(),
    } as BiWidget;

    let updatedWidgets: BiWidget[];
    if (editingWidgetId) {
      updatedWidgets = widgets.map((w) =>
        w.id === editingWidgetId ? finalWidget : w,
      );
    } else {
      updatedWidgets = [...widgets, finalWidget];
    }

    setWidgets(updatedWidgets);
    onUpdate?.(updatedWidgets);
    setIsPanelOpen(false);
  };

  const handleLayoutChange = (layout: any[]) => {
    const updatedWidgets = widgets.map((w) => {
      const item = layout.find((l: any) => l.i === w.id.toString());
      if (item) {
        return {
          ...w,
          position: {
            ...w.position,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        };
      }
      return w;
    });
    setWidgets(updatedWidgets);
    onUpdate?.(updatedWidgets);
  };

  const handleDeleteWidget = (id: number) => {
    const updated = widgets.filter((w) => w.id !== id);
    setWidgets(updated);
    onUpdate?.(updated);
  };

  // Semantic Validation
  const semanticValidation = useMemo(() => {
    const type = widgetDraft.visualization?.type || "bar";
    const viz = widgetDraft.visualization || {};

    const registryEntry = WIDGET_REGISTRY[type];
    if (registryEntry) {
      return registryEntry.validate(viz);
    }

    return { valid: true, message: "semantic.valid" };
  }, [widgetDraft.visualization]);

  // Update draft helper
  const updateDraft = (patch: any) => {
    setWidgetDraft((prev) => {
      const newState = { ...prev };
      // Deep merge for specific objects if needed
      if (patch.data_source)
        newState.data_source = { ...prev.data_source, ...patch.data_source };
      if (patch.visualization)
        newState.visualization = {
          ...prev.visualization,
          ...patch.visualization,
        };
      if (patch.style) newState.style = { ...prev.style, ...patch.style };
      if (patch.config)
        newState.config = { ...(prev as any).config, ...patch.config };

      return { ...newState, ...patch } as Partial<BiWidget>;
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 px-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Layout className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {t("dashboards.detail.tabs.edit")}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            {dashboard.description || t("dashboards.list.noDescription")}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowFormulaBuilder(!showFormulaBuilder)}
            className={`p-3.5 rounded-2xl border transition-all shadow-sm font-bold text-xs flex items-center gap-1.5 ${
              showFormulaBuilder
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            <Code2 className="w-5 h-5" />
            <span className="hidden sm:inline">
              {t("dashboards.detail.editor.actions.daxMetrics")}
            </span>
          </button>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold"
          >
            <Mail className="w-5 h-5 text-blue-500" />
            <span className="hidden sm:inline">
              {t("dashboards.detail.editor.actions.scheduleDigest")}
            </span>
          </button>
          <button
            onClick={() => handleOpenPanel()}
            aria-label={t("dashboards.detail.actions.addWidget")}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all font-black text-sm uppercase tracking-wider"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            {t("dashboards.detail.actions.addWidget")}
          </button>
          <button
            onClick={() => onSave?.(widgets)}
            disabled={isSaving}
            aria-label={t("accessibility.saveDashboard")}
            className="p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Save className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Optional DAX Calculated Metric Formula Bar */}
      {showFormulaBuilder && (
        <div className="px-6 mb-4">
          <BiMeasureBuilder />
        </div>
      )}

      {/* Scheduled Export Digest Configuration Modal */}
      <ScheduledExportModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        dashboardTitle={dashboard.name}
      />

      {/* Editor Canvas */}
      <div className="flex-1 bg-gray-50/50 dark:bg-slate-800/60 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-slate-800 m-4 p-4 min-h-[600px] overflow-hidden">
        <DashboardOverview
          dashboard={dashboard}
          widgets={widgets}
          isEditable={true}
          onLayoutChange={handleLayoutChange}
          onDeleteWidget={handleDeleteWidget}
          onEditWidget={handleOpenPanel}
        />
      </div>

      {/* Premium Editor Sidebar */}
      <PodaciumDrawer
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        position="end"
        size="lg"
      >
        <DrawerContent
          className="z-[70] w-full border-gray-100 sm:w-[540px]"
          overlayClassName="z-[60] bg-gray-900/40"
        >
          {/* Panel Header */}
          <DrawerHeader className="items-center border-gray-50 bg-white/80 px-6 py-6 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                {(() => {
                  const Icon =
                    WIDGET_REGISTRY[widgetDraft.visualization?.type || "bar"]
                      ?.icon || Settings;
                  return <Icon className="w-6 h-6" />;
                })()}
              </div>
              <div>
                <DrawerTitle className="text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight leading-tight">
                  {editingWidgetId ? t("widgets.edit") : t("widgets.add")}
                </DrawerTitle>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {widgetDraft.visualization?.type
                    ? t(
                        WIDGET_REGISTRY[widgetDraft.visualization.type]
                          ?.nameKey || "widgets.types.unsupported",
                        { type: widgetDraft.visualization.type },
                      )
                    : t("widgets.add")}
                </p>
              </div>
            </div>
            <DrawerClose
              aria-label={t("accessibility.closePanel")}
              className="rounded-2xl p-3 text-gray-400 dark:hover:bg-slate-800"
            />
          </DrawerHeader>

          {/* Tab Switcher */}
          <div className="flex p-2 bg-gray-50/50 dark:bg-slate-800/60 mx-6 mt-6 rounded-2xl border border-gray-100 dark:border-slate-800/80 dark:border-slate-800/50">
            {(["data", "design", "format"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm ring-1 ring-gray-100"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                }`}
              >
                {tab === "data" && <Database className="w-4 h-4" />}
                {tab === "design" && <Palette className="w-4 h-4" />}
                {tab === "format" && <Type className="w-4 h-4" />}
                {t(`dashboards.detail.editor.sidebar.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* Semantic Alert */}
          <AnimatePresence>
            {!semanticValidation.valid && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 rounded-2xl flex items-start gap-3"
              >
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300 leading-tight">
                  {t(
                    `dashboards.detail.editor.sidebar.${semanticValidation.message}`,
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <DrawerBody className="custom-scrollbar space-y-8 p-6">
            {/* DATA TAB */}
            {activeTab === "data" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.data.source")}
                  icon={<Database className="w-4 h-4" />}
                >
                  <div className="space-y-4">
                    <div className="relative">
                      <select
                        value={widgetDraft.data_source?.dataset_id}
                        onChange={(e) =>
                          updateDraft({
                            data_source: { dataset_id: e.target.value },
                          })
                        }
                        aria-label={t(
                          "dashboards.detail.editor.sidebar.data.source",
                        )}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-700 dark:text-slate-300 appearance-none cursor-pointer"
                      >
                        <option value="" disabled>
                          {t("dashboards.detail.autoGenerate.selectDataset")}
                        </option>
                        {datasets.map((ds) => (
                          <option key={ds.dataset_id} value={ds.dataset_id}>
                            {ds.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </div>
                    </div>
                  </div>
                </ConfigSection>

                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.data.xAxis")}
                  icon={<Activity className="w-4 h-4" />}
                >
                  <select
                    value={widgetDraft.visualization?.xAxis}
                    onChange={(e) =>
                      updateDraft({
                        visualization: {
                          ...widgetDraft.visualization,
                          xAxis: e.target.value,
                        },
                      })
                    }
                    aria-label={t(
                      "dashboards.detail.editor.sidebar.data.xAxis",
                    )}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-slate-100"
                  >
                    <option value="">{t("common.unknown")}</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </ConfigSection>

                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.data.metrics")}
                  icon={<BarChart2 className="w-4 h-4" />}
                >
                  <div className="space-y-3">
                    {/* Metric Rows would go here for multi-series support */}
                    <div className="flex gap-2">
                      <select
                        value={widgetDraft.visualization?.yAxis}
                        onChange={(e) =>
                          updateDraft({
                            visualization: {
                              ...widgetDraft.visualization,
                              yAxis: e.target.value,
                            },
                          })
                        }
                        aria-label={t(
                          "dashboards.detail.editor.sidebar.data.metrics",
                        )}
                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-sm"
                      >
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                      <select
                        value={widgetDraft.visualization?.aggregation}
                        onChange={(e) =>
                          updateDraft({
                            visualization: {
                              ...widgetDraft.visualization,
                              aggregation: e.target.value,
                            },
                          })
                        }
                        aria-label={t("accessibility.selectAggregation")}
                        className="w-32 px-4 py-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl font-black text-xs uppercase"
                      >
                        <option value="sum">
                          {t("widgets.aggregations.sum")}
                        </option>
                        <option value="avg">
                          {t("widgets.aggregations.avg")}
                        </option>
                        <option value="count">
                          {t("widgets.aggregations.count")}
                        </option>
                        <option value="min">
                          {t("widgets.aggregations.min")}
                        </option>
                        <option value="max">
                          {t("widgets.aggregations.max")}
                        </option>
                      </select>
                    </div>
                    <button className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-xs font-black text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:text-blue-400 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t("dashboards.detail.editor.sidebar.data.addMetric")}
                    </button>
                  </div>
                </ConfigSection>
              </motion.div>
            )}

            {/* DESIGN TAB */}
            {activeTab === "design" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.design.chartType")}
                  icon={<Layout className="w-4 h-4" />}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(WIDGET_REGISTRY).map(([key, entry]) => (
                      <VizBtn
                        key={key}
                        selected={widgetDraft.visualization?.type === key}
                        onClick={() =>
                          updateDraft({
                            visualization: {
                              ...widgetDraft.visualization,
                              type: key,
                            },
                          })
                        }
                        icon={<entry.icon />}
                        label={t(entry.nameKey)}
                      />
                    ))}
                  </div>
                </ConfigSection>

                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.design.theme")}
                  icon={<Palette className="w-4 h-4" />}
                >
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800 flex-1">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full shadow-sm" />
                      <span className="text-sm font-bold">
                        {t(
                          "dashboards.detail.editor.sidebar.design.palettes.azure",
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800 flex-1">
                      <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full shadow-sm" />
                      <span className="text-sm font-bold">
                        {t(
                          "dashboards.detail.editor.sidebar.design.palettes.forest",
                        )}
                      </span>
                    </div>
                  </div>
                </ConfigSection>

                <ConfigSection
                  title={t(
                    "dashboards.detail.editor.sidebar.design.interactive",
                  )}
                  icon={<Maximize2 className="w-4 h-4" />}
                >
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg group-hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors shadow-sm">
                          <Layout className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                          {t(
                            "dashboards.detail.editor.sidebar.design.glassmorphism",
                          )}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={
                          widgetDraft.style?.background_color === "glass"
                        }
                        onChange={(e) =>
                          updateDraft({
                            style: {
                              background_color: e.target.checked
                                ? "glass"
                                : "#ffffff",
                            },
                          })
                        }
                        className="w-5 h-5 rounded-md text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-700 transition-all"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg group-hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors shadow-sm">
                          <Filter className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                          {t("widgets.interactivity.export")}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetDraft.interactivity?.export !== false}
                        onChange={(e) =>
                          updateDraft({
                            interactivity: {
                              ...widgetDraft.interactivity,
                              export: e.target.checked,
                            },
                          })
                        }
                        className="w-5 h-5 rounded-md text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-700 transition-all"
                      />
                    </label>
                  </div>
                </ConfigSection>

                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.design.legend")}
                  icon={<Info className="w-4 h-4" />}
                >
                  <select
                    value={widgetDraft.config?.legend?.position || "bottom"}
                    onChange={(e) =>
                      updateDraft({
                        config: {
                          ...widgetDraft.config,
                          legend: {
                            ...widgetDraft.config?.legend,
                            position: e.target.value,
                          },
                        },
                      })
                    }
                    aria-label={t(
                      "dashboards.detail.editor.sidebar.design.legend",
                    )}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl font-bold text-gray-900 dark:text-slate-100"
                  >
                    <option value="top">{t("common.top")}</option>
                    <option value="bottom">{t("common.bottom")}</option>
                    <option value="left">{t("common.left")}</option>
                    <option value="right">{t("common.right")}</option>
                    <option value="hidden">{t("common.hidden")}</option>
                  </select>
                </ConfigSection>
              </motion.div>
            )}

            {/* FORMAT TAB */}
            {activeTab === "format" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <ConfigSection
                  title={t(
                    "dashboards.detail.editor.sidebar.format.numberFormat",
                  )}
                  icon={<Hash className="w-4 h-4" />}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormatBtn
                      active={widgetDraft.config?.format?.type === "auto"}
                      onClick={() =>
                        updateDraft({
                          config: {
                            format: {
                              ...widgetDraft.config?.format,
                              type: "auto",
                            },
                          },
                        })
                      }
                      icon={<Activity className="w-5 h-5" />}
                      label={t("dashboards.detail.editor.sidebar.format.auto")}
                    />
                    <FormatBtn
                      active={widgetDraft.config?.format?.type === "currency"}
                      onClick={() =>
                        updateDraft({
                          config: {
                            format: {
                              ...widgetDraft.config?.format,
                              type: "currency",
                            },
                          },
                        })
                      }
                      icon={<DollarSign className="w-5 h-5" />}
                      label={t(
                        "dashboards.detail.editor.sidebar.format.currency",
                      )}
                    />
                    <FormatBtn
                      active={widgetDraft.config?.format?.type === "percentage"}
                      onClick={() =>
                        updateDraft({
                          config: {
                            format: {
                              ...widgetDraft.config?.format,
                              type: "percentage",
                            },
                          },
                        })
                      }
                      icon={<Percent className="w-5 h-5" />}
                      label={t(
                        "dashboards.detail.editor.sidebar.format.percentage",
                      )}
                    />
                    <FormatBtn
                      active={widgetDraft.config?.format?.type === "decimal"}
                      onClick={() =>
                        updateDraft({
                          config: {
                            format: {
                              ...widgetDraft.config?.format,
                              type: "decimal",
                            },
                          },
                        })
                      }
                      icon={<Hash className="w-5 h-5" />}
                      label={t(
                        "dashboards.detail.editor.sidebar.format.decimals",
                      )}
                    />
                  </div>
                </ConfigSection>

                <ConfigSection
                  title={t("dashboards.detail.editor.sidebar.format.decimals")}
                  icon={<Info className="w-4 h-4" />}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="4"
                      step="1"
                      value={widgetDraft.config?.format?.decimals || 0}
                      onChange={(e) =>
                        updateDraft({
                          config: {
                            format: {
                              ...widgetDraft.config?.format,
                              decimals: parseInt(e.target.value),
                            },
                          },
                        })
                      }
                      aria-label={t(
                        "dashboards.detail.editor.sidebar.format.decimals",
                      )}
                      className="flex-1 h-2 bg-gray-200 dark:bg-slate-800/90 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black rounded-xl border border-blue-100 dark:border-blue-900/50">
                      {widgetDraft.config?.format?.decimals || 0}
                    </span>
                  </div>
                </ConfigSection>
              </motion.div>
            )}

            {/* Real-time Preview Area */}
            <div className="pt-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  {t("dashboards.detail.editor.sidebar.data.preview")}
                </h4>
                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-md border border-emerald-100 dark:border-emerald-900/50 uppercase tracking-tighter">
                  {t("dashboards.detail.editor.sidebar.data.liveSync")}
                </span>
              </div>
              <div
                className={`p-4 rounded-3xl border border-gray-100 dark:border-slate-800 transition-all overflow-hidden ${widgetDraft.style?.background_color === "glass" ? "bg-gradient-to-br from-blue-50/20 to-indigo-50/20 backdrop-blur-md border-white/40 shadow-xl" : "bg-gray-50 dark:bg-slate-900/60 shadow-inner"}`}
              >
                <SmartChart
                  type={(widgetDraft.visualization?.type as ChartType) || "bar"}
                  height={240}
                  data={[
                    { k: "Jan", v: 4000 },
                    { k: "Feb", v: 3000 },
                    { k: "Mar", v: 2000 },
                    { k: "Apr", v: 2780 },
                    { k: "May", v: 1890 },
                  ]}
                  dataKey="v"
                  categoryKey="k"
                />
              </div>
            </div>
          </DrawerBody>

          {/* Footer Actions */}
          <DrawerFooter className="gap-3 border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setIsPanelOpen(false)}
              className="flex-1 px-6 py-4 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-black rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all text-sm uppercase tracking-wider"
            >
              {t("dashboards.detail.actions.cancel")}
            </button>
            <button
              onClick={handleSaveWidget}
              className="flex-[1.5] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              {editingWidgetId
                ? t("dashboards.detail.actions.save")
                : t("dashboards.detail.actions.addWidget")}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </PodaciumDrawer>
    </div>
  );
}

// Sub-components
function ConfigSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          {icon}
        </div>
        <h4 className="text-sm font-black text-gray-800 dark:text-slate-200 tracking-tight">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function VizBtn({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
        selected
          ? "bg-blue-50 border-blue-600 text-blue-700 shadow-lg shadow-blue-500/10"
          : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/60"
      }`}
    >
      <div
        className={`p-2 rounded-lg ${selected ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-400"}`}
      >
        {React.cloneElement(icon as React.ReactElement, {
          className: "w-5 h-5",
        })}
      </div>
      <span className="text-sm font-black tracking-tight">{label}</span>
    </button>
  );
}

function FormatBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all ${
        active
          ? "bg-blue-50 border-blue-600 text-blue-700 shadow-md"
          : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-400 hover:border-gray-200 dark:hover:border-slate-800"
      }`}
    >
      <div
        className={`p-3 rounded-xl ${active ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 dark:bg-slate-900/60 text-gray-400"}`}
      >
        {icon}
      </div>
      <span className="text-xs font-black uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}
