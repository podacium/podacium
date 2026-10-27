"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { useBidi } from "@/lib/i18n";

export function DeleteDatasetModal({
  datasetName,
  isOpen,
  onClose,
  onConfirmDelete,
  t,
}: {
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  t: (key: string, params?: any) => string;
}) {
  const { dir } = useBidi();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirmDelete();
      onClose();
    } catch (err) {
      console.error("Delete dataset failed:", err);
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.modals.delete.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.modals.delete.subtitle")}
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

          <div className="space-y-3 text-sm">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {t("bi.datasets.detail.modals.delete.confirmPrompt", {
                name: datasetName,
              })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("bi.datasets.detail.modals.delete.consequences")}
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              {t("bi.datasets.detail.modals.delete.cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting
                ? t("bi.datasets.detail.modals.delete.deleting")
                : t("bi.datasets.detail.modals.delete.confirm")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
