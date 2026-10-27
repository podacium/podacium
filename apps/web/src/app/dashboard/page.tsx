"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, ChevronRight, RefreshCw, User } from "lucide-react";

import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/lib/dashboard/hooks";
import {
  WelcomeBanner,
  DashboardStatsGrid,
  DashboardError,
  SectionRenderer,
} from "@/lib/dashboard/components";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { LoadingState } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import type { UserRoleStr } from "@/lib/dashboard/utils";

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { state, viewConfig, role, loading, error, refreshState, refresh } =
    useDashboard();
  const t = useTranslations("user");
  const { dir } = useBidi();

  const userName = user?.fullName || t("dashboard.general.user");
  const roleStr = (role || user?.role || "STUDENT") as UserRoleStr;

  const mainSections = useMemo(
    () =>
      (viewConfig?.sections || [])
        .filter((s) => s.grid === "main")
        .sort((a, b) => a.priority - b.priority),
    [viewConfig?.sections],
  );
  const sidebarSections = useMemo(
    () =>
      (viewConfig?.sections || [])
        .filter((s) => s.grid === "sidebar")
        .sort((a, b) => a.priority - b.priority),
    [viewConfig?.sections],
  );
  const fullSections = useMemo(
    () =>
      (viewConfig?.sections || [])
        .filter((s) => s.grid === "full")
        .sort((a, b) => a.priority - b.priority),
    [viewConfig?.sections],
  );

  if (authLoading || loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-4"
        dir={dir}
      >
        <LoadingState text={t("dashboard.loading")} />
      </div>
    );
  }

  if (error) {
    return <DashboardError error={error} onRetry={refresh} />;
  }

  if (!isAuthenticated || !state) return <div />;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-gray-900 dark:text-slate-100"
      dir={dir}
    >
      <main className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>{t("dashboard.breadcrumb.home")}</span>
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("dashboard.breadcrumb.dashboard")}
          </span>
        </nav>

        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-indigo-100/70 dark:border-indigo-900/50 dark:border-slate-800/80 bg-gradient-to-br from-white via-indigo-50/40 to-purple-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80 p-6 lg:p-8 shadow-[0_16px_48px_-20px_rgba(79,70,229,0.18)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="aurora-blob w-72 h-72 -top-20 -right-16 bg-indigo-100 dark:bg-indigo-950/60 animate-aurora-slow" />
            <div className="aurora-blob w-64 h-64 bottom-0 -left-20 bg-purple-100 dark:bg-purple-950/60 animate-aurora" />
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <WelcomeBanner userName={userName} role={roleStr} />
            <motion.div
              initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <PodaciumButton
                variant="outline"
                onClick={refresh}
                disabled={refreshState.isRefreshing}
                className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshState.isRefreshing ? "animate-spin" : ""}`}
                />
                {t("dashboard.buttons.refresh")}
              </PodaciumButton>
              <PodaciumButton href="/profile/me" glow>
                <User className="w-4 h-4" />
                {t("dashboard.profileCompletion.cta")}
              </PodaciumButton>
            </motion.div>
          </div>
        </div>

        <DashboardTabs stats={state?.platform_stats || state?.user_stats} />

        <DashboardStatsGrid state={state} role={roleStr} />

        {fullSections.map((s) => (
          <div key={s.id} className="mb-8">
            <SectionRenderer section={s} state={state} role={roleStr} t={t} />
          </div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {mainSections.map((s) => (
              <SectionRenderer
                key={s.id}
                section={s}
                state={state}
                role={roleStr}
                t={t}
              />
            ))}

            <SectionRenderer
              section={{ id: "recent_activities" }}
              state={state}
              role={roleStr}
              t={t}
            />
          </div>

          <div className="space-y-8">
            {viewConfig?.show_quick_actions && (
              <SectionRenderer
                section={{ id: "quick_actions" }}
                state={state}
                role={roleStr}
                t={t}
              />
            )}

            {viewConfig?.show_skills && (
              <SectionRenderer
                section={{ id: "skills" }}
                state={state}
                role={roleStr}
                t={t}
              />
            )}

            {viewConfig?.show_recommendations &&
              state.recommendations?.length > 0 && (
                <SectionRenderer
                  section={{ id: "course_recommendations" }}
                  state={state}
                  role={roleStr}
                  t={t}
                />
              )}

            {sidebarSections.map((s) => (
              <SectionRenderer
                key={s.id}
                section={s}
                state={state}
                role={roleStr}
                t={t}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
