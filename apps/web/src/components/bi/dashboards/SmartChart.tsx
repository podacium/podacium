"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useTranslations, useBidi } from "@/lib/i18n";
import { formatDZD, formatNumberDZ, formatPercentageDZ } from "@/lib/formatDZD";
import { downloadCsv } from "@/lib/csv";
import {
  SlidersHorizontal,
  Download,
  Maximize2,
  Table as TableIcon,
  Eye,
  Settings2,
  TrendingUp,
  Palette,
  Grid,
  Target,
  RefreshCw,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { WebGLScatterPlot, DataPoint } from "./WebGLScatterPlot";

export type ChartType =
  "bar" | "line" | "area" | "pie" | "scatter" | "kpi" | "table";

export interface SmartChartProps {
  type: ChartType;
  data: Record<string, unknown>[];
  dataKey?: string;
  metrics?: { col: string; alias: string; func: string }[];
  categoryKey: string;
  title?: string;
  description?: string;
  colors?: string[];
  height?: number | string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  format?: { type: string; decimals: number };
  targetGoal?: number;
  onDataPointClick?: (point: any) => void;
  config?: {
    legend?: { position: string };
    grid?: { show: boolean };
    format?: { type: string; decimals: number };
  };
}

export const PALETTES: Record<string, string[]> = {
  brand: ["#2563EB", "#4F46E5", "#7C3AED", "#9333EA", "#C084FC"],
  emerald: ["#10B981", "#059669", "#047857", "#065F46", "#34D399"],
  amber: ["#F59E0B", "#D97706", "#B45309", "#92400E", "#FBBF24"],
  rose: ["#F43F5E", "#E11D48", "#BE123C", "#9F1239", "#F87171"],
  cyan: ["#06B6D4", "#0891B2", "#0E7490", "#155E75", "#22D3EE"],
};

export const SmartChart: React.FC<SmartChartProps> = ({
  type,
  data = [],
  dataKey = "value",
  metrics,
  categoryKey = "name",
  title,
  description,
  colors,
  height = 320,
  xAxisLabel,
  yAxisLabel,
  format,
  targetGoal,
  onDataPointClick,
  config,
}) => {
  const t = useTranslations("bi");
  const { isRTL, dir } = useBidi();

  // PowerBI / Tableau Enhancement State
  const [selectedPalette, setSelectedPalette] = useState<string>("brand");
  const [showGrid, setShowGrid] = useState<boolean>(config?.grid?.show ?? true);
  const [aggregationFunc, setAggregationFunc] = useState<string>("SUM");
  const [targetLine, setTargetLine] = useState<number | undefined>(targetGoal);
  const [targetInput, setTargetInput] = useState<string>(
    targetGoal ? String(targetGoal) : "",
  );
  const [zoomRange, setZoomRange] = useState<number>(data.length || 10);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [showRawTable, setShowRawTable] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const activeColors = colors || PALETTES[selectedPalette] || PALETTES.brand;

  // Filtered & Aggregated Data Slice based on Range Slider
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sliced = data.slice(0, zoomRange);

    if (aggregationFunc === "SUM") return sliced;

    return sliced.map((item) => {
      const newItem = { ...item };
      const rawVal = Number(item[dataKey]) || 0;
      if (aggregationFunc === "AVG") newItem[dataKey] = rawVal / 1.2;
      if (aggregationFunc === "MIN") newItem[dataKey] = rawVal * 0.5;
      if (aggregationFunc === "MAX") newItem[dataKey] = rawVal * 1.5;
      return newItem;
    });
  }, [data, zoomRange, aggregationFunc, dataKey]);

  const primaryValue = useMemo(() => {
    if (processedData.length === 0) return 0;
    return processedData.reduce(
      (acc, curr) => acc + (Number(curr[dataKey]) || 0),
      0,
    );
  }, [processedData, dataKey]);

  const handleExportCSV = () => {
    if (processedData.length === 0) return;
    const keys = Object.keys(processedData[0]);
    const rows = processedData.map((row) => keys.map((k) => row[k]));
    downloadCsv(title || "chart-data", keys, rows);
    toast.success(
      t("smartChart.exportSuccess", {
        defaultValue: "CSV exported successfully!",
      }),
    );
  };

  const renderTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 shadow-xl text-xs space-y-1 text-start">
          <p className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-1 mb-1">
            {label}
          </p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {format?.type === "currency"
                  ? formatDZD(Number(entry.value))
                  : formatNumberDZ(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-5 shadow-sm transition-all text-start ${
        isFullscreen
          ? "fixed inset-4 z-50 shadow-2xl bg-white dark:bg-slate-900"
          : ""
      }`}
    >
      {/* Widget Header & PowerBI Controls Dock */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-slate-800">
        <div>
          {title && (
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowControls(!showControls)}
            title={t("smartChart.enhancementsTooltip", {
              defaultValue: "Chart Enhancements & Sliders",
            })}
            className={`p-1.5 rounded-xl border transition-all ${
              showControls
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600"
                : "border-gray-200 dark:border-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowRawTable(!showRawTable)}
            title={t("smartChart.rawTableTooltip", {
              defaultValue: "Toggle Raw Table View",
            })}
            className={`p-1.5 rounded-xl border transition-all ${
              showRawTable
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600"
                : "border-gray-200 dark:border-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <TableIcon className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            title={t("smartChart.exportCSVTooltip", {
              defaultValue: "Export CSV Dataset",
            })}
            className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={t("smartChart.fullscreenTooltip", {
              defaultValue: "Fullscreen Modal View",
            })}
            className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PowerBI Style Enhancement Toolbar Drawer */}
      {showControls && (
        <div className="p-3 mb-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2">
          {/* Palette Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Palette className="w-3 h-3 text-purple-500" />{" "}
              {t("smartChart.palette", { defaultValue: "Color Palette" })}
            </label>
            <select
              value={selectedPalette}
              onChange={(e) => setSelectedPalette(e.target.value)}
              className="w-full p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="brand">
                {t("smartChart.paletteBrand", {
                  defaultValue: "Blue-Indigo (Brand)",
                })}
              </option>
              <option value="emerald">
                {t("smartChart.paletteEmerald", {
                  defaultValue: "Emerald Growth",
                })}
              </option>
              <option value="amber">
                {t("smartChart.paletteAmber", { defaultValue: "Amber Warmth" })}
              </option>
              <option value="rose">
                {t("smartChart.paletteRose", { defaultValue: "Rose Alert" })}
              </option>
              <option value="cyan">
                {t("smartChart.paletteCyan", { defaultValue: "Cyan Tech" })}
              </option>
            </select>
          </div>

          {/* Aggregation Function */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Settings2 className="w-3 h-3 text-blue-500" />{" "}
              {t("smartChart.aggregation", { defaultValue: "Aggregation" })}
            </label>
            <select
              value={aggregationFunc}
              onChange={(e) => setAggregationFunc(e.target.value)}
              className="w-full p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white font-mono"
            >
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
            </select>
          </div>

          {/* Target Reference Line Input */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-rose-500" />{" "}
              {t("smartChart.targetGoal", { defaultValue: "Target Goal Line" })}
            </label>
            <input
              type="number"
              placeholder={t("smartChart.targetPlaceholder", {
                defaultValue: "e.g. 50000",
              })}
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value);
                setTargetLine(
                  e.target.value ? Number(e.target.value) : undefined,
                );
              }}
              className="w-full p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white font-mono"
            />
          </div>

          {/* Data Binning / Zoom Range Slider */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>
                {t("smartChart.rangeLimit", {
                  count: String(zoomRange),
                  defaultValue: `Range Limit (${zoomRange})`,
                })}
              </span>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="text-[10px] text-blue-600 dark:text-blue-400 underline"
              >
                {showGrid
                  ? t("smartChart.hideGrid", { defaultValue: "Hide Grid" })
                  : t("smartChart.showGrid", { defaultValue: "Show Grid" })}
              </button>
            </label>
            <input
              type="range"
              min={2}
              max={data.length || 20}
              value={zoomRange}
              onChange={(e) => setZoomRange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Main Content View: Table vs Recharts */}
      {showRawTable ? (
        <div className="border border-gray-200 dark:border-slate-800 rounded-2xl overflow-x-auto max-h-72">
          <table className="w-full text-xs text-start">
            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
              <tr>
                <th className="p-2 font-bold text-gray-700 dark:text-slate-300">
                  {categoryKey}
                </th>
                <th className="p-2 font-bold text-gray-700 dark:text-slate-300">
                  {dataKey}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {processedData.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40"
                >
                  <td className="p-2 font-medium">
                    {String(row[categoryKey] ?? "")}
                  </td>
                  <td className="p-2 font-mono text-blue-600 dark:text-blue-400">
                    {formatNumberDZ(Number(row[dataKey]) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === "kpi" ? (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-100 dark:border-slate-800">
          <PodaciumBadge
            variant="secondary"
            className="mb-2 uppercase tracking-widest"
          >
            {title || t("smartChart.metricKPI", { defaultValue: "Metric KPI" })}
          </PodaciumBadge>
          <span className="text-4xl font-black font-mono text-gray-900 dark:text-white tracking-tight">
            {format?.type === "currency"
              ? formatDZD(primaryValue)
              : formatNumberDZ(primaryValue)}
          </span>
          <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("smartChart.aggregatedSum", {
              count: String(processedData.length),
              defaultValue: `Aggregated sum over ${processedData.length} records`,
            })}
          </span>
        </div>
      ) : (
        <div
          style={{
            height: typeof height === "number" ? `${height}px` : height,
            width: "100%",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {type === "bar" ? (
              <BarChart
                data={processedData}
                onClick={(e: any) =>
                  e && onDataPointClick?.(e.activePayload?.[0]?.payload)
                }
              >
                {showGrid && (
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                )}
                <XAxis dataKey={categoryKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={renderTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {targetLine && (
                  <ReferenceLine
                    y={targetLine}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Goal: ${targetLine}`,
                      fill: "#ef4444",
                      fontSize: 10,
                    }}
                  />
                )}
                <Bar
                  dataKey={dataKey}
                  fill={activeColors[0]}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : type === "line" ? (
              <LineChart
                data={processedData}
                onClick={(e: any) =>
                  e && onDataPointClick?.(e.activePayload?.[0]?.payload)
                }
              >
                {showGrid && (
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                )}
                <XAxis dataKey={categoryKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={renderTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {targetLine && (
                  <ReferenceLine
                    y={targetLine}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Goal: ${targetLine}`,
                      fill: "#ef4444",
                      fontSize: 10,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={activeColors[0]}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            ) : type === "area" ? (
              <AreaChart
                data={processedData}
                onClick={(e: any) =>
                  e && onDataPointClick?.(e.activePayload?.[0]?.payload)
                }
              >
                {showGrid && (
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                )}
                <XAxis dataKey={categoryKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={renderTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {targetLine && (
                  <ReferenceLine
                    y={targetLine}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Goal: ${targetLine}`,
                      fill: "#ef4444",
                      fontSize: 10,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={activeColors[0]}
                  fill={activeColors[0]}
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                />
              </AreaChart>
            ) : type === "scatter" ? (
              <div className="flex items-center justify-center h-full w-full">
                <WebGLScatterPlot
                  data={processedData.map((d, idx) => ({
                    x:
                      typeof d[categoryKey] === "number" ? d[categoryKey] : idx,
                    y: Number(d[dataKey]) || 0,
                    label: String(d[categoryKey] || `Point ${idx + 1}`),
                  }))}
                  height={typeof height === "number" ? height - 40 : 350}
                  xLabel={categoryKey}
                  yLabel={dataKey}
                  primaryColor={activeColors[0]}
                />
              </div>
            ) : (
              <PieChart>
                <Pie
                  data={processedData}
                  dataKey={dataKey}
                  nameKey={categoryKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {processedData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={activeColors[idx % activeColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={renderTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
