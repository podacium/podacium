"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Plus,
  Trash2,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { useTranslations, useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api, OrganizationResponse } from "@/lib/api";

import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export interface FactureProformaModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: OrganizationResponse;
  onSuccess?: (proforma: any) => void;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceDzd: number;
}

export function FactureProformaModal({
  isOpen,
  onClose,
  organization,
  onSuccess,
}: FactureProformaModalProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [items, setItems] = useState<LineItem[]>([
    {
      id: "1",
      description:
        "Pack Licences EdTech Entreprise & Certifications (10 sièges)",
      quantity: 1,
      unitPriceDzd: 150000,
    },
  ]);
  const [article169Eligible, setArticle169Eligible] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProforma, setGeneratedProforma] = useState<any | null>(null);
  const [copiedRip, setCopiedRip] = useState<boolean>(false);

  const officialRip = "004 00123 4567890123 45";
  const podaciumLegal = {
    name: "SARL PODACIUM BI & TECH",
    address: "04 Rue Didouche Mourad, Alger Centre, 16000 Alger",
    rc: "16B0123456",
    nif: "002016012345678",
    nis: "002016012345678",
    ai: "16012345678",
    bank: "Banque Extérieure d'Algérie (BEA)",
    agency: "Agence 004 - Alger Centre",
    rip: officialRip,
  };

  // Calculations
  const subtotalDzd = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + (it.quantity || 0) * (it.unitPriceDzd || 0),
      0,
    );
  }, [items]);

  const tvaRate = article169Eligible ? 0.0 : 0.19;
  const tvaDzd = subtotalDzd * tvaRate;
  const totalTtc = subtotalDzd + tvaDzd;
  const ibsSavingsDzd = totalTtc * 0.26;

  const handleAddItem = () => {
    const newItem: LineItem = {
      id: String(Date.now()),
      description: "",
      quantity: 1,
      unitPriceDzd: 50000,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof LineItem, val: any) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          return { ...it, [field]: val };
        }
        return it;
      }),
    );
  };

  const handleCopyRip = () => {
    navigator.clipboard.writeText(officialRip.replace(/\s+/g, ""));
    setCopiedRip(true);
    toast.success(t("organizations.topUp.ripCopied"));
    setTimeout(() => setCopiedRip(false), 2500);
  };

  const handleGenerate = async () => {
    // Validate
    const invalidItem = items.find(
      (it) => !it.description.trim() || it.unitPriceDzd <= 0,
    );
    if (invalidItem) {
      setError(t("organizations.nameRequired"));
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: it.quantity,
          unitPriceDzd: it.unitPriceDzd,
        })),
        notes: notes.trim() || undefined,
        article169Eligible,
      };

      const result = await api.generateOrganizationProforma(
        organization.id,
        payload,
      );
      setGeneratedProforma(result);
      toast.success(
        t("organizations.proforma.successTitle").replace(
          "{ref}",
          result.proformaReference,
        ),
      );
      onSuccess?.(result);
    } catch (err: any) {
      console.error("Failed to generate proforma:", err);
      setError(err?.message || t("organizations.branding.brandingSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePdf = () => {
    const pf = generatedProforma || {
      proformaReference: `PF-2026-${organization.id.toString().padStart(4, "0")}-${Math.floor(
        Math.random() * 90000 + 10000,
      )}`,
      issuedAt: new Date().toISOString(),
    };

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor: [number, number, number] = [27, 77, 62]; // #1B4D3E
    const textDark: [number, number, number] = [30, 41, 59];

    // Document Header Banner
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("FACTURE PROFORMA", 15, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Réf: ${pf.proformaReference} | Date: ${new Date().toLocaleDateString("fr-DZ")}`,
      15,
      20,
    );

    doc.text("PODACIUM ENTERPRISE OS", 195, 16, { align: "right" });

    // Issuer (Podacium) Box
    doc.setTextColor(...textDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Émetteur / Vendeur:", 15, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(podaciumLegal.name, 15, 41);
    doc.text(podaciumLegal.address, 15, 46);
    doc.text(`RC: ${podaciumLegal.rc} | NIF: ${podaciumLegal.nif}`, 15, 51);
    doc.text(
      `NIS: ${podaciumLegal.nis} | Art. Imp: ${podaciumLegal.ai}`,
      15,
      56,
    );

    // Client Organization Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Client / Destinataire:", 115, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(organization.name, 115, 41);
    doc.text(
      `${organization.city || "Alger"}, ${organization.country || "Algérie"}`,
      115,
      46,
    );
    doc.text(`RC: ${(organization as any).rcNumber || "En cours"}`, 115, 51);
    doc.text(
      `NIF: ${(organization as any).nifNumber || "Non spécifié"}`,
      115,
      56,
    );

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 66, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Désignation des Prestations", 18, 71.5);
    doc.text("Qté", 125, 71.5, { align: "center" });
    doc.text("P.U (DZD)", 155, 71.5, { align: "right" });
    doc.text("Total HT (DZD)", 192, 71.5, { align: "right" });

    // Table Items
    let y = 80;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    items.forEach((it, idx) => {
      const lineTotal = (it.quantity || 1) * (it.unitPriceDzd || 0);
      doc.setFontSize(8.5);
      doc.text(it.description || `Prestation #${idx + 1}`, 18, y);
      doc.text(String(it.quantity || 1), 125, y, { align: "center" });
      doc.text((it.unitPriceDzd || 0).toLocaleString("fr-DZ"), 155, y, {
        align: "right",
      });
      doc.text(lineTotal.toLocaleString("fr-DZ"), 192, y, { align: "right" });
      y += 8;
    });

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 2, 195, y + 2);
    y += 10;

    // Financial Totals Summary
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Sous-total Hors Taxes (HT):", 130, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${subtotalDzd.toLocaleString("fr-DZ")} DZD`, 192, y, {
      align: "right",
    });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.text(
      `TVA (${article169Eligible ? "0% - Exonéré Art. 169" : "19%"}):`,
      130,
      y,
    );
    doc.setFont("helvetica", "bold");
    doc.text(`${tvaDzd.toLocaleString("fr-DZ")} DZD`, 192, y, {
      align: "right",
    });
    y += 7;

    doc.setFillColor(...primaryColor);
    doc.rect(125, y - 4, 70, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL À RÉGLER (TTC):", 128, y + 2);
    doc.text(`${totalTtc.toLocaleString("fr-DZ")} DZD`, 192, y + 2, {
      align: "right",
    });
    y += 16;

    // Fiscal Tax Shield Clause (Article 169 & 224 CIDTA)
    doc.setTextColor(...textDark);
    if (article169Eligible) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(15, y, 180, 22, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(22, 101, 52);
      doc.text(
        "BOUCLIER FISCAL ENTREPRISE (Articles 169 & 224 du CIDTA):",
        19,
        y + 6,
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(
        "Les dépenses relatives aux formations techniques, licences d'apprentissage et ingénierie décisionnelle sont",
        19,
        y + 11,
      );
      doc.text(
        "déductibles à 100% de l'assiette de l'Impôt sur les Bénéfices des Sociétés (IBS au taux standard de 26%).",
        19,
        y + 15,
      );
      doc.setFont("helvetica", "bold");
      doc.text(
        `Économie fiscale nette estimée pour l'exercice en cours: ${ibsSavingsDzd.toLocaleString("fr-DZ")} DZD.`,
        19,
        y + 19,
      );
      y += 28;
    }

    // Bank Wire Instructions (RIP 20 digits)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, 180, 26, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text(
      "INSTRUCTIONS DE RÈGLEMENT PAR VIREMENT BANCAIRE (RIP 20 CHIFFRES):",
      19,
      y + 6,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    doc.text(
      `Banque: ${podaciumLegal.bank} (${podaciumLegal.agency})`,
      19,
      y + 11,
    );
    doc.text(`Bénéficiaire: ${podaciumLegal.name}`, 19, y + 15);
    doc.setFont("helvetica", "bold");
    doc.text(`RIP: ${podaciumLegal.rip}`, 19, y + 20);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Libellé obligatoire du virement: ${pf.proformaReference}`,
      19,
      y + 24,
    );

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Document généré par Podacium OS - Validité 30 jours à compter de la date d'émission.",
      105,
      287,
      { align: "center" },
    );

    doc.save(`Facture_Proforma_${pf.proformaReference}.pdf`);
    toast.success(t("organizations.proforma.downloadPdf"));
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("organizations.proforma.modalTitle")}
      description={t("organizations.proforma.modalDesc")}
      size="xl"
    >
      <div className="space-y-6 pt-2">
        {generatedProforma ? (
          /* Success Screen with Proforma reference and download button */
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-foreground">
                {t("organizations.proforma.successTitle").replace(
                  "{ref}",
                  generatedProforma.proformaReference,
                )}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {organization.name} · {totalTtc.toLocaleString("fr-DZ")} DZD
              </p>
            </div>

            {/* Bank Wire Details Box */}
            <div className="p-4 rounded-xl bg-card border border-border text-start space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("organizations.proforma.bankWireRip")}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-mono font-bold text-base text-foreground"
                  dir="ltr"
                >
                  {officialRip}
                </span>
                <PodaciumButton
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
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
              <div className="text-[11px] text-muted-foreground">
                {t("organizations.proforma.beneficiary")}:{" "}
                <span className="font-bold text-foreground">
                  {podaciumLegal.name}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <PodaciumButton
                variant="primary"
                glow
                icon={<Download className="w-4 h-4" />}
                onClick={generatePdf}
              >
                {t("organizations.proforma.downloadPdf")}
              </PodaciumButton>

              <PodaciumButton variant="outline" onClick={onClose}>
                {t("organizations.proforma.cancel")}
              </PodaciumButton>
            </div>
          </div>
        ) : (
          /* Proforma Request Form */
          <>
            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("organizations.proforma.itemDescription")}
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("organizations.proforma.addItem")}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border border-border bg-card/60"
                  >
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder={t(
                          "organizations.proforma.itemDescPlaceholder",
                        )}
                        className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "quantity",
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                        className="w-full text-xs text-center font-mono font-bold px-2 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="w-36 relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.unitPriceDzd}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "unitPriceDzd",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full text-xs font-mono font-bold px-2 py-2 pe-10 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-end"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                        DZD
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(item.id)}
                      className={cn(
                        "p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0",
                        items.length <= 1 && "opacity-30 cursor-not-allowed",
                      )}
                      title={t("organizations.proforma.removeItem")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Article 169 & 224 Tax Shield Checkbox */}
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10 flex items-start gap-3">
              <input
                type="checkbox"
                id="article169Eligible"
                checked={article169Eligible}
                onChange={(e) => setArticle169Eligible(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor="article169Eligible"
                className="cursor-pointer text-xs space-y-0.5"
              >
                <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {t("organizations.proforma.article169Label")}
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {t("organizations.proforma.article169Hint")}
                </p>
              </label>
            </div>

            {/* Notes / PO Reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t("organizations.proforma.notesLabel")}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("organizations.proforma.notesPlaceholder")}
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Financial Summary Calculation Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("organizations.proforma.subtotalHt")}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {subtotalDzd.toLocaleString("fr-DZ")} DZD
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("organizations.proforma.tvaAmount")}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {tvaDzd.toLocaleString("fr-DZ")} DZD
                </span>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
                <span className="font-bold text-foreground">
                  {t("organizations.proforma.totalTtc")}
                </span>
                <span className="font-mono font-bold text-primary text-base">
                  {totalTtc.toLocaleString("fr-DZ")} DZD
                </span>
              </div>

              {article169Eligible && (
                <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>{t("organizations.proforma.taxShieldSavings")}</span>
                  <span className="font-mono font-bold">
                    -{ibsSavingsDzd.toLocaleString("fr-DZ")} DZD
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <PodaciumButton
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t("organizations.proforma.cancel")}
              </PodaciumButton>

              <PodaciumButton
                type="button"
                variant="primary"
                glow
                loading={isSubmitting}
                onClick={handleGenerate}
                icon={<FileText className="w-4 h-4" />}
              >
                {isSubmitting
                  ? t("organizations.proforma.generating")
                  : t("organizations.proforma.generateBtn")}
              </PodaciumButton>
            </div>
          </>
        )}
      </div>
    </PodaciumModal>
  );
}

export default FactureProformaModal;
