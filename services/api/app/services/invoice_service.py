"""
Invoice and Legal Compliance Service.

Generates legally compliant Algerian invoices and the Triple Document Kit:
1. Type 1: Platform SaaS / Service Fee Invoice (19% TVA, Platform NIF, NIS, RC, Art. Imposition)
2. Type 2: ANAE Freelancer Invoice (0% TVA, Loi 22-23 / IFU 0.5% Art. 282 sexies CIDTA, Art. 169 CIDTA SME tax deductibility)
3. Triple Document Kit: Contrat de Prestation, PV de Réception, Facture ANAE
"""

import os
import logging
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

from app.core.prisma import prisma
from app.core.config import setting

logger = logging.getLogger(__name__)

# Statutory Notice for Stamp Duty Exemption on Electronic/Cashless Payments
# Art. 258 quinquies du Code du Timbre (amended by Loi de Finances 2024, Art. 34)
STAMP_DUTY_EXEMPTION_NOTICE = (
    "Droit de Timbre: 0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34)"
)

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for _font_path in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]:
    if os.path.exists(_font_path):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", _font_path))
            FONT_REGULAR = "DejaVuSans"
            break
        except Exception:
            pass

for _font_bold_path in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]:
    if os.path.exists(_font_bold_path):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", _font_bold_path))
            FONT_BOLD = "DejaVuSans-Bold"
            break
        except Exception:
            pass


