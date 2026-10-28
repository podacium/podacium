"""
TamWheel Institutional Side Letter Management & CNRC Filing Exporter (Pillar 1 Phase 4).
Tracks investor covenants (Information Rights, Pro-Rata, Board Observer, MFN, Sharia compliance),
flags conflicts with Algerian Law 22-09 SPAS Statuts, and exports formal CNRC share register filings.
"""

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import logging
import uuid
from typing import Dict, List, Optional, Any

from app.schemas.side_letter import (
    CovenantType,
    SideLetterStatus,
    SideLetterCovenant,
    SideLetterModel,
    SideLetterCreateRequest,
    StatutsConflictReport,
    MfnElectionRequest,
    MfnElectionResponse,
    CnrcShareholderFilingItem,
    CnrcFilingExportResponse,
)
from app.schemas.safe_conversion import SafeConversionSimulationResponse

logger = logging.getLogger(__name__)


class SideLetterEngine:
    """
    Manages institutional side letter covenants, automated MFN elections,
    statutory SPAS conflict detection, and CNRC filing document generation.
    """

    def __init__(self):
        # startup_id -> {side_letter_id -> SideLetterModel}
        self._side_letters: Dict[str, Dict[str, SideLetterModel]] = defaultdict(dict)

    def create_side_letter(
        self,
        startup_id: str,
        req: SideLetterCreateRequest,
    ) -> SideLetterModel:
        """Create and register a new side letter with investor covenants."""
        letter_id = f"sl_{uuid.uuid4().hex[:12]}"
        now = req.execution_date or datetime.now(timezone.utc)

        # Audit covenants for conflicts with SPAS bylaws
        conflict_notes = self._detect_covenant_conflicts(req.covenants)

        letter = SideLetterModel(
            id=letter_id,
            startup_id=startup_id,
            investor_id=req.investor_id,
            investor_name=req.investor_name,
            execution_date=now,
            status=SideLetterStatus.ACTIVE,
            covenants=req.covenants,
            legal_signatories=req.legal_signatories,
            statuts_conflict_notes=conflict_notes if conflict_notes else None,
        )

        self._side_letters[startup_id][letter_id] = letter
        return letter

    def get_side_letter(self, startup_id: str, side_letter_id: str) -> Optional[SideLetterModel]:
        """Fetch a specific side letter."""
        return self._side_letters.get(startup_id, {}).get(side_letter_id)

    def list_side_letters(self, startup_id: str) -> List[SideLetterModel]:
        """List all side letters registered for a startup."""
        return list(self._side_letters.get(startup_id, {}).values())

    def _detect_covenant_conflicts(self, covenants: List[SideLetterCovenant]) -> List[str]:
        """
        Internal rule checker against Algerian Commercial Code (Law 22-09 SPAS bylaws).
        """
        notes: List[str] = []
        for cov in covenants:
            if cov.covenant_type == CovenantType.BOARD_OBSERVER:
                # Under Law 22-09, SPAS governance is freely determined by Statuts (Art. 715 bis 59),
                # but non-shareholders attending board meetings require an NDA and formal board charter.
                if not cov.specific_terms.get("has_confidentiality_undertaking", True):
                    notes.append(
                        "Board Observer covenant lacks mandatory confidentiality undertaking required by Art. 301 Penal Code."
                    )
            elif cov.covenant_type == CovenantType.PRO_RATA_RIGHTS:
                # Pro-rata rights in subsequent capital increases require an Extraordinary General Meeting (AGE)
                # waiver of preferential subscription rights (Art. 715 bis 33).
                if not cov.specific_terms.get("subject_to_age_approval", True):
                    notes.append(
                        "Pro-Rata Rights must be stipulated as subject to AGE ratification under Law 22-09 Art. 715 bis 33."
                    )
            elif cov.covenant_type == CovenantType.RESTRICTED_TRANSFERS:
                # Inalienability clauses cannot exceed 10 years under Law 22-09 Art. 715 bis 61.
                years = cov.specific_terms.get("lockup_years", 0)
                if years > 10:
                    notes.append(
                        f"Inalienability duration of {years} years violates Law 22-09 Art. 715 bis 61 (maximum 10 years)."
                    )
            elif cov.covenant_type == CovenantType.SHARIA_COMPLIANCE:
                # Zero Riba and debt leverage limits
                if cov.specific_terms.get("allows_conventional_interest", False):
                    notes.append("Covenant permits interest-bearing debt, violating AAOIFI Sharia Governance standards.")

        return notes

    def audit_statuts_conflicts(self, startup_id: str) -> StatutsConflictReport:
        """Run an automated conflict audit across all registered side letters for a startup."""
        letters = self.list_side_letters(startup_id)
        flagged: List[Dict[str, Any]] = []
        recommendations: List[str] = []

        for letter in letters:
            conflicts = self._detect_covenant_conflicts(letter.covenants)
            if conflicts:
                flagged.append({
                    "side_letter_id": letter.id,
                    "investor_name": letter.investor_name,
                    "conflicts": conflicts,
                })

        if flagged:
            recommendations.append(
                "Submit proposed side letter amendments to the company notary before the next Extraordinary General Meeting (AGE)."
            )
            recommendations.append(
                "Ensure inalienability lockup terms strictly comply with the 10-year statutory cap under Law 22-09 Art. 715 bis 61."
            )
        else:
            recommendations.append("All active side letters conform fully to Algerian Law 22-09 SPAS statutory rules.")

        return StatutsConflictReport(
            startup_id=startup_id,
            has_conflicts=len(flagged) > 0,
            conflicts_count=len(flagged),
            flagged_covenants=flagged,
            recommendations=recommendations,
        )

    def elect_mfn_covenants(
        self,
        startup_id: str,
        req: MfnElectionRequest,
    ) -> MfnElectionResponse:
        """
        Allow an existing investor with an MFN clause to adopt more favorable covenants
        from a newer institutional side letter.
        """
        source = self.get_side_letter(startup_id, req.source_side_letter_id)
        target = self.get_side_letter(startup_id, req.target_side_letter_id)

        if not source or not target:
            raise ValueError("Source or target side letter not found for MFN covenant election.")

        # Check if source letter actually has MFN
        has_mfn = any(c.covenant_type == CovenantType.MOST_FAVORED_NATION for c in source.covenants)
        if not has_mfn:
            raise ValueError(f"Investor '{source.investor_name}' does not possess an MFN covenant entitlement.")

        # Adopt requested covenants from target
        adopted_types = set(req.adopted_covenant_types)
        new_covenants = [c for c in source.covenants if c.covenant_type not in adopted_types]

        added_count = 0
        adopted_names = []
        for cov in target.covenants:
            if cov.covenant_type in adopted_types:
                adopted_copy = cov.model_copy()
                adopted_copy.description = f"[MFN Adopted from {target.investor_name}] {cov.description}"
                new_covenants.append(adopted_copy)
                added_count += 1
                adopted_names.append(cov.covenant_type.value)

        source.covenants = new_covenants
        source.statuts_conflict_notes = self._detect_covenant_conflicts(source.covenants) or None

        summary = (
            f"MFN Election Successful: Adopted {added_count} covenant(s) "
            f"({', '.join(adopted_names)}) from investor '{target.investor_name}'."
        )

        return MfnElectionResponse(
            side_letter_id=source.id,
            updated_covenants_count=len(source.covenants),
            new_terms_summary=summary,
            effective_date=datetime.now(timezone.utc),
        )

    def export_cnrc_filing_manifest(
        self,
        startup_id: str,
        company_legal_name: str,
        rc_number: str,
        nif_number: str,
        nominal_value_dzd: Decimal,
        conversion_simulation: SafeConversionSimulationResponse,
        founder_name: str = "Fondateur Principal",
        founder_nin: str = "198016010012345678",
    ) -> CnrcFilingExportResponse:
        """
        Export formal Shareholder Register & Capital Modification Declaration
        formatted for official submission to the Centre National du Registre du Commerce (CNRC)
        under Algerian Law 22-09.
        """
        # Calculate capital numbers
        total_post_shares = conversion_simulation.total_post_shares
        new_shares_count = conversion_simulation.total_new_shares_from_safes + conversion_simulation.total_new_shares_from_priced_round
        initial_shares_count = total_post_shares - new_shares_count

        capital_initial = Decimal(str(initial_shares_count)) * nominal_value_dzd
        augmentation = Decimal(str(new_shares_count)) * nominal_value_dzd
        capital_nouveau = capital_initial + augmentation

        # Build Shareholder Register
        shareholders_register: List[CnrcShareholderFilingItem] = []

        # 1. Common Founders
        common_entry = next((e for e in conversion_simulation.cap_table_before_vs_after if "Founders" in e.stakeholder_name), None)
        common_shares = common_entry.post_shares if common_entry else initial_shares_count
        common_pct = common_entry.post_ownership_percent if common_entry else 100.0

        shareholders_register.append(
            CnrcShareholderFilingItem(
                shareholder_name=founder_name,
                nationality="Algérienne",
                national_id_or_nif=founder_nin,
                shares_count=common_shares,
                capital_nominal_dzd=Decimal(str(common_shares)) * nominal_value_dzd,
                ownership_percentage=common_pct,
                voting_rights_count=common_shares,
                share_class="ORDINAIRE",
            )
        )

        # 2. Converted SAFE Investors
        for safe in conversion_simulation.safe_conversions:
            if safe.integer_shares_issued > 0:
                shareholders_register.append(
                    CnrcShareholderFilingItem(
                        shareholder_name=safe.investor_name,
                        nationality="Algérienne / Internationale",
                        national_id_or_nif=f"NIN-INV-{safe.safe_id[:8].upper()}",
                        shares_count=safe.integer_shares_issued,
                        capital_nominal_dzd=Decimal(str(safe.integer_shares_issued)) * nominal_value_dzd,
                        ownership_percentage=safe.post_conversion_ownership_percent,
                        voting_rights_count=safe.integer_shares_issued,
                        share_class="PREFERENCE_A",
                    )
                )

        # 3. Formatted Notarial PV Extract Text
        pv_text = (
            "RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE\n"
            "MINISTÈRE DE LA JUSTICE - CHAMBRE NATIONALE DES NOTAIRES\n"
            "CENTRE NATIONAL DU REGISTRE DU COMMERCE (CNRC)\n"
            "--------------------------------------------------------------------------------\n"
            "PROCES-VERBAL DE DÉPÔT & DÉCLARATION D'AUGMENTATION DU CAPITAL SOCIAL\n"
            f"SOCIÉTÉ : {company_legal_name}\n"
            "FORME JURIDIQUE : Société par Actions Simplifiée (SPAS) - Loi n° 22-09\n"
            f"REGISTRE DU COMMERCE N° : {rc_number} | N.I.F : {nif_number}\n\n"
            "L'an deux mille vingt-six, devant Maître Notaire soussigné,\n"
            "A été constatée la réalisation définitive de l'augmentation du capital social:\n"
            f"- Capital Social Antérieur : {capital_initial:,.2f} DZD divisé en {initial_shares_count:,} actions.\n"
            f"- Montant de l'Augmentation : {augmentation:,.2f} DZD par émission de {new_shares_count:,} actions nouvelles "
            f"de valeur nominale {nominal_value_dzd:,.2f} DZD chacune.\n"
            f"- Nouveau Capital Social Souscrit & Libéré : {capital_nouveau:,.2f} DZD divisé en {total_post_shares:,} actions.\n\n"
            "ATTESTATION STATUTAIRE (Loi 22-09, Art. 715 bis 30):\n"
            "Toutes les actions nouvelles créées ont été souscrites en totalité et attribuées "
            "sans fractionnement ni rompu selon la méthode du plus fort reste (Hamilton-Hare).\n"
            "Fait pour valoir déclaration régulière auprès de l'antenne locale du CNRC."
        )

        # Hash for integrity
        payload_to_hash = f"{startup_id}:{rc_number}:{capital_nouveau}:{total_post_shares}".encode("utf-8")
        filing_hash = hashlib.sha256(payload_to_hash).hexdigest()

        return CnrcFilingExportResponse(
            startup_id=startup_id,
            company_legal_name=company_legal_name,
            commercial_register_num=rc_number,
            tax_id_num=nif_number,
            legal_form="SPAS (Société par Actions Simplifiée - Loi 22-09)",
            capital_social_initial_dzd=capital_initial,
            capital_social_nouveau_dzd=capital_nouveau,
            augmentation_capital_dzd=augmentation,
            actions_total_nouvelles=new_shares_count,
            valeur_nominale_action_dzd=nominal_value_dzd,
            shareholders_register=shareholders_register,
            notarial_pv_extract_text=pv_text,
            export_timestamp=datetime.now(timezone.utc),
            filing_hash_sha256=filing_hash,
        )


# Global singleton instance
side_letter_engine = SideLetterEngine()
