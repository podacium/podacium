"""Email service for Podacium — SMTP delivery layer with robust error handling,
rate limiting, delivery auditing, and connection management.

Template rendering is delegated to email_templates.py.
"""

import smtplib
import asyncio
import time
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from email.utils import formataddr, formatdate, make_msgid
from app.core.config import setting
import logging
import random
from typing import Optional, Dict
from datetime import datetime, timezone

from app.services.email_templates import render_email

logger = logging.getLogger(__name__)

# RFC 8058 §3 compliance: 1-Click unsubscribe MUST NOT be applied to transactional/security emails
TRANSACTIONAL_EMAIL_TYPES = {
    "verify",
    "reset",
    "new_device",
    "password_changed",
    "email_changed",
    "otp",
    "2fa",
    "invoice",
    "receipt",
    "contract",
    "security_alert",
    "dispute",
    "account_locked",
    "login_alert",
}


# ─── In-memory rate limiter ────────────────────────────────────────────────────


class EmailRateLimiter:
    """Per-user, per-email-type rate limiter."""

    def __init__(self):
        self._buckets: Dict[str, list] = {}

    def _key(self, user_id: int, email_type: str) -> str:
        return f"{user_id}:{email_type}"

    def check(self, user_id: int, email_type: str, max_per_hour: int = 5) -> bool:
        key = self._key(user_id, email_type)
        now = time.time()
        window = 3600
        if key not in self._buckets:
            self._buckets[key] = []
        self._buckets[key] = [t for t in self._buckets[key] if now - t < window]
        if len(self._buckets[key]) >= max_per_hour:
            logger.warning(f"Rate limit exceeded for user {user_id} on {email_type}")
            return False
        self._buckets[key].append(now)
        return True


_email_rate_limiter = EmailRateLimiter()


# ─── Delivery audit helper ─────────────────────────────────────────────────────


