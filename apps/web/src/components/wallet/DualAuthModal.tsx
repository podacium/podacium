"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  PodaciumModal,
  PodaciumButton,
  PodaciumBadge,
  PodaciumOTPInput,
} from "@/components/design-system";
import { useTranslations, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api/auth";
import { getWebAuthnAssertion } from "@/lib/webauthn";

export interface BeneficiaryDetails {
  name: string;
  anaeNumber?: string;
  nif?: string;
  nis?: string;
  bankName: string;
  accountNumber: string;
  rip: string;
  isAnaeVerified: boolean;
}

export interface PayoutAuditDiff {
  requestedAmount: number;
  approvedAmount: number;
  platformFee: number;
  netDisbursement: number;
  currency: string;
}

export interface DualAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  payoutId: number;
  makerAdminName: string;
  makerNotes?: string;
  makerReviewedAt: string;
  currentAdminId: number;
  makerAdminId: number;
  beneficiary: BeneficiaryDetails;
  auditDiff: PayoutAuditDiff;
  onConfirmApproval: (
    totpOrPasskey: string,
    checkerNotes: string,
  ) => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
}

export const DualAuthModal: React.FC<DualAuthModalProps> = ({
  isOpen,
  onClose,
  payoutId,
  makerAdminName,
  makerNotes,
  makerReviewedAt,
  currentAdminId,
  makerAdminId,
  beneficiary,
  auditDiff,
  onConfirmApproval,
  onReject,
}) => {
  const { t } = useTranslations();
  const locale = useLocale();

  const [authMethod, setAuthMethod] = useState<"TOTP" | "WEBAUTHN">("TOTP");
  const [totpCode, setTotpCode] = useState("");
  const [checkerNotes, setCheckerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Separation of duties rule
  const isSelfApprovalBlocked = currentAdminId === makerAdminId;

  const handleApprove = async () => {
    if (isSelfApprovalBlocked) {
      setErrorMessage(
        t(
          "billing.separation_of_duties_error",
          "Separation of Duties violation: The Maker cannot act as the Checker.",
        ),
      );
      return;
    }

    if (authMethod === "TOTP" && (!totpCode || totpCode.trim().length < 6)) {
      setErrorMessage(
        t(
          "billing.enter_valid_totp",
          "Veuillez saisir un code TOTP valide à 6 chiffres.",
        ),
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (authMethod === "WEBAUTHN") {
        if (typeof window === "undefined" || !navigator.credentials?.get) {
          throw new Error(t("billing.webauthn_unsupported"));
        }
        const beginRes = await authApi.webauthnAuthBegin();
        if (!beginRes?.options) {
          throw new Error(t("billing.webauthn_options_failed"));
        }
        const assertion = await getWebAuthnAssertion(beginRes.options);
        const completeRes = await authApi.webauthnAuthComplete(assertion);
        if (!completeRes?.success) {
          throw new Error(t("billing.webauthn_verify_failed"));
        }
        await onConfirmApproval(
          completeRes.step_up_token ||
            completeRes.credential_id ||
            "webauthn_verified",
          checkerNotes,
        );
      } else {
        await onConfirmApproval(totpCode, checkerNotes);
      }
      onClose();
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
        setErrorMessage(t("billing.webauthn_cancelled"));
      } else {
        setErrorMessage(err?.message || t("billing.auth_failed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (num: number) => {
    const numberLocale =
      locale === "ar" ? "ar-DZ" : locale === "kab" ? "fr-DZ" : locale;
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(
        "billing.dual_auth_title",
        "Dual Authorization — Four-Eyes Principle",
      )}
      description={t(
        "billing.dual_auth_subtitle",
        "Bank of Algeria Instruction n° 06-2025 Tier 1 High-Value Disbursement Verification",
      )}
      size="lg"
    >
      <div className="space-y-6 pt-2" data-testid="dual-auth-modal">
        {/* Separation of duties warning if current admin is the maker */}
        {isSelfApprovalBlocked && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                {t(
                  "billing.sod_violation_title",
                  "Conflit de Séparation des Fonctions (NIST AC-5)",
                )}
              </p>
              <p className="text-xs mt-1 leading-relaxed">
                {t(
                  "billing.sod_violation_desc",
                  "Vous avez déjà validé cette demande en tant qu'administrateur Maker. Un second administrateur distinct est légalement requis pour exécuter le décaissement.",
                )}
              </p>
            </div>
          </div>
        )}

        {/* Maker vs Checker Audit Trail */}
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("billing.maker_audit_trail", "Piste d'Audit Maker (Phase 1)")}
            </span>
            <PodaciumBadge variant="success" className="text-[10px]">
              <CheckCircle2 className="w-3 h-3 me-1" />
              {t("billing.maker_cleared", "Vérifié & Signé")}
            </PodaciumBadge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">
                {t("billing.maker_admin", "Admin Initiateur / Maker")}:
              </span>
              <p className="font-semibold text-foreground mt-0.5">
                {makerAdminName} ({t("billing.id_prefix", "ID #")}
                {makerAdminId})
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("billing.reviewed_at", "Date d'examen")}:
              </span>
              <p className="font-mono text-foreground mt-0.5">
                {makerReviewedAt}
              </p>
            </div>
          </div>

          {makerNotes && (
            <div className="mt-3 pt-3 border-t border-border/50 text-xs">
              <span className="text-muted-foreground">
                {t("billing.maker_notes", "Notes de validation Maker")}:
              </span>
              <p className="italic text-foreground mt-0.5 bg-background/60 p-2 rounded-lg border border-border/40">
                &ldquo;{makerNotes}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Beneficiary ANAE & RIP Verification */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(
                "billing.beneficiary_kyc",
                "Bénéficiaire & Conformité Fiscale",
              )}
            </span>
            <PodaciumBadge
              variant={beneficiary.isAnaeVerified ? "success" : "warning"}
              className="text-[10px]"
            >
              {beneficiary.isAnaeVerified
                ? t("billing.anae_verified", "Carte ANAE Validée")
                : t("billing.anae_pending", "Vérification Fiscale en Cours")}
            </PodaciumBadge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">
                {t("billing.beneficiary_name", "Titulaire")}:
              </span>
              <p className="font-semibold text-foreground mt-0.5">
                {beneficiary.name}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("billing.bank_rip", "Banque & RIP")}:
              </span>
              <p className="font-mono text-foreground mt-0.5">
                {beneficiary.bankName}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {beneficiary.rip}
              </p>
            </div>
            {beneficiary.anaeNumber && (
              <div>
                <span className="text-muted-foreground">
                  {t("billing.anae_card", "N° Registre National ANAE")}:
                </span>
                <p className="font-mono text-foreground mt-0.5">
                  {beneficiary.anaeNumber}
                </p>
              </div>
            )}
            {beneficiary.nif && (
              <div>
                <span className="text-muted-foreground">
                  {t("billing.nif_nis", "NIF / NIS")}:
                </span>
                <p className="font-mono text-foreground mt-0.5">
                  {beneficiary.nif}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side-by-side Transaction Diff */}
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground block mb-3">
            {t(
              "billing.financial_diff",
              "Grand Livre — Ventilation Financière",
            )}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border">
              <span className="text-[11px] text-muted-foreground block">
                {t("billing.requested", "Montant Brut")}
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                {formatAmount(auditDiff.requestedAmount)} {auditDiff.currency}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border">
              <span className="text-[11px] text-muted-foreground block">
                {t("billing.fees", "Frais Plateforme")}
              </span>
              <span className="font-mono font-bold text-sm text-amber-700 dark:text-amber-300">
                −{formatAmount(auditDiff.platformFee)} {auditDiff.currency}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border">
              <span className="text-[11px] text-muted-foreground block">
                {t("billing.net_payout", "Décaissement Net")}
              </span>
              <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                {formatAmount(auditDiff.netDisbursement)} {auditDiff.currency}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border">
              <span className="text-[11px] text-muted-foreground block">
                {t("billing.payout_id", "ID Payout")}
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                #{payoutId}
              </span>
            </div>
          </div>
        </div>

        {/* Checker Authentication Factor Prompt (TOTP / WebAuthn) */}
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("billing.signature_factor", "Facteur de Signature Checker")}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAuthMethod("TOTP")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                  authMethod === "TOTP"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <KeyRound className="w-3.5 h-3.5 inline me-1" />
                {t("billing.totp_2fa", "TOTP 2FA")}
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod("WEBAUTHN")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                  authMethod === "WEBAUTHN"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Fingerprint className="w-3.5 h-3.5 inline me-1" />
                WebAuthn
              </button>
            </div>
          </div>

          {authMethod === "TOTP" ? (
            <div className="space-y-2">
              <div className="flex justify-center">
                <PodaciumOTPInput
                  maxLength={6}
                  value={totpCode}
                  onChange={setTotpCode}
                  invalid={Boolean(errorMessage)}
                  data-testid="totp-input"
                />
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block text-center">
                {t(
                  "billing.totp_hint",
                  "Saisissez le code à 6 chiffres depuis votre application d'authentification (Google Authenticator, YubiKey).",
                )}
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-center">
              <Fingerprint className="w-8 h-8 text-primary mx-auto mb-2 motion-safe:animate-pulse" />
              <p className="text-xs font-semibold text-foreground">
                {t(
                  "billing.webauthn_ready",
                  "Clé matérielle FIDO2 / Passkey prête",
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t(
                  "billing.webauthn_hint",
                  "Touchez votre clé YubiKey ou utilisez Touch ID lors de la confirmation.",
                )}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              {t(
                "billing.checker_notes",
                "Notes de validation Checker (Optionnel)",
              )}
            </label>
            <input
              type="text"
              placeholder={t(
                "billing.checker_notes_placeholder",
                "Ex: Vérification manuelle SATIM conforme.",
              )}
              value={checkerNotes}
              onChange={(e) => setCheckerNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="checker-notes-input"
            />
          </div>

          {errorMessage && (
            <p
              className="text-xs text-destructive font-medium"
              data-testid="error-message"
            >
              {errorMessage}
            </p>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("common.cancel", "Annuler")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            glow
            onClick={handleApprove}
            loading={isSubmitting}
            disabled={isSelfApprovalBlocked || isSubmitting}
            data-testid="approve-disbursement-btn"
          >
            <ShieldAlert className="w-4 h-4 me-1.5" />
            {t("billing.authorize_disbursement", "Autoriser le Décaissement")}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
};

export default DualAuthModal;
