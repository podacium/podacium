"""
Invoicing and DLG PC Compta SCF Integration Service.

Provides Algerian Système Comptable Financier (SCF) account mapping and validation
for automated DLG PC Compta / PC Paie journal generation and audit compliance:
- Compte 6181: Frais d'études, de recherche et sous-traitance freelancing (Loi 22-23)
- Compte 6186: Frais de formation professionnelle continue (Art. 169 & 224 CIDTA)
- Compte 411 / 411000: Créances Clients (Kridi / B2B Corporate Clients)
- Compte 512 / 512000: Banque et Trésorerie (Chargily Clearing / CCP / SATIM)
- Compte 401 / 401000: Dettes Fournisseurs (Fournisseurs / Prestataires ANAE)
- Compte 706 / 706000: Prestations de Services Podacium (Chiffre d'Affaires)
"""

import csv
import io
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# SCF Account Taxonomy for DLG PC Compta (Algerian Système Comptable Financier)
SCF_DLG_ACCOUNT_MAP: Dict[str, Dict[str, str]] = {
    "6181": {
        "category": "OPERATING_EXPENSE",
        "label": "Frais d'études, de recherche et de sous-traitance freelancing",
        "description": "Prestations d'études, d'ingénierie et freelancing indépendant (Loi n° 22-23)",
        "badge_color": "amber",
        "dlg_journal_type": "OD",
    },
    "6186": {
        "category": "OPERATING_EXPENSE",
        "label": "Frais de formation professionnelle continue",
        "description": "Formations professionnelles déductibles à 100% à l'IBS (Art. 169 & 224 CIDTA)",
        "badge_color": "amber",
        "dlg_journal_type": "OD",
    },
    "411": {
        "category": "ACCOUNTS_RECEIVABLE",
        "label": "Comptes Clients (Créances)",
        "description": "Créances clients B2B et B2C sous SCF",
        "badge_color": "blue",
        "dlg_journal_type": "VT",
    },
    "411000": {
        "category": "ACCOUNTS_RECEIVABLE",
        "label": "Client Compte Collectif",
        "description": "Compte auxiliaire clients réguliers Podacium",
        "badge_color": "blue",
        "dlg_journal_type": "VT",
    },
    "512": {
        "category": "TREASURY",
        "label": "Banque & Trésorerie",
        "description": "Comptes bancaires commerciaux et CCP",
        "badge_color": "cyan",
        "dlg_journal_type": "BQ",
    },
    "512000": {
        "category": "TREASURY",
        "label": "Banque / Chargily Clearing / Satim",
        "description": "Compte de compensation passerelle de paiement électronique (Chargily / Satim / EDAHABIA / CIB)",
        "badge_color": "cyan",
        "dlg_journal_type": "BQ",
    },
    "401": {
        "category": "ACCOUNTS_PAYABLE",
        "label": "Fournisseurs",
        "description": "Dettes fournisseurs et sous-traitants",
        "badge_color": "rose",
        "dlg_journal_type": "AC",
    },
    "401000": {
        "category": "ACCOUNTS_PAYABLE",
        "label": "Fournisseur / Prestataire ANAE",
        "description": "Compte collectif prestataires auto-entrepreneurs ANAE",
        "badge_color": "rose",
        "dlg_journal_type": "AC",
    },
    "706": {
        "category": "REVENUE",
        "label": "Prestations de Services",
        "description": "Chiffre d'affaires de prestations de services",
        "badge_color": "emerald",
        "dlg_journal_type": "VT",
    },
    "706000": {
        "category": "REVENUE",
        "label": "Prestation de Services Podacium",
        "description": "Chiffre d'affaires plateforme EdTech & BI Podacium (19% TVA)",
        "badge_color": "emerald",
        "dlg_journal_type": "VT",
    },
    "44571": {
        "category": "TAX_PAYABLE",
        "label": "TVA Collectée (19%)",
        "description": "TVA collectée sur prestations de services",
        "badge_color": "purple",
        "dlg_journal_type": "VT",
    },
}

STAMP_DUTY_EXEMPTION_NOTICE = (
    "Droit de Timbre: 0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34)"
)


class DLGJournalEntrySchema(BaseModel):
    journal_code: str = Field(
        default="BQ", description="DLG journal code (BQ, VT, AC, OD)"
    )
    date: str = Field(..., description="Transaction date YYYY-MM-DD")
    piece_ref: str = Field(..., description="Voucher / Invoice reference")
    account: str = Field(
        ..., description="SCF account number (e.g. 512000, 411000, 6181, 6186)"
    )
    libelle: str = Field(..., description="Transaction narration / label")
    debit: float = Field(default=0.0, ge=0.0)
    credit: float = Field(default=0.0, ge=0.0)


