"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  FileText,
  ArrowLeft,
  Save,
  Loader2,
  Video,
  HelpCircle,
  AlertCircle,
  BookOpen,
  Clock,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Upload,
  Cloud,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

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

export default function NewLessonPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedModule = searchParams.get("module");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "video" | "quiz">(
    "details",
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
    storage_provider: "supabase",
    transcript: "",
    thumbnail_url: "",
    learning_objectives: [] as string[],
    key_takeaways: [] as string[],
    instructor_notes: "",
    estimated_completion_time: "",
    difficulty: "beginner",
    tags: [] as string[],
  });

  // Quiz state
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    passing_score: "90",
    time_limit_minutes: "30",
    retake_cooldown_minutes: "60",
    allow_retake: true,
    shuffle_questions: true,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [objectiveInput, setObjectiveInput] = useState("");
  const [takeawayInput, setTakeawayInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "complete" | "error"
  >("idle");
  const [isDragging, setIsDragging] = useState(false);
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

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await api.get<any>(
          `${ENDPOINTS.ADMIN.MODULES}?page_size=100`,
        );
        setModules(res.modules || []);
      } catch (err) {
        console.error("Failed to fetch modules", err);
      }
    };
    fetchModules();
  }, []);

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

  const handleVideoUpload = async (file: File) => {
    if (!formData.id.trim()) {
      setError(t("admin.lessons.validation.setIdBeforeUpload"));
      return;
    }
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
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadStatus("processing");
            resolve();
          } else reject(new Error(xhr.responseText));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        xhr.open(
          "POST",
          `${baseUrl}${ENDPOINTS.ADMIN.UPLOAD_VIDEO_AWS}?lesson_id=${encodeURIComponent(formData.id.trim())}`,
        );
        xhr.withCredentials = true;
        xhr.send(formPayload);
      });
    } catch (err: any) {
      setUploadStatus("error");
      setError(err?.message || "Video upload failed");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("video/")) handleVideoUpload(file);
  };

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
      question: "",
      question_type: "MULTIPLE_CHOICE",
      options: [
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
      ],
      correct_answer: "a",
      explanation: "",
      points: 10,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const updated = [...questions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.id.trim() || !formData.title.trim() || !formData.module_id) {
      setError(t("admin.lessons.new.errors.required"));
      return;
    }

    const order = parseInt(formData.order);
    if (isNaN(order) || order < 1) {
      setError(t("admin.lessons.validation.orderMin"));
      return;
    }
    if (
      formData.duration_minutes &&
      (isNaN(parseInt(formData.duration_minutes)) ||
        parseInt(formData.duration_minutes) < 0)
    ) {
      setError(t("admin.lessons.validation.durationPositive"));
      return;
    }
    if (
      formData.estimated_completion_time &&
      (isNaN(parseInt(formData.estimated_completion_time)) ||
        parseInt(formData.estimated_completion_time) < 0)
    ) {
      setError(t("admin.lessons.validation.completionTimePositive"));
      return;
    }

    setLoading(true);
    try {
      // Create lesson
      const lessonPayload: any = {
        id: formData.id.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        module_id: formData.module_id,
        order: parseInt(formData.order) || 1,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : null,
        type: formData.type,
        video_url: formData.video_url.trim() || null,
        storage_provider: formData.storage_provider,
        transcript: formData.transcript.trim() || null,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        learning_objectives: formData.learning_objectives,
        key_takeaways: formData.key_takeaways,
        instructor_notes: formData.instructor_notes.trim() || null,
        estimated_completion_time: formData.estimated_completion_time
          ? parseInt(formData.estimated_completion_time)
          : null,
        difficulty: formData.difficulty,
        tags: formData.tags,
      };

      await api.post(
        ENDPOINTS.ADMIN.MODULE_LESSONS(formData.module_id),
        lessonPayload,
      );

      // Create quiz if questions exist
      if (questions.length > 0 && quizData.title.trim()) {
        const quizPayload = {
          title: quizData.title.trim(),
          description: quizData.description.trim() || null,
          passing_score: parseInt(quizData.passing_score) || 90,
          time_limit_minutes: parseInt(quizData.time_limit_minutes) || 30,
          retake_cooldown_minutes:
            parseInt(quizData.retake_cooldown_minutes) || 60,
          allow_retake: quizData.allow_retake,
          shuffle_questions: quizData.shuffle_questions,
          questions: questions.map((q, i) => ({
            question: q.question,
            question_type: q.question_type,
            options: q.question_type === "MULTIPLE_CHOICE" ? q.options : null,
            correct_answer: q.correct_answer,
            explanation: q.explanation || null,
            points: q.points,
            order: i,
          })),
        };
        await api.post(ENDPOINTS.ADMIN.LESSON_QUIZ(formData.id), quizPayload);
      }

      toast.success(t("admin.lessons.lessonCreated"));
      router.push("/admin/lessons");
    } catch (err: any) {
      console.error("Failed to create lesson", err);
      const msg = err?.message || t("admin.lessons.new.errors.failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

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
            {t("admin.lessons.new.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.lessons.new.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["details", "video", "quiz"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
            }`}
          >
            {tab === "details" && (
              <FileText size={16} className="inline mr-2" />
            )}
            {tab === "video" && <Video size={16} className="inline mr-2" />}
            {tab === "quiz" && <HelpCircle size={16} className="inline mr-2" />}
            {t(`admin.lessons.new.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="max-w-4xl"
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.lessonId")}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: e.target.value })
                  }
                  placeholder={t("admin.lessons.new.lessonIdPlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.module")}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={formData.module_id}
                  onChange={(e) =>
                    setFormData({ ...formData, module_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                >
                  <option value="">
                    {t("admin.lessons.new.selectModule")}
                  </option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.titleField")}{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder={t("admin.lessons.new.titlePlaceholder")}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.description")}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("admin.lessons.new.descriptionPlaceholder")}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.order")}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.type")}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                >
                  <option value="text">{t("admin.lessons.types.text")}</option>
                  <option value="video">
                    {t("admin.lessons.types.video")}
                  </option>
                  <option value="quiz">{t("admin.lessons.types.quiz")}</option>
                  <option value="interactive">
                    {t("admin.lessons.types.interactive")}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.difficulty")}
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) =>
                    setFormData({ ...formData, difficulty: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.duration")}
                </label>
                <div className="relative">
                  <Clock
                    size={18}
                    className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                  />
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
                    placeholder="15"
                    className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.estimatedTime")}
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
                  placeholder="20"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Learning Objectives */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.objectives")}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addObjective())
                  }
                  placeholder={t("admin.lessons.new.objectivePlaceholder")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={addObjective}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
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
                          learning_objectives:
                            formData.learning_objectives.filter(
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.takeaways")}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={takeawayInput}
                  onChange={(e) => setTakeawayInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTakeaway())
                  }
                  placeholder={t("admin.lessons.new.takeawayPlaceholder")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={addTakeaway}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {formData.key_takeaways.map((takeaway, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-emerald-950/40 rounded-lg"
                  >
                    <span className="text-sm text-green-700 flex-1">
                      {takeaway}
                    </span>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.tags")}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTag())
                  }
                  placeholder={t("admin.lessons.new.tagPlaceholder")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.instructorNotes")}
              </label>
              <textarea
                value={formData.instructor_notes}
                onChange={(e) =>
                  setFormData({ ...formData, instructor_notes: e.target.value })
                }
                placeholder={t("admin.lessons.new.instructorNotesPlaceholder")}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
              />
            </div>
          </div>
        )}

        {/* Video Tab */}
        {activeTab === "video" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
            {/* Storage Provider Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.video.storageProvider")}
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, storage_provider: "supabase" })
                  }
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.storage_provider === "supabase" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60" : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"}`}
                >
                  <div className="text-sm font-medium">
                    {t("admin.lessons.video.supabase")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("admin.lessons.video.supabaseDesc")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, storage_provider: "aws" })
                  }
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.storage_provider === "aws" ? "border-orange-500 bg-orange-50" : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"}`}
                >
                  <Cloud size={16} className="inline mr-1" />
                  <span className="text-sm font-medium">
                    {t("admin.lessons.video.aws")}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("admin.lessons.video.awsDesc")}
                  </div>
                </button>
              </div>
            </div>

            {/* Supabase mode: URL input */}
            {formData.storage_provider === "supabase" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.new.videoUrl")}
                </label>
                <div className="relative">
                  <Video
                    size={18}
                    className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                  />
                  <input
                    type="text"
                    value={formData.video_url}
                    onChange={(e) =>
                      setFormData({ ...formData, video_url: e.target.value })
                    }
                    placeholder="https://youtube.com/watch?v=... or Supabase path or /videos/..."
                    className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                  />
                </div>
              </div>
            )}

            {/* AWS mode: File upload with drag-drop */}
            {formData.storage_provider === "aws" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.lessons.video.uploadVideo")}
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40" : "border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600"}`}
                >
                  {uploadStatus === "idle" && (
                    <>
                      <Upload
                        size={32}
                        className="mx-auto mb-3 text-gray-400"
                      />
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                        {t("admin.lessons.video.dragDrop")}
                      </p>
                      <label className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-orange-700 transition-colors">
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
                      <p className="text-xs text-gray-400 mt-2">
                        {t("admin.lessons.video.fileSizeHint")}
                      </p>
                    </>
                  )}
                  {uploadStatus === "uploading" && (
                    <div className="space-y-3 max-w-sm mx-auto">
                      <Loader2
                        size={32}
                        className="mx-auto text-orange-500 animate-spin"
                      />
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
                        <span>
                          {t("admin.lessons.video.uploading")} {videoFile?.name}
                          ...
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
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">
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
                        size={32}
                        className="mx-auto mb-3 text-blue-500 dark:text-blue-400 animate-spin"
                      />
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                        {t("admin.lessons.video.transcoding")}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {t("admin.lessons.video.transcodingDesc")}
                      </p>
                    </div>
                  )}
                  {uploadStatus === "complete" && (
                    <div className="space-y-3">
                      <CheckCircle2
                        size={32}
                        className="mx-auto text-green-500"
                      />
                      <p className="text-sm font-medium text-green-700">
                        {t("admin.lessons.video.uploadComplete")}
                      </p>
                      {videoPreviewUrl && (
                        <div className="max-w-md mx-auto rounded-xl overflow-hidden bg-black border border-gray-800">
                          <video
                            src={videoPreviewUrl}
                            controls
                            className="w-full max-h-48 mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {uploadStatus === "error" && (
                    <div>
                      <AlertCircle
                        size={32}
                        className="mx-auto mb-3 text-red-500 dark:text-red-400"
                      />
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        {t("admin.lessons.video.uploadFailed")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setUploadStatus("idle")}
                        className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t("admin.lessons.video.tryAgain")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.thumbnailUrl")}
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail_url: e.target.value })
                }
                placeholder="https://example.com/thumbnail.jpg"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.lessons.new.transcript")}
              </label>
              <textarea
                value={formData.transcript}
                onChange={(e) =>
                  setFormData({ ...formData, transcript: e.target.value })
                }
                placeholder={t("admin.lessons.new.transcriptPlaceholder")}
                rows={10}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none font-mono"
              />
            </div>
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === "quiz" && (
          <div className="space-y-6">
            {/* Quiz Settings */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {t("admin.lessons.new.quizSettings")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t("admin.lessons.new.quizTitle")}
                  </label>
                  <input
                    type="text"
                    value={quizData.title}
                    onChange={(e) =>
                      setQuizData({ ...quizData, title: e.target.value })
                    }
                    placeholder={t("admin.lessons.new.quizTitlePlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t("admin.lessons.new.passingScore")}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t("admin.lessons.new.timeLimit")}
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizData.allow_retake}
                    onChange={(e) =>
                      setQuizData({
                        ...quizData,
                        allow_retake: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    {t("admin.lessons.new.allowRetake")}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizData.shuffle_questions}
                    onChange={(e) =>
                      setQuizData({
                        ...quizData,
                        shuffle_questions: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    {t("admin.lessons.new.shuffleQuestions")}
                  </span>
                </label>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {t("admin.lessons.new.questions")} ({questions.length})
                </h3>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Plus size={16} />
                  {t("admin.lessons.new.addQuestion")}
                </button>
              </div>

              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <select
                        value={q.question_type}
                        onChange={(e) =>
                          updateQuestion(index, {
                            question_type: e.target.value as any,
                            options:
                              e.target.value === "MULTIPLE_CHOICE"
                                ? [
                                    { id: "a", text: "" },
                                    { id: "b", text: "" },
                                    { id: "c", text: "" },
                                    { id: "d", text: "" },
                                  ]
                                : [],
                            correct_answer:
                              e.target.value === "TRUE_FALSE" ? "true" : "a",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                      >
                        <option value="MULTIPLE_CHOICE">
                          {t("admin.lessons.new.multipleChoice")}
                        </option>
                        <option value="TRUE_FALSE">
                          {t("admin.lessons.new.trueFalse")}
                        </option>
                        <option value="SHORT_ANSWER">
                          {t("admin.lessons.new.shortAnswer")}
                        </option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, "down")}
                        disabled={index === questions.length - 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-red-500 dark:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        {t("admin.lessons.new.questionText")}
                      </label>
                      <textarea
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(index, { question: e.target.value })
                        }
                        placeholder={t("admin.lessons.new.questionPlaceholder")}
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
                      />
                    </div>

                    {q.question_type === "MULTIPLE_CHOICE" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correct_answer === opt.id}
                              onChange={() =>
                                updateQuestion(index, {
                                  correct_answer: opt.id,
                                })
                              }
                              className="w-4 h-4 text-blue-600 dark:text-blue-400"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const newOptions = q.options?.map((o) =>
                                  o.id === opt.id
                                    ? { ...o, text: e.target.value }
                                    : o,
                                );
                                updateQuestion(index, { options: newOptions });
                              }}
                              placeholder={`${opt.id.toUpperCase()}. ${t("admin.lessons.new.option")}`}
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.question_type === "TRUE_FALSE" && (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`correct-tf-${q.id}`}
                            checked={q.correct_answer === "true"}
                            onChange={() =>
                              updateQuestion(index, { correct_answer: "true" })
                            }
                            className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          />
                          <span className="text-sm">
                            {t("admin.lessons.new.true")}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`correct-tf-${q.id}`}
                            checked={q.correct_answer === "false"}
                            onChange={() =>
                              updateQuestion(index, { correct_answer: "false" })
                            }
                            className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          />
                          <span className="text-sm">
                            {t("admin.lessons.new.false")}
                          </span>
                        </label>
                      </div>
                    )}

                    {q.question_type === "SHORT_ANSWER" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          {t("admin.lessons.new.correctAnswer")}
                        </label>
                        <input
                          type="text"
                          value={q.correct_answer || ""}
                          onChange={(e) =>
                            updateQuestion(index, {
                              correct_answer: e.target.value,
                            })
                          }
                          placeholder={t(
                            "admin.lessons.new.correctAnswerPlaceholder",
                          )}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          {t("admin.lessons.new.explanation")}
                        </label>
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) =>
                            updateQuestion(index, {
                              explanation: e.target.value,
                            })
                          }
                          placeholder={t(
                            "admin.lessons.new.explanationPlaceholder",
                          )}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          {t("admin.lessons.new.points")}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) =>
                            updateQuestion(index, {
                              points: parseInt(e.target.value) || 10,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="bg-gray-50 dark:bg-slate-900/60 rounded-2xl p-8 text-center">
                  <HelpCircle
                    size={40}
                    className="mx-auto mb-3 text-gray-300"
                  />
                  <p className="text-gray-500 dark:text-slate-400">
                    {t("admin.lessons.new.noQuestions")}
                  </p>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all"
                  >
                    {t("admin.lessons.new.addFirstQuestion")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.lessons.new.create")}
          </button>
          <Link
            href="/admin/lessons"
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            {t("admin.common.cancel")}
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
