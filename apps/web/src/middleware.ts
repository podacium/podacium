import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import {
  resolveRoleGate,
  isRoleAllowedForPath,
} from "@/lib/navigation/role-access";

export {
  ROLE_GATES,
  resolveRoleGate,
  isRoleAllowedForPath,
} from "@/lib/navigation/role-access";
export type { RoleGate } from "@/lib/navigation/role-access";

const SUPPORTED_LOCALES = ["en", "fr", "ar", "kab"];

// Default policy: microphone allowed for self (voice notes, messaging across app); camera & geolocation blocked.
const PERMISSIONS_POLICY = "camera=(), microphone=(self), geolocation=()";
// Live rooms need camera/mic from the same origin; geolocation stays blocked.
const PERMISSIONS_POLICY_LIVE =
  "camera=(self), microphone=(self), geolocation=()";

// Paths that host a LiveKit room and therefore must not block camera.
// Only the room page (/live/<sessionId>/room) consumes camera.
function isLiveRoute(pathname: string): boolean {
  return (
    /^\/live\/[^/]+\/room\/?$/.test(pathname) ||
    /^\/(en|fr|ar|kab)\/live\/[^/]+\/room\/?$/.test(pathname)
  );
}

/** Pick the Permissions-Policy value for a given path (exported for tests). */
export function resolvePermissionsPolicy(pathname: string): string {
  if (isLiveRoute(pathname)) return PERMISSIONS_POLICY_LIVE;
  return PERMISSIONS_POLICY;
}

// ── Auth Protection ───────────────────────────────────────────────────────────
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/learn/create",
  "/learn/manage",
  "/profile/me",
  "/settings",
  "/notifications",
  "/onboarding",
  "/billing",
  "/payment",
  "/admin",
  "/hub/projects/new",
  "/hub/contracts",
  "/hub/messages",
  "/hub/proposals",
  "/bi/dashboards/new",
  "/bi/datasets/upload",
  "/bi/organizations",
  "/organizations",
  "/ai-analytics",
  "/live/create",
  "/live/my-sessions",
  "/live/bookings",
];

export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/profile") return true;
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  // Sub-actions on projects that require authentication
  if (/^\/hub\/projects\/[^/]+\/proposals(\/.*)?$/.test(pathname)) {
    return true;
  }
  return false;
}

// ── Role-based access control ───────────────────────────────────────────────
// SECURITY (P1): authentication alone must not grant access to privileged
// routes. The signed session JWT now carries the user's role, so the Edge
// can enforce route-level RBAC without trusting any client-side cookie.
// The gates live in `@/lib/navigation/role-access` so the navigation layer can
// hide links (and skip prefetches) the Edge would reject.

// ── Reverse Proxy Trusted CIDRs & Client IP Extraction (VULN-W2-10) ──────────
export const TRUSTED_PROXY_PREFIXES = [
  "127.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "::1",
];

export function resolveClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const hops = xForwardedFor
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i];
      const isTrusted = TRUSTED_PROXY_PREFIXES.some((prefix) =>
        hop.startsWith(prefix),
      );
      if (!isTrusted) {
        return hop;
      }
    }
    if (hops.length > 0) return hops[0];
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return (request as { ip?: string }).ip || "127.0.0.1";
}

/**
 * Verify a JWT token at the Edge using jose.
 *
 * The `podacium_session` cookie is a lightweight JWT set by the backend API
 * on the shared parent domain (.podacium.com). Unlike the httpOnly
 * __Host-access_token (scoped to backend-api.podacium.com), this cookie is readable
 * by the frontend domain but its VALUE is a signed JWT, so it cannot be forged.
 * Since it is signed by the backend, the `role` claim it carries is trusted.
 *
 * Falls back to the legacy auth_hint cookie when the env secret is not
 * configured — graceful degradation for local dev.
 *
 * Returns the decoded payload on success, or null when unauthenticated.
 */
/**
 * Resolves the edge secret used to verify the podacium_session JWT.
 * Falls back to deriving the 32-char sha256 hex string from SECRET_KEY
 * or JWT_SECRET_KEY, exactly mirroring the backend's _get_edge_secret().
 */
