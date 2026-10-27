"""
services/api/app/agent/security/pii_cleaner.py
Algerian ANPDP Law 18-07 & Law 25-11 Dual-Boundary Redaction and Checksum Validation Engine.
Implements ISO 7064 Modulo 97 for BaridiMob/Postal RIP, Luhn Modulo 10 for EDAHABIA/CIB cards,
and transient vault tokenization.
"""

from __future__ import annotations
import re
import json
import logging
import uuid
from typing import Dict, Any, Tuple
from app.core.redis import get_redis

logger = logging.getLogger("podacium.agent.security.pii")


def validate_luhn(card_number: str) -> bool:
    """Validates card PAN using Luhn Modulo-10 algorithm."""
    digits = [int(c) for c in re.sub(r"\D", "", card_number)]
    if len(digits) != 16:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


def validate_dz_rip(rip_str: str) -> bool:
    """
    Validates 20-digit Algerian Postal RIP using ISO 7064 Modulo 97.
    Format: 007 (3 Bank) + 99999 (5 Guichet) + Account (10) + Key (2)
    Formula: Cle = 97 - ((Bank*10^17 + Guichet*10^12 + Account*10^2) % 97)
    """
    clean_rip = re.sub(r"\D", "", rip_str)
    if len(clean_rip) != 20:
        return False

    bank = clean_rip[:3]
    guichet = clean_rip[3:8]
    account = clean_rip[8:18]
    try:
        key = int(clean_rip[18:20])
    except ValueError:
        return False

    num_str = f"{bank}{guichet}{account}00"
    try:
        remainder = int(num_str) % 97
        expected_key = 97 - remainder
        if expected_key == 0:
            expected_key = 97
        return key == expected_key
    except ValueError:
        return False


def validate_ccp_key(account_str: str, key_str: str) -> bool:
    """Validates standalone Algerian CCP account with 2-digit key."""
    try:
        account = int(re.sub(r"\D", "", account_str))
        key = int(re.sub(r"\D", "", key_str))
        remainder = (account * 100) % 97
        expected_key = 97 - remainder
        if expected_key == 0:
            expected_key = 97
        return key == expected_key
    except ValueError:
        return False


