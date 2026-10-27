"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  Video,
  AlertCircle,
  Plus,
  X,
  Upload,
  CheckCircle2,
  RefreshCw,
  ArrowRightLeft,
  Clock,
  Subtitles,
} from "lucide-react";
import { toast } from "sonner";

interface LessonDetail {
  id: string;
  title: string;
  description?: string;
  moduleId: string;
  order: number;
  type: string;
  videoUrl?: string;
  storageProvider?: string;
  hlsPath?: string;
  transcodingStatus?: string;
  transcript?: string;
  subtitlesPath?: string;
  subtitlesLanguage?: string;
  subtitlesEnabled?: boolean;
  thumbnailUrl?: string;
  durationMinutes?: number;
  difficulty?: string;
  learningObjectives?: string[];
  keyTakeaways?: string[];
  tags?: string[];
  instructorNotes?: string;
  estimatedCompletionTime?: number;
}

export default function EditLessonPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [lesson, setLesson] = useState<LessonDetail | null>(null);

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "complete" | "error"
  >("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Subtitle upload state
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleUploadStatus, setSubtitleUploadStatus] = useState<
    "idle" | "uploading" | "complete" | "error"
  >("idle");
  const [subtitleLanguage, setSubtitleLanguage] = useState(
    lesson?.subtitlesLanguage || "ar",
  );

  // Form state — all lesson fields
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order: "1",
    type: "text",
    difficulty: "beginner",
    duration_minutes: "",
    estimated_completion_time: "",
    video_url: "",
    storage_provider: "supabase",
    thumbnail_url: "",
    transcript: "",
    instructor_notes: "",
    learning_objectives: [] as string[],
    key_takeaways: [] as string[],
    tags: [] as string[],
  });

  // Input helpers for list fields
  const [objectiveInput, setObjectiveInput] = useState("");
  const [takeawayInput, setTakeawayInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const fetchLesson = useCallback(async () => {
    try {
      const data = await api.get<LessonDetail>(
        ENDPOINTS.ADMIN.LESSON(lessonId),
      );
      setLesson(data);
      setFormData({
        title: data.title || "",
        description: data.description || "",
        order: data.order?.toString() || "1",
        type: data.type || "text",
        difficulty: data.difficulty || "beginner",
        duration_minutes: data.durationMinutes?.toString() || "",
        estimated_completion_time:
          data.estimatedCompletionTime?.toString() || "",
        video_url: data.videoUrl || "",
        storage_provider: data.storageProvider || "supabase",
        thumbnail_url: data.thumbnailUrl || "",
        transcript: data.transcript || "",
        instructor_notes: data.instructorNotes || "",
        learning_objectives: data.learningObjectives || [],
        key_takeaways: data.keyTakeaways || [],
        tags: data.tags || [],
      });
      if (data.subtitlesLanguage) setSubtitleLanguage(data.subtitlesLanguage);
    } catch (err: any) {
      setError(err?.message || t("admin.common.error"));
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = t("admin.common.required");
    if (
      formData.order &&
      (parseInt(formData.order) < 1 || isNaN(parseInt(formData.order)))
    )
      errors.order = t("admin.common.required");
    if (
      formData.duration_minutes &&
      (parseInt(formData.duration_minutes) < 0 ||
        isNaN(parseInt(formData.duration_minutes)))
    )
      errors.duration_minutes = t("admin.common.required");
    if (
      formData.estimated_completion_time &&
      (parseInt(formData.estimated_completion_time) < 0 ||
        isNaN(parseInt(formData.estimated_completion_time)))
    )
      errors.estimated_completion_time = t("admin.common.required");
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(ENDPOINTS.ADMIN.LESSON(lessonId), {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        order: parseInt(formData.order) || 1,
        type: formData.type,
        difficulty: formData.difficulty,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : null,
        estimated_completion_time: formData.estimated_completion_time
          ? parseInt(formData.estimated_completion_time)
          : null,
        video_url: formData.video_url.trim() || null,
        storage_provider: formData.storage_provider,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        transcript: formData.transcript.trim() || null,
        instructor_notes: formData.instructor_notes.trim() || null,
        learning_objectives: formData.learning_objectives,
        key_takeaways: formData.key_takeaways,
        tags: formData.tags,
      });
      toast.success(t("admin.lessons.lessonUpdated"));
      router.push("/admin/lessons");
    } catch (err: any) {
      const msg = err?.message || t("admin.common.error");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // List field helpers
  const addObjective = () => {
    if (objectiveInput.trim()) {
      setFormData({
        ...formData,
        learning_objectives: [
          ...formData.learning_objectives,
          objectiveInput.trim(),
        ],
      });
      setObjectiveInput("");
    }
  };
  const addTakeaway = () => {
    if (takeawayInput.trim()) {
      setFormData({
        ...formData,
        key_takeaways: [...formData.key_takeaways, takeawayInput.trim()],
      });
      setTakeawayInput("");
    }
  };
  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  // Video upload
  const handleVideoUpload = async (file: File) => {
    setVideoFile(file);
    setUploadStatus("uploading");
    setUploadProgress(0);
    const formPayload = new FormData();
    formPayload.append("file", file);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          xhr.status >= 200 && xhr.status < 300
            ? (setUploadStatus("processing"), resolve())
            : reject(new Error(xhr.responseText));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        xhr.open(
          "POST",
          `${baseUrl}${ENDPOINTS.ADMIN.UPLOAD_VIDEO_AWS}?lesson_id=${encodeURIComponent(lessonId)}`,
        );
        xhr.withCredentials = true;
        xhr.send(formPayload);
      });
      setTimeout(() => fetchLesson(), 2000);
    } catch (err: any) {
      setUploadStatus("error");
      toast.error(err?.message || t("admin.lessons.video.uploadFailed"));
      setError(err?.message || t("admin.lessons.video.uploadFailed"));
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${baseUrl}${ENDPOINTS.ADMIN.MIGRATE_VIDEO}?lesson_id=${encodeURIComponent(lessonId)}`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("admin.lessons.video.migrateToAws"));
      setTimeout(() => {
        fetchLesson();
        setMigrating(false);
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || t("admin.common.error"));
      setError(err?.message || t("admin.common.error"));
      setMigrating(false);
    }
  };

  const handleSubtitleUpload = async (file: File) => {
    setSubtitleFile(file);
    setSubtitleUploadStatus("uploading");
    const formPayload = new FormData();
    formPayload.append("file", file);
    formPayload.append("language", subtitleLanguage);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${baseUrl}/api/admin/lessons/${lessonId}/subtitles`,
        {
          method: "POST",
          credentials: "include",
          body: formPayload,
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Subtitle upload failed");
      }
      setSubtitleUploadStatus("complete");
      toast.success(t("admin.lessons.subtitles.uploaded"));
      setTimeout(() => fetchLesson(), 1000);
    } catch (err: any) {
      setSubtitleUploadStatus("error");
      toast.error(err?.message || t("admin.common.error"));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("video/")) handleVideoUpload(f);
  };

  const inputClass = (field?: string) =>
    `w-full px-4 py-2.5 rounded-xl border ${field && validationErrors[field] ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/60" : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"} focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm`;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={32}
          className="animate-spin text-blue-500 dark:text-blue-400"
        />
      </div>
    );

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/admin/lessons"
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className={dir === "rtl" ? "rotate-180" : ""} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t("admin.lessons.editLesson")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {lesson?.title}{" "}
            <span className="text-xs text-gray-400">({lessonId})</span>
          </p>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-4xl space-y-6">
        {/* Details Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.lessons.new.tabs.details")}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.form.title")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className={inputClass("title")}
            />
            {validationErrors.title && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                {validationErrors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.form.description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`${inputClass()} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.order")}
              </label>
              <input
                type="number"
                min="1"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: e.target.value })
                }
                className={inputClass("order")}
              />
              {validationErrors.order && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {validationErrors.order}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.form.type")}
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className={inputClass()}
              >
                <option value="text">{t("admin.lessons.types.text")}</option>
                <option value="video">{t("admin.lessons.types.video")}</option>
                <option value="quiz">{t("admin.lessons.types.quiz")}</option>
                <option value="interactive">
                  {t("admin.lessons.types.interactive")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.form.difficulty")}
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData({ ...formData, difficulty: e.target.value })
                }
                className={inputClass()}
              >
                <option value="beginner">
                  {t("admin.lessons.difficulties.beginner")}
                </option>
                <option value="intermediate">
                  {t("admin.lessons.difficulties.intermediate")}
                </option>
                <option value="advanced">
                  {t("admin.lessons.difficulties.advanced")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.duration")}
              </label>
              <input
                type="number"
                min="0"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: e.target.value })
                }
                className={inputClass("duration_minutes")}
              />
              {validationErrors.duration_minutes && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {validationErrors.duration_minutes}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.form.estimatedTime")}
              </label>
              <input
                type="number"
                min="0"
                value={formData.estimated_completion_time}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_completion_time: e.target.value,
                  })
                }
                className={inputClass("estimated_completion_time")}
              />
              {validationErrors.estimated_completion_time && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {validationErrors.estimated_completion_time}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Learning Objectives */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.lessons.form.learningObjectives")}
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={objectiveInput}
              onChange={(e) => setObjectiveInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addObjective())
              }
              placeholder={t("admin.lessons.new.objectivePlaceholder")}
              className={`flex-1 ${inputClass()}`}
            />
            <button
              type="button"
              onClick={addObjective}
              className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {formData.learning_objectives.map((obj, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 rounded-lg"
              >
                <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                  {obj}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      learning_objectives: formData.learning_objectives.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.lessons.form.keyTakeaways")}
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={takeawayInput}
              onChange={(e) => setTakeawayInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addTakeaway())
              }
              placeholder={t("admin.lessons.new.takeawayPlaceholder")}
              className={`flex-1 ${inputClass()}`}
            />
            <button
              type="button"
              onClick={addTakeaway}
              className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {formData.key_takeaways.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-emerald-950/40 rounded-lg"
              >
                <span className="text-sm text-green-700 flex-1">{item}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      key_takeaways: formData.key_takeaways.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  className="text-green-400 hover:text-green-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.lessons.form.tags")}
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addTag())
              }
              placeholder={t("admin.lessons.new.tagPlaceholder")}
              className={`flex-1 ${inputClass()}`}
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      tags: formData.tags.filter((t) => t !== tag),
                    })
                  }
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Instructor Notes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.lessons.form.instructorNotes")}
          </h3>
          <textarea
            value={formData.instructor_notes}
            onChange={(e) =>
              setFormData({ ...formData, instructor_notes: e.target.value })
            }
            rows={5}
            placeholder={t("admin.lessons.new.instructorNotesPlaceholder")}
            className={`${inputClass()} resize-none`}
          />
        </div>

        {/* Video Management */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Video size={20} /> {t("admin.lessons.video.videoManagement")}
          </h3>

          {/* Status */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-slate-400">
                  {t("admin.lessons.video.provider")}:
                </span>
                <div className="font-medium mt-0.5">
                  {lesson?.storageProvider === "aws" ? (
                    <span className="text-orange-600">
                      {t("admin.lessons.video.aws")}
                    </span>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400">
                      {t("admin.lessons.video.supabase")}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">
                  {t("admin.lessons.video.transcodingStatus")}:
                </span>
                <div className="font-medium mt-0.5">
                  {lesson?.transcodingStatus === "complete" && (
                    <span className="text-green-600">
                      ✓ {t("admin.lessons.video.statusComplete")}
                    </span>
                  )}
                  {lesson?.transcodingStatus === "processing" && (
                    <span className="text-yellow-600">
                      ⟳ {t("admin.lessons.video.statusProcessing")}
                    </span>
                  )}
                  {lesson?.transcodingStatus === "failed" && (
                    <span className="text-red-600 dark:text-red-400">
                      ✗ {t("admin.lessons.video.statusFailed")}
                    </span>
                  )}
                  {!lesson?.transcodingStatus && (
                    <span className="text-gray-400">
                      {t("admin.lessons.video.statusNA")}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">
                  {t("admin.lessons.video.hlsPath")}:
                </span>
                <div className="font-medium mt-0.5 truncate">
                  {lesson?.hlsPath ? (
                    <span className="text-green-600 text-xs">
                      {lesson.hlsPath}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">
                  {t("admin.lessons.video.videoUrl")}:
                </span>
                <div className="font-medium mt-0.5 truncate text-xs">
                  {lesson?.videoUrl || <span className="text-gray-400">—</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Migration */}
          {lesson?.storageProvider === "supabase" && lesson?.videoUrl && (
            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-900">
                  {t("admin.lessons.video.migrateToAws")}
                </p>
                <p className="text-xs text-orange-700 mt-0.5">
                  {t("admin.lessons.video.migrateDesc")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMigrate}
                disabled={migrating}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {migrating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRightLeft size={16} />
                )}
                {migrating
                  ? t("admin.lessons.video.migrating")
                  : t("admin.lessons.video.migrate")}
              </button>
            </div>
          )}

          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.video.uploadReplace")}
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDragging ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40" : "border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600"}`}
            >
              {uploadStatus === "idle" && (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                    {t("admin.lessons.video.dragDrop")}
                  </p>
                  <label className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-orange-700">
                    {t("admin.lessons.video.chooseFile")}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleVideoUpload(f);
                      }}
                    />
                  </label>
                </>
              )}
              {uploadStatus === "uploading" && (
                <div className="py-4 space-y-3 max-w-sm mx-auto">
                  <Loader2
                    size={28}
                    className="mx-auto text-orange-500 animate-spin"
                  />
                  <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
                    <span className="truncate max-w-[200px]">
                      {videoFile?.name}
                    </span>
                    <span className="font-mono font-bold text-orange-600">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {videoFile && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-mono text-center">
                      {(
                        (videoFile.size * uploadProgress) /
                        100 /
                        (1024 * 1024)
                      ).toFixed(1)}{" "}
                      {"MB / "}
                      {(videoFile.size / (1024 * 1024)).toFixed(1)} {"MB"} (
                      {uploadProgress}%)
                    </p>
                  )}
                </div>
              )}
              {uploadStatus === "processing" && (
                <div>
                  <Loader2
                    size={24}
                    className="mx-auto mb-2 text-blue-500 dark:text-blue-400 animate-spin"
                  />
                  <p className="text-sm font-medium">
                    {t("admin.lessons.video.transcoding")}
                  </p>
                </div>
              )}
              {uploadStatus === "complete" && (
                <div>
                  <CheckCircle2
                    size={24}
                    className="mx-auto mb-2 text-green-500"
                  />
                  <p className="text-sm font-medium text-green-700">
                    {t("admin.lessons.video.uploadComplete")}
                  </p>
                </div>
              )}
              {uploadStatus === "error" && (
                <div>
                  <AlertCircle
                    size={24}
                    className="mx-auto mb-2 text-red-500"
                  />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {t("admin.lessons.video.uploadFailed")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUploadStatus("idle")}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    {t("admin.lessons.video.tryAgain")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Manual URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.video.manualUrl")}
            </label>
            <input
              type="text"
              value={formData.video_url}
              onChange={(e) =>
                setFormData({ ...formData, video_url: e.target.value })
              }
              placeholder={t("admin.lessons.video.manualUrl")}
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.form.thumbnail")}
            </label>
            <input
              type="text"
              value={formData.thumbnail_url}
              onChange={(e) =>
                setFormData({ ...formData, thumbnail_url: e.target.value })
              }
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.lessons.form.transcript")}
            </label>
            <textarea
              value={formData.transcript}
              onChange={(e) =>
                setFormData({ ...formData, transcript: e.target.value })
              }
              rows={6}
              className={`${inputClass()} resize-none font-mono`}
            />
          </div>

          {/* Subtitles */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
              <Subtitles size={18} /> {t("admin.lessons.subtitles.title")}
            </h4>

            {/* Subtitle upload */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <select
                  value={subtitleLanguage}
                  onChange={(e) => setSubtitleLanguage(e.target.value)}
                  className={inputClass()}
                >
                  <option value="ar">
                    {t("admin.lessons.subtitles.arabic")}
                  </option>
                  <option value="en">
                    {t("admin.lessons.subtitles.english")}
                  </option>
                  <option value="fr">
                    {t("admin.lessons.subtitles.french")}
                  </option>
                </select>
              </div>

              {subtitleUploadStatus === "idle" && (
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
                    {t("admin.lessons.subtitles.chooseFile")}
                    <input
                      type="file"
                      accept=".vtt,.srt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSubtitleUpload(f);
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-400">
                    {t("admin.lessons.subtitles.supportedFormats")}
                  </span>
                </div>
              )}
              {subtitleUploadStatus === "uploading" && (
                <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                  <Loader2 size={16} className="animate-spin" />
                  {t("admin.lessons.subtitles.uploading")}
                </div>
              )}
              {subtitleUploadStatus === "complete" && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 size={16} />
                  {t("admin.lessons.subtitles.uploadComplete")}
                </div>
              )}
              {subtitleUploadStatus === "error" && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={16} />
                  {t("admin.lessons.subtitles.uploadFailed")}
                  <button
                    type="button"
                    onClick={() => setSubtitleUploadStatus("idle")}
                    className="underline hover:no-underline"
                  >
                    {t("admin.lessons.video.tryAgain")}
                  </button>
                </div>
              )}

              {lesson?.subtitlesPath && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t("admin.lessons.subtitles.current")}:{" "}
                  <code className="text-indigo-600 dark:text-indigo-400">
                    {lesson.subtitlesPath}
                  </code>
                </p>
              )}
            </div>
          </div>

          {lesson?.transcodingStatus === "processing" && (
            <button
              type="button"
              onClick={fetchLesson}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <RefreshCw size={14} /> {t("admin.lessons.video.refreshStatus")}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.common.save")}
          </button>
          <Link
            href="/admin/lessons"
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            {t("admin.common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
