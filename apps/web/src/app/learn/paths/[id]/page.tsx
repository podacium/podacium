"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, Home } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useBidi, useTranslations } from "@/lib/i18n";
import api, { apiHelpers } from "@/lib/api";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BreadcrumbJsonLd } from "@/components/StructuredData";
import WalletPaymentModal from "@/components/billing/WalletPaymentModal";
import PaymentFailModal from "@/components/design-system/PaymentFailModal";
import PromoCodeInput from "@/components/billing/PromoCodeInput";
import PathEnrollmentCTA from "./components/PathEnrollmentCTA";
import PathHero from "./components/PathHero";
import PathStatsBar from "./components/PathStatsBar";
import PathCurriculum from "./components/PathCurriculum";
import PathCertificate from "./components/PathCertificate";
import {
  AccessState,
  ModuleStatus,
  type Permissions,
} from "./components/types";

const ACCESS_LEVELS: Record<string, Permissions> = {
  UNAUTHENTICATED: {
    canViewPath: true,
    canEnroll: false,
    canAccessModules: false,
    canDownloadResources: false,
    canGenerateCertificate: false,
    canAccessAnalytics: false,
    canSaveProgress: false,
    canRequestSupport: false,
    canSharePath: true,
    canBookmarkPath: false,
  },
  AUTHENTICATED_NOT_ENROLLED: {
    canViewPath: true,
    canEnroll: true,
    canAccessModules: false,
    canDownloadResources: false,
    canGenerateCertificate: false,
    canAccessAnalytics: false,
    canSaveProgress: false,
    canRequestSupport: true,
    canSharePath: true,
    canBookmarkPath: true,
  },
  ENROLLED: {
    canViewPath: true,
    canEnroll: false,
    canAccessModules: true,
    canDownloadResources: true,
    canGenerateCertificate: true,
    canAccessAnalytics: true,
    canSaveProgress: true,
    canRequestSupport: true,
    canSharePath: true,
    canBookmarkPath: true,
  },
};

