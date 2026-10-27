"use client";

import React, { useState } from "react";
import {
  Filter,
  X,
  Calendar,
  RefreshCw,
  Bookmark,
  Sparkles,
  Clock,
  Globe,
} from "lucide-react";
import { useBiCrossFilterContext } from "@/contexts/BiCrossFilterContext";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { toast } from "sonner";

import { useTranslations } from "@/lib/i18n";

export const DashboardFilterBar: React.FC = () => {
  const t = useTranslations("bi");
  const { filters, removeFilter, clearAllFilters, setFilter } =
    useBiCrossFilterContext();
  const filterKeys = Object.keys(filters);

  const [datePreset, setDatePreset] = useState<string>("mtd");
  const [granularity, setGranularity] = useState<string>("daily");

  const handleApplyPreset = (preset: string) => {
    setDatePreset(preset);
    setFilter("dateRange", {
      field: "dateRange",
      value: preset,
      operator: "eq",
    });
    toast.success(
      t("filterBar.appliedToast", {
        preset: preset.toUpperCase(),
        defaultValue: `Date filter applied: ${preset.toUpperCase()}`,
      }),
    );
  };

  return (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 mb-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-200/60 dark:border-slate-800/80 shadow-md transition-all text-start">
      {/* Date Range & Granularity Preset Dock */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-slate-200 pe-3 border-e border-gray-200 dark:border-slate-800">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{t("filterBar.period", { defaultValue: "Period:" })}</span>
        </div>

        <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 font-medium text-[11px]">
          {["today", "7d", "mtd", "ytd", "all"].map((p) => (
            <button
              key={p}
              onClick={() => handleApplyPreset(p)}
              className={`px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all ${
                datePreset === p
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-xs"
        >
          <option value="daily">
            {t("filterBar.granularityDaily", {
              defaultValue: "Daily Granularity",
            })}
          </option>
          <option value="weekly">
            {t("filterBar.granularityWeekly", {
              defaultValue: "Weekly Granularity",
            })}
          </option>
          <option value="monthly">
            {t("filterBar.granularityMonthly", {
              defaultValue: "Monthly Granularity",
            })}
          </option>
          <option value="quarterly">
            {t("filterBar.granularityQuarterly", {
              defaultValue: "Quarterly Granularity",
            })}
          </option>
        </select>
      </div>

      {/* Active Filter Chips & Reset Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterKeys.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterKeys.map((key) => {
              const filter = filters[key];
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-xs"
                >
                  <span className="capitalize">{key}:</span>
                  <span className="font-mono">{String(filter.value)}</span>
                  <button
                    onClick={() => removeFilter(key)}
                    className="p-0.5 rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline px-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t("filterBar.resetAll", { defaultValue: "Reset All" })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
