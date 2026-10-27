"use client";

import React, { useState } from "react";
import { ShieldCheck, Download, Loader2, Info } from "lucide-react";
import { PodaciumButton, PodaciumTooltip } from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface FiscalDefensePackButtonProps {
  invoiceId: number;
  invoiceNumber: string;
  totalDzd: number;
  className?: string;
  variant?: "primary" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export const FiscalDefensePackButton: React.FC<
  FiscalDefensePackButtonProps
> = ({
  invoiceId,
  invoiceNumber,
  totalDzd,
  className,
  variant = "primary",
  size = "default",
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();
  const [isDownloading, setIsDownloading] = useState(false);

  // Estimate 26% IBS tax savings for Algerian corporate client
  const estimatedIbsSavings = Math.round(totalDzd * 0.26);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/v1/invoices/${invoiceId}/defense-pack`,
        {
          method: "GET",
          headers: {
            Accept: "application/zip",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to download fiscal defense pack");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Dossier_Fiscal_${invoiceNumber}_IBS100.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Defense pack download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const tooltipText =
    t("robustness.fiscal.defensePackTooltip") ||
    (isRTL
      ? `ملف ضريبي كامل وموقع إلكترونيًا (العقد، محضر الاستلام، الفاتورة، ومذكرة المادة 169 CIDTA) لخصم 100% من ضريبة الشركات IBS (توفير حوالي ${estimatedIbsSavings.toLocaleString()} دج).`
      : `Dossier fiscal certifié (Contrat, PV, Facture ANAE, Mémorandum Art. 169 CIDTA) garantissant la déductibilité intégrale à 100% de l'IBS (~${estimatedIbsSavings.toLocaleString()} DZD d'économie).`);

  const buttonText =
    t("robustness.fiscal.defensePackButton") ||
    (isRTL
      ? "تحميل الملف الضريبي (خصم 100% IBS)"
      : "Dossier Fiscal (100% Déductible IBS)");

  return (
    <PodaciumTooltip content={tooltipText} position="top">
      <PodaciumButton
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={isDownloading}
        className={className}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        )}
        <span>{buttonText}</span>
      </PodaciumButton>
    </PodaciumTooltip>
  );
};

export default FiscalDefensePackButton;
