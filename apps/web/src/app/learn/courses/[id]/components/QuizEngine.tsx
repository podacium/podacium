"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Clock,
  Trophy,
  RotateCcw,
  CheckSquare,
  ToggleLeft,
  AlignLeft,
} from "lucide-react";
import { LessonResponse, LessonProgressResponse } from "../types";
import { useTranslations } from "@/lib/i18n";
import { apiHelpers } from "@/lib/api";
import { enqueueOfflineMutation } from "@/lib/offlineSync";

// Quiz question types from backend enum - MVP only: deterministic/keyword-based grading
enum QuizQuestionType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  MULTIPLE_SELECT = "MULTIPLE_SELECT",
  TRUE_FALSE = "TRUE_FALSE",
  CODE_OUTPUT = "CODE_OUTPUT",
  FILL_BLANK = "FILL_BLANK",
  SHORT_ANSWER = "SHORT_ANSWER",
}

const SUPPORTED_QUESTION_TYPES = [
  QuizQuestionType.MULTIPLE_CHOICE,
  QuizQuestionType.MULTIPLE_SELECT,
  QuizQuestionType.TRUE_FALSE,
  QuizQuestionType.CODE_OUTPUT,
  QuizQuestionType.FILL_BLANK,
  QuizQuestionType.SHORT_ANSWER,
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  options?: QuizOption[];
  points: number;
  hint?: string;
  explanation?: string;
}

interface QuizData {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  timeLimitMinutes: number;
  passingScore: number;
  allowRetake: boolean;
}

interface QuizAttempt {
  id: number;
  score: number;
  isPassed: boolean;
  timeSpent: number;
  startedAt: string;
  completedAt?: string;
}

interface QuizEngineProps {
  activeLesson: LessonResponse | null;
  lessonProgress: LessonProgressResponse | null;
  onComplete: () => void;
  isRtl: boolean;
}

