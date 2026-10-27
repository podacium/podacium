"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  ChevronRight,
  GraduationCap,
  Users,
  DollarSign,
  Star,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RoleGuard } from "@/components/dashboard/RoleGuard";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  StatCard,
  SectionCard,
  LoadingState,
  EmptyState,
} from "@/components/SectionComponents";

const PIE_COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#8B5CF6", // purple-500
  "#F59E0B", // amber-500
  "#EC4899", // pink-500
  "#06B6D4", // cyan-500
  "#F97316", // orange-500
  "#6366F1", // indigo-500
];

interface RevenueByCourse {
  course_id: string;
  title: string;
  revenue: number;
  enrollments: number;
}

interface RevenueByMonth {
  month: string;
  revenue: number;
}

interface RevenueData {
  total: number;
  by_course: RevenueByCourse[];
  by_month: RevenueByMonth[];
}

interface WalletData {
  id: number;
  balance: number;
  currency: string;
  is_frozen: boolean;
}

interface TeachingStats {
  totalCourses: number;
  totalStudents: number;
  totalRevenue: number;
  avgRating: number;
  totalReviews: number;
  studentEngagement?: {
    completionRate: number;
    avgTimeSpent: number;
    activeStudents: number;
  };
}

interface Review {
  id: number;
  courseTitle: string;
  studentName: string;
  rating: number;
  comment: string;
  date: string;
}

