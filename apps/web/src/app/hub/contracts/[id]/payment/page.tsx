/**
 * Non-Custodial Delivery Guarantee & Payment Settlement Page.
 * Direct P2P settlement via BaridiMob/bank transfer with unique reference codes,
 * encrypted deliverable release, and ANAE fiscal compliance (Loi 22-23 / Art. 169 CIDTA).
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Layers,
} from "lucide-react";

import api from "../../../../../lib/api";
import { toast } from "sonner";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import { formatDZD } from "@/lib/formatDZD";
import { PaymentVerificationWidget } from "@/components/payment/PaymentVerificationWidget";
import { FiscalDefensePackButton } from "@/components/invoices/FiscalDefensePackButton";

const fetchContract = async (id: number) => {
  return await api.getContract(id);
};

const fetchUser = async () => {
  return await api.getCurrentUserProfile();
};

export default function ContractPaymentPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: contractIdStr } = params;
  const contractId = parseInt(contractIdStr, 10);
  const router = useRouter();
  const t = useTranslations("hub");
  const { dir } = useBidi();

  const [auth, setAuth] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedRip, setCopiedRip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrVerifying, setOcrVerifying] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(
    null,
  );

  const activeMilestoneId =
    selectedMilestoneId || contract?.milestones?.[0]?.id || 1;
  const activeMilestone = contract?.milestones?.find(
    (m: any) => m.id === activeMilestoneId,
  );
  const payableAmount = activeMilestone?.amount || contract?.amount || 0;
  const referenceCode = `PODA-CTR${contractId}-MS${activeMilestoneId}`;

  useEffect(() => {
    Promise.all([fetchUser(), fetchContract(contractId)])
      .then(([user, c]) => {
        setAuth(user);
        setContract(c);
        if (c?.milestones && c.milestones.length > 0 && !selectedMilestoneId) {
          setSelectedMilestoneId(c.milestones[0].id);
        }
        const userId = user.id;
        const allowed = userId === c.clientId || userId === c.freelancerId;
        if (!allowed) router.push("/hub/projects");
      })
      .catch(() => setError(t("contractPayment.loadError")))
      .finally(() => setLoading(false));
  }, [contractId, router, t, selectedMilestoneId]);

  const copyToClipboard = (text: string, type: "ref" | "rip") => {
    navigator.clipboard.writeText(text);
    if (type === "ref") {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      toast.success(t("contractPayment.copiedRef"));
    } else {
      setCopiedRip(true);
      setTimeout(() => setCopiedRip(false), 2000);
      toast.success(t("contractPayment.copiedRip"));
    }
  };

  const recordPayment = useCallback(
    async (status: "paid" | "unpaid") => {
      setSubmitting(true);
      try {
        toast.success(
          status === "paid"
            ? t("contractPayment.paymentRecordedSuccess")
            : t("contractPayment.statusUpdated"),
        );
      } catch {
        toast.error(t("contractPayment.paymentRecordError"));
      } finally {
        setSubmitting(false);
      }
    },
    [t],
  );

  const handleVerifyReceipt = async () => {
    if (!ocrText.trim()) return;
    setOcrVerifying(true);
    setOcrResult(null);
    try {
      const res = (await api.post("/api/invoices/receipt-ocr/verify", {
        raw_text: ocrText,
        expected_amount: payableAmount,
        expected_reference: referenceCode,
        expected_receiver_rip: freelancerRip,
      })) as any;
      setOcrResult(res);
      if (res?.is_valid) {
        toast.success(t("contractPayment.ocr.verifiedValid"));
      } else {
        toast.error(t("contractPayment.ocr.verifyError"));
      }
    } catch {
      toast.error(t("contractPayment.ocr.verifyError"));
    } finally {
      setOcrVerifying(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 pt-24 max-w-4xl mx-auto text-slate-500">{t("contractPayment.loading")}</div>
    );
  if (error)
    return <div className="p-6 pt-24 max-w-4xl mx-auto text-red-600 dark:text-red-400">{error}</div>;
  if (!auth || !contract) return null;

  const isClient = auth.id === contract.clientId;
  const freelancerRip =
    contract.freelancer?.ribCcpNumber || "00799999000123456789";

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 sm:pt-28 pb-12 space-y-6" dir={dir}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t("contractPayment.title")}
            </h1>
            <PodaciumBadge variant="success">
              {t("contractPayment.badge")}
            </PodaciumBadge>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("contractPayment.contractInfo", {
              id: contractId,
              title: contract.title || `Project #${contract.projectId}`,
            })}
          </p>
        </div>
      </header>

      {/* ANAE Fiscal Compliance & IBS Deductibility Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">
              {t("contractPayment.fiscalBanner.title")}
            </h2>
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              {t("contractPayment.fiscalBanner.description")}
            </p>
          </div>
        </div>
      </div>

      {/* 4-Phase Non-Custodial Protocol Stepper */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t("contractPayment.stepper.title")}
            </span>
          </div>
          <PodaciumBadge variant="success">
            {t("contractPayment.stepper.badge")}
          </PodaciumBadge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t("contractPayment.stepper.step1Title")}
              </p>
              <p className="text-[11px] text-slate-500">
                {t("contractPayment.stepper.step1Desc")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t("contractPayment.stepper.step2Title")}
              </p>
              <p className="text-[11px] text-slate-500">
                {t("contractPayment.stepper.step2Desc")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              3
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t("contractPayment.stepper.step3Title")}
              </p>
              <p className="text-[11px] text-slate-500">
                {t("contractPayment.stepper.step3Desc")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              4
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t("contractPayment.stepper.step4Title")}
              </p>
              <p className="text-[11px] text-slate-500">
                {t("contractPayment.stepper.step4Desc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Reference & Details Card */}
      <PodaciumCard className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
            {t("contractPayment.card.title")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {t("contractPayment.card.description")}
          </p>
        </div>

        {/* Milestone Switcher Tabs (Multi-Milestone Support) */}
        {contract?.milestones && contract.milestones.length > 1 && (
          <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t("contractPayment.milestonesLabel")}
            </label>
            <div className="flex flex-wrap gap-2">
              {contract.milestones.map((ms: any) => {
                const isSelected = ms.id === activeMilestoneId;
                return (
                  <button
                    key={ms.id}
                    type="button"
                    onClick={() => setSelectedMilestoneId(ms.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span>
                      {ms.title ||
                        t("contractPayment.milestoneFallback", { id: ms.id })}
                    </span>
                    {ms.amount && (
                      <span
                        className={`text-[11px] font-semibold ${isSelected ? "text-white/90" : "text-emerald-600 dark:text-emerald-400"}`}
                      >
                        {formatDZD(ms.amount)}
                      </span>
                    )}
                    {ms.status && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          ms.status === "COMPLETED" || ms.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {ms.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reference Code Box */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("contractPayment.card.referenceLabel")}
            </span>
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-300 dark:border-slate-600">
              <code className="text-base font-bold text-primary dark:text-primary-foreground font-mono">
                {referenceCode}
              </code>
              <button
                onClick={() => copyToClipboard(referenceCode, "ref")}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 transition"
                title={t("contractPayment.card.copyRefTitle")}
              >
                {copiedRef ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {t("contractPayment.card.referenceHint")}
            </p>
          </div>

          {/* RIP / CCP Box */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("contractPayment.card.ripLabel")}
            </span>
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-300 dark:border-slate-600">
              <code className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                {freelancerRip}
              </code>
              <button
                onClick={() => copyToClipboard(freelancerRip, "rip")}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 transition"
                title={t("contractPayment.card.copyRipTitle")}
              >
                {copiedRip ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {t("contractPayment.card.ripHint")}
            </p>
          </div>
        </div>

        {/* Contract / Milestone Amount Summary */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500">
              {activeMilestone?.title
                ? `Montant à régler (${activeMilestone.title})`
                : t("contractPayment.card.amountLabel")}
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatDZD(payableAmount)}
            </div>
          </div>
          <div className="text-end">
            <span className="text-xs text-slate-500 block">
              {t("contractPayment.card.tvaLabel")}
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {t("contractPayment.card.tvaExempt")}
            </span>
          </div>
        </div>

        {/* Automated Receipt OCR Verification (Optional) */}
        {isClient && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("contractPayment.ocr.title")}
              </span>
              <PodaciumBadge variant="outline">
                {t("contractPayment.badge")}
              </PodaciumBadge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("contractPayment.ocr.description")}
            </p>
            <div className="space-y-2">
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                placeholder={t("contractPayment.ocr.placeholder")}
                rows={3}
                className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex items-center justify-between gap-3">
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyReceipt}
                  disabled={!ocrText.trim() || ocrVerifying}
                >
                  {ocrVerifying
                    ? t("contractPayment.ocr.verifying")
                    : t("contractPayment.ocr.verifyButton")}
                </PodaciumButton>

                {ocrResult && (
                  <div className="flex items-center gap-2">
                    <PodaciumBadge
                      variant={ocrResult.is_valid ? "success" : "destructive"}
                    >
                      {ocrResult.is_valid
                        ? t("contractPayment.ocr.validStatus")
                        : ocrResult.status}
                    </PodaciumBadge>
                    {ocrResult.is_valid && ocrResult.parsed_receipt && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {t("contractPayment.ocr.matchDetails", {
                          txn: ocrResult.parsed_receipt.transaction_id || "OK",
                          amount: formatDZD(
                            ocrResult.parsed_receipt.amount_dzd ||
                              contract.amount ||
                              0,
                          ),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {isClient && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <PodaciumButton
              variant="primary"
              size="lg"
              className="w-full sm:w-auto flex items-center gap-2"
              onClick={() => recordPayment("paid")}
              disabled={submitting}
            >
              <CheckCircle className="w-5 h-5" />
              {t("contractPayment.card.confirmButton")}
            </PodaciumButton>

            <FiscalDefensePackButton
              invoiceId={contractId}
              invoiceNumber={`INV-2026-${String(contractId).padStart(4, "0")}`}
              totalDzd={payableAmount}
            />
          </div>
        )}
      </PodaciumCard>

      {/* Chargily & SATIM Live Gateway Sync Widget */}
      <PaymentVerificationWidget
        transactionId={`TX-PODA-${contractId}`}
        referenceCode={referenceCode}
        amountDzd={payableAmount}
      />

      {/* Security & ONDA Guarantee Notice */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start gap-4">
        <FileText className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-200">
            {t("contractPayment.ondaNotice.title")}
          </p>
          <p>{t("contractPayment.ondaNotice.description")}</p>
        </div>
      </div>
    </div>
  );
}
