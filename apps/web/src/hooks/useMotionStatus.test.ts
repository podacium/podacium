import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deriveMotionStatus, useMotionStatus } from "./useMotionStatus";

describe("deriveMotionStatus", () => {
  it("defaults to idle", () => {
    expect(deriveMotionStatus()).toBe("idle");
    expect(deriveMotionStatus({})).toBe("idle");
  });

  it("maps foreground loading to searching", () => {
    expect(deriveMotionStatus({ isLoading: true })).toBe("searching");
  });

  it("maps background refetch to syncing", () => {
    expect(deriveMotionStatus({ isFetching: true })).toBe("syncing");
  });

  it("maps streaming with and without an active tool", () => {
    expect(deriveMotionStatus({ isStreaming: true })).toBe("thinking");
    expect(
      deriveMotionStatus({ isStreaming: true, activeTool: "search" }),
    ).toBe("busy");
  });

  it("maps voice capture to listening", () => {
    expect(deriveMotionStatus({ isListening: true })).toBe("listening");
  });

  it("maps mutations to saving and imports to importing", () => {
    expect(deriveMotionStatus({ isSaving: true })).toBe("saving");
    expect(deriveMotionStatus({ isImporting: true })).toBe("importing");
  });

  it("lets errors win over every other signal", () => {
    expect(
      deriveMotionStatus({
        error: new Error("nope"),
        isStreaming: true,
        isLoading: true,
        success: true,
      }),
    ).toBe("error");
  });

  it("lets terminal success outrank background refetches", () => {
    expect(deriveMotionStatus({ success: true, isFetching: true })).toBe(
      "success",
    );
  });

  it("prefers foreground work over background work", () => {
    expect(deriveMotionStatus({ isFetching: true, isSaving: true })).toBe(
      "saving",
    );
  });
});

describe("useMotionStatus", () => {
  it("returns the derived state and its frame config", () => {
    const { result } = renderHook(() => useMotionStatus({ isStreaming: true }));

    expect(result.current.state).toBe("thinking");
    expect(result.current.config.frames.length).toBeGreaterThan(1);
    expect(result.current.config.loop).toBe(true);
  });

  it("recomputes when signals change", () => {
    const { result, rerender } = renderHook(
      (props: { isSaving: boolean }) => useMotionStatus(props),
      { initialProps: { isSaving: false } },
    );

    expect(result.current.state).toBe("idle");
    rerender({ isSaving: true });
    expect(result.current.state).toBe("saving");
  });
});
