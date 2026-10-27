import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, GET, formatDevError } from "./route";
import { NextRequest } from "next/server";

describe("Dev Logger API Route", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should format dev errors with ANSI borders, icons, and messages", () => {
    const formatted = formatDevError({
      type: "runtime_error",
      message: "Uncaught TypeError: test error",
      url: "http://localhost:3000/dashboard",
      stack: "TypeError: test error\n  at Dashboard (Dashboard.tsx:20)",
      source: { file: "Dashboard.tsx", line: 20, col: 5 },
      details: { foo: "bar" },
    });

    expect(formatted).toContain("FRONTEND RUNTIME ERROR");
    expect(formatted).toContain("Uncaught TypeError: test error");
    expect(formatted).toContain("http://localhost:3000/dashboard");
    expect(formatted).toContain("Dashboard.tsx:20:5");
    expect(formatted).toContain("foo");
  });

  it("should handle POST request in development and write to process.stderr", async () => {
    const req = new NextRequest("http://localhost:3000/api/dev-logger", {
      method: "POST",
      body: JSON.stringify({
        type: "console.error",
        message: "Component failed to mount",
        url: "http://localhost:3000/hub",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("should return 404 in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const req = new NextRequest("http://localhost:3000/api/dev-logger", {
      method: "POST",
      body: JSON.stringify({
        type: "runtime_error",
        message: "Prod error",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("should respond to GET request in development", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});
