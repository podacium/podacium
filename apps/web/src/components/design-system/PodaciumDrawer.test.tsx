import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import {
  PodaciumDrawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
} from "./PodaciumDrawer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { bidiState, dragHandlers } = vi.hoisted(() => ({
  bidiState: { isRTL: false },
  dragHandlers: {
    onDragEnd: undefined as
      ((event: unknown, info: PanInfoLike) => void) | undefined,
  },
}));

interface PanInfoLike {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({
    isRTL: bidiState.isRTL,
    dir: bidiState.isRTL ? "rtl" : "ltr",
  }),
  useLocale: () => (bidiState.isRTL ? "ar" : "en"),
}));

// Framer Motion is replaced by inert elements: animations are not observable in
// jsdom, but prop wiring (drag axes, handlers, styles) still is.
const MOTION_ONLY_PROPS = [
  "initial",
  "animate",
  "exit",
  "transition",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "dragSnapToOrigin",
  "whileHover",
  "whileTap",
  "variants",
  "layout",
  "onDrag",
  "onDragStart",
  "onAnimationStart",
];

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");

  const motion = {
    div: ReactModule.forwardRef(function MotionDiv(props: any, ref: any) {
      const { children, onDragEnd, drag, ...rest } = props;

      if (typeof onDragEnd === "function") {
        dragHandlers.onDragEnd = onDragEnd;
      }

      const domProps: Record<string, unknown> = { ...rest };
      for (const key of MOTION_ONLY_PROPS) {
        delete domProps[key];
      }

      return ReactModule.createElement(
        "div",
        {
          ...domProps,
          ref,
          "data-drag": drag ? String(drag) : undefined,
        },
        children,
      );
    }),
  };

  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getPanel = () => screen.getByRole("dialog");

/** jsdom has no layout, so gesture maths needs an explicit panel extent. */
function setPanelExtent(panel: HTMLElement, extent: number) {
  Object.defineProperty(panel, "offsetHeight", {
    value: extent,
    configurable: true,
  });
  Object.defineProperty(panel, "offsetWidth", {
    value: extent,
    configurable: true,
  });
}

function drag(offset: { x: number; y: number }, velocity = { x: 0, y: 0 }) {
  act(() => {
    dragHandlers.onDragEnd?.({}, { offset, velocity });
  });
}

const onClose = vi.fn();
const onOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  bidiState.isRTL = false;
  dragHandlers.onDragEnd = undefined;
});

// ---------------------------------------------------------------------------
// Rendering & portal
// ---------------------------------------------------------------------------

describe("PodaciumDrawer rendering", () => {
  it("renders the panel with its content when open", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} title="Filters">
        <p>Drawer body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <PodaciumDrawer isOpen={false} onClose={onClose} title="Filters">
        <p>Drawer body</p>
      </PodaciumDrawer>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Drawer body")).not.toBeInTheDocument();
  });

  it("portals the panel into a dedicated container on document.body", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <p>Drawer body</p>
      </PodaciumDrawer>,
    );

    const container = document.body.querySelector(
      "[data-podacium-drawer-portal]",
    );
    expect(container).not.toBeNull();
    expect(container?.contains(getPanel())).toBe(true);
  });

  it("renders exactly one panel in compound mode", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} onOpen={onOpen}>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Compound</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Compound")).toBeInTheDocument();
  });

  it("renders the trigger outside the panel in compound mode", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} onOpen={onOpen}>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    const trigger = screen.getByRole("button", { name: /open drawer/i });
    expect(getPanel().contains(trigger)).toBe(false);
  });

  it("forwards a ref to the panel element", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <PodaciumDrawer isOpen onClose={onClose} ref={ref}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(ref.current).toBe(getPanel());
  });
});

// ---------------------------------------------------------------------------
// Dismissal
// ---------------------------------------------------------------------------

