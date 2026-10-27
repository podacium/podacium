"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import PodaciumModal from "./PodaciumModal";
import PodaciumButton from "./PodaciumButton";
import PodaciumInput from "./PodaciumInput";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface PodaciumDangerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmTextExpected: string;
  actionLabel?: string;
  isPending?: boolean;
  impactItems?: string[];
}

export const PodaciumDangerModal: React.FC<PodaciumDangerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmTextExpected,
  actionLabel,
  isPending = false,
  impactItems = [],
}) => {
  const [inputValue, setInputValue] = useState("");
  const t = useTranslations("common");
  const { dir } = useBidi();

  // Reset input value when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const isConfirmed = inputValue.trim() === confirmTextExpected.trim();

  const handleConfirm = async () => {
    if (!isConfirmed || isPending) return;
    await onConfirm();
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={isPending ? () => {} : onClose}
      title={title}
      size="md"
      closeOnOverlay={!isPending}
    >
      <div className="space-y-4 text-start" dir={dir}>
        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">{description}</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              {t("dangerModal.actionIrreversible")}
            </p>
          </div>
        </div>

        {/* Impact Checklist */}
        {impactItems.length > 0 && (
          <div className="bg-slate-100 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <span className="font-medium text-slate-900 dark:text-slate-100 block">
              {t("dangerModal.impactList")}
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              {impactItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Verification Input & Anti-Paste Shield */}
        <div className="space-y-2 pt-1">
          <label
            htmlFor="danger-modal-confirmation-input"
            className="text-xs font-medium text-slate-700 dark:text-slate-300 block"
          >
            {t("dangerModal.typeToConfirm")}{" "}
            <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded select-none">
              {confirmTextExpected}
            </span>{" "}
            {t("dangerModal.below")}
          </label>
          <div className="relative">
            <PodaciumInput
              id="danger-modal-confirmation-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
              }}
              placeholder={confirmTextExpected}
              disabled={isPending}
              autoComplete="off"
              spellCheck="false"
              className="font-mono text-sm border-red-500/30 focus:border-red-500"
            />
            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Lock className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            {t("dangerModal.antiPasteNotice")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2">
          <PodaciumButton
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            {t("dangerModal.cancel")}
          </PodaciumButton>
          <PodaciumButton
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isPending}
            loading={isPending}
          >
            {actionLabel || t("dangerModal.confirm")}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
};

export default PodaciumDangerModal;
