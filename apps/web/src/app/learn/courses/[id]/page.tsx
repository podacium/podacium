// app/learn/courses/[id]/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  useRef,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Clock,
  Users,
  Star,
  Award,
  FileText,
  Lock,
  Play,
  CheckCircle,
  ChevronRight,
  BookOpen,
  Layers,
  Video,
  FileCode,
  Music,
  RefreshCw,
  AlertCircle,
  Loader2,
  Zap,
  Target,
  TrendingUp,
  Home,
  User,
  ChevronLeft,
  Database,
  Cloud,
  Wifi,
  WifiOff,
  RotateCw,
  Save,
  Shield,
  Bell,
  Download,
  MonitorCheck,
  Box,
  FolderOpen,
  HelpCircle,
  BarChart3,
  MessageSquare,
} from "lucide-react";

import Footer from "@/components/Footer";
import { CourseJsonLd, BreadcrumbJsonLd } from "@/components/StructuredData";
import { useAuth } from "@/contexts/AuthContext";
import AccessControl from "@/components/course/AccessControl";
import {
  api,
  apiHelpers,
  ModuleResponse,
  LessonResponse,
  EnrollmentResponse,
  LessonProgressResponse,
  UserLearningStats,
  AuthenticationError,
  ApiError,
} from "@/lib/api";
import { toast } from "sonner";
import { useTranslations, useBidi } from "@/lib/i18n";

// Import modular pieces
import {
  AccessState,
  LessonStatus,
  SyncStatus,
  Permissions,
  PriceInfo,
} from "./types";
import { usePublicCourseData } from "./hooks/usePublicCourseData";
import { useCourseData } from "./hooks/useCourseData";
import { useCurriculumState } from "./hooks/useCurriculumState";
import { useCourseAccess } from "./hooks/useCourseAccess";
import {
  formatDuration,
  calculateProgress,
  getPriceInfo,
  normalizePrice,
  getLessonIcon,
} from "./utils";
import ProgressBar from "./components/ProgressBar";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import LessonCard from "./components/LessonCard";
import ModuleAccordion from "./components/ModuleAccordion";
import EnrollmentCTA from "./components/EnrollmentCTA";
import { LockedCourseCTA } from "./components/LockedCourseCTA";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import {
  CourseHeaderSkeleton,
  CurriculumSkeleton,
  InstructorCardSkeleton,
} from "./components/Skeletons";

const VideoPlayer = dynamic(
  () => import("./components/VideoPlayer").then((m) => m.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video bg-gray-900 rounded-2xl animate-pulse" />
    ),
  },
);

