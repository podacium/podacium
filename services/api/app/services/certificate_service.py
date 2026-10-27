# app/services/certificate_service.py
import hmac
import hashlib
import os
import time
import json
import base64
from io import BytesIO
from datetime import datetime, timezone
import inspect
from typing import Optional, Dict, Any, List
import logging

import qrcode
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.core.config import setting

logger = logging.getLogger(__name__)


def canonicalize_jcs(data: Any) -> bytes:
    """RFC 8785 JSON Canonicalization Scheme (JCS)."""
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


class CertificateService:
    def __init__(self):
        if not setting.SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY is not configured — cannot sign certificates"
            )
        self.secret_key = setting.SECRET_KEY.encode()
        if not setting.BASE_URL:
            raise RuntimeError(
                "BASE_URL is not configured — cannot generate certificate URLs"
            )
        self.base_url = setting.BASE_URL

        # Derive deterministic Ed25519 key pair for asymmetric certificate signing
        ed25519_seed = hashlib.sha256(
            self.secret_key + b":podacium-asymmetric-cert-authority:v3"
        ).digest()
        self._private_key = ed25519.Ed25519PrivateKey.from_private_bytes(ed25519_seed)
        self._public_key = self._private_key.public_key()

    @property
    def public_key_hex(self) -> str:
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        ).hex()

    @staticmethod
    def _generate_qr_data_url(data: str) -> str:
        buf = BytesIO()
        img = qrcode.make(data, box_size=10, border=2)
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    @staticmethod
    def _canonical_ts(dt: datetime) -> str:
        """Canonical, reproducible timestamp for signing.

        Postgres/Prisma datetime round-trips can drop microseconds, so signing
        over the raw isoformat() is non-reproducible at verify time. Truncating
        to whole seconds in UTC makes the signed value deterministic.
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

    @staticmethod
    def _mask_email(email: str) -> str:
        """Mask student email for public verification endpoints per Law 18-07."""
        if not email or "@" not in email:
            return ""
        name, domain = email.split("@", 1)
        if len(name) <= 2:
            masked_name = name[0] + "*"
        else:
            masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
        return f"{masked_name}@{domain}"

    async def _sync_user_skills(
        self, user_id: int, skills: Optional[List[str]]
    ) -> None:
        """Synchronize verified course skills into the student's Skill Passport."""
        if not skills:
            return
        clean_skills = [s.strip() for s in skills if isinstance(s, str) and s.strip()]
        if not clean_skills:
            return
        try:
            user = await prisma.user.find_unique(where={"id": user_id})
            if user:
                current_skills = set(user.skills or [])
                new_skills = list(current_skills.union(clean_skills))
                if len(new_skills) > len(current_skills):
                    await prisma.user.update(
                        where={"id": user_id},
                        data={"skills": new_skills},
                    )

            existing_user_skills = await prisma.userskill.find_many(
                where={"userId": user_id, "name": {"in": clean_skills}}
            )
            existing_names = {s.name for s in existing_user_skills}
            to_create = [s for s in clean_skills if s not in existing_names]
            for skill_name in to_create:
                try:
                    await prisma.userskill.create(
                        data={"userId": user_id, "name": skill_name}
                    )
                except Exception:
                    pass
        except Exception as sync_err:
            logger.warning(f"Failed to sync skills for user {user_id}: {sync_err}")

    def _build_canonical_credential_doc(
        self,
        certificate_id: str,
        user_id: int,
        module_id: Optional[str],
        path_id: Optional[str],
        issued_at: str,
        metadata: Optional[Dict[str, Any]] = None,
        expiration_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Construct canonical W3C credential document encompassing entire scope (RFC 8785)."""
        doc: Dict[str, Any] = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
            ],
            "id": certificate_id,
            "type": ["VerifiableCredential", "OpenBadgeCredential"],
            "issuer": {
                "id": f"{self.base_url}/api/v1/certificates/issuer",
                "name": "Podacium Verified Credentials Authority",
                "publicKey": self.public_key_hex,
            },
            "issuanceDate": issued_at,
            "credentialSubject": {
                "id": f"urn:podacium:user:{user_id}",
                "userId": user_id,
                "moduleId": module_id,
                "pathId": path_id,
            },
        }
        exp_val = expiration_date
        if not exp_val and metadata and isinstance(metadata, dict):
            exp_val = metadata.get("expirationDate") or metadata.get("expiresAt")
        if exp_val:
            doc["expirationDate"] = exp_val

        if metadata and isinstance(metadata, dict):
            for k in ("moduleTitle", "pathTitle", "userName", "skills", "arrete1275"):
                if k in metadata:
                    doc["credentialSubject"][k] = metadata[k]
        return doc

    def _generate_ed25519_signature(
        self,
        certificate_id: str,
        user_id: int,
        module_id: Optional[str],
        path_id: Optional[str],
        issued_at: str,
        metadata: Optional[Dict[str, Any]] = None,
        expiration_date: Optional[str] = None,
    ) -> str:
        """Generate asymmetric Ed25519 signature over canonical W3C credential document (RFC 8785 JCS)."""
        doc = self._build_canonical_credential_doc(
            certificate_id,
            user_id,
            module_id,
            path_id,
            issued_at,
            metadata,
            expiration_date=expiration_date,
        )
        canonical_bytes = canonicalize_jcs(doc)
        sig = self._private_key.sign(canonical_bytes).hex()
        return f"ed25519:{sig}"

    def _generate_signature(
        self,
        certificate_id: str,
        user_id: int,
        module_id: Optional[str],
        path_id: Optional[str],
        issued_at: str,
        scheme: str = "v2",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate digital signature for verification.
        - scheme='ed25519' / 'eddsa-jcs-2022': Asymmetric Ed25519 signature over canonical W3C credential document (RFC 8785 JCS).
        - scheme='v2': HMAC-SHA256 signature for backwards compatibility.
        """
        if scheme in ("ed25519", "eddsa-jcs-2022"):
            return self._generate_ed25519_signature(
                certificate_id, user_id, module_id, path_id, issued_at, metadata
            )
        module_part = module_id or ""
        path_part = path_id or ""
        msg = f"v2:{certificate_id}:{user_id}:{module_part}:{path_part}:{issued_at}".encode()
        return "v2:" + hmac.new(self.secret_key, msg, hashlib.sha256).hexdigest()

    def verify_asymmetric_signature(
        self,
        certificate_id: str,
        user_id: int,
        module_id: Optional[str],
        path_id: Optional[str],
        issued_at: str,
        signature: str,
        public_key_hex: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        expiration_date: Optional[str] = None,
    ) -> bool:
        """Cryptographically verifies an off-platform certificate signature without platform master secret.
        Uses asymmetric Ed25519 (eddsa-jcs-2022) with RFC 8785 JSON Canonicalization Scheme.
        """
        try:
            if signature.startswith("ed25519:"):
                sig_hex = signature.split("ed25519:", 1)[1]
            elif signature.startswith("eddsa-jcs-2022:"):
                sig_hex = signature.split("eddsa-jcs-2022:", 1)[1]
            else:
                sig_hex = signature

            sig_bytes = bytes.fromhex(sig_hex)
            target_pub_hex = public_key_hex or self.public_key_hex
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(
                bytes.fromhex(target_pub_hex)
            )

            exp_val = expiration_date
            if not exp_val and metadata and isinstance(metadata, dict):
                exp_val = metadata.get("expirationDate") or metadata.get("expiresAt")

            # Try with metadata
            if metadata:
                doc = self._build_canonical_credential_doc(
                    certificate_id,
                    user_id,
                    module_id,
                    path_id,
                    issued_at,
                    metadata,
                    expiration_date=exp_val,
                )
                try:
                    pub_key.verify(sig_bytes, canonicalize_jcs(doc))
                    return True
                except Exception:
                    pass

            # Try base doc
            doc_base = self._build_canonical_credential_doc(
                certificate_id,
                user_id,
                module_id,
                path_id,
                issued_at,
                None,
                expiration_date=exp_val,
            )
            try:
                pub_key.verify(sig_bytes, canonicalize_jcs(doc_base))
                return True
            except Exception:
                pass

            if exp_val:
                doc_no_exp = self._build_canonical_credential_doc(
                    certificate_id,
                    user_id,
                    module_id,
                    path_id,
                    issued_at,
                    None,
                    expiration_date=None,
                )
                try:
                    pub_key.verify(sig_bytes, canonicalize_jcs(doc_no_exp))
                    return True
                except Exception:
                    pass

            return False
        except Exception:
            return False

    def _generate_signature_legacy(
        self,
        certificate_id: str,
        user_id: int,
        module_id: Optional[str],
        path_id: Optional[str],
        issued_at: str,
    ) -> str:
        """Legacy v1 signature scheme (pre-canonical timestamp). Kept so existing
        certificates created before the strict scheme remain verifiable."""
        module_part = module_id or ""
        path_part = path_id or ""
        msg = (
            f"{certificate_id}:{user_id}:{module_part}:{path_part}:{issued_at}".encode()
        )
        return hmac.new(self.secret_key, msg, hashlib.sha256).hexdigest()

    def _normalize_cert(self, cert) -> Dict[str, Any]:
        """Return a consistent dict from a Prisma Certificate object.
        Always uses certificateId (UUID) as the primary identifier — never the integer PK."""
        issued_at = (
            cert.issuedAt.isoformat()
            if hasattr(cert.issuedAt, "isoformat")
            else cert.issuedAt
        )
        return {
            "id": cert.certificateId,  # UUID — the public-facing identifier
            "certificateId": cert.certificateId,  # Alias for explicit consumers
            "issuedAt": issued_at,
            "verificationUrl": cert.verificationUrl,
            "qrCodeUrl": cert.qrCodeUrl,
            "fileUrl": cert.fileUrl,
            "userId": cert.userId,
            "moduleId": cert.moduleId,
            "pathId": cert.pathId,
        }

    def _generate_podacium_id(self) -> str:
        """Generate a unique, branded, non-predictable Podacium certificate ID.

        Format: PDC-{ts_b62}-{rand_b62}-{hmac_fragment}

        - PDC prefix  — instantly identifiable as a Podacium credential.
        - Timestamp   — milliseconds epoch in base-62 (~7 chars), enables rough time-sorting.
        - Entropy     — 10 bytes of os.urandom (80 bits) in base-62 (~14 chars), cryptographically unpredictable.
        - HMAC tail   — first 6 hex chars of HMAC-SHA256 keyed on installation secret,
                        so the ID can only be forged by someone with the secret key.

        Example: PDC-LYdKmN-X9kJ2mRqAs7L-f3a2b1
        """
        _B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

        def to_b62(n: int, min_len: int = 1) -> str:
            digits = []
            while n:
                digits.append(_B62[n % 62])
                n //= 62
            while len(digits) < min_len:
                digits.append("0")
            return "".join(reversed(digits))

        ts_ms = int(time.time() * 1000)  # milliseconds since epoch
        ts_part = to_b62(ts_ms, 7)  # ~7 base-62 chars

        rand_int = int.from_bytes(os.urandom(10), "big")  # 80 bits OS randomness
        rand_part = to_b62(rand_int, 14)  # ~14 base-62 chars

        raw = f"{ts_part}{rand_part}".encode()
        hmac_frag = hmac.new(self.secret_key, raw, hashlib.sha256).hexdigest()[:6]

        return f"PDC-{ts_part}-{rand_part}-{hmac_frag}"

    async def check_module_eligibility(
        self, user_id: int, module_id: str
    ) -> Dict[str, Any]:
        """Check if user is eligible for a module certificate.

        Criteria:
        - Enrollment progress == 100% (all lessons complete)
        - For each quiz-enabled lesson: best attempt score >= 90
        """
        try:
            # 1. Get the enrollment progress from the Enrollment record
            enrollment = await prisma.enrollment.find_first(
                where={"userId": user_id, "moduleId": module_id, "deletedAt": None}
            )
            if not enrollment:
                return {"eligible": False, "reason": "Not enrolled in this module"}

            # SECURITY: an expired or no-longer-entitled enrollment must not
            # yield a certificate, even if progress was recorded earlier.
            if (
                enrollment.expiresAt
                and datetime.now(timezone.utc) > enrollment.expiresAt
            ):
                return {"eligible": False, "reason": "Enrollment expired"}
            from app.services.education_service import education_service

            if not await education_service.check_access(user_id, module_id):
                return {"eligible": False, "reason": "No active access to this course"}

            progress = enrollment.progress or 0.0
            if progress < 100:
                return {
                    "eligible": False,
                    "reason": f"Progress is {progress:.1f}% — need 100%",
                }

            # 2. Check best quiz score for every quiz-linked lesson in this module
            lessons_with_quiz = await prisma.lesson.find_many(
                where={"moduleId": module_id, "quiz": {"isNot": None}},
                include={"quiz": True},
            )
            quiz_ids = [l.quiz.id for l in lessons_with_quiz if l.quiz]

            if quiz_ids:
                # For each quiz, find the best attempt by this user
                best_scores = await prisma.quizattempt.group_by(
                    by=["quizId"],
                    where={"userId": user_id, "quizId": {"in": quiz_ids}},
                    max={"score": True},
                )

                # Build a map of quizId -> best score
                best_score_map: Dict[str, float] = {
                    row["quizId"]: float(row.get("_max", {}).get("score", 0) or 0)
                    for row in best_scores
                }

                # Build a map of quizId -> passingScore (default 90)
                passing_score_map = {
                    l.quiz.id: (
                        float(l.quiz.passingScore)
                        if getattr(l.quiz, "passingScore", None) is not None
                        else 90.0
                    )
                    for l in lessons_with_quiz
                    if l.quiz
                }

                # Every quiz must have been attempted with best score >= passing score
                failing = [
                    qid
                    for qid in quiz_ids
                    if best_score_map.get(qid, 0) < passing_score_map.get(qid, 90.0)
                ]
                if failing:
                    return {
                        "eligible": False,
                        "reason": f"{len(failing)} quiz(zes) not passed with required score",
                    }

            return {"eligible": True, "completed_at": datetime.now(timezone.utc)}

        except Exception as e:
            logger.error(f"Error checking module certificate eligibility: {e}")
            return {"eligible": False, "reason": "Internal error"}

    async def check_path_eligibility(
        self, user_id: int, path_id: str
    ) -> Dict[str, Any]:
        """Check if user is eligible for a learning path certificate"""
        try:
            # 0. Check path enrollment expiration if path enrollment exists
            path_enrollment = None
            enrollment_model = getattr(prisma, "enrollment", None)
            if enrollment_model and hasattr(enrollment_model, "find_first"):
                res = enrollment_model.find_first(
                    where={"userId": user_id, "pathId": path_id, "deletedAt": None}
                )
                if inspect.isawaitable(res):
                    path_enrollment = await res
            if (
                path_enrollment
                and getattr(path_enrollment, "expiresAt", None)
                and datetime.now(timezone.utc) > path_enrollment.expiresAt
            ):
                return {"eligible": False, "reason": "Path enrollment expired"}

            # 1. Get all modules in the path
            path_modules = await prisma.pathmodule.find_many(
                where={"pathId": path_id}, include={"module": True}
            )

            if not path_modules:
                return {"eligible": False, "reason": "Path has no modules"}

            # 2. Check if user has certificates for all required modules
            required_module_ids = [
                pm.moduleId
                for pm in path_modules
                if not getattr(pm, "isOptional", False)
            ]
            if not required_module_ids:
                return {"eligible": False, "reason": "Path has no required modules"}

            user_certs = await prisma.certificate.find_many(
                where={
                    "userId": user_id,
                    "moduleId": {"in": required_module_ids},
                    "revokedAt": None,
                    "deletedAt": None,
                }
            )
            completed_module_ids = {c.moduleId for c in user_certs if c.moduleId}
            missing = [
                m_id for m_id in required_module_ids if m_id not in completed_module_ids
            ]
            if missing:
                return {
                    "eligible": False,
                    "reason": f"Module {missing[0]} not yet completed",
                }

            return {"eligible": True, "completed_at": datetime.now(timezone.utc)}

        except Exception as e:
            logger.error(f"Error checking path certificate eligibility: {e}")
            return {"eligible": False, "reason": "Internal error"}

    async def generate_module_certificate(
        self, user_id: int, module_id: str
    ) -> Optional[Dict[str, Any]]:
        """Generate a new certificate for a module completion"""
        try:
            # Check eligibility first
            eligibility = await self.check_module_eligibility(user_id, module_id)
            if not eligibility["eligible"]:
                logger.warning(
                    f"User {user_id} ineligible for module {module_id}: {eligibility['reason']}"
                )
                return None

            # Check if already exists (not revoked, not deleted)
            existing = await prisma.certificate.find_first(
                where={
                    "userId": user_id,
                    "moduleId": module_id,
                    "revokedAt": None,
                    "deletedAt": None,
                }
            )
            if existing:
                logger.info(
                    f"Certificate already exists for user {user_id}, module {module_id}"
                )
                return self._normalize_cert(existing)

            # Check if enrollment already has a certificate linked
            enrollment = await prisma.enrollment.find_first(
                where={"userId": user_id, "moduleId": module_id, "deletedAt": None}
            )
            if enrollment and enrollment.certificateId:
                existing_linked = await prisma.certificate.find_first(
                    where={
                        "certificateId": enrollment.certificateId,
                        "revokedAt": None,
                        "deletedAt": None,
                    }
                )
                if existing_linked:
                    return self._normalize_cert(existing_linked)

            # Get module info for metadata
            module = await prisma.module.find_unique(where={"id": module_id})
            user = await prisma.user.find_unique(where={"id": user_id})

            if not module or not user:
                logger.error(
                    f"Module or user not found: module={module_id}, user={user_id}"
                )
                return None

            # Create new certificate
            cert_id = self._generate_podacium_id()
            issued_at = datetime.now(timezone.utc).replace(microsecond=0)
            issued_at_str = self._canonical_ts(issued_at)
            verification_url = f"{self.base_url}/verify/{cert_id}"
            qr_code_url = self._generate_qr_data_url(verification_url)
            file_url = f"/api/certificates/download/{cert_id}"

            # Build metadata
            module_skills = module.skills if hasattr(module, "skills") else []
            metadata = {
                "moduleTitle": module.title,
                "moduleDescription": module.description,
                "moduleLevel": module.level,
                "userName": user.fullName,
                "userEmail": user.email,
                "completedAt": eligibility.get("completed_at", issued_at).isoformat(),
                "issuedAt": issued_at_str,
                "certificateType": "module",
                "skills": module_skills,
                "arrete1275": {
                    "framework": "MESRS Arrêté 1275 / Un diplôme, une startup",
                    "status": "ELIGIBLE_INCUBATION_CREDIT",
                    "openBadgesV3": {
                        "@context": "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
                        "type": ["VerifiableCredential", "OpenBadgeCredential"],
                        "name": f"MESRS Incubation Credit: {module.title}",
                    },
                },
            }

            # Asymmetric Ed25519 signature over canonical W3C credential document (RFC 8785 JCS)
            signature = self._generate_ed25519_signature(
                cert_id, user_id, module_id, None, issued_at_str, metadata=metadata
            )
            # Embed cryptographic proof in OpenBadges 3.0 metadata
            open_badges = metadata["arrete1275"]["openBadgesV3"]
            open_badges["proof"] = {
                "type": "DataIntegrityProof",
                "cryptosuite": "eddsa-jcs-2022",
                "created": issued_at_str,
                "verificationMethod": f"{self.base_url}/api/v1/certificates/keys/platform-ed25519#{self.public_key_hex[:16]}",
                "proofPurpose": "assertionMethod",
                "proofValue": signature.split("ed25519:", 1)[1],
            }

            # Create certificate and link to enrollment atomically
            try:
                async with prisma.tx() as tx:
                    certificate = await tx.certificate.create(
                        data={
                            "certificateId": cert_id,
                            "userId": user_id,
                            "moduleId": module_id,
                            "pathId": None,
                            "issuedAt": issued_at,
                            "digitalSignature": signature,
                            "verificationUrl": verification_url,
                            "qrCodeUrl": qr_code_url,
                            "fileUrl": file_url,
                            "metadata": Json(metadata),
                        }
                    )
                    await tx.enrollment.update_many(
                        where={"userId": user_id, "moduleId": module_id},
                        data={"certificateId": cert_id, "completedAt": issued_at},
                    )
            except Exception as create_err:
                existing_race = await prisma.certificate.find_first(
                    where={
                        "userId": user_id,
                        "moduleId": module_id,
                        "revokedAt": None,
                        "deletedAt": None,
                    }
                )
                if existing_race:
                    return self._normalize_cert(existing_race)
                raise create_err

            # Sync verified skills to student Skill Passport
            await self._sync_user_skills(user_id, module_skills)

            logger.info(
                f"Generated module certificate {cert_id} for user {user_id}, module {module_id}"
            )
            try:
                from app.services.notification_service import NotificationService
                from app.schemas.notifications import (
                    NotificationCreate,
                    NotificationCategory,
                    NotificationPriority,
                    NotificationPayload,
                )

                await NotificationService.create_notification(
                    NotificationCreate(
                        userId=user_id,
                        type="CERTIFICATE_ISSUED",
                        title="Certificate Issued! 🎓",
                        body=f"Congratulations! Your certificate {cert_id} has been issued.",
                        category=NotificationCategory.EDUCATION,
                        priority=NotificationPriority.HIGH,
                        payload=NotificationPayload(
                            entity_type="certificate",
                            entity_id=str(cert_id),
                            action_url=f"/certificates/{cert_id}",
                            metadata={
                                "certificate_id": cert_id,
                                "module_id": module_id,
                            },
                        ),
                        data={
                            "certificate_id": cert_id,
                            "action_url": f"/certificates/{cert_id}",
                            "url": f"/certificates/{cert_id}",
                        },
                    )
                )
            except Exception as notif_err:
                logger.warning(f"Failed to send certificate notification: {notif_err}")

            try:
                from app.middleware.metrics import FLYWHEEL_PASSPORT_ISSUED

                FLYWHEEL_PASSPORT_ISSUED.inc()
            except Exception:
                pass
            return self._normalize_cert(certificate)

        except Exception as e:
            logger.error(f"Error generating module certificate: {e}")
            return None

    async def generate_path_certificate(
        self, user_id: int, path_id: str
    ) -> Optional[Dict[str, Any]]:
        """Generate a new certificate for a learning path completion"""
        try:
            # Check eligibility first
            eligibility = await self.check_path_eligibility(user_id, path_id)
            if not eligibility["eligible"]:
                logger.warning(
                    f"User {user_id} ineligible for path {path_id}: {eligibility['reason']}"
                )
                return None

            # Check if already exists
            existing = await prisma.certificate.find_first(
                where={
                    "userId": user_id,
                    "pathId": path_id,
                    "revokedAt": None,
                    "deletedAt": None,
                }
            )
            if existing:
                logger.info(
                    f"Path certificate already exists for user {user_id}, path {path_id}"
                )
                return self._normalize_cert(existing)

            # Check if path enrollment already has a certificate linked
            path_enrollment = None
            enrollment_model = getattr(prisma, "enrollment", None)
            if enrollment_model and hasattr(enrollment_model, "find_first"):
                res = enrollment_model.find_first(
                    where={"userId": user_id, "pathId": path_id, "deletedAt": None}
                )
                if inspect.isawaitable(res):
                    path_enrollment = await res
            if path_enrollment and getattr(path_enrollment, "certificateId", None):
                existing_linked = None
                cert_model = getattr(prisma, "certificate", None)
                if cert_model and hasattr(cert_model, "find_first"):
                    c_res = cert_model.find_first(
                        where={
                            "certificateId": path_enrollment.certificateId,
                            "revokedAt": None,
                            "deletedAt": None,
                        }
                    )
                    if inspect.isawaitable(c_res):
                        existing_linked = await c_res
                if existing_linked:
                    return self._normalize_cert(existing_linked)

            # Get path info for metadata
            path = await prisma.path.find_unique(where={"id": path_id})
            user = await prisma.user.find_unique(where={"id": user_id})

            if not path or not user:
                logger.error(f"Path or user not found: path={path_id}, user={user_id}")
                return None

            # Create new certificate
            cert_id = self._generate_podacium_id()
            issued_at = datetime.now(timezone.utc).replace(microsecond=0)
            issued_at_str = self._canonical_ts(issued_at)
            verification_url = f"{self.base_url}/verify/{cert_id}"
            qr_code_url = self._generate_qr_data_url(verification_url)
            file_url = f"/api/certificates/download/{cert_id}"

            # Build metadata
            path_skills = path.skills if hasattr(path, "skills") else []
            metadata = {
                "pathTitle": path.title,
                "pathDescription": path.description,
                "pathLevel": path.level,
                "userName": user.fullName,
                "userEmail": user.email,
                "completedAt": eligibility.get("completed_at", issued_at).isoformat(),
                "issuedAt": issued_at_str,
                "certificateType": "path",
                "skills": path_skills,
                "arrete1275": {
                    "framework": "MESRS Arrêté 1275 / Un diplôme, une startup",
                    "status": "ELIGIBLE_INCUBATION_CREDIT",
                    "openBadgesV3": {
                        "@context": "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
                        "type": ["VerifiableCredential", "OpenBadgeCredential"],
                        "name": f"MESRS Incubation Track: {path.title}",
                    },
                },
            }

            # Asymmetric Ed25519 signature over canonical W3C credential document (RFC 8785 JCS)
            signature = self._generate_ed25519_signature(
                cert_id, user_id, None, path_id, issued_at_str, metadata=metadata
            )
            # Embed cryptographic proof in OpenBadges 3.0 metadata
            open_badges = metadata["arrete1275"]["openBadgesV3"]
            open_badges["proof"] = {
                "type": "DataIntegrityProof",
                "cryptosuite": "eddsa-jcs-2022",
                "created": issued_at_str,
                "verificationMethod": f"{self.base_url}/api/v1/certificates/keys/platform-ed25519#{self.public_key_hex[:16]}",
                "proofPurpose": "assertionMethod",
                "proofValue": signature.split("ed25519:", 1)[1],
            }

            try:
                async with prisma.tx() as tx:
                    certificate = await tx.certificate.create(
                        data={
                            "certificateId": cert_id,
                            "userId": user_id,
                            "moduleId": None,
                            "pathId": path_id,
                            "issuedAt": issued_at,
                            "digitalSignature": signature,
                            "verificationUrl": verification_url,
                            "qrCodeUrl": qr_code_url,
                            "fileUrl": file_url,
                            "metadata": Json(metadata),
                        }
                    )
                    await tx.enrollment.update_many(
                        where={"userId": user_id, "pathId": path_id},
                        data={"certificateId": cert_id, "completedAt": issued_at},
                    )
            except Exception as create_err:
                existing_race = await prisma.certificate.find_first(
                    where={
                        "userId": user_id,
                        "pathId": path_id,
                        "revokedAt": None,
                        "deletedAt": None,
                    }
                )
                if existing_race:
                    return self._normalize_cert(existing_race)
                raise create_err

            # Sync verified skills to student Skill Passport
            await self._sync_user_skills(user_id, path_skills)

            logger.info(
                f"Generated path certificate {cert_id} for user {user_id}, path {path_id}"
            )
            try:
                from app.services.notification_service import NotificationService
                from app.schemas.notifications import (
                    NotificationCreate,
                    NotificationCategory,
                    NotificationPriority,
                    NotificationPayload,
                )

                await NotificationService.create_notification(
                    NotificationCreate(
                        userId=user_id,
                        type="CERTIFICATE_ISSUED",
                        title="Career Path Certificate Issued! 🎓",
                        body=f"Congratulations! Your career track certificate {cert_id} has been issued.",
                        category=NotificationCategory.EDUCATION,
                        priority=NotificationPriority.HIGH,
                        payload=NotificationPayload(
                            entity_type="certificate",
                            entity_id=str(cert_id),
                            action_url=f"/certificates/{cert_id}",
                            metadata={"certificate_id": cert_id, "path_id": path_id},
                        ),
                        data={
                            "certificate_id": cert_id,
                            "action_url": f"/certificates/{cert_id}",
                            "url": f"/certificates/{cert_id}",
                        },
                    )
                )
            except Exception as notif_err:
                logger.warning(
                    f"Failed to send path certificate notification: {notif_err}"
                )

            try:
                from app.middleware.metrics import FLYWHEEL_PASSPORT_ISSUED

                FLYWHEEL_PASSPORT_ISSUED.inc()
            except Exception:
                pass
            return self._normalize_cert(certificate)

        except Exception as e:
            logger.error(f"Error generating path certificate: {e}")
            return None

    async def auto_generate_on_progress(
        self,
        user_id: int,
        module_id: Optional[str] = None,
        path_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Automatically generate certificate when user completes a module or path"""
        try:
            if module_id:
                return await self.generate_module_certificate(user_id, module_id)
            elif path_id:
                return await self.generate_path_certificate(user_id, path_id)
            else:
                logger.warning(
                    "auto_generate_on_progress called without module_id or path_id"
                )
                return None
        except Exception as e:
            logger.error(f"Error in auto_generate_on_progress: {e}")
            return None

    async def verify_certificate(self, cert_uuid: str) -> Optional[Dict[str, Any]]:
        """Verify a certificate via its UUID - Public endpoint"""
        try:
            cert = await prisma.certificate.find_unique(
                where={"certificateId": cert_uuid},
                include={"user": True, "module": True, "path": True},
            )

            if not cert or cert.revokedAt or cert.deletedAt:
                logger.warning(f"Certificate not found or revoked: {cert_uuid}")
                return None

            # Verify signature as an integrity check.
            # - Asymmetric Ed25519 (eddsa-jcs-2022) with RFC 8785 JCS over full document
            # - HMAC-SHA256 v2 (canonical timestamp)
            # - Legacy v1 (non-canonical timestamp)
            sig_valid = None  # None = no signature present
            if cert.digitalSignature:
                try:
                    if cert.digitalSignature.startswith(
                        ("ed25519:", "eddsa-jcs-2022:")
                    ):
                        sig_hex = (
                            cert.digitalSignature.split("ed25519:", 1)[1]
                            if cert.digitalSignature.startswith("ed25519:")
                            else cert.digitalSignature.split("eddsa-jcs-2022:", 1)[1]
                        )
                        sig_bytes = bytes.fromhex(sig_hex)
                        canonical_ts = self._canonical_ts(cert.issuedAt)

                        parsed_meta = None
                        if cert.metadata:
                            try:
                                parsed_meta = (
                                    json.loads(cert.metadata)
                                    if isinstance(cert.metadata, str)
                                    else cert.metadata
                                )
                            except Exception:
                                parsed_meta = None

                        exp_date = None
                        if parsed_meta and isinstance(parsed_meta, dict):
                            exp_date = parsed_meta.get(
                                "expirationDate"
                            ) or parsed_meta.get("expiresAt")

                        # 1. Try full document with metadata and expirationDate
                        doc_full = self._build_canonical_credential_doc(
                            cert.certificateId,
                            cert.userId,
                            cert.moduleId,
                            cert.pathId,
                            canonical_ts,
                            parsed_meta,
                            expiration_date=exp_date,
                        )
                        try:
                            self._public_key.verify(
                                sig_bytes, canonicalize_jcs(doc_full)
                            )
                            sig_valid = True
                        except Exception:
                            # 2. Try base document without metadata
                            doc_base = self._build_canonical_credential_doc(
                                cert.certificateId,
                                cert.userId,
                                cert.moduleId,
                                cert.pathId,
                                canonical_ts,
                                None,
                                expiration_date=exp_date,
                            )
                            try:
                                self._public_key.verify(
                                    sig_bytes, canonicalize_jcs(doc_base)
                                )
                                sig_valid = True
                            except Exception:
                                if exp_date:
                                    doc_no_exp = self._build_canonical_credential_doc(
                                        cert.certificateId,
                                        cert.userId,
                                        cert.moduleId,
                                        cert.pathId,
                                        canonical_ts,
                                        None,
                                        expiration_date=None,
                                    )
                                    try:
                                        self._public_key.verify(
                                            sig_bytes, canonicalize_jcs(doc_no_exp)
                                        )
                                        sig_valid = True
                                    except Exception:
                                        logger.error(
                                            f"Certificate asymmetric signature verification FAILED for {cert_uuid} — rejecting"
                                        )
                                        return None
                                else:
                                    logger.error(
                                        f"Certificate asymmetric signature verification FAILED for {cert_uuid} — rejecting"
                                    )
                                    return None

                        # Check expiration date if present
                        if exp_date:
                            try:
                                exp_dt = datetime.fromisoformat(
                                    exp_date.replace("Z", "+00:00")
                                )
                                if exp_dt.tzinfo is None:
                                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                                if datetime.now(timezone.utc) > exp_dt:
                                    logger.warning(
                                        f"Certificate {cert_uuid} expired on {exp_date}"
                                    )
                                    return {
                                        "id": cert.certificateId,
                                        "userName": getattr(
                                            cert.user, "fullName", "Unknown"
                                        )
                                        if cert.user
                                        else "Unknown",
                                        "userEmail": self._mask_email(
                                            getattr(cert.user, "email", "")
                                            if cert.user
                                            else ""
                                        ),
                                        "completedTitle": getattr(
                                            cert.module, "title", "Unknown"
                                        )
                                        if cert.module
                                        else "Unknown",
                                        "completedType": "module"
                                        if cert.moduleId
                                        else ("path" if cert.pathId else "unknown"),
                                        "issuedAt": cert.issuedAt.isoformat(),
                                        "verificationUrl": cert.verificationUrl
                                        or f"{self.base_url}/verify/{cert_uuid}",
                                        "qrCodeUrl": cert.qrCodeUrl
                                        or self._generate_qr_data_url(
                                            f"{self.base_url}/verify/{cert_uuid}"
                                        ),
                                        "isValid": False,
                                        "reason": "CERTIFICATE_EXPIRED",
                                        "expirationDate": exp_date,
                                        "metadata": parsed_meta or {},
                                    }
                            except Exception:
                                pass
                    elif cert.digitalSignature.startswith("v2:"):
                        expected_sig = self._generate_signature(
                            cert.certificateId,
                            cert.userId,
                            cert.moduleId,
                            cert.pathId,
                            self._canonical_ts(cert.issuedAt),
                            scheme="v2",
                        )
                        if not hmac.compare_digest(expected_sig, cert.digitalSignature):
                            logger.error(
                                f"Certificate signature verification FAILED for {cert_uuid} — rejecting"
                            )
                            return None
                        sig_valid = True
                    else:
                        legacy_sig = self._generate_signature_legacy(
                            cert.certificateId,
                            cert.userId,
                            cert.moduleId,
                            cert.pathId,
                            cert.issuedAt.isoformat(),
                        )
                        if hmac.compare_digest(legacy_sig, cert.digitalSignature):
                            sig_valid = True
                        else:
                            logger.warning(
                                f"Legacy certificate signature mismatch for {cert_uuid} — rejecting"
                            )
                            return None
                except Exception as sig_error:
                    logger.error(
                        f"Signature verification error for {cert_uuid}: {sig_error}"
                    )
                    return None

            # Certificates without a digital signature fail verification — they are shown but marked invalid.
            if sig_valid is None:
                return {
                    "id": cert.certificateId,
                    "userName": "Unknown",
                    "userEmail": "",
                    "completedTitle": "Unknown",
                    "completedType": "module"
                    if cert.moduleId
                    else ("path" if cert.pathId else "unknown"),
                    "issuedAt": cert.issuedAt.isoformat(),
                    "verificationUrl": cert.verificationUrl
                    or f"{self.base_url}/verify/{cert_uuid}",
                    "qrCodeUrl": cert.qrCodeUrl
                    or self._generate_qr_data_url(
                        f"{self.base_url}/verify/{cert_uuid}"
                    ),
                    "isValid": False,
                    "reason": "UNSIGNED_CERTIFICATE",
                    "metadata": {},
                }

            # Parse metadata
            metadata = {}
            if cert.metadata:
                try:
                    metadata = (
                        json.loads(cert.metadata)
                        if isinstance(cert.metadata, str)
                        else cert.metadata
                    )
                except Exception as json_error:
                    logger.warning(
                        f"Failed to parse metadata for {cert_uuid}: {json_error}"
                    )
                    pass

            # Determine what was completed - handle None cases
            completed_title = "Unknown"
            if cert.module and cert.module.title:
                completed_title = cert.module.title
            elif cert.path and cert.path.title:
                completed_title = cert.path.title
            elif metadata.get("moduleTitle"):
                completed_title = metadata["moduleTitle"]
            elif metadata.get("pathTitle"):
                completed_title = metadata["pathTitle"]

            certificate_type = (
                "module" if cert.moduleId else ("path" if cert.pathId else "unknown")
            )

            # Get user name safely
            user_name = "Unknown"
            if cert.user and cert.user.fullName:
                user_name = cert.user.fullName
            elif metadata.get("userName"):
                user_name = metadata["userName"]

            raw_email = (
                cert.user.email
                if cert.user and cert.user.email
                else metadata.get("userEmail", "")
            )
            masked_email = self._mask_email(raw_email)

            public_metadata = dict(metadata) if isinstance(metadata, dict) else {}
            if "userEmail" in public_metadata:
                public_metadata["userEmail"] = masked_email

            return {
                "id": cert.certificateId,
                "userName": user_name,
                "userEmail": masked_email,
                "completedTitle": completed_title,
                "completedType": certificate_type,
                "issuedAt": cert.issuedAt.isoformat(),
                "verificationUrl": cert.verificationUrl
                or f"{self.base_url}/verify/{cert_uuid}",
                "qrCodeUrl": cert.qrCodeUrl
                or self._generate_qr_data_url(f"{self.base_url}/verify/{cert_uuid}"),
                "isValid": True,
                "signatureScheme": "eddsa-jcs-2022"
                if cert.digitalSignature
                and cert.digitalSignature.startswith(("ed25519:", "eddsa-jcs-2022:"))
                else "hmac-sha256",
                "publicKey": self.public_key_hex,
                "metadata": public_metadata,
            }

        except Exception as e:
            logger.error(f"Error verifying certificate {cert_uuid}: {e}")
            import traceback

            logger.error(traceback.format_exc())
            return None

    async def get_user_certificates(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all certificates for a user"""
        try:
            certs = await prisma.certificate.find_many(
                where={"userId": user_id, "revokedAt": None, "deletedAt": None},
                include={"module": True, "path": True},
                order={"issuedAt": "desc"},
            )

            result = []
            for cert in certs:
                metadata = {}
                if cert.metadata:
                    try:
                        metadata = (
                            json.loads(cert.metadata)
                            if isinstance(cert.metadata, str)
                            else cert.metadata
                        )
                    except:
                        pass

                completed_title = (
                    cert.module.title
                    if cert.module
                    else (cert.path.title if cert.path else "Unknown")
                )
                certificate_type = (
                    "module"
                    if cert.moduleId
                    else ("path" if cert.pathId else "unknown")
                )

                result.append(
                    {
                        "id": cert.certificateId,
                        "completedTitle": completed_title,
                        "completedType": certificate_type,
                        "issuedAt": cert.issuedAt.isoformat(),
                        "verificationUrl": cert.verificationUrl,
                        "qrCodeUrl": cert.qrCodeUrl,
                        "fileUrl": cert.fileUrl,
                        "metadata": metadata,
                    }
                )

            return result

        except Exception as e:
            logger.error(f"Error getting user certificates: {e}")
            return []

    async def get_certificate_by_id(
        self, cert_uuid: str, user_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Get a specific certificate by UUID. If user_id provided, verify ownership."""
        try:
            where_clause: Dict[str, Any] = {"certificateId": cert_uuid}
            if user_id:
                where_clause["userId"] = user_id

            cert = await prisma.certificate.find_first(
                where=where_clause, include={"user": True, "module": True, "path": True}
            )

            if not cert or cert.revokedAt or cert.deletedAt:
                return None

            metadata = {}
            if cert.metadata:
                try:
                    metadata = (
                        json.loads(cert.metadata)
                        if isinstance(cert.metadata, str)
                        else cert.metadata
                    )
                except:
                    pass

            completed_title = (
                cert.module.title
                if cert.module
                else (cert.path.title if cert.path else "Unknown")
            )
            certificate_type = (
                "module" if cert.moduleId else ("path" if cert.pathId else "unknown")
            )

            return {
                "id": cert.certificateId,
                "userId": cert.userId,
                "userName": cert.user.fullName,
                "userEmail": cert.user.email,
                "completedTitle": completed_title,
                "completedType": certificate_type,
                "issuedAt": cert.issuedAt.isoformat(),
                "verificationUrl": cert.verificationUrl,
                "qrCodeUrl": cert.qrCodeUrl,
                "fileUrl": cert.fileUrl,
                "metadata": metadata,
            }

        except Exception as e:
            logger.error(f"Error getting certificate {cert_uuid}: {e}")
            return None

    async def revoke_certificate(self, cert_uuid: str, reason: str = "") -> bool:
        """Revoke a certificate (admin use)"""
        try:
            cert = await prisma.certificate.find_unique(
                where={"certificateId": cert_uuid}
            )

            if not cert:
                return False

            await prisma.certificate.update(
                where={"id": cert.id}, data={"revokedAt": datetime.now(timezone.utc)}
            )

            logger.info(f"Revoked certificate {cert_uuid}. Reason: {reason}")
            return True

        except Exception as e:
            logger.error(f"Error revoking certificate {cert_uuid}: {e}")
            return False


certificate_service = CertificateService()
