"use client";

import {
  Activity,
  Table,
  Layers,
  BarChart2,
  ShieldCheck,
  History,
} from "lucide-react";
import { TabId } from "./types";

export function DatasetTabsNav({
  activeTab,
  onTabChange,
  t,
  qualityIssueCount = 0,
  insightCount = 0,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  t: (key: string, params?: any) => string;
  qualityIssueCount?: number;
  insightCount?: number;
}) {
  const tabs: {
    id: TabId;
    labelKey: string;
    defaultLabel: string;
    icon: any;
    badge?: number;
  }[] = [
    {
      id: "overview",
      labelKey: "bi.datasets.detail.tabs.overview.title",
      defaultLabel: "Overview",
      icon: Activity,
    },
    {
      id: "data",
      labelKey: "bi.datasets.detail.tabs.data.title",
      defaultLabel: "Data & Schema",
      icon: Table,
    },
    {
      id: "quality",
      labelKey: "bi.datasets.detail.tabs.quality.title",
      defaultLabel: "Quality & Governance",
      icon: ShieldCheck,
      badge: qualityIssueCount,
    },
    {
      id: "analytics",
      labelKey: "bi.datasets.detail.tabs.analytics.title",
      defaultLabel: "Analytics & Query",
      icon: BarChart2,
      badge: insightCount,
    },
    {
      id: "settings",
      labelKey: "bi.datasets.detail.tabs.settings.title",
      defaultLabel: "Security & Settings",
      icon: Layers,
    },
  ];

  return (
    <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-indigo-500/5 overflow-x-auto no-scrollbar">
      <nav className="flex items-center gap-1.5 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const translated = t(tab.labelKey);
          const label =
            translated && translated !== tab.labelKey
              ? translated
              : tab.defaultLabel;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 select-none relative ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/10"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`}
              />
              <span>{label}</span>
              {!!tab.badge && tab.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
