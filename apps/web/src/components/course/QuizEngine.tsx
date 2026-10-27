// components/course/QuizEngine.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RotateCw,
  HelpCircle,
  ChevronRight,
  Award,
} from "lucide-react";
import { apiHelpers } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface QuizQuestionOption {
  id: string | number;
  text: string;
}

interface QuizQuestion {
  id: string;
  type:
    | "mcq"
    | "multiple_select"
    | "true_false"
    | "fill_blank"
    | "matching"
    | string;
  question: string;
  options?: Array<string | QuizQuestionOption>;
  points: number;
  explanation?: string;
}

interface QuizEngineProps {
  quizId: number;
  lessonId: string;
  onComplete?: () => void;
  maxRetries?: number;
  timeLimit?: number;
}

const QuizEngine: React.FC<QuizEngineProps> = ({
  quizId,
  lessonId,
  onComplete,
  maxRetries = 3,
  timeLimit: propsTimeLimit,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [retriesLeft, setRetriesLeft] = useState(maxRetries);
  const t = useTranslations();

  const currentQuestion = questions[currentQuestionIndex];
  const userAnswer = userAnswers[currentQuestion?.id];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const userAnswersRef = useRef(userAnswers);
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  const handleQuizComplete = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const result = await apiHelpers.education.submitQuizAttempt(
        attemptId,
        userAnswersRef.current,
      );
      setQuizCompleted(true);
      setScore(result.score);
      setPassed(result.passed);
      setResultMessage(result.message);
      if (result.passed && onComplete) onComplete();
    } catch (err: any) {
      console.error("Error submitting quiz:", err);
      setError(err.message || t("compcourse.quiz.error_submit"));
    } finally {
      setLoading(false);
    }
  }, [attemptId, onComplete, t]);

  const handleQuizCompleteRef = useRef(handleQuizComplete);
  useEffect(() => {
    handleQuizCompleteRef.current = handleQuizComplete;
  }, [handleQuizComplete]);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const quizData = await apiHelpers.education.getQuiz(lessonId);
        if (quizData) {
          setQuestions(quizData.questions);
          setTotalScore(
            quizData.questions.reduce(
              (sum: number, q: any) => sum + (q.points || 0),
              0,
            ),
          );
          if (quizData.timeLimitMinutes) {
            setTimeLeft(quizData.timeLimitMinutes * 60);
          } else if (propsTimeLimit) {
            setTimeLeft(propsTimeLimit * 60);
          }
        }
      } catch (err: any) {
        console.error("Error loading quiz:", err);
        setError(err.message || t("compcourse.quiz.error"));
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [lessonId, propsTimeLimit, t]);

  const handleStartQuiz = async () => {
    try {
      setLoading(true);
      const { attemptId: newAttemptId } =
        await apiHelpers.education.startQuizAttempt(lessonId);
      setAttemptId(newAttemptId);
      setQuizStarted(true);
      setError(null);
    } catch (err: any) {
      console.error("Error starting quiz:", err);
      setError(err.message || t("compcourse.quiz.error_start"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!quizStarted || quizCompleted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleQuizCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizStarted, quizCompleted]);

  const handleAnswerSelect = useCallback(
    (answer: any) => {
      if (!currentQuestion) return;
      setUserAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    },
    [currentQuestion],
  );

  const handleNextQuestion = useCallback(() => {
    if (isLastQuestion) {
      handleQuizComplete();
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setShowExplanation(false);
    }
  }, [isLastQuestion, handleQuizComplete]);

  const handleRetry = () => {
    if (retriesLeft > 0) {
      setRetriesLeft((prev) => prev - 1);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setQuizStarted(false);
      setQuizCompleted(false);
      setScore(0);
      setPassed(false);
      setResultMessage(null);
      setAttemptId(null);
      if (propsTimeLimit) setTimeLeft(propsTimeLimit * 60);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-pulse mx-auto mb-4" />
        <h3 className="text-xl font-bold">{t("compcourse.quiz.loading")}</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold">{t("compcourse.quiz.error")}</h3>
        <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl"
        >
          {t("compcourse.quiz.tryAgain")}
        </button>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 p-8">
        <div className="text-center mb-8">
          <HelpCircle className="w-20 h-20 text-blue-600 dark:text-blue-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold">
            {t("compcourse.quiz.knowledgeCheck")}
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            {t("compcourse.quiz.description")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-center">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("compcourse.quiz.questions")}
            </div>
            <div className="text-xl font-bold">{questions.length}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("compcourse.quiz.totalPoints")}
            </div>
            <div className="text-xl font-bold">{totalScore}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("compcourse.quiz.passingScore")}
            </div>
            <div className="text-xl font-bold">90%</div>
          </div>
        </div>
        <div className="text-center">
          <button
            onClick={handleStartQuiz}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
          >
            {t("compcourse.quiz.startQuiz")}
          </button>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-4">
            {t("compcourse.quiz.attemptsRemaining", {
              count: retriesLeft.toString(),
            })}
          </p>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-8 ${passed ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 border-green-200 dark:border-emerald-800/80" : "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200 dark:border-amber-800/80"}`}
      >
        <div className="text-center mb-8">
          {passed ? (
            <Award className="w-20 h-20 text-green-600 mx-auto mb-6" />
          ) : (
            <AlertCircle className="w-20 h-20 text-amber-600 dark:text-amber-400 mx-auto mb-6" />
          )}
          <h2 className="text-2xl font-bold">
            {passed ? t("compcourse.quiz.passed") : t("compcourse.quiz.failed")}
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            {resultMessage ||
              (passed
                ? t("compcourse.quiz.passedMessage")
                : t("compcourse.quiz.failedMessage"))}
          </p>
          <div className="flex justify-center gap-12 my-8">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {score} / {totalScore}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("compcourse.quiz.pointsScored")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{percentage.toFixed(1)}%</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("compcourse.quiz.percentage")}
              </div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden relative mb-8">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              className={`h-full ${percentage >= 90 ? "bg-green-500" : "bg-amber-500"}`}
            />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-gray-400"
              style={{ left: "90%" }}
            ></div>
          </div>
          <div className="flex justify-center gap-4">
            {!passed && retriesLeft > 0 && (
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold"
              >
                <RotateCw className="w-4 h-4 mr-2 inline" />
                {t("compcourse.quiz.retryQuiz")}
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-semibold"
            >
              {t("compcourse.quiz.finish")}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-800 p-8 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <div>
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
            {t("compcourse.quiz.question", {
              current: (currentQuestionIndex + 1).toString(),
              total: questions.length.toString(),
            })}
          </span>
          <h3 className="text-xl font-bold mt-2">{currentQuestion.question}</h3>
        </div>
        {timeLeft > 0 && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-center">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 me-2" />
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-3 mb-8">
        {currentQuestion.type === "mcq" &&
          currentQuestion.options?.map((option, idx) => {
            const optId =
              typeof option === "object" && option !== null
                ? String(option.id)
                : String(idx);
            const optText =
              typeof option === "object" && option !== null
                ? option.text
                : String(option);
            const isSelected =
              String(userAnswer) === optId ||
              userAnswer === option ||
              userAnswer === optText;
            return (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(optId)}
                className={`w-full text-start p-4 rounded-xl border transition ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 border-2"
                    : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-blue-200 dark:border-blue-800/80"
                }`}
              >
                <span className="me-4 inline-flex w-8 h-8 items-center justify-center rounded bg-gray-100 dark:bg-slate-800 font-bold">
                  {String.fromCharCode(65 + idx)}
                </span>
                {optText}
              </button>
            );
          })}
        {currentQuestion.type === "true_false" && (
          <div className="grid grid-cols-2 gap-4">
            {["true", "false"].map((val) => (
              <button
                key={val}
                onClick={() => handleAnswerSelect(val)}
                className={`p-6 rounded-xl border text-center font-bold capitalize ${userAnswer === val ? (val === "true" ? "bg-green-50 dark:bg-emerald-950/40 border-green-300" : "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700") : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"}`}
              >
                {val}
              </button>
            ))}
          </div>
        )}
        {currentQuestion.type === "fill_blank" && (
          <input
            type="text"
            value={userAnswer || ""}
            onChange={(e) => handleAnswerSelect(e.target.value)}
            placeholder={t("compcourse.quiz.fillBlankPlaceholder")}
            className="w-full px-6 py-4 border rounded-xl"
          />
        )}
      </div>
      <div className="flex justify-between items-center pt-6 border-t font-semibold">
        <div className="text-gray-500 dark:text-slate-400">
          {t("compcourse.quiz.points", {
            points: currentQuestion.points.toString(),
          })}
        </div>
        <button
          onClick={handleNextQuestion}
          disabled={!userAnswer}
          className={`px-8 py-3 rounded-xl transition ${userAnswer ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"}`}
        >
          {isLastQuestion
            ? t("compcourse.quiz.finishQuiz")
            : t("compcourse.quiz.nextQuestion")}
        </button>
      </div>
    </div>
  );
};

export default QuizEngine;
