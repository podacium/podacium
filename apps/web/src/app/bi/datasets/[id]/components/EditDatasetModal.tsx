"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Edit3, Check, Tag, FileText, Type } from "lucide-react";
import { BiDatasetMetadata } from "@/lib/api";
import { BI_DOMAINS } from "./types";

export function EditDatasetModal({
  dataset,
  isOpen,
  onClose,
  onSave,
  t,
}: {
  dataset: BiDatasetMetadata;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: {
    name?: string;
    domain?: string;
    description?: string;
  }) => Promise<void>;
  t: (key: string, params?: any) => string;
}) {
  const [name, setName] = useState(dataset.name || "");
  const [domain, setDomain] = useState(dataset.domain || "other");
  const [description, setDescription] = useState(dataset.description || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(dataset.name || "");
    setDomain(dataset.domain || "other");
    setDescription(dataset.description || "");
  }, [dataset]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, domain, description });
      onClose();
    } catch (err) {
      console.error("Save dataset edit failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-slate-900 dark:text-slate-100 relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.modals.edit.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.modals.edit.subtitle")}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                {t("bi.datasets.detail.modals.edit.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                {t("bi.datasets.detail.modals.edit.domain")}
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {BI_DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t(`bi.datasets.domains.${d.id}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                {t("bi.datasets.detail.modals.edit.description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder={t(
                  "bi.datasets.detail.modals.edit.descPlaceholder",
                )}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                {t("bi.datasets.detail.modals.edit.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving
                  ? t("bi.datasets.detail.modals.edit.saving")
                  : t("bi.datasets.detail.modals.edit.save")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
