"""
TamWheel Sovereign Ethical Agentic Venture OS — Executive Vetting & Officer Disqualification Engine.
Implements:
1. Algerian National Identification Number (NIN - 18 digits) validation & identity coherence.
2. CNRC Official Disqualification Register (Fichier National des Fraudeurs / Interdictions de Gérer):
   - Law 04-08 (Art. 8, 33, 34) & Code de Commerce Art. 800+
   - Disqualifications: Interdiction de gérer, Faillite personnelle, Fraude fiscale/douanière, Chèque sans provision.
3. Commercial Court Insolvency & Judicial Liquidation records:
   - 5-year statutory commercial lookback
   - Personal managerial liability decrees (Comblement de passif - Art. 224 / 790)
4. Corporate Governance & Mandate Conflict Evaluation:
   - SPA 5-mandate limit under Art. 615 & 624 of Algerian Commercial Code
   - SARL statutory non-compete for Gérants under Art. 569 of Commercial Code
   - Undisclosed competitor holdings and self-dealing conflicts
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.executive_vetting import (
    DisqualificationType,
    CNRCRegisterStatus,
    InsolvencyStatus,
    CorporateEntityType,
    ExecutiveVerdict,
    CNRCDisqualificationRecord,
    BankruptcyHistoryRecord,
    DirectorshipMandate,
    GovernanceConflictFlag,
    ExecutiveVettingRequest,
    ExecutiveVettingResponse,
    DisqualificationCheckRequest,
    DisqualificationCheckResponse,
    MandatesCheckRequest,
    MandatesCheckResponse,
)
from app.services.sanctions_screening_engine import AlgerianPhoneticMatcher

logger = logging.getLogger("tamwheel.services.executive_vetting")


# =============================================================================
# REPRESENTATIVE CNRC DISQUALIFICATION REGISTER (FICHIER DES FRAUDEURS)
# =============================================================================

CNRC_DISQUALIFICATION_REGISTRY = [
    {
        "recordId": "CNRC-FRAUD-2023-0891",
        "name": "Tariq Khelil",
        "aliases": ["Tarek Khelil", "Tariq Khalil"],
        "nationalId": "184160100451230012",
        "status": CNRCRegisterStatus.INSCRIT_INTERDIT,
        "disqualificationType": DisqualificationType.INTERDICTION_DE_GERER,
        "court": "Tribunal de Première Instance de Bab El Oued (Section Commerciale)",
        "judgmentDate": "2023-05-12",
        "expiryDate": "2028-05-12",
        "legalBasis": "Code de Commerce Art. 805 & Loi 04-08 Art. 34 (Interdiction judiciaire d'exercer toute fonction de gestion)",
        "notes": "Faillite frauduleuse avec détournement d'actifs et tenue irrégulière de comptabilité.",
    },
    {
        "recordId": "CNRC-FRAUD-2022-0412",
        "name": "Sofiane Bouchareb",
        "aliases": ["Soufiane Bouchareb"],
        "nationalId": "191090100234120098",
        "status": CNRCRegisterStatus.INSCRIT_INTERDIT,
        "disqualificationType": DisqualificationType.FAILLITE_PERSONNELLE,
        "court": "Cour d'Alger (Chambre Commerciale)",
        "judgmentDate": "2022-11-04",
        "expiryDate": "2032-11-04",
        "legalBasis": "Code de Commerce Art. 810 (Faillite personnelle et interdiction commerciale 10 ans)",
        "notes": "Comblement de passif prononcé à titre personnel pour un passif non réglé de 45.000.000 DZD.",
    },
    {
        "recordId": "CNRC-FRAUD-2024-0105",
        "name": "Nabil Benali",
        "aliases": ["Nabil Ben Ali"],
        "nationalId": "178310100789010045",
        "status": CNRCRegisterStatus.INSCRIT_INTERDIT,
        "disqualificationType": DisqualificationType.INFRACTION_FISCALE_MAJEURE,
        "court": "Tribunal Criminel d'Oran",
        "judgmentDate": "2024-01-15",
        "expiryDate": "2029-01-15",
        "legalBasis": "Loi 04-08 Art. 33 & CIDTA Art. 302 (Faux en écritures de commerce et réseau de fausses factures)",
        "notes": "Inscription au Fichier National des Fraudeurs suite à redressement fiscal avec pénalités de mauvaise foi.",
    },
    {
        "recordId": "CNRC-FRAUD-2021-0988",
        "name": "Hichem Mebarki",
        "aliases": ["Hichem Mabarki"],
        "nationalId": "180250100561230077",
        "status": CNRCRegisterStatus.INSCRIT_INTERDIT,
        "disqualificationType": DisqualificationType.CHEQUE_SANS_PROVISION,
        "court": "Tribunal de Constantine",
        "judgmentDate": "2021-09-30",
        "expiryDate": "2026-09-30",
        "legalBasis": "Code Pénal Art. 374 & Instruction Banque d'Algérie sur la Centrale des Impayés",
        "notes": "Émission répétée de chèques sans provision d'un montant supérieur à 10.000.000 DZD.",
    },
    {
        "recordId": "CNRC-FRAUD-2018-0245",
        "name": "Farid Ziane",
        "aliases": ["Farid Ziyane"],
        "nationalId": "175160100891230033",
        "status": CNRCRegisterStatus.REHABILITE,
        "disqualificationType": DisqualificationType.INTERDICTION_DE_GERER,
        "court": "Tribunal de Sidi M'hamed",
        "judgmentDate": "2018-04-10",
        "expiryDate": "2023-04-10",
        "legalBasis": "Code de Commerce Art. 815 (Réhabilitation judiciaire)",
        "notes": "Période d'interdiction de 5 ans échue; certificat de non-faillite délivré après apurement intégral du passif.",
    },
]


# =============================================================================
# REPRESENTATIVE COMMERCIAL COURT LIQUIDATIONS / INSOLVENCIES
# =============================================================================

KNOWN_INSOLVENT_ENTITIES = [
    {
        "officerName": "Tariq Khelil",
        "companyName": "Maghreb Digital Logistics SARL",
        "rc": "16/00-104921B19",
        "role": "Gérant",
        "insolvencyType": InsolvencyStatus.FAILLITE_FRAUDULEUSE,
        "judgmentDate": "2023-03-20",
        "lookbackYears": 1.5,
        "managerLiability": True,
    },
    {
        "officerName": "Sofiane Bouchareb",
        "companyName": "Atlas Agro Food Industries SPA",
        "rc": "09/00-008234A18",
        "role": "Président Directeur Général (PDG)",
        "insolvencyType": InsolvencyStatus.LIQUIDATION_JUDICIAIRE,
        "judgmentDate": "2022-09-15",
        "lookbackYears": 2.1,
        "managerLiability": True,
    },
    {
        "officerName": "Mourad Belkacem",
        "companyName": "Algiers Cloud Solutions EURL",
        "rc": "16/00-009844B20",
        "role": "Gérant Associé Unique",
        "insolvencyType": InsolvencyStatus.CESSATION_DES_PAIEMENTS,
        "judgmentDate": "2024-02-10",
        "lookbackYears": 0.7,
        "managerLiability": False,
    },
]


# =============================================================================
# EXECUTIVE VETTING SERVICE IMPLEMENTATION
# =============================================================================

class ExecutiveVettingService:
    """
    Sovereign officer background check & commercial qualification vetting service.
    """

    def __init__(self):
        self.matcher = AlgerianPhoneticMatcher()

    @staticmethod
    def validate_algerian_nin(nin: Optional[str]) -> Tuple[bool, Optional[str]]:
        """
        Validate Algerian Numéro d'Identification Nationale (NIN).
        Official format: exactly 18 digits.
        - Digit 1: Gender (1 = Male, 2 = Female)
        - Digits 2-3: Year of birth
        - Digits 4-5: Commune of birth
        - Digits 6-7: Wilaya of birth (01 to 58)
        - Digits 8-18: Sequential registration & checksum digits
        """
        if not nin:
            return False, "NIN not provided"

        cleaned = re.sub(r"[\s-]", "", nin.strip())
        if not re.match(r"^\d{18}$", cleaned):
            return False, f"NIN '{nin}' invalid: must be exactly 18 numeric digits"

        # Check gender digit
        gender_digit = int(cleaned[0])
        if gender_digit not in (1, 2):
            return False, f"NIN '{nin}' invalid: first digit must be 1 (Male) or 2 (Female)"

        # Check wilaya digits (index 5:7)
        wilaya_code = int(cleaned[5:7])
        if not (1 <= wilaya_code <= 58):
            return False, f"NIN '{nin}' invalid: wilaya code '{wilaya_code:02d}' outside range 01-58"

        return True, None

    def check_cnrc_disqualification(
        self,
        full_name: str,
        national_id: Optional[str] = None,
    ) -> CNRCDisqualificationRecord:
        """
        Cross-check candidate against the CNRC Official Disqualification Register
        (Fichier National des Fraudeurs / Interdictions de Gérer).
        """
        cleaned_nin = re.sub(r"[\s-]", "", national_id.strip()) if national_id else ""

        for record in CNRC_DISQUALIFICATION_REGISTRY:
            # 1. Exact NIN hit
            if cleaned_nin and record.get("nationalId") == cleaned_nin:
                return CNRCDisqualificationRecord(
                    recordId=record["recordId"],
                    status=record["status"],
                    disqualificationType=record["disqualificationType"],
                    courtName=record["court"],
                    judgmentDate=record["judgmentDate"],
                    expiryDate=record.get("expiryDate"),
                    legalBasis=record["legalBasis"],
                    notes=record.get("notes"),
                )

            # 2. Fuzzy name match
            target_names = [record["name"]] + record.get("aliases", [])
            for tgt in target_names:
                match_res = self.matcher.match_names(full_name, tgt)
                if match_res.compositeScore >= 0.85:
                    return CNRCDisqualificationRecord(
                        recordId=record["recordId"],
                        status=record["status"],
                        disqualificationType=record["disqualificationType"],
                        courtName=record["court"],
                        judgmentDate=record["judgmentDate"],
                        expiryDate=record.get("expiryDate"),
                        legalBasis=record["legalBasis"],
                        notes=record.get("notes"),
                    )

        # Clean record
        return CNRCDisqualificationRecord(
            recordId="CNRC-CLEAN-CERT",
            status=CNRCRegisterStatus.AUCUNE_INSCRIPTION,
            disqualificationType=DisqualificationType.NONE,
            courtName="Direction Générale du Centre National du Registre de Commerce (CNRC)",
            judgmentDate=datetime.utcnow().strftime("%Y-%m-%d"),
            expiryDate=None,
            legalBasis="Loi 04-08 relative aux conditions d'exercice des activités commerciales",
            notes="Aucune mention d'interdiction de gérer ni d'inscription au Fichier National des Fraudeurs.",
        )

    def check_bankruptcy_history(self, full_name: str) -> List[BankruptcyHistoryRecord]:
        """
        Retrieve commercial insolvency and court liquidation records.
        """
        hits: List[BankruptcyHistoryRecord] = []
        for entity in KNOWN_INSOLVENT_ENTITIES:
            match_res = self.matcher.match_names(full_name, entity["officerName"])
            if match_res.compositeScore >= 0.85:
                hits.append(
                    BankruptcyHistoryRecord(
                        companyName=entity["companyName"],
                        commercialRegisterNumber=entity["rc"],
                        roleHeld=entity["role"],
                        insolvencyType=entity["insolvencyType"],
                        judgmentDate=entity["judgmentDate"],
                        lookbackYears=entity["lookbackYears"],
                        managerLiabilityDecreed=entity["managerLiability"],
                        isWithinLookbackWindow=entity["lookbackYears"] <= 5.0,
                    )
                )
        return hits

    def evaluate_mandates_and_conflicts(
        self,
        officer_name: str,
        current_mandates: List[DirectorshipMandate],
        proposed_role: str = "Gérant",
        target_entity_type: CorporateEntityType = CorporateEntityType.SARL,
        target_sector: Optional[str] = None,
    ) -> Tuple[int, int, List[GovernanceConflictFlag]]:
        """
        Evaluate corporate governance conflicts:
        - Algerian Commercial Code Art. 615 & 624: Max 5 mandates in SPAs
        - Algerian Commercial Code Art. 569: SARL Gérant statutory non-compete
        - Undisclosed competitor equity holdings
        """
        active_mandates = [m for m in current_mandates if m.isCurrent]
        total_active = len(active_mandates)

        spa_mandates = [m for m in active_mandates if m.entityType == CorporateEntityType.SPA]
        spa_count = len(spa_mandates)

        conflicts: List[GovernanceConflictFlag] = []

        # 1. Check SPA statutory limit (Article 615 Code de Commerce)
        # In SPAs, max 5 directorship mandates allowed
        prospective_spa = 1 if target_entity_type == CorporateEntityType.SPA else 0
        if spa_count + prospective_spa > 5:
            conflicts.append(
                GovernanceConflictFlag(
                    conflictType="SPA_MANDATE_LIMIT_EXCEEDED",
                    severity="CRITICAL",
                    description=(
                        f"Officer holds {spa_count} active SPA directorship mandates. Adding this role would "
                        f"bring total to {spa_count + prospective_spa}, violating statutory cap of 5 mandates."
                    ),
                    statutoryArticle="Code de Commerce Algérien Article 615 & 624",
                    mitigationRequired="Mandatory formal resignation and CNRC deregistration from at least one existing SPA directorship before appointment.",
                )
            )

        # 2. Check SARL statutory non-compete (Article 569 Code de Commerce)
        # Gérant of SARL cannot operate or manage a competing business without unanimous associate consent
        if target_entity_type == CorporateEntityType.SARL and "gérant" in proposed_role.lower():
            for m in active_mandates:
                is_competing = (
                    m.isDirectCompetitor or
                    (target_sector and m.sector and target_sector.lower() == m.sector.lower())
                )
                if is_competing:
                    conflicts.append(
                        GovernanceConflictFlag(
                            conflictType="SARL_COMPETITOR_GERANT",
                            severity="HIGH",
                            description=(
                                f"Officer is active {m.role} in '{m.companyName}' ({m.sector or 'same sector'}), "
                                f"creating an unlawful competitive clash with the target SARL."
                            ),
                            statutoryArticle="Code de Commerce Algérien Article 569",
                            mitigationRequired=(
                                "Unanimous notarized General Assembly (AGE) resolution of associates expressly authorizing "
                                "the concurrent mandate, or resignation from competing executive post."
                            ),
                        )
                    )

        # 3. Check significant equity holding in direct competitors
        for m in active_mandates:
            if m.isDirectCompetitor and m.sharesOwnedPercentage >= 10.0:
                conflicts.append(
                    GovernanceConflictFlag(
                        conflictType="COMPETITOR_SIGNIFICANT_EQUITY",
                        severity="HIGH",
                        description=(
                            f"Officer owns {m.sharesOwnedPercentage}% equity in direct competitor '{m.companyName}', "
                            f"constituting a severe conflict of interest under corporate fiduciary rules."
                        ),
                        statutoryArticle="Code de Commerce Art. 638 (Conventions réglementées et conflits d'intérêts)",
                        mitigationRequired="Establish blind trust or execute binding divestment / standstill covenant prior to Series A closing.",
                    )
                )

        return total_active, spa_count, conflicts

    def vet_executive(self, request: ExecutiveVettingRequest) -> ExecutiveVettingResponse:
        """
        Execute comprehensive executive vetting audit:
        - NIN verification
        - CNRC Disqualification check
        - Commercial Court bankruptcy lookback
        - Corporate mandate statutory compliance
        - Composite scoring & legal covenants
        """
        vetting_id = str(uuid.uuid4())
        name = request.fullName

        # 1. NIN Check
        nin_valid, nin_err = self.validate_algerian_nin(request.nationalIdNumber)

        # 2. CNRC Disqualification
        cnrc_record = self.check_cnrc_disqualification(name, request.nationalIdNumber)

        # 3. Bankruptcy & Liquidation History
        insolvency_history = self.check_bankruptcy_history(name)

        # 4. Mandates & Conflicts
        total_active, spa_count, conflicts = self.evaluate_mandates_and_conflicts(
            officer_name=name,
            current_mandates=request.knownMandates,
            proposed_role=request.intendedRoleInStartup,
            target_entity_type=request.targetStartupEntityType,
            target_sector=request.targetStartupSector,
        )

        # 5. Composite Risk Score [0, 100]
        risk_score = 0.0
        covenants: List[str] = []

        # NIN penalty
        if request.nationalIdNumber and not nin_valid:
            risk_score += 15.0
            covenants.append(f"Produce valid 18-digit Algerian National ID Card / Passport (Reason: {nin_err}).")

        # CNRC Disqualification penalty
        if cnrc_record.status == CNRCRegisterStatus.INSCRIT_INTERDIT:
            risk_score += 65.0
        elif cnrc_record.status == CNRCRegisterStatus.SUSPENDU_SOUS_RECOURS:
            risk_score += 35.0
            covenants.append("Provide authenticated certificate of stay of execution from the Supreme Court.")
        elif cnrc_record.status == CNRCRegisterStatus.REHABILITE:
            risk_score += 10.0
            covenants.append("Furnish official Notarized Rehabilitation Decree (Extrait de Réhabilitation Judiciaire).")

        # Bankruptcy history penalties
        for b in insolvency_history:
            if b.isWithinLookbackWindow:
                if b.managerLiabilityDecreed or b.insolvencyType == InsolvencyStatus.FAILLITE_FRAUDULEUSE:
                    risk_score += 45.0
                elif b.insolvencyType == InsolvencyStatus.LIQUIDATION_JUDICIAIRE:
                    risk_score += 25.0
                else:
                    risk_score += 10.0
                covenants.append(
                    f"Deliver commercial court discharge certificate (Certificat de Clôture des Opérations) for '{b.companyName}'."
                )

        # Governance conflicts penalties
        for c in conflicts:
            if c.severity == "CRITICAL":
                risk_score += 30.0
            elif c.severity == "HIGH":
                risk_score += 20.0
            else:
                risk_score += 10.0
            covenants.append(f"{c.conflictType}: {c.mitigationRequired}")

        risk_score = min(100.0, round(risk_score, 2))

        # Overall Verdict
        if cnrc_record.status == CNRCRegisterStatus.INSCRIT_INTERDIT or risk_score >= 70.0:
            verdict = ExecutiveVerdict.DISQUALIFIED
        elif risk_score >= 25.0 or conflicts or insolvency_history:
            verdict = ExecutiveVerdict.FLAGGED_CONDITIONAL
        else:
            verdict = ExecutiveVerdict.APPROVED

        return ExecutiveVettingResponse(
            vettingId=vetting_id,
            officerName=name,
            ninValidated=nin_valid,
            overallVerdict=verdict,
            executiveRiskScore=risk_score,
            cnrcDisqualificationRecord=cnrc_record,
            bankruptcyHistory=insolvency_history,
            activeMandatesCount=total_active,
            spaMandatesCount=spa_count,
            governanceConflicts=conflicts,
            covenantsAndMitigations=covenants,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    def check_disqualification_only(self, request: DisqualificationCheckRequest) -> DisqualificationCheckResponse:
        """Rapid lookup in CNRC disqualification register."""
        record = self.check_cnrc_disqualification(request.fullName, request.nationalId)
        is_disqualified = record.status == CNRCRegisterStatus.INSCRIT_INTERDIT
        return DisqualificationCheckResponse(
            candidateName=request.fullName,
            isDisqualified=is_disqualified,
            record=record,
        )

    def check_mandates_only(self, request: MandatesCheckRequest) -> MandatesCheckResponse:
        """Rapid lookup of corporate mandate limits & non-compete overlaps."""
        total, spa_count, conflicts = self.evaluate_mandates_and_conflicts(
            officer_name=request.officerName,
            current_mandates=request.currentMandates,
            proposed_role=request.proposedNewRole,
            target_entity_type=request.targetEntityType,
            target_sector=request.targetSector,
        )
        is_spa_exceeded = any(c.conflictType == "SPA_MANDATE_LIMIT_EXCEEDED" for c in conflicts)
        has_sarl_conflict = any(c.conflictType == "SARL_COMPETITOR_GERANT" for c in conflicts)

        status_str = "COMPLIANT"
        if is_spa_exceeded or has_sarl_conflict:
            status_str = "CONFLICT_DETECTED"

        return MandatesCheckResponse(
            officerName=request.officerName,
            spaMandatesCount=spa_count,
            isSpaLimitExceeded=is_spa_exceeded,
            hasSarlConflictOfInterest=has_sarl_conflict,
            governanceConflicts=conflicts,
            status=status_str,
        )


executive_vetting_service = ExecutiveVettingService()
