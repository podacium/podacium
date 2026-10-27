"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layout,
  GraduationCap,
  Briefcase,
  Building2,
  DollarSign,
  Award,
  BarChart3,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";

interface TabItem {
  key: string;
  fallback: string;
  href: string;
  icon: React.ElementType;
  allowedRoles?: string[];
  theme: {
    text: string;
    groupHoverText: string;
    bgActive: string;
    borderActive: string;
    ring: string;
    dot: string;
  };
}

const TABS: TabItem[] = [
  {
    key: "dashboard.tabs.overview",
    fallback: "Overview",
    href: "/dashboard",
    icon: Layout,
    theme: {
      text: "text-blue-500 dark:text-blue-400",
      groupHoverText:
        "group-hover:text-blue-500 dark:group-hover:text-blue-400",
      bgActive: "bg-blue-500/10 dark:bg-blue-500/15",
      borderActive: "border-blue-500/40",
      ring: "ring-blue-500/30",
      dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.learning",
    fallback: "Learning",
    href: "/dashboard/learning",
    icon: GraduationCap,
    allowedRoles: ["STUDENT", "INSTRUCTOR", "FREELANCER", "ADMIN", "MODERATOR"],
    theme: {
      text: "text-indigo-500 dark:text-indigo-400",
      groupHoverText:
        "group-hover:text-indigo-500 dark:group-hover:text-indigo-400",
      bgActive: "bg-indigo-500/10 dark:bg-indigo-500/15",
      borderActive: "border-indigo-500/40",
      ring: "ring-indigo-500/30",
      dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.freelancing",
    fallback: "Freelancing",
    href: "/dashboard/freelancing",
    icon: Briefcase,
    allowedRoles: ["FREELANCER", "BUSINESS", "ADMIN", "MODERATOR"],
    theme: {
      text: "text-purple-500 dark:text-purple-400",
      groupHoverText:
        "group-hover:text-purple-500 dark:group-hover:text-purple-400",
      bgActive: "bg-purple-500/10 dark:bg-purple-500/15",
      borderActive: "border-purple-500/40",
      ring: "ring-purple-500/30",
      dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.business",
    fallback: "Business BI",
    href: "/dashboard/business",
    icon: Building2,
    allowedRoles: ["BUSINESS", "ADMIN"],
    theme: {
      text: "text-cyan-500 dark:text-cyan-400",
      groupHoverText:
        "group-hover:text-cyan-500 dark:group-hover:text-cyan-400",
      bgActive: "bg-cyan-500/10 dark:bg-cyan-500/15",
      borderActive: "border-cyan-500/40",
      ring: "ring-cyan-500/30",
      dot: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.financial",
    fallback: "Revenue",
    href: "/dashboard/financial",
    icon: DollarSign,
    allowedRoles: ["INSTRUCTOR", "BUSINESS", "FREELANCER", "ADMIN"],
    theme: {
      text: "text-emerald-500 dark:text-emerald-400",
      groupHoverText:
        "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
      bgActive: "bg-emerald-500/10 dark:bg-emerald-500/15",
      borderActive: "border-emerald-500/40",
      ring: "ring-emerald-500/30",
      dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.teaching",
    fallback: "Teaching",
    href: "/dashboard/teaching",
    icon: Award,
    allowedRoles: ["INSTRUCTOR", "ADMIN"],
    theme: {
      text: "text-amber-500 dark:text-amber-400",
      groupHoverText:
        "group-hover:text-amber-500 dark:group-hover:text-amber-400",
      bgActive: "bg-amber-500/10 dark:bg-amber-500/15",
      borderActive: "border-amber-500/40",
      ring: "ring-amber-500/30",
      dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
    },
  },
  {
    key: "dashboard.tabs.profile",
    fallback: "Profile Analytics",
    href: "/dashboard/profile",
    icon: BarChart3,
    theme: {
      text: "text-teal-500 dark:text-teal-400",
      groupHoverText:
        "group-hover:text-teal-500 dark:group-hover:text-teal-400",
      bgActive: "bg-teal-500/10 dark:bg-teal-500/15",
      borderActive: "border-teal-500/40",
      ring: "ring-teal-500/30",
      dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]",
    },
  },
];

export function DashboardTabs({ stats }: { stats?: any }) {
  const pathname = usePathname();
  const t = useTranslations("user");
  const { user } = useAuth();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const userRole = (user?.role || "STUDENT").toUpperCase();

  const visibleTabs = TABS.filter((tab) => {
    if (!tab.allowedRoles) return true;
    return tab.allowedRoles.includes(userRole) || userRole === "ADMIN";
  });

  return (
    <div className="w-full flex justify-center py-2 overflow-x-auto scrollbar-none mb-8">
      <nav
        className="relative inline-flex items-center p-1 sm:p-1.5 rounded-2xl border border-gray-200/80 dark:border-slate-800/90 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-lg shrink-0"
        aria-label={t("dashboard.breadcrumb.dashboard")}
        onMouseLeave={() => setHoveredHref(null)}
      >
        <div className="flex items-center gap-1 sm:gap-1.5 px-0.5">
          {visibleTabs.map((tab, idx) => {
            const isActive =
              tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.href);
            const isExpanded =
              hoveredHref !== null ? hoveredHref === tab.href : isActive;
            const theme = tab.theme;
            const Icon = tab.icon;
            const label = t(tab.key, {}, tab.fallback);

            // Optional live telemetry badge for the pillar
            let badge: string | null = null;
            if (stats) {
              if (
                tab.href === "/dashboard" &&
                stats.total_users !== undefined
              ) {
                badge = String(stats.total_users);
              } else if (
                tab.href === "/dashboard/learning" &&
                stats.active_courses !== undefined
              ) {
                badge = String(stats.active_courses);
              } else if (
                tab.href === "/dashboard/freelancing" &&
                stats.active_projects !== undefined
              ) {
                badge = String(stats.active_projects);
              } else if (
                tab.href === "/dashboard/financial" &&
                stats.total_revenue !== undefined
              ) {
                badge =
                  stats.total_revenue === 0
                    ? "DZD 0"
                    : `${stats.total_revenue.toLocaleString()}`;
              }
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                title={label}
                style={{ animationDelay: `${idx * 40}ms` }}
                onMouseEnter={() => setHoveredHref(tab.href)}
                onFocus={() => setHoveredHref(tab.href)}
                onBlur={() => setHoveredHref(null)}
                className={`group relative flex items-center h-10 sm:h-11 rounded-xl text-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] tab-pop-in shrink-0 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] ${
                  isExpanded
                    ? `px-3 ${
                        isActive
                          ? theme.bgActive
                          : "bg-gray-100/80 dark:bg-slate-800/80"
                      } text-gray-900 dark:text-slate-100 border ${
                        isActive
                          ? theme.borderActive
                          : "border-gray-200 dark:border-slate-700"
                      } shadow-sm ring-1 ${
                        isActive
                          ? theme.ring
                          : "ring-black/5 dark:ring-white/10"
                      }`
                    : isActive
                      ? `w-10 sm:w-11 justify-center ${theme.bgActive} ${theme.text} border ${theme.borderActive} shadow-xs ring-1 ${theme.ring}`
                      : "w-10 sm:w-11 justify-center bg-transparent text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-gray-200/50 dark:hover:border-slate-800"
                }`}
              >
                {/* Chromatic Pillar Icon */}
                <span
                  className={`flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive
                      ? theme.text
                      : `text-gray-400 dark:text-slate-500 ${theme.groupHoverText}`
                  }`}
                >
                  <Icon size={17} />
                </span>

                {/* Morphing Expanded Title & Live Telemetry Badge */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-2 whitespace-nowrap ${
                    isExpanded
                      ? "max-w-[200px] opacity-100 ps-2 pe-0.5"
                      : "max-w-0 opacity-0 ps-0 pe-0 pointer-events-none"
                  }`}
                >
                  <span className="font-semibold text-xs tracking-tight text-gray-900 dark:text-slate-100 truncate max-w-[110px]">
                    {label}
                  </span>
                  {badge && (
                    <span
                      dir="ltr"
                      className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 border ${
                        isActive
                          ? "bg-white/20 dark:bg-white/10 text-gray-900 dark:text-white border-white/20"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </div>

                {/* Active Indicator Beacon Pip */}
                {isActive && (
                  <span
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${theme.dot}`}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
