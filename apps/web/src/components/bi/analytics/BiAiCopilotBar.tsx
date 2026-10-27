"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Bot,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface QuerySuggestion {
  id: string;
  query: string;
  category: "trend" | "anomaly" | "forecast";
}

export const BiAiCopilotBar: React.FC = () => {
  const t = useTranslations("bi");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const sampleSuggestions: QuerySuggestion[] = [
    {
      id: "1",
      query: t("copilot.sampleQueries.revenueGrowth"),
      category: "trend",
    },
    {
      id: "2",
      query: t("copilot.sampleQueries.churnAnomalies"),
      category: "anomaly",
    },
    {
      id: "3",
      query: t("copilot.sampleQueries.forecastBookings"),
      category: "forecast",
    },
  ];

  const handleRunQuery = (queryText: string) => {
    if (!queryText.trim()) return;
    setPrompt(queryText);
    setIsGenerating(true);
    setAiInsight(null);

    setTimeout(() => {
      setIsGenerating(false);
      setAiInsight(
        `AI Insight generated for "${queryText}": Total revenue increased by 24.8% YoY driven by Algiers and Oran Wilayas. Enterprise plan adoption expanded by +18% with an average order value of 450,000 DZD.`,
      );
      toast.success(t("copilot.queryExecSuccess"));
    }, 1200);
  };

  return (
    <div className="w-full mb-6 rounded-3xl p-5 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/90 border border-blue-200/60 dark:border-blue-800/40 backdrop-blur-xl shadow-lg transition-all text-start">
      {/* Header Badge & Title */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {t("copilot.title")}
              <PodaciumBadge variant="gradient">
                {t("copilot.versionBadge")}
              </PodaciumBadge>
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("copilot.subtitle")}
            </p>
          </div>
        </div>

        <PodaciumButton
          variant="secondary"
          size="sm"
          onClick={() =>
            handleRunQuery("Summarize executive business performance metrics")
          }
          className="text-xs"
        >
          <Sparkles className="w-3.5 h-3.5 me-1 text-blue-500" />
          {t("copilot.autoInsights")}
        </PodaciumButton>
      </div>

      {/* Input Search Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRunQuery(prompt);
        }}
        className="relative flex items-center mb-3"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("copilot.placeholder")}
          className="w-full py-3 ps-4 pe-28 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
        />
        <div className="absolute end-1.5 flex items-center gap-1">
          <PodaciumButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={isGenerating || !prompt.trim()}
            className="rounded-xl"
          >
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin me-1" />
            ) : (
              <ArrowRight className="w-4 h-4 me-1 rtl:rotate-180" />
            )}
            {isGenerating ? t("copilot.analyzing") : t("copilot.ask")}
          </PodaciumButton>
        </div>
      </form>

      {/* Quick Prompt Suggestions */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500 dark:text-slate-400 font-medium me-1 flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />{" "}
          {t("copilot.suggestions")}
        </span>
        {sampleSuggestions.map((item) => (
          <button
            key={item.id}
            onClick={() => handleRunQuery(item.query)}
            className="px-3 py-1 rounded-xl bg-white/60 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-gray-200/80 dark:border-slate-700/60 text-gray-700 dark:text-slate-300 transition-all font-medium hover:text-blue-600 dark:hover:text-blue-400"
          >
            {item.query}
          </button>
        ))}
      </div>

      {/* Generated AI Insight Callout */}
      {aiInsight && (
        <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {t("copilot.narrativeTitle")}
              </span>
              <p className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed">
                {aiInsight}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