class AlgerianComplianceEngine:
    """
    ANPDP Law 18-07 & Law 25-11 Dual-Boundary Redaction and Checksum Validation Engine.
    """

    RE_EDAHABIA = re.compile(r"\b(6035[\s-]?78\d{2}[\s-]?\d{4}[\s-]?\d{4})\b")
    RE_CIB = re.compile(r"\b(6280[\s-]?38\d{2}[\s-]?\d{4}[\s-]?\d{4})\b")
    RE_RIP_BARIDIMOB = re.compile(r"\b(007\s*99999\s*\d{10}\s*\d{2})\b")
    RE_NIF = re.compile(r"\b(\d{15})\b")
    RE_NIS = re.compile(r"\b(\d{20})\b")
    RE_RC = re.compile(r"\b(\d{2}/\d{2}-\d{7}[A-Z]\d{2})\b")
    RE_DZ_PHONE = re.compile(r"(?:\+213|00213|0)(?:5|6|7)\d{8}\b")

    @classmethod
    def validate_postal_rip(cls, rip_str: str) -> bool:
        return validate_dz_rip(rip_str)

    @classmethod
    def validate_edahabia_card(cls, card_str: str) -> bool:
        return validate_luhn(card_str)

    def redact_text(self, text: str) -> Tuple[str, Dict[str, str]]:
        """Synchronous redaction helper mapping tokens locally for tests."""
        mapping: Dict[str, str] = {}
        out = text
        # NIF
        for m in self.RE_NIF.finditer(text):
            val = m.group(1)
            token = f"<PII:NIF:{uuid.uuid4().hex[:6]}>"
            mapping[token] = val
            out = out.replace(val, token)
        # EDAHABIA
        for m in self.RE_EDAHABIA.finditer(text):
            val = m.group(1)
            token = f"<PII:EDAHABIA:{uuid.uuid4().hex[:6]}>"
            mapping[token] = val
            out = out.replace(val, token)
        return out, mapping

    def detokenize_text(self, text: str, mapping: Dict[str, str]) -> str:
        """Synchronous restoration helper."""
        out = text
        for token, val in mapping.items():
            out = out.replace(token, val)
        return out

    @classmethod
    async def pre_llm_redact(cls, text: str, session_id: str) -> Tuple[str, int]:
        """
        Boundary 1: Pre-LLM Redaction & Reversible Tokenization.
        Extracts validated identifiers, stores them in an ephemeral Redis vault (TTL=1800s),
        and returns the sanitized string with opaque tokens.
        """
        if not text:
            return text, 0

        vault: Dict[str, str] = {}
        redactions_count = 0

        # 1. EDAHABIA Card PAN
        def _mask_edahabia(match: re.Match[str]) -> str:
            nonlocal redactions_count
            raw = re.sub(r"\D", "", match.group(1))
            if validate_luhn(raw):
                redactions_count += 1
                token = f"[EDAHABIA_CARD_{uuid.uuid4().hex[:8]}]"
                vault[token] = raw
                return token
            return match.group(0)

        text = cls.RE_EDAHABIA.sub(_mask_edahabia, text)

        # 2. CIB SATIM Card PAN
        def _mask_cib(match: re.Match[str]) -> str:
            nonlocal redactions_count
            raw = re.sub(r"\D", "", match.group(1))
            if validate_luhn(raw):
                redactions_count += 1
                token = f"[EDAHABIA_CARD_{uuid.uuid4().hex[:8]}]"
                vault[token] = raw
                return token
            return match.group(0)

        text = cls.RE_CIB.sub(_mask_cib, text)

        # 3. Modulo-97 Postal RIP / BaridiMob
        def _mask_rip(match: re.Match[str]) -> str:
            nonlocal redactions_count
            raw = re.sub(r"\D", "", match.group(1))
            if validate_dz_rip(raw):
                redactions_count += 1
                token = f"[ALGERIA_POSTE_RIP_{uuid.uuid4().hex[:8]}]"
                vault[token] = raw
                return token
            return match.group(0)

        text = cls.RE_RIP_BARIDIMOB.sub(_mask_rip, text)

        # 4. NIF (15 digits)
        def _mask_nif(m: re.Match[str]) -> str:
            nonlocal redactions_count
            raw = m.group(1)
            redactions_count += 1
            token = f"{{{{DZ_NIF_{uuid.uuid4().hex[:6]}}}}}"
            vault[token] = raw
            return f"{raw[:4]}*******{raw[-4:]} ({token})"

        text = cls.RE_NIF.sub(_mask_nif, text)

        # 5. Algerian Phone Numbers
        text = cls.RE_DZ_PHONE.sub("[TÉLÉPHONE_MASQUÉ]", text)

        # Persist ephemeral vault in Redis with 30-minute TTL
        if vault:
            redis = await get_redis()
            if redis:
                await redis.set(f"pii:vault:{session_id}", json.dumps(vault), ex=1800)

        return text, redactions_count

    @classmethod
    async def post_llm_detokenize(
        cls, prepared_params: Dict[str, Any], session_id: str
    ) -> Dict[str, Any]:
        """
        Boundary 2: Post-LLM Zero-Trust Execution Gateway.
        Re-injects real identifiers into tool parameters ONLY within the secure execution runtime.
        """
        redis = await get_redis()
        if not redis:
            return prepared_params

        vault_raw = await redis.get(f"pii:vault:{session_id}")
        if not vault_raw:
            return prepared_params

        vault: Dict[str, str] = json.loads(vault_raw)
        serialized = json.dumps(prepared_params)

        for token, original_value in vault.items():
            if token in serialized:
                serialized = serialized.replace(token, original_value)

        return json.loads(serialized)
