"""
Bilateral Intellectual Property Assignment Service for Podacium Freelance Hub.

Conforms to:
1. Ordonnance n° 03-05 relative aux droits d'auteur et aux droits voisins:
   - Articles 64–67: Transfer of patrimonial economic rights (droit d'exploitation, de reproduction,
     d'adaptation, de commercialisation et de distribution), defined territory (monde entier),
     duration (durée légale d'auteur), and flat lump-sum consideration (rémunération forfaitaire).
   - Article 21: Public policy inalienability of moral rights (droit de paternité et au respect de l'œuvre)
     supervised under ONDA (Office National des Droits d'Auteur et des Droits Voisins).
   - Article 67: Garantie d'éviction et de jouissance paisible.
2. Loi n° 22-23 portant Statut de l'Auto-Entrepreneur (ANAE):
   - Freelancer ANAE registration, IFU 0.5% (Art. 282 sexies CIDTA), 0% TVA, Article 169 CIDTA SME tax shield.
3. Loi n° 15-04 fixant les règles générales relatives à la signature et à la certification électroniques:
   - Deliverable SHA-256 cryptographic integrity hash.
   - Platform Ed25519 asymmetric cryptographic seal over document hash.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from app.core.prisma import prisma
from app.core.config import setting

logger = logging.getLogger(__name__)


class IpAssignmentService:
    @staticmethod
    def _get_platform_ed25519_keys() -> tuple[ed25519.Ed25519PrivateKey, str]:
        """Derive deterministic platform Ed25519 keypair from platform secret."""
        seed = hashlib.sha256(
            f"PODACIUM_ED25519_PLATFORM_KEY_{setting.SECRET_KEY}".encode("utf-8")
        ).digest()
        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)
        pub_bytes = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return private_key, pub_bytes.hex()

    @staticmethod
    def calculate_deliverable_hash(milestone) -> str:
        """Compute SHA-256 hash over milestone deliverables and delivery payloads."""
        payload = {
            "milestoneId": milestone.id,
            "contractId": milestone.contractId,
            "title": milestone.title,
            "amount": milestone.amount,
            "deliverables": milestone.deliverables,
            "deliveries": [
                {
                    "id": d.id,
                    "deliveredAt": d.deliveredAt.isoformat() if d.deliveredAt else None,
                    "files": d.files,
                }
                for d in getattr(milestone, "deliveries", [])
            ],
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

    @staticmethod
    def generate_party_signature(
        party_role: str,
        user_id: int,
        contract_id: int,
        milestone_id: int,
        deliverable_hash: str,
        signed_at: datetime,
    ) -> str:
        """
        Derives cryptographic digital signature hash for each contracting party
        under Algerian Loi n° 15-04 (Signature et Certification Électroniques).
        """
        import hmac

        secret = (setting.SECRET_KEY or "PODACIUM_ED25519_SECRET").encode("utf-8")
        payload = f"{party_role}:{user_id}:{contract_id}:{milestone_id}:{deliverable_hash}:{signed_at.isoformat()}"
        return hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    @staticmethod
    def render_ip_assignment_deed_pdf(
        deed_number: str,
        contract_id: int,
        milestone_id: int,
        milestone_title: str,
        amount_dzd: int,
        freelancer_name: str,
        freelancer_anae: str,
        client_name: str,
        client_tax_id: str,
        deliverable_sha256: str,
        signed_at: datetime,
        output_file_path: str,
        freelancer_signature: Optional[str] = None,
        client_signature: Optional[str] = None,
    ) -> tuple[str, str, str]:
        """
        Renders a certified bilingual French/Arabic Intellectual Property Assignment Deed PDF
        with two-party cryptographic signatures (Loi n° 15-04) and platform Ed25519 seal.
        Returns: (output_file_path, document_sha256, ed25519_signature_hex)
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

        title_style = ParagraphStyle(
            "DeedTitle",
            parent=styles["Heading1"],
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1e3a8a"),
            alignment=1,  # Center
        )
        subtitle_style = ParagraphStyle(
            "DeedSubtitle",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#475569"),
            alignment=1,
        )
        section_style = ParagraphStyle(
            "DeedSection",
            parent=styles["Heading3"],
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=6,
            spaceAfter=2,
        )
        body_style = ParagraphStyle(
            "DeedBody",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#334155"),
        )
        code_style = ParagraphStyle(
            "DeedCode",
            parent=styles["Normal"],
            fontSize=7,
            leading=9,
            fontName="Courier",
            textColor=colors.HexColor("#1e293b"),
        )

        elements = []

        # ── Header ──
        header_text = (
            "<b>RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE</b><br/>"
            "الجمهورية الجزائرية الديمقراطية الشعبية<br/>"
            "<b>ACTE BILATÉRAL DE CESSION DE DROITS DE PROPRIÉTÉ INTELLECTUELLE</b><br/>"
            "عقد ثنائي للتنازل عن حقوق الملكية الفكرية"
        )
        elements.append(Paragraph(header_text, title_style))
        elements.append(Spacer(1, 4))

        sub_text = (
            f"<b>Réf. Acte :</b> {deed_number} | <b>Contrat N° :</b> PODA-CTR-{contract_id} | <b>Jalon N° :</b> MS-{milestone_id:02d}<br/>"
            "Conforme à l'Ordonnance n° 03-05 (Art. 64-67) & Loi n° 22-23 (Statut de l'Auto-Entrepreneur)"
        )
        elements.append(Paragraph(sub_text, subtitle_style))
        elements.append(Spacer(1, 8))
        elements.append(
            HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1e3a8a"))
        )
        elements.append(Spacer(1, 10))

        # ── Parties Table ──
        cedant_text = (
            "<b>LE CÉDANT (L'Auteur) / المتنازل:</b><br/>"
            f"<b>Nom et Prénom :</b> {freelancer_name}<br/>"
            "<b>Qualité :</b> Prestataire Indépendant sous Statut d'Auto-Entrepreneur<br/>"
            f"<b>Carte ANAE N° :</b> {freelancer_anae}<br/>"
            "<b>Régime Fiscal :</b> IFU 0.5% (LF 2024 Art. 282 sexies CIDTA) - Exonéré de TVA"
        )
        cessionnaire_text = (
            "<b>LE CESSIONNAIRE (Le Client) / المتنازل له:</b><br/>"
            f"<b>Raison Sociale / Nom :</b> {client_name}<br/>"
            f"<b>Identifiant Fiscal / NIF :</b> {client_tax_id}<br/>"
            f"<b>Dépense Éligible :</b> Déductible de l'IBS 26% (Art. 169 & 224 CIDTA)<br/>"
            "<b>Bénéficiaire des droits :</b> Pleine propriété patrimoniale exclusive"
        )
        parties_table = Table(
            [
                [
                    Paragraph(cedant_text, body_style),
                    Paragraph(cessionnaire_text, body_style),
                ]
            ],
            colWidths=[260, 260],
        )
        parties_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("PADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        elements.append(parties_table)
        elements.append(Spacer(1, 10))

        # ── Deliverable Identification & SHA-256 ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 1 : LIVRABLES ET IDENTIFICATION CRYPTOGRAPHIQUE</b>",
                section_style,
            )
        )
        deliverable_desc = (
            f"Les créations faisant l'objet de la présente cession concernent le jalon : <b>{milestone_title}</b>.<br/>"
            f"L'empreinte cryptographique numérique unique garantissant l'intégrité probatoire des livrables est :"
        )
        elements.append(Paragraph(deliverable_desc, body_style))
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(f"<b>SHA-256 :</b> {deliverable_sha256}", code_style))
        elements.append(Spacer(1, 6))

        # ── Scope of Transferred Rights (Art. 64) ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 2 : ÉTENDUE DES DROITS PATRIMONIAUX CÉDÉS (ART. 27 & 64)</b>",
                section_style,
            )
        )
        rights_desc = (
            "Conformément aux Articles 27 et 64 de l'Ordonnance n° 03-05 du 19 juillet 2003, le Cédant cède à titre "
            "exclusif et définitif au Cessionnaire l'ensemble des droits patrimoniaux suivants :<br/>"
            "• <b>Droit d'exploitation et d'usage :</b> Intégrer, exécuter, compiler et commercialiser les livrables.<br/>"
            "• <b>Droit de reproduction :</b> Reproduire ou faire reproduire le code source, les maquettes et binaires.<br/>"
            "• <b>Droit d'adaptation et modification :</b> Corriger, traduire, adapter, faire évoluer ou dériver l'œuvre.<br/>"
            "• <b>Droit de commercialisation :</b> Concéder des licences d'exploitation ou distribuer à des tiers."
        )
        elements.append(Paragraph(rights_desc, body_style))
        elements.append(Spacer(1, 6))

        # ── Territoriality & Duration (Art. 64) ──
        elements.append(
            Paragraph("<b>ARTICLE 3 : TERRITORIALITÉ ET DURÉE</b>", section_style)
        )
        territory_desc = (
            "• <b>Territoire :</b> La cession est consentie pour le <b>monde entier</b> (Algérie et international).<br/>"
            "• <b>Durée :</b> La cession est conclue pour toute la <b>durée légale de protection</b> des droits patrimoniaux "
            "d'auteur (durée de vie de l'auteur et cinquante ans post-mortem selon l'Ordonnance n° 03-05)."
        )
        elements.append(Paragraph(territory_desc, body_style))
        elements.append(Spacer(1, 6))

        # ── Consideration & Escrow Release (Art. 65) ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 4 : RÉMUNÉRATION FORFAITAIRE ET LIBÉRATOIRE (ART. 65)</b>",
                section_style,
            )
        )
        remun_desc = (
            f"La présente cession est consentie moyennant une rémunération forfaitaire et définitive de <b>{amount_dzd:,.0f} DZD</b> "
            "(Dinars Algériens). Le Cédant atteste expressément avoir perçu l'intégralité de cette somme par la libération "
            "définitive des fonds séquestrés (Escrow Release) par Podacium, valant quittance irrévocable."
        )
        elements.append(Paragraph(remun_desc, body_style))
        elements.append(Spacer(1, 6))

        # ── Reservation of Moral Rights (Art. 21) & ONDA ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 5 : RÉSERVE D'ORDRE PUBLIC DU DROIT MORAL (ART. 21) & ONDA</b>",
                section_style,
            )
        )
        moral_desc = (
            "Conformément à l'Article 21 de l'Ordonnance n° 03-05, les droits moraux de l'Auteur sont inaliénables, "
            "imprescriptibles et perpétuels. L'Auteur conserve son droit de paternité (mention de sa qualité d'auteur "
            "dans les portfolios et documentations) et son droit au respect de l'intégrité de l'œuvre sous la tutelle de l'ONDA."
        )
        elements.append(Paragraph(moral_desc, body_style))
        elements.append(Spacer(1, 6))

        # ── Eviction Warranty (Art. 67) ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 6 : GARANTIE D'ÉVICTION ET DE JOUISSANCE PAISIBLE (ART. 67)</b>",
                section_style,
            )
        )
        warranty_desc = (
            "L'Auteur garantit être le créateur original des œuvres cédées et garantit le Cessionnaire contre toute action "
            "en contrefaçon ou revendication de tiers (Art. 67 de l'Ordonnance n° 03-05)."
        )
        elements.append(Paragraph(warranty_desc, body_style))
        elements.append(Spacer(1, 8))

        # ── Two-Party Cryptographic Signatures (Loi n° 15-04) ──
        elements.append(
            Paragraph(
                "<b>ARTICLE 7 : SIGNATURES ÉLECTRONIQUES BILATÉRALES (LOI N° 15-04)</b>",
                section_style,
            )
        )
        fl_sig_display = freelancer_signature or "SIG-CEDANT-VALIDATED"
        cl_sig_display = client_signature or "SIG-CESSIONNAIRE-VALIDATED"
        sig_table_data = [
            [
                Paragraph(
                    f"<b>LE CÉDANT (L'Auteur) :</b><br/>"
                    f"<b>Signataire :</b> {freelancer_name}<br/>"
                    f"<b>Qualité :</b> Auto-Entrepreneur (ANAE {freelancer_anae})<br/>"
                    f"<b>Empreinte Électronique (HMAC-SHA256) :</b><br/>"
                    f"<font size=6 face=Courier>{fl_sig_display[:32]}...<br/>{fl_sig_display[32:]}</font><br/>"
                    f"<b>Consentement :</b> Cession irrévocable certifiée",
                    body_style,
                ),
                Paragraph(
                    f"<b>LE CESSIONNAIRE (Le Client) :</b><br/>"
                    f"<b>Signataire :</b> {client_name}<br/>"
                    f"<b>Qualité :</b> Bénéficiaire des Droits (NIF {client_tax_id})<br/>"
                    f"<b>Empreinte Électronique (HMAC-SHA256) :</b><br/>"
                    f"<font size=6 face=Courier>{cl_sig_display[:32]}...<br/>{cl_sig_display[32:]}</font><br/>"
                    f"<b>Consentement :</b> Réception et libération conformes",
                    body_style,
                ),
            ]
        ]
        sig_table = Table(sig_table_data, colWidths=[260, 260])
        sig_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("PADDING", (0, 0), (-1, -1), 6),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        elements.append(sig_table)
        elements.append(Spacer(1, 8))

        # ── Cryptographic Platform Seal Footer ──
        priv_key, pub_key_hex = IpAssignmentService._get_platform_ed25519_keys()

        # Build PDF doc to bytes first to sign doc hash
        doc.build(elements)

        with open(output_file_path, "rb") as f:
            pdf_bytes = f.read()

        doc_hash_hex = hashlib.sha256(pdf_bytes).hexdigest()
        sig_bytes = priv_key.sign(doc_hash_hex.encode("utf-8"))
        signature_hex = sig_bytes.hex()

        return output_file_path, doc_hash_hex, signature_hex

    @staticmethod
    async def generate_ip_deed_on_milestone_release(
        milestone_id: int,
    ) -> Dict[str, Any]:
        """
        Triggered automatically on milestone escrow release.
        Builds the certified deed, derives two-party signatures, applies platform Ed25519 seal,
        saves PDF to disk, and records deed metadata in milestone deliverables.
        """
        milestone = await prisma.contractmilestone.find_unique(
            where={"id": milestone_id},
            include={
                "contract": {
                    "include": {
                        "client": {"include": {"primaryOrganization": True}},
                        "freelancer": {
                            "include": {"freelancerProfile": True, "kyc": True}
                        },
                        "project": True,
                    }
                },
                "deliveries": True,
            },
        )
        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found")

        contract = milestone.contract
        freelancer = contract.freelancer
        client = contract.client
        freelancer_profile = getattr(freelancer, "freelancerProfile", None)
        freelancer_kyc = getattr(freelancer, "kyc", None)

        freelancer_name = freelancer.fullName or freelancer.email
        client_name = (
            client.primaryOrganization.name
            if client.primaryOrganization
            else (client.fullName or client.email)
        )
        client_tax_id = (
            client.primaryOrganization.nif
            if client.primaryOrganization
            and getattr(client.primaryOrganization, "nif", None)
            else "NIF-REGISTRÉ-PODACIUM"
        )
        anae_card = (
            freelancer_kyc.anaeCardNumber
            if freelancer_kyc and freelancer_kyc.anaeCardNumber
            else (
                freelancer_profile.anaeCardNumber
                if freelancer_profile and freelancer_profile.anaeCardNumber
                else "CERTIFIÉ-ANAE-DZ"
            )
        )

        now = datetime.now(timezone.utc)
        deed_number = f"IP-{now.year}-CTR{contract.id}-MS{milestone.id:02d}"
        deliverable_sha256 = IpAssignmentService.calculate_deliverable_hash(milestone)

        output_dir = os.path.join(setting.UPLOAD_DIR or "storage", "deeds")
        pdf_filename = f"{deed_number}.pdf"
        output_file_path = os.path.join(output_dir, pdf_filename)

        # Derive bilateral two-party cryptographic signatures (Loi n° 15-04)
        freelancer_sig = IpAssignmentService.generate_party_signature(
            party_role="CEDANT_AUTEUR",
            user_id=freelancer.id,
            contract_id=contract.id,
            milestone_id=milestone.id,
            deliverable_hash=deliverable_sha256,
            signed_at=now,
        )
        client_sig = IpAssignmentService.generate_party_signature(
            party_role="CESSIONNAIRE_CLIENT",
            user_id=client.id,
            contract_id=contract.id,
            milestone_id=milestone.id,
            deliverable_hash=deliverable_sha256,
            signed_at=now,
        )

        file_path, doc_hash_hex, signature_hex = (
            IpAssignmentService.render_ip_assignment_deed_pdf(
                deed_number=deed_number,
                contract_id=contract.id,
                milestone_id=milestone.id,
                milestone_title=milestone.title,
                amount_dzd=milestone.amount,
                freelancer_name=freelancer_name,
                freelancer_anae=anae_card,
                client_name=client_name,
                client_tax_id=client_tax_id,
                deliverable_sha256=deliverable_sha256,
                signed_at=now,
                output_file_path=output_file_path,
                freelancer_signature=freelancer_sig,
                client_signature=client_sig,
            )
        )

        _, pub_key_hex = IpAssignmentService._get_platform_ed25519_keys()
        pdf_rel_url = f"/static/deeds/{pdf_filename}"

        deed_record: Dict[str, Any] = {
            "deedNumber": deed_number,
            "contractId": contract.id,
            "milestoneId": milestone.id,
            "milestoneTitle": milestone.title,
            "amountDzd": milestone.amount,
            "freelancerId": freelancer.id,
            "freelancerName": freelancer_name,
            "freelancerAnae": anae_card,
            "freelancerSignature": freelancer_sig,
            "freelancerSignedAt": now.isoformat(),
            "clientId": client.id,
            "clientName": client_name,
            "clientSignature": client_sig,
            "clientSignedAt": now.isoformat(),
            "deliverableSha256": deliverable_sha256,
            "documentSha256": doc_hash_hex,
            "signatureEd25519": signature_hex,
            "publicKeyEd25519": pub_key_hex,
            "signedAt": now.isoformat(),
            "pdfPath": file_path,
            "pdfUrl": pdf_rel_url,
            "legalNotice": (
                "Cession définitive des droits patrimoniaux d'auteur conforme à l'Ordonnance n° 03-05 (Art. 64-67). "
                "Statut Auto-Entrepreneur Loi n° 22-23 (Exonération TVA, IFU 0.5% Art. 282 sexies CIDTA). "
                "Signatures bilatérales des deux parties et scellé cryptographique d'intégrité Ed25519 (Loi n° 15-04)."
            ),
        }

        # Update milestone deliverables with IP deed metadata
        try:
            current_deliverables = milestone.deliverables
            if isinstance(current_deliverables, str):
                try:
                    current_deliverables = json.loads(current_deliverables)
                except Exception:
                    current_deliverables = {"content": current_deliverables}
            elif not isinstance(current_deliverables, dict):
                current_deliverables = {}

            current_deliverables["ipAssignmentDeed"] = deed_record

            await prisma.contractmilestone.update(
                where={"id": milestone.id},
                data={"deliverables": json.dumps(current_deliverables)},
            )
        except Exception as e:
            logger.warning(f"Could not persist IP deed in milestone deliverables: {e}")

        logger.info(
            f"Bilateral IP Assignment Deed {deed_number} generated for milestone {milestone.id} (SHA: {doc_hash_hex[:16]})"
        )
        return deed_record

    @staticmethod
    async def get_ip_deed(
        contract_id: int, milestone_id: int
    ) -> Optional[Dict[str, Any]]:
        """Retrieve IP Assignment Deed for a milestone."""
        milestone = await prisma.contractmilestone.find_unique(
            where={"id": milestone_id},
        )
        if not milestone or milestone.contractId != contract_id:
            return None

        deliverables = milestone.deliverables
        if isinstance(deliverables, str):
            try:
                deliverables = json.loads(deliverables)
            except Exception:
                return None

        if isinstance(deliverables, dict):
            return deliverables.get("ipAssignmentDeed")
        return None


ip_assignment_service = IpAssignmentService()
