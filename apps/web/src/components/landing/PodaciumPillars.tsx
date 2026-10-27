"use client";

import { useTranslations } from "@/lib/i18n";

const PILLARS = [
  { key: "learning", dot: "bg-brand-from" },
  { key: "freelancing", dot: "bg-brand-via" },
  { key: "bi", dot: "bg-brand-to" },
  { key: "hub", dot: "bg-purple-500" },
] as const;

export function PodaciumPillars({ className }: { className?: string }) {
  const t = useTranslations("home");

  return (
    <ul
      aria-label={t("hero.pillarsAriaLabel")}
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-8 ${className ?? ""}`}
    >
      {PILLARS.map(({ key, dot }) => (
        <li
          key={key}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <span aria-hidden className={`size-2 rounded-full ${dot}`} />
          {t(`hero.pillars.${key}`)}
        </li>
      ))}
    </ul>
  );
}