export default function LearningPathPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();
  const t = useTranslations();

  const [path, setPath] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [moduleProgress, setModuleProgress] = useState<Record<string, any>>({});
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(0);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{
    amount: number;
    promo_code?: string;
    skip_wallet: boolean;
  } | null>(null);
  const [promoCode, setPromoCode] = useState<string | undefined>(undefined);
  const [promoDiscountedAmount, setPromoDiscountedAmount] = useState<
    number | null
  >(null);
  const [showFailModal, setShowFailModal] = useState(false);
  const [dismissedFailModal, setDismissedFailModal] = useState(false);

  const accessState = !isAuthenticated
    ? AccessState.UNAUTHENTICATED
    : enrollments.some((e) => e.pathId === id || e.path?.id === id)
      ? AccessState.ENROLLED
      : AccessState.AUTHENTICATED_NOT_ENROLLED;
  const permissions = ACCESS_LEVELS[accessState];
  const isEnrolled = accessState === AccessState.ENROLLED;
  const isCompleted = overallProgress >= 100;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pathData, enrData] = await Promise.all([
        apiHelpers.education.getPath(id),
        isAuthenticated
          ? apiHelpers.education.getMyEnrollments().catch(() => [])
          : [],
      ]);
      setPath(pathData);
      setEnrollments(enrData || []);
      setEnrolledCount(pathData.enrolled_count || pathData.enrolled || 0);

      const isUserEnrolled =
        isAuthenticated &&
        (enrData || []).some((e: any) => e.pathId === id || e.path?.id === id);

      if (pathData.modules) {
        setModules(pathData.modules);

        // Fetch actual lesson progress for enrolled users
        const lessonProgressMap: Record<string, boolean> = {};
        if (isUserEnrolled) {
          try {
            const rawProgresses =
              await apiHelpers.education.getMyLessonProgresses();
            const progresses = Array.isArray(rawProgresses)
              ? rawProgresses
              : (rawProgresses as any)?.items || [];
            for (const p of progresses) {
              lessonProgressMap[p.lessonId || p.lesson_id] =
                p.isCompleted || p.completed || false;
            }
          } catch {
            /* progress fetch is non-critical */
          }
        }

        const mp: Record<string, any> = {};
        let total = 0,
          completed = 0;
        const compMods: string[] = [];
        for (const mod of pathData.modules) {
          if (mod.lessons) {
            const done = mod.lessons.filter(
              (l: any) => lessonProgressMap[l.id] || l.isCompleted,
            ).length;
            const pct =
              mod.lessons.length > 0 ? (done / mod.lessons.length) * 100 : 0;
            mp[mod.id] = {
              progress: pct,
              completedLessons: done,
              totalLessons: mod.lessons.length,
              status:
                done === mod.lessons.length
                  ? ModuleStatus.COMPLETED
                  : done > 0
                    ? ModuleStatus.IN_PROGRESS
                    : ModuleStatus.AVAILABLE,
            };
            total += mod.lessons.length;
            completed += done;
            if (done === mod.lessons.length) compMods.push(mod.id);
          }
        }
        setModuleProgress(mp);
        setCompletedModules(compMods);
        setOverallProgress(total > 0 ? (completed / total) * 100 : 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setWalletBalance(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!id) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("podacium_bookmarked_paths") || "[]",
      );
      setBookmarked(Array.isArray(saved) && saved.includes(id));
    } catch {
      setBookmarked(false);
    }
  }, [id]);

  const handleBookmark = useCallback(() => {
    if (!id) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("podacium_bookmarked_paths") || "[]",
      );
      const isSaved = Array.isArray(saved) && saved.includes(id);
      let updated: string[];
      let newBookmarked: boolean;
      if (isSaved) {
        updated = saved.filter((pathId: string) => pathId !== id);
        newBookmarked = false;
        toast.info(
          t("path.social.unbookmarked") ||
            t("course.social.bookmarkToggle") ||
            "Path removed from bookmarks",
        );
      } else {
        updated = [...(Array.isArray(saved) ? saved : []), id];
        newBookmarked = true;
        toast.success(
          t("path.social.bookmarked") ||
            t("course.social.bookmarkToggle") ||
            "Path saved to bookmarks",
        );
      }
      localStorage.setItem(
        "podacium_bookmarked_paths",
        JSON.stringify(updated),
      );
      setBookmarked(newBookmarked);
    } catch {
      setBookmarked((prev) => !prev);
      toast.info(t("course.social.bookmarkToggle"));
    }
  }, [id, t]);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: path?.title || t("paths.labels.learningPath"),
      text: path?.description || t("paths.recommendations.defaultDescription"),
      url: shareUrl,
    };
    try {
      if (navigator.share && typeof navigator.share === "function") {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(
          t("path.social.linkCopied") || t("course.social.linkCopied"),
        );
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(
          t("path.social.linkCopied") || t("course.social.linkCopied"),
        );
      } catch {
        toast.error(t("course.social.failedToCopy"));
      }
    }
  }, [path, t]);

  // ── Payment verification polling (fallback for missed Chargily webhooks) ──
  const searchParams = useSearchParams();
  const paymentPollingRef = useRef(false);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const checkoutId = searchParams.get("checkout_id");

    if (!checkoutId || !user || !isAuthenticated) return;

    if (paymentStatus === "failure") {
      setShowFailModal(true);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment");
        url.searchParams.delete("checkout_id");
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }

    if (paymentStatus !== "success") return;
    if (paymentPollingRef.current) return;
    paymentPollingRef.current = true;

    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 3000;

    const poll = async () => {
      const timer = setInterval(async () => {
        attempts++;
        try {
          const result = await api.getCheckoutStatus(checkoutId);
          if (result.enrolled) {
            clearInterval(timer);
            await fetchData();
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("payment");
              url.searchParams.delete("checkout_id");
              window.history.replaceState({}, "", url.toString());
            }
            return;
          }
          if (attempts >= maxAttempts) {
            clearInterval(timer);
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(timer);
          }
        }
      }, intervalMs);
    };
    poll();
  }, [searchParams, user, isAuthenticated, fetchData]);

  const pathPrice =
    path &&
    (typeof path.price === "object"
      ? path.price.discounted || path.price.original || path.price.amount || 0
      : typeof path?.price === "number"
        ? path.price
        : 0);

  const handleEnroll = async (skipWallet?: boolean) => {
    if (typeof skipWallet !== "boolean") skipWallet = undefined;
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    const price = promoDiscountedAmount ?? (pathPrice as number);
    if (
      !skipWallet &&
      price > 0 &&
      walletBalance !== null &&
      walletBalance >= price
    ) {
      setPendingPurchase({
        amount: price,
        promo_code: promoCode,
        skip_wallet: false,
      });
      setShowWalletModal(true);
      return;
    }

    setIsEnrolling(true);
    try {
      if (price > 0) {
        const origin = window.location.origin;
        const response = await api.purchasePath({
          path_id: id,
          amount: price,
          success_url: `${origin}/learn/paths/${id}?payment=success`,
          failure_url: `${origin}/learn/paths/${id}?payment=failure`,
          promo_code: promoCode,
          skip_wallet: skipWallet ?? false,
        });
        if (response?.data?.paid_with_wallet) {
          await fetchData();
          return;
        }
        if (response?.data?.checkout_url) {
          window.location.href = response.data.checkout_url;
          return;
        }
        throw new Error("errors.billing.failed_to_initiate_payment");
      }

      const enrollment = await apiHelpers.education.enrollInPath(id);
      if (enrollment) {
        setEnrollments((prev) => [...prev, enrollment]);
        await fetchData();
      }
    } catch (e: any) {
      toast.error(e?.message || t("path.enrollmentCta.errors.enrollFailed"));
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleWalletPay = async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    setPromoCode(pendingPurchase.promo_code);
    await handleEnroll(false);
    setPendingPurchase(null);
  };

  const handleCardPay = async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    setPromoCode(pendingPurchase.promo_code);
    await handleEnroll(true);
    setPendingPurchase(null);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
        dir={dir}
      >
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          {/* Hero Skeleton */}
          <div className="relative h-[420px] bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-800 dark:to-slate-900 animate-pulse">
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-16">
              <div className="flex gap-2 mb-4">
                <div className="h-6 w-20 bg-gray-300/80 dark:bg-slate-700/80 rounded-full" />
                <div className="h-6 w-16 bg-gray-300/80 dark:bg-slate-700/80 rounded-full" />
              </div>
              <div className="h-10 w-2/3 bg-gray-300/70 dark:bg-slate-700/70 rounded-xl mb-3" />
              <div className="h-4 w-1/2 bg-gray-300/60 dark:bg-slate-700/60 rounded-lg mb-2" />
              <div className="h-4 w-1/3 bg-gray-300/60 dark:bg-slate-700/60 rounded-lg mb-6" />
              <div className="flex gap-3">
                <div className="h-12 w-40 bg-gray-300/70 dark:bg-slate-700/70 rounded-xl" />
                <div className="h-12 w-12 bg-gray-300/60 dark:bg-slate-700/60 rounded-xl" />
                <div className="h-12 w-12 bg-gray-300/60 dark:bg-slate-700/60 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Stats Bar Skeleton */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
            <div className="flex gap-8 justify-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-12 bg-gray-200 dark:bg-slate-800/90 rounded" />
                    <div className="h-3 w-16 bg-gray-100 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Curriculum + Sidebar Skeleton */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-gray-200 dark:bg-slate-800/90 rounded" />
                        <div className="h-3 w-1/2 bg-gray-100 dark:bg-slate-800 rounded" />
                      </div>
                      <div className="h-6 w-16 bg-gray-100 dark:bg-slate-800 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-slate-800/90 rounded mb-4" />
                  <div className="h-3 w-full bg-gray-100 dark:bg-slate-800 rounded mb-3" />
                  <div className="h-3 w-3/4 bg-gray-100 dark:bg-slate-800 rounded mb-4" />
                  <div className="h-10 w-full bg-gray-200 dark:bg-slate-800/90 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (!path) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
        dir={dir}
      >
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-48 pb-56 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                {t("path.errors.notFound")}
              </h1>
              <p className="text-gray-600 dark:text-slate-400 mb-8">
                {t("path.errors.notFoundDescription")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push("/learn/paths")}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                >
                  <Home className="w-4 h-4 mr-3 ml-3 inline" />
                  {t("path.buttons.browsePaths")}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all duration-300"
                >
                  <RefreshCw className="w-4 h-4 mr-3 ml-3 inline" />
                  {t("path.buttons.tryAgain")}
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={dir}
    >
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <BreadcrumbJsonLd
          items={[
            { name: t("learn.nav.breadcrumb.home"), url: "/" },
            { name: t("learn.nav.breadcrumb.learn"), url: "/learn" },
            { name: t("learn.quickActions.paths"), url: "/learn/paths" },
            ...(path ? [{ name: path.title }] : []),
          ]}
        />

        <AuthRequiredModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={() => router.push("/auth/login")}
          onSignup={() => router.push("/auth/signup")}
        />

        <WalletPaymentModal
          isOpen={showWalletModal}
          onClose={() => {
            setShowWalletModal(false);
            setPendingPurchase(null);
          }}
          amount={pendingPurchase?.amount || 0}
          walletBalance={walletBalance || 0}
          onPayWithWallet={handleWalletPay}
          onPayWithCard={handleCardPay}
          processing={isEnrolling}
        />

        <PaymentFailModal
          isOpen={showFailModal && !dismissedFailModal}
          onClose={() => setDismissedFailModal(true)}
          onRetry={handleEnroll}
        />

        {/* Hero Section */}
        {(() => {
          const nextCourse =
            modules.find((m) => !completedModules.includes(m.id)) || modules[0];
          return (
            <PathHero
              path={path}
              modulesCount={modules.length}
              isEnrolled={isEnrolled}
              isCompleted={isCompleted}
              progress={overallProgress}
              accessState={accessState}
              isRtl={isRTL}
              t={t}
              onEnroll={handleEnroll}
              onShare={handleShare}
              onBookmark={handleBookmark}
              isBookmarked={bookmarked}
              isEnrolling={isEnrolling}
              enrolledCount={enrolledCount}
              nextCourseId={nextCourse?.id}
            />
          );
        })()}

        {/* Stats Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          className="px-4 sm:px-6 lg:px-8 py-12"
        >
          <div className="max-w-7xl mx-auto">
            <PathStatsBar
              modulesCount={modules.length}
              duration={path.totalDuration}
              enrolledCount={enrolledCount}
              rating={path.rating}
              progress={overallProgress}
              isEnrolled={isEnrolled}
              t={t}
            />
          </div>
        </motion.section>

        {/* Main Content Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
          className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-slate-800/60 min-h-[600px]"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <PathCurriculum
                  modules={modules}
                  moduleProgress={moduleProgress}
                  completedModules={completedModules}
                  isEnrolled={isEnrolled}
                  isRtl={isRTL}
                  t={t}
                />
              </div>

              <div className="space-y-6">
                {!isEnrolled && pathPrice > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
                      {t("billing.payment.chooseMethod")}
                    </h3>
                    <PromoCodeInput
                      amount={
                        typeof promoDiscountedAmount === "number"
                          ? promoDiscountedAmount
                          : pathPrice
                      }
                      onApply={(code, discounted) => {
                        setPromoCode(code);
                        setPromoDiscountedAmount(discounted);
                      }}
                      onRemove={() => {
                        setPromoCode(undefined);
                        setPromoDiscountedAmount(null);
                      }}
                    />
                  </div>
                )}

                <PathCertificate
                  isCompleted={isCompleted}
                  pathId={id}
                  isRtl={isRTL}
                  t={t}
                />

                {isEnrolled && overallProgress > 0 && (
                  <div className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
                      {t("path.modules.sections.yourProgress")}
                    </h3>
                    <div className="space-y-3">
                      {modules.slice(0, 5).map((mod) => {
                        const mp = moduleProgress[mod.id];
                        return mp ? (
                          <div key={mod.id}>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                              <span className="truncate">{mod.title}</span>
                              <span>{Math.round(mp.progress)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${mp.progress}%` }}
                              />
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {!isEnrolled && (
          <PathEnrollmentCTA
            path={path}
            onEnroll={() => handleEnroll()}
            isLoading={isEnrolling}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
