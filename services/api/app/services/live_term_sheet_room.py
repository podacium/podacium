"""
TamWheel Sovereign Ethical Agentic Venture OS — Live Deal Term Sheet Collaborative Room.
Phase 4 Expansion: Prime-Time Shark Tank Collaborative Deal Negotiation & Mutual Locking.

Features:
- Real-time adjustment of valuation, ticket size, governance board seats, liquidation preference,
  and Sharia compliance covenants.
- Interactive mutual electronic initials: both founder and lead shark must click/tap to lock
  each term sheet clause.
- Automatic reset of clause initials upon modification of underlying financial or governance terms.
- Mutual locking gate: all mandatory clauses must be locked before triggering the Sovereign
  Haptic Khatm ceremony (3-second ethical reflection slider + 80ms tactile pulse + 72h cooling-off).
"""

from __future__ import annotations

import copy
import hashlib
import logging
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from app.services.haptic_khatm import (
    haptic_khatm_service,
    MANDATORY_REFLECTION_SECONDS,
    HAPTIC_PROFILE,
)

logger = logging.getLogger(__name__)


class TermSheetStatus(str, Enum):
    DRAFTING = "DRAFTING"
    NEGOTIATING = "NEGOTIATING"
    MUTUALLY_LOCKED = "MUTUALLY_LOCKED"
    KHATM_SEALED = "KHATM_SEALED"
    ABANDONED = "ABANDONED"


class PartyRole(str, Enum):
    FOUNDER = "FOUNDER"
    INVESTOR = "INVESTOR"


# Default Sharia compliance covenants for TamWheel term sheets
DEFAULT_SHARIA_COVENANTS: List[str] = [
    "Strict prohibition of interest-bearing (Riba) debt, bonds, or credit facilities.",
    "Mandatory annual Sharia audit by the TamWheel Sharia Supervisory Board (SSB).",
    "Tathir (تطهير) income purification mechanism for any accidental non-halal proceeds routed to Waqf.",
    "Prohibition of speculative derivatives, options, forwards, or excessive gharar contracts.",
    "Corporate governance and capital structure aligned with Algerian Commercial Code Law 22-09 for SPAS vehicles.",
]


class TermSheetClause:
    """Represents an individual negotiable clause requiring mutual electronic initials."""

    def __init__(
        self,
        clause_id: str,
        title: str,
        category: str,
        content: Any,
        is_mandatory: bool = True,
        version: int = 1,
    ):
        self.clause_id = clause_id
        self.title = title
        self.category = category
        self.content = content
        self.is_mandatory = is_mandatory
        self.version = version

        # Electronic Initials
        self.founder_initials: Optional[str] = None
        self.founder_user_id: Optional[int] = None
        self.founder_initialed_at: Optional[float] = None

        self.investor_initials: Optional[str] = None
        self.investor_user_id: Optional[int] = None
        self.investor_initialed_at: Optional[float] = None

        self.is_locked: bool = False

    def update_content(self, new_content: Any) -> None:
        """Modifies clause content and automatically resets initials and lock."""
        self.content = new_content
        self.version += 1
        self.founder_initials = None
        self.founder_user_id = None
        self.founder_initialed_at = None
        self.investor_initials = None
        self.investor_user_id = None
        self.investor_initialed_at = None
        self.is_locked = False

    def apply_initial(
        self,
        party: PartyRole | str,
        user_id: int,
        initials: str,
        timestamp: Optional[float] = None,
    ) -> bool:
        """Applies electronic initial from founder or investor. Returns True if clause becomes locked."""
        now = timestamp or time.time()
        initial_str = initials.strip().upper()[:4]
        if not initial_str:
            raise ValueError("Initials cannot be empty")

        party_norm = PartyRole(party.upper()) if isinstance(party, str) else party
        if party_norm == PartyRole.FOUNDER:
            self.founder_initials = initial_str
            self.founder_user_id = user_id
            self.founder_initialed_at = now
        elif party_norm == PartyRole.INVESTOR:
            self.investor_initials = initial_str
            self.investor_user_id = user_id
            self.investor_initialed_at = now

        # A clause is locked only when BOTH parties have initialed this version
        if self.founder_initials and self.investor_initials:
            self.is_locked = True
        else:
            self.is_locked = False

        return self.is_locked

    def to_dict(self) -> Dict[str, Any]:
        return {
            "clause_id": self.clause_id,
            "title": self.title,
            "category": self.category,
            "content": self.content,
            "is_mandatory": self.is_mandatory,
            "version": self.version,
            "founder_initials": self.founder_initials,
            "founder_user_id": self.founder_user_id,
            "founder_initialed_at": self.founder_initialed_at,
            "investor_initials": self.investor_initials,
            "investor_user_id": self.investor_user_id,
            "investor_initialed_at": self.investor_initialed_at,
            "is_locked": self.is_locked,
        }