async def _audit_email_delivery(
    to_email: str,
    email_type: str,
    subject: str,
    success: bool,
    user_id: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    """Log email delivery to the audit log for observability."""
    try:
        from app.core.prisma import prisma
        from app.generated.prisma import Json

        await prisma.auditlog.create(
            data={
                "actorId": user_id,
                "entityType": "Email",
                "entityId": hashlib.sha256(to_email.encode()).hexdigest()[:16],
                "eventType": f"EMAIL_{'SENT' if success else 'FAILED'}",
                "metadata": Json(
                    {
                        "email_type": email_type,
                        "subject_preview": subject[:80],
                        "success": success,
                        "error": error[:200] if error else None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ),
            }
        )
    except Exception as e:
        logger.debug(f"Audit log write failed (non-blocking): {e}")


# ─── Email Service ─────────────────────────────────────────────────────────────


class EmailService:
    """SMTP email delivery with retry, rate limiting, and auditing."""

    def __init__(self):
        self._server: Optional[smtplib.SMTP] = None
        self._is_connected = False

    def check_smtp_config(self) -> bool:
        """Check if SMTP is configured. Logs a debug message if not."""
        missing = []
        if not setting.SMTP_HOST:
            missing.append("SMTP_HOST")
        if not setting.SMTP_USER:
            missing.append("SMTP_USER")
        if not setting.SMTP_PASSWORD:
            missing.append("SMTP_PASSWORD")
        if missing:
            logger.debug(f"SMTP not fully configured: missing {', '.join(missing)}")
            return False
        return True

    # ─── Unified dispatch helper ──────────────────────────────────────────────

    async def _dispatch(
        self,
        email_type: str,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        user_id: Optional[int] = None,
    ) -> bool:
        """Unified send wrapper with rate limiting, retry, and audit logging."""
        if not to_email:
            logger.warning(f"Cannot send {email_type}: no recipient email")
            return False
        if not subject:
            logger.warning(f"Cannot send {email_type}: no subject")
            return False

        # Rate limit check (only for authenticated users)
        if user_id:
            if not _email_rate_limiter.check(user_id, email_type):
                await _audit_email_delivery(
                    to_email,
                    email_type,
                    subject,
                    False,
                    user_id,
                    "Rate limit exceeded",
                )
                return False

        is_transactional = email_type.lower() in TRANSACTIONAL_EMAIL_TYPES
        try:
            await self.send_email_with_retry(
                to_email,
                subject,
                text_body,
                html_body,
                is_transactional=is_transactional,
            )
            await _audit_email_delivery(to_email, email_type, subject, True, user_id)
            return True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send {email_type} to {to_email}: {error_msg}")
            await _audit_email_delivery(
                to_email,
                email_type,
                subject,
                False,
                user_id,
                error_msg,
            )
            # Security emails should not raise — transactional emails may
            if email_type in (
                "verify",
                "reset",
                "new_device",
                "password_changed",
                "email_changed",
            ):
                return False
            raise

    # ─── Email sending methods ────────────────────────────────────────────────

    async def send_verification_email(
        self,
        email: str,
        token: str,
        name: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        verification_url = f"{setting.FRONTEND_URL}/auth/verify-email?token={token}"
        subject, text_body, html_body = render_email(
            "verify",
            locale=locale,
            recipient_email=email,
            name=name,
            url=verification_url,
            email=email,
        )
        await self._dispatch("verify", email, subject, text_body, html_body, user_id)

    async def send_password_reset_email(
        self,
        email: str,
        token: str,
        name: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        reset_url = f"{setting.FRONTEND_URL}/auth/reset-password?token={token}"
        subject, text_body, html_body = render_email(
            "reset",
            locale=locale,
            recipient_email=email,
            name=name,
            url=reset_url,
            email=email,
        )
        await self._dispatch("reset", email, subject, text_body, html_body, user_id)

    async def send_organization_invitation_email(
        self, email: str, org_name: str, inviter_name: str, role: str, invite_url: str
    ):
        if not self.check_smtp_config() or not email:
            return
        subject, text_body, html_body = render_email(
            "invite",
            locale="en",
            recipient_email=email,
            org_name=org_name,
            inviter_name=inviter_name,
            role=role,
            url=invite_url,
            email=email,
        )
        await self._dispatch("invite", email, subject, text_body, html_body)

    async def send_contact_email(
        self,
        name: str,
        email: str,
        message: str,
        phone: Optional[str] = None,
        subject: Optional[str] = None,
        category: Optional[str] = None,
        reply_to_admin: bool = True,
    ) -> bool:
        if not self.check_smtp_config():
            return False

        admin_email = getattr(
            setting, "CONTACT_FORM_RECIPIENT", "podaciumcontacts@gmail.com"
        )
        if not admin_email:
            logger.error("CONTACT_FORM_RECIPIENT not configured")
            return False

        email_subject = subject or "New Contact Form Message"
        if not email_subject.startswith("Contact Form:"):
            email_subject = f"Contact Form: {email_subject}"

        _, text_body, html_body = render_email(
            "contact",
            locale="en",
            recipient_email=admin_email,
            name=name,
            email_addr=email,
            phone=phone or "",
            subject=email_subject,
            category=category or "",
            message=message,
        )

        try:
            from_email = getattr(setting, "MAIL_FROM", None) or setting.SMTP_USER
            from_name = getattr(
                setting, "CONTACT_FORM_SENDER_NAME", "Podacium Contact Form"
            )
            msg = MIMEMultipart("alternative")
            msg["From"] = formataddr((from_name, from_email))
            msg["To"] = admin_email
            msg["Subject"] = Header(email_subject, "utf-8")
            msg["Reply-To"] = email if not reply_to_admin else from_email
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            await self.send_email_with_retry(
                admin_email, email_subject, text_body, html_body
            )
            await _audit_email_delivery(admin_email, "contact", email_subject, True)
            return True
        except Exception as e:
            error_msg = f"Failed to send contact form email: {e}"
            logger.error(error_msg)
            await _audit_email_delivery(
                admin_email, "contact", email_subject, False, error=error_msg
            )
            return False

    async def send_email_with_retry(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        max_retries: int = 3,
        is_transactional: bool = True,
    ):
        """Send email with exponential backoff retry and randomized jitter."""
        last_error = None
        for attempt in range(max_retries):
            try:
                await self._send_email(
                    to_email,
                    subject,
                    text_body,
                    html_body,
                    is_transactional=is_transactional,
                )
                logger.info(f"Email sent to {to_email}: subject={subject[:60]}")
                return
            except (smtplib.SMTPAuthenticationError, smtplib.SMTPConnectError) as e:
                last_error = e
                logger.error(
                    f"SMTP permanent error (attempt {attempt + 1}/{max_retries}): {e}"
                )
                break
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    base_wait = 2**attempt
                    jitter = random.uniform(base_wait * 0.5, base_wait * 1.5)
                    logger.warning(
                        f"Email send failed (attempt {attempt + 1}/{max_retries}), retrying in {jitter:.2f}s: {e}"
                    )
                    await asyncio.sleep(jitter)
                else:
                    logger.error(f"Email send failed after {max_retries} attempts: {e}")
        if last_error:
            raise last_error

    async def _send_email(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str = None,
        is_transactional: bool = True,
    ):
        """Send email via SendGrid Web API (if SG key) or SMTP relay with robust error diagnostics."""
        from_email = getattr(setting, "MAIL_FROM", None) or setting.SMTP_USER
        if not from_email:
            raise ValueError("MAIL_FROM / SMTP_USER not configured")

        host = (setting.SMTP_HOST or "").strip()
        user = (setting.SMTP_USER or "").strip()
        pw = (setting.SMTP_PASSWORD or "").strip()

        # If SendGrid API key is detected, use SendGrid Web API v3 for high reliability and precise diagnostics
        if pw.startswith("SG.") or "sendgrid" in host.lower():
            import httpx

            headers = {
                "Auto-Submitted": "auto-generated",
                "X-Mailer": "Podacium Platform Mailer/1.0",
            }
            if not is_transactional:
                headers["List-Unsubscribe"] = (
                    f"<mailto:unsubscribe@podacium.com>, <{setting.FRONTEND_URL}/settings>"
                )
                headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
                headers["Precedence"] = "bulk"

            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": from_email, "name": "Podacium"},
                "subject": subject,
                "content": [{"type": "text/plain", "value": text_body}],
                "headers": headers,
            }
            if html_body:
                payload["content"].append({"type": "text/html", "value": html_body})

            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {pw}",
                        "Content-Type": "application/json",
                    },
                )
                if res.status_code in (200, 201, 202):
                    return
                # Extract structured error message
                err_text = res.text
                try:
                    err_json = res.json()
                    errors = err_json.get("errors", [])
                    if errors:
                        err_text = "; ".join(e.get("message", str(e)) for e in errors)
                except Exception:
                    pass
                raise RuntimeError(
                    f"SendGrid API Error ({res.status_code}): {err_text}"
                )

        # Standard SMTP relay with RFC 5322 & RFC 8058 deliverability compliance
        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr(("Podacium", from_email))
        msg["To"] = to_email
        msg["Subject"] = Header(subject, "utf-8")
        msg["Reply-To"] = from_email
        domain = from_email.split("@")[-1] if "@" in from_email else "podacium.com"
        msg["Message-ID"] = make_msgid(domain=domain)
        msg["Date"] = formatdate(localtime=True)
        msg["MIME-Version"] = "1.0"
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Auto-Response-Suppress"] = "All"
        msg["X-Mailer"] = "Podacium Platform Mailer/1.0"

        # RFC 8058 §3: Transactional emails (password reset, OTP, verification) MUST NOT have List-Unsubscribe
        if not is_transactional:
            msg["List-Unsubscribe"] = (
                f"<mailto:unsubscribe@podacium.com>, <{setting.FRONTEND_URL}/settings>"
            )
            msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
            msg["Precedence"] = "bulk"

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        def _sync_send():
            import ssl

            port = int(setting.SMTP_PORT or 587)
            use_ssl = getattr(setting, "SMTP_USE_SSL", False) or port == 465
            server = None
            try:
                if use_ssl:
                    context = ssl.create_default_context()
                    server = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
                else:
                    server = smtplib.SMTP(host, port, timeout=15)
                    server.ehlo()
                    if server.has_extn("starttls") or server.has_extn("STARTTLS"):
                        context = ssl.create_default_context()
                        server.starttls(context=context)
                        server.ehlo()
                    elif port == 587 and host not in (
                        "localhost",
                        "127.0.0.1",
                        "testserver",
                    ):
                        raise ssl.SSLError(
                            f"SMTP server at {host}:{port} did not offer STARTTLS (potential STRIPTLS downgrade attack)"
                        )

                if user and pw:
                    server.login(user, pw)
                server.send_message(msg)
            finally:
                if server is not None:
                    try:
                        server.quit()
                    except Exception:
                        try:
                            server.close()
                        except Exception:
                            pass

        await asyncio.to_thread(_sync_send)

    # ─── Security Emails ───────────────────────────────────────────────────

    async def send_new_device_email(
        self,
        email: str,
        name: str,
        device: str,
        browser: str,
        os_name: str,
        ip: str,
        location: str,
        time_val: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        secure_url = f"{setting.FRONTEND_URL}/settings/security"
        subject, text_body, html_body = render_email(
            "new_device",
            locale=locale,
            recipient_email=email,
            name=name,
            device=device,
            browser=browser,
            os=os_name,
            ip=ip,
            location=location,
            time=time_val,
            url=secure_url,
        )
        await self._dispatch(
            "new_device", email, subject, text_body, html_body, user_id
        )

    async def send_password_changed_email(
        self,
        email: str,
        name: str,
        time_val: str,
        ip_val: str = "",
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        reset_url = f"{setting.FRONTEND_URL}/auth/forgot-password"
        support_url = f"{setting.FRONTEND_URL}/contact"
        subject, text_body, html_body = render_email(
            "password_changed",
            locale=locale,
            recipient_email=email,
            name=name,
            time_val=time_val,
            ip_val=ip_val,
            reset_url=reset_url,
            support_url=support_url,
        )
        await self._dispatch(
            "password_changed", email, subject, text_body, html_body, user_id
        )

    async def send_email_changed_email(
        self,
        email: str,
        name: str,
        old_email: str,
        new_email: str,
        time_val: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        support_url = f"{setting.FRONTEND_URL}/contact"
        subject, text_body, html_body = render_email(
            "email_changed",
            locale=locale,
            recipient_email=email,
            name=name,
            old_email=old_email,
            new_email=new_email,
            time_val=time_val,
            support_url=support_url,
        )
        await self._dispatch(
            "email_changed", email, subject, text_body, html_body, user_id
        )

    # ─── Lifecycle Emails ──────────────────────────────────────────────────

    async def send_welcome_email(
        self, email: str, name: str, locale: str = "en", user_id: Optional[int] = None
    ):
        if not self.check_smtp_config() or not email:
            return
        frontend = setting.FRONTEND_URL.rstrip("/")
        subject, text_body, html_body = render_email(
            "welcome",
            locale=locale,
            recipient_email=email,
            name=name,
            url=frontend,
            support_url=f"{frontend}/contact",
        )
        await self._dispatch("welcome", email, subject, text_body, html_body, user_id)

    async def send_invite_accepted_email(
        self,
        email: str,
        inviter_name: str,
        user_name: str,
        org_name: str,
        role: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        manage_url = f"{setting.FRONTEND_URL}/bi/organizations"
        subject, text_body, html_body = render_email(
            "invite_accepted",
            locale=locale,
            recipient_email=email,
            user_name=user_name,
            inviter_name=inviter_name,
            org_name=org_name,
            role=role,
            manage_url=manage_url,
        )
        await self._dispatch(
            "invite_accepted", email, subject, text_body, html_body, user_id
        )

    async def send_member_removed_email(
        self,
        email: str,
        name: str,
        org_name: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        support_url = f"{setting.FRONTEND_URL}/contact"
        subject, text_body, html_body = render_email(
            "member_removed",
            locale=locale,
            recipient_email=email,
            name=name,
            org_name=org_name,
            support_url=support_url,
        )
        await self._dispatch(
            "member_removed", email, subject, text_body, html_body, user_id
        )

    async def send_role_changed_email(
        self,
        email: str,
        name: str,
        org_name: str,
        old_role: str,
        new_role: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return
        org_url = f"{setting.FRONTEND_URL}/bi/organizations"
        subject, text_body, html_body = render_email(
            "role_changed",
            locale=locale,
            recipient_email=email,
            name=name,
            org_name=org_name,
            old_role=old_role,
            new_role=new_role,
            org_url=org_url,
        )
        await self._dispatch(
            "role_changed", email, subject, text_body, html_body, user_id
        )

    # ─── Learning Emails ───────────────────────────────────────────────────

    async def send_enrollment_email(
        self,
        email: str,
        name: str,
        course_name: str,
        course_url: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "enrollment",
            locale=locale,
            recipient_email=email,
            name=name,
            course_name=course_name,
            url=course_url,
        )
        return await self._dispatch(
            "enrollment", email, subject, text_body, html_body, user_id
        )

    async def send_completion_email(
        self,
        email: str,
        name: str,
        course_name: str,
        score: str,
        cert_url: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ):
        if not self.check_smtp_config() or not email:
            return False
        explore_url = f"{setting.FRONTEND_URL}/learn"
        subject, text_body, html_body = render_email(
            "completion",
            locale=locale,
            recipient_email=email,
            name=name,
            course_name=course_name,
            score=score,
            cert_url=cert_url,
            explore_url=explore_url,
        )
        return await self._dispatch(
            "completion", email, subject, text_body, html_body, user_id
        )

    # ─── Billing Emails ────────────────────────────────────────────────────

    async def send_payment_receipt_email(
        self,
        email: str,
        name: str,
        amount: str,
        item: str,
        date_val: str,
        transaction_id: str,
        receipt_url: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "payment",
            locale=locale,
            recipient_email=email,
            name=name,
            amount=amount,
            item=item,
            date_val=date_val,
            transaction_id=transaction_id,
            receipt_url=receipt_url,
        )
        return await self._dispatch(
            "payment", email, subject, text_body, html_body, user_id
        )

    async def send_refund_confirmation_email(
        self,
        email: str,
        name: str,
        amount: str,
        transaction_id: str,
        refund_id: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        billing_url = f"{setting.FRONTEND_URL}/billing"
        subject, text_body, html_body = render_email(
            "refund",
            locale=locale,
            recipient_email=email,
            name=name,
            amount=amount,
            transaction_id=transaction_id,
            refund_id=refund_id,
            billing_url=billing_url,
        )
        return await self._dispatch(
            "refund", email, subject, text_body, html_body, user_id
        )

    async def send_subscription_email(
        self,
        email: str,
        name: str,
        plan: str,
        amount: str,
        status: str,
        started: str,
        renewal: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        manage_url = f"{setting.FRONTEND_URL}/billing"
        subject, text_body, html_body = render_email(
            "subscription",
            locale=locale,
            recipient_email=email,
            name=name,
            plan=plan,
            amount=amount,
            status=status,
            started=started,
            renewal=renewal,
            manage_url=manage_url,
        )
        return await self._dispatch(
            "subscription", email, subject, text_body, html_body, user_id
        )

    # ─── Freelancing Emails ────────────────────────────────────────────────

    async def send_proposal_email(
        self,
        email: str,
        name: str,
        project_title: str,
        freelancer: str,
        amount: str,
        message: str,
        review_url: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "proposal",
            locale=locale,
            recipient_email=email,
            name=name,
            project_title=project_title,
            freelancer=freelancer,
            amount=amount,
            message=message,
            review_url=review_url,
        )
        return await self._dispatch(
            "proposal", email, subject, text_body, html_body, user_id
        )

    # ─── Newsletter ────────────────────────────────────────────────────────

    async def send_newsletter_subscription_email(
        self,
        email: str,
        name: str,
        locale: str = "en",
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "newsletter",
            locale=locale,
            recipient_email=email,
            name=name,
        )
        return await self._dispatch("newsletter", email, subject, text_body, html_body)

    # ─── Waitlist Confirmation ─────────────────────────────────────────────

    async def send_waitlist_confirmation_email(
        self,
        email: str,
        name: str,
        referral_code: str,
        queue_position: int,
        locale: str = "en",
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "waitlist_confirmation",
            locale=locale,
            recipient_email=email,
            name=name,
            referral_code=referral_code,
            queue_position=queue_position,
        )
        return await self._dispatch(
            "waitlist_confirmation", email, subject, text_body, html_body
        )

    # ─── Support Email ─────────────────────────────────────────────────────

    async def send_csat_survey_email(
        self,
        email: str,
        user_name: str,
        ticket_subject: str,
        ticket_number: str,
        rating_url: str,
        locale: str = "en",
        user_id: Optional[int] = None,
    ) -> bool:
        if not self.check_smtp_config() or not email:
            return False
        subject, text_body, html_body = render_email(
            "csat_survey",
            locale=locale,
            recipient_email=email,
            user_name=user_name,
            ticket_subject=ticket_subject,
            ticket_number=ticket_number,
            rating_url=rating_url,
        )
        return await self._dispatch(
            "csat_survey", email, subject, text_body, html_body, user_id
        )

    # ─── Health Check ──────────────────────────────────────────────────────

    async def test_connection(self) -> bool:
        try:
            if getattr(setting, "SMTP_USE_SSL", False):
                server = smtplib.SMTP_SSL(setting.SMTP_HOST, setting.SMTP_PORT)
            else:
                server = smtplib.SMTP(setting.SMTP_HOST, setting.SMTP_PORT)

            if not getattr(setting, "SMTP_USE_SSL", False):
                server.starttls()

            server.login(setting.SMTP_USER, setting.SMTP_PASSWORD)
            server.quit()
            return True
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return False


email_service = EmailService()
