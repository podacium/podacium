"use client";

import React, { useState } from "react";
import { Lock, X, CheckCircle2 } from "lucide-react";

interface CreatePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (policy: {
    policy_type: "ROW_FILTER" | "COLUMN_MASK";
    role: "ALL" | "ANALYST" | "VIEWER" | "MANAGER";
    column_name?: string;
    filter_condition?: string;
    masking_method?: string;
  }) => Promise<void>;
  columns: string[];
  t: (key: string, params?: any) => string;
}

export function CreatePolicyModal({
  isOpen,
  onClose,
  onSubmit,
  columns,
  t,
}: CreatePolicyModalProps) {
  const [policyType, setPolicyType] = useState<"ROW_FILTER" | "COLUMN_MASK">(
    "ROW_FILTER",
  );
  const [role, setRole] = useState<"ALL" | "ANALYST" | "VIEWER" | "MANAGER">(
    "ANALYST",
  );
  const [columnName, setColumnName] = useState(columns[0] || "");
  const [filterCondition, setFilterCondition] = useState("amount >= 0");
  const [maskingMethod, setMaskingMethod] = useState("HASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        policy_type: policyType,
        role,
        column_name: policyType === "COLUMN_MASK" ? columnName : undefined,
        filter_condition:
          policyType === "ROW_FILTER" ? filterCondition : undefined,
        masking_method:
          policyType === "COLUMN_MASK" ? maskingMethod : undefined,
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
            <Lock className="h-5 w-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {t("bi.datasets.detail.tabs.security.createPolicy")}
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
              {t("bi.datasets.detail.tabs.security.policyType")}
            </label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="ROW_FILTER">
                {t("bi.datasets.detail.tabs.security.types.rowFilter")}
              </option>
              <option value="COLUMN_MASK">
                {t("bi.datasets.detail.tabs.security.types.columnMask")}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t("bi.datasets.detail.tabs.security.targetRole")}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="ALL">
                {t("bi.datasets.detail.tabs.security.roles.all")}
              </option>
              <option value="ANALYST">
                {t("bi.datasets.detail.tabs.security.roles.analyst")}
              </option>
              <option value="VIEWER">
                {t("bi.datasets.detail.tabs.security.roles.viewer")}
              </option>
              <option value="MANAGER">
                {t("bi.datasets.detail.tabs.security.roles.manager")}
              </option>
            </select>
          </div>

          {policyType === "ROW_FILTER" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("bi.datasets.detail.tabs.security.sqlCondition")}
              </label>
              <input
                type="text"
                required
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                placeholder={t(
                  "bi.datasets.detail.tabs.security.sqlConditionPlaceholder",
                )}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("bi.datasets.detail.tabs.security.targetColumn")}
                </label>
                <select
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("bi.datasets.detail.tabs.security.masking")}
                </label>
                <select
                  value={maskingMethod}
                  onChange={(e) => setMaskingMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="HASH">
                    {t("bi.datasets.detail.tabs.security.methods.hash")}
                  </option>
                  <option value="REDACT">
                    {t("bi.datasets.detail.tabs.security.methods.redact")}
                  </option>
                  <option value="MASK_CHARS">
                    {t("bi.datasets.detail.tabs.security.methods.maskChars")}
                  </option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("bi.datasets.detail.tabs.security.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting
                ? t("bi.datasets.detail.tabs.security.saving")
                : t("bi.datasets.detail.tabs.security.savePolicy")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
