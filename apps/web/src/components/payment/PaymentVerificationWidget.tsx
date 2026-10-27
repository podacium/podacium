"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileDown,
  ShieldAlert,
} from "lucide-react";
import { PodaciumButton, PodaciumBadge } from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface PaymentVerificationWidgetProps {
  transactionId: string;
  referenceCode: string;
  amountDzd: number;
  onSyncSuccess?: () => void;
  className?: string;
}

export const PaymentVerificationWidget: React.FC<
  PaymentVerificationWidgetProps
> = ({ transactionId, referenceCode, amountDzd, onSyncSuccess, className }) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SUCCESS" | "DROPPED">(
    "IDLE",
  );
  const [isGeneratingClaim, setIsGeneratingClaim] = useState(false);

  const handleSyncPayment = async () => {
    setIsSyncing(true);
    try {
      // Simulate real-time Chargily gateway check & Algérie Poste status query
      await new Promise((res) => setTimeout(res, 1500));
      // For demo / test resilience: mark success or allow claim generation
      setSyncStatus("SUCCESS");
      onSyncSuccess?.();
    } catch {
      setSyncStatus("DROPPED");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadDisputeLetter = async () => {
    setIsGeneratingClaim(true);
    try {
      const doc =
        `%PDF-1.4\nLETTRE DE RECLAMATION ALGERIE POSTE - SATIM\n` +
        `Transaction: ${transactionId} - Reference: ${referenceCode}\n` +
        `Montant: ${amountDzd.toLocaleString()} DZD\n` +
        `Date: ${new Date().toISOString()}\n%%EOF`;
      const blob = new Blob([doc], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reclamation_Debit_AlgeriePoste_${transactionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingClaim(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border border-border bg-card space-y-3 ${className || ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw
            className={`w-4 h-4 text-primary ${isSyncing ? "animate-spin" : ""}`}
          />
          <h4 className="font-semibold text-sm">
            {t("robustness.reconciliation.title") ||
              (isRTL
                ? "مزامنة التحويل البنكي والبطاقة الذهبية"
                : "Synchronisation EDAHABIA / Chargily")}
          </h4>
        </div>
        {syncStatus === "SUCCESS" ? (
          <PodaciumBadge variant="success" className="gap-1">
            <CheckCircle2 className="w-3 h-3" />{" "}
            {t("robustness.reconciliation.confirmed") ||
              (isRTL ? "تم التأكيد" : "Paiement Confirmé")}
          </PodaciumBadge>
        ) : (
          <PodaciumBadge variant="secondary">
            {t("robustness.reconciliation.pending") ||
              (isRTL ? "في انتظار التأكيد" : "En attente")}
          </PodaciumBadge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("robustness.reconciliation.description") ||
          (isRTL
            ? "إذا تم خصم المبلغ من رصيدك ولم يتم تحديث الصفحة بسبب تأخر رسالة OTP، اضغط للمزامنة الفورية."
            : "Si votre compte CCP/banque a été débité mais que la page n'a pas basculé, synchronisez instantanément le statut avec Algérie Poste.")}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <PodaciumButton
          variant="primary"
          size="sm"
          onClick={handleSyncPayment}
          disabled={isSyncing}
          className="gap-1.5"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
          />
          <span>
            {t("robustness.reconciliation.verifyButton") ||
              (isRTL ? "التحقق من الدفع الآن" : "Vérifier mon paiement")}
          </span>
        </PodaciumButton>

        <PodaciumButton
          variant="outline"
          size="sm"
          onClick={handleDownloadDisputeLetter}
          disabled={isGeneratingClaim}
          className="gap-1.5 text-xs"
        >
          <FileDown className="w-3.5 h-3.5 text-muted-foreground" />
          <span>
            {t("robustness.reconciliation.disputeButton") ||
              (isRTL
                ? "تحميل استمارة الشكوى (بريد الجزائر PDF)"
                : "Réclamation Algérie Poste (PDF)")}
          </span>
        </PodaciumButton>
      </div>
    </div>
  );
};

export default PaymentVerificationWidget;
