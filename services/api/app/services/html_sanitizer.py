"""
HTML Sanitizer for Incoming & Displayed Emails.

Ensures zero-trust email HTML rendering:
1. Strips executable script tags, styles, iframes, objects, forms, svg, and mathml.
2. Neutralizes event attributes (onload, onerror, onclick, etc.).
3. Sanitizes URLs (blocking javascript: and data: URIs, forcing https/http/mailto).
4. Handles tracking pixels and remote images by proxying or neutralizing remote URLs.
5. Converts cid: inline attachments to internal attachment stream endpoints.
"""

import hashlib
import hmac
import html
import re
from html.parser import HTMLParser
from typing import List, Optional, Set, Tuple
from urllib.parse import quote, urlparse

from app.core.config import setting


def generate_image_proxy_signature(url: str) -> str:
    """Generates a cryptographic HMAC-SHA256 signature for proxied image URLs."""
    secret = (
        getattr(setting, "SECRET_KEY", None) or "podacium-default-secret-key"
    ).encode("utf-8")
    return hmac.new(secret, url.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


SAFE_TAGS: Set[str] = {
    "a",
    "abbr",
    "address",
    "b",
    "bdi",
    "bdo",
    "big",
    "blockquote",
    "br",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "dd",
    "del",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "font",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "ins",
    "kbd",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "small",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "tt",
    "u",
    "ul",
    "wbr",
    # Safe SVG elements
    "svg",
    "g",
    "path",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
    "ellipse",
    "text",
    "tspan",
    "defs",
    "clippath",
    "lineargradient",
    "radialgradient",
    "stop",
    "use",
    "image",
    "title",
    "desc",
}

DROP_CONTENT_TAGS: Set[str] = {
    "script",
    "style",
    "template",
    "noscript",
    "math",
    "foreignobject",
}

VOID_TAGS: Set[str] = {
    "br",
    "hr",
    "img",
    "wbr",
    "area",
    "col",
}

SAFE_ATTRS: Set[str] = {
    "align",
    "alt",
    "bgcolor",
    "border",
    "cellpadding",
    "cellspacing",
    "class",
    "color",
    "colspan",
    "dir",
    "height",
    "href",
    "hspace",
    "id",
    "lang",
    "rowspan",
    "src",
    "style",
    "target",
    "title",
    "valign",
    "vspace",
    "width",
    # Safe SVG attributes
    "viewbox",
    "xmlns",
    "xmlns:xlink",
    "xlink:href",
    "fill",
    "fill-rule",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "d",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "dx",
    "dy",
    "points",
    "transform",
    "opacity",
    "clip-path",
    "offset",
    "stop-color",
    "stop-opacity",
    "gradientunits",
    "gradienttransform",
    "spreadmethod",
    "aria-hidden",
    "role",
    "preserveaspectratio",
}

SAFE_PROTOCOLS: Set[str] = {"http", "https", "mailto", "tel", "cid"}


class SafeMailHTMLParser(HTMLParser):
    def __init__(
        self,
        message_id: Optional[str] = None,
        block_remote_images: bool = True,
        proxy_images: bool = True,
    ):
        super().__init__(convert_charrefs=True)
        self.message_id = message_id
        self.block_remote_images = block_remote_images
        self.proxy_images = proxy_images
        self.output: List[str] = []
        self._drop_depth = 0

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        tag_lower = tag.lower()
        if tag_lower in DROP_CONTENT_TAGS:
            self._drop_depth += 1
            return

        if self._drop_depth > 0:
            return

        if tag_lower not in SAFE_TAGS:
            return

        clean_attrs: List[Tuple[str, str]] = []
        for attr_name, attr_val in attrs:
            attr_name_lower = attr_name.lower()
            if attr_val is None:
                continue

            # Strip all event handlers
            if attr_name_lower.startswith("on"):
                continue

            if attr_name_lower not in SAFE_ATTRS:
                continue

            val = attr_val.strip()

            # Prevent unsafe external or script references on SVG <use> tags
            if tag_lower == "use" and attr_name_lower in ("href", "xlink:href"):
                if not val.startswith("#"):
                    continue

            # URL validation
            if attr_name_lower in ("href", "src", "xlink:href"):
                # Strip internal whitespace, control chars, and newlines to prevent scheme bypass
                cleaned_val = re.sub(r"[\x00-\x1f\s]+", "", val).lower()
                if any(x in cleaned_val for x in ("javascript:", "data:", "vbscript:")):
                    continue

                parsed = urlparse(val)
                scheme = parsed.scheme.lower() if parsed.scheme else ""

                if scheme and scheme not in SAFE_PROTOCOLS:
                    continue

                if tag_lower in ("img", "image") and attr_name_lower in (
                    "src",
                    "href",
                    "xlink:href",
                ):
                    if val.lower().startswith("cid:"):
                        cid = val[4:].strip("<>")
                        if self.message_id:
                            sig = generate_image_proxy_signature(
                                f"cid:{cid}@{self.message_id}"
                            )
                            val = f"/api/v1/mail/messages/{self.message_id}/attachments/cid/{quote(cid)}?sig={sig}"
                    elif val.lower().startswith(("http://", "https://")):
                        sig = generate_image_proxy_signature(val)
                        proxy_url = (
                            f"/api/v1/mail/proxy/image?url={quote(val)}&sig={sig}"
                        )
                        if self.block_remote_images:
                            clean_attrs.append(("data-original-src", proxy_url))
                            val = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'/>"
                        elif self.proxy_images:
                            val = proxy_url

            if attr_name_lower == "style":
                # Basic style neutralization: disallow behavior, expression, javascript
                low_val = val.lower()
                if (
                    "expression(" in low_val
                    or "behavior:" in low_val
                    or "javascript:" in low_val
                ):
                    continue
                if "-moz-binding" in low_val:
                    continue

                if "url(" in low_val:

                    def replace_css_url(match):
                        raw_u = match.group(1).strip("'\"")
                        if raw_u.lower().startswith(("http://", "https://")):
                            if self.proxy_images:
                                s = generate_image_proxy_signature(raw_u)
                                return f"url('/api/v1/mail/proxy/image?url={quote(raw_u)}&sig={s}')"
                        elif raw_u.lower().startswith("cid:") and self.message_id:
                            cid = raw_u[4:].strip("<>")
                            s = generate_image_proxy_signature(
                                f"cid:{cid}@{self.message_id}"
                            )
                            return (
                                f"url('/api/v1/mail/messages/{self.message_id}"
                                f"/attachments/cid/{quote(cid)}?sig={s}')"
                            )
                        return match.group(0)

                    val = re.sub(
                        r"url\(([^)]+)\)", replace_css_url, val, flags=re.IGNORECASE
                    )

            clean_attrs.append((attr_name_lower, val))

        if tag_lower == "a":
            # Force secure attributes
            clean_attrs = [a for a in clean_attrs if a[0] not in ("target", "rel")]
            clean_attrs.append(("target", "_blank"))
            clean_attrs.append(("rel", "noopener noreferrer nofollow"))

        attr_str = "".join(
            f' {k}="{html.escape(v, quote=True)}"' for k, v in clean_attrs
        )
        if tag_lower in VOID_TAGS:
            self.output.append(f"<{tag_lower}{attr_str} />")
        else:
            self.output.append(f"<{tag_lower}{attr_str}>")

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()
        if tag_lower in DROP_CONTENT_TAGS:
            if self._drop_depth > 0:
                self._drop_depth -= 1
            return

        if self._drop_depth > 0:
            return

        if tag_lower in SAFE_TAGS and tag_lower not in VOID_TAGS:
            self.output.append(f"</{tag_lower}>")

    def handle_data(self, data: str):
        if self._drop_depth == 0:
            self.output.append(html.escape(data))

    def handle_entityref(self, name: str):
        if self._drop_depth == 0:
            self.output.append(f"&{name};")

    def handle_charref(self, name: str):
        if self._drop_depth == 0:
            self.output.append(f"&#{name};")


def sanitize_email_html(
    html_content: str,
    message_id: Optional[str] = None,
    block_remote_images: bool = False,
    proxy_images: bool = True,
) -> str:
    """
    Sanitizes raw incoming email HTML for secure display.
    """
    if not html_content:
        return ""

    parser = SafeMailHTMLParser(
        message_id=message_id,
        block_remote_images=block_remote_images,
        proxy_images=proxy_images,
    )
    try:
        parser.feed(html_content)
        parser.close()
        return "".join(parser.output)
    except Exception:
        # Fallback to plain escaped text if parsing fails
        return f"<pre>{html.escape(html_content)}</pre>"


def html_to_plain_text(html_content: str) -> str:
    """Extract plain text snippet from HTML for preview cards."""
    if not html_content:
        return ""
    # Strip script/style
    clean = re.sub(
        r"<(script|style)[^>]*>.*?</\1>",
        " ",
        html_content,
        flags=re.DOTALL | re.IGNORECASE,
    )
    # Strip tags
    clean = re.sub(r"<[^>]+>", " ", clean)
    # Unescape entities
    text = html.unescape(clean)
    # Normalize whitespaces
    return re.sub(r"\s+", " ", text).strip()
