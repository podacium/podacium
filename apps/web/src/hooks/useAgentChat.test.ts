import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAgentChat } from "./useAgentChat";

vi.mock("@/lib/i18n", () => ({
  useLocale: () => "fr",
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("useAgentChat", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createMockStream(chunks: string[]) {
    const encoder = new TextEncoder();
    let index = 0;

    const stream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: stream,
    } as unknown as Response;
  }

  it("handles clean stream with tokens and done frame", async () => {
    const mockResponse = createMockStream([
      'data: {"token": "Hello "}\n\n',
      'data: {"token": "world!"}\n\n',
      'data: {"done": true, "session_id": "sess_test_1"}\n\n',
    ]);
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAgentChat());

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    const messages = result.current.messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hi");

    const assistantMsg = messages[1];
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.status).toBe("completed");
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.content).toBe("Hello world!");
    expect(result.current.sessionId).toBe("sess_test_1");
  });

  it("handles abrupt stream termination with content by marking completed", async () => {
    // Stream terminates without a "done" frame, but has text
    const mockResponse = createMockStream([
      'data: {"token": "Abrupt partial content"}\n\n',
    ]);
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAgentChat());

    await act(async () => {
      await result.current.sendMessage("Tell me something");
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.status).toBe("completed");
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.content).toBe("Abrupt partial content");
    expect(result.current.isStreaming).toBe(false);
  });

  it("handles abrupt stream termination without content by marking error", async () => {
    // Stream terminates immediately without any tokens or done frame
    const mockResponse = createMockStream([]);
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAgentChat());

    await act(async () => {
      await result.current.sendMessage("Empty stream test");
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.status).toBe("error");
    expect(assistantMsg.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });
});
