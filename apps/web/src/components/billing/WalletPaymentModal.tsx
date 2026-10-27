import React from "react";
import { Wallet, CreditCard } from "lucide-react";
import PodaciumModal from "../design-system/PodaciumModal";
import PodaciumButton from "../design-system/PodaciumButton";
import { useTranslations, useBidi } from "../../lib/i18n";

/**
 * @deprecated Use FeatureStore with PodaPoints instead.
 * Kept for backward compatibility with live booking and learn paths
 * that have not yet migrated to the PodaPoints feature-monetization model.
 */
interface WalletPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  walletBalance: number;
  onPayWithWallet: () => void;
  onPayWithCard: () => void;
  processing: boolean;
  description?: string;
}

/**
 * @deprecated Use FeatureStore with PodaPoints instead.
 * Kept for backward compatibility with live booking, learn paths, and course pages
 * that have not yet migrated to the PodaPoints feature-monetization model.
 */
export default function WalletPaymentModal({
  isOpen,
  onClose,
  amount,
  walletBalance,
  onPayWithWallet,
  onPayWithCard,
  processing,
  description,
}: WalletPaymentModalProps) {
  const t = useTranslations();
  const { dir } = useBidi();
  const sufficient = walletBalance >= amount;
  const remaining = amount - walletBalance;

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("billing.payment.chooseMethod")}
      size="md"
    >
      <div className="space-y-6" dir={dir}>
        {description && (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center">
            {description}
          </p>
        )}

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {t("billing.wallet.balance")}
            </span>
            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
            {walletBalance.toLocaleString()} {t("billing.wallet.currency")}
          </p>
          {!sufficient && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              {t("billing.payment.walletShortfall", {
                amount: remaining.toLocaleString(),
              })}
            </p>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-gray-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
              {t("billing.subscriptions.total")}
            </span>
            <span className="text-xl font-black text-gray-900 dark:text-slate-100">
              {amount.toLocaleString()} {t("billing.wallet.currency")}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <PodaciumButton
            variant="primary"
            onClick={onPayWithWallet}
            loading={processing}
            disabled={!sufficient || processing}
            icon={<Wallet className="w-5 h-5" />}
            className="w-full justify-center"
            size="lg"
          >
            {sufficient
              ? t("billing.payment.payWithWallet")
              : t("billing.payment.insufficientWallet")}
          </PodaciumButton>

          <PodaciumButton
            variant="outline"
            onClick={onPayWithCard}
            disabled={processing}
            icon={<CreditCard className="w-5 h-5" />}
            className="w-full justify-center"
            size="lg"
          >
            {t("billing.payment.payWithCard")}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
}
