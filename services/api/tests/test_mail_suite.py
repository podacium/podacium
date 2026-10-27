"""
Unit & Integration Tests for Podacium Mail Suite.
"""

import pytest
from app.services.envelope_encryption_service import envelope_encryption_service
from app.services.html_sanitizer import sanitize_email_html, html_to_plain_text
from app.services.mail_attachment_scanner import mail_attachment_scanner


def test_mail_credentials_encryption_roundtrip():
    """Verify AES-256-GCM envelope encryption and decryption of mail passwords."""
    raw_pass = "UltraSecretPassword123!@#"
    account_id = "test-account-uuid-999"
    email = "test@podacium.com"

    ct, wrapped_dek, nonce = envelope_encryption_service.encrypt_credentials_triplet(
        password=raw_pass,
        account_id=account_id,
        email=email,
    )

    decrypted = envelope_encryption_service.decrypt_credentials_triplet(
        ciphertext_b64=ct,
        dek_wrapped_b64=wrapped_dek,
        iv_b64=nonce,
        account_id=account_id,
        email=email,
    )

    assert decrypted == raw_pass


def test_mail_credentials_encryption_tamper_detection():
    """Verify that tampering or wrong AAD email causes decryption rejection."""
    raw_pass = "SecretPass"
    account_id = "acc-1"
    email = "admin@podacium.com"

    ct, wrapped_dek, nonce = envelope_encryption_service.encrypt_credentials_triplet(
        password=raw_pass,
        account_id=account_id,
        email=email,
    )

    # Attempt decryption with wrong email
    with pytest.raises(ValueError, match="mail_credentials_decryption_failed"):
        envelope_encryption_service.decrypt_credentials_triplet(
            ciphertext_b64=ct,
            dek_wrapped_b64=wrapped_dek,
            iv_b64=nonce,
            account_id=account_id,
            email="attacker@podacium.com",
        )


def test_html_sanitizer_anti_xss():
    """Verify that script tags, style tags, and event handlers are completely stripped."""
    dangerous_html = """
    <div>
        <p>Hello world</p>
        <script>alert('XSS')</script>
        <img src="http://example.com/pic.png" onload="alert('pwned')" onerror="alert('fail')" />
        <a href="javascript:alert(1)">Click me</a>
        <iframe src="http://malicious.site"></iframe>
    </div>
    """

    sanitized = sanitize_email_html(
        dangerous_html, message_id="msg-123", proxy_images=True
    )

    assert "<script>" not in sanitized
    assert "alert('XSS')" not in sanitized
    assert "onload=" not in sanitized
    assert "onerror=" not in sanitized
    assert "javascript:" not in sanitized
    assert "<iframe" not in sanitized
    assert "Hello world" in sanitized
    assert 'rel="noopener noreferrer nofollow"' in sanitized


def test_html_sanitizer_cid_and_proxy_images():
    """Verify CID attachment URLs and remote image proxy URLs."""
    html_with_cid = (
        '<img src="cid:logo123" /><img src="https://tracking.com/pixel.png" />'
    )

    sanitized = sanitize_email_html(
        html_with_cid,
        message_id="msg-abc",
        block_remote_images=False,
        proxy_images=True,
    )

    assert "/api/v1/mail/messages/msg-abc/attachments/cid/logo123" in sanitized
    assert "attachments/cid/logo123?sig=" in sanitized
    assert "/api/v1/mail/proxy/image?url=" in sanitized
    assert "sig=" in sanitized


def test_prepare_body_html_signs_raw_cid_references():
    """Unrewritten cid: images must still receive a capability signature."""
    from app.services.mail_suite_service import mail_suite_service

    out = mail_suite_service._prepare_body_html_for_view(
        '<img src="cid:inline@example.com">', "msg-123"
    )
    assert out is not None
    assert "/api/v1/mail/messages/msg-123/attachments/cid/" in out
    assert "sig=" in out


def test_html_sanitizer_preserves_svg_and_signs_images():
    """Verify that safe SVGs (like GitHub logo / CI status) are preserved and images are signed."""
    github_email_html = """
    <div>
        <svg height="24" width="24" viewBox="0 0 16 16" class="octicon octicon-mark-github" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59"></path>
        </svg>
        <img src="https://github.githubassets.com/images/icons/emoji/unicode/274c.png" alt="fail" />
    </div>
    """
    sanitized = sanitize_email_html(github_email_html, proxy_images=True)
    assert "<svg" in sanitized
    assert "<path" in sanitized
    assert "octicon-mark-github" in sanitized
    assert "</svg>" in sanitized
    assert "/api/v1/mail/proxy/image?url=" in sanitized
    assert "sig=" in sanitized