interface TeachingData {
  stats: TeachingStats;
  recentReviews: Review[];
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-800/90" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-16 bg-gray-200 dark:bg-slate-800/90 rounded" />
              <div className="h-4 w-24 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 p-6"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-gray-200 dark:bg-slate-800/90 rounded" />
              <div className="h-4 w-32 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-4 w-20 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
          <div className="h-4 w-full bg-gray-100 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function TeachingDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const t = useTranslations("user");
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const [data, setData] = useState<TeachingData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, reviewsResult, revenueResult, walletResult] =
        await Promise.all([
          api.get<any>("/api/v1/dashboard/teaching").catch(() => ({})),
          api.get<any>("/api/v1/dashboard/teaching/reviews").catch(() => []),
          api.get<any>("/api/v1/dashboard/teaching/revenue").catch(() => ({
            total: 0,
            by_course: [],
            by_month: [],
          })),
          api.get<any>("/api/v1/wallets/me").catch(() => null),
        ]);

      setRevenueData(revenueResult);
      setWalletData(walletResult);

      const statsObj = statsResult?.stats || statsResult || {};
      const rawReviews = Array.isArray(reviewsResult)
        ? reviewsResult
        : reviewsResult?.reviews || [];
      const reviewsList: Review[] = rawReviews.map((r: any) => ({
        id: r.id,
        courseTitle:
          r.courseTitle || r.module_title || r.course_title || "Course",
        studentName:
          r.studentName || r.user_name || r.student_name || "Student",
        rating: typeof r.rating === "number" ? r.rating : 0,
        comment: r.comment || "",
        date: r.date || r.created_at || new Date().toISOString(),
      }));

      const avgRating =
        statsObj.avgRating ??
        statsObj.avg_rating ??
        statsObj.average_rating ??
        0;

      const engagement =
        statsObj.studentEngagement || statsObj.student_engagement;
      const studentEngagement = engagement
        ? {
            completionRate:
              engagement.completionRate ?? engagement.completion_rate ?? 0,
            avgTimeSpent:
              engagement.avgTimeSpent ?? engagement.avg_time_spent ?? 0,
            activeStudents:
              engagement.activeStudents ?? engagement.active_students ?? 0,
          }
        : undefined;

      setData({
        stats: {
          totalCourses: statsObj.totalCourses ?? statsObj.total_courses ?? 0,
          totalStudents: statsObj.totalStudents ?? statsObj.total_students ?? 0,
          totalRevenue: statsObj.totalRevenue ?? statsObj.total_revenue ?? 0,
          avgRating:
            typeof avgRating === "number" && !isNaN(avgRating) ? avgRating : 0,
          totalReviews: statsObj.totalReviews ?? statsObj.total_reviews ?? 0,
          studentEngagement,
        },
        recentReviews: reviewsList,
      });
    } catch (err: any) {
      setError(err?.message || t("dashboard.teaching.error.title"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (authLoading || loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        dir={dir}
      >
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-800/90 rounded animate-pulse" />
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-800/90 rounded animate-pulse" />
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-800/90 rounded animate-pulse" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-10 animate-pulse">
          <div className="h-10 w-64 bg-gray-200 dark:bg-slate-800/90 rounded" />
        </h1>
        <StatCardsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ReviewsSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        dir={dir}
      >
        <div className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-gray-900 dark:text-slate-100 font-medium mb-2">
            {t("dashboard.teaching.error.title")}
          </p>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
            {error}
          </p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            {t("dashboard.teaching.error.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentReviews } = data;

  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  });

  return (
    <RoleGuard allowedRoles={["INSTRUCTOR", "ADMIN"]}>
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <DashboardTabs />

          <div className="mb-8">
            <h1 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              {t("dashboard.teaching.title")}
              <GraduationCap className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </h1>
            <p className="text-lg text-gray-500 dark:text-slate-400 font-medium mt-1">
              {t("dashboard.teaching.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label={t("dashboard.teaching.stats.totalRevenue")}
              value={currency.format(revenueData?.total ?? stats.totalRevenue)}
              gradient="from-emerald-600 to-teal-400"
              delay={0.05}
            />
            <StatCard
              icon={<Wallet className="w-5 h-5" />}
              label={t("dashboard.teaching.stats.spendableBalance")}
              value={currency.format(walletData?.balance ?? 0)}
              gradient="from-blue-600 to-indigo-400"
              delay={0.1}
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label={t("dashboard.teaching.stats.totalStudents")}
              value={
                stats.studentEngagement?.activeStudents ?? stats.totalStudents
              }
              gradient="from-purple-600 to-pink-400"
              delay={0.15}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label={t("dashboard.teaching.studentEngagement.completionRate")}
              value={`${stats.studentEngagement?.completionRate ?? 0}%`}
              gradient="from-amber-500 to-orange-400"
              delay={0.2}
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              label={t("dashboard.teaching.stats.avgRating")}
              value={`${(stats.avgRating ?? 0).toFixed(1)} ★`}
              gradient="from-rose-500 to-red-400"
              delay={0.25}
            />
          </div>

          {/* Interactive Recharts Analytics: Monthly Royalties & Course Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Monthly Creator Royalties */}
            <SectionCard
              title={t("dashboard.teaching.royalties.monthlyTitle")}
              icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
            >
              {revenueData &&
              revenueData.by_month &&
              revenueData.by_month.length > 0 ? (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData.by_month}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="month"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(val) => `${val.toLocaleString()} DZD`}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          `${Number(value || 0).toLocaleString()} DZD`,
                          "Royalties",
                        ]}
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.9)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#10B981"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={<BarChart3 className="w-12 h-12 text-gray-300" />}
                  title={t("dashboard.teaching.royalties.noMonthlyData")}
                  description={t(
                    "dashboard.teaching.royalties.noMonthlyDataDesc",
                  )}
                />
              )}
            </SectionCard>

            {/* Revenue by Course */}
            <SectionCard
              title={t("dashboard.teaching.royalties.byCourseTitle")}
              icon={<PieChartIcon className="w-5 h-5 text-blue-500" />}
            >
              {revenueData &&
              revenueData.by_course &&
              revenueData.by_course.length > 0 ? (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData.by_course}
                        dataKey="revenue"
                        nameKey="title"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={4}
                      >
                        {revenueData.by_course.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [
                          `${Number(value || 0).toLocaleString()} DZD`,
                          "Revenue",
                        ]}
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.9)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={<PieChartIcon className="w-12 h-12 text-gray-300" />}
                  title={t("dashboard.teaching.royalties.noCourseData")}
                  description={t(
                    "dashboard.teaching.royalties.noCourseDataDesc",
                  )}
                />
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <SectionCard
                title={t("dashboard.teaching.recentReviews.title")}
                icon={<Star className="w-5 h-5" />}
              >
                {(recentReviews || []).length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.teaching.recentReviews.empty")}
                    description={t(
                      "dashboard.teaching.recentReviews.emptyDescription",
                    )}
                  />
                ) : (
                  <div className="space-y-4">
                    {(recentReviews || []).map((review, i) => (
                      <motion.div
                        key={review.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 hover:bg-gray-100/80 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                              {review.courseTitle}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {review.studentName}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                              {review.rating}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                          {review.comment}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(review.date).toLocaleDateString()}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="space-y-8">
              <SectionCard
                title={t("dashboard.teaching.studentEngagement.title")}
                icon={<TrendingUp className="w-5 h-5" />}
              >
                {stats.studentEngagement ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {t(
                            "dashboard.teaching.studentEngagement.completionRate",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {stats.studentEngagement.completionRate}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${stats.studentEngagement.completionRate}%`,
                          }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            {t(
                              "dashboard.teaching.studentEngagement.activeStudents",
                            )}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                            {stats.studentEngagement.activeStudents}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            {t(
                              "dashboard.teaching.studentEngagement.avgTimeSpent",
                            )}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                            {stats.studentEngagement.avgTimeSpent}h
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="w-12 h-12 text-gray-300" />}
                    title={t("dashboard.teaching.studentEngagement.empty")}
                    description={t(
                      "dashboard.teaching.studentEngagement.emptyDescription",
                    )}
                  />
                )}
              </SectionCard>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
