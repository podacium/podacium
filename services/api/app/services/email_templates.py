"""Email HTML and plain-text template generators.

All HTML templates use table-based layout for maximum email client compatibility.
Inline styles are preferred over embedded where possible. Dark mode is fully supported.
Each template follows the Podacium design system (DESIGN.md).
"""

import inspect
from typing import Optional, Any
from datetime import datetime
from app.core.config import setting
from app.services.email_localization import get_email_strings


# ─── Utility helpers ──────────────────────────────────────────────────────────


def _fmt_url(url: str) -> str:
    """Ensure URL is safe for HTML attributes."""
    return url.replace("&", "&amp;").replace('"', "&quot;")


def _safe(s: str) -> str:
    """HTML-escape a string for safe inline use."""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


# ─── Base HTML Template & Global Email Styles ─────────────────────────────────

EMAIL_STYLES = """
    /* Reset & Typography */
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td, th { vertical-align: top; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    :root { color-scheme: light dark; supported-color-schemes: light dark; }

    /* Dark Mode (Webkit / Apple Mail) */
    @media (prefers-color-scheme: dark) {
      body, .email-body { background-color: #080C14 !important; }
      .email-container { background-color: #0F172A !important; border-color: #1E293B !important; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6) !important; }
      .email-content { background-color: #0F172A !important; color: #CBD5E1 !important; }
      .email-text { color: #CBD5E1 !important; }
      .email-heading { color: #FFFFFF !important; }
      .email-muted { color: #94A3B8 !important; }
      .email-card { background-color: #1E293B !important; border-color: #334155 !important; }
      .email-card-alt { background-color: #0B1120 !important; border-color: #1E293B !important; }
      .email-code-box { background-color: #0B1120 !important; border-color: #3B82F6 !important; }
      .email-code { color: #60A5FA !important; }
      .email-divider { border-color: #1E293B !important; }
      .email-footer { background-color: #030712 !important; border-top: 1px solid #1E293B !important; }
      a { color: #38BDF8 !important; }
      .email-button { color: #FFFFFF !important; }
      .email-badge { background-color: rgba(59, 130, 246, 0.2) !important; border-color: rgba(96, 165, 250, 0.35) !important; color: #93C5FD !important; }
    }

    /* Dark Mode (Outlook.com / Office 365 OWA) */
    [data-ogsc] body, [data-ogsc] .email-body { background-color: #080C14 !important; }
    [data-ogsc] .email-container { background-color: #0F172A !important; border-color: #1E293B !important; }
    [data-ogsc] .email-content { background-color: #0F172A !important; color: #CBD5E1 !important; }
    [data-ogsc] .email-text { color: #CBD5E1 !important; }
    [data-ogsc] .email-heading { color: #FFFFFF !important; }
    [data-ogsc] .email-muted { color: #94A3B8 !important; }
    [data-ogsc] .email-card { background-color: #1E293B !important; border-color: #334155 !important; }
    [data-ogsc] .email-card-alt { background-color: #0B1120 !important; border-color: #1E293B !important; }
    [data-ogsc] .email-code-box { background-color: #0B1120 !important; border-color: #3B82F6 !important; }
    [data-ogsc] .email-code { color: #60A5FA !important; }
    [data-ogsc] .email-divider { border-color: #1E293B !important; }
    [data-ogsc] .email-footer { background-color: #030712 !important; border-top: 1px solid #1E293B !important; }
    [data-ogsc] a { color: #38BDF8 !important; }
    [data-ogsc] .email-button { color: #FFFFFF !important; }

    /* Dark Mode (Gmail App Android/iOS) */
    u + .email-body { background-color: #080C14 !important; }
    u + .email-body .email-container { background-color: #0F172A !important; border-color: #1E293B !important; }
    u + .email-body .email-content { background-color: #0F172A !important; color: #CBD5E1 !important; }
    u + .email-body .email-text { color: #CBD5E1 !important; }
    u + .email-body .email-heading { color: #FFFFFF !important; }
    u + .email-body .email-card { background-color: #1E293B !important; border-color: #334155 !important; }
    u + .email-body .email-code-box { background-color: #0B1120 !important; border-color: #3B82F6 !important; }
    u + .email-body .email-code { color: #60A5FA !important; }

    /* Responsive Mobile Layout */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
      .email-padding { padding: 28px 20px !important; }
      .email-hero { padding: 36px 20px 32px !important; }
      .email-footer-padding { padding: 28px 20px !important; }
      .email-button { width: 100% !important; display: block !important; box-sizing: border-box !important; text-align: center !important; }
      .email-button-td { display: block !important; width: 100% !important; }
      .email-stack { display: block !important; width: 100% !important; }
      .email-stack-td { display: block !important; width: 100% !important; padding: 6px 0 !important; }
      .email-card-grid { display: block !important; width: 100% !important; }
      .email-hide-mobile { display: none !important; }
      .email-code { font-size: 28px !important; letter-spacing: 8px !important; }
      .email-heading-hero { font-size: 22px !important; }
    }

    /* Preheader hiding (zero-font-size, zero-dimensions, zero-margin without low-contrast hacks) */
    .preheader { display: none !important; mso-hide: all !important; max-height: 0 !important; max-width: 0 !important; overflow: hidden !important; font-size: 0px !important; line-height: 0px !important; visibility: hidden !important; opacity: 0 !important; }

    /* BiDi / RTL Rules */
    .rtl, [dir="rtl"] { direction: rtl; unicode-bidi: embed; }
    .rtl .email-label, [dir="rtl"] .email-label { text-align: right !important; }
    [dir="rtl"] td, [dir="rtl"] th { text-align: right; }
    [dir="rtl"] .email-text, [dir="rtl"] .email-heading { text-align: right !important; }
    [dir="rtl"] .email-center-text { text-align: center !important; }
"""


def _dir_from_locale(locale: str) -> str:
    """Return the dir attribute value for a given locale."""
    return "rtl" if locale == "ar" else "ltr"


