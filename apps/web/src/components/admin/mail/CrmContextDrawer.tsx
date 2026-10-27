"use client";

import React from "react";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  LifeBuoy,
  Scale,
  ExternalLink,
  Building,
  User,
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  GraduationCap,
  Wallet,
  Award,
  Star,
} from "lucide-react";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import { useTranslations } from "@/lib/i18n";

export interface CrmContextData {
  user?: {
    id: number;
    email: string;
    fullName?: string;
    role: string;
    kycStatus?: "VERIFIED" | "PENDING_REVIEW" | "UNVERIFIED" | "REJECTED";
    wilaya?: string;
    joinedAt?: string;
  } | null;
  education?: {
    enrolledCoursesCount: number;
    completedCoursesCount: number;
    averageProgressPct: number;
    certificatesCount?: number;
  } | null;
  freelance?: {
    activeContractsCount: number;
    totalEscrowDzd: number;
    ratingAverage?: number;
  } | null;
  financials?: {
    walletBalanceDzd: number;
    totalSpentDzd?: number;
  } | null;
  contract?: {
    id: number;
    title: string;
    status: string;
    amount?: number;
    currency?: string;
  } | null;
  dispute?: {
    id: number;
    reason: string;
    status: string;
  } | null;
  ticket?: {
    id: number;
    subject: string;
    status: string;
  } | null;
  invoice?: {
    id: number;
    invoiceNumber: string;
    status: string;
    totalAmount?: number;
  } | null;
}

interface CrmContextDrawerProps {
  crmContext?: CrmContextData | null;
  className?: string;
}

