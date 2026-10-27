# ADR-006: File Upload Security

## Status
Accepted

## Context
The platform accepts file uploads for avatars, course thumbnails, certificates, datasets, and invoices. Without proper validation, uploaded files could be used for:
- Remote code execution (uploading .php, .exe, .sh files)
- XSS attacks (uploading HTML/SVG with embedded scripts)
- Storage abuse (uploading extremely large files)
- MIME type spoofing (renaming malware to .jpg)

## Decision
Implement multi-layer file upload validation:

1. **Extension blocking** — Reject known dangerous extensions (.exe, .php, .sh, .ps1, etc.)
2. **MIME type validation** — Only allow expected MIME types per upload category
3. **Magic byte verification** — Verify file content matches claimed MIME type
4. **Per-category size limits** — Different limits for avatars (5MB) vs datasets (100MB)
5. **Filename sanitization** — Strip path traversal, null bytes, special characters

## Implementation
- `services/api/app/services/file_validation_service.py`
- Called before any file is saved to disk or uploaded to S3
- Returns (is_valid, error_message) tuple

## Category Limits

| Category | Max Size | Allowed Types |
|----------|----------|---------------|
| Avatar | 5 MB | JPEG, PNG, WebP, GIF |
| Course Thumbnail | 10 MB | JPEG, PNG, WebP |
| Certificate | 20 MB | PDF, PNG, JPEG |
| Dataset | 100 MB | CSV, JSON, XLSX |
| Invoice | 10 MB | PDF |

## Consequences
- **Positive**: Prevents malicious file uploads
- **Positive**: Reduces storage abuse
- **Positive**: Magic byte check catches MIME spoofing
- **Negative**: Slightly slower uploads (must read file header)
- **Negative**: May reject legitimate files with unusual MIME types
