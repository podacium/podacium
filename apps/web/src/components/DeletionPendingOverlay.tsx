"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Trash2,
  LogOut,
} from "lucide-react";

const DELETION_PENDING_COOKIE = "deletion_pending";

interface DeletionStatus {
  has_pending_request: boolean;
  id?: number;
  status?: string;
  scheduled_for?: string;
  requested_at?: string;
  days_remaining?: number;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale.replace("_", "-"), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "success" | "warning" | "error";
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export default function DeletionPendingOverlay() {
  const t = useTranslations("user");
  const { dir } = useBidi();
  const { isAuthenticated, logout } = useAuth();
  const locale = t.i18n.language || "en";

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const checkDone = useRef(false);

  const checkStatus = useCallback(async () => {
    const cookie = getCookie(DELETION_PENDING_COOKIE);

    // Fast path: if we have a recent cookie AND are authenticated, show immediately
    // while we fetch details from the API in the background.
    const showOptimistic = cookie === "1";

    try {
      const data = await apiClient.get<DeletionStatus>(
        "/api/users/me/delete-request",
      );
      if (data?.has_pending_request) {
        setStatus(data);
        if (typeof document !== "undefined") {
          document.cookie = `${DELETION_PENDING_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        }
        setVisible(true);
      } else {
        clearCookie(DELETION_PENDING_COOKIE);
        setVisible(false);
      }
    } catch {
      // API unreachable (CORS, network, etc.)
      if (showOptimistic) {
        // Cookie says pending — trust it and show with estimated dates
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        setStatus({
          has_pending_request: true,
          days_remaining: 30,
          requested_at: now.toISOString(),
          scheduled_for: future.toISOString(),
        });
        setVisible(true);
      } else {
        // No cookie and API failed — nothing to show
        setVisible(false);
      }
    } finally {
      setLoading(false);
      checkDone.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    checkStatus();
  }, [checkStatus, isAuthenticated]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiClient.delete("/api/users/me/delete-request");
      clearCookie(DELETION_PENDING_COOKIE);
      setCancelled(true);
      setTimeout(() => {
        setVisible(false);
        window.location.reload();
      }, 2000);
    } catch {
      setCancelling(false);
    }
  };

  if (cancelled) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            dir={dir}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full mx-4 p-8 text-center"
            >
              <div className="w-20 h-20 mx-auto mb-5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("settings.dataPrivacy.deletion.overlay.cancelled.title")}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                {t("settings.dataPrivacy.deletion.overlay.cancelled.message")}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (!visible || loading) return null;

  const daysRemaining = status?.days_remaining ?? 0;
  const pct = Math.max(
    0,
    Math.min(100, Math.round((daysRemaining / 30) * 100)),
  );
  const barColor =
    daysRemaining > 20
      ? "bg-emerald-500"
      : daysRemaining > 10
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          dir={dir}
          style={{ overflow: "auto" }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deletion-overlay-title"
          >
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-950/60 px-8 py-6 border-b border-red-100 dark:border-red-900/50 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2
                id="deletion-overlay-title"
                className="text-2xl font-bold text-gray-900 dark:text-slate-100"
              >
                {t("settings.dataPrivacy.deletion.overlay.title")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                {t("settings.dataPrivacy.deletion.overlay.subtitle")}
              </p>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-5">
              {/* Status info */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-200 dark:border-amber-800/80">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      {t("settings.dataPrivacy.deletion.overlay.status")}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                      {status?.scheduled_for
                        ? t(
                            "settings.dataPrivacy.deletion.overlay.scheduledDate",
                            {
                              date: formatDate(status.scheduled_for, locale),
                            },
                          )
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress + days remaining */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("settings.dataPrivacy.deletion.overlay.daysRemaining", {
                      n: String(daysRemaining),
                    })}
                  </span>
                  <StatusBadge
                    variant={
                      daysRemaining > 20
                        ? "success"
                        : daysRemaining > 10
                          ? "warning"
                          : "error"
                    }
                  >
                    {daysRemaining > 20
                      ? t("settings.dataPrivacy.deletion.overlay.statusGood")
                      : daysRemaining > 10
                        ? t(
                            "settings.dataPrivacy.deletion.overlay.statusWarning",
                          )
                        : t(
                            "settings.dataPrivacy.deletion.overlay.statusCritical",
                          )}
                  </StatusBadge>
                </div>
                <div
                  className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-3"
                  role="progressbar"
                  aria-valuenow={daysRemaining}
                  aria-valuemin={0}
                  aria-valuemax={30}
                >
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mt-1.5">
                  <span>
                    {status?.requested_at
                      ? t(
                          "settings.dataPrivacy.deletion.overlay.requestedDate",
                          {
                            date: formatDate(status.requested_at, locale),
                          },
                        )
                      : ""}
                  </span>
                  <span>
                    {status?.scheduled_for
                      ? t(
                          "settings.dataPrivacy.deletion.overlay.deletionDate",
                          {
                            date: formatDate(status.scheduled_for, locale),
                          },
                        )
                      : ""}
                  </span>
                </div>
              </div>

              {/* What this means */}
              <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2 text-sm">
                  {t("settings.dataPrivacy.deletion.overlay.whatHappens.title")}
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <span>
                      {t(
                        "settings.dataPrivacy.deletion.overlay.whatHappens.line1",
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <span>
                      {t(
                        "settings.dataPrivacy.deletion.overlay.whatHappens.line2",
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" />
                    <span>
                      {t(
                        "settings.dataPrivacy.deletion.overlay.whatHappens.line3",
                      )}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Cancel button — the ONLY way out */}
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full py-3 px-6 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />{" "}
                    {t("settings.dataPrivacy.deletion.overlay.cancelling")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />{" "}
                    {t("settings.dataPrivacy.deletion.overlay.cancelButton")}
                  </>
                )}
              </button>

              {/* Contact support */}
              <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                {t("settings.dataPrivacy.deletion.overlay.support")}{" "}
                <a
                  href="mailto:podacium@podacium.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {t("settings.dataPrivacy.deletion.overlay.contactSupport")}
                </a>
              </p>

              {/* Logout */}
              <div className="text-center pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    clearCookie(DELETION_PENDING_COOKIE);
                    logout();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t("settings.dataPrivacy.deletion.overlay.logout")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
