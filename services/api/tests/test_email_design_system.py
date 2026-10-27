"""Unit and integration tests for Podacium Transactional Email Design System.

Verifies:
- All email builders render without syntax, formatting, or template errors across all supported locales (en, fr, ar, kab).
- Strict adherence to DESIGN.md tokens: brand gradient (#2563EB -> #4F46E5 -> #9333EA), typography (Inter / Baloo Bhaijaan 2 / DM Mono).
- Multi-client dark-mode resiliency (WebKit, Outlook.com [data-ogsc], Gmail App u + .email-body).
- Bidirectional and RTL correctness: dir="rtl", border orientation, <bdi dir="ltr"> isolation for sensitive tokens (emails, numbers, IPs, codes).
- Outlook MSO VML table and button fallbacks with explicit bgcolor.
- Regulatory footer compliance (TLS encryption, ANPDP Law 25-11, company jurisdiction).
"""

import pytest
from app.services.email_templates import (
    render_email,
    _cta_button,
    _card,
    _security_note,
    EMAIL_BUILDERS,
)


SAMPLE_KWARGS = {
    "verify": {
        "name": "Zakarya",
        "url": "https://podacium.com/verify?token=abc",
        "email": "zakarya@podacium.com",
    },
    "magic_link": {
        "name": "Zakarya",
        "magic_url": "https://podacium.com/auth/magic?token=xyz",
        "expires_in_minutes": 15,
        "client_ip": "105.235.139.54",
    },
    "reset": {
        "name": "Zakarya",
        "url": "https://podacium.com/reset?token=123",
        "email_addr": "zakarya@podacium.com",
    },
    "invite": {
        "org_name": "Podacium Labs",
        "inviter_name": "Admin",
        "role": "Engineer",
        "url": "https://podacium.com/invite/123",
        "email": "invitee@podacium.com",
    },
    "contact": {
        "name": "Karim",
        "email_addr": "karim@example.com",
        "phone": "+213555123456",
        "subject": "Enterprise Inquiry",
        "category": "Sales",
        "message": "Interested in BI pilot.",
    },
    "otp": {"code": "849201"},
    "new_device": {
        "name": "Zakarya",
        "device": "MacBook Pro",
        "browser": "Chrome 122",
        "os": "macOS",
        "ip": "105.235.139.54",
        "location": "Oran, Algeria",
        "time": "2026-10-07 11:30 UTC",
        "url": "https://podacium.com/security/lock",
    },
    "password_changed": {
        "name": "Zakarya",
        "time_val": "2026-10-07 11:30 UTC",
        "ip_val": "105.235.139.54",
        "reset_url": "https://podacium.com/reset",
        "support_url": "https://podacium.com/support",
    },
    "email_changed": {
        "name": "Zakarya",
        "old_email": "old@podacium.com",
        "new_email": "new@podacium.com",
        "time_val": "2026-10-07 11:30 UTC",
        "support_url": "https://podacium.com/support",
    },
    "account_deleted": {
        "name": "Zakarya",
        "deletion_date": "2026-11-07",
        "recover_url": "https://podacium.com/recover",
        "feedback_url": "https://podacium.com/feedback",
    },
    "welcome": {
        "name": "Zakarya",
        "url": "https://podacium.com/dashboard",
        "support_url": "https://podacium.com/support",
    },
    "welcome_d1": {
        "name": "Zakarya",
        "url": "https://podacium.com/dashboard",
        "support_url": "https://podacium.com/support",
    },
    "welcome_d3": {
        "name": "Zakarya",
        "url": "https://podacium.com/dashboard",
        "support_url": "https://podacium.com/support",
    },
    "welcome_d7": {
        "name": "Zakarya",
        "url": "https://podacium.com/dashboard",
        "support_url": "https://podacium.com/support",
    },
    "invite_accepted": {
        "user_name": "Karim",
        "inviter_name": "Zakarya",
        "org_name": "Podacium Labs",
        "role": "Developer",
        "manage_url": "https://podacium.com/org/manage",
    },
    "member_removed": {
        "name": "Karim",
        "org_name": "Podacium Labs",
        "support_url": "https://podacium.com/support",
    },
    "role_changed": {
        "name": "Karim",
        "org_name": "Podacium Labs",
        "old_role": "Member",
        "new_role": "Manager",
        "org_url": "https://podacium.com/org",
    },
    "enrollment": {
        "name": "Zakarya",
        "course_name": "FastAPI & Next.js Monoliths",
        "url": "https://podacium.com/learn/fastapi",
    },
    "completion": {
        "name": "Zakarya",
        "course_name": "FastAPI & Next.js Monoliths",
        "score": "98%",
        "cert_url": "https://podacium.com/cert/123",
        "explore_url": "https://podacium.com/learn",
    },
    "refund": {
        "name": "Zakarya",
        "amount": "15,000 DZD",
        "transaction_id": "TX_99214",
        "refund_id": "RF_1048",
        "billing_url": "https://podacium.com/billing",
    },
    "payment": {
        "name": "Zakarya",
        "amount": "15,000 DZD",
        "item": "Pro Annual Plan",
        "date_val": "2026-10-07",
        "transaction_id": "TX_99214",
        "receipt_url": "https://podacium.com/receipt/123",
    },
    "subscription": {
        "name": "Zakarya",
        "plan": "Enterprise BI",
        "amount": "50,000 DZD / month",
        "status": "Active",
        "started": "2026-10-01",
        "renewal": "2026-11-01",
        "manage_url": "https://podacium.com/billing",
    },
    "csat_survey": {
        "user_name": "Zakarya",
        "ticket_subject": "IMAP Ingestion",
        "ticket_number": "TICK-402",
        "rating_url": "https://podacium.com/csat/402",
    },
    "newsletter": {"name": "Zakarya"},
    "proposal": {
        "name": "Zakarya",
        "project_title": "FinTech Mobile App",
        "freelancer": "Nadir",
        "amount": "120,000 DZD",
        "message": "Ready to start immediately.",
        "review_url": "https://podacium.com/proposals/91",
    },
    "waitlist_confirmation": {
        "name": "Zakarya",
        "referral_code": "POD-99",
        "queue_position": 42,
    },
    "waitlist_drip_day3": {"name": "Zakarya", "referral_code": "POD-99"},
    "waitlist_drip_day7": {"name": "Zakarya", "referral_code": "POD-99"},
    "waitlist_drip_day14": {"name": "Zakarya", "referral_code": "POD-99"},
    "waitlist_drip_day30": {"name": "Zakarya", "referral_code": "POD-99"},
}


