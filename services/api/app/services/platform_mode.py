"""
TamWheel Platform Mode Configuration Engine.
Manages the checklist-guarded transition from SIMULATION mode (Year 1 educational sandbox)
to LIVE regulated equity crowdfunding mode under COSOB Regulation 23-01 and Law 22-09.
"""

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PlatformMode(str, Enum):
    SIMULATION = "SIMULATION"
    LIVE = "LIVE"


class ChecklistItemKey(str, Enum):
    COSOB_CIP_LICENSE = "COSOB_CIP_LICENSE"
    SEGREGATED_ESCROW_CONTRACT = "SEGREGATED_ESCROW_CONTRACT"
    CHARGILY_PAY_PROD_KEYS = "CHARGILY_PAY_PROD_KEYS"
    NOMINEE_SPAS_CONSTITUTION = "NOMINEE_SPAS_CONSTITUTION"
    SHARIA_BOARD_FATWA = "SHARIA_BOARD_FATWA"
    BANK_OF_ALGERIA_NOTIFICATION = "BANK_OF_ALGERIA_NOTIFICATION"


class ChecklistItem(BaseModel):
    key: ChecklistItemKey
    title_en: str
    title_ar: str
    regulatory_reference: str
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    document_proof_hash: Optional[str] = None
    notes: Optional[str] = None


class PlatformModeState(BaseModel):
    current_mode: PlatformMode = PlatformMode.SIMULATION
    all_requirements_met: bool = False
    total_requirements: int = 6
    verified_count: int = 0
    checklist: List[ChecklistItem]
    last_transition_at: Optional[str] = None
    transitioned_by: Optional[str] = None
    audit_hash: str


class VerifyChecklistRequest(BaseModel):
    key: ChecklistItemKey
    verified_by: str
    document_proof_hash: str
    notes: Optional[str] = None


class ToggleModeRequest(BaseModel):
    target_mode: PlatformMode
    admin_id: str
    admin_otp: str
    justification: str


class PlatformModeEngine:
    """Master configuration panel engine guarding the PLATFORM_MODE toggle."""

    def __init__(self):
        self._mode: PlatformMode = PlatformMode.SIMULATION
        self._last_transition_at: Optional[str] = None
        self._transitioned_by: Optional[str] = None
        self._checklist: Dict[ChecklistItemKey, ChecklistItem] = {
            ChecklistItemKey.COSOB_CIP_LICENSE: ChecklistItem(
                key=ChecklistItemKey.COSOB_CIP_LICENSE,
                title_en="COSOB CIP Accreditation",
                title_ar="اعتماد لجنة تنظيم ومراقبة عمليات البورصة (CIP)",
                regulatory_reference="COSOB Regulation 23-01 / CNRC Code 612.212",
                is_verified=False,
            ),
            ChecklistItemKey.SEGREGATED_ESCROW_CONTRACT: ChecklistItem(
                key=ChecklistItemKey.SEGREGATED_ESCROW_CONTRACT,
                title_en="Segregated Escrow Bank Contract",
                title_ar="اتفاقية حساب الضمان البنكي المنفصل (Compte de Cantonnement)",
                regulatory_reference="Convention CPA/BNA/Algérie Poste - Zéro détention de fonds",
                is_verified=False,
            ),
            ChecklistItemKey.CHARGILY_PAY_PROD_KEYS: ChecklistItem(
                key=ChecklistItemKey.CHARGILY_PAY_PROD_KEYS,
                title_en="Chargily Pay V2 Production Gateway",
                title_ar="بوابة الدفع الإلكتروني شارجيلي V2 (EDAHABIA / CIB)",
                regulatory_reference="Chargily Pay API v2 Production Contract & Webhook Signatures",
                is_verified=False,
            ),
            ChecklistItemKey.NOMINEE_SPAS_CONSTITUTION: ChecklistItem(
                key=ChecklistItemKey.NOMINEE_SPAS_CONSTITUTION,
                title_en="Nominee SPAS Legal Vehicle Constitution",
                title_ar="تأسيس شركة المساهمة البسيطة الحاملة للحصص (SPAS Nominee)",
                regulatory_reference="Algerian Commercial Code Law 22-09 & Civil Code Art. 571",
                is_verified=False,
            ),
            ChecklistItemKey.SHARIA_BOARD_FATWA: ChecklistItem(
                key=ChecklistItemKey.SHARIA_BOARD_FATWA,
                title_en="Sharia Supervisory Board Fatwa Sign-off",
                title_ar="اعتماد الهيئة الشرعية الرقابية للمنصة",
                regulatory_reference="AAOIFI Governance Standard No. 1 & 2 / Fatwa N° 2026-DZ-01",
                is_verified=False,
            ),
            ChecklistItemKey.BANK_OF_ALGERIA_NOTIFICATION: ChecklistItem(
                key=ChecklistItemKey.BANK_OF_ALGERIA_NOTIFICATION,
                title_en="Bank of Algeria Fintech Regulatory Filing",
                title_ar="إخطار بنك الجزائر بأنشطة التكنولوجيا المالية غير الإيداعية",
                regulatory_reference="Monetary & Banking Law 23-09 & Instruction 25-02 Sandbox Exemption",
                is_verified=False,
            ),
        }

    def get_state(self) -> PlatformModeState:
        """Returns the full state of the platform mode and checklist."""
        items = list(self._checklist.values())
        verified = [item for item in items if item.is_verified]
        all_met = len(verified) == len(items)

        state_data = f"{self._mode.value}:{len(verified)}:{all_met}"
        audit_hash = hashlib.sha256(state_data.encode()).hexdigest()

        return PlatformModeState(
            current_mode=self._mode,
            all_requirements_met=all_met,
            total_requirements=len(items),
            verified_count=len(verified),
            checklist=items,
            last_transition_at=self._last_transition_at,
            transitioned_by=self._transitioned_by,
            audit_hash=audit_hash,
        )

    def verify_checklist_item(self, req: VerifyChecklistRequest) -> ChecklistItem:
        """Verifies a single regulatory requirement with documentary proof."""
        if req.key not in self._checklist:
            raise ValueError(f"Unknown checklist item: {req.key}")

        now = datetime.now(timezone.utc).isoformat()
        item = self._checklist[req.key]
        item.is_verified = True
        item.verified_by = req.verified_by
        item.verified_at = now
        item.document_proof_hash = req.document_proof_hash
        item.notes = req.notes
        return item

    def toggle_mode(self, req: ToggleModeRequest) -> PlatformModeState:
        """
        Toggles the platform mode. Switching to LIVE is strictly prohibited
        unless all 6 statutory compliance prerequisites have been verified.
        """
        if req.target_mode == PlatformMode.LIVE:
            state = self.get_state()
            if not state.all_requirements_met:
                unmet = [item.title_en for item in state.checklist if not item.is_verified]
                raise PermissionError(
                    f"FATAL REGULATORY LOCK: Cannot activate LIVE mode. Unmet compliance requirements: {', '.join(unmet)}"
                )

        now = datetime.now(timezone.utc).isoformat()
        self._mode = req.target_mode
        self._last_transition_at = now
        self._transitioned_by = req.admin_id
        return self.get_state()

    def reset_for_testing(self):
        """Resets engine state for testing."""
        self._mode = PlatformMode.SIMULATION
        self._last_transition_at = None
        self._transitioned_by = None
        for item in self._checklist.values():
            item.is_verified = False
            item.verified_by = None
            item.verified_at = None
            item.document_proof_hash = None
            item.notes = None


platform_mode_engine = PlatformModeEngine()
