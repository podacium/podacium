"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion } from "framer-motion";
import { ErrorBoundary } from "react-error-boundary";
import {
  Users,
  Building2,
  Route,
  BookOpen,
  FileText,
  HelpCircle,
  TrendingUp,
  Award,
  DollarSign,
  GraduationCap,
  Plus,
  ArrowUpRight,
  Loader2,
  BarChart3,
  BookMarked,
  UserPlus,
  CreditCard,
} from "lucide-react";
import dynamic from "next/dynamic";
import PodaciumCard from "@/components/design-system/PodaciumCard";

// Lazy-load recharts — keeps it out of the initial JS bundle (~500 KB saved)
const AdminAreaChart = dynamic(
  () =>
    import("recharts").then((recharts) => {
      function Chart({ data, dir }: { data: any[]; dir: "ltr" | "rtl" }) {
        const { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } =
          recharts;
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide reversed={dir === "rtl"} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#adminGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
    ),
  },
);

interface DashboardStats {
  total_users: number;
  active_users: number;
  total_organizations: number;
  total_paths: number;
  total_modules: number;
  published_modules: number;
  total_lessons: number;
  total_quizzes: number;
  total_enrollments: number;
  total_revenue: number;
  new_users_this_month: number;
  new_enrollments_this_month: number;
}

const statCards = [
  {
    key: "totalUsers",
    icon: Users,
    color: "from-blue-500 to-blue-600",
    field: "total_users",
  },
  {
    key: "activeUsers",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-600",
    field: "active_users",
  },
  {
    key: "totalModules",
    icon: BookOpen,
    color: "from-violet-500 to-violet-600",
    field: "total_modules",
  },
  {
    key: "totalEnrollments",
    icon: GraduationCap,
    color: "from-amber-500 to-amber-600",
    field: "total_enrollments",
  },
  {
    key: "totalPaths",
    icon: Route,
    color: "from-rose-500 to-rose-600",
    field: "total_paths",
  },
  {
    key: "totalLessons",
    icon: FileText,
    color: "from-cyan-500 to-cyan-600",
    field: "total_lessons",
  },
  {
    key: "totalQuizzes",
    icon: HelpCircle,
    color: "from-orange-500 to-orange-600",
    field: "total_quizzes",
  },
  {
    key: "totalOrganizations",
    icon: Building2,
    color: "from-indigo-500 to-indigo-600",
    field: "total_organizations",
  },
  {
    key: "totalRevenue",
    icon: DollarSign,
    color: "from-green-500 to-green-600",
    field: "total_revenue",
    format: "currency",
  },
  {
    key: "newUsersThisMonth",
    icon: Users,
    color: "from-sky-500 to-sky-600",
    field: "new_users_this_month",
  },
  {
    key: "newEnrollmentsThisMonth",
    icon: BookMarked,
    color: "from-purple-500 to-purple-600",
    field: "new_enrollments_this_month",
  },
  {
    key: "publishedModules",
    icon: Award,
    color: "from-teal-500 to-teal-600",
    field: "published_modules",
  },
];

const quickActions = [
  {
    key: "createCourse",
    icon: Plus,
    href: "/admin/courses/new",
    color:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-100/60 dark:border-blue-900/40",
  },
  {
    key: "createPath",
    icon: Route,
    href: "/admin/paths",
    color:
      "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-100/60 dark:border-violet-900/40",
  },
  {
    key: "manageUsers",
    icon: Users,
    href: "/admin/users",
    color:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-100/60 dark:border-emerald-900/40",
  },
];

function AdminDashboardPageInner() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsData, analytics, activity] = await Promise.all([
          api.get<DashboardStats>(ENDPOINTS.ADMIN.DASHBOARD),
          api.get<any>("/api/admin/analytics?period=7d").catch(() => null),
          api
            .get<any>("/api/admin/activity-log?page=1&page_size=8")
            .catch(() => ({ data: [] })),
        ]);
        setStats(statsData);
        setChartData(analytics);
        setRecentActivity(activity?.data || []);
      } catch (err) {
        console.error("Failed to load dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const formatValue = (value: number, format?: string) => {
    if (format === "currency") {
      const currencySymbol =
        t("admin.settings.subscriptions.currency") || "DZD";
      return `${value.toLocaleString()} ${currencySymbol}`;
    }
    return value.toLocaleString();
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
          {t("admin.dashboard.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {t("admin.dashboard.subtitle")}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              const value = stats ? (stats as any)[card.field] || 0 : 0;
              return (
                <PodaciumCard
                  key={card.key}
                  variant="default"
                  padding="none"
                  hover
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="p-5 rounded-2xl border-gray-100 dark:border-slate-800 shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        {t(`admin.dashboard.${card.key}`)}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-2">
                        {formatValue(value, card.format)}
                      </p>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md group-hover:scale-110 transition-transform`}
                    >
                      <Icon size={20} />
                    </div>
                  </div>
                </PodaciumCard>
              );
            })}
          </div>

          {/* Quick Actions */}
          <PodaciumCard
            variant="default"
            padding="md"
            transition={{ delay: 0.3 }}
            className="rounded-2xl border-gray-100 dark:border-slate-800 shadow-sm mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.dashboard.quickActions")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.key}
                    href={action.href}
                    className={`${action.color} rounded-xl p-4 flex items-center gap-3 transition-all group`}
                  >
                    <Icon size={20} />
                    <span className="font-medium text-sm">
                      {t(`admin.dashboard.${action.key}`)}
                    </span>
                    <ArrowUpRight
                      size={16}
                      className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} opacity-0 group-hover:opacity-100 transition-opacity`}
                    />
                  </Link>
                );
              })}
            </div>
          </PodaciumCard>

          {/* Charts + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mini Chart */}
            <PodaciumCard
              variant="default"
              padding="md"
              transition={{ delay: 0.4 }}
              className="lg:col-span-2 rounded-2xl border-gray-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t("admin.dashboard.userGrowth7d")}
                </h2>
                <Link
                  href="/admin/analytics"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                >
                  {t("admin.dashboard.viewReports")} <ArrowUpRight size={14} />
                </Link>
              </div>
              <AdminAreaChart data={chartData?.user_growth || []} dir={dir} />
            </PodaciumCard>

            {/* Recent Activity */}
            <PodaciumCard
              variant="default"
              padding="md"
              transition={{ delay: 0.5 }}
              className="rounded-2xl border-gray-100 dark:border-slate-800 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                {t("admin.dashboard.recentActivity")}
              </h2>
              <div className="space-y-3">
                {recentActivity.slice(0, 6).map((a, i) => {
                  const icons: Record<string, any> = {
                    USER_REGISTERED: UserPlus,
                    ENROLLMENT: GraduationCap,
                    TRANSACTION: CreditCard,
                  };
                  const colors: Record<string, string> = {
                    USER_REGISTERED: "text-blue-500",
                    ENROLLMENT: "text-green-500",
                    TRANSACTION: "text-purple-500",
                  };
                  const Icon = icons[a.type] || UserPlus;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Icon
                        size={16}
                        className={colors[a.type] || "text-gray-400"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-slate-100 truncate">
                          {a.actor}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {a.detail}
                        </p>
                      </div>
                      <time className="text-xs text-gray-400">
                        {new Date(a.timestamp).toLocaleDateString()}
                      </time>
                    </div>
                  );
                })}
                {recentActivity.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {t("admin.common.noResults")}
                  </p>
                )}
              </div>
            </PodaciumCard>
          </div>
        </>
      )}
    </div>
  );
}

function AdminDashboardErrorFallback() {
  const t = useTranslations("admin");
  return (
    <div className="p-8 text-center text-red-600 dark:text-red-400">
      {t("dashboardLoadFailed")}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ErrorBoundary fallback={<AdminDashboardErrorFallback />}>
      <AdminDashboardPageInner />
    </ErrorBoundary>
  );
}
