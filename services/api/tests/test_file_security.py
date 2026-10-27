import io
import zipfile
import pytest
import pandas as pd
from fastapi import HTTPException

from app.services.file_validator import (
    validate_file_content,
    detect_mime_type,
    detect_malicious_content,
    validate_zip_archive,
)
from app.services.file_service import (
    sanitize_filename,
    get_safe_extension,
)
from app.services.bi_services.ingestion_service import IngestionService


def test_valid_image_and_document_magic_bytes():
    # PNG
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    assert detect_mime_type(png_bytes) == "image/png"
    res = validate_file_content(png_bytes, category="avatars")
    assert res.is_valid is True

    # JPEG
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    assert detect_mime_type(jpeg_bytes) == "image/jpeg"
    res = validate_file_content(jpeg_bytes, category="avatars")
    assert res.is_valid is True

    # PDF
    pdf_bytes = b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n"
    assert detect_mime_type(pdf_bytes) == "application/pdf"
    res = validate_file_content(pdf_bytes, category="certificates")
    assert res.is_valid is True


def test_reject_dangerous_executables():
    # Windows PE / EXE
    pe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    assert detect_malicious_content(pe_bytes) is not None

    # Linux ELF
    elf_bytes = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    assert detect_malicious_content(elf_bytes) is not None

    # Shell Shebang
    sh_bytes = b"#!/bin/bash\nrm -rf /\n"
    assert detect_malicious_content(sh_bytes) is not None


def test_polyglot_rejection_in_binary_files():
    # PNG with embedded PHP payload
    polyglot_png = b"\x89PNG\r\n\x1a\n<?php system($_GET['cmd']); ?>"
    res = validate_file_content(polyglot_png, category="avatars")
    assert res.is_valid is False
    assert "Embedded script pattern" in res.error

    # JPEG with embedded script tag
    polyglot_jpeg = b"\xff\xd8\xff\xe0<script>alert(1)</script>"
    res = validate_file_content(polyglot_jpeg, category="avatars")
    assert res.is_valid is False
    assert "Embedded script pattern" in res.error


def test_zip_archive_security_traversal_and_bomb():
    # Safe Zip
    safe_buf = io.BytesIO()
    with zipfile.ZipFile(safe_buf, "w") as zf:
        zf.writestr("test.txt", "hello world")
    safe_data = safe_buf.getvalue()

    is_valid, err = validate_zip_archive(safe_data)
    assert is_valid is True
    assert err is None

    # Path traversal Zip
    evil_buf = io.BytesIO()
    with zipfile.ZipFile(evil_buf, "w") as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0:::")
    evil_data = evil_buf.getvalue()

    is_valid, err = validate_zip_archive(evil_data)
    assert is_valid is False
    assert "Path traversal attempt" in err

    # Zip bomb check (massive compression ratio)
    bomb_buf = io.BytesIO()
    with zipfile.ZipFile(bomb_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "zeros.bin", b"\x00" * (15 * 1024 * 1024)
        )  # 15 MB of zeros compresses to ~15 KB
    bomb_data = bomb_buf.getvalue()

    is_valid, err = validate_zip_archive(bomb_data, max_ratio=50.0)
    assert is_valid is False
    assert "Suspicious compression ratio" in err


def test_filename_sanitization_and_extension_hardening():
    # Null bytes & directory traversal in filenames
    dirty_name = "../../../etc/passwd\x00.png"
    clean = sanitize_filename(dirty_name)
    assert "\x00" not in clean
    assert "/" not in clean
    assert "\\" not in clean

    # Dangerous double extension rejection
    with pytest.raises(HTTPException) as exc:
        get_safe_extension("exploit.php.png", "image/png")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        get_safe_extension("invoice.exe.pdf", "application/pdf")
    assert exc.value.status_code == 400

    # Canonical safe extension
    safe_ext = get_safe_extension("my_photo.jpg", "image/png")
    assert safe_ext == ".png"


def test_csv_formula_injection_defense():
    df = pd.DataFrame(
        {
            "name": ["Alice", "=CMD|' /C calc'!A0", "@SUM(1+1)", "-10.5", "+50"],
            "score": [100, 200, 300, -10.5, 50],
        }
    )

    cleaned = IngestionService._clean_dataframe(df)

    # Malicious formula strings should be neutralized by prepending single quote
    assert cleaned["name"].iloc[1] == "'=CMD|' /C calc'!A0"
    assert cleaned["name"].iloc[2] == "'@SUM(1+1)"
    # Pure numbers (e.g. "-10.5", "+50") should remain valid numbers
    assert float(cleaned["name"].iloc[3]) == -10.5
    assert float(cleaned["name"].iloc[4]) == 50.0