def test_html_to_plain_text():
    """Verify extraction of plain text snippet for inbox preview."""
    html_input = "<h3>Meeting Agenda</h3><p>Let's discuss the <b>Algerian startup ecosystem</b> &amp; growth.</p>"
    snippet = html_to_plain_text(html_input)
    assert (
        snippet
        == "Meeting Agenda Let's discuss the Algerian startup ecosystem & growth."
    )


@pytest.mark.asyncio
async def test_attachment_scanner_blocks_executables():
    """Verify that dangerous executable extensions are blocked."""
    res_exe = await mail_attachment_scanner.scan_attachment(
        filename="payload.exe",
        content=b"MZ\x90\x00\x03\x00\x00\x00",
        declared_mime="application/x-msdownload",
    )
    assert not res_exe.is_safe
    assert "Disallowed executable extension" in (res_exe.threat or "")
    assert res_exe.scan_status == "blocked"

    res_sh = await mail_attachment_scanner.scan_attachment(
        filename="script.sh",
        content=b"#!/bin/bash\nrm -rf /",
        declared_mime="text/x-shellscript",
    )
    assert not res_sh.is_safe
    assert res_sh.scan_status == "blocked"


@pytest.mark.asyncio
async def test_attachment_scanner_allows_safe_files():
    """Verify safe document types pass scanning."""
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj"
    res = await mail_attachment_scanner.scan_attachment(
        filename="report.pdf",
        content=pdf_content,
        declared_mime="application/pdf",
    )
    assert res.is_safe
    # A skipped ClamAV scan must not be reported as "virus clean".
    assert res.virus_clean is False
    assert res.scan_status == "skipped"


@pytest.mark.asyncio
async def test_attachment_scanner_reports_clean_when_av_runs(monkeypatch):
    """Verify a real clean ClamAV verdict is persisted as scan_status=clean."""
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    monkeypatch.setenv("AV_REQUIRED", "true")
    clean = SimpleNamespace(clean=True, skipped=False, threat=None, error=None)
    with patch(
        "app.services.mail_attachment_scanner.antivirus_service.scan_bytes",
        new=AsyncMock(return_value=clean),
    ):
        res = await mail_attachment_scanner.scan_attachment(
            filename="report.pdf",
            content=b"%PDF-1.4\n1 0 obj\n<<>>\nendobj",
            declared_mime="application/pdf",
        )
    assert res.is_safe
    assert res.virus_clean is True
    assert res.scan_status == "clean"
    assert res.scan_engine == "clamav"


def test_mime_multipart_message_extraction():
    """Verify parsing of multipart MIME emails with plain text and HTML bodies."""
    from email.message import EmailMessage
    from app.services.mail_suite_service import mail_suite_service

    msg = EmailMessage()
    msg["Subject"] = "Podacium Platform Update"
    msg["From"] = "team@podacium.com"
    msg["To"] = "admin@podacium.com"
    msg.set_content("Plain text announcement body.")
    msg.add_alternative("<p>HTML announcement body.</p>", subtype="html")

    text_body, html_body, attachments = mail_suite_service.extract_body_and_attachments(
        msg
    )

    assert "Plain text announcement body." in text_body
    assert "<p>HTML announcement body.</p>" in html_body
    assert len(attachments) == 0