export function CrmContextDrawer({
  crmContext,
  className,
}: CrmContextDrawerProps) {
  const t = useTranslations();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasAnyData =
    crmContext &&
    (crmContext.user ||
      crmContext.education ||
      crmContext.freelance ||
      crmContext.financials ||
      crmContext.contract ||
      crmContext.ticket ||
      crmContext.dispute ||
      crmContext.invoice);

  if (!hasAnyData) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-border/70 bg-white/40 dark:bg-slate-900/40 text-center flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-2xl bg-secondary/80 flex items-center justify-center text-muted-foreground/60">
          <Building className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-foreground">
          {t("admin.mail.crm.noContext")}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
          {t("admin.mail.crm.noDataHint")}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className || ""}`}>
      {/* Drawer Section Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t("admin.mail.crm.title")}
          </span>
        </div>
        <PodaciumBadge variant="outline" className="text-[10px] py-0 px-2">
          {t("admin.mail.crm.contextBadge")}
        </PodaciumBadge>
      </div>

      {/* User KYC Identity Card */}
      {crmContext?.user && (
        <PodaciumCard className="p-3.5 border border-border/70 bg-gradient-to-br from-white/90 to-blue-50/30 dark:from-slate-900/90 dark:to-blue-950/20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {(crmContext.user.fullName || crmContext.user.email)
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {crmContext.user.fullName || "Platform User"}
                </p>
                <PodaciumBadge
                  variant="default"
                  className="text-[9px] py-0 px-1.5 uppercase"
                >
                  {crmContext.user.role}
                </PodaciumBadge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {crmContext.user.email}
              </p>
              {crmContext.user.kycStatus && (
                <div className="mt-1 flex items-center gap-1">
                  <ShieldCheck
                    className={`w-3 h-3 ${crmContext.user.kycStatus === "VERIFIED" ? "text-emerald-500" : "text-amber-500"}`}
                  />
                  <span
                    className={`text-[10px] font-semibold ${crmContext.user.kycStatus === "VERIFIED" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    KYC: {crmContext.user.kycStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        </PodaciumCard>
      )}

      {/* EdTech Education Progress Card */}
      {crmContext?.education && (
        <PodaciumCard className="p-3.5 border border-border/70 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">
                {t("admin.mail.crm.edtechProgress")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("admin.mail.crm.coursesCompleted", {
                  completed: crmContext.education.completedCoursesCount,
                  enrolled: crmContext.education.enrolledCoursesCount,
                })}
              </p>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, crmContext.education.averageProgressPct))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-end text-muted-foreground mt-1 font-mono">
              {t("admin.mail.crm.averageCompletion", {
                pct: crmContext.education.averageProgressPct,
              })}
            </p>
          </div>
        </PodaciumCard>
      )}

      {/* Financials & Wallet Card */}
      {crmContext?.financials && (
        <PodaciumCard className="p-3.5 border border-border/70 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">
                {t("admin.mail.crm.activeWallet")}
              </p>
              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {crmContext.financials.walletBalanceDzd.toLocaleString()} DZD
              </p>
            </div>
          </div>
        </PodaciumCard>
      )}

      {/* Freelance Hub Card */}
      {crmContext?.freelance && (
        <PodaciumCard className="p-3.5 border border-border/70 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">
                {t("admin.mail.crm.freelancing")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("admin.mail.crm.freelanceSummary", {
                  count: crmContext.freelance.activeContractsCount,
                  amount: crmContext.freelance.totalEscrowDzd.toLocaleString(),
                })}
              </p>
            </div>
          </div>
        </PodaciumCard>
      )}

      {/* Linked Contract Card */}
      {crmContext?.contract && (
        <PodaciumCard className="p-3.5 border border-border/70 hover:border-primary/40 transition-all shadow-2xs group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px]">
                  {crmContext.contract.title}
                </p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {t("admin.mail.crm.linkedContract")}
                  <span className="text-muted-foreground/50">
                    #CTR-{crmContext.contract.id}
                  </span>
                </span>
              </div>
            </div>
            <Link
              href={`/hub/contracts/${crmContext.contract.id}`}
              target="_blank"
              className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={t("admin.mail.crm.openContract")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
            <PodaciumBadge
              variant={
                crmContext.contract.status === "ACTIVE"
                  ? "success"
                  : crmContext.contract.status === "COMPLETED"
                    ? "default"
                    : "outline"
              }
              className="text-[10px] py-0"
            >
              {crmContext.contract.status}
            </PodaciumBadge>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `[CTR-${crmContext?.contract?.id}]`,
                  `ctr-${crmContext?.contract?.id}`,
                )
              }
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={t("admin.mail.crm.copyTagTitle")}
            >
              {copiedId === `ctr-${crmContext?.contract?.id}` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    {t("admin.mail.crm.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("admin.mail.crm.copyTag")}</span>
                </>
              )}
            </button>
          </div>
        </PodaciumCard>
      )}

      {/* Linked Ticket Card */}
      {crmContext?.ticket && (
        <PodaciumCard className="p-3.5 border border-border/70 hover:border-primary/40 transition-all shadow-2xs group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[170px]">
                  {crmContext.ticket.subject}
                </p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {t("admin.mail.crm.linkedTicket")}
                  <span className="text-muted-foreground/50">
                    #TICK-{crmContext.ticket.id}
                  </span>
                </span>
              </div>
            </div>
            <Link
              href={`/admin/tickets`}
              target="_blank"
              className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={t("admin.mail.crm.openTicket")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
            <PodaciumBadge
              variant={
                crmContext.ticket.status === "RESOLVED"
                  ? "success"
                  : crmContext.ticket.status === "OPEN"
                    ? "warning"
                    : "outline"
              }
              className="text-[10px] py-0"
            >
              {crmContext.ticket.status}
            </PodaciumBadge>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `[TICK-${crmContext?.ticket?.id}]`,
                  `tick-${crmContext?.ticket?.id}`,
                )
              }
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={t("admin.mail.crm.copyTagTitle")}
            >
              {copiedId === `tick-${crmContext?.ticket?.id}` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    {t("admin.mail.crm.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("admin.mail.crm.copyTag")}</span>
                </>
              )}
            </button>
          </div>
        </PodaciumCard>
      )}

      {/* Linked Dispute Card */}
      {crmContext?.dispute && (
        <PodaciumCard className="p-3.5 border border-border/70 hover:border-amber-500/40 transition-all shadow-2xs group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground group-hover:text-amber-600 transition-colors truncate max-w-[170px]">
                  {crmContext.dispute.reason}
                </p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {t("admin.mail.crm.linkedDispute")}
                  <span className="text-muted-foreground/50">
                    #DISP-{crmContext.dispute.id}
                  </span>
                </span>
              </div>
            </div>
            <Link
              href={`/hub/contracts`}
              target="_blank"
              className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={t("admin.mail.crm.openDispute")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
            <PodaciumBadge variant="warning" className="text-[10px] py-0">
              {crmContext.dispute.status}
            </PodaciumBadge>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `[DISP-${crmContext?.dispute?.id}]`,
                  `disp-${crmContext?.dispute?.id}`,
                )
              }
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={t("admin.mail.crm.copyTagTitle")}
            >
              {copiedId === `disp-${crmContext?.dispute?.id}` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    {t("admin.mail.crm.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("admin.mail.crm.copyTag")}</span>
                </>
              )}
            </button>
          </div>
        </PodaciumCard>
      )}

      {/* Linked Invoice Card */}
      {crmContext?.invoice && (
        <PodaciumCard className="p-3.5 border border-border/70 hover:border-purple-500/40 transition-all shadow-2xs group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground group-hover:text-purple-600 transition-colors truncate max-w-[170px]">
                  {crmContext.invoice.invoiceNumber}
                </p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {t("admin.mail.crm.linkedInvoice")}
                  <span className="text-muted-foreground/50">
                    #INV-{crmContext.invoice.id}
                  </span>
                </span>
              </div>
            </div>
            <Link
              href={`/billing`}
              target="_blank"
              className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={t("admin.mail.crm.openBilling")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
            <PodaciumBadge
              variant={
                crmContext.invoice.status === "PAID"
                  ? "success"
                  : crmContext.invoice.status === "PENDING"
                    ? "warning"
                    : "outline"
              }
              className="text-[10px] py-0"
            >
              {crmContext.invoice.status}
            </PodaciumBadge>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `[INV-${crmContext?.invoice?.id}]`,
                  `inv-${crmContext?.invoice?.id}`,
                )
              }
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={t("admin.mail.crm.copyTagTitle")}
            >
              {copiedId === `inv-${crmContext?.invoice?.id}` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    {t("admin.mail.crm.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("admin.mail.crm.copyTag")}</span>
                </>
              )}
            </button>
          </div>
        </PodaciumCard>
      )}
    </div>
  );
}

export default CrmContextDrawer;
