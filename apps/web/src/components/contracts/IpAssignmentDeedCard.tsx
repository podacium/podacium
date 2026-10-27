"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Download,
  FileCheck2,
  Copy,
  Check,
  Lock,
  ExternalLink,
  Scale,
  Award,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
} from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

export interface IpAssignmentDeedData {
  deedNumber: string;
  contractId: number;
  milestoneId: number;
  milestoneTitle: string;
  amountDzd: number;
  freelancerName: string;
  freelancerAnae?: string;
  clientName: string;
  deliverableSha256: string;
  documentSha256: string;
  signatureEd25519: string;
  publicKeyEd25519?: string;
  signedAt: string;
  pdfUrl?: string;
  freelancerSignature?: string;
  clientSignature?: string;
  freelancerSignedAt?: string;
  clientSignedAt?: string;
}

export interface IpAssignmentDeedCardProps {
  deed: IpAssignmentDeedData;
  onDownloadPdf?: () => void;
  className?: string;
}

export const IpAssignmentDeedCard: React.FC<IpAssignmentDeedCardProps> = ({
  deed,
  onDownloadPdf,
  className = "",
}) => {
  const t = useTranslations();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <PodaciumCard
      variant="default"
      className={`overflow-hidden border border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/20 to-white shadow-md ${className}`}
    >
      {/* Top Banner with Sovereign Legal Stamp */}
      <div className="border-b border-emerald-100 bg-emerald-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-emerald-950">
                  {t("contracts.detail.ipDeed.title")}
                </h4>
                <PodaciumBadge
                  variant="success"
                  className="text-[10px] font-bold"
                >
                  {t("contracts.detail.ipDeed.certifiedBadge")}
                </PodaciumBadge>
              </div>
              <p className="text-[11px] font-arabic font-medium text-emerald-800">
                {t("contracts.detail.ipDeed.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-emerald-900 bg-white px-2.5 py-1 rounded-md border border-emerald-200">
              {deed.deedNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Main Legal Deed Body */}
      <div className="p-5 space-y-4 text-xs">
        {/* Parties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("contracts.detail.ipDeed.assignorLabel")}
            </span>
            <p className="font-bold text-foreground text-sm">
              {deed.freelancerName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("contracts.detail.ipDeed.assignorMeta", {
                anae: deed.freelancerAnae || "162400998811",
              })}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium">
              {t("contracts.detail.ipDeed.assignorTax")}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("contracts.detail.ipDeed.assigneeLabel")}
            </span>
            <p className="font-bold text-foreground text-sm">
              {deed.clientName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("contracts.detail.ipDeed.assigneeMeta", {
                contractId: String(deed.contractId),
              })}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium">
              {t("contracts.detail.ipDeed.assigneeTax")}
            </p>
          </div>
        </div>

        {/* Scope and consideration bullet summary */}
        <div className="rounded-xl border border-border/80 bg-white p-3.5 space-y-2 text-[11px] leading-relaxed text-foreground/90">
          <div className="flex items-start gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <b>{t("contracts.detail.ipDeed.rightsGrantedTitle")}</b>{" "}
              {t("contracts.detail.ipDeed.rightsGrantedBody")}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Award className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <b>{t("contracts.detail.ipDeed.considerationTitle")}</b>{" "}
              {t("contracts.detail.ipDeed.considerationBody", {
                amount: deed.amountDzd.toLocaleString(),
              })}
            </p>
          </div>
        </div>

        {/* Cryptographic Hashes & Ed25519 Seal */}
        <div className="space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>{t("contracts.detail.ipDeed.integritySeal")}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {t("contracts.detail.ipDeed.timestampedAt", {
                date: new Date(deed.signedAt).toLocaleString("fr-DZ"),
              })}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t("contracts.detail.ipDeed.deliverableHash")}</span>
                <button
                  type="button"
                  onClick={() => handleCopy("deliv", deed.deliverableSha256)}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {copiedKey === "deliv" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedKey === "deliv"
                    ? t("contracts.detail.ipDeed.copied")
                    : t("contracts.detail.ipDeed.copy")}
                </button>
              </div>
              <p className="font-mono text-[10px] text-foreground bg-white/80 p-1.5 rounded border border-gray-200 truncate">
                {deed.deliverableSha256}
              </p>
            </div>

            {/* Two-Party Signatures */}
            {deed.freelancerSignature && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="text-emerald-900 font-medium">
                    {t("contracts.detail.ipDeed.assignorSignature")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy("fl_sig", deed.freelancerSignature || "")
                    }
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    {copiedKey === "fl_sig" ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedKey === "fl_sig"
                      ? t("contracts.detail.ipDeed.copied")
                      : t("contracts.detail.ipDeed.copy")}
                  </button>
                </div>
                <p className="font-mono text-[10px] text-foreground bg-white/80 p-1.5 rounded border border-gray-200 truncate">
                  {deed.freelancerSignature}
                </p>
              </div>
            )}

            {deed.clientSignature && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="text-emerald-900 font-medium">
                    {t("contracts.detail.ipDeed.assigneeSignature")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy("cl_sig", deed.clientSignature || "")
                    }
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    {copiedKey === "cl_sig" ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedKey === "cl_sig"
                      ? t("contracts.detail.ipDeed.copied")
                      : t("contracts.detail.ipDeed.copy")}
                  </button>
                </div>
                <p className="font-mono text-[10px] text-foreground bg-white/80 p-1.5 rounded border border-gray-200 truncate">
                  {deed.clientSignature}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="text-emerald-950 font-semibold">
                  {t("contracts.detail.ipDeed.platformSeal")}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("sig", deed.signatureEd25519)}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {copiedKey === "sig" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedKey === "sig"
                    ? t("contracts.detail.ipDeed.copied")
                    : t("contracts.detail.ipDeed.copy")}
                </button>
              </div>
              <p className="font-mono text-[10px] text-foreground bg-white/80 p-1.5 rounded border border-gray-200 truncate">
                {deed.signatureEd25519}
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-muted-foreground">
            {t("contracts.detail.ipDeed.legalNotice")}
          </p>
          {onDownloadPdf && (
            <PodaciumButton
              variant="gradient"
              size="sm"
              onClick={onDownloadPdf}
              className="text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 me-1.5" />
              {t("contracts.detail.ipDeed.downloadPdf")}
            </PodaciumButton>
          )}
        </div>
      </div>
    </PodaciumCard>
  );
};

export default IpAssignmentDeedCard;
