"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCcw,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { LessonResponse, LessonStatus } from "../types";
import { useTranslations } from "@/lib/i18n";
import PodaciumVideoPlayer from "@/components/course/VideoPlayer";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { AutomaticProgressSyncManager } from "../hooks/AutomaticProgressSyncManager";
import { useAuth } from "@/contexts/AuthContext";
import { getSignedVideoUrl } from "@/app/actions/video";

interface VideoPlayerProps {
  activeLesson: LessonResponse | null;
  lessons: LessonResponse[];
  onLessonSelect: (lessonId: string) => void;
  getLessonStatus: (lessonId: string) => LessonStatus;
  onProgress: (currentTime: number, duration: number) => void;
  onComplete: () => void;
  lastPosition?: number;
  isRtl: boolean;
  milestones: any[];
  courseId: string;
  onSwitchToQuiz?: () => void;
  isEnrolled?: boolean;
  onEnroll?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  activeLesson,
  lessons,
  onLessonSelect,
  getLessonStatus,
  onProgress,
  onComplete,
  lastPosition,
  isRtl,
  milestones,
  courseId,
  onSwitchToQuiz,
  isEnrolled = true,
  onEnroll,
}) => {
  const t = useTranslations("learn");
  const { user } = useAuth();
  const [videoProgress, setVideoProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [secureVideoUrl, setSecureVideoUrl] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | undefined>(undefined);
  const secureVideoUrlRef = useRef<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const refreshPositionRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const lastSyncRef = useRef(0);
  const playbackPositionRef = useRef(0);
  // SECURITY: track whether the current secureVideoUrl was just
  // refreshed mid-session so PodaciumVideoPlayer can restore position.
  const pendingRestorePositionRef = useRef<number | null>(null);

  const loadedLessonIdRef = useRef<string | null>(null);

  // Fetch the signed video URL from the server (CloudFront URLs expire, so
  // this is re-invoked periodically or on lesson change).
  const fetchSignedVideoUrl = useCallback(
    async (isLessonChange = false) => {
      if (
        !activeLesson?.videoUrl &&
        !activeLesson?.hlsPath &&
        !activeLesson?.rawPath
      ) {
        secureVideoUrlRef.current = null;
        setSecureVideoUrl(null);
        setIsLoadingVideo(false);
        loadedLessonIdRef.current = null;
        return;
      }

      // Embeds (YouTube, Vimeo, Dailymotion)
      if (
        activeLesson.storageProvider === "YOUTUBE" ||
        activeLesson.storageProvider === "VIMEO" ||
        activeLesson.storageProvider === "DAILYMOTION"
      ) {
        const url = activeLesson.videoUrl || null;
        secureVideoUrlRef.current = url;
        setSecureVideoUrl(url);
        setIsLoadingVideo(false);
        loadedLessonIdRef.current = activeLesson.id;
        return;
      }

      // Only show full loading UI if switching to a new lesson or if no URL loaded yet
      const needsFullLoad =
        isLessonChange ||
        loadedLessonIdRef.current !== activeLesson.id ||
        !secureVideoUrlRef.current;

      if (needsFullLoad) {
        setIsLoadingVideo(true);
        setVideoError(null);
      }

      try {
        const result = await getSignedVideoUrl(
          activeLesson.id,
          activeLesson.storageProvider,
          activeLesson.hlsPath || activeLesson.rawPath || undefined,
        );

        if (result.error) {
          setVideoError(result.error);
          secureVideoUrlRef.current = null;
          setSecureVideoUrl(null);
        } else if (result.signedUrl) {
          // If refreshing mid-session on same video, preserve position
          if (!needsFullLoad) {
            pendingRestorePositionRef.current = playbackPositionRef.current;
            refreshPositionRef.current = playbackPositionRef.current;
          }
          secureVideoUrlRef.current = result.signedUrl;
          setSecureVideoUrl(result.signedUrl);
          if (result.clientIp) {
            setClientIp(result.clientIp);
          }
          loadedLessonIdRef.current = activeLesson.id;
        }
      } catch (err) {
        if (needsFullLoad) {
          setVideoError(t("errors.secureLoadFailed"));
        }
        console.error("Error in fetchSignedVideoUrl:", err);
      } finally {
        if (needsFullLoad) {
          setIsLoadingVideo(false);
        }
      }
    },
    [
      activeLesson?.id,
      activeLesson?.videoUrl,
      activeLesson?.storageProvider,
      activeLesson?.hlsPath,
      activeLesson?.rawPath,
    ],
  );

  // Fetch secure video URL only when activeLesson ID or media paths actually change
  useEffect(() => {
    if (!activeLesson?.id) return;

    // Skip if we are already displaying this exact lesson
    if (
      loadedLessonIdRef.current === activeLesson.id &&
      secureVideoUrlRef.current
    ) {
      return;
    }

    fetchSignedVideoUrl(true);
  }, [
    activeLesson?.id,
    activeLesson?.videoUrl,
    activeLesson?.storageProvider,
    activeLesson?.hlsPath,
    activeLesson?.rawPath,
    fetchSignedVideoUrl,
  ]);

  // Pre-emptively refresh the signed URL well before it expires so a long
  // watch session never stalls mid-video. Signed URLs last ~2h server-side
  // (reduced from 12h); we refresh every 60 minutes to stay safely
  // within that window while avoiding unnecessary round-trips.
  useEffect(() => {
    if (
      !activeLesson?.videoUrl &&
      !activeLesson?.hlsPath &&
      !activeLesson?.rawPath
    )
      return;

    const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 60 min — well within 2h expiry
    const interval = setInterval(() => {
      fetchSignedVideoUrl();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    activeLesson?.videoUrl,
    activeLesson?.hlsPath,
    activeLesson?.rawPath,
    fetchSignedVideoUrl,
  ]);

  // Real-time status polling when video is currently transcoding in background.
  useEffect(() => {
    if (activeLesson?.transcodingStatus !== "processing") return;

    const pollInterval = setInterval(() => {
      fetchSignedVideoUrl();
    }, 5000); // Poll every 5 seconds until processing completes

    return () => clearInterval(pollInterval);
  }, [activeLesson?.transcodingStatus, fetchSignedVideoUrl]);

  // Handle video progress with non-blocking sync - must be defined before any conditional returns
  const handleVideoProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!duration || duration <= 0) return;

      const progress = Math.min(
        100,
        Math.max(0, (currentTime / duration) * 100),
      );
      if (
        Math.round(progress) !== Math.round(progressRef.current) ||
        progress >= 99
      ) {
        setVideoProgress(progress);
      }
      progressRef.current = progress;
      playbackPositionRef.current = currentTime;
      // Clear the pending restore position once the player is actively
      // reporting progress — it has already seeked to the right position.
      pendingRestorePositionRef.current = null;
      refreshPositionRef.current = null;

      // Call parent handler for milestone tracking
      onProgress(currentTime, duration);

      // Non-blocking sync to backend every 10 seconds or at key milestones
      const now = Date.now();
      const shouldSync =
        now - lastSyncRef.current > 10000 || // Every 10 seconds
        (progress >= 25 && progress < 26) ||
        (progress >= 50 && progress < 51) ||
        (progress >= 75 && progress < 76) ||
        (progress >= 90 && progress < 91) ||
        progress >= 99;

      if (shouldSync && user && activeLesson && !isSyncingRef.current) {
        isSyncingRef.current = true;
        setIsSyncing(true);
        lastSyncRef.current = now;

        // Save to localStorage immediately (non-blocking)
        AutomaticProgressSyncManager.saveVideoPosition(
          courseId,
          user.id,
          activeLesson.id,
          currentTime,
        );

        // Queue for backend sync
        AutomaticProgressSyncManager.queueProgressUpdate(
          courseId,
          user.id,
          activeLesson.id,
          progress,
          currentTime,
        );

        // Trigger background sync
        AutomaticProgressSyncManager.processAutomaticSync(
          courseId,
          user.id.toString(),
        ).finally(() => {
          isSyncingRef.current = false;
          setIsSyncing(false);
        });
      }
    },
    [activeLesson?.id, courseId, user?.id, onProgress],
  );

  // Handle video completion
  const handleVideoComplete = useCallback(() => {
    // Enforce 90% server watch criteria before marking complete to prevent HTTP 403 forgery rejection
    if (progressRef.current >= 90 || videoProgress >= 90) {
      setVideoProgress(100);
      progressRef.current = 100;

      // Force immediate sync on completion
      if (user && activeLesson) {
        AutomaticProgressSyncManager.queueProgressUpdate(
          courseId,
          user.id,
          activeLesson.id,
          100,
          undefined,
        );
        AutomaticProgressSyncManager.processAutomaticSync(
          courseId,
          user.id.toString(),
        );
      }

      onComplete();
    } else {
      console.warn(
        "⚠️ Video ended before 90% watch progress criteria was met. Completion sync skipped to prevent 403 rejection.",
      );
    }
  }, [activeLesson, courseId, user, onComplete, videoProgress]);

  // Check if next lesson is locked due to quiz requirement
  const nextLesson = useMemo(() => {
    if (!activeLesson || !lessons) return null;
    const currentIndex = lessons.findIndex((l) => l.id === activeLesson.id);
    return lessons[currentIndex + 1] || null;
  }, [activeLesson, lessons]);

  const hasQuiz = activeLesson?.quizId != null;
  const showQuizPrompt =
    videoProgress >= 100 && hasQuiz && nextLesson?.isLocked;

  // Get resume position from localStorage or backend
  const getResumePosition = useCallback(() => {
    if (!user || !activeLesson) return lastPosition || 0;

    const localPosition = AutomaticProgressSyncManager.getVideoPosition(
      courseId,
      user.id,
      activeLesson.id,
    );
    const backendPosition = lastPosition || 0;

    // Return the maximum position
    return Math.max(localPosition, backendPosition);
  }, [activeLesson?.id, courseId, user?.id, lastPosition]);

  // Memoize initial position per lesson so initialPosition prop remains stable during playback
  const initialLessonPosition = useMemo(() => {
    const position =
      pendingRestorePositionRef.current ??
      refreshPositionRef.current ??
      getResumePosition();
    pendingRestorePositionRef.current = null;
    if (refreshPositionRef.current !== null) {
      refreshPositionRef.current = null;
    }
    return position;
  }, [activeLesson?.id, getResumePosition]);

  // Early return after all hooks are defined
  if (!activeLesson) return null;

  return (
    <div className="space-y-6">
      {/* Video Player Container */}
      <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative group">
        {isLoadingVideo ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.videoLoading.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t("course.lessons.videoLoading.description")}
            </p>
          </div>
        ) : videoError ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <Lock className="w-20 h-20 text-red-500 dark:text-red-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.videoError.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">{videoError}</p>
          </div>
        ) : activeLesson.transcodingStatus === "processing" ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.transcoding.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t("course.lessons.transcoding.description")}
            </p>
          </div>
        ) : activeLesson.transcodingStatus === "failed" ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <AlertCircle className="w-20 h-20 text-red-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.transcodingFailed.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t("course.lessons.transcodingFailed.description")}
            </p>
          </div>
        ) : secureVideoUrl ? (
          <PodaciumVideoPlayer
            src={secureVideoUrl}
            poster={activeLesson.thumbnailUrl}
            onProgress={handleVideoProgress}
            onComplete={handleVideoComplete}
            onTokenExpired={fetchSignedVideoUrl}
            initialPosition={initialLessonPosition}
            autoPlay={false}
            controls={true}
            muted={true}
            isHls={
              !!activeLesson.hlsPath ||
              (secureVideoUrl ? secureVideoUrl.includes(".m3u8") : false)
            }
            subtitlesUrl={activeLesson?.subtitlesUrl}
            subtitlesLanguage={activeLesson?.subtitlesLanguage}
            userEmail={user?.email || "student@podacium.com"}
            userId={user?.id || 101}
            clientIp={clientIp}
            lessonId={activeLesson.id}
            title={activeLesson.title}
            courseTitle={t("course.header.title")}
          />
        ) : activeLesson.isLocked ? (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <Lock className="w-20 h-20 text-amber-500 dark:text-amber-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.locked.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t("course.lessons.locked.description")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white bg-gradient-to-br from-gray-900 to-black p-8 text-center">
            <Play className="w-20 h-20 text-gray-700 dark:text-slate-300 mb-4 animate-pulse" />
            <h3 className="text-xl font-bold mb-2">
              {t("course.lessons.videoNotAvailable.title")}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t("course.lessons.videoNotAvailable.description")}
            </p>
          </div>
        )}

        {/* Progress Overlay */}
        {videoProgress > 0 && videoProgress < 100 && (
          <div className="absolute top-4 end-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium z-20">
            {Math.round(videoProgress)}%
          </div>
        )}

        {/* Sync Indicator */}
        {isSyncing && (
          <div className="absolute top-4 start-4 bg-blue-600/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium z-20 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t("course.sync.syncing")}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
        {!isEnrolled && (
          <div className="mb-4 flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                {t("learn.preview.badge")}
              </span>
              <span className="text-xs text-emerald-900 dark:text-emerald-100 font-medium">
                {t("learn.preview.watchingBanner")}
              </span>
            </div>
            {onEnroll && (
              <button
                type="button"
                onClick={onEnroll}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                {t("learn.preview.enrollPrompt")}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {activeLesson.title}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {t("course.lessons.milestones.title")}:{" "}
              {Math.round(videoProgress)}%
            </span>
            {videoProgress >= 100 && (
              <span className="px-3 py-1 bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full text-sm font-medium">
                {t("course.lessons.status.completed")}
              </span>
            )}
          </div>
        </div>

        <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-6">
          {activeLesson.description}
        </p>

        {/* Progress Bar */}
        <div className="relative h-3 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 start-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${videoProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-slate-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        {/* Quiz Prompt - Shows when video complete but quiz not passed */}
        {showQuizPrompt && (
          <div className="mt-6 p-6 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <HelpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-1">
                  {t("course.lessons.completion.title")}
                </h4>
                <p className="text-amber-700 dark:text-amber-300 mb-4">
                  {t("course.lessons.completion.quizPrompt")}
                </p>
                <button
                  onClick={() => {
                    // Switch to quiz tab via callback
                    onSwitchToQuiz?.();
                  }}
                  className="px-6 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                >
                  {t("course.lessons.completion.quizButton")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End of Preview Enrollment Card */}
        {!isEnrolled && (videoProgress >= 90 || videoProgress === 100) && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">
                {t("learn.preview.enjoyedTitle")}
              </h4>
              <p className="text-sm text-blue-100 mt-1">
                {t("learn.preview.enjoyedDesc")}
              </p>
            </div>
            {onEnroll && (
              <PodaciumButton
                type="button"
                variant="secondary"
                onClick={onEnroll}
                className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 font-bold whitespace-nowrap shadow-md rounded-xl"
              >
                {t("learn.preview.enrollNow")}
              </PodaciumButton>
            )}
          </div>
        )}

        {/* Resume Button */}
        {videoProgress > 0 &&
          videoProgress < 100 &&
          getResumePosition() > 10 && (
            <div className="mt-4 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
              <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {t("course.lessons.resumeFrom")}{" "}
                  {formatTime(getResumePosition())}
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Circular Lesson Navigator */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-4 min-w-max">
          {lessons.map((lesson, index) => {
            const status = getLessonStatus(lesson.id);
            const isActive = lesson.id === activeLesson.id;
            const isLocked = status === LessonStatus.LOCKED;

            return (
              <motion.button
                key={lesson.id}
                whileHover={{ scale: isLocked ? 1 : 1.05 }}
                whileTap={{ scale: isLocked ? 1 : 0.95 }}
                onClick={() => !isLocked && onLessonSelect(lesson.id)}
                className={`
                                    relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                    ${isActive ? "border-blue-600 bg-blue-50 shadow-md" : "border-gray-200 dark:border-slate-800 hover:border-blue-300 bg-white dark:bg-slate-900"}
                                    ${isLocked ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"}
                                `}
              >
                <span
                  className={`text-lg font-bold ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-slate-400"}`}
                >
                  {index + 1}
                </span>
                {isLocked && (
                  <div className="absolute -top-1 -end-1 bg-gray-100 dark:bg-slate-800 rounded-full p-1 border border-gray-200 dark:border-slate-800">
                    <Lock className="w-3 h-3 text-gray-400" />
                  </div>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper function to format seconds to MM:SS
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default VideoPlayer;
