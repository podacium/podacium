"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  CheckCircle2,
  Rows3,
  Columns,
  HardDrive,
  Calendar,
  Sparkles,
  Download,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { BiDatasetMetadata } from "@/lib/api";
import {
  BI_DOMAINS,
  formatFileSize,
  formatNumber,
  formatDate,
  getDomainLabel,
} from "./types";

function HealthScoreRing({
  score,
  t,
}: {
  score: number;
  t: (key: string) => string;
}) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let colorClass = "stroke-emerald-500 text-emerald-500";
  let bgGradient = "from-emerald-500/20 to-teal-500/10";
  if (clampedScore < 70) {
    colorClass = "stroke-amber-500 text-amber-500";
    bgGradient = "from-amber-500/20 to-yellow-500/10";
  }
  if (clampedScore < 50) {
    colorClass = "stroke-rose-500 text-rose-500";
    bgGradient = "from-rose-500/20 to-red-500/10";
  }

  return (
    <div
      className={`relative w-28 h-28 rounded-2xl flex items-center justify-center bg-gradient-to-br ${bgGradient} border border-white/10 p-2 shadow-inner`}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="8"
          fill="transparent"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          className={colorClass}
          strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
          {clampedScore}%
        </span>
        <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
          {t("bi.datasets.detail.hero.health")}
        </span>
      </div>
    </div>
  );
}

export function DatasetHeroBanner({
  dataset,
  t,
  dir,
  refreshing,
  isDeleting,
  onExport,
  onRefresh,
  onOpenCleanModal,
  locale,
  onUpdateMetadata,
  onDeleteDataset,
}: {
  dataset: BiDatasetMetadata;
  t: (key: string, params?: any) => string;
  dir?: "ltr" | "rtl";
  refreshing: boolean;
  isDeleting: boolean;
  onExport?: () => void;
  onRefresh: () => void;
  onOpenCleanModal: () => void;
  locale?: string;
  onUpdateMetadata: (updates: {
    name?: string;
    domain?: string;
    description?: string;
  }) => void;
  onDeleteDataset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(dataset.name);
  const [domain, setDomain] = useState(dataset.domain || "other");
  const [description, setDescription] = useState(dataset.description || "");

  const domainObj =
    BI_DOMAINS.find((d) => d.id === dataset.domain) || BI_DOMAINS[6];
  const columnsList = dataset.columns || [];

  const handleSave = () => {
    onUpdateMetadata({ name, domain, description });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(dataset.name);
    setDomain(dataset.domain || "other");
    setDescription(dataset.description || "");
    setIsEditing(false);
  };

  const domainLabel = getDomainLabel(dataset.domain, t);

  return (
    <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/60 shadow-2xl shadow-indigo-500/5 rounded-3xl p-6 sm:p-8">
      <div className="absolute -top-24 -end-24 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        {/* Title & Metadata */}
        <div className="space-y-4 max-w-3xl flex-1">
          {!isEditing ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${domainObj.color}`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {domainLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  {(dataset.format || "CSV").toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t(
                    `bi.datasets.status.${(dataset.status || "PROCESSED").toLowerCase()}`,
                  )}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={t("bi.datasets.detail.hero.editDetails")}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {dataset.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  {dataset.description ||
                    t("bi.datasets.detail.tabs.overview.description.empty")}
                </p>
              </div>
            </>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {t("bi.datasets.detail.hero.editModal.nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {t("bi.datasets.detail.hero.editModal.domainLabel")}
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {BI_DOMAINS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {getDomainLabel(d.id, t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {t("bi.datasets.detail.hero.editModal.descriptionLabel")}
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />{" "}
                  {t("bi.datasets.detail.hero.editModal.cancel")}
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />{" "}
                  {t("bi.datasets.detail.hero.editModal.save")}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-mono pt-1">
            <div className="flex items-center gap-2">
              <Rows3 className="w-4 h-4 text-indigo-500" />
              <span>
                {t("bi.datasets.detail.hero.stats.rows", {
                  count: formatNumber(dataset.row_count),
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-purple-500" />
              <span>
                {t("bi.datasets.detail.hero.stats.columns", {
                  count: dataset.column_count || columnsList.length,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-500" />
              <span>{formatFileSize(dataset.file_size)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>
                {t("bi.datasets.detail.hero.stats.createdOn", {
                  date: formatDate(dataset.created_at, true, locale),
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Health Ring & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
          <HealthScoreRing score={dataset.quality_score ?? 85} t={t} />

          <div className="flex flex-col gap-2.5 w-full sm:w-auto">
            <button
              onClick={onOpenCleanModal}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t("bi.datasets.detail.hero.actions.smartClean")}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onExport}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-200/80 dark:border-slate-700"
                title={t("bi.datasets.detail.hero.actions.exportTitle")}
              >
                <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t("bi.datasets.detail.hero.actions.export")}
              </button>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-200/80 dark:border-slate-700 disabled:opacity-50"
                title={t("bi.datasets.detail.hero.actions.refreshTitle")}
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={onDeleteDataset}
                disabled={isDeleting}
                className="p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-colors disabled:opacity-50"
                title={t("bi.datasets.detail.hero.actions.deleteTitle")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
