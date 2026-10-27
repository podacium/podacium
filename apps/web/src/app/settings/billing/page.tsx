"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  CreditCard,
  Crown,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle,
  Trash2,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";

interface BillingData {
  plan: "free" | "pro" | "enterprise";
  payment_methods: PaymentMethod[];
  invoices: Invoice[];
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface Invoice {
  id: string;
  transaction_id?: number;
  download_url?: string;
  invoice_id?: number;
  invoice_number?: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  date: string;
  description: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const getCardBrand = (num: string): string => {
  const clean = num.replace(/\D/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^(5[1-5]|22[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "Amex";
  if (/^(6011|65)/.test(clean)) return "Discover";
  if (/^9833/.test(clean)) return "CIB";
  if (/^6035/.test(clean)) return "Edahabia";
  return "Visa";
};

const formatCardNumber = (value: string): string => {
  const clean = value.replace(/\D/g, "").slice(0, 19);
  const parts = clean.match(/[\s\S]{1,4}/g) || [];
  return parts.join(" ");
};

const formatExpDate = (value: string): string => {
  const clean = value.replace(/\D/g, "").slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
};

const BillingPage = () => {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [isDefaultCard, setIsDefaultCard] = useState(false);

  // Plan Switch & Invoice Receipt Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadInvoicePdf = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const cleanTxId =
        invoice.transaction_id ||
        (invoice.id.startsWith("inv_") ? invoice.id.replace("inv_", "") : null);
      const targetUrl =
        invoice.download_url ||
        (cleanTxId
          ? `/api/v1/billing/payments/invoices/${cleanTxId}/download`
          : `/api/v1/invoices/${invoice.invoice_id || invoice.id}/download`);

      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(
        /\/$/,
        "",
      );
      const fullUrl = targetUrl.startsWith("http")
        ? targetUrl
        : `${baseUrl}${targetUrl}`;

      const res = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Download failed");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Facture_${invoice.invoice_number || invoice.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download invoice PDF:", err);
      setSelectedInvoice(invoice);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleChangePlan = async (newPlan: string) => {
    setChangingPlan(true);
    try {
      await api.put("/api/v1/settings/billing/plan", { plan: newPlan });
      setIsPlanModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to change plan", err);
    } finally {
      setChangingPlan(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const curr = (currency || "DZD").toUpperCase();
    const effectiveAmount = curr === "DZD" ? amount : amount / 100;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: curr === "DZD" ? 0 : 2,
    }).format(effectiveAmount);
  };

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<BillingData>("/api/v1/settings/billing");
      setData({
        plan: result.plan || "free",
        payment_methods: result.payment_methods || [],
        invoices: result.invoices || [],
      });
    } catch {
      setError(tUser("settings.billing.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError(null);

    const cleanNum = cardNumber.replace(/\D/g, "");
    if (!cardholderName.trim()) {
      setCardError(tUser("settings.billing.errorCardholder"));
      return;
    }
    if (cleanNum.length < 13 || cleanNum.length > 19) {
      setCardError(tUser("settings.billing.errorCardNumber"));
      return;
    }
    const expMatch = expDate.match(/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/);
    if (!expMatch) {
      setCardError(tUser("settings.billing.errorExpDate"));
      return;
    }
    const expMonth = parseInt(expMatch[1], 10);
    let expYear = parseInt(expMatch[2], 10);
    if (expYear < 100) expYear += 2000;
    const currentYear = new Date().getFullYear();
    if (expYear < currentYear) {
      setCardError(tUser("settings.billing.errorCardExpired"));
      return;
    }
    if (cvc.replace(/\D/g, "").length < 3) {
      setCardError(tUser("settings.billing.errorCvc"));
      return;
    }

    setSubmittingCard(true);
    try {
      const brand = getCardBrand(cleanNum);
      const last4 = cleanNum.slice(-4);
      const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      await api.post("/api/v1/settings/billing/payment-method", {
        cardholder_name: cardholderName,
        brand,
        last4,
        exp_month: expMonth,
        exp_year: expYear,
        is_default: isDefaultCard,
        token,
        type: "card",
      });

      setIsModalOpen(false);
      setCardholderName("");
      setCardNumber("");
      setExpDate("");
      setCvc("");
      setIsDefaultCard(false);
      await fetchData();
    } catch (err: any) {
      setCardError(err?.message || tUser("settings.billing.addCardError"));
    } finally {
      setSubmittingCard(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      await api.put(
        `/api/v1/settings/billing/payment-method/${methodId}/default`,
      );
      await fetchData();
    } catch (err: any) {
      console.error("Failed to set default payment method", err);
    }
  };

  const handleRemoveCard = async (methodId: string) => {
    try {
      await api.delete(`/api/v1/settings/billing/payment-method/${methodId}`);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to remove payment method", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {tCommon("loading")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <p className="text-gray-700 dark:text-slate-300 font-medium">{error}</p>
        <PodaciumButton onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 me-2" />
          {tCommon("retry")}
        </PodaciumButton>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      dir={dir}
    >
      <motion.div variants={itemVariants}>
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <Link
            href="/settings"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {tUser("settings.title")}
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {tUser("settings.tabs.billing")}
          </span>
        </nav>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            {tUser("settings.billing.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
            {tUser("settings.billing.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Subscription Card */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
              <Crown className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.billing.currentPlan")}
            </h2>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gradient-to-br from-blue-50/60 via-indigo-50/40 to-purple-50/40 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xl font-extrabold text-gray-900 dark:text-slate-100 capitalize">
                  {data?.plan === "pro"
                    ? tUser("settings.billing.proPlanTitle")
                    : data?.plan === "enterprise"
                      ? tUser("settings.billing.enterprisePlanTitle")
                      : tUser("settings.billing.freePlanTitle")}
                </span>
                <PodaciumBadge
                  variant={data?.plan === "pro" ? "warning" : "secondary"}
                >
                  {data?.plan === "pro"
                    ? tUser("settings.billing.proBadge")
                    : tUser("settings.billing.freeBadge")}
                </PodaciumBadge>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {data?.plan === "free"
                  ? tUser("settings.billing.freePlanDesc")
                  : tUser("settings.billing.proPlanDesc")}
              </p>
            </div>
            <PodaciumButton onClick={() => setIsPlanModalOpen(true)} glow>
              <Crown className="h-4 w-4 me-2" />
              {data?.plan === "free"
                ? tUser("settings.billing.upgradeCTA")
                : tUser("settings.billing.changePlanCTA")}
            </PodaciumButton>
          </div>
        </div>
      </motion.div>

      {/* Payment Methods Card */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.billing.paymentMethods")}
            </h2>
          </div>
          <PodaciumButton
            size="sm"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4 me-1" />
            {tUser("settings.billing.addPaymentMethod")}
          </PodaciumButton>
        </div>
        <div className="p-6">
          {data?.payment_methods && data.payment_methods.length > 0 ? (
            <div className="space-y-3">
              {data.payment_methods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 shadow-xs">
                      <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-slate-100">
                        {method.brand} •••• {method.last4}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {tUser("settings.billing.expires")} {method.exp_month}/
                        {method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.is_default ? (
                      <PodaciumBadge variant="success">
                        {tCommon("default")}
                      </PodaciumBadge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(method.id)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {tUser("settings.billing.makeDefault")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveCard(method.id)}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      aria-label={tUser("settings.billing.removePaymentMethod")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {tUser("settings.billing.noPaymentMethods")}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Payment Method Tokenization Modal */}
      <PodaciumModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCardError(null);
        }}
        title={tUser("settings.billing.modalTitle")}
        description={tUser("settings.billing.modalDesc")}
        size="md"
      >
        <form onSubmit={handleAddCard} className="space-y-4">
          {cardError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{cardError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">
              {tUser("settings.billing.cardholderName")}
            </label>
            <input
              type="text"
              required
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder={tUser("settings.billing.cardholderPlaceholder")}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-200 flex items-center justify-between">
              <span>{tUser("settings.billing.cardNumber")}</span>
              {cardNumber && (
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {getCardBrand(cardNumber)}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={cardNumber}
                onChange={(e) =>
                  setCardNumber(formatCardNumber(e.target.value))
                }
                placeholder={tUser("settings.billing.cardNumberPlaceholder")}
                maxLength={23}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-mono text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
              />
              <CreditCard className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                {tUser("settings.billing.expDate")}
              </label>
              <input
                type="text"
                required
                value={expDate}
                onChange={(e) => setExpDate(formatExpDate(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-mono text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                {tUser("settings.billing.cvc")}
              </label>
              <input
                type="password"
                required
                value={cvc}
                onChange={(e) =>
                  setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="•••"
                maxLength={4}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-mono text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isDefaultCard"
              checked={isDefaultCard}
              onChange={(e) => setIsDefaultCard(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="isDefaultCard"
              className="text-xs font-medium text-gray-700 dark:text-slate-300 cursor-pointer"
            >
              {tUser("settings.billing.setAsDefault")}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <PodaciumButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              {tCommon("cancel")}
            </PodaciumButton>
            <PodaciumButton
              type="submit"
              size="sm"
              disabled={submittingCard}
              glow
            >
              {submittingCard ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  <span>{tCommon("submitting")}</span>
                </>
              ) : (
                <span>{tUser("settings.billing.addCardBtn")}</span>
              )}
            </PodaciumButton>
          </div>
        </form>
      </PodaciumModal>

      {/* Invoice History */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.billing.invoices")}
            </h2>
          </div>
        </div>
        <div className="p-6">
          {data?.invoices && data.invoices.length > 0 ? (
            <div className="space-y-3">
              {data.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        invoice.status === "paid"
                          ? "bg-emerald-100 text-emerald-600"
                          : invoice.status === "pending"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-red-100 text-red-600"
                      }`}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {invoice.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {new Date(invoice.date).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ms-auto sm:ms-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                    <PodaciumBadge
                      variant={
                        invoice.status === "paid"
                          ? "success"
                          : invoice.status === "pending"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {invoice.status.toUpperCase()}
                    </PodaciumBadge>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoicePdf(invoice)}
                      disabled={downloadingId === invoice.id}
                      aria-label={tCommon("downloadInvoice", {
                        id: invoice.id,
                      })}
                      className="p-2 rounded-xl text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors disabled:opacity-50"
                    >
                      {downloadingId === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {tUser("settings.billing.noInvoices")}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Plan Switch Modal */}
      <PodaciumModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={tUser("settings.billing.switchPlanTitle")}
        description={tUser("settings.billing.switchPlanDesc")}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
          {[
            {
              planKey: "free",
              name: tUser("settings.billing.plans.freeName"),
              price: tUser("settings.billing.plans.freePrice"),
              desc: tUser("settings.billing.plans.freeDesc"),
            },
            {
              planKey: "pro",
              name: tUser("settings.billing.plans.proName"),
              price: tUser("settings.billing.plans.proPrice"),
              desc: tUser("settings.billing.plans.proDesc"),
            },
            {
              planKey: "enterprise",
              name: tUser("settings.billing.plans.enterpriseName"),
              price: tUser("settings.billing.plans.enterprisePrice"),
              desc: tUser("settings.billing.plans.enterpriseDesc"),
            },
          ].map(({ planKey, name, price, desc }) => (
            <div
              key={planKey}
              className={`p-5 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                data?.plan === planKey
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/40"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                    {name}
                  </span>
                  {data?.plan === planKey && (
                    <PodaciumBadge variant="success">
                      {tCommon("default")}
                    </PodaciumBadge>
                  )}
                </div>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                  {price}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {desc}
                </p>
              </div>
              <div className="pt-4">
                <PodaciumButton
                  size="sm"
                  variant={data?.plan === planKey ? "outline" : "primary"}
                  disabled={data?.plan === planKey || changingPlan}
                  onClick={() => handleChangePlan(planKey)}
                  className="w-full"
                >
                  {changingPlan ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : data?.plan === planKey ? (
                    tUser("settings.billing.plans.activePlan")
                  ) : (
                    tUser("settings.billing.plans.switchTo", { name })
                  )}
                </PodaciumButton>
              </div>
            </div>
          ))}
        </div>
      </PodaciumModal>

      {/* Invoice Receipt Detail Modal */}
      <PodaciumModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={tUser("settings.billing.receipt.title", {
          id: selectedInvoice?.id || "",
        })}
        description={tUser("settings.billing.receipt.description")}
        size="md"
      >
        {selectedInvoice && (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{tUser("settings.billing.receipt.colDescription")}</span>
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {selectedInvoice.description}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{tUser("settings.billing.receipt.colDate")}</span>
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {new Date(selectedInvoice.date).toLocaleDateString(locale, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{tUser("settings.billing.receipt.colGateway")}</span>
                <span className="font-bold text-emerald-600">
                  {tUser("settings.billing.receipt.chargilyPay")}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-200 dark:border-slate-800">
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {tUser("settings.billing.receipt.totalPaid")}
                </span>
                <span className="font-extrabold text-base text-gray-900 dark:text-slate-100">
                  {formatCurrency(
                    selectedInvoice.amount,
                    selectedInvoice.currency,
                  )}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                {tUser("settings.billing.receipt.close")}
              </PodaciumButton>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
              >
                {tUser("settings.billing.receipt.printPdf")}
              </PodaciumButton>
              <PodaciumButton
                size="sm"
                onClick={() => handleDownloadInvoicePdf(selectedInvoice)}
                disabled={downloadingId === selectedInvoice.id}
              >
                {downloadingId === selectedInvoice.id ? (
                  <Loader2 className="w-4 h-4 animate-spin me-1.5" />
                ) : (
                  <Download className="w-4 h-4 me-1.5" />
                )}
                {tCommon("downloadInvoice")}
              </PodaciumButton>
            </div>
          </div>
        )}
      </PodaciumModal>
    </motion.div>
  );
};

export default BillingPage;