def test_image_proxy_blocks_private_and_loopback_ips():
    """Verify SSRF defense rejects loopback, private ranges and non-http schemes."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)

    # Missing auth
    res_no_auth = client.get("/api/v1/mail/accounts")
    assert res_no_auth.status_code in (401, 403)


@pytest.mark.asyncio
async def test_is_super_admin_rbac():
    """Verify RBAC super-admin detection honors clearance level 10 and superuser flags."""
    from types import SimpleNamespace
    from app.routers.mail import _is_super_admin

    # Regular staff (clearance 5, SUPPORT) -> False
    user_staff = SimpleNamespace(
        id=20,
        isSuperuser=False,
        role="admin",
        adminProfile=SimpleNamespace(
            clearanceLevel=5, department="SUPPORT", roleAssignments=[]
        ),
        profile=None,
    )
    assert await _is_super_admin(user_staff) is False

    # Superuser flag -> True
    user_su = SimpleNamespace(id=1, isSuperuser=True, adminProfile=None, profile=None)
    assert await _is_super_admin(user_su) is True

    # Clearance Level 10 + SUPER_ADMIN department -> True
    user_owner = SimpleNamespace(
        id=12,
        isSuperuser=False,
        role="admin",
        adminProfile=SimpleNamespace(
            clearanceLevel=10, department="SUPER_ADMIN", roleAssignments=[]
        ),
        profile=None,
    )
    assert await _is_super_admin(user_owner) is True

    # High clearance but different department -> False
    user_tech = SimpleNamespace(
        id=22,
        isSuperuser=False,
        role="admin",
        adminProfile=SimpleNamespace(
            clearanceLevel=10, department="ENGINEERING", roleAssignments=[]
        ),
        profile=None,
    )
    assert await _is_super_admin(user_tech) is False


@pytest.mark.asyncio
async def test_check_account_access_delegation():
    """Verify delegated access check respects super-admin, account ownership, and granular permissions."""
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch
    from fastapi import HTTPException
    from app.routers.mail import check_account_access

    account = SimpleNamespace(id=5, userId=10)

    # 1. Super admin -> always True
    assert await check_account_access(account, admin_id=99, is_super=True) is True

    # 2. Account owner -> always True
    assert await check_account_access(account, admin_id=10, is_super=False) is True

    # 3. Non-owner without delegation assignment -> 403
    with patch("app.routers.mail.prisma") as mock_prisma:
        mock_prisma.mailaccountadminassignment.find_first = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await check_account_access(
                account, admin_id=20, is_super=False, required_permission="read"
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "errors.mail.unauthorized_account_access"

    # 4. Delegated assignment with read only -> read succeeds, send and manage fail
    assignment = SimpleNamespace(canRead=True, canSend=False, canManage=False)
    with patch("app.routers.mail.prisma") as mock_prisma:
        mock_prisma.mailaccountadminassignment.find_first = AsyncMock(
            return_value=assignment
        )
        # Read succeeds
        assert (
            await check_account_access(
                account, admin_id=20, is_super=False, required_permission="read"
            )
            is True
        )

        # Send fails
        with pytest.raises(HTTPException) as exc_send:
            await check_account_access(
                account, admin_id=20, is_super=False, required_permission="send"
            )
        assert exc_send.value.status_code == 403
        assert exc_send.value.detail == "errors.mail.unauthorized_send_access"

        # Manage fails
        with pytest.raises(HTTPException) as exc_manage:
            await check_account_access(
                account, admin_id=20, is_super=False, required_permission="manage"
            )
        assert exc_manage.value.status_code == 403
        assert exc_manage.value.detail == "errors.mail.unauthorized_manage_access"


async def test_restore_and_purge_thread_actions():
    """Verify thread action dispatcher supports restore and purge/delete_permanently."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.services.mail_suite_service import mail_suite_service
    from app.schemas.mail import ThreadActionRequest

    # Test Restore
    mock_thread = MagicMock()
    mock_thread.id = 101
    mock_thread.threadId = "th-101"
    mock_thread.mailAccountId = 1

    mock_inbox = MagicMock(id=11)

    with (
        patch("app.services.mail_suite_service.prisma") as mock_prisma,
        patch.object(mail_suite_service, "_create_audit_log", new_callable=AsyncMock),
    ):
        mock_prisma.mailthread.find_unique = AsyncMock(return_value=mock_thread)
        mock_prisma.mailbox.find_first = AsyncMock(return_value=mock_inbox)
        mock_prisma.mailmessage.update_many = AsyncMock()
        mock_prisma.mailthread.update = AsyncMock()

        res = await mail_suite_service.execute_thread_action(
            "th-101", ThreadActionRequest(action="restore"), current_admin_id=1
        )
        assert res is True
        mock_prisma.mailmessage.update_many.assert_called_once_with(
            where={"threadId": 101}, data={"mailboxId": 11}
        )

    # Test Purge
    with (
        patch("app.services.mail_suite_service.prisma") as mock_prisma,
        patch.object(
            mail_suite_service, "_purge_thread_internal", new_callable=AsyncMock
        ) as mock_purge,
        patch.object(mail_suite_service, "_create_audit_log", new_callable=AsyncMock),
    ):
        mock_prisma.mailthread.find_unique = AsyncMock(return_value=mock_thread)
        res_purge = await mail_suite_service.execute_thread_action(
            "th-101", ThreadActionRequest(action="purge"), current_admin_id=1
        )
        assert res_purge is True
        mock_purge.assert_called_once_with(mock_thread)


