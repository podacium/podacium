"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Users,
  GraduationCap,
  DollarSign,
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load recharts — keeps it out of the initial JS bundle
const AdminLineBarChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      function Charts({
        userGrowth,
        enrollmentTrends,
        revenue,
      }: {
        userGrowth: any[];
        enrollmentTrends: any[];
        revenue: any[];
      }) {
        const t = useTranslations();
        const {
          LineChart,
          Line,
          BarChart,
          Bar,
          XAxis,
          YAxis,
          CartesianGrid,
          Tooltip,
          ResponsiveContainer,
        } = recharts;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
                {t("admin.analytics.userGrowth")}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={userGrowth}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(156, 163, 175, 0.2)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(51, 65, 85, 0.5)",
                      borderRadius: "0.75rem",
                      color: "#F8FAFC",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
                {t("admin.analytics.enrollmentTrends")}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={enrollmentTrends}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(156, 163, 175, 0.2)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(51, 65, 85, 0.5)",
                      borderRadius: "0.75rem",
                      color: "#F8FAFC",
                    }}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
                {t("admin.analytics.revenue")}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenue}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(156, 163, 175, 0.2)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(51, 65, 85, 0.5)",
                      borderRadius: "0.75rem",
                      color: "#F8FAFC",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }
      return { default: Charts };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6 h-[280px] animate-pulse ${i === 3 ? "lg:col-span-2" : ""}`}
          >
            <div className="h-4 w-24 bg-gray-200 dark:bg-slate-800/90 rounded mb-4" />
            <div className="h-[220px] bg-gray-100 dark:bg-slate-800 rounded-lg" />
          </div>
        ))}
      </div>
    ),
  },
);

interface AnalyticsData {
  period: string;
  user_growth: { date: string; count: number }[];
  enrollment_trends: { date: string; count: number }[];
  revenue: { date: string; amount: number }[];
  top_modules: { id: string; title: string; enrollments: number }[];
  completion_rate: number;
  totals: { new_users: number; new_enrollments: number; revenue: number };
}

export default function AdminAnalyticsPage() {
  const t = useTranslations();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<AnalyticsData>(`/api/admin/analytics?period=${period}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const periods = [
    { value: "7d", label: t("admin.analytics.last7days") },
    { value: "30d", label: t("admin.analytics.last30days") },
    { value: "90d", label: t("admin.analytics.last90days") },
    { value: "12m", label: t("admin.analytics.last12months") },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            {t("admin.analytics.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.analytics.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.value ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-lg">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("admin.analytics.newUsers")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {data?.totals.new_users || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-emerald-950/60 rounded-lg">
              <GraduationCap
                size={20}
                className="text-green-600 dark:text-emerald-400"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("admin.analytics.newEnrollments")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {data?.totals.new_enrollments || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 rounded-lg">
              <DollarSign
                size={20}
                className="text-purple-600 dark:text-purple-400"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("admin.analytics.revenue")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {(data?.totals.revenue || 0).toLocaleString()} DZD
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 dark:bg-amber-950/60 rounded-lg">
              <TrendingUp
                size={20}
                className="text-orange-600 dark:text-amber-400"
              />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("admin.analytics.completionRate")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {data?.completion_rate || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts — lazy-loaded to keep recharts out of the initial bundle */}
      <AdminLineBarChart
        userGrowth={data?.user_growth || []}
        enrollmentTrends={data?.enrollment_trends || []}
        revenue={data?.revenue || []}
      />
    </div>
  );
}
