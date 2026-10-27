"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import { isItemActive, type NavSection } from "@/lib/navigation/chrome";
import {
  isRoleAllowedForPath,
  isRoleGatedPath,
} from "@/lib/navigation/role-access";
import PodaciumIcon from "@/components/logo/podacium icon.svg";
import PodaciumIconWhite from "@/components/logo/podacium icon white.svg";

export type SidebarState = "expanded" | "collapsed";

export interface WorkspaceSidebarProps {
  id?: string;
  labelKey?: string;
  sections: readonly NavSection[];
  initialState?: SidebarState;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  canSee?: (permissions?: readonly string[]) => boolean;
  /**
   * Signed-in role. When provided, links the role gate would reject are hidden
   * (matching the Edge middleware). When omitted (unknown/hydrating), items are
   * kept but role-gated links are never prefetched.
   */
  role?: string;
  onNavigate?: () => void;
  variant?: "rail" | "drawer";
  className?: string;
  title?: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
  headerIcon?: React.ElementType;
}

const COOKIE = "pd_sidebar";

export function WorkspaceSidebar({
  id = "workspace-sidebar",
  labelKey = "nav.workspace",
  title,
  subtitle,
  titleKey,
  subtitleKey,
  headerIcon: HeaderIcon,
  sections,
  initialState = "expanded",
  header,
  footer,
  canSee = () => true,
  role,
  onNavigate,
  variant = "rail",
  className,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const [state, setState] = useState<SidebarState>(initialState);
  const collapsed = variant === "rail" && state === "collapsed";

  const resolvedTitle =
    title ||
    (titleKey ? t(titleKey) : "") ||
    (labelKey ? t(labelKey) : "") ||
    t("nav.workspace");

  const resolvedSubtitle = subtitle || (subtitleKey ? t(subtitleKey) : "");

  const toggle = useCallback(() => {
    setState((s) => {
      const next: SidebarState = s === "expanded" ? "collapsed" : "expanded";
      if (typeof document !== "undefined") {
        document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.dataset.sidebar = next;
      }
      return next;
    });
  }, []);

  return (
    <aside
      id={id}
      data-testid="workspace-sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "flex flex-col select-none",
        variant === "rail" &&
          "sticky top-[calc(var(--chrome-offset)+1.25rem)] z-30 hidden lg:flex rounded-3xl border border-gray-200/60 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xs overflow-hidden h-[calc(100dvh-var(--chrome-offset)-2.5rem)] transition-[inline-size] duration-300 ease-(--ease-spring) motion-reduce:transition-none",
        variant === "rail" &&
          (collapsed
            ? "w-[var(--sidebar-w-collapsed,4.5rem)]"
            : "w-[var(--sidebar-w,15rem)]"),
        variant === "drawer" &&
          "h-dvh w-[min(20rem,85vw)] border-e border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
        className,
      )}
    >
      {/* Context Identity Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-border/40">
        {collapsed ? (
          <div
            title={
              resolvedSubtitle
                ? `${resolvedTitle} — ${resolvedSubtitle}`
                : resolvedTitle
            }
            className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 text-primary flex items-center justify-center font-bold text-xs shadow-xs mx-auto"
          >
            {HeaderIcon ? (
              <HeaderIcon
                className="w-4.5 h-4.5 text-primary"
                aria-hidden="true"
              />
            ) : (
              <span className="font-bold text-xs text-primary">
                {resolvedTitle.charAt(0)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col min-w-0 justify-center">
            <h2 className="font-bold text-sm tracking-tight text-foreground truncate flex items-center gap-2">
              {HeaderIcon && (
                <HeaderIcon
                  className="w-4 h-4 text-primary shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{resolvedTitle}</span>
            </h2>
            {resolvedSubtitle && (
              <p
                className="text-[11px] text-muted-foreground/80 truncate leading-tight mt-0.5"
                title={resolvedSubtitle}
              >
                {resolvedSubtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {!collapsed && header && <div className="px-3 py-2">{header}</div>}

      {/* Navigation Sections */}
      <nav
        aria-label={t(labelKey)}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {sections.map((section) => {
          const items = section.items.filter(
            (i) =>
              canSee(i.permissions) &&
              // Role unknown: keep the item (avoid hydration flicker) but never
              // prefetch a route the Edge may reject.
              (role === undefined || isRoleAllowedForPath(role, i.href)),
          );
          if (items.length === 0) return null;
          const headingId = `${id}-${section.id}`;

          return (
            <div key={section.id} className="mt-4 first:mt-0">
              {section.labelKey && (
                <h3
                  id={headingId}
                  className={cn(
                    "px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80",
                    collapsed && "sr-only",
                  )}
                >
                  {t(section.labelKey) || section.labelKey}
                </h3>
              )}
              <ul
                role="list"
                aria-labelledby={section.labelKey ? headingId : undefined}
                className="space-y-1"
              >
                {items.map((item) => {
                  const active = isItemActive(pathname, item);
                  const Icon = item.icon;
                  const label = t(item.labelKey) || item.labelKey;
                  // Prefetching a role-gated route before the role is known
                  // makes the Edge answer with a redirect, which the router
                  // reports as a failed fetch. Only prefetch what we know the
                  // role can open.
                  const canPrefetch =
                    role !== undefined
                      ? isRoleAllowedForPath(role, item.href)
                      : !isRoleGatedPath(item.href);

                  return (
                    <li key={item.id} className="relative">
                      <Link
                        href={item.href}
                        prefetch={canPrefetch}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? label : undefined}
                        title={collapsed ? label : undefined}
                        className={cn(
                          "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium outline-none transition-colors duration-150",
                          "focus-visible:ring-2 focus-visible:ring-primary",
                          active
                            ? "bg-primary/10 text-primary font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-foreground",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        {/* Start active border strip */}
                        {active && (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 start-0 w-1 rounded-e-full bg-primary"
                          />
                        )}
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {!collapsed && (
                          <span className="truncate flex-1">{label}</span>
                        )}
                        {item.badge && item.badge.count > 0 && (
                          <>
                            {collapsed ? (
                              <span
                                className="absolute top-1.5 end-2 w-2 h-2 rounded-full bg-destructive"
                                aria-hidden="true"
                              />
                            ) : (
                              <PodaciumBadge
                                variant={
                                  item.badge.tone === "destructive"
                                    ? "destructive"
                                    : item.badge.tone === "warning"
                                      ? "warning"
                                      : "secondary"
                                }
                                className="ms-auto text-[10px] px-1.5 py-0.5 tabular-nums"
                              >
                                {item.badge.count > 99
                                  ? "99+"
                                  : item.badge.count}
                              </PodaciumBadge>
                            )}
                            <span className="sr-only">
                              {t("nav.badgeCount", {
                                count: String(item.badge.count),
                              })}
                            </span>
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer & Collapse Toggle */}
      <div className="border-t border-border/40 p-2.5">
        {!collapsed && footer}
        {variant === "rail" && (
          <button
            type="button"
            data-testid="sidebar-collapse-btn"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={id}
            className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-foreground transition-colors"
          >
            <ChevronsLeft
              className={cn(
                "w-4 h-4 transition-transform duration-200 rtl:rotate-180",
                collapsed && "rotate-180 rtl:rotate-0",
              )}
              aria-hidden="true"
            />
            {!collapsed && <span>{t("nav.collapseSidebar")}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

export default WorkspaceSidebar;