function toBase64Url(str: string): string {
  // Pure Web API base64url encoding (zero Node.js Buffer dependency)
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getEdgeSecret(): Promise<
  Uint8Array | { kty: string; k: string } | null
> {
  const secretHex = process.env.EDGE_AUTH_SECRET;
  if (secretHex) {
    return { kty: "oct", k: toBase64Url(secretHex) };
  }
  const fallback =
    process.env.SECRET_KEY ||
    process.env.JWT_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET;
  if (fallback) {
    try {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(fallback),
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
      return { kty: "oct", k: toBase64Url(hashHex) };
    } catch {
      return null;
    }
  }
  return null;
}

export type SessionData = {
  sub: string;
  role?: string;
  iat?: number;
  isVerified: boolean;
};

// In-memory revocation cache at the Edge with 2-second TTL
const revocationCache = new Map<
  string,
  { revokedAt: number | null; cachedAt: number }
>();
const REVOCATION_CACHE_TTL_MS = 2000;

export function clearRevocationCache(): void {
  revocationCache.clear();
}

/**
 * Check whether a user's session has been revoked at the Edge without hitting PostgreSQL.
 * Verifies that token.iat >= user_revoked_at.
 */
export async function isSessionRevoked(
  userId: string,
  tokenIat?: number,
): Promise<boolean> {
  if (
    tokenIat === undefined ||
    !userId ||
    userId === "authenticated-client" ||
    userId === "dev"
  ) {
    return false;
  }

  const now = Date.now();
  const cached = revocationCache.get(userId);
  let revokedAt: number | null = null;

  if (cached && now - cached.cachedAt < REVOCATION_CACHE_TTL_MS) {
    revokedAt = cached.revokedAt;
  } else {
    try {
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (upstashUrl && upstashToken) {
        const res = await fetch(`${upstashUrl}/get/user:${userId}:revoked_at`, {
          headers: { Authorization: `Bearer ${upstashToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.result !== null && data.result !== undefined) {
            revokedAt = Number(data.result);
          }
        }
      } else {
        const baseUrl =
          process.env.INTERNAL_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://127.0.0.1:8000";
        const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
        const res = await fetch(
          `${cleanBaseUrl}/api/v1/auth/session-revocation-status?user_id=${userId}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(1500),
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (
            data &&
            data.revoked_at !== null &&
            data.revoked_at !== undefined
          ) {
            revokedAt = Number(data.revoked_at);
          }
        }
      }
      revocationCache.set(userId, { revokedAt, cachedAt: now });
    } catch {
      // Network timeout / degraded: fail-open for connectivity glitch to avoid locking out valid users
      return false;
    }
  }

  if (revokedAt !== null && !isNaN(revokedAt)) {
    return tokenIat < revokedAt;
  }
  return false;
}

/**
 * Remove all authentication cookies from response.
 */
export function clearAuthCookies(response: NextResponse): void {
  const cookieNames = [
    "podacium_session",
    "__Host-podacium_session",
    "access_token",
    "__Host-access_token",
    "refresh_token",
    "__Host-refresh_token",
    "podacium_auth_hint",
  ];
  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      expires: new Date(0),
    });
    response.cookies.delete(name);
  }
}

/**
 * Verify a JWT token at the Edge using jose.
 *
 * The `podacium_session` cookie is a lightweight JWT set by the backend API
 * on the shared parent domain (.podacium.com).
 *
 * Returns the decoded payload on success, or null when unauthenticated.
 */
