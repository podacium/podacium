"""Tests for certificate generation, verification, and revocation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.certificate_service import CertificateService
import json


@pytest.fixture
def csvc():
    return CertificateService()


class TestCertificateEligibility:
    """Eligibility checks before certificate issuance."""

    @patch("app.services.certificate_service.prisma")
    async def test_module_eligible(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(
            return_value=[
                MagicMock(quizId=1, quiz=MagicMock(id=1)),
                MagicMock(quizId=2, quiz=MagicMock(id=2)),
            ]
        )
        mock_prisma.quizattempt.find_first = AsyncMock(
            return_value=MagicMock(isPassed=True, score=95.0)
        )
        mock_prisma.quizattempt.group_by = AsyncMock(
            return_value=[
                {"quizId": 1, "_max": {"score": 95.0}},
                {"quizId": 2, "_max": {"score": 95.0}},
            ]
        )
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is True

    @patch("app.services.certificate_service.prisma")
    async def test_low_progress_not_eligible(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=50.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_failed_quiz_not_eligible(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[MagicMock(quizId=1)])
        mock_prisma.quizattempt.find_first = AsyncMock(
            return_value=MagicMock(isPassed=False, score=50.0)
        )
        result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False


class TestGenerateCertificate:
    """Certificate generation."""

    @patch("app.services.certificate_service.prisma")
    async def test_generate_module_certificate(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(
            return_value=MagicMock(
                id="mod-1",
                title="Test Module",
                description="Desc",
                level="beginner",
                skills=["python"],
            )
        )
        mock_prisma.user.find_unique = AsyncMock(
            return_value=MagicMock(id=1, fullName="Test User", email="test@test.com")
        )
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(
                progress=100.0, expiresAt=None, startedAt=datetime.now(timezone.utc)
            )
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        mock_prisma.certificate.create = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-xxx",
                userId=1,
                moduleId="mod-1",
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="url",
                qrCodeUrl="qr",
                fileUrl="file",
                digitalSignature="sig",
                pathId=None,
                revokedAt=None,
                deletedAt=None,
                metadata='{"moduleTitle": "Test Module"}',
            )
        )
        mock_prisma.enrollment.update_many = AsyncMock()
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.generate_module_certificate(1, "mod-1")
        assert result is not None
        assert result["certificateId"].startswith("PDC-")

    @patch("app.services.certificate_service.prisma")
    async def test_generate_duplicate_returns_existing(self, mock_prisma, csvc):
        existing = MagicMock(
            certificateId="PDC-existing",
            userId=1,
            moduleId="mod-1",
            issuedAt=datetime.now(timezone.utc),
            verificationUrl="url",
            qrCodeUrl="qr",
            fileUrl="file",
            digitalSignature="sig",
            pathId=None,
            revokedAt=None,
            deletedAt=None,
            metadata="{}",
            user=MagicMock(fullName="Test", email="t@t.com"),
            module=MagicMock(title="Test"),
        )
        mock_prisma.certificate.find_first = AsyncMock(return_value=existing)
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(
                progress=100.0, expiresAt=None, completedAt=datetime.now(timezone.utc)
            )
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.generate_module_certificate(1, "mod-1")
        assert result["certificateId"] == "PDC-existing"


class TestVerifyCertificate:
    """Certificate verification."""

    @patch("app.services.certificate_service.prisma")
    async def test_verify_valid(self, mock_prisma, csvc):
        issued_at = datetime.now(timezone.utc)
        valid_sig = csvc._generate_signature(
            "PDC-xxx", 1, "mod-1", None, csvc._canonical_ts(issued_at)
        )
        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-xxx",
                userId=1,
                moduleId="mod-1",
                issuedAt=issued_at,
                digitalSignature=valid_sig,
                verificationUrl="url",
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
                pathId=None,
                user=MagicMock(fullName="Test User"),
                module=MagicMock(title="Test Module"),
                path=None,
            )
        )
        result = await csvc.verify_certificate("PDC-xxx")
        assert result is not None
        assert result["isValid"] is True

    @patch("app.services.certificate_service.prisma")
    async def test_verify_invalid_signature_rejected(self, mock_prisma, csvc):
        issued_at = datetime.now(timezone.utc)
        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-xxx",
                userId=1,
                moduleId="mod-1",
                issuedAt=issued_at,
                digitalSignature="invalid_signature_that_fails_digest",
                verificationUrl="url",
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
                pathId=None,
                user=MagicMock(fullName="Test User"),
                module=MagicMock(title="Test Module"),
                path=None,
            )
        )
        result = await csvc.verify_certificate("PDC-xxx")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_verify_nonexistent(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(return_value=None)
        result = await csvc.verify_certificate("PDC-nonexistent")
        assert result is None


class TestCertificateIdFormat:
    def test_id_format(self):
        csvc = CertificateService()
        cert_id = csvc._generate_podacium_id()
        assert cert_id.startswith("PDC-")

    def test_signature_generation(self):
        csvc = CertificateService()
        sig = csvc._generate_signature("PDC-xxx", 1, "mod-1", None, "2024-01-01")
        assert isinstance(sig, str) and len(sig) > 0

    def test_signature_consistent(self):
        csvc = CertificateService()
        sig1 = csvc._generate_signature("PDC-xxx", 1, "mod-1", None, "2024-01-01")
        sig2 = csvc._generate_signature("PDC-xxx", 1, "mod-1", None, "2024-01-01")
        assert sig1 == sig2


class TestPathCertificate:
    """Path certificate generation and eligibility."""

    @patch("app.services.certificate_service.prisma")
    async def test_check_path_eligible(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-mod1",
                    moduleId="mod-1",
                    revokedAt=None,
                    deletedAt=None,
                )
            ]
        )
        result = await csvc.check_path_eligibility(1, "path-1")
        assert result["eligible"] is True

    @patch("app.services.certificate_service.prisma")
    async def test_check_path_not_eligible_missing_module(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(return_value=[])
        result = await csvc.check_path_eligibility(1, "path-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_check_path_not_eligible_no_modules(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        result = await csvc.check_path_eligibility(1, "path-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_check_path_error(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(side_effect=Exception("DB error"))
        result = await csvc.check_path_eligibility(1, "path-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_generate_path_certificate(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-mod1",
                    moduleId="mod-1",
                    revokedAt=None,
                    deletedAt=None,
                )
            ]
        )
        mock_prisma.certificate.find_first = AsyncMock(
            return_value=None
        )  # no existing path cert
        mock_prisma.path.find_unique = AsyncMock(
            return_value=MagicMock(
                id="path-1",
                title="Test Path",
                description="Desc",
                level="beginner",
                skills=["python"],
            )
        )
        mock_prisma.user.find_unique = AsyncMock(
            return_value=MagicMock(id=1, fullName="Test User", email="test@test.com")
        )
        mock_prisma.certificate.create = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-path123",
                userId=1,
                pathId="path-1",
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="url",
                qrCodeUrl="qr",
                fileUrl="file",
                digitalSignature="sig",
                moduleId=None,
                revokedAt=None,
                deletedAt=None,
                metadata=json.dumps({"pathTitle": "Test Path"}),
            )
        )
        mock_prisma.enrollment.update_many = AsyncMock()
        result = await csvc.generate_path_certificate(1, "path-1")
        assert result is not None
        assert result["certificateId"].startswith("PDC-")

    @patch("app.services.certificate_service.prisma")
    async def test_generate_path_duplicate_returns_existing(self, mock_prisma, csvc):
        existing = MagicMock(
            certificateId="PDC-existing",
            userId=1,
            pathId="path-1",
            issuedAt=datetime.now(timezone.utc),
            verificationUrl="url",
            qrCodeUrl="qr",
            fileUrl="file",
            digitalSignature="sig",
            moduleId=None,
            revokedAt=None,
            deletedAt=None,
            metadata="{}",
        )
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-mod1",
                    moduleId="mod-1",
                    revokedAt=None,
                    deletedAt=None,
                )
            ]
        )
        mock_prisma.certificate.find_first = AsyncMock(return_value=existing)
        result = await csvc.generate_path_certificate(1, "path-1")
        assert result["certificateId"] == "PDC-existing"

    @patch("app.services.certificate_service.prisma")
    async def test_generate_path_ineligible(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        result = await csvc.generate_path_certificate(1, "path-1")
        assert result is None


class TestAutoGenerateCertificate:
    """Auto-generation on progress completion."""

    @patch("app.services.certificate_service.prisma")
    async def test_auto_generate_module(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(
            return_value=MagicMock(
                id="mod-1",
                title="M",
                description="D",
                level="b",
                skills=[],
            )
        )
        mock_prisma.user.find_unique = AsyncMock(
            return_value=MagicMock(id=1, fullName="U", email="u@u.com")
        )
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(
                progress=100.0, expiresAt=None, startedAt=datetime.now(timezone.utc)
            )
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        mock_prisma.certificate.create = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-auto",
                userId=1,
                moduleId="mod-1",
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="url",
                qrCodeUrl="qr",
                fileUrl="file",
                digitalSignature="sig",
                pathId=None,
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
            )
        )
        mock_prisma.enrollment.update_many = AsyncMock()
        mock_prisma.pathmodule.find_many = AsyncMock(return_value=[])
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.auto_generate_on_progress(1, module_id="mod-1")
        assert result is not None

    @patch("app.services.certificate_service.prisma")
    async def test_auto_generate_path(self, mock_prisma, csvc):
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-mod1",
                    moduleId="mod-1",
                    revokedAt=None,
                    deletedAt=None,
                )
            ]
        )
        mock_prisma.certificate.find_first = AsyncMock(return_value=None)
        mock_prisma.path.find_unique = AsyncMock(
            return_value=MagicMock(
                id="path-1",
                title="P",
                description="D",
                level="b",
                skills=[],
            )
        )
        mock_prisma.user.find_unique = AsyncMock(
            return_value=MagicMock(id=1, fullName="U", email="u@u.com")
        )
        mock_prisma.certificate.create = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-auto2",
                userId=1,
                pathId="path-1",
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="url",
                qrCodeUrl="qr",
                fileUrl="file",
                digitalSignature="sig",
                moduleId=None,
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
            )
        )
        mock_prisma.enrollment.update_many = AsyncMock()
        result = await csvc.auto_generate_on_progress(1, path_id="path-1")
        assert result is not None

    def test_auto_generate_no_ids(self, csvc):
        import asyncio

        result = asyncio.run(csvc.auto_generate_on_progress(1))
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_auto_generate_error(self, mock_prisma, csvc):
        mock_prisma.module.find_unique = AsyncMock(side_effect=Exception("error"))
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0)
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        result = await csvc.auto_generate_on_progress(1, module_id="mod-1")
        assert result is None


class TestUserCertificates:
    """User certificate listing and retrieval."""

    @patch("app.services.certificate_service.prisma")
    async def test_get_user_certificates(self, mock_prisma, csvc):
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-1",
                    userId=1,
                    moduleId="mod-1",
                    pathId=None,
                    issuedAt=datetime.now(timezone.utc),
                    verificationUrl="v1",
                    qrCodeUrl="q1",
                    fileUrl="f1",
                    revokedAt=None,
                    deletedAt=None,
                    metadata='{"moduleTitle": "M1"}',
                    module=MagicMock(title="M1"),
                    path=None,
                ),
            ]
        )
        result = await csvc.get_user_certificates(1)
        assert len(result) == 1
        assert result[0]["completedTitle"] == "M1"

    @patch("app.services.certificate_service.prisma")
    async def test_get_user_certificates_empty(self, mock_prisma, csvc):
        mock_prisma.certificate.find_many = AsyncMock(return_value=[])
        result = await csvc.get_user_certificates(1)
        assert result == []

    @patch("app.services.certificate_service.prisma")
    async def test_get_user_certificates_handles_path_certs(self, mock_prisma, csvc):
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-p1",
                    userId=1,
                    moduleId=None,
                    pathId="path-1",
                    issuedAt=datetime.now(timezone.utc),
                    verificationUrl="v1",
                    qrCodeUrl="q1",
                    fileUrl="f1",
                    revokedAt=None,
                    deletedAt=None,
                    metadata="{}",
                    module=None,
                    path=MagicMock(title="Path 1"),
                ),
            ]
        )
        result = await csvc.get_user_certificates(1)
        assert result[0]["completedTitle"] == "Path 1"
        assert result[0]["completedType"] == "path"

    @patch("app.services.certificate_service.prisma")
    async def test_get_certificate_by_id(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-1",
                userId=1,
                moduleId="mod-1",
                pathId=None,
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="v1",
                qrCodeUrl="q1",
                fileUrl="f1",
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
                user=MagicMock(fullName="U", email="u@u.com"),
                module=MagicMock(title="M1"),
                path=None,
            )
        )
        result = await csvc.get_certificate_by_id("PDC-1")
        assert result is not None
        assert result["id"] == "PDC-1"

    @patch("app.services.certificate_service.prisma")
    async def test_get_certificate_by_id_ownership(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-1",
                userId=1,
                moduleId="mod-1",
                pathId=None,
                issuedAt=datetime.now(timezone.utc),
                verificationUrl="v1",
                qrCodeUrl="q1",
                fileUrl="f1",
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
                user=MagicMock(fullName="U", email="u@u.com"),
                module=MagicMock(title="M1"),
                path=None,
            )
        )
        result = await csvc.get_certificate_by_id("PDC-1", user_id=1)
        assert result is not None

    @patch("app.services.certificate_service.prisma")
    async def test_get_certificate_by_id_not_found(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(return_value=None)
        result = await csvc.get_certificate_by_id("PDC-nonexistent")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_get_certificate_by_id_revoked(self, mock_prisma, csvc):
        mock_prisma.certificate.find_first = AsyncMock(
            return_value=MagicMock(
                revokedAt=datetime.now(timezone.utc),
                deletedAt=None,
            )
        )
        result = await csvc.get_certificate_by_id("PDC-revoked")
        assert result is None


class TestRevokeCertificate:
    """Certificate revocation."""

    @patch("app.services.certificate_service.prisma")
    async def test_revoke_certificate(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.certificate.update = AsyncMock()
        result = await csvc.revoke_certificate("PDC-xxx", reason="Test revoke")
        assert result is True

    @patch("app.services.certificate_service.prisma")
    async def test_revoke_nonexistent(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(return_value=None)
        result = await csvc.revoke_certificate("PDC-nonexistent")
        assert result is False

    @patch("app.services.certificate_service.prisma")
    async def test_revoke_error(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(
            side_effect=Exception("DB error")
        )
        result = await csvc.revoke_certificate("PDC-xxx")
        assert result is False


class TestVerifyCertificateEdgeCases:
    """Edge cases for certificate verification."""

    @patch("app.services.certificate_service.prisma")
    async def test_verify_revoked(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-r",
                revokedAt=datetime.now(timezone.utc),
                deletedAt=None,
            )
        )
        result = await csvc.verify_certificate("PDC-r")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_verify_deleted(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-d",
                revokedAt=None,
                deletedAt=datetime.now(timezone.utc),
            )
        )
        result = await csvc.verify_certificate("PDC-d")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_verify_with_metadata_string(self, mock_prisma, csvc):
        issued_at = datetime.now(timezone.utc)
        valid_sig = csvc._generate_signature(
            "PDC-m", 1, "mod-1", None, csvc._canonical_ts(issued_at)
        )
        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-m",
                userId=1,
                moduleId="mod-1",
                pathId=None,
                issuedAt=issued_at,
                digitalSignature=valid_sig,
                verificationUrl="url",
                revokedAt=None,
                deletedAt=None,
                metadata='{"moduleTitle": "M1", "userName": "U"}',
                user=MagicMock(fullName="U", email="u@u.com"),
                module=MagicMock(title="M1"),
            )
        )
        result = await csvc.verify_certificate("PDC-m")
        assert result is not None
        assert result["isValid"] is True

    @patch("app.services.certificate_service.prisma")
    async def test_verify_error_returns_none(self, mock_prisma, csvc):
        mock_prisma.certificate.find_unique = AsyncMock(
            side_effect=Exception("DB error")
        )
        result = await csvc.verify_certificate("PDC-err")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_check_module_eligibility_not_enrolled(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_check_module_eligibility_internal_error(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(side_effect=Exception("error"))
        result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False

    @patch("app.services.certificate_service.prisma")
    async def test_generate_module_certificate_ineligible(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(return_value=None)
        result = await csvc.generate_module_certificate(1, "mod-1")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_generate_module_certificate_error(self, mock_prisma, csvc):
        mock_prisma.enrollment.find_first = AsyncMock(side_effect=Exception("error"))
        result = await csvc.generate_module_certificate(1, "mod-1")
        assert result is None

    def test_normalize_cert(self, csvc):
        cert = MagicMock(
            certificateId="PDC-norm",
            userId=1,
            moduleId="mod-1",
            pathId=None,
            issuedAt=datetime.now(timezone.utc),
            verificationUrl="v",
            qrCodeUrl="q",
            fileUrl="f",
        )
        result = csvc._normalize_cert(cert)
        assert result["id"] == "PDC-norm"
        assert result["moduleId"] == "mod-1"


class TestCertificateExpiredData:
    """Certificate generation with expired or invalid data."""

    @patch("app.services.certificate_service.prisma")
    async def test_check_module_eligibility_expired_enrollment(self, mock_prisma, csvc):
        """Enrollment with past expiresAt should NOT be eligible (security fix)."""
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(
                progress=100.0, expiresAt=datetime(2020, 1, 1, tzinfo=timezone.utc)
            )
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False  # expired enrollment is denied

    @patch("app.services.certificate_service.prisma")
    async def test_module_with_no_lessons_eligible(self, mock_prisma, csvc):
        """Module with no lessons but 100% progress should be eligible."""
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is True

    @patch("app.services.certificate_service.prisma")
    async def test_module_quizzes_not_attempted(self, mock_prisma, csvc):
        """Module with unpublished/skipped quiz lessons should check best score."""
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(
            return_value=[
                MagicMock(quizId=1, quiz=MagicMock(id=1)),
            ]
        )
        mock_prisma.quizattempt.group_by = AsyncMock(return_value=[])
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.check_module_eligibility(1, "mod-1")
        assert result["eligible"] is False  # quiz not attempted

    @patch("app.services.certificate_service.prisma")
    async def test_generate_certificate_module_not_found(self, mock_prisma, csvc):
        """Attempting to generate cert for non-existent module returns None."""
        mock_prisma.enrollment.find_first = AsyncMock(
            return_value=MagicMock(progress=100.0, expiresAt=None)
        )
        mock_prisma.lesson.find_many = AsyncMock(return_value=[])
        mock_prisma.certificate.find_first = AsyncMock(return_value=None)
        mock_prisma.module.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.education_service.education_service.check_access",
            AsyncMock(return_value=True),
        ):
            result = await csvc.generate_module_certificate(1, "nonexistent")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_generate_path_certificate_no_path(self, mock_prisma, csvc):
        """Attempting to generate path cert for non-existent path returns None."""
        mock_prisma.pathmodule.find_many = AsyncMock(
            side_effect=Exception("Path not found")
        )
        result = await csvc.generate_path_certificate(1, "nonexistent")
        assert result is None

    @patch("app.services.certificate_service.prisma")
    async def test_path_certificate_optional_modules_skipped(self, mock_prisma, csvc):
        """Path with optional modules should only require required modules."""
        mock_prisma.pathmodule.find_many = AsyncMock(
            return_value=[
                MagicMock(moduleId="mod-1", isOptional=False),
                MagicMock(moduleId="mod-2", isOptional=True),
            ]
        )
        mock_prisma.certificate.find_many = AsyncMock(
            return_value=[
                MagicMock(
                    certificateId="PDC-mod1",
                    moduleId="mod-1",
                    revokedAt=None,
                    deletedAt=None,
                )
            ]
        )
        result = await csvc.check_path_eligibility(1, "path-1")
        assert result["eligible"] is True  # optional module skipped

    @patch("app.services.certificate_service.prisma")
    async def test_revoke_already_revoked_certificate(self, mock_prisma, csvc):
        """Revoking an already revoked cert should still succeed."""
        mock_prisma.certificate.find_unique = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.certificate.update = AsyncMock()
        result = await csvc.revoke_certificate("PDC-already-revoked")
        assert result is True

    @patch("app.services.certificate_service.prisma")
    async def test_get_user_certificates_error(self, mock_prisma, csvc):
        """Database error during cert listing should return empty list."""
        mock_prisma.certificate.find_many = AsyncMock(side_effect=Exception("DB error"))
        result = await csvc.get_user_certificates(1)
        assert result == []


class TestAsymmetricEd25519Certificates:
    """VULN-W2-09: Asymmetric Ed25519 (eddsa-jcs-2022) signing and off-platform verification."""

    def test_ed25519_signature_generation_and_off_platform_verification(self, csvc):
        """Verify Ed25519 signature is generated and can be verified using only public key."""
        cert_id = "PDC-TEST-ASYMMETRIC"
        user_id = 42
        module_id = "mod-crypto-101"
        issued_at = "2026-10-17T12:00:00+00:00"
        meta = {"moduleTitle": "Cryptography in Algerian Banking"}

        sig = csvc._generate_ed25519_signature(
            cert_id, user_id, module_id, None, issued_at, metadata=meta
        )
        assert sig.startswith("ed25519:")
        assert len(sig) > 70

        # Off-platform third party verifies with only the public key
        pub_hex = csvc.public_key_hex
        is_valid = csvc.verify_asymmetric_signature(
            cert_id,
            user_id,
            module_id,
            None,
            issued_at,
            signature=sig,
            public_key_hex=pub_hex,
            metadata=meta,
        )
        assert is_valid is True

    def test_asymmetric_signature_tamper_detection(self, csvc):
        """Tampering with claims must cause asymmetric verification to fail."""
        cert_id = "PDC-TEST-ASYMMETRIC"
        user_id = 42
        module_id = "mod-crypto-101"
        issued_at = "2026-10-17T12:00:00+00:00"

        sig = csvc._generate_ed25519_signature(
            cert_id, user_id, module_id, None, issued_at
        )

        # Tampered user_id
        assert not csvc.verify_asymmetric_signature(
            cert_id,
            user_id + 1,  # Tampered!
            module_id,
            None,
            issued_at,
            signature=sig,
        )

        # Tampered module_id
        assert not csvc.verify_asymmetric_signature(
            cert_id,
            user_id,
            "mod-tampered",  # Tampered!
            None,
            issued_at,
            signature=sig,
        )

    @patch("app.services.certificate_service.prisma")
    async def test_verify_certificate_ed25519_scheme(self, mock_prisma, csvc):
        """Verify verify_certificate verifies ed25519 signature and returns signatureScheme and publicKey."""
        issued_at = datetime.now(timezone.utc)
        canonical_ts = csvc._canonical_ts(issued_at)
        sig = csvc._generate_ed25519_signature(
            "PDC-ED25519", 10, "mod-1", None, canonical_ts
        )

        mock_prisma.certificate.find_unique = AsyncMock(
            return_value=MagicMock(
                certificateId="PDC-ED25519",
                userId=10,
                moduleId="mod-1",
                pathId=None,
                issuedAt=issued_at,
                digitalSignature=sig,
                verificationUrl="url",
                revokedAt=None,
                deletedAt=None,
                metadata="{}",
                user=MagicMock(fullName="Yacine Kateb", email="yacine@podacium.dz"),
                module=MagicMock(title="Algerian Fintech 101"),
                path=None,
            )
        )
        result = await csvc.verify_certificate("PDC-ED25519")
        assert result is not None
        assert result["isValid"] is True
        assert result["signatureScheme"] == "eddsa-jcs-2022"
        assert result["publicKey"] == csvc.public_key_hex

    def test_certificate_with_expiration_date_verification(self, csvc):
        """Ensure certificate with expirationDate signs entire document and verifies correctly."""
        cert_id = "PDC-EXPIRING-CERT"
        user_id = 99
        module_id = "mod-cyber-sec"
        issued_at = "2026-10-18T10:00:00+00:00"
        exp_date = "2028-10-18T10:00:00+00:00"
        meta = {
            "moduleTitle": "Critical Infrastructure Protection",
            "expirationDate": exp_date,
        }

        sig = csvc._generate_ed25519_signature(
            cert_id,
            user_id,
            module_id,
            None,
            issued_at,
            metadata=meta,
            expiration_date=exp_date,
        )
        assert sig.startswith("ed25519:")

        # Verifies successfully with original expiration date
        is_valid = csvc.verify_asymmetric_signature(
            cert_id,
            user_id,
            module_id,
            None,
            issued_at,
            signature=sig,
            metadata=meta,
            expiration_date=exp_date,
        )
        assert is_valid is True

        # Tampering with expiration date fails verification
        tampered_exp = "2030-10-18T10:00:00+00:00"
        tampered_meta = dict(meta, expirationDate=tampered_exp)
        is_tampered_valid = csvc.verify_asymmetric_signature(
            cert_id,
            user_id,
            module_id,
            None,
            issued_at,
            signature=sig,
            metadata=tampered_meta,
            expiration_date=tampered_exp,
        )
        assert is_tampered_valid is False

    def test_w3c_verifiable_credential_full_document_scope_and_tampering(self):
        """W3C Verifiable Credentials sign ENTIRE document (issuer, expiration, issuanceDate, credentialSubject)."""
        from app.services.microvm_evaluator_service import (
            microvm_evaluator_service,
            EvaluationResult,
            RubricBreakdown,
        )

        eval_result = EvaluationResult(
            evaluation_id="eval-w3c-full-scope",
            student_id=77,
            course_id="algerian-fintech-capstone",
            repo_url="https://github.com/student/fintech",
            commit_hash="c0ffee1234567890",
            rubric=RubricBreakdown(
                functional_tests_score=40.0,
                code_quality_lint_score=20.0,
                test_coverage_score=20.0,
                architecture_docs_score=20.0,
                total_score=100.0,
            ),
            passed=True,
            ast_fingerprint="ast-fingerprint-full-scope",
            test_logs=["[SANDBOX] Evaluated successfully."],
            executed_at="2026-10-18T12:00:00+00:00",
        )

        expiration = "2029-01-01T00:00:00+00:00"
        cred = microvm_evaluator_service.issue_verifiable_credential(
            student_id=77,
            student_name="Karim Belkacem",
            evaluation=eval_result,
            course_title="Algerian Sovereign FinTech Architecture",
            expiration_date=expiration,
        )

        # 1. Verify valid credential
        verify_ok = microvm_evaluator_service.verify_credential_proof(cred)
        assert verify_ok["is_valid"] is True
        assert verify_ok["cryptosuite"] == "eddsa-jcs-2022"
        assert verify_ok["scope"] == "FULL_DOCUMENT_RFC8785"
        assert verify_ok["expiration_date"] == expiration

        # 2. Tampering with issuer fails
        tampered_issuer = json.loads(json.dumps(cred))
        tampered_issuer["issuer"]["name"] = "Attacker Fake Authority"
        res_bad_issuer = microvm_evaluator_service.verify_credential_proof(
            tampered_issuer
        )
        assert res_bad_issuer["is_valid"] is False

        # 3. Tampering with expirationDate fails
        tampered_exp = json.loads(json.dumps(cred))
        tampered_exp["expirationDate"] = "2035-01-01T00:00:00+00:00"
        res_bad_exp = microvm_evaluator_service.verify_credential_proof(tampered_exp)
        assert res_bad_exp["is_valid"] is False

        # 4. Tampering with issuanceDate fails
        tampered_issuance = json.loads(json.dumps(cred))
        tampered_issuance["issuanceDate"] = "2020-01-01T00:00:00+00:00"
        res_bad_issuance = microvm_evaluator_service.verify_credential_proof(
            tampered_issuance
        )
        assert res_bad_issuance["is_valid"] is False

        # 5. Tampering with credentialSubject fails
        tampered_subj = json.loads(json.dumps(cred))
        tampered_subj["credentialSubject"]["name"] = "Impostor Student"
        res_bad_subj = microvm_evaluator_service.verify_credential_proof(tampered_subj)
        assert res_bad_subj["is_valid"] is False
