"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Lock,
  Clock,
  ShieldCheck,
  Plus,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Info,
  PackageCheck,
  FileCheck2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api, OrganizationResponse } from "@/lib/api";

import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import CorporateTopUpModal from "./CorporateTopUpModal";
import FactureProformaModal from "./FactureProformaModal";

export interface OrganizationTreasuryTabProps {
  organization: OrganizationResponse;
  isAdminOrOwner?: boolean;
}

export function OrganizationTreasuryTab({
  organization,
  isAdminOrOwner = true,
}: OrganizationTreasuryTabProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [treasury, setTreasury] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isProformaOpen, setIsProformaOpen] = useState(false);
  const [selectedInvoiceKit, setSelectedInvoiceKit] = useState<any | null>(
    null,
  );

  const loadTreasuryData = useCallback(async () => {
    try {
      setLoading(true);
      const [treasuryRes, invoicesRes] = await Promise.allSettled([
        api.getOrganizationTreasury(organization.id),
        api.getOrganizationInvoices(organization.id),
      ]);

      if (treasuryRes.status === "fulfilled") {
        setTreasury(treasuryRes.value);
      } else {
        // Fallback baseline for treasury
        setTreasury({
          availableBalanceDzd: 0,
          inEscrowDzd: 0,
          pendingClearanceDzd: 0,
          timbreFiscalExempt: true,
        });
      }

      if (invoicesRes.status === "fulfilled" && invoicesRes.value?.invoices) {
        setInvoices(invoicesRes.value.invoices);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error("Error loading treasury:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [organization.id]);

  useEffect(() => {
    loadTreasuryData();
  }, [loadTreasuryData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTreasuryData();
  };

  const handleDownloadInvoice = (inv: any) => {
    window.open(`/api/invoices/${inv.id}/download`, "_blank");
  };

  const formatDzd = (val: number = 0) => {
    return val.toLocaleString("fr-DZ");
  };

  return (
    <div className="space-y-6 pt-4" data-testid="organization-treasury-center">
      {/* Treasury Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {t("organizations.treasuryTitle")}
            </h3>
            <PodaciumBadge
              variant="success"
              className="text-[10px] font-mono uppercase tracking-wider flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{t("organizations.treasury.timbreExemptBadge")}</span>
            </PodaciumBadge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("organizations.treasuryDesc")}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {t("organizations.treasury.refresh")}
          </PodaciumButton>

          {isAdminOrOwner && (
            <>
              <PodaciumButton
                variant="outline"
                size="sm"
                icon={<FileText className="w-3.5 h-3.5" />}
                onClick={() => setIsProformaOpen(true)}
                data-testid="request-proforma-btn"
              >
                {t("organizations.treasury.proformaAction")}
              </PodaciumButton>

              <PodaciumButton
                variant="primary"
                size="sm"
                glow
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsTopUpOpen(true)}
                data-testid="top-up-deposit-btn"
              >
                {t("organizations.treasury.topUpAction")}
              </PodaciumButton>
            </>
          )}
        </div>
      </div>

      {/* Corporate Wallet Balance Cards (3 Pillars + Timbre Fiscal Indicator) */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        data-testid="treasury-balance-cards"
      >
        {/* 1. Available Balance */}
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 relative overflow-hidden transition-all hover:shadow-md hover:border-emerald-500/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {t("organizations.treasury.availableBalance")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="text-3xl font-bold font-mono text-emerald-950 dark:text-emerald-100 tracking-tight"
              data-testid="available-balance-amount"
            >
              {formatDzd(treasury?.availableBalanceDzd || 0)}
            </span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-mono">
              DZD
            </span>
          </div>

          <p className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
            {t("billing.spendable_desc")}
          </p>
        </div>

        {/* 2. In Escrow */}
        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 relative overflow-hidden transition-all hover:shadow-md hover:border-amber-500/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {t("organizations.treasury.inEscrow")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="text-3xl font-bold font-mono text-amber-950 dark:text-amber-100 tracking-tight"
              data-testid="in-escrow-amount"
            >
              {formatDzd(treasury?.inEscrowDzd || 0)}
            </span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 font-mono">
              DZD
            </span>
          </div>

          <p className="mt-2 text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
            {t("billing.escrow_tooltip")}
          </p>
        </div>

        {/* 3. Pending Clearance */}
        <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 relative overflow-hidden transition-all hover:shadow-md hover:border-blue-500/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              {t("organizations.treasury.pendingClearance")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="text-3xl font-bold font-mono text-blue-950 dark:text-blue-100 tracking-tight"
              data-testid="pending-clearance-amount"
            >
              {formatDzd(treasury?.pendingClearanceDzd || 0)}
            </span>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400 font-mono">
              DZD
            </span>
          </div>

          <p className="mt-2 text-[11px] text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
            {t("organizations.treasury.timbreExemptNote")}
          </p>
        </div>
      </div>

      {/* Timbre Fiscal Exemption Notice Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-foreground">
            {t("organizations.treasury.timbreExemptBadge")}
          </span>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="text-muted-foreground">
            {t("organizations.treasury.timbreExemptNote")}
          </span>
        </div>
        <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
          {t("organizations.treasury.stampDutyZero")}
        </div>
      </div>

      {/* Corporate Invoice History Table */}
      <PodaciumCard
        className="p-6 space-y-4"
        data-testid="corporate-invoices-section"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-base font-bold text-foreground">
              {t("organizations.treasury.invoicesTitle")}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("organizations.treasury.invoicesDesc")}
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t("organizations.treasury.noInvoices")}
            </p>
            {isAdminOrOwner && (
              <PodaciumButton
                size="sm"
                variant="outline"
                onClick={() => setIsProformaOpen(true)}
                icon={<FileText className="w-3.5 h-3.5" />}
              >
                {t("organizations.treasury.proformaAction")}
              </PodaciumButton>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase text-[11px] font-semibold">
                  <th className="py-3 px-3 text-start">
                    {t("organizations.treasury.invoiceNumber")}
                  </th>
                  <th className="py-3 px-3 text-start">
                    {t("organizations.treasury.invoiceDate")}
                  </th>
                  <th className="py-3 px-3 text-start">
                    {t("organizations.treasury.invoiceDescription")}
                  </th>
                  <th className="py-3 px-3 text-end">
                    {t("organizations.treasury.invoiceAmount")}
                  </th>
                  <th className="py-3 px-3 text-center">
                    {t("organizations.treasury.invoiceStatus")}
                  </th>
                  <th className="py-3 px-3 text-end">
                    {t("organizations.treasury.invoiceActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-foreground">
                      {inv.invoiceNumber || `INV-${inv.id}`}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {inv.issuedAt
                        ? new Date(inv.issuedAt).toLocaleDateString("fr-DZ")
                        : "—"}
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground max-w-xs truncate">
                      {inv.description || "Corporate Service Package"}
                    </td>
                    <td className="py-3 px-3 text-end font-mono font-bold text-foreground whitespace-nowrap">
                      {formatDzd(inv.amount || 0)} DZD
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <PodaciumBadge
                        variant={
                          inv.status === "PAID"
                            ? "success"
                            : inv.status === "PENDING"
                              ? "warning"
                              : "outline"
                        }
                        className="text-[10px] font-mono"
                      >
                        {inv.status}
                      </PodaciumBadge>
                    </td>
                    <td className="py-3 px-3 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <PodaciumButton
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => handleDownloadInvoice(inv)}
                          title={t("organizations.treasury.downloadPdf")}
                        >
                          <Download className="w-3.5 h-3.5 me-1" />
                          <span>PDF</span>
                        </PodaciumButton>

                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-medium"
                          onClick={() => setSelectedInvoiceKit(inv)}
                          title={t("organizations.treasury.tripleKit")}
                        >
                          <PackageCheck className="w-3.5 h-3.5 me-1 text-primary" />
                          <span>{t("organizations.treasury.tripleKit")}</span>
                        </PodaciumButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PodaciumCard>

      {/* Triple Document Kit Modal */}
      {selectedInvoiceKit && (
        <PodaciumModal
          isOpen={Boolean(selectedInvoiceKit)}
          onClose={() => setSelectedInvoiceKit(null)}
          title={t("organizations.treasury.tripleKit")}
          description={t("organizations.treasury.invoicesDesc")}
          size="md"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <div className="font-semibold text-foreground">
                {selectedInvoiceKit.invoiceNumber ||
                  `INV-${selectedInvoiceKit.id}`}
              </div>
              <div className="text-muted-foreground font-mono mt-0.5">
                {`${formatDzd(selectedInvoiceKit.amount || 0)} DZD · ${selectedInvoiceKit.status}`}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-semibold text-foreground">
                      {t("organizations.treasury.anaeInvoice")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("organizations.treasury.kitAnaeLaw")}
                    </div>
                  </div>
                </div>
                <PodaciumButton
                  size="sm"
                  variant="outline"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownloadInvoice(selectedInvoiceKit)}
                >
                  PDF
                </PodaciumButton>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-foreground">
                      {t("organizations.treasury.pvReception")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("organizations.treasury.kitPvDesc")}
                    </div>
                  </div>
                </div>
                <PodaciumButton
                  size="sm"
                  variant="outline"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownloadInvoice(selectedInvoiceKit)}
                >
                  PDF
                </PodaciumButton>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold text-foreground">
                      {t("organizations.treasury.commissionInvoice")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("organizations.treasury.kitCommissionDesc")}
                    </div>
                  </div>
                </div>
                <PodaciumButton
                  size="sm"
                  variant="outline"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleDownloadInvoice(selectedInvoiceKit)}
                >
                  PDF
                </PodaciumButton>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoiceKit(null)}
              >
                {t("common.close")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      )}

      {/* Top-Up Modal */}
      <CorporateTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        organization={organization}
        onSuccess={loadTreasuryData}
      />

      {/* Facture Proforma Modal */}
      <FactureProformaModal
        isOpen={isProformaOpen}
        onClose={() => setIsProformaOpen(false)}
        organization={organization}
        onSuccess={loadTreasuryData}
      />
    </div>
  );
}

export default OrganizationTreasuryTab;
