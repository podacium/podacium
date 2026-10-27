// components/course/VideoPlayer.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Loader2,
  AlertCircle,
  Rewind,
  FastForward,
  Subtitles,
  HelpCircle,
  Download,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import dynamic from "next/dynamic";
import Hls from "hls.js";
import { WatermarkWatchdog } from "./WatermarkWatchdog";
import { FrictionHeatmapScrubber } from "./FrictionHeatmapScrubber";
import { useOfflineVideoCache } from "@/hooks/useOfflineVideoCache";
import { IndexedDBFragmentLoader } from "./IndexedDBFragmentLoader";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface ThumbnailCue {
  start: number;
  end: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  courseTitle?: string;
  onProgress?: (progress: number, duration: number) => void;
  onComplete?: () => void;
  onTokenExpired?: () => void;
  initialPosition?: number;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  playbackRate?: number;
  width?: string | number;
  height?: string | number;
  isHls?: boolean;
  subtitlesUrl?: string;
  subtitlesLanguage?: string;
  userEmail?: string;
  userId?: string | number;
  clientIp?: string;
  thumbnailsVttUrl?: string;
  telemetryBins?: number[];
  lessonId?: string;
}

export default function VideoPlayer({
  src,
  poster,
  title,
  courseTitle,
  onProgress,
  onComplete,
  onTokenExpired,
  initialPosition = 0,
  autoPlay = false,
  controls = true,
  muted = false,
  loop = false,
  playbackRate = 1.0,
  width = "100%",
  height = "100%",
  isHls = false,
  subtitlesUrl,
  subtitlesLanguage,
  userEmail = "student@podacium.com",
  userId = 101,
  clientIp,
  thumbnailsVttUrl,
  telemetryBins = [],
  lessonId,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(muted ? 0 : 0.7);
  const [mutedState, setMutedState] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tamperAlert, setTamperAlert] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoPlay);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRateState, setPlaybackRateState] = useState(playbackRate);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [thumbnailCues, setThumbnailCues] = useState<ThumbnailCue[]>([]);
  const [activeThumbnail, setActiveThumbnail] = useState<ThumbnailCue | null>(
    null,
  );
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");
  const networkRetryCountRef = useRef(0);
  const inactivityTimerRef = useRef<NodeJS.Timeout>();
  const isAdjustingVolumeRef = useRef(false);
  const trackRef = useRef<HTMLTrackElement>(null);
  const t = useTranslations("component");

  const announceToScreenReader = useCallback((msg: string) => {
    setAriaAnnouncement(msg);
  }, []);

  useEffect(() => {
    if (!thumbnailsVttUrl) {
      setThumbnailCues([]);
      return;
    }
    let isCancelled = false;
    const fetchVtt = async () => {
      try {
        const resp = await fetch(thumbnailsVttUrl);
        if (!resp.ok) return;
        const text = await resp.text();
        const lines = text.split(/\r?\n/);
        const cues: ThumbnailCue[] = [];
        let i = 0;
        const parseTime = (tStr: string) => {
          const parts = tStr.trim().split(":");
          if (parts.length === 3) {
            const [h, m, s] = parts;
            return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
          } else if (parts.length === 2) {
            const [m, s] = parts;
            return parseFloat(m) * 60 + parseFloat(s);
          }
          return 0;
        };

        const baseUrl = thumbnailsVttUrl.substring(
          0,
          thumbnailsVttUrl.lastIndexOf("/") + 1,
        );

        while (i < lines.length) {
          const line = lines[i].trim();
          if (line.includes("-->")) {
            const [startStr, endStr] = line.split("-->");
            const start = parseTime(startStr);
            const end = parseTime(endStr.split(" ")[0]);
            i++;
            while (i < lines.length && !lines[i].trim()) i++;
            if (i < lines.length) {
              const cuePayload = lines[i].trim();
              const [imgPart, coordPart] = cuePayload.split("#xywh=");
              const resolvedImgUrl = imgPart.startsWith("http")
                ? imgPart
                : `${baseUrl}${imgPart}`;
              if (coordPart) {
                const [x, y, w, h] = coordPart.split(",").map(Number);
                cues.push({ start, end, url: resolvedImgUrl, x, y, w, h });
              }
            }
          }
          i++;
        }
        if (!isCancelled) {
          setThumbnailCues(cues);
        }
      } catch (err) {
        console.warn("Could not load thumbnail cues:", err);
      }
    };
    fetchVtt();
    return () => {
      isCancelled = true;
    };
  }, [thumbnailsVttUrl]);

  useEffect(() => {
    if (hoverTime === null || thumbnailCues.length === 0) {
      setActiveThumbnail(null);
      return;
    }
    const matched = thumbnailCues.find(
      (c) => hoverTime >= c.start && hoverTime < c.end,
    );
    setActiveThumbnail(matched || null);
  }, [hoverTime, thumbnailCues]);

  const handleSecurityViolation = useCallback(
    (reason: string) => {
      setPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.style.filter = "brightness(0)";
      }
      setTamperAlert(reason);
      if (lessonId) {
        fetch("/api/v1/education/video/security-violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lesson_id: lessonId, reason }),
        }).catch((err) => console.warn("Violation beacon failed", err));
      }
    },
    [lessonId],
  );

  // Cleanup function
  const cleanupVideo = useCallback(() => {
    if (videoRef.current) {
      // Pause the video
      videoRef.current.pause();

      // Disconnect all event handlers by replacing src
      videoRef.current.src = "";

      // Load empty source to stop any buffering
      videoRef.current.load();
    }

    // Clear timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, []);

  const hasInitializedPositionRef = useRef<string | null>(null);
  const lastEmittedProgressTimeRef = useRef<number>(0);
  const baseSrc = src ? src.split("?")[0] : "";
  const positionKey = `${lessonId || ""}-${baseSrc}`;

  // Initialize with initial position ONCE per lesson/src before playback starts
  useEffect(() => {
    if (
      videoRef.current &&
      initialPosition > 0 &&
      hasInitializedPositionRef.current !== positionKey &&
      !playing &&
      videoRef.current.currentTime < 1
    ) {
      videoRef.current.currentTime = initialPosition;
      setCurrentTime(initialPosition);
      hasInitializedPositionRef.current = positionKey;
    }
  }, [initialPosition, positionKey, playing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVideo();
    };
  }, [cleanupVideo]);

  // State for quality selection, speed, gestures, PiP, hover preview, shortcuts modal
  const [hlsLevels, setHlsLevels] = useState<
    Array<{ id: number; height: number; name: string }>
  >([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState<boolean>(false);
  const [touchRipple, setTouchRipple] = useState<{
    type: "rewind" | "forward";
    id: number;
  } | null>(null);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const lastTapTimeRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // ── Screen Wake Lock API ────────────────────────────────────────────────
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if (
        typeof navigator !== "undefined" &&
        "wakeLock" in navigator &&
        !wakeLockRef.current
      ) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch (_) {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (playing) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [playing, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && playing) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [playing, requestWakeLock]);

  // ── Media Session API ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || "Podacium Lesson",
      artist: courseTitle || "Podacium Academy",
      album: "Podacium Courses",
      artwork: [
        {
          src: poster || "/og-image.jpg",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      setPlaying(true);
      videoRef.current?.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      setPlaying(false);
      videoRef.current?.pause();
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const offset = details.seekOffset || 10;
      if (videoRef.current) {
        const target = Math.max(videoRef.current.currentTime - offset, 0);
        videoRef.current.currentTime = target;
        setCurrentTime(target);
      }
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const offset = details.seekOffset || 10;
      if (videoRef.current) {
        const target = Math.min(
          videoRef.current.currentTime + offset,
          duration || 0,
        );
        videoRef.current.currentTime = target;
        setCurrentTime(target);
      }
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (
        details.seekTime !== undefined &&
        details.seekTime !== null &&
        videoRef.current
      ) {
        videoRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekto", null);
      } catch (_) {}
    };
  }, [title, courseTitle, poster, duration]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";

    if (
      videoRef.current &&
      "setPositionState" in navigator.mediaSession &&
      duration > 0 &&
      !isNaN(duration) &&
      isFinite(duration)
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: playbackRateState,
          position: Math.min(currentTime, duration),
        });
      } catch (_) {}
    }
  }, [playing, currentTime, duration, playbackRateState]);

  // ── Offline Video Cache ────────────────────────────────────────────────
  const {
    isSupported: isOfflineSupported,
    cachedLessons,
    downloadProgress,
    isDownloading,
    downloadLesson,
    isLessonDownloaded,
    getLessonVideoBlobUrl,
    storeSegment,
  } = useOfflineVideoCache();

  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const isCached = lessonId ? cachedLessons.includes(lessonId) : false;
  const currentDownloadProgress = lessonId
    ? downloadProgress[lessonId] || 0
    : 0;
  const isLessonDownloading = lessonId
    ? isDownloading[lessonId] || false
    : false;
  const { isPoorConnection, saveData } = useNetworkQuality();

  useEffect(() => {
    let active = true;
    if (lessonId) {
      isLessonDownloaded(lessonId).then((downloaded) => {
        if (downloaded && active) {
          getLessonVideoBlobUrl(lessonId).then((blobUrl) => {
            if (active && blobUrl) {
              setOfflineBlobUrl(blobUrl);
            }
          });
        } else if (active) {
          setOfflineBlobUrl(null);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [lessonId, isLessonDownloaded, getLessonVideoBlobUrl]);

  // Determine if HLS should be used based on flag or URL extension
  const effectiveIsHls = isHls || (src ? src.includes(".m3u8") : false);

  // Preserve underlying video src across URL query parameter (token) updates
  // to avoid unloading HTML5 video buffer and issuing repetitive HTTP 206 range requests.
  const activeVideoSrcRef = useRef<string>("");
  const getStableVideoSrc = useCallback((rawSrc: string) => {
    if (!rawSrc) return "";
    const currentSrc = activeVideoSrcRef.current;
    if (currentSrc) {
      const baseCurrent = currentSrc.split("?")[0];
      const baseRaw = rawSrc.split("?")[0];
      if (baseCurrent === baseRaw) {
        return currentSrc;
      }
    }
    activeVideoSrcRef.current = rawSrc;
    return rawSrc;
  }, []);

  // HLS.js initialization for adaptive streaming with advanced buffer & ABR tuning
  const hlsRef = useRef<Hls | null>(null);
  useEffect(() => {
    if (!effectiveIsHls || !videoRef.current || !src || offlineBlobUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        fLoader: IndexedDBFragmentLoader as any,
        startPosition: initialPosition || -1,
        maxBufferLength: 90, // 90 seconds forward pre-buffering
        maxMaxBufferLength: 180, // Cap buffer at 3 minutes
        backBufferLength: 30, // Retain 30s for instant rewind
        maxBufferSize: 60 * 1024 * 1024, // 60MB RAM cap for low-end mobile devices
        enableWorker: true, // Offload demuxing to Web Worker
        abrEwmaDefaultEstimate: isPoorConnection || saveData ? 400000 : 1200000, // Adaptive based on network
        abrBandWidthUpFactor: 0.7, // Require 30% headroom before up-switching
        abrBandWidthFactor: 0.9, // Sensitive down-switching to avoid stalls
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 6,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        if (data.levels && data.levels.length > 0) {
          const levels = data.levels.map((lvl, index) => ({
            id: index,
            height: lvl.height || 0,
            name: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
          }));
          setHlsLevels(levels);
        }
        if (autoPlay) videoRef.current?.play();
      });

      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        networkRetryCountRef.current = 0;
        if (lessonId && data.frag?.url && data.payload) {
          storeSegment(data.frag.url, data.payload, lessonId).catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(
                "HLS network error encountered, triggering recovery with backoff...",
                data,
              );
              if (onTokenExpired) {
                onTokenExpired();
              }
              if (networkRetryCountRef.current < 5) {
                networkRetryCountRef.current += 1;
                const delay = Math.min(
                  1000 * Math.pow(1.5, networkRetryCountRef.current) +
                    Math.random() * 500,
                  10000,
                );
                setTimeout(() => {
                  hls.startLoad();
                }, delay);
              } else {
                setError(t("video.hlsError"));
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(
                "HLS media error encountered, recovering media...",
                data,
              );
              hls.recoverMediaError();
              break;
            default:
              setError(t("video.hlsError"));
              hls.destroy();
              break;
          }
        }
      });
      return () => {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch (e) {
          // Ignored on teardown
        }
        hlsRef.current = null;
      };
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      videoRef.current.src = src;
    }
  }, [baseSrc, effectiveIsHls, autoPlay]);

  // Reset controls visibility timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Don't reset timer if user is adjusting volume
    if (isAdjustingVolumeRef.current) return;

    setShowControls(true);

    inactivityTimerRef.current = setTimeout(() => {
      if (playing) {
        setShowControls(false);
      }
    }, 3000);
  }, [playing]);

  // Periodic 10s playback heartbeat beacon to backend interval tracker
  const lastHeartbeatTimeRef = useRef<number>(0);
  const lastWallClockRef = useRef<number>(performance.now());
  const watchedIntervalsRef = useRef<Array<[number, number]>>([]);

  useEffect(() => {
    if (!playing || !lessonId) return;

    lastWallClockRef.current = performance.now();

    const interval = setInterval(async () => {
      if (!videoRef.current) return;
      const currTime = videoRef.current.currentTime;
      const startTime = lastHeartbeatTimeRef.current;
      const nowWallClock = performance.now();
      const wallElapsed = Math.max(
        0.5,
        (nowWallClock - lastWallClockRef.current) / 1000,
      );
      lastWallClockRef.current = nowWallClock;

      if (currTime > startTime) {
        const newInterval: [number, number] = [startTime, currTime];
        watchedIntervalsRef.current.push(newInterval);

        try {
          await fetch(`/api/v1/education/lessons/${lessonId}/heartbeat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start_time: startTime,
              end_time: currTime,
              time_elapsed: parseFloat(wallElapsed.toFixed(2)),
              existing_intervals: watchedIntervalsRef.current,
            }),
          });
        } catch (err) {
          console.warn("Heartbeat reporting failed", err);
        }
      }

      lastHeartbeatTimeRef.current = currTime;
    }, 10000);

    return () => clearInterval(interval);
  }, [playing, lessonId]);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }, []);

  // Also cleanup on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && videoRef.current) {
        videoRef.current.pause();
        setPlaying(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Toggle subtitle track mode
  useEffect(() => {
    if (trackRef.current && trackRef.current.track) {
      trackRef.current.track.mode = showSubtitles ? "showing" : "hidden";
    }
  }, [showSubtitles, subtitlesUrl]);

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;

      // Set duration if it's valid
      if (
        videoDuration &&
        videoDuration > 0 &&
        !isNaN(videoDuration) &&
        isFinite(videoDuration)
      ) {
        setDuration(videoDuration);
      } else {
        console.warn("⚠️ Invalid video duration:", videoDuration);
        // Try to get duration again after a delay
        setTimeout(() => {
          if (videoRef.current && videoRef.current.duration > 0) {
            setDuration(videoRef.current.duration);
          }
        }, 1000);
      }

      videoRef.current.playbackRate = playbackRateState;

      // Apply initial position only if not already initialized
      if (
        initialPosition > 0 &&
        hasInitializedPositionRef.current !== positionKey &&
        !playing &&
        videoRef.current.currentTime < 1
      ) {
        videoRef.current.currentTime = initialPosition;
        setCurrentTime(initialPosition);
        hasInitializedPositionRef.current = positionKey;
      }
    }
  }, [initialPosition, positionKey, playbackRateState, playing]);

  // Handle video data loaded
  const handleLoadedData = useCallback(() => {
    setIsLoading(false);

    // Double-check duration when data is loaded
    if (videoRef.current && videoRef.current.duration > 0 && duration === 0) {
      setDuration(videoRef.current.duration);
    }
  }, [duration]);

  // Ref to track the play promise to prevent AbortError when pausing too quickly
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Handle play/pause
  const togglePlay = useCallback(async () => {
    if (videoRef.current) {
      if (playing) {
        // If there's an ongoing play request, wait for it before pausing
        if (playPromiseRef.current !== null) {
          try {
            await playPromiseRef.current;
          } catch (e) {
            // Ignore if the play promise was rejected
          }
        }
        videoRef.current.pause();
        setPlaying(false);
      } else {
        setPlaying(true);
        playPromiseRef.current = videoRef.current.play();

        try {
          await playPromiseRef.current;
          playPromiseRef.current = null;
        } catch (e: any) {
          playPromiseRef.current = null;
          console.error("Play error:", e);
          // If autoplay is blocked, mute and try again
          if (e.name === "NotAllowedError") {
            if (videoRef.current) {
              videoRef.current.muted = true;
              setMutedState(true);
              playPromiseRef.current = videoRef.current.play();
              try {
                await playPromiseRef.current;
              } catch (retryError) {
                console.error("Retry play error:", retryError);
              } finally {
                playPromiseRef.current = null;
              }
            }
          } else {
            setPlaying(false); // Reset playing state if it truly failed
          }
        }
      }
    }
    resetInactivityTimer();
  }, [playing, resetInactivityTimer]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setIsBuffering(false);

    // Check duration when video can play
    if (videoRef.current && videoRef.current.duration > 0 && duration === 0) {
      setDuration(videoRef.current.duration);
    }
  }, [duration]);

  // Update the playing event handler
  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setIsLoading(false);
  }, []);

  // Update the waiting event handler
  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  // Handle volume - fixed to not reset inactivity timer
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setMutedState(newVolume === 0);
      }
      // Don't reset inactivity timer for volume changes
    },
    [],
  );

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !mutedState;
      setMutedState(!mutedState);
      if (!mutedState && volume === 0) {
        setVolume(0.7);
        videoRef.current.volume = 0.7;
      }
    }
    resetInactivityTimer();
  }, [mutedState, volume, resetInactivityTimer]);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Try to get duration if it's still 0
      if (
        (duration === 0 || isNaN(duration)) &&
        videoRef.current.duration > 0
      ) {
        setDuration(videoRef.current.duration);
      }

      // Call progress callback at most once every 2 seconds or when video ends
      if (onProgress && duration > 0) {
        const now = Date.now();
        if (
          now - lastEmittedProgressTimeRef.current >= 2000 ||
          Math.abs(time - duration) < 0.5
        ) {
          lastEmittedProgressTimeRef.current = now;
          onProgress(time, duration);
        }
      }

      // Clear buffering when time updates
      if (isBuffering) {
        setIsBuffering(false);
      }
    }
  }, [onProgress, duration, isBuffering]);

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent click event from bubbling
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      lastHeartbeatTimeRef.current = time;
      setCurrentTime(time);
    }
    resetInactivityTimer();
  };

  const handleSeeked = useCallback(() => {
    if (videoRef.current) {
      lastHeartbeatTimeRef.current = videoRef.current.currentTime;
    }
  }, []);

  // Skip forward/backward
  const skipForward = useCallback(() => {
    if (videoRef.current) {
      const vidDuration = videoRef.current.duration || duration;
      const newTime = Math.min(vidDuration, videoRef.current.currentTime + 10);
      videoRef.current.currentTime = newTime;
      lastHeartbeatTimeRef.current = newTime;
      setCurrentTime(newTime);
    }
    resetInactivityTimer();
  }, [duration, resetInactivityTimer]);

  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 10);
      videoRef.current.currentTime = newTime;
      lastHeartbeatTimeRef.current = newTime;
      setCurrentTime(newTime);
    }
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Handle video ended
  const handleEnded = useCallback(() => {
    setPlaying(false);

    if (onComplete) {
      onComplete();
    }

    // Handle loop
    if (loop && videoRef.current) {
      videoRef.current.currentTime = 0;
      if (autoPlay) {
        videoRef.current.play();
        setPlaying(true);
      }
    }
  }, [onComplete, loop, autoPlay]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    resetInactivityTimer();
  }, [isFullscreen, resetInactivityTimer]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Handle keyboard shortcuts — scoped to the video container only.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing in an editable field
      // (inputs, textareas, contenteditable, selects) elsewhere on the page.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      // Only handle shortcuts when the video container itself is focused —
      // never when focus lives outside it, even while the video is playing.
      const isVideoFocused = containerRef.current?.contains(
        document.activeElement,
      );
      if (!isVideoFocused) return;

      setShowControls(true);
      resetInactivityTimer();

      switch (e.key) {
        case " ":
        case "Enter":
        case "k":
        case "K":
          togglePlay();
          announceToScreenReader(
            playing ? "Lecture en pause" : "Lecture en cours",
          );
          break;

        case "j":
        case "J":
          skipBackward();
          announceToScreenReader("Recul de 10 secondes");
          break;

        case "l":
        case "L":
          skipForward();
          announceToScreenReader("Avance de 10 secondes");
          break;

        case "c":
        case "C":
          setShowSubtitles((prev) => {
            const next = !prev;
            announceToScreenReader(
              next ? "Sous-titres activés" : "Sous-titres désactivés",
            );
            return next;
          });
          break;

        case "ArrowLeft":
          // Seek backward 5 seconds
          if (videoRef.current) {
            const newTime = Math.max(0, videoRef.current.currentTime - 5);
            videoRef.current.currentTime = newTime;
            lastHeartbeatTimeRef.current = newTime;
            setCurrentTime(newTime);
            announceToScreenReader("Recul de 5 secondes");
          }
          break;

        case "ArrowRight":
          // Seek forward 5 seconds
          if (videoRef.current) {
            const vidDuration = videoRef.current.duration || 0;
            const newTime = Math.min(
              vidDuration,
              videoRef.current.currentTime + 5,
            );
            videoRef.current.currentTime = newTime;
            lastHeartbeatTimeRef.current = newTime;
            setCurrentTime(newTime);
            announceToScreenReader("Avance de 5 secondes");
          }
          break;

        case "ArrowUp":
          // Increase volume
          if (videoRef.current) {
            const newVolume = Math.min(1, (videoRef.current.volume || 0) + 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume > 0) {
              setMutedState(false);
              videoRef.current.muted = false;
            }
            announceToScreenReader(`Volume ${Math.round(newVolume * 100)}%`);
          }
          break;

        case "ArrowDown":
          // Decrease volume
          if (videoRef.current) {
            const newVolume = Math.max(0, (videoRef.current.volume || 0) - 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume === 0) {
              setMutedState(true);
              videoRef.current.muted = true;
            }
            announceToScreenReader(`Volume ${Math.round(newVolume * 100)}%`);
          }
          break;

        case "f":
        case "F":
          toggleFullscreen();
          announceToScreenReader(
            isFullscreen ? "Plein écran désactivé" : "Plein écran activé",
          );
          break;

        case "m":
        case "M":
          toggleMute();
          announceToScreenReader(mutedState ? "Son réactivé" : "Son coupé");
          break;

        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          // Seek to percentage (0 = 0%, 1 = 10%, ..., 9 = 90%)
          if (videoRef.current && videoRef.current.duration > 0) {
            const percentage = e.key === "0" ? 0 : parseInt(e.key) * 0.1;
            const newTime = videoRef.current.duration * percentage;
            videoRef.current.currentTime = newTime;
            lastHeartbeatTimeRef.current = newTime;
            setCurrentTime(newTime);
            announceToScreenReader(`Position ${Math.round(percentage * 100)}%`);
          }
          break;

        case ">":
        case ".":
          // Increase playback rate
          setPlaybackRateState((prev) => {
            const next = Math.min(4, prev + 0.25);
            announceToScreenReader(`Vitesse ${next}x`);
            return next;
          });
          break;

        case "<":
        case ",":
          // Decrease playback rate
          setPlaybackRateState((prev) => {
            const next = Math.max(0.25, prev - 0.25);
            announceToScreenReader(`Vitesse ${next}x`);
            return next;
          });
          break;

        default:
          return;
      }

      // Only preventDefault / stopPropagation for keys we actually consumed.
      e.preventDefault();
      e.stopPropagation();
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    playing,
    isFullscreen,
    mutedState,
    resetInactivityTimer,
    togglePlay,
    skipBackward,
    skipForward,
    toggleFullscreen,
    toggleMute,
    announceToScreenReader,
  ]);

  // Handle mouse move (show controls)
  const handleMouseMove = () => {
    setShowControls(true);
    resetInactivityTimer();
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    if (playing) {
      setTimeout(() => {
        setShowControls(false);
      }, 1000);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle quality level change
  const handleQualityChange = useCallback((levelId: number) => {
    setCurrentQuality(levelId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
    }
  }, []);

  // Toggle Data Saver (360p/480p low-bitrate profile for Algerian 3G/4G networks)
  const toggleDataSaver = useCallback(() => {
    setDataSaver((prev) => {
      const next = !prev;
      if (next) {
        if (hlsRef.current && hlsLevels.length > 0) {
          const lowestLevel = 0;
          setCurrentQuality(lowestLevel);
          hlsRef.current.currentLevel = lowestLevel;
        }
      } else {
        setCurrentQuality(-1);
        if (hlsRef.current) {
          hlsRef.current.currentLevel = -1;
        }
      }
      return next;
    });
  }, [hlsLevels]);

  // Toggle Picture-in-Picture mode
  const togglePip = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (document.pictureInPictureEnabled) {
        if (videoRef.current.readyState < 1) {
          return;
        }
        await videoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch (e) {
      console.warn("Picture-in-Picture error:", e);
    }
  }, []);

  // Handle playback rate change with pitch preservation
  useEffect(() => {
    if (videoRef.current) {
      // Preserve pitch across all playback speeds
      if ("preservesPitch" in videoRef.current) {
        (videoRef.current as any).preservesPitch = true;
      }
      const targetRate = isSpeedBoosted ? 2.0 : playbackRateState;
      videoRef.current.playbackRate = targetRate;
    }
  }, [playbackRateState, isSpeedBoosted]);

  // Handle double-tap seek and long-press speed boost gestures
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle if clicking empty player area
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest(".control-container")
    ) {
      return;
    }

    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    // Check for double-tap seek
    if (
      now - lastTapTimeRef.current.time < 300 &&
      Math.abs(clickX - lastTapTimeRef.current.x) < 50
    ) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (clickX < width * 0.4) {
        skipBackward();
        setTouchRipple({ type: "rewind", id: now });
      } else if (clickX > width * 0.6) {
        skipForward();
        setTouchRipple({ type: "forward", id: now });
      }
      setTimeout(() => setTouchRipple(null), 700);
      lastTapTimeRef.current = { time: 0, x: 0 };
      return;
    }
    lastTapTimeRef.current = { time: now, x: clickX };

    // Start long-press timer for temporary 2x speed boost
    longPressTimerRef.current = setTimeout(() => {
      setIsSpeedBoosted(true);
    }, 400);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (isSpeedBoosted) {
      setIsSpeedBoosted(false);
    }
  };

  // Handle volume slider interaction
  const handleVolumeInteractionStart = (
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    isAdjustingVolumeRef.current = true;
    setShowControls(true);

    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };

  const handleVolumeInteractionEnd = (
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    isAdjustingVolumeRef.current = false;
    // Start the inactivity timer again
    resetInactivityTimer();
  };

  // Focus container when clicked - FIXED VERSION
  const handleContainerClick = (e: React.MouseEvent) => {
    // Check if the click target is an interactive element
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.closest("button") ||
      target.closest('input[type="range"]') ||
      target.closest(".skip-button") ||
      target.closest(".control-button") ||
      target.closest("svg") ||
      target.closest(".volume-slider") ||
      target.closest(".progress-bar") ||
      target.closest(".control-container");

    // Only toggle play/pause if NOT clicking on interactive elements
    if (!isInteractiveElement) {
      togglePlay();
    }

    // Focus the container for keyboard input
    if (containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }
  };

  const renderCenterLoadingSpinnerV2 = () => {
    if (!isBuffering && !isLoading) return null;

    return (
      <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
        <div className="relative">
          {/* Background blur */}
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20 rounded-full blur-xl"></div>

          {/* Spinner container */}
          <div className="relative w-20 h-20">
            {/* Gradient ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin"></div>

            {/* Inner ring */}
            <div className="absolute inset-3 rounded-full border-2 border-white/30"></div>

            {/* Center dot */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse"></div>

            {/* Optional: Text */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white text-xs font-medium whitespace-nowrap">
              {t("compcourse.video.loading")}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render loading state
  const renderLoadingState = () => {
    // Only show loading if explicitly loading AND no error
    if (!isLoading || error) return null;

    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center z-40">
        <div className="text-center">
          <div className="relative mb-4">
            <Loader2 className="w-12 h-12 text-blue-500 dark:text-blue-400 animate-spin mx-auto" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          </div>
          <p className="text-gray-300">{t("compcourse.video.loading")}</p>
          {duration === 0 && (
            <p className="text-gray-400 text-sm mt-2">
              {t("compcourse.video.fetchingDuration")}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Render error state
  const renderErrorState = () => {
    if (!error) return null;

    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            {t("compcourse.video.playbackError")}
          </h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setError(null);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("compcourse.video.retry")}
          </button>
        </div>
      </div>
    );
  };

  // Render buffering state
  const renderBufferingState = () => {
    // Don't show this if we're already showing the center spinner
    if (!isBuffering || error) return null;

    // Show a subtle indicator in the corner instead
    return (
      <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 z-30">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <span>{t("compcourse.video.buffering")}</span>
      </div>
    );
  };

  // Render controls
  const renderControls = () => {
    if (!controls || error) return null;

    // Calculate progress percentage safely but rounded to 0 decimal places
    const progressPercentage = Math.round(
      Math.min(
        100,
        Math.max(0, duration > 0 ? (currentTime / duration) * 100 : 0),
      ),
    );

    return (
      <AnimatePresence>
        {(showControls || !playing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
          >
            {/* Available Offline Badge */}
            {isCached && (
              <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-semibold backdrop-blur-md shadow-lg border border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t("video.player.availableOffline")}</span>
              </div>
            )}
            {/* Center play button when paused */}
            {!playing && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="p-6 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-200 z-50"
                >
                  <Play className="w-12 h-12 ml-1" />
                </button>
              </div>
            )}

            {/* Bottom controls */}
            <div
              className="absolute bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 bg-slate-900/85 dark:bg-slate-950/90 backdrop-blur-xl border border-white/15 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-2xl z-30"
              dir="ltr"
            >
              {/* Telemetry Friction Heatmap */}
              <div className="relative w-full">
                <FrictionHeatmapScrubber telemetryBins={telemetryBins} />
              </div>

              {/* Progress bar - ALWAYS VISIBLE */}
              <div
                className="relative h-2 w-full mb-3 sm:mb-4 progress-bar cursor-pointer"
                dir="ltr"
              >
                {/* Progress track background with clipped inner fill */}
                <div className="absolute inset-0 bg-gray-600/50 rounded-full overflow-hidden">
                  {/* Progress background (Colored Fill) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-150"
                    style={{
                      width: `${progressPercentage}%`,
                    }}
                  />
                </div>

                {/* Hover time tooltip with WebVTT thumbnail preview */}
                {hoverTime !== null && (
                  <div
                    className="absolute -top-32 flex flex-col items-center -translate-x-1/2 pointer-events-none z-30 transition-transform duration-75"
                    style={{ left: `${hoverX}px` }}
                  >
                    {activeThumbnail ? (
                      <div
                        className="mb-1.5 rounded-lg overflow-hidden border border-white/20 shadow-2xl bg-black"
                        style={{
                          width: `${activeThumbnail.w}px`,
                          height: `${activeThumbnail.h}px`,
                          backgroundImage: `url(${activeThumbnail.url})`,
                          backgroundPosition: `-${activeThumbnail.x}px -${activeThumbnail.y}px`,
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    ) : null}
                    <div className="px-2 py-0.5 bg-black/95 text-white text-xs font-mono rounded shadow-lg border border-white/10 dark:border-slate-800/30 whitespace-nowrap">
                      {formatTime(hoverTime)}
                    </div>
                  </div>
                )}

                {/* Seek input */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0.0001} // Use a very small number instead of 0
                  value={currentTime}
                  onChange={handleSeek}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(
                      0,
                      Math.min(e.clientX - rect.left, rect.width),
                    );
                    const targetTime =
                      duration > 0 ? (x / rect.width) * duration : 0;
                    setHoverX(x);
                    setHoverTime(targetTime);
                  }}
                  onMouseLeave={() => setHoverTime(null)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-20"
                  style={{ direction: "ltr" }}
                  disabled={duration === 0}
                />

                {/* Progress indicator - ALWAYS VISIBLE */}
                <div
                  className="absolute top-1/2 w-4 h-4 -translate-y-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 rounded-full shadow-lg border-2 border-blue-500 transition-all duration-150 z-10 pointer-events-none"
                  style={{
                    left: `${progressPercentage}%`,
                  }}
                />
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between control-container">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 control-button"
                  >
                    {playing ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      skipBackward();
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 skip-button"
                    disabled={duration === 0}
                  >
                    <Rewind className="w-5 h-5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      skipForward();
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 skip-button"
                    disabled={duration === 0}
                  >
                    <FastForward className="w-5 h-5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 control-button"
                  >
                    {mutedState || volume === 0 ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  {/* Volume slider - FIXED */}
                  <div
                    className="w-24 relative group volume-slider"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step="any"
                      value={volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleVolumeInteractionStart(e);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleVolumeInteractionEnd(e);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleVolumeInteractionStart(e);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        handleVolumeInteractionEnd(e);
                      }}
                      className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer 
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:w-4 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-white dark:bg-slate-900
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-blue-400
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white dark:bg-slate-900
                        [&::-moz-range-thumb]:border-2
                        [&::-moz-range-thumb]:border-blue-400
                        [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {Math.round(volume * 100)}%
                    </div>
                  </div>

                  <div className="text-sm text-white font-medium">
                    <span>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Quick-Speed Pill */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
                      const currentIndex = speeds.indexOf(playbackRateState);
                      const nextSpeed =
                        speeds[(currentIndex + 1) % speeds.length];
                      changePlaybackRate(nextSpeed);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-semibold transition-all duration-150 control-button border border-white/10 shadow-sm"
                    title={t("compcourse.video.speed")}
                  >
                    {playbackRateState}x
                  </button>

                  {/* Offline Download Button with Progress Indicator */}
                  {isOfflineSupported && lessonId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCached && !isLessonDownloading) {
                          downloadLesson(lessonId, src);
                        }
                      }}
                      disabled={isLessonDownloading}
                      className={`p-2 rounded-full transition-colors duration-200 control-button flex items-center justify-center relative ${
                        isCached
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : isLessonDownloading
                            ? "bg-blue-500/30 text-blue-300"
                            : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                      title={
                        isCached
                          ? t("video.player.availableOffline")
                          : isLessonDownloading
                            ? `Downloading: ${currentDownloadProgress}%`
                            : "Download for Offline Viewing"
                      }
                    >
                      {isLessonDownloading ? (
                        <div className="flex items-center gap-1 px-1">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <span className="text-[10px] font-bold">
                            {currentDownloadProgress}%
                          </span>
                        </div>
                      ) : isCached ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  {/* Settings Button & Popover */}
                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsMenu(!showSettingsMenu);
                      }}
                      className={`p-2 rounded-full transition-colors duration-200 control-button ${
                        showSettingsMenu
                          ? "bg-blue-500/30 text-blue-300"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                      title={t("compcourse.video.settingsTitle")}
                    >
                      <Settings className="w-5 h-5" />
                    </button>

                    {showSettingsMenu && (
                      <div className="absolute bottom-12 right-0 w-56 bg-gray-900/95 backdrop-blur-md border border-white/20 dark:border-slate-800/40 rounded-xl p-3 shadow-2xl text-white z-50 animate-in fade-in zoom-in-95 duration-150">
                        {/* Playback Speed Section */}
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                            {t("compcourse.video.speed")}
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5].map(
                              (rate) => (
                                <button
                                  key={rate}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlaybackRateState(rate);
                                  }}
                                  className={`px-1.5 py-1 text-xs rounded-md transition-colors font-medium ${
                                    playbackRateState === rate
                                      ? "bg-blue-600 text-white"
                                      : "bg-white/10 hover:bg-white/20 text-gray-200"
                                  }`}
                                >
                                  {rate}x
                                </button>
                              ),
                            )}
                          </div>
                        </div>

                        {/* Data Saver Mode (3G/4G optimization) */}
                        <div className="pb-2 border-b border-white/10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDataSaver();
                            }}
                            className={`w-full text-start px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                              dataSaver
                                ? "bg-emerald-600/80 text-white font-medium"
                                : "hover:bg-white/10 text-gray-200"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span>📱</span>
                              <span>{t("compcourse.video.dataSaver")}</span>
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/20">
                              {dataSaver
                                ? t("compcourse.video.dataSaverActive")
                                : t("compcourse.video.dataSaverDisabled")}
                            </span>
                          </button>
                        </div>

                        {/* Quality Section */}
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                            {t("compcourse.video.quality")}
                          </div>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {hlsLevels.length > 0 ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQualityChange(-1);
                                  }}
                                  className={`w-full text-start px-2.5 py-1 text-xs rounded-md transition-colors flex items-center justify-between ${
                                    currentQuality === -1
                                      ? "bg-blue-600 text-white font-medium"
                                      : "hover:bg-white/10 text-gray-200"
                                  }`}
                                >
                                  <span>{t("compcourse.video.autoAbr")}</span>
                                  {currentQuality === -1 && (
                                    <span className="text-[10px]">✓</span>
                                  )}
                                </button>
                                {hlsLevels.map((lvl) => (
                                  <button
                                    key={lvl.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQualityChange(lvl.id);
                                    }}
                                    className={`w-full text-start px-2.5 py-1 text-xs rounded-md transition-colors flex items-center justify-between ${
                                      currentQuality === lvl.id
                                        ? "bg-blue-600 text-white font-medium"
                                        : "hover:bg-white/10 text-gray-200"
                                    }`}
                                  >
                                    <span>{lvl.name}</span>
                                    {currentQuality === lvl.id && (
                                      <span className="text-[10px]">✓</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <div className="px-2.5 py-1 text-xs text-gray-300 bg-white/5 rounded-md flex items-center justify-between">
                                <span>
                                  {t("compcourse.video.autoOriginal")}
                                </span>
                                <span className="text-[10px] text-blue-400 font-medium">
                                  ✓
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keyboard Shortcuts Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShortcutsModal(!showShortcutsModal);
                    }}
                    className={`p-2 rounded-full transition-colors duration-200 control-button ${
                      showShortcutsModal
                        ? "bg-blue-500/30 text-blue-300"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                    title={t("compcourse.video.keyboardShortcuts")}
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>

                  {/* Picture in Picture Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePip();
                    }}
                    className={`p-2 rounded-full transition-colors duration-200 control-button ${
                      isPipActive
                        ? "bg-blue-500/30 text-blue-300"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                    title={t("compcourse.video.pictureInPicture")}
                  >
                    <Minimize className="w-5 h-5" />
                  </button>

                  {subtitlesUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSubtitles(!showSubtitles);
                      }}
                      className={`p-2 rounded-full transition-colors duration-200 control-button ${
                        showSubtitles
                          ? "bg-blue-500/30 text-blue-300"
                          : "bg-white/10 text-white/60 hover:bg-white/20"
                      }`}
                      title={
                        showSubtitles
                          ? t("compcourse.video.disableCaptions")
                          : t("compcourse.video.enableCaptions")
                      }
                    >
                      <Subtitles className="w-5 h-5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setCurrentTime(0);
                      }
                    }}
                    className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors duration-200 control-button"
                    disabled={duration === 0}
                  >
                    {t("compcourse.video.controls.replay")}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 control-button"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5" />
                    ) : (
                      <Maximize className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Check if source is external (Vimeo/YouTube/Dailymotion)
  const isExternalService = React.useMemo(() => {
    return (
      src.includes("vimeo.com") ||
      src.includes("youtube.com") ||
      src.includes("youtu.be") ||
      src.includes("dailymotion.com") ||
      src.includes("dai.ly")
    );
  }, [src]);

  if (isExternalService) {
    return (
      <div
        ref={containerRef}
        role="region"
        aria-label={t("video.player.videoPlayerAria")}
        className="relative w-full h-full bg-black rounded-2xl overflow-hidden"
        style={{ width, height }}
      >
        <div role="status" aria-live="polite" className="sr-only">
          {ariaAnnouncement}
        </div>
        {/* Dynamic Watermark Security Watchdog */}
        {userEmail && userId && (
          <WatermarkWatchdog
            userEmail={userEmail}
            userId={userId}
            ipAddress={clientIp}
            onSecurityViolation={handleSecurityViolation}
          />
        )}
        {tamperAlert && (
          <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center text-red-400">
            <AlertCircle className="w-12 h-12 mb-3 text-red-500 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">
              {t("video.player.tamperAlert")}
            </h3>
            <p className="text-sm text-gray-400 max-w-md">{tamperAlert}</p>
          </div>
        )}
        <ReactPlayer
          url={src}
          width="100%"
          height="100%"
          controls={true}
          playing={playing}
          muted={muted}
          onProgress={(state: {
            played: number;
            playedSeconds: number;
            loaded: number;
            loadedSeconds: number;
          }) => {
            setCurrentTime(state.playedSeconds);
            if (onProgress && duration > 0) {
              const now = Date.now();
              if (
                now - lastEmittedProgressTimeRef.current >= 2000 ||
                Math.abs(state.playedSeconds - duration) < 0.5
              ) {
                lastEmittedProgressTimeRef.current = now;
                onProgress(state.playedSeconds, duration);
              }
            }
          }}
          onDuration={(d: number) => setDuration(d)}
          onEnded={onComplete}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t("video.player.videoPlayerAria")}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      style={{ width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      tabIndex={0}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>
      {/* Dynamic Watermark Security Watchdog */}
      <WatermarkWatchdog
        userEmail={userEmail}
        userId={userId}
        ipAddress={clientIp}
        onSecurityViolation={handleSecurityViolation}
      />
      {tamperAlert && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center text-red-400">
          <AlertCircle className="w-12 h-12 mb-3 text-red-500 animate-bounce" />
          <h3 className="text-lg font-bold text-white mb-2">
            {t("video.player.tamperAlert")}
          </h3>
          <p className="text-sm text-gray-400 max-w-md">{tamperAlert}</p>
        </div>
      )}
      {/* 2.0x Speed Boost Badge Overlay */}
      {isSpeedBoosted && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white font-semibold text-xs px-3 py-1.5 rounded-full shadow-lg border border-blue-400/50 flex items-center gap-1.5 z-40 animate-pulse">
          <FastForward className="w-4 h-4" />
          <span>{t("compcourse.video.speedBoost")}</span>
        </div>
      )}
      {/* Touch Double-Tap Seek Ripples */}
      {touchRipple && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 p-6 rounded-full bg-white/20 backdrop-blur-md text-white z-40 animate-ping ${
            touchRipple.type === "rewind" ? "left-12" : "right-12"
          }`}
        >
          {touchRipple.type === "rewind" ? (
            <Rewind className="w-8 h-8" />
          ) : (
            <FastForward className="w-8 h-8" />
          )}
        </div>
      )}
      {/* Video element */}
      <video
        ref={videoRef}
        src={
          offlineBlobUrl ||
          (effectiveIsHls ? undefined : getStableVideoSrc(src))
        }
        poster={poster}
        preload="auto"
        playsInline
        className="w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onError={(e) => {
          console.error("Video error occurred");
          // Don't set error state immediately - let the video retry
          // This handles transient errors that resolve quickly
          setTimeout(() => {
            if (videoRef.current?.error) {
              setError(t("video.loadError"));
              setIsLoading(false);
              setIsBuffering(false);
            }
          }, 1000);
        }}
        onTimeUpdate={handleTimeUpdate}
        onSeeked={handleSeeked}
        onEnded={handleEnded}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onDurationChange={() => {
          if (videoRef.current && videoRef.current.duration > 0) {
            setDuration(videoRef.current.duration);
          }
        }}
        autoPlay={autoPlay}
        muted={mutedState}
        loop={loop}
      >
        {subtitlesUrl && (
          <track
            ref={trackRef}
            kind="subtitles"
            src={subtitlesUrl}
            srcLang={subtitlesLanguage || "ar"}
            label={
              subtitlesLanguage === "ar"
                ? t("video.arabic")
                : t("video.subtitles")
            }
            default
          />
        )}
      </video>
      {/* Poster */}
      {poster && !playing && !error && !isLoading && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}
      {/* Center loading spinner (appears during buffering) */}
      {renderCenterLoadingSpinnerV2()} {/* Choose which spinner you prefer */}
      {/* Error overlay */}
      {renderErrorState()}
      {/* Buffering indicator in corner */}
      {renderBufferingState()}
      {/* Controls */}
      {renderControls()}
      {/* Keyboard Shortcuts Modal Overlay */}
      {showShortcutsModal && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowShortcutsModal(false);
          }}
        >
          <div
            className="bg-gray-900 border border-white/20 dark:border-slate-800/40 rounded-2xl p-6 max-w-md w-full text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                {t("compcourse.video.keyboardShortcuts")}
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-gray-400 hover:text-white px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.playPause")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.fullscreen")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.mute")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.seek")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.volume")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.jumpPercent")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg col-span-2">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.speedBoostHint")}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg col-span-2">
                <span className="text-gray-300">
                  {t("compcourse.video.shortcuts.doubleTapHint")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
