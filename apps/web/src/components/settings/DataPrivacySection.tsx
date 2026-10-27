"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, apiClient } from "@/lib/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Trash2,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Clock,
  FileJson,
  Loader2,
  X,
  RefreshCw,
  Info,
  Calendar,
  Shield,
  Lock,
  Database,
  BookOpen,
  Award,
  Briefcase,
  HardDrive,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeletionStatus {
  has_pending_request: boolean;
  id?: number;
  status?: string;
  scheduled_for?: string;
  requested_at?: string;
  days_remaining?: number;
}

interface DataStats {
  total_courses: number;
  completed_courses: number;
  active_projects: number;
  completed_projects: number;
  datasets_count: number;
  certifications_count: number;
  total_earnings: number;
  storage_used_mb: number;
  storage_limit_mb: number;
}

type PageState = "idle" | "exporting" | "requesting_deletion" | "cancelling";

type DeletionStep = "warning" | "confirm_text" | "password";

const DELETION_CONFIRM_TEXT = "DELETE";
const STATUS_POLL_INTERVAL = 30000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "warning" | "success" | "info" | "error";
}) {
  const styles = {
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function DismissableAlert({
  type,
  message,
  onClose,
  action,
}: {
  type: "success" | "error" | "warning";
  message: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const t = useTranslations("common");
  const styles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  const icons = {
    success: (
      <CheckCircle
        className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
    ),
    error: (
      <AlertCircle
        className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400"
        aria-hidden="true"
      />
    ),
    warning: (
      <AlertTriangle
        className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
    ),
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`flex items-start gap-3 p-4 rounded-xl border ${styles[type]}`}
      role="alert"
    >
      {icons[type]}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <div className="flex items-center gap-2 shrink-0">
        {action && (
          <button
            onClick={action.onClick}
            className="text-sm font-semibold underline hover:no-underline whitespace-nowrap"
          >
            {action.label}
          </button>
        )}
        <button
          onClick={onClose}
          aria-label={t("dismiss")}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Data Overview Card ───────────────────────────────────────────────────────

function DataOverviewCard({
  stats,
  loading,
}: {
  stats: DataStats | null;
  loading: boolean;
}) {
  const t = useTranslations("user");
  const tc = useTranslations("common");

  if (loading) {
    return (
      <section
        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden"
        aria-label={t("settings.dataPrivacy.overview.title")}
      >
        <div className="p-6 flex items-center justify-center">
          <Loader2
            className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400"
            aria-label={tc("loading")}
          />
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const items = [
    {
      icon: BookOpen,
      label: t("settings.dataPrivacy.overview.courses"),
      value: `${stats.completed_courses}/${stats.total_courses}`,
      suffix: t("settings.dataPrivacy.overview.completed"),
    },
    {
      icon: Award,
      label: t("settings.dataPrivacy.overview.certificates"),
      value: String(stats.certifications_count),
    },
    {
      icon: Briefcase,
      label: t("settings.dataPrivacy.overview.projects"),
      value: `${stats.completed_projects}/${stats.active_projects}`,
      suffix: t("settings.dataPrivacy.overview.active"),
    },
    {
      icon: Database,
      label: t("settings.dataPrivacy.overview.datasets"),
      value: String(stats.datasets_count),
    },
  ];

  const storagePct =
    stats.storage_limit_mb > 0
      ? Math.min(
          100,
          Math.round((stats.storage_used_mb / stats.storage_limit_mb) * 100),
        )
      : 0;

  return (
    <section
      className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden"
      aria-label={t("settings.dataPrivacy.overview.title")}
    >
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex items-center gap-3">
        <HardDrive
          className="w-5 h-5 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">
          {t("settings.dataPrivacy.overview.title")}
        </h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {items.map(({ icon: Icon, label, value, suffix }) => (
            <div
              key={label}
              className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-2">
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {label}
                </span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {value}
                {suffix && (
                  <span className="text-xs font-normal text-gray-500 dark:text-slate-400 ltr:mr-1 rtl:ml-1">
                    {" "}
                    {suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {stats.storage_limit_mb > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium text-gray-700 dark:text-slate-300">
                {t("settings.dataPrivacy.overview.storage")}
              </span>
              <span className="text-gray-500 dark:text-slate-400">
                {formatMegabytes(stats.storage_used_mb)} /{" "}
                {formatMegabytes(stats.storage_limit_mb)}
              </span>
            </div>
            <div
              className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-2"
              role="progressbar"
              aria-valuenow={storagePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-2 rounded-full transition-all duration-500 ${storagePct > 90 ? "bg-red-500" : storagePct > 70 ? "bg-amber-500" : "bg-blue-600"}`}
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function formatMegabytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

// ─── Deletion countdown / timeline ────────────────────────────────────────────

function DeletionTimeline({
  requestedAt,
  scheduledFor,
  daysRemaining,
}: {
  requestedAt?: string;
  scheduledFor?: string;
  daysRemaining?: number;
}) {
  const t = useTranslations("user");

  const days = daysRemaining ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round((days / 30) * 100)));
  const color =
    days > 20 ? "bg-emerald-500" : days > 10 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {t("settings.dataPrivacy.deletion.timeline.title")}
        </span>
        <StatusBadge
          variant={days > 20 ? "success" : days > 10 ? "warning" : "error"}
        >
          {days > 0
            ? t("settings.dataPrivacy.deletion.timeline.daysLeft", {
                n: String(days),
              })
            : t("settings.dataPrivacy.deletion.timeline.expiring")}
        </StatusBadge>
      </div>
      <div
        className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-2.5 mb-3"
        role="progressbar"
        aria-valuenow={days}
        aria-valuemin={0}
        aria-valuemax={30}
      >
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>
          {requestedAt
            ? t("settings.dataPrivacy.deletion.timeline.requested", {
                date: new Date(requestedAt).toLocaleDateString(),
              })
            : ""}
        </span>
        <span>
          {scheduledFor
            ? t("settings.dataPrivacy.deletion.timeline.scheduled", {
                date: new Date(scheduledFor).toLocaleDateString(),
              })
            : ""}
        </span>
      </div>
    </div>
  );
}

// ─── Enhanced Deletion confirmation dialog ────────────────────────────────────

function DeletionConfirmDialog({
  onConfirm,
  onCancel,
  isLoading,
  onDownloadFirst,
}: {
  onConfirm: (reason: string, feedback: string, password: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  onDownloadFirst: () => void;
}) {
  const [step, setStep] = useState<DeletionStep>("warning");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const t = useTranslations("user");
  const { dir } = useBidi();

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  const match = confirmText === DELETION_CONFIRM_TEXT;

  useEffect(() => {
    firstFocusableRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "confirm_text") {
      confirmInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deletion-dialog-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
        dir={dir}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2.5 rounded-xl ${step === "password" ? "bg-red-100 dark:bg-red-900/50" : "bg-amber-100 dark:bg-amber-900/50"}`}
            aria-hidden="true"
          >
            {step === "password" ? (
              <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <h2
            id="deletion-dialog-title"
            className="text-lg font-bold text-gray-900 dark:text-slate-100"
          >
            {step === "password"
              ? t("settings.dataPrivacy.dialog.titleFinal")
              : t("settings.dataPrivacy.dialog.title")}
          </h2>
        </div>

        {/* Step indicator */}
        <div
          className="flex items-center gap-2 mb-5"
          aria-label={t("settings.dataPrivacy.dialog.stepsLabel")}
        >
          {(["warning", "confirm_text", "password"] as DeletionStep[]).map(
            (s, i) => {
              const isActive = s === step;
              const isDone =
                ["warning", "confirm_text", "password"].indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-red-600 text-white"
                          : "bg-gray-200 dark:bg-slate-800/90 text-gray-500 dark:text-slate-400"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < 2 && (
                    <div
                      className={`flex-1 h-0.5 transition-colors ${isDone ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-800/90"}`}
                    />
                  )}
                </div>
              );
            },
          )}
        </div>

        {/* Step 1: Warning + acknowledgment */}
        {step === "warning" && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-semibold mb-1">
                    {t("settings.dataPrivacy.dialog.warning.title")}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t("settings.dataPrivacy.dialog.warning.line1")}</li>
                    <li>{t("settings.dataPrivacy.dialog.warning.line2")}</li>
                    <li>{t("settings.dataPrivacy.dialog.warning.line3")}</li>
                    <li>{t("settings.dataPrivacy.dialog.warning.line4")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info
                  className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t("settings.dataPrivacy.dialog.warning.graceNote")}
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                {t("settings.dataPrivacy.dialog.warning.downloadPrompt")}
              </p>
              <button
                onClick={onDownloadFirst}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                {t("settings.dataPrivacy.dialog.warning.downloadButton")}
              </button>
            </div>

            <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-red-600 dark:text-red-400 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                {t("settings.dataPrivacy.dialog.warning.acknowledge")}
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                {t("settings.dataPrivacy.dialog.keepAccount")}
              </button>
              <button
                ref={firstFocusableRef}
                onClick={() => setStep("confirm_text")}
                disabled={!acknowledged}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              >
                {t("settings.dataPrivacy.dialog.continue")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Type confirmation */}
        {step === "confirm_text" && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("settings.dataPrivacy.dialog.confirmText.instruction")}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-delete-text"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
              >
                {t("settings.dataPrivacy.dialog.confirmText.label")}
              </label>
              <input
                ref={confirmInputRef}
                id="confirm-delete-text"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full rounded-xl border-2 px-3 py-2.5 text-sm text-center font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white dark:bg-slate-900"
              />
              {confirmText.length > 0 && !match && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                  <X className="w-3 h-3" />{" "}
                  {t("settings.dataPrivacy.dialog.confirmText.mismatch")}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("warning")}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                {t("settings.dataPrivacy.dialog.back")}
              </button>
              <button
                onClick={() => setStep("password")}
                disabled={!match}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {t("settings.dataPrivacy.dialog.continue")}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Password + final submit */}
        {step === "password" && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {t("settings.dataPrivacy.dialog.password.warning")}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="deletion-password"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
              >
                {t("settings.dataPrivacy.dialog.password.label")}{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="deletion-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t(
                    "settings.dataPrivacy.dialog.password.placeholder",
                  )}
                  autoComplete="current-password"
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-slate-800 px-3 py-2.5 ltr:pr-10 rtl:pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 ltr:left-auto ltr:right-3 rtl:right-auto rtl:left-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                  aria-label={
                    showPassword
                      ? t("common.hidePassword")
                      : t("common.showPassword")
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert
                  className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t("settings.dataPrivacy.dialog.warning.graceNote")}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("confirm_text")}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border-2 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                {t("settings.dataPrivacy.dialog.back")}
              </button>
              <button
                onClick={() => onConfirm(reason, feedback, password)}
                disabled={isLoading || !password}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading && (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isLoading
                  ? t("settings.dataPrivacy.dialog.processing")
                  : t("settings.dataPrivacy.dialog.confirm")}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function DataPrivacySection() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations("user");
  const { dir } = useBidi();

  const [pageState, setPageState] = useState<PageState>("idle");
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(
    null,
  );
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "warning";
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const showAlert = (
    type: "success" | "error" | "warning",
    message: string,
    action?: { label: string; onClick: () => void },
  ) => {
    setAlert({ type, message, action });
    if (type === "success" || type === "warning") {
      setTimeout(() => setAlert(null), type === "warning" ? 10000 : 8000);
    }
  };

  // ── Format localized date ──────────────────────────────────────────────────

  const formatDate = useCallback(
    (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
      const locale = t.i18n.language || "en";
      return new Date(dateStr).toLocaleDateString(locale.replace("_", "-"), {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...options,
      });
    },
    [t],
  );

  // ── Load data stats ────────────────────────────────────────────────────────

  const loadDataStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const [dashboard, usage] = await Promise.allSettled([
        api.getUserDashboard(),
        api.getUsageMetrics(),
      ]);

      const stats: DataStats = {
        total_courses: 0,
        completed_courses: 0,
        active_projects: 0,
        completed_projects: 0,
        datasets_count: 0,
        certifications_count: 0,
        total_earnings: 0,
        storage_used_mb: 0,
        storage_limit_mb: 0,
      };

      if (
        dashboard.status === "fulfilled" &&
        dashboard.value?.state?.user_stats
      ) {
        const us = dashboard.value.state.user_stats;
        stats.total_courses = us.total_courses ?? 0;
        stats.completed_courses = us.completed_courses ?? 0;
        stats.active_projects = us.active_projects ?? 0;
        stats.completed_projects = us.completed_projects ?? 0;
        stats.datasets_count = us.datasets_count ?? 0;
        stats.certifications_count = us.certifications_count ?? 0;
        stats.total_earnings = us.total_earnings ?? 0;
      }

      if (usage.status === "fulfilled" && usage.value?.metrics) {
        const met = usage.value.metrics;
        stats.storage_used_mb = Math.round((met.storage ?? 0) / (1024 * 1024));
        stats.storage_limit_mb = Math.round(
          (met.storage_limit ?? 0) / (1024 * 1024),
        );
      }

      setDataStats(stats);
    } catch {
      setDataStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Load deletion request status ────────────────────────────────────────────

  const loadDeletionStatus = useCallback(async () => {
    try {
      const status = await apiClient.get<DeletionStatus>(
        ENDPOINTS.USERS.DELETE_REQUEST,
      );
      setDeletionStatus(status);
    } catch {
      setDeletionStatus({ has_pending_request: false });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // ── Periodic polling when deletion is pending ──────────────────────────────

  useEffect(() => {
    loadDeletionStatus();
    loadDataStats();
  }, [loadDeletionStatus, loadDataStats]);

  useEffect(() => {
    if (deletionStatus?.has_pending_request) {
      pollingRef.current = setInterval(() => {
        loadDeletionStatus();
      }, STATUS_POLL_INTERVAL);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [deletionStatus?.has_pending_request, loadDeletionStatus]);

  // ── Export handler ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setPageState("exporting");
    setAlert(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}${ENDPOINTS.USERS.EXPORT_DATA}`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 404) {
        showAlert("error", t("settings.dataPrivacy.alerts.exportEmpty"));
        return;
      }
      if (response.status === 429) {
        showAlert("error", t("settings.dataPrivacy.alerts.exportRateLimit"));
        return;
      }
      if (!response.ok) {
        showAlert("error", t("settings.dataPrivacy.alerts.exportError"));
        return;
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        showAlert("warning", t("settings.dataPrivacy.alerts.exportEmpty"));
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = `podacium-data-${new Date().toISOString().split("T")[0]}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showAlert("success", t("settings.dataPrivacy.alerts.exportSuccess"));
    } catch (err: any) {
      if (err?.name === "AbortError") {
        showAlert("error", t("settings.dataPrivacy.alerts.exportTimeout"));
      } else if (
        err?.message?.includes("Failed to fetch") ||
        err?.message?.includes("NetworkError")
      ) {
        showAlert("error", t("settings.errors.network"));
      } else {
        showAlert("error", t("settings.dataPrivacy.alerts.exportError"));
      }
    } finally {
      setPageState("idle");
    }
  }, [t]);

  // ── Deletion request handler ───────────────────────────────────────────────

  const handleDeletionConfirm = useCallback(
    async (reason: string, feedback: string, password: string) => {
      setPageState("requesting_deletion");
      try {
        await apiClient.post(ENDPOINTS.USERS.DELETE_REQUEST, {
          reason,
          feedback,
          password,
        });
        setShowDeletionDialog(false);

        // Set deletion_pending cookie so middleware blocks access
        if (typeof document !== "undefined") {
          document.cookie =
            "deletion_pending=1; path=/; max-age=" +
            60 * 60 * 24 * 30 +
            "; SameSite=Lax";
        }

        // Log out and redirect to login page
        await logout();
        router.push("/auth/login?reason=deletion_scheduled");
      } catch (err: any) {
        setShowDeletionDialog(false);
        if (err?.status === 400) {
          showAlert(
            "error",
            t("settings.dataPrivacy.alerts.deletionBadRequest"),
          );
        } else if (err?.status === 429) {
          showAlert("error", t("settings.dataPrivacy.alerts.exportRateLimit"));
        } else {
          const msg =
            err?.message || t("settings.dataPrivacy.alerts.deletionError");
          showAlert("error", msg);
        }
        setPageState("idle");
      }
    },
    [t, loadDeletionStatus, logout, router],
  );

  // ── Cancel deletion handler ────────────────────────────────────────────────

  const handleCancelDeletion = useCallback(async () => {
    setPageState("cancelling");
    try {
      const prevStatus = deletionStatus;
      await apiClient.delete(ENDPOINTS.USERS.DELETE_REQUEST);

      showAlert("success", t("settings.dataPrivacy.alerts.cancelSuccess"), {
        label: t("settings.dataPrivacy.alerts.undoCancel"),
        onClick: async () => {
          if (prevStatus) {
            try {
              await apiClient.post(ENDPOINTS.USERS.DELETE_REQUEST, {});
              showAlert(
                "success",
                t("settings.dataPrivacy.alerts.deletionSuccess"),
              );
              await loadDeletionStatus();
            } catch {
              showAlert(
                "error",
                t("settings.dataPrivacy.alerts.deletionError"),
              );
            }
          }
        },
      });
      await loadDeletionStatus();
    } catch {
      showAlert("error", t("settings.dataPrivacy.alerts.cancelError"));
    } finally {
      setPageState("idle");
    }
  }, [t, loadDeletionStatus, deletionStatus]);

  // ── Download-first from dialog ─────────────────────────────────────────────

  const handleDownloadFirst = useCallback(async () => {
    setShowDeletionDialog(false);
    await handleExport();
    setShowDeletionDialog(true);
  }, [handleExport]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const exportItems = [
    t("settings.dataPrivacy.export.items.profile"),
    t("settings.dataPrivacy.export.items.enrollments"),
    t("settings.dataPrivacy.export.items.projects"),
    t("settings.dataPrivacy.export.items.contracts"),
    t("settings.dataPrivacy.export.items.wallet"),
    t("settings.dataPrivacy.export.items.support"),
    t("settings.dataPrivacy.export.items.analytics"),
    t("settings.dataPrivacy.export.items.notifications"),
  ];

  const deletionFeatures = [
    {
      icon: Calendar,
      text: t("settings.dataPrivacy.deletion.features.grace"),
    },
    {
      icon: CheckCircle,
      text: t("settings.dataPrivacy.deletion.features.email"),
    },
    {
      icon: ShieldAlert,
      text: t("settings.dataPrivacy.deletion.features.erase"),
    },
  ];

  return (
    <div dir={dir} className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Shield
            className="w-6 h-6 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          {t("settings.dataPrivacy.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
          {t("settings.dataPrivacy.subtitle")}
        </p>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {alert && (
          <DismissableAlert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
            action={alert.action}
          />
        )}
      </AnimatePresence>

      {/* Data Overview Card */}
      <DataOverviewCard stats={dataStats} loading={loadingStats} />

      {/* Pending deletion banner */}
      <AnimatePresence>
        {deletionStatus?.has_pending_request && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-2xl"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-4">
              <Clock
                className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  {t("settings.dataPrivacy.deletion.banner.title")}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  {(() => {
                    const scheduledDate = deletionStatus.scheduled_for
                      ? formatDate(deletionStatus.scheduled_for)
                      : "\u2014";
                    return t("settings.dataPrivacy.deletion.banner.body", {
                      date: scheduledDate,
                      days: String(deletionStatus.days_remaining ?? 0),
                    });
                  })()}
                </p>
                <DeletionTimeline
                  requestedAt={deletionStatus.requested_at}
                  scheduledFor={deletionStatus.scheduled_for}
                  daysRemaining={deletionStatus.days_remaining}
                />
              </div>
              <button
                onClick={handleCancelDeletion}
                disabled={pageState === "cancelling"}
                className="shrink-0 px-3 py-1.5 bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 dark:bg-amber-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 flex items-center gap-1.5"
                aria-label={t("settings.dataPrivacy.deletion.cancelButton")}
              >
                {pageState === "cancelling" ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    {t("settings.dataPrivacy.deletion.cancelling")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    {t("settings.dataPrivacy.deletion.cancelButton")}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export card */}
      <section
        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden"
        aria-labelledby="export-heading"
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex items-center gap-3">
          <FileJson
            className="w-5 h-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <h2
            id="export-heading"
            className="font-semibold text-gray-900 dark:text-slate-100"
          >
            {t("settings.dataPrivacy.export.title")}
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            {t("settings.dataPrivacy.export.description")}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400 mb-5">
            {exportItems.map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle
                  className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl mb-5 text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t("settings.dataPrivacy.export.redactionNotice")}</span>
          </div>

          <button
            onClick={handleExport}
            disabled={pageState !== "idle"}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            aria-label={t("settings.dataPrivacy.export.button")}
            aria-busy={pageState === "exporting"}
          >
            {pageState === "exporting" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t("settings.dataPrivacy.export.busy")}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                {t("settings.dataPrivacy.export.button")}
              </>
            )}
          </button>
        </div>
      </section>

      {/* Deletion card */}
      <section
        className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800/80 shadow-sm overflow-hidden"
        aria-labelledby="deletion-heading"
      >
        <div className="px-6 py-5 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-950/60 flex items-center gap-3">
          <Trash2
            className="w-5 h-5 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <h2
            id="deletion-heading"
            className="font-semibold text-red-900 dark:text-red-100"
          >
            {t("settings.dataPrivacy.deletion.title")}
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            {t("settings.dataPrivacy.deletion.description")}
          </p>

          <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400 mb-5">
            {deletionFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2">
                <Icon
                  className="w-4 h-4 shrink-0 mt-0.5 text-red-400"
                  aria-hidden="true"
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <StatusBadge
            variant={deletionStatus?.has_pending_request ? "warning" : "info"}
          >
            {loadingStatus
              ? t("settings.dataPrivacy.deletion.status.checking")
              : deletionStatus?.has_pending_request
                ? t("settings.dataPrivacy.deletion.status.scheduled", {
                    days: String(deletionStatus.days_remaining ?? 0),
                  })
                : t("settings.dataPrivacy.deletion.status.none")}
          </StatusBadge>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {deletionStatus?.has_pending_request ? (
              <button
                onClick={handleCancelDeletion}
                disabled={pageState !== "idle"}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60"
                aria-label={t("settings.dataPrivacy.deletion.cancelButton")}
              >
                {pageState === "cancelling" ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    {t("settings.dataPrivacy.deletion.cancelling")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    {t("settings.dataPrivacy.deletion.cancelRequestButton")}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowDeletionDialog(true)}
                disabled={pageState !== "idle" || loadingStatus}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60"
                aria-label={t("settings.dataPrivacy.deletion.requestButton")}
                aria-haspopup="dialog"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {t("settings.dataPrivacy.deletion.requestButton")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Legal notice */}
      <p className="text-xs text-gray-400 text-center pb-4">
        {t("settings.dataPrivacy.legal")}{" "}
        <Link
          href="/privacy"
          className="underline hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
        >
          {t("settings.dataPrivacy.privacyLink")}
        </Link>
        {" \u00b7 "}
        <Link
          href="/terms"
          className="underline hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
        >
          {t("settings.dataPrivacy.termsLink")}
        </Link>
      </p>

      {/* Deletion confirmation dialog */}
      <AnimatePresence>
        {showDeletionDialog && (
          <DeletionConfirmDialog
            onConfirm={handleDeletionConfirm}
            onCancel={() => setShowDeletionDialog(false)}
            isLoading={pageState === "requesting_deletion"}
            onDownloadFirst={handleDownloadFirst}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
