"use client";

import React from "react";
import {
  Database,
  Calendar,
  FileText,
  BarChart2,
  Trash2,
  Download,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface DatasetCardProps {
  id: string | number;
  name: string;
  rowCount: number;
  columnCount: number;
  format?: string;
  status?: string;
  createdAt?: string;
  onPreview?: (id: string | number) => void;
  onExport?: (id: string | number) => void;
  onDelete?: (id: string | number) => void;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({
  id,
  name,
  rowCount,
  columnCount,
  format = "CSV",
  status = "ready",
  createdAt,
  onPreview,
  onExport,
  onDelete,
}) => {
  const { t } = useTranslations();

  return (
    <div className="group border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:border-blue-500/40 dark:hover:border-blue-500/40">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {name}
            </h3>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              <span className="uppercase font-medium text-blue-600 dark:text-blue-400">
                {format}
              </span>
              <span>•</span>
              <span className="capitalize">{status}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 py-3 px-3 rounded-xl bg-gray-50/50 dark:bg-slate-800/50 text-xs">
        <div>
          <span className="text-gray-400 dark:text-slate-500 block">
            {t("bi.datasets.detail.tabs.overview.metrics.rows")}
          </span>
          <span className="font-medium text-gray-800 dark:text-slate-200">
            {rowCount.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-400 dark:text-slate-500 block">
            {t("bi.datasets.detail.tabs.overview.metrics.columns")}
          </span>
          <span className="font-medium text-gray-800 dark:text-slate-200">
            {columnCount}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-xs">
        <span className="text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {createdAt
            ? new Date(createdAt).toLocaleDateString()
            : t("common.recent")}
        </span>
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              onClick={() => onPreview(id)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title={t("bi.datasets.list.table.actions.preview")}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          )}
          {onExport && (
            <button
              onClick={() => onExport(id)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title={t("bi.datasets.list.table.actions.export")}
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title={t("bi.datasets.list.table.actions.delete")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