class InvoicingService:
    """Enterprise service integrating Algerian SCF accounts with DLG PC Compta exports."""

    @staticmethod
    def get_stamp_duty_notice() -> str:
        """Returns the statutory stamp duty exemption notice for electronic / cashless payments."""
        return STAMP_DUTY_EXEMPTION_NOTICE

    @staticmethod
    def validate_scf_account(account_code: str) -> bool:
        """
        Validates whether an account code conforms to Algerian SCF standards.
        Must be a non-empty numeric string matching known SCF class prefixes (1 through 7).
        """
        clean = re.sub(r"\D", "", str(account_code).strip())
        if not clean or len(clean) < 2:
            return False
        # Algerian SCF classes: 1 (Capitaux), 2 (Immobilisations), 3 (Stocks),
        # 4 (Tiers), 5 (Financiers), 6 (Charges), 7 (Produits)
        return clean[0] in "1234567"

    @staticmethod
    def map_scf_account(account_code: str) -> Tuple[str, str, str, str]:
        """
        Maps raw account number (e.g. 6181, 6186, 411, 411000, 512, 512000) to SCF taxonomy.
        Returns tuple: (category, label, badge_color, matched_prefix).
        """
        clean = re.sub(r"\D", "", str(account_code).strip())
        for length in [6, 5, 4, 3, 2, 1]:
            prefix = clean[:length]
            if prefix in SCF_DLG_ACCOUNT_MAP:
                mapping = SCF_DLG_ACCOUNT_MAP[prefix]
                return (
                    mapping["category"],
                    mapping["label"],
                    mapping["badge_color"],
                    prefix,
                )

        # Fallback based on primary SCF class
        primary_class = clean[:1] if clean else "0"
        fallback_map: Dict[str, Tuple[str, str, str]] = {
            "1": ("EQUITY", "Comptes de capitaux", "slate"),
            "2": ("FIXED_ASSET", "Comptes d'immobilisations", "slate"),
            "3": ("INVENTORY", "Comptes de stocks et en-cours", "amber"),
            "4": ("ACCOUNTS_RECEIVABLE", "Comptes de tiers", "blue"),
            "5": ("TREASURY", "Comptes financiers / Trésorerie", "cyan"),
            "6": ("OPERATING_EXPENSE", "Comptes de charges", "amber"),
            "7": ("REVENUE", "Comptes de produits (Ventes)", "emerald"),
        }
        cat, label, badge = fallback_map.get(
            primary_class, ("OTHER", "Compte Général", "slate")
        )
        return cat, label, badge, clean[:2] if len(clean) >= 2 else clean

    @staticmethod
    def get_account_for_service(service_type: str) -> str:
        """
        Determines the appropriate SCF account number based on service classification:
        - Training / Formation -> Compte 6186 (Art. 169 CIDTA)
        - Freelancing / Études / Software engineering -> Compte 6181 (Loi 22-23)
        - Client receivable -> Compte 411000
        - Bank / Electronic clearing -> Compte 512000
        """
        norm = service_type.strip().lower()
        if any(
            kw in norm
            for kw in [
                "formation",
                "training",
                "course",
                "edtech",
                "elearning",
                "certif",
            ]
        ):
            return "6186"
        if any(
            kw in norm
            for kw in [
                "freelance",
                "freelancing",
                "etude",
                "étude",
                "consult",
                "dev",
                "tech",
                "logiciel",
            ]
        ):
            return "6181"
        if any(kw in norm for kw in ["client", "receivable", "customer", "kridi"]):
            return "411000"
        if any(
            kw in norm
            for kw in [
                "banque",
                "bank",
                "chargily",
                "clearing",
                "edahabia",
                "cib",
                "satim",
                "ccp",
            ]
        ):
            return "512000"
        return "6181"

    @staticmethod
    def generate_dlg_scf_entry(
        date: str,
        piece_ref: str,
        account: str,
        libelle: str,
        debit: float = 0.0,
        credit: float = 0.0,
        journal_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized dictionary entry suitable for DLG PC Compta."""
        clean_acc = re.sub(r"\D", "", str(account).strip())
        resolved_journal = journal_code
        if not resolved_journal:
            # Infer from account prefix
            for length in [6, 4, 3, 2, 1]:
                p = clean_acc[:length]
                if p in SCF_DLG_ACCOUNT_MAP:
                    resolved_journal = SCF_DLG_ACCOUNT_MAP[p].get(
                        "dlg_journal_type", "BQ"
                    )
                    break
            resolved_journal = resolved_journal or "BQ"

        return {
            "journal": resolved_journal,
            "date": date,
            "piece": piece_ref,
            "compte": clean_acc,
            "libelle": libelle,
            "debit": round(float(debit), 2),
            "credit": round(float(credit), 2),
        }

    @staticmethod
    def export_dlg_pc_compta_journal(
        entries: List[Dict[str, Any]],
        delimiter: str = "\t",
        default_journal_code: str = "BQ",
    ) -> str:
        """
        Exports list of transactions to DLG PC Compta tab-separated or semicolon-separated format.
        Header: JOURNAL\tDATE\tPIECE\tCOMPTE\tLIBELLE\tDEBIT\tCREDIT
        """
        output = io.StringIO()
        writer = csv.writer(output, delimiter=delimiter, lineterminator="\r\n")
        writer.writerow(
            ["JOURNAL", "DATE", "PIECE", "COMPTE", "LIBELLE", "DEBIT", "CREDIT"]
        )

        for e in entries:
            j_code = str(e.get("journal") or default_journal_code)
            d_str = str(
                e.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            )
            p_ref = str(e.get("piece") or e.get("piece_ref") or "PIECE")
            acct = str(e.get("compte") or e.get("account") or "512000")
            lbl = str(e.get("libelle") or "Ecriture SCF DLG")
            deb = float(e.get("debit") or 0.0)
            crd = float(e.get("credit") or 0.0)

            writer.writerow(
                [
                    j_code,
                    d_str,
                    p_ref,
                    acct,
                    lbl,
                    f"{deb:.2f}",
                    f"{crd:.2f}",
                ]
            )

        return output.getvalue()

    @staticmethod
    def calculate_ibs_tax_shield(
        expense_dzd: float,
        ibs_rate: float = 0.26,
    ) -> Dict[str, Any]:
        """
        Calculates the 26% corporate income tax (IBS) deduction shield under Article 169 & 224 CIDTA.
        Enterprise clients purchasing freelancing or training services can deduct 100% of expenses,
        yielding a direct tax saving of 26% (taux de droit commun IBS).
        """
        deductible_amount = round(float(expense_dzd), 2)
        effective_tax_savings = round(deductible_amount * ibs_rate, 2)
        return {
            "eligible": True,
            "statutory_basis": "Articles 169 & 224 du CIDTA (Loi de Finances)",
            "expense_amount_dzd": deductible_amount,
            "ibs_tax_rate": ibs_rate,
            "ibs_tax_rate_percent": f"{ibs_rate * 100:.1f}%",
            "effective_tax_savings_dzd": effective_tax_savings,
            "net_effective_cost_dzd": round(
                deductible_amount - effective_tax_savings, 2
            ),
            "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
        }

    @staticmethod
    def calculate_ifu_tax(
        turnover_dzd: float,
        ifu_rate: float = 0.005,
    ) -> Dict[str, Any]:
        """
        Calculates the 0.5% Impôt Forfaitaire Unique (IFU) liability under Article 282 sexies CIDTA
        (Loi de Finances 2024) for auto-entrepreneurs under Loi 22-23.
        """
        turnover = round(float(turnover_dzd), 2)
        ifu_due = round(turnover * ifu_rate, 2)
        return {
            "statutory_basis": "Loi 22-23 & Article 282 sexies CIDTA (LF 2024)",
            "turnover_dzd": turnover,
            "ifu_rate": ifu_rate,
            "ifu_rate_percent": f"{ifu_rate * 100:.1f}%",
            "ifu_tax_due_dzd": ifu_due,
            "tva_rate_percent": "0% (Exonéré de TVA en vertu de la Loi 22-23)",
            "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
        }

    @staticmethod
    def check_anae_turnover_ceiling(
        current_turnover_dzd: float,
        new_invoice_dzd: float = 0.0,
        ceiling_limit_dzd: float = 5_000_000.0,
    ) -> Dict[str, Any]:
        """
        Tracks auto-entrepreneur annual turnover against the statutory 5,000,000 DZD ceiling (Loi 22-23).
        Calculates utilization percentage, ceiling breach detection, and remaining headroom.
        """
        total = round(float(current_turnover_dzd + new_invoice_dzd), 2)
        utilization = round((total / ceiling_limit_dzd) * 100, 2)
        exceeded = total > ceiling_limit_dzd
        headroom = max(0.0, round(ceiling_limit_dzd - total, 2))
        return {
            "statutory_ceiling_dzd": ceiling_limit_dzd,
            "current_turnover_dzd": round(float(current_turnover_dzd), 2),
            "new_invoice_dzd": round(float(new_invoice_dzd), 2),
            "projected_annual_turnover_dzd": total,
            "ceiling_utilization_percent": utilization,
            "remaining_headroom_dzd": headroom,
            "is_ceiling_exceeded": exceeded,
            "warning": (
                f"Attention: Le seuil annuel légal de {ceiling_limit_dzd:,.0f} DZD est dépassé ({total:,.0f} DZD)."
                if exceeded
                else None
            ),
        }

    @staticmethod
    def calculate_g50_quarterly_breakdown(
        quarterly_turnovers: Dict[int, float],
        ifu_rate: float = 0.005,
    ) -> Dict[str, Any]:
        """
        Generates G50 quarterly IFU tax breakdown (0.5%) across quarters 1 through 4.
        """
        breakdown = []
        total_turnover = 0.0
        total_ifu = 0.0
        for q in range(1, 5):
            q_turnover = round(float(quarterly_turnovers.get(q, 0.0)), 2)
            q_ifu = round(q_turnover * ifu_rate, 2)
            total_turnover += q_turnover
            total_ifu += q_ifu
            breakdown.append(
                {
                    "quarter": q,
                    "turnover_dzd": q_turnover,
                    "ifu_tax_due_dzd": q_ifu,
                }
            )
        return {
            "fiscal_regime": "IFU 0.5% (LF 2024 Art. 282 sexies CIDTA / Loi 22-23)",
            "total_turnover_dzd": round(total_turnover, 2),
            "total_ifu_tax_due_dzd": round(total_ifu, 2),
            "quarters": breakdown,
            "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
        }


invoicing_service = InvoicingService()
