// components/course/AnalyticsDashboard.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Award,
  Calendar,
  Activity,
  Zap,
  Brain,
  Target as TargetIcon,
  TrendingUp as TrendingUpIcon,
  Clock as ClockIcon,
  Award as AwardIcon,
  BarChart as BarChartIcon,
  LineChart,
  PieChart,
  Radar,
} from "lucide-react";
import { LessonResponse, LessonProgressResponse } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface AnalyticsDashboardProps {
  courseId: string;
  userId?: number;
  lessons: LessonResponse[];
  progress: Record<string, LessonProgressResponse>;
}

interface LearningStats {
  totalTimeSpent: number;
  averageScore: number;
  completionRate: number;
  engagementScore: number;
  lastActive: string;
}

interface ActivityChart {
  date: string;
  lessonsCompleted: number;
  timeSpent: number;
  quizScore?: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  courseId,
  userId,
  lessons,
  progress,
}) => {
  const [stats, setStats] = useState<LearningStats>({
    totalTimeSpent: 0,
    averageScore: 0,
    completionRate: 0,
    engagementScore: 0,
    lastActive: new Date().toISOString(),
  });

  const [activityData, setActivityData] = useState<ActivityChart[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations();

  useEffect(() => {
    const calculateStats = () => {
      // Calculate completion rate
      const completedLessons = Object.values(progress).filter(
        (p) => p.isCompleted,
      ).length;
      const completionRate =
        lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;

      // Calculate total time spent (estimated)
      const totalTimeSpent = lessons.reduce((total, lesson) => {
        const lessonProgress = progress[lesson.id];
        if (lessonProgress && lessonProgress.progress > 0) {
          return (
            total +
            (lesson.durationMinutes || 0) * (lessonProgress.progress / 100)
          );
        }
        return total;
      }, 0);

      // Calculate engagement score (0-100)
      const engagementScore = Math.min(
        completionRate +
          (totalTimeSpent / (lessons.length * 60)) * 10 + // Time factor
          (Object.keys(progress).length / lessons.length) * 30, // Interaction factor
        100,
      );

      setStats({
        totalTimeSpent,
        averageScore: 85, // Mock average score
        completionRate,
        engagementScore,
        lastActive: new Date().toISOString(),
      });

      // Generate mock activity data
      const generateActivityData = () => {
        const data: ActivityChart[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);

          data.push({
            date: date.toLocaleDateString("en-US", { weekday: "short" }),
            lessonsCompleted: Math.floor(Math.random() * 3),
            timeSpent: Math.floor(Math.random() * 120),
            quizScore: Math.floor(Math.random() * 30) + 70,
          });
        }

        return data;
      };

      setActivityData(generateActivityData());
      setLoading(false);
    };

    calculateStats();
  }, [lessons, progress]);

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-gray-200 dark:bg-slate-800/90 rounded-xl"
            ></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t("compcourse.analytics.title")}
          </h3>
          <p className="text-gray-600 dark:text-slate-400">
            {t("compcourse.analytics.subtitle")}
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          {t("compcourse.analytics.updated")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDE — Lesson Progress (spans 2 columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-4">
              {t("compcourse.analytics.lessonProgress")}
            </h4>
            <div className="space-y-4">
              {lessons.map((lesson) => {
                const lessonProgress = progress[lesson.id];
                const progressPercent =
                  Math.round(lessonProgress?.progress) || 0;
                const isCompleted = lessonProgress?.isCompleted || false;

                return (
                  <div key={lesson.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {lesson.title}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          isCompleted
                            ? "bg-gradient-to-r from-green-500 to-emerald-500"
                            : "bg-gradient-to-r from-blue-500 to-indigo-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — Stats stacked vertically */}
        <div className="space-y-4">
          {/* Total Time Spent */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-blue-200 dark:border-blue-800/80 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {formatTime(stats.totalTimeSpent)}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("compcourse.analytics.timeSpent")}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              {lessons.length} {t("compcourse.analytics.units.lessons")} •{" "}
              {Object.keys(progress).length}{" "}
              {t("compcourse.analytics.units.inProgress")}
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-emerald-800/80 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-emerald-950/60 flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {stats.completionRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("compcourse.analytics.completion")}
                </div>
              </div>
            </div>
            <div className="h-2 bg-green-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          {/* Engagement Score */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-xl border border-purple-200 dark:border-purple-800/80 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {stats.engagementScore.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("compcourse.analytics.engagement")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 p-6">
        <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-4">
          {t("compcourse.analytics.personalizedRecommendations")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200 dark:border-blue-800/80">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3">
                <TargetIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-slate-100">
                  {t("compcourse.analytics.recommendations.focusAreas")}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("compcourse.analytics.recommendations.focusAreasSubtitle")}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t("compcourse.analytics.recommendations.focusAreasDescription")}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200 dark:border-blue-800/80">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3">
                <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-slate-100">
                  {t("compcourse.analytics.recommendations.studySchedule")}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t(
                    "compcourse.analytics.recommendations.studyScheduleSubtitle",
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t(
                "compcourse.analytics.recommendations.studyScheduleDescription",
              )}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200 dark:border-blue-800/80">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3">
                <TrendingUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-slate-100">
                  {t("compcourse.analytics.recommendations.nextSteps")}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("compcourse.analytics.recommendations.nextStepsSubtitle")}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t("compcourse.analytics.recommendations.nextStepsDescription")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
