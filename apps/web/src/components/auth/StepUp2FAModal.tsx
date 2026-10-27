"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, AlertCircle, Loader2 } from "lucide-react";
import {
  PodaciumModal,
  PodaciumButton,
  PodaciumOTPInput,
} from "@/components/design-system";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";

export interface StepUp2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifySuccess: (token: string) => void;
  title?: string;
  description?: string;
}

export const StepUp2FAModal: React.FC<StepUp2FAModalProps> = ({
  isOpen,
  onClose,
  onVerifySuccess,
  title,
  description,
}) => {
  const { t } = useTranslations();
  const { isRTL } = useBidi();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtp("");
      setError(null);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    const code = otp.trim();
    if (code.length !== 6) {
      setError(
        t("robustness.auth_2fa.errorDigits") ||
          (isRTL
            ? "يرجى إدخال رمز التحقق المكون من 6 أرقام."
            : "Veuillez saisir les 6 chiffres."),
      );
      return;
    }

    setIsVerifying(true);
    setError(null);
    try {
      const res = await api.post<{
        success: boolean;
        data: { step_up_token: string };
      }>("/api/v1/auth/step-up", {
        code,
        method: "totp",
        required_acr: "urn:podacium:loa:2",
      });
      const token = res?.data?.step_up_token || code;
      onVerifySuccess(token);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          t("robustness.auth_2fa.errorInvalid") ||
          (isRTL
            ? "رمز التحقق غير صحيح أو منتهي الصلاحية."
            : "Code de sécurité incorrect ou expiré."),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        title ||
        t("robustness.auth_2fa.title") ||
        (isRTL
          ? "التحقق الأمني المشدد (2FA)"
          : "Validation de Sécurité Requise (2FA)")
      }
      description={
        description ||
        t("robustness.auth_2fa.description") ||
        (isRTL
          ? "هذه العملية حساسة وتتطلب تأكيد هويتك عبر تطبيق المصادقة."
          : "Cette opération administrative sensible nécessite une confirmation OTP.")
      }
      size="sm"
    >
      <div className="py-2 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-primary flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="flex justify-center">
          <PodaciumOTPInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              if (error) setError(null);
            }}
            invalid={Boolean(error)}
            disabled={isVerifying}
            autoFocus={isOpen}
            data-testid="step-up-otp-input"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <PodaciumButton variant="ghost" size="sm" onClick={onClose}>
            {t("robustness.auth_2fa.cancel") || (isRTL ? "إلغاء" : "Annuler")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            onClick={handleVerify}
            disabled={isVerifying || otp.length !== 6}
            className="gap-1.5"
          >
            {isVerifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>
              {t("robustness.auth_2fa.confirm") ||
                (isRTL ? "تأكيد" : "Confirmer l'opération")}
            </span>
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
};

export default StepUp2FAModal;
