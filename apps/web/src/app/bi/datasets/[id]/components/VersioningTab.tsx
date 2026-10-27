"use client";

import React from "react";
import { DatasetSnapshot, formatDate } from "./types";
import {
  History,
  GitCommit,
  RotateCcw,
  Clock,
  Plus,
  Sparkles,
} from "lucide-react";

interface VersioningTabProps {
  snapshots: DatasetSnapshot[];
  t: (key: string, params?: any) => string;
  locale?: string;
  onOpenSnapshotModal: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  restoringId: string | null;
}

export function VersioningTab({
  snapshots,
  t,
  locale,
  onOpenSnapshotModal,
  onRestoreSnapshot,
  restoringId,
}: VersioningTabProps) {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <History className="h-5 w-5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.versioning.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.versioning.description")}
            </p>
          </div>
          <button
            onClick={onOpenSnapshotModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("bi.datasets.detail.tabs.versioning.createSnapshot")}
          </button>
        </div>
      </div>

      {/* Snapshot Timeline Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <GitCommit className="h-4 w-4 text-indigo-500" />
          {t("bi.datasets.detail.tabs.versioning.snapshotHistory")}
        </h4>

        <div className="mt-6 relative space-y-6 before:absolute before:start-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {snapshots.map((snap) => {
            const isRestoring = restoringId === snap.snapshot_id;
            const localizedVersionName = snap.version_name
              .replace(
                "Initial Ingestion",
                t("bi.datasets.detail.tabs.versioning.initialIngestion"),
              )
              .replace(
                "Current State",
                t("bi.datasets.detail.tabs.versioning.currentState"),
              );
            return (
              <div
                key={snap.snapshot_id}
                className="relative ps-10 transition-all"
              >
                {/* Dot */}
                <div
                  className={`absolute start-1.5 top-1 h-4 w-4 rounded-full border-2 ${
                    snap.is_current
                      ? "border-emerald-500 bg-emerald-500 ring-4 ring-emerald-500/20"
                      : "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900"
                  }`}
                />

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-slate-100/50 dark:border-slate-800/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {localizedVersionName}
                        </span>
                        {snap.is_current && (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                            {t("bi.datasets.detail.tabs.versioning.current")}
                          </span>
                        )}
                      </div>
                      {snap.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {snap.description}
                        </p>
                      )}
                    </div>

                    {!snap.is_current && (
                      <button
                        disabled={isRestoring}
                        onClick={() => onRestoreSnapshot(snap.snapshot_id)}
                        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:self-center"
                      >
                        <RotateCcw
                          className={`h-3.5 w-3.5 ${
                            isRestoring ? "animate-spin text-indigo-500" : ""
                          }`}
                        />
                        {isRestoring
                          ? t("bi.datasets.detail.tabs.versioning.restoring")
                          : t("bi.datasets.detail.tabs.versioning.restore")}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(snap.created_at, true, locale)}
                    </span>
                    <span>
                      {t("bi.datasets.detail.tabs.versioning.rows")}:{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {snap.row_count}
                      </strong>
                    </span>
                    <span>
                      {t("bi.datasets.detail.tabs.versioning.cols")}:{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {snap.column_count}
                      </strong>
                    </span>
                    <span>
                      {t("bi.datasets.detail.tabs.versioning.quality")}:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {snap.quality_score}%
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
