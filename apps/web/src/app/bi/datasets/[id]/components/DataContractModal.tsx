"use client";

import React, { useState } from "react";
import { FileCode2, X, CheckCircle2 } from "lucide-react";

interface DataContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (contract: {
    name: string;
    min_row_count: number;
    max_missing_pct: number;
    enforce_strict_types: boolean;
  }) => Promise<void>;
  t: (key: string, params?: any) => string;
}

export function DataContractModal({
  isOpen,
  onClose,
  onSubmit,
  t,
}: DataContractModalProps) {
  const [name, setName] = useState("");
  const [minRowCount, setMinRowCount] = useState(1);
  const [maxMissingPct, setMaxMissingPct] = useState(10);
  const [enforceStrict, setEnforceStrict] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        name:
          name.trim() ||
          t("bi.datasets.detail.contractModal.defaultContractName"),
        min_row_count: minRowCount,
        max_missing_pct: maxMissingPct,
        enforce_strict_types: enforceStrict,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {t("bi.datasets.detail.contractModal.title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t("bi.datasets.detail.contractModal.contractName")}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "bi.datasets.detail.contractModal.defaultContractName",
              )}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("bi.datasets.detail.contractModal.minRows")}
              </label>
              <input
                type="number"
                min={0}
                value={minRowCount}
                onChange={(e) => setMinRowCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("bi.datasets.detail.contractModal.maxMissing")}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxMissingPct}
                onChange={(e) => setMaxMissingPct(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={enforceStrict}
              onChange={(e) => setEnforceStrict(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {t("bi.datasets.detail.contractModal.strictSchema")}
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("bi.datasets.detail.contractModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting
                ? "..."
                : t("bi.datasets.detail.contractModal.activate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
