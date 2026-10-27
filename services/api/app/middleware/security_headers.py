"""Security headers middleware — injects enterprise-grade headers on every response."""

import os
from fastapi import Request


async def security_headers_middleware(request: Request, call_next):
    """Inject security headers into every HTTP response."""
    response = await call_next(request)

    # Relax CSP in development (Next.js dev server uses eval for HMR)
    is_dev = os.environ.get("ENVIRONMENT", "").lower() in ("development", "dev", "")

    # HSTS (1 year, include subdomains, preload-ready)
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )

    # Prevent Clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Prevent MIME-sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Content Security Policy
    csp_directives = [
        "default-src 'self'",
        "font-src 'self' https://fonts.gstatic.com",
        "base-uri 'self'",
        "form-action 'self'",
    ]

    if is_dev:
        # Development: allow eval for Next.js Fast Refresh / HMR, localhost media and frames
        csp_directives.append(
            "img-src 'self' data: https: blob: http://localhost:* http://127.0.0.1:*"
        )
        csp_directives.append(
            "media-src 'self' data: https: blob: http://localhost:* http://127.0.0.1:*"
        )
        csp_directives.append("script-src 'self' 'unsafe-eval' 'unsafe-inline'")
        csp_directives.append(
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
        )
        csp_directives.append(
            "connect-src 'self' https: http://localhost:* ws://localhost:* wss:"
        )
        csp_directives.append(
            "frame-src 'self' blob: data: http://localhost:* http://127.0.0.1:* https://player.vimeo.com https://*.vimeo.com https://challenges.cloudflare.com"
        )
        csp_directives.append(
            "frame-ancestors 'self' http://localhost:3000 http://localhost:3001 http://127.0.0.1:3000 http://127.0.0.1:3001"
        )
    else:
        # Production: allow inline scripts/styles for Next.js 15 hydration & dynamic styles
        csp_directives.append("img-src 'self' data: https: blob:")
        csp_directives.append("media-src 'self' data: https: blob:")
        csp_directives.append(
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://client.crisp.chat https://*.vimeo.com https://player.vimeo.com https://challenges.cloudflare.com"
        )
        csp_directives.append(
            "frame-src 'self' blob: data: https: https://player.vimeo.com https://*.vimeo.com https://challenges.cloudflare.com"
        )
        csp_directives.append(
            "frame-ancestors 'self' https://podacium.com https://*.podacium.com"
        )
        csp_directives.append(
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
        )
        csp_directives.append("connect-src 'self' https: wss:")
        csp_directives.append("upgrade-insecure-requests")
        csp_directives.append("report-to csp-endpoint")

    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

    # Permissions Policy (restrict browser features, block advertising APIs)
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    return response
