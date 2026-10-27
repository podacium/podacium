"use client";

import { useState, useEffect, useCallback } from "react";
import { educationApi, type PendingReviewItem } from "@/lib/api/education";
import { ModuleStatusBadge } from "@/components/course/ModuleStatusBadge";
import { useTranslations, useLocale } from "@/lib/i18n";
import { toast } from "sonner";
import { CheckCircle, XCircle, BookOpen, Clock, User } from "lucide-react";

export default function ContentReviewPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await educationApi.getPendingReview({ page, page_size: 20 });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error(t("admin.contentReview.loadFail"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (moduleId: string) => {
    setActionLoading(moduleId);
    try {
      await educationApi.approveModule(moduleId);
      toast.success(t("admin.contentReview.approveSuccess"));
      fetchPending();
    } catch {
      toast.error(t("admin.contentReview.approveFail"));
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (moduleId: string) => {
    setRejectTarget(moduleId);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget || rejectReason.length < 10) {
      toast.error(t("admin.contentReview.rejectModal.reasonError"));
      return;
    }
    setActionLoading(rejectTarget);
    try {
      await educationApi.rejectModule(rejectTarget, rejectReason);
      toast.success(t("admin.contentReview.rejectSuccess"));
      setRejectModalOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      fetchPending();
    } catch {
      toast.error(t("admin.contentReview.rejectFail"));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(
      locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US",
      { year: "numeric", month: "short", day: "numeric" },
    );
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {t("admin.contentReview.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {total !== 1
              ? t("admin.contentReview.subtitlePlural", {
                  count: String(total),
                })
              : t("admin.contentReview.subtitle", { count: String(total) })}
          </p>
        </div>
        <ModuleStatusBadge status="IN_REVIEW" />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 dark:border-slate-800 border-t-blue-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-700 p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-slate-100">
            {t("admin.contentReview.emptyTitle")}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            {t("admin.contentReview.emptyDescription")}
          </p>
        </div>
      )}

      {/* Module list */}
      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-slate-400">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                    {item.instructorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {item.instructorName}
                      </span>
                    )}
                    {item.level && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {item.level}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {item.lessonCount !== 1
                        ? t("admin.contentReview.lessonsPlural", {
                            count: String(item.lessonCount),
                          })
                        : t("admin.contentReview.lessons", {
                            count: String(item.lessonCount),
                          })}
                    </span>
                    {item.submittedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t("admin.contentReview.submitted", {
                          date: formatDate(item.submittedAt),
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="ms-4 flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={actionLoading === item.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                    aria-label={`${t("admin.contentReview.approve")} ${item.title}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t("admin.contentReview.approve")}
                  </button>
                  <button
                    onClick={() => openRejectModal(item.id)}
                    disabled={actionLoading === item.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/60 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 shadow-sm hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-50"
                    aria-label={`${t("admin.contentReview.reject")} ${item.title}`}
                  >
                    <XCircle className="h-4 w-4" />
                    {t("admin.contentReview.reject")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            {t("admin.contentReview.pagination.previous")}
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-400">
            {t("admin.contentReview.pagination.page", {
              current: String(page),
              total: String(totalPages),
            })}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            {t("admin.contentReview.pagination.next")}
          </button>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {t("admin.contentReview.rejectModal.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {t("admin.contentReview.rejectModal.description")}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("admin.contentReview.rejectModal.placeholder")}
              className="mt-4 w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              rows={4}
              aria-label={t("admin.contentReview.rejectModal.title")}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                {t("admin.contentReview.rejectModal.cancel")}
              </button>
              <button
                onClick={handleReject}
                disabled={rejectReason.length < 10 || actionLoading !== null}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t("admin.contentReview.rejectModal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
