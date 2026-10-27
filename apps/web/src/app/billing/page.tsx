/**
 * Billing & Subscription Management Page
 * Handles Wallet, Subscriptions (Education/BI), and Transaction History
 */
"use client";

import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Wallet,
  AlertCircle,
  CheckCircle,
  History,
  Shield,
  Zap,
  Sparkles,
  Gem,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Lock,
  Star,
  TrendingUp,
  Loader2,
  LayoutDashboard,
  BookOpen,
  Award,
  Box,
} from "lucide-react";

import api, {
  PaymentGateway,
  PaymentPurpose,
  SubscriptionPlan,
  WalletResponse,
  TransactionResponse,
} from "../../lib/api";
import { paymentsApi } from "../../lib/api/payments";
import { useTranslations, useLocale, useBidi } from "../../lib/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { AuthRequiredModal } from "../../components/AuthRequiredModal";
import PaymentFailModal from "../../components/design-system/PaymentFailModal";
import RefundDialog from "../../components/billing/RefundDialog";
import FeatureStore from "../../components/billing/FeatureStore";
import PodaciumTabs from "../../components/design-system/PodaciumTabs";
import PodaciumProgressRing from "../../components/design-system/PodaciumProgressRing";
import PromoCodeInput from "../../components/billing/PromoCodeInput";
import PodaciumButton from "../../components/design-system/PodaciumButton";

import { useAuthGuard } from "../../hooks/useAuthGuard";

const Footer = lazy(() => import("../../components/Footer"));

const fetchWallet = async () => api.getUserWallet();
const fetchTransactions = async () => api.getUserTransactions({ limit: 10 });
const fetchSubscriptions = async () => api.getMySubscriptions();
const fetchOverview = async () => api.getBillingOverview();

