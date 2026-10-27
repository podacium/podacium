import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavDrawer } from "./MobileNavDrawer";

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  return {
    motion: {
      div: ReactModule.forwardRef(({ children, ...props }: any, ref: any) => {
        const domProps = { ...props };
        for (const key of [
          "initial",
          "animate",
          "exit",
          "transition",
          "drag",
          "dragConstraints",
          "dragElastic",
          "dragSnapToOrigin",
          "dragMomentum",
          "onDrag",
          "onDragStart",
          "onDragEnd",
        ]) {
          delete domProps[key];
        }
        return ReactModule.createElement("div", { ...domProps, ref }, children);
      }),
    },
    AnimatePresence: ({ children }: any) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock("@/lib/i18n", () => ({
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
  useTranslations: () => (key: string) => key,
}));

const getPanel = () => screen.getByRole("dialog");

describe("MobileNavDrawer", () => {
  it("does not render when open is false", () => {
    render(
      <MobileNavDrawer open={false} onClose={vi.fn()}>
        <div>Drawer Content</div>
      </MobileNavDrawer>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders an accessible dialog when open is true", () => {
    render(
      <MobileNavDrawer open onClose={vi.fn()}>
        <div>Drawer Content</div>
      </MobileNavDrawer>,
    );

    const drawer = getPanel();
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveAttribute(
      "aria-labelledby",
      "workspace-sidebar-drawer",
    );
    expect(screen.getByText("Drawer Content")).toBeDefined();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <MobileNavDrawer open onClose={onClose}>
        <button type="button">Focusable item</button>
      </MobileNavDrawer>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <MobileNavDrawer open onClose={onClose}>
        <div>Drawer Content</div>
      </MobileNavDrawer>,
    );

    fireEvent.click(screen.getByTestId("drawer-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides the drawer on desktop by default", () => {
    render(
      <MobileNavDrawer open onClose={vi.fn()}>
        <div>Drawer Content</div>
      </MobileNavDrawer>,
    );

    expect(getPanel().className).toContain("lg:hidden");
    expect(screen.getByTestId("drawer-overlay").className).toContain(
      "lg:hidden",
    );
  });

  it("omits lg:hidden when allowDesktop is true", () => {
    render(
      <MobileNavDrawer open onClose={vi.fn()} allowDesktop>
        <div>Drawer Content</div>
      </MobileNavDrawer>,
    );

    expect(getPanel().className).not.toContain("lg:hidden");
    expect(screen.getByTestId("drawer-overlay").className).not.toContain(
      "lg:hidden",
    );
  });

  it("returns focus to returnFocusRef on close", () => {
    const returnFocusRef = React.createRef<HTMLButtonElement>();

    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button ref={returnFocusRef}>Menu</button>
          <MobileNavDrawer
            open={open}
            onClose={vi.fn()}
            returnFocusRef={returnFocusRef}
          >
            <button data-testid="nav-item">Home</button>
          </MobileNavDrawer>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open />);
    rerender(<Harness open={false} />);

    expect(document.activeElement).toBe(returnFocusRef.current);
  });
});
