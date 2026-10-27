// /components/hub/ProposalForm.tsx - INTERNATIONALIZED
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  DollarSign,
  Calendar,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Paperclip,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface ProposalFormProps {
  projectId: number;
  projectTitle: string;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isOpen: boolean;
}

export const ProposalForm: React.FC<ProposalFormProps> = ({
  projectId,
  projectTitle,
  onClose,
  onSubmit,
  isOpen,
}) => {
  const { t } = useTranslations("component");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!message.trim()) {
      setError(t("comphub.proposalForm.validation.messageRequired"));
      return;
    }

    if (message.length < 10) {
      setError(t("comphub.proposalForm.validation.messageMinLength"));
      return;
    }

    if (!amount || parseInt(amount) < 1000) {
      setError(t("comphub.proposalForm.validation.minAmount"));
      return;
    }

    if (
      estimatedDays &&
      (parseInt(estimatedDays) < 1 || parseInt(estimatedDays) > 365)
    ) {
      setError(t("comphub.proposalForm.validation.estimatedDaysRange"));
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare data according to API schema
      const proposalData = {
        message: message.trim(),
        amount: parseInt(amount),
        estimated_days: estimatedDays ? parseInt(estimatedDays) : undefined,
      };

      await onSubmit(proposalData);

      // Reset form on success
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message || t("comphub.proposalForm.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMessage("");
    setAmount("");
    setEstimatedDays("");
    setAttachments([]);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (file.size > maxSize) {
        alert(
          t("comphub.proposalForm.fileTooLarge", {
            name: file.name,
            maxSize: "10MB",
          }),
        );
        return false;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(
          t("comphub.proposalForm.fileTypeNotSupported", { name: file.name }),
        );
        return false;
      }

      return true;
    });

    setAttachments((prev) => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {t("comphub.proposalForm.title")}
                </h2>
                <p className="text-gray-600 dark:text-slate-400 mt-1">
                  {t("comphub.proposalForm.forProject", {
                    title: projectTitle,
                  })}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl p-4"
              >
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                  <p className="text-red-800 dark:text-red-200 font-medium">
                    {error}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>{t("comphub.proposalForm.labels.message")}</span>
                </div>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("comphub.proposalForm.placeholders.message")}
                rows={6}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm resize-none"
                required
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{t("comphub.proposalForm.hints.minCharacters")}</span>
                <span>{message.length}/2000</span>
              </div>
            </div>

            {/* Amount and Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{t("comphub.proposalForm.labels.amount")}</span>
                  </div>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-slate-400">
                    DA
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    min="1000"
                    step="100"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t("comphub.proposalForm.hints.minAmount")}
                </p>
              </div>

              {/* Estimated Days */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {t("comphub.proposalForm.labels.estimatedDays")}
                    </span>
                  </div>
                </label>
                <input
                  type="number"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  placeholder="7"
                  min="1"
                  max="365"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t("comphub.proposalForm.hints.estimatedDaysRange")}
                </p>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Paperclip className="w-4 h-4" />
                  <span>{t("comphub.proposalForm.labels.attachments")}</span>
                </div>
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="attachments"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="attachments"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <Paperclip className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {t("comphub.proposalForm.hints.uploadFiles")}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("comphub.proposalForm.hints.fileTypesAndSize")}
                  </span>
                </label>
              </div>

              {/* File List */}
              {attachments.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("comphub.proposalForm.selectedFiles")}:
                  </h4>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/60 rounded-lg border border-gray-200 dark:border-slate-800"
                    >
                      <div className="flex items-center space-x-3">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-gray-400 hover:text-red-500 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>{t("comphub.proposalForm.tips.title")}:</span>
              </h4>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• {t("comphub.proposalForm.tips.specificApproach")}</li>
                <li>• {t("comphub.proposalForm.tips.highlightExperience")}</li>
                <li>• {t("comphub.proposalForm.tips.realisticTimeline")}</li>
                <li>• {t("comphub.proposalForm.tips.askQuestions")}</li>
                <li>• {t("comphub.proposalForm.tips.marketExperience")}</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                disabled={isSubmitting}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {t("comphub.proposalForm.buttons.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isSubmitting
                  ? t("comphub.proposalForm.buttons.submitting")
                  : t("comphub.proposalForm.buttons.submit")}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
};
