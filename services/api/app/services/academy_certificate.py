"""
TamWheel Sovereign Ethical Agentic Venture OS — Academy Certificate Generator.
Phase 2 Expansion: Cryptographically sealed, tamper-proof graduation certificates
for citizens completing the 5-module ESE Oran Darija Financial Literacy Academy.
Conforms to W3C Verifiable Credentials (JSON-LD) and Ed25519 digital signatures.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import qrcode
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from app.core.config import setting

logger = logging.getLogger(__name__)

ACCREDITATION_AUTHORITY = "École Supérieure d'Économie d'Oran (ESE Oran) & TamWheel Sovereign Academy"
ACCREDITATION_COUNCIL = "Comité Pédagogique National d'Éducation Financière Participative"


def canonicalize_jcs(data: Any) -> bytes:
    """RFC 8785 JSON Canonicalization Scheme (JCS) representation."""
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


class AcademyCertificateGenerator:
    """
    Generates and cryptographically verifies tamper-proof graduation credentials
    for graduates of the ESE Oran Darija Financial Literacy Academy.
    """

    def __init__(self):
        secret = (getattr(setting, "SECRET_KEY", None) or "tamwheel_academy_master_signing_secret_key_32c").encode()
        # Derive deterministic Ed25519 signing keypair for the Academy
        seed = hashlib.sha256(secret + b":ese-oran-financial-literacy-authority:v1").digest()
        self._private_key = ed25519.Ed25519PrivateKey.from_private_bytes(seed)
        self._public_key = self._private_key.public_key()

        self._in_memory_cert_store: Dict[str, Dict[str, Any]] = {}

    @property
    def public_key_hex(self) -> str:
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        ).hex()

    def generate_qr_data_url(self, verify_url: str) -> str:
        """Generates inline PNG base64 QR code image."""
        buf = BytesIO()
        img = qrcode.make(verify_url, box_size=8, border=2)
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    def issue_certificate(
        self,
        user_id: int,
        recipient_name: str,
        average_score: float,
        wilaya: Optional[int] = None,
        national_id_masked: Optional[str] = None,
        issued_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Issues a cryptographically signed graduation certificate conforming to:
        - ID: DARIJA-ACADEMY-CERT-YYYY-XXXX
        - ESE Oran accreditation hash (SHA-256)
        - Ed25519 digital signature
        - W3C Verifiable Credential standard schema
        """
        now_dt = issued_at or datetime.now(timezone.utc)
        year = now_dt.year
        short_code = uuid.uuid4().hex[:6].upper()
        certificate_id = f"DARIJA-ACADEMY-CERT-{year}-{short_code}"

        base_url = getattr(setting, "BASE_URL", "https://tamwheel.dz") or "https://tamwheel.dz"
        verify_url = f"{base_url.rstrip('/')}/verify/cert/{certificate_id}"
        qr_data_url = self.generate_qr_data_url(verify_url)

        # Core claims payload
        claims = {
            "certificateId": certificate_id,
            "recipientUserId": user_id,
            "recipientName": recipient_name,
            "recipientWilaya": wilaya or 31,  # Default Oran
            "recipientIdMasked": national_id_masked or f"DZ-***-{user_id:04d}",
            "program": "ESE Oran Darija Financial Literacy Academy",
            "modulesCompleted": 5,
            "totalModules": 5,
            "averageScore": round(float(average_score), 2),
            "qualificationAwarded": "Certified Venture Scout Analyst (كشاف مالي معتمد)",
            "accreditationAuthority": ACCREDITATION_AUTHORITY,
            "accreditationCouncil": ACCREDITATION_COUNCIL,
            "issuedAt": now_dt.replace(microsecond=0).isoformat(),
        }

        # Canonical hashing under RFC 8785
        canonical_bytes = canonicalize_jcs(claims)
        accreditation_hash = hashlib.sha256(canonical_bytes).hexdigest()

        # Sign the accreditation hash with Ed25519
        signature_bytes = self._private_key.sign(accreditation_hash.encode())
        signature_hex = signature_bytes.hex()

        # W3C Verifiable Credential JSON-LD
        verifiable_credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://tamwheel.dz/contexts/financial-literacy/v1",
            ],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential", "FinancialLiteracyAcademyCredential"],
            "issuer": {
                "id": "did:web:tamwheel.dz:ese-oran",
                "name": ACCREDITATION_AUTHORITY,
                "url": "https://ese-oran.dz",
            },
            "issuanceDate": now_dt.replace(microsecond=0).isoformat(),
            "credentialSubject": {
                "id": f"did:tamwheel:user:{user_id}",
                "name": recipient_name,
                "wilaya": wilaya or 31,
                "degree": "Certified Venture Scout Analyst (كشاف مالي معتمد)",
                "modules": [
                    "Module 1: شنو هي ستارت أب؟",
                    "Module 2: كيفاش تعمل الكراودفندينغ؟",
                    "Module 3: كيفاش تقرا ملف ستارت أب؟",
                    "Module 4: البورتفويو: التنويع واش معناه؟",
                    "Module 5: العائد: كيفاش نحسبو؟",
                ],
                "academicPartner": "École Supérieure d'Économie d'Oran (ESE Oran)",
            },
            "proof": {
                "type": "Ed25519Signature2020",
                "created": now_dt.replace(microsecond=0).isoformat(),
                "verificationMethod": f"did:web:tamwheel.dz:keys#{self.public_key_hex[:16]}",
                "proofPurpose": "assertionMethod",
                "proofValue": signature_hex,
                "accreditationHash": accreditation_hash,
            },
        }

        cert_bundle = {
            "certificateId": certificate_id,
            "claims": claims,
            "accreditationHash": accreditation_hash,
            "signature": signature_hex,
            "publicKey": self.public_key_hex,
            "verificationUrl": verify_url,
            "qrCodeDataUrl": qr_data_url,
            "verifiableCredential": verifiable_credential,
            "status": "VALID",
        }

        # Store in registry
        self._in_memory_cert_store[certificate_id] = cert_bundle
        logger.info(f"Certificate issued: ID={certificate_id} for user={recipient_name} ({user_id})")
        return cert_bundle

    def verify_certificate(self, certificate_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cryptographically validates an issued graduation certificate.
        Detects tampering or corrupted claims.
        """
        try:
            claims = certificate_data.get("claims")
            provided_hash = certificate_data.get("accreditationHash")
            signature_hex = certificate_data.get("signature")

            if not claims or not provided_hash or not signature_hex:
                return {
                    "isValid": False,
                    "reason": "Missing required claims, accreditation hash, or signature",
                }

            # 1. Recompute canonical hash
            recomputed_hash = hashlib.sha256(canonicalize_jcs(claims)).hexdigest()
            if recomputed_hash != provided_hash:
                return {
                    "isValid": False,
                    "reason": "Accreditation hash mismatch: Certificate claims have been altered (Tamper Detected)",
                }

            # 2. Verify Ed25519 signature
            sig_bytes = bytes.fromhex(signature_hex)
            self._public_key.verify(sig_bytes, provided_hash.encode())

            return {
                "isValid": True,
                "certificateId": claims.get("certificateId"),
                "recipientName": claims.get("recipientName"),
                "program": claims.get("program"),
                "issuedAt": claims.get("issuedAt"),
                "accreditationAuthority": claims.get("accreditationAuthority"),
                "status": "VERIFIED_AUTHENTIC",
            }

        except Exception as e:
            return {
                "isValid": False,
                "reason": f"Cryptographic verification failed: {str(e)}",
            }

    def get_certificate_by_id(self, certificate_id: str) -> Optional[Dict[str, Any]]:
        return self._in_memory_cert_store.get(certificate_id)


# Singleton certificate generator instance
academy_certificate_generator = AcademyCertificateGenerator()
