"use client";

import React from "react";
import { SecurityPolicy } from "./types";
import { Lock, Plus, Shield, Filter, EyeOff, CheckCircle2 } from "lucide-react";

interface SecurityPoliciesTabProps {
  policies: SecurityPolicy[];
  t: (key: string, params?: any) => string;
  onOpenPolicyModal: () => void;
}

export function SecurityPoliciesTab({
  policies,
  t,
  onOpenPolicyModal,
}: SecurityPoliciesTabProps) {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Shield className="h-5 w-5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.security.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.security.description")}
            </p>
          </div>
          <button
            onClick={onOpenPolicyModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("bi.datasets.detail.tabs.security.createPolicy")}
          </button>
        </div>
      </div>

      {/* Policies List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Lock className="h-4 w-4 text-emerald-500" />
            {t("bi.datasets.detail.tabs.security.policiesList")}
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.security.type")}
                </th>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.security.role")}
                </th>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.security.condition")}
                </th>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.security.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {policies.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {p.policy_type === "ROW_FILTER" ? (
                        <Filter className="h-4 w-4 text-blue-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {p.policy_type === "ROW_FILTER"
                          ? t("bi.datasets.detail.tabs.security.rowFilter")
                          : t("bi.datasets.detail.tabs.security.colMask")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      {p.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {p.policy_type === "ROW_FILTER"
                      ? p.filter_condition || "—"
                      : `Column: ${p.column_name} (${p.masking_method})`}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("bi.datasets.detail.tabs.security.active")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
