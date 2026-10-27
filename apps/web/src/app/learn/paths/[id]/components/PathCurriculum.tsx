"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Lock,
  Play,
  CheckCircle,
  FileText,
  Video,
  Globe,
  FileCode,
  Music,
  HelpCircle,
  Clock,
  BookOpen,
  Layers,
  Star,
  ArrowRight,
  User,
  BarChart3,
  Bot,
  GraduationCap,
  Code,
  Briefcase,
  Palette,
  Lightbulb,
  Database,
} from "lucide-react";

const EMOJI_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "📊": BarChart3,
  "🤖": Bot,
  "📚": BookOpen,
  "📖": BookOpen,
  "🌐": Globe,
  "💻": Code,
  "🎓": GraduationCap,
  "💼": Briefcase,
  "🎨": Palette,
  "💡": Lightbulb,
  "🗄️": Database,
  "⚙️": Code,
};

const typeIcons: Record<string, any> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
  code: FileCode,
  audio: Music,
  interactive: Globe,
};

interface ModuleItemProps {
  module: any;
  isLocked: boolean;
  isCompleted: boolean;
  progress: number;
  defaultOpen?: boolean;
  moduleStatus: string;
  isRtl: boolean;
  t: (key: string) => string;
}

function ModuleItem({
  module,
  isLocked,
  isCompleted,
  progress,
  defaultOpen,
  moduleStatus,
  isRtl,
  t,
}: ModuleItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ModuleIcon =
    (typeof module.icon === "string" && EMOJI_ICONS[module.icon]) || BookOpen;

  const statusColors: Record<
    string,
    { border: string; bg: string; dot: string; label: string }
  > = {
    LOCKED: {
      border: "border-gray-200 dark:border-slate-800",
      bg: "bg-gray-50/50 dark:bg-slate-800/60",
      dot: "bg-gray-300",
      label: t("path.modules.status.locked"),
    },
    AVAILABLE: {
      border: "border-blue-200",
      bg: "bg-blue-50/30",
      dot: "bg-blue-500",
      label: t("path.modules.status.available"),
    },
    IN_PROGRESS: {
      border: "border-amber-200",
      bg: "bg-amber-50/30",
      dot: "bg-amber-500",
      label: t("path.modules.status.inProgress"),
    },
    COMPLETED: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/30",
      dot: "bg-emerald-500",
      label: t("path.modules.status.completed"),
    },
  };
  const sc = statusColors[moduleStatus] || statusColors.LOCKED;
  const totalLessons = module.lessons?.length || module.total_lessons || 0;
  const completedLessons =
    module.lessons?.filter((l: any) => l.isCompleted).length || 0;
  const duration =
    module.duration || module.duration_minutes || module.durationMinutes;
  const formattedDuration = duration
    ? `${Math.floor(duration / 60)}h ${duration % 60}m`
    : null;
  const instructor = module.instructor;
  const hasAccess = !isLocked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`rounded-2xl border-2 overflow-hidden transition-all ${sc.border} ${sc.bg} bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm`}
    >
      <button
        onClick={() => !isLocked && setOpen(!open)}
        className={`w-full flex items-center justify-between p-5 sm:p-6 text-start ${isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-black/[0.02]"} transition-colors`}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 ${isCompleted ? "bg-emerald-100 dark:bg-emerald-900/50" : isLocked ? "bg-gray-100 dark:bg-slate-800" : "bg-blue-100 dark:bg-blue-900/50"}`}
          >
            {isCompleted ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : isLocked ? (
              <Lock className="w-5 h-5 text-gray-400" />
            ) : (
              <ModuleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 truncate">
                {module.title}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${sc.dot.replace("bg-", "bg-").replace("500", "100")} ${sc.dot.replace("bg-", "text-").replace("-500", "-700")}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
            </div>
            {module.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {module.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {formattedDuration && (
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formattedDuration}
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {totalLessons} {t("path.labels.lessons")}
              </span>
              {module.rating && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {module.rating.toFixed(1)}
                </span>
              )}
              {instructor && (
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {instructor.fullName}
                </span>
              )}
              {module.skills?.slice(0, 2).map((s: string) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ltr:ml-4 rtl:mr-4">
          {progress > 0 && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-black text-gray-900 dark:text-slate-100 tabular-nums">
                {Math.round(progress)}
                <span className="text-[10px] font-bold opacity-40">%</span>
              </span>
            </div>
          )}
          {!isLocked && (
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>

      {/* Progress bar */}
      {!isLocked && (
        <div className="px-5 sm:px-6 pb-1">
          <div className="w-full h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && !isLocked && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200/60 dark:border-slate-800/80 divide-y divide-gray-100">
              {/* Lessons list */}
              {module.lessons?.length > 0 && (
                <div>
                  {module.lessons.map((lesson: any, idx: number) => {
                    const LessonIcon = typeIcons[lesson.type] || FileText;
                    const isLessonLocked = lesson.isLocked ?? false;
                    const isLessonCompleted = lesson.isCompleted ?? false;
                    return (
                      <div
                        key={lesson.id || idx}
                        className={`flex items-center gap-4 px-6 py-4 ${isLessonLocked ? "opacity-50" : "hover:bg-gray-50/50 dark:hover:bg-slate-800/60"} transition-colors`}
                      >
                        <div
                          className={`p-2 rounded-lg flex-shrink-0 ${isLessonCompleted ? "bg-emerald-100 dark:bg-emerald-900/50" : isLessonLocked ? "bg-gray-100 dark:bg-slate-800" : "bg-gray-50 dark:bg-slate-900/60"}`}
                        >
                          {isLessonCompleted ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : isLessonLocked ? (
                            <Lock className="w-4 h-4 text-gray-300" />
                          ) : (
                            <LessonIcon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          )}
                        </div>
                        <span
                          className={`flex-1 text-sm font-medium ${isLessonLocked ? "text-gray-400" : "text-gray-700 dark:text-slate-300"}`}
                        >
                          {lesson.title}
                        </span>
                        {lesson.durationMinutes && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {lesson.durationMinutes}
                            {t("path.modules.minutes")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Go to Course CTA */}
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
                <Link
                  href={`/learn/courses/${module.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:scale-105 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t("path.modules.actions.viewCourse")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface PathCurriculumProps {
  modules: any[];
  moduleProgress: Record<string, any>;
  completedModules: string[];
  isEnrolled: boolean;
  isRtl: boolean;
  t: (key: string) => string;
}

export default function PathCurriculum({
  modules,
  moduleProgress,
  completedModules,
  isEnrolled,
  isRtl,
  t,
}: PathCurriculumProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {t("path.modules.curriculum")}
          </h2>
          {isEnrolled && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {completedModules.length}/{modules.length}{" "}
              {t("path.labels.modules")}
              {completedModules.length === modules.length &&
                modules.length > 0 &&
                " ✓"}
            </p>
          )}
        </div>
        <span className="text-sm bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-gray-500 dark:text-slate-400 font-bold">
          {modules.length} {t("path.labels.modules")}
        </span>
      </div>
      {modules.map((mod: any, idx: number) => {
        const isLocked =
          !isEnrolled ||
          (idx > 0 &&
            completedModules.indexOf(modules[idx - 1]?.id || "") === -1 &&
            !isEnrolled);
        const mp = moduleProgress?.[mod.id];
        const isCompleted = completedModules?.includes(mod.id);
        const status = isCompleted
          ? "COMPLETED"
          : isLocked
            ? "LOCKED"
            : mp?.progress > 0
              ? "IN_PROGRESS"
              : "AVAILABLE";
        return (
          <ModuleItem
            key={mod.id}
            module={mod}
            isLocked={isLocked}
            isCompleted={isCompleted}
            progress={mp?.progress || 0}
            defaultOpen={idx === 0 && !isLocked}
            moduleStatus={status}
            isRtl={isRtl}
            t={t}
          />
        );
      })}
      {!isEnrolled && (
        <div className="text-center py-12 text-gray-400 text-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
          {t("path.modules.enrollToAccess")}
        </div>
      )}
    </div>
  );
}