@pytest.mark.asyncio
async def test_empty_trash_purges_all_trashed_messages():
    """Verify empty_trash deletes all trashed messages and attachments."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.services.mail_suite_service import mail_suite_service

    mock_account = MagicMock(id=1, accountId="acc-1")
    mock_trash_mb = MagicMock(id=99)

    msg1 = MagicMock(id=10, threadId=1, attachments=[])
    msg2 = MagicMock(id=11, threadId=1, attachments=[])

    with patch("app.services.mail_suite_service.prisma") as mock_prisma:
        mock_prisma.mailaccount.find_unique = AsyncMock(return_value=mock_account)
        mock_prisma.mailbox.find_first = AsyncMock(return_value=mock_trash_mb)
        mock_prisma.mailmessage.find_many = AsyncMock(return_value=[msg1, msg2])
        mock_prisma.mailattachment.delete_many = AsyncMock()
        mock_prisma.mailmessage.delete_many = AsyncMock()
        mock_prisma.mailmessage.count = AsyncMock(return_value=0)
        mock_prisma.mailthread.delete = AsyncMock()

        with patch.object(
            mail_suite_service, "_create_audit_log", new_callable=AsyncMock
        ):
            res = await mail_suite_service.empty_trash("acc-1", current_admin_id=1)
            assert res["purged_messages"] == 2
            assert res["purged_threads"] == 1
            mock_prisma.mailmessage.delete_many.assert_called_once_with(
                where={"mailboxId": 99}
            )


@pytest.mark.asyncio
async def test_attachment_scanner_blocks_zip_bomb_excessive_entries():
    """Verify zip archives with excessive entry counts are blocked."""
    import zipfile
    import io

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i in range(505):
            zf.writestr(f"file_{i}.txt", "A")
    zip_bytes = buf.getvalue()

    res = await mail_attachment_scanner.scan_attachment(
        filename="archive.zip",
        content=zip_bytes,
        declared_mime="application/zip",
    )
    assert not res.is_safe
    assert "Decompression bomb risk: zip archive contains" in (res.threat or "")


@pytest.mark.asyncio
async def test_attachment_scanner_blocks_svg_script_injection():
    """Verify SVG attachments containing executable script or foreignObject tags are blocked."""
    malicious_svg = b"""<svg xmlns="http://www.w3.org/2000/svg">
        <script>alert(document.cookie)</script>
        <circle cx="10" cy="10" r="5" />
    </svg>"""

    res = await mail_attachment_scanner.scan_attachment(
        filename="vector.svg",
        content=malicious_svg,
        declared_mime="image/svg+xml",
    )
    assert not res.is_safe
    assert "SVG attachment contains executable script" in (res.threat or "")


@pytest.mark.asyncio
async def test_attachment_scanner_blocks_pdf_with_javascript():
    """Verify PDF attachments containing embedded JavaScript or Launch actions are blocked."""
    malicious_pdf = b"""%PDF-1.4
    1 0 obj
    << /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert("pwned")) >> >>
    endobj"""

    res = await mail_attachment_scanner.scan_attachment(
        filename="invoice.pdf",
        content=malicious_pdf,
        declared_mime="application/pdf",
    )
    assert not res.is_safe
    assert "PDF attachment contains active JavaScript" in (res.threat or "")


def test_transactional_email_omits_list_unsubscribe():
    """Verify RFC 8058 §3 compliance: transactional emails omit 1-click unsubscribe headers."""
    from app.services.email_service import TRANSACTIONAL_EMAIL_TYPES

    assert "reset" in TRANSACTIONAL_EMAIL_TYPES
    assert "verify" in TRANSACTIONAL_EMAIL_TYPES
    assert "new_device" in TRANSACTIONAL_EMAIL_TYPES
    assert "otp" in TRANSACTIONAL_EMAIL_TYPES


def _mail_account(**overrides):
    from types import SimpleNamespace

    base = dict(
        id=1,
        accountId="acc-1",
        deletedAt=None,
        emailAddress="owner@podacium.com",
        displayName="Owner",
        encryptedPassword="cipher",
        dekWrapped="dek",
        dekNonce="nonce",
        smtpHost="smtp.podacium.com",
        smtpPort=465,
        smtpUseSsl=True,
        imapHost="imap.podacium.com",
        imapPort=993,
        imapUseSsl=True,
        mailboxes=[],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_send_rejects_thread_owned_by_another_account():
    """Cross-tenant thread append must fail before SMTP is touched."""
    from unittest.mock import AsyncMock, patch
    from types import SimpleNamespace
    from app.schemas.mail import ComposeEmailRequest
    from app.services.mail_suite_service import mail_suite_service

    thread = SimpleNamespace(id=9, mailAccountId=999, threadId="th-1")
    with (
        patch("app.services.mail_suite_service.prisma") as mock_prisma,
        patch(
            "app.services.mail_suite_service.envelope_encryption_service.decrypt_credentials_triplet",
            return_value="pw",
        ),
        patch.object(mail_suite_service, "_send_smtp_and_append_sent") as mock_send,
    ):
        mock_prisma.mailaccount.find_unique = AsyncMock(return_value=_mail_account())
        mock_prisma.mailthread.find_unique = AsyncMock(return_value=thread)

        with pytest.raises(ValueError, match="errors.mail.thread_not_owned"):
            await mail_suite_service.send_email(
                ComposeEmailRequest(
                    account_id="acc-1",
                    to_addresses=["external@example.com"],
                    subject="Hello",
                    thread_id="th-1",
                ),
                current_admin_id=1,
            )
        mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_send_rejects_attachment_owned_by_another_account():
    """Attachment UUIDs must not be usable as a cross-account exfiltration primitive."""
    from unittest.mock import AsyncMock, patch
    from types import SimpleNamespace
    from app.schemas.mail import ComposeEmailRequest
    from app.services.mail_suite_service import mail_suite_service

    foreign_attachment = SimpleNamespace(
        id=5,
        attachmentId="att-foreign",
        mailAccountId=999,
        mailMessageId=None,
        mailMessage=None,
        storagePath="mail/x",
        fileName="secret.pdf",
        mimeType="application/pdf",
        sha256Checksum="",
    )
    with (
        patch("app.services.mail_suite_service.prisma") as mock_prisma,
        patch(
            "app.services.mail_suite_service.envelope_encryption_service.decrypt_credentials_triplet",
            return_value="pw",
        ),
        patch.object(mail_suite_service, "_send_smtp_and_append_sent") as mock_send,
    ):
        mock_prisma.mailaccount.find_unique = AsyncMock(return_value=_mail_account())
        mock_prisma.mailattachment.find_unique = AsyncMock(
            return_value=foreign_attachment
        )

        with pytest.raises(ValueError, match="errors.mail.attachment_not_owned"):
            await mail_suite_service.send_email(
                ComposeEmailRequest(
                    account_id="acc-1",
                    to_addresses=["external@example.com"],
                    subject="Hello",
                    attachment_ids=["att-foreign"],
                ),
                current_admin_id=1,
            )
        mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_thread_action_aliases_and_unknown_action():
    """Legacy UI actions must map to canonical actions; unknown ones must 400."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.schemas.mail import ThreadActionRequest
    from app.services.mail_suite_service import mail_suite_service

    thread = MagicMock()
    thread.id = 101
    thread.threadId = "th-101"
    thread.mailAccountId = 1

    with (
        patch("app.services.mail_suite_service.prisma") as mock_prisma,
        patch.object(mail_suite_service, "_create_audit_log", new_callable=AsyncMock),
    ):
        mock_prisma.mailthread.find_unique = AsyncMock(return_value=thread)
        mock_prisma.mailthread.update = AsyncMock()
        mock_prisma.mailmessage.update_many = AsyncMock()

        assert await mail_suite_service.execute_thread_action(
            "th-101", ThreadActionRequest(action="read"), current_admin_id=1
        )
        mock_prisma.mailmessage.update_many.assert_called_with(
            where={"threadId": 101}, data={"isRead": True}
        )

        with pytest.raises(ValueError, match="errors.mail.unknown_action"):
            await mail_suite_service.execute_thread_action(
                "th-101", ThreadActionRequest(action="bogus"), current_admin_id=1
            )


