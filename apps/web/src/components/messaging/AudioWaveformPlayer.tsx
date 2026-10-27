"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, AlertCircle } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AudioWaveformPlayerProps {
  src: string;
  waveformData?: number[];
  duration?: number;
  className?: string;
  isOwn?: boolean;
}

export function AudioWaveformPlayer({
  src,
  waveformData = [],
  duration: initialDuration,
  className = "",
  isOwn = false,
}: AudioWaveformPlayerProps) {
  const t = useTranslations("messaging");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<1.0 | 1.5 | 2.0>(1.0);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate synthetic waveform if none provided
  const bars = React.useMemo(() => {
    if (waveformData && waveformData.length > 0) {
      return waveformData;
    }
    const count = 36;
    const result: number[] = [];
    let seed = 0;
    for (let i = 0; i < src.length; i++) {
      seed = (seed + src.charCodeAt(i) * 17) % 100;
    }
    for (let i = 0; i < count; i++) {
      const val = 20 + ((seed * (i + 1) * 31) % 75);
      result.push(val);
    }
    return result;
  }, [waveformData, src]);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else if (initialDuration) {
        setDuration(initialDuration);
      }
      setIsReady(true);
      setHasError(false);
    };

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration) && duration === 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handleError = () => {
      console.warn("Audio element error on src:", src.slice(0, 50));
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [src, initialDuration, duration]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (hasError) {
      setHasError(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (
        audioRef.current.ended ||
        audioRef.current.currentTime >= (audioRef.current.duration || 0)
      ) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio play failed:", err);
          setHasError(true);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, hasError]);

  const toggleRate = useCallback(() => {
    if (!audioRef.current) return;
    const rates: (1.0 | 1.5 | 2.0)[] = [1.0, 1.5, 2.0];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    audioRef.current.playbackRate = nextRate;
  }, [playbackRate]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = progress * duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [duration],
  );

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-xs text-rose-500 py-1">
        <AlertCircle className="w-4 h-4" />
        <span>{t("errors.audioUnavailable")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-1.5 px-3 rounded-2xl max-w-sm select-none",
        isOwn
          ? "bg-blue-700/60 text-white"
          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
        className,
      )}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer shadow-xs",
          isOwn
            ? "bg-white text-blue-600 hover:bg-slate-100"
            : "bg-blue-600 text-white hover:bg-blue-700",
        )}
        aria-label={isPlaying ? t("common.pause") : t("common.play")}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ms-0.5" />
        )}
      </button>

      {/* Scrubbable Waveform */}
      <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
        <div
          onClick={handleSeek}
          className="h-6 flex items-center gap-[2px] cursor-pointer group py-1"
        >
          {bars.map((height, i) => {
            const barProgress = (i / bars.length) * 100;
            const isFilled = barProgress <= progressPercent;

            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-all duration-75",
                  isFilled
                    ? isOwn
                      ? "bg-white"
                      : "bg-blue-600 dark:bg-blue-400"
                    : isOwn
                      ? "bg-white/40 group-hover:bg-white/60"
                      : "bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400",
                )}
                style={{
                  height: `${Math.max(15, height * 0.8)}%`,
                }}
              />
            );
          })}
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[10px] font-medium leading-none opacity-80">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Rate Toggle */}
      <button
        type="button"
        onClick={toggleRate}
        className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all flex-shrink-0 cursor-pointer",
          isOwn
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300",
        )}
      >
        {playbackRate}x
      </button>
    </div>
  );
}
