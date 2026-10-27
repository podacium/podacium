"use client";

import React, { useState } from "react";
import {
  Table,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
} from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";

export interface DLGEntryPreview {
  account_code: string;
  account_label: string;
  scf_category: string;
  badge_color: string;
  debit_dzd: number;
  credit_dzd: number;
  transaction_date?: string;
  libelle?: string;
}

export interface DLGUploadPreviewProps {
  encoding: string;
  delimiter: string;
  totalEntries: number;
  totalDebitDzd: number;
  totalCreditDzd: number;
  isBalanced: boolean;
  negativeCashDetected: boolean;
  warnings?: string[];
  sampleEntries: DLGEntryPreview[];
  onConfirmImport?: () => void;
  className?: string;
}

export const DLGUploadPreview: React.FC<DLGUploadPreviewProps> = ({
  encoding,
  delimiter,
  totalEntries,
  totalDebitDzd,
  totalCreditDzd,
  isBalanced,
  negativeCashDetected,
  warnings = [],
  sampleEntries,
  onConfirmImport,
  className,
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground">
            {t("robustness.dlg.encoding") ||
              (isRTL ? "الترميز المكتشف:" : "Encodage Fichier")}
          </span>
          <p className="text-sm font-semibold font-mono mt-0.5">
            {encoding.toUpperCase()}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground">
            {t("robustness.dlg.delimiter") ||
              (isRTL ? "فاصل الحقول:" : "Séparateur")}
          </span>
          <p className="text-sm font-semibold font-mono mt-0.5">
            {delimiter === ";"
              ? t("bi.datasets.upload.semicolon")
              : delimiter === "\t"
                ? "Tabulation (\\t)"
                : delimiter}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground">
            {t("robustness.dlg.entriesCount") ||
              (isRTL ? "إجمالي الحركات:" : "Lignes Écritures")}
          </span>
          <p className="text-sm font-semibold font-mono mt-0.5">
            {totalEntries.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground">
            {t("robustness.dlg.balanced") ||
              (isRTL ? "توازن اليومية:" : "Équilibre Débit/Crédit")}
          </span>
          <div className="mt-0.5">
            {isBalanced ? (
              <PodaciumBadge variant="success" className="text-xs">
                {t("robustness.dlg.balanced") ||
                  (isRTL ? "متوازن" : "Équilibré")}
              </PodaciumBadge>
            ) : (
              <PodaciumBadge variant="destructive" className="text-xs">
                {t("robustness.dlg.unbalanced") ||
                  (isRTL ? "غير متوازن" : "Déséquilibré")}
              </PodaciumBadge>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              {t("robustness.dlg.complianceWarnings") ||
                (isRTL
                  ? "تنبيهات التدقيق المحاسبي (SCF):"
                  : "Avertissements de Conformité SCF :")}
            </span>
          </div>
          <ul className="list-disc list-inside ps-4 space-y-0.5">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabular Preview */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("robustness.dlg.previewTitle") ||
                (isRTL
                  ? "معاينة التصنيف الآلي لدليل الحسابات (SCF Algérie)"
                  : "Aperçu de la Classification SCF Algérie")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {t("robustness.dlg.sampleCount", { count: sampleEntries.length })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="py-2 px-3 text-start">
                  {t("robustness.dlg.accountNumber") ||
                    (isRTL ? "رقم الحساب" : "N° Compte")}
                </th>
                <th className="py-2 px-3 text-start">
                  {t("robustness.dlg.classification") ||
                    (isRTL ? "تصنيف SCF" : "Classification SCF")}
                </th>
                <th className="py-2 px-3 text-start">
                  {t("robustness.dlg.label") ||
                    (isRTL ? "البيان" : "Libellé Écriture")}
                </th>
                <th className="py-2 px-3 text-end">
                  {t("robustness.dlg.debit") ||
                    (isRTL ? "مدين (DZD)" : "Débit (DZD)")}
                </th>
                <th className="py-2 px-3 text-end">
                  {t("robustness.dlg.credit") ||
                    (isRTL ? "دائن (DZD)" : "Crédit (DZD)")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sampleEntries.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3 font-mono font-medium">
                    {row.account_code}
                  </td>
                  <td className="py-2 px-3">
                    <PodaciumBadge variant="secondary" className="text-[10px]">
                      {row.account_label}
                    </PodaciumBadge>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">
                    {row.libelle || "-"}
                  </td>
                  <td className="py-2 px-3 text-end font-mono">
                    {row.debit_dzd > 0 ? row.debit_dzd.toLocaleString() : "-"}
                  </td>
                  <td className="py-2 px-3 text-end font-mono">
                    {row.credit_dzd > 0 ? row.credit_dzd.toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onConfirmImport && (
        <div className="flex justify-end gap-2 pt-2">
          <PodaciumButton
            variant="primary"
            onClick={onConfirmImport}
            className="gap-2"
          >
            <Database className="w-4 h-4" />
            <span>
              {t("robustness.dlg.confirmImport") ||
                (isRTL
                  ? "تأكيد استيراد البيانات إلى لوحة التحكم"
                  : "Confirmer et Injecter les Données BI")}
            </span>
          </PodaciumButton>
        </div>
      )}
    </div>
  );
};

export default DLGUploadPreview;
