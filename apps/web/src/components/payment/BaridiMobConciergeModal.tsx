"use client";

import React, { useState, useRef } from "react";
import {
  Copy,
  Check,
  UploadCloud,
  FileCheck,
  AlertCircle,
  Building,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  PodaciumModal,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { useTranslations, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface BaridiMobConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  amountDzd: number;
  corporateRip?: string;
  corporateName?: string;
  onSubmitReceipt?: (file: File, orderCode: string) => Promise<void>;
  className?: string;
}

export const BaridiMobConciergeModal: React.FC<
  BaridiMobConciergeModalProps
> = ({
  isOpen,
  onClose,
  orderCode,
  amountDzd,
  corporateRip = "00799999000123456787",
  corporateName = "SARL PODACIUM BI & TECH",
  onSubmitReceipt,
  className,
}) => {
  const { t } = useTranslations();
  const locale = useLocale();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRip, setCopiedRip] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      setErrorMessage(
        t(
          "billing.invalid_file_type",
          "Format non supporté. Veuillez importer un fichier JPG, PNG ou PDF.",
        ),
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(
        t(
          "billing.file_too_large",
          "Fichier trop volumineux. La taille maximale est de 10 Mo.",
        ),
      );
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage(
        t(
          "billing.select_receipt_prompt",
          "Veuillez téléverser votre reçu avant de confirmer.",
        ),
      );
      return;
    }

    if (!onSubmitReceipt) {
      setUploadSuccess(true);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await onSubmitReceipt(selectedFile, orderCode);
      setUploadSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || t("billing.upload_failed", "Échec de l'envoi du reçu."),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatAmount = (num: number) => {
    const numberLocale =
      locale === "ar" ? "ar-DZ" : locale === "kab" ? "fr-DZ" : locale;
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(
        "billing.baridimob_concierge_title",
        "Paiement Concierge BaridiMob / CCP",
      )}
      description={t(
        "billing.baridimob_concierge_subtitle",
        "Virement direct par BaridiMob ou dépôt au bureau de poste Algérie Poste",
      )}
      size="lg"
      className={className}
    >
      <div className="space-y-6 pt-2" data-testid="baridimob-concierge-modal">
        {/* Order Reference Banner */}
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                {t("billing.order_reference_code", "Code Unique de Commande")}
              </span>
              <p className="text-xl font-mono font-bold text-foreground mt-0.5 tracking-wider">
                {orderCode}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PodaciumButton
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(orderCode, setCopiedCode)}
                data-testid="copy-order-code-btn"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 me-1" />
                ) : (
                  <Copy className="w-4 h-4 me-1" />
                )}
                {copiedCode
                  ? t("common.copied", "Copié")
                  : t("common.copy", "Copier")}
              </PodaciumButton>
              <PodaciumBadge
                variant="default"
                className="font-mono text-sm py-1 px-3"
              >
                {formatAmount(amountDzd)} DZD
              </PodaciumBadge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 inline me-1 text-primary" />
            {t(
              "billing.order_code_warning",
              "Mentionnez obligatoirement ce code dans la case « Libellé / Communication » sur l'application BaridiMob.",
            )}
          </p>
        </div>

        {/* Corporate Postal Slip (Bordereau Algérie Poste) Preview */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t(
                  "billing.postal_slip_details",
                  "Bordereau de Versement CCP / Algérie Poste",
                )}
              </span>
            </div>
            <PodaciumBadge variant="success" className="text-[10px]">
              <ShieldCheck className="w-3 h-3 me-1" />
              {t("billing.verified_corporate", "Compte Vérifié")}
            </PodaciumBadge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block">
                {t("billing.beneficiary", "Bénéficiaire")}:
              </span>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {corporateName}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground block">
                {t("billing.rip_number", "RIP Algérie Poste (20 chiffres)")}:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-semibold text-foreground text-sm tracking-wide">
                  {corporateRip
                    .replace(/\s+/g, "")
                    .replace(/(\d{3})(\d{5})(\d{10})(\d{2})/, "$1 $2 $3 $4")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      corporateRip.replace(/\s+/g, ""),
                      setCopiedRip,
                    )
                  }
                  className="text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={t("billing.copy_rip", "Copier le RIP")}
                  data-testid="copy-rip-btn"
                >
                  {copiedRip ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground block">
                {t("billing.exact_amount", "Montant Exact")}:
              </span>
              <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                {formatAmount(amountDzd)} DZD
              </p>
            </div>

            <div>
              <span className="text-muted-foreground block">
                {t("billing.mandate_libelle", "Libellé de Virement")}:
              </span>
              <p className="font-mono font-bold text-primary text-sm mt-0.5">
                {orderCode}
              </p>
            </div>
          </div>
        </div>

        {/* Drag-and-Drop Receipt Slip Upload Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t(
                "billing.upload_receipt_slip",
                "Téléverser le Reçu BaridiMob / Récépissé Postal",
              )}
            </label>
            <span className="text-[11px] text-muted-foreground">
              {t("billing.supported_formats", "JPG, PNG, PDF (Max 10 Mo)")}
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label={t(
              "billing.upload_receipt_slip",
              "Téléverser le Reçu BaridiMob / Récépissé Postal",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              selectedFile
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-border hover:border-primary/50 bg-muted/40",
            )}
            data-testid="receipt-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={handleFileInputChange}
              data-testid="receipt-file-input"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <FileCheck className="w-10 h-10 text-emerald-700 dark:text-emerald-400 mb-2" />
                <p className="text-xs font-semibold text-foreground font-mono">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)}{" "}
                  {t("billing.mb_unit", "Mo")} —{" "}
                  {t("billing.click_to_change", "Cliquer pour changer")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-xs font-semibold text-foreground">
                  {t(
                    "billing.drag_receipt_here",
                    "Glissez-déposez la capture ou cliquez pour parcourir",
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t(
                    "billing.ocr_auto_scan",
                    "Notre système OCR validera automatiquement le montant et le numéro de transaction.",
                  )}
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <p
              className="text-xs text-destructive font-medium"
              data-testid="upload-error"
            >
              {errorMessage}
            </p>
          )}

          {uploadSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                {t(
                  "billing.receipt_submitted_success",
                  "Reçu transmis avec succès ! La validation administrative prend en moyenne moins de 30 minutes.",
                )}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isUploading}
          >
            {t("common.close", "Fermer")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            glow
            onClick={handleSubmit}
            loading={isUploading}
            disabled={!selectedFile || isUploading || uploadSuccess}
            data-testid="submit-receipt-btn"
          >
            <FileText className="w-4 h-4 me-1.5" />
            {t("billing.submit_receipt_confirmation", "Confirmer le Dépôt")}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
};

export default BaridiMobConciergeModal;
