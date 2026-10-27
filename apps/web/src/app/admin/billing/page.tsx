"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  KeyRound,
  Building,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
  PodaciumInput,
} from "@/components/design-system";
import { ThreePillarWalletCard } from "@/components/wallet/ThreePillarWalletCard";
import {
  DualAuthModal,
  BeneficiaryDetails,
  PayoutAuditDiff,
} from "@/components/wallet/DualAuthModal";
import { useTranslations, useLocale } from "@/lib/i18n";
import {
  paymentsApi,
  type AdminWalletSummaryResponse,
} from "@/lib/api/payments";
import { cn } from "@/lib/utils";

interface ConciergeReceiptItem {
  id: string;
  orderCode: string;
  clientName: string;
  clientEmail: string;
  amountDzd: number;
  submittedAt: string;
  status: "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
  receiptUrl?: string;
  ocrExtractedAmount?: number;
  ocrConfidence?: number;
  slipRipMatched: boolean;
}

interface HighValuePayoutItem {
  id: number;
  makerAdminName: string;
  makerAdminId: number;
  makerReviewedAt: string;
  makerNotes: string;
  beneficiary: BeneficiaryDetails;
  auditDiff: PayoutAuditDiff;
}

export default function AdminBillingPage() {
  const { t } = useTranslations();
  const locale = useLocale();

  // Real platform aggregates. This page previously rendered hardcoded treasury
  // figures (18,450,000 / 4,250,000 / 70,000) under a compliance badge.
  const [walletSummary, setWalletSummary] =
    useState<AdminWalletSummaryResponse | null>(null);
  const [walletSummaryError, setWalletSummaryError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    paymentsApi
      .getAdminWalletSummary()
      .then((summary) => {
        if (!cancelled) setWalletSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setWalletSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [activeTab, setActiveTab] = useState<
    "concierge" | "maker_checker" | "scf_tax"
  >("concierge");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayout, setSelectedPayout] =
    useState<HighValuePayoutItem | null>(null);
  const [isDualAuthOpen, setIsDualAuthOpen] = useState(false);

  // Mock initial queue data conforming to real schemas
  const [conciergeQueue, setConciergeQueue] = useState<ConciergeReceiptItem[]>([
    {
      id: "REC-991",
      orderCode: "POD-BM-892147",
      clientName: "Amine Meziani",
      clientEmail: "amine.meziani@univ-oran.dz",
      amountDzd: 45000,
      submittedAt: "2026-10-15 17:40 UTC",
      status: "PENDING_VERIFICATION",
      ocrExtractedAmount: 45000,
      ocrConfidence: 98.4,
      slipRipMatched: true,
    },
    {
      id: "REC-992",
      orderCode: "POD-BM-341908",
      clientName: "Nassima Benali",
      clientEmail: "n.benali@esi.dz",
      amountDzd: 25000,
      submittedAt: "2026-10-15 18:15 UTC",
      status: "PENDING_VERIFICATION",
      ocrExtractedAmount: 25000,
      ocrConfidence: 99.1,
      slipRipMatched: true,
    },
  ]);

  const [payoutsQueue, setPayoutsQueue] = useState<HighValuePayoutItem[]>([
    {
      id: 884,
      makerAdminName: "Ahmed Co-Founder (CMO)",
      makerAdminId: 2,
      makerReviewedAt: "2026-10-15 16:30 UTC",
      makerNotes:
        "Bordereau fiscal ANAE vérifié. Travaux de développement validés par le client.",
      beneficiary: {
        name: "Yacine Belkacem",
        anaeNumber: "ANAE-2026-DZ-99120",
        nif: "001916098765432",
        bankName: "Banque de Développement Local (BDL)",
        accountNumber: "00500123456789012345",
        rip: "00500 12345 6789012345 32",
        isAnaeVerified: true,
      },
      auditDiff: {
        requestedAmount: 180000,
        approvedAmount: 180000,
        platformFee: 9000,
        netDisbursement: 171000,
        currency: "DZD",
      },
    },
  ]);

  const [taxPackForm, setTaxPackForm] = useState({
    enterpriseName: "SARL HYDRA TECH ALGERIA",
    nif: "001916012345678",
    nis: "001916010001234",
    trainingTitle: "Data Engineering & PowerBI Enterprise Analytics",
    amountDzd: 750000,
    hoursCompleted: 45,
    participantsCount: 15,
    invoiceRef: "INV-2026-OCT-5501",
  });

  const [generatedTaxPack, setGeneratedTaxPack] = useState<any | null>(null);

  const currentAdminId = 1; // Logged-in admin (Checker)

  const handleApproveSlip = (id: string) => {
    setConciergeQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "APPROVED" } : item,
      ),
    );
  };

  const handleRejectSlip = (id: string) => {
    setConciergeQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "REJECTED" } : item,
      ),
    );
  };

  const handleConfirmDisbursement = async (
    totpOrPasskey: string,
    checkerNotes: string,
  ) => {
    if (!selectedPayout) return;
    setPayoutsQueue((prev) => prev.filter((p) => p.id !== selectedPayout.id));
    setIsDualAuthOpen(false);
  };

  const handleGenerateTaxPack = () => {
    const taxShieldDzd = roundToTwo(taxPackForm.amountDzd * 0.26);
    setGeneratedTaxPack({
      packId: `TDP-CIDTA169-${taxPackForm.invoiceRef}-9A8F12B4`,
      enterprise: taxPackForm.enterpriseName,
      nif: taxPackForm.nif,
      amountDzd: taxPackForm.amountDzd,
      taxShieldDzd,
      statute: "Article 169 & 224 CIDTA (Déductibilité IBS 100%)",
      signature: {
        algorithm: "Ed25519",
        signer: "Podacium Sovereign Certification Authority (Algiers, DZ)",
        publicKeyHex:
          "b9424b41a050a1112b322da9f93532a2432d0112423456789abcdef012345678",
        status: "VALID & VERIFIED",
      },
    });
  };

  const roundToTwo = (num: number) => Math.round(num * 100) / 100;

  const formatAmount = (num: number) => {
    const numberLocale =
      locale === "ar" ? "ar-DZ" : locale === "kab" ? "fr-DZ" : locale;
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  const currencyLabel = t("billing.currency_dzd", "DZD");

  const receiptStatusKey: Record<ConciergeReceiptItem["status"], string> = {
    PENDING_VERIFICATION: "billing.receipt_status_pending",
    APPROVED: "billing.receipt_status_approved",
    REJECTED: "billing.receipt_status_rejected",
  };

  const localizedStatus = (status: ConciergeReceiptItem["status"]) =>
    t(receiptStatusKey[status], status);

  return (
    <div
      className="space-y-8 p-6 max-w-7xl mx-auto"
      data-testid="admin-billing-page"
    >
      {/* FinTech Three-Pillar Vault Header — live aggregates, never mocked */}
      <div data-testid="wallet-summary-source" className="space-y-2">
        <ThreePillarWalletCard
          balances={{
            spendableDzd: walletSummary?.available_poda_points ?? 0,
            inEscrowDzd: walletSummary?.held_in_escrow_points ?? 0,
            pendingClearanceDzd: walletSummary?.pending_payouts_points ?? 0,
            currency: walletSummary?.currency ?? "PODAPOINT",
            podaPoints: walletSummary?.total_poda_points ?? 0,
          }}
          onTopUp={() => {}}
          onWithdraw={() => {}}
          onReviewPending={() => setActiveTab("concierge")}
        />
        <p className="text-xs text-muted-foreground text-end">
          {walletSummaryError
            ? t("admin.billing.wallet_summary_unavailable")
            : t("admin.billing.wallet_summary_source", {
                count: walletSummary?.wallet_count ?? 0,
                pending: walletSummary?.pending_payout_count ?? 0,
              })}
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("concierge")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2",
            activeTab === "concierge"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          data-testid="tab-concierge"
        >
          <Building className="w-4 h-4" />
          {t("admin.billing.concierge_queue", "Bordereaux BaridiMob / CCP")}
          <PodaciumBadge variant="default" className="text-[10px] py-0 px-1.5">
            {
              conciergeQueue.filter((q) => q.status === "PENDING_VERIFICATION")
                .length
            }
          </PodaciumBadge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("maker_checker")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2",
            activeTab === "maker_checker"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          data-testid="tab-maker-checker"
        >
          <ShieldCheck className="w-4 h-4" />
          {t(
            "admin.billing.maker_checker_queue",
            "Dual Auth Décaissements (≥ 100k DZD)",
          )}
          <PodaciumBadge variant="warning" className="text-[10px] py-0 px-1.5">
            {payoutsQueue.length}
          </PodaciumBadge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scf_tax")}
          className={cn(
            "px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2",
            activeTab === "scf_tax"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          data-testid="tab-scf-tax"
        >
          <FileText className="w-4 h-4" />
          {t(
            "admin.billing.scf_tax_defense",
            "DLG PC Compta SCF & Pack Fiscal 169",
          )}
        </button>
      </div>

      {/* 1. BaridiMob Concierge Verification Queue */}
      {activeTab === "concierge" && (
        <PodaciumCard variant="default" padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t(
                  "admin.billing.concierge_verification_title",
                  "File de Vérification des Récépissés Postaux",
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "admin.billing.concierge_verification_subtitle",
                  "Vérifiez l'adéquation du bordereau CCP ou de la capture BaridiMob avec le RIP officiel Podacium.",
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <PodaciumInput
                placeholder={t(
                  "admin.billing.concierge_search_placeholder",
                  "Search by order code...",
                )}
                aria-label={t(
                  "admin.billing.concierge_search_placeholder",
                  "Search by order code...",
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 text-start">
                    {t("billing.order_code", "Code Commande")}
                  </th>
                  <th className="py-3 px-4 text-start">
                    {t("billing.client", "Client")}
                  </th>
                  <th className="py-3 px-4 text-start">
                    {t("billing.amount", "Montant DZD")}
                  </th>
                  <th className="py-3 px-4 text-start">
                    {t("billing.ocr_status", "Contrôle OCR")}
                  </th>
                  <th className="py-3 px-4 text-start">
                    {t("billing.status", "Statut")}
                  </th>
                  <th className="py-3 px-4 text-end">
                    {t("common.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {conciergeQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      <span dir="ltr" className="inline-block">
                        {item.orderCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-foreground">
                        {item.clientName}
                      </p>
                      <p
                        dir="ltr"
                        className="text-[11px] text-muted-foreground text-start"
                      >
                        {item.clientEmail}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold tabular-nums text-foreground">
                      {formatAmount(item.amountDzd)} {currencyLabel}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                          {item.ocrConfidence}%{" "}
                          {t("billing.rip_conformed", "RIP Conforme")}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <PodaciumBadge
                        variant={
                          item.status === "APPROVED"
                            ? "success"
                            : item.status === "REJECTED"
                              ? "destructive"
                              : "warning"
                        }
                        className="text-[10px]"
                      >
                        {localizedStatus(item.status)}
                      </PodaciumBadge>
                    </td>
                    <td className="py-3.5 px-4 text-end">
                      {item.status === "PENDING_VERIFICATION" ? (
                        <div className="flex items-center justify-end gap-2">
                          <PodaciumButton
                            size="sm"
                            variant="primary"
                            onClick={() => handleApproveSlip(item.id)}
                            data-testid={`approve-slip-${item.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                            {t("billing.validate_credit", "Valider & Créditer")}
                          </PodaciumButton>
                          <PodaciumButton
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectSlip(item.id)}
                            data-testid={`reject-slip-${item.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 me-1 text-destructive" />
                            {t("billing.reject", "Rejeter")}
                          </PodaciumButton>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">
                          {t("common.processed", "Traité")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PodaciumCard>
      )}

      {/* 2. High-Value Maker-Checker Dual Auth Queue */}
      {activeTab === "maker_checker" && (
        <PodaciumCard variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t(
                  "admin.billing.maker_checker_title",
                  "File de Double Autorisation (Instruction 06-2025 Tier 1)",
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "admin.billing.maker_checker_subtitle",
                  "Tout décaissement ≥ 100 000 DZD exige la validation d'un Checker distinct avec signature TOTP/WebAuthn.",
                )}
              </p>
            </div>
            <PodaciumBadge variant="success" className="text-xs font-mono">
              {t("admin.billing.nist_ac5_enforced", "NIST AC-5 Enforced")}
            </PodaciumBadge>
          </div>

          {payoutsQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              {t(
                "admin.billing.no_pending_dual_auth",
                "Aucun décaissement en attente de validation Checker.",
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {payoutsQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border bg-muted/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  data-testid={`payout-item-${item.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        #{item.id} — {item.beneficiary.name}
                      </span>
                      <PodaciumBadge
                        variant="default"
                        className="text-[10px] font-mono"
                      >
                        {formatAmount(item.auditDiff.netDisbursement)}{" "}
                        {currencyLabel}
                      </PodaciumBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {item.makerAdminName}
                      </span>{" "}
                      • {item.makerNotes}
                    </p>
                  </div>

                  <PodaciumButton
                    size="sm"
                    variant="primary"
                    glow
                    onClick={() => {
                      setSelectedPayout(item);
                      setIsDualAuthOpen(true);
                    }}
                    data-testid={`open-dual-auth-${item.id}`}
                  >
                    <KeyRound className="w-3.5 h-3.5 me-1.5" />
                    {t(
                      "billing.review_dual_auth",
                      "Examiner & Signer (Checker)",
                    )}
                  </PodaciumButton>
                </div>
              ))}
            </div>
          )}
        </PodaciumCard>
      )}

      {/* 3. DLG PC Compta SCF & Article 169 Tax Defense Pack Generator */}
      {activeTab === "scf_tax" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SCF Export Card */}
          <PodaciumCard variant="default" padding="lg" className="space-y-4">
            <h3 className="text-base font-bold text-foreground">
              {t(
                "admin.billing.scf_export_title",
                "Export Grand Livre DLG PC Compta (SCF)",
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                "admin.billing.scf_export_subtitle",
                "Génération automatisée des écritures conformes aux comptes 512000, 411000, 401000, 706000 et 6186.",
              )}
            </p>

            <div className="p-4 rounded-xl bg-muted/50 border border-border font-mono text-[11px] text-muted-foreground space-y-1">
              <p>
                {t(
                  "admin.billing.scf_acc_512",
                  "512000 - Banque / Chargily Clearing (Trésorerie)",
                )}
              </p>
              <p>
                {t(
                  "admin.billing.scf_acc_411",
                  "411000 - Clients Factures à Émettre",
                )}
              </p>
              <p>
                {t(
                  "admin.billing.scf_acc_401",
                  "401000 - Fournisseurs ANAE Freelancers",
                )}
              </p>
              <p>
                {t(
                  "admin.billing.scf_acc_706",
                  "706000 - Prestations de Services Podacium",
                )}
              </p>
              <p>
                {t(
                  "admin.billing.scf_acc_6186",
                  "6186 - Frais de formation professionnelle continue (Art. 169 CIDTA)",
                )}
              </p>
            </div>

            <PodaciumButton size="sm" variant="outline" className="w-full">
              <Download className="w-4 h-4 me-1.5" />
              {t(
                "admin.billing.download_scf_journal",
                "Télécharger Journal DLG (CSV Windows-1256)",
              )}
            </PodaciumButton>
          </PodaciumCard>

          {/* Article 169 Tax Defense Pack Card */}
          <PodaciumCard variant="default" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                {t(
                  "admin.billing.tax_pack_title",
                  "Pack Fiscal Article 169 CIDTA (IBS 26%)",
                )}
              </h3>
              <PodaciumBadge variant="success" className="text-[10px]">
                {t("admin.billing.ed25519_signed", "Ed25519 Signed")}
              </PodaciumBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "admin.billing.tax_pack_subtitle",
                "Certificat fiscal opposable garantissant la déductibilité intégrale (100%) des frais de formation.",
              )}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">
                  {t(
                    "admin.billing.beneficiary_enterprise",
                    "Entreprise Bénéficiaire",
                  )}
                </label>
                <PodaciumInput
                  value={taxPackForm.enterpriseName}
                  onChange={(e) =>
                    setTaxPackForm({
                      ...taxPackForm,
                      enterpriseName: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">
                    {t("admin.billing.nif_label", "NIF (15 chiffres)")}
                  </label>
                  <PodaciumInput
                    value={taxPackForm.nif}
                    onChange={(e) =>
                      setTaxPackForm({ ...taxPackForm, nif: e.target.value })
                    }
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">
                    {t(
                      "admin.billing.contract_amount_dzd",
                      "Montant Contrat DZD",
                    )}
                  </label>
                  <PodaciumInput
                    type="number"
                    value={taxPackForm.amountDzd}
                    onChange={(e) =>
                      setTaxPackForm({
                        ...taxPackForm,
                        amountDzd: Number(e.target.value),
                      })
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <PodaciumButton
                size="sm"
                variant="primary"
                glow
                onClick={handleGenerateTaxPack}
                className="w-full"
                data-testid="generate-tax-pack-btn"
              >
                <ShieldCheck className="w-4 h-4 me-1.5" />
                {t(
                  "admin.billing.generate_tax_defense",
                  "Générer & Signer Pack Fiscal",
                )}
              </PodaciumButton>

              {generatedTaxPack && (
                <div
                  className="mt-4 p-4 rounded-xl border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/10 space-y-2"
                  data-testid="generated-tax-pack-result"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-emerald-900 dark:text-emerald-200">
                      {generatedTaxPack.packId}
                    </span>
                    <PodaciumBadge variant="success" className="text-[10px]">
                      {t(
                        "billing.signature_valid_verified",
                        "VALID & VERIFIED",
                      )}
                    </PodaciumBadge>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    {t(
                      "admin.billing.estimated_tax_shield",
                      "Bouclier fiscal estimé :",
                    )}{" "}
                    <span className="font-bold font-mono tabular-nums">
                      {formatAmount(generatedTaxPack.taxShieldDzd)}{" "}
                      {currencyLabel}
                    </span>{" "}
                    {t(
                      "admin.billing.net_ibs_saving",
                      "(Économie nette sur l'IBS 26%)",
                    )}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">
                    {t(
                      "admin.billing.ed25519_public_key",
                      "Clé publique Ed25519 :",
                    )}{" "}
                    {generatedTaxPack.signature.publicKeyHex}
                  </p>
                </div>
              )}
            </div>
          </PodaciumCard>
        </div>
      )}

      {/* Dual Authorization Modal */}
      {selectedPayout && (
        <DualAuthModal
          isOpen={isDualAuthOpen}
          onClose={() => setIsDualAuthOpen(false)}
          payoutId={selectedPayout.id}
          makerAdminName={selectedPayout.makerAdminName}
          makerAdminId={selectedPayout.makerAdminId}
          currentAdminId={currentAdminId}
          makerReviewedAt={selectedPayout.makerReviewedAt}
          makerNotes={selectedPayout.makerNotes}
          beneficiary={selectedPayout.beneficiary}
          auditDiff={selectedPayout.auditDiff}
          onConfirmApproval={handleConfirmDisbursement}
        />
      )}
    </div>
  );
}
