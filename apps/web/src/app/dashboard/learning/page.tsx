"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  ChevronRight,
  BookOpen,
  BarChart3,
  Clock,
  Award,
  TrendingUp,
  Brain,
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Zap,
  PieChart,
  Layout,
  Briefcase,
  Building2,
  DollarSign,
  GraduationCap,
} from "lucide-react";

import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { SPRING, STAGGER, fadeInUp } from "@/lib/animation-presets";
import { cn } from "@/lib/utils";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RoleGuard } from "@/components/dashboard/RoleGuard";

interface LearningStats {
  coursesInProgress: number;
  completedCourses: number;
  totalHours: number;
  avgQuizScore: number;
  certificates: number;
}

interface CourseProgress {
  id: string;
  title: string;
  progress: number;
  lastActivity: string;
  status: "in_progress" | "completed" | "not_started";
}

interface QuizTrend {
  id: string;
  courseTitle: string;
  score: number;
  date: string;
}

interface LearningData {
  stats: LearningStats;
  courses: CourseProgress[];
  quizTrends: QuizTrend[];
}

function StatCardSkeleton() {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-slate-800/90" />
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-slate-800/90" />
      </div>
      <div className="h-8 w-24 rounded bg-gray-200 dark:bg-slate-800/90 mb-2" />
      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-slate-800/90" />
    </div>
  );
}

