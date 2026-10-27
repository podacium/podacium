"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, InvitationResponse } from "@/lib/api";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import {
  Mail,
  UserPlus,
  RefreshCw,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  Send,
  X,
} from "lucide-react";

interface PendingInvitationsProps {
  organizationId: number;
  canManage: boolean;
}

interface ConfirmModalState {
  isOpen: boolean;
  type: "cancel" | "resend" | null;
  token: string;
  email: string;
}

export default function PendingInvitations({
  organizationId,
  canManage,
}: PendingInvitationsProps) {
  const t = useTranslations();
  const { dir } = useBidi();
  const locale = useLocale();
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{
    [key: string]: "cancel" | "resend" | null;
  }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: null,
    token: "",
    email: "",
  });

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listOrganizationInvitations(organizationId);
      setInvitations(data);
    } catch (err: any) {
      setError(err.message || t("bi.organizations.members.error.generic"));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const openConfirmModal = (
    type: "cancel" | "resend",
    token: string,
    email: string,
  ) => {
    setConfirmModal({ isOpen: true, type, token, email });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, token: "", email: "" });
  };

  const handleConfirmedAction = async () => {
    const { type, token, email } = confirmModal;
    closeConfirmModal();

    if (type === "cancel") {
      try {
        setActionLoading((prev) => ({ ...prev, [token]: "cancel" }));
        await api.cancelInvitation(token);
        setSuccessMessage(t("bi.organizations.members.success.cancelled"));
        setInvitations((prev) => prev.filter((inv) => inv.token !== token));
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setError(
          err.message || t("bi.organizations.members.error.cancelFailed"),
        );
      } finally {
        setActionLoading((prev) => ({ ...prev, [token]: null }));
      }
    } else if (type === "resend") {
      try {
        setActionLoading((prev) => ({ ...prev, [token]: "resend" }));
        await api.resendInvitation(token);
        setSuccessMessage(t("bi.organizations.members.success.resent"));
        await fetchInvitations();
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setError(
          err.message || t("bi.organizations.members.error.resendFailed"),
        );
      } finally {
        setActionLoading((prev) => ({ ...prev, [token]: null }));
      }
    }
  };

  const formatExpiryDate = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return t("bi.organizations.members.list.expired");
    return t("bi.organizations.members.list.expiresIn", {
      days: String(diffDays),
    });
  };

  const formatInvitedDate = (createdAt: string) => {
    const date = new Date(createdAt);
    return t("bi.organizations.members.list.invitedOn", {
      date: date.toLocaleDateString(locale),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (invitations.length === 0 && !canManage) {
    return null;
  }

  return (
    <>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeConfirmModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    confirmModal.type === "cancel"
                      ? "bg-red-50 dark:bg-red-950/60"
                      : "bg-blue-50 dark:bg-blue-950/60"
                  }`}
                >
                  {confirmModal.type === "cancel" ? (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <button
                  onClick={closeConfirmModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {confirmModal.type === "cancel"
                  ? t("bi.organizations.members.actions.cancel")
                  : t("bi.organizations.members.actions.resend")}
              </h3>
              <p className="text-gray-500 dark:text-slate-400 mb-6">
                {confirmModal.type === "cancel"
                  ? t("bi.organizations.members.actions.cancelConfirm")
                  : t("bi.organizations.members.actions.resendConfirm", {
                      email: confirmModal.email,
                    })}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={closeConfirmModal}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  {t("bi.organizations.members.actions.modalCancel")}
                </button>
                <button
                  onClick={handleConfirmedAction}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    confirmModal.type === "cancel"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {confirmModal.type === "cancel" ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {t("bi.organizations.members.actions.modalConfirm")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 border-t border-gray-200 dark:border-slate-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
              {t("bi.organizations.members.list.title")}
            </h4>
            {invitations.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                {invitations.length}
              </span>
            )}
          </div>
          <button
            onClick={fetchInvitations}
            className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
            title={t("bi.datasets.detail.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Success/Error Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">{successMessage}</span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {error}
              </span>
              <button
                onClick={() => setError(null)}
                className="ms-auto text-red-400 hover:text-red-600 dark:text-red-400"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {invitations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <Mail className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>{t("bi.organizations.members.list.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <motion.div
                key={invitation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-blue-200 dark:border-blue-800/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">
                        {invitation.email}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full capitalize">
                          {t(
                            `bi.organizations.roles.${invitation.role.toLowerCase()}`,
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiryDate(invitation.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <button
                        onClick={() =>
                          openConfirmModal(
                            "resend",
                            invitation.token!,
                            invitation.email,
                          )
                        }
                        disabled={!!actionLoading[invitation.token!]}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading[invitation.token!] === "resend" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {actionLoading[invitation.token!] === "resend"
                          ? t("bi.organizations.members.actions.resending")
                          : t("bi.organizations.members.actions.resend")}
                      </button>
                      <button
                        onClick={() =>
                          openConfirmModal(
                            "cancel",
                            invitation.token!,
                            invitation.email,
                          )
                        }
                        disabled={!!actionLoading[invitation.token!]}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading[invitation.token!] === "cancel" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {actionLoading[invitation.token!] === "cancel"
                          ? t("bi.organizations.members.actions.cancelling")
                          : t("bi.organizations.members.actions.cancel")}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
