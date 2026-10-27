import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ dir: "ltr" }),
}));

const mockSend = vi.fn();
vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { identity: "host-1", name: "Host" },
  }),
  useDataChannel: (topic: string, onMessage: any) => ({
    send: mockSend,
  }),
}));

import { Whiteboard } from "./Whiteboard";

describe("Whiteboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as any;
    // Mock getBoundingClientRect and getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
    })) as any;

    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 600,
    });
  });

  it("renders whiteboard controls for host", () => {
    render(<Whiteboard isHost={true} />);
    expect(screen.getByTitle("room.whiteboard.pen")).toBeInTheDocument();
    expect(screen.getByTitle("room.whiteboard.eraser")).toBeInTheDocument();
  });

  it("allows tool selection and drawing interaction", () => {
    const { container } = render(<Whiteboard isHost={true} />);
    const eraserBtn = screen.getByTitle("room.whiteboard.eraser");
    fireEvent.click(eraserBtn);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();

    if (canvas) {
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);
    }
  });

  it("ensures active drawing uses strokeWidth rather than canvas pixel dimensions", () => {
    let capturedLineWidth = 0;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      const ctx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        clearRect: vi.fn(),
        scale: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokeRect: vi.fn(),
        arc: vi.fn(),
        fillText: vi.fn(),
      };
      Object.defineProperty(ctx, "lineWidth", {
        set(val: number) {
          capturedLineWidth = val;
        },
        get() {
          return capturedLineWidth;
        },
      });
      return ctx;
    }) as any;

    const { container } = render(<Whiteboard isHost={true} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();

    if (canvas) {
      // Start drawing
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
      // Line width should be 2 (default STROKE_WIDTHS[0]), never 800 (canvas width)
      expect(capturedLineWidth).toBeLessThanOrEqual(32);
      expect(capturedLineWidth).toBeGreaterThanOrEqual(1);
      fireEvent.mouseUp(canvas);
    }
  });
});
