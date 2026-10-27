"use client";

import {
  BadgeCheckIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const ITEMS = [
  { key: "languages", icon: LanguagesIcon },
  { key: "certificates", icon: BadgeCheckIcon },
  { key: "payments", icon: WalletIcon },
  { key: "commission", icon: ShieldCheckIcon },
] as const;

/**
 * Honest trust strip: each claim is a product fact (locale coverage, verified
 * certificates, local payment rails, no commission) rather than a borrowed
 * customer logo.
 */
export function PodaciumTrustStrip({ className }: { className?: string }) {
  const t = useTranslations("home");

  return (
    <div className={className}>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {t("hero.trust.title")}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/60 px-4 py-3"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span className="text-sm leading-snug text-muted-foreground">
              {t(`hero.trust.items.${key}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
