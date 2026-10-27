"use client";

import React, { useState } from "react";
import {
  Download,
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PieChart,
  Brain,
  MessageSquare,
  FileText,
  Plus,
  CheckCircle,
  BarChart3,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatDZD, formatNumberDZ } from "@/lib/formatDZD";
import { useTranslations } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import {
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";

export interface DrillThroughDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  data: Record<string, any>[];
  totalRecords?: number;
  onCreateDecision?: (title: string, rationale: string) => void;
}

export const DrillThroughDrawer: React.FC<DrillThroughDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  data = [],
  totalRecords = data.length,
  onCreateDecision,
}) => {
  const t = useTranslations("bi");

  const displayTitle =
    title ||
    t("drillThrough.defaultTitle", {
      defaultValue: "Underlying Record Slice & Segment Breakdown",
    });
  const displaySubtitle =
    subtitle ||
    t("drillThrough.defaultSubtitle", {
      defaultValue:
        "Interactive drill-down records, statistical distribution, and decision triggers",
    });

  const [activeTab, setActiveTab] = useState<
    "overview" | "records" | "decision" | "actions"
  >("overview");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [impactLevel, setImpactLevel] = useState("high");

  const pageSize = 12;

  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase()),
    ),
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Summary Metrics
  const numericCol =
    columns.find((c) => typeof data[0]?.[c] === "number") || columns[1];
  const totalSum = data.reduce(
    (acc, curr) => acc + (Number(curr[numericCol]) || 0),
    0,
  );
  const avgVal = data.length ? totalSum / data.length : 0;

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const rows = data.map((r) => columns.map((col) => r[col]));
    downloadCsv(`segment_slice_${Date.now()}`, columns, rows);
    toast.success(
      t("drillThrough.exportSuccess", {
        defaultValue: "Segment CSV exported successfully!",
      }),
    );
  };

  const handleCreateDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionTitle) {
      toast.error(
        t("drillThrough.decisionTitleRequired", {
          defaultValue: "Please enter a decision title",
        }),
      );
      return;
    }
    onCreateDecision?.(decisionTitle, decisionRationale);
    toast.success(
      t("drillThrough.decisionLogged", {
        defaultValue: "Executive Decision logged from metric drill-down!",
      }),
    );
    setDecisionTitle("");
    setDecisionRationale("");
    setActiveTab("overview");
  };

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end">
      <DrawerContent
        className="w-full max-w-3xl text-start"
        overlayClassName="bg-slate-950/60"
      >
        {/* Header Bar */}
        <DrawerHeader className="items-center border-gray-200 px-6 py-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <DrawerTitle className="text-base font-bold text-gray-900 dark:text-white">
                  {displayTitle}
                </DrawerTitle>
                <PodaciumBadge variant="secondary">
                  {t("drillThrough.recordsCount", {
                    count: String(data.length),
                    defaultValue: `${data.length} records`,
                  })}
                </PodaciumBadge>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {displaySubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PodaciumButton
              onClick={handleExportCSV}
              variant="secondary"
              size="sm"
            >
              <Download className="w-3.5 h-3.5 me-1.5" />{" "}
              {t("drillThrough.exportCSV", { defaultValue: "CSV" })}
            </PodaciumButton>
            <DrawerClose className="rounded-xl p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200" />
          </div>
        </DrawerHeader>

        {/* Tab Navigation Dock */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              activeTab === "overview"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t("drillThrough.segmentMetrics", {
              defaultValue: "Segment Metrics",
            })}
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              activeTab === "records"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t("drillThrough.rawRecordSlice", {
              count: String(filteredData.length),
              defaultValue: `Raw Record Slice (${filteredData.length})`,
            })}
          </button>
          <button
            onClick={() => setActiveTab("decision")}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              activeTab === "decision"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t("drillThrough.createDecisionLog", {
              defaultValue: "Create Decision Log",
            })}
          </button>
        </div>

        {/* Tab 1: Overview Summary Cards */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-4 text-start">
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                  {t("drillThrough.totalVolume", {
                    defaultValue: "Total Volume",
                  })}
                </span>
                <span className="text-xl font-mono font-black text-gray-900 dark:text-white">
                  {formatDZD(totalSum)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                  {t("drillThrough.averageTicket", {
                    defaultValue: "Average Ticket",
                  })}
                </span>
                <span className="text-xl font-mono font-black text-gray-900 dark:text-white">
                  {formatDZD(avgVal)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                  {t("drillThrough.sliceRows", { defaultValue: "Slice Rows" })}
                </span>
                <span className="text-xl font-mono font-black text-gray-900 dark:text-white">
                  {formatNumberDZ(data.length)}
                </span>
              </div>
            </div>

            {/* Sub-Category Distribution */}
            <div className="p-5 rounded-3xl bg-gray-50/60 dark:bg-slate-800/40 border border-gray-200/60 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                <span>
                  {t("drillThrough.topBreakdown", {
                    defaultValue: "Top Breakdown Elements",
                  })}
                </span>
                <PodaciumBadge variant="secondary">
                  {t("drillThrough.automatedSegmentInsight", {
                    defaultValue: "Automated Segment Insight",
                  })}
                </PodaciumBadge>
              </h3>

              <div className="space-y-2">
                {data.slice(0, 5).map((r, i) => {
                  const label = String(r[columns[0]] ?? `Item ${i + 1}`);
                  const val = Number(r[numericCol]) || 0;
                  const pct = totalSum
                    ? Math.round((val / totalSum) * 100)
                    : 20;

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-gray-700 dark:text-slate-300">
                        <span>{label}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">
                          {formatDZD(val)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Raw Records Table */}
        {activeTab === "records" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("drillThrough.filterPlaceholder", {
                    defaultValue: "Filter drill-down rows...",
                  })}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full ps-9 pe-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="p-3 font-bold text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-800"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {paginatedData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="p-3 font-mono text-gray-800 dark:text-slate-200 truncate max-w-xs"
                        >
                          {String(row[col] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span>
                {t("drillThrough.pageInfo", {
                  page: String(page),
                  total: String(totalPages),
                  defaultValue: `Page ${page} of ${totalPages}`,
                })}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Create Decision */}
        {activeTab === "decision" && (
          <form
            onSubmit={handleCreateDecisionSubmit}
            className="p-6 space-y-4 flex-1 text-xs"
          >
            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                {t("drillThrough.decisionTitle", {
                  defaultValue: "Decision Title",
                })}
              </label>
              <input
                type="text"
                placeholder={t("drillThrough.decisionTitlePlaceholder", {
                  defaultValue:
                    "e.g. Optimize Inventory Allocation for Alger Region",
                })}
                value={decisionTitle}
                onChange={(e) => setDecisionTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                {t("drillThrough.impactLevel", {
                  defaultValue: "Impact Level",
                })}
              </label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="critical">
                  {t("drillThrough.impactCritical", {
                    defaultValue: "Critical (Executive Board)",
                  })}
                </option>
                <option value="high">
                  {t("drillThrough.impactHigh", {
                    defaultValue: "High (Department Lead)",
                  })}
                </option>
                <option value="medium">
                  {t("drillThrough.impactMedium", {
                    defaultValue: "Medium (Team Sprint)",
                  })}
                </option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                {t("drillThrough.rationaleLabel", {
                  defaultValue: "Rationale & Action Plan",
                })}
              </label>
              <textarea
                rows={5}
                placeholder={t("drillThrough.rationalePlaceholder", {
                  defaultValue:
                    "Document analytical rationale observed in metric slice...",
                })}
                value={decisionRationale}
                onChange={(e) => setDecisionRationale(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white resize-none"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <PodaciumButton type="submit" variant="primary">
                <Plus className="w-4 h-4 me-1.5" />{" "}
                {t("drillThrough.submitDecision", {
                  defaultValue: "Submit Decision Log",
                })}
              </PodaciumButton>
            </div>
          </form>
        )}
      </DrawerContent>
    </PodaciumDrawer>
  );
};
