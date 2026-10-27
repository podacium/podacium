"use client";

import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  MoreVertical,
  Maximize2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { SmartChartLazy as SmartChart } from "./SmartChartLazy";
import { ChartType } from "./SmartChart";
import { BiWidget, api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { formatDZD, formatNumberDZ, formatPercentageDZ } from "@/lib/formatDZD";
import { Loader2, AlertCircle } from "lucide-react";

interface WidgetCardProps {
  widget: BiWidget;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function WidgetCard({
  widget,
  onEdit,
  onDelete,
  className = "",
}: WidgetCardProps) {
  const { t, dir, i18n } = useTranslations("bi");
  const [data, setData] = React.useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Detailed data fetching logic
        if (widget.id < 0 && widget.data_source?.dataset_id) {
          const previewRes = await api.getDatasetPreview(
            widget.data_source.dataset_id,
            10,
          );
          setData(
            Array.isArray(previewRes)
              ? previewRes
              : (previewRes as any)?.data || [],
          );
        } else {
          const res = await api.getWidgetData(widget.id);
          setData(Array.isArray(res) ? res : res?.data || []);
        }
      } catch (err) {
        console.error(`Failed to fetch data for widget ${widget.id}:`, err);
        setError(t("widgets.state.error"));
      } finally {
        setLoading(false);
      }
    };

    if (widget.data_source?.dataset_id) {
      fetchData();
    } else {
      setLoading(false);
      setData([]);
    }
  }, [widget.id, widget.visualization, widget.data_source?.dataset_id]);

  // Determine configuration from widget
  const vizConfig = widget.visualization || {};
  const chartType: ChartType = (vizConfig.type as ChartType) || "bar";

  // Determine keys for charting
  const isAggregated = !!vizConfig.aggregation;
  const dataKey = isAggregated ? "value" : vizConfig.yAxis || "value";
  const categoryKey = vizConfig.xAxis || "name";

  // Style Helpers
  const isGlass = widget.style?.background_color === "glass";
  const cardBaseStyles = isGlass
    ? "bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl border-white/40 dark:border-slate-800/80 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
    : "bg-white dark:bg-slate-900 border-gray-200/60 dark:border-slate-800/80 shadow-sm";

  // Format Helper
  const formatValue = (val: any) => {
    if (typeof val !== "number") return val;
    const format = widget.config?.format || { type: "auto", decimals: 0 };
    const decimals = format.decimals ?? 0;

    if (format.type === "currency") {
      return formatDZD(val, { decimals });
    }
    if (format.type === "percentage") {
      return formatPercentageDZ(val, decimals);
    }
    return formatNumberDZ(val, decimals);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const content = (
    <div
      className={`flex flex-col h-full rounded-[24px] border transition-all duration-500 group/card ${cardBaseStyles} ${className} ${isFullscreen ? "fixed inset-4 z-[100] bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl overflow-hidden" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex flex-col truncate pe-2">
          <h3
            className="font-black text-gray-900 dark:text-slate-100 truncate text-sm tracking-tight group-hover/card:text-blue-600 dark:text-blue-400 transition-colors"
            title={widget.title}
          >
            {widget.title || t("widgets.config.titlePlaceholder")}
          </h3>
          {widget.description && (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">
              {widget.description}
            </p>
          )}
        </div>

        <div
          className={`flex items-center gap-2 ${isFullscreen ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"} transition-all duration-300 transform`}
        >
          <button
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen
                ? t("widgets.fullscreen.exit")
                : t("widgets.fullscreen.enter")
            }
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-all"
          >
            {isFullscreen ? (
              <Minus className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={t("widgets.edit")}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <div className="relative group/menu">
            <button
              aria-label={t("widgets.moreOptions")}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="absolute end-0 top-full mt-2 w-48 bg-white dark:bg-slate-900/95 backdrop-blur-md border border-gray-100 dark:border-slate-800 shadow-2xl rounded-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 py-2 overflow-hidden">
              <button
                onClick={() => onEdit?.()}
                className="w-full text-left px-4 py-2.5 text-xs font-black text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {t("widgets.edit")}
              </button>
              <div className="h-px bg-gray-50 dark:bg-slate-900/60 my-1" />
              <button
                onClick={() => onDelete?.()}
                className="w-full text-left px-4 py-2.5 text-xs font-black text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {t("widgets.remove")}
              </button>
              {widget.interactivity?.export !== false && (
                <>
                  <div className="h-px bg-gray-50 dark:bg-slate-900/60 my-1" />
                  <button
                    onClick={() => {
                      /* Implement export logic */
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-black text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {t("widgets.interactivity.export")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body: Chart */}
      <div className="flex-1 px-6 py-4 min-h-[200px] flex items-center justify-center relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin" />
              <div className="absolute inset-0 bg-blue-500/10 blur-xl animate-pulse" />
            </div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
              {t("widgets.state.loading")}
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-red-400">
            <AlertCircle className="w-10 h-10" />
            <p className="text-[10px] font-black uppercase tracking-widest">
              {error}
            </p>
          </div>
        ) : data.length > 0 ? (
          <ErrorBoundary
            fallback={
              <div
                className="flex flex-col items-center gap-3 text-red-400"
                role="alert"
              >
                <AlertCircle className="w-10 h-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {t("widgets.state.error")}
                </p>
              </div>
            }
          >
            <div className="w-full h-full animate-in fade-in zoom-in-95 duration-500">
              <SmartChart
                type={chartType}
                data={data}
                dataKey={dataKey}
                metrics={vizConfig.metrics?.map((m) => ({
                  col: m,
                  alias: m,
                  func: "sum",
                }))}
                categoryKey={categoryKey}
                format={widget.config?.format}
                config={widget.config}
                height="100%"
              />
            </div>
          </ErrorBoundary>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-300">
            <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-full">
              <Minus className="w-10 h-10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">
              {t("widgets.state.empty")}
            </p>
          </div>
        )}
      </div>

      {/* Footer Insights removed during E3 stub purge */}
    </div>
  );

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[90] animate-in fade-in duration-300"
          onClick={toggleFullscreen}
        />
      )}
      {content}
    </>
  );
}
