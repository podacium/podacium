"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Briefcase,
  FileText,
  TrendingUp,
  Users,
  Building2,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  UserPlus,
  ChevronRight,
  Award,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { SectionCard, EmptyState } from "@/components/SectionComponents";
import { formatCurrency, formatDate, formatRelativeTime } from "./utils";
import type {
  ProposalSummary,
  ContractSummary,
  EarningsSummary,
  JobListingSummary,
  PlatformMetrics,
  UserSummary,
  SystemAlert,
  DashboardState,
} from "@/lib/api/users";

// ── Proposals Section (Freelancer) ─────────────────────────────

export function ProposalsSection({
  proposals,
  onViewAll,
}: {
  proposals: ProposalSummary[];
  onViewAll?: () => void;
}) {
  const t = useTranslations("user");
  const { isRTL } = useBidi();
  const locale = useLocale();
  if (!proposals?.length) {
    return (
      <SectionCard title={t("dashboard.freelancerSections.proposals.title")}>
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title={t("dashboard.emptyStates.proposals.title")}
          description={t("dashboard.emptyStates.proposals.description")}
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={t("dashboard.freelancerSections.proposals.title")}
      description={t("dashboard.freelancerSections.proposals.pending", {
        count: String(proposals.filter((p) => p.status === "PENDING").length),
      })}
      action={
        <Link
          href="/hub/proposals"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
        >
          {t("dashboard.sections.wallet.viewAll")}{" "}
          <ChevronRight
            className={`w-4 h-4 inline ${isRTL ? "rotate-180" : ""}`}
          />
        </Link>
      }
    >
      <div className="divide-y divide-gray-100">
        {proposals.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                {p.project_title}
              </h4>
              {p.client_name && (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {p.client_name}
                </p>
              )}
              <p className="text-xs text-gray-400">
                {t("dashboard.freelancerSections.proposals.submitted", {
                  date: formatDate(p.submitted_at, locale),
                })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(p.amount, locale)}
              </span>
              <PodaciumBadge
                variant={
                  p.status === "ACCEPTED"
                    ? "success"
                    : p.status === "PENDING"
                      ? "warning"
                      : "destructive"
                }
              >
                {p.status}
              </PodaciumBadge>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Contracts Section (Freelancer) ─────────────────────────────

export function ContractsSection({
  contracts,
}: {
  contracts: ContractSummary[];
}) {
  const t = useTranslations("user");
  if (!contracts?.length) return null;
  return (
    <SectionCard
      title={t("dashboard.freelancerSections.contracts.title")}
      action={
        <Link
          href="/hub/contracts"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
        >
          {t("dashboard.sections.wallet.viewAll")}{" "}
          <ChevronRight className="w-4 h-4 inline" />
        </Link>
      }
    >
      <div className="divide-y divide-gray-100">
        {contracts.slice(0, 5).map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                {c.project_title}
              </h4>
              {c.client_name && (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("dashboard.freelancerSections.contracts.client", {
                    name: c.client_name,
                  })}
                </p>
              )}
              {c.end_date && (
                <p className="text-xs text-gray-400">
                  {t("dashboard.freelancerSections.contracts.deadline", {
                    date: formatDate(c.end_date),
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(c.amount)}
              </span>
              <PodaciumBadge
                variant={c.status === "ACTIVE" ? "success" : "warning"}
              >
                {c.status}
              </PodaciumBadge>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Earnings Section (Freelancer) ──────────────────────────────

export function EarningsSection({ earnings }: { earnings?: EarningsSummary }) {
  const t = useTranslations("user");
  if (!earnings) return null;
  return (
    <SectionCard title={t("dashboard.freelancerSections.earnings.title")}>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.freelancerSections.earnings.thisMonth")}
          </p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(earnings.this_month)}
          </p>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.freelancerSections.earnings.pending")}
          </p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(earnings.pending_payments)}
          </p>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.freelancerSections.earnings.average")}
          </p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(earnings.average_per_project)}
          </p>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.common.total")}
          </p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {formatCurrency(earnings.total_earned)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Job Listings Section (Business) ────────────────────────────

export function JobListingsSection({
  listings,
}: {
  listings: JobListingSummary[];
}) {
  const t = useTranslations("user");
  if (!listings?.length) {
    return (
      <SectionCard
        title={t("dashboard.businessSections.listings.title")}
        action={
          <Link
            href="/hub/projects/new"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
          >
            {t("dashboard.quickActions.postJob.title")}{" "}
            <ChevronRight className="w-4 h-4 inline" />
          </Link>
        }
      >
        <EmptyState
          icon={<Briefcase className="w-10 h-10" />}
          title={t("dashboard.emptyStates.listings.title")}
          description={t("dashboard.emptyStates.listings.description")}
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={t("dashboard.businessSections.listings.title")}
      description={t("dashboard.businessSections.listings.active", {
        count: String(listings.filter((l) => l.status === "ACTIVE").length),
      })}
      action={
        <Link
          href="/hub/projects"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
        >
          {t("dashboard.businessSections.applicants.viewAll")}{" "}
          <ChevronRight className="w-4 h-4 inline" />
        </Link>
      }
    >
      <div className="divide-y divide-gray-100">
        {listings.slice(0, 5).map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                {l.title}
              </h4>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("dashboard.businessSections.listings.applicants", {
                  count: String(l.applicants_count),
                })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {l.budget_range && (
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {l.budget_range}
                </span>
              )}
              <PodaciumBadge
                variant={l.status === "ACTIVE" ? "success" : "warning"}
              >
                {l.status}
              </PodaciumBadge>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Applicants Section (Business) ──────────────────────────────

export function ApplicantsSection({
  total,
  hires,
}: {
  total: number;
  hires: number;
}) {
  const t = useTranslations("user");
  return (
    <SectionCard title={t("dashboard.businessSections.applicants.title")}>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.common.total")}
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {total}
          </p>
        </div>
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {t("dashboard.stats.hires")}
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {hires}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Team Section (Business) ────────────────────────────────────

export function TeamSection({ members }: { members: number }) {
  const t = useTranslations("user");
  return (
    <SectionCard
      title={t("dashboard.businessSections.team.title")}
      description={t("dashboard.businessSections.team.members", {
        count: String(members),
      })}
      action={
        <Link
          href="/bi/organizations"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
        >
          {t("dashboard.businessSections.team.invite")}{" "}
          <ChevronRight className="w-4 h-4 inline" />
        </Link>
      }
    >
      <div className="flex items-center gap-4 p-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/50 flex items-center justify-center">
          <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {members}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("dashboard.businessSections.team.members", {
              count: String(members),
            })}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Platform Metrics Section (Admin) ───────────────────────────

export function PlatformMetricsSection({
  stats,
  initialActiveId = "users",
}: {
  stats?: PlatformMetrics;
  initialActiveId?: string;
}) {
  const t = useTranslations("user");
  const { isRTL } = useBidi();
  const [activeId, setActiveId] = React.useState<string>(initialActiveId);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  if (!stats) return null;

  const metrics = [
    {
      id: "users",
      label: t("dashboard.stats.platformUsers"),
      value: (stats.total_users ?? 0).toLocaleString(),
      growth: stats.users_growth,
      icon: Users,
      href: "/admin/users",
      description: isRTL
        ? "إجمالي المستخدمين المسجلين في المنصة وتوزيعهم"
        : "Total registered users across the platform ecosystem",
      theme: {
        text: "text-blue-500 dark:text-blue-400",
        groupHoverText:
          "group-hover:text-blue-500 dark:group-hover:text-blue-400",
        bgActive: "bg-blue-500/10 dark:bg-blue-500/15",
        borderActive: "border-blue-500/40",
        ring: "ring-blue-500/30",
        dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]",
        gradient: "from-blue-500 to-indigo-600",
      },
    },
    {
      id: "revenue",
      label: t("dashboard.stats.revenue"),
      value: formatCurrency(stats.total_revenue ?? 0),
      growth: stats.revenue_growth,
      icon: DollarSign,
      href: "/admin/analytics",
      description: isRTL
        ? "إجمالي الإيرادات المحققة والمعاملات المالية"
        : "Gross platform revenue & transaction volume",
      theme: {
        text: "text-emerald-500 dark:text-emerald-400",
        groupHoverText:
          "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
        bgActive: "bg-emerald-500/10 dark:bg-emerald-500/15",
        borderActive: "border-emerald-500/40",
        ring: "ring-emerald-500/30",
        dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
        gradient: "from-emerald-500 to-teal-600",
      },
    },
    {
      id: "courses",
      label: t("dashboard.stats.activeCourses.title"),
      value: String(stats.active_courses ?? 0),
      icon: Award,
      href: "/learn/courses",
      description: isRTL
        ? "الدورات التعليمية المتاحة والنشطة حالياً"
        : "Currently published & active learning courses",
      theme: {
        text: "text-amber-500 dark:text-amber-400",
        groupHoverText:
          "group-hover:text-amber-500 dark:group-hover:text-amber-400",
        bgActive: "bg-amber-500/10 dark:bg-amber-500/15",
        borderActive: "border-amber-500/40",
        ring: "ring-amber-500/30",
        dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
        gradient: "from-amber-500 to-orange-600",
      },
    },
    {
      id: "projects",
      label: t("dashboard.stats.activeProjects.title"),
      value: String(stats.active_projects ?? 0),
      icon: Briefcase,
      href: "/hub/projects",
      description: isRTL
        ? "المشاريع قيد التنفيذ في سوق العمل الحر"
        : "Active freelance contracts and marketplace assignments",
      theme: {
        text: "text-purple-500 dark:text-purple-400",
        groupHoverText:
          "group-hover:text-purple-500 dark:group-hover:text-purple-400",
        bgActive: "bg-purple-500/10 dark:bg-purple-500/15",
        borderActive: "border-purple-500/40",
        ring: "ring-purple-500/30",
        dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]",
        gradient: "from-purple-500 to-fuchsia-600",
      },
    },
    {
      id: "transactions",
      label: t("dashboard.stats.transactions"),
      value: (stats.total_transactions ?? 0).toLocaleString(),
      icon: BarChart3,
      href: "/admin/analytics",
      description: isRTL
        ? "العمليات المالية والدفعات المكتملة عبر EDAHABIA / CIB"
        : "Completed transaction pipeline through Chargily EDAHABIA / CIB",
      theme: {
        text: "text-cyan-500 dark:text-cyan-400",
        groupHoverText:
          "group-hover:text-cyan-500 dark:group-hover:text-cyan-400",
        bgActive: "bg-cyan-500/10 dark:bg-cyan-500/15",
        borderActive: "border-cyan-500/40",
        ring: "ring-cyan-500/30",
        dot: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]",
        gradient: "from-cyan-500 to-blue-600",
      },
    },
    {
      id: "uptime",
      label: t("dashboard.adminSections.health.uptime"),
      value: `${stats.system_uptime ?? 100}%`,
      icon: Clock,
      href: "/admin/health",
      description: isRTL
        ? "جاهزية واستقرار الخوادم والبنية التحتية"
        : "Service uptime SLA and operational infrastructure telemetry",
      theme: {
        text: "text-teal-500 dark:text-teal-400",
        groupHoverText:
          "group-hover:text-teal-500 dark:group-hover:text-teal-400",
        bgActive: "bg-teal-500/10 dark:bg-teal-500/15",
        borderActive: "border-teal-500/40",
        ring: "ring-teal-500/30",
        dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]",
        gradient: "from-teal-500 to-emerald-600",
      },
    },
  ];

  const activeMetric = metrics.find((m) => m.id === activeId) || metrics[0];
  const ActiveIcon = activeMetric.icon;

  return (
    <div className="mb-8 w-full">
      {/* Executive Floating Capsule Dock */}
      <div className="w-full flex justify-center py-2 overflow-x-auto scrollbar-none">
        <nav
          className="relative inline-flex items-center p-1 sm:p-1.5 rounded-2xl border border-gray-200/80 dark:border-slate-800/90 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-xl shrink-0"
          role="tablist"
          aria-label={t("dashboard.adminSections.platform.title")}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="flex items-center gap-1 sm:gap-1.5 px-0.5">
            {metrics.map((item, idx) => {
              const active = activeId === item.id;
              // Active Anchor Rule: Expanded by default when idle; hovered tab expands on hover
              const isExpanded =
                hoveredId !== null ? hoveredId === item.id : active;
              const theme = item.theme;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`metric-tab-${item.id}`}
                  aria-controls={`metric-panel-${item.id}`}
                  aria-selected={active}
                  aria-label={item.label}
                  title={`${item.label}: ${item.value}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => {
                    setActiveId(item.id);
                    setHoveredId(item.id);
                  }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onFocus={() => setHoveredId(item.id)}
                  onBlur={() => setHoveredId(null)}
                  className={`group relative flex items-center h-10 sm:h-11 rounded-xl text-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] tab-pop-in shrink-0 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] ${
                    isExpanded
                      ? `px-2.5 sm:px-3 ${
                          active
                            ? theme.bgActive
                            : "bg-gray-100/80 dark:bg-slate-800/80"
                        } text-gray-900 dark:text-slate-100 border ${
                          active
                            ? theme.borderActive
                            : "border-gray-200 dark:border-slate-700"
                        } shadow-md ring-1 ${
                          active
                            ? theme.ring
                            : "ring-black/5 dark:ring-white/10"
                        }`
                      : active
                        ? `w-10 sm:w-11 justify-center ${theme.bgActive} ${theme.text} border ${theme.borderActive} shadow-sm ring-1 ${theme.ring}`
                        : "w-10 sm:w-11 justify-center bg-transparent text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-gray-200/50 dark:hover:border-slate-800"
                  }`}
                >
                  {/* Distinct Sized Icon with Chromatic Category Tone */}
                  <span
                    className={`flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      active
                        ? theme.text
                        : `text-gray-400 dark:text-slate-500 ${theme.groupHoverText}`
                    }`}
                  >
                    <Icon size={17} />
                  </span>

                  {/* Morphing Expanded Content (Label + Value + Growth Badge) */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-2 whitespace-nowrap ${
                      isExpanded
                        ? "max-w-[200px] opacity-100 ps-2 pe-0.5"
                        : "max-w-0 opacity-0 ps-0 pe-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-slate-400 rtl:tracking-normal truncate max-w-[90px]">
                        {item.label}
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-slate-100 tabular-nums">
                        {item.value}
                      </span>
                    </div>

                    {item.growth !== undefined && item.growth !== null && (
                      <span
                        dir="ltr"
                        className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 border ${
                          item.growth >= 0
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {item.growth >= 0 ? "+" : ""}
                        {item.growth.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Active Indicator Beacon Pip */}
                  {active && (
                    <span
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${theme.dot}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Active Metric Spotlight Card */}
      <motion.div
        key={activeMetric.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        id={`metric-panel-${activeMetric.id}`}
        role="tabpanel"
        className="w-full mt-3 p-5 rounded-2xl border border-gray-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${activeMetric.theme.gradient} text-white shadow-sm flex items-center justify-center shrink-0`}
          >
            <ActiveIcon size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 rtl:tracking-normal">
                {activeMetric.label}
              </h3>
              {activeMetric.growth !== undefined &&
                activeMetric.growth !== null && (
                  <span
                    dir="ltr"
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${
                      activeMetric.growth >= 0
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {activeMetric.growth >= 0 ? "+" : ""}
                    {activeMetric.growth.toFixed(1)}%
                  </span>
                )}
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
              {activeMetric.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
              {activeMetric.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            href={activeMetric.href}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline group"
          >
            <span>{t("dashboard.sections.wallet.viewAll")}</span>
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""
              }`}
            />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// ── Recent Users Section (Admin) ───────────────────────────────

export function RecentUsersSection({ users }: { users: UserSummary[] }) {
  const t = useTranslations("user");
  if (!users?.length) return null;
  return (
    <SectionCard title={t("dashboard.adminSections.users.title")}>
      <div className="divide-y divide-gray-100">
        {users.slice(0, 8).map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-950/50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {u.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {u.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {u.role} • {t("dashboard.common.joined")}
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {formatRelativeTime(u.joined_at)}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── System Alerts Section (Admin) ──────────────────────────────

export function SystemAlertsSection({ alerts }: { alerts: SystemAlert[] }) {
  const t = useTranslations("user");
  if (!alerts?.length) return null;
  const typeStyles = {
    warning:
      "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200",
    error:
      "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200",
    info: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200",
  };
  return (
    <SectionCard title={t("dashboard.adminSections.alerts.title")}>
      <div className="space-y-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`flex items-center gap-3 p-4 rounded-xl border ${typeStyles[a.type] || typeStyles.info}`}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{a.message}</p>
              <p className="text-xs opacity-75 mt-1">
                {formatRelativeTime(a.timestamp)}
              </p>
            </div>
            <PodaciumBadge
              variant={
                a.type === "error"
                  ? "destructive"
                  : a.type === "warning"
                    ? "warning"
                    : "default"
              }
            >
              {a.acknowledged
                ? t("dashboard.alerts.acknowledged")
                : t("dashboard.alerts.new")}
            </PodaciumBadge>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Certificates Section (Student) ─────────────────────────────

export function CertificatesSection({ count }: { count: number }) {
  const t = useTranslations("user");
  if (!count) return null;
  return (
    <SectionCard
      title={t("dashboard.sections.certificates.title")}
      description={t("dashboard.sections.certificates.earned", {
        count: String(count),
      })}
      action={
        <Link
          href="/learn/certificates"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
        >
          {t("dashboard.sections.wallet.viewAll")}{" "}
          <ChevronRight className="w-4 h-4 inline" />
        </Link>
      }
    >
      <div className="flex items-center gap-4 p-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/60 dark:to-orange-950/50 flex items-center justify-center">
          <Award className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {count}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("dashboard.sections.certificates.earned", {
              count: String(count),
            })}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