describe("PodaciumDrawer dismissal", () => {
  it("closes when the overlay is clicked", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    fireEvent.click(screen.getByTestId("drawer-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the overlay inert when closeOnOverlay is false", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} closeOnOverlay={false}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    fireEvent.click(screen.getByTestId("drawer-overlay"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape when closeOnEscape is false", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} closeOnEscape={false}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from DrawerClose", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <DrawerContent>
          <DrawerClose />
        </DrawerContent>
      </PodaciumDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses text children as the accessible name for DrawerClose", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <DrawerContent>
          <DrawerClose>Dismiss panel</DrawerClose>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    const button = screen.getByRole("button", { name: "Dismiss panel" });
    expect(button).not.toHaveAttribute("aria-label");
  });

  it("opens from DrawerTrigger", () => {
    render(
      <PodaciumDrawer isOpen={false} onClose={onClose} onOpen={onOpen}>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("merges the open handler onto a child when asChild is set", () => {
    const childClick = vi.fn();

    render(
      <PodaciumDrawer isOpen={false} onClose={onClose} onOpen={onOpen}>
        <DrawerTrigger asChild>
          <button className="brand-button" onClick={childClick}>
            Styled open
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    const trigger = screen.getByRole("button", { name: "Styled open" });
    expect(trigger).toHaveClass("brand-button");

    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(childClick).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

describe("PodaciumDrawer variants", () => {
  it("renders an overlay and aria-modal for the modal variant", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} variant="modal">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(screen.getByTestId("drawer-overlay")).toBeInTheDocument();
    expect(getPanel()).toHaveAttribute("aria-modal", "true");
  });

  it("renders no overlay and no aria-modal for the persistent variant", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} variant="persistent">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(screen.queryByTestId("drawer-overlay")).not.toBeInTheDocument();
    expect(getPanel()).not.toHaveAttribute("aria-modal");
  });

  it("does not dismiss a persistent drawer on Escape by default", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} variant="persistent">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not lock page scroll for the persistent variant", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} variant="persistent">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(document.body.style.overflow).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Position, size & RTL
// ---------------------------------------------------------------------------

describe("PodaciumDrawer position and size", () => {
  it("anchors physical side positions", () => {
    const { rerender } = render(
      <PodaciumDrawer isOpen onClose={onClose} position="left">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(getPanel()).toHaveClass("left-0");

    rerender(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(getPanel()).toHaveClass("bottom-0");
  });

  it('resolves position="start" to the leading edge in LTR', () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="start">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveClass("left-0");
  });

  it('resolves position="start" to the trailing edge in RTL', () => {
    bidiState.isRTL = true;

    render(
      <PodaciumDrawer isOpen onClose={onClose} position="start">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveClass("right-0");
  });

  it("applies size classes on the horizontal axis", () => {
    const { rerender } = render(
      <PodaciumDrawer isOpen onClose={onClose} position="right" size="sm">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(getPanel()).toHaveClass("w-[280px]");

    rerender(
      <PodaciumDrawer isOpen onClose={onClose} position="right" size="full">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(getPanel()).toHaveClass("w-full");
  });

  it("applies size classes on the vertical axis", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom" size="lg">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveClass("h-[480px]");
  });

  it("supports content-sized panels", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="start" size="auto">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveClass("w-auto");
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Background isolation
// ---------------------------------------------------------------------------

describe("PodaciumDrawer background isolation", () => {
  it("makes everything except the portal inert while a modal panel is open", () => {
    const { unmount } = render(
      <PodaciumDrawer isOpen onClose={onClose} title="Filters">
        <p>Drawer body</p>
      </PodaciumDrawer>,
    );

    const portal = document.querySelector("[data-podacium-drawer-portal]");
    expect(portal).not.toBeNull();

    const background = Array.from(document.body.children).filter(
      (element) => element !== portal,
    );
    expect(background.length).toBeGreaterThan(0);
    for (const element of background) {
      expect(element.hasAttribute("inert")).toBe(true);
    }
    expect(portal?.hasAttribute("inert")).toBe(false);

    unmount();
    for (const element of background) {
      expect(element.hasAttribute("inert")).toBe(false);
      expect(element.hasAttribute("data-podacium-inert")).toBe(false);
    }
  });

  it("keeps the page interactive for persistent panels", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        variant="persistent"
        title="Step"
      >
        <p>Step body</p>
      </PodaciumDrawer>,
    );

    expect(document.querySelectorAll("[data-podacium-inert]")).toHaveLength(0);
  });
});

describe("PodaciumDrawer accessibility", () => {
  it("labels the panel from the title and description props", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        title="Comment thread"
        description="All replies"
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );

    const panel = getPanel();
    const labelledBy = panel.getAttribute("aria-labelledby");
    const describedBy = panel.getAttribute("aria-describedby");

    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(
      "Comment thread",
    );
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "All replies",
    );
  });

  it("labels the panel from composed parts", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Webhook inspector</DrawerTitle>
            <DrawerDescription>Recent deliveries</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    const panel = getPanel();
    expect(
      document.getElementById(panel.getAttribute("aria-labelledby") as string),
    ).toHaveTextContent("Webhook inspector");
    expect(
      document.getElementById(panel.getAttribute("aria-describedby") as string),
    ).toHaveTextContent("Recent deliveries");
  });

  it("omits labelling attributes when there is no title or description", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).not.toHaveAttribute("aria-labelledby");
    expect(getPanel()).not.toHaveAttribute("aria-describedby");
  });

  it("uses an external label target when labelledBy is set", () => {
    render(
      <>
        <h2 id="external-heading">Workspace navigation</h2>
        <PodaciumDrawer isOpen onClose={onClose} labelledBy="external-heading">
          <p>Body</p>
        </PodaciumDrawer>
      </>,
    );

    expect(getPanel()).toHaveAttribute("aria-labelledby", "external-heading");
  });

  it("returns focus to returnFocusRef on close", () => {
    const returnFocusRef = React.createRef<HTMLButtonElement>();

    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button ref={returnFocusRef}>Return target</button>
          <PodaciumDrawer
            isOpen={open}
            onClose={onClose}
            returnFocusRef={returnFocusRef}
          >
            <button data-testid="inside">Inside</button>
          </PodaciumDrawer>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open />);
    rerender(<Harness open={false} />);

    expect(document.activeElement).toBe(returnFocusRef.current);
  });

  it("moves focus into a drawer that mounts already open", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <button data-testid="inside">Inside</button>
      </PodaciumDrawer>,
    );

    expect(document.activeElement).toBe(screen.getByTestId("inside"));
  });

  it("moves focus into the panel on open and restores it on close", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button data-testid="outside">Outside</button>
          <PodaciumDrawer isOpen={open} onClose={onClose}>
            <button data-testid="inside">Inside</button>
          </PodaciumDrawer>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    screen.getByTestId("outside").focus();
    expect(document.activeElement).toBe(screen.getByTestId("outside"));

    rerender(<Harness open />);
    expect(document.activeElement).toBe(screen.getByTestId("inside"));

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(screen.getByTestId("outside"));
  });

  it("cycles Tab focus inside the panel", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <button data-testid="first">First</button>
        <button data-testid="last">Last</button>
      </PodaciumDrawer>,
    );

    const first = screen.getByTestId("first");
    const last = screen.getByTestId("last");

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("locks page scroll while open and restores it afterwards", () => {
    const { rerender } = render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <PodaciumDrawer isOpen={false} onClose={onClose}>
        <p>Body</p>
      </PodaciumDrawer>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Swipe handle & gestures
// ---------------------------------------------------------------------------

describe("PodaciumDrawer swipe handle", () => {
  it("renders the handle when enabled", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        showSwipeHandle
        position="bottom"
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(screen.getByTestId("drawer-swipe-handle")).toBeInTheDocument();
  });

  it("is not rendered when disabled", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(screen.queryByTestId("drawer-swipe-handle")).not.toBeInTheDocument();
  });

  it("is never rendered for the persistent variant", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        showSwipeHandle
        variant="persistent"
      >
        <DrawerContent>
          <DrawerSwipeHandle />
          <DrawerBody>Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    expect(screen.queryByTestId("drawer-swipe-handle")).not.toBeInTheDocument();
  });
});

describe("PodaciumDrawer drag-to-dismiss", () => {
  it("drags along the vertical axis for vertical drawers", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveAttribute("data-drag", "y");
  });

  it("drags along the horizontal axis for horizontal drawers", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="end">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).toHaveAttribute("data-drag", "x");
  });

  it("closes when dragged past the dismiss threshold", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 600);

    drag({ x: 0, y: 400 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the drag stops short of the threshold", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 600);

    drag({ x: 0, y: 50 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a fast flick even with a small offset", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 600);

    drag({ x: 0, y: 10 }, { x: 0, y: 900 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores drags that move away from the anchored edge", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} position="bottom">
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 600);

    drag({ x: 0, y: -400 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not dismiss a persistent drawer", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose} variant="persistent">
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel()).not.toHaveAttribute("data-drag");
  });
});

// ---------------------------------------------------------------------------
// Snap points
// ---------------------------------------------------------------------------

describe("PodaciumDrawer snap points", () => {
  it("sizes the panel from the first snap point", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        position="bottom"
        snapPoints={[420, 220]}
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel().style.height).toBe("420px");
  });

  it("supports an auto-height snap point", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        position="bottom"
        snapPoints={["auto"]}
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );

    expect(getPanel().style.height).toBe("auto");
  });

  it("steps down to the next snap point on a drag", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        position="bottom"
        snapPoints={[400, 200]}
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 400);

    drag({ x: 0, y: 150 });
    expect(getPanel().style.height).toBe("200px");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when dragged past the last snap point", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        position="bottom"
        snapPoints={[400, 200]}
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );
    const panel = getPanel();
    setPanelExtent(panel, 400);

    drag({ x: 0, y: 150 });
    expect(panel.style.height).toBe("200px");

    drag({ x: 0, y: 150 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("grows back up when dragged away from the closing edge", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        position="bottom"
        snapPoints={[400, 200]}
      >
        <p>Body</p>
      </PodaciumDrawer>,
    );
    setPanelExtent(getPanel(), 400);

    drag({ x: 0, y: 150 });
    drag({ x: 0, y: -150 });

    expect(getPanel().style.height).toBe("400px");
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Compound parts
// ---------------------------------------------------------------------------

describe("PodaciumDrawer compound parts", () => {
  it("renders header, body and footer in order", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
            <DrawerClose />
          </DrawerHeader>
          <DrawerBody>Body content</DrawerBody>
          <DrawerFooter>
            <button>Apply</button>
          </DrawerFooter>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    const panel = getPanel();
    expect(panel).toHaveTextContent("Title");
    expect(panel).toHaveTextContent("Body content");
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("merges custom classes in compound mode", () => {
    render(
      <PodaciumDrawer isOpen onClose={onClose}>
        <DrawerContent
          className="panel-extra"
          overlayClassName="overlay-extra"
          contentClassName="content-extra"
        >
          <DrawerBody className="body-extra">Body</DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>,
    );

    expect(screen.getByTestId("drawer-panel")).toHaveClass("panel-extra");
    expect(screen.getByTestId("drawer-overlay")).toHaveClass("overlay-extra");
    expect(document.querySelector(".content-extra")).not.toBeNull();
    expect(document.querySelector(".body-extra")).not.toBeNull();
  });

  it("merges custom classes in short form", () => {
    render(
      <PodaciumDrawer
        isOpen
        onClose={onClose}
        className="panel-extra"
        overlayClassName="overlay-extra"
        contentClassName="content-extra"
        title="Title"
      >
        Body
      </PodaciumDrawer>,
    );

    expect(screen.getByTestId("drawer-panel")).toHaveClass("panel-extra");
    expect(screen.getByTestId("drawer-overlay")).toHaveClass("overlay-extra");
    expect(document.querySelector(".content-extra")).not.toBeNull();
  });
});