export async function getSession(
  request: NextRequest,
): Promise<SessionData | null> {
  const sessionToken =
    request.cookies.get("__Host-podacium_session")?.value ||
    request.cookies.get("podacium_session")?.value;
  const secret = await getEdgeSecret();

  if (secret && sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, secret, {
        algorithms: ["HS256"],
      });
      if (payload.type === "session" && payload.sub) {
        const sessionBase = {
          sub: String(payload.sub),
          role:
            typeof payload.role === "string"
              ? payload.role.toUpperCase()
              : undefined,
          iat: typeof payload.iat === "number" ? payload.iat : undefined,
        };

        // 🔒 Cryptographic device fingerprint binding verification (VULN-W2-10)
        if (payload.fpt && typeof payload.fpt === "string") {
          const rawFingerprint =
            request.headers.get("x-fingerprint") ||
            request.cookies.get("x-fingerprint")?.value ||
            "";

          if (!rawFingerprint) {
            // The fingerprint is published to the edge by the API client as an
            // `x-fingerprint` cookie. When it is absent (first visit after this
            // change, cleared cookies, private mode) treating the session as a
            // hard failure bounces every navigation back to /auth/login/ and
            // makes the app unusable. Fall back to an unverified session: auth
            // still works, but privileged (role-gated) routes stay fail-closed.
            console.warn(
              `Edge auth: fpt claim present but missing x-fingerprint for user ${payload.sub} — falling back to unverified session`,
            );
            return { ...sessionBase, isVerified: false };
          }

          const fptBuffer = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(rawFingerprint.trim()),
          );
          const computedFpt = Array.from(new Uint8Array(fptBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          if (computedFpt !== payload.fpt) {
            console.warn(
              `Edge auth: device fingerprint mismatch for user ${payload.sub}`,
            );
            return null;
          }
        }

        return { ...sessionBase, isVerified: true };
      }
    } catch (err) {
      // Signature mismatch or token expired — fall through to auth cookie
      // inspection. Surface the cause: an expired token is benign, but a
      // signature mismatch (EDGE_AUTH_SECRET missing/different on the web app
      // vs the API) silently downgrades every session to `isVerified: false`,
      // which bounces all role-gated routes (/admin/*, ...) to /auth/login.
      console.warn(
        `Edge auth: podacium_session verification failed (${
          (err as Error)?.name ?? "unknown"
        }) — falling back to unverified session`,
      );
    }
  }

  // Check whether the client has active authentication tokens/cookies
  const hasAuthCookies =
    !!request.cookies.get("access_token")?.value ||
    !!request.cookies.get("__Host-access_token")?.value ||
    !!request.cookies.get("refresh_token")?.value ||
    !!request.cookies.get("__Host-refresh_token")?.value ||
    !!request.cookies.get("podacium_auth_hint")?.value ||
    !!sessionToken;

  if (hasAuthCookies) {
    // Client has active auth tokens. Allow the request to proceed to the page
    // where client-side AuthContext and ProtectedRoute will verify against
    // the backend API (/api/v1/auth/me-light).
    // SECURITY: role is NEVER populated from unverified tokens!
    return {
      sub: "authenticated-client",
      role: undefined,
      isVerified: false,
    };
  }

  // Dev-only fallback
  if (
    process.env.NODE_ENV !== "production" &&
    request.cookies.get("podacium_auth_hint")?.value
  ) {
    return { sub: "dev", isVerified: false };
  }

  return null;
}

