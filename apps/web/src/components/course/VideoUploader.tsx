"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Pause,
  Play,
  RotateCw,
  WifiOff,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import { useTranslations } from "@/lib/i18n";
import { TusUploader, TusUploadProgress } from "@/lib/api/tusUploader";

interface VideoUploaderProps {
  lessonId?: string;
  moduleId?: string;
  onUploadSuccess?: (result: {
    rawPath: string;
    hlsPath?: string;
    storageProvider: string;
  }) => void;
  onUploadError?: (error: string) => void;
  storageProvider?: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  lessonId,
  onUploadSuccess,
  onUploadError,
  storageProvider: defaultProvider = "aws",
}) => {
  const t = useTranslations();
  const selectedProvider = defaultProvider;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progressData, setProgressData] = useState<TusUploadProgress | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploaderRef = useRef<TusUploader | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (
        !selected.type.startsWith("video/") &&
        !selected.name.match(/\.(mp4|mov|webm|mkv)$/i)
      ) {
        setError(t("compcourse.video.uploader.invalidFormat"));
        return;
      }
      setFile(selected);
      setError(null);
      setIsSuccess(false);
      setProgressData(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (
        !dropped.type.startsWith("video/") &&
        !dropped.name.match(/\.(mp4|mov|webm|mkv)$/i)
      ) {
        setError(t("compcourse.video.uploader.invalidFormat"));
        return;
      }
      setFile(dropped);
      setError(null);
      setIsSuccess(false);
      setProgressData(null);
    }
  };

  const handleStartUpload = async () => {
    if (!file) return;
    setUploading(true);
    setIsPaused(false);
    setError(null);

    const uploader = new TusUploader(file, {
      endpoint: "/api/v1/video/tus",
      metadata: {
        lesson_id: lessonId || "",
        provider: selectedProvider,
      },
      onProgress: (progress) => {
        setProgressData(progress);
      },
      onSuccess: ({ uploadId, location }) => {
        setUploading(false);
        setIsSuccess(true);
        if (onUploadSuccess) {
          onUploadSuccess({
            rawPath: location,
            storageProvider: selectedProvider,
          });
        }
      },
      onError: (err) => {
        setUploading(false);
        setError(err.message || t("compcourse.video.uploader.uploadError"));
        if (onUploadError) onUploadError(err.message);
      },
    });

    uploaderRef.current = uploader;
    await uploader.start();
  };

  const handleTogglePause = () => {
    if (!uploaderRef.current) return;
    if (isPaused) {
      uploaderRef.current.resume();
      setIsPaused(false);
    } else {
      uploaderRef.current.pause();
      setIsPaused(true);
    }
  };

  const formatEta = (seconds: number) => {
    if (seconds <= 0 || !isFinite(seconds)) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Smart Automated Ingestion Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{t("compcourse.video.uploader.smartRoutingTitle")}</span>
        </div>
        <span className="text-gray-500 dark:text-slate-400 text-[11px]">
          {t("video.uploader.tusHeader")}
        </span>
      </div>

      <PodaciumCard className="p-6 border-dashed border-2 border-gray-300 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center space-y-4 text-center cursor-pointer py-8"
          onClick={() => {
            if (!uploading) fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />

          {isSuccess ? (
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
          ) : (
            <Upload className="w-12 h-12 text-blue-500/80 hover:text-blue-400 transition-colors" />
          )}

          <div className="space-y-1">
            <p className="font-semibold text-gray-900 dark:text-slate-100">
              {file ? file.name : t("compcourse.video.uploader.dragDrop")}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("video.uploader.supportedFormats")}
            </p>
          </div>

          {file && !uploading && !isSuccess && (
            <PodaciumButton
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleStartUpload();
              }}
              className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium px-6 py-2 rounded-xl shadow-lg shadow-blue-500/25"
            >
              {t("video.uploader.startUpload", {
                provider: selectedProvider.toUpperCase(),
              })}
            </PodaciumButton>
          )}

          {uploading && progressData && (
            <div
              className="w-full max-w-md space-y-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Percent & Controls */}
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    {progressData.percent}%
                  </span>
                  <span className="text-xs text-gray-500 ms-2">
                    ({(progressData.bytesUploaded / (1024 * 1024)).toFixed(1)} /{" "}
                    {(progressData.totalBytes / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                    title={
                      isPaused
                        ? t("video.uploader.resumeUpload")
                        : t("video.uploader.pauseUpload")
                    }
                  >
                    {isPaused ? (
                      <Play className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isPaused
                      ? "bg-amber-500"
                      : progressData.isRetrying
                        ? "bg-rose-500 animate-pulse"
                        : "bg-gradient-to-r from-blue-500 to-indigo-500"
                  }`}
                  style={{ width: `${progressData.percent}%` }}
                />
              </div>

              {/* Metrics: Speed, ETA, Chunk */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
                <span>
                  {t("video.uploader.speed", {
                    speed: isPaused
                      ? t("video.uploader.paused")
                      : `${progressData.speedMBs} MB/s`,
                  })}
                </span>
                <span>
                  {t("common.uiLabels.etaPrefix")}{" "}
                  {isPaused ? "--" : formatEta(progressData.etaSeconds)}
                </span>
                <span>
                  {t("video.uploader.chunk", {
                    current: progressData.chunkIndex,
                    total: progressData.totalChunks,
                  })}
                </span>
              </div>

              {/* Carrier Drop Recovery Indicator */}
              {progressData.isRetrying && (
                <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-xs pt-1 border-t border-rose-100 dark:border-rose-900/30">
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {t("video.uploader.retryBackoff", {
                      attempt: progressData.retryAttempt ?? 1,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 text-rose-500 dark:text-rose-400 text-xs mt-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </PodaciumCard>
    </div>
  );
};
