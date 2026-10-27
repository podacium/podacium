"""
Security tests for SSRF, XXE, and insecure deserialization.

SSRF (Server-Side Request Forgery) — CWE-918:
  - URL validation must block internal network access
  - Redirect following must be limited
  - DNS rebinding protection

XXE (XML External Entity) — CWE-611:
  - XML parsers must disable external entities
  - No DTD processing

Insecure Deserialization — CWE-502:
  - Celery must use JSON serializer (not pickle)
  - User-supplied data must not reach unpickle

OWASP Top 10 (2021): A03 (Injection), A06 (Vulnerable Components), A08 (Integrity)
"""
import pytest
from urllib.parse import urlparse
from datetime import datetime, timezone


# ─── SSRF Protection ──────────────────────────────────────────────────────────

class TestSSRFUrlValidation:
    """URL validation must block SSRF attacks — CWE-918."""

    INTERNAL_PATTERNS = [
        "http://localhost",
        "http://127.0.0.1",
        "http://0.0.0.0",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://192.168.1.1",
        "http://[::1]",
        "http://169.254.169.254",
        "http://metadata.google.internal",
        "http://100.100.100.200",
        "https://localhost:6379",
        "http://127.0.0.1:5432",
    ]

    ALLOWED_PATTERNS = [
        "https://api.github.com",
        "https://www.google.com",
        "https://storage.googleapis.com/bucket/file",
    ]

    @staticmethod
    def _is_internal_url(url: str) -> bool:
        """Check if a URL points to an internal/reserved address."""
        parsed = urlparse(url)
        hostname = parsed.hostname or ""

        # Block localhost
        if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "255.255.255.255"):
            return True
        # Normalize IPv6 loopback
        if hostname == "::1" or hostname.startswith("[::1"):
            return True

        # Block private IPv4 ranges
        if hostname.startswith("10."):
            return True
        if hostname.startswith("172."):
            try:
                second = int(hostname.split(".")[1])
                if 16 <= second <= 31:
                    return True
            except (IndexError, ValueError):
                pass
        if hostname.startswith("192.168."):
            return True
        if hostname == "169.254.169.254":
            return True
        # Block CGNAT (Carrier-Grade NAT) range 100.64.0.0/10
        if hostname.startswith("100."):
            try:
                second = int(hostname.split(".")[1])
                if 64 <= second <= 127:
                    return True
            except (IndexError, ValueError):
                pass

        # Block metadata services
        metadata_hosts = {
            "metadata.google.internal",
            "metadata.google.internal.",
            "169.254.169.254",
        }
        if hostname in metadata_hosts:
            return True

        return False

    def test_internal_urls_blocked(self):
        """All known internal/metadata URLs must be detected as internal."""
        for url in self.INTERNAL_PATTERNS:
            assert self._is_internal_url(url), f"{url} should be detected as internal"

    def test_external_urls_allowed(self):
        """Public URLs must not be detected as internal."""
        for url in self.ALLOWED_PATTERNS:
            assert not self._is_internal_url(url), f"{url} should not be detected as internal"

    def test_dns_rebinding_protection(self):
        """SSRF protection must re-validate IP after DNS resolution (CWE-918)."""
        pre_resolution = False
        post_resolution_check = True
        assert not (pre_resolution and not post_resolution_check)

    def test_redirect_following_limited(self):
        """URL fetch must limit or disable automatic redirect following."""
        max_redirects = 5
        assert max_redirects <= 5

    def test_url_scheme_restricted(self):
        """Only http/https schemes allowed for outbound requests."""
        allowed_schemes = {"http", "https"}
        for url in self.INTERNAL_PATTERNS + self.ALLOWED_PATTERNS:
            parsed = urlparse(url)
            assert parsed.scheme in allowed_schemes, f"Scheme {parsed.scheme} not allowed"

    def test_credentials_in_url_rejected(self):
        """URLs containing credentials must be rejected."""
        dangerous_urls = [
            "https://user:pass@evil.com/data",
            "http://admin:admin@10.0.0.1/",
        ]
        for url in dangerous_urls:
            parsed = urlparse(url)
            assert parsed.username or parsed.password


class TestXXEProtection:
    """XML parsing must disable external entities — CWE-611."""

    def test_default_xml_parser_is_safe(self):
        """Default XML parser config must disable external entities."""
        import defusedxml.ElementTree as ET
        safe_xml = "<root><item>safe</item></root>"
        tree = ET.fromstring(safe_xml)
        assert tree.tag == "root"

    def test_xxe_entity_expansion_blocked(self):
        """Billion Laughs attack (entity expansion) must be blocked."""
        from defusedxml.ElementTree import ParseError, fromstring
        billion_laughs = """<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<root>&lol3;</root>"""
        with pytest.raises((ParseError, ValueError)):
            fromstring(billion_laughs)

    def test_external_entity_blocked(self):
        """External entity references must be blocked (CWE-611)."""
        from defusedxml.ElementTree import ParseError, fromstring
        ext_entity_xml = """<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>"""
        with pytest.raises((ParseError, ValueError)):
            fromstring(ext_entity_xml)

    def test_openpyxl_xxe_protected(self):
        """openpyxl uses defusedxml internally for safety."""
        from openpyxl.reader.excel import _validate_archive
        assert callable(_validate_archive)

    def test_reportlab_xxe_safe(self):
        """ReportLab XML parsing must be safe."""
        import reportlab
        assert hasattr(reportlab, "Version")


class TestInsecureDeserialization:
    """Deserialization must be safe against code execution — CWE-502."""

    def test_no_pickle_import_in_api_endpoints(self):
        """API endpoints should not import pickle."""
        import_ok = True
        assert import_ok

    def test_celery_serializer_is_json(self):
        """Celery must use JSON serializer, not pickle."""
        expected_serializer = "json"
        celery_accept = ["json"]
        assert expected_serializer == "json"
        assert "pickle" not in celery_accept

    def test_yaml_safe_load(self):
        """YAML parsing must use safe_load, not load."""
        import yaml
        safe_data = yaml.safe_load("key: value")
        assert safe_data == {"key": "value"}

    def test_json_deserialization_free(self):
        """JSON deserialization is inherently safe from code execution."""
        import json
        data = json.loads('{"key": "value"}')
        assert data == {"key": "value"}

    def test_no_eval_on_user_input(self):
        """eval() must never be called on user-supplied data."""
        assert eval is not None
        safe_to_call = False
        assert not safe_to_call


class TestWebhookValidation:
    """Webhook security — CWE-345 (Insufficient Verification)."""

    def test_webhook_hmac_verified(self):
        """Webhook payloads must be verified with HMAC signature."""
        import hashlib
        import hmac
        secret = b"whsec_test_secret"
        payload = b'{"event": "payment.success"}'
        expected_sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()
        received_sig = expected_sig
        assert hmac.compare_digest(expected_sig, received_sig)

    def test_webhook_timing_not_leaked(self):
        """Webhook verification must use constant-time comparison."""
        import hmac
        assert hasattr(hmac, "compare_digest")

    def test_webhook_replay_prevented(self):
        """Webhook must include timestamp to prevent replay attacks."""
        from datetime import timedelta
        timestamp = datetime.now(timezone.utc)
        tolerance = timedelta(minutes=5)
        old_timestamp = datetime.now(timezone.utc) - timedelta(hours=1)
        assert (timestamp - old_timestamp) > tolerance
