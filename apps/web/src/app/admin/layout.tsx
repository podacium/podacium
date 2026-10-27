"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Menu, ChevronRight, Sun, Moon, Shield } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { isRoleAllowedForPath } from "@/lib/navigation/role-access";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import { WorkspaceShell } from "@/components/navigation/WorkspaceShell";
import { ADMIN_SECTIONS } from "@/lib/navigation/sections";
import { cn } from "@/lib/utils";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const { dir } = useBidi();
  const pathname = usePathname();
  const { profile, hasAnyPermission } = useAdminAuth();
  const auth = useOptionalAuth();
  // MODERATORs are allowed into the admin console for moderation sub-routes
  // only (see role-access.ts); for them the "/admin" root breadcrumb would be
  // a dead link, so render it as plain text.
  const canOpenAdminRoot = isRoleAllowedForPath(auth?.user?.role, "/admin");
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const flattenedAdminItems = useMemo(
    () => ADMIN_SECTIONS.flatMap((sec) => sec.items),
    [],
  );

  const normalizedPath = pathname?.replace(/\/$/, "") || "/admin";
  const isMailRoute = normalizedPath.startsWith("/admin/mail");

  const currentItem = flattenedAdminItems.find(
    (item) =>
      normalizedPath === item.href ||
      (item.href !== "/admin" && normalizedPath.startsWith(item.href)),
  );

  const localizedStaffTitle = useMemo(() => {
    if (!profile) return "";
    if (profile.title === "Super Administrator (Owner)") {
      return t("admin.iam.superAdminOwner");
    }
    if (profile.title === "Super Administrator") {
      return t("admin.iam.superAdmin");
    }
    if (profile.roles?.includes("super-admin")) {
      return t("admin.iam.superAdmin");
    }
    return profile.title || t("admin.iam.staffMember");
  }, [profile, t]);

  const clearanceHeader = profile ? (
    <div className="px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
      <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 truncate">
        {localizedStaffTitle}
      </div>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-blue-600 dark:text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>
          {t("admin.iam.clearanceLevel", {
            level: String(profile.clearanceLevel),
          })}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <ProtectedRoute requireAuth requiredRole={["ADMIN", "MODERATOR"]}>
      <WorkspaceShell
        preset="admin"
        labelKey="admin.title"
        header={clearanceHeader}
        hideSidebar={isMailRoute}
        canSee={(permissions) =>
          !permissions ||
          permissions.length === 0 ||
          hasAnyPermission(permissions as string[])
        }
      >
        <div
          className={cn(
            "w-full",
            isMailRoute ? "space-y-3" : "max-w-7xl mx-auto space-y-6",
          )}
        >
          {/* Top Breadcrumb & Quick Actions Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-workspace-drawer"))
                }
                className={cn(
                  "p-1.5 -ms-1 rounded-lg text-foreground/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                  isMailRoute ? "inline-flex" : "lg:hidden",
                )}
                aria-label={t("admin.nav.openNav")}
                title={t("admin.nav.openNav")}
              >
                <Menu size={18} />
              </button>
              {canOpenAdminRoot ? (
                <Link
                  href="/admin"
                  className="hover:text-primary font-medium transition-colors"
                >
                  {t("admin.title")}
                </Link>
              ) : (
                <span className="font-medium">{t("admin.title")}</span>
              )}
              {currentItem && currentItem.href !== "/admin" && (
                <span
                  key="admin-breadcrumb-subpage"
                  className="inline-flex items-center gap-2"
                >
                  <ChevronRight
                    size={12}
                    className="rtl:rotate-180"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-foreground">
                    {t(currentItem.labelKey)}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ms-auto">
              {!isMailRoute && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        key: "k",
                        metaKey: true,
                        bubbles: true,
                      }),
                    );
                  }}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white/70 dark:bg-slate-900/70 text-xs text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                  title={t("admin.nav.searchTooltip")}
                  aria-label={t("admin.nav.openSearch")}
                >
                  <span className="font-medium">{t("admin.nav.search")}</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border/80 rounded text-muted-foreground">
                    {t("admin.nav.searchShortcut")}
                  </kbd>
                </button>
              )}

              {profile && (
                <PodaciumBadge
                  key="admin-profile-badge"
                  variant={
                    profile.roles?.includes("super-admin")
                      ? "gradient"
                      : "outline"
                  }
                  className="text-[11px] font-medium py-1 px-2.5"
                >
                  {profile.roles?.includes("super-admin")
                    ? t("admin.iam.superAdmin")
                    : profile.department || "Staff"}
                </PodaciumBadge>
              )}

              {!isMailRoute && (
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="p-2 rounded-lg border border-border bg-white/70 dark:bg-slate-900/70 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs flex items-center gap-1.5"
                  aria-label={t("admin.nav.toggleTheme")}
                >
                  {resolvedTheme === "dark" ? (
                    <Moon size={14} className="text-indigo-400" />
                  ) : (
                    <Sun size={14} className="text-amber-500" />
                  )}
                  <span className="hidden sm:inline capitalize">
                    {t(`auth.theme.${theme}`)}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Accessible screen reader live region */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {currentItem
              ? t(currentItem.labelKey) || currentItem.labelKey
              : t("admin.title")}
          </div>

          {children}
        </div>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
