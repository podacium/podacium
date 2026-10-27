"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { educationApi, type InstructorModuleItem } from "@/lib/api/education";
import { ModuleStatusBadge } from "@/components/course/ModuleStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  BookOpen,
  Users,
  AlertCircle,
  Send,
  Loader2,
  FileEdit,
  Clock,
  CheckCircle2,
  Home,
  ChevronRight,
  Library,
  Archive,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";

type StatusFilter = "ALL" | "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export default function InstructorManagePage() {
  const t = useTranslations("learn.instructor.manage");
  const { dir } = useBidi();
  const { user, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<InstructorModuleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const pageSize = 20;

  const fetchModules = useCallback(
    async (currentPage: number, filter: StatusFilter) => {
      setLoading(true);
      try {
        const params: any = { page: currentPage, page_size: pageSize };
        if (filter !== "ALL") params.status = filter;
        const res = await educationApi.getMyDrafts(params);
        setModules(res.items);
        setTotal(res.total);
      } catch {
        toast.error(t("loadFail"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchModules(page, statusFilter);
  }, [page, statusFilter, fetchModules]);

  const handleSubmitForReview = async (moduleId: string) => {
    setSubmitting(moduleId);
    try {
      await educationApi.submitForReview(moduleId);
      toast.success(t("submitSuccess"));
      fetchModules(page, statusFilter);
    } catch (err: any) {
      toast.error(err?.message || t("submitFail"));
    } finally {
      setSubmitting(null);
    }
  };

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusTabs: { id: StatusFilter; label: string; icon: any }[] = [
    { id: "ALL", label: t("allModules"), icon: Library },
    { id: "DRAFT", label: t("statuses.draft"), icon: FileEdit },
    { id: "IN_REVIEW", label: t("statuses.inReview"), icon: Clock },
    { id: "PUBLISHED", label: t("statuses.published"), icon: CheckCircle2 },
    { id: "ARCHIVED", label: t("statuses.archived"), icon: Archive },
  ];

  const archivedCount = modules.filter((m) => m.status === "ARCHIVED").length;

  if (authLoading) {
    return <LoadingState text={t("loading")} />;
  }

  if (!user || !["INSTRUCTOR", "ADMIN"].includes(user.role)) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-10 h-10" />}
        title={t("instructorDenied")}
      />
    );
  }

  if (loading && modules.length === 0) {
    return <LoadingState text={t("loading")} />;
  }

  return (
    <div className="space-y-8" dir={dir}>
      <div>
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
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("title")}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <Library className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              {t("title")}
            </h1>
            <p className="text-base text-gray-500 dark:text-slate-400 max-w-2xl">
              {t("subtitle")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link href="/learn/create/module">
              <PodaciumButton className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t("createModule")}
              </PodaciumButton>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            icon={<Library className="w-6 h-6" />}
            label={t("allModules")}
            value={String(total)}
            gradient="from-blue-600 to-blue-400"
            delay={0.1}
            onClick={() => handleFilterChange("ALL")}
            className={statusFilter === "ALL" ? "ring-2 ring-blue-500/30" : ""}
          />
          <StatCard
            icon={<FileEdit className="w-6 h-6" />}
            label={t("statuses.draft")}
            value={String(modules.filter((m) => m.status === "DRAFT").length)}
            gradient="from-amber-600 to-orange-400"
            delay={0.2}
            onClick={() => handleFilterChange("DRAFT")}
            className={
              statusFilter === "DRAFT" ? "ring-2 ring-amber-500/30" : ""
            }
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label={t("statuses.inReview")}
            value={String(
              modules.filter((m) => m.status === "IN_REVIEW").length,
            )}
            gradient="from-purple-600 to-pink-400"
            delay={0.3}
            onClick={() => handleFilterChange("IN_REVIEW")}
            className={
              statusFilter === "IN_REVIEW" ? "ring-2 ring-purple-500/30" : ""
            }
          />
          <StatCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            label={t("statuses.published")}
            value={String(
              modules.filter((m) => m.status === "PUBLISHED").length,
            )}
            gradient="from-emerald-600 to-teal-400"
            delay={0.4}
            onClick={() => handleFilterChange("PUBLISHED")}
            className={
              statusFilter === "PUBLISHED" ? "ring-2 ring-emerald-500/30" : ""
            }
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {statusTabs.map((tab) => {
            const count =
              tab.id === "ALL"
                ? total
                : tab.id === "DRAFT"
                  ? modules.filter((m) => m.status === "DRAFT").length
                  : tab.id === "IN_REVIEW"
                    ? modules.filter((m) => m.status === "IN_REVIEW").length
                    : tab.id === "PUBLISHED"
                      ? modules.filter((m) => m.status === "PUBLISHED").length
                      : archivedCount;
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                  statusFilter === tab.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-gray-200 dark:border-slate-800"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      statusFilter === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <SectionCard padding="sm">
          {modules.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-10 h-10" />}
              title={
                statusFilter === "ALL" ? t("noModules") : t("noModulesFilter")
              }
              description={
                statusFilter === "ALL" ? t("noModulesDesc") : undefined
              }
              action={
                statusFilter === "ALL" ? (
                  <Link href="/learn/create/module">
                    <PodaciumButton className="mt-4 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> {t("createModule")}
                    </PodaciumButton>
                  </Link>
                ) : (
                  <PodaciumButton
                    variant="outline"
                    onClick={() => handleFilterChange("ALL")}
                  >
                    {t("viewAllModules")}
                  </PodaciumButton>
                )
              }
            />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800/80">
              <AnimatePresence mode="popLayout">
                {modules.map((mod, idx) => (
                  <motion.div
                    key={mod.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-start justify-between p-5 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/learn/manage/${mod.id}`}
                          className="text-base font-semibold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                        >
                          {mod.title}
                        </Link>
                        <ModuleStatusBadge status={mod.status} />
                      </div>
                      {mod.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 line-clamp-1">
                          {mod.description}
                        </p>
                      )}
                      {mod.rejectionReason && mod.status === "DRAFT" && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/60 p-3 text-sm text-red-700 dark:text-red-300">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>
                            <strong>{t("feedback.label")}</strong>{" "}
                            {mod.rejectionReason}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {mod.lessonCount}{" "}
                          {mod.lessonCount !== 1
                            ? t("lessonsPlural", {
                                count: String(mod.lessonCount),
                              })
                            : t("lessons", { count: String(mod.lessonCount) })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {mod.enrollmentCount}{" "}
                          {t("enrolled", {
                            count: String(mod.enrollmentCount),
                          })}
                        </span>
                        {mod.level && (
                          <PodaciumBadge variant="outline">
                            {mod.level}
                          </PodaciumBadge>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                      {mod.status === "DRAFT" && (
                        <PodaciumButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleSubmitForReview(mod.id)}
                          disabled={
                            submitting === mod.id || mod.lessonCount === 0
                          }
                          className="flex items-center gap-1.5"
                          title={
                            mod.lessonCount === 0
                              ? t("submitDisabled")
                              : t("submitForReview")
                          }
                        >
                          {submitting === mod.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {t("submitForReview")}
                        </PodaciumButton>
                      )}
                      {mod.status === "IN_REVIEW" && (
                        <PodaciumBadge variant="warning">
                          {t("awaitingReview")}
                        </PodaciumBadge>
                      )}
                      <Link
                        href={`/learn/manage/${mod.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                        {t("edit")}
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("pagination.page", {
                  current: String(page),
                  total: String(totalPages),
                })}
              </p>
              <div className="flex items-center gap-2">
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t("pagination.previous")}
                </PodaciumButton>
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  {t("pagination.next")}
                </PodaciumButton>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
