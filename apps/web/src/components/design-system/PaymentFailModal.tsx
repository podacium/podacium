"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  X,
  RefreshCw,
  LayoutDashboard,
  HeadphonesIcon,
  Ban,
} from "lucide-react";
import { PodaciumModal } from "./PodaciumModal";
import { useTranslations, useLocale, useBidi } from "../../lib/i18n";

interface PaymentFailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export default function PaymentFailModal({
  isOpen,
  onClose,
  onRetry,
}: PaymentFailModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { dir, forceLTR } = useBidi();
  const isRTL = dir === "rtl";
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState(false);

  useEffect(() => {
    if (isOpen && !cancelled && !isCancelling) {
      cancelPendingTransaction();
    }
  }, [isOpen]);

  const cancelPendingTransaction = async () => {
    setIsCancelling(true);
    setCancelError(false);
    try {
      const { apiClient } = await import("../../lib/api/client");
      await apiClient.post("/api/payments/cancel-all-pending");
      setCancelled(true);
    } catch {
      setCancelError(true);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGoToDashboard = () => {
    router.push(`/${locale !== "en" ? locale : ""}/dashboard`);
  };

  const handleDismiss = () => {
    onClose();
    if (onRetry) {
      setTimeout(() => onRetry(), 100);
    }
  };

  const currency = t("billing.wallet.currency");

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      closeOnOverlay={false}
    >
      <div className="space-y-5" dir={dir}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">
              {t("billing.payment.failureModal.title")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
              {t("billing.payment.failureModal.message")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
            {t("billing.payment.failureReasons.heading")}
          </p>
          <ul className="space-y-1.5">
            {["insufficientFunds", "cardVerification", "connection"].map(
              (reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"
                >
                  <span className="mt-0.5 flex-shrink-0">•</span>
                  <span>{t(`billing.payment.failureReasons.${reason}`)}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 flex items-start gap-3">
          <HeadphonesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            {t("billing.payment.failureModal.contact")}
          </p>
        </div>

        {(isCancelling || cancelled || cancelError) && (
          <div
            className={`rounded-xl p-3 flex items-center gap-2 text-sm ${
              cancelled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : cancelError
                  ? "bg-red-50 text-red-600 border border-red-100"
                  : "bg-gray-50 dark:bg-slate-900/60 text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800"
            }`}
          >
            {isCancelling ? (
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-700 border-t-gray-600 rounded-full animate-spin" />
            ) : cancelled ? (
              <Ban className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="font-medium text-xs">
              {isCancelling
                ? t("billing.payment.processing")
                : cancelled
                  ? t("billing.payment.autoCancel")
                  : t("billing.payment.failureMessage")}
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={handleGoToDashboard}
            className="flex-1 py-3.5 px-5 rounded-xl border-2 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 order-2 sm:order-1"
          >
            <LayoutDashboard className="w-4 h-4" />
            {t("billing.payment.failureModal.backToDashboard")}
          </button>
          {onRetry && (
            <button
              onClick={handleDismiss}
              className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200/50 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t("billing.payment.failureModal.retry")}
            </button>
          )}
        </div>
      </div>
    </PodaciumModal>
  );
}
