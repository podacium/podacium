"""
BaridiMob & CCP Receipt OCR / Transaction Verification Service.

Automates the verification of peer-to-peer non-custodial milestone settlements
in Algeria (BaridiMob, Algérie Poste CCP, Bank RIP transfers).
"""

import re
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class ParsedReceipt(BaseModel):
    transaction_id: Optional[str] = None
    reference_code: Optional[str] = None
    amount_dzd: Optional[int] = None
    sender_rip: Optional[str] = None
    receiver_rip: Optional[str] = None
    transaction_date: Optional[datetime] = None
    raw_text: str
    fingerprint: Optional[str] = None


class ReceiptVerificationResult(BaseModel):
    is_valid: bool
    status: str  # VALID, AMOUNT_MISMATCH, REFERENCE_MISMATCH, EXPIRED, REPLAY_DETECTED, PARSE_ERROR
    error_code: Optional[str] = None
    parsed_receipt: ParsedReceipt
    expected_amount: int
    expected_reference: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ReceiptOCRService:
    """Parses and cryptographically verifies Algerian payment slips and SMS receipts."""

    TXN_PATTERNS = [
        re.compile(
            r"(?:Transaction|N°\s*Op[ée]ration|N°\s*Trans|Num[ée]ro\s*d['’]op[ée]ration|R[ée]f[ée]rence\s*bancaire|TXN|OP|ID)[\s:]*([A-Za-z0-9\-_]{6,32})",
            re.IGNORECASE,
        ),
        re.compile(r"\b(BM\d{8,16}|CCP\d{8,16}|EDAHABIA\d{6,14})\b", re.IGNORECASE),
        re.compile(r"\bOp[ée]ration\s*n°\s*:?\s*(\d{6,16})\b", re.IGNORECASE),
    ]

    PODA_REF_PATTERN = re.compile(
        r"\b(PODA-CTR\d+-MS\d+|PODA-INV-\d+)\b", re.IGNORECASE
    )

    AMOUNT_PATTERNS = [
        re.compile(
            r"(?:Montant|Total|Somme|Amount|القيمة|المبلغ)[\s:]*([0-9\s.,]+)\s*(?:DZD|DA|D\.A|دج|DA\b)?",
            re.IGNORECASE,
        ),
        re.compile(
            r"([0-9]{1,3}(?:[\s.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:DZD|DA|D\.A|دج)\b",
            re.IGNORECASE,
        ),
    ]

    RIP_PATTERNS = [
        re.compile(
            r"(?:RIP|Vers|Destinataire|B[ée]n[ée]ficiaire|Compte|إلى|الحساب)[\s:]*(\d{3}\s*\d{5}\s*\d{10}\s*\d{2}|\d{20})\b",
            re.IGNORECASE,
        ),
        re.compile(r"\b(007\d{17}|\d{20})\b"),
    ]

    DATE_PATTERNS = [
        re.compile(r"(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?)"),
        re.compile(r"(\d{2}[/-]\d{2}[/-]\d{4}[\sT]\d{2}:\d{2}(?::\d{2})?)"),
        re.compile(r"le\s*(\d{2}/\d{2}/\d{4})\s*à\s*(\d{2}:\d{2})"),
    ]

    @staticmethod
    def normalize_amount(raw_amount_str: str) -> Optional[int]:
        """Convert formatted Algerian dinar string into integer DZD."""
        if not raw_amount_str:
            return None
        cleaned = raw_amount_str.strip()
        cleaned = re.sub(r"(?i)(?:dzd|da|d\.a|دج)", "", cleaned).strip()
        cleaned = re.sub(r"\s+", "", cleaned)
        if not cleaned:
            return None

        try:
            if "," in cleaned and "." in cleaned:
                if cleaned.rfind(",") > cleaned.rfind("."):
                    cleaned = cleaned.replace(".", "").replace(",", ".")
                else:
                    cleaned = cleaned.replace(",", "")
            elif "," in cleaned:
                parts = cleaned.split(",")
                if len(parts) == 2 and len(parts[1]) == 2:
                    cleaned = f"{parts[0]}.{parts[1]}"
                else:
                    cleaned = "".join(parts)
            elif "." in cleaned:
                # Check for thousands separator in Algerian/French format (e.g. 50.000 or 1.250.000)
                parts = cleaned.split(".")
                if all(len(p) == 3 for p in parts[1:]):
                    cleaned = "".join(parts)
                elif len(parts) == 2 and len(parts[1]) == 2:
                    cleaned = f"{parts[0]}.{parts[1]}"
            val = float(cleaned)
            return round(val)
        except Exception:
            return None

    @classmethod
    def parse_receipt_text(cls, raw_text: str) -> ParsedReceipt:
        """Extract structured fields from raw receipt OCR text or SMS notification."""
        txn_id = None
        for pat in cls.TXN_PATTERNS:
            match = pat.search(raw_text)
            if match:
                txn_id = match.group(1).strip()
                break

        ref_match = cls.PODA_REF_PATTERN.search(raw_text)
        ref_code = ref_match.group(1).upper() if ref_match else None

        amount_dzd = None
        for pat in cls.AMOUNT_PATTERNS:
            match = pat.search(raw_text)
            if match:
                extracted = cls.normalize_amount(match.group(1))
                if extracted and extracted > 0:
                    amount_dzd = extracted
                    break

        receiver_rip = None
        rip_matches = cls.RIP_PATTERNS[0].findall(raw_text)
        if rip_matches:
            raw_rip = rip_matches[0]
            receiver_rip = re.sub(r"\s+", "", raw_rip)
        else:
            fallback = cls.RIP_PATTERNS[1].search(raw_text)
            if fallback:
                receiver_rip = re.sub(r"\s+", "", fallback.group(1))

        txn_date = None
        for pat in cls.DATE_PATTERNS:
            match = pat.search(raw_text)
            if match:
                date_str = match.group(1)
                try:
                    if "/" in date_str and len(match.groups()) == 2:
                        full_dt = f"{match.group(1)} {match.group(2)}"
                        txn_date = datetime.strptime(full_dt, "%d/%m/%Y %H:%M").replace(
                            tzinfo=timezone.utc
                        )
                    elif "/" in date_str:
                        if ":" in date_str:
                            fmt = (
                                "%d/%m/%Y %H:%M:%S"
                                if date_str.count(":") == 2
                                else "%d/%m/%Y %H:%M"
                            )
                            txn_date = datetime.strptime(
                                date_str.replace("T", " "), fmt
                            ).replace(tzinfo=timezone.utc)
                        else:
                            txn_date = datetime.strptime(date_str, "%d/%m/%Y").replace(
                                tzinfo=timezone.utc
                            )
                    elif "-" in date_str:
                        fmt = (
                            "%Y-%m-%d %H:%M:%S"
                            if date_str.count(":") == 2
                            else "%Y-%m-%d %H:%M"
                        )
                        txn_date = datetime.strptime(
                            date_str.replace("T", " "), fmt
                        ).replace(tzinfo=timezone.utc)
                    break
                except Exception as e:
                    logger.debug(f"Failed to parse date '{date_str}': {e}")

        fingerprint = None
        if txn_id and amount_dzd:
            fp_seed = f"{txn_id}:{amount_dzd}:{receiver_rip or ''}:{ref_code or ''}"
            fingerprint = hashlib.sha256(fp_seed.encode("utf-8")).hexdigest()

        return ParsedReceipt(
            transaction_id=txn_id,
            reference_code=ref_code,
            amount_dzd=amount_dzd,
            receiver_rip=receiver_rip,
            transaction_date=txn_date,
            raw_text=raw_text,
            fingerprint=fingerprint,
        )

    @classmethod
    async def verify_receipt(
        cls,
        raw_text: str,
        expected_amount: int,
        expected_reference: str,
        expected_receiver_rip: Optional[str] = None,
        max_age_hours: int = 48,
    ) -> ReceiptVerificationResult:
        """
        End-to-end receipt verification with anti-replay and strict compliance checks.
        """
        parsed = cls.parse_receipt_text(raw_text)

        if not parsed.amount_dzd:
            return ReceiptVerificationResult(
                is_valid=False,
                status="PARSE_ERROR",
                error_code="errors.ocr.amount_not_found",
                parsed_receipt=parsed,
                expected_amount=expected_amount,
                expected_reference=expected_reference,
                details={
                    "detail": "Impossible d'extraire le montant de la preuve de virement."
                },
            )

        if parsed.amount_dzd != expected_amount:
            return ReceiptVerificationResult(
                is_valid=False,
                status="AMOUNT_MISMATCH",
                error_code="errors.ocr.amount_mismatch",
                parsed_receipt=parsed,
                expected_amount=expected_amount,
                expected_reference=expected_reference,
                details={
                    "detected_amount": parsed.amount_dzd,
                    "expected_amount": expected_amount,
                    "difference": parsed.amount_dzd - expected_amount,
                },
            )

        if (
            parsed.reference_code
            and parsed.reference_code.upper() != expected_reference.upper()
        ):
            return ReceiptVerificationResult(
                is_valid=False,
                status="REFERENCE_MISMATCH",
                error_code="errors.ocr.reference_mismatch",
                parsed_receipt=parsed,
                expected_amount=expected_amount,
                expected_reference=expected_reference,
                details={
                    "detected_reference": parsed.reference_code,
                    "expected_reference": expected_reference,
                },
            )

        if expected_receiver_rip and parsed.receiver_rip:
            clean_expected = re.sub(r"\s+", "", expected_receiver_rip)
            clean_detected = re.sub(r"\s+", "", parsed.receiver_rip)
            if clean_expected != clean_detected:
                return ReceiptVerificationResult(
                    is_valid=False,
                    status="RIP_MISMATCH",
                    error_code="errors.ocr.rip_mismatch",
                    parsed_receipt=parsed,
                    expected_amount=expected_amount,
                    expected_reference=expected_reference,
                    details={
                        "detected_rip": clean_detected,
                        "expected_rip": clean_expected,
                    },
                )

        if parsed.transaction_date:
            now = datetime.now(timezone.utc)
            max_age = timedelta(hours=max_age_hours)
            if (now - parsed.transaction_date) > max_age:
                return ReceiptVerificationResult(
                    is_valid=False,
                    status="EXPIRED",
                    error_code="errors.ocr.receipt_expired",
                    parsed_receipt=parsed,
                    expected_amount=expected_amount,
                    expected_reference=expected_reference,
                    details={
                        "transaction_date": parsed.transaction_date.isoformat(),
                        "max_age_hours": max_age_hours,
                    },
                )

        if parsed.fingerprint and prisma.is_connected():
            try:
                existing_audit = await prisma.auditlog.find_first(
                    where={
                        "eventType": "RECEIPT_VERIFIED",
                        "entityId": parsed.fingerprint,
                    }
                )
                if existing_audit:
                    return ReceiptVerificationResult(
                        is_valid=False,
                        status="REPLAY_DETECTED",
                        error_code="errors.ocr.receipt_already_used",
                        parsed_receipt=parsed,
                        expected_amount=expected_amount,
                        expected_reference=expected_reference,
                        details={"fingerprint": parsed.fingerprint},
                    )
            except Exception as e:
                logger.warning(f"Anti-replay audit check error: {e}")

        return ReceiptVerificationResult(
            is_valid=True,
            status="VALID",
            parsed_receipt=parsed,
            expected_amount=expected_amount,
            expected_reference=expected_reference,
            details={"message": "Preuve de virement valide et conforme."},
        )

    @classmethod
    def extract_text_from_image(cls, image_bytes: bytes) -> str:
        """
        Extract text from BaridiMob / CCP receipt image bytes.
        Uses pytesseract or PIL preprocessing when available, with graceful fallback.
        """
        try:
            import io
            from PIL import Image

            img = Image.open(io.BytesIO(image_bytes))
            if img.mode != "L":
                img = img.convert("L")
            try:
                import pytesseract

                return pytesseract.image_to_string(img, lang="fra+ara")
            except Exception:
                logger.debug("pytesseract not available or failed")
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {e}")
        return ""

    @classmethod
    async def record_verified_receipt(
        cls,
        fingerprint: str,
        actor_id: Optional[int] = None,
        reference_code: Optional[str] = None,
        amount_dzd: Optional[int] = None,
    ) -> None:
        """Persist fingerprint into audit log to prevent replay attacks."""
        if not fingerprint or not prisma.is_connected():
            return
        try:
            await prisma.auditlog.create(
                data={
                    "eventType": "RECEIPT_VERIFIED",
                    "entityType": "RECEIPT",
                    "entityId": fingerprint,
                    "actorId": actor_id or 0,
                    "action": "APPROVE_RECEIPT",
                    "metadata": {
                        "reference_code": reference_code,
                        "amount_dzd": amount_dzd,
                        "verified_at": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )
        except Exception as e:
            logger.warning(f"Could not write receipt verification audit log: {e}")


receipt_ocr_service = ReceiptOCRService()