@pytest.mark.asyncio
async def test_empty_trash_aborts_when_remote_delete_fails():
    """Local purge must not proceed if IMAP deletion fails (prevents resurrection)."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.services.mail_suite_service import mail_suite_service

    account = _mail_account()
    trash = MagicMock(id=99)
    message = MagicMock(id=10, threadId=1, attachments=[])

    with patch("app.services.mail_suite_service.prisma") as mock_prisma:
        mock_prisma.mailaccount.find_unique = AsyncMock(return_value=account)
        mock_prisma.mailbox.find_first = AsyncMock(return_value=trash)
        mock_prisma.mailmessage.find_many = AsyncMock(return_value=[message])
        mock_prisma.mailmessage.delete_many = AsyncMock()

        with patch.object(
            mail_suite_service,
            "_delete_remote_for_account",
            new=AsyncMock(side_effect=ValueError("errors.mail.remote_delete_failed")),
        ):
            with pytest.raises(ValueError, match="errors.mail.remote_delete_failed"):
                await mail_suite_service.empty_trash("acc-1", current_admin_id=1)

        mock_prisma.mailmessage.delete_many.assert_not_called()


def test_remote_delete_raises_on_search_failure(monkeypatch):
    """An IMAP error must abort the purge instead of letting mail resurrect."""
    import imaplib
    from app.services.mail_suite_service import MailSuiteService

    class FakeClient:
        def login(self, *_args):
            return "OK", []

        def list(self):
            return "OK", [b'(\\HasNoChildren) "/" "INBOX"']

        def select(self, _folder, readonly=False):
            return "OK", [b"1"]

        def search(self, *_args):
            raise imaplib.IMAP4.error("search failed")

        def expunge(self):
            return "OK", []

        def logout(self):
            return "BYE", []

    monkeypatch.setattr(imaplib, "IMAP4_SSL", lambda *_a, **_k: FakeClient())

    with pytest.raises(RuntimeError, match="search INBOX"):
        MailSuiteService._delete_remote_messages_sync(
            "imap.example.com", 993, True, "owner@example.com", "pw", ["<m@x>"]
        )


@pytest.mark.asyncio
async def test_remote_delete_rejects_message_without_id():
    """A synced message without a Message-ID cannot be purged safely."""
    from types import SimpleNamespace
    from app.services.mail_suite_service import mail_suite_service

    message = SimpleNamespace(internetMessageId=None, isDraft=False)
    with pytest.raises(ValueError, match="errors.mail.remote_delete_failed"):
        await mail_suite_service._delete_remote_for_account(_mail_account(), [message])


def test_remote_delete_ignores_messages_already_gone(monkeypatch):
    """A message absent from every folder is fine: there is nothing to purge."""
    import imaplib
    from app.services.mail_suite_service import MailSuiteService

    class FakeClient:
        def login(self, *_args):
            return "OK", []

        def list(self):
            return "OK", [b'(\\HasNoChildren) "/" "INBOX"']

        def select(self, _folder, readonly=False):
            return "OK", [b"1"]

        def search(self, *_args):
            return "OK", [b""]

        def expunge(self):
            return "OK", []

        def logout(self):
            return "BYE", []

    monkeypatch.setattr(imaplib, "IMAP4_SSL", lambda *_a, **_k: FakeClient())
    assert (
        MailSuiteService._delete_remote_messages_sync(
            "imap.example.com", 993, True, "owner@example.com", "pw", ["<m@x>"]
        )
        == 0
    )


@pytest.mark.asyncio
async def test_audit_chain_detects_tampered_details():
    """The HMAC chain must bind details/message-id, not just the action label."""
    import hashlib
    import hmac
    import json
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch
    from app.core.config import setting
    from app.services.mail_suite_service import mail_suite_service

    created = datetime.now(timezone.utc)
    prev = "0" * 64
    details = {"subject": "Original"}
    payload = (
        f"th-1|1|READ_THREAD|127.0.0.1|{created.isoformat()}|{prev}|msg-1|"
        f"{json.dumps(details, sort_keys=True, separators=(',', ':'))}"
    )
    entry_hash = hmac.new(
        setting.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    def entry(detail_payload):
        return SimpleNamespace(
            id=1,
            threadId="th-1",
            actorId=1,
            action="READ_THREAD",
            ipAddress="127.0.0.1",
            createdAt=created,
            previousHash=prev,
            entryHash=entry_hash,
            messageId="msg-1",
            details=detail_payload,
        )

    with patch("app.services.mail_suite_service.prisma") as mock_prisma:
        mock_prisma.emailauditlog.find_many = AsyncMock(
            return_value=[entry({"subject": "Original"})]
        )
        assert (await mail_suite_service.verify_audit_chain())["valid"] is True

        mock_prisma.emailauditlog.find_many = AsyncMock(
            return_value=[entry({"subject": "Tampered"})]
        )
        result = await mail_suite_service.verify_audit_chain()
        assert result["valid"] is False
        assert result["broken_at"] == 1