export const QuizEngine: React.FC<QuizEngineProps> = ({
  activeLesson,
  lessonProgress,
  onComplete,
  isRtl,
}) => {
  const t = useTranslations();

  // Quiz data state
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz attempt state
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(
    null,
  );
  const [attemptHistory, setAttemptHistory] = useState<QuizAttempt[]>([]);

  // Quiz progress state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Results state
  const [showResults, setShowResults] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Cooldown state (separate from error so it doesn't hijack the whole UI)
  const [cooldownActive, setCooldownActive] = useState(false);

  const progress = lessonProgress?.progress || 0;
  const isMediaLesson = ["video", "audio", "interactive"].includes(
    (activeLesson?.type || "").toLowerCase(),
  );
  const isPrerequisiteMet = !isMediaLesson || progress >= 90;

  // Auto-dismiss cooldown after 30 seconds
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setTimeout(() => setCooldownActive(false), 30000);
    return () => clearTimeout(timer);
  }, [cooldownActive]);

  // Fetch quiz data — only when the lesson has a quiz attached
  useEffect(() => {
    const hasQuizAttached =
      activeLesson?.quizId != null ||
      (typeof activeLesson?.exercises === "number" &&
        activeLesson.exercises > 0);
    if (activeLesson?.id && hasQuizAttached && isPrerequisiteMet) {
      setLoading(true);
      setError(null);

      Promise.all([
        apiHelpers.education.getQuiz(activeLesson.id),
        apiHelpers.education.getQuizAttempts(activeLesson.id),
      ])
        .then(([quizData, attempts]) => {
          setQuizData(quizData);
          setAttemptHistory(attempts || []);
          if (quizData?.timeLimitMinutes) {
            setTimeRemaining(quizData.timeLimitMinutes * 60);
          }
        })
        .catch((err) => {
          if (
            err?.status === 404 ||
            err?.message?.includes("No quiz") ||
            err?.message?.includes("404")
          ) {
            // Lesson has no quiz — handle gracefully without UI error state
            setQuizData(null);
            setError(null);
          } else {
            console.error("Failed to fetch quiz:", err);
            setError(t("course.messages.loadError"));
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!hasQuizAttached) {
      setLoading(false);
      setQuizData(null);
    }
  }, [
    activeLesson?.id,
    activeLesson?.quizId,
    activeLesson?.exercises,
    isPrerequisiteMet,
  ]);

  // Timer countdown — the updater stays PURE (no side effects). Auto-submit
  // is triggered from a separate effect when timeRemaining hits 0, so React
  // StrictMode's double-invoked updaters can never double-submit.
  useEffect(() => {
    if (!currentAttempt || showResults || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentAttempt, showResults, timeRemaining]);

  // Start new quiz attempt
  const handleStartAttempt = useCallback(async () => {
    if (!activeLesson?.id) return;

    setLoading(true);
    setCooldownActive(false);
    try {
      const result = await apiHelpers.education.startQuizAttempt(
        activeLesson.id,
      );
      setCurrentAttempt({
        id: result.attemptId,
        score: 0,
        isPassed: false,
        timeSpent: 0,
        startedAt: new Date().toISOString(),
      });
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
      setSubmissionResult(null);
      autoSubmittedRef.current = false;
      submittingRef.current = false;
      if (quizData?.questions?.length) {
        const shuffled = shuffleArray(quizData.questions).map((q) => ({
          ...q,
          options: q.options ? shuffleArray(q.options) : q.options,
        }));
        setQuizData((prev) => (prev ? { ...prev, questions: shuffled } : prev));
      }
      if (quizData?.timeLimitMinutes) {
        setTimeRemaining(quizData.timeLimitMinutes * 60);
      }
    } catch (err: any) {
      if (
        err.message?.includes("429") ||
        err.message?.includes("Cooldown") ||
        err.message?.includes("Too many requests")
      ) {
        setCooldownActive(true);
      } else {
        setError(err.message || t("course.messages.loadError"));
      }
    } finally {
      setLoading(false);
    }
  }, [activeLesson?.id, quizData?.timeLimitMinutes, t]);

  // Proctoring telemetry
  const tabSwitchesRef = useRef(0);
  const copyPastesRef = useRef(0);
  const dwellTimesRef = useRef<Record<string, number>>({});
  const lastNavTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentAttempt || showResults) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
      }
    };
    const onBlur = () => {
      tabSwitchesRef.current += 1;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [currentAttempt, showResults]);

  // Submit quiz answers
  const submittingRef = useRef(false);
  const handleSubmit = useCallback(async () => {
    if (!currentAttempt || submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);
    try {
      const activeQ = quizData?.questions?.[currentQuestionIndex];
      if (activeQ?.id) {
        const now = Date.now();
        const elapsed = (now - lastNavTimeRef.current) / 1000;
        dwellTimesRef.current[String(activeQ.id)] =
          (dwellTimesRef.current[String(activeQ.id)] || 0) + elapsed;
        lastNavTimeRef.current = now;
      }

      const submissionPayload = {
        answers,
        tabSwitchesCount: tabSwitchesRef.current,
        copyPasteAttempts: copyPastesRef.current,
        questionDwellTimes: dwellTimesRef.current,
      };

      const result = await apiHelpers.education.submitQuizAttempt(
        currentAttempt.id,
        submissionPayload,
      );
      setSubmissionResult(result);
      setShowResults(true);

      if (result.passed) {
        onComplete();
      }

      // Refresh attempt history
      const attempts = await apiHelpers.education.getQuizAttempts(
        activeLesson!.id,
      );
      setAttemptHistory(attempts || []);
    } catch (err: any) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          const submissionPayload = {
            answers,
            tabSwitchesCount: tabSwitchesRef.current,
            copyPasteAttempts: copyPastesRef.current,
            questionDwellTimes: dwellTimesRef.current,
          };
          await enqueueOfflineMutation({
            type: "QUIZ_SUBMIT",
            endpoint: `/api/education/quiz-attempts/${currentAttempt.id}/submit`,
            method: "POST",
            payload: submissionPayload,
            idempotency_key: `quiz_attempt_${currentAttempt.id}`,
          });
          setSubmissionResult({
            score: 100,
            passed: true,
            feedback:
              "Offline submission saved. Score will sync automatically when online.",
            isOfflineQueued: true,
          } as any);
          setShowResults(true);
          onComplete();
          return;
        } catch (queueErr) {
          console.error("Failed to enqueue offline quiz submission:", queueErr);
        }
      }
      setError(err.message || t("course.messages.loadError"));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [
    currentAttempt,
    answers,
    activeLesson,
    onComplete,
    quizData?.questions,
    currentQuestionIndex,
    t,
  ]);

  // Auto-submit exactly once when the timer reaches zero. Declared AFTER
  // `handleSubmit` so the reference is not in the temporal dead zone.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (
      currentAttempt &&
      !showResults &&
      timeRemaining <= 0 &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [timeRemaining, currentAttempt, showResults, handleSubmit]);

  // Handle answer selection
  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  // Note: Matching and Fill-in-blank handlers removed for MVP
  // Only deterministic question types are supported

  // Navigate questions
  const goToNext = useCallback(() => {
    if (currentQuestionIndex < (quizData?.questions.length || 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, quizData?.questions.length]);

  const goToPrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get question type icon
  const getQuestionTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "MULTIPLE_CHOICE":
      case "MULTIPLE_SELECT":
        return <CheckSquare className="w-5 h-5" />;
      case "TRUE_FALSE":
        return <ToggleLeft className="w-5 h-5" />;
      case "CODE_OUTPUT":
        return <AlignLeft className="w-5 h-5" />;
      case "SHORT_ANSWER":
      case "FILL_BLANK":
      case "FILL_IN_BLANK":
      case "ESSAY":
        return <AlignLeft className="w-5 h-5" />;
      default:
        return <HelpCircle className="w-5 h-5" />;
    }
  };

  // Get question type label
  const getQuestionTypeLabel = (type: string): string => {
    switch (type?.toUpperCase()) {
      case "MULTIPLE_CHOICE":
        return t("course.quiz.types.multipleChoice");
      case "MULTIPLE_SELECT":
        return t("course.quiz.types.multipleSelect");
      case "TRUE_FALSE":
        return t("course.quiz.types.trueFalse");
      case "CODE_OUTPUT":
        return t("course.quiz.types.codeOutput");
      case "SHORT_ANSWER":
        return t("course.quiz.types.shortAnswer");
      case "FILL_BLANK":
      case "FILL_IN_BLANK":
        return t("course.quiz.types.fillInBlank");
      case "ESSAY":
        return t("course.quiz.types.essay");
      default:
        return t("course.quiz.types.unknown");
    }
  };

  // Render question input based on type
  const renderQuestionInput = (question: QuizQuestion) => {
    const currentAnswer = answers[question.id];

    // Normalize question type to uppercase for comparison
    const questionType = question.type?.toUpperCase();

    switch (questionType) {
      case "MULTIPLE_CHOICE":
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswerChange(question.id, option.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-start
                                    ${
                                      currentAnswer === option.id
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                                        : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                                    }`}
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                    ${currentAnswer === option.id ? "border-blue-500" : "border-gray-300 dark:border-slate-700"}`}
                >
                  {currentAnswer === option.id && (
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="text-gray-700 dark:text-slate-300 font-medium">
                  {option.text}
                </span>
              </button>
            ))}
          </div>
        );

      case "TRUE_FALSE":
        // For TRUE_FALSE, use options if available, otherwise use default true/false
        const tfOptions =
          question.options && question.options.length > 0
            ? question.options
            : [
                { id: "true", text: t("course.quiz.true") },
                { id: "false", text: t("course.quiz.false") },
              ];

        return (
          <div className="flex gap-4">
            {tfOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswerChange(question.id, option.id)}
                className={`flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200
                                    ${
                                      currentAnswer === option.id
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                                        : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                                    }`}
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                                    ${currentAnswer === option.id ? "border-blue-500" : "border-gray-300 dark:border-slate-700"}`}
                >
                  {currentAnswer === option.id && (
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="text-gray-700 dark:text-slate-300 font-bold text-lg">
                  {option.text}
                </span>
              </button>
            ))}
          </div>
        );

      case "MULTIPLE_SELECT":
        const selectedList: string[] = Array.isArray(currentAnswer)
          ? currentAnswer
          : [];
        return (
          <div className="space-y-3">
            {question.options?.map((option) => {
              const isSelected = selectedList.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedList.filter((id) => id !== option.id)
                      : [...selectedList, option.id];
                    handleAnswerChange(question.id, next);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-start ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 dark:border-slate-700"
                    }`}
                  >
                    {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-gray-700 dark:text-slate-300 font-medium">
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>
        );

      case "CODE_OUTPUT":
        return (
          <div className="space-y-4">
            {question.options && question.options.length > 0 ? (
              <div className="space-y-3">
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, option.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-start ${
                      currentAnswer === option.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                        : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        currentAnswer === option.id
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300 dark:border-slate-700"
                      }`}
                    />
                    <code className="text-xs font-mono font-bold text-gray-800 dark:text-slate-200">
                      {option.text}
                    </code>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={currentAnswer || ""}
                  onChange={(e) =>
                    handleAnswerChange(question.id, e.target.value)
                  }
                  placeholder={t("course.quiz.codeOutputPlaceholder")}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>
        );

      case "SHORT_ANSWER":
      case "FILL_BLANK":
      case "FILL_IN_BLANK":
      case "ESSAY":
        return (
          <div className="space-y-4">
            <textarea
              value={currentAnswer || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={
                questionType === "FILL_IN_BLANK"
                  ? t("course.quiz.fillBlankPlaceholder")
                  : questionType === "ESSAY"
                    ? t("course.quiz.essayPlaceholder")
                    : t("course.quiz.shortAnswerPlaceholder")
              }
              className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/40 transition-all resize-none text-gray-700 dark:text-slate-300"
              rows={questionType === "ESSAY" ? 6 : 4}
            />
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {questionType === "FILL_IN_BLANK"
                ? t("course.quiz.fillBlankHint")
                : questionType === "ESSAY"
                  ? t("course.quiz.essayHint")
                  : t("course.quiz.shortAnswerHint")}
            </p>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-200 dark:border-amber-800/80">
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              {t("course.quiz.unsupportedQuestionType")}
            </p>
          </div>
        );
    }
  };

  if (!activeLesson) return null;

  // Prerequisite not completed (e.g. video < 90%) - show locked state
  if (!isPrerequisiteMet) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 dark:text-amber-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t("course.quiz.lockedTitle")}
          </h3>
          <p className="text-amber-700 dark:text-amber-300 mb-6">
            {t("course.quiz.lockedDescription")}
          </p>
          <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-2 max-w-md mx-auto overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="bg-amber-500 h-full"
            />
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 font-medium">
            {t("course.quiz.progressPercentage", {
              percentage: Math.round(progress).toString(),
            })}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !quizData) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 dark:text-slate-400">
          {t("course.states.loading")}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center">
        <XCircle className="w-16 h-16 text-red-500 dark:text-red-400 mb-4" />
        <p className="text-gray-700 dark:text-slate-300 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          {t("course.actions.tryAgain")}
        </button>
      </div>
    );
  }

  // No quiz available
  if (!quizData?.questions?.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center">
        <HelpCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 dark:text-slate-400 italic">
          {t("course.states.noLessonsAvailable.description")}
        </p>
      </div>
    );
  }

  // Results view
  if (showResults && submissionResult) {
    const passed = submissionResult.passed;
    const score = submissionResult.score;
    const totalQuestions = quizData.questions.length;
    const correctAnswers = Math.round((score / 100) * totalQuestions);

    return (
      <div className="space-y-6">
        <div
          className={`rounded-2xl p-8 text-center ${passed ? "bg-green-50 dark:bg-emerald-950/40 border border-green-100 dark:border-emerald-900/50" : "bg-red-50 dark:bg-red-950/60 border border-red-100 dark:border-red-900/50"}`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 10 }}
          >
            {passed ? (
              <Trophy className="w-20 h-20 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-20 h-20 text-red-500 dark:text-red-400 mx-auto mb-4" />
            )}
          </motion.div>

          <h3
            className={`text-2xl font-bold mb-2 ${
              (submissionResult as any).isOfflineQueued
                ? "text-blue-800 dark:text-blue-200"
                : passed
                  ? "text-green-800"
                  : "text-red-800 dark:text-red-200"
            }`}
          >
            {(submissionResult as any).isOfflineQueued
              ? t("course.quiz.savedOffline")
              : passed
                ? t("course.quiz.passed")
                : t("course.quiz.failed")}
          </h3>

          <p
            className={`mb-6 ${
              (submissionResult as any).isOfflineQueued
                ? "text-blue-700 dark:text-blue-300"
                : passed
                  ? "text-green-700"
                  : "text-red-700 dark:text-red-300"
            }`}
          >
            {(submissionResult as any).isOfflineQueued
              ? t("course.quiz.savedOfflineMessage")
              : passed
                ? t("course.quiz.passedMessage")
                : t("course.quiz.failedMessage")}
          </p>

          <div className="flex justify-center items-center gap-8 mb-6">
            <div className="text-center">
              <div
                className={`text-4xl font-black ${passed ? "text-green-600" : "text-red-600 dark:text-red-400"}`}
              >
                {score.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("course.quiz.score")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-gray-700 dark:text-slate-300">
                {correctAnswers}/{totalQuestions}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("course.quiz.correct")}
              </div>
            </div>
          </div>

          {quizData.questions.some((q) => q.type === "ESSAY") && (
            <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
              {t("course.quiz.essayNote")}
            </p>
          )}

          {passed && quizData.allowRetake && (
            <div className="text-sm text-green-600">
              {t("course.quiz.passedCanRetake")}
            </div>
          )}
        </div>

        {/* Per-Question Review with Explanations */}
        {quizData.questions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 flex items-center justify-between">
              <span>{t("course.quiz.questionReview")}</span>
              <span className="text-xs font-normal text-gray-500">
                {quizData.questions.length} {t("common.uiLabels.questions")}
              </span>
            </h4>
            <div className="space-y-3">
              {quizData.questions.map((q, idx) => {
                const userAns = answers[q.id];
                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        {idx + 1}. {q.question}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-gray-500 flex-shrink-0">
                        {q.points} {t("common.uiLabels.pts")}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-slate-400">
                      <span className="font-semibold text-gray-700 dark:text-slate-300">
                        {t("course.quiz.yourAnswer")}:{" "}
                      </span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {Array.isArray(userAns)
                          ? userAns.join(", ")
                          : String(userAns ?? t("course.quiz.noAnswer"))}
                      </span>
                    </div>

                    {(q.explanation || q.hint) && (
                      <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        <strong className="font-semibold">
                          {t("course.quiz.explanation")}:
                        </strong>{" "}
                        {q.explanation || q.hint}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attempt History */}
        {attemptHistory.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-4">
              {t("course.quiz.attemptHistory")}
            </h4>
            <div className="space-y-2">
              {attemptHistory.map((attempt, idx) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/60 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {attempt.isPassed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    )}
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {t("course.quiz.attempt")} #{attemptHistory.length - idx}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-bold ${attempt.isPassed ? "text-green-600" : "text-red-600 dark:text-red-400"}`}
                    >
                      {attempt.score.toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(attempt.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-4">
          {cooldownActive && (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-100 dark:border-amber-900/50">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-1">
                    {t("course.quiz.cooldownError")}
                  </h4>
                  <p className="text-amber-600 dark:text-amber-400 text-sm leading-relaxed">
                    {t("course.quiz.cooldownSubtitle")}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-4">
            {(!passed || quizData.allowRetake) && (
              <button
                onClick={handleStartAttempt}
                disabled={loading || cooldownActive}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  cooldownActive
                    ? "bg-gray-200 dark:bg-slate-800/90 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <RotateCcw className="w-5 h-5" />
                {passed ? t("course.quiz.retake") : t("course.quiz.tryAgain")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz intro / start screen
  if (!currentAttempt) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {quizData.title}
            </h2>
            <p className="text-gray-500 dark:text-slate-400">
              {t("course.quiz.stats", {
                score: quizData.passingScore.toString(),
                attempts: attemptHistory.length.toString(),
              })}
            </p>
          </div>
        </div>

        {quizData.description && (
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            {quizData.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {quizData.questions.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("course.quiz.questions")}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {quizData.timeLimitMinutes}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("course.quiz.minutes")}
            </div>
          </div>
        </div>

        {attemptHistory.length > 0 && !cooldownActive && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-100 dark:border-amber-900/50">
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              {t("course.quiz.previousAttempts")}
            </p>
          </div>
        )}

        {cooldownActive && (
          <div className="mb-6 p-6 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-1">
                  {t("course.quiz.cooldownError")}
                </h4>
                <p className="text-amber-600 dark:text-amber-400 text-sm leading-relaxed">
                  {t("course.quiz.cooldownSubtitle")}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleStartAttempt}
          disabled={loading || cooldownActive}
          className={`w-full py-4 rounded-xl font-bold transition-colors shadow-lg ${
            cooldownActive
              ? "bg-gray-200 dark:bg-slate-800/90 text-gray-400 cursor-not-allowed shadow-none"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
          }`}
        >
          {loading ? t("course.states.loading") : t("course.quiz.start")}
        </button>
      </div>
    );
  }

  // Active quiz view
  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizData.questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
              {getQuestionTypeIcon(currentQuestion.type)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100">
                {t("course.quiz.question")} {currentQuestionIndex + 1}{" "}
                {t("course.quiz.of")} {quizData.questions.length}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {currentQuestion.points} {t("course.quiz.points")} •{" "}
                {getQuestionTypeLabel(currentQuestion.type)}
              </p>
            </div>
          </div>

          {quizData.timeLimitMinutes > 0 && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeRemaining < 60 ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"}`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-2">
          <motion.div
            className="bg-blue-600 h-full rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${((currentQuestionIndex + 1) / quizData.questions.length) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800">
        <h4 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6">
          {currentQuestion.question}
        </h4>

        {currentQuestion.hint && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              <strong>{t("course.quiz.hint")}:</strong> {currentQuestion.hint}
            </p>
          </div>
        )}

        <div className="mb-8">{renderQuestionInput(currentQuestion)}</div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={goToPrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                            text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            {isRtl ? (
              <ArrowRight className="w-4 h-4" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            {t("course.quiz.prevQuestion")}
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {answeredCount}
            </span>
            <span>/</span>
            <span>{quizData.questions.length}</span>
            <span>{t("course.quiz.answered")}</span>
          </div>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={loading || answeredCount < quizData.questions.length}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("course.quiz.submitting")}
                </>
              ) : (
                <>
                  {t("course.quiz.submit")}
                  {isRtl ? (
                    <ArrowLeft className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goToNext}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              {t("course.quiz.nextQuestion")}
              {isRtl ? (
                <ArrowLeft className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Question Navigator */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800">
        <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-4">
          {t("course.quiz.questionNavigator")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {(quizData.questions || []).map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-10 h-10 rounded-lg font-bold text-sm transition-all
                                ${
                                  idx === currentQuestionIndex
                                    ? "bg-blue-600 text-white"
                                    : answers[q.id]
                                      ? "bg-green-100 text-green-700 border-2 border-green-300"
                                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
                                }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizEngine;
