"use client";

import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, apiClient, ENDPOINTS } from "@/lib/api";
import { educationApi } from "@/lib/api/education";
import { useTranslations, useBidi } from "@/lib/i18n";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  BookOpen,
  FileText,
  Video,
  HelpCircle,
  Plus,
  X,
  Home,
  ChevronRight,
  Clock,
  Tag,
  AlertCircle,
  Trash2,
  Upload,
  CheckCircle2,
  Play,
  ExternalLink,
} from "lucide-react";
import { SectionCard } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

interface Module {
  id: string;
  title: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  question_type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation: string;
  points: number;
}

function LessonEditorInner() {
  const t = useTranslations("learn.instructor.lessonEditor");
  const { dir } = useBidi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedModule = searchParams.get("module");
  const editLessonId = searchParams.get("edit");
  const preselectedTab = searchParams.get("tab");
  const isEditing = Boolean(editLessonId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<Module[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "quiz">(
    preselectedTab === "quiz" ? "quiz" : "details",
  );

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    description: "",
    module_id: preselectedModule || "",
    order: "1",
    duration_minutes: "",
    type: "text",
    video_url: "",
    transcript: "",
    thumbnail_url: "",
    learning_objectives: [] as string[],
    key_takeaways: [] as string[],
    instructor_notes: "",
    estimated_completion_time: "",
    difficulty: "beginner",
    tags: [] as string[],
    is_preview: false,
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUploadStatus, setVideoUploadStatus] = useState<string | null>(
    null,
  );
  const [autoDetectedDuration, setAutoDetectedDuration] = useState<
    string | null
  >(null);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [videoSourceMode, setVideoSourceMode] = useState<"upload" | "url">(
    "upload",
  );
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoPreviewUrl(null);
    }
  }, [videoFile]);

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.type.startsWith("video/") ||
        /\.(mp4|mov|mkv|webm)$/i.test(file.name))
    ) {
      setVideoFile(file);
    } else if (file) {
      toast.error(t("invalidVideoType"));
    }
  };

  const [quizData, setQuizData] = useState({
    title: "",
    passing_score: "70",
    time_limit_minutes: "30",
    allow_retake: true,
    shuffle_questions: true,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [objectiveInput, setObjectiveInput] = useState("");
  const [takeawayInput, setTakeawayInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await api.get<any>("/api/education/modules?limit=100");
        setModules(Array.isArray(res) ? res : res?.modules || []);
      } catch {}
    };
    fetchModules();
  }, []);

  useEffect(() => {
    if (isEditing && editLessonId) {
      setLoading(true);
      api
        .get<any>(`/api/education/lessons/${editLessonId}`)
        .then((res) => {
          setFormData({
            id: res.id || "",
            title: res.title || "",
            description: res.description || "",
            module_id: res.moduleId || preselectedModule || "",
            order: res.order?.toString() || "1",
            duration_minutes: res.durationMinutes?.toString() || "",
            type: res.type || "text",
            video_url: res.videoUrl || "",
            transcript: res.transcript || "",
            thumbnail_url: res.thumbnailUrl || "",
            learning_objectives: res.learningObjectives || [],
            key_takeaways: res.keyTakeaways || [],
            instructor_notes: res.instructorNotes || "",
            estimated_completion_time: res.estimatedCompletionTime || "",
            difficulty: res.difficulty || "beginner",
            tags: res.tags || [],
            is_preview: Boolean(res.isPreview || res.is_preview || false),
          });
        })
        .catch(() => toast.error(t("loadFail")))
        .finally(() => setLoading(false));
    }
  }, [isEditing, editLessonId]);

  const addObjective = () => {
    if (!objectiveInput.trim()) return;
    const parts = objectiveInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = [...formData.learning_objectives];
    for (const part of parts) {
      if (!updated.includes(part)) updated.push(part);
    }
    setFormData({ ...formData, learning_objectives: updated });
    setObjectiveInput("");
  };

  const removeObjective = (idx: number) => {
    setFormData({
      ...formData,
      learning_objectives: formData.learning_objectives.filter(
        (_, i) => i !== idx,
      ),
    });
  };

  const addTakeaway = () => {
    if (!takeawayInput.trim()) return;
    const parts = takeawayInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = [...formData.key_takeaways];
    for (const part of parts) {
      if (!updated.includes(part)) updated.push(part);
    }
    setFormData({ ...formData, key_takeaways: updated });
    setTakeawayInput("");
  };

  const removeTakeaway = (idx: number) => {
    setFormData({
      ...formData,
      key_takeaways: formData.key_takeaways.filter((_, i) => i !== idx),
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const parts = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = [...formData.tags];
    for (const part of parts) {
      if (!updated.includes(part)) updated.push(part);
    }
    setFormData({ ...formData, tags: updated });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tg) => tg !== tag),
    });
  };

  const inputClass = (field: string) => {
    const base =
      "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm";
    return `${base} ${errors[field] ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 dark:bg-red-950/60" : "border-gray-200 dark:border-slate-800"}`;
  };

  const clearError = (field: string) => {
    if (errors[field])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q_${Date.now()}`,
        question: "",
        question_type: "MULTIPLE_CHOICE",
        options: [
          { id: `opt_${Date.now()}_1`, text: "" },
          { id: `opt_${Date.now()}_2`, text: "" },
        ],
        correct_answer: "",
        explanation: "",
        points: 1,
      },
    ]);
  };

  const updateQuestion = (idx: number, data: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...data };
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options.push({ id: `opt_${Date.now()}`, text: "" });
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx].text = text;
    setQuestions(updated);
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== oIdx);
    setQuestions(updated);
  };

  const isDirty = Boolean(
    formData.title.trim() || questions.length > 0 || videoFile,
  );
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !saving) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (uploadingVideo) {
      toast.error(t("videoUploadInProgress"));
      return;
    }

    const errs: Record<string, string> = {};
    if (!formData.title.trim()) errs.title = t("errors.required");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      let createdLessonId: string | null = null;
      if (isEditing && editLessonId) {
        await api.put(`/api/education/lessons/${editLessonId}`, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          moduleId: formData.module_id,
          order: parseInt(formData.order) || 1,
          duration_minutes: formData.duration_minutes
            ? parseInt(formData.duration_minutes)
            : null,
          type: formData.type,
          video_url: formData.video_url || null,
          transcript: formData.transcript || null,
          thumbnail_url: formData.thumbnail_url || null,
          learning_objectives: formData.learning_objectives,
          key_takeaways: formData.key_takeaways,
          instructor_notes: formData.instructor_notes || null,
          estimated_completion_time: formData.estimated_completion_time || null,
          difficulty: formData.difficulty,
          tags: formData.tags,
          is_preview: formData.is_preview,
        });
      } else {
        const response: any = await api.post(
          `/api/education/modules/${formData.module_id || preselectedModule}/lessons`,
          {
            id: formData.id.trim() || undefined,
            title: formData.title.trim(),
            description: formData.description.trim(),
            module_id: formData.module_id || preselectedModule,
            order: parseInt(formData.order) || 1,
            duration_minutes: formData.duration_minutes
              ? parseInt(formData.duration_minutes)
              : null,
            type: formData.type,
            video_url: formData.video_url || null,
            transcript: formData.transcript || null,
            thumbnail_url: formData.thumbnail_url || null,
            learning_objectives: formData.learning_objectives,
            key_takeaways: formData.key_takeaways,
            instructor_notes: formData.instructor_notes || null,
            estimated_completion_time:
              formData.estimated_completion_time || null,
            difficulty: formData.difficulty,
            tags: formData.tags,
            is_preview: formData.is_preview,
          },
        );
        createdLessonId = response?.data?.id || response?.id || null;
      }

      const lessonId = isEditing
        ? editLessonId!
        : createdLessonId || formData.id.trim();

      if (questions.length > 0 && lessonId) {
        await educationApi.createQuiz(lessonId, {
          title: quizData.title || `${formData.title} ${t("quiz")}`,
          passing_score: parseInt(quizData.passing_score) || 70,
          time_limit_minutes: parseInt(quizData.time_limit_minutes) || 30,
          retake_cooldown_minutes: 60,
          allow_retake: quizData.allow_retake,
          shuffle_questions: quizData.shuffle_questions,
          questions: questions.map((q, qi) => ({
            question: q.question,
            question_type: q.question_type,
            options: q.options.map((o) => ({ text: o.text })),
            correct_answer: q.correct_answer,
            explanation: q.explanation || null,
            points: q.points || 1,
            order: qi + 1,
          })),
        });
      }

      toast.success(isEditing ? t("saveSuccess") : t("createSuccess"), {
        description: t("createSuccessHint"),
      });
      const backModule = formData.module_id || preselectedModule;
      if (backModule) {
        router.push(`/learn/manage?id=${backModule}`);
      } else {
        router.push("/learn/manage");
      }
    } catch (err: any) {
      const msg = err?.message || (isEditing ? t("saveFail") : t("createFail"));
      setError(msg.startsWith("errors.") ? t(msg) : msg);
      toast.error(msg.startsWith("errors.") ? t(msg) : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (
    customFile?: File,
    targetLessonId?: string,
  ) => {
    const fileToUpload = customFile || videoFile;
    if (!fileToUpload) return;

    const moduleId = formData.module_id || preselectedModule;
    if (!moduleId) {
      toast.error(t("moduleRequired"));
      return;
    }

    let lessonId = targetLessonId || (isEditing ? editLessonId : null);

    if (!lessonId) {
      if (!formData.title.trim()) {
        toast.error(t("errors.required"));
        return;
      }
      try {
        setSaving(true);
        const created: any = await api.post(
          `/api/education/modules/${moduleId}/lessons`,
          {
            id: formData.id.trim() || undefined,
            title: formData.title.trim(),
            description: formData.description.trim(),
            module_id: moduleId,
            order: parseInt(formData.order) || 1,
            duration_minutes: formData.duration_minutes
              ? parseInt(formData.duration_minutes)
              : null,
            type: formData.type,
            video_url: formData.video_url || null,
            transcript: formData.transcript || null,
            thumbnail_url: formData.thumbnail_url || null,
            learning_objectives: formData.learning_objectives,
            key_takeaways: formData.key_takeaways,
            instructor_notes: formData.instructor_notes || null,
            estimated_completion_time:
              formData.estimated_completion_time || null,
            difficulty: formData.difficulty,
            tags: formData.tags,
            is_preview: formData.is_preview,
          },
        );
        lessonId = created?.id || formData.id.trim();
        if (lessonId) {
          router.replace(
            `/learn/create/lesson?module=${moduleId}&edit=${lessonId}`,
          );
        }
      } catch (err: any) {
        toast.error(err?.message || t("saveFail"));
        return;
      } finally {
        setSaving(false);
      }
    }

    setUploadingVideo(true);
    setUploadProgress(0);
    setVideoUploadStatus(null);
    setError(null);

    const formDataPayload = new FormData();
    formDataPayload.append("file", fileToUpload);

    try {
      const res: any = await apiClient.uploadWithProgress(
        `/api/education/modules/${moduleId}/lessons/${lessonId}/video`,
        formDataPayload,
        {
          onProgress: (p) => setUploadProgress(p),
          timeout: 10 * 60 * 1000,
        },
      );
      setVideoUploadStatus(t("videoProcessing"));
      if (res?.formatted_duration) {
        setAutoDetectedDuration(res.formatted_duration);
      }
      if (res?.detected_duration_minutes) {
        setFormData((prev) => ({
          ...prev,
          duration_minutes: res.detected_duration_minutes.toString(),
        }));
      }
      if (res?.videoUrl || res?.raw_path) {
        setFormData((prev) => ({
          ...prev,
          video_url: res.videoUrl || res.raw_path || prev.video_url,
        }));
      }
      setVideoFile(null);
      toast.success(t("videoUploadSuccess"));
    } catch (err) {
      const httpErr = err as { message?: string } | undefined;
      const msg = httpErr?.message || t("videoUploadFail");
      setError(msg.startsWith("errors.") ? t(msg) : msg);
      toast.error(msg.startsWith("errors.") ? t(msg) : msg);
    } finally {
      setUploadingVideo(false);
    }
  };

  if (isEditing && loading) {
    return (
      <div className="py-20 flex justify-center" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const tabs = [
    { id: "details" as const, label: t("details"), icon: FileText },
    { id: "quiz" as const, label: t("quiz"), icon: HelpCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-16" dir={dir}>
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
        <Link
          href="/"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
        >
          <Home className="w-4 h-4" />
          <span>{t("breadcrumb.home")}</span>
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <Link
          href="/learn"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("breadcrumb.learn")}
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <Link
          href="/learn/manage"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("breadcrumb.modules")}
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <span className="text-gray-900 dark:text-slate-100 font-medium">
          {isEditing ? t("title") : t("title")}
        </span>
      </nav>

      <motion.div
        initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href={
            preselectedModule
              ? `/learn/manage?id=${preselectedModule}`
              : "/learn/manage"
          }
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className={dir === "rtl" ? "rotate-180" : ""} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {isEditing ? t("title") : t("title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {isEditing ? t("editSubtitle") : t("createSubtitle")}
          </p>
        </div>
      </motion.div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-gray-200 dark:border-slate-800"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {activeTab === "details" && (
          <motion.div
            key="details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <SectionCard
              title={t("details")}
              icon={
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("lessonId")}
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => {
                      setFormData({ ...formData, id: e.target.value });
                      clearError("id");
                    }}
                    placeholder={t("lessonIdHint")}
                    disabled={isEditing}
                    className={`${inputClass("id")} ${isEditing ? "opacity-60" : ""}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("module")}
                  </label>
                  <select
                    value={formData.module_id}
                    onChange={(e) =>
                      setFormData({ ...formData, module_id: e.target.value })
                    }
                    disabled={!!preselectedModule || isEditing}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  >
                    <option value="">{t("selectModule")}</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("titleField")}
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value });
                      clearError("title");
                    }}
                    placeholder={t("titlePlaceholder")}
                    className={inputClass("title")}
                    required
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.title}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("description")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder={t("descriptionPlaceholder")}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("order")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.order}
                      onChange={(e) =>
                        setFormData({ ...formData, order: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("type")}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                    >
                      <option value="text">{t("types.text")}</option>
                      <option value="video">{t("types.video")}</option>
                      <option value="quiz">{t("types.quiz")}</option>
                      <option value="interactive">
                        {t("types.interactive")}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("duration")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: e.target.value,
                        })
                      }
                      placeholder={t("estimatedTime")}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={t("objectives")}
              icon={
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={objectiveInput}
                    onChange={(e) => setObjectiveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addObjective();
                      }
                    }}
                    placeholder={t("objectivePlaceholder")}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                  <PodaciumButton
                    type="button"
                    variant="outline"
                    onClick={addObjective}
                  >
                    <Plus size={16} />
                  </PodaciumButton>
                </div>
                {formData.learning_objectives.map((obj, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm"
                  >
                    <span className="flex-1">{obj}</span>
                    <button
                      type="button"
                      onClick={() => removeObjective(idx)}
                      className="hover:text-blue-900 dark:text-blue-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title={t("takeaways")}
              icon={
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={takeawayInput}
                    onChange={(e) => setTakeawayInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTakeaway();
                      }
                    }}
                    placeholder={t("takeawayPlaceholder")}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                  <PodaciumButton
                    type="button"
                    variant="outline"
                    onClick={addTakeaway}
                  >
                    <Plus size={16} />
                  </PodaciumButton>
                </div>
                {formData.key_takeaways.map((takeaway, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm"
                  >
                    <span className="flex-1">{takeaway}</span>
                    <button
                      type="button"
                      onClick={() => removeTakeaway(idx)}
                      className="hover:text-emerald-900 dark:text-emerald-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title={t("tags")}
              icon={
                <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("tagPlaceholder")}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                  <PodaciumButton
                    type="button"
                    variant="outline"
                    onClick={addTag}
                  >
                    <Plus size={16} />
                  </PodaciumButton>
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
                        onClick={() => removeTag(tag)}
                        className="hover:text-gray-900 dark:hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>

            {formData.type === "video" && (
              <SectionCard
                title={t("video")}
                icon={
                  <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                }
              >
                <div className="space-y-5">
                  {/* Free Preview Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40">
                    <div className="space-y-0.5">
                      <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{t("freePreviewLabel")}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {t("freePreviewBadge")}
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("freePreviewDescription")}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.is_preview}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          is_preview: !prev.is_preview,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        formData.is_preview
                          ? "bg-emerald-600"
                          : "bg-gray-200 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          formData.is_preview
                            ? "ltr:translate-x-5 rtl:-translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Source Mode Toggle */}
                  <div className="flex p-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-xl max-w-md">
                    <button
                      type="button"
                      onClick={() => setVideoSourceMode("upload")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        videoSourceMode === "upload"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Upload size={14} />
                      {t("uploadLocalFile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSourceMode("url")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        videoSourceMode === "url"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <Video size={14} />
                      {t("enterVideoUrl")}
                    </button>
                  </div>

                  {videoSourceMode === "url" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                        {t("videoUrl")}
                      </label>
                      <input
                        type="text"
                        value={formData.video_url}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            video_url: e.target.value,
                          })
                        }
                        placeholder={t("videoPlaceholder")}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("videoUrlHelp")}
                      </p>

                      {/* Smart URL Provider Analyzer & Live Preview */}
                      {(() => {
                        const url = formData.video_url?.trim();
                        if (!url) return null;
                        const lower = url.toLowerCase();

                        let provider:
                          | "youtube"
                          | "vimeo"
                          | "dailymotion"
                          | "cloudflare"
                          | "bunny"
                          | "hls"
                          | "mp4"
                          | null = null;
                        let ytId: string | null = null;
                        let vimeoId: string | null = null;
                        let dmId: string | null = null;

                        if (
                          lower.includes("youtube.com") ||
                          lower.includes("youtu.be")
                        ) {
                          provider = "youtube";
                          const m = url.match(
                            /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
                          );
                          ytId = m ? m[1] : null;
                        } else if (lower.includes("vimeo.com")) {
                          provider = "vimeo";
                          const m = url.match(
                            /vimeo\.com\/(?:video\/)?([0-9]+)/,
                          );
                          vimeoId = m ? m[1] : null;
                        } else if (
                          lower.includes("dailymotion.com") ||
                          lower.includes("dai.ly")
                        ) {
                          provider = "dailymotion";
                          const m = url.match(
                            /(?:dailymotion\.com\/(?:video|hub)\/([^_]+))|(?:dai\.ly\/([a-zA-Z0-9]+))/,
                          );
                          dmId = m ? m[1] || m[2] : null;
                        } else if (
                          lower.includes("cloudflarestream.com") ||
                          lower.includes("videodelivery.net")
                        ) {
                          provider = "cloudflare";
                        } else if (
                          lower.includes("b-cdn.net") ||
                          lower.includes("bunnycdn.com")
                        ) {
                          provider = "bunny";
                        } else if (lower.includes(".m3u8")) {
                          provider = "hls";
                        } else if (
                          lower.includes(".mp4") ||
                          lower.includes(".webm") ||
                          lower.startsWith("/")
                        ) {
                          provider = "mp4";
                        }

                        if (!provider) return null;

                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 rounded-xl border border-gray-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 overflow-hidden shadow-sm"
                          >
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                                  {t("livePreview")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <PodaciumBadge
                                  variant="success"
                                  className="text-[10px] px-2 py-0.5 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t("validVideoUrl")}
                                </PodaciumBadge>
                                <PodaciumBadge
                                  variant="secondary"
                                  className="text-[10px] px-2 py-0.5 font-medium"
                                >
                                  {t(`detectedProvider.${provider}`)}
                                </PodaciumBadge>
                              </div>
                            </div>
                            <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                              {provider === "youtube" && ytId ? (
                                <iframe
                                  src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                                  title={t("youtubePreview")}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : provider === "vimeo" && vimeoId ? (
                                <iframe
                                  src={`https://player.vimeo.com/video/${vimeoId}`}
                                  title={t("vimeoPreview")}
                                  className="w-full h-full border-0"
                                  allow="autoplay; fullscreen; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : provider === "dailymotion" && dmId ? (
                                <iframe
                                  src={`https://www.dailymotion.com/embed/video/${dmId}`}
                                  title={t("dailymotionPreview")}
                                  className="w-full h-full border-0"
                                  allow="autoplay; fullscreen"
                                  allowFullScreen
                                />
                              ) : provider === "mp4" ? (
                                <video
                                  src={url}
                                  controls
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                                  <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
                                    <Play className="w-5 h-5 ms-0.5 text-blue-400" />
                                  </div>
                                  <p className="text-xs font-medium text-slate-200">
                                    {t(`detectedProvider.${provider}`)}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono mt-1 max-w-sm truncate">
                                    {url}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })()}
                    </motion.div>
                  )}

                  {videoSourceMode === "upload" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      {/* Drag & Drop Upload Zone */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingVideo(true);
                        }}
                        onDragLeave={() => setIsDraggingVideo(false)}
                        onDrop={handleVideoDrop}
                        className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                          isDraggingVideo
                            ? "border-blue-500 bg-blue-50/70 scale-[1.01]"
                            : "border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/60 hover:border-blue-400 hover:bg-blue-50/20"
                        }`}
                      >
                        {!videoFile && (
                          <div className="py-4 space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-950/60 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                              <Upload size={24} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                                {t("dragDropVideo")}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                {t("videoFormatsHint")}
                              </p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-colors">
                              <Upload size={14} />
                              {t("chooseVideoFile")}
                              <input
                                type="file"
                                accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
                                onChange={(e) =>
                                  setVideoFile(e.target.files?.[0] ?? null)
                                }
                                disabled={uploadingVideo}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}

                        {/* Selected Video Preview Card */}
                        {videoFile && (
                          <div className="space-y-4 text-start bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                  <Video size={20} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                                    {videoFile.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                                    {(videoFile.size / (1024 * 1024)).toFixed(
                                      1,
                                    )}{" "}
                                    {t("mb")} {videoFile.type || "video"}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setVideoFile(null)}
                                disabled={uploadingVideo}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors disabled:opacity-40"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            {/* Local Video Instant Preview */}
                            {videoPreviewUrl && (
                              <div className="rounded-xl overflow-hidden bg-black border border-gray-800">
                                <video
                                  src={videoPreviewUrl}
                                  controls
                                  className="w-full max-h-56 mx-auto object-contain"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Upload Progress Bar */}
                        {uploadingVideo && (
                          <div className="mt-4 space-y-2 p-4 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-blue-50 dark:from-slate-900 dark:via-blue-950/50 dark:to-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50 text-start">
                            <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-100">
                              <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                                {uploadProgress < 100
                                  ? t("uploadingStatus")
                                  : t("transcodingStatus")}
                              </span>
                              <span className="font-mono text-sm text-blue-700 dark:text-blue-300 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md shadow-xs">
                                {uploadProgress}%
                              </span>
                            </div>
                            <div className="h-3 w-full bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden p-0.5">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 transition-all duration-300 rounded-full shadow-inner"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            {videoFile && (
                              <div className="flex justify-between text-[11px] text-blue-700 dark:text-blue-300 font-mono pt-1">
                                <span>
                                  {(
                                    (videoFile.size * uploadProgress) /
                                    100 /
                                    (1024 * 1024)
                                  ).toFixed(1)}{" "}
                                  MB of{" "}
                                  {(videoFile.size / (1024 * 1024)).toFixed(1)}{" "}
                                  MB
                                </span>
                                <span>
                                  {uploadProgress === 100
                                    ? t("transcodingComplete")
                                    : `${uploadProgress}% Transferred`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {videoUploadStatus && (
                          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 text-start">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>{videoUploadStatus}</span>
                          </div>
                        )}

                        {autoDetectedDuration && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border border-blue-200 dark:border-blue-800/80 dark:border-slate-800/80 dark:border-blue-800/80 rounded-xl flex items-center justify-between text-start">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
                                {t("autoDetectedDuration")}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                              {t("durationSaved")}
                            </span>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end">
                          <PodaciumButton
                            type="button"
                            variant="primary"
                            onClick={() => handleVideoUpload()}
                            disabled={!videoFile || uploadingVideo}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                          >
                            {uploadingVideo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload size={16} />
                            )}
                            {uploadingVideo
                              ? `${t("uploading")} ${uploadProgress}%`
                              : t("uploadVideoBtn")}
                          </PodaciumButton>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("transcript")}
                    </label>
                    <textarea
                      value={formData.transcript}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          transcript: e.target.value,
                        })
                      }
                      rows={5}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
                    />
                  </div>
                </div>
              </SectionCard>
            )}
          </motion.div>
        )}

        {activeTab === "quiz" && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <SectionCard
              title={t("quiz")}
              icon={
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("quizTitle")}
                  </label>
                  <input
                    type="text"
                    value={quizData.title}
                    onChange={(e) =>
                      setQuizData({ ...quizData, title: e.target.value })
                    }
                    placeholder={t("quizTitlePlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("passingScore")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={quizData.passing_score}
                      onChange={(e) =>
                        setQuizData({
                          ...quizData,
                          passing_score: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("timeLimit")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quizData.time_limit_minutes}
                      onChange={(e) =>
                        setQuizData({
                          ...quizData,
                          time_limit_minutes: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={quizData.allow_retake}
                      onChange={(e) =>
                        setQuizData({
                          ...quizData,
                          allow_retake: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-slate-700"
                    />
                    {t("allowRetake")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={quizData.shuffle_questions}
                      onChange={(e) =>
                        setQuizData({
                          ...quizData,
                          shuffle_questions: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300 dark:border-slate-700"
                    />
                    {t("shuffleQuestions")}
                  </label>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={t("questions")}
              icon={
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              }
              action={
                <PodaciumButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addQuestion}
                  className="flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  {t("addQuestion")}
                </PodaciumButton>
              }
            >
              {questions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {t("noQuestions")}
                </p>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                question: e.target.value,
                              })
                            }
                            placeholder={t("questionPlaceholder")}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <select
                          value={q.question_type}
                          onChange={(e) =>
                            updateQuestion(qIdx, {
                              question_type: e.target.value as any,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        >
                          <option value="MULTIPLE_CHOICE">
                            {t("multipleChoice")}
                          </option>
                          <option value="TRUE_FALSE">{t("trueFalse")}</option>
                          <option value="SHORT_ANSWER">
                            {t("shortAnswer")}
                          </option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) =>
                            updateQuestion(qIdx, {
                              points: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          placeholder={t("points")}
                        />
                      </div>
                      {q.question_type === "MULTIPLE_CHOICE" && (
                        <div className="space-y-2 ms-4">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={opt.id}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="radio"
                                name={`correct_${q.id}`}
                                checked={q.correct_answer === opt.text}
                                onChange={() =>
                                  updateQuestion(qIdx, {
                                    correct_answer: opt.text,
                                  })
                                }
                                className="text-blue-600 dark:text-blue-400"
                              />
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) =>
                                  updateOption(qIdx, oIdx, e.target.value)
                                }
                                placeholder={t("optionPlaceholder")}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                              />
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(qIdx, oIdx)}
                                  className="p-1 text-gray-400 hover:text-red-500 dark:text-red-400"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(qIdx)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Plus size={14} /> {t("addOption")}
                          </button>
                        </div>
                      )}
                      {q.question_type === "TRUE_FALSE" && (
                        <div className="space-y-2 ms-4">
                          {["True", "False"].map((val) => (
                            <label
                              key={val}
                              className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
                            >
                              <input
                                type="radio"
                                name={`correct_${q.id}`}
                                checked={q.correct_answer === val}
                                onChange={() =>
                                  updateQuestion(qIdx, {
                                    correct_answer: val,
                                  })
                                }
                                className="text-blue-600 dark:text-blue-400"
                              />
                              {val}
                            </label>
                          ))}
                        </div>
                      )}
                      {q.question_type === "SHORT_ANSWER" && (
                        <div className="ms-4">
                          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                            {t("correctAnswer")}
                          </label>
                          <input
                            type="text"
                            value={q.correct_answer}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                correct_answer: e.target.value,
                              })
                            }
                            placeholder={t("correctAnswerPlaceholder")}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                        </div>
                      )}
                      <div className="mt-3">
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) =>
                            updateQuestion(qIdx, {
                              explanation: e.target.value,
                            })
                          }
                          placeholder={t("explanationPlaceholder")}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <PodaciumButton
            type="submit"
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isEditing ? t("save") : t("save")}
          </PodaciumButton>
          <Link
            href={
              preselectedModule
                ? `/learn/manage?id=${preselectedModule}`
                : "/learn/manage"
            }
          >
            <PodaciumButton variant="outline" type="button">
              {t("cancel")}
            </PodaciumButton>
          </Link>
        </div>
      </motion.form>
    </div>
  );
}

export default function LessonEditorPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      }
    >
      <LessonEditorInner />
    </Suspense>
  );
}
