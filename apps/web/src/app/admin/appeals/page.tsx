"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole, api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Check,
  X,
  Search,
  Loader2,
  ExternalLink,
  FileText,
  AlertTriangle,
  GraduationCap,
  Wallet,
  MessageSquare,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PodaciumButton,
  PodaciumBadge,
  PodaciumCard,
  PodaciumSelect,
  PodaciumConfirmDialog,
} from "@/components/design-system";
import { toast } from "sonner";

export type AppealTargetType =
  "REVIEW" | "COURSE_REJECTION" | "ACCOUNT_BAN" | "WALLET_FREEZE";

export interface AppealRecord {
  id: number;
  targetType: AppealTargetType;
  targetId: string;
  reviewId?: number;
  appealerId: number;
  appealerName: string;
  appealerEmail?: string;
  authorName?: string;
  reason: string;
  evidenceUrls: string[];
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "ACCEPTED" | "REJECTED";
  resolutionNotes?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
}

const targetTypeConfig: Record<
  AppealTargetType,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "outline"
      | "success"
      | "warning"
      | "destructive";
    icon: any;
  }
> = {
  REVIEW: {
    label: "Review Dispute",
    variant: "secondary",
    icon: MessageSquare,
  },
  COURSE_REJECTION: {
    label: "Course Rejection",
    variant: "warning",
    icon: GraduationCap,
  },
  ACCOUNT_BAN: {
    label: "Account Ban / Suspension",
    variant: "destructive",
    icon: AlertTriangle,
  },
  WALLET_FREEZE: {
    label: "Wallet Freeze",
    variant: "outline",
    icon: Wallet,
  },
};