const handleDownloadInvoice = async (txId: number) => {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const downloadUrl = `${apiUrl}/api/v1/billing/payments/invoices/${txId}/download`;
  try {
    const res = await fetch(downloadUrl, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Download request failed");
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Facture_TX_${txId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(downloadUrl, "_blank");
  }
};

// =============================================================================
// ANIMATION CONFIGURATIONS (BI STYLE)
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
} as const;

export default function BillingPage() {
  const router = useRouter();
  const t = useTranslations(["billing", "about", "common"]);
  const locale = useLocale();
  const { dir, forceLTR } = useBidi();
  const { user } = useAuth();

  // Auth Guard
  const {
    isAuthenticated,
    loading: authGuardLoading,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
  } = useAuthGuard({ redirectTo: "/auth/login", showModal: true });

  const { data: wallet, mutate: mutateWallet } = useSWR(
    isAuthenticated ? "wallet" : null,
    fetchWallet,
  );
  const { data: transactions, mutate: mutateTransactions } = useSWR(
    isAuthenticated ? "transactions" : null,
    fetchTransactions,
  );
  const { data: subscriptions } = useSWR(
    isAuthenticated ? "subscriptions" : null,
    fetchSubscriptions,
  );
  const { data: overview, mutate: mutateOverview } = useSWR(
    isAuthenticated ? "billing-overview" : null,
    fetchOverview,
  );

  const [isYearly, setIsYearly] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("500");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFailModal, setShowFailModal] = useState(false);
  const [refundTxId, setRefundTxId] = useState<number | null>(null);
  const [refundTxData, setRefundTxData] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "feature-store") {
      setActiveTab("features");
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [promoDiscountedAmount, setPromoDiscountedAmount] = useState<
    number | null
  >(null);
  const changePlan = useCallback(
    async (planId: string) => {
      try {
        await api.changePlan(planId);
        mutateOverview();
      } catch {
        /* ignore */
      }
    },
    [mutateOverview],
  );
  const searchParams = useSearchParams();
  const topUpRef = React.useRef<HTMLDivElement>(null);

  const handleRetry = useCallback(() => {
    setShowFailModal(false);
    setActiveTab("wallet");
    setTimeout(
      () =>
        topUpRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      100,
    );
  }, []);

  // Handle payment callback (redirect back from Chargily)
  useEffect(() => {
    const success = searchParams.get("success");
    const failure = searchParams.get("failure");
    const checkoutId = searchParams.get("checkout_id");
    if (success === "true") {
      if (checkoutId) {
        // Verify and finalize the checkout on the backend
        api
          .post("/api/billing/payments/verify-checkout", {
            checkout_id: checkoutId,
          })
          .then(() => {
            mutateWallet();
            mutateTransactions();
          })
          .catch(() => {
            /* webhook may have already handled it */
          });
      }
      setSuccessMessage(t("billing.payment.successMessage"));
      setTimeout(() => mutateWallet(), 2000);
      setTimeout(() => mutateTransactions(), 2000);
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("checkout_id");
      window.history.replaceState({}, "", url.toString());
    } else if (failure === "true" || (checkoutId && success !== "true")) {
      setShowFailModal(true);
      mutateWallet();
      mutateTransactions();
      const url = new URL(window.location.href);
      url.searchParams.delete("failure");
      url.searchParams.delete("checkout_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, mutateWallet, mutateTransactions, t]);

  const handleTopUp = async () => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
      setIsProcessing(true);

      const amountVal = parseFloat(topUpAmount);
      if (isNaN(amountVal) || amountVal < 200) {
        setError(t("billing.wallet.minAmount"));
        return;
      }

      const response = await paymentsApi.purchasePodaPoints(amountVal);

      const checkoutUrl = response?.checkout_url;
      const txId = response?.transaction_id;
      if (checkoutUrl) {
        if (txId) sessionStorage.setItem("pending_tx_id", String(txId));
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      console.error("Top-up failed", err);
      setError(t("billing.payment.failureMessage"));
    } finally {
      setIsProcessing(false);
    }
  };

  const executeSubscribe = async (
    plan: SubscriptionPlan,
    amount: number,
    billing_cycle: "monthly" | "yearly",
    promo_code?: string,
  ) => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);
      const origin = window.location.origin;
      const response = await api.subscribe({
        plan,
        amount: amount,
        success_url: `${origin}/billing?success=true`,
        failure_url: `${origin}/billing?failure=true`,
        billing_cycle,
        promo_code,
      });
      const txId = response?.data?.transactionId;
      if (response?.data?.checkout_url) {
        if (txId) sessionStorage.setItem("pending_tx_id", String(txId));
        window.location.href = response.data.checkout_url;
      }
    } catch (err: any) {
      setError(t("billing.payment.failureMessage"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async (
    plan: SubscriptionPlan,
    amount: number,
    billing_cycle: "monthly" | "yearly",
    promo_code?: string,
  ) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    await executeSubscribe(plan, amount, billing_cycle, promo_code);
  };

  const presetAmounts = ["200", "500", "1000", "2000"];

  // Fetch pricing from API (single source of truth from admin config)
  const [pricingData, setPricingData] = useState<any>(null);
  useEffect(() => {
    api
      .get<any>("/api/subscriptions/pricing")
      .then(setPricingData)
      .catch(console.error);
  }, []);

  const educationPlans = (() => {
    const planI18n: Record<string, { name: string; desc: string }> = {
      STUDENT_STARTER: {
        name: t("pricing.education.plans.starter"),
        desc: t("pricing.education.plans.starterDesc"),
      },
      STUDENT_PLUS: {
        name: t("pricing.education.plans.plus"),
        desc: t("pricing.education.plans.plusDesc"),
      },
      STUDENT_PRO: {
        name: t("pricing.education.plans.pro"),
        desc: t("pricing.education.plans.proDesc"),
      },
    };
    const edFeatures: string[][] = [
      [
        t("pricing.education.features.skillPassport"),
        t("pricing.education.features.tracking"),
      ],
      [
        t("pricing.education.features.skillPassport"),
        t("pricing.education.features.tracking"),
        t("pricing.education.features.certificates"),
      ],
      [
        t("pricing.education.features.skillPassport"),
        t("pricing.education.features.tracking"),
        t("pricing.education.features.certificates"),
        t("pricing.education.features.mentor"),
        t("pricing.education.features.priority"),
      ],
    ];
    const icons = [
      <Zap key="z" className="w-5 h-5" />,
      <Sparkles key="s" className="w-5 h-5" />,
      <Gem key="g" className="w-5 h-5" />,
    ];

    const apiPlans =
      pricingData?.edtech?.filter((p: any) => p.plan !== "FREE") || [];
    const plans =
      apiPlans.length > 0
        ? apiPlans
        : [
            {
              plan: "STUDENT_STARTER",
              price: 1900,
              yearly_price: 17900,
              max_courses: 3,
              trial_days: 7,
            },
            {
              plan: "STUDENT_PLUS",
              price: 3400,
              yearly_price: 31900,
              max_courses: 5,
              trial_days: 7,
            },
            {
              plan: "STUDENT_PRO",
              price: 5400,
              yearly_price: 49900,
              max_courses: 10,
              trial_days: 14,
            },
          ];

    return plans.map((p: any, i: number) => ({
      id: p.plan as SubscriptionPlan,
      name: planI18n[p.plan]?.name || p.name || p.plan,
      desc: planI18n[p.plan]?.desc || p.description || "",
      price: p.price,
      yearly_price: p.yearly_price,
      trialDays: p.trial_days,
      maxCourses: p.max_courses,
      icon: icons[i] || icons[0],
      features: edFeatures[i] || edFeatures[0],
    }));
  })();

  const biPlans = (() => {
    const planI18n: Record<string, { name: string; desc: string }> = {
      BI_GROWTH: {
        name: t("pricing.business.plans.starter"),
        desc: t("pricing.business.plans.starterDesc"),
      },
      BI_SCALE: {
        name: t("pricing.business.plans.growth"),
        desc: t("pricing.business.plans.growthDesc"),
      },
      BI_ELITE: {
        name: t("pricing.business.plans.pro"),
        desc: t("pricing.business.plans.proDesc"),
      },
    };
    const biFeatures: string[][] = [
      [
        t("pricing.business.features.cityLevel"),
        t("pricing.business.features.weeklyDigest"),
      ],
      [
        t("pricing.business.features.wilayaLevel"),
        t("pricing.business.features.salaryBenchmarks"),
        t("pricing.business.features.apiAccess"),
      ],
      [
        t("pricing.business.features.customReports"),
        t("pricing.business.features.hiringForecasts"),
        t("pricing.business.features.apiAccess"),
        t("pricing.business.features.dedicatedManager"),
      ],
    ];
    const icons = [
      <TrendingUp key="t" className="w-5 h-5" />,
      <Sparkles key="s" className="w-5 h-5" />,
      <Gem key="g" className="w-5 h-5" />,
    ];

    const apiPlans = pricingData?.bi || [];
    const plans =
      apiPlans.length > 0
        ? apiPlans
        : [
            {
              plan: "BI_GROWTH",
              price: 3500,
              yearly_price: 32900,
              max_datasets: 3,
              max_dashboards: 2,
              trial_days: 30,
            },
            {
              plan: "BI_SCALE",
              price: 8000,
              yearly_price: 74900,
              max_datasets: 10,
              max_dashboards: 10,
              trial_days: 14,
            },
            {
              plan: "BI_ELITE",
              price: 15000,
              yearly_price: 139900,
              max_datasets: 100,
              max_dashboards: 50,
              trial_days: 14,
            },
          ];

    return plans.map((p: any, i: number) => ({
      id: p.plan as SubscriptionPlan,
      name: planI18n[p.plan]?.name || p.name || p.plan,
      desc: planI18n[p.plan]?.desc || p.description || "",
      price: p.price,
      yearly_price: p.yearly_price,
      trialDays: p.trial_days,
      maxDatasets: p.max_datasets,
      maxDashboards: p.max_dashboards,
      icon: icons[i] || icons[0],
      features: biFeatures[i] || biFeatures[0],
    }));
  })();

  // Loading state
  if (authGuardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={dir}
    >
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />

      <PaymentFailModal
        isOpen={showFailModal}
        onClose={() => setShowFailModal(false)}
        onRetry={handleRetry}
      />

      <main className="max-w-7xl mx-auto pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        {" "}
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={ANIMATION_CONFIGS.EASING.ENTER}
          className="mb-12 text-center md:text-start"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 mb-4">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              {t("billing.wallet.secure")}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-4">
            {t("billing.title")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-slate-400 max-w-2xl">
            {t("billing.subtitle")}
          </p>
        </motion.header>
        {/* Payment callback banners */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm font-bold flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/50"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" /> {successMessage}
            <button
              onClick={() => setSuccessMessage(null)}
              className="ms-auto text-emerald-400 hover:text-emerald-600 dark:text-emerald-400"
            >
              &times;
            </button>
          </motion.div>
        )}
        <PodaciumTabs
          tabs={[
            {
              id: "overview",
              label: t("billing.overview.title"),
              icon: <LayoutDashboard className="w-4 h-4" />,
            },
            {
              id: "plans",
              label: t("billing.subscriptions.title"),
              icon: <Gem className="w-4 h-4" />,
            },
            {
              id: "wallet",
              label: t("billing.wallet.title"),
              icon: <Wallet className="w-4 h-4" />,
            },
            {
              id: "features",
              label: t("billing.features.title"),
              icon: <Box className="w-4 h-4" />,
            },
            {
              id: "history",
              label: t("billing.history.title"),
              icon: <History className="w-4 h-4" />,
            },
          ]}
          defaultTab="overview"
          variant="glass"
          onChange={setActiveTab}
          className="mb-6"
          tabsClassName="w-fit mx-auto"
        >
          {(tabId) => (
            <>
              {tabId === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={ANIMATION_CONFIGS.SPRING.SMOOTH}
                  className="space-y-8"
                >
                  {/* Current Plan Card */}
                  <div className="relative group overflow-hidden rounded-[2.5rem] shadow-2xl p-8 md:p-10 text-white">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-800" />
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] border border-white/10" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                          <Star className="w-8 h-8 text-amber-300" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-blue-200 text-xs font-black uppercase tracking-[0.3em]">
                              {t("billing.subscriptions.current")}
                            </span>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                          </div>
                          <h3 className="text-2xl md:text-3xl font-black leading-tight tracking-tighter text-white">
                            {subscriptions
                              ?.find((s) => s.status === "ACTIVE")
                              ?.plan.replace(/_/g, " ") ||
                              t("billing.overview.noSubscription")}
                          </h3>
                          {overview?.next_billing_date && (
                            <p className="text-blue-200/70 text-sm font-medium mt-1">
                              {t("billing.overview.nextBilling")}:{" "}
                              {new Date(
                                overview.next_billing_date,
                              ).toLocaleDateString(locale, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <PodaciumButton
                        variant="craft"
                        onClick={() => setActiveTab("plans")}
                        className="w-full md:w-auto h-12 px-6 rounded-xl font-bold shadow-md"
                      >
                        {t("billing.subscriptions.manage")}
                      </PodaciumButton>
                    </div>
                  </div>

                  {/* Usage Gauges */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-6 flex flex-col items-center gap-4">
                      <PodaciumProgressRing
                        progress={overview?.courses_progress || 0}
                        size={100}
                        strokeWidth={8}
                        variant="info"
                      />
                      <div className="text-center">
                        <p className="text-lg font-black text-gray-900 dark:text-slate-100">
                          {t("billing.usage.courses")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {overview?.courses_used || 0}/
                          {overview?.courses_total || 0}{" "}
                          {t("billing.usage.used")}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-6 flex flex-col items-center gap-4">
                      <PodaciumProgressRing
                        progress={overview?.certificates_progress || 0}
                        size={100}
                        strokeWidth={8}
                        variant="purple"
                      />
                      <div className="text-center">
                        <p className="text-lg font-black text-gray-900 dark:text-slate-100">
                          {t("billing.usage.certificates")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {overview?.certificates_earned || 0}/
                          {overview?.certificates_total || 0}{" "}
                          {t("billing.usage.used")}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-6 flex flex-col items-center gap-4">
                      <div className="w-[100px] h-[100px] rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border-4 border-emerald-100 dark:border-emerald-900/50">
                        <Wallet className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-gray-900 dark:text-slate-100">
                          {t("billing.overview.walletBalance")}
                        </p>
                        <p
                          className="text-sm text-gray-500 dark:text-slate-400"
                          dir="ltr"
                        >
                          {t("billing.wallet.podaPoints.points", {
                            count: (
                              overview?.poda_points ||
                              wallet?.podaPoints ||
                              0
                            ).toLocaleString(),
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Renewals */}
                  {overview?.pending_renewals &&
                    overview.pending_renewals.length > 0 && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 rounded-[2rem] border border-amber-200 dark:border-amber-800/80 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-8 pt-8 pb-4">
                          <h2 className="text-xl font-black text-amber-900 dark:text-amber-100 flex items-center gap-3">
                            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />{" "}
                            {t("billing.overview.pendingRenewals")}
                          </h2>
                        </div>
                        <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
                          {overview.pending_renewals.map(
                            (tx: any, idx: number) => (
                              <div
                                key={tx.id}
                                className="px-8 py-5 flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-bold text-gray-900 dark:text-slate-100">
                                    {t("billing.overview.subscriptionRenewal")}
                                  </p>
                                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                                    {tx.amount.toLocaleString()}{" "}
                                    {t("billing.wallet.currency")} —{" "}
                                    {new Date(tx.created_at).toLocaleDateString(
                                      locale,
                                    )}
                                  </p>
                                </div>
                                <a
                                  href={tx.checkout_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all hover:shadow-lg"
                                >
                                  {t("billing.overview.payNow")}{" "}
                                  <ArrowUpRight className="w-4 h-4" />
                                </a>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Recent Activity */}
                  <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-8 pt-8 pb-4">
                      <h2 className="text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-3">
                        <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />{" "}
                        {t("billing.overview.recentActivity")}
                      </h2>
                      <button
                        onClick={() => setActiveTab("history")}
                        className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors flex items-center gap-1"
                      >
                        {t("billing.overview.viewAll")}{" "}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    {overview?.recent_transactions &&
                    overview.recent_transactions.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {overview.recent_transactions
                          .slice(0, 5)
                          .map((tx: TransactionResponse, idx: number) => (
                            <motion.div
                              key={tx.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className="flex gap-4 items-center mb-3 sm:mb-0">
                                <div
                                  className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${tx.amount > 0 ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/60 text-rose-500"}`}
                                >
                                  {tx.amount > 0 ? (
                                    <ArrowDownLeft className="w-5 h-5" />
                                  ) : (
                                    <ArrowUpRight className="w-5 h-5" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    {tx.description ||
                                      t(
                                        `billing.payment.purpose.${tx.purpose}`,
                                      )}
                                  </div>
                                  <div className="text-xs text-gray-400 font-bold mt-0.5">
                                    {new Date(tx.createdAt).toLocaleDateString(
                                      locale,
                                      {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      },
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-start sm:text-end">
                                <div
                                  className={`text-xl font-black flex items-baseline justify-end gap-1 ${tx.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-slate-100"}`}
                                  dir="ltr"
                                >
                                  <span>
                                    {tx.amount > 0 ? "+" : ""}
                                    {tx.amount.toLocaleString()}
                                  </span>
                                  <span className="text-xs font-bold text-gray-400 uppercase">
                                    {t("billing.wallet.currency")}
                                  </span>
                                </div>
                                {tx.status === "COMPLETED" &&
                                  tx.purpose !== "REFUND" &&
                                  tx.purpose !==
                                    PaymentPurpose.PODAPOINT_PURCHASE &&
                                  tx.amount > 0 && (
                                    <button
                                      onClick={() =>
                                        handleDownloadInvoice(tx.id)
                                      }
                                      className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors border border-blue-100 dark:border-blue-900/50"
                                    >
                                      {t("billing.invoice.download")}
                                    </button>
                                  )}
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900/60 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-gray-100 dark:border-slate-800">
                          <History className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-lg font-black text-gray-900 dark:text-slate-100">
                          {t("billing.history.noTransactions")}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              {tabId === "plans" && (
                <motion.div
                  key="plans"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={ANIMATION_CONFIGS.SPRING.SMOOTH}
                  className="space-y-16"
                >
                  {/* Hero Subscription Card (Active Plan) */}
                  {subscriptions &&
                  subscriptions.some((s) => s.status === "ACTIVE") ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative group overflow-hidden rounded-[2.5rem] shadow-2xl p-10 md:p-14 text-white"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-800" />
                      {/* Glassmorphic overlay */}
                      <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] border border-white/10" />

                      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                            <Star className="w-10 h-10 text-amber-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-blue-200 text-sm font-black uppercase tracking-[0.3em]">
                                {t("billing.subscriptions.current")}
                              </span>
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                            </div>
                            <h3 className="text-4xl md:text-5xl font-black leading-tight tracking-tighter">
                              {subscriptions
                                .find((s) => s.status === "ACTIVE")
                                ?.plan.replace(/_/g, " ")}
                            </h3>
                          </div>
                        </div>
                        <PodaciumButton
                          variant="craft"
                          onClick={() => setActiveTab("plans")}
                          className="w-full md:w-auto h-12 px-8 rounded-xl font-bold shadow-lg"
                        >
                          {t("billing.subscriptions.manage")}
                        </PodaciumButton>
                      </div>
                    </motion.div>
                  ) : null}

                  {/* Plans Sections */}
                  <section className="space-y-10">
                    <div className="text-center md:text-start space-y-2 px-2">
                      <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                        {t("billing.subscriptions.education.title")}
                      </h2>
                      <p className="text-gray-500 dark:text-slate-400 font-medium">
                        {t("billing.subscriptions.education.subtitle")}
                      </p>
                    </div>

                    {/* Billing Toggle */}
                    {(() => {
                      const monthlyLabel = t("billing.subscriptions.monthly");
                      const yearlyLabel = t("billing.subscriptions.yearly");
                      const switchBg = isYearly ? "bg-blue-600" : "bg-gray-300";
                      const knobLeft =
                        dir === "rtl"
                          ? isYearly
                            ? "4px"
                            : "30px"
                          : isYearly
                            ? "30px"
                            : "4px";
                      return (
                        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                          <span
                            className={`text-sm font-bold whitespace-nowrap ${!isYearly ? "text-gray-900 dark:text-slate-100" : "text-gray-400"}`}
                          >
                            {monthlyLabel}
                          </span>
                          <button
                            onClick={() => setIsYearly(!isYearly)}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${switchBg}`}
                            role="switch"
                            aria-checked={isYearly}
                          >
                            <div
                              className="absolute top-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm transition-all duration-200"
                              style={{ left: knobLeft }}
                            />
                          </button>
                          <span
                            className={`text-sm font-bold whitespace-nowrap ${isYearly ? "text-gray-900 dark:text-slate-100" : "text-gray-400"}`}
                          >
                            {yearlyLabel}
                          </span>
                        </div>
                      );
                    })()}

                    {isYearly &&
                      (() => {
                        const savings = educationPlans.reduce(
                          (max: number, p: any) => {
                            const monthly = p.price || 0;
                            const yearly = p.yearly_price || p.price * 12 || 0;
                            if (monthly === 0) return max;
                            const savePct = Math.round(
                              ((monthly * 12 - yearly) / (monthly * 12)) * 100,
                            );
                            return Math.max(max, savePct);
                          },
                          0,
                        );
                        if (savings <= 0) return null;
                        return (
                          <div className="text-center">
                            <span className="inline-block px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800/80">
                              {t("billing.subscriptions.savePercent", {
                                percent: String(savings),
                              })}
                            </span>
                          </div>
                        );
                      })()}

                    <div className="max-w-md mx-auto mb-8">
                      <PromoCodeInput
                        amount={(() => {
                          const firstPlan = educationPlans[0];
                          return firstPlan
                            ? isYearly
                              ? firstPlan.yearly_price ||
                                firstPlan.price * 12 ||
                                0
                              : firstPlan.price || 0
                            : 0;
                        })()}
                        onApply={(code, discounted, original) => {
                          setPromoCode(code);
                          setPromoDiscountedAmount(discounted);
                        }}
                        onRemove={() => {
                          setPromoCode(undefined);
                          setPromoDiscountedAmount(null);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                      {educationPlans.map((plan: any, idx: number) => {
                        const isPopular = idx === 1;
                        const gradients = [
                          "from-blue-500 to-cyan-500",
                          "from-indigo-500 to-purple-500",
                          "from-purple-500 to-pink-500",
                        ];
                        return (
                          <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                              isPopular
                                ? "border-blue-500 shadow-lg shadow-blue-500/10"
                                : "border-gray-100 dark:border-slate-800 hover:border-gray-200"
                            }`}
                          >
                            {isPopular && (
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                                {t("pricing.common.mostPopular")}
                              </div>
                            )}

                            <div
                              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white mb-5`}
                            >
                              {plan.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                              {plan.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                              {plan.desc}
                            </p>

                            <div className="mb-6">
                              {(() => {
                                const displayPrice = isYearly
                                  ? plan.yearly_price || plan.price * 12 || 0
                                  : plan.price || 0;
                                return (
                                  <>
                                    <div
                                      className="flex items-baseline gap-2"
                                      dir="ltr"
                                    >
                                      <span className="text-4xl font-black text-gray-900 dark:text-slate-100">
                                        {displayPrice.toLocaleString()}
                                      </span>
                                      <span className="text-sm text-gray-400 font-medium">
                                        {t("billing.wallet.currency")}/
                                        {isYearly
                                          ? t("billing.subscriptions.perYear")
                                          : t("billing.subscriptions.perMonth")}
                                      </span>
                                    </div>
                                    {plan.trialDays > 0 && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                                        {t("pricing.common.trialDays", {
                                          days: String(plan.trialDays),
                                        })}
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex-1 space-y-3 mb-8">
                              {plan.maxCourses && (
                                <div className="flex items-center gap-2.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">
                                    {plan.maxCourses}{" "}
                                    {t(
                                      "pricing.education.features.coursesPerMonth",
                                    )}
                                  </span>
                                </div>
                              )}
                              {plan.features.map((f: string, fi: number) => (
                                <div
                                  key={fi}
                                  className="flex items-center gap-2.5"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">
                                    {f}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <PodaciumButton
                              variant={isPopular ? "gradient" : "craft"}
                              fullWidth
                              loading={isProcessing}
                              disabled={isProcessing}
                              className="h-12 rounded-xl text-sm font-bold"
                              onClick={() =>
                                handleSubscribe(
                                  plan.id,
                                  promoDiscountedAmount ??
                                    (isYearly
                                      ? plan.yearly_price ||
                                        plan.price * 12 ||
                                        0
                                      : plan.price || 0),
                                  isYearly ? "yearly" : "monthly",
                                  promoCode,
                                )
                              }
                            >
                              {isProcessing
                                ? t("billing.payment.processing")
                                : t("pricing.education.cta", {
                                    tier: plan.name,
                                  })}
                            </PodaciumButton>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Skill Passport Note */}
                    <div className="mt-6 max-w-2xl mx-auto p-5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                        {t("pricing.education.notes.skillPassportTitle")}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300/70 leading-relaxed">
                        {t("pricing.education.notes.skillPassportDesc")}
                      </p>
                    </div>
                  </section>

                  {/* BI Plans */}
                  <section className="space-y-10">
                    <div className="text-center md:text-start space-y-2 px-2">
                      <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                        {t("billing.subscriptions.bi.title")}
                      </h2>
                      <p className="text-gray-500 dark:text-slate-400 font-medium tracking-tight">
                        {t("billing.subscriptions.bi.subtitle")}
                      </p>
                    </div>

                    {isYearly &&
                      (() => {
                        const savings = biPlans.reduce(
                          (max: number, p: any) => {
                            const monthly = p.price || 0;
                            const yearly = p.yearly_price || p.price * 12 || 0;
                            if (monthly === 0) return max;
                            const savePct = Math.round(
                              ((monthly * 12 - yearly) / (monthly * 12)) * 100,
                            );
                            return Math.max(max, savePct);
                          },
                          0,
                        );
                        if (savings <= 0) return null;
                        return (
                          <div className="text-center">
                            <span className="inline-block px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800/80">
                              {t("billing.subscriptions.savePercent", {
                                percent: String(savings),
                              })}
                            </span>
                          </div>
                        );
                      })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                      {biPlans.map((plan: any, idx: number) => {
                        const isPopular = idx === 1;
                        const gradients = [
                          "from-purple-500 to-indigo-500",
                          "from-indigo-500 to-blue-500",
                          "from-blue-600 to-cyan-500",
                        ];
                        return (
                          <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                              isPopular
                                ? "border-purple-500 shadow-lg shadow-purple-500/10"
                                : "border-gray-100 dark:border-slate-800 hover:border-gray-200"
                            }`}
                          >
                            {isPopular && (
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                                {t("pricing.common.recommended")}
                              </div>
                            )}

                            <div
                              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white mb-5`}
                            >
                              {plan.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                              {plan.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                              {plan.desc}
                            </p>

                            <div className="mb-6">
                              {(() => {
                                const displayPrice = isYearly
                                  ? plan.yearly_price || plan.price * 12 || 0
                                  : plan.price || 0;
                                return (
                                  <>
                                    <div
                                      className="flex items-baseline gap-2"
                                      dir="ltr"
                                    >
                                      <span className="text-4xl font-black text-gray-900 dark:text-slate-100">
                                        {displayPrice.toLocaleString()}
                                      </span>
                                      <span className="text-sm text-gray-400 font-medium">
                                        {t("billing.wallet.currency")}/
                                        {isYearly
                                          ? t("billing.subscriptions.perYear")
                                          : t("billing.subscriptions.perMonth")}
                                      </span>
                                    </div>
                                    {plan.trialDays > 0 && (
                                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                                        {t("pricing.common.trialDays", {
                                          days: String(plan.trialDays),
                                        })}
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex-1 space-y-3 mb-8">
                              {plan.maxDatasets && (
                                <div className="flex items-center gap-2.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">
                                    {plan.maxDatasets}{" "}
                                    {t("pricing.business.features.datasets")}
                                  </span>
                                </div>
                              )}
                              {plan.maxDashboards && (
                                <div className="flex items-center gap-2.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">
                                    {plan.maxDashboards}{" "}
                                    {t("pricing.business.features.dashboards")}
                                  </span>
                                </div>
                              )}
                              {plan.features.map((f: string, fi: number) => (
                                <div
                                  key={fi}
                                  className="flex items-center gap-2.5"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">
                                    {f}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <PodaciumButton
                              variant={isPopular ? "gradient" : "craft"}
                              fullWidth
                              loading={isProcessing}
                              disabled={isProcessing}
                              className="h-12 rounded-xl text-sm font-bold"
                              onClick={() =>
                                handleSubscribe(
                                  plan.id,
                                  promoDiscountedAmount ??
                                    (isYearly
                                      ? plan.yearly_price ||
                                        plan.price * 12 ||
                                        0
                                      : plan.price || 0),
                                  isYearly ? "yearly" : "monthly",
                                  promoCode,
                                )
                              }
                            >
                              {isProcessing
                                ? t("billing.payment.processing")
                                : t("pricing.business.cta.startTrial")}
                            </PodaciumButton>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Freelance Note */}
                    <div className="mt-10 p-5 bg-emerald-50 dark:bg-emerald-950/40 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
                      <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium mb-1">
                        {t("pricing.freelancing.notes.howItWorksTitle")}
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/70 leading-relaxed">
                        {t("pricing.freelancing.notes.howItWorksDesc")}
                      </p>
                    </div>
                  </section>
                </motion.div>
              )}
              {tabId === "wallet" && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={ANIMATION_CONFIGS.SPRING.SMOOTH}
                  className="grid grid-cols-1 gap-8"
                >
                  {/* Wallet & Top-up */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-8">
                      {/* Premium Wallet Card */}
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl overflow-hidden">
                          <div className="absolute top-0 inset-inline-end-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -me-20 -mt-20 pointer-events-none" />
                          <div className="absolute bottom-0 inset-inline-start-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ms-20 -mb-20 pointer-events-none" />

                          <div className="relative z-10 space-y-10">
                            <div className="flex items-center justify-between">
                              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 shadow-inner">
                                <Wallet className="w-7 h-7 text-white" />
                              </div>
                              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                <span className="text-xs font-bold tracking-widest text-white/90 uppercase">
                                  {t("billing.wallet.secure")}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-blue-100/60 text-sm font-bold uppercase tracking-[0.2em] mb-3">
                                {t("billing.wallet.points")}
                              </p>
                              <div
                                className="flex items-baseline gap-3"
                                dir="ltr"
                              >
                                <span className="text-6xl md:text-7xl font-black tracking-tighter">
                                  {(wallet?.podaPoints || 0).toLocaleString()}
                                </span>
                                <span className="text-3xl font-bold text-blue-200/50 uppercase">
                                  {t("billing.wallet.podaPoints.pts")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Up Card */}
                      <div
                        ref={topUpRef}
                        className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-8 md:p-10 space-y-8"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                            <ArrowUpRight className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 leading-tight">
                            {t("billing.wallet.topUp")}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                          {presetAmounts.map((preset) => (
                            <button
                              key={preset}
                              onClick={() => setTopUpAmount(preset)}
                              className={`py-4 px-2 rounded-2xl border-2 text-sm font-black transition-all duration-300 ${
                                topUpAmount === preset
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                                  : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-blue-200 hover:bg-blue-50/30"
                              }`}
                            >
                              <span>
                                {t("billing.wallet.podaPoints.points", {
                                  count:
                                    dir === "rtl" ? forceLTR(preset) : preset,
                                })}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="relative group">
                          <input
                            type="number"
                            value={topUpAmount}
                            onChange={(e) => setTopUpAmount(e.target.value)}
                            className="w-full px-6 py-5 bg-gray-50/50 dark:bg-slate-800/60 border-2 border-transparent rounded-[1.5rem] focus:bg-white dark:bg-slate-900 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-2xl transition-all text-center"
                            placeholder={t("billing.wallet.customAmount")}
                            dir="ltr"
                          />
                        </div>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-3 border border-red-100 dark:border-red-900/50"
                          >
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />{" "}
                            {t(error)}
                          </motion.div>
                        )}

                        <PodaciumButton
                          variant="gradient"
                          fullWidth
                          size="xl"
                          loading={isProcessing}
                          disabled={isProcessing}
                          onClick={handleTopUp}
                          className="h-14 rounded-2xl text-base font-black"
                          icon={<Lock className="w-5 h-5" />}
                        >
                          {isProcessing
                            ? t("billing.wallet.processing")
                            : t("billing.wallet.proceed")}
                        </PodaciumButton>

                        <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                          {t("billing.wallet.chargilyNotice")}
                        </p>
                      </div>
                    </div>

                    {/* PodaPoints Explainer Card */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.2,
                        ...ANIMATION_CONFIGS.SPRING.SMOOTH,
                      }}
                      className="relative group"
                    >
                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000" />
                      <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-8 md:p-10 overflow-hidden">
                        <div className="absolute top-0 inset-inline-end-0 w-48 h-48 bg-emerald-50 dark:bg-emerald-950/60 rounded-full blur-3xl -me-16 -mt-16 pointer-events-none" />
                        <div className="absolute bottom-0 inset-inline-start-0 w-32 h-32 bg-teal-50 dark:bg-teal-950/60 rounded-full blur-3xl -ms-12 -mb-12 pointer-events-none" />

                        <div className="relative z-10 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-200">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-slate-100">
                              {t("billing.wallet.info.title")}
                            </h3>
                          </div>

                          <div className="space-y-5">
                            {[
                              {
                                icon: Zap,
                                color: "from-amber-400 to-orange-500",
                                text: "billing.wallet.info.rate",
                              },
                              {
                                icon: Clock,
                                color: "from-blue-400 to-indigo-500",
                                text: "billing.wallet.info.expiry",
                              },
                              {
                                icon: Sparkles,
                                color: "from-purple-400 to-pink-500",
                                text: "billing.wallet.info.features",
                              },
                              {
                                icon: Shield,
                                color: "from-emerald-400 to-teal-500",
                                text: "billing.wallet.info.secure",
                              },
                            ].map((item, idx) => (
                              <motion.div
                                key={item.text}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  delay: 0.3 + idx * 0.1,
                                  duration: 0.4,
                                  ease: [0.4, 0, 0.2, 1],
                                }}
                                className="flex items-start gap-4 group/bullet"
                              >
                                <div
                                  className={`p-2 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg shrink-0 mt-0.5 transition-transform duration-300 group-hover/bullet:scale-110 group-hover/bullet:rotate-3`}
                                >
                                  <item.icon className="w-4 h-4" />
                                </div>
                                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed font-medium">
                                  {t(item.text)}
                                </p>
                              </motion.div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                            <p
                              className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center"
                              dir="ltr"
                            >
                              1 DZD = 1 {t("billing.wallet.points")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
              {tabId === "features" && (
                <motion.div
                  key="features"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={ANIMATION_CONFIGS.SPRING.SMOOTH}
                >
                  <div id="feature-store">
                    <FeatureStore
                      walletPodaPoints={wallet?.podaPoints || 0}
                      onSuccess={() => {
                        mutateWallet();
                        mutateTransactions();
                      }}
                    />
                  </div>
                </motion.div>
              )}
              {tabId === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={ANIMATION_CONFIGS.SPRING.SMOOTH}
                >
                  <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden min-h-[500px]">
                    <div className="px-8 pt-8 pb-4">
                      <h2 className="text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-3">
                        <History className="w-7 h-7 text-blue-600 dark:text-blue-400" />{" "}
                        {t("billing.history.title")}
                      </h2>
                    </div>
                    {transactions && transactions.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {transactions.map(
                          (tx: TransactionResponse, idx: number) => (
                            <motion.div
                              key={tx.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className="flex gap-5 items-center mb-4 sm:mb-0">
                                <div
                                  className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${tx.amount > 0 ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/60 text-rose-500"}`}
                                >
                                  {tx.amount > 0 ? (
                                    <ArrowDownLeft className="w-6 h-6" />
                                  ) : (
                                    <ArrowUpRight className="w-6 h-6" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-black text-gray-900 dark:text-slate-100 text-lg group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    {(() => {
                                      if (tx.description) return tx.description;
                                      if (
                                        tx.metadata?.plan &&
                                        (tx.purpose ===
                                          "STUDENT_SUBSCRIPTION" ||
                                          tx.purpose === "BI_SUBSCRIPTION")
                                      ) {
                                        const plan = [
                                          ...educationPlans,
                                          ...biPlans,
                                        ].find(
                                          (p) => p.id === tx.metadata!.plan,
                                        );
                                        if (plan) {
                                          const category = t(
                                            `billing.payment.purpose.${tx.purpose}`,
                                          );
                                          return `${category}: ${plan.name}`;
                                        }
                                      }
                                      return t(
                                        `billing.payment.purpose.${tx.purpose}`,
                                      );
                                    })()}
                                  </div>
                                  <div className="text-sm text-gray-400 font-bold tracking-tight mt-0.5 uppercase">
                                    {new Date(tx.createdAt).toLocaleDateString(
                                      locale,
                                      {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      },
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-start sm:text-end border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-50 dark:border-slate-800/60">
                                <div
                                  className={`text-2xl font-black flex items-baseline justify-end gap-1 ${tx.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-slate-100"}`}
                                  dir="ltr"
                                >
                                  <span>
                                    {tx.amount > 0 ? "+" : ""}
                                    {tx.amount.toLocaleString()}
                                  </span>
                                  <span className="text-sm font-bold text-gray-400 uppercase">
                                    {t("billing.wallet.currency")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
                                  <div
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] inline-flex px-2 py-0.5 rounded-full ${
                                      tx.status === "COMPLETED"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : tx.status === "REFUNDED"
                                          ? "bg-orange-100 text-orange-700"
                                          : tx.status === "PENDING" &&
                                              tx.purpose === "REFUND"
                                            ? "bg-blue-100 text-blue-700"
                                            : tx.status === "PENDING"
                                              ? "bg-amber-100 text-amber-700"
                                              : tx.status === "CANCELLED"
                                                ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                                                : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {tx.status === "PENDING" &&
                                    tx.purpose === "REFUND"
                                      ? t(
                                          "billing.payment.status.refund_pending",
                                        )
                                      : t(
                                          `billing.payment.status.${tx.status.toLowerCase()}`,
                                        )}
                                  </div>
                                  {tx.status === "PENDING" &&
                                    (tx as any).checkout_url && (
                                      <a
                                        href={(tx as any).checkout_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 transition-colors border border-amber-200 dark:border-amber-800/80"
                                      >
                                        {t("billing.overview.payNow")}{" "}
                                        <ArrowUpRight className="w-3 h-3" />
                                      </a>
                                    )}
                                  {tx.status === "COMPLETED" &&
                                    tx.purpose !== "REFUND" &&
                                    tx.purpose !==
                                      PaymentPurpose.PODAPOINT_PURCHASE &&
                                    tx.amount > 0 && (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleDownloadInvoice(tx.id)
                                          }
                                          className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors border border-blue-100 dark:border-blue-900/50"
                                        >
                                          {t("billing.invoice.download")}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setRefundTxId(tx.id);
                                            setRefundTxData({
                                              amount: tx.amount,
                                              currency: tx.currency || "DZD",
                                            });
                                          }}
                                          className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:bg-red-950/60 transition-colors border border-rose-100 dark:border-rose-900/50"
                                        >
                                          {t("billing.payment.refund.title")}
                                        </button>
                                      </>
                                    )}
                                </div>
                              </div>
                            </motion.div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-24 text-center space-y-6">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-slate-900/60 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-gray-100 dark:border-slate-800">
                          <History className="w-10 h-10 text-gray-200" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xl font-black text-gray-900 dark:text-slate-100">
                            {t("billing.history.noTransactions")}
                          </p>
                          <p className="text-sm text-gray-400 max-w-[200px] leading-relaxed">
                            {t("billing.history.noTransactionsDesc")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </PodaciumTabs>
      </main>

      <RefundDialog
        isOpen={refundTxId !== null}
        onClose={() => {
          setRefundTxId(null);
          setRefundTxData(null);
        }}
        transactionId={refundTxId ?? 0}
        transactionAmount={refundTxData?.amount || 0}
        transactionCurrency={refundTxData?.currency || "DZD"}
        onSuccess={() => {
          mutateWallet();
          mutateTransactions();
        }}
      />

      <Suspense
        fallback={<div className="h-64 bg-gray-50 dark:bg-slate-900/60"></div>}
      >
        <Footer />
      </Suspense>
    </div>
  );
}
