"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Database,
  Star,
  Sparkles,
  Loader2,
  XCircle,
  Home,
  Hand,
  RefreshCw,
  User,
  Award,
  BarChart3,
  Users,
  DollarSign,
  Target,
  MapPin,
  Heart,
  Zap,
  ArrowUpRight,
  Compass,
  Layout,
  Settings,
} from "lucide-react";
import { useBidi, useTranslations, useLocale } from "@/lib/i18n";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getProgressColor,
  ROLE_THEMES,
} from "./utils";
import type { UserRoleStr } from "./utils";
import type { ViewConfig, DashboardState } from "@/lib/api/users";
import {
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import {
  ProposalsSection,
  ContractsSection,
  EarningsSection,
  JobListingsSection,
  ApplicantsSection,
  TeamSection,
  PlatformMetricsSection,
  RecentUsersSection,
  SystemAlertsSection,
  CertificatesSection,
} from "./sections";
import UniversalImage from "@/components/UniversalImage";

// ── Welcome Banner ─────────────────────────────────────────────

export function WelcomeBanner({
  userName,
  role,
}: {
  userName: string;
  role: UserRoleStr;
}) {
  const t = useTranslations("user");
  const { dir } = useBidi();
  const theme = ROLE_THEMES[role] || ROLE_THEMES.STUDENT;
  const welcomeKey =
    role === "STUDENT"
      ? "dashboard.welcome.title"
      : role === "FREELANCER"
        ? "dashboard.welcome.FREELANCER"
        : role === "BUSINESS"
          ? "dashboard.welcome.BUSINESS"
          : role === "ADMIN"
            ? "dashboard.welcome.ADMIN"
            : "dashboard.welcome.title";

  const fullTitle =
    welcomeKey === "dashboard.welcome.title"
      ? t("dashboard.welcome.title", { name: userName })
      : t(welcomeKey, { name: userName });
  const splitIdx = fullTitle.indexOf("! ");
  const greeting =
    splitIdx !== -1 ? fullTitle.slice(0, splitIdx + 1) : fullTitle;
  const prompt = splitIdx !== -1 ? fullTitle.slice(splitIdx + 2) : "";

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
      <motion.div
        initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3 flex-wrap">
          <span>{greeting}</span>
          <motion.span
            animate={{ rotate: [0, 20, 0, 20, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            className="inline-flex"
          >
            <Hand className="w-8 h-8 text-amber-500 dark:text-amber-400" />
          </motion.span>
        </h1>
        {prompt && (
          <p className="text-xl text-gray-500 dark:text-slate-400 font-medium max-w-2xl">
            {prompt}
          </p>
        )}
        {!prompt && (
          <p className="text-lg text-gray-500 dark:text-slate-400 font-medium max-w-2xl">
            {t("dashboard.welcome.subtitle")}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ── Stats Grid ─────────────────────────────────────────────────

export function DashboardStatsGrid({
  state,
  role,
}: {
  state: DashboardState;
  role: UserRoleStr;
}) {
  const t = useTranslations("user");
  const locale = useLocale();
  const stats = state.user_stats;
  const platform = state.platform_stats;

  if (role === "ADMIN" && platform) {
    const adminStats = [
      {
        label: t("dashboard.stats.platformUsers"),
        value: platform.total_users.toLocaleString(locale),
        icon: <Users className="w-6 h-6" />,
        gradient: "from-blue-600 to-indigo-400",
        delay: 0.1,
      },
      {
        label: t("dashboard.stats.revenue"),
        value: formatCurrency(platform.total_revenue, locale),
        icon: <TrendingUp className="w-6 h-6" />,
        gradient: "from-emerald-600 to-teal-400",
        delay: 0.2,
      },
      {
        label: t("dashboard.stats.activeProjects.title"),
        value: String(platform.active_projects),
        icon: <Briefcase className="w-6 h-6" />,
        gradient: "from-purple-600 to-pink-400",
        delay: 0.3,
      },
      {
        label: t("dashboard.stats.activeCourses.title"),
        value: String(platform.active_courses),
        icon: <BookOpen className="w-6 h-6" />,
        gradient: "from-amber-600 to-orange-400",
        delay: 0.4,
      },
    ];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {adminStats.map((s, i) => (
          <StatCard
            key={i}
            icon={s.icon}
            label={s.label}
            value={s.value}
            gradient={s.gradient}
            delay={s.delay}
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      <StatCard
        icon={<BookOpen className="w-6 h-6" />}
        label={t("dashboard.stats.activeCourses.title")}
        value={String(stats.total_courses)}
        description={`${stats.completed_courses} ${t("dashboard.stats.activeCourses.completed")}`}
        gradient="from-blue-600 to-blue-400"
        delay={0.1}
        href="/learn/courses"
      />
      <StatCard
        icon={<Briefcase className="w-6 h-6" />}
        label={t("dashboard.stats.activeProjects.title")}
        value={String(
          state.active_projects?.length || stats.active_projects || 0,
        )}
        description={`${stats.completed_projects} ${t("dashboard.stats.activeProjects.completed")}`}
        gradient="from-purple-600 to-pink-400"
        delay={0.2}
        href="/hub/contracts"
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6" />}
        label={t("dashboard.stats.totalEarnings.title")}
        value={formatCurrency(stats.total_earnings, locale)}
        description={t("dashboard.stats.totalEarnings.description")}
        gradient="from-emerald-600 to-teal-400"
        delay={0.3}
      />
      <StatCard
        icon={<Star className="w-6 h-6" />}
        label={t("dashboard.stats.skillLevel.title")}
        value={stats.skill_level}
        description={`${Object.keys(state.skill_breakdown || {}).length} ${t("dashboard.stats.skillLevel.skillsTracked")}`}
        gradient="from-amber-600 to-orange-400"
        delay={0.4}
      />
    </div>
  );
}

// ── Unified Executive Command Center (Quick Actions & System Links) ──

export function QuickActionsGrid({ role }: { role: UserRoleStr }) {
  const t = useTranslations("user");
  const { isRTL, dir } = useBidi();
  const [activeTab, setActiveTab] = React.useState<"actions" | "links">(
    "actions",
  );

  const actionsMap: Record<
    string,
    Array<{
      key: string;
      icon: React.ElementType;
      href: string;
      gradient: string;
    }>
  > = {
    STUDENT: [
      {
        key: "startCourse",
        icon: BookOpen,
        href: "/learn/courses",
        gradient: "from-blue-600 to-indigo-500",
      },
      {
        key: "uploadDataset",
        icon: Database,
        href: "/bi/datasets/upload",
        gradient: "from-emerald-600 to-teal-500",
      },
      {
        key: "createReport",
        icon: BarChart3,
        href: "/bi/reports",
        gradient: "from-amber-600 to-orange-500",
      },
    ],
    FREELANCER: [
      {
        key: "findProjects",
        icon: Briefcase,
        href: "/hub/projects",
        gradient: "from-purple-600 to-pink-500",
      },
      {
        key: "uploadDataset",
        icon: Database,
        href: "/bi/datasets/upload",
        gradient: "from-emerald-600 to-teal-500",
      },
      {
        key: "createReport",
        icon: BarChart3,
        href: "/bi/reports",
        gradient: "from-amber-600 to-orange-500",
      },
    ],
    BUSINESS: [
      {
        key: "postJob",
        icon: Briefcase,
        href: "/hub/projects/new",
        gradient: "from-emerald-600 to-teal-500",
      },
      {
        key: "viewAnalytics",
        icon: BarChart3,
        href: "/bi/analytics",
        gradient: "from-blue-600 to-indigo-500",
      },
      {
        key: "uploadDataset",
        icon: Database,
        href: "/bi/datasets/upload",
        gradient: "from-amber-600 to-orange-500",
      },
    ],
    ADMIN: [
      {
        key: "manageUsers",
        icon: User,
        href: "/admin/users",
        gradient: "from-blue-600 to-indigo-600",
      },
      {
        key: "viewAnalytics",
        icon: BarChart3,
        href: "/admin/analytics",
        gradient: "from-cyan-600 to-blue-500",
      },
      {
        key: "reviewReports",
        icon: Award,
        href: "/admin/content-review",
        gradient: "from-amber-600 to-orange-500",
      },
    ],
    INSTRUCTOR: [
      {
        key: "startCourse",
        icon: BookOpen,
        href: "/learn/courses",
        gradient: "from-blue-600 to-blue-400",
      },
      {
        key: "uploadDataset",
        icon: Database,
        href: "/bi/datasets/upload",
        gradient: "from-emerald-600 to-teal-400",
      },
      {
        key: "createReport",
        icon: BarChart3,
        href: "/bi/reports",
        gradient: "from-orange-600 to-amber-400",
      },
    ],
  };

  const actions = actionsMap[role] || actionsMap.STUDENT;

  const quickLinks = [
    {
      label: t("dashboard.sections.quickLinks.dashboard"),
      href: "/dashboard",
      icon: Layout,
      gradient: "from-blue-500 to-indigo-500",
    },
    {
      label: t("dashboard.sections.quickLinks.profile"),
      href: "/profile",
      icon: User,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      label: t("dashboard.sections.quickLinks.billing"),
      href: "/billing",
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      label: t("dashboard.sections.quickLinks.accountSettings"),
      href: "/settings",
      icon: Settings,
      gradient: "from-slate-600 to-slate-500",
    },
  ];

  return (
    <SectionCard
      title={t("dashboard.quickActions.title")}
      action={
        <div className="flex items-center p-0.5 rounded-xl bg-gray-100/90 dark:bg-slate-800/90 border border-gray-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab("actions")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1 ${
              activeTab === "actions"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>{t("dashboard.quickActions.title")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("links")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1 ${
              activeTab === "links"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>{t("dashboard.sections.quickLinks.title")}</span>
          </button>
        </div>
      }
    >
      <div className="w-full">
        {activeTab === "actions" ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2.5"
          >
            {actions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.key}
                  href={action.href}
                  className="group flex items-center gap-3.5 p-3 rounded-xl border border-gray-100/80 dark:border-slate-800/80 hover:border-blue-200/80 dark:hover:border-blue-800/80 bg-gray-50/50 dark:bg-slate-900/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all duration-200 shadow-xs hover:shadow-sm"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.gradient} text-white flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {t(`dashboard.quickActions.${action.key}.title`)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                      {t(`dashboard.quickActions.${action.key}.description`)}
                    </p>
                  </div>
                  <ArrowUpRight
                    className={`w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                      isRTL
                        ? "rotate-[-90deg] group-hover:-translate-x-0.5"
                        : ""
                    }`}
                  />
                </Link>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="links"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-1.5"
          >
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 transition-colors">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                  </div>
                  <span className="font-medium text-xs text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:hover:text-white">
                    {link.label}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 ms-auto group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${
                      dir === "rtl" ? "rotate-180" : ""
                    }`}
                  />
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Course Item (shared) ───────────────────────────────────────

export function CourseItem({ course }: { course: any }) {
  const { dir } = useBidi();
  const t = useTranslations("user");
  return (
    <Link href="/learn/courses">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group">
        {course.thumbnail_url ? (
          <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0 border border-gray-200/60 dark:border-slate-800/80 shadow-xs">
            <UniversalImage
              src={course.thumbnail_url}
              alt={course.title || "Course"}
              fill
              className="object-cover group-hover:scale-1.05 transition-transform"
              sizes="56px"
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-950/50 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {course.title}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <span>
              {t("dashboard.sections.learningProgress.modules", {
                completed: course.completed_modules,
                total: course.module_count,
              })}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className={getProgressColor(course.progress)}>
              {course.progress}%
            </span>
          </div>
        </div>
        <div className="w-16 h-16 relative flex-shrink-0">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${course.progress * 1.76} 176`}
              className={getProgressColor(course.progress)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-slate-300">
            {course.progress}%
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Project Item (shared) ──────────────────────────────────────

export function ProjectItem({ project }: { project: any }) {
  return (
    <Link href="/hub/projects">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/60 dark:to-pink-950/50 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-purple-600 dark:text-purple-400 transition-colors">
            {project.title}
          </h4>
          {project.client && (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {project.client}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <PodaciumBadge
            variant={
              project.status === "active"
                ? "success"
                : project.status === "completed"
                  ? "default"
                  : "warning"
            }
          >
            {project.status}
          </PodaciumBadge>
          {project.amount && (
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(project.amount)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Activity Item (shared) ─────────────────────────────────────

export function ActivityItem({ activity }: { activity: any }) {
  const iconMap: Record<
    string,
    { icon: React.ElementType; color: string; bg: string }
  > = {
    course_completed: {
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    project_started: {
      icon: Briefcase,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    certification_earned: {
      icon: Award,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    dataset_uploaded: {
      icon: Database,
      color: "text-cyan-600",
      bg: "bg-cyan-100",
    },
    payment_received: {
      icon: Star,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
  };
  const {
    icon: Icon,
    color,
    bg,
  } = iconMap[activity.type] || {
    icon: Clock,
    color: "text-gray-600 dark:text-slate-400",
    bg: "bg-gray-100 dark:bg-slate-800",
  };
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
      <div className={`p-2 rounded-lg ${bg} ${color} flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-slate-100">
          {activity.title}
        </h4>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {activity.description}
        </p>
        <span className="text-xs text-gray-400 mt-1">
          {formatRelativeTime(activity.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ── Skill Bar (shared) ─────────────────────────────────────────

export function SkillBar({ skill, level }: { skill: string; level: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300 capitalize">
          {skill}
        </span>
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {level}%
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${level}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${level >= 80 ? "bg-emerald-500" : level >= 60 ? "bg-blue-500" : level >= 40 ? "bg-amber-500" : "bg-orange-500"}`}
        />
      </div>
    </div>
  );
}

// ── Transaction Item (shared) ──────────────────────────────────

export function TransactionItem({ transaction }: { transaction: any }) {
  const isIncoming = transaction.amount > 0;
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${isIncoming ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-red-100 dark:bg-red-900/50"}`}
      >
        {isIncoming ? (
          <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-slate-100 capitalize">
          {transaction.purpose?.replace(/_/g, " ")}
        </h4>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {formatDate(transaction.createdAt)}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <span
          className={`font-semibold ${isIncoming ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {isIncoming ? "+" : "-"}
          {formatCurrency(Math.abs(transaction.amount))}
        </span>
        <PodaciumBadge
          variant={
            transaction.status === "completed"
              ? "success"
              : transaction.status === "pending"
                ? "warning"
                : "destructive"
          }
        >
          {transaction.status}
        </PodaciumBadge>
      </div>
    </div>
  );
}

// ── Recommendation Card (shared) ───────────────────────────────

const REASON_STYLES: Record<
  string,
  { gradient: string; border: string; badge: string; icon: any; label: string }
> = {
  skill_gap: {
    gradient:
      "from-amber-50/90 to-orange-50/90 dark:from-amber-950/40 dark:to-orange-950/30",
    border: "border-amber-200/80 dark:border-amber-800/40",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    icon: Target,
    label: "Skill Gap",
  },
  skill_match: {
    gradient:
      "from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/40 dark:to-teal-950/30",
    border: "border-emerald-200/80 dark:border-emerald-800/40",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: Zap,
    label: "Skill Match",
  },
  collab_filter: {
    gradient:
      "from-violet-50/90 to-purple-50/90 dark:from-violet-950/40 dark:to-purple-950/30",
    border: "border-violet-200/80 dark:border-violet-800/40",
    badge:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300",
    icon: Users,
    label: "Peer Choice",
  },
  popularity: {
    gradient:
      "from-rose-50/90 to-pink-50/90 dark:from-rose-950/40 dark:to-pink-950/30",
    border: "border-rose-200/80 dark:border-rose-800/40",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
    icon: TrendingUp,
    label: "Popular",
  },
  trending: {
    gradient:
      "from-sky-50/90 to-cyan-50/90 dark:from-sky-950/40 dark:to-cyan-950/30",
    border: "border-sky-200/80 dark:border-sky-800/40",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300",
    icon: BarChart3,
    label: "Trending",
  },
  cross_pillar: {
    gradient:
      "from-indigo-50/90 to-blue-50/90 dark:from-indigo-950/40 dark:to-blue-950/30",
    border: "border-indigo-200/80 dark:border-indigo-800/40",
    badge:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300",
    icon: RefreshCw,
    label: "Cross-Pillar",
  },
  geo_loc: {
    gradient:
      "from-teal-50/90 to-emerald-50/90 dark:from-teal-950/40 dark:to-emerald-950/30",
    border: "border-teal-200/80 dark:border-teal-800/40",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300",
    icon: MapPin,
    label: "Local",
  },
  social: {
    gradient:
      "from-fuchsia-50/90 to-pink-50/90 dark:from-fuchsia-950/40 dark:to-pink-950/30",
    border: "border-fuchsia-200/80 dark:border-fuchsia-800/40",
    badge:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-300",
    icon: Heart,
    label: "Social",
  },
  price_match: {
    gradient:
      "from-green-50/90 to-lime-50/90 dark:from-green-950/40 dark:to-lime-950/30",
    border: "border-green-200/80 dark:border-green-800/40",
    badge:
      "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300",
    icon: Award,
    label: "Best Value",
  },
  default: {
    gradient:
      "from-blue-50/90 to-indigo-50/90 dark:from-slate-900 dark:to-slate-800",
    border: "border-blue-200/80 dark:border-slate-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
    icon: Sparkles,
    label: "Recommended",
  },
};

export function RecommendationCard({
  recommendation,
  onAction,
  t,
}: {
  recommendation: any;
  onAction: () => void;
  t: (key: string, vars?: any, fallback?: string) => string;
}) {
  const rt = recommendation.reason_type || "default";
  const style = REASON_STYLES[rt] || REASON_STYLES.default;
  const Icon = style.icon;

  const translatedLabel = t(
    `dashboard.recommendations.labels.${rt}`,
    {},
    style.label,
  );
  const translatedReason = t(
    `dashboard.recommendations.reasons.${rt}`,
    {},
    recommendation.reason || style.label,
  );

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-gradient-to-br ${style.gradient} rounded-xl p-5 border ${style.border} transition-all duration-200 shadow-sm`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg ${style.badge} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {recommendation.title}
            </h4>
            {recommendation.score > 0 && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style.badge} shrink-0`}
              >
                {Math.round(recommendation.score * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {recommendation.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge} shrink-0`}
        >
          {translatedLabel}
        </span>
        <p className="text-xs text-gray-600 dark:text-slate-300 italic truncate">
          {translatedReason}
        </p>
      </div>
      <button
        onClick={onAction}
        className="w-full py-2 bg-white/90 dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-700 transition-all shadow-xs"
      >
        {t("dashboard.recommendations.common.learnMore")}
      </button>
    </motion.div>
  );
}

// ── Dataset Item (shared) ──────────────────────────────────────

export function DatasetItem({ dataset }: { dataset: any }) {
  const t = useTranslations("user");
  return (
    <Link href="/bi/datasets">
      <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/60 dark:to-teal-950/50 flex items-center justify-center flex-shrink-0">
          <Database className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:text-emerald-400 transition-colors">
            {dataset.name}
          </h4>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {dataset.size} • {dataset.record_count?.toLocaleString()}{" "}
            {t("dashboard.datasetInfo.records")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PodaciumBadge
            variant={
              dataset.processing_status === "ready" ? "success" : "warning"
            }
          >
            {dataset.processing_status}
          </PodaciumBadge>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(dataset.last_accessed)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Error State ────────────────────────────────────────────────

export function DashboardError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  const t = useTranslations("user");
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center pt-20 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 p-8 max-w-md w-full text-center"
      >
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          {t("dashboard.errors.loading.title")}
        </h2>
        <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
        <PodaciumButton onClick={onRetry} className="w-full">
          {t("dashboard.errors.loading.retry")}
        </PodaciumButton>
      </motion.div>
    </div>
  );
}

// ── Dashboard Shell ────────────────────────────────────────────

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { dir } = useBidi();
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}

// ── Revenue Overview Section Card ─────────────────────────────

export function RevenueSectionCard({ stats }: { stats?: any }) {
  const t = useTranslations("user");
  const { isRTL } = useBidi();
  const locale = useLocale();
  if (!stats) return null;

  return (
    <SectionCard
      title={t("dashboard.adminSections.revenue.title")}
      action={
        <Link
          href="/dashboard/financial"
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-1"
        >
          <span>{t("dashboard.sections.wallet.viewAll")}</span>
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            {t("dashboard.stats.revenue")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
            {formatCurrency(stats.total_revenue ?? 0, locale)}
          </p>
          {stats.revenue_growth !== undefined &&
            stats.revenue_growth !== null && (
              <span
                dir="ltr"
                className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-1 inline-block"
              >
                {stats.revenue_growth >= 0 ? "+" : ""}
                {stats.revenue_growth.toFixed(1)}%
              </span>
            )}
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            {t("dashboard.stats.transactions")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
            {stats.total_transactions?.toLocaleString() ?? 0}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20">
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
            {t("dashboard.stats.projects")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
            {stats.active_projects?.toLocaleString() ?? 0}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Section Renderer ───────────────────────────────────────────

export function SectionRenderer({
  section,
  state,
  role,
  t,
  onAction,
}: {
  section: { id: string; titleKey?: string; descriptionKey?: string };
  state: DashboardState;
  role: UserRoleStr;
  t: (key: string, vars?: any) => string;
  onAction?: (url: string) => void;
}) {
  const clickLink = (url: string) => onAction?.(url);

  switch (section.id) {
    case "learning_progress":
      return (
        <SectionCard
          title={t("dashboard.sections.learningProgress.title")}
          description={`${state.ongoing_courses?.length || 0} ${t("dashboard.pillars.education.stats.courses")}`}
          action={
            <Link
              href="/learn/courses"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {t("dashboard.sections.learningProgress.viewAll")}{" "}
              <ChevronRight className="w-4 h-4" />
            </Link>
          }
        >
          {state.ongoing_courses?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {state.ongoing_courses.slice(0, 4).map((c: any) => (
                <CourseItem key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen className="w-10 h-10" />}
              title={t("dashboard.emptyStates.courses.title")}
              description={t("dashboard.emptyStates.courses.description")}
              actionText={t("dashboard.buttons.browseCourses")}
              onAction={() => clickLink("/learn/courses")}
            />
          )}
        </SectionCard>
      );

    case "certificates":
      return <CertificatesSection count={state.certificates_earned} />;

    case "course_recommendations":
      if (!state.recommendations?.length) return null;
      return (
        <SectionCard title={t("dashboard.sections.aiInsights.title")}>
          <div className="grid grid-cols-1 gap-4">
            {state.recommendations.slice(0, 2).map((rec: any, i: number) => (
              <RecommendationCard
                key={i}
                recommendation={rec}
                onAction={() => clickLink(rec.action_url)}
                t={t}
              />
            ))}
          </div>
        </SectionCard>
      );

    case "active_projects":
      return (
        <SectionCard
          title={t("dashboard.sections.activeProjects.title")}
          description={`${state.active_projects?.length || 0} ${t("dashboard.sections.activeProjects.active")}`}
          action={
            <Link
              href="/hub/projects"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {t("dashboard.sections.activeProjects.findNew")}{" "}
              <ChevronRight className="w-4 h-4" />
            </Link>
          }
        >
          {state.active_projects?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {state.active_projects.slice(0, 4).map((p: any) => (
                <ProjectItem key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Briefcase className="w-10 h-10" />}
              title={t("dashboard.emptyStates.projects.title")}
              description={t("dashboard.emptyStates.projects.description")}
              actionText={t("dashboard.buttons.findProjects")}
              onAction={() => clickLink("/hub/projects")}
            />
          )}
        </SectionCard>
      );

    case "recent_activities":
      return (
        <SectionCard title={t("dashboard.sections.recentActivities.title")}>
          {state.recent_activities?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {state.recent_activities.slice(0, 6).map((a: any) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock className="w-10 h-10" />}
              title={t("dashboard.emptyStates.activities.title")}
              description={t("dashboard.emptyStates.activities.description")}
            />
          )}
        </SectionCard>
      );

    case "skills":
      if (!state.skill_breakdown || !Object.keys(state.skill_breakdown).length)
        return null;
      return (
        <SectionCard title={t("dashboard.sections.skillsOverview.title")}>
          <div className="space-y-4">
            {Object.entries(state.skill_breakdown)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([skill, level]) => (
                <SkillBar key={skill} skill={skill} level={level} />
              ))}
          </div>
        </SectionCard>
      );

    case "quick_actions":
      return <QuickActionsGrid role={role} />;

    case "proposals":
      return <ProposalsSection proposals={state.proposals} />;

    case "active_contracts":
      return <ContractsSection contracts={state.active_contracts} />;

    case "earnings_chart":
      return <EarningsSection earnings={state.freelance_earnings} />;

    case "job_listings":
      return <JobListingsSection listings={state.job_listings} />;

    case "applicants":
      return (
        <ApplicantsSection
          total={state.total_applications}
          hires={state.total_hires}
        />
      );

    case "team_overview":
      return <TeamSection members={state.team_members} />;

    case "platform_metrics":
      return <PlatformMetricsSection stats={state.platform_stats} />;

    case "user_growth":
    case "recent_users":
      return <RecentUsersSection users={state.recent_users} />;

    case "revenue":
      return state.platform_stats ? (
        <RevenueSectionCard stats={state.platform_stats} />
      ) : null;

    case "system_alerts":
      return <SystemAlertsSection alerts={state.system_alerts} />;

    default:
      return null;
  }
}
