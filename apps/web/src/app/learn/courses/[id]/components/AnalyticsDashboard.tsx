"use client";

import React from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, TrendingUp, Target, Award, Zap } from "lucide-react";
import { LessonResponse, ModuleResponse } from "../types";
import { useTranslations } from "@/lib/i18n";

interface AnalyticsDashboardProps {
  overallProgress: number;
  userStats: any;
  lessons: LessonResponse[];
  module: ModuleResponse;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  overallProgress,
  userStats,
  lessons,
  module,
}) => {
  const t = useTranslations();

  // Real stats from backend or calculated
  const timeSpent = userStats?.totalLearningTime
    ? (userStats.totalLearningTime / 60).toFixed(1)
    : "0.0";
  const quizAverage = userStats?.averageQuizScore
    ? Math.round(userStats.averageQuizScore)
    : "0";
  const streak = userStats?.currentStreak || 0;

  // Milestones from real lessons
  const milestones = lessons.slice(0, 4).map((lesson) => ({
    label: lesson.title,
    status: lesson.isCompleted
      ? "completed"
      : lesson.isLocked
        ? "locked"
        : "in-progress",
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t("course.analytics.timeSpent")}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {timeSpent}
            </h3>
            <span className="text-gray-500 dark:text-slate-400 font-medium">
              {t("course.analytics.hours")}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-emerald-950/40 w-fit px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            <span>{t("course.analytics.weekTrend", { percentage: "0" })}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg">
              <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t("course.analytics.quizAverage")}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {quizAverage}
            </h3>
            <span className="text-gray-500 dark:text-slate-400 font-medium">
              %
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-950/60 w-fit px-2 py-0.5 rounded-full">
            <Award className="w-3 h-3" />
            <span>{t("course.analytics.rank")}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {t("course.analytics.streak")}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {streak}
            </h3>
            <span className="text-gray-500 dark:text-slate-400 font-medium">
              {t("course.analytics.days")}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm bg-purple-50 dark:bg-purple-950/60 w-fit px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            <span>{t("course.analytics.personalBest")}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {t("course.analytics.progressBreakdown")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t("course.analytics.journeyDescription")}
            </p>
          </div>
          <div className="text-end">
            <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
              {overallProgress}%
            </span>
            <p className="text-xs text-gray-400 font-semibold uppercase">
              {t("course.analytics.totalProgress")}
            </p>
          </div>
        </div>

        <div className="relative h-4 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-12">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-0 start-0 h-full bg-gradient-to-r from-blue-600 to-indigo-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 border-b pb-2">
              {t("course.analytics.skillsAcquired")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {module.skills.length > 0 ? (
                module.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-sm rounded-lg font-medium"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm italic">
                  {t("course.states.trainingOngoing")}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 border-b pb-2">
              {t("course.analytics.milestones")}
            </h4>
            <div className="space-y-3">
              {milestones.length > 0 ? (
                milestones.map((milestone, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        milestone.status === "completed"
                          ? "bg-green-500"
                          : milestone.status === "in-progress"
                            ? "bg-blue-500 animate-pulse"
                            : "bg-gray-300"
                      }`}
                    />
                    <span
                      className={`text-sm ${milestone.status === "locked" ? "text-gray-400" : "text-gray-700 dark:text-slate-300 font-medium"}`}
                    >
                      {milestone.label}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-gray-400 text-sm italic">
                  {t("course.states.noData")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