class InvoiceService:
    @staticmethod
    def generate_invoice_number(prefix: str, invoice_id: int) -> str:
        year = datetime.now(timezone.utc).year
        return f"INV-{year}-{prefix}-{invoice_id:06d}"

    @staticmethod
    def amount_to_words_fr(n: int) -> str:
        """Converts an integer amount in DZD into French words."""
        n = abs(int(n))
        if n == 0:
            return "zéro"

        units = [
            "",
            "un",
            "deux",
            "trois",
            "quatre",
            "cinq",
            "six",
            "sept",
            "huit",
            "neuf",
        ]
        teens = [
            "dix",
            "onze",
            "douze",
            "treize",
            "quatorze",
            "quinze",
            "seize",
            "dix-sept",
            "dix-huit",
            "dix-neuf",
        ]
        tens = [
            "",
            "dix",
            "vingt",
            "trente",
            "quarante",
            "cinquante",
            "soixante",
            "soixante-dix",
            "quatre-vingt",
            "quatre-vingt-dix",
        ]

        def chunk_under_1000(num: int) -> str:
            res: List[str] = []
            c = num // 100
            rem = num % 100
            if c > 0:
                if c == 1:
                    res.append("cent")
                else:
                    res.append(units[c] + (" cents" if rem == 0 else " cent"))
            if rem > 0:
                if rem < 10:
                    res.append(units[rem])
                elif rem < 20:
                    res.append(teens[rem - 10])
                elif rem < 70:
                    t = rem // 10
                    u = rem % 10
                    if u == 1 and t in [2, 3, 4, 5, 6]:
                        res.append(f"{tens[t]} et un")
                    elif u > 0:
                        res.append(f"{tens[t]}-{units[u]}")
                    else:
                        res.append(tens[t])
                elif rem < 80:
                    u = rem - 60
                    if u == 11:
                        res.append("soixante et onze")
                    else:
                        res.append(f"soixante-{teens[u - 10] if u >= 10 else units[u]}")
                elif rem < 90:
                    u = rem - 80
                    if u == 0:
                        res.append("quatre-vingts")
                    else:
                        res.append(f"quatre-vingt-{units[u]}")
                else:
                    u = rem - 80
                    res.append(f"quatre-vingt-{teens[u - 10]}")
            return " ".join(res)

        chunks: List[str] = []
        billions = n // 1_000_000_000
        n %= 1_000_000_000
        millions = n // 1_000_000
        n %= 1_000_000
        thousands = n // 1_000
        units_part = n % 1_000

        if billions > 0:
            chunks.append(
                f"{chunk_under_1000(billions)} milliard" + ("s" if billions > 1 else "")
            )
        if millions > 0:
            chunks.append(
                f"{chunk_under_1000(millions)} million" + ("s" if millions > 1 else "")
            )
        if thousands > 0:
            if thousands == 1:
                chunks.append("mille")
            else:
                chunks.append(f"{chunk_under_1000(thousands)} mille")
        if units_part > 0:
            chunks.append(chunk_under_1000(units_part))

        return " ".join(chunks)

    @staticmethod
    def amount_to_words_ar(n: int) -> str:
        """Converts an integer amount in DZD into Arabic words."""
        n = abs(int(n))
        if n == 0:
            return "صفر"

        units = [
            "",
            "واحد",
            "اثنان",
            "ثلاثة",
            "أربعة",
            "خمسة",
            "ستة",
            "سبعة",
            "ثمانية",
            "تسعة",
        ]
        teens = [
            "عشرة",
            "أحد عشر",
            "اثنا عشر",
            "ثلاثة عشر",
            "أربعة عشر",
            "خمسة عشر",
            "ستة عشر",
            "سبعة عشر",
            "ثمانية عشر",
            "تسعة عشر",
        ]
        tens = [
            "",
            "عشرة",
            "عشرون",
            "ثلاثون",
            "أربعون",
            "خمسون",
            "ستون",
            "سبعون",
            "ثمانون",
            "تسعون",
        ]
        hundreds = [
            "",
            "مائة",
            "مائتان",
            "ثلاثمائة",
            "أربعمائة",
            "خمسمائة",
            "ستمائة",
            "سبعمائة",
            "ثمانمائة",
            "تسعمائة",
        ]

        def chunk_under_1000(num: int) -> str:
            res: List[str] = []
            c = num // 100
            rem = num % 100
            if c > 0:
                res.append(hundreds[c])
            if rem > 0:
                if rem < 10:
                    res.append(units[rem])
                elif rem < 20:
                    res.append(teens[rem - 10])
                else:
                    t = rem // 10
                    u = rem % 10
                    if u > 0:
                        res.append(f"{units[u]} و{tens[t]}")
                    else:
                        res.append(tens[t])
            return " و".join(res)

        chunks: List[str] = []
        billions = n // 1_000_000_000
        n %= 1_000_000_000
        millions = n // 1_000_000
        n %= 1_000_000
        thousands = n // 1_000
        units_part = n % 1_000

        if billions > 0:
            if billions == 1:
                chunks.append("مليار")
            elif billions == 2:
                chunks.append("ملياران")
            elif 3 <= billions <= 10:
                chunks.append(f"{chunk_under_1000(billions)} ملايير")
            else:
                chunks.append(f"{chunk_under_1000(billions)} مليار")

        if millions > 0:
            if millions == 1:
                chunks.append("مليون")
            elif millions == 2:
                chunks.append("مليونان")
            elif 3 <= millions <= 10:
                chunks.append(f"{chunk_under_1000(millions)} ملايين")
            else:
                chunks.append(f"{chunk_under_1000(millions)} مليون")

        if thousands > 0:
            if thousands == 1:
                chunks.append("ألف")
            elif thousands == 2:
                chunks.append("ألفان")
            elif 3 <= thousands <= 10:
                chunks.append(f"{chunk_under_1000(thousands)} آلاف")
            else:
                chunks.append(f"{chunk_under_1000(thousands)} ألف")

        if units_part > 0:
            chunks.append(chunk_under_1000(units_part))

        return " و".join(chunks)

    @staticmethod
    def render_invoice_pdf(
        invoice_number: str,
        invoice_type: str,
        issued_at: datetime,
        paid_at: Optional[datetime],
        recipient_name: str,
        recipient_email: str,
        recipient_tax_id: Optional[str],
        items: List[Dict[str, Any]],
        subtotal_dzd: int,
        tax_dzd: int,
        total_dzd: int,
        tax_rate_percent: float,
        legal_notice: str,
        output_file_path: str,
    ) -> str:
        """
        Renders a certified Algerian commercial invoice PDF conforming to:
        - Loi n° 18-05 relative au commerce électronique (Article 11)
        - Articles 169 & 282 sexies du CIDTA
        - Mentions fiscales obligatoires: NIF, NIS, RC, Art. Imp., TVA / Exonération
        """
        os.makedirs(os.path.dirname(output_file_path), exist_ok=True)
        doc = SimpleDocTemplate(
            output_file_path,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()
        elements = []

        issuer_text = (
            "<b>SARL PODACIUM BI & TECH</b><br/>"
            "Plateforme Nationale EdTech, Freelancing & BI<br/>"
            f"<b>NIF:</b> {setting.PLATFORM_NIF} | <b>NIS:</b> {setting.PLATFORM_NIS}<br/>"
            f"<b>RC:</b> {setting.PLATFORM_RC} | <b>Art. Imp:</b> {setting.PLATFORM_ARTICLE_IMPOSITION}<br/>"
            "12 Rue Didouche Mourad, Alger Centre, Algérie"
        )

        status_text = (
            "<font color='#059669'><b>ACQUITTÉE / PAID</b></font>"
            if paid_at
            else "<font color='#d97706'><b>ÉMISE / ISSUED</b></font>"
        )

        facture_text = (
            f"<font size=16 color='#1e3a8a'><b>FACTURE COMMERCIALE</b></font><br/>"
            f"<b>N° Facture:</b> {invoice_number}<br/>"
            f"<b>Date d'émission:</b> {issued_at.strftime('%d/%m/%Y %H:%M')}<br/>"
            f"<b>Statut Règlement:</b> {status_text}<br/>"
            f"<b>Régime Fiscal:</b> {invoice_type}"
        )

        header_table = Table(
            [
                [
                    Paragraph(issuer_text, styles["Normal"]),
                    Paragraph(facture_text, styles["Normal"]),
                ]
            ],
            colWidths=[310, 210],
        )
        header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        elements.append(header_table)
        elements.append(Spacer(1, 12))
        elements.append(
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"))
        )
        elements.append(Spacer(1, 12))

        recipient_info = (
            "<b>FACTURÉ À / CLIENT :</b><br/>"
            f"<b>Nom / Raison Sociale :</b> {recipient_name}<br/>"
            f"<b>Email :</b> {recipient_email}<br/>"
        )
        if recipient_tax_id:
            recipient_info += f"<b>Identifiant Fiscal :</b> {recipient_tax_id}<br/>"

        recipient_table = Table(
            [[Paragraph(recipient_info, styles["Normal"])]], colWidths=[520]
        )
        recipient_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        elements.append(recipient_table)
        elements.append(Spacer(1, 16))

        table_rows = [
            [
                Paragraph("<b>Désignation de la Prestation</b>", styles["Normal"]),
                Paragraph("<b>Qté</b>", styles["Normal"]),
                Paragraph("<b>P.U. HT (DZD)</b>", styles["Normal"]),
                Paragraph("<b>Total HT (DZD)</b>", styles["Normal"]),
            ]
        ]

        for it in items:
            desc = it.get("description", "Prestation de service")
            qty = str(it.get("quantity", 1))
            pu = f"{it.get('unitPriceDzd', 0):,} DZD"
            tot = f"{it.get('totalPriceDzd', 0):,} DZD"
            table_rows.append(
                [
                    Paragraph(desc, styles["Normal"]),
                    Paragraph(qty, styles["Normal"]),
                    Paragraph(pu, styles["Normal"]),
                    Paragraph(tot, styles["Normal"]),
                ]
            )

        items_table = Table(table_rows, colWidths=[290, 40, 95, 95])
        items_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        elements.append(items_table)
        elements.append(Spacer(1, 16))

        tva_label = (
            f"TVA ({tax_rate_percent:.1f}%)"
            if tax_rate_percent > 0
            else "TVA (0% Exonéré Loi 22-23)"
        )
        totals_data = [
            ["Sous-total HT :", f"{subtotal_dzd:,} DZD"],
            [f"{tva_label} :", f"{tax_dzd:,} DZD"],
            [
                "Droit de Timbre :",
                "0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34)",
            ],
            ["Total TTC Net Réglé :", f"{total_dzd:,} DZD"],
        ]
        totals_table = Table(totals_data, colWidths=[200, 320])
        totals_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, -1), (-1, -1), 11),
                    ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#1e3a8a")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(totals_table)
        elements.append(Spacer(1, 14))

        # Montant en toutes lettres (Obligation légale commerciale algérienne)
        amount_words_fr = InvoiceService.amount_to_words_fr(total_dzd)
        amount_words_ar = InvoiceService.amount_to_words_ar(total_dzd)
        words_html = (
            f"<b>Arrêtée la présente facture à la somme de :</b><br/>"
            f"• <i>En français :</i> {amount_words_fr.capitalize()} dinars algériens<br/>"
            f"• <i>بالعربية :</i> {amount_words_ar} دينار جزائري"
        )
        words_style = ParagraphStyle(
            "InvoiceWordsStyle",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )
        words_table = Table([[Paragraph(words_html, words_style)]], colWidths=[520])
        words_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(words_table)
        elements.append(Spacer(1, 14))

        legal_text = (
            f"<b>Mentions Légales & Fiscales Algériennes :</b><br/>"
            f"{legal_notice}<br/>"
            f"<b>Droit de Timbre :</b> 0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34) - Paiement par voie électronique / sans numéraire.<br/>"
            f"<i>Conforme à la Loi n° 18-05 relative au commerce électronique. "
            f"Facture acquittée valant quittance de règlement opposable aux tiers et à l'administration fiscale.</i>"
        )
        legal_table = Table(
            [[Paragraph(legal_text, styles["Normal"])]], colWidths=[520]
        )
        legal_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(legal_table)

        doc.build(elements)
        return output_file_path

    @staticmethod
    async def ensure_invoice_pdf(invoice: Any) -> str:
        """
        Ensures a physical certified PDF invoice exists on disk for the given Invoice record.
        Returns the absolute filesystem path to the PDF file.
        """
        filename = f"{invoice.invoiceNumber}.pdf"
        invoices_dir = os.path.join(setting.UPLOAD_DIR, "invoices")
        os.makedirs(invoices_dir, exist_ok=True)
        pdf_path = os.path.join(invoices_dir, filename)

        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
            return pdf_path

        # Resolve recipient details
        recipient_name = "Client"
        recipient_email = "client@podacium.com"
        recipient_tax_id = None

        if invoice.recipientType == "ORGANIZATION" and invoice.recipientId:
            org = await prisma.organization.find_unique(
                where={"id": invoice.recipientId}
            )
            if org:
                recipient_name = org.name
                recipient_email = (
                    getattr(org, "billingEmail", None) or "billing@enterprise.dz"
                )
                tax_parts = []
                if getattr(org, "rcNumber", None):
                    tax_parts.append(f"RC: {org.rcNumber}")
                if getattr(org, "nifNumber", None):
                    tax_parts.append(f"NIF: {org.nifNumber}")
                if getattr(org, "nisNumber", None):
                    tax_parts.append(f"NIS: {org.nisNumber}")
                if getattr(org, "articleImposition", None):
                    tax_parts.append(f"Art. Imp: {org.articleImposition}")
                recipient_tax_id = (
                    " | ".join(tax_parts)
                    if tax_parts
                    else f"NIF: {getattr(org, 'nif', 'Non renseigné')}"
                )
        elif invoice.recipientId:
            user = await prisma.user.find_unique(where={"id": invoice.recipientId})
            if user:
                recipient_name = getattr(user, "fullName", None) or user.email
                recipient_email = user.email

        # Fetch items
        items = getattr(invoice, "items", None)
        if not items:
            items_records = await prisma.invoiceitem.find_many(
                where={"invoiceId": invoice.id}
            )
            items = [
                item.model_dump() if hasattr(item, "model_dump") else item.__dict__
                for item in items_records
            ]
        else:
            items = [
                item.model_dump() if hasattr(item, "model_dump") else item.__dict__
                for item in items
            ]

        if not items:
            items = [
                {
                    "description": f"Prestation de services Podacium - {invoice.type}",
                    "quantity": 1,
                    "unitPriceDzd": invoice.subtotalDzd,
                    "totalPriceDzd": invoice.subtotalDzd,
                }
            ]

        inv_type_str = (
            invoice.type
            if isinstance(invoice.type, str)
            else getattr(invoice.type, "value", "PLATFORM_FEE")
        )

        InvoiceService.render_invoice_pdf(
            invoice_number=invoice.invoiceNumber,
            invoice_type=inv_type_str,
            issued_at=invoice.issuedAt or datetime.now(timezone.utc),
            paid_at=invoice.paidAt,
            recipient_name=recipient_name,
            recipient_email=recipient_email,
            recipient_tax_id=recipient_tax_id,
            items=items,
            subtotal_dzd=invoice.subtotalDzd,
            tax_dzd=invoice.taxDzd,
            total_dzd=invoice.totalDzd,
            tax_rate_percent=invoice.taxRatePercent,
            legal_notice=invoice.legalNotice or "Conforme Loi 18-05 & Art. 169 CIDTA.",
            output_file_path=pdf_path,
        )

        rel_url = f"/static/invoices/{filename}"
        await prisma.invoice.update(
            where={"id": invoice.id},
            data={"pdfUrl": rel_url},
        )

        return pdf_path

    @staticmethod
    async def create_platform_invoice(
        recipient_id: int,
        recipient_type: str,
        amount_dzd: int,
        description: str,
        tax_rate: float = 0.19,
        contract_id: Optional[int] = None,
        milestone_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create a platform fee invoice with 19% TVA and legal notices."""
        subtotal = round(amount_dzd / (1 + tax_rate)) if tax_rate > 0 else amount_dzd
        tax = amount_dzd - subtotal
        now = datetime.now(timezone.utc)

        temp_number = f"TEMP-{uuid.uuid4().hex[:12]}"
        legal_notice = (
            f"Facture émise par Podacium SARL. RC: {setting.PLATFORM_RC} | "
            f"NIF: {setting.PLATFORM_NIF} | NIS: {setting.PLATFORM_NIS} | "
            f"Art. Imp: {setting.PLATFORM_ARTICLE_IMPOSITION}. TVA {int(tax_rate*100)}% incluse. "
            f"Droit de Timbre: 0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34)."
        )

        async with prisma.tx() as tx:
            invoice = await tx.invoice.create(
                data={
                    "invoiceNumber": temp_number,
                    "type": "PLATFORM_FEE",
                    "status": "PAID",
                    "issuerId": None,
                    "issuerType": "PLATFORM",
                    "recipientId": recipient_id,
                    "recipientType": recipient_type,
                    "contractId": contract_id,
                    "milestoneId": milestone_id,
                    "subtotalDzd": subtotal,
                    "taxDzd": tax,
                    "totalDzd": amount_dzd,
                    "taxRatePercent": tax_rate * 100,
                    "legalNotice": legal_notice,
                    "paidAt": now,
                }
            )

            real_number = InvoiceService.generate_invoice_number("PLT", invoice.id)
            await tx.invoice.update(
                where={"id": invoice.id},
                data={"invoiceNumber": real_number},
            )

            await tx.invoiceitem.create(
                data={
                    "invoiceId": invoice.id,
                    "description": description,
                    "quantity": 1,
                    "unitPriceDzd": subtotal,
                    "totalPriceDzd": subtotal,
                }
            )

        # Ensure certified PDF is generated
        saved_invoice = await prisma.invoice.find_unique(
            where={"id": invoice.id},
            include={"items": True},
        )
        pdf_path = await InvoiceService.ensure_invoice_pdf(saved_invoice)
        pdf_rel_url = f"/static/invoices/{real_number}.pdf"

        amount_words_fr = InvoiceService.amount_to_words_fr(amount_dzd)
        amount_words_ar = InvoiceService.amount_to_words_ar(amount_dzd)

        return {
            "id": invoice.id,
            "invoice_number": real_number,
            "type": "PLATFORM_FEE",
            "subtotal_dzd": subtotal,
            "tax_dzd": tax,
            "total_dzd": amount_dzd,
            "amount_words_fr": f"{amount_words_fr.capitalize()} dinars algériens",
            "amount_words_ar": f"{amount_words_ar} دينار جزائري",
            "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
            "legal_notice": legal_notice,
            "paid_at": now.isoformat(),
            "pdf_url": pdf_rel_url,
            "pdf_path": pdf_path,
        }

    @staticmethod
    async def create_anae_freelancer_invoice(
        freelancer_id: int,
        client_id: int,
        contract_id: int,
        milestone_id: int,
        amount_dzd: int,
        service_title: str,
    ) -> Dict[str, Any]:
        """Create compliant ANAE Freelancer invoice under Loi 22-23 (0% TVA, IFU 0.5% Art. 282 sexies CIDTA)."""
        freelancer = await prisma.user.find_unique(
            where={"id": freelancer_id},
            include={"freelancerProfile": True, "kyc": True},
        )
        if not freelancer:
            raise ValueError("errors.freelancing.freelancer_not_found")

        client = await prisma.user.find_unique(
            where={"id": client_id},
            include={
                "primaryOrganization": True,
                "ownedOrganizations": True,
                "memberships": True,
            },
        )
        if not client:
            raise ValueError("errors.freelancing.client_not_found")

        anae_card = (
            freelancer.kyc.anaeCardNumber
            if freelancer.kyc and freelancer.kyc.anaeCardNumber
            else (
                freelancer.freelancerProfile.anaeCardNumber
                if freelancer.freelancerProfile
                else "NON-RENSEIGNE"
            )
        )

        now = datetime.now(timezone.utc)
        current_year = now.year
        start_date = datetime(current_year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(current_year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

        # Track annual 5,000,000 DZD turnover ceiling under Loi 22-23 / Art. 282 sexies CIDTA
        prior_invoices = await prisma.invoice.find_many(
            where={
                "issuerId": freelancer_id,
                "issuerType": "USER",
                "type": "FREELANCER_SERVICE",
                "status": "PAID",
                "createdAt": {"gte": start_date, "lte": end_date},
            }
        )
        prior_turnover = sum(inv.totalDzd for inv in prior_invoices)
        new_annual_turnover = prior_turnover + amount_dzd

        ceiling_limit = 5_000_000
        is_ceiling_exceeded = new_annual_turnover > ceiling_limit
        ceiling_utilization = round((new_annual_turnover / ceiling_limit) * 100, 2)
        remaining_headroom = max(0, ceiling_limit - new_annual_turnover)

        if is_ceiling_exceeded:
            logger.warning(
                "ANAE Freelancer %s exceeded annual 5,000,000 DZD turnover ceiling: %s DZD",
                freelancer_id,
                new_annual_turnover,
            )

        current_quarter = (now.month - 1) // 3 + 1
        ifu_tax_05 = round(amount_dzd * 0.005)
        tax_shield_ibs_26 = round(amount_dzd * 0.26)

        temp_number = f"TEMP-ANAE-{uuid.uuid4().hex[:12]}"
        legal_notice = (
            f"Facture établie sous le statut d'Auto-Entrepreneur (Loi n° 22-23). "
            f"Carte ANAE N°: {anae_card}. "
            f"Régime fiscal: IFU 0.5% (LF 2024 Art. 282 sexies CIDTA). "
            f"Exonéré de TVA en vertu de la législation en vigueur. "
            f"Dépense éligible à la déductibilité intégrale de l'IBS client au taux de 26% (Art. 169 & 282 sexies CIDTA - "
            f"Bouclier fiscal effectif de {tax_shield_ibs_26:,} DZD). "
            f"Droit de Timbre: 0 DZD (Exonéré Art. 258 quinquies / LF 2024 Art. 34) - Loi 18-05 commerce électronique."
        )

        org_id = (
            client.primaryOrganizationId
            or (
                client.ownedOrganizations[0].id
                if getattr(client, "ownedOrganizations", None)
                else None
            )
            or (client.memberships[0].organizationId if client.memberships else None)
        )
        recipient_type = "ORGANIZATION" if org_id else "USER"
        recipient_id = org_id if org_id else client.id

        async with prisma.tx() as tx:
            invoice = await tx.invoice.create(
                data={
                    "invoiceNumber": temp_number,
                    "type": "FREELANCER_SERVICE",
                    "status": "PAID",
                    "issuerId": freelancer_id,
                    "issuerType": "USER",
                    "recipientId": recipient_id,
                    "recipientType": recipient_type,
                    "contractId": contract_id,
                    "milestoneId": milestone_id,
                    "subtotalDzd": amount_dzd,
                    "taxDzd": 0,
                    "totalDzd": amount_dzd,
                    "taxRatePercent": 0.0,
                    "legalNotice": legal_notice,
                    "paidAt": now,
                }
            )

            real_number = InvoiceService.generate_invoice_number("ANAE", invoice.id)
            await tx.invoice.update(
                where={"id": invoice.id},
                data={"invoiceNumber": real_number},
            )

            await tx.invoiceitem.create(
                data={
                    "invoiceId": invoice.id,
                    "description": f"Prestation freelance: {service_title}",
                    "quantity": 1,
                    "unitPriceDzd": amount_dzd,
                    "totalPriceDzd": amount_dzd,
                }
            )

        saved_invoice = await prisma.invoice.find_unique(
            where={"id": invoice.id},
            include={"items": True},
        )
        pdf_path = await InvoiceService.ensure_invoice_pdf(saved_invoice)
        pdf_rel_url = f"/static/invoices/{real_number}.pdf"

        amount_words_fr = InvoiceService.amount_to_words_fr(amount_dzd)
        amount_words_ar = InvoiceService.amount_to_words_ar(amount_dzd)

        return {
            "id": invoice.id,
            "invoice_number": real_number,
            "type": "FREELANCER_SERVICE",
            "freelancer_id": freelancer_id,
            "anae_card_number": anae_card,
            "total_dzd": amount_dzd,
            "tax_dzd": 0,
            "amount_words_fr": f"{amount_words_fr.capitalize()} dinars algériens",
            "amount_words_ar": f"{amount_words_ar} دينار جزائري",
            "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
            "legal_notice": legal_notice,
            "tax_shield_ibs_26_dzd": tax_shield_ibs_26,
            "ifu_tax_due_dzd": ifu_tax_05,
            "ifu_rate_percent": 0.5,
            "quarter": current_quarter,
            "annual_turnover_dzd": new_annual_turnover,
            "turnover_ceiling_dzd": ceiling_limit,
            "ceiling_utilization_percent": ceiling_utilization,
            "remaining_ceiling_headroom_dzd": remaining_headroom,
            "is_ceiling_exceeded": is_ceiling_exceeded,
            "paid_at": now.isoformat(),
            "pdf_url": pdf_rel_url,
            "pdf_path": pdf_path,
        }

    @staticmethod
    async def get_freelancer_ceiling_status(
        freelancer_id: int,
        fiscal_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Track annual auto-entrepreneur turnover against 5,000,000 DZD ceiling (Loi 22-23)."""
        year = fiscal_year or datetime.now(timezone.utc).year
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

        invoices = await prisma.invoice.find_many(
            where={
                "issuerId": freelancer_id,
                "issuerType": "USER",
                "type": "FREELANCER_SERVICE",
                "status": "PAID",
                "createdAt": {"gte": start_date, "lte": end_date},
            }
        )
        total_turnover = sum(inv.totalDzd for inv in invoices)
        ceiling_limit = 5_000_000
        utilization = round((total_turnover / ceiling_limit) * 100, 2)
        exceeded = total_turnover > ceiling_limit
        ifu_tax_due = round(total_turnover * 0.005)

        return {
            "freelancer_id": freelancer_id,
            "fiscal_year": year,
            "total_turnover_dzd": total_turnover,
            "turnover_ceiling_dzd": ceiling_limit,
            "ceiling_utilization_percent": utilization,
            "remaining_headroom_dzd": max(0, ceiling_limit - total_turnover),
            "is_ceiling_exceeded": exceeded,
            "total_ifu_tax_due_dzd": ifu_tax_due,
            "invoice_count": len(invoices),
        }

    @staticmethod
    async def get_freelancer_g50_quarterly_breakdown(
        freelancer_id: int,
        fiscal_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Computes G50 quarterly IFU (0.5%) breakdown for an ANAE freelancer."""
        from app.services.fiscal_ledger_service import fiscal_ledger_service

        year = fiscal_year or datetime.now(timezone.utc).year
        report = await fiscal_ledger_service.generate_freelancer_g50_report(
            freelancer_id=freelancer_id,
            fiscal_year=year,
        )
        return report.model_dump() if hasattr(report, "model_dump") else report.dict()

    @staticmethod
    async def generate_milestone_kit(
        contract_id: int, milestone_id: int
    ) -> Dict[str, Any]:
        """Generate the complete Triple Document Kit for a completed milestone."""
        milestone = await prisma.contractmilestone.find_unique(
            where={"id": milestone_id},
            include={"contract": {"include": {"project": True}}},
        )
        if not milestone:
            raise ValueError("errors.milestones.not_found")

        contract = milestone.contract
        freelancer_id = contract.freelancerId
        client_id = contract.clientId
        if not freelancer_id:
            raise ValueError("errors.contracts.no_assigned_freelancer")

        # 1. Generate ANAE Invoice
        anae_invoice = await InvoiceService.create_anae_freelancer_invoice(
            freelancer_id=freelancer_id,
            client_id=client_id,
            contract_id=contract_id,
            milestone_id=milestone_id,
            amount_dzd=milestone.amount,
            service_title=milestone.title,
        )

        # 2. PV de Réception
        now = datetime.now(timezone.utc)
        pv_content = {
            "document_type": "PROCES_VERBAL_DE_LIVRAISON_ET_RECEPTION",
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "milestone_title": milestone.title,
            "client_id": client_id,
            "freelancer_id": freelancer_id,
            "amount_dzd": milestone.amount,
            "date": now.isoformat(),
            "status": "CONFORME_ET_VALIDE",
            "conformity_statement": (
                "Le client atteste avoir reçu et validé l'intégralité des livrables "
                "associés au jalon spécifié, en pleine conformité avec le cahier des charges."
            ),
            "ip_transfer_statement": (
                "Conformément à l'Ordonnance n° 03-05 relative aux droits d'auteur et droits voisins, "
                "l'ensemble des droits patrimoniaux d'exploitation est intégralement cédé au client "
                "à compter de la confirmation définitive du règlement."
            ),
        }

        kit_hash = hashlib.sha256(
            json.dumps(
                {
                    "invoice_number": anae_invoice["invoice_number"],
                    "contract_id": contract_id,
                    "milestone_id": milestone_id,
                    "amount_dzd": milestone.amount,
                    "timestamp": now.isoformat(),
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()

        # Generate / Retrieve Bilateral IP Assignment Deed (Ordonnance 03-05 ONDA & Loi 22-23 ANAE)
        ip_deed = None
        try:
            from app.services.ip_assignment_service import ip_assignment_service

            ip_deed = await ip_assignment_service.generate_ip_deed_on_milestone_release(
                milestone_id
            )
        except Exception as e:
            logger.warning(f"Could not generate IP deed during milestone kit: {e}")

        return {
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "invoice": anae_invoice,
            "pv_reception": pv_content,
            "ip_assignment_deed": ip_deed,
            "verification_seal": kit_hash,
            "generated_at": now.isoformat(),
        }

    @staticmethod
    async def generate_invoice(transaction_id: int) -> Dict[str, Any]:
        """
        Generate a certified invoice for a completed Chargily transaction.
        Bridges Chargily Pay webhooks (checkout.paid) with certified invoice creation.
        """
        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id},
            include={"contract": True, "organization": True, "user": True},
        )
        if not transaction:
            logger.error(
                "Cannot generate invoice: Transaction %s not found", transaction_id
            )
            raise ValueError("errors.transactions.not_found")

        recipient_id = transaction.organizationId or transaction.userId
        recipient_type = "ORGANIZATION" if transaction.organizationId else "USER"
        if not recipient_id:
            logger.error(
                "Transaction %s has no associated user or organization", transaction_id
            )
            raise ValueError("errors.transactions.no_recipient")

        # Idempotency check: verify if an invoice item already references this transaction
        tx_ref_tag = f"TX-{transaction.id}"
        existing_item = await prisma.invoiceitem.find_first(
            where={"description": {"contains": tx_ref_tag}},
            include={"invoice": True},
        )
        if existing_item and existing_item.invoice:
            logger.info(
                "Invoice already exists for transaction %s: %s",
                transaction_id,
                existing_item.invoice.invoiceNumber,
            )
            pdf_path = await InvoiceService.ensure_invoice_pdf(existing_item.invoice)
            pdf_rel_url = f"/static/invoices/{existing_item.invoice.invoiceNumber}.pdf"
            amount_words_fr = InvoiceService.amount_to_words_fr(
                existing_item.invoice.totalDzd
            )
            amount_words_ar = InvoiceService.amount_to_words_ar(
                existing_item.invoice.totalDzd
            )
            return {
                "id": existing_item.invoice.id,
                "invoice_number": existing_item.invoice.invoiceNumber,
                "type": (
                    existing_item.invoice.type.value
                    if hasattr(existing_item.invoice.type, "value")
                    else str(existing_item.invoice.type)
                ),
                "subtotal_dzd": existing_item.invoice.subtotalDzd,
                "tax_dzd": existing_item.invoice.taxDzd,
                "total_dzd": existing_item.invoice.totalDzd,
                "amount_words_fr": f"{amount_words_fr.capitalize()} dinars algériens",
                "amount_words_ar": f"{amount_words_ar} دينار جزائري",
                "stamp_duty_notice": STAMP_DUTY_EXEMPTION_NOTICE,
                "legal_notice": existing_item.invoice.legalNotice,
                "paid_at": (
                    existing_item.invoice.paidAt.isoformat()
                    if existing_item.invoice.paidAt
                    else None
                ),
                "pdf_url": pdf_rel_url,
                "pdf_path": pdf_path,
            }

        # Format descriptive line with transaction purpose and provider reference
        purpose_label = (
            transaction.purpose.value
            if hasattr(transaction.purpose, "value")
            else str(transaction.purpose)
        )
        description = f"Règlement Podacium - {purpose_label} ({tx_ref_tag})"
        if transaction.providerReference:
            description += f" [Réf: {transaction.providerReference}]"

        # Certified Platform Invoice with 19% TVA & fiscal identifiers
        invoice_record = await InvoiceService.create_platform_invoice(
            recipient_id=recipient_id,
            recipient_type=recipient_type,
            amount_dzd=transaction.amount,
            description=description,
            contract_id=transaction.contractId,
        )

        logger.info(
            "Certified invoice %s created for transaction %s (%s DZD)",
            invoice_record["invoice_number"],
            transaction_id,
            transaction.amount,
        )
        return invoice_record


invoice_service = InvoiceService()
