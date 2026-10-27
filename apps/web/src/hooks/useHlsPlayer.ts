"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls, { ErrorData } from "hls.js";

export interface CdnEndpoint {
  id: string;
  name: string;
  baseUrl: string;
}

interface UseHlsPlayerOptions {
  src: string;
  cdns?: CdnEndpoint[];
  sessionId?: string;
  contentId?: string;
  autoplay?: boolean;
  onTokenExpired?: () => void;
  onError?: (err: ErrorData) => void;
  onCdnFailover?: (fromCdn: string, toCdn: string, reason: string) => void;
}

export function useHlsPlayer({
  src,
  cdns = [],
  sessionId = "podacium-session",
  contentId = "podacium-video",
  autoplay = false,
  onTokenExpired,
  onError,
  onCdnFailover,
}: UseHlsPlayerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<
    { id: number; height: number; bitrate: number }[]
  >([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [activeCdnIndex, setActiveCdnIndex] = useState<number>(0);
  const [stallCount, setStallCount] = useState<number>(0);

  const consecutiveStallsRef = useRef<number>(0);
  const lastStallTimeRef = useRef<number>(0);

  // Derive current effective URL given active CDN
  const getEffectiveUrl = useCallback(
    (index: number) => {
      if (!cdns || cdns.length === 0 || !cdns[index]) {
        return src;
      }
      const cdn = cdns[index];
      // If src is a full URL, parse path; if relative, prepend baseUrl
      try {
        const parsed = new URL(src);
        return `${cdn.baseUrl.replace(/\/$/, "")}${parsed.pathname}${parsed.search}`;
      } catch {
        const cleanPath = src.startsWith("/") ? src : `/${src}`;
        return `${cdn.baseUrl.replace(/\/$/, "")}${cleanPath}`;
      }
    },
    [src, cdns],
  );

  const switchCdn = useCallback(
    (reason: string) => {
      if (!cdns || cdns.length <= 1) return;
      const nextIndex = (activeCdnIndex + 1) % cdns.length;
      const prevCdn = cdns[activeCdnIndex]?.name || "primary";
      const nextCdn = cdns[nextIndex]?.name || `cdn-${nextIndex}`;

      console.warn(
        `[Podacium Stream] Dynamic CDN Failover: ${prevCdn} -> ${nextCdn}. Reason: ${reason}`,
      );
      onCdnFailover?.(prevCdn, nextCdn, reason);

      const currentTime = videoRef.current?.currentTime || 0;
      const isPaused = videoRef.current?.paused ?? true;

      setActiveCdnIndex(nextIndex);

      if (hlsRef.current && videoRef.current) {
        const newSrc = getEffectiveUrl(nextIndex);
        hlsRef.current.loadSource(newSrc);
        hlsRef.current.attachMedia(videoRef.current);
        videoRef.current.currentTime = currentTime;
        if (!isPaused) {
          videoRef.current.play().catch(() => {});
        }
      }
    },
    [activeCdnIndex, cdns, getEffectiveUrl, onCdnFailover],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const effectiveSrc = getEffectiveUrl(activeCdnIndex);

    // Check native HLS support (e.g. Safari iOS / macOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveSrc;
      if (autoplay) video.play().catch(() => {});
      setIsSupported(true);
      return;
    }

    // Use hls.js for MSE browsers
    if (!Hls.isSupported()) {
      setIsSupported(false);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      abrEwmaFastVoD: 3.0,
      abrEwmaSlowVoD: 9.0,
      capLevelToPlayerSize: true, // Optimizes mobile bandwidth for 4G LTE
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000, // 60MB max RAM buffer
      backBufferLength: 30,

      // CTA-5004 Common Media Client Data (CMCD) Telemetry
      cmcd: {
        sessionId,
        contentId,
        useHeaders: false, // Query parameters prevent CORS preflight delay on mobile networks
        includeKeys: [
          "br",
          "d",
          "ot",
          "tb",
          "bl",
          "bs",
          "su",
          "rtp",
          "cid",
          "sid",
        ],
      },
    });

    hlsRef.current = hls;
    hls.loadSource(effectiveSrc);
    hls.attachMedia(video);

    // Dynamic Failover Trigger on Buffer Stalling (Emerging market network resiliency)
    const handleWaiting = () => {
      const now = performance.now();
      if (now - lastStallTimeRef.current < 12000) {
        consecutiveStallsRef.current += 1;
      } else {
        consecutiveStallsRef.current = 1;
      }
      lastStallTimeRef.current = now;
      setStallCount((prev) => prev + 1);

      if (consecutiveStallsRef.current >= 2 && cdns.length > 1) {
        switchCdn("High Buffer Stalls / Carrier Peering Congestion");
        consecutiveStallsRef.current = 0;
      }
    };

    video.addEventListener("waiting", handleWaiting);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const parsedLevels = data.levels.map((lvl, index) => ({
        id: index,
        height: lvl.height,
        bitrate: lvl.bitrate,
      }));
      setLevels(parsedLevels);
      if (autoplay) video.play().catch(() => {});
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      setCurrentLevel(data.level);
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (
              data.response &&
              (data.response.code === 403 || data.response.code === 401)
            ) {
              if (onTokenExpired) onTokenExpired();
            } else {
              // Trigger CDN failover on fatal network failures if multiple CDNs available
              if (cdns.length > 1) {
                switchCdn(`Fatal Network Error: ${data.details}`);
              } else {
                hls.startLoad();
              }
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            if (onError) onError(data);
            break;
        }
      }
    });

    return () => {
      video.removeEventListener("waiting", handleWaiting);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [
    src,
    activeCdnIndex,
    cdns,
    sessionId,
    contentId,
    autoplay,
    onTokenExpired,
    onError,
    getEffectiveUrl,
    switchCdn,
  ]);

  const setQualityLevel = useCallback((levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
    }
  }, []);

  return {
    videoRef,
    levels,
    currentLevel,
    setQualityLevel,
    isSupported,
    activeCdn: cdns[activeCdnIndex] || null,
    stallCount,
    switchCdn,
  };
}
