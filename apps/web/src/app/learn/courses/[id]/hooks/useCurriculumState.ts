import { useState, useEffect, useCallback, useMemo } from "react";
import {
  apiHelpers,
  LessonResponse,
  EnrollmentResponse,
  LessonProgressResponse,
} from "@/lib/api";
import { LessonStatus } from "../types";

export const useCurriculumState = (
  lessons: LessonResponse[],
  enrollment: EnrollmentResponse | null,
  lessonProgress: Record<string, LessonProgressResponse>,
) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonResponse | null>(null);

  // P0-7: Pre-compute all lesson statuses into a stable map so that
  // getLessonStatus (used as a prop on every LessonCard) returns the same
  // reference for lessons whose status didn't change. Combined with
  // React.memo on LessonCard, this prevents a full 50+ card re-render on
  // every progress tick — only the cards whose status actually changed
  // will re-render.
  const lessonStatusMap = useMemo<Record<string, LessonStatus>>(() => {
    const map: Record<string, LessonStatus> = {};
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const progress = lessonProgress[lesson.id];

      if (progress?.progress === 100 || progress?.isCompleted) {
        map[lesson.id] = LessonStatus.COMPLETED;
        continue;
      }

      if (enrollment) {
        if (i === 0) {
          map[lesson.id] = LessonStatus.AVAILABLE;
          continue;
        }

        const previousLesson = lessons[i - 1];
        const previousProgress = lessonProgress[previousLesson.id];
        const isPreviousCompleted =
          previousProgress?.progress === 100 || previousProgress?.isCompleted;

        if (isPreviousCompleted) {
          map[lesson.id] = LessonStatus.AVAILABLE;
          continue;
        }

        if (progress && progress.progress > 0) {
          map[lesson.id] = LessonStatus.IN_PROGRESS;
          continue;
        }

        map[lesson.id] = LessonStatus.LOCKED;
      } else {
        const isPreview =
          i === 0 || Boolean(lesson.isPreview || (lesson as any).is_preview);
        map[lesson.id] = isPreview
          ? LessonStatus.AVAILABLE
          : LessonStatus.LOCKED;
      }
    }
    return map;
  }, [lessons, enrollment, lessonProgress]);

  const getLessonStatus = useCallback(
    (lessonId: string): LessonStatus =>
      lessonStatusMap[lessonId] ?? LessonStatus.LOCKED,
    [lessonStatusMap],
  );

  const getLessonProgress = useCallback(
    (lessonId: string): number => {
      const progress = lessonProgress[lessonId];
      return progress?.progress || 0;
    },
    [lessonProgress],
  );

  const overallProgress = useMemo(() => {
    if (lessons.length === 0) return 0;

    let totalProgress = 0;
    lessons.forEach((lesson) => {
      const progress = lessonProgress[lesson.id];
      totalProgress += progress?.progress || 0;
    });

    return Math.round(totalProgress / lessons.length);
  }, [lessons, lessonProgress]);

  const toggleModuleExpansion = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const handleLessonSelect = useCallback(
    async (lessonId: string) => {
      const status = getLessonStatus(lessonId);
      if (status === LessonStatus.LOCKED) return;

      setActiveLessonId(lessonId);

      try {
        const lessonData = await apiHelpers.education.getLesson(lessonId);
        setActiveLesson(lessonData);

        setTimeout(() => {
          const activeLessonElement = document.getElementById("active-lesson");
          if (activeLessonElement) {
            activeLessonElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);
      } catch (error: any) {
        console.error("Error fetching lesson:", error);
      }
    },
    [getLessonStatus],
  );

  // Auto-select appropriate lesson on initial load
  useEffect(() => {
    if (lessons.length > 0 && !activeLessonId) {
      let defaultLessonId = lessons[0]?.id || null;

      if (enrollment) {
        for (const lesson of lessons) {
          const progress = lessonProgress[lesson.id];
          if (!progress || progress.progress < 100) {
            defaultLessonId = lesson.id;
            break;
          }
        }
      }

      if (defaultLessonId) {
        setActiveLessonId(defaultLessonId);

        const lessonExists = lessons.some((l) => l.id === defaultLessonId);
        if (lessonExists) {
          const loadLessonData = async () => {
            try {
              const lessonData = await apiHelpers.education.getLesson(
                defaultLessonId!,
              );
              setActiveLesson(lessonData);
            } catch (error) {
              console.error("Error loading default lesson:", error);
            }
          };
          loadLessonData();
        }
      }
    }
  }, [lessons, activeLessonId, enrollment, lessonProgress]);

  return {
    expandedModules,
    activeLessonId,
    activeLesson,
    overallProgress,
    getLessonStatus,
    getLessonProgress,
    getNextLessonId: useCallback(
      (currentLessonId: string) => {
        const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
        if (currentIndex === -1 || currentIndex >= lessons.length - 1)
          return null;
        return lessons[currentIndex + 1]?.id || null;
      },
      [lessons],
    ),
    getPreviousLessonId: useCallback(
      (currentLessonId: string) => {
        const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
        if (currentIndex <= 0) return null;
        return lessons[currentIndex - 1]?.id || null;
      },
      [lessons],
    ),
    toggleModuleExpansion,
    handleLessonSelect,
  };
};
