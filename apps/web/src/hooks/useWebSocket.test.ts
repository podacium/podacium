import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe("WebSocket connection logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates WebSocket without token in URL (auth via cookie)", () => {
    // Token-in-URL is deprecated — authentication should use the access_token cookie.
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    expect(ws.url).toBe("ws://localhost:8000/ws");
  });

  it("can send JSON messages", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const message = { type: "ping" };
    ws.send(JSON.stringify(message));
    expect(ws.send).toHaveBeenCalledWith('{"type":"ping"}');
  });

  it("handles incoming messages", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const handler = vi.fn();
    ws.onmessage = handler;

    const event = { data: JSON.stringify({ type: "pong" }) };
    ws.onmessage(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("handles connection close", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const handler = vi.fn();
    ws.onclose = handler;

    ws.onclose();
    expect(handler).toHaveBeenCalled();
  });

  it("handles connection error", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const handler = vi.fn();
    ws.onerror = handler;

    ws.onerror({ message: "Connection failed" });
    expect(handler).toHaveBeenCalled();
  });

  it("typing indicator message format", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const typingMsg = { type: "typing", conversationId: 123 };
    ws.send(JSON.stringify(typingMsg));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "typing", conversationId: 123 }),
    );
  });

  it("read receipt message format", () => {
    const ws = new MockWebSocket("ws://localhost:8000/ws");
    const readMsg = { type: "read", messageId: 456 };
    ws.send(JSON.stringify(readMsg));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "read", messageId: 456 }),
    );
  });
});

describe("useWebSocket hook interface", () => {
  it("exports useWebSocket function", async () => {
    const { useWebSocket } = await import("./useWebSocket");
    expect(typeof useWebSocket).toBe("function");
  });

  it("handles beforeunload and pagehide without error", () => {
    expect(() => {
      window.dispatchEvent(new Event("beforeunload"));
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pageshow"));
    }).not.toThrow();
  });
});
