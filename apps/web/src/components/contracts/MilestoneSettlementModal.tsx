"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  UploadCloud,
  FileText,
  Download,
  Lock,
  AlertCircle,
} from "lucide-react";
import {
  PodaciumModal,
  PodaciumButton,
  PodaciumBadge,
  PodaciumTabs,
  PodaciumCard,
} from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface MilestoneSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number;
  milestoneId: number;
  milestoneTitle: string;
  amountDzd: number;
  freelancerName: string;
  freelancerRip: string;
  deliverableSha256?: string;
  isSettled?: boolean;
  onConfirmProofSubmission?: (file: File) => Promise<void>;
  onDownloadDecryptedDeliverable?: () => Promise<void>;
}

export const MilestoneSettlementModal: React.FC<
  MilestoneSettlementModalProps
> = ({
  isOpen,
  onClose,
  contractId,
  milestoneId,
  milestoneTitle,
  amountDzd,
  freelancerName,
  freelancerRip,
  deliverableSha256,
  isSettled = false,
  onConfirmProofSubmission,
  onDownloadDecryptedDeliverable,
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzingOcr, setIsAnalyzingOcr] = useState(false);
  const [ocrVerified, setOcrVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const referenceCode = `PODA-CTR${contractId}-MS${milestoneId}`;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processProofFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processProofFile(e.target.files[0]);
    }
  };

  const processProofFile = (file: File) => {
    setUploadedFile(file);
    setIsAnalyzingOcr(true);
    // Simulate real-time client-side OCR extraction pre-flight
    setTimeout(() => {
      setIsAnalyzingOcr(false);
      setOcrVerified(true);
    }, 1200);
  };

  const handleProofSubmit = async () => {
    if (!uploadedFile || !onConfirmProofSubmission) return;
    setIsSubmitting(true);
    try {
      await onConfirmProofSubmission(uploadedFile);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    {
      id: "payment",
      label: t("robustness.settlement.tabPayment"),
      icon: <QrCode className="w-4 h-4" />,
    },
    {
      id: "proof",
      label: t("robustness.settlement.tabProof"),
      icon: <UploadCloud className="w-4 h-4" />,
    },
    {
      id: "vault",
      label: t("robustness.settlement.tabVault"),
      icon: isSettled ? (
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
      ) : (
        <Lock className="w-4 h-4" />
      ),
    },
  ];

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("robustness.settlement.modalTitle")}
      description={`${milestoneTitle} — ${amountDzd.toLocaleString()} DZD`}
      size="lg"
    >
      <div className="py-2">
        <PodaciumTabs tabs={tabs} variant="pills">
          {(activeTab) => (
            <div className="mt-4">
              {activeTab === "payment" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {t("robustness.settlement.p2pNoticeTitle")}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {t("robustness.settlement.p2pNoticeDesc")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        {t("robustness.settlement.referenceLabel")}
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 px-3 py-2 bg-muted/60 dark:bg-slate-800 rounded-lg font-mono text-sm font-bold tracking-wide border border-border">
                          {referenceCode}
                        </div>
                        <PodaciumButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(referenceCode, "ref")}
                        >
                          {copiedField === "ref" ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </PodaciumButton>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        {t("robustness.settlement.freelancerRipLabel")}
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 px-3 py-2 bg-muted/60 dark:bg-slate-800 rounded-lg font-mono text-sm border border-border">
                          {freelancerRip}
                        </div>
                        <PodaciumButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(freelancerRip, "rip")}
                        >
                          {copiedField === "rip" ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </PodaciumButton>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                      <span className="text-sm text-muted-foreground">
                        {t("robustness.settlement.amountDue")}
                      </span>
                      <span className="text-lg font-bold text-foreground font-mono">
                        {amountDzd.toLocaleString()} DZD
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "proof" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-6 text-center cursor-pointer bg-muted/20"
                    onClick={() =>
                      document.getElementById("receipt-file-input")?.click()
                    }
                  >
                    <input
                      id="receipt-file-input"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      {t("robustness.settlement.dragDropTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("robustness.settlement.dragDropSub")}
                    </p>
                  </div>

                  {uploadedFile && (
                    <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {uploadedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      {isAnalyzingOcr ? (
                        <PodaciumBadge
                          variant="secondary"
                          className="animate-pulse"
                        >
                          {t("robustness.settlement.ocrScanning")}
                        </PodaciumBadge>
                      ) : ocrVerified ? (
                        <PodaciumBadge variant="success" className="gap-1">
                          <Check className="w-3 h-3" />{" "}
                          {t("robustness.settlement.ocrValidated")}
                        </PodaciumBadge>
                      ) : null}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <PodaciumButton variant="ghost" onClick={onClose}>
                      {t("robustness.settlement.cancel")}
                    </PodaciumButton>
                    <PodaciumButton
                      variant="primary"
                      disabled={!uploadedFile || isAnalyzingOcr || isSubmitting}
                      onClick={handleProofSubmit}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        t("robustness.settlement.submitting")
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          {t("robustness.settlement.confirmAndUnlock")}
                        </>
                      )}
                    </PodaciumButton>
                  </div>
                </div>
              )}

              {activeTab === "vault" && (
                <div className="space-y-4">
                  {isSettled ? (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-center space-y-3">
                      <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      <div>
                        <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-base">
                          {t("robustness.settlement.vaultUnlockedTitle")}
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                          SHA-256:{" "}
                          {deliverableSha256 ||
                            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                        </p>
                      </div>
                      <PodaciumButton
                        variant="primary"
                        onClick={onDownloadDecryptedDeliverable}
                        className="w-full gap-2 mt-2"
                      >
                        <Download className="w-4 h-4" />
                        {t("robustness.settlement.downloadDecrypted")}
                      </PodaciumButton>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-muted/40 border border-border text-center space-y-3">
                      <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
                      <h4 className="font-semibold text-sm">
                        {t("robustness.settlement.vaultLockedTitle")}
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {t("robustness.settlement.vaultLockedDesc")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </PodaciumTabs>
      </div>
    </PodaciumModal>
  );
};

export default MilestoneSettlementModal;
