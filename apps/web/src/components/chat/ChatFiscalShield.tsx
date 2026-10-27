"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  FileText,
  ChevronRight,
  X,
} from "lucide-react";
import { PodaciumModal, PodaciumButton } from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface ChatFiscalShieldProps {
  userRole?: "CLIENT" | "FREELANCER" | "OTHER";
  contractAmountDzd?: number;
  onDismiss?: () => void;
  className?: string;
}

export const ChatFiscalShield: React.FC<ChatFiscalShieldProps> = ({
  userRole = "CLIENT",
  contractAmountDzd = 50000,
  onDismiss,
  className,
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const estimatedTaxLoss = Math.round(contractAmountDzd * 0.26);

  const handleClose = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs flex items-center justify-between gap-3 ${className || ""}`}
          >
            <div className="flex items-center gap-2 flex-1">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                {userRole === "CLIENT" ? (
                  <p>
                    <span className="font-semibold">
                      {t("robustness.chat_shield.activeBanner")}
                    </span>{" "}
                    {t("robustness.chat_shield.clientWarning", {
                      amount: estimatedTaxLoss.toLocaleString(),
                    })}
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold">
                      {t("robustness.chat_shield.activeBanner")}
                    </span>{" "}
                    {t("robustness.chat_shield.freelancerWarning")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowExplanationModal(true)}
                className="font-medium underline hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex items-center gap-0.5"
              >
                <span>{t("robustness.chat_shield.learnMore")}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                aria-label={t("robustness.chat_shield.dismiss")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PodaciumModal
        isOpen={showExplanationModal}
        onClose={() => setShowExplanationModal(false)}
        title={t("robustness.chat_shield.modalTitle")}
        size="md"
      >
        <div className="space-y-4 py-2 text-sm">
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t("robustness.chat_shield.legalBasisTitle")}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("robustness.chat_shield.legalBasisDesc")}
            </p>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
              {t("robustness.chat_shield.guaranteesTitle")}
            </h5>
            <ul className="space-y-1.5 text-xs text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t("robustness.chat_shield.guaranteeVault")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t("robustness.chat_shield.guaranteePack")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t("robustness.chat_shield.guaranteeLoyalty")}</span>
              </li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <PodaciumButton
              variant="primary"
              onClick={() => setShowExplanationModal(false)}
            >
              {t("robustness.chat_shield.understood")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>
    </>
  );
};

export default ChatFiscalShield;
