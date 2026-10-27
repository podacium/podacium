"use client";

import React, { useState } from "react";
import { BiDatasetMetadata } from "@/lib/api";
import { DataContract, GovernanceData } from "./types";
import {
  ShieldCheck,
  Award,
  Tag,
  Plus,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
} from "lucide-react";

interface GovernanceTabProps {
  dataset: BiDatasetMetadata;
  contract: DataContract | null;
  governance: GovernanceData | null;
  t: (key: string, params?: any) => string;
  onOpenContractModal: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function GovernanceTab({
  dataset,
  contract,
  governance,
  t,
  onOpenContractModal,
  onAddTag,
  onRemoveTag,
}: GovernanceTabProps) {
  const [newTag, setNewTag] = useState("");

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    onAddTag(newTag.trim());
    setNewTag("");
  };

  const sensitivityLevel = governance?.sensitivity_level || "CONFIDENTIAL";
  const tags = governance?.tags || ["#PRODUCTION", "#ANALYTICAL_READY"];
  const frameworks = governance?.compliance_frameworks || [
    "GDPR",
    "Algeria Law 18-07",
    "ISO-27001",
  ];

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.governance.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.governance.description")}
            </p>
          </div>
          <button
            onClick={onOpenContractModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <FileCode2 className="h-4 w-4" />
            {t("bi.datasets.detail.tabs.governance.createContract")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Governance Posture Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Lock className="h-4 w-4 text-emerald-500" />
            {t("bi.datasets.detail.tabs.governance.sensitivity")}
          </h4>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                sensitivityLevel === "CONFIDENTIAL"
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t(
                `bi.datasets.detail.tabs.governance.sensitivity_${sensitivityLevel.toLowerCase()}`,
              ) || sensitivityLevel}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Award className="h-3.5 w-3.5" />
              {t("bi.datasets.detail.tabs.governance.compliance")}
            </h5>
            <div className="flex flex-wrap gap-2">
              {frameworks.map((fw, idx) => {
                const label = fw.includes("Algeria Law")
                  ? t("bi.datasets.detail.tabs.governance.algeriaLaw") || fw
                  : fw;
                return (
                  <span
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Data Quality Contract & SLAs */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FileCode2 className="h-4 w-4 text-indigo-500" />
              {t("bi.datasets.detail.tabs.governance.contractsTitle")}
            </h4>
            {contract?.status === "VERIFIED" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("bi.datasets.detail.tabs.governance.verified")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("bi.datasets.detail.tabs.governance.violated")}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t("bi.datasets.detail.tabs.governance.contractsDesc")}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 dark:border-slate-800/60 dark:bg-slate-800/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.governance.minRows")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {contract?.min_row_count ?? 1}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 dark:border-slate-800/60 dark:bg-slate-800/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.governance.maxMissing")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {contract?.max_missing_pct ?? 10}%
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 dark:border-slate-800/60 dark:bg-slate-800/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.tabs.overview.metrics.quality")}
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {contract?.current_quality ?? dataset?.qualityScore ?? 85}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Taxonomy & Tags Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Tag className="h-4 w-4 text-purple-500" />
          {t("bi.datasets.detail.tabs.governance.tags")}
        </h4>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300"
            >
              {tag}
              <button
                onClick={() => onRemoveTag(tag)}
                className="ms-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <form
          onSubmit={handleAddTagSubmit}
          className="mt-6 flex max-w-md items-center gap-2"
        >
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder={t("bi.datasets.detail.tabs.governance.tagPlaceholder")}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("bi.datasets.detail.tabs.governance.addTag")}
          </button>
        </form>
      </div>
    </div>
  );
}