export default function LearningDashboardPage() {
  const { user } = useAuth();
  const t = useTranslations("user");
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const statCards = [
    {
      key: "coursesInProgress",
      icon: BookOpen,
      gradient: "from-blue-500 to-blue-600",
      label: t("dashboard.learning.stats.coursesInProgress"),
    },
    {
      key: "completedCourses",
      icon: CheckCircle,
      gradient: "from-emerald-500 to-emerald-600",
      label: t("dashboard.learning.stats.completedCourses"),
    },
    {
      key: "totalHours",
      icon: Clock,
      gradient: "from-violet-500 to-violet-600",
      label: t("dashboard.learning.stats.totalHours"),
    },
    {
      key: "avgQuizScore",
      icon: Brain,
      gradient: "from-amber-500 to-amber-600",
      label: t("dashboard.learning.stats.avgQuizScore"),
    },
    {
      key: "certificates",
      icon: Award,
      gradient: "from-rose-500 to-rose-600",
      label: t("dashboard.learning.stats.certificates"),
    },
  ];

  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      setError(null);
      setRefreshing(true);
      const [learningRes, progressRes, quizRes] = await Promise.all([
        api.get<any>("/api/v1/dashboard/learning"),
        api.get<any>("/api/v1/dashboard/learning/progress"),
        api
          .get<any>("/api/v1/dashboard/learning/quiz-performance")
          .catch(() => []),
      ]);

      const statsObj = learningRes?.stats || learningRes || {};
      const rawCourses = Array.isArray(progressRes)
        ? progressRes
        : progressRes?.courses || [];
      const coursesList: CourseProgress[] = rawCourses.map((c: any) => ({
        id: String(c.id || c.course_id || ""),
        title: c.title || c.course_title || "Course",
        progress: typeof c.progress === "number" ? c.progress : 0,
        lastActivity:
          c.lastActivity ||
          (c.completed_at
            ? new Date(c.completed_at).toLocaleDateString()
            : c.last_activity || ""),
        status:
          c.status ||
          (c.progress >= 100 || c.completed_at
            ? "completed"
            : c.progress > 0
              ? "in_progress"
              : "not_started"),
      }));

      const rawQuiz = Array.isArray(quizRes)
        ? quizRes
        : Array.isArray(progressRes?.quizTrends)
          ? progressRes.quizTrends
          : Array.isArray(learningRes?.quizTrends)
            ? learningRes.quizTrends
            : [];
      const quizTrendsList: QuizTrend[] = rawQuiz.map((q: any) => ({
        id: String(q.quiz_id || q.id || ""),
        courseTitle: q.quiz_title || q.courseTitle || "Quiz",
        score: Math.round(Number(q.score) || 0),
        date: q.completed_at
          ? new Date(q.completed_at).toLocaleDateString()
          : q.date || "",
      }));

      setData({
        stats: {
          coursesInProgress:
            statsObj.coursesInProgress ?? statsObj.courses_in_progress ?? 0,
          completedCourses:
            statsObj.completedCourses ?? statsObj.completed_courses ?? 0,
          totalHours: statsObj.totalHours ?? statsObj.total_learning_hours ?? 0,
          avgQuizScore:
            statsObj.avgQuizScore ?? statsObj.average_quiz_score ?? 0,
          certificates:
            statsObj.certificates ?? statsObj.certificates_earned ?? 0,
        },
        courses: coursesList,
        quizTrends: quizTrendsList,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("dashboard.learning.error.title"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="h-4 w-48 rounded bg-gray-200 dark:bg-slate-800/90 mb-10 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/60 mb-6">
              <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {t("dashboard.learning.error.title")}
            </h2>
            <p className="text-gray-500 dark:text-slate-400 mb-8 text-center max-w-md">
              {error}
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.learning.error.retry")}
            </motion.button>
          </motion.div>
        </main>
      </div>
    );
  }

  if (!data) return <div />;

  const statValue = (key: string) => {
    if (!data?.stats) return "0";
    const v = data.stats[key as keyof LearningStats] ?? 0;
    if (key === "totalHours") return `${v}h`;
    if (key === "avgQuizScore") return `${v}%`;
    return v;
  };

  return (
    <RoleGuard
      allowedRoles={[
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "ADMIN",
        "MODERATOR",
      ]}
    >
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.nav
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-8"
          >
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              <span>{t("dashboard.breadcrumb.home")}</span>
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href="/dashboard"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("dashboard.breadcrumb.dashboard")}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-slate-100 font-medium">
              {t("dashboard.learning.breadcrumb")}
            </span>
          </motion.nav>

          <DashboardTabs />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100"
              >
                {t("dashboard.learning.title")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-gray-500 dark:text-slate-400 mt-1"
              >
                {t("dashboard.learning.description")}
              </motion.p>
            </div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50 self-start"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {t("dashboard.learning.refresh")}
            </motion.button>
          </div>

          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              animate: { transition: { staggerChildren: STAGGER.FAST } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10"
          >
            {statCards.map(({ key, icon: Icon, gradient, label }) => (
              <motion.div
                key={key}
                variants={fadeInUp}
                transition={SPRING.GENTLE}
                className="relative group"
              >
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                    {statValue(key)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {label}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ...SPRING.GENTLE }}
              className="lg:col-span-2"
            >
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {t("dashboard.learning.courseProgress.title")}
                    </h2>
                  </div>
                  <span className="text-sm text-gray-400">
                    {t("dashboard.learning.courseProgress.courses", {
                      count: String((data.courses || []).length),
                    })}
                  </span>
                </div>
                <div className="p-6">
                  {(data.courses || []).length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">
                        {t("dashboard.learning.courseProgress.empty")}
                      </p>
                      <Link
                        href="/courses"
                        className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                      >
                        {t("dashboard.learning.courseProgress.browseCourses")}
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {(data.courses || []).map((course, i) => (
                        <motion.div
                          key={course.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg flex-shrink-0 ${
                                  course.status === "completed"
                                    ? "bg-emerald-50"
                                    : "bg-blue-50"
                                }`}
                              >
                                {course.status === "completed" ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                                  {course.title}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {t(
                                    "dashboard.learning.courseProgress.lastActivity",
                                    { date: course.lastActivity },
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 ml-4 flex-shrink-0">
                              {course.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${course.progress}%` }}
                              transition={{
                                duration: 0.8,
                                ease: "easeOut",
                                delay: i * 0.05,
                              }}
                              className={`h-full rounded-full ${
                                course.status === "completed"
                                  ? "bg-emerald-500"
                                  : "bg-blue-500"
                              }`}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, ...SPRING.GENTLE }}
            >
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {t("dashboard.learning.quizPerformance.title")}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  {(data.quizTrends || []).length === 0 ? (
                    <div className="text-center py-12">
                      <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">
                        {t("dashboard.learning.quizPerformance.empty")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t("dashboard.learning.quizPerformance.emptyHint")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(data.quizTrends || []).map((quiz, i) => (
                        <motion.div
                          key={quiz.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate mr-2">
                              {quiz.courseTitle}
                            </p>
                            <span
                              className={`text-sm font-bold flex-shrink-0 ${
                                quiz.score >= 80
                                  ? "text-emerald-600"
                                  : quiz.score >= 60
                                    ? "text-amber-600"
                                    : "text-red-500"
                              }`}
                            >
                              {quiz.score}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${quiz.score}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className={`h-full rounded-full ${
                                quiz.score >= 80
                                  ? "bg-emerald-500"
                                  : quiz.score >= 60
                                    ? "bg-amber-500"
                                    : "bg-red-400"
                              }`}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {quiz.date}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...SPRING.GENTLE }}
                className="mt-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {t("dashboard.learning.quickActions.title")}
                  </h2>
                </div>
                <div className="space-y-2">
                  <Link
                    href="/courses"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors">
                      <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">
                      {t("dashboard.learning.quickActions.browseCourses")}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 ms-auto group-hover:text-blue-600 dark:group-hover:text-blue-400 ${isRTL ? "rotate-180" : ""}`}
                    />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 transition-colors">
                      <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">
                      {t("dashboard.learning.quickActions.mainDashboard")}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 ms-auto group-hover:text-blue-600 dark:group-hover:text-blue-400 ${isRTL ? "rotate-180" : ""}`}
                    />
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
