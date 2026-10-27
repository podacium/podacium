import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle,
  Clock,
  Layers,
  Star,
  ChevronRight,
} from "lucide-react";
import { ModuleResponse, LessonResponse, EnrollmentResponse } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { LessonStatus } from "../types";
import { formatDuration } from "../utils";
import ProgressBar from "./ProgressBar";
import LessonCard from "./LessonCard";

interface ModuleAccordionProps {
  module: ModuleResponse;
  isExpanded: boolean;
  onToggle: () => void;
  progress: number;
  lessons: LessonResponse[];
  activeLessonId?: string;
  onLessonSelect: (lessonId: string) => void;
  getLessonProgress: (lessonId: string) => number;
  getLessonStatus: (lessonId: string) => LessonStatus;
  enrollment?: EnrollmentResponse | null;
}

const ModuleAccordion: React.FC<ModuleAccordionProps> = ({
  module,
  isExpanded,
  onToggle,
  progress,
  lessons,
  activeLessonId,
  onLessonSelect,
  getLessonProgress,
  getLessonStatus,
  enrollment,
}) => {
  const t = useTranslations();
  const completedLessons = lessons.filter(
    (l) => getLessonStatus(l.id) === LessonStatus.COMPLETED,
  ).length;
  const totalLessons = lessons.length;

  return (
    <div
      className={`group bg-white dark:bg-slate-900 rounded-[32px] border-2 transition-all duration-500 ${
        isExpanded
          ? "border-indigo-100 shadow-2xl shadow-indigo-900/5"
          : "border-gray-50 hover:border-gray-100 dark:border-slate-800 shadow-sm"
      } overflow-hidden`}
    >
      <button
        onClick={onToggle}
        className="w-full p-8 text-start hover:bg-indigo-50 dark:bg-slate-900/80 dark:bg-indigo-950/60 transition-colors duration-300"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                className={`w-16 h-16 rounded-[22px] flex items-center justify-center transition-all duration-500 ${
                  isExpanded
                    ? "bg-indigo-600 text-white scale-110 shadow-xl shadow-indigo-200"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                }`}
              >
                <BookOpen className="w-7 h-7" />
              </div>
              {progress === 100 && (
                <div className="absolute -top-2 -end-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                  {module.title}
                </h3>
                {module.isNew && (
                  <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">
                    {t("course.badges.new")}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 me-2 opacity-60" />
                  {formatDuration(module.durationMinutes)}
                </div>
                <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 me-2 opacity-60" />
                  {totalLessons} {t("course.curriculum.lessons")}
                </div>
                {module.rating && (
                  <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <Star className="w-3.5 h-3.5 me-2 text-amber-500 dark:text-amber-400 fill-amber-500" />
                    {module.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden md:flex flex-col items-end gap-1">
              <div className="text-3xl font-black text-gray-900 dark:text-slate-100 tabular-nums">
                {progress}
                <span className="text-lg font-bold opacity-30">%</span>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                {completedLessons} / {totalLessons}{" "}
                {t("course.curriculum.complete")}
              </div>
            </div>

            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 text-gray-400 transition-all duration-500 ${
                isExpanded
                  ? "rotate-180 bg-indigo-600 border-indigo-600 text-white"
                  : "group-hover:bg-gray-100 dark:group-hover:bg-slate-800 group-hover:text-gray-900 dark:group-hover:text-slate-100 group-hover:border-gray-200 dark:group-hover:border-slate-700"
              }`}
            >
              <ChevronRight
                className={`w-5 h-5 rtl:rotate-180 transition-transform ${isExpanded ? "rotate-90 rtl:-rotate-90" : ""}`}
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ProgressBar
            value={progress}
            color={progress === 100 ? "green" : "blue"}
            size="md"
            showLabel={false}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-gray-50 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800"
          >
            <div className="p-8 pt-2">
              <div className="bg-white dark:bg-slate-900 rounded-[24px] p-2 border border-gray-100 dark:border-slate-800 shadow-inner">
                {lessons.length > 0 ? (
                  <div className="space-y-1">
                    {lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        isActive={activeLessonId === lesson.id}
                        isCompleted={
                          getLessonStatus(lesson.id) === LessonStatus.COMPLETED
                        }
                        isLocked={
                          getLessonStatus(lesson.id) === LessonStatus.LOCKED
                        }
                        progress={getLessonProgress(lesson.id)}
                        onClick={() => onLessonSelect(lesson.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900/60 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
                      {t("course.states.noLessons")}
                    </p>
                  </div>
                )}
              </div>

              {module.learningObjectives &&
                module.learningObjectives.length > 0 && (
                  <div className="mt-8 px-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-3">
                      <span className="h-px bg-gray-200 dark:bg-slate-800/90 flex-1"></span>
                      {t("course.curriculum.moduleObjectives")}
                      <span className="h-px bg-gray-200 dark:bg-slate-800/90 flex-1"></span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(module.learningObjectives || []).map(
                        (objective, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                              {objective}
                            </span>
                          </motion.div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModuleAccordion;
