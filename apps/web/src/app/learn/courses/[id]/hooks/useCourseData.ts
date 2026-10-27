import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  apiHelpers,
  LessonResponse,
  EnrollmentResponse,
  LessonProgressResponse,
  UserLearningStats,
  AuthenticationError,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CourseState, SyncStatus } from "../types";
import { AutomaticProgressSyncManager } from "./AutomaticProgressSyncManager";
import { normalizePrice } from "../utils";

export const useCourseData = (courseId: string) => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<CourseState>({
    module: null,
    lessons: [],
    enrollment: null,
    lessonProgress: {},
    userStats: null,
    isLoading: true,
    isEnrolling: false,
    error: null,
    syncStatus:
      typeof navigator !== "undefined" && navigator.onLine
        ? SyncStatus.ONLINE
        : SyncStatus.OFFLINE,
    pendingUpdatesCount: 0,
    lastSyncTime: 0,
    showFailModal: false,
  });

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, syncStatus: SyncStatus.ONLINE }));
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, syncStatus: SyncStatus.OFFLINE }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize automatic sync when user is enrolled
  useEffect(() => {
    if (user && state.enrollment) {
      AutomaticProgressSyncManager.initializeAutomaticSync(courseId, user.id);

      const updateCountInterval = setInterval(() => {
        const pendingCount =
          AutomaticProgressSyncManager.getPendingUpdatesCount(
            courseId,
            user.id,
          );
        const lastSync = AutomaticProgressSyncManager.getLastSyncTime(
          courseId,
          user.id,
        );
        setState((prev) => {
          if (
            prev.pendingUpdatesCount === pendingCount &&
            prev.lastSyncTime === lastSync
          ) {
            return prev;
          }
          return {
            ...prev,
            pendingUpdatesCount: pendingCount,
            lastSyncTime: lastSync,
          };
        });
      }, 10000);

      return () => {
        AutomaticProgressSyncManager.clearSyncInterval(courseId, user.id);
        clearInterval(updateCountInterval);
      };
    }
  }, [user, courseId, state.enrollment]);

  // Fetch module data
  const fetchModuleData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      if (!courseId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(courseId)) {
        throw new Error("Invalid course ID");
      }

      const moduleData = await apiHelpers.education.getModule(courseId, false);

      if (!moduleData) {
        throw new Error("Course not found");
      }

      setState((prev) => ({ ...prev, module: moduleData }));
    } catch (error: any) {
      console.error("Error fetching course data:", error);
      if (
        !error.message?.includes("Authentication") &&
        !error.message?.includes("auth")
      ) {
        setState((prev) => ({
          ...prev,
          error: error.message || "Failed to load course data",
        }));
      }
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [courseId]);

  // Fetch lessons
  const fetchLessons = useCallback(async () => {
    if (!user || !isAuthenticated) {
      return [];
    }

    try {
      const lessonsData = await apiHelpers.education.getModuleLessons(courseId);
      setState((prev) => ({ ...prev, lessons: lessonsData }));
      return lessonsData;
    } catch (error: any) {
      return [];
    }
  }, [user, isAuthenticated, courseId]);

  // Fetch all lesson progress from database
  const fetchAllLessonProgressFromDB = useCallback(async (): Promise<
    Record<string, LessonProgressResponse>
  > => {
    try {
      const allProgress: Record<string, LessonProgressResponse> = {};

      // Get user's lesson progresses from database
      const rawProgresses = await apiHelpers.education.getMyLessonProgresses();
      const lessonProgresses = Array.isArray(rawProgresses)
        ? rawProgresses
        : (rawProgresses as any)?.items || [];

      // Filter for lessons in this course
      lessonProgresses.forEach((progress: any) => {
        if (state.lessons.some((lesson) => lesson.id === progress.lessonId)) {
          allProgress[progress.lessonId] = progress;
        }
      });

      return allProgress;
    } catch (error) {
      console.error("Error fetching lesson progress from database:", error);
      return {};
    }
  }, [state.lessons]);

  // Fetch enrollment and progress data
  const fetchEnrollmentData = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setState((prev) => ({
        ...prev,
        enrollment: null,
        lessonProgress: {},
        userStats: null,
      }));
      return;
    }

    try {
      const enrollments = await apiHelpers.education.getMyEnrollments();
      const courseEnrollment = enrollments.find(
        (e) =>
          e.moduleId === courseId || (e.module && e.module.id === courseId),
      );

      setState((prev) => ({ ...prev, enrollment: courseEnrollment || null }));

      if (!courseEnrollment) {
        AutomaticProgressSyncManager.clearCourseData(courseId, user.id);
        return;
      }

      const lessons = await fetchLessons();
      if (lessons.length === 0) return;

      const dbProgress: Record<string, LessonProgressResponse> = {};
      try {
        const rawProgresses =
          await apiHelpers.education.getMyLessonProgresses();
        const allProgresses = Array.isArray(rawProgresses)
          ? rawProgresses
          : (rawProgresses as any)?.items || [];
        allProgresses.forEach((progress: any) => {
          if (lessons.some((lesson) => lesson.id === progress.lessonId)) {
            dbProgress[progress.lessonId] = progress;
          }
        });
      } catch (error) {
        console.error("Error fetching progress from database:", error);
      }

      const localProgress = AutomaticProgressSyncManager.loadProgressLocally(
        courseId,
        user.id,
      );
      const mergedProgress: Record<string, LessonProgressResponse> = {
        ...dbProgress,
      };

      Object.entries(localProgress).forEach(([lessonId, local]) => {
        const db = dbProgress[lessonId];
        if (!db) {
          mergedProgress[lessonId] = local;
        } else if (local.progress > db.progress) {
          mergedProgress[lessonId] = {
            ...local,
            progress: Math.max(db.progress, local.progress),
            id: db.id || local.id,
            createdAt: db.createdAt || local.createdAt,
            updatedAt: local.updatedAt,
          };
        }
      });

      const pendingCount = AutomaticProgressSyncManager.getPendingUpdatesCount(
        courseId,
        user.id,
      );

      try {
        const userStats = await apiHelpers.education.getMyLearningStats();
        setState((prev) => ({ ...prev, userStats }));
      } catch (error) {
        console.error("Error fetching user stats:", error);
      }

      const unsyncedLessons = Object.keys(localProgress).filter(
        (lessonId) =>
          !dbProgress[lessonId] ||
          localProgress[lessonId].progress >
            (dbProgress[lessonId]?.progress || 0),
      );

      if (unsyncedLessons.length > 0) {
        unsyncedLessons.forEach((lessonId) => {
          const local = localProgress[lessonId];
          AutomaticProgressSyncManager.queueProgressUpdate(
            courseId,
            user.id,
            lessonId,
            local.progress,
          );
        });
      }

      setState((prev) => ({
        ...prev,
        lessonProgress: mergedProgress,
        pendingUpdatesCount: pendingCount,
        lastSyncTime: AutomaticProgressSyncManager.getLastSyncTime(
          courseId,
          user.id,
        ),
      }));
    } catch (error: any) {
      console.error("Error fetching enrollment:", error);
    }
  }, [user, isAuthenticated, courseId, fetchLessons]);

  // Save progress
  const saveProgress = useCallback(
    (lessonId: string, progress: number, videoPosition?: number) => {
      if (!user || !state.enrollment) return null;

      const currentProgress = state.lessonProgress[lessonId]?.progress || 0;
      const newProgress = Math.max(currentProgress, Math.min(100, progress));

      if (Math.abs(newProgress - currentProgress) < 1 && newProgress < 99)
        return null;

      const now = Date.now();
      const lesson = state.lessons.find((l) => l.id === lessonId);

      const progressRecord: LessonProgressResponse = {
        id: Date.now(),
        userId: user.id,
        lessonId,
        isCompleted: newProgress === 100,
        completedAt:
          newProgress === 100 ? new Date(now).toISOString() : undefined,
        progress: newProgress,
        createdAt:
          state.lessonProgress[lessonId]?.createdAt ||
          new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        deletedAt: undefined,
        lesson,
      };

      AutomaticProgressSyncManager.saveProgressLocally(courseId, user.id, {
        ...state.lessonProgress,
        [lessonId]: progressRecord,
      });

      if (videoPosition !== undefined && videoPosition > 10) {
        AutomaticProgressSyncManager.saveVideoPosition(
          courseId,
          user.id,
          lessonId,
          videoPosition,
        );
      }

      AutomaticProgressSyncManager.queueProgressUpdate(
        courseId,
        user.id,
        lessonId,
        newProgress,
        videoPosition,
      );

      const pendingCount = AutomaticProgressSyncManager.getPendingUpdatesCount(
        courseId,
        user.id,
      );
      const lastSync = AutomaticProgressSyncManager.getLastSyncTime(
        courseId,
        user.id,
      );

      setState((prev) => ({
        ...prev,
        lessonProgress: {
          ...prev.lessonProgress,
          [lessonId]: progressRecord,
        },
        pendingUpdatesCount: pendingCount,
        lastSyncTime: lastSync,
      }));

      return progressRecord;
    },
    [user, courseId, state.enrollment, state.lessons, state.lessonProgress],
  );

  // Auto-generate certificate when course is completed
  const autoGenerateCertificate = useCallback(async () => {
    if (!user || !courseId) return;

    try {
      // Check if all lessons are completed
      const allLessonsCompleted = state.lessons.every((lesson) => {
        const progress = state.lessonProgress[lesson.id];
        return progress?.isCompleted || progress?.progress === 100;
      });

      if (allLessonsCompleted && state.lessons.length > 0) {
        await apiHelpers.education.autoGenerateCertificate(courseId);
      }
    } catch (error: any) {
      // Certificate might already exist or user not eligible yet
      console.error(
        "Certificate auto-generation error:",
        error?.message || error,
      );
    }
  }, [user, courseId, state.lessons, state.lessonProgress]);

  // Complete lesson
  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!user || !state.enrollment) return null;

      try {
        await apiHelpers.education.completeLesson(lessonId);

        const now = Date.now();
        const lesson = state.lessons.find((l) => l.id === lessonId);

        const progressRecord: LessonProgressResponse = {
          id: Date.now(),
          userId: user.id,
          lessonId,
          isCompleted: true,
          completedAt: new Date(now).toISOString(),
          progress: 100,
          createdAt:
            state.lessonProgress[lessonId]?.createdAt ||
            new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
          deletedAt: undefined,
          lesson,
        };

        setState((prev) => ({
          ...prev,
          lessonProgress: {
            ...prev.lessonProgress,
            [lessonId]: progressRecord,
          },
        }));

        AutomaticProgressSyncManager.saveProgressLocally(courseId, user.id, {
          ...state.lessonProgress,
          [lessonId]: progressRecord,
        });

        // Trigger certificate auto-generation after lesson completion
        // Use setTimeout to allow state to update first
        setTimeout(() => {
          autoGenerateCertificate();
        }, 500);

        return progressRecord;
      } catch (error) {
        const progressRecord = saveProgress(lessonId, 100);
        AutomaticProgressSyncManager.queueProgressUpdate(
          courseId,
          user.id,
          lessonId,
          100,
        );

        const pendingCount =
          AutomaticProgressSyncManager.getPendingUpdatesCount(
            courseId,
            user.id,
          );
        setState((prev) => ({
          ...prev,
          pendingUpdatesCount: pendingCount,
          lastSyncTime: AutomaticProgressSyncManager.getLastSyncTime(
            courseId,
            user.id,
          ),
        }));

        // Trigger certificate auto-generation even on error (optimistic)
        setTimeout(() => {
          autoGenerateCertificate();
        }, 500);

        return progressRecord;
      }
    },
    [
      user,
      courseId,
      state.enrollment,
      saveProgress,
      state.lessons,
      state.lessonProgress,
      autoGenerateCertificate,
    ],
  );

  // Force sync
  const forceSyncToDatabase = useCallback(async () => {
    if (!user || !state.enrollment) return;

    try {
      setState((prev) => ({ ...prev, syncStatus: SyncStatus.SYNCING }));

      const pendingCount = state.pendingUpdatesCount;
      if (pendingCount === 0) {
        setState((prev) => ({ ...prev, syncStatus: SyncStatus.ONLINE }));
        return;
      }

      await AutomaticProgressSyncManager.processAutomaticSync(
        courseId,
        user.id.toString(),
      );
      const dbProgress = await fetchAllLessonProgressFromDB();

      setState((prev) => ({
        ...prev,
        lessonProgress: dbProgress,
        pendingUpdatesCount: 0,
        syncStatus: SyncStatus.ONLINE,
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      setState((prev) => ({ ...prev, syncStatus: SyncStatus.ERROR }));
      setTimeout(() => {
        setState((prev) => ({ ...prev, syncStatus: SyncStatus.ONLINE }));
      }, 5000);
    }
  }, [
    user,
    courseId,
    state.enrollment,
    state.pendingUpdatesCount,
    fetchAllLessonProgressFromDB,
  ]);

  // Get saved video position
  const getLastVideoPosition = useCallback(
    (lessonId: string): number => {
      if (!user) return 0;
      return AutomaticProgressSyncManager.getVideoPosition(
        courseId,
        user.id,
        lessonId,
      );
    },
    [user, courseId],
  );

  // Enroll in course
  const enrollInCourse = useCallback(
    async (options?: { promo_code?: string; skip_wallet?: boolean }) => {
      if (!user || !isAuthenticated) {
        throw new AuthenticationError("Authentication required");
      }

      try {
        setState((prev) => ({ ...prev, isEnrolling: true, error: null }));

        let moduleData = state.module;
        if (!moduleData) {
          try {
            moduleData = await apiHelpers.education.getModule(courseId, false);
            if (moduleData) {
              setState((prev) => ({ ...prev, module: moduleData }));
            }
          } catch (e) {
            // Ignore
          }
        }

        const price = moduleData ? normalizePrice(moduleData) : 0;
        if (price > 0 && moduleData) {
          const origin = window.location.origin;
          const response = await api.purchaseCourse({
            course_id: courseId,
            amount: price,
            success_url: `${origin}/learn/courses/${courseId}?payment=success`,
            failure_url: `${origin}/learn/courses/${courseId}?payment=failure`,
            promo_code: options?.promo_code,
            skip_wallet: options?.skip_wallet ?? false,
          });

          const rawResp = response as any;
          const resData = response?.data as any;
          const paidWithWallet =
            rawResp?.paid_with_wallet ||
            rawResp?.paidWithWallet ||
            resData?.paid_with_wallet ||
            resData?.paidWithWallet;
          const checkoutUrl =
            rawResp?.checkout_url ||
            rawResp?.checkoutUrl ||
            resData?.checkout_url ||
            resData?.checkoutUrl;

          if (paidWithWallet) {
            await fetchEnrollmentData();
            await fetchLessons();
            AutomaticProgressSyncManager.clearCourseData(courseId, user.id);
            return;
          }

          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
          }

          console.error("Invalid enrollment response:", response);
          throw new Error("errors.billing.failed_to_initiate_payment");
        } else {
          await apiHelpers.education.enrollInModule(courseId);
          await fetchEnrollmentData();
          await fetchLessons();
          AutomaticProgressSyncManager.clearCourseData(courseId, user.id);
        }
      } catch (error: any) {
        console.error("Error enrolling in course:", error);
        throw error;
      } finally {
        setState((prev) => ({ ...prev, isEnrolling: false }));
      }
    },
    [
      user,
      isAuthenticated,
      courseId,
      fetchEnrollmentData,
      fetchLessons,
      state.module,
    ],
  );

  // ── Payment callback handling (redirect back from Chargily) ──
  const searchParams = useSearchParams();
  const paymentPollingRef = useRef(false);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const checkoutId = searchParams.get("checkout_id");

    if (!checkoutId || !user || !isAuthenticated) return;

    if (paymentStatus === "failure") {
      setState((prev) => ({ ...prev, showFailModal: true }));
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment");
        url.searchParams.delete("checkout_id");
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }

    if (paymentStatus !== "success") return;
    if (paymentPollingRef.current) return; // already polling
    paymentPollingRef.current = true;

    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 3000;

    const timer = setInterval(async () => {
      attempts++;
      try {
        const result = await api.getCheckoutStatus(checkoutId);
        if (result.enrolled) {
          clearInterval(timer);
          paymentPollingRef.current = false;
          // Refresh enrollment data now that the user is enrolled
          await fetchEnrollmentData();
          // Clean up URL params
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
          paymentPollingRef.current = false;
          console.warn(
            "⚠️ Payment verification polling timed out after",
            maxAttempts,
            "attempts",
          );
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          paymentPollingRef.current = false;
          console.error("❌ Payment verification polling failed:", err);
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      paymentPollingRef.current = false;
    };
  }, [searchParams, user, isAuthenticated, fetchEnrollmentData]);

  // Initial load
  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  useEffect(() => {
    fetchEnrollmentData();
  }, [user?.id, isAuthenticated, fetchEnrollmentData]);

  return {
    state,
    actions: {
      enrollInCourse,
      completeLesson,
      saveProgress,
      getLastVideoPosition,
      forceSyncToDatabase,
    },
  };
};
