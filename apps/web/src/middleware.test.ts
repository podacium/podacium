import {
  resolvePermissionsPolicy,
  isProtectedPath,
  resolveRoleGate,
} from "./middleware";

// Note: Testing Next.js middleware requires mocking NextRequest/NextResponse
// This tests the locale detection and protection logic in isolation

describe("Permissions-Policy for live rooms and app routes", () => {
  it("allows camera/mic (self) on the live room page", () => {
    expect(resolvePermissionsPolicy("/live/sess-001/room")).toBe(
      "camera=(self), microphone=(self), geolocation=()",
    );
  });

  it("allows camera/mic on locale-prefixed live room", () => {
    expect(resolvePermissionsPolicy("/en/live/sess-001/room")).toBe(
      "camera=(self), microphone=(self), geolocation=()",
    );
    expect(resolvePermissionsPolicy("/ar/live/sess-001/room")).toBe(
      "camera=(self), microphone=(self), geolocation=()",
    );
  });

  it("allows microphone (self) while blocking camera and geolocation on standard routes", () => {
    const defaultPolicy = "camera=(), microphone=(self), geolocation=()";
    expect(resolvePermissionsPolicy("/hub/messages")).toBe(defaultPolicy);
    expect(resolvePermissionsPolicy("/en/hub/messages")).toBe(defaultPolicy);
    expect(resolvePermissionsPolicy("/fr/hub/contracts/c-123/messages")).toBe(
      defaultPolicy,
    );
    expect(resolvePermissionsPolicy("/dashboard")).toBe(defaultPolicy);
    expect(resolvePermissionsPolicy("/live-sessions/list")).toBe(defaultPolicy);
    expect(resolvePermissionsPolicy("/")).toBe(defaultPolicy);
  });
});

describe("Middleware route protection logic", () => {
  it("allows public crawling of freelancers and projects", () => {
    expect(isProtectedPath("/hub/freelancers")).toBe(false);
    expect(isProtectedPath("/hub/freelancers/123")).toBe(false);
    expect(isProtectedPath("/hub/projects")).toBe(false);
    expect(isProtectedPath("/hub/projects/123")).toBe(false);
  });

  it("allows public crawling of user public profiles", () => {
    expect(isProtectedPath("/profile/algeria-tech")).toBe(false);
    expect(isProtectedPath("/profile/john-doe")).toBe(false);
  });

  it("protects private actions, proposals, and project creation", () => {
    expect(isProtectedPath("/hub/projects/new")).toBe(true);
    expect(isProtectedPath("/hub/projects/123/proposals")).toBe(true);
    expect(isProtectedPath("/hub/contracts")).toBe(true);
    expect(isProtectedPath("/hub/messages")).toBe(true);
    expect(isProtectedPath("/hub/proposals")).toBe(true);
  });

  it("protects private user routes and profile me", () => {
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/profile/me")).toBe(true);
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
  });
});

describe("Middleware locale logic", () => {
  const SUPPORTED_LOCALES = ["en", "fr", "ar", "kab"];

  function extractLocaleFromPath(pathname: string): string | null {
    const match = pathname.match(/^\/(en|fr|ar|kab)(\/.*)?$/);
    return match ? match[1] : null;
  }

  it("extracts locale from /en path", () => {
    expect(extractLocaleFromPath("/en")).toBe("en");
  });

  it("extracts locale from /fr/dashboard path", () => {
    expect(extractLocaleFromPath("/fr/dashboard")).toBe("fr");
  });

  it("extracts locale from /ar/settings/profile path", () => {
    expect(extractLocaleFromPath("/ar/settings/profile")).toBe("ar");
  });

  it("extracts locale from /kab/about path", () => {
    expect(extractLocaleFromPath("/kab/about")).toBe("kab");
  });

  it("returns null for non-locale paths", () => {
    expect(extractLocaleFromPath("/dashboard")).toBeNull();
    expect(extractLocaleFromPath("/auth/login")).toBeNull();
    expect(extractLocaleFromPath("/")).toBeNull();
  });

  it("returns null for unsupported locales", () => {
    expect(extractLocaleFromPath("/de/page")).toBeNull();
    expect(extractLocaleFromPath("/es/page")).toBeNull();
  });

  it("validates supported locales", () => {
    expect(SUPPORTED_LOCALES.includes("en")).toBe(true);
    expect(SUPPORTED_LOCALES.includes("fr")).toBe(true);
    expect(SUPPORTED_LOCALES.includes("ar")).toBe(true);
    expect(SUPPORTED_LOCALES.includes("kab")).toBe(true);
    expect(SUPPORTED_LOCALES.includes("de")).toBe(false);
  });
});

