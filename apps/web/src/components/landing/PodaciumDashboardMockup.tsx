"use client";

import { useId } from "react";
import {
  BadgeCheckIcon,
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  SearchIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const KPIS = [
  { key: "courses", value: "3", delta: "85% Avg" },
  { key: "learners", value: "4", delta: "100% Valid" },
  { key: "earnings", value: "45,000 DZD", delta: "Secured" },
  { key: "satisfaction", value: "125,000 DZD", delta: "Paid" },
] as const;

const WEEKLY = [12, 18, 15, 25, 22, 35, 30, 42, 38, 45, 40, 50];

const CHANNELS = [
  { key: "organic", share: 94 },
  { key: "referral", share: 88 },
  { key: "paid", share: 82 },
  { key: "email", share: 75 },
] as const;

const NAV = [
  { key: "learning", icon: BookOpenIcon },
  { key: "freelancing", icon: WalletIcon },
  { key: "bi", icon: BarChart3Icon },
  { key: "hub", icon: ShieldCheckIcon },
] as const;

const ACTIVITY = [
  {
    key: "freelancer",
    icon: ShieldCheckIcon,
    badge: "Milestone 2/3",
    amount: "+45,000 DZD",
  },
  {
    key: "course",
    icon: BadgeCheckIcon,
    badge: "Open Badges v3",
    amount: "100% Verified",
  },
  {
    key: "project",
    icon: WalletIcon,
    badge: "BaridiMob",
    amount: "+40,000 DZD",
  },
] as const;

const CHART_WIDTH = 600;
const CHART_HEIGHT = 180;

/**
 * Illustrative product UI for the hero:
 * An authentic individual talent & freelancer workspace mockup
 * showing real course progression, Open Badges v3 verification,
 * secured client escrow, and DZD payouts via EDAHABIA / CIB.
 *
 * Everything is Tailwind + inline SVG — no screenshot, so it stays crisp on
 * every DPR, translates with the page, and costs zero extra network requests
 * on the LCP path. `role="img"` keeps the decorative micro-copy out of the
 * accessibility tree while the `aria-label` describes the whole panel.
 */
export function PodaciumDashboardMockup() {
  const t = useTranslations("home");
  const gradientId = `hero-chart-${useId().replace(/:/g, "")}`;

  const points = WEEKLY.map((value, index) => {
    const x = (index / (WEEKLY.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - (value / 60) * CHART_HEIGHT;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");

  return (
    <div
      role="img"
      aria-label={t("hero.dashboard.ariaLabel")}
      className="flex bg-card text-start"
    >
      <aside className="hidden w-48 shrink-0 flex-col gap-1 border-e border-border bg-muted/30 p-3 lg:flex">
        <div className="mb-3 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-foreground">
          <span className="size-5 rounded-md bg-gradient-to-br from-brand-from to-brand-to" />
          Podacium
        </div>
        {NAV.map(({ key, icon: Icon }, index) => (
          <div
            key={key}
            className={
              index === 0
                ? "flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs font-medium text-foreground ring-1 ring-border"
                : "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground"
            }
          >
            <Icon className="size-3.5 shrink-0" />
            {t(`hero.dashboard.nav.${key}`)}
          </div>
        ))}

        <div className="mt-auto border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 px-2 text-[11px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Talent Verified • 58 Wilayas</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand ring-1 ring-brand/20">
              AK
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground sm:text-base">
                {t("hero.dashboard.userTitle")}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>{t("hero.dashboard.userStatus")}</span>
                <span>•</span>
                <span>{t("hero.dashboard.period")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden h-8 w-52 items-center gap-2 rounded-md border border-border px-2 text-xs text-muted-foreground sm:flex">
              <SearchIcon className="size-3.5 shrink-0" />
              <span className="truncate">{t("hero.dashboard.search")}</span>
            </div>
            <div className="relative grid size-8 place-items-center rounded-md border border-border text-muted-foreground">
              <BellIcon className="size-3.5" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {KPIS.map((kpi) => (
            <div
              key={kpi.key}
              className="rounded-lg border border-border bg-background/60 p-3"
            >
              <div className="truncate text-xs text-muted-foreground">
                {t(`hero.dashboard.kpi.${kpi.key}`)}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold tracking-tight text-foreground tabular-nums sm:text-xl">
                  {kpi.value}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand"
                >
                  {kpi.delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/60 p-4 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {t("hero.dashboard.weeklyChart")}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand"
                >
                  {t("hero.dashboard.currency")}
                </span>
              </div>
              <span className="font-medium text-muted-foreground">
                DZD (EDAHABIA / CIB)
              </span>
            </div>
            <svg
              viewBox={`0 -8 ${CHART_WIDTH} ${CHART_HEIGHT + 8}`}
              preserveAspectRatio="none"
              className="mt-4 h-28 w-full sm:h-36"
              aria-hidden
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--brand-from))"
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--brand-from))"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((fraction) => (
                <line
                  key={fraction}
                  x1="0"
                  x2={CHART_WIDTH}
                  y1={CHART_HEIGHT * fraction}
                  y2={CHART_HEIGHT * fraction}
                  className="stroke-border"
                  strokeDasharray="4 6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                d={`${line} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`}
                fill={`url(#${gradientId})`}
              />
              <path
                d={line}
                fill="none"
                stroke="hsl(var(--brand-from))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="hidden rounded-lg border border-border bg-background/60 p-4 md:block">
            <div className="text-xs font-medium text-foreground">
              {t("hero.dashboard.topChannels")}
            </div>
            <div className="mt-4 space-y-3">
              {CHANNELS.map((channel) => (
                <div key={channel.key}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t(`hero.dashboard.sources.${channel.key}`)}</span>
                    <span className="tabular-nums">{channel.share}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-from to-brand-to"
                      style={{ width: `${channel.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 hidden rounded-lg border border-border bg-background/60 sm:block">
          {ACTIVITY.map(({ key, icon: Icon, badge, amount }, index) => (
            <div
              key={key}
              className={`flex items-center gap-3 px-4 py-2.5 text-xs ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                <Icon className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium text-foreground">
                  {t(`hero.dashboard.activity.${key}`)}
                </span>
                <span className="hidden rounded bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
                  {badge}
                </span>
              </div>
              <span
                className="ms-auto shrink-0 font-medium tabular-nums text-foreground"
                dir="ltr"
              >
                {amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
