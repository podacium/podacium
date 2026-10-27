"use client";

import { useState, useMemo } from "react";
import {
  Search,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BiDatasetMetadata } from "@/lib/api";

export function PreviewGridTab({
  dataset,
  datasetId,
  columns: columnsProp,
  sampleData: sampleDataProp,
  totalRows: totalRowsProp,
  t,
}: {
  dataset?: BiDatasetMetadata;
  datasetId?: string;
  columns?: string[] | any[];
  sampleData?: Record<string, unknown>[];
  totalRows?: number;
  t: (key: string, params?: any) => string;
}) {
  const [gridSearch, setGridSearch] = useState("");
  const [gridPage, setGridPage] = useState(1);
  const gridRowsPerPage = 15;

  const rawColumns = columnsProp || dataset?.columns || [];
  const rawRecords =
    sampleDataProp ||
    dataset?.sample_records ||
    (dataset as any)?.sampleData ||
    [];
  const totalRowsCount =
    totalRowsProp || dataset?.row_count || rawRecords.length;

  const columnsList = useMemo(() => {
    return rawColumns.map((col) =>
      typeof col === "string" ? col : col.name || String(col),
    );
  }, [rawColumns]);

  const filteredRows = useMemo(() => {
    if (!gridSearch.trim()) return rawRecords;
    const query = gridSearch.toLowerCase();
    return rawRecords.filter((row: any) =>
      Object.values(row || {}).some((val) =>
        String(val ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [rawRecords, gridSearch]);

  const pagedPreviewRows = useMemo(() => {
    const start = (gridPage - 1) * gridRowsPerPage;
    return filteredRows.slice(start, start + gridRowsPerPage);
  }, [filteredRows, gridPage]);

  const totalPages = Math.ceil(filteredRows.length / gridRowsPerPage) || 1;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
          <input
            type="text"
            placeholder={t("bi.datasets.detail.tabs.preview.search")}
            value={gridSearch}
            onChange={(e) => {
              setGridSearch(e.target.value);
              setGridPage(1);
            }}
            className="w-full ps-9 pe-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            {t("bi.datasets.detail.tabs.preview.showingPaged", {
              count: pagedPreviewRows.length,
              total: filteredRows.length,
              all: totalRowsCount,
            })}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/60">
        <table className="w-full text-start text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
            <tr>
              <th className="p-3 text-start border-b border-slate-200/80 dark:border-slate-800 w-12">
                #
              </th>
              {columnsList.map((colName: string, idx: number) => (
                <th
                  key={idx}
                  className="p-3 text-start border-b border-slate-200/80 dark:border-slate-800 whitespace-nowrap font-bold text-slate-800 dark:text-slate-300"
                >
                  {colName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 bg-white dark:bg-slate-900/40">
            {pagedPreviewRows.length > 0 ? (
              pagedPreviewRows.map((row: any, rIdx: number) => (
                <tr
                  key={rIdx}
                  className="hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  <td className="p-3 font-mono text-slate-400 dark:text-slate-500 font-semibold">
                    {rIdx + 1 + (gridPage - 1) * gridRowsPerPage}
                  </td>
                  {columnsList.map((colName: string, cIdx: number) => {
                    const val = row[colName];
                    return (
                      <td
                        key={cIdx}
                        className="p-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate"
                      >
                        {val === null || val === undefined ? (
                          <span className="text-slate-400 dark:text-slate-600 italic">
                            null
                          </span>
                        ) : typeof val === "object" ? (
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {JSON.stringify(val)}
                          </span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columnsList.length + 1}
                  className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium"
                >
                  {t("bi.datasets.detail.tabs.preview.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredRows.length > gridRowsPerPage && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs">
          <button
            onClick={() => setGridPage((p) => Math.max(1, p - 1))}
            disabled={gridPage === 1}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 font-semibold flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {t("common.previous")}
          </button>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {t("common.pageOf", { page: gridPage, total: totalPages })}
          </span>
          <button
            onClick={() => setGridPage((p) => Math.min(totalPages, p + 1))}
            disabled={gridPage >= totalPages}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 font-semibold flex items-center gap-1 transition-colors"
          >
            {t("common.next")} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
