"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { educationApi } from "@/lib/api/education";
import { api } from "@/lib/api";
import { useTranslations, useBidi } from "@/lib/i18n";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Send,
  Loader2,
  FileText,
  Video,
  HelpCircle,
  Home,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Save,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Film,
  Edit3,
  Sparkles,
  DollarSign,
  Layers,
  ExternalLink,
  Image as ImageIcon,
  Clock,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SectionCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { LessonEditorSheet } from "@/components/course/LessonEditorSheet";
import { BulkVideoUploader } from "@/components/course/BulkVideoUploader";

const statusMap: Record<string, string> = {
  DRAFT: "draft",
  IN_REVIEW: "inReview",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

function getModulePrice(price: any): number {
  if (typeof price === "number") return isNaN(price) ? 0 : price;
  if (typeof price === "object" && price !== null) {
    const val = price.amount ?? price.dzd ?? 0;
    return typeof val === "number" && !isNaN(val) ? val : Number(val) || 0;
  }
  const parsed = Number(price);
  return isNaN(parsed) ? 0 : parsed;
}

function SortableLessonItem({
  lesson,
  index,
  totalLessons,
  moveLesson,
  onOpenEditor,
  onTogglePreview,
  onDelete,
  t,
}: {
  lesson: any;
  index: number;
  totalLessons: number;
  moveLesson: (index: number, direction: "up" | "down") => void;
  onOpenEditor: (lessonId: string, tab: "content" | "meta" | "quiz") => void;
  onTogglePreview: (lessonId: string, currentVal: boolean) => void;
  onDelete: (lessonId: string) => void;
  t: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border ${
        isDragging
          ? "border-blue-500 shadow-xl ring-2 ring-blue-500/20 opacity-40"
          : "border-gray-200/50 dark:border-slate-800/50 shadow-sm"
      } p-3.5 hover:shadow-md transition-all group`}
    >
      {/* Drag Handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 rounded cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors touch-none"
        title={t("curriculum.dragToReorder")}
        aria-label={t("curriculum.dragToReorder")}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Order Controls */}
      <div className="flex flex-col items-center gap-0.5 text-gray-400">
        <button
          type="button"
          onClick={() => moveLesson(index, "up")}
          disabled={index === 0}
          className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-mono w-4 text-center">
          {lesson.order ?? index + 1}
        </span>
        <button
          type="button"
          onClick={() => moveLesson(index, "down")}
          disabled={index === totalLessons - 1}
          className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lesson Content Preview / Trigger Drawer */}
      <div
        onClick={() => onOpenEditor(lesson.id, "content")}
        className="flex-1 min-w-0 cursor-pointer flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-950/60 flex items-center justify-center flex-shrink-0">
          {lesson.type === "video" ? (
            <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {lesson.title}
            </p>

            {/* Free Preview Toggle Pill */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview(lesson.id, lesson.isPreview);
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                lesson.isPreview
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "border-gray-200 dark:border-slate-800 text-gray-400 hover:text-emerald-500 hover:border-emerald-500/30"
              }`}
              title={
                lesson.isPreview
                  ? t("preview.disablePreviewTooltip")
                  : t("preview.enablePreviewTooltip")
              }
            >
              <Eye className="w-3 h-3" />
              {lesson.isPreview ? t("preview.badge") : t("preview.setPreview")}
            </button>

            {lesson.quizId && (
              <PodaciumBadge
                variant="gradient"
                className="text-[10px] px-1.5 py-0 flex items-center gap-1 cursor-pointer"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onOpenEditor(lesson.id, "quiz");
                }}
                title={t("moduleDetail.editQuiz")}
              >
                <HelpCircle className="w-2.5 h-2.5" />
                {t("lessonSheet.quizTab")}
              </PodaciumBadge>
            )}

            {lesson.type === "video" && (
              <>
                {lesson.transcodingStatus === "processing" && (
                  <PodaciumBadge
                    variant="warning"
                    className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                  >
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    {t("moduleDetail.transcodingStatus.processing")}
                  </PodaciumBadge>
                )}
                {(lesson.transcodingStatus === "ready" ||
                  lesson.transcodingStatus === "completed") && (
                  <PodaciumBadge
                    variant="success"
                    className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {t("moduleDetail.transcodingStatus.ready")}
                  </PodaciumBadge>
                )}
                {lesson.transcodingStatus === "failed" && (
                  <PodaciumBadge
                    variant="destructive"
                    className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {t("moduleDetail.transcodingStatus.failed")}
                  </PodaciumBadge>
                )}
                {lesson.storageProvider && (
                  <PodaciumBadge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 uppercase"
                  >
                    {lesson.storageProvider}
                  </PodaciumBadge>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            <span>{lesson.type}</span>
            {lesson.durationMinutes && (
              <>
                <span>•</span>
                <span>{lesson.durationMinutes} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenEditor(lesson.id, "quiz")}
          className={`p-1.5 rounded-lg transition-colors ${
            lesson.quizId
              ? "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60"
              : "text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60"
          }`}
          title={
            lesson.quizId
              ? t("moduleDetail.editQuiz")
              : t("moduleDetail.addQuiz")
          }
        >
          <HelpCircle size={15} />
        </button>
        <button
          type="button"
          onClick={() => onOpenEditor(lesson.id, "content")}
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={t("lessonSheet.editInDrawer")}
        >
          <Edit3 size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(lesson.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
          title={t("moduleDetail.deleteLesson")}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function ModuleManageInner({ moduleId: propModuleId }: { moduleId?: string }) {
  const t = useTranslations("learn.instructor");
  const { dir } = useBidi();
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const moduleId =
    (typeof propModuleId === "string" && propModuleId ? propModuleId : "") ||
    (routeParams?.id as string) ||
    searchParams.get("id") ||
    "";
  const backTo = searchParams.get("back") || "/learn/manage";

  const [module, setModule] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "lessons" | "quiz">(
    "details",
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // New in-place curriculum builder states
  const [editorSheetOpen, setEditorSheetOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editorSheetInitialTab, setEditorSheetInitialTab] = useState<
    "content" | "meta" | "quiz"
  >("content");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [addingQuick, setAddingQuick] = useState(false);

  // DND and Autosave States
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "saved" | "saving" | "unsaved"
  >("saved");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // BeforeUnload dirty state guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autosaveStatus === "saving" || autosaveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autosaveStatus]);

  // Course Details Studio States
  const [previewTab, setPreviewTab] = useState<"card" | "hero">("card");
  const [fullDescTab, setFullDescTab] = useState<"write" | "preview">("write");

  const fetchModule = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    try {
      const [mod, lessonData] = await Promise.all([
        api.get<any>(`/api/education/modules/${moduleId}`),
        api.get<any[]>(`/api/education/modules/${moduleId}/lessons`),
      ]);
      setModule(mod);
      setLessons(
        (lessonData || []).sort(
          (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
        ),
      );
    } catch (err: any) {
      toast.error(err?.message || t("moduleDetail.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const handleSubmitForReview = async () => {
    if (!moduleId) return;
    if (lessons.length === 0) {
      setShowSubmitModal(true);
      return;
    }
    setSubmitting(true);
    try {
      await educationApi.submitForReview(moduleId);
      toast.success(t("manage.submitSuccess"));
      setModule((m: any) => (m ? { ...m, status: "IN_REVIEW" } : m));
      fetchModule();
    } catch (err: any) {
      toast.error(err?.message || t("manage.submitFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/api/education/lessons/${deleteConfirm}`);
      setLessons((prev) => prev.filter((l: any) => l.id !== deleteConfirm));
      toast.success(t("moduleDetail.lessonDeleted"));
      await fetchModule(); // Refresh module duration & lesson count
    } catch {
      toast.error(t("moduleDetail.lessonDeletedFail"));
    } finally {
      setDeleteConfirm(null);
    }
  };

  const moveLesson = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;
    const previousLessons = [...lessons];
    const reordered = arrayMove(lessons, index, newIndex).map((l, idx) => ({
      ...l,
      order: idx + 1,
    }));
    setLessons(reordered);
    setAutosaveStatus("saving");
    try {
      await educationApi.reorderLessons(
        moduleId,
        reordered.map((l: any, i: number) => ({
          lessonId: l.id,
          order: i + 1,
        })),
      );
      setAutosaveStatus("saved");
    } catch {
      setLessons(previousLessons);
      setAutosaveStatus("unsaved");
      toast.error(t("moduleDetail.reorderFail"));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousLessons = [...lessons];
    const reordered = arrayMove(lessons, oldIndex, newIndex).map((l, idx) => ({
      ...l,
      order: idx + 1,
    }));
    setLessons(reordered);
    setAutosaveStatus("saving");
    try {
      await educationApi.reorderLessons(
        moduleId,
        reordered.map((l: any, i: number) => ({
          lessonId: l.id,
          order: i + 1,
        })),
      );
      setAutosaveStatus("saved");
    } catch {
      setLessons(previousLessons);
      setAutosaveStatus("unsaved");
      toast.error(t("moduleDetail.reorderFail"));
    }
  };

  const saveOrder = async () => {
    if (!moduleId) return;
    setSavingOrder(true);
    setAutosaveStatus("saving");
    try {
      await educationApi.reorderLessons(
        moduleId,
        lessons.map((l: any, i: number) => ({ lessonId: l.id, order: i + 1 })),
      );
      setAutosaveStatus("saved");
      toast.success(t("moduleDetail.reorderSaved"));
      await fetchModule();
    } catch {
      setAutosaveStatus("unsaved");
      toast.error(t("moduleDetail.reorderFail"));
    } finally {
      setSavingOrder(false);
    }
  };

  const saveModuleDetails = async () => {
    if (!moduleId || !module) return;
    setSavingDetails(true);
    try {
      const priceNum = getModulePrice(module.price);
      await api.put(`/api/education/modules/${moduleId}`, {
        title: module.title,
        description: module.description,
        fullDescription: module.fullDescription,
        level: module.level || "BEGINNER",
        price: {
          amount: priceNum,
          currency: "DZD",
          dzd: priceNum,
        },
        thumbnailUrl: module.thumbnailUrl || null,
      });
      toast.success(t("create.saveSuccess"));
      await fetchModule();
    } catch {
      toast.error(t("create.saveFail"));
    } finally {
      setSavingDetails(false);
    }
  };

  const handleQuickAddLesson = async () => {
    if (!quickTitle.trim() || !moduleId) return;
    setAddingQuick(true);
    try {
      await api.post(`/api/education/modules/${moduleId}/lessons`, {
        title: quickTitle.trim(),
        description: `Lesson ${lessons.length + 1}: ${quickTitle.trim()}`,
        module_id: moduleId,
        order: lessons.length + 1,
        type: "video",
      });
      setQuickTitle("");
      toast.success(t("lessonSheet.draftCreated"));
      await fetchModule();
    } catch (e: any) {
      toast.error(e?.message || t("lessonSheet.addLessonFail"));
    } finally {
      setAddingQuick(false);
    }
  };

  const toggleLessonPreview = async (lessonId: string, currentVal: boolean) => {
    try {
      await api.put(`/api/education/lessons/${lessonId}`, {
        is_preview: !currentVal,
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId ? { ...l, isPreview: !currentVal } : l,
        ),
      );
      toast.success(
        !currentVal ? t("preview.markedSuccess") : t("preview.disabledSuccess"),
      );
    } catch {
      toast.error(t("preview.updateFail"));
    }
  };

  const tabs = [
    {
      id: "details" as const,
      label: t("lessonEditor.details"),
      icon: FileText,
    },
    {
      id: "lessons" as const,
      label: t("moduleDetail.lessonsList"),
      icon: BookOpen,
    },
    { id: "quiz" as const, label: t("lessonEditor.quiz"), icon: HelpCircle },
  ];

  const statusVariant =
    module?.status === "PUBLISHED"
      ? "success"
      : module?.status === "IN_REVIEW"
        ? "warning"
        : module?.status === "ARCHIVED"
          ? "default"
          : "outline";

  if (!moduleId) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-24 pb-16 px-4">
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title={t("moduleDetail.noModule")}
            action={
              <Link href={backTo}>
                <PodaciumButton
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft
                    className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                  />
                  {t("moduleDetail.backToManage")}
                </PodaciumButton>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-24 pb-16 px-4">
          <LoadingState text={t("loading")} />
        </main>
      </div>
    );
  }

  if (!module) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pt-24 pb-16 px-4">
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title={t("moduleDetail.notFound")}
            action={
              <Link href={backTo}>
                <PodaciumButton
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft
                    className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                  />
                  {t("moduleDetail.backToManage")}
                </PodaciumButton>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <PodaciumModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t("moduleDetail.confirmDeleteLesson")}
        size="sm"
      >
        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/60 rounded-xl mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            {t("moduleDetail.deleteWarning")}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <PodaciumButton
            variant="outline"
            onClick={() => setDeleteConfirm(null)}
          >
            {t("manage.cancel")}
          </PodaciumButton>
          <PodaciumButton
            variant="destructive"
            onClick={handleDeleteLesson}
            className="flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> {t("moduleDetail.deleteLesson")}
          </PodaciumButton>
        </div>
      </PodaciumModal>

      <PodaciumModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t("manage.submitDisabled")}
        size="sm"
      >
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t("manage.submitDisabledDesc")}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <PodaciumButton
            variant="outline"
            onClick={() => setShowSubmitModal(false)}
          >
            {t("manage.cancel")}
          </PodaciumButton>
          <Link href={`/learn/create/lesson?module=${moduleId}`}>
            <PodaciumButton className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              {t("moduleDetail.addLesson")}
            </PodaciumButton>
          </Link>
        </div>
      </PodaciumModal>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>{t("manage.breadcrumb.home")}</span>
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <Link
            href="/learn"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t("manage.breadcrumb.learn")}
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <Link
            href={backTo}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t("manage.title")}
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium truncate max-w-[200px]">
            {module.title}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <Link
              href={backTo}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft
                size={20}
                className={dir === "rtl" ? "rotate-180" : ""}
              />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
                {module.title}
                <PodaciumBadge variant={statusVariant}>
                  {t(`manage.statuses.${statusMap[module.status] || "draft"}`)}
                </PodaciumBadge>
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {t("moduleDetail.subtitle", { count: String(lessons.length) })}
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            {module.status === "DRAFT" && (
              <PodaciumButton
                onClick={handleSubmitForReview}
                disabled={submitting}
                className="flex items-center gap-1.5"
                title={
                  lessons.length === 0
                    ? t("manage.submitDisabled")
                    : t("manage.submitForReview")
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting
                  ? t("manage.submitting")
                  : t("manage.submitForReview")}
              </PodaciumButton>
            )}
            <Link href={backTo}>
              <PodaciumButton
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft
                  className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                />
                {t("moduleDetail.backToManage")}
              </PodaciumButton>
            </Link>
          </motion.div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25" : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-gray-200 dark:border-slate-800"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left Column: Form Cards */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Headline / Course Title */}
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PodaciumBadge variant="gradient">
                        {t("details.badgeHeadline")}
                      </PodaciumBadge>
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                        {t("details.primaryIdentifier")}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-medium ${
                        (module.title || "").length > 60
                          ? "text-amber-500 font-bold"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    >
                      {(module.title || "").length} / 60 {t("details.chars")}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("details.titleHelp")}
                  </p>

                  <input
                    type="text"
                    value={module.title || ""}
                    onChange={(e) =>
                      setModule((m: any) => ({ ...m, title: e.target.value }))
                    }
                    placeholder={t("details.titlePlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm font-semibold text-gray-900 dark:text-slate-100"
                  />
                </div>

                {/* 2. Short Description / The Hook */}
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PodaciumBadge variant="secondary">
                        {t("details.badgeHook")}
                      </PodaciumBadge>
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                        {t("details.cardSnippet")}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-medium ${
                        (module.description || "").length > 160
                          ? "text-amber-500 font-bold"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    >
                      {(module.description || "").length} / 160{" "}
                      {t("details.chars")}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("details.shortDescHelp")}
                  </p>

                  <textarea
                    rows={3}
                    value={module.description || ""}
                    onChange={(e) =>
                      setModule((m: any) => ({
                        ...m,
                        description: e.target.value,
                      }))
                    }
                    placeholder={t("details.shortDescPlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm text-gray-800 dark:text-slate-200 resize-none leading-relaxed"
                  />
                </div>

                {/* 3. Full Description / Syllabus Markdown */}
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PodaciumBadge variant="outline">
                        {t("details.badgeSyllabus")}
                      </PodaciumBadge>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setFullDescTab("write")}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          fullDescTab === "write"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                        }`}
                      >
                        {t("details.writeMarkdown")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFullDescTab("preview")}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          fullDescTab === "preview"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                        }`}
                      >
                        {t("details.previewMarkdown")}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("details.fullDescHelp")}
                  </p>

                  {fullDescTab === "write" ? (
                    <textarea
                      value={(module as any)?.fullDescription || ""}
                      onChange={(e) =>
                        setModule((m: any) => ({
                          ...m,
                          fullDescription: e.target.value,
                        }))
                      }
                      rows={8}
                      placeholder={t("details.fullDescPlaceholder")}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm font-mono text-gray-800 dark:text-slate-200 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="w-full min-h-[160px] p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/40 text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {(module as any)?.fullDescription ? (
                        (module as any).fullDescription
                      ) : (
                        <span className="italic text-gray-400">
                          {t("details.emptyMarkdownPreview")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Pricing, Difficulty & Category */}
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-slate-200">
                      {t("details.courseAttributes")}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Level */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                        {t("details.difficultyLevel")}
                      </label>
                      <select
                        value={module.level || "BEGINNER"}
                        onChange={(e) =>
                          setModule((m: any) => ({
                            ...m,
                            level: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-gray-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="BEGINNER">{t("levels.beginner")}</option>
                        <option value="INTERMEDIATE">
                          {t("levels.intermediate")}
                        </option>
                        <option value="ADVANCED">{t("levels.advanced")}</option>
                        <option value="ALL_LEVELS">
                          {t("levels.allLevels")}
                        </option>
                      </select>
                    </div>

                    {/* Price in DZD */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                          {t("details.priceLabel")}
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-blue-600 dark:text-blue-400">
                          <input
                            type="checkbox"
                            checked={getModulePrice(module?.price) === 0}
                            onChange={(e) =>
                              setModule((m: any) => ({
                                ...m,
                                price: e.target.checked ? 0 : 3500,
                              }))
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{t("details.freeCourseCheckbox")}</span>
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          disabled={getModulePrice(module?.price) === 0}
                          value={getModulePrice(module?.price)}
                          onChange={(e) =>
                            setModule((m: any) => ({
                              ...m,
                              price: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                        />
                        <span className="absolute end-3 top-2 text-xs font-semibold text-gray-400">
                          DZD
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Course Thumbnail / Cover Media */}
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-slate-200">
                      {t("details.coverImageTitle")}
                    </h4>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("details.coverImageHelp")}
                  </p>

                  <input
                    type="url"
                    value={module.thumbnailUrl || ""}
                    onChange={(e) =>
                      setModule((m: any) => ({
                        ...m,
                        thumbnailUrl: e.target.value,
                      }))
                    }
                    placeholder="https://images.unsplash.com/... or cloud storage URL"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-gray-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <PodaciumButton
                    onClick={saveModuleDetails}
                    disabled={savingDetails}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 shadow-md shadow-blue-500/10"
                  >
                    {savingDetails ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{t("create.save")}</span>
                  </PodaciumButton>
                </div>
              </div>

              {/* Right Column: Sticky Live Previews */}
              <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
                <div className="flex items-center justify-between p-2 rounded-2xl bg-gray-100 dark:bg-slate-800/70 border border-gray-200/60 dark:border-slate-700/50">
                  <div className="flex items-center gap-1.5 ps-2">
                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-gray-900 dark:text-slate-200">
                      {t("details.livePreviewHeading")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("card")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        previewTab === "card"
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                      }`}
                    >
                      {t("details.previewCardTab")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("hero")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        previewTab === "hero"
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                      }`}
                    >
                      {t("details.previewHeroTab")}
                    </button>
                  </div>
                </div>

                {previewTab === "card" ? (
                  /* Catalog Card Simulation */
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-lg transition-all">
                    <div className="relative aspect-video w-full bg-gradient-to-tr from-blue-900 via-indigo-900 to-slate-900 flex items-center justify-center overflow-hidden">
                      {module.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={module.thumbnailUrl}
                          alt={module.title || "Course"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <BookOpen className="w-10 h-10 text-blue-400 mx-auto mb-2 opacity-60" />
                          <span className="text-[11px] font-mono text-blue-200/80">
                            {t("details.courseCoverRatio")}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-3 start-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10 uppercase tracking-wide">
                          {module.level || "Beginner"}
                        </span>
                      </div>
                      <div className="absolute bottom-3 end-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-600/90 backdrop-blur-md text-white">
                          {lessons.length} {t("moduleDetail.lessons")}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {t("details.headlineField")}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 line-clamp-2 mt-0.5">
                          {module.title || t("details.previewEmptyTitle")}
                        </h4>
                      </div>

                      <div className="border-t border-gray-100 dark:border-slate-800/80 pt-2">
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">
                          {t("details.theHookField")}
                        </span>
                        <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-3 mt-0.5 leading-relaxed">
                          {module.description || t("details.previewEmptyDesc")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {Math.round(
                              lessons.reduce(
                                (acc, l) =>
                                  acc +
                                  (l.durationSeconds ||
                                    l.duration_minutes * 60 ||
                                    0),
                                0,
                              ) / 60,
                            )}{" "}
                            mins
                          </span>
                        </div>

                        <div className="text-xs font-black text-gray-900 dark:text-slate-100">
                          {getModulePrice(module?.price) === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {t("details.free")}
                            </span>
                          ) : (
                            <span>
                              {getModulePrice(module?.price).toLocaleString()}{" "}
                              DZD
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Sales Page Hero Simulation */
                  <div className="rounded-2xl border border-gray-800 bg-slate-950 p-6 text-white space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 text-[10px] text-blue-400 font-mono">
                      <span>PODACIUM</span>
                      <span>/</span>
                      <span>{t("details.curriculum")}</span>
                      <span>/</span>
                      <span>{module.level || "BEGINNER"}</span>
                    </div>

                    <h3 className="text-lg font-black tracking-tight text-white leading-snug">
                      {module.title || t("details.previewEmptyTitle")}
                    </h3>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {module.description || t("details.previewEmptyDesc")}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-xs text-blue-300">
                          P
                        </div>
                        <span className="text-xs text-slate-300 font-medium">
                          {t("details.instructorPreview")}
                        </span>
                      </div>

                      <div className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20">
                        {getModulePrice(module?.price) === 0
                          ? t("details.enrollFree")
                          : `${getModulePrice(module?.price).toLocaleString()} DZD`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "lessons" && (
            <motion.div
              key="lessons"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/60 dark:border-slate-800/60 rounded-2xl p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    {t("moduleDetail.lessonsList")} ({lessons.length})
                  </h3>
                  {lessons.length > 0 && (
                    <PodaciumBadge
                      variant={
                        lessons.some((l: any) => l.isPreview)
                          ? "success"
                          : "secondary"
                      }
                      className="text-[11px] px-2.5 py-0.5 flex items-center gap-1.5 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t("preview.badge")}:{" "}
                      {lessons.filter((l: any) => l.isPreview).length}{" "}
                      {t("curriculum.lessons")} (
                      {lessons
                        .filter((l: any) => l.isPreview)
                        .reduce(
                          (acc: number, l: any) =>
                            acc + (l.durationMinutes || 0),
                          0,
                        )}
                      m)
                    </PodaciumBadge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Autosave Status Indicator */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white/70 dark:bg-slate-900/70 border-gray-200 dark:border-slate-800">
                    {autosaveStatus === "saved" && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {t("curriculum.autosaveSaved")}
                        </span>
                      </>
                    )}
                    {autosaveStatus === "saving" && (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                        <span className="text-blue-700 dark:text-blue-400">
                          {t("curriculum.autosaveSaving")}
                        </span>
                      </>
                    )}
                    {autosaveStatus === "unsaved" && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-700 dark:text-amber-400">
                          {t("curriculum.autosaveUnsaved")}
                        </span>
                      </>
                    )}
                  </div>

                  {lessons.length > 1 && (
                    <PodaciumButton
                      variant="outline"
                      size="sm"
                      onClick={saveOrder}
                      disabled={savingOrder}
                      className="flex items-center gap-1.5 text-xs py-1.5"
                    >
                      {savingOrder ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {savingOrder
                        ? t("moduleDetail.savingOrder")
                        : t("moduleDetail.reorderSaveLabel")}
                    </PodaciumButton>
                  )}

                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className="flex items-center gap-1.5 text-xs py-1.5"
                  >
                    <Film className="h-3.5 w-3.5 text-indigo-500" />
                    {showBulkUpload
                      ? t("bulkUpload.hide")
                      : t("bulkUpload.startBatch")}
                  </PodaciumButton>

                  <PodaciumButton
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setEditingLessonId(null);
                      setEditorSheetInitialTab("content");
                      setEditorSheetOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs py-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("moduleDetail.addLesson")}
                  </PodaciumButton>
                </div>
              </div>

              {/* Bulk Video Uploader Dropzone */}
              {showBulkUpload && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <BulkVideoUploader
                    moduleId={moduleId}
                    existingLessonCount={lessons.length}
                    onLessonsCreated={fetchModule}
                  />
                </motion.div>
              )}

              {/* Inline Quick Add Lesson Row */}
              <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 border border-gray-200/50 dark:border-slate-800/50 rounded-xl p-2.5">
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (e.preventDefault(), handleQuickAddLesson())
                  }
                  placeholder={t("lessonSheet.titlePlaceholder")}
                  className="flex-1 px-3 py-1.5 bg-transparent text-xs text-gray-800 dark:text-slate-200 outline-none"
                />
                <PodaciumButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuickAddLesson}
                  disabled={addingQuick || !quickTitle.trim()}
                  className="text-xs py-1 px-3 flex items-center gap-1"
                >
                  {addingQuick ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  {t("common.add")}
                </PodaciumButton>
              </div>

              {lessons.length === 0 ? (
                <SectionCard>
                  <EmptyState
                    icon={<BookOpen className="w-10 h-10" />}
                    title={t("moduleDetail.noLessons")}
                    description={t("moduleDetail.noLessonsDesc")}
                    action={
                      <PodaciumButton
                        onClick={() => {
                          setEditingLessonId(null);
                          setEditorSheetOpen(true);
                        }}
                        className="mt-4 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {t("moduleDetail.addLesson")}
                      </PodaciumButton>
                    }
                  />
                </SectionCard>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={lessons.map((l: any) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {lessons.map((lesson: any, index: number) => (
                        <SortableLessonItem
                          key={lesson.id}
                          lesson={lesson}
                          index={index}
                          totalLessons={lessons.length}
                          moveLesson={moveLesson}
                          onOpenEditor={(lessonId, tab) => {
                            setEditingLessonId(lessonId);
                            setEditorSheetInitialTab(tab);
                            setEditorSheetOpen(true);
                          }}
                          onTogglePreview={toggleLessonPreview}
                          onDelete={(lessonId) => setDeleteConfirm(lessonId)}
                          t={t}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeDragId
                      ? (() => {
                          const dragItem = lessons.find(
                            (l) => l.id === activeDragId,
                          );
                          if (!dragItem) return null;
                          return (
                            <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xl p-3.5 opacity-90 scale-[1.02] pointer-events-none">
                              <GripVertical className="w-4 h-4 text-blue-500" />
                              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                                {dragItem.type === "video" ? (
                                  <Video className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <FileText className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                                  {dragItem.title}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {dragItem.type}
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      : null}
                  </DragOverlay>
                </DndContext>
              )}
            </motion.div>
          )}

          {activeTab === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t("lessonEditor.quiz")}
                </h3>
              </div>

              {lessons.length === 0 ? (
                <SectionCard>
                  <EmptyState
                    icon={<BookOpen className="w-10 h-10" />}
                    title={t("moduleDetail.quizRequiresLessons")}
                    description={t("moduleDetail.quizRequiresLessonsDesc")}
                    action={
                      <Link href={`/learn/create/lesson?module=${moduleId}`}>
                        <PodaciumButton className="mt-4 flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          {t("moduleDetail.addLesson")}
                        </PodaciumButton>
                      </Link>
                    }
                  />
                </SectionCard>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {t("moduleDetail.quizSelectLesson")}
                  </p>
                  {lessons.map((lesson: any) => (
                    <motion.div
                      key={lesson.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {lesson.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {lesson.quizId
                              ? t("moduleDetail.quizExists")
                              : t("moduleDetail.quizNone")}
                          </p>
                        </div>
                      </div>
                      <PodaciumButton
                        variant={lesson.quizId ? "outline" : "primary"}
                        size="sm"
                        className="flex items-center gap-1.5"
                        onClick={() => {
                          setEditingLessonId(lesson.id);
                          setEditorSheetInitialTab("quiz");
                          setEditorSheetOpen(true);
                        }}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {lesson.quizId
                          ? t("moduleDetail.editQuiz")
                          : t("moduleDetail.addQuiz")}
                      </PodaciumButton>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* In-Place Slide-Over Lesson Editor Drawer */}
        <LessonEditorSheet
          isOpen={editorSheetOpen}
          onClose={() => {
            setEditorSheetOpen(false);
            setEditingLessonId(null);
            setEditorSheetInitialTab("content");
          }}
          moduleId={moduleId}
          lessonId={editingLessonId}
          onSaved={() => {
            fetchModule();
          }}
          initialOrder={lessons.length + 1}
          initialTab={editorSheetInitialTab}
        />
      </main>
    </div>
  );
}

export default function ModuleManagePageWrapper({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="pt-24 flex justify-center">
            <LoadingState />
          </div>
        </div>
      }
    >
      <ModuleManageInner moduleId={params.id} />
    </Suspense>
  );
}
