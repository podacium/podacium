"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, X, Loader2, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

export function SyntheticGeneratorModal({
  datasetId,
  isOpen,
  onClose,
  t: propT,
}: {
  datasetId: string;
  isOpen: boolean;
  onClose: () => void;
  t?: (key: string, params?: any) => string;
}) {
  const tLocal = useTranslations();
  const t = propT || tLocal;
  const [rowCount, setRowCount] = useState(10);
  const [records, setRecords] = useState<any[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.bi.generateSyntheticData(datasetId, rowCount);
      setRecords(res.records || []);
      toast.success(
        t("bi.datasets.detail.syntheticModal.toastSuccess", {
          count: res.generated_count,
        }),
      );
    } catch (err: any) {
      console.error("Synthetic generation error:", err);
      toast.error(
        err.message || t("bi.datasets.detail.syntheticModal.toastError"),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyJSON = () => {
    if (!records) return;
    navigator.clipboard.writeText(JSON.stringify(records, null, 2));
    setCopied(true);
    toast.success(t("bi.datasets.detail.syntheticModal.toastCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-6 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.syntheticModal.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.syntheticModal.subtitle")}
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
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                {t("bi.datasets.detail.syntheticModal.rowsLabel")}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={rowCount}
                onChange={(e) =>
                  setRowCount(
                    Math.max(1, Math.min(100, Number(e.target.value))),
                  )
                }
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {records && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("bi.datasets.detail.syntheticModal.previewTitle", {
                      count: records.length,
                    })}
                  </span>
                  <button
                    onClick={handleCopyJSON}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {t("bi.datasets.detail.syntheticModal.copyJson")}
                  </button>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 max-h-56 overflow-y-auto font-mono text-xs text-indigo-700 dark:text-indigo-300">
                  <pre>{JSON.stringify(records, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              {t("bi.datasets.detail.syntheticModal.close")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("bi.datasets.detail.syntheticModal.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t("bi.datasets.detail.syntheticModal.submit")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
