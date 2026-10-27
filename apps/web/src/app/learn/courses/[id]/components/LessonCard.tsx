import React, { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Clock, Lock, Play } from "lucide-react";
import { LessonResponse } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { getLessonIcon, formatDuration } from "../utils";
import ProgressBar from "./ProgressBar";

interface LessonCardProps {
  lesson: LessonResponse;
  isActive: boolean;
  isCompleted: boolean;
  isLocked: boolean;
  progress: number;
  onClick: () => void;
  showDetails?: boolean;
}

// P0-7: Wrapped in React.memo with a custom comparator so LessonCard only
// re-renders when its own props actually change. Without this, every
// `lessonProgress` state update (fired every 10 s) caused ALL 50+ lesson
// cards in the sidebar to re-render simultaneously, producing a 2-3 s freeze
// on mobile during playback. The comparator checks each prop by value/reference
// so stable callbacks passed via useCallback are correctly treated as equal.
const LessonCard: React.FC<LessonCardProps> = memo(
  ({
    lesson,
    isActive,
    isCompleted,
    isLocked,
    progress,
    onClick,
    showDetails = true,
  }) => {
    const t = useTranslations();

    const stateConfig = useMemo(() => {
      if (isLocked)
        return {
          container:
            "bg-gray-50/50 dark:bg-slate-800/60 border-gray-100 dark:border-slate-800 cursor-not-allowed opacity-60",
          icon: "bg-gray-100 dark:bg-slate-800 text-gray-400",
          title: "text-gray-400",
          desc: "text-gray-400",
          indicator: "hidden",
          shadow: "shadow-none",
        };
      if (isActive)
        return {
          container:
            "bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/10 cursor-pointer",
          icon: "bg-blue-600 text-white shadow-lg shadow-blue-200",
          title: "text-blue-900 font-black",
          desc: "text-blue-700/70",
          indicator: "block",
          shadow: "shadow-xl shadow-blue-900/5",
        };
      if (isCompleted)
        return {
          container:
            "bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 cursor-pointer",
          icon: "bg-emerald-500 text-white",
          title: "text-emerald-900",
          desc: "text-emerald-700/60",
          indicator: "hidden",
          shadow: "hover:shadow-lg hover:shadow-emerald-900/5",
        };
      return {
        container:
          "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-indigo-200 cursor-pointer",
        icon: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white",
        title: "text-gray-900 dark:text-slate-100 font-bold",
        desc: "text-gray-500 dark:text-slate-400",
        indicator: "hidden",
        shadow: "hover:shadow-xl hover:shadow-indigo-900/5",
      };
    }, [isActive, isCompleted, isLocked]);

    return (
      <motion.button
        whileHover={!isLocked ? { scale: 1.005, x: isActive ? 0 : 4 } : {}}
        whileTap={!isLocked ? { scale: 0.995 } : {}}
        onClick={onClick}
        disabled={isLocked}
        className={`group relative w-full text-start p-5 rounded-3xl transition-all duration-300 border-2 ${stateConfig.container} ${stateConfig.shadow}`}
      >
        <div className="flex items-start gap-4">
          {/* State Indicator Beam */}
          {isActive && (
            <motion.div
              layoutId="active-lesson-beam"
              className="absolute start-0 top-1/4 bottom-1/4 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 ltr:rounded-r-full rtl:rounded-l-full"
            />
          )}

          <div
            className={`p-3 rounded-2xl transition-all duration-500 ${stateConfig.icon}`}
          >
            {getLessonIcon(lesson.type, isCompleted, isLocked)}
          </div>

          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h4
                  className={`text-base leading-tight mb-1 truncate ${stateConfig.title}`}
                >
                  {lesson.title}
                </h4>
                {showDetails && lesson.description && (
                  <p
                    className={`text-xs leading-relaxed line-clamp-1 ${stateConfig.desc}`}
                  >
                    {lesson.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                {(lesson.isPreview || (lesson as any).is_preview) && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-xs">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    {t("learn.preview.badge")}
                  </span>
                )}
                {lesson.durationMinutes && lesson.durationMinutes > 0 && (
                  <span className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                    <Clock className="w-3 h-3 me-1 opacity-70" />
                    {formatDuration(lesson.durationMinutes)}
                  </span>
                )}
                {isLocked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
              </div>
            </div>

            {!isLocked && (
              <div className="flex items-center gap-4 mt-3">
                <div className="flex-1">
                  <ProgressBar
                    value={progress}
                    size="sm"
                    color={isCompleted ? "green" : isActive ? "blue" : "indigo"}
                    showLabel={false}
                    animated={false}
                  />
                </div>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap"
                  >
                    {t("course.lessons.active")}
                  </motion.span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.button>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparator: only re-render if one of these changes.
    // P0-7: without this, every lessonProgress update (every 10 s during
    // playback) triggers all 50+ LessonCards to re-render simultaneously.
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.isCompleted === nextProps.isCompleted &&
      prevProps.isLocked === nextProps.isLocked &&
      prevProps.progress === nextProps.progress &&
      prevProps.lesson.id === nextProps.lesson.id &&
      prevProps.lesson.title === nextProps.lesson.title &&
      (prevProps.lesson.isPreview || (prevProps.lesson as any).is_preview) ===
        (nextProps.lesson.isPreview || (nextProps.lesson as any).is_preview) &&
      prevProps.showDetails === nextProps.showDetails &&
      prevProps.onClick === nextProps.onClick
    );
  },
);

LessonCard.displayName = "LessonCard";

export default LessonCard;
