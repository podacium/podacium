"use client";

import { History, Clock, FileText, User } from "lucide-react";
import { BiDatasetMetadata, HistoryEntry } from "@/lib/api";
import { formatDate } from "./types";

export function LineageAuditTab({
  dataset,
  datasetId,
  history = [],
  t,
  locale,
}: {
  dataset?: BiDatasetMetadata;
  datasetId?: string;
  history?: HistoryEntry[];
  t: (key: string, params?: any) => string;
  locale?: string;
}) {
  const createdAt = dataset?.created_at || new Date().toISOString();

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            {t("bi.datasets.detail.tabs.history.title")}
          </h3>
          <p className="text-xs text-slate-400">
            {t("bi.datasets.detail.tabs.history.description")}
          </p>
        </div>
      </div>

      <div className="space-y-3 font-mono text-xs">
        {history.length > 0 ? (
          history.map((entry: any, idx: number) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <div>
                  <span className="text-slate-100 font-bold block">
                    {entry.action ||
                      entry.title ||
                      t("bi.datasets.detail.tabs.history.dataModified")}
                  </span>
                  {entry.details && (
                    <span className="text-slate-400 text-[11px] block mt-0.5">
                      {entry.details}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px] block">
                  {formatDate(
                    entry.timestamp || entry.created_at,
                    true,
                    locale,
                  )}
                </span>
                {entry.user && (
                  <span className="text-slate-500 text-[10px] block">
                    {entry.user}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <span className="text-slate-100 font-bold block">
                  {t("bi.datasets.detail.tabs.history.initialImportTitle")}
                </span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  {t("bi.datasets.detail.tabs.history.initialImportDesc")}
                </span>
              </div>
            </div>
            <span className="text-slate-400 text-[11px]">
              {formatDate(createdAt, true, locale)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
