"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Film,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import { api, apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

interface BulkVideoUploaderProps {
  moduleId: string;
  existingLessonCount: number;
  onLessonsCreated: () => void;
}

interface QueuedUpload {
  id: string;
  file: File;
  order: number;
  title: string;
  status: "queued" | "uploading" | "completed" | "error";
  progress: number;
  errorMessage?: string;
  lessonId?: string;
}

export function parseVideoFilename(
  filename: string,
  fallbackOrder: number,
): { title: string; order: number } {
  // 1. Strip file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // 2. Try matching patterns like:
  // "01_02_Intro_To_Something" -> Order 2
  // "01 - Intro" -> Order 1
  // "Lesson 3 - Database Models" -> Order 3
  const regex =
    /^(?:section\s*(\d+)[\s_-]+)?(?:lesson\s*(\d+)|\b(\d+)\b)[\s._-]+(.+)$/i;
  const match = nameWithoutExt.match(regex);

  if (match) {
    const rawOrder = match[2] || match[3];
    const rawTitle = match[4] || "";
    const parsedOrder = parseInt(rawOrder, 10);
    const cleanTitle = rawTitle
      .replace(/^[_\s-]+|[_\s-]+$/g, "")
      .replace(/[_-]+/g, " ")
      .trim();

    return {
      order: isNaN(parsedOrder) ? fallbackOrder : parsedOrder,
      title: cleanTitle || nameWithoutExt,
    };
  }

  // Fallback: replace underscores/dashes with spaces
  return {
    order: fallbackOrder,
    title: nameWithoutExt.replace(/[_-]+/g, " ").trim(),
  };
}

export const BulkVideoUploader: React.FC<BulkVideoUploaderProps> = ({
  moduleId,
  existingLessonCount,
  onLessonsCreated,
}) => {
  const t = useTranslations("instructor");
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    const videoFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(f.name),
    );

    if (videoFiles.length === 0) {
      toast.error(t("bulkUpload.validVideoToast"));
      return;
    }

    const newItems: QueuedUpload[] = videoFiles.map((file, idx) => {
      const { title, order } = parseVideoFilename(
        file.name,
        existingLessonCount + queue.length + idx + 1,
      );
      return {
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        title,
        order,
        status: "queued",
        progress: 0,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
  };

  const startBatchUpload = async () => {
    if (queue.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const pending = [...queue];
    const concurrency = 3;
    let index = 0;

    const runNext = async () => {
      if (index >= pending.length) return;
      const currentIdx = index++;
      const item = pending[currentIdx];

      if (item.status === "completed") {
        return runNext();
      }

      // Update status to uploading
      setQueue((prev) =>
        prev.map((q, i) =>
          i === currentIdx ? { ...q, status: "uploading", progress: 5 } : q,
        ),
      );

      try {
        // Step 1: Create Draft Lesson on backend
        const created: any = await api.post(
          `/api/education/modules/${moduleId}/lessons`,
          {
            title: item.title,
            description: `Lesson ${item.order}: ${item.title}`,
            module_id: moduleId,
            order: item.order,
            type: "video",
          },
        );

        const lessonId = created?.id;
        if (!lessonId) throw new Error("Failed to create lesson slot");

        // Step 2: Stream Video Upload with real-time progress
        const formData = new FormData();
        formData.append("file", item.file);

        await apiClient.uploadWithProgress(
          `/api/education/modules/${moduleId}/lessons/${lessonId}/video`,
          formData,
          {
            onProgress: (p) => {
              setQueue((prev) =>
                prev.map((q, i) =>
                  i === currentIdx ? { ...q, progress: Math.max(5, p) } : q,
                ),
              );
            },
            timeout: 15 * 60 * 1000,
          },
        );

        setQueue((prev) =>
          prev.map((q, i) =>
            i === currentIdx
              ? { ...q, status: "completed", progress: 100, lessonId }
              : q,
          ),
        );
        onLessonsCreated();
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q, i) =>
            i === currentIdx
              ? {
                  ...q,
                  status: "error",
                  errorMessage: err?.message || t("bulkUpload.uploadFailed"),
                }
              : q,
          ),
        );
      } finally {
        if (index < pending.length) {
          await runNext();
        }
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(concurrency, pending.length); w++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    setIsProcessing(false);
    onLessonsCreated();
    toast.success(t("bulkUpload.uploadSuccess"));
  };

  const removeQueueItem = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const completedCount = queue.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Dropzone Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-inner"
            : "border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white/60 dark:bg-slate-900/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {t("bulkUpload.dropzoneTitle")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {t("bulkUpload.dropzoneDesc")}
            </p>
          </div>
          <PodaciumButton
            type="button"
            variant="outline"
            className="mt-2 text-xs py-1.5 px-3 flex items-center gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Plus className="w-3.5 h-3.5" /> {t("bulkUpload.selectFiles")}
          </PodaciumButton>
        </div>
      </div>

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                {t("bulkUpload.queueTitle")} ({completedCount}/{queue.length}{" "}
                {t("bulkUpload.readyCount")})
              </span>
              {isProcessing && (
                <PodaciumBadge
                  variant="default"
                  className="text-[10px] py-0 px-2 flex items-center gap-1"
                >
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />{" "}
                  {t("bulkUpload.uploadingActive", { count: "3" })}
                </PodaciumBadge>
              )}
            </div>

            {!isProcessing && queue.some((i) => i.status === "queued") && (
              <PodaciumButton
                type="button"
                variant="primary"
                onClick={startBatchUpload}
                className="text-xs py-1 px-3 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> {t("bulkUpload.startBatch")}
              </PodaciumButton>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 me-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-mono text-[10px] font-bold">
                    {item.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 dark:text-slate-200 truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {item.file.name} •{" "}
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === "uploading" && (
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span>{item.progress}%</span>
                    </div>
                  )}

                  {item.status === "completed" && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                      {t("bulkUpload.statusDone")}
                    </span>
                  )}

                  {item.status === "error" && (
                    <span
                      className="flex items-center gap-1 text-rose-500 font-medium"
                      title={item.errorMessage}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />{" "}
                      {t("bulkUpload.statusFailed")}
                    </span>
                  )}

                  {item.status === "queued" && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => removeQueueItem(item.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkVideoUploader;
