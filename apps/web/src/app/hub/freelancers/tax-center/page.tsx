"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  ShieldCheck,
  TrendingUp,
  Download,
  AlertCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import { formatDZD } from "@/lib/formatDZD";

interface QuarterlyBreakdown {
  quarter: string;
  turnover_dzd: number;
  ifu_tax_due_dzd: number;
  invoice_count: number;
}

interface FreelancerG50Report {
  freelancer_id: number;
  freelancer_name: string;
  anae_card_number: string;
  fiscal_year: number;
  total_turnover_dzd: number;
  total_ifu_tax_due_dzd: number;
  turnover_ceiling_dzd: number;
  ceiling_utilization_percent: number;
  is_ceiling_exceeded: boolean;
  quarterly_breakdown: QuarterlyBreakdown[];
  tax_regime: string;
  generated_at: string;
}

export default function FreelancerTaxCenterPage() {
  const t = useTranslations("hub");
  const { dir } = useBidi();

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [report, setReport] = useState<FreelancerG50Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<FreelancerG50Report>(`/api/v1/invoices/fiscal/g50/${selectedYear}`)
      .then((res: FreelancerG50Report) => {
        setReport(res);
      })
      .catch((err: any) => {
        console.error("Failed to load G50 report:", err);
        setError(t("taxCenter.loadError"));
      })
      .finally(() => setLoading(false));
  }, [selectedYear, t]);

  const handlePrintG50 = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pt-24 sm:pt-28 pb-12 space-y-6" dir={dir}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t("taxCenter.title")}
            </h1>
            <PodaciumBadge variant="secondary">
              {t("taxCenter.statuteBadge")}
            </PodaciumBadge>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("taxCenter.subtitle")}
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
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handlePrintG50}
            disabled={!report}
          >
            <Download className="w-4 h-4" />
            {t("taxCenter.downloadG50")}
          </PodaciumButton>
        </div>
      </header>

      {/* Statutory IFU 0.5% & Loi 22-23 Legal Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold text-indigo-900 dark:text-indigo-100">
              {t("taxCenter.banner.title")}
            </h2>
            <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
              {t("taxCenter.banner.description")}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-slate-500">
          {t("taxCenter.loading")}
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {report && !loading && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxCenter.metrics.turnover")}
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {formatDZD(report.total_turnover_dzd)}
              </div>
              <p className="text-xs text-slate-500">
                {t("taxCenter.metrics.turnoverHint", { year: selectedYear })}
              </p>
            </PodaciumCard>

            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxCenter.metrics.ifuTaxDue")}
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatDZD(report.total_ifu_tax_due_dzd)}
              </div>
              <p className="text-xs text-slate-500">
                {t("taxCenter.metrics.ifuTaxHint")}
              </p>
            </PodaciumCard>

            <PodaciumCard className="p-5 space-y-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("taxCenter.metrics.ceiling")}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {report.ceiling_utilization_percent}%
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {t(
                    "taxCenter.metrics.ceilingLimit",
                    { limit: formatDZD(5000000) },
                    `Max ${formatDZD(5000000)}`,
                  )}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full ${
                    report.is_ceiling_exceeded ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(report.ceiling_utilization_percent, 100)}%`,
                  }}
                />
              </div>
            </PodaciumCard>
          </div>

          {/* Quarterly Breakdown Schedule */}
          <PodaciumCard className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t("taxCenter.schedule.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("taxCenter.schedule.subtitle")}
                </p>
              </div>
              <PodaciumBadge variant="outline">
                {report.tax_regime}
              </PodaciumBadge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {report.quarterly_breakdown.map((q: QuarterlyBreakdown) => (
                <div
                  key={q.quarter}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {t("taxCenter.schedule.quarterLabel", {
                        quarter: q.quarter,
                      })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {q.invoice_count} {t("taxCenter.schedule.invoices")}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("taxCenter.schedule.turnover")}:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDZD(q.turnover_dzd)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>{t("taxCenter.schedule.ifuDue")}:</span>
                      <span className="font-bold">
                        {formatDZD(q.ifu_tax_due_dzd)}
                      </span>
                    </div>
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