@pytest.mark.parametrize("email_type", list(EMAIL_BUILDERS.keys()))
@pytest.mark.parametrize("locale", ["en", "fr", "ar", "kab"])
def test_all_email_types_render_successfully(email_type: str, locale: str):
    """Test that all 30 email templates render without error across all 4 locales."""
    kwargs = SAMPLE_KWARGS.get(email_type, {"name": "User"})
    subject, text, html = render_email(
        email_type,
        locale=locale,
        recipient_email="user@podacium.com",
        **kwargs,
    )
    assert subject and len(subject) > 0
    assert text and len(text) > 0
    assert html and len(html) > 0
    assert "<!DOCTYPE html>" in html
    assert f'lang="{locale}"' in html
    assert "PODACIUM" in html


def test_design_tokens_brand_gradient():
    """Verify North Star brand gradient (#2563EB -> #4F46E5 -> #9333EA) from DESIGN.md."""
    _, _, html = render_email("verify", locale="en", **SAMPLE_KWARGS["verify"])
    assert "linear-gradient(90deg, #2563EB 0%, #4F46E5 50%, #9333EA 100%)" in html
    assert "background:rgba(255,255,255,0.08)" in html  # Brand wordmark frosted pill
    assert "#38BDF8" in html  # Brand dot glowing accent


def test_dark_mode_resiliency():
    """Verify comprehensive dark mode selectors for Apple Mail, Outlook.com, and Gmail."""
    _, _, html = render_email("verify", locale="en", **SAMPLE_KWARGS["verify"])
    assert '<meta name="color-scheme" content="light dark">' in html
    assert "@media (prefers-color-scheme: dark)" in html
    assert "[data-ogsc] body" in html
    assert "[data-ogsc] .email-container" in html
    assert "u + .email-body" in html
    assert "u + .email-body .email-container" in html


def test_arabic_rtl_and_bidi_isolation():
    """Verify Arabic email renders with dir='rtl', Baloo Bhaijaan 2 font, and <bdi dir='ltr'>."""
    _, _, html = render_email("new_device", locale="ar", **SAMPLE_KWARGS["new_device"])
    assert 'dir="rtl"' in html
    assert "Baloo Bhaijaan 2" in html
    # Sensitive tokens must be isolated in <bdi dir="ltr"> to prevent Arabic shaping distortion
    assert "<bdi dir='ltr'>105.235.139.54</bdi>" in html
    assert "<bdi dir='ltr'>2026-10-07 11:30 UTC</bdi>" in html


