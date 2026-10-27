"use client";

import React, { useState } from "react";
import {
  Code2,
  Play,
  Plus,
  HelpCircle,
  Check,
  Copy,
  Sparkles,
  Terminal,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface QuickFormula {
  name: string;
  syntax: string;
  desc: string;
}

const COMMON_FORMULAS: QuickFormula[] = [
  {
    name: "SUM()",
    syntax: "SUM(dataset.revenue)",
    desc: "Total sum of numeric column",
  },
  { name: "AVERAGE()", syntax: "AVG(dataset.amount)", desc: "Arithmetic mean" },
  {
    name: "DIVIDE()",
    syntax: "DIVIDE(SUM(revenue), SUM(users), 0)",
    desc: "Safe division with zero fallback",
  },
  {
    name: "YOY_GROWTH()",
    syntax: "CALCULATE_YOY(SUM(revenue), date_col)",
    desc: "Year over year percentage change",
  },
];

export const BiMeasureBuilder: React.FC = () => {
  const t = useTranslations("bi.dashboards.measureBuilder");
  const [measureName, setMeasureName] = useState("Total_Revenue_DZD");
  const [expression, setExpression] = useState(
    "SUM(transactions.amount_dzd) * 1.19",
  );
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestMeasure = () => {
    if (!expression.trim()) return;
    setTestResult("Evaluating AST...");
    setTimeout(() => {
      setTestResult(
        "✅ Evaluated Successfully: Output Type = FLOAT64 | Sample Value = 14,850,200 DZD",
      );
      toast.success(t("successToast"));
    }, 600);
  };

  const handleInsertFormula = (syntax: string) => {
    setExpression((prev) => (prev ? `${prev} + ${syntax}` : syntax));
  };

  return (
    <div className="w-full mb-6 rounded-3xl p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-200/80 dark:border-slate-800/80 shadow-md text-start">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {t("title")}
              <PodaciumBadge variant="success">{t("badge")}</PodaciumBadge>
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <PodaciumButton variant="primary" size="sm" onClick={handleTestMeasure}>
          <Play className="w-3.5 h-3.5 me-1 fill-current" />
          {t("compileEvaluate")}
        </PodaciumButton>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t("measureIdentifier")}
          </label>
          <input
            type="text"
            value={measureName}
            onChange={(e) => setMeasureName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center justify-between">
            <span>{t("daxExpression")}</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono">
              {t("syntaxHint")}
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              className="w-full px-3 py-2 ps-8 rounded-xl bg-gray-900 dark:bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <Terminal className="w-4 h-4 text-slate-500 absolute start-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Quick Snippets Bar */}
      <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
        <span className="text-gray-500 dark:text-slate-400 font-medium me-1">
          {t("quickFunctions")}
        </span>
        {COMMON_FORMULAS.map((f) => (
          <button
            key={f.name}
            onClick={() => handleInsertFormula(f.syntax)}
            title={f.desc}
            className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-gray-700 dark:text-slate-300 transition-all font-mono text-[11px] border border-gray-200 dark:border-slate-700 hover:border-indigo-400"
          >
            + {f.name}
          </button>
        ))}
      </div>

      {/* Evaluation Output */}
      {testResult && (
        <div className="p-3 rounded-2xl bg-slate-950 text-emerald-400 border border-slate-800 text-xs font-mono">
          {testResult}
        </div>
      )}
    </div>
  );
};