def render_base(
    content_html: str,
    title: str,
    *,
    badge: Optional[str] = None,
    preheader: Optional[str] = None,
    accent_gradient: str = "linear-gradient(135deg, #0B0F19 0%, #111827 50%, #1E1B4B 100%)",
    email: str = "",
    locale: str = "en",
) -> str:
    """Render the base email wrapper adhering to Podacium DESIGN.md invariants.

    Args:
        content_html: Inner content HTML (should NOT include <html>/<body> tags).
        title: Hero title text.
        badge: Optional badge text above title.
        preheader: Optional hidden preview text for inbox.
        accent_gradient: CSS gradient for the hero header.
        email: Recipient email (shown in footer).
        locale: User locale.
    """
    s = get_email_strings(locale, "shared")
    current_year = datetime.now().year
    is_rtl = locale == "ar"
    direction = "rtl" if is_rtl else "ltr"

    # Font stack selection per DESIGN.md: Inter (default) / Baloo Bhaijaan 2 (Arabic) with robust fallbacks
    font_stack = (
        "'Baloo Bhaijaan 2', 'Cairo', 'DejaVu Sans', 'Segoe UI', Tahoma, 'Geeza Pro', Arial, sans-serif"
        if is_rtl
        else "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    )

    badge_html = (
        f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 16px;">
      <tr><td class="email-badge" style="background: rgba(59, 130, 246, 0.16); border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 100px; padding: 5px 16px; font-family: {font_stack}; font-size: 11px; font-weight: 700; color: #93C5FD; text-transform: uppercase; letter-spacing: 0.08em;">{_safe(badge)}</td></tr>
    </table>"""
        if badge
        else ""
    )
    # Clean, RFC/SpamAssassin compliant zero-height preheader (no 1px opacity hacks or hidden char spam)
    preheader_html = (
        f"""<div class="preheader" style="display:none;font-size:0px;line-height:0px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;visibility:hidden;mso-hide:all;">{_safe(preheader)}</div>"""
        if preheader
        else ""
    )

    safe_email = f"<bdi dir='ltr'>{_safe(email)}</bdi>" if email else ""
    sent_to = s["footer_sent_to"].format(email=safe_email) if email else ""

    dir_attr = f' dir="{direction}"'
    lang_attr = f' lang="{locale}"'
    align_style = f"direction:{direction};text-align:{'right' if is_rtl else 'left'};"

    return f"""<!DOCTYPE html>
<html{lang_attr}{dir_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>{_safe(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style type="text/css">
  body, table, td, h1, h2, h3, p, a, span, bdi {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }}
</style>
<![endif]-->
<style>{EMAIL_STYLES}</style>
</head>
<body{dir_attr} style="margin:0;padding:0;width:100%!important;background-color:#F8FAFC;font-family:{font_stack};{align_style}">
{preheader_html}
<!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color:#F8FAFC;"><![endif]-->
<table class="email-body"{dir_attr} role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;margin:0;padding:0;width:100%;{align_style}">
<tr><td align="center" style="padding:40px 16px;">
  <!-- ─── Container ─── -->
  <table class="email-container"{dir_attr} role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.04),0 8px 10px -6px rgba(0,0,0,0.02);{align_style}">

    <!-- ─── Top Brand Accent Stripe (DESIGN.md blue-600 -> indigo-600 -> purple-600) ─── -->
    <tr>
      <td style="height:4px;background:linear-gradient(90deg, #2563EB 0%, #4F46E5 50%, #9333EA 100%);font-size:0px;line-height:0px;">&nbsp;</td>
    </tr>

    <!-- ─── Hero Header ─── -->
    <tr>
      <td class="email-hero" style="background:{accent_gradient};padding:44px 36px 40px;text-align:center;">
        <!-- Brand Wordmark Pill Badge with Official Retina Icon -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:6px 16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);border-radius:9999px;box-shadow:0 4px 12px rgba(0,0,0,0.15);vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="vertical-align:middle;padding-right:8px;line-height:0;">
                          <img src="{setting.FRONTEND_URL}/apple-icon.png" width="22" height="22" alt="Podacium" style="display:block;width:22px;height:22px;border-radius:6px;border:0;outline:none;" />
                        </td>
                        <td style="vertical-align:middle;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:900;letter-spacing:0.20em;color:#FFFFFF;text-transform:uppercase;line-height:1;">
                          PODACIUM
                        </td>
                        <td style="vertical-align:middle;padding-left:8px;line-height:0;">
                          <span style="display:inline-block;width:6px;height:6px;background:#38BDF8;border-radius:50%;box-shadow:0 0 8px rgba(56,189,248,0.8);"></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        {badge_html}
        <h1 class="email-heading email-heading-hero" style="margin:0;font-family:{font_stack};font-size:25px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;mso-line-height-rule:exactly;line-height:1.25;">{_safe(title)}</h1>
        <p style="margin:8px 0 0;font-family:{font_stack};font-size:14px;color:rgba(255,255,255,0.85);">{_safe(s['tagline'])}</p>
      </td>
    </tr>

    <!-- ─── Content ─── -->
    <tr>
      <td class="email-content email-padding" style="background-color:#FFFFFF;padding:36px 40px;font-family:{font_stack};font-size:15px;line-height:1.65;color:#334151;">
        {content_html}
      </td>
    </tr>

    <!-- ─── Footer ─── -->
    <tr>
      <td class="email-footer email-footer-padding" style="background-color:#0B0F19;padding:32px 36px;text-align:center;font-family:{font_stack};font-size:13px;color:#94A3B8;line-height:1.5;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
          <tr>
            <td style="padding:5px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:9999px;font-size:11px;color:#94A3B8;font-weight:600;">
              Podacium Platform &middot; Official Account Communication &middot; ANPDP Law 25-11 Compliant
            </td>
          </tr>
        </table>
        <p style="margin:0;font-weight:500;">&copy; {current_year} {_safe(s['brand'])}. {_safe(s['footer_rights'])}</p>
        {f'<p style="margin:8px 0 0;font-size:12px;color:#64748B;">{sent_to}</p>' if sent_to else ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0;">
          <tr>
            <td style="padding:0 10px;"><a href="{setting.FRONTEND_URL}/privacy" style="color:#94A3B8;text-decoration:underline;font-size:12px;">{_safe(s['footer_privacy'])}</a></td>
            <td style="padding:0 10px;color:#475569;">&bull;</td>
            <td style="padding:0 10px;"><a href="{setting.FRONTEND_URL}/contact" style="color:#94A3B8;text-decoration:underline;font-size:12px;">{_safe(s['footer_support'])}</a></td>
            <td style="padding:0 10px;color:#475569;">&bull;</td>
            <td style="padding:0 10px;"><a href="{setting.FRONTEND_URL}/terms" style="color:#94A3B8;text-decoration:underline;font-size:12px;">{_safe(s['footer_terms'])}</a></td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#64748B;">{_safe(s['footer_company'])} &middot; Podacium Technologies EURL &middot; Oran / Algiers, Algeria</p>
      </td>
    </tr>
  </table>
  <!-- ─── Bottom text ─── -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0;">
    <tr><td style="text-align:center;font-family:{font_stack};font-size:11px;color:#94A3B8;">
      <a href="{setting.FRONTEND_URL}/settings" style="color:#94A3B8;text-decoration:underline;font-size:11px;">{_safe(s['manage_prefs'])}</a>
    </td></tr>
  </table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>"""


# ─── Shared content components ────────────────────────────────────────────────


def _cta_button(
    text: str,
    url: str,
    variant: str = "primary",
    is_rtl: bool = False,
) -> str:
    """Render a CTA button block (table-based, Outlook VML-safe, dark-mode resilient).

    Variants adhere strictly to DESIGN.md palette:
    - primary: Brand blue-indigo gradient (#2563EB -> #4F46E5)
    - success: Emerald-teal gradient (#059669 -> #0D9488)
    - destructive: Crimson gradient (#DC2626 -> #B91C1C)
    - secondary: Slate neutral gradient (#475569 -> #334155)
    """
    safe_url = _fmt_url(url)
    safe_text = _safe(text)

    variants = {
        "primary": {
            "bg": "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
            "bgcolor": "#2563EB",
            "stroke": "#4F46E5",
            "fill": "#2563EB",
            "shadow": "0 4px 14px rgba(37, 99, 235, 0.35)",
            "text": "#FFFFFF",
        },
        "success": {
            "bg": "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
            "bgcolor": "#059669",
            "stroke": "#0D9488",
            "fill": "#059669",
            "shadow": "0 4px 14px rgba(13, 148, 136, 0.3)",
            "text": "#FFFFFF",
        },
        "destructive": {
            "bg": "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
            "bgcolor": "#DC2626",
            "stroke": "#B91C1C",
            "fill": "#DC2626",
            "shadow": "0 4px 14px rgba(220, 38, 38, 0.3)",
            "text": "#FFFFFF",
        },
        "secondary": {
            "bg": "linear-gradient(135deg, #475569 0%, #334155 100%)",
            "bgcolor": "#475569",
            "stroke": "#334155",
            "fill": "#475569",
            "shadow": "0 4px 14px rgba(71, 85, 105, 0.25)",
            "text": "#FFFFFF",
        },
    }
    cfg = variants.get(variant, variants["primary"])
    font_stack = (
        "'Baloo Bhaijaan 2', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        if is_rtl
        else "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    )

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
  <tr>
    <td class="email-button-td" bgcolor="{cfg['bgcolor']}" style="border-radius:10px;text-align:center;background:{cfg['bg']};box-shadow:{cfg['shadow']};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{safe_url}" style="height:48px;v-text-anchor:middle;width:auto;" arcsize="20%" strokecolor="{cfg['stroke']}" fillcolor="{cfg['fill']}">
        <w:anchorlock/>
        <center style="color:{cfg['text']};font-family:{font_stack};font-size:15px;font-weight:700;">{safe_text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="{safe_url}" class="email-button" style="display:inline-block;padding:15px 36px;background:{cfg['bg']};border-radius:10px;color:{cfg['text']} !important;text-decoration:none;font-weight:700;font-size:15px;font-family:{font_stack};text-align:center;mso-hide:all;letter-spacing:0.01em;">{safe_text}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>"""


def _fallback_link(alt_text: str, url: str) -> str:
    """Render a fallback plain link (shown when buttons are blocked)."""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;width:100%;">
  <tr><td class="email-text" style="font-size:12px;color:#64748B;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    {_safe(alt_text)}
  </td></tr>
  <tr><td class="email-card-alt" style="word-break:break-all;padding:12px 14px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;margin-top:6px;font-family:'DM Mono','SF Mono',Consolas,Menlo,Monaco,monospace;font-size:12px;color:#475569;line-height:1.5;">
    <a href="{_fmt_url(url)}" style="color:#2563EB;word-break:break-all;text-decoration:none;"><bdi dir="ltr">{_safe(url)}</bdi></a>
  </td></tr>
</table>"""


def _card(
    title: str,
    body: str,
    border_color: str = "#2563EB",
    is_rtl: bool = False,
) -> str:
    """Render an info card block with direction-aware accent border."""
    border_side = (
        f"border-right: 4px solid {border_color}; border-left: 1px solid #E2E8F0;"
        if is_rtl
        else f"border-left: 4px solid {border_color}; border-right: 1px solid #E2E8F0;"
    )
    align = "text-align: right;" if is_rtl else "text-align: left;"
    return f"""<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F8FAFC;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;{border_side}border-radius:10px;width:100%;">
  <tr><td style="padding:18px 22px;{align}">
    <p class="email-heading" style="margin:0 0 6px;font-weight:700;font-size:14px;color:#0F172A;">{_safe(title)}</p>
    <p class="email-text" style="margin:0;color:#334155;font-size:14px;line-height:1.6;">{body}</p>
  </td></tr>
</table>"""


def _info_row(
    label: str,
    value: str,
    bold_value: bool = True,
    is_rtl: bool = False,
) -> str:
    """Render a label: value row for detail tables with bidirectional alignment."""
    val_style = "font-weight:600;color:#0F172A;" if bold_value else "color:#334155;"
    if is_rtl:
        return f"""<tr>
  <td class="email-heading" style="padding:8px 0;font-size:14px;{val_style}word-break:break-word;text-align:left;">{value}</td>
  <td class="email-muted" style="padding:8px 0;font-size:13px;color:#64748B;white-space:nowrap;vertical-align:top;width:40%;text-align:right;">{_safe(label)}</td>
</tr>"""
    return f"""<tr>
  <td class="email-muted" style="padding:8px 0;font-size:13px;color:#64748B;white-space:nowrap;vertical-align:top;width:40%;text-align:left;">{_safe(label)}</td>
  <td class="email-heading" style="padding:8px 0;font-size:14px;{val_style}word-break:break-word;text-align:right;">{value}</td>
</tr>"""


def _divider() -> str:
    return """<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;"><tr><td class="email-divider" style="height:1px;background:#E2E8F0;font-size:0px;line-height:0px;">&nbsp;</td></tr></table>"""


def _regards(regards_html: str, is_rtl: bool = False) -> str:
    align = "text-align: right;" if is_rtl else "text-align: left;"
    align_table = "margin: 32px 0 0 auto;" if is_rtl else "margin-top: 32px;"
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="{align_table}">
  <tr><td class="email-text" style="font-size:14px;color:#334155;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;{align}">
    {regards_html}
  </td></tr>
</table>"""


def _security_note(
    text: str,
    label: str = "SECURE",
    bg: str = "#F8FAFC",
    border: str = "#2563EB",
    lbl_bg: str = "#2563EB",
    lbl_txt: str = "#FFFFFF",
    txt_color: str = "#0F172A",
    is_rtl: bool = False,
) -> str:
    border_side = (
        f"border-right: 4px solid {border}; border-left: 1px solid rgba(0,0,0,0.06);"
        if is_rtl
        else f"border-left: 4px solid {border}; border-right: 1px solid rgba(0,0,0,0.06);"
    )
    align = "text-align: right;" if is_rtl else "text-align: left;"
    align_table = "margin: 0 0 6px auto;" if is_rtl else "margin: 0 0 6px 0;"
    return f"""<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:{bg};border-top:1px solid rgba(0,0,0,0.06);border-bottom:1px solid rgba(0,0,0,0.06);{border_side}border-radius:10px;width:100%;">
  <tr><td style="padding:14px 18px;font-size:13px;color:{txt_color};line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;{align}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="{align_table}">
      <tr><td style="background:{lbl_bg};color:{lbl_txt};font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:3px 9px;border-radius:9999px;">{_safe(label)}</td></tr>
    </table>
    <span class="email-text" style="font-weight:500;">{_safe(text)}</span>
  </td></tr>
</table>"""


# ─── Email content builders ───────────────────────────────────────────────────


def _verify_content(
    name: str, url: str, email: str, s: dict, is_rtl: bool = False
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0F172A;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["body"]}</p>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["cta"]}</p>
{_cta_button(s["button"], url, variant="primary", is_rtl=is_rtl)}
{_security_note(s["security"], label="SECURITY", border="#2563EB", bg="#EFF6FF", lbl_bg="#2563EB", txt_color="#1E40AF", is_rtl=is_rtl)}
{_fallback_link(s["alt_link"], url)}
<p class="email-text" style="margin:18px 0 0;color:#94A3B8;font-size:13px;">{s["ignore"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _reset_content(
    name: str,
    url: str,
    email_addr: str = "",
    s: Optional[dict] = None,
    email: str = "",
    is_rtl: bool = False,
) -> str:
    s = s or {}
    addr = email_addr or email
    safe_addr = f"<bdi dir='ltr'>{_safe(addr)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0F172A;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["body"].format(email=safe_addr)}</p>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["cta"]}</p>
{_cta_button(s["button"], url, variant="primary", is_rtl=is_rtl)}
{_security_note(s["security"], label="EXPIRES SOON", border="#EF4444", bg="#FEF2F2", lbl_bg="#EF4444", txt_color="#991B1B", is_rtl=is_rtl)}
<p class="email-text" style="margin:18px 0 0;color:#94A3B8;font-size:13px;">{s["ignore"]}</p>
{_fallback_link(s["alt_link"], url)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _invite_content(
    org_name: str, inviter_name: str, role: str, url: str, s: dict, is_rtl: bool = False
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0F172A;line-height:1.3;">{s["heading"]}</p>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["body"].format(inviter_name=inviter_name)}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;width:100%;">
  <tr><td style="padding:24px;text-align:center;">
    <p class="email-heading" style="margin:0 0 4px;font-size:19px;font-weight:800;color:#0F172A;">{_safe(org_name)}</p>
    <p style="margin:0 0 14px;font-size:13px;color:#64748B;">{s["invited_by"].format(inviter_name=inviter_name)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td style="background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF;padding:5px 16px;border-radius:9999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">{_safe(role)}</td></tr>
    </table>
  </td></tr>
</table>
<p class="email-text" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">{s["collab_note"]}</p>
{_cta_button(s["button"], url, variant="primary", is_rtl=is_rtl)}
{_fallback_link(s["alt_link"], url)}
<p class="email-text" style="margin:18px 0 0;color:#94A3B8;font-size:13px;">{s["ignore"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _contact_content(
    name: str,
    email_addr: str,
    phone: str,
    subject: str,
    category: str,
    message: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    phone_display = (
        f"<bdi dir='ltr'>{_safe(phone)}</bdi>"
        if phone
        else f'<span style="color:#9CA3AF;">{_safe(s["not_provided"])}</span>'
    )
    cat_display = category or s["general_inquiry"]
    subj_display = subject or s["no_subject"]
    safe_msg = _safe(message).replace("\n", "<br>")
    short_name = name.split()[0] if name.split() else "Sender"
    align = "text-align: right;" if is_rtl else "text-align: left;"

    return f"""
<table class="email-card email-text" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;width:100%;">
  <tr>
    <td style="padding:14px 18px;width:50%;{align}">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;font-weight:700;">{_safe(s["name_label"])}</div>
      <div class="email-heading" style="font-size:15px;font-weight:700;color:#0F172A;">{_safe(name)}</div>
    </td>
    <td style="padding:14px 18px;width:50%;{align}">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;font-weight:700;">{_safe(s["email_label"])}</div>
      <div class="email-heading" style="font-size:15px;font-weight:700;color:#0F172A;"><bdi dir="ltr">{_safe(email_addr)}</bdi></div>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;width:50%;{align}">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;font-weight:700;">{_safe(s["phone_label"])}</div>
      <div style="font-size:15px;font-weight:600;color:#0F172A;">{phone_display}</div>
    </td>
    <td style="padding:14px 18px;width:50%;{align}">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;font-weight:700;">{_safe(s["category_label"])}</div>
      <div style="font-size:15px;font-weight:600;color:#0F172A;">{_safe(cat_display)}</div>
    </td>
  </tr>
</table>
<div style="margin-bottom:20px;{align}">
  <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;font-weight:700;">{_safe(s["subject_label"])}</div>
  <div style="font-size:18px;font-weight:800;color:#2563EB;">{_safe(subj_display)}</div>
</div>
{_card(s["message_label"], f"<div style='white-space:pre-wrap;'>{safe_msg}</div>", border_color="#2563EB", is_rtl=is_rtl)}
{_cta_button(s["reply_button"].format(name=short_name), f"mailto:{email_addr}", variant="primary", is_rtl=is_rtl)}
{_security_note(s["action_required"], label="ACTION", border="#2563EB", bg="#EFF6FF", lbl_bg="#2563EB", txt_color="#1E40AF", is_rtl=is_rtl)}"""


def _otp_content(code: str, s: dict, is_rtl: bool = False) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0F172A;line-height:1.3;">{s["heading"]}</p>
<p class="email-text" style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.65;">{s["body"]}</p>
<table class="email-code-box" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;background:#F8FAFC;border:2px dashed #2563EB;border-radius:14px;width:100%;max-width:380px;">
  <tr>
    <td style="padding:24px 28px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
        <tr>
          <td style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);border-radius:9999px;padding:3px 12px;font-size:10px;font-weight:800;letter-spacing:0.12em;color:#2563EB;text-transform:uppercase;">
            VERIFICATION CODE
          </td>
        </tr>
      </table>
      <div class="email-code" style="font-size:38px;font-weight:900;color:#0F172A;font-family:'DM Mono','SF Mono',Consolas,Menlo,Monaco,monospace;letter-spacing:12px;text-align:center;mso-text-raise:6px;"><!-- --><bdi dir="ltr">{_safe(code)}</bdi><!-- --></div>
      <p style="margin:10px 0 0;font-size:11px;color:#64748B;font-weight:600;letter-spacing:0.04em;">🔒 SINGLE-USE &middot; EXPIRES IN 10 MINUTES</p>
    </td>
  </tr>
</table>
{_security_note(s["expiry"], label="EXPIRES SOON", border="#EF4444", bg="#FEF2F2", lbl_bg="#EF4444", txt_color="#991B1B", is_rtl=is_rtl)}
{_security_note(s["warning"], label="IMPORTANT", border="#F59E0B", bg="#FFFBEB", lbl_bg="#F59E0B", txt_color="#92400E", is_rtl=is_rtl)}
<p class="email-text" style="margin:18px 0 0;color:#94A3B8;font-size:13px;">{s["not_you"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _new_device_content(
    name: str,
    device: str,
    browser: str,
    os: str,
    ip: str,
    location: str,
    time: str,
    url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    raw_text = s.get("text", "")
    try:
        formatted_text = raw_text.format(
            name=name,
            device=device,
            browser=browser,
            os=os,
            ip=ip,
            location=location,
            time=time,
        )
    except Exception:
        formatted_text = raw_text

    paragraphs = [p.strip() for p in formatted_text.split("\n\n") if p.strip()]
    body_preview = ""
    for p in reversed(paragraphs):
        if not (
            p.startswith("—")
            or p.startswith("-")
            or p.startswith("Device:")
            or p.startswith("الجهاز:")
            or p.startswith("Appareil:")
            or p.startswith("Allal:")
        ):
            body_preview = p
            break
    if not body_preview:
        body_preview = s.get("body", "")
    safe_ip = f"<bdi dir='ltr'>{_safe(ip)}</bdi>"
    safe_time = f"<bdi dir='ltr'>{_safe(time)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["device_label"], _safe(device), is_rtl=is_rtl)}
      {_info_row(s["browser_label"], _safe(browser), is_rtl=is_rtl)}
      {_info_row(s["os_label"], _safe(os), is_rtl=is_rtl)}
      {_info_row(s["ip_label"], safe_ip, is_rtl=is_rtl)}
      {_info_row(s["location_label"], _safe(location), is_rtl=is_rtl)}
      {_info_row(s["time_label"], safe_time, is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{body_preview}</p>
{_cta_button(s["secure_button"], url, variant="destructive", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _password_changed_content(
    name: str,
    time_val: str,
    ip_val: str,
    reset_url: str,
    support_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_ip = f"<bdi dir='ltr'>{_safe(ip_val)}</bdi>"
    safe_time = f"<bdi dir='ltr'>{_safe(time_val)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["time_label"], safe_time, is_rtl=is_rtl)}
      {_info_row(s["ip_label"], safe_ip, is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_divider()}
<p class="email-heading" style="margin:0 0 8px;font-size:16px;font-weight:700;color:#EF4444;">{s["not_you"]}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["not_you_body"]}</p>
{_cta_button(s["reset_link"], reset_url, variant="destructive", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _email_changed_content(
    name: str,
    old_email: str,
    new_email: str,
    time_val: str,
    support_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_old = f"<bdi dir='ltr'>{_safe(old_email)}</bdi>"
    safe_new = f"<bdi dir='ltr'>{_safe(new_email)}</bdi>"
    safe_time = f"<bdi dir='ltr'>{_safe(time_val)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["old_email_label"], safe_old, is_rtl=is_rtl)}
      {_info_row(s["new_email_label"], safe_new, is_rtl=is_rtl)}
      {_info_row(s["time_label"], safe_time, is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_divider()}
<p class="email-heading" style="margin:0 0 8px;font-size:16px;font-weight:700;color:#EF4444;">{s["not_you"]}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["not_you_body"]}</p>
{_cta_button(s["support_link"], support_url, variant="destructive", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _account_deleted_content(
    name: str,
    deletion_date: str,
    recover_url: str,
    feedback_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;width:100%;">
  <tr><td style="padding:20px;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#991B1B;">{s["recovery_window"]}</p>
    <p style="margin:0;font-size:15px;color:#991B1B;">{s["recovery_body"]}</p>
  </td></tr>
</table>
{_cta_button(s["recover_button"], recover_url, variant="destructive", is_rtl=is_rtl)}
{_divider()}
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["feedback"]}</p>
{_cta_button(s["support_link"], feedback_url, variant="secondary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _welcome_content(
    name: str, url: str, support_url: str, s: dict, is_rtl: bool = False
) -> str:
    FRONTEND = setting.FRONTEND_URL.rstrip("/")
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 24px;color:#374151;">{s["body"]}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;">
  <tr>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["learn_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["learn_desc"])}</p>
          <a href="{FRONTEND}/learn" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["learn_cta"])}</a>
        </td></tr>
      </table>
    </td>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["bi_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["bi_desc"])}</p>
          <a href="{FRONTEND}/bi" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["bi_cta"])}</a>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["hub_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["hub_desc"])}</p>
          <a href="{FRONTEND}/hub" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["hub_cta"])}</a>
        </td></tr>
      </table>
    </td>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["profile_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["profile_desc"])}</p>
          <a href="{FRONTEND}/settings" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["profile_cta"])}</a>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<p class="email-text" style="margin:24px 0 0;color:#6B7280;font-size:14px;">{s["support"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _welcome_d1_content(
    name: str, url: str, support_url: str, s: dict, is_rtl: bool = False
) -> str:
    FRONTEND = setting.FRONTEND_URL.rstrip("/")
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 24px;color:#374151;">{s["body"]}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;">
  <tr>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["tip1_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["tip1_desc"])}</p>
          <a href="{FRONTEND}/learn" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["tip1_cta"])}</a>
        </td></tr>
      </table>
    </td>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["tip2_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["tip2_desc"])}</p>
          <a href="{FRONTEND}/hub" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["tip2_cta"])}</a>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<p class="email-text" style="margin:24px 0 0;color:#6B7280;font-size:14px;">{s["support"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _welcome_d3_content(
    name: str, url: str, support_url: str, s: dict, is_rtl: bool = False
) -> str:
    FRONTEND = setting.FRONTEND_URL.rstrip("/")
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 24px;color:#374151;">{s["body"]}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;">
  <tr>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["community_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["community_desc"])}</p>
          <a href="{FRONTEND}/community" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["community_cta"])}</a>
        </td></tr>
      </table>
    </td>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["network_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["network_desc"])}</p>
          <a href="{FRONTEND}/hub/network" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["network_cta"])}</a>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<p class="email-text" style="margin:24px 0 0;color:#6B7280;font-size:14px;">{s["support"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _welcome_d7_content(
    name: str, url: str, support_url: str, s: dict, is_rtl: bool = False
) -> str:
    FRONTEND = setting.FRONTEND_URL.rstrip("/")
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 24px;color:#374151;">{s["body"]}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;">
  <tr>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["premium_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["premium_desc"])}</p>
          <a href="{FRONTEND}/pricing" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["premium_cta"])}</a>
        </td></tr>
      </table>
    </td>
    <td class="email-stack-td" style="width:50%;padding:6px;vertical-align:top;">
      <table class="email-card email-stack" role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
        <tr><td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111827;">{_safe(s["portal_title"])}</p>
          <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">{_safe(s["portal_desc"])}</p>
          <a href="{FRONTEND}/bi" style="display:inline-block;padding:8px 20px;background:#2563EB;border-radius:6px;color:#FFFFFF !important;text-decoration:none;font-size:12px;font-weight:600;">{_safe(s["portal_cta"])}</a>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<p class="email-text" style="margin:24px 0 0;color:#6B7280;font-size:14px;">{s["support"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _invite_accepted_content(
    user_name: str,
    inviter_name: str,
    org_name: str,
    role: str,
    manage_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"]}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(user_name=user_name, org_name=org_name, role=role)}</p>
{_cta_button(s["manage_button"], manage_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _member_removed_content(
    name: str, org_name: str, support_url: str, s: dict, is_rtl: bool = False
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(org_name=org_name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["reason_body"]}</p>
{_cta_button(s["support_button"], support_url, variant="secondary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _role_changed_content(
    name: str,
    org_name: str,
    old_role: str,
    new_role: str,
    org_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(org_name=org_name)}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["old_role_label"], _safe(old_role), is_rtl=is_rtl)}
      {_info_row(s["new_role_label"], f'<span style="color:#2563EB;font-weight:700;">{_safe(new_role)}</span>', is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_cta_button(s["org_button"], org_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _enrollment_content(
    name: str, course_name: str, url: str, s: dict, is_rtl: bool = False
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(course_name=course_name)}</p>
{_cta_button(s["start_button"], url, variant="primary", is_rtl=is_rtl)}
<p class="email-text" style="margin:16px 0 0;color:#6B7280;font-size:14px;">{s["progress_tip"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _completion_content(
    name: str,
    course_name: str,
    score: str,
    cert_url: str,
    explore_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(course_name=course_name)}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;width:auto;">
  <tr><td style="padding:16px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">{_safe(s["score_label"])}</p>
    <p style="margin:0;font-size:32px;font-weight:800;color:#10B981;"><bdi dir="ltr">{_safe(score)}</bdi></p>
  </td></tr>
</table>
{_cta_button(s["certificate_button"], cert_url, variant="success", is_rtl=is_rtl)}
{_divider()}
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["next_steps"]}</p>
{_cta_button(s["explore_button"], explore_url, variant="secondary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _refund_content(
    name: str,
    amount: str,
    transaction_id: str,
    refund_id: str,
    billing_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_amount = f"<bdi dir='ltr'>{_safe(amount)}</bdi>"
    safe_tx = f"<bdi dir='ltr'>{_safe(transaction_id)}</bdi>"
    safe_ref = f"<bdi dir='ltr'>{_safe(refund_id)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["amount_label"], f'<span style="font-size:18px;font-weight:800;color:#111827;">{safe_amount}</span>', is_rtl=is_rtl)}
      {_info_row(s["transaction_label"], f'<span style="font-size:12px;color:#6B7280;font-family:monospace;">{safe_tx}</span>', is_rtl=is_rtl)}
      {_info_row(s["refund_label"], f'<span style="font-size:12px;color:#6B7280;font-family:monospace;">{safe_ref}</span>', is_rtl=is_rtl)}
      {_info_row(s["status_label"], f'<span style="color:#F97316;font-weight:600;">{_safe(s["status_refunded"])}</span>', is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_cta_button(s["wallet_button"], billing_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _payment_content(
    name: str,
    amount: str,
    item: str,
    date_val: str,
    transaction_id: str,
    receipt_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_amount = f"<bdi dir='ltr'>{_safe(amount)}</bdi>"
    safe_date = f"<bdi dir='ltr'>{_safe(date_val)}</bdi>"
    safe_tx = f"<bdi dir='ltr'>{_safe(transaction_id)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["amount_label"], f'<span style="font-size:18px;font-weight:800;color:#111827;">{safe_amount}</span>', is_rtl=is_rtl)}
      {_info_row(s["item_label"], _safe(item), is_rtl=is_rtl)}
      {_info_row(s["date_label"], safe_date, is_rtl=is_rtl)}
      {_info_row(s["transaction_label"], f'<span style="font-size:12px;color:#6B7280;font-family:monospace;">{safe_tx}</span>', is_rtl=is_rtl)}
      {_info_row(s["status_label"], f'<span style="color:#10B981;font-weight:600;">{_safe(s["status_paid"])}</span>', is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_cta_button(s["receipt_button"], receipt_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _subscription_content(
    name: str,
    plan: str,
    amount: str,
    status: str,
    started: str,
    renewal: str,
    manage_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_amount = f"<bdi dir='ltr'>{_safe(amount)}</bdi>"
    safe_started = f"<bdi dir='ltr'>{_safe(started)}</bdi>"
    safe_renewal = f"<bdi dir='ltr'>{_safe(renewal)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"]}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["plan_label"], f'<span style="font-size:16px;font-weight:700;color:#111827;">{_safe(plan)}</span>', is_rtl=is_rtl)}
      {_info_row(s["amount_label"], safe_amount, is_rtl=is_rtl)}
      {_info_row(s["status_label"], _safe(status), is_rtl=is_rtl)}
      {_info_row(s["started_label"], safe_started, is_rtl=is_rtl)}
      {_info_row(s["renewal_label"], safe_renewal, is_rtl=is_rtl)}
    </table>
  </td></tr>
</table>
{_cta_button(s["manage_button"], manage_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _csat_survey_content(
    user_name: str,
    ticket_subject: str,
    ticket_number: str,
    rating_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_ticket = f"<bdi dir='ltr'>#{_safe(ticket_number)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(user_name=user_name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(ticket_number=safe_ticket, ticket_subject=ticket_subject)}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;width:100%;">
  <tr><td style="padding:24px;text-align:center;">
    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#166534;">{_safe(s["rating_question"])}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td style="font-size:28px;letter-spacing:8px;text-align:center;">
        <span style="color:#2563EB;cursor:default;">&#x2605; &#x2605; &#x2605; &#x2605; &#x2605;</span>
      </td></tr>
    </table>
  </td></tr>
</table>
{_cta_button(s["rating_button"], rating_url, variant="primary", is_rtl=is_rtl)}
<p class="email-text" style="margin:16px 0 0;color:#6B7280;font-size:14px;">{s["feedback_note"]}</p>
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _proposal_content(
    name: str,
    project_title: str,
    freelancer: str,
    amount: str,
    message: str,
    review_url: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_msg = _safe(message[:500] if message else "")
    safe_amount = f"<bdi dir='ltr'>{_safe(amount)}</bdi>"
    return f"""
<p class="email-heading" style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">{s["heading"].format(name=name)}</p>
<p class="email-text" style="margin:0 0 16px;color:#374151;">{s["body"].format(project_title=project_title)}</p>
<table class="email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;width:100%;">
  <tr><td style="padding:16px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      {_info_row(s["freelancer_label"], _safe(freelancer), is_rtl=is_rtl)}
      {_info_row(s["amount_label"], safe_amount, is_rtl=is_rtl)}
    </table>
    {f'<div style="margin-top:12px;padding:12px;background:#FFFFFF;border-radius:6px;border:1px solid #E5E7EB;font-size:13px;color:#374151;line-height:1.5;">{safe_msg}</div>' if message else ''}
  </td></tr>
</table>
{_cta_button(s["review_button"], review_url, variant="primary", is_rtl=is_rtl)}
{_regards(s["regards"], is_rtl=is_rtl)}"""


def _newsletter_content(name: str, s: dict, is_rtl: bool = False) -> str:
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="email-padding" style="padding:0 32px;">
    <p class="email-text" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      {_safe(s['body'])}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="padding:20px;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#111827;">
            {_safe(s['whatsnext_title'])}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:4px 0;font-size:13px;color:#374151;">{_safe(s['whatsnext_1'])}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#374151;">{_safe(s['whatsnext_2'])}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#374151;">{_safe(s['whatsnext_3'])}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#374151;">{_safe(s['whatsnext_4'])}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <p class="email-muted" style="margin:16px 0 0;font-size:12px;color:#6B7280;">
      {_safe(s['prefs'])}
    </p>
  </td></tr>
</table>
{_regards(s['footer'], is_rtl=is_rtl)}"""


def _waitlist_content(
    name: str, referral_code: str, queue_position: int, s: dict, is_rtl: bool = False
) -> str:
    share_link = f"https://podacium.com/waitlist?ref={referral_code}"
    safe_pos = f"<bdi dir='ltr'>#{queue_position}</bdi>"
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="email-padding" style="padding:0 32px;">
    <p class="email-text" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      {_safe(s['greeting'])}
    </p>
    <p class="email-text" style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      {s['position_info'].format(position=safe_pos)}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="padding:20px;background:#EFF6FF;border-radius:12px;border:1px solid #BFDBFE;text-align:center;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1D4ED8;">
            {_safe(s['share_title'])}
          </p>
          <p style="margin:0;font-size:14px;color:#1E40AF;word-break:break-all;">
            <bdi dir="ltr">{_safe(share_link)}</bdi>
          </p>
        </td>
      </tr>
    </table>

    {_cta_button(s['share_button'], share_link, variant="primary", is_rtl=is_rtl)}

    <p class="email-text" style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#374151;">
      {_safe(s['reward_info'])}
    </p>

    <p class="email-muted" style="margin:16px 0 0;font-size:12px;color:#6B7280;white-space:pre-line;">
      {_safe(s['whats_next'])}
    </p>

    <p class="email-muted" style="margin:16px 0 0;font-size:12px;color:#6B7280;">
      {_safe(s['prefs'])}
    </p>
  </td></tr>
</table>
{_regards(s['footer'], is_rtl=is_rtl)}"""


def _waitlist_drip_content(
    name: str, referral_code: str, s: dict, is_rtl: bool = False
) -> str:
    share_link = f"https://podacium.com/waitlist?ref={referral_code}"
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="email-padding" style="padding:0 32px;">
    <p class="email-text" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      {_safe(s['heading'].format(name=name))}
    </p>
    <p class="email-text" style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      {_safe(s['body'])}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="padding:20px;background:#EFF6FF;border-radius:12px;border:1px solid #BFDBFE;text-align:center;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1D4ED8;">
            {_safe(s['referral_label'])}
          </p>
          <p style="margin:0;font-size:14px;color:#1E40AF;word-break:break-all;">
            <bdi dir="ltr">{_safe(share_link)}</bdi>
          </p>
        </td>
      </tr>
    </table>

    {_cta_button(s['referral_button'], share_link, variant="primary", is_rtl=is_rtl)}

    <p class="email-text" style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#374151;">
      {_safe(s['referral_info'])}
    </p>
  </td></tr>
</table>"""


def _magic_link_content(
    name: str,
    magic_url: str,
    expires_in_minutes: int,
    client_ip: str,
    s: dict,
    is_rtl: bool = False,
) -> str:
    safe_ip = f"<bdi dir='ltr'>{_safe(client_ip)}</bdi>" if client_ip else ""
    return f"""<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr><td>
    <p class="email-heading" style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0F172A;line-height:1.3;">
      {s.get('greeting', 'Hello {name},').format(name=_safe(name))}
    </p>
    <p class="email-text" style="margin:0 0 24px;font-size:16px;line-height:24px;color:#334151;">
      {s.get('body', 'Click the button below to instantly sign in to your Podacium account without a password.')}
    </p>
    {_cta_button(s.get('cta', 'Sign In to Podacium'), magic_url, variant="primary", is_rtl=is_rtl)}
    {_security_note(
        s.get('expiry', 'This link is single-use and will expire in {expires_in_minutes} minutes.').format(expires_in_minutes=expires_in_minutes),
        label="EXPIRES SOON",
        border="#2563EB",
        bg="#EFF6FF",
        lbl_bg="#2563EB",
        txt_color="#1E40AF",
        is_rtl=is_rtl
    )}
    {_fallback_link("If the button above does not work, copy and paste this link:", magic_url)}
    <p class="email-muted" style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">
      {s.get('security_note', 'If you did not request this link, you can safely ignore this email.')} {f'Request originated from IP: {safe_ip}' if safe_ip else ''}
    </p>
  </td></tr>
</table>"""


# ─── Public API ────────────────────────────────────────────────────────────────

EMAIL_BUILDERS = {
    "verify": {
        "content": lambda name, url, email, s, is_rtl=False: _verify_content(
            name, url, email, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "magic_link": {
        "content": lambda name,
        magic_url,
        expires_in_minutes,
        client_ip,
        s,
        is_rtl=False: _magic_link_content(
            name, magic_url, expires_in_minutes, client_ip, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "reset": {
        "content": lambda name,
        url,
        email="",
        email_addr="",
        s=None,
        is_rtl=False: _reset_content(
            name, url, email_addr=email_addr or email, s=s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "invite": {
        "content": lambda org_name,
        inviter_name,
        role,
        url,
        email,
        s,
        is_rtl=False: _invite_content(
            org_name, inviter_name, role, url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "contact": {
        "content": lambda name,
        email_addr,
        phone,
        subject,
        category,
        message,
        s,
        is_rtl=False: _contact_content(
            name, email_addr, phone, subject, category, message, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "otp": {
        "content": lambda code, s, is_rtl=False: _otp_content(code, s, is_rtl=is_rtl),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "new_device": {
        "content": lambda name,
        device,
        browser,
        os,
        ip,
        location,
        time,
        url,
        s,
        is_rtl=False: _new_device_content(
            name, device, browser, os, ip, location, time, url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "password_changed": {
        "content": lambda name,
        time_val,
        ip_val,
        reset_url,
        support_url,
        s,
        is_rtl=False: _password_changed_content(
            name, time_val, ip_val, reset_url, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "email_changed": {
        "content": lambda name,
        old_email,
        new_email,
        time_val,
        support_url,
        s,
        is_rtl=False: _email_changed_content(
            name, old_email, new_email, time_val, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "account_deleted": {
        "content": lambda name,
        deletion_date,
        recover_url,
        feedback_url,
        s,
        is_rtl=False: _account_deleted_content(
            name, deletion_date, recover_url, feedback_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "welcome": {
        "content": lambda name, url, support_url, s, is_rtl=False: _welcome_content(
            name, url, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "welcome_d1": {
        "content": lambda name, url, support_url, s, is_rtl=False: _welcome_d1_content(
            name, url, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "welcome_d3": {
        "content": lambda name, url, support_url, s, is_rtl=False: _welcome_d3_content(
            name, url, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "welcome_d7": {
        "content": lambda name, url, support_url, s, is_rtl=False: _welcome_d7_content(
            name, url, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "invite_accepted": {
        "content": lambda user_name,
        inviter_name,
        org_name,
        role,
        manage_url,
        s,
        is_rtl=False: _invite_accepted_content(
            user_name, inviter_name, org_name, role, manage_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "member_removed": {
        "content": lambda name,
        org_name,
        support_url,
        s,
        is_rtl=False: _member_removed_content(
            name, org_name, support_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "role_changed": {
        "content": lambda name,
        org_name,
        old_role,
        new_role,
        org_url,
        s,
        is_rtl=False: _role_changed_content(
            name, org_name, old_role, new_role, org_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "enrollment": {
        "content": lambda name, course_name, url, s, is_rtl=False: _enrollment_content(
            name, course_name, url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "completion": {
        "content": lambda name,
        course_name,
        score,
        cert_url,
        explore_url,
        s,
        is_rtl=False: _completion_content(
            name, course_name, score, cert_url, explore_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "refund": {
        "content": lambda name,
        amount,
        transaction_id,
        refund_id,
        billing_url,
        s,
        is_rtl=False: _refund_content(
            name, amount, transaction_id, refund_id, billing_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "payment": {
        "content": lambda name,
        amount,
        item,
        date_val,
        transaction_id,
        receipt_url,
        s,
        is_rtl=False: _payment_content(
            name, amount, item, date_val, transaction_id, receipt_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "subscription": {
        "content": lambda name,
        plan,
        amount,
        status,
        started,
        renewal,
        manage_url,
        s,
        is_rtl=False: _subscription_content(
            name, plan, amount, status, started, renewal, manage_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "csat_survey": {
        "content": lambda user_name,
        ticket_subject,
        ticket_number,
        rating_url,
        s,
        is_rtl=False: _csat_survey_content(
            user_name, ticket_subject, ticket_number, rating_url, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "newsletter": {
        "content": lambda name, s, is_rtl=False: _newsletter_content(
            name, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "proposal": {
        "content": lambda name,
        project_title,
        freelancer,
        amount,
        message,
        review_url,
        s,
        is_rtl=False: _proposal_content(
            name,
            project_title,
            freelancer,
            amount,
            message,
            review_url,
            s,
            is_rtl=is_rtl,
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "waitlist_confirmation": {
        "content": lambda name,
        referral_code,
        queue_position,
        s,
        is_rtl=False: _waitlist_content(
            name, referral_code, queue_position, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "waitlist_drip_day3": {
        "content": lambda name, referral_code, s, is_rtl=False: _waitlist_drip_content(
            name, referral_code, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "waitlist_drip_day7": {
        "content": lambda name, referral_code, s, is_rtl=False: _waitlist_drip_content(
            name, referral_code, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "waitlist_drip_day14": {
        "content": lambda name, referral_code, s, is_rtl=False: _waitlist_drip_content(
            name, referral_code, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
    "waitlist_drip_day30": {
        "content": lambda name, referral_code, s, is_rtl=False: _waitlist_drip_content(
            name, referral_code, s, is_rtl=is_rtl
        ),
        "preheader_key": "preheader",
        "badge_key": "badge",
        "title_key": "title",
        "subject_key": "subject",
    },
}


def _get_email_kwargs(email_type: str, s: dict) -> dict:
    """Build the extra kwargs for render_base from localized strings."""
    cfg = EMAIL_BUILDERS.get(email_type, {})
    return {
        "title": s.get(cfg.get("title_key", "title"), ""),
        "badge": s.get(cfg.get("badge_key", "badge")),
        "preheader": s.get(cfg.get("preheader_key", "preheader")),
    }


def render_email(
    email_type: str,
    *,
    locale: str = "en",
    recipient_email: str = "",
    **kwargs,
) -> tuple:
    """Render a complete email.

    Args:
        email_type: One of the keys in EMAIL_BUILDERS.
        locale: User locale.
        recipient_email: Recipient for footer.
        **kwargs: Content arguments passed to the builder.

    Returns:
        Tuple of (subject: str, plain_text: str, html: str)
    """
    s = get_email_strings(locale, email_type)
    cfg = EMAIL_BUILDERS.get(email_type)
    if not cfg:
        raise ValueError(f"Unknown email type: {email_type}")

    # Build HTML — only pass kwargs the content function expects
    is_rtl = locale == "ar"
    direction = _dir_from_locale(locale)
    content_fn: Any = cfg["content"]
    sig = inspect.signature(content_fn)
    filtered = {k: v for k, v in kwargs.items() if k in sig.parameters and k != "s"}
    if "is_rtl" in sig.parameters and "is_rtl" not in filtered:
        filtered["is_rtl"] = is_rtl
    if "direction" in sig.parameters and "direction" not in filtered:
        filtered["direction"] = direction

    content_html = content_fn(**filtered, s=s)
    base_kwargs = _get_email_kwargs(email_type, s)
    html = render_base(
        content_html,
        base_kwargs["title"],
        badge=base_kwargs["badge"],
        preheader=base_kwargs["preheader"],
        email=recipient_email,
        locale=locale,
    )

    # Build subject
    subject_key = cfg.get("subject_key", "subject")
    subject = s.get(subject_key, "")
    # Format subject with any kwargs that match
    try:
        subject = subject.format(**kwargs)
    except (KeyError, ValueError):
        pass

    # Build plain text fallback
    text_key = "text"
    text = s.get(text_key, "")
    try:
        text = text.format(**kwargs)
    except (KeyError, ValueError):
        pass

    return subject, text, html