def test_otp_code_box_typography():
    """Verify OTP verification code has DM Mono font and letter spacing."""
    _, _, html = render_email("otp", locale="en", **SAMPLE_KWARGS["otp"])
    assert "DM Mono" in html
    assert "letter-spacing:12px" in html
    assert '<bdi dir="ltr">849201</bdi>' in html
    assert "SINGLE-USE &middot; EXPIRES IN 10 MINUTES" in html


def test_cta_button_variants_and_mso_vml():
    """Verify button variants generate valid Outlook VML and explicit bgcolor attributes."""
    for variant, expected_bg in [
        ("primary", "#2563EB"),
        ("success", "#059669"),
        ("destructive", "#DC2626"),
        ("secondary", "#475569"),
    ]:
        btn = _cta_button("Click Here", "https://podacium.com", variant=variant)
        assert f'bgcolor="{expected_bg}"' in btn
        assert f'fillcolor="{expected_bg}"' in btn
        assert "<v:roundrect" in btn
        assert 'class="email-button"' in btn


def test_direction_aware_card_and_security_borders():
    """Verify cards and security notes orient accent borders on right in RTL and left in LTR."""
    card_ltr = _card("Title", "Body", border_color="#2563EB", is_rtl=False)
    assert "border-left: 4px solid #2563EB" in card_ltr

    card_rtl = _card("عنوان", "نص", border_color="#2563EB", is_rtl=True)
    assert "border-right: 4px solid #2563EB" in card_rtl

    note_ltr = _security_note("Security Alert", is_rtl=False)
    assert "border-left: 4px solid" in note_ltr

    note_rtl = _security_note("تنبيه أمني", is_rtl=True)
    assert "border-right: 4px solid" in note_rtl


def test_regulatory_footer_compliance():
    """Verify enterprise footer includes official communication badge, ANPDP Law 25-11, and company jurisdiction."""
    _, _, html = render_email("verify", locale="en", **SAMPLE_KWARGS["verify"])
    assert "Official Account Communication" in html
    assert "ANPDP Law 25-11 Compliant" in html
    assert "Podacium Technologies EURL &middot; Oran / Algiers, Algeria" in html


def test_brand_retina_icon_in_header():
    """Verify that email templates embed the official Podacium brand icon in the header pill."""
    _, _, html = render_email("verify", locale="en", **SAMPLE_KWARGS["verify"])
    assert "apple-icon.png" in html
    assert 'alt="Podacium"' in html
    assert 'width="22"' in html
    assert 'height="22"' in html


def test_anti_spam_deliverability_hygiene():
    """Verify templates contain zero deceptive hidden characters or 1px font-size spam triggers."""
    _, _, html = render_email("verify", locale="en", **SAMPLE_KWARGS["verify"])
    # Zero-width / soft hyphen spam runs must never exist
    assert "&#847;" not in html
    assert "&shy;" not in html
    assert "&zwnj;" not in html
    # Preheader must be 0px and not 1px font opacity hack
    assert "font-size:0px" in html or "font-size: 0px" in html
    assert "font-size:1px" not in html
    # Untrusted remote <link rel="stylesheet"> must be absent from <head>
    assert '<link href="https://fonts.googleapis.com' not in html


def test_recursive_key_level_localization_fallback():
    """Verify get_email_strings falls back key-by-key to English without raising KeyError."""
    from app.services.email_localization import get_email_strings, LOCALIZED

    # Test with partial dictionary (simulating a newly introduced key)
    original_kab_verify = LOCALIZED.get("kab", {}).get("verify", {}).copy()
    try:
        # Intentionally strip non-title keys to test recursive fallback
        LOCALIZED["kab"]["verify"] = {"title": "Tafsirelt"}
        strings = get_email_strings("kab", "verify")
        # 'title' comes from Kabyle
        assert strings["title"] == "Tafsirelt"
        # 'heading', 'cta', 'alt_link' must fall back seamlessly to English
        assert "heading" in strings
        assert "cta" in strings
        assert "alt_link" in strings
        assert strings["heading"] == LOCALIZED["en"]["verify"]["heading"]
    finally:
        LOCALIZED["kab"]["verify"] = original_kab_verify


def test_arabic_font_fallbacks_in_base_template():
    """Verify Arabic font stack includes Cairo and DejaVu Sans alongside Baloo Bhaijaan 2."""
    _, _, html = render_email("welcome", locale="ar", **SAMPLE_KWARGS["welcome"])
    assert "Cairo" in html
    assert "DejaVu Sans" in html
    assert "Baloo Bhaijaan 2" in html
    assert 'dir="rtl"' in html