describe("Middleware role gating logic", () => {
  it("restricts general /admin to ADMIN role only", () => {
    const gate = resolveRoleGate("/admin");
    expect(gate).not.toBeNull();
    expect(gate?.allowed).toEqual(["ADMIN"]);

    const settingsGate = resolveRoleGate("/admin/settings");
    expect(settingsGate?.allowed).toEqual(["ADMIN"]);

    const iamGate = resolveRoleGate("/admin/iam");
    expect(iamGate?.allowed).toEqual(["ADMIN"]);
  });

  it("permits MODERATOR on specific moderation sub-routes", () => {
    const reviewGate = resolveRoleGate("/admin/content-review");
    expect(reviewGate).not.toBeNull();
    expect(reviewGate?.allowed).toEqual(["ADMIN", "MODERATOR"]);

    const appealsGate = resolveRoleGate("/admin/appeals");
    expect(appealsGate).not.toBeNull();
    expect(appealsGate?.allowed).toEqual(["ADMIN", "MODERATOR"]);
  });

  it("restricts learn creation and live sessions to ADMIN and INSTRUCTOR", () => {
    expect(resolveRoleGate("/learn/create")?.allowed).toEqual([
      "ADMIN",
      "INSTRUCTOR",
    ]);
    expect(resolveRoleGate("/live/create")?.allowed).toEqual([
      "ADMIN",
      "INSTRUCTOR",
    ]);
  });
});

const TEST_SECRET = "test_super_secret_edge_key_32bytes!!";

describe("CRITICAL-AUTH-01: Unsigned Cookie Role Spoofing Prevention", () => {
  beforeEach(() => {
    process.env.EDGE_AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EDGE_AUTH_SECRET;
  });

  it("never trusts an unverified/tampered cookie with role ADMIN", async () => {
    const { getSession } = await import("./middleware");

    // Attacker crafts an unsigned base64 token with {"sub": "attacker", "role": "ADMIN"}
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "attacker_123", role: "ADMIN", type: "session" }),
    ).toString("base64url");
    const forgedToken = `${header}.${payload}.invalidsignature`;

    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "podacium_session") return { value: forgedToken };
          return undefined;
        },
      },
    } as any;

    const session = await getSession(mockRequest);
    expect(session).not.toBeNull();
    // Role MUST be undefined, and isVerified MUST be false
    expect(session?.isVerified).toBe(false);
    expect(session?.role).toBeUndefined();
  });

  it("verifies and extracts trusted role from legitimately signed JWT", async () => {
    const { getSession } = await import("./middleware");
    const crypto = await import("crypto");

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin_user_1",
        role: "ADMIN",
        type: "session",
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const validToken = `${header}.${payload}.${signature}`;

    const mockRequest = {
      cookies: {
        get: (name: string) => {
          if (name === "podacium_session") return { value: validToken };
          return undefined;
        },
      },
    } as any;

    const session = await getSession(mockRequest);
    expect(session).not.toBeNull();
    expect(session?.isVerified).toBe(true);
    expect(session?.sub).toBe("admin_user_1");
    expect(session?.role).toBe("ADMIN");
  });
});