class LiveTermSheetSession:
    """
    Stateful collaborative room session managing a live pitch term sheet negotiation.
    """

    def __init__(
        self,
        room_id: str,
        startup_id: str,
        startup_name: str,
        founder_id: int,
        founder_name: str,
        investor_id: Optional[int] = None,
        investor_name: Optional[str] = None,
        initial_valuation_dzd: int = 50_000_000,
        initial_ticket_dzd: int = 10_000_000,
    ):
        self.room_id = room_id
        self.deal_id = f"deal-{uuid.uuid4().hex[:8]}"
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.founder_id = founder_id
        self.founder_name = founder_name
        self.investor_id = investor_id or 999
        self.investor_name = investor_name or "Lead Shark"

        self.status = TermSheetStatus.NEGOTIATING
        self.created_at = time.time()
        self.last_updated_at = time.time()

        # Core Financials & Governance Parameters
        self.valuation_pre_money_dzd = int(initial_valuation_dzd)
        self.ticket_size_dzd = int(initial_ticket_dzd)
        self.equity_share_pct = self._calculate_equity(self.valuation_pre_money_dzd, self.ticket_size_dzd)
        self.board_seats = {
            "founder_seats": 2,
            "investor_seats": 1,
            "independent_seats": 1,
        }
        self.liquidation_preference = "1.0x Non-Participating (Sharia-Compliant Common Parity)"
        self.sharia_covenants = copy.deepcopy(DEFAULT_SHARIA_COVENANTS)

        # Clauses catalog
        self.clauses: Dict[str, TermSheetClause] = {}
        self._initialize_default_clauses()

        # Audit History
        self.audit_log: List[Dict[str, Any]] = [
            {
                "action": "ROOM_CREATED",
                "actor_id": founder_id,
                "actor_name": founder_name,
                "timestamp": self.created_at,
                "details": f"Term Sheet opened for {startup_name} ({self.deal_id})",
            }
        ]

        # Khatm Ceremony Result
        self.khatm_record: Optional[Dict[str, Any]] = None

    @property
    def is_mutually_locked(self) -> bool:
        return self.status in (TermSheetStatus.MUTUALLY_LOCKED, TermSheetStatus.KHATM_SEALED)

    @staticmethod
    def _calculate_equity(pre_money: int, ticket: int) -> float:
        total = pre_money + ticket
        if total <= 0:
            return 0.0
        return round((ticket / total) * 100, 2)

    def _initialize_default_clauses(self) -> None:
        """Instantiates default mandatory term sheet clauses."""
        self.clauses["valuation_equity"] = TermSheetClause(
            clause_id="valuation_equity",
            title="Valuation & Equity Ownership",
            category="FINANCIALS",
            content={
                "valuation_pre_money_dzd": self.valuation_pre_money_dzd,
                "ticket_size_dzd": self.ticket_size_dzd,
                "equity_share_pct": self.equity_share_pct,
                "post_money_valuation_dzd": self.valuation_pre_money_dzd + self.ticket_size_dzd,
            },
        )
        self.clauses["board_governance"] = TermSheetClause(
            clause_id="board_governance",
            title="Governance & Board of Directors",
            category="GOVERNANCE",
            content=copy.deepcopy(self.board_seats),
        )
        self.clauses["liquidation_preference"] = TermSheetClause(
            clause_id="liquidation_preference",
            title="Liquidation Preference & Exit Waterfall",
            category="LIQUIDATION",
            content={"type": self.liquidation_preference, "sharia_pro_rata": True},
        )
        self.clauses["sharia_covenants"] = TermSheetClause(
            clause_id="sharia_covenants",
            title="Sovereign Sharia Compliance & Ethical Covenants",
            category="SHARIA_COMPLIANCE",
            content=copy.deepcopy(self.sharia_covenants),
        )
        self.clauses["protective_provisions"] = TermSheetClause(
            clause_id="protective_provisions",
            title="Information Rights & Protective Vetoes",
            category="PROTECTIVE_PROVISIONS",
            content={
                "quarterly_audited_financials": True,
                "founder_reverse_vesting_years": 4,
                "one_year_cliff": True,
                "tag_along_threshold_pct": 50.0,
            },
        )

    def update_terms(
        self,
        actor_id: int,
        actor_name: str,
        actor_role: PartyRole | str,
        valuation_pre_money_dzd: Optional[int] = None,
        ticket_size_dzd: Optional[int] = None,
        board_seats: Optional[Dict[str, int]] = None,
        liquidation_preference: Optional[str] = None,
        sharia_covenants: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Updates live negotiable parameters.
        Whenever a term changes, affected clauses are reset and status returns to NEGOTIATING.
        """
        now = time.time()
        changed_fields: List[str] = []

        if valuation_pre_money_dzd is not None and valuation_pre_money_dzd != self.valuation_pre_money_dzd:
            if valuation_pre_money_dzd < 1_000_000:
                raise ValueError("Pre-money valuation must be at least 1,000,000 DZD")
            self.valuation_pre_money_dzd = int(valuation_pre_money_dzd)
            changed_fields.append("valuation_pre_money_dzd")

        if ticket_size_dzd is not None and ticket_size_dzd != self.ticket_size_dzd:
            if ticket_size_dzd < 500_000:
                raise ValueError("Ticket size must be at least 500,000 DZD")
            self.ticket_size_dzd = int(ticket_size_dzd)
            changed_fields.append("ticket_size_dzd")

        if "valuation_pre_money_dzd" in changed_fields or "ticket_size_dzd" in changed_fields:
            self.equity_share_pct = self._calculate_equity(self.valuation_pre_money_dzd, self.ticket_size_dzd)
            self.clauses["valuation_equity"].update_content({
                "valuation_pre_money_dzd": self.valuation_pre_money_dzd,
                "ticket_size_dzd": self.ticket_size_dzd,
                "equity_share_pct": self.equity_share_pct,
                "post_money_valuation_dzd": self.valuation_pre_money_dzd + self.ticket_size_dzd,
            })

        if board_seats is not None and board_seats != self.board_seats:
            self.board_seats = copy.deepcopy(board_seats)
            changed_fields.append("board_seats")
            self.clauses["board_governance"].update_content(copy.deepcopy(self.board_seats))

        if liquidation_preference is not None and liquidation_preference != self.liquidation_preference:
            self.liquidation_preference = liquidation_preference.strip()
            changed_fields.append("liquidation_preference")
            self.clauses["liquidation_preference"].update_content({
                "type": self.liquidation_preference,
                "sharia_pro_rata": True,
            })

        if sharia_covenants is not None and sharia_covenants != self.sharia_covenants:
            self.sharia_covenants = copy.deepcopy(sharia_covenants)
            changed_fields.append("sharia_covenants")
            self.clauses["sharia_covenants"].update_content(copy.deepcopy(self.sharia_covenants))

        if changed_fields:
            self.status = TermSheetStatus.NEGOTIATING
            self.last_updated_at = now
            self.audit_log.append({
                "action": "TERMS_UPDATED",
                "actor_id": actor_id,
                "actor_name": actor_name,
                "actor_role": str(actor_role),
                "timestamp": now,
                "changed_fields": changed_fields,
            })
            logger.info(
                f"Term sheet {self.deal_id} in room {self.room_id} updated by {actor_name} ({actor_role}): "
                f"{', '.join(changed_fields)}"
            )

        return self.get_state()

    def initial_clause(
        self,
        clause_id: str,
        user_id: int,
        username: str,
        party: PartyRole | str,
        initials: str,
    ) -> Dict[str, Any]:
        """
        Applies a party's electronic initial to a specific clause.
        If all mandatory clauses are locked, transitions room to MUTUALLY_LOCKED.
        """
        clause = self.clauses.get(clause_id)
        if not clause:
            raise KeyError(f"Clause '{clause_id}' does not exist in term sheet")

        now = time.time()
        clause_locked = clause.apply_initial(party=party, user_id=user_id, initials=initials, timestamp=now)

        # Audit
        self.audit_log.append({
            "action": "CLAUSE_INITIALED",
            "clause_id": clause_id,
            "actor_id": user_id,
            "actor_name": username,
            "actor_party": str(party),
            "initials": initials,
            "clause_is_locked": clause_locked,
            "timestamp": now,
        })

        # Check if all mandatory clauses are now locked
        self._check_and_update_mutual_lock_state()
        self.last_updated_at = now

        return {
            "type": "termsheet:clause_initialed",
            "room_id": self.room_id,
            "deal_id": self.deal_id,
            "clause": clause.to_dict(),
            "room_status": self.status.value,
            "all_clauses_locked": self.status == TermSheetStatus.MUTUALLY_LOCKED,
            "timestamp": now,
        }

    def initial_all_clauses(
        self,
        user_id: int,
        username: str,
        party: PartyRole | str,
        initials: str,
    ) -> Dict[str, Any]:
        """Applies electronic initials across all clauses for the designated party."""
        now = time.time()
        for clause in self.clauses.values():
            clause.apply_initial(party=party, user_id=user_id, initials=initials, timestamp=now)

        self.audit_log.append({
            "action": "ALL_CLAUSES_INITIALED",
            "actor_id": user_id,
            "actor_name": username,
            "actor_party": str(party),
            "initials": initials,
            "timestamp": now,
        })

        self._check_and_update_mutual_lock_state()
        self.last_updated_at = now

        return self.get_state()

    def _check_and_update_mutual_lock_state(self) -> bool:
        """Evaluates whether all mandatory clauses have both founder and investor initials."""
        all_locked = all(c.is_locked for c in self.clauses.values() if c.is_mandatory)
        if all_locked and self.status != TermSheetStatus.KHATM_SEALED:
            self.status = TermSheetStatus.MUTUALLY_LOCKED
            logger.info(f"Term sheet {self.deal_id} in room {self.room_id} is MUTUALLY_LOCKED!")
            return True
        elif not all_locked and self.status == TermSheetStatus.MUTUALLY_LOCKED:
            self.status = TermSheetStatus.NEGOTIATING
            return False
        return self.status == TermSheetStatus.MUTUALLY_LOCKED

    def trigger_khatm_ceremony(
        self,
        user_id: int,
        reflection_hold_duration_sec: float,
    ) -> Dict[str, Any]:
        """
        Executes the Sovereign Haptic Khatm ceremony to formally seal the mutually initialed term sheet.
        Requires:
        1. Term sheet must be MUTUALLY_LOCKED.
        2. Physical slider held for >= 3.0 seconds (ethical reflection requirement).
        """
        if self.status != TermSheetStatus.MUTUALLY_LOCKED:
            raise ValueError(
                f"Cannot seal Khatm ceremony: Term sheet is currently in state '{self.status.value}'. "
                "Both founder and lead shark must electronically initial all clauses first."
            )

        if reflection_hold_duration_sec < MANDATORY_REFLECTION_SECONDS:
            raise ValueError(
                f"Ethical reflection requirement not met: held for {reflection_hold_duration_sec:.2f}s, "
                f"minimum required is {MANDATORY_REFLECTION_SECONDS}s."
            )

        now = time.time()
        khatm_res = haptic_khatm_service.seal_pledge(
            user_id=user_id,
            startup_id=self.startup_id,
            amount_dzd=self.ticket_size_dzd,
            reflection_hold_duration_sec=reflection_hold_duration_sec,
            equity_share_pct=self.equity_share_pct,
            now=now,
        )

        self.khatm_record = khatm_res
        self.status = TermSheetStatus.KHATM_SEALED
        self.last_updated_at = now

        self.audit_log.append({
            "action": "KHATM_CEREMONY_SEALED",
            "actor_id": user_id,
            "khatm_id": khatm_res.get("khatmId"),
            "khatm_seal_hash": khatm_res.get("khatmSealHash"),
            "ticket_size_dzd": self.ticket_size_dzd,
            "equity_share_pct": self.equity_share_pct,
            "timestamp": now,
        })

        logger.info(
            f"Sovereign Haptic Khatm SEALED for deal {self.deal_id} in room {self.room_id}! "
            f"KhatmID: {khatm_res.get('khatmId')}"
        )

        return {
            "type": "termsheet:khatm_sealed",
            "room_id": self.room_id,
            "deal_id": self.deal_id,
            "status": self.status.value,
            "khatm_record": self.khatm_record,
            "haptic_profile": HAPTIC_PROFILE,
            "cooling_off_hours": 72,
            "timestamp": now,
        }

    def get_state(self) -> Dict[str, Any]:
        """Provides full real-time state of the collaborative term sheet room."""
        return {
            "type": "termsheet:state_sync",
            "room_id": self.room_id,
            "deal_id": self.deal_id,
            "startup_id": self.startup_id,
            "startup_name": self.startup_name,
            "founder_id": self.founder_id,
            "founder_name": self.founder_name,
            "investor_id": self.investor_id,
            "investor_name": self.investor_name,
            "status": self.status.value,
            "valuation_pre_money_dzd": self.valuation_pre_money_dzd,
            "ticket_size_dzd": self.ticket_size_dzd,
            "post_money_valuation_dzd": self.valuation_pre_money_dzd + self.ticket_size_dzd,
            "equity_share_pct": self.equity_share_pct,
            "board_seats": self.board_seats,
            "liquidation_preference": self.liquidation_preference,
            "sharia_covenants": self.sharia_covenants,
            "clauses": {cid: c.to_dict() for cid, c in self.clauses.items()},
            "is_mutually_locked": self.status in (TermSheetStatus.MUTUALLY_LOCKED, TermSheetStatus.KHATM_SEALED),
            "khatm_record": self.khatm_record,
            "created_at": self.created_at,
            "last_updated_at": self.last_updated_at,
        }

    def get_audit_log(self) -> List[Dict[str, Any]]:
        return list(self.audit_log)


class LiveTermSheetEngine:
    """Singleton service managing live collaborative term sheet negotiation rooms."""

    def __init__(self):
        self._rooms: Dict[str, LiveTermSheetSession] = {}

    def get_or_create_room(
        self,
        room_id: str,
        startup_id: Optional[str] = None,
        startup_name: Optional[str] = None,
        founder_id: Optional[int] = None,
        founder_name: Optional[str] = None,
        investor_id: Optional[int] = None,
        investor_name: Optional[str] = None,
        initial_valuation_dzd: int = 50_000_000,
        initial_ticket_dzd: int = 10_000_000,
    ) -> LiveTermSheetSession:
        if room_id not in self._rooms:
            self._rooms[room_id] = LiveTermSheetSession(
                room_id=room_id,
                startup_id=startup_id or f"startup-{room_id[:8]}",
                startup_name=startup_name or "TamWheel Venture",
                founder_id=founder_id or 1,
                founder_name=founder_name or "Founder",
                investor_id=investor_id or 999,
                investor_name=investor_name or "Lead Shark",
                initial_valuation_dzd=initial_valuation_dzd,
                initial_ticket_dzd=initial_ticket_dzd,
            )
        return self._rooms[room_id]

    def get_room(self, room_id: str) -> Optional[LiveTermSheetSession]:
        return self._rooms.get(room_id)

    def remove_room(self, room_id: str) -> None:
        self._rooms.pop(room_id, None)


# Global singleton instance
live_term_sheet_engine = LiveTermSheetEngine()