function setSecurityHeaders(
  response: NextResponse,
  permissionsPolicy?: string,
): NextResponse {
  const isDev =
    process.env.NODE_ENV !== "production" ||
    !process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_URL.includes("localhost") ||
    process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1");
  const connectSrc = isDev
    ? `connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;`
    : `connect-src 'self' https: wss:;`;
  const upgradeInsecure = isDev ? "" : " upgrade-insecure-requests;";

  const frameSrc = isDev
    ? `frame-src 'self' blob: data: http://localhost:* http://127.0.0.1:* https://player.vimeo.com https://*.vimeo.com https://challenges.cloudflare.com;`
    : `frame-src 'self' blob: data: https: https://player.vimeo.com https://*.vimeo.com https://challenges.cloudflare.com;`;

  const imgSrc = isDev
    ? `img-src 'self' data: https: blob: http://localhost:* http://127.0.0.1:*;`
    : `img-src 'self' data: https: blob:;`;

  const mediaSrc = isDev
    ? `media-src 'self' data: https: blob: http://localhost:* http://127.0.0.1:*;`
    : `media-src 'self' data: https: blob:;`;

  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://client.crisp.chat https://*.vimeo.com https://player.vimeo.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; ${imgSrc} ${mediaSrc} ${connectSrc} ${frameSrc} frame-ancestors 'none'; base-uri 'self'; form-action 'self';${upgradeInsecure}`,
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    permissionsPolicy ?? PERMISSIONS_POLICY,
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Live rooms run a WebRTC session in the browser, so camera/microphone must
  // be permitted (self) on /live/*; everywhere else they stay fully blocked.
  const permissionsPolicy = resolvePermissionsPolicy(pathname);

  // ── 1. Locale detection from query parameter ────────────────────────────────
  const localeFromQuery = searchParams.get("lang");
  if (localeFromQuery && SUPPORTED_LOCALES.includes(localeFromQuery)) {
    const newUrl = new URL(request.url);
    newUrl.searchParams.delete("lang");

    // Atomically rewrite path prefix if current path starts with a supported locale
    const existingPrefixMatch = newUrl.pathname.match(
      /^\/(en|fr|ar|kab)(\/.*)?$/,
    );
    if (existingPrefixMatch) {
      const rest = existingPrefixMatch[2] || "";
      newUrl.pathname = `/${localeFromQuery}${rest}` || `/${localeFromQuery}`;
    }

    const response = NextResponse.redirect(newUrl);
    response.cookies.set("locale", localeFromQuery, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    response.cookies.set("NEXT_LOCALE", localeFromQuery, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    return setSecurityHeaders(response, permissionsPolicy);
  }

  // ── 2. Locale detection from path prefix ────────────────────────────────────
  // Normalize the path BEFORE the auth check so /fr/dashboard, /ar/admin etc.
  // cannot bypass route protection. The rewrite itself happens after auth.
  let locale: string | null = null;
  let remainingPath = pathname;
  const localeMatch = pathname.match(/^\/(en|fr|ar|kab)(\/.*)?$/);
  if (localeMatch) {
    locale = localeMatch[1];
    remainingPath = localeMatch[2] || "/";
  }

  // ── 2b. Permanent deprecation redirect: /bi/organizations/* -> /organizations/* ─
  if (
    remainingPath === "/bi/organizations" ||
    remainingPath.startsWith("/bi/organizations/")
  ) {
    const newRemaining = remainingPath.replace(
      /^\/bi\/organizations(\/|$)/,
      "/organizations$1",
    );
    const targetPath = locale ? `/${locale}${newRemaining}` : newRemaining;
    const redirectUrl = new URL(targetPath, request.url);
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    return setSecurityHeaders(
      NextResponse.redirect(redirectUrl, 308),
      permissionsPolicy,
    );
  }

  // ── 3. Auth + RBAC enforcement (against the locale-normalized path) ────────
  if (isProtectedPath(remainingPath)) {
    const session = await getSession(request);

    if (!session) {
      const loginUrl = new URL("/auth/login/", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return setSecurityHeaders(
        NextResponse.redirect(loginUrl),
        permissionsPolicy,
      );
    }

    // ── Two-tier Edge session revocation check ──────────────────────────────
    // `sub`/`iat` come from a signature-verified JWT, so a session that was
    // only downgraded (missing fingerprint cookie) must still be revocation
    // checked — otherwise a revoked cookie keeps working until the next login.
    if (session.iat && session.sub) {
      const revoked = await isSessionRevoked(session.sub, session.iat);
      if (revoked) {
        console.warn(
          `Edge revocation: session for user ${session.sub} is revoked (iat: ${session.iat})`,
        );
        const loginUrl = new URL("/auth/login/", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        const response = NextResponse.redirect(loginUrl);
        clearAuthCookies(response);
        return setSecurityHeaders(response, permissionsPolicy);
      }
    }

    // ── Role-based access control (FAIL-CLOSED) ───────────────────────────────
    const gate = resolveRoleGate(remainingPath);
    if (gate) {
      // 1. Role gates REQUIRE cryptographic verification.
      // Unverified tokens or unverified cookies MUST NEVER be trusted for role gates.
      if (!session.isVerified) {
        console.warn(
          `RBAC: unverified session attempting access to privileged route ${remainingPath} — redirecting to login`,
        );
        const loginUrl = new URL("/auth/login/", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return setSecurityHeaders(
          NextResponse.redirect(loginUrl),
          permissionsPolicy,
        );
      }

      // 2. Strict role evaluation: fail-closed if role is missing or not allowed
      const isRoleAllowed = isRoleAllowedForPath(session.role, remainingPath);

      if (!isRoleAllowed) {
        console.warn(
          `RBAC: blocked ${session.role ?? "none"} from ${remainingPath} (requires ${gate.allowed.join("/")})`,
        );
        return setSecurityHeaders(
          NextResponse.redirect(new URL("/unauthorized", request.url)),
          permissionsPolicy,
        );
      }
    }
  }

  // ── 4. Locale rewrite (after auth) ──────────────────────────────────────────
  if (locale) {
    // Rewrite (not redirect) so the locale-prefixed URL stays in the browser bar.
    const newUrl = new URL(remainingPath, request.url);
    searchParams.forEach((value, key) => {
      if (key !== "lang") {
        newUrl.searchParams.set(key, value);
      }
    });

    // Forward the detected locale and verified client IP to server components via custom headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", locale);
    requestHeaders.set("x-client-ip", resolveClientIp(request));

    const response = NextResponse.rewrite(newUrl, {
      request: { headers: requestHeaders },
    });
    response.cookies.set("locale", locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    return setSecurityHeaders(response, permissionsPolicy);
  }

  // ── 5. Default response with security headers ───────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-client-ip", resolveClientIp(request));
  return setSecurityHeaders(
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
    permissionsPolicy,
  );
}

export const config = {
  matcher: [
    "/(en|fr|ar|kab)/:path*",
    "/(en|fr|ar|kab)",
    "/((?!api|_next|favicon|robots\\.txt|sitemap\\.xml|manifest\\.json|images/).*)",
  ],
};