describe("Edge Session Revocation & Cookie Clearing", () => {
  beforeEach(() => {
    process.env.EDGE_AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EDGE_AUTH_SECRET;
  });

  it("clearAuthCookies removes all authentication cookies", async () => {
    const { clearAuthCookies } = await import("./middleware");
    const { NextResponse } = await import("next/server");

    const response = NextResponse.next();
    clearAuthCookies(response);

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
      const cookie = response.cookies.get(name);
      expect(cookie?.value).toBe("");
    }
  });

  it("isSessionRevoked correctly flags tokens issued prior to revocation epoch", async () => {
    const { isSessionRevoked, clearRevocationCache } =
      await import("./middleware");
    clearRevocationCache();

    // Mock global fetch to return revoked_at = 1700000000
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user_id: 10, revoked_at: 1700000000 }),
    }) as any;

    try {
      // Token issued before revocation -> revoked!
      const isOldRevoked = await isSessionRevoked("10", 1699999000);
      expect(isOldRevoked).toBe(true);

      // Token issued after revocation -> active!
      clearRevocationCache();
      const isNewRevoked = await isSessionRevoked("10", 1700000500);
      expect(isNewRevoked).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("middleware redirects forged role cookie to /auth/login/ when accessing /admin", async () => {
    const { middleware } = await import("./middleware");
    const { NextRequest } = await import("next/server");

    // Attacker crafts an unsigned base64 token with role ADMIN
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "attacker_123", role: "ADMIN", type: "session" }),
    ).toString("base64url");
    const forgedToken = `${header}.${payload}.invalidsignature`;

    const request = new NextRequest("http://localhost:3000/admin");
    request.cookies.set("podacium_session", forgedToken);

    const response = await middleware(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/auth/login/");
  });

  it("middleware redirects non-admin role to /unauthorized when accessing /admin", async () => {
    const { middleware } = await import("./middleware");
    const { NextRequest } = await import("next/server");
    const crypto = await import("crypto");

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "student_user",
        role: "STUDENT",
        type: "session",
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const studentToken = `${header}.${payload}.${signature}`;

    const request = new NextRequest("http://localhost:3000/admin");
    request.cookies.set("podacium_session", studentToken);

    const response = await middleware(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/unauthorized");
  });

  it("middleware allows valid verified ADMIN into /admin", async () => {
    const { middleware } = await import("./middleware");
    const { NextRequest } = await import("next/server");
    const crypto = await import("crypto");

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin_user",
        role: "ADMIN",
        type: "session",
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const adminToken = `${header}.${payload}.${signature}`;

    const request = new NextRequest("http://localhost:3000/admin");
    request.cookies.set("podacium_session", adminToken);

    const response = await middleware(request);
    // Should not redirect to /unauthorized or /auth/login
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("permanently redirects /bi/organizations/* to /organizations/* with 308", async () => {
    const { middleware } = await import("./middleware");
    const { NextRequest } = await import("next/server");

    const reqRoot = new NextRequest("http://localhost:3000/bi/organizations");
    const resRoot = await middleware(reqRoot);
    expect(resRoot.status).toBe(308);
    expect(resRoot.headers.get("location")).toBe(
      "http://localhost:3000/organizations",
    );

    const reqNested = new NextRequest(
      "http://localhost:3000/fr/bi/organizations/42?tab=kyb",
    );
    const resNested = await middleware(reqNested);
    expect(resNested.status).toBe(308);
    expect(resNested.headers.get("location")).toBe(
      "http://localhost:3000/fr/organizations/42?tab=kyb",
    );
  });
});

describe("VULN-W2-10: Reverse Proxy IP Resolution & Device Fingerprint Binding", () => {
  beforeEach(() => {
    process.env.EDGE_AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EDGE_AUTH_SECRET;
  });

  it("resolves client IP from cf-connecting-ip header first", async () => {
    const { resolveClientIp } = await import("./middleware");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        "cf-connecting-ip": "105.101.44.12",
        "x-forwarded-for": "172.18.0.2, 127.0.0.1",
      },
    });
    expect(resolveClientIp(req)).toBe("105.101.44.12");
  });

  it("traverses x-forwarded-for right-to-left skipping trusted reverse proxy hops", async () => {
    const { resolveClientIp } = await import("./middleware");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        "x-forwarded-for": "197.200.10.5, 172.18.0.4, 127.0.0.1",
      },
    });
    expect(resolveClientIp(req)).toBe("197.200.10.5");
  });

  it("getSession validates matching device fingerprint fpt claim", async () => {
    const { getSession } = await import("./middleware");
    const { NextRequest } = await import("next/server");
    const crypto = await import("crypto");

    const rawFingerprint = "device_canvas_gpu_algeria_12345";
    const fptHash = crypto
      .createHash("sha256")
      .update(rawFingerprint)
      .digest("hex");

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user_with_fpt",
        role: "STUDENT",
        type: "session",
        iat: Math.floor(Date.now() / 1000),
        fpt: fptHash,
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const boundToken = `${header}.${payload}.${signature}`;

    // 1. With matching header -> verified
    const reqMatching = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        "x-fingerprint": rawFingerprint,
      },
    });
    reqMatching.cookies.set("podacium_session", boundToken);
    const sessionMatching = await getSession(reqMatching);
    expect(sessionMatching).not.toBeNull();
    expect(sessionMatching?.sub).toBe("user_with_fpt");
    expect(sessionMatching?.isVerified).toBe(true);

    // 2. Fingerprint published as a cookie (what the browser does on
    //    navigations) -> verified
    const reqCookie = new NextRequest("http://localhost:3000/dashboard");
    reqCookie.cookies.set("podacium_session", boundToken);
    reqCookie.cookies.set("x-fingerprint", rawFingerprint);
    const sessionCookie = await getSession(reqCookie);
    expect(sessionCookie?.sub).toBe("user_with_fpt");
    expect(sessionCookie?.isVerified).toBe(true);

    // 3. With missing fingerprint -> degraded, not rejected (otherwise every
    //    navigation bounces back to /auth/login/)
    const reqMissing = new NextRequest("http://localhost:3000/dashboard");
    reqMissing.cookies.set("podacium_session", boundToken);
    const sessionMissing = await getSession(reqMissing);
    expect(sessionMissing).not.toBeNull();
    expect(sessionMissing?.sub).toBe("user_with_fpt");
    expect(sessionMissing?.isVerified).toBe(false);

    // 4. With tampered header -> rejected
    const reqTampered = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        "x-fingerprint": "hijacked_attacker_fingerprint",
      },
    });
    reqTampered.cookies.set("podacium_session", boundToken);
    const sessionTampered = await getSession(reqTampered);
    expect(sessionTampered).toBeNull();
  });

  it("keeps role-gated routes fail-closed for an unverified fingerprint", async () => {
    const { middleware } = await import("./middleware");
    const { NextRequest } = await import("next/server");
    const crypto = await import("crypto");

    const rawFingerprint = "device_canvas_gpu_algeria_12345";
    const fptHash = crypto
      .createHash("sha256")
      .update(rawFingerprint)
      .digest("hex");

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin_with_fpt",
        role: "ADMIN",
        type: "session",
        iat: Math.floor(Date.now() / 1000),
        fpt: fptHash,
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    // No fingerprint cookie/header: auth-only pages pass, /admin must not.
    const req = new NextRequest("http://localhost:3000/dashboard");
    req.cookies.set("podacium_session", `${header}.${payload}.${signature}`);
    const response = await middleware(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();

    const adminReq = new NextRequest("http://localhost:3000/admin");
    adminReq.cookies.set(
      "podacium_session",
      `${header}.${payload}.${signature}`,
    );
    const adminResponse = await middleware(adminReq);
    expect(adminResponse.status).toBe(307);
    expect(adminResponse.headers.get("location")).toContain("/auth/login/");
  });

  it("still enforces revocation for a fingerprint-degraded session", async () => {
    const { middleware, clearRevocationCache } = await import("./middleware");
    const { NextRequest } = await import("next/server");
    const crypto = await import("crypto");

    const rawFingerprint = "device_canvas_gpu_algeria_12345";
    const fptHash = crypto
      .createHash("sha256")
      .update(rawFingerprint)
      .digest("hex");
    const issuedAt = Math.floor(Date.now() / 1000);

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "degraded_user",
        role: "STUDENT",
        type: "session",
        iat: issuedAt,
        fpt: fptHash,
      }),
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    clearRevocationCache();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user_id: 77, revoked_at: issuedAt + 60 }),
    }) as any;

    try {
      // No x-fingerprint cookie -> degraded session (isVerified === false).
      // It is still signature-valid, so revocation must be checked anyway.
      const req = new NextRequest("http://localhost:3000/dashboard");
      req.cookies.set("podacium_session", `${header}.${payload}.${signature}`);

      const response = await middleware(req);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/auth/login/");
    } finally {
      globalThis.fetch = originalFetch;
      clearRevocationCache();
    }
  });
});
