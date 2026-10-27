"use client";

import React, { useState } from "react";
import {
  Mail,
  Send,
  Calendar,
  Clock,
  Lock,
  Share2,
  Check,
  Copy,
  Shield,
  FileText,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

interface ScheduledExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardTitle?: string;
}

export const ScheduledExportModal: React.FC<ScheduledExportModalProps> = ({
  isOpen,
  onClose,
  dashboardTitle = "Executive Sales Overview",
}) => {
  const t = useTranslations("bi.dashboards.scheduledExport");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [emailRecipients, setEmailRecipients] = useState<string>(
    "executives@podacium.com",
  );
  const [format, setFormat] = useState<string>("pdf");
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleSaveSchedule = () => {
    toast.success(
      t("saveSuccess", { format: format.toUpperCase(), frequency }),
    );
    onClose();
  };

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(
      "https://podacium.com/bi/share/dash-9812-dzd-v2",
    );
    setIsCopied(true);
    toast.success(t("copySuccess"));
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-5 text-start">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-blue-600 text-white shadow-md">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {t("title")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t("subtitle", { dashboardTitle })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("dispatchFrequency")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["daily", "weekly", "monthly"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`py-2 rounded-xl uppercase tracking-wider font-semibold border transition-all ${
                    frequency === f
                      ? "bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"
                  }`}
                >
                  {t(`frequencies.${f}` as any)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("recipientLabel")}
            </label>
            <input
              type="text"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("exportFormat")}
            </label>
            <div className="flex gap-2">
              {["pdf", "excel", "csv", "png"].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-1.5 rounded-xl uppercase font-bold border transition-all ${
                    format === fmt
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Secure Share Link */}
          <div className="pt-3 border-t border-gray-200 dark:border-slate-800">
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-blue-500" />
              {t("secureShareToken")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value="https://podacium.com/bi/share/dash-9812-dzd-v2"
                className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-mono text-[11px]"
              />
              <PodaciumButton
                variant="secondary"
                size="sm"
                onClick={handleCopyPublicLink}
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </PodaciumButton>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800">
          <PodaciumButton variant="secondary" size="sm" onClick={onClose}>
            {t("cancel")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            onClick={handleSaveSchedule}
          >
            <Send className="w-3.5 h-3.5 me-1" />
            {t("enableSchedule")}
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
};
