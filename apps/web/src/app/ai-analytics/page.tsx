"use client";

import React from "react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionComponents";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  Brain,
  TrendingUp,
  BarChart3,
  Sparkles,
  Target,
  Activity,
  Cpu,
  Zap,
  Clock,
  CheckCircle,
  Lightbulb,
  GraduationCap,
  Briefcase,
  BookOpen,
} from "lucide-react";

const statCards = [
  { key: "modelsActive", icon: Cpu, color: "text-blue-600", bg: "bg-blue-100" },
  {
    key: "queriesProcessed",
    icon: Activity,
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    key: "avgResponseTime",
    icon: Clock,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
  {
    key: "accuracy",
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
];

const insightCards = [
  {
    key: "personalized",
    icon: Lightbulb,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "progress",
    icon: TrendingUp,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  { key: "skills", icon: Target, color: "text-purple-600", bg: "bg-purple-50" },
  {
    key: "career",
    icon: Briefcase,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export default function AiAnalyticsPage() {
  const t = useTranslations();
  const { dir } = useBidi();

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title={t("meta.aiAnalytics.page.title")}
            subtitle={t("meta.aiAnalytics.page.description")}
            icon={<Brain className="h-6 w-6" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map(({ key, icon: Icon, color, bg }) => (
              <PodaciumCard key={key} className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${bg}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      {t(`meta.aiAnalytics.page.stats.${key}`)}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                      {t(`meta.aiAnalytics.page.stats.${key}Value`)}
                    </p>
                  </div>
                </div>
              </PodaciumCard>
            ))}
          </div>

          <SectionCard
            title={t("meta.aiAnalytics.page.insights.title")}
            className="mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insightCards.map(({ key, icon: Icon, color, bg }) => (
                <div
                  key={key}
                  className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className={`p-3 rounded-xl ${bg} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                      {t(`meta.aiAnalytics.page.insights.${key}.title`)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                      {t(`meta.aiAnalytics.page.insights.${key}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border border-blue-100 dark:border-blue-900/50 text-center">
            <Sparkles className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("meta.aiAnalytics.page.comingSoon.title")}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t("meta.aiAnalytics.page.comingSoon.description")}
            </p>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
