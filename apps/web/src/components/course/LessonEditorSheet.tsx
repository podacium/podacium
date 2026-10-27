"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Loader2,
  Video,
  FileText,
  Eye,
  Clock,
  Tag,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Film,
  Check,
  ChevronUp,
  ChevronDown,
  ListChecks,
  Sliders,
} from "lucide-react";
import { api, apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import {
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  PodaciumDrawer,
} from "@/components/design-system";

export interface QuizQuestionItem {
  id?: number | string;
  question: string;
  questionType:
    | "MULTIPLE_CHOICE"
    | "MULTIPLE_SELECT"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "CODE_OUTPUT"
    | "FILL_BLANK";
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

interface LessonEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: string;
  lessonId?: string | null;
  onSaved: () => void;
  initialOrder?: number;
  initialTab?: "content" | "meta" | "quiz";
}

export const LessonEditorSheet: React.FC<LessonEditorSheetProps> = ({
  isOpen,
  onClose,
  moduleId,
  lessonId,
  onSaved,
  initialOrder = 1,
  initialTab = "content",
}) => {
  const t = useTranslations("instructor");
  const tCommon = useTranslations("common");
  const isEditing = Boolean(lessonId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "meta" | "quiz">(
    initialTab,
  );
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Quiz state
  const [quizEnabled, setQuizEnabled] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [passingScore, setPassingScore] = useState(80);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [retakeCooldownMinutes, setRetakeCooldownMinutes] = useState(60);
  const [allowRetake, setAllowRetake] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order: initialOrder.toString(),
    duration_minutes: "",
    type: "video",
    is_preview: false,
    video_url: "",
    transcript: "",
    difficulty: "beginner",
    learning_objectives: [] as string[],
    key_takeaways: [] as string[],
    instructor_notes: "",
  });

  // Video uploading
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [objectiveInput, setObjectiveInput] = useState("");
  const [takeawayInput, setTakeawayInput] = useState("");

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
    if (isOpen && isEditing && lessonId) {
      setLoading(true);
      api
        .get<any>(`/api/education/lessons/${lessonId}`)
        .then((res) => {
          setFormData({
            title: res.title || "",
            description: res.description || "",
            order: res.order?.toString() || initialOrder.toString(),
            duration_minutes: res.durationMinutes?.toString() || "",
            type: res.type || "video",
            is_preview: Boolean(res.isPreview ?? res.is_preview),
            video_url: res.videoUrl || "",
            transcript: res.transcript || "",
            difficulty: res.difficulty || "beginner",
            learning_objectives: res.learningObjectives || [],
            key_takeaways: res.keyTakeaways || [],
            instructor_notes: res.instructorNotes || "",
          });
        })
        .catch(() => toast.error(t("lessonSheet.loadFailed")))
        .finally(() => setLoading(false));

      // Fetch Quiz for editing if exists
      api
        .get<any>(`/api/education/lessons/${lessonId}/quiz/authoring`)
        .then((quizRes) => {
          if (quizRes?.hasQuiz && quizRes.quiz) {
            setQuizEnabled(true);
            setQuizTitle(quizRes.quiz.title || "");
            setQuizDescription(quizRes.quiz.description || "");
            setPassingScore(quizRes.quiz.passingScore ?? 80);
            setTimeLimitMinutes(quizRes.quiz.timeLimitMinutes ?? 30);
            setRetakeCooldownMinutes(quizRes.quiz.retakeCooldownMinutes ?? 60);
            setAllowRetake(quizRes.quiz.allowRetake ?? true);
            setShuffleQuestions(quizRes.quiz.shuffleQuestions ?? true);
            setQuestions(
              (quizRes.quiz.questions || []).map((q: any) => ({
                id: q.id,
                question: q.question || "",
                questionType: q.questionType || "MULTIPLE_CHOICE",
                options: Array.isArray(q.options) ? q.options : [],
                correctAnswer: q.correctAnswer || "",
                explanation: q.explanation || "",
                points: q.points ?? 10,
              })),
            );
          } else {
            setQuizEnabled(false);
            setQuestions([]);
          }
        })
        .catch(() => {});
    } else if (isOpen && !isEditing) {
      setFormData({
        title: "",
        description: "",
        order: initialOrder.toString(),
        duration_minutes: "",
        type: "video",
        is_preview: false,
        video_url: "",
        transcript: "",
        difficulty: "beginner",
        learning_objectives: [],
        key_takeaways: [],
        instructor_notes: "",
      });
      setVideoFile(null);
      setQuizEnabled(false);
      setQuizTitle("");
      setQuizDescription("");
      setPassingScore(80);
      setTimeLimitMinutes(30);
      setRetakeCooldownMinutes(60);
      setAllowRetake(true);
      setShuffleQuestions(true);
      setQuestions([]);
    }
  }, [isOpen, isEditing, lessonId, initialOrder, t]);

  const addQuestion = (
    type:
      | "MULTIPLE_CHOICE"
      | "MULTIPLE_SELECT"
      | "TRUE_FALSE"
      | "SHORT_ANSWER" = "MULTIPLE_CHOICE",
  ) => {
    const newQ: QuizQuestionItem = {
      id: `q_${Date.now()}`,
      question: "",
      questionType: type,
      options:
        type === "TRUE_FALSE"
          ? [
              { id: "true", text: "True" },
              { id: "false", text: "False" },
            ]
          : [
              { id: "opt_0", text: "" },
              { id: "opt_1", text: "" },
              { id: "opt_2", text: "" },
              { id: "opt_3", text: "" },
            ],
      correctAnswer: type === "TRUE_FALSE" ? "true" : "opt_0",
      explanation: "",
      points: 10,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const updateQuestion = (
    index: number,
    updates: Partial<QuizQuestionItem>,
  ) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const addOption = (qIndex: number) => {
    const q = questions[qIndex];
    const newOptId = `opt_${q.options.length}`;
    updateQuestion(qIndex, {
      options: [...q.options, { id: newOptId, text: "" }],
    });
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    const q = questions[qIndex];
    const updatedOpts = [...q.options];
    updatedOpts[optIndex] = { ...updatedOpts[optIndex], text };
    updateQuestion(qIndex, { options: updatedOpts });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (q.options.length <= 2) return;
    const optIdToRemove = q.options[optIndex].id;
    const updatedOpts = q.options.filter((_, i) => i !== optIndex);
    let updatedCorrect = q.correctAnswer;
    if (q.correctAnswer === optIdToRemove) {
      updatedCorrect = updatedOpts[0]?.id || "";
    }
    updateQuestion(qIndex, {
      options: updatedOpts,
      correctAnswer: updatedCorrect,
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error(t("lessonSheet.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      let currentLessonId = lessonId;

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        module_id: moduleId,
        order: parseInt(formData.order, 10) || 1,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes, 10)
          : null,
        type: formData.type,
        is_preview: formData.is_preview,
        video_url: formData.video_url || null,
        transcript: formData.transcript || null,
        difficulty: formData.difficulty,
        learning_objectives: formData.learning_objectives,
        key_takeaways: formData.key_takeaways,
        instructor_notes: formData.instructor_notes || null,
      };

      if (isEditing && currentLessonId) {
        await api.put(`/api/education/lessons/${currentLessonId}`, payload);
      } else {
        const created: any = await api.post(
          `/api/education/modules/${moduleId}/lessons`,
          payload,
        );
        currentLessonId = created?.id;
      }

      // If a video file was selected, upload it now
      if (videoFile && currentLessonId) {
        setIsUploading(true);
        const fd = new FormData();
        fd.append("file", videoFile);
        await apiClient.uploadWithProgress(
          `/api/education/modules/${moduleId}/lessons/${currentLessonId}/video`,
          fd,
          {
            onProgress: (p) => setUploadProgress(p),
            timeout: 15 * 60 * 1000,
          },
        );
        setIsUploading(false);
      }

      // If quiz is enabled, create or update quiz
      if (quizEnabled && currentLessonId) {
        const quizPayload = {
          title: quizTitle.trim() || `${formData.title.trim()} Assessment`,
          description: quizDescription.trim() || null,
          passing_score: Number(passingScore) || 80,
          time_limit_minutes: Number(timeLimitMinutes) || 30,
          retake_cooldown_minutes: Number(retakeCooldownMinutes) || 60,
          allow_retake: allowRetake,
          shuffle_questions: shuffleQuestions,
          questions: questions.map((q, idx) => {
            const filteredOptions = (q.options || []).filter(
              (opt) => (opt.text || "").trim().length > 0,
            );
            return {
              question: q.question.trim(),
              question_type: q.questionType,
              options: filteredOptions.length > 0 ? filteredOptions : q.options,
              correct_answer: q.correctAnswer,
              explanation: q.explanation.trim() || null,
              points: Number(q.points) || 10,
              order: idx,
            };
          }),
        };
        await api.post(
          `/api/education/lessons/${currentLessonId}/quiz`,
          quizPayload,
        );
      } else if (!quizEnabled && isEditing && currentLessonId) {
        // If instructor disabled quiz, detach it
        await api
          .delete(`/api/education/lessons/${currentLessonId}/quiz`)
          .catch(() => {});
      }

      toast.success(
        isEditing
          ? t("lessonSheet.lessonUpdated")
          : t("lessonSheet.lessonCreated"),
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t("lessonSheet.saveFailed"));
    } finally {
      setSaving(false);
      setIsUploading(false);
    }
  };

  const addObjective = () => {
    if (!objectiveInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      learning_objectives: [...prev.learning_objectives, objectiveInput.trim()],
    }));
    setObjectiveInput("");
  };

  const addTakeaway = () => {
    if (!takeawayInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      key_takeaways: [...prev.key_takeaways, takeawayInput.trim()],
    }));
    setTakeawayInput("");
  };

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end" size="lg">
      <DrawerContent
        className="w-full max-w-xl"
        overlayClassName="bg-slate-950/50"
      >
        {/* Drawer Header */}
        <DrawerHeader className="items-center border-gray-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              {formData.order || 1}
            </span>
            <div>
              <DrawerTitle className="text-base font-bold text-gray-900 dark:text-slate-100">
                {isEditing
                  ? t("lessonSheet.editTitle")
                  : t("lessonSheet.createTitle")}
              </DrawerTitle>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t("lessonSheet.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DrawerClose className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200" />
          </div>
        </DrawerHeader>

        {/* Content Tabs */}
        <div className="flex items-center gap-4 px-6 border-b border-gray-100 dark:border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "content"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400"
            }`}
          >
            {t("lessonSheet.contentTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("meta")}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === "meta"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400"
            }`}
          >
            {t("lessonSheet.pedagogyTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "quiz"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t("lessonSheet.quizTab")}</span>
            {quizEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Drawer Body */}
        {loading ? (
          <DrawerBody className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </DrawerBody>
        ) : (
          <DrawerBody className="space-y-5 p-6">
            {activeTab === "content" ? (
              <>
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("lessonSheet.titleLabel")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder={t("lessonSheet.titlePlaceholder")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Free Preview Switch */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 block">
                        {t("lessonSheet.freePreviewLabel")}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        {t("lessonSheet.freePreviewDesc")}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_preview: !formData.is_preview,
                      })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                      formData.is_preview
                        ? "bg-emerald-600"
                        : "bg-gray-300 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        formData.is_preview
                          ? "ltr:translate-x-5 rtl:-translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Type & Order */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("lessonSheet.lessonType")}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                    >
                      <option value="video">
                        {t("lessonSheet.videoLecture")}
                      </option>
                      <option value="text">
                        {t("lessonSheet.textArticle")}
                      </option>
                      <option value="quiz">{t("lessonSheet.quiz")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("lessonSheet.durationLabel")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: e.target.value,
                        })
                      }
                      placeholder={t("lessonSheet.autoDetected")}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                {/* Video Upload Area */}
                {formData.type === "video" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      {t("lessonSheet.videoFile")}
                    </label>

                    {/* Local Preview if selected */}
                    {videoPreviewUrl ? (
                      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-black aspect-video relative">
                        <video
                          src={videoPreviewUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setVideoFile(null)}
                          className="absolute top-2 end-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "video/mp4,video/quicktime,video/webm";
                          input.onchange = (e: any) => {
                            if (e.target.files?.[0]) {
                              setVideoFile(e.target.files[0]);
                            }
                          };
                          input.click();
                        }}
                        className="border-2 border-dashed border-gray-200 dark:border-slate-800 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition-colors"
                      >
                        <Film className="w-8 h-8 text-gray-400 mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-gray-800 dark:text-slate-200">
                          {t("lessonSheet.dropVideo")}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {t("lessonSheet.routedDirectly")}
                        </p>
                      </div>
                    )}

                    {isUploading && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl space-y-1.5">
                        <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
                          <span>{t("lessonSheet.uploadingVideo")}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Description with Markdown toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                      {t("lessonSheet.notesAndDescription")}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setShowMarkdownPreview(!showMarkdownPreview)
                      }
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showMarkdownPreview
                        ? t("lessonSheet.editRaw")
                        : t("lessonSheet.previewFormat")}
                    </button>
                  </div>

                  {showMarkdownPreview ? (
                    <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs text-gray-800 dark:text-slate-200 min-h-[100px] whitespace-pre-wrap">
                      {formData.description || t("lessonSheet.noDescription")}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder={t("lessonSheet.descriptionPlaceholder")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  )}
                </div>
              </>
            ) : activeTab === "meta" ? (
              <>
                {/* Objectives */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    {t("lessonSheet.learningObjectives")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={objectiveInput}
                      onChange={(e) => setObjectiveInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addObjective())
                      }
                      placeholder={t("lessonSheet.objectivePlaceholder")}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none"
                    />
                    <PodaciumButton
                      type="button"
                      variant="outline"
                      onClick={addObjective}
                      className="text-xs py-1 px-3"
                    >
                      {t("lessonSheet.add")}
                    </PodaciumButton>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {formData.learning_objectives.map((obj, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full"
                      >
                        {obj}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              learning_objectives:
                                prev.learning_objectives.filter(
                                  (_, idx) => idx !== i,
                                ),
                            }))
                          }
                        >
                          <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Key Takeaways */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    {t("lessonSheet.keyTakeaways")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={takeawayInput}
                      onChange={(e) => setTakeawayInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addTakeaway())
                      }
                      placeholder={t("lessonSheet.takeawayPlaceholder")}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none"
                    />
                    <PodaciumButton
                      type="button"
                      variant="outline"
                      onClick={addTakeaway}
                      className="text-xs py-1 px-3"
                    >
                      {t("lessonSheet.add")}
                    </PodaciumButton>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {formData.key_takeaways.map((item, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              key_takeaways: prev.key_takeaways.filter(
                                (_, idx) => idx !== i,
                              ),
                            }))
                          }
                        >
                          <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Instructor Notes */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    {t("lessonSheet.instructorNotes")}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.instructor_notes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        instructor_notes: e.target.value,
                      })
                    }
                    placeholder={t("lessonSheet.instructorNotesPlaceholder")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>
              </>
            ) : (
              /* Quiz & Assessment Tab */
              <div className="space-y-6">
                {/* Enable Quiz Toggle Card */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100">
                        {t("quiz.enableTitle")}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        {t("quiz.enableSubtitle")}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-4">
                    <input
                      type="checkbox"
                      checked={quizEnabled}
                      onChange={(e) => {
                        setQuizEnabled(e.target.checked);
                        if (e.target.checked && questions.length === 0) {
                          addQuestion("MULTIPLE_CHOICE");
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {quizEnabled ? (
                  <>
                    {/* Quiz Global Settings Card */}
                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h5 className="text-xs font-bold text-gray-900 dark:text-slate-200">
                            {t("quiz.settingsTitle")}
                          </h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <PodaciumBadge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {questions.length} {t("quiz.questionsCount")}
                          </PodaciumBadge>
                          <PodaciumBadge
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {questions.reduce(
                              (acc, q) => acc + (q.points || 0),
                              0,
                            )}{" "}
                            {t("quiz.totalPoints")}
                          </PodaciumBadge>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            {t("quiz.titleLabel")}
                          </label>
                          <input
                            type="text"
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                            placeholder={
                              formData.title
                                ? `${formData.title} - ${t("quiz.quizSuffix")}`
                                : t("quiz.titlePlaceholder")
                            }
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            {t("quiz.instructionsLabel")}
                          </label>
                          <textarea
                            rows={2}
                            value={quizDescription}
                            onChange={(e) => setQuizDescription(e.target.value)}
                            placeholder={t("quiz.instructionsPlaceholder")}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                          />
                        </div>

                        {/* Passing Score Slider & Time Limit Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                                {t("quiz.passScoreLabel")}
                              </span>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {passingScore}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="100"
                              step="5"
                              value={passingScore}
                              onChange={(e) =>
                                setPassingScore(Number(e.target.value))
                              }
                              className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800">
                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                              {t("quiz.timeLimitLabel")}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="180"
                                value={timeLimitMinutes}
                                onChange={(e) =>
                                  setTimeLimitMinutes(Number(e.target.value))
                                }
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-xs font-bold outline-none"
                              />
                              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                                {timeLimitMinutes === 0
                                  ? t("quiz.noLimit")
                                  : `${timeLimitMinutes} ${t("quiz.minutesShort")}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Retake & Shuffle Checkboxes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allowRetake}
                              onChange={(e) => setAllowRetake(e.target.checked)}
                              className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{t("quiz.allowRetake")}</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={shuffleQuestions}
                              onChange={(e) =>
                                setShuffleQuestions(e.target.checked)
                              }
                              className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{t("quiz.shuffleQuestions")}</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                          <ListChecks className="w-4 h-4 text-emerald-500" />
                          <span>{t("quiz.questionsHeading")}</span>
                        </h5>
                      </div>

                      {questions.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                          <HelpCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                            {t("quiz.noQuestionsPrompt")}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                            {t("quiz.noQuestionsHelper")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {questions.map((q, qIndex) => (
                            <div
                              key={q.id || qIndex}
                              className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5 shadow-sm"
                            >
                              {/* Question Card Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                                    {qIndex + 1}
                                  </span>
                                  <select
                                    value={q.questionType}
                                    onChange={(e) => {
                                      const nextType = e.target.value as any;
                                      let nextOptions = q.options;
                                      let nextCorrect = q.correctAnswer;
                                      if (nextType === "TRUE_FALSE") {
                                        nextOptions = [
                                          { id: "true", text: "True" },
                                          { id: "false", text: "False" },
                                        ];
                                        nextCorrect = "true";
                                      } else if (
                                        q.questionType === "TRUE_FALSE" &&
                                        nextType !== "TRUE_FALSE"
                                      ) {
                                        nextOptions = [
                                          { id: "opt_0", text: "" },
                                          { id: "opt_1", text: "" },
                                        ];
                                        nextCorrect = "opt_0";
                                      }
                                      updateQuestion(qIndex, {
                                        questionType: nextType,
                                        options: nextOptions,
                                        correctAnswer: nextCorrect,
                                      });
                                    }}
                                    className="text-xs font-medium py-1 px-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 outline-none"
                                  >
                                    <option value="MULTIPLE_CHOICE">
                                      {t("quiz.typeSingle")}
                                    </option>
                                    <option value="MULTIPLE_SELECT">
                                      {t("quiz.typeMulti")}
                                    </option>
                                    <option value="TRUE_FALSE">
                                      {t("quiz.typeTrueFalse")}
                                    </option>
                                    <option value="CODE_OUTPUT">
                                      {t("quiz.typeCodeOutput")}
                                    </option>
                                    <option value="FILL_BLANK">
                                      {t("quiz.typeFillBlank")}
                                    </option>
                                    <option value="SHORT_ANSWER">
                                      {t("quiz.typeShortAnswer")}
                                    </option>
                                  </select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {/* Points */}
                                  <div className="flex items-center gap-1 me-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={q.points}
                                      onChange={(e) =>
                                        updateQuestion(qIndex, {
                                          points: Number(e.target.value) || 10,
                                        })
                                      }
                                      className="w-12 px-1.5 py-0.5 text-center text-xs font-bold rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400">
                                      {tCommon("uiLabels.pts")}
                                    </span>
                                  </div>

                                  {/* Move buttons */}
                                  <button
                                    type="button"
                                    disabled={qIndex === 0}
                                    onClick={() => moveQuestion(qIndex, "up")}
                                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-30"
                                    title={t("quiz.moveUp")}
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={qIndex === questions.length - 1}
                                    onClick={() => moveQuestion(qIndex, "down")}
                                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-30"
                                    title={t("quiz.moveDown")}
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    type="button"
                                    onClick={() => removeQuestion(qIndex)}
                                    className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ms-1"
                                    title={t("quiz.deleteQuestion")}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Question Prompt */}
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                  {t("quiz.questionPrompt")}{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.question}
                                  onChange={(e) =>
                                    updateQuestion(qIndex, {
                                      question: e.target.value,
                                    })
                                  }
                                  placeholder={t(
                                    "quiz.questionPromptPlaceholder",
                                  )}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                />
                              </div>

                              {/* Answer Options */}
                              {q.questionType === "SHORT_ANSWER" ? (
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                    {t("quiz.acceptedAnswer")}{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={q.correctAnswer}
                                    onChange={(e) =>
                                      updateQuestion(qIndex, {
                                        correctAnswer: e.target.value,
                                      })
                                    }
                                    placeholder={t(
                                      "quiz.acceptedAnswerPlaceholder",
                                    )}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              ) : q.questionType === "TRUE_FALSE" ? (
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                                    {t("quiz.correctAnswerLabel")}
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {["true", "false"].map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() =>
                                          updateQuestion(qIndex, {
                                            correctAnswer: val,
                                          })
                                        }
                                        className={`p-2.5 rounded-xl border text-xs font-bold capitalize transition-all flex items-center justify-center gap-2 ${
                                          q.correctAnswer === val
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                                            : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
                                        }`}
                                      >
                                        {q.correctAnswer === val && (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        )}
                                        {val === "true"
                                          ? t("quiz.true")
                                          : t("quiz.false")}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                /* MULTIPLE_CHOICE or MULTIPLE_SELECT */
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                                      {t("quiz.answerChoices")}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => addOption(qIndex)}
                                      className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      {t("quiz.addChoice")}
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {(q.options || []).map((opt, oIndex) => {
                                      const isMulti =
                                        q.questionType === "MULTIPLE_SELECT";
                                      let isCorrect = false;
                                      if (isMulti) {
                                        try {
                                          const selectedArray = JSON.parse(
                                            q.correctAnswer || "[]",
                                          );
                                          isCorrect =
                                            Array.isArray(selectedArray) &&
                                            selectedArray.includes(opt.id);
                                        } catch {
                                          isCorrect = (q.correctAnswer || "")
                                            .split(",")
                                            .includes(opt.id);
                                        }
                                      } else {
                                        isCorrect = q.correctAnswer === opt.id;
                                      }

                                      return (
                                        <div
                                          key={opt.id || oIndex}
                                          className="flex items-center gap-2"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isMulti) {
                                                let arr: string[] = [];
                                                try {
                                                  arr = JSON.parse(
                                                    q.correctAnswer || "[]",
                                                  );
                                                  if (!Array.isArray(arr))
                                                    arr = [];
                                                } catch {
                                                  arr = (q.correctAnswer || "")
                                                    .split(",")
                                                    .filter(Boolean);
                                                }
                                                if (arr.includes(opt.id)) {
                                                  arr = arr.filter(
                                                    (x) => x !== opt.id,
                                                  );
                                                } else {
                                                  arr.push(opt.id);
                                                }
                                                updateQuestion(qIndex, {
                                                  correctAnswer:
                                                    JSON.stringify(arr),
                                                });
                                              } else {
                                                updateQuestion(qIndex, {
                                                  correctAnswer: opt.id,
                                                });
                                              }
                                            }}
                                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                                              isCorrect
                                                ? "border-emerald-500 bg-emerald-500 text-white"
                                                : "border-gray-300 dark:border-slate-700 hover:border-gray-400"
                                            }`}
                                            title={
                                              isCorrect
                                                ? t("quiz.markedCorrect")
                                                : t("quiz.markCorrect")
                                            }
                                          >
                                            {isCorrect && (
                                              <Check className="w-3.5 h-3.5" />
                                            )}
                                          </button>

                                          <input
                                            type="text"
                                            value={opt.text}
                                            onChange={(e) =>
                                              updateOption(
                                                qIndex,
                                                oIndex,
                                                e.target.value,
                                              )
                                            }
                                            placeholder={`${t("quiz.optionPlaceholder")} ${
                                              oIndex + 1
                                            }`}
                                            className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none bg-white dark:bg-slate-900 transition-colors ${
                                              isCorrect
                                                ? "border-emerald-300 dark:border-emerald-900/60 font-medium"
                                                : "border-gray-200 dark:border-slate-800"
                                            }`}
                                          />

                                          {(q.options || []).length > 2 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeOption(qIndex, oIndex)
                                              }
                                              className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Explanation / Rationale */}
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1">
                                  {t("quiz.explanationLabel")}
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.explanation}
                                  onChange={(e) =>
                                    updateQuestion(qIndex, {
                                      explanation: e.target.value,
                                    })
                                  }
                                  placeholder={t("quiz.explanationPlaceholder")}
                                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 resize-none text-gray-700 dark:text-slate-300"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Question Button Bar */}
                      <div className="pt-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <PodaciumButton
                            type="button"
                            variant="outline"
                            onClick={() => addQuestion("MULTIPLE_CHOICE")}
                            className="text-[11px] py-2 px-2.5 flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t("quiz.addSingleChoice")}</span>
                          </PodaciumButton>

                          <PodaciumButton
                            type="button"
                            variant="outline"
                            onClick={() => addQuestion("MULTIPLE_SELECT")}
                            className="text-[11px] py-2 px-2.5 flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t("quiz.addMultiSelect")}</span>
                          </PodaciumButton>

                          <PodaciumButton
                            type="button"
                            variant="outline"
                            onClick={() => addQuestion("TRUE_FALSE")}
                            className="text-[11px] py-2 px-2.5 flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t("quiz.addTrueFalse")}</span>
                          </PodaciumButton>

                          <PodaciumButton
                            type="button"
                            variant="outline"
                            onClick={() => addQuestion("SHORT_ANSWER")}
                            className="text-[11px] py-2 px-2.5 flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t("quiz.addShortAnswer")}</span>
                          </PodaciumButton>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Quiz Disabled Empty State */
                  <div className="p-8 text-center border border-gray-100 dark:border-slate-800/80 rounded-2xl bg-gray-50/50 dark:bg-slate-900/40 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <h5 className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        {t("quiz.noQuizTitle")}
                      </h5>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                        {t("quiz.noQuizDesc")}
                      </p>
                    </div>
                    <PodaciumButton
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setQuizEnabled(true);
                        if (questions.length === 0) {
                          addQuestion("MULTIPLE_CHOICE");
                        }
                      }}
                      className="text-xs py-1.5 px-4 inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("quiz.enableButton")}</span>
                    </PodaciumButton>
                  </div>
                )}
              </div>
            )}
          </DrawerBody>
        )}

        {/* Drawer Footer */}
        <DrawerFooter className="justify-end border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <PodaciumButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="text-xs py-2 px-4"
          >
            {t("lessonSheet.cancelButton")}
          </PodaciumButton>
          <PodaciumButton
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saving || isUploading}
            className="text-xs py-2 px-5 flex items-center gap-1.5"
          >
            {saving || isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                {t("lessonSheet.savingButton")}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> {t("lessonSheet.saveButton")}
              </>
            )}
          </PodaciumButton>
        </DrawerFooter>
      </DrawerContent>
    </PodaciumDrawer>
  );
};

export default LessonEditorSheet;
