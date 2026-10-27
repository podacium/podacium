"use client";

import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
  Lock,
  PlusCircle,
  Cpu,
} from "lucide-react";
import { BiDatasetMetadata, BiQualityResult } from "@/lib/api";
import { DQRulesModal } from "./DQRulesModal";
import { PiiMaskingModal } from "./PiiMaskingModal";
import { SyntheticGeneratorModal } from "./SyntheticGeneratorModal";

export function QualityDoctorTab({
  dataset,
  quality,
  onOpenCleanModal,
  t,
}: {
  dataset: BiDatasetMetadata;
  quality?: BiQualityResult | null;
  onOpenCleanModal: () => void;
  t: (key: string, params?: any) => string;
}) {
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isMaskModalOpen, setIsMaskModalOpen] = useState(false);
  const [isSyntheticModalOpen, setIsSyntheticModalOpen] = useState(false);

  const issues = quality?.issues || [];
  const score = dataset.quality_score ?? 85;
  const columns = dataset.columns || [];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t("bi.datasets.detail.tabs.quality.doctorTitle")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.quality.scoreSubtitle", { score })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {t("bi.datasets.detail.tabs.quality.rulesBtn")}
            </button>
            <button
              onClick={() => setIsMaskModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-500/20 flex items-center gap-1.5 transition-all"
            >
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              {t("bi.datasets.detail.tabs.quality.piiBtn")}
            </button>
            <button
              onClick={() => setIsSyntheticModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-500/20 flex items-center gap-1.5 transition-all"
            >
              <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              {t("bi.datasets.detail.tabs.quality.syntheticBtn")}
            </button>
            <button
              onClick={onOpenCleanModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              {t("bi.datasets.detail.hero.actions.smartClean")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              {t("bi.datasets.detail.tabs.quality.completenessVerified")}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t("bi.datasets.detail.tabs.quality.completenessDesc")}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              {t("bi.datasets.detail.tabs.quality.recommendationsTitle")}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t("bi.datasets.detail.tabs.quality.recommendationsDesc")}
            </p>
          </div>
        </div>

        {/* Quality Issues List */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">
            {t("bi.datasets.detail.tabs.quality.alertsTitle")}
          </h4>
          {issues.length > 0 ? (
            <div className="space-y-2">
              {issues.map((issue: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`w-4 h-4 mt-0.5 ${issue.severity === "CRITICAL" ? "text-rose-500" : "text-amber-500"}`}
                    />
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {issue.title || issue.type}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {issue.description || issue.message}
                      </p>
                      {issue.affectedColumn && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 font-mono text-[10px]">
                          {t("common.uiLabels.columnPrefix")}{" "}
                          {issue.affectedColumn}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${issue.severity === "CRITICAL" ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400" : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"}`}
                  >
                    {issue.severity || "WARNING"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
              {t("bi.datasets.detail.tabs.overview.aiSummary.noIssues")}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <DQRulesModal
        datasetId={dataset.dataset_id || String(dataset.id)}
        columns={columns}
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        t={t}
      />

      <PiiMaskingModal
        datasetId={dataset.dataset_id || String(dataset.id)}
        columns={columns}
        isOpen={isMaskModalOpen}
        onClose={() => setIsMaskModalOpen(false)}
        t={t}
      />

      <SyntheticGeneratorModal
        datasetId={dataset.dataset_id || String(dataset.id)}
        isOpen={isSyntheticModalOpen}
        onClose={() => setIsSyntheticModalOpen(false)}
        t={t}
      />
    </div>
  );
}
