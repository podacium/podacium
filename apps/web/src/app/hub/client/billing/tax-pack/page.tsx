"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  ShieldCheck,
  Download,
  AlertCircle,
  Calendar,
  Building2,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import { formatDZD } from "@/lib/formatDZD";

interface TaxPackInvoice {
  invoice_number: string;
  type: string;
  amount_dzd: number;
  legal_notice: string;
}

interface ClientTaxDeductionPack {
  client_id: number;
  client_name: string;
  fiscal_year: number;
  total_freelancer_expenses_dzd: number;
  total_platform_fees_dzd: number;
  total_tva_paid_dzd: number;
  total_deductible_expense_dzd: number;
  estimated_ibs_tax_savings_19_percent: number;
  estimated_ibs_tax_savings_26_percent: number;
  invoices: TaxPackInvoice[];
  tax_basis_legal_reference: string;
  generated_at: string;
}

export default function ClientTaxPackPage() {
  const t = useTranslations("hub");
  const { dir } = useBidi();

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [pack, setPack] = useState<ClientTaxDeductionPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<ClientTaxDeductionPack>(
        `/api/v1/invoices/fiscal/tax-deduction-pack/${selectedYear}`,
      )
      .then((res: ClientTaxDeductionPack) => {
        setPack(res);
      })
      .catch((err: any) => {
        console.error("Failed to load tax deduction pack:", err);
        setError(t("taxPack.loadError"));
      })
      .finally(() => setLoading(false));
  }, [selectedYear, t]);

  const handlePrintPack = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pt-24 sm:pt-28 pb-12 space-y-6" dir={dir}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t("taxPack.title")}
            </h1>
            <PodaciumBadge variant="success">
              {t("taxPack.badge")}
            </PodaciumBadge>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("taxPack.subtitle")}
          </p>
        </div>

        {/* Year Selector & Print */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>

          <PodaciumButton
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={handlePrintPack}
            disabled={!pack}
          >
            <Download className="w-4 h-4" />
            {t("taxPack.downloadPack")}
          </PodaciumButton>
        </div>
      </header>

      {/* Legal Basis Banner (Article 169 CIDTA) */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">
              {t("taxPack.banner.title")}
            </h2>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              {t("taxPack.banner.description")}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-slate-500">
          {t("taxPack.loading")}
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {pack && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxPack.metrics.totalDeductible")}
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {formatDZD(pack.total_deductible_expense_dzd)}
              </div>
              <p className="text-xs text-slate-500">
                {t("taxPack.metrics.totalDeductibleHint")}
              </p>
            </PodaciumCard>

            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxPack.metrics.ibsSavings19")}
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatDZD(pack.estimated_ibs_tax_savings_19_percent)}
              </div>
              <p className="text-xs text-slate-500">
                {t("taxPack.metrics.ibsSavings19Hint")}
              </p>
            </PodaciumCard>

            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxPack.metrics.ibsSavings26")}
              </span>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {formatDZD(pack.estimated_ibs_tax_savings_26_percent)}
              </div>
              <p className="text-xs text-slate-500">
                {t("taxPack.metrics.ibsSavings26Hint")}
              </p>
            </PodaciumCard>
          </div>

          {/* Invoices Manifest */}
          <PodaciumCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("taxPack.manifest.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("taxPack.manifest.subtitle")}
                </p>
              </div>
              <PodaciumBadge variant="outline">
                {pack.invoices.length} {t("taxPack.manifest.invoicesCount")}
              </PodaciumBadge>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {pack.invoices.map((inv: TaxPackInvoice) => (
                <div
                  key={inv.invoice_number}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {inv.invoice_number}
                      </span>
                      <PodaciumBadge
                        variant={
                          inv.type === "FREELANCER_SERVICE"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {inv.type === "FREELANCER_SERVICE"
                          ? t("taxPack.manifest.freelancerType")
                          : t("taxPack.manifest.platformType")}
                      </PodaciumBadge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {inv.legal_notice}
                    </p>
                  </div>
                  <div className="text-end font-bold text-sm text-slate-900 dark:text-slate-100 flex-shrink-0">
                    {formatDZD(inv.amount_dzd)}
                  </div>
                </div>
              ))}
            </div>
          </PodaciumCard>
        </>
      )}
    </div>
  );
}
