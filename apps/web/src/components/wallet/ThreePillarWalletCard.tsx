"use client";

import React from "react";
import {
  Wallet,
  Lock,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Info,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
  PodaciumTooltip,
} from "@/components/design-system";
import { useTranslations, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface WalletBalances {
  spendableDzd: number;
  inEscrowDzd: number;
  pendingClearanceDzd: number;
  currency?: string;
  podaPoints?: number;
}

export interface ThreePillarWalletCardProps {
  balances: WalletBalances;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onReviewPending?: () => void;
  className?: string;
}

export const ThreePillarWalletCard: React.FC<ThreePillarWalletCardProps> = ({
  balances,
  onTopUp,
  onWithdraw,
  onReviewPending,
  className,
}) => {
  const { t } = useTranslations();
  const locale = useLocale();

  const currencyLabel = balances.currency || "DZD";

  const numberLocale =
    locale === "ar" ? "ar-DZ" : locale === "kab" ? "fr-DZ" : locale;

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <PodaciumCard
      variant="premium"
      padding="lg"
      className={cn("w-full overflow-hidden relative", className)}
      data-testid="three-pillar-wallet-card"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">
                {t(
                  "billing.wallet_overview",
                  "FinTech Vault & Double-Entry Ledger",
                )}
              </h3>
              <PodaciumBadge
                variant="success"
                className="text-[10px] font-mono uppercase tracking-wider"
              >
                <ShieldCheck className="w-3 h-3 me-1 inline-block" />
                {t("billing.tier1_compliant", "Bank of Algeria 06-2025 Tier 1")}
              </PodaciumBadge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                "billing.atomic_balance_formula",
                "Available Balance = Posted Balance − Pending Outbound Holds",
              )}
            </p>
          </div>
        </div>

        {/* Quick CTA Actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {onTopUp && (
            <PodaciumButton
              size="sm"
              variant="primary"
              glow
              onClick={onTopUp}
              className="flex-1 sm:flex-initial"
              data-testid="top-up-btn"
            >
              <ArrowDownLeft className="w-4 h-4 me-1.5" />
              {t("billing.deposit", "Recharger / Dépôt")}
            </PodaciumButton>
          )}
          {onWithdraw && (
            <PodaciumButton
              size="sm"
              variant="outline"
              onClick={onWithdraw}
              className="flex-1 sm:flex-initial"
              data-testid="withdraw-btn"
            >
              <ArrowUpRight className="w-4 h-4 me-1.5" />
              {t("billing.withdraw", "Retrait")}
            </PodaciumButton>
          )}
        </div>
      </div>

      {/* Three-Pillar Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
        {/* 1. Spendable Balance */}
        <PodaciumCard
          variant="default"
          padding="md"
          className="relative overflow-hidden transition-colors hover:border-primary/30"
          data-testid="pillar-spendable"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("billing.spendable_balance", "Solde Disponible")}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Wallet className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground tracking-tight">
              {formatAmount(balances.spendableDzd)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {currencyLabel}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {t(
              "billing.spendable_desc",
              "Fonds immédiatement débloqués pour retraits ou nouveaux contrats.",
            )}
          </p>
        </PodaciumCard>

        {/* 2. In Escrow */}
        <PodaciumCard
          variant="default"
          padding="md"
          className="relative overflow-hidden transition-colors hover:border-primary/30"
          data-testid="pillar-escrow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("billing.in_escrow", "En Séquestre (Escrow)")}
              </span>
              <PodaciumTooltip
                content={t(
                  "billing.escrow_tooltip",
                  "Secured in escrow vault. Released upon milestone inspection.",
                )}
                position="top"
              >
                <button
                  type="button"
                  aria-label={t(
                    "billing.escrow_info",
                    "Informations séquestre",
                  )}
                  className="text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </PodaciumTooltip>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Lock className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground tracking-tight">
              {formatAmount(balances.inEscrowDzd)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {currencyLabel}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {t(
              "billing.escrow_vault_active",
              "Sécurisé dans le coffre-fort séquestre. Libéré après validation des livrables.",
            )}
          </p>
        </PodaciumCard>

        {/* 3. Pending Clearance */}
        <PodaciumCard
          variant="default"
          padding="md"
          className="relative overflow-hidden transition-colors hover:border-primary/30"
          data-testid="pillar-clearance"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("billing.pending_clearance", "En Cours de Compensation")}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <Clock className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground tracking-tight">
              {formatAmount(balances.pendingClearanceDzd)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {currencyLabel}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                "billing.clearance_desc",
                "Recharges 3DS ou bordereaux BaridiMob en attente de validation.",
              )}
            </p>
            {balances.pendingClearanceDzd > 0 && onReviewPending && (
              <button
                type="button"
                onClick={onReviewPending}
                className="text-xs font-semibold text-primary hover:underline shrink-0 ms-2"
              >
                {t("common.details", "Détails")}
              </button>
            )}
          </div>
        </PodaciumCard>
      </div>
    </PodaciumCard>
  );
};

export default ThreePillarWalletCard;
