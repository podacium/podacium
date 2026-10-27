"use client";

import React, { useState, useMemo } from "react";
import { WorkbenchQueryResult } from "./types";
import {
  Terminal,
  Play,
  Download,
  Clock,
  Database,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Wand2,
  Filter,
  History,
  Trash2,
  Search,
  Code2,
  ChevronDown,
} from "lucide-react";

interface QueryWorkbenchTabProps {
  datasetName?: string;
  t: (key: string, params?: any) => string;
  onExecuteQuery: (query: string) => Promise<WorkbenchQueryResult | null>;
}

interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: Date;
  executionTimeMs: number;
  rowsReturned: number;
}

export function QueryWorkbenchTab({
  datasetName,
  t,
  onExecuteQuery,
}: QueryWorkbenchTabProps) {
  const [queryText, setQueryText] = useState("SELECT * FROM dataset LIMIT 10;");
  const [isRunning, setIsRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<WorkbenchQueryResult | null>(
    null,
  );
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [resultSearch, setResultSearch] = useState("");
  const [rowLimit, setRowLimit] = useState<number>(50);

  // Preset SQL Queries
  const presets = useMemo(
    () => [
      {
        id: "presetPreview",
        category: "basic",
        name: t("bi.datasets.detail.tabs.query.presetPreview"),
        sql: "SELECT * FROM dataset LIMIT 10;",
      },
      {
        id: "presetRecentOrder",
        category: "basic",
        name: t("bi.datasets.detail.tabs.query.presetRecentOrder"),
        sql: "SELECT * FROM dataset ORDER BY id DESC LIMIT 25;",
      },
      {
        id: "presetGroupBy",
        category: "aggregations",
        name: t("bi.datasets.detail.tabs.query.presetGroupBy"),
        sql: "SELECT domain, COUNT(*) as record_count FROM dataset GROUP BY domain ORDER BY record_count DESC;",
      },
      {
        id: "presetSummary",
        category: "aggregations",
        name: t("bi.datasets.detail.tabs.query.presetSummary"),
        sql: "SELECT AVG(amount) as avg_amount, MIN(amount) as min_amount, MAX(amount) as max_amount, SUM(amount) as sum_amount FROM dataset;",
      },
      {
        id: "presetNullAudit",
        category: "quality",
        name: t("bi.datasets.detail.tabs.query.presetNullAudit"),
        sql: "SELECT COUNT(*) - COUNT(domain) as missing_domain, COUNT(*) - COUNT(amount) as missing_amount FROM dataset;",
      },
      {
        id: "presetOutliers",
        category: "advanced",
        name: t("bi.datasets.detail.tabs.query.presetOutliers"),
        sql: "SELECT * FROM dataset WHERE amount > (SELECT AVG(amount) FROM dataset) ORDER BY amount DESC LIMIT 20;",
      },
    ],
    [t],
  );

  const categories = [
    {
      id: "all",
      label: t("bi.datasets.detail.tabs.query.categories.all"),
    },
    {
      id: "basic",
      label: t("bi.datasets.detail.tabs.query.categories.basic"),
    },
    {
      id: "aggregations",
      label: t("bi.datasets.detail.tabs.query.categories.aggregations"),
    },
    {
      id: "quality",
      label: t("bi.datasets.detail.tabs.query.categories.quality"),
    },
    {
      id: "advanced",
      label: t("bi.datasets.detail.tabs.query.categories.advanced"),
    },
  ];

  const filteredPresets = useMemo(() => {
    if (activeCategory === "all") return presets;
    return presets.filter((p) => p.category === activeCategory);
  }, [presets, activeCategory]);

  const snippets = [
    { label: "WHERE", clause: "WHERE column = 'value'" },
    { label: "GROUP BY", clause: "GROUP BY column" },
    { label: "ORDER BY", clause: "ORDER BY column DESC" },
    { label: "HAVING", clause: "HAVING COUNT(*) > 1" },
    { label: "LIMIT", clause: `LIMIT ${rowLimit}` },
    { label: "COUNT(*)", clause: "COUNT(*) as total_records" },
  ];

  const handleRunQuery = async () => {
    if (!queryText.trim() || isRunning) return;
    setIsRunning(true);
    const startTime = Date.now();
    try {
      const res = await onExecuteQuery(queryText.trim());
      if (res) {
        setQueryResult(res);
        const newItem: QueryHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          sql: queryText.trim(),
          timestamp: new Date(),
          executionTimeMs: res.execution_time_ms || Date.now() - startTime,
          rowsReturned: res.rows_returned || res.data.length,
        };
        setQueryHistory((prev) => [newItem, ...prev.slice(0, 9)]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const handleFormatSQL = () => {
    let formatted = queryText;
    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "GROUP BY",
      "ORDER BY",
      "HAVING",
      "LIMIT",
      "JOIN",
      "ON",
      "LEFT JOIN",
      "RIGHT JOIN",
      "INNER JOIN",
      "AND",
      "OR",
      "IN",
      "LIKE",
      "NOT",
      "NULL",
      "IS",
      "AS",
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "DESC",
      "ASC",
    ];

    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      formatted = formatted.replace(regex, kw);
    });

    formatted = formatted
      .replace(/\s+/g, " ")
      .replace(/\s*;\s*$/, ";")
      .replace(/\s*(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT)\s*/g, "\n$1 ");

    setQueryText(formatted.trim());
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(queryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertSnippet = (clause: string) => {
    setQueryText((prev) => {
      const trimmed = prev.trim();
      if (trimmed.endsWith(";")) {
        return trimmed.slice(0, -1) + " " + clause + ";";
      }
      return trimmed + " " + clause;
    });
  };

  const handleExportCSV = () => {
    if (!queryResult || !queryResult.data.length) return;
    const cols = queryResult.columns;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        cols.join(","),
        ...queryResult.data.map((r) =>
          cols.map((c) => `"${r[c] ?? ""}"`).join(","),
        ),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `query_result_${datasetName || "dataset"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filtered rows in result view
  const filteredResultData = useMemo(() => {
    if (!queryResult || !resultSearch.trim()) return queryResult?.data || [];
    const q = resultSearch.toLowerCase();
    return queryResult.data.filter((row) =>
      queryResult.columns.some((col) =>
        String(row[col] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [queryResult, resultSearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Terminal className="h-5 w-5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.query.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.query.description")}
            </p>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60 sm:self-center"
          >
            <History className="h-4 w-4 text-indigo-500" />
            {t("bi.datasets.detail.tabs.query.sqlHistory")}
            {queryHistory.length > 0 && (
              <span className="ms-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
                {queryHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Execution History Drawer */}
        {showHistory && (
          <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-slate-800/60">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("bi.datasets.detail.tabs.query.recentHistory")}
              </span>
              {queryHistory.length > 0 && (
                <button
                  onClick={() => setQueryHistory([])}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("bi.datasets.detail.tabs.query.clearHistory")}
                </button>
              )}
            </div>

            {queryHistory.length === 0 ? (
              <p className="py-3 text-xs italic text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.query.noHistory")}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                {queryHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setQueryText(item.sql)}
                    className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/60 bg-white/80 p-2.5 transition-all hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800/60 dark:bg-slate-800/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
                  >
                    <code className="truncate font-mono text-xs text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.sql}
                    </code>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{item.executionTimeMs} ms</span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {item.rowsReturned} {t("common.uiLabels.rows")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Categories & Preset Queries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {t("bi.datasets.detail.tabs.query.presets")}
          </span>

          {/* Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets List */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setQueryText(preset.sql)}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-start transition-all hover:border-indigo-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
            >
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {preset.name}
              </span>
              <Code2 className="h-4 w-4 flex-shrink-0 text-slate-400 hover:text-indigo-500" />
            </button>
          ))}
        </div>
      </div>

      {/* SQL Snippets Quick Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50/60 p-2 dark:border-slate-800/60 dark:bg-slate-900/40">
        <span className="me-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {t("bi.datasets.detail.tabs.query.insertSnippet")}:
        </span>
        {snippets.map((snip, idx) => (
          <button
            key={idx}
            onClick={() => handleInsertSnippet(snip.clause)}
            className="rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 font-mono text-[11px] text-indigo-600 shadow-2xs transition-all hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
          >
            +{snip.label}
          </button>
        ))}
      </div>

      {/* SQL Editor Box */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
        {/* Editor Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-800/40">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Database className="h-4 w-4 text-indigo-500" />
            {t("bi.datasets.detail.tabs.query.editorLabel")}
          </span>

          <div className="flex items-center gap-2">
            {/* Format SQL */}
            <button
              type="button"
              onClick={handleFormatSQL}
              title={t("bi.datasets.detail.tabs.query.formatSql")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Wand2 className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">
                {t("bi.datasets.detail.tabs.query.formatSql")}
              </span>
            </button>

            {/* Copy SQL */}
            <button
              type="button"
              onClick={handleCopySQL}
              title={t("bi.datasets.detail.tabs.query.copySql")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("bi.datasets.detail.tabs.query.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">
                    {t("bi.datasets.detail.tabs.query.copy")}
                  </span>
                </>
              )}
            </button>

            {/* Clear Editor */}
            <button
              type="button"
              onClick={() => setQueryText("")}
              title={t("bi.datasets.detail.tabs.query.clearSql")}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden sm:inline">
                {t("bi.datasets.detail.tabs.query.clear")}
              </span>
            </button>

            {/* Run Query Button */}
            <button
              disabled={isRunning}
              onClick={handleRunQuery}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              <Play
                className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`}
              />
              {isRunning
                ? t("bi.datasets.detail.tabs.query.running")
                : t("bi.datasets.detail.tabs.query.runQuery")}
            </button>
          </div>
        </div>

        {/* Textarea Editor */}
        <div className="relative">
          <textarea
            rows={5}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="ltr"
            placeholder={t("bi.datasets.detail.tabs.query.queryPlaceholder")}
            className="w-full bg-slate-950 p-4 font-mono text-sm leading-relaxed text-emerald-400 focus:outline-none focus:ring-0 placeholder:text-slate-700"
          />
          <div
            dir="ltr"
            className="absolute bottom-2 end-3 pointer-events-none text-[10px] font-mono text-slate-600"
          >
            {t("bi.datasets.detail.tabs.query.keyboardShortcut")}
          </div>
        </div>
      </div>

      {/* Query Results Section */}
      {queryResult && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80">
            {/* Stats & Row Search */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {t("bi.datasets.detail.tabs.query.executionTime")}:{" "}
                <strong className="font-mono text-slate-700 dark:text-slate-300">
                  {queryResult.execution_time_ms} ms
                </strong>
              </span>
              <span>
                {t("bi.datasets.detail.tabs.query.rowsReturned")}:{" "}
                <strong className="font-mono text-slate-700 dark:text-slate-300">
                  {queryResult.rows_returned}
                </strong>
              </span>

              {/* Table Search Input */}
              <div className="relative min-w-[180px]">
                <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                  placeholder={t("bi.datasets.detail.tabs.query.searchResults")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-3 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.query.exportResults")}
            </button>
          </div>

          {/* Results Table */}
          <div className="max-h-96 overflow-auto">
            {filteredResultData.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.query.noMatchingRows")}
              </div>
            ) : (
              <table className="w-full text-start text-xs font-mono">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    {queryResult.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-start font-semibold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {filteredResultData.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      {queryResult.columns.map((col) => (
                        <td
                          key={col}
                          className="whitespace-nowrap px-4 py-2.5 text-slate-800 dark:text-slate-200"
                        >
                          {row[col] !== null && row[col] !== undefined
                            ? String(row[col])
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