export default function AdminAppealsPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [targetTypeFilter, setTargetTypeFilter] = useState("ALL");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // Evidence Modal State
  const [previewEvidence, setPreviewEvidence] = useState<{
    isOpen: boolean;
    appealId: number | null;
    urls: string[];
  }>({
    isOpen: false,
    appealId: null,
    urls: [],
  });

  // Dialog State
  const [resolveDialogState, setResolveDialogState] = useState<{
    isOpen: boolean;
    appealId: number | null;
    targetType: AppealTargetType;
    targetStatus: "ACCEPTED" | "REJECTED" | "";
  }>({
    isOpen: false,
    appealId: null,
    targetType: "REVIEW",
    targetStatus: "",
  });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== UserRole.ADMIN)) {
      router.push("/hub");
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (targetTypeFilter !== "ALL")
        params.set("target_type", targetTypeFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res: any = await api.get(`/api/admin/appeals${qs}`);
      setAppeals(Array.isArray(res) ? res : []);
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message || t("admin.appeals.loadError", "Failed to load appeals."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchAppeals();
    }
  }, [user, statusFilter, targetTypeFilter]);

  const handleOpenResolveDialog = (
    id: number,
    targetType: AppealTargetType,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    setResolveDialogState({
      isOpen: true,
      appealId: id,
      targetType,
      targetStatus: status,
    });
  };

  const handleConfirmResolve = async (notes?: string) => {
    if (!resolveDialogState.appealId || !resolveDialogState.targetStatus)
      return;

    setResolvingId(resolveDialogState.appealId);
    try {
      await api.patch(
        `/api/admin/appeals/${resolveDialogState.appealId}/resolve`,
        {
          status: resolveDialogState.targetStatus,
          resolutionNotes: notes || "",
          resolution_notes: notes || "",
        },
      );
      toast.success(
        t("admin.appeals.resolveSuccess", "Appeal resolved successfully"),
      );
      setResolveDialogState({
        isOpen: false,
        appealId: null,
        targetType: "REVIEW",
        targetStatus: "",
      });
      fetchAppeals();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message ||
          t("admin.appeals.resolveError", "Failed to resolve appeal."),
      );
    } finally {
      setResolvingId(null);
    }
  };

  if (authLoading || (user?.role !== UserRole.ADMIN && loading)) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-slate-100">
            <ShieldAlert className="w-8 h-8 text-orange-500" />
            {t("admin.appeals.title", "Appeals & Dispute Resolution")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t(
              "admin.appeals.subtitle",
              "Review and resolve platform appeals across reviews, course rejections, account bans, and wallet freezes.",
            )}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
          >
            <option value="ALL">
              {t("admin.appeals.allCategories", "All Categories")}
            </option>
            <option value="REVIEW">
              {t("admin.appeals.categories.review", "Reviews")}
            </option>
            <option value="COURSE_REJECTION">
              {t(
                "admin.appeals.categories.courseRejection",
                "Course Rejections",
              )}
            </option>
            <option value="ACCOUNT_BAN">
              {t("admin.appeals.categories.accountBan", "Account Bans")}
            </option>
            <option value="WALLET_FREEZE">
              {t("admin.appeals.categories.walletFreeze", "Wallet Freezes")}
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
          >
            <option value="ALL">
              {t("admin.appeals.filterAll", "All Statuses")}
            </option>
            <option value="PENDING">
              {t("admin.appeals.filterPending", "Pending")}
            </option>
            <option value="ACCEPTED">
              {t("admin.appeals.filterApproved", "Accepted / Approved")}
            </option>
            <option value="REJECTED">
              {t("admin.appeals.filterRejected", "Rejected")}
            </option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : appeals.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800"
        >
          <ShieldAlert className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
            {t("admin.appeals.empty", "No appeals found")}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              "admin.appeals.emptyFiltered",
              "No appeals match the selected category and status filters.",
            )}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {appeals.map((appeal) => {
              const target =
                targetTypeConfig[appeal.targetType] || targetTypeConfig.REVIEW;
              const TargetIcon = target.icon;
              const isPending =
                appeal.status === "PENDING" || appeal.status === "UNDER_REVIEW";

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={appeal.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <PodaciumBadge
                          variant={target.variant}
                          className="flex items-center gap-1.5"
                        >
                          <TargetIcon className="w-3.5 h-3.5" />
                          {target.label}
                        </PodaciumBadge>
                        <span className="text-xs font-mono text-gray-400">
                          {t("admin.appeals.id", "ID")}: #{appeal.targetId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                        <span className="font-semibold">
                          {t("admin.appeals.appealer", "Appealer")}:
                        </span>{" "}
                        {appeal.appealerName}
                        {appeal.authorName && (
                          <>
                            <span className="text-gray-400 mx-1">|</span>
                            <span className="font-semibold">
                              {t("admin.appeals.reviewAuthor", "Review Author")}
                              :
                            </span>{" "}
                            {appeal.authorName}
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {t("admin.appeals.submittedOn", "Submitted on")}:{" "}
                        {new Date(appeal.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          appeal.status === "PENDING"
                            ? "bg-orange-100 dark:bg-amber-950/60 text-orange-800 dark:text-amber-300"
                            : appeal.status === "ACCEPTED" ||
                                appeal.status === "APPROVED"
                              ? "bg-green-100 dark:bg-emerald-950/60 text-green-800 dark:text-emerald-300"
                              : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300"
                        }`}
                      >
                        {appeal.status}
                      </span>
                    </div>
                  </div>

                  {/* Reason statement */}
                  <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-xl mb-4 border border-gray-100 dark:border-slate-800">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1.5">
                      {t("admin.appeals.reason", "Reason & Justification")}:
                    </h4>
                    <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {appeal.reason}
                    </p>
                  </div>

                  {/* Evidence attachment pill */}
                  {appeal.evidenceUrls && appeal.evidenceUrls.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <PodaciumButton
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPreviewEvidence({
                            isOpen: true,
                            appealId: appeal.id,
                            urls: appeal.evidenceUrls,
                          })
                        }
                        className="text-xs flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        {t("admin.appeals.viewEvidence", "View Evidence")} (
                        {appeal.evidenceUrls.length}{" "}
                        {t("admin.appeals.attachment", "Attachment")})
                      </PodaciumButton>
                    </div>
                  )}

                  {/* Resolution Notes Display */}
                  {appeal.resolutionNotes && (
                    <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 p-4 rounded-xl mb-4 border border-blue-100 dark:border-blue-900/50">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-xs uppercase tracking-wider">
                          {t(
                            "admin.appeals.resolutionNotes",
                            "Resolution Notes",
                          )}
                          :
                        </h4>
                        {appeal.resolvedByName && (
                          <span className="text-xs opacity-75">
                            {t("admin.appeals.resolvedBy", "Resolved by")}{" "}
                            {appeal.resolvedByName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{appeal.resolutionNotes}</p>
                    </div>
                  )}

                  {/* Pending Decision Buttons */}
                  {isPending && (
                    <div className="flex gap-3 justify-end border-t border-gray-100 dark:border-slate-800 pt-4">
                      <PodaciumButton
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          handleOpenResolveDialog(
                            appeal.id,
                            appeal.targetType,
                            "REJECTED",
                          )
                        }
                        disabled={resolvingId === appeal.id}
                        icon={<X className="w-4 h-4" />}
                      >
                        {t("admin.appeals.reject", "Reject")}
                      </PodaciumButton>
                      <PodaciumButton
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          handleOpenResolveDialog(
                            appeal.id,
                            appeal.targetType,
                            "ACCEPTED",
                          )
                        }
                        disabled={resolvingId === appeal.id}
                        icon={<Check className="w-4 h-4" />}
                      >
                        {t("admin.appeals.approve", "Accept Appeal")}
                      </PodaciumButton>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Evidence Preview Modal */}
      {previewEvidence.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                {t("admin.appeals.submittedEvidence")} (
                {t("admin.appeals.appeal")} #{previewEvidence.appealId})
              </h3>
              <button
                onClick={() =>
                  setPreviewEvidence({
                    isOpen: false,
                    appealId: null,
                    urls: [],
                  })
                }
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {previewEvidence.urls.map((url, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50"
                >
                  <span className="text-xs font-mono truncate max-w-md text-gray-700 dark:text-slate-300">
                    {url}
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0"
                  >
                    {t("admin.appeals.openDocument")}{" "}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() =>
                  setPreviewEvidence({
                    isOpen: false,
                    appealId: null,
                    urls: [],
                  })
                }
              >
                {t("admin.appeals.close")}
              </PodaciumButton>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Confirmation Dialog */}
      <PodaciumConfirmDialog
        isOpen={resolveDialogState.isOpen}
        onClose={() =>
          setResolveDialogState({
            isOpen: false,
            appealId: null,
            targetType: "REVIEW",
            targetStatus: "",
          })
        }
        onConfirm={handleConfirmResolve}
        title={
          resolveDialogState.targetStatus === "ACCEPTED"
            ? t("admin.appeals.approveTitle")
            : t("admin.appeals.rejectTitle")
        }
        description={
          resolveDialogState.targetStatus === "ACCEPTED"
            ? t("admin.appeals.approveDesc")
            : t("admin.appeals.rejectDesc")
        }
        variant={
          resolveDialogState.targetStatus === "ACCEPTED" ? "info" : "danger"
        }
        confirmText={
          resolveDialogState.targetStatus === "ACCEPTED"
            ? t("admin.appeals.confirmApprove")
            : t("admin.appeals.confirmReject")
        }
        promptConfig={{
          label: t("admin.appeals.resolutionNotesLabel"),
          placeholder: t("admin.appeals.resolutionNotesPlaceholder"),
          multiline: true,
          required: false,
        }}
        isLoading={resolvingId !== null}
      />
    </div>
  );
}
