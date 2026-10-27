"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Building,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { paymentsApi } from "@/lib/api/payments";
import { OrganizationResponse } from "@/lib/api";

import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export interface CorporateTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: OrganizationResponse;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [5000, 20000, 50000, 100000];

export function CorporateTopUpModal({
  isOpen,
  onClose,
  organization,
  onSuccess,
}: CorporateTopUpModalProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [amount, setAmount] = useState<number>(20000);
  const [customAmount, setCustomAmount] = useState<string>("20000");
  const [paymentRail, setPaymentRail] = useState<"chargily" | "baridimob">(
    "chargily",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedRip, setCopiedRip] = useState(false);

  const officialRip = "004 00123 4567890123 45";
  const beneficiary = "SARL PODACIUM BI & TECH";

  const handlePresetSelect = (preset: number) => {
    setAmount(preset);
    setCustomAmount(String(preset));
    setError(null);
  };

  const handleCustomAmountChange = (val: string) => {
    setCustomAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAmount(num);
    }
    setError(null);
  };

  const handleCopyRip = () => {
    navigator.clipboard.writeText(officialRip.replace(/\s+/g, ""));
    setCopiedRip(true);
    toast.success(t("organizations.topUp.ripCopied"));
    setTimeout(() => setCopiedRip(false), 2500);
  };

  const handleProceedPayment = async () => {
    if (amount < 500) {
      setError(t("organizations.topUp.minAmountError"));
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Call payment API for corporate checkout
      const response = await paymentsApi.purchasePodaPoints(amount);
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        toast.success(t("organizations.topUp.proceedToPayment"));
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      console.error("Corporate topup error:", err);
      setError(err?.message || t("organizations.branding.brandingSaveFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("organizations.topUp.modalTitle")}
      description={t("organizations.topUp.modalDesc")}
      size="lg"
    >
      <div className="space-y-6 pt-2">
        {/* Payment Rail Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setPaymentRail("chargily")}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all",
              paymentRail === "chargily"
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t("organizations.topUp.chargilyTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentRail("baridimob")}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all",
              paymentRail === "baridimob"
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{t("organizations.topUp.baridimobTab")}</span>
          </button>
        </div>

        {/* Amount Selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("organizations.topUp.selectAmount")}
          </label>

          {/* Preset Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESET_AMOUNTS.map((preset) => {
              const isSelected = amount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={cn(
                    "py-2.5 px-3 rounded-xl border text-sm font-mono font-bold transition-all text-center",
                    isSelected
                      ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20"
                      : "bg-card border-border hover:border-border/80 text-foreground",
                  )}
                >
                  {preset.toLocaleString("fr-DZ")} DZD
                </button>
              );
            })}
          </div>

          {/* Custom Amount Input */}
          <div className="relative mt-2">
            <input
              type="number"
              min="500"
              step="100"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              placeholder="50000"
              className="w-full h-11 px-3.5 pe-16 text-base font-mono font-bold rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">
              DZD
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive mt-1">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Rail 1: Chargily Pay */}
        {paymentRail === "chargily" && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PodaciumBadge
                  variant="success"
                  className="font-mono text-[11px]"
                >
                  EDAHABIA
                </PodaciumBadge>
                <PodaciumBadge
                  variant="success"
                  className="font-mono text-[11px]"
                >
                  CIB
                </PodaciumBadge>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t("organizations.topUp.satim3dSecure")}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("organizations.topUp.chargilyNotice")}
            </p>

            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t("organizations.treasury.timbreExemptBadge")}
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                0 DZD
              </span>
            </div>
          </div>
        )}

        {/* Rail 2: BaridiMob & Bank Wire */}
        {paymentRail === "baridimob" && (
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/10 space-y-3 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              {t("organizations.topUp.baridimobInstructions")}
            </p>

            <div className="p-3 bg-card rounded-lg border border-border space-y-2">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.topUp.officialBeneficiary")}:
                </span>
                <div className="font-bold text-foreground font-mono">
                  {beneficiary}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.topUp.officialRip")}:
                </span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span
                    className="font-mono font-bold text-foreground tracking-wider select-all"
                    dir="ltr"
                  >
                    {officialRip}
                  </span>
                  <PodaciumButton
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleCopyRip}
                  >
                    {copiedRip ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="ms-1">
                      {t("organizations.topUp.copyRip")}
                    </span>
                  </PodaciumButton>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              {t("organizations.topUp.uploadReceiptPrompt")}
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <PodaciumButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            {t("organizations.topUp.cancel")}
          </PodaciumButton>

          {paymentRail === "chargily" ? (
            <PodaciumButton
              type="button"
              variant="primary"
              glow
              loading={isProcessing}
              onClick={handleProceedPayment}
              icon={
                <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
              }
              iconPosition="right"
            >
              {isProcessing
                ? t("organizations.topUp.processingPayment")
                : t("organizations.topUp.proceedToPayment")}
            </PodaciumButton>
          ) : (
            <PodaciumButton
              type="button"
              variant="primary"
              onClick={onClose}
              icon={<ExternalLink className="w-4 h-4" />}
              iconPosition="right"
            >
              {t("common.confirm")}
            </PodaciumButton>
          )}
        </div>
      </div>
    </PodaciumModal>
  );
}

export default CorporateTopUpModal;
