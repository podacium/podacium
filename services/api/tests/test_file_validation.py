"""
Tests for file upload validation service.
Covers: filename sanitization, extension blocking, size limits, MIME validation.

OWASP Top 10 (2021): A03 (Injection), A04 (Insecure Design)
CWE: CWE-22 (Path Traversal), CWE-434 (Unrestricted Upload), CWE-79 (XSS via Filename)
"""
from app.services.file_validation_service import (
    sanitize_filename,
    validate_file_extension,
    validate_magic_bytes,
    SIZE_LIMITS,
    ALLOWED_TYPES,
    BLOCKED_EXTENSIONS,
)


class TestFilenameSanitization:
    """Test filename sanitization logic."""

    def test_normal_filename(self):
        """Normal filenames should pass through."""
        assert sanitize_filename("photo.jpg") == "photo.jpg"

    def test_path_traversal(self):
        """Path traversal attempts should be stripped."""
        assert sanitize_filename("../../etc/passwd") == "passwd"
        assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == ".._.._windows_system32_cmd.exe"

    def test_null_bytes(self):
        """Null bytes should be removed."""
        result = sanitize_filename("file\x00.jpg")
        assert "\x00" not in result

    def test_special_characters(self):
        """Special characters should be replaced with underscores."""
        result = sanitize_filename('file<>:"/\\|?*.jpg')
        assert "<" not in result
        assert ">" not in result
        assert ":" not in result

    def test_empty_filename(self):
        """Empty filename should return default."""
        assert sanitize_filename("") == "unnamed_file"
        assert sanitize_filename(None) == "unnamed_file"

    def test_long_filename(self):
        """Very long filenames should be truncated."""
        long_name = "a" * 200 + ".jpg"
        result = sanitize_filename(long_name)
        assert len(result) <= 114  # 100 name + 4 ext + some buffer

    def test_unicode_filename(self):
        """Unicode filenames should be preserved."""
        result = sanitize_filename("مستند.pdf")
        assert result == "مستند.pdf"

    def test_hidden_file(self):
        """Hidden files (starting with .) should be preserved."""
        result = sanitize_filename(".gitignore")
        assert result == ".gitignore"


class TestExtensionValidation:
    """Test file extension blocking."""

    def test_allowed_extensions(self):
        """Common safe extensions should pass."""
        assert validate_file_extension("photo.jpg") is None
        assert validate_file_extension("document.pdf") is None
        assert validate_file_extension("data.csv") is None
        assert validate_file_extension("image.png") is None

    def test_blocked_extensions(self):
        """Dangerous extensions should be blocked."""
        assert validate_file_extension("virus.exe") is not None
        assert validate_file_extension("script.bat") is not None
        assert validate_file_extension("hack.php") is not None
        assert validate_file_extension("shell.sh") is not None
        assert validate_file_extension("payload.ps1") is not None

    def test_case_insensitive(self):
        """Extension check should be case-insensitive."""
        assert validate_file_extension("VIRUS.EXE") is not None
        assert validate_file_extension("Script.BAT") is not None

    def test_no_extension(self):
        """Files without extensions should pass."""
        assert validate_file_extension("README") is None

    def test_double_extension(self):
        """Double extensions should check the last one."""
        # .exe is the actual extension
        assert validate_file_extension("photo.jpg.exe") is not None


class TestMagicBytes:
    """Test magic byte validation."""

    def test_valid_jpeg(self):
        """JPEG magic bytes should validate correctly."""
        jpeg_header = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        assert validate_magic_bytes(jpeg_header, "image/jpeg") is True

    def test_valid_png(self):
        """PNG magic bytes should validate correctly."""
        png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        assert validate_magic_bytes(png_header, "image/png") is True

    def test_valid_pdf(self):
        """PDF magic bytes should validate correctly."""
        pdf_header = b"%PDF-1.4" + b"\x00" * 100
        assert validate_magic_bytes(pdf_header, "application/pdf") is True

    def test_mismatch_detected(self):
        """Mismatched magic bytes should be detected."""
        # JPEG header but claiming to be PNG
        jpeg_header = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        assert validate_magic_bytes(jpeg_header, "image/png") is False

    def test_unknown_format_passes(self):
        """Unknown formats should pass (benefit of the doubt)."""
        unknown_header = b"\x00\x01\x02\x03" + b"\x00" * 100
        assert validate_magic_bytes(unknown_header, "application/octet-stream") is True


class TestSizeLimits:
    """Test file size limit configuration."""

    def test_avatar_limit(self):
        """Avatar limit should be 5 MB."""
        assert SIZE_LIMITS["avatar"] == 5 * 1024 * 1024

    def test_dataset_limit(self):
        """Dataset limit should be 100 MB."""
        assert SIZE_LIMITS["dataset"] == 100 * 1024 * 1024

    def test_all_categories_have_limits(self):
        """All defined categories should have size limits."""
        for category in ALLOWED_TYPES:
            assert category in SIZE_LIMITS

    def test_blocked_extensions_comprehensive(self):
        """Blocked extensions list should include all dangerous types."""
        assert ".exe" in BLOCKED_EXTENSIONS
        assert ".php" in BLOCKED_EXTENSIONS
        assert ".sh" in BLOCKED_EXTENSIONS
        assert ".ps1" in BLOCKED_EXTENSIONS
        assert ".dll" in BLOCKED_EXTENSIONS
