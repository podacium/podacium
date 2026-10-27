"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Play,
  Loader2,
} from "lucide-react";
import { useBidi, useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";

export interface DQRule {
  column: string;
  rule_type: string;
  value?: string;
  allowed_values?: string[];
}

export function DQRulesModal({
  datasetId,
  columns,
  isOpen,
  onClose,
  t: propsT,
}: {
  datasetId: string;
  columns: any[];
  isOpen: boolean;
  onClose: () => void;
  t?: (key: string, params?: any) => string;
}) {
  const { dir } = useBidi();
  const i18n = useTranslations();
  const t = propsT || i18n;
  const columnNames = columns.map((c) =>
    typeof c === "string" ? c : c.name || String(c),
  );
  const [rules, setRules] = useState<DQRule[]>([
    { column: columnNames[0] || "", rule_type: "not_null" },
  ]);
  const [results, setResults] = useState<any[] | null>(null);
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { column: columnNames[0] || "", rule_type: "not_null" },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTestRules = async () => {
    setTesting(true);
    try {
      const res = await api.bi.evaluateQualityRules(datasetId, rules);
      setResults(res.results || []);
      toast.success(t("bi.datasets.detail.modals.dqRules.success"));
    } catch (err: any) {
      console.error("Rule evaluation error:", err);
      toast.error(err.message || t("bi.datasets.detail.modals.dqRules.error"));
    } finally {
      setTesting(false);
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
          className="w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-6 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("bi.datasets.detail.modals.dqRules.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("bi.datasets.detail.modals.dqRules.subtitle")}
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

          {/* Rule Creator List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("bi.datasets.detail.modals.dqRules.activeRules", {
                  count: rules.length,
                })}
              </span>
              <button
                onClick={handleAddRule}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-500/30 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />{" "}
                {t("bi.datasets.detail.modals.dqRules.addRule")}
              </button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3"
                >
                  <select
                    value={rule.column}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRules((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, column: val } : r,
                        ),
                      );
                    }}
                    className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {columnNames.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>

                  <select
                    value={rule.rule_type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRules((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, rule_type: val } : r,
                        ),
                      );
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-indigo-600 dark:text-indigo-400 focus:outline-none"
                  >
                    <option value="not_null">
                      {t("bi.datasets.detail.modals.dqRules.ruleTypes.notNull")}
                    </option>
                    <option value="min">
                      {t("bi.datasets.detail.modals.dqRules.ruleTypes.min")}
                    </option>
                    <option value="max">
                      {t("bi.datasets.detail.modals.dqRules.ruleTypes.max")}
                    </option>
                  </select>

                  {(rule.rule_type === "min" || rule.rule_type === "max") && (
                    <input
                      type="text"
                      placeholder={t(
                        "bi.datasets.detail.modals.dqRules.limitValuePlaceholder",
                      )}
                      value={rule.value || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRules((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, value: val } : r,
                          ),
                        );
                      }}
                      className="w-28 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  )}

                  <button
                    onClick={() => handleRemoveRule(idx)}
                    disabled={rules.length === 1}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Test Evaluation Results */}
          {results && (
            <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("bi.datasets.detail.modals.dqRules.resultsTitle")}
              </h4>
              <div className="space-y-2">
                {results.map((res, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {res.status === "PASSED" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      ) : res.status === "WARNING" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      )}
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {res.column}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        ({res.rule_type})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t(
                          "bi.datasets.detail.modals.dqRules.complianceCounts",
                          {
                            passed: res.passed,
                            failed: res.failed,
                            total: res.total || res.passed + res.failed,
                          },
                        )}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md ${
                          res.status === "PASSED"
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                            : res.status === "WARNING"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {t("bi.datasets.detail.modals.dqRules.passRate", {
                          rate: res.pass_rate,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              {t("bi.datasets.detail.modals.dqRules.close")}
            </button>
            <button
              onClick={handleTestRules}
              disabled={testing}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("bi.datasets.detail.modals.dqRules.evaluating")}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  {t("bi.datasets.detail.modals.dqRules.testRules")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