const QuizEngine = dynamic(
  () => import("./components/QuizEngine").then((m) => m.QuizEngine),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

const ResourcesManager = dynamic(
  () => import("./components/ResourcesManager").then((m) => m.ResourcesManager),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

const AnalyticsDashboard = dynamic(
  () =>
    import("./components/AnalyticsDashboard").then((m) => m.AnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

const CertificateGenerator = dynamic(
  () =>
    import("./components/CertificateGenerator").then(
      (m) => m.CertificateGenerator,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

const ActionButtons = dynamic(
  () => import("./components/ActionButtons").then((m) => m.ActionButtons),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

const ReviewForm = dynamic(
  () => import("./components/ReviewForm").then((m) => m.ReviewForm),
  {
    ssr: false,
    loading: () => null,
  },
);

import WalletPaymentModal from "../../../../components/billing/WalletPaymentModal";
import PaymentFailModal from "../../../../components/design-system/PaymentFailModal";
import PromoCodeInput from "../../../../components/billing/PromoCodeInput";

const ReviewList = dynamic(
  () => import("./components/ReviewList").then((m) => m.ReviewList),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
    ),
  },
);

// =============================================================================
// 3. CUSTOM HOOKS
// =============================================================================

// Redundant hook removed

// useCourseData removed

// useCurriculumState and useCourseAccess removed

// =============================================================================
// 4. MAIN COURSE PAGE COMPONENT
// =============================================================================

// =============================================================================
// 8. MAIN COURSE PAGE COMPONENT
// =============================================================================

export default function CoursePage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const isRtl = dir === "rtl";
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const courseId = params.id as string;

  // For public users
  const publicData = usePublicCourseData(courseId);

  // For authenticated users
  const {
    state: {
      module: authenticatedModule,
      lessons,
      enrollment,
      lessonProgress,
      userStats,
      isLoading: authenticatedLoading,
      isEnrolling,
      error: courseError,
      syncStatus,
      pendingUpdatesCount,
      lastSyncTime,
      showFailModal,
    },
    actions: {
      enrollInCourse,
      completeLesson,
      saveProgress,
      getLastVideoPosition,
      forceSyncToDatabase,
    },
  } = useCourseData(courseId);

  const [dismissedFailModal, setDismissedFailModal] = useState(false);
  const effectiveShowFailModal = showFailModal && !dismissedFailModal;

  // Use appropriate data source
  const courseModule = isAuthenticated
    ? authenticatedModule
    : publicData.module;
  const isLoading = isAuthenticated
    ? authenticatedLoading
    : publicData.isLoading;
  const error = isAuthenticated ? courseError : publicData.error;

  const isInstructorOrAdmin =
    user &&
    courseModule &&
    (user.id === courseModule.instructorId || user.role === "ADMIN");
  const hasAccess = enrollment || isInstructorOrAdmin;

  // Curriculum state
  const {
    expandedModules,
    activeLessonId,
    activeLesson,
    overallProgress,
    getLessonStatus,
    getLessonProgress,
    getNextLessonId,
    getPreviousLessonId,
    toggleModuleExpansion,
    handleLessonSelect,
  } = useCurriculumState(
    isAuthenticated && hasAccess ? lessons : [],
    enrollment,
    lessonProgress,
  );

  const { accessState, permissions } = useCourseAccess(
    isAuthenticated,
    enrollment,
    overallProgress,
    user,
    courseModule,
  );

  // State for video playback
  const [videoMilestones, setVideoMilestones] = useState([
    {
      id: "25",
      timestamp: 0,
      percentage: 25,
      completed: false,
      type: "content" as const,
    },
    {
      id: "50",
      timestamp: 0,
      percentage: 50,
      completed: false,
      type: "content" as const,
    },
    {
      id: "75",
      timestamp: 0,
      percentage: 75,
      completed: false,
      type: "content" as const,
    },
    {
      id: "90",
      timestamp: 0,
      percentage: 90,
      completed: false,
      type: "content" as const,
    },
  ]);

  // Tab selection state
  const [activeTab, setActiveTab] = useState<
    | "video"
    | "quiz"
    | "resources"
    | "analytics"
    | "certificate"
    | "actions"
    | "reviews"
  >("video");

  // Wallet & promo state
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

  useEffect(() => {
    // Wallet DZD removed — all payments go through Chargily checkout
    setWalletBalance(null);
  }, [isAuthenticated]);

  // Prevent enrolled users from staying on the video tab since it's moved to the hero
  useEffect(() => {
    if (accessState === AccessState.ENROLLED && activeTab === "video") {
      setActiveTab("quiz");
    }
  }, [accessState, activeTab]);

  // Review modal state
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Bookmark state
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("podacium_bookmarked_courses") || "[]",
      );
      setBookmarked(Array.isArray(saved) && saved.includes(courseId));
    } catch {
      setBookmarked(false);
    }
  }, [courseId]);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: courseModule?.title || t("course.header.defaultCategory"),
      text: courseModule?.description || t("course.header.noDescription"),
      url: shareUrl,
    };
    try {
      if (navigator.share && typeof navigator.share === "function") {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t("course.social.linkCopied"));
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t("course.social.linkCopied"));
      } catch {
        toast.error(t("course.social.failedToCopy"));
      }
    }
  }, [courseModule, t]);

  const handleBookmark = useCallback(() => {
    if (!courseId) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("podacium_bookmarked_courses") || "[]",
      );
      const isSaved = Array.isArray(saved) && saved.includes(courseId);
      let updated: string[];
      let newBookmarked: boolean;
      if (isSaved) {
        updated = saved.filter((id: string) => id !== courseId);
        newBookmarked = false;
        toast.info(
          t("course.social.unbookmarked") || t("course.social.bookmarkToggle"),
        );
      } else {
        updated = [...(Array.isArray(saved) ? saved : []), courseId];
        newBookmarked = true;
        toast.success(
          t("course.social.bookmarked") || t("course.social.bookmarkToggle"),
        );
      }
      localStorage.setItem(
        "podacium_bookmarked_courses",
        JSON.stringify(updated),
      );
      setBookmarked(newBookmarked);
    } catch {
      setBookmarked((prev) => !prev);
      toast.info(t("course.social.bookmarkToggle"));
    }
  }, [courseId, t]);

  const handleViewProfile = useCallback(() => {
    const instructorId =
      courseModule?.instructor?.id ?? courseModule?.instructorId;
    if (instructorId) router.push(`/profile/${instructorId}`);
  }, [courseModule, router]);

  // Debounced progress saving
  const lastProgressUpdateRef = useRef<{
    lessonId: string;
    progress: number;
    videoPosition: number;
    timestamp: number;
  } | null>(null);
  const progressSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lessonProgressRef = useRef(lessonProgress);
  useEffect(() => {
    lessonProgressRef.current = lessonProgress;
  }, [lessonProgress]);

  // Handle video progress
  const handleVideoProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!activeLessonId || !permissions.canSaveProgress || !duration) return;

      const percentage = (currentTime / duration) * 100;

      setVideoMilestones((prev) => {
        const hasNewlyCompleted = prev.some(
          (m) => !m.completed && percentage >= m.percentage,
        );
        if (!hasNewlyCompleted) return prev;

        return prev.map((milestone) => {
          if (!milestone.completed && percentage >= milestone.percentage) {
            return {
              ...milestone,
              completed: true,
              timestamp: currentTime,
            };
          }
          return milestone;
        });
      });

      // Store for debounced saving
      lastProgressUpdateRef.current = {
        lessonId: activeLessonId,
        progress: percentage,
        videoPosition: currentTime,
        timestamp: Date.now(),
      };

      // Clear existing timeout
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }

      // Set new timeout for saving progress
      progressSaveTimeoutRef.current = setTimeout(() => {
        if (lastProgressUpdateRef.current) {
          const { lessonId, progress, videoPosition } =
            lastProgressUpdateRef.current;

          const currentProgress =
            lessonProgressRef.current[lessonId]?.progress || 0;

          // Only save if progress is significant
          if (
            progress - currentProgress >= 5 ||
            progress >= 90 ||
            progress === 100
          ) {
            saveProgress(lessonId, progress, videoPosition);
          }

          lastProgressUpdateRef.current = null;
        }
      }, 2500);
    },
    [activeLessonId, permissions.canSaveProgress, saveProgress],
  );

  // Handle video complete
  const handleVideoComplete = useCallback(() => {
    if (!activeLessonId || !permissions.canSaveProgress) return;

    const currentProgress = lessonProgress[activeLessonId]?.progress || 0;

    if (currentProgress < 100) {
      completeLesson(activeLessonId).catch((error) => {
        console.error("Error completing lesson after video:", error);
      });
    }
  }, [
    activeLessonId,
    permissions.canSaveProgress,
    completeLesson,
    lessonProgress,
  ]);

  const handleManualComplete = useCallback(async () => {
    if (!activeLessonId || !permissions.canSaveProgress) return;

    try {
      await completeLesson(activeLessonId);
    } catch (error: any) {
      console.error("Error manually completing lesson:", error);
    }
  }, [activeLessonId, permissions.canSaveProgress, completeLesson]);

  const initialLessonResumePosition = useMemo(() => {
    return activeLessonId ? getLastVideoPosition(activeLessonId) : 0;
  }, [activeLessonId, getLastVideoPosition]);

  const coursePrice = courseModule ? normalizePrice(courseModule) : 0;

  const handleEnroll = useCallback(
    async (skipWallet?: boolean) => {
      if (typeof skipWallet !== "boolean") skipWallet = undefined;
      if (!isAuthenticated) {
        router.push(`/auth/login?redirect=/learn/courses/${courseId}`);
        return;
      }

      const price = promoDiscountedAmount ?? coursePrice;
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

      try {
        await enrollInCourse({
          promo_code: promoCode,
          skip_wallet: skipWallet ?? false,
        });
      } catch (error: any) {
        console.error("Enrollment error:", error);
        toast.error(error?.message || t("course.errors.enrollFailed"));
      }
    },
    [
      isAuthenticated,
      router,
      courseId,
      enrollInCourse,
      courseModule,
      promoCode,
      promoDiscountedAmount,
      coursePrice,
      walletBalance,
    ],
  );

  const handleWalletPay = useCallback(async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    await enrollInCourse({
      promo_code: pendingPurchase.promo_code,
      skip_wallet: pendingPurchase.skip_wallet,
    });
    setPendingPurchase(null);
  }, [pendingPurchase, enrollInCourse]);

  const handleCardPay = useCallback(async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    await enrollInCourse({
      promo_code: pendingPurchase.promo_code,
      skip_wallet: true,
    });
    setPendingPurchase(null);
  }, [pendingPurchase, enrollInCourse]);

  const handleLoginRedirect = useCallback(() => {
    router.push(`/auth/login?redirect=/learn/courses/${courseId}`);
  }, [router, courseId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
    };
  }, []);

  // Reset milestones when lesson changes
  useEffect(() => {
    if (activeLessonId) {
      const currentProgress = getLessonProgress(activeLessonId);
      setVideoMilestones((prev) =>
        prev.map((m) => ({
          ...m,
          completed: m.percentage <= currentProgress,
          timestamp: 0,
        })),
      );
    }
  }, [activeLessonId, getLessonProgress]);

  // Loading state
  if (authLoading || (isLoading && !courseModule)) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
        dir={dir}
      >
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-8xl mx-auto">
              <CourseHeaderSkeleton />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                <div className="lg:col-span-2">
                  <CurriculumSkeleton />
                </div>
                <div className="space-y-6">
                  <InstructorCardSkeleton />
                  <div className="h-64 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if ((error && !error.includes("Authentication")) || !courseModule) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
        dir={dir}
      >
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-48 pb-56 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                {error
                  ? t("course.states.error.title")
                  : t("course.states.notFound.title")}
              </h1>
              <p className="text-gray-600 dark:text-slate-400 mb-8">
                {error || t("course.states.notFound.description")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push("/learn/courses")}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                >
                  <Home className="w-4 h-4 mr-3 ml-3 inline" />
                  {t("course.actions.browseCourses")}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all duration-300"
                >
                  <RefreshCw className="w-4 h-4 mr-3 ml-3 inline" />
                  {t("course.actions.tryAgain")}
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Calculate derived values
  const price = normalizePrice(courseModule);
  const isFree = price === 0;
  const isEnrolled = accessState === AccessState.ENROLLED;

  // Check if user can write a review (enrolled + at least one completed lesson)
  const canReview =
    isEnrolled && Object.values(lessonProgress).some((lp) => lp.isCompleted);
  const showContent = activeLessonId && activeLesson;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={dir}
    >
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* JSON-LD structured data for search engines & LLMs */}
        {courseModule && (
          <CourseJsonLd
            name={courseModule.title}
            description={courseModule.description || ""}
            url={`/learn/courses/${courseId}`}
            imageUrl={courseModule.thumbnailUrl}
            duration={
              courseModule.durationMinutes
                ? `PT${courseModule.durationMinutes}M`
                : undefined
            }
            level={courseModule.level}
            language={isRtl ? "ar" : "en"}
            rating={
              courseModule.rating
                ? {
                    value: courseModule.rating,
                    count: courseModule.enrolled || 0,
                  }
                : undefined
            }
            price={
              courseModule.price
                ? { amount: normalizePrice(courseModule), currency: "DZD" }
                : undefined
            }
          />
        )}
        <BreadcrumbJsonLd
          items={[
            { name: t("learn.nav.breadcrumb.learn"), url: "/learn" },
            {
              name: t("course.curriculum.lessons"),
              url: "/learn/courses",
            },
            ...(courseModule ? [{ name: courseModule.title }] : []),
          ]}
        />

        {/* Sync Status Bar */}
        {isEnrolled && (
          <div className="fixed bottom-[10px] end-8 z-50 flex flex-col items-end">
            <AnimatePresence>
              <motion.div
                initial={{ x: isRtl ? -100 : 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRtl ? -100 : 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <SyncStatusIndicator
                  status={syncStatus}
                  lastSynced={lastSyncTime ? new Date(lastSyncTime) : undefined}
                  pendingCount={pendingUpdatesCount}
                  onForceSync={forceSyncToDatabase}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ENROLLED HERO SECTION */}
        {isEnrolled && (
          <section className="relative pt-24 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden flex flex-col min-h-[calc(100vh-64px)]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
            <div
              className="absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgb(79 70 229 / 0.15) 1px, transparent 0)`,
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative max-w-[1600px] mx-auto w-full flex-grow flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
              <div className="flex-grow flex flex-col min-h-[400px] lg:min-h-0 relative z-10 w-full lg:w-3/4">
                <VideoPlayer
                  activeLesson={activeLesson}
                  onComplete={handleVideoComplete}
                  onProgress={handleVideoProgress}
                  lastPosition={initialLessonResumePosition}
                  isRtl={isRtl}
                  milestones={videoMilestones}
                  lessons={lessons}
                  onLessonSelect={handleLessonSelect}
                  getLessonStatus={getLessonStatus}
                  courseId={courseId}
                  onSwitchToQuiz={() => setActiveTab("quiz")}
                />
              </div>
              <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[32px] border border-white/60 dark:border-slate-800/80 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] p-6 overflow-hidden ring-1 ring-white/20 h-[500px] lg:h-auto max-h-full">
                <div className="flex items-center justify-between mb-4 px-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 dark:text-slate-100 tracking-tight">
                      {t("course.sidebar.lessons")}
                    </h3>
                    <span className="text-xs bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 font-bold">
                      {lessons.length} {t("course.curriculum.lessons")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const prevId = getPreviousLessonId(
                          activeLessonId || "",
                        );
                        if (prevId) handleLessonSelect(prevId);
                      }}
                      disabled={!getPreviousLessonId(activeLessonId || "")}
                      aria-label={t("course.lessons.prev")}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-slate-300 rtl:rotate-180" />
                    </button>
                    <button
                      onClick={() => {
                        const nextId = getNextLessonId(activeLessonId || "");
                        if (nextId) handleLessonSelect(nextId);
                      }}
                      disabled={!getNextLessonId(activeLessonId || "")}
                      aria-label={t("course.lessons.next")}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-700 dark:text-slate-300 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
                <div className="px-2 mb-4 flex-shrink-0">
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${overallProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div className="space-y-3 overflow-y-auto min-h-0 flex-grow pr-2 scrollbar-hide">
                  {lessons.map((lesson, idx) => (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        if (getLessonStatus(lesson.id) !== LessonStatus.LOCKED)
                          handleLessonSelect(lesson.id);
                      }}
                      aria-current={
                        lesson.id === activeLessonId ? "true" : undefined
                      }
                      className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all text-start ${lesson.id === activeLessonId ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 ring-2 ring-blue-500/20" : "hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent"} ${getLessonStatus(lesson.id) === LessonStatus.LOCKED ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${lesson.id === activeLessonId ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 dark:bg-slate-900/60 text-gray-400"}`}
                      >
                        {getLessonStatus(lesson.id) ===
                        LessonStatus.COMPLETED ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : getLessonStatus(lesson.id) ===
                          LessonStatus.LOCKED ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <span className="font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <div className="text-start overflow-hidden flex-grow">
                        <div
                          className={`text-sm font-bold truncate ${lesson.id === activeLessonId ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-slate-100"}`}
                        >
                          {lesson.title}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {formatDuration(lesson.durationMinutes)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* NON-ENROLLED HERO SECTION */}
        {!isEnrolled && (
          <section className="relative pt-38 pb-44 px-4 sm:px-6 lg:px-8 overflow-hidden">
            {/* Animated Background Layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

            {/* Dynamic Pattern */}
            <div
              className="absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgb(79 70 229 / 0.15) 1px, transparent 0)`,
                backgroundSize: "32px 32px",
              }}
            />

            {/* Floating Accents */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [0, 50, 0],
                y: [0, -30, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 blur-[100px] rounded-full"
            />
            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.4, 0.2],
                x: [0, -40, 0],
                y: [0, 60, 0],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-48 -left-24 w-[500px] h-[500px] bg-purple-400/10 blur-[120px] rounded-full"
            />

            <div className="relative max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Course info */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="lg:col-span-7 flex flex-col items-start text-start"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center px-4 py-1.5 bg-blue-600/10 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md"
                    >
                      <Award className="w-3.5 h-3.5 me-2" />
                      {courseModule.category ||
                        t("course.header.defaultCategory")}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="inline-flex items-center px-4 py-1.5 bg-indigo-600/10 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md"
                    >
                      <TrendingUp className="w-3.5 h-3.5 me-2" />
                      {courseModule.level || t("course.header.level")}
                    </motion.div>
                  </div>

                  <h1 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-slate-100 mb-6 leading-[1.1] tracking-tight">
                    {courseModule.title}
                  </h1>

                  <p className="text-xl text-gray-600 dark:text-slate-400 mb-10 leading-relaxed font-medium">
                    {courseModule.description ||
                      t("course.header.noDescription")}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10 p-6 bg-white dark:bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-blue-900/5">
                    {/* Instructor */}
                    {courseModule.instructor && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {t("course.header.instructor")}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex-shrink-0 overflow-hidden border border-white shadow-sm">
                            {courseModule.instructor.profilePictureUrl ? (
                              <img
                                src={courseModule.instructor.profilePictureUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mx-auto mt-1" />
                            )}
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
                            {courseModule.instructor.fullName}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {t("course.header.duration")}
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                          {formatDuration(courseModule.durationMinutes)}
                        </span>
                      </div>
                    </div>

                    {/* Students */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {t("course.header.students")}
                      </span>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                          {courseModule.enrolled?.toLocaleString() || "0"}
                        </span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {t("course.header.rating")}
                      </span>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-500" />
                        <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                          {courseModule.rating
                            ? courseModule.rating.toFixed(1)
                            : t("course.reviews.noRating")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Course tags */}
                  {courseModule.skills && courseModule.skills.length > 0 && (
                    <div className="flex flex-wrap items-center justify-start gap-2 mb-8">
                      {courseModule.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm hover:shadow-md hover:border-blue-200 dark:border-blue-800/80 transition-all cursor-default"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Progress bar for enrolled users */}
                  {isEnrolled && overallProgress > 0 && (
                    <div className="max-w-md">
                      <ProgressBar
                        value={overallProgress}
                        size="lg"
                        color="blue"
                        showLabel={true}
                        animated={true}
                      />
                    </div>
                  )}
                </motion.div>

                {/* Action card Area */}
                <div className="lg:col-span-5 w-full sticky top-32">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[32px] border border-white/60 dark:border-slate-800/80 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] p-8 relative overflow-hidden ring-1 ring-white/20"
                  >
                    {/* Course Preview Video Teaser */}
                    <div
                      onClick={() => {
                        const firstPreview =
                          lessons.find(
                            (l) => l.isPreview || (l as any).is_preview,
                          ) || lessons[0];
                        if (firstPreview) {
                          handleLessonSelect(firstPreview.id);
                          setPreviewModalOpen(true);
                        }
                      }}
                      className="relative mb-6 rounded-2xl overflow-hidden aspect-video bg-slate-900 border border-gray-200 dark:border-slate-800 group cursor-pointer shadow-md"
                    >
                      {courseModule.thumbnailUrl ? (
                        <img
                          src={courseModule.thumbnailUrl}
                          alt={courseModule.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950 text-white/50">
                          <Play className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 group-hover:bg-black/30 transition-colors">
                        <div className="w-14 h-14 rounded-full bg-white/90 text-blue-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 fill-current ms-0.5" />
                        </div>
                        <span className="text-xs font-bold text-white tracking-wide uppercase drop-shadow">
                          {t("learn.preview.previewThisCourse")}
                        </span>
                      </div>
                    </div>

                    {/* Pricing */}
                    {(() => {
                      const priceInfo = getPriceInfo(courseModule);
                      const price = priceInfo.current;

                      return (
                        <div className="mb-6">
                          <div className="flex flex-col gap-1">
                            {/* Show original price as strikethrough + discount badge */}
                            {priceInfo.isDiscounted &&
                              priceInfo.original !== null && (
                                <div className="flex items-center gap-2">
                                  <span className="text-lg text-gray-400 line-through decoration-gray-300">
                                    {priceInfo.original}{" "}
                                    {t("course.currency.da")}
                                  </span>
                                  {priceInfo.discountPercentage && (
                                    <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-sm shadow-rose-100 uppercase tracking-tighter">
                                      -{priceInfo.discountPercentage}%
                                    </span>
                                  )}
                                </div>
                              )}

                            {/* Show current price (could be discounted or original) */}
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                                {price > 0 ? price : t("course.pricing.free")}
                              </span>
                              {price > 0 && (
                                <span className="text-xl font-bold text-gray-400 uppercase tracking-widest">
                                  {t("course.currency.da")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                            {t("course.pricing.features")}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Features list */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 me-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-slate-300">
                          {t("course.features.lifetimeAccess")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 me-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-slate-300">
                          {t("course.features.certificate")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 me-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-slate-300">
                          {t("course.features.mobileDesktop")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 me-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-slate-300">
                          {t("course.features.downloadableResources")}
                        </span>
                      </div>
                      {courseModule.instructor && (
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-500 me-3 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-slate-300">
                            {t("course.features.instructorSupport")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enrollment button */}
                    <AccessControl
                      allowedStates={[AccessState.AUTHENTICATED_NOT_ENROLLED]}
                      requireEnrollment={true}
                      courseEnrollment={enrollment}
                      fallback={
                        isEnrolled ? (
                          <button
                            onClick={() => {
                              const firstIncompleteLesson = lessons.find(
                                (lesson) =>
                                  lessonProgress[lesson.id]?.progress < 100,
                              );

                              if (firstIncompleteLesson) {
                                handleLessonSelect(firstIncompleteLesson.id);
                                document
                                  .getElementById("curriculum")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                  });
                              } else if (lessons.length > 0) {
                                handleLessonSelect(lessons[0].id);
                                document
                                  .getElementById("curriculum")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                  });
                              }
                            }}
                            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg"
                          >
                            <Play className="w-5 h-5 me-2 inline" />
                            {t("course.actions.continueLearning")}
                          </button>
                        ) : (
                          <button
                            onClick={handleLoginRedirect}
                            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                          >
                            {t("course.actions.login")} /{" "}
                            {t("course.actions.signUp")}
                          </button>
                        )
                      }
                    >
                      <button
                        onClick={() => handleEnroll()}
                        disabled={isEnrolling}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                      >
                        {isEnrolling ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin me-2" />
                            {t("course.actions.enrolling")}
                          </div>
                        ) : isFree ? (
                          t("course.actions.enrollFree")
                        ) : (
                          `${t("course.actions.enrollNow")} - ${price} ${t("course.currency.da")}`
                        )}
                        {!isEnrolling && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
                        )}
                      </button>
                    </AccessControl>

                    {/* Guarantee */}
                    <div className="text-center mt-4 pt-4 border-t border-gray-200 dark:border-slate-800">
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {t("course.pricing.guarantee")}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab Navigation Section */}
        <section className="sticky top-[64px] z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-hide no-scrollbar"
              role="tablist"
              aria-label={t("course.tabs.title")}
            >
              {[
                { id: "video", icon: Play, premium: true },
                { id: "quiz", icon: HelpCircle, premium: true },
                { id: "resources", icon: FolderOpen, premium: true },
                { id: "analytics", icon: BarChart3, premium: false },
                { id: "certificate", icon: Award, premium: false },
                { id: "reviews", icon: Star, premium: false },
                { id: "actions", icon: MessageSquare, premium: false },
              ]
                .filter(
                  (tab) =>
                    (!tab.premium || isEnrolled) &&
                    !(isEnrolled && tab.id === "video"),
                )
                .map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300 whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white"
                  }
                `}
                  >
                    <tab.icon className="w-4 h-4" />
                    {t(`course.tabs.${tab.id}`)}
                  </button>
                ))}
            </div>
          </div>
        </section>

        {/* Main Content Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-slate-800/60 min-h-[600px]">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Primary Content */}
              <div
                className={
                  isEnrolled
                    ? "lg:col-span-12 space-y-8"
                    : "lg:col-span-8 space-y-8"
                }
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Suspense
                      fallback={
                        <div className="h-96 bg-gray-100 dark:bg-slate-800 rounded-3xl animate-pulse" />
                      }
                    >
                      {activeTab === "video" &&
                        (isEnrolled ? null : activeLesson &&
                          (activeLesson.isPreview ||
                            (activeLesson as any).is_preview ||
                            activeLesson.id === lessons[0]?.id) ? (
                          <div className="space-y-4">
                            <VideoPlayer
                              activeLesson={activeLesson}
                              onComplete={handleVideoComplete}
                              onProgress={handleVideoProgress}
                              lastPosition={initialLessonResumePosition}
                              isRtl={isRtl}
                              milestones={videoMilestones}
                              lessons={lessons}
                              onLessonSelect={handleLessonSelect}
                              getLessonStatus={getLessonStatus}
                              courseId={courseId}
                              onSwitchToQuiz={() => setActiveTab("quiz")}
                              isEnrolled={false}
                              onEnroll={handleEnroll}
                            />
                          </div>
                        ) : (
                          <LockedCourseCTA
                            onEnroll={handleEnroll}
                            onLogin={handleLoginRedirect}
                            isAuthenticated={isAuthenticated}
                            isEnrolling={isEnrolling}
                          />
                        ))}
                      {activeTab === "quiz" &&
                        (isEnrolled ? (
                          <QuizEngine
                            activeLesson={activeLesson}
                            lessonProgress={
                              activeLessonId
                                ? lessonProgress[activeLessonId]
                                : null
                            }
                            onComplete={handleManualComplete}
                            isRtl={isRtl}
                          />
                        ) : (
                          <LockedCourseCTA
                            onEnroll={handleEnroll}
                            onLogin={handleLoginRedirect}
                            isAuthenticated={isAuthenticated}
                            isEnrolling={isEnrolling}
                          />
                        ))}
                      {activeTab === "resources" &&
                        (isEnrolled ? (
                          <ResourcesManager
                            activeLesson={activeLesson}
                            isRtl={isRtl}
                          />
                        ) : (
                          <LockedCourseCTA
                            onEnroll={handleEnroll}
                            onLogin={handleLoginRedirect}
                            isAuthenticated={isAuthenticated}
                            isEnrolling={isEnrolling}
                          />
                        ))}
                      {activeTab === "analytics" && (
                        <AnalyticsDashboard
                          overallProgress={overallProgress}
                          userStats={userStats}
                          lessons={lessons}
                          module={courseModule}
                        />
                      )}
                      {activeTab === "certificate" && (
                        <CertificateGenerator
                          courseId={courseId}
                          overallProgress={overallProgress}
                          isRtl={isRtl}
                          userName={user?.fullName}
                          moduleTitle={courseModule?.title}
                          completedAt={enrollment?.completedAt}
                          certificateId={enrollment?.certificateId || undefined}
                          onWalletBalance={walletBalance ?? undefined}
                        />
                      )}
                      {activeTab === "actions" && (
                        <ActionButtons
                          module={courseModule}
                          isRtl={isRtl}
                          enrolledCount={courseModule?.enrolled}
                          onWriteReview={() => setIsReviewFormOpen(true)}
                          canReview={canReview}
                          onShare={handleShare}
                          onBookmark={handleBookmark}
                          bookmarked={bookmarked}
                          onSupport={() => router.push("/contact")}
                          onViewProfile={handleViewProfile}
                        />
                      )}
                      {activeTab === "reviews" && (
                        <div className="space-y-6">
                          {/* Write Review CTA or enrollment notice */}
                          {canReview ? (
                            <button
                              onClick={() => setIsReviewFormOpen(true)}
                              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                            >
                              <Star className="w-5 h-5" />
                              {t("course.reviews.writeReview")}
                            </button>
                          ) : !isEnrolled ? (
                            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 text-center">
                              <p className="text-amber-700 dark:text-amber-300 font-medium text-sm">
                                {t("course.reviews.enrollFirst")}
                              </p>
                            </div>
                          ) : (
                            <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-center">
                              <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                                {t("course.reviews.completeLessonFirst")}
                              </p>
                            </div>
                          )}
                          <ReviewList
                            moduleId={courseId}
                            refreshTrigger={reviewRefreshTrigger}
                          />
                        </div>
                      )}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sidebar (4 cols) */}
              {!isEnrolled && (
                <div className="lg:col-span-4 space-y-8">
                  {/* Simple Curriculum Widget for quick switching while on tabs */}
                  <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className="font-black text-gray-900 dark:text-slate-100 tracking-tight">
                        {t("course.sidebar.lessons")}
                      </h3>
                      <span className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-gray-500 dark:text-slate-400 font-bold">
                        {lessons.length} {t("course.curriculum.lessons")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {lessons.map((lesson, idx) => (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            handleLessonSelect(lesson.id);
                            if (
                              !isEnrolled &&
                              (lesson.isPreview ||
                                (lesson as any).is_preview ||
                                idx === 0)
                            ) {
                              setActiveTab("video");
                            }
                          }}
                          className={`
                        w-full flex items-center gap-4 p-3 rounded-2xl transition-all
                        ${lesson.id === activeLessonId ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent"}
                      `}
                        >
                          <div
                            className={`
                        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${lesson.id === activeLessonId ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-400"}
                      `}
                          >
                            {getLessonIcon(
                              lesson.type,
                              getLessonStatus(lesson.id) ===
                                LessonStatus.COMPLETED,
                              getLessonStatus(lesson.id) ===
                                LessonStatus.LOCKED,
                            )}
                          </div>
                          <div className="text-start overflow-hidden flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                {lesson.title}
                              </span>
                              {(lesson.isPreview ||
                                (lesson as any).is_preview ||
                                idx === 0) && (
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full shadow-xs">
                                  {t("learn.preview.badge")}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium">
                              {formatDuration(lesson.durationMinutes)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Promo code input */}
                  {!isEnrolled && coursePrice > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                      <PromoCodeInput
                        amount={coursePrice}
                        onApply={(code: string, _discounted: number) => {
                          setPromoCode(code);
                          setPromoDiscountedAmount(_discounted);
                        }}
                        onRemove={() => {
                          setPromoCode(undefined);
                          setPromoDiscountedAmount(null);
                        }}
                      />
                    </div>
                  )}

                  {/* Enrollment CTA if not enrolled */}
                  {!isEnrolled && (
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
                      <div className="relative z-10">
                        <h3 className="text-2xl font-black mb-4">
                          {t("course.actions.cta.unauthenticated.title")}
                        </h3>
                        <p className="text-indigo-100 text-sm mb-8 opacity-90 leading-relaxed">
                          {t("course.actions.cta.unauthenticated.description")}
                        </p>
                        <button
                          onClick={() => handleEnroll()}
                          className="w-full py-4 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg transition-all"
                        >
                          {t("course.actions.enrollNow")}
                        </button>
                      </div>
                      <Lock className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <EnrollmentCTA
          module={courseModule}
          accessState={accessState}
          onEnroll={handleEnroll}
          onLogin={handleLoginRedirect}
          isLoading={isEnrolling}
        />

        <WalletPaymentModal
          isOpen={showWalletModal}
          onClose={() => {
            setShowWalletModal(false);
            setPendingPurchase(null);
          }}
          onPayWithWallet={handleWalletPay}
          onPayWithCard={handleCardPay}
          processing={isEnrolling}
          amount={pendingPurchase?.amount ?? coursePrice}
          walletBalance={walletBalance ?? 0}
        />

        <PaymentFailModal
          isOpen={effectiveShowFailModal}
          onClose={() => setDismissedFailModal(true)}
          onRetry={handleEnroll}
        />

        <ReviewForm
          moduleId={courseId}
          isOpen={isReviewFormOpen}
          onClose={() => setIsReviewFormOpen(false)}
          onSubmitted={() => setReviewRefreshTrigger((prev) => prev + 1)}
        />

        {/* Course Cinema Preview Modal */}
        <PodaciumModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          title={
            activeLesson
              ? `${t("learn.preview.badge")}: ${activeLesson.title}`
              : t("learn.preview.modalTitle")
          }
          size="full"
        >
          <div className="p-2">
            <VideoPlayer
              activeLesson={activeLesson}
              onComplete={handleVideoComplete}
              onProgress={handleVideoProgress}
              lastPosition={initialLessonResumePosition}
              isRtl={isRtl}
              milestones={videoMilestones}
              lessons={lessons}
              onLessonSelect={handleLessonSelect}
              getLessonStatus={getLessonStatus}
              courseId={courseId}
              onSwitchToQuiz={() => setActiveTab("quiz")}
              isEnrolled={false}
              onEnroll={() => {
                setPreviewModalOpen(false);
                handleEnroll();
              }}
            />
          </div>
        </PodaciumModal>
      </main>

      <Footer />
    </div>
  );
}
