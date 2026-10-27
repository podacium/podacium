import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PodaciumDangerModal } from "./PodaciumDangerModal";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ dir: "ltr", isRtl: false }),
}));

describe("PodaciumDangerModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Delete Learning Path",
    description: "Are you sure you want to permanently delete this path?",
    confirmTextExpected: "Fullstack Web Dev",
    actionLabel: "Delete Path",
  };

  it("renders modal with description, warning, and confirm text expected", () => {
    render(<PodaciumDangerModal {...defaultProps} />);
    expect(screen.getByText("Delete Learning Path")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Are you sure you want to permanently delete this path?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Fullstack Web Dev")).toBeInTheDocument();
  });

  it("disables confirm button when input does not match expected text", () => {
    render(<PodaciumDangerModal {...defaultProps} />);
    const confirmButton = screen.getByRole("button", { name: "Delete Path" });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText("Fullstack Web Dev");
    fireEvent.change(input, { target: { value: "Wrong text" } });
    expect(confirmButton).toBeDisabled();
  });

  it("enables confirm button and calls onConfirm when exact match is typed", () => {
    const onConfirm = vi.fn();
    render(<PodaciumDangerModal {...defaultProps} onConfirm={onConfirm} />);
    const confirmButton = screen.getByRole("button", { name: "Delete Path" });
    const input = screen.getByPlaceholderText("Fullstack Web Dev");

    fireEvent.change(input, { target: { value: "Fullstack Web Dev" } });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("prevents paste into confirmation input", () => {
    render(<PodaciumDangerModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("Fullstack Web Dev");
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(pasteEvent, "preventDefault");

    input.dispatchEvent(pasteEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
