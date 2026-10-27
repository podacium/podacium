"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  FileText,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ListFilter,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import { downloadCsv } from "@/lib/csv";
import { formatCockpitMetric } from "./utils/formatters";
import { DrillThroughRecord, ExecutiveDecisionMemo } from "./types";
import { useTranslations } from "@/lib/i18n";

export interface DrillThroughDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  records: DrillThroughRecord[];
  baselineTotal?: number;
  currentTotal?: number;
  onCreateDecisionMemo?: (memo: ExecutiveDecisionMemo) => void;
  className?: string;
  /** Configurable page size (default: 10) */
  pageSize?: number;
  /** Total count if using server-side pagination */
  totalRecords?: number;
  /** Server-side pagination pushdown callback */
  onPageChange?: (page: number, pageSize: number) => void;
  /** Optional loading indicator for async pagination */
  isLoading?: boolean;
}

export const DrillThroughDrawer: React.FC<DrillThroughDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  records,
  baselineTotal,
  currentTotal,
  onCreateDecisionMemo,
  className,
  pageSize: initialPageSize = 10,
  totalRecords,
  onPageChange,
  isLoading = false,
}) => {
  const t = useTranslations();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [memoTitle, setMemoTitle] = useState("");
  const [memoAction, setMemoAction] = useState("");
  const [memoOwner, setMemoOwner] = useState("Directeur Général (DG)");

  // Pagination states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialPageSize);
  const [paginationMode, setPaginationMode] = useState<"numbered" | "infinite">(
    "numbered",
  );
  const [infiniteVisibleCount, setInfiniteVisibleCount] =
    useState(initialPageSize);

  // Filter records by search keyword
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter(
      (r) =>
        String(r.entity).toLowerCase().includes(term) ||
        String(r.category).toLowerCase().includes(term) ||
        String(r.status).toLowerCase().includes(term),
    );
  }, [records, searchTerm]);

  // Reset pagination when search keyword or rowsPerPage changes
  useEffect(() => {
    setPage(1);
    setInfiniteVisibleCount(rowsPerPage);
  }, [searchTerm, rowsPerPage]);

  const totalCount = totalRecords ?? filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

  // Determine the paginated records slice to prevent DOM bloat
  const displayedRecords = useMemo(() => {
    if (onPageChange) {
      // Remote server-side pagination already returns requested slice
      return filteredRecords;
    }
    if (paginationMode === "infinite") {
      return filteredRecords.slice(0, infiniteVisibleCount);
    }
    const startIndex = (page - 1) * rowsPerPage;
    return filteredRecords.slice(startIndex, startIndex + rowsPerPage);
  }, [
    filteredRecords,
    page,
    rowsPerPage,
    paginationMode,
    infiniteVisibleCount,
    onPageChange,
  ]);

  const summary = useMemo(() => {
    const total = filteredRecords.reduce((acc, r) => acc + (r.amount || 0), 0);
    const avg = filteredRecords.length ? total / filteredRecords.length : 0;
    return {
      total,
      avg,
      count: totalCount,
    };
  }, [filteredRecords, totalCount]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setPage(clamped);
    onPageChange?.(clamped, rowsPerPage);
  };

  const handleRowsPerPageChange = (newSize: number) => {
    setRowsPerPage(newSize);
    setPage(1);
    setInfiniteVisibleCount(newSize);
    onPageChange?.(1, newSize);
  };

  const handleLoadMore = () => {
    const nextCount = Math.min(
      infiniteVisibleCount + rowsPerPage,
      filteredRecords.length,
    );
    setInfiniteVisibleCount(nextCount);
    const nextPage = Math.ceil(nextCount / rowsPerPage);
    setPage(nextPage);
    onPageChange?.(nextPage, rowsPerPage);
  };

  const handleExport = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "Date",
      "Entity",
      "Category",
      "Amount (DZD)",
      "Variance (DZD)",
      "Status",
    ];
    const rows = filteredRecords.map((r) => [
      r.date,
      r.entity,
      r.category,
      r.amount,
      r.variance,
      r.status,
    ]);
    downloadCsv(`drillthrough_${title.replace(/\s+/g, "_")}`, headers, rows);
  };

  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoTitle.trim()) return;

    onCreateDecisionMemo?.({
      id: `memo_${Date.now()}`,
      title: memoTitle,
      metricKey: title,
      observedAnomaly: subtitle || "Segment variance inspection",
      financialImpactDZD: summary.total,
      proposedAction: memoAction,
      assignedOwner: memoOwner,
      urgency: "high",
      loggedAt: new Date().toISOString(),
    });

    setIsMemoOpen(false);
    setMemoTitle("");
    setMemoAction("");
  };

  const startRecordIdx = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endRecordIdx =
    paginationMode === "infinite"
      ? Math.min(infiniteVisibleCount, totalCount)
      : Math.min(page * rowsPerPage, totalCount);

  // Generate numbered page buttons (up to 5 pages around current)
  const renderPageButtons = () => {
    const buttons: React.ReactNode[] = [];
    const maxVisiblePages = 5;
    let startP = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const endP = Math.min(totalPages, startP + maxVisiblePages - 1);

    if (endP - startP + 1 < maxVisiblePages) {
      startP = Math.max(1, endP - maxVisiblePages + 1);
    }

    if (startP > 1) {
      buttons.push(
        <button
          key="1"
          type="button"
          onClick={() => handlePageChange(1)}
          className="w-7 h-7 rounded-lg text-xs font-mono font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors"
        >
          1
        </button>,
      );
      if (startP > 2) {
        buttons.push(
          <span
            key="start-ellipsis"
            className="px-1 text-xs text-muted-foreground select-none"
          >
            …
          </span>,
        );
      }
    }

    for (let p = startP; p <= endP; p++) {
      const isCurrent = p === page;
      buttons.push(
        <button
          key={p}
          type="button"
          onClick={() => handlePageChange(p)}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "w-7 h-7 rounded-lg text-xs font-mono font-medium transition-colors",
            isCurrent
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground",
          )}
        >
          {p}
        </button>,
      );
    }

    if (endP < totalPages) {
      if (endP < totalPages - 1) {
        buttons.push(
          <span
            key="end-ellipsis"
            className="px-1 text-xs text-muted-foreground select-none"
          >
            …
          </span>,
        );
      }
      buttons.push(
        <button
          key={totalPages}
          type="button"
          onClick={() => handlePageChange(totalPages)}
          className="w-7 h-7 rounded-lg text-xs font-mono font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors"
        >
          {totalPages}
        </button>,
      );
    }

    return buttons;
  };

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end" size="lg">
      <DrawerContent
        className={cn("w-screen max-w-2xl border-border", className)}
        overlayClassName="bg-slate-900/40"
      >
        {/* Drawer Header */}
        <DrawerHeader className="mb-0 flex-col items-stretch gap-0 border-border bg-slate-50/50 p-5 dark:bg-slate-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <DrawerTitle className="text-lg font-bold text-foreground">
                {title}
              </DrawerTitle>
            </div>
            <DrawerClose
              className="rounded-lg p-1 text-muted-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800"
              aria-label={t("bi.cockpit.drawer.closeAria")}
            />
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}

          {/* Quick KPI Strip */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-border/60 text-start">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                {t("bi.cockpit.drawer.totalVolume")}
              </span>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {formatCockpitMetric(currentTotal ?? summary.total, true, true)}
              </div>
              {baselineTotal !== undefined && (
                <span className="text-[9px] text-muted-foreground">
                  {t("common.uiLabels.vs")}{" "}
                  {formatCockpitMetric(baselineTotal, true, true)}
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-border/60 text-start">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                {t("bi.cockpit.drawer.avgLineItem")}
              </span>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {formatCockpitMetric(summary.avg, true, true)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-border/60 text-start">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                {t("bi.cockpit.drawer.totalRecords")}
              </span>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {summary.count.toLocaleString()}
              </div>
            </div>
          </div>
        </DrawerHeader>

        {/* Body Content */}
        <DrawerBody className="space-y-4 p-5">
          {/* Search, Mode Toggle and Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("bi.cockpit.drawer.filterPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-9 pe-3 py-1.5 text-xs rounded-xl border border-border bg-slate-50 dark:bg-slate-800/60 text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Pagination Mode Pill Switch */}
            <div className="flex items-center rounded-lg border border-border bg-slate-100/70 dark:bg-slate-800/70 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPaginationMode("numbered")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  paginationMode === "numbered"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={t("bi.cockpit.drawer.numberedTitle")}
              >
                <ListFilter className="w-3 h-3" />
                {t("bi.cockpit.drawer.pages")}
              </button>
              <button
                type="button"
                onClick={() => setPaginationMode("infinite")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  paginationMode === "infinite"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={t("bi.cockpit.drawer.infiniteTitle")}
              >
                <Layers className="w-3 h-3" />
                {t("bi.cockpit.drawer.infinite")}
              </button>
            </div>

            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="text-xs shrink-0 h-8"
            >
              <Download className="w-3.5 h-3.5 me-1.5" />
              {t("bi.cockpit.drawer.exportCsv")}
            </PodaciumButton>
          </div>

          {/* Decision Memo Modal Overlay or Form */}
          {isMemoOpen ? (
            <form
              onSubmit={handleSaveMemo}
              className="p-4 rounded-xl border border-primary/40 bg-primary/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {t("bi.cockpit.drawer.newMemoTitle")}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMemoOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("bi.cockpit.drawer.cancel")}
                </button>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  {t("bi.cockpit.drawer.decisionTitle")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("bi.cockpit.drawer.decisionPlaceholder")}
                  value={memoTitle}
                  onChange={(e) => setMemoTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  {t("bi.cockpit.drawer.actionPlan")}
                </label>
                <textarea
                  rows={2}
                  placeholder={t("bi.cockpit.drawer.actionPlanPlaceholder")}
                  value={memoAction}
                  onChange={(e) => setMemoAction(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  {t("bi.cockpit.drawer.assignedOwner")}
                </label>
                <select
                  value={memoOwner}
                  onChange={(e) => setMemoOwner(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="Directeur Général (DG)">
                    {t("bi.cockpit.drawer.owners.dg")}
                  </option>
                  <option value="Directeur Administratif et Financier (DAF)">
                    {t("bi.cockpit.drawer.owners.daf")}
                  </option>
                  <option value="Head of Engineering">
                    {t("bi.cockpit.drawer.owners.eng")}
                  </option>
                  <option value="VP Growth & Marketing">
                    {t("bi.cockpit.drawer.owners.growth")}
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <PodaciumButton type="submit" variant="gradient" size="sm">
                  {t("bi.cockpit.drawer.logDecisionMemo")}
                </PodaciumButton>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-border/60">
              <div className="text-xs text-muted-foreground">
                {t("bi.cockpit.drawer.memoPrompt")}
              </div>
              <PodaciumButton
                variant="secondary"
                size="sm"
                onClick={() => setIsMemoOpen(true)}
                className="text-xs shrink-0"
              >
                <FileText className="w-3.5 h-3.5 me-1" />
                {t("bi.cockpit.drawer.logMemoBtn")}
              </PodaciumButton>
            </div>
          )}

          {/* Records Data Table */}
          <div className="rounded-xl border border-border overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-start text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-border text-[11px] text-muted-foreground uppercase font-semibold">
                <tr>
                  <th scope="col" className="p-2.5 text-start">
                    {t("bi.cockpit.drawer.thEntity")}
                  </th>
                  <th scope="col" className="p-2.5 text-start">
                    {t("bi.cockpit.drawer.thCategory")}
                  </th>
                  <th scope="col" className="p-2.5 text-end">
                    {t("bi.cockpit.drawer.thAmount")}
                  </th>
                  <th scope="col" className="p-2.5 text-end">
                    {t("bi.cockpit.drawer.thVariance")}
                  </th>
                  <th scope="col" className="p-2.5 text-center">
                    {t("bi.cockpit.drawer.thStatus")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-sans">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>{t("bi.cockpit.drawer.loadingRecords")}</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-muted-foreground"
                    >
                      {t("bi.cockpit.drawer.noRecords")}
                    </td>
                  </tr>
                ) : (
                  displayedRecords.map((r, idx) => (
                    <tr
                      key={r.id || `${r.entity}-${idx}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-2.5 font-medium text-foreground truncate max-w-[140px]">
                        {r.entity}
                      </td>
                      <td className="p-2.5 text-muted-foreground truncate max-w-[100px]">
                        {r.category}
                      </td>
                      <td className="p-2.5 text-end font-mono font-semibold text-foreground">
                        {formatCockpitMetric(r.amount, true, true)}
                      </td>
                      <td
                        className={cn(
                          "p-2.5 text-end font-mono font-medium",
                          r.variance >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {r.variance > 0 ? "+" : ""}
                        {formatCockpitMetric(r.variance, true, true)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            r.status === "approved" || r.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : r.status === "flagged" ||
                                  r.status === "critical"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Infinite Scroll "Load More" Sentinel / Button */}
            {paginationMode === "infinite" &&
              filteredRecords.length > infiniteVisibleCount && (
                <div className="p-3 border-t border-border/60 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("bi.cockpit.drawer.loadedCount", {
                      visible: infiniteVisibleCount,
                      total: totalCount,
                    })}
                  </span>
                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-xs h-7"
                  >
                    {t("bi.cockpit.drawer.loadMore", { rows: rowsPerPage })}
                  </PodaciumButton>
                </div>
              )}
          </div>

          {/* Pagination Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            {/* Range Information */}
            <div className="flex items-center gap-2">
              <span>
                {t("bi.cockpit.drawer.showingRange", {
                  start: startRecordIdx,
                  end: endRecordIdx,
                  total: totalCount.toLocaleString(),
                })}
              </span>
              {totalRecords !== undefined &&
                totalRecords > filteredRecords.length && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                    {t("common.uiLabels.pushdownActive")}
                  </span>
                )}
            </div>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">
                {t("bi.cockpit.drawer.rowsPerPage")}
              </span>
              <select
                value={rowsPerPage}
                onChange={(e) =>
                  handleRowsPerPageChange(Number(e.target.value))
                }
                className="px-2 py-1 text-xs rounded-lg border border-border bg-white dark:bg-slate-900 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Numbered Pagination Buttons */}
            {paginationMode === "numbered" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  aria-label={t("bi.cockpit.drawer.firstPage")}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  aria-label={t("bi.cockpit.drawer.prevPage")}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {renderPageButtons()}
                </div>

                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  aria-label={t("bi.cockpit.drawer.nextPage")}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  aria-label={t("bi.cockpit.drawer.lastPage")}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </DrawerBody>

        {/* Footer */}
        <DrawerFooter className="justify-between border-border bg-slate-50/50 px-4 py-4 dark:bg-slate-800/30">
          <div className="text-[11px] text-muted-foreground">
            {paginationMode === "numbered" ? (
              <span>
                {t("bi.cockpit.drawer.pageIndicator", { page, totalPages })}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />{" "}
                {t("bi.cockpit.drawer.continuousActive")}
              </span>
            )}
          </div>
          <PodaciumButton variant="outline" size="sm" onClick={onClose}>
            {t("bi.cockpit.drawer.closeInspection")}
          </PodaciumButton>
        </DrawerFooter>
      </DrawerContent>
    </PodaciumDrawer>
  );
};

export default DrillThroughDrawer;
