import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initDevErrorReporter, reportDevError, sendDevLog } from "./client";

describe("Dev Logger Client", () => {
  const originalEnv = process.env.NODE_ENV;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should send error log when NODE_ENV is development", () => {
    sendDevLog({
      type: "runtime_error",
      message: "Test runtime error",
      stack: "Error: Test\n  at Component.tsx:10:5",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("/api/dev-logger");
    const body = JSON.parse(callArgs[1].body);
    expect(body.type).toBe("runtime_error");
    expect(body.message).toBe("Test runtime error");
    expect(body.stack).toContain("Component.tsx");
  });

  it("should format and forward error from reportDevError helper", () => {
    const customErr = new Error("Custom query failure");
    reportDevError({
      type: "query_error",
      message: "Query [users] failed",
      error: customErr,
      details: { queryKey: ["users"] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("query_error");
    expect(body.message).toBe("Query [users] failed");
    expect(body.details.queryKey).toEqual(["users"]);
    expect(body.stack).toBeDefined();
  });

  it("should intercept console.error calls and forward them", () => {
    const cleanup = initDevErrorReporter();

    console.error("Failed to render card", { id: 123 });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("console.error");
    expect(body.message).toContain("Failed to render card");

    cleanup();
  });

  it("should intercept console.warn calls and forward them", () => {
    const cleanup = initDevErrorReporter();

    console.warn("Deprecated API usage in widget");

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("console.warn");
    expect(body.message).toContain("Deprecated API usage in widget");

    cleanup();
  });

  it("should deduplicate rapid identical errors", () => {
    sendDevLog({
      type: "runtime_error",
      message: "Deduplication test error",
    });

    sendDevLog({
      type: "runtime_error",
      message: "Deduplication test error",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
