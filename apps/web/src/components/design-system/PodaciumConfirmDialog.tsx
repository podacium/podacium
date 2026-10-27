import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PodaciumButton from "./PodaciumButton";
import PodaciumInput from "./PodaciumInput";
import PodaciumTextarea from "./PodaciumTextarea";
import { useTranslations } from "@/lib/i18n";

export interface PodaciumConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (promptValue?: string) => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  typeToConfirm?: string;
  hazardBanner?: string;
  promptConfig?: {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    multiline?: boolean;
  };
  className?: string;
}

export const PodaciumConfirmDialog: React.FC<PodaciumConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "danger",
  isLoading = false,
  typeToConfirm,
  hazardBanner,
  promptConfig,
  className,
}) => {
  const t = useTranslations("common");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [promptValue, setPromptValue] = useState(
    promptConfig?.defaultValue || "",
  );
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation("");
      setPromptValue(promptConfig?.defaultValue || "");
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, promptConfig?.defaultValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const isConfirmDisabled =
    isLoading ||
    (typeToConfirm ? typedConfirmation !== typeToConfirm : false) ||
    (promptConfig?.required ? !promptValue.trim() : false);

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    await onConfirm(promptConfig ? promptValue : undefined);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: (
            <AlertTriangle
              className="w-6 h-6 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          ),
          iconBg:
            "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900",
          btnVariant: "destructive" as const,
        };
      case "warning":
        return {
          icon: (
            <AlertCircle
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          ),
          iconBg:
            "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900",
          btnVariant: "destructive" as const,
        };
      case "info":
      default:
        return {
          icon: <Info className="w-6 h-6 text-primary" aria-hidden="true" />,
          iconBg: "bg-primary/10 text-primary border border-primary/20",
          btnVariant: "primary" as const,
        };
    }
  };

  const variantInfo = getVariantStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            aria-hidden="true"
          />

          {/* Dialog Body */}
          <motion.div
            className={cn(
              "relative w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl shadow-2xl overflow-hidden p-6",
              className,
            )}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-desc" : undefined}
          >
            {/* Header & Icon */}
            <div className="flex items-start gap-4">
              <div
                className={cn("p-3 rounded-xl shrink-0", variantInfo.iconBg)}
              >
                {variantInfo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2
                    id="confirm-dialog-title"
                    className="text-lg font-bold text-gray-900 dark:text-slate-100"
                  >
                    {title}
                  </h2>
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label={t("close", "Close")}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {description && (
                  <p
                    id="confirm-dialog-desc"
                    className="mt-2 text-sm text-gray-600 dark:text-slate-300 leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Hazard Banner */}
            {hazardBanner && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
                {hazardBanner}
              </div>
            )}

            {/* Prompt Input Mode */}
            {promptConfig && (
              <div className="mt-4">
                {promptConfig.label && (
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                    {promptConfig.label}
                    {promptConfig.required && (
                      <span className="text-red-500 ms-1">*</span>
                    )}
                  </label>
                )}
                {promptConfig.multiline ? (
                  <PodaciumTextarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={promptConfig.placeholder}
                    rows={3}
                    className="w-full text-sm"
                  />
                ) : (
                  <PodaciumInput
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={promptConfig.placeholder}
                    className="w-full text-sm"
                  />
                )}
              </div>
            )}

            {/* Type-to-Confirm Safeguard */}
            {typeToConfirm && (
              <div className="mt-4 p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                <label className="block text-xs text-gray-600 dark:text-slate-300 mb-2">
                  <span>
                    {t("type_to_confirm_instruction", "Please type")}{" "}
                  </span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900">
                    {typeToConfirm}
                  </span>
                  <span> {t("type_to_confirm_to_proceed", "to proceed:")}</span>
                </label>
                <PodaciumInput
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder={typeToConfirm}
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <PodaciumButton
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {cancelText || t("cancel", "Cancel")}
              </PodaciumButton>
              <PodaciumButton
                ref={confirmBtnRef}
                type="button"
                variant={variantInfo.btnVariant}
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                loading={isLoading}
                className="w-full sm:w-auto font-semibold"
              >
                {confirmText || t("confirm", "Confirm")}
              </PodaciumButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PodaciumConfirmDialog;
