"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

export function SmartCleanModal({
  isOpen,
  onClose,
  onCleanSuccess,
  onCleanComplete,
  datasetId,
  datasetName,
  t: propT,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCleanSuccess?: (res: any) => void;
  onCleanComplete?: () => void;
  datasetId: string;
  datasetName?: string;
  t?: (key: string, params?: any) => string;
}) {
  const tLocal = useTranslations();
  const t = propT || tLocal;
  const [fillMissing, setFillMissing] = useState(true);
  const [missingStrategy, setMissingStrategy] = useState("auto");
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  if (!isOpen) return null;

  const handleClean = async () => {
    setCleaning(true);
    try {
      const res = await api.bi.cleanDataset(datasetId, {
        fill_missing: fillMissing,
        missing_strategy: missingStrategy,
        drop_duplicates: dropDuplicates,
        trim_whitespace: trimWhitespace,
      });
      toast.success(t("bi.datasets.detail.cleanModal.success"));
      if (onCleanSuccess) onCleanSuccess(res);
      if (onCleanComplete) onCleanComplete();
      onClose();
    } catch (err: any) {
      console.error("Clean error:", err);
      toast.error(err.message || t("bi.datasets.detail.cleanModal.error"));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.cleanModal.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.cleanModal.subtitle")}{" "}
                  {datasetName ? `(${datasetName})` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                  {t("bi.datasets.detail.cleanModal.fillMissing")}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.cleanModal.fillMissingDesc")}
                </span>
              </div>
              <input
                type="checkbox"
                checked={fillMissing}
                onChange={(e) => setFillMissing(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {fillMissing && (
              <div className="ms-4 space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {t("bi.datasets.detail.cleanModal.strategyLabel")}
                </label>
                <select
                  value={missingStrategy}
                  onChange={(e) => setMissingStrategy(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="auto">
                    {t("bi.datasets.detail.cleanModal.autoStrategy")}
                  </option>
                  <option value="mean">
                    {t("bi.datasets.detail.cleanModal.meanStrategy")}
                  </option>
                  <option value="mode">
                    {t("bi.datasets.detail.cleanModal.modeStrategy")}
                  </option>
                </select>
              </div>
            )}

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                  {t("bi.datasets.detail.cleanModal.deduplicate")}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.cleanModal.deduplicateDesc")}
                </span>
              </div>
              <input
                type="checkbox"
                checked={dropDuplicates}
                onChange={(e) => setDropDuplicates(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                  {t("bi.datasets.detail.cleanModal.trimWhitespace")}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.cleanModal.trimWhitespaceDesc")}
                </span>
              </div>
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(e) => setTrimWhitespace(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              {t("bi.datasets.detail.cleanModal.cancel")}
            </button>
            <button
              onClick={handleClean}
              disabled={cleaning}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {cleaning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("bi.datasets.detail.cleanModal.cleaning")}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t("bi.datasets.detail.cleanModal.submit")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
