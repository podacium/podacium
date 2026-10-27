"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShieldAlert, Lock, CheckCircle2, X, Loader2 } from "lucide-react";
import { useBidi, useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";

export function PiiMaskingModal({
  datasetId,
  columns,
  isOpen,
  onClose,
  onMaskComplete,
  t: propT,
}: {
  datasetId: string;
  columns: any[];
  isOpen: boolean;
  onClose: () => void;
  onMaskComplete?: () => void;
  t?: (key: string, params?: any) => string;
}) {
  const { dir } = useBidi();
  const tLocal = useTranslations();
  const t = propT || tLocal;
  const columnNames = columns.map((c) =>
    typeof c === "string" ? c : c.name || String(c),
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [method, setMethod] = useState<"hash" | "redact" | "mask_chars">(
    "hash",
  );
  const [masking, setMasking] = useState(false);

  if (!isOpen) return null;

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleApplyMasking = async () => {
    if (selectedColumns.length === 0) {
      toast.error(t("bi.datasets.detail.modals.pii.selectColumnError"));
      return;
    }
    setMasking(true);
    try {
      const res = await api.bi.maskDatasetPii(
        datasetId,
        selectedColumns,
        method,
      );
      toast.success(res.message || t("bi.datasets.detail.modals.pii.success"));
      if (onMaskComplete) onMaskComplete();
      onClose();
    } catch (err: any) {
      console.error("Masking error:", err);
      toast.error(err.message || t("bi.datasets.detail.modals.pii.error"));
    } finally {
      setMasking(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-lg shadow-rose-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.modals.pii.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.modals.pii.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                {t("bi.datasets.detail.modals.pii.selectMethod")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "hash",
                    label: t("bi.datasets.detail.modals.pii.methods.hash"),
                    desc: "Unique Key",
                  },
                  {
                    id: "redact",
                    label: t("bi.datasets.detail.modals.pii.methods.redact"),
                    desc: "[REDACTED]",
                  },
                  {
                    id: "mask_chars",
                    label: t("bi.datasets.detail.modals.pii.methods.mask"),
                    desc: "XX****XX",
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id as any)}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      method === m.id
                        ? "bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 font-bold"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xs block">{m.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5">
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                {t("bi.datasets.detail.modals.pii.sensitiveColumns", {
                  count: selectedColumns.length,
                })}
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                {columnNames.map((col) => {
                  const isSelected = selectedColumns.includes(col);
                  return (
                    <label
                      key={col}
                      onClick={() => toggleColumn(col)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold"
                          : "hover:bg-slate-200/60 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-mono">{col}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              {t("bi.datasets.detail.modals.pii.cancel")}
            </button>
            <button
              onClick={handleApplyMasking}
              disabled={masking || selectedColumns.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-rose-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {masking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("bi.datasets.detail.modals.pii.maskingProgress")}
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {t("bi.datasets.detail.modals.pii.applyMasking")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
