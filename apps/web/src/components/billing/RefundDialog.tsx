import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  RotateCcw,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Minus,
  Plus,
  Calculator,
  ExternalLink,
  Shield,
} from "lucide-react";
import PodaciumModal from "../design-system/PodaciumModal";
import PodaciumButton from "../design-system/PodaciumButton";
import { useTranslations, useBidi } from "../../lib/i18n";
import { paymentsApi } from "../../lib/api/payments";

interface RefundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: number;
  transactionAmount: number; // in cents
  transactionCurrency: string;
  proRataMaxAmount?: number; // in cents
  onSuccess: () => void;
}

interface RefundApiResponse {
  status: string;
  refund_id: number;
  original_transaction_id: number;
  refund_amount: number;
  pro_rata_max_amount: number;
  is_partial: boolean;
}

export default function RefundDialog({
  isOpen,
  onClose,
  transactionId,
  transactionAmount,
  transactionCurrency,
  proRataMaxAmount,
  onSuccess,
}: RefundDialogProps) {
  const t = useTranslations();
  const { dir } = useBidi();

  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<number | "">(transactionAmount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proRataMax, setProRataMax] = useState<number | null>(
    proRataMaxAmount || null,
  );
  const [showProRataInfo, setShowProRataInfo] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [refundInfo, setRefundInfo] = useState<{
    eligible: boolean;
    reason: string | null;
    pro_rata_max_amount: number;
    time_remaining_days: number;
  } | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Fetch refund info when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (proRataMaxAmount) {
        setProRataMax(proRataMaxAmount);
        setAmount(proRataMaxAmount);
        setRefundInfo(null);
        setInfoError(null);
        return;
      }
      setIsLoadingInfo(true);
      setInfoError(null);
      paymentsApi
        .getRefundInfo(transactionId)
        .then((info) => {
          setRefundInfo(info);
          if (!info.eligible) {
            setInfoError(
              info.reason || t("billing.payment.refund.notEligible"),
            );
          } else {
            const max = info.pro_rata_max_amount;
            setProRataMax(max);
            setAmount(max);
          }
        })
        .catch((err: any) => {
          setInfoError(err?.message || t("billing.payment.refund.error"));
        })
        .finally(() => {
          setIsLoadingInfo(false);
        });
    }
  }, [isOpen, transactionId, proRataMaxAmount, t]);

  const formatAmount = (cents: number) => {
    return (cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (value: string) => {
    if (value === "") {
      setAmount("");
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setAmount(numValue);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    const amountValue = typeof amount === "number" ? amount : transactionAmount;
    if (amountValue <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = (await paymentsApi.requestRefund(
        transactionId,
        reason.trim(),
        amountValue,
      )) as RefundApiResponse;
      if (result.status === "refund_requested") {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2500);
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("already")) {
        setError(t("billing.payment.refund.alreadyRequested"));
      } else if (msg.includes("pro-rata") || msg.includes("maximum")) {
        setError(msg);
      } else {
        setError(t("billing.payment.refund.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setAmount(transactionAmount);
    setError(null);
    setSuccess(false);
    setIsSubmitting(false);
    setConsentAcknowledged(false);
    onClose();
  };

  const incrementAmount = () => {
    const current = typeof amount === "number" ? amount : transactionAmount;
    const max = proRataMax || transactionAmount;
    if (current < max) {
      setAmount(Math.min(current + 100, max));
    }
  };

  const decrementAmount = () => {
    const current = typeof amount === "number" ? amount : transactionAmount;
    const min = 100; // minimum 1.00
    if (current > min) {
      setAmount(Math.max(current - 100, min));
    }
  };

  const maxAmount = proRataMax || transactionAmount;
  const isPartial = proRataMax && proRataMax < transactionAmount;

  const showForm = !infoError || refundInfo?.eligible === true;

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("billing.payment.refund.title")}
      description={t("billing.payment.refund.description")}
      size="lg"
    >
      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-8 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {t("billing.payment.refund.success")}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("billing.payment.refund.successDesc")}
          </p>
        </motion.div>
      ) : isLoadingInfo ? (
        <div className="flex flex-col items-center py-12 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-800/80 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("billing.payment.refund.checking")}
          </p>
        </div>
      ) : !showForm ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-8 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-base text-gray-900 dark:text-slate-100 font-bold">
            {t("billing.payment.refund.notEligible")}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm">
            {infoError}
          </p>
          {refundInfo && refundInfo.time_remaining_days > 0 && (
            <p className="text-xs text-gray-400">
              {t("billing.payment.refund.windowRemaining", {
                days: String(refundInfo.time_remaining_days),
              })}
            </p>
          )}
          <PodaciumButton variant="outline" onClick={handleClose}>
            {t("billing.payment.refund.cancel")}
          </PodaciumButton>
        </motion.div>
      ) : (
        <div className="space-y-5" dir={dir}>
          {/* Reason Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300">
              {t("billing.payment.refund.reason")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("billing.payment.refund.reasonPlaceholder")}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border-2 border-gray-100 dark:border-slate-800 rounded-xl focus:border-red-300 dark:border-red-700 focus:bg-white dark:bg-slate-900 focus:ring-4 focus:ring-red-100 outline-none text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 transition-all resize-none"
              dir={dir}
            />
          </div>

          {/* Amount Input with Pro-Rata Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300">
                {t("billing.payment.refund.amount")}
              </label>
              {isPartial && (
                <button
                  type="button"
                  onClick={() => setShowProRataInfo(!showProRataInfo)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  <Calculator className="w-3 h-3" />
                  <span>{t("billing.payment.refund.proRataInfo")}</span>
                  <HelpCircle className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold"
                dir="ltr"
              >
                {transactionCurrency}
              </span>
              <input
                type="number"
                value={amount === "" ? "" : amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                min={100}
                max={maxAmount}
                step={100}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border-2 border-gray-100 dark:border-slate-800 rounded-xl focus:border-blue-300 dark:border-blue-700 focus:bg-white dark:bg-slate-900 focus:ring-4 focus:ring-blue-100 outline-none text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 transition-all text-right"
                dir="ltr"
                disabled={isSubmitting}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                ({formatAmount(typeof amount === "number" ? amount : 0)}{" "}
                {transactionCurrency})
              </span>
            </div>

            {/* Amount Controls */}
            <div className="flex items-center gap-3">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={decrementAmount}
                disabled={
                  isSubmitting ||
                  (typeof amount === "number" ? amount : transactionAmount) <=
                    100
                }
                icon={<Minus className="w-4 h-4" />}
                className="flex-1"
              >
                {t("billing.payment.refund.decrease")}
              </PodaciumButton>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={incrementAmount}
                disabled={
                  isSubmitting ||
                  (typeof amount === "number" ? amount : transactionAmount) >=
                    maxAmount
                }
                icon={<Plus className="w-4 h-4" />}
                className="flex-1"
              >
                {t("billing.payment.refund.increase")}
              </PodaciumButton>
            </div>

            {/* Pro-Rata Max Info */}
            {showProRataInfo && proRataMax && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-xl text-sm text-blue-800 dark:text-blue-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="w-4 h-4" />
                  <span className="font-bold">
                    {t("billing.payment.refund.proRataMax")}
                  </span>
                </div>
                <p className="text-blue-700 dark:text-blue-300">
                  {t("billing.payment.refund.proRataDesc", {
                    max: formatAmount(proRataMax),
                    currency: transactionCurrency,
                  })}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {t("billing.payment.refund.proRataNote")}
                </p>
              </motion.div>
            )}

            {/* Original Amount Reference */}
            {isPartial && (
              <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-between">
                <span>{t("billing.payment.refund.originalAmount")}</span>
                <span
                  className="font-bold text-gray-700 dark:text-slate-300"
                  dir="ltr"
                >
                  {formatAmount(transactionAmount)} {transactionCurrency}
                </span>
              </div>
            )}
          </div>

          {/* Withdrawal Rights Notice */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-bold">
                  {t("billing.payment.refund.withdrawalRight")}
                </p>
                <p>{t("billing.payment.refund.withdrawalRightDetail")}</p>
                <Link
                  href="/refund"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 underline hover:text-amber-900 font-medium"
                >
                  {t("billing.payment.refund.viewPolicy")}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <label className="flex items-start gap-3 mt-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentAcknowledged}
                onChange={(e) => setConsentAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-amber-600 dark:text-amber-400 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-800 dark:text-amber-200 group-hover:text-amber-900">
                {t("billing.payment.refund.consentAcknowledgment")}
              </span>
            </label>
          </motion.div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 dark:border-red-900/50"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <PodaciumButton
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              {t("billing.payment.refund.cancel")}
            </PodaciumButton>
            <PodaciumButton
              variant="destructive"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={
                !reason.trim() ||
                !consentAcknowledged ||
                (typeof amount === "number" ? amount : transactionAmount) <= 0
              }
              icon={<RotateCcw className="w-4 h-4" />}
              className="flex-1"
            >
              {isSubmitting
                ? t("billing.payment.refund.submitting")
                : t("billing.payment.refund.submit")}
            </PodaciumButton>
          </div>
        </div>
      )}
    </PodaciumModal>
  );
}
