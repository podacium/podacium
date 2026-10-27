import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useDataStreamParser } from "./useDataStreamParser";
import type { StreamFrame } from "@/types/agent-stream";

describe("useDataStreamParser", () => {
  it("parses single text token frame cleanly", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];

    act(() => {
      result.current.parseChunk('data: {"token": "Salam "}\n\n', (ev) => {
        events.push(ev);
      });
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "token", token: "Salam " });
  });

  it("handles multi-byte UTF-8 Arabic text split across chunks", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];
    const encoder = new TextEncoder();

    // "مرحبا" in UTF-8
    const fullBytes = encoder.encode('data: {"token": "مرحبا"}\n\n');
    // Split the bytes in half (potentially cutting an Arabic multi-byte character)
    const chunk1 = fullBytes.slice(0, 15);
    const chunk2 = fullBytes.slice(15);

    act(() => {
      result.current.parseChunk(chunk1, (ev) => events.push(ev));
      result.current.parseChunk(chunk2, (ev) => events.push(ev));
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "token", token: "مرحبا" });
  });

  it("handles multiple frames in a single chunk", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];

    const chunk = [
      'data: {"tool_call": {"name": "search_courses", "status": "running"}}\n\n',
      'data: {"token": "Voici les cours disponibles :"}\n\n',
      'data: {"done": true, "session_id": "sess_123"}\n\n',
    ].join("");

    act(() => {
      result.current.parseChunk(chunk, (ev) => events.push(ev));
    });

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("tool_call");
    expect(events[1].type).toBe("token");
    expect(events[2].type).toBe("done");
  });

  it("resets buffer state correctly", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];

    act(() => {
      // Incomplete chunk
      result.current.parseChunk('data: {"token": "Part', (ev) =>
        events.push(ev),
      );
      result.current.reset();
      // Fresh new frame
      result.current.parseChunk('data: {"token": "Fresh"}\n\n', (ev) =>
        events.push(ev),
      );
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "token", token: "Fresh" });
  });

  it("handles multiline SSE JSON payload joined with newline", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];

    const multilineChunk = [
      "data: {",
      'data:   "token": "Hello multiline",',
      'data:   "type": "token"',
      "data: }",
      "",
      "",
    ].join("\n");

    act(() => {
      result.current.parseChunk(multilineChunk, (ev) => events.push(ev));
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "token", token: "Hello multiline" });
  });

  it("preserves buffer state when JSON parsing fails partially", () => {
    const { result } = renderHook(() => useDataStreamParser());
    const events: StreamFrame[] = [];

    // First part has valid frame, second part has incomplete JSON with boundary
    const chunk1 = 'data: {"token": "valid"}\n\n';
    const chunk2 = 'data: {"token": "incomp\n\n';
    const chunk3 = 'lete"}\n\n';

    act(() => {
      result.current.parseChunk(chunk1, (ev) => events.push(ev));
      result.current.parseChunk(chunk2, (ev) => events.push(ev));
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "token", token: "valid" });

    act(() => {
      result.current.parseChunk(chunk3, (ev) => events.push(ev));
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: "token", token: "incomplete" });
  });
});
