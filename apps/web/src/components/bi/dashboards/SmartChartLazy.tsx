"use client";

/**
 * Lazy-loaded wrapper for SmartChart.
 *
 * Recharts is ~500 KB gzipped. Wrapping it in next/dynamic with ssr:false
 * ensures it is never included in the server-rendered HTML or the initial
 * JS bundle — it is only fetched when the component first mounts in the
 * browser.
 *
 * Usage: replace `import { SmartChart } from './SmartChart'` with
 *        `import { SmartChartLazy as SmartChart } from './SmartChartLazy'`
 */

import dynamic from "next/dynamic";
import type { SmartChartProps } from "./SmartChart";
import { useTranslations } from "@/lib/i18n";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton({ height = 300 }: { height?: number | string }) {
  const t = useTranslations("bi.dashboards");
  return (
    <div
      className="w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800"
      style={{ height }}
      role="status"
      aria-label={t("loadingChart")}
    >
      <div className="flex h-full items-end justify-around px-6 pb-6 pt-10 gap-2">
        {[0.6, 0.9, 0.4, 0.75, 0.55, 0.85, 0.5].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-lg bg-gray-200 dark:bg-slate-800/90"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dynamic import ───────────────────────────────────────────────────────────

const SmartChartDynamic = dynamic<SmartChartProps>(
  () => import("./SmartChart").then((m) => ({ default: m.SmartChart })),
  {
    ssr: false,
    loading: ({ height }: any) => <ChartSkeleton height={height} />,
  },
);

export function SmartChartLazy(props: SmartChartProps) {
  return <SmartChartDynamic {...props} />;
}

// Default export for convenience
export default SmartChartLazy;
