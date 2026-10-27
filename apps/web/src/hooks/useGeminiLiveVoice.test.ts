import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGeminiLiveVoice } from "./useGeminiLiveVoice";

// Mock Web Audio API and WebSocket environment
class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state = "running";
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
  destination = {};
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(10)),
      connect: vi.fn(),
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    };
  }
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 1; // WebSocket.OPEN
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
}

describe("useGeminiLiveVoice Hook", () => {
  const originalAudioContext = window.AudioContext;
  const originalAudioWorkletNode = window.AudioWorkletNode;
  const originalWebSocket = window.WebSocket;
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];

    // Assign mocks
    (window as unknown as { AudioContext: unknown }).AudioContext =
      MockAudioContext;
    (window as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode =
      MockAudioWorkletNode;
    (window as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        writable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [],
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext =
      originalAudioContext;
    (window as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode =
      originalAudioWorkletNode;
    (window as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
  });

  it("initializes in idle state", () => {
    const { result } = renderHook(() => useGeminiLiveVoice());
    expect(result.current.status).toBe("idle");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });

  it("starts session and connects to live voice WebSocket gateway", async () => {
    const { result } = renderHook(() =>
      useGeminiLiveVoice({
        language: "ar-DZ",
        voiceName: "Aoede",
      }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(MockWebSocket.instances.length).toBe(1);

    const ws = MockWebSocket.instances[0];
    // Wait for onopen
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.status).toBe("connected");
    expect(ws.send).toHaveBeenCalled();

    const setupCall = JSON.parse(ws.send.mock.calls[0][0]);
    expect(setupCall.setup).toBeDefined();
    expect(
      setupCall.setup.generation_config.speech_config.voice_config
        .prebuilt_voice_config.voice_name,
    ).toBe("Aoede");
  });

  it("handles server barge-in / interruption frame instantly", async () => {
    const onInterruptedMock = vi.fn();
    const { result } = renderHook(() =>
      useGeminiLiveVoice({
        onInterrupted: onInterruptedMock,
      }),
    );

    await act(async () => {
      await result.current.startSession();
      await new Promise((r) => setTimeout(r, 20));
    });

    const ws = MockWebSocket.instances[0];

    // Simulate server barge-in event
    await act(async () => {
      ws.onmessage?.({
        data: JSON.stringify({
          serverContent: { interrupted: true },
        }),
      });
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(onInterruptedMock).toHaveBeenCalled();
  });

  it("toggles microphone mute correctly", async () => {
    const { result } = renderHook(() => useGeminiLiveVoice());

    await act(async () => {
      await result.current.startSession();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
  });

  it("stops session and tears down active audio and sockets", async () => {
    const { result } = renderHook(() => useGeminiLiveVoice());

    await act(async () => {
      await result.current.startSession();
      await new Promise((r) => setTimeout(r, 20));
    });

    const ws = MockWebSocket.instances[0];

    await act(async () => {
      await result.current.stopSession();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(ws.close).toHaveBeenCalled();
  });
});
