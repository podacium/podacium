/* eslint-disable react/display-name -- framer-motion mocks are anonymous by design */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PodaciumConfirmDialog from "./PodaciumConfirmDialog";

// Mock framer-motion to render children synchronously
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      role,
      "aria-labelledby": ariaLabelledBy,
      "aria-modal": ariaModal,
      onClick,
    }: any) => (
      <div
        className={className}
        role={role}
        aria-labelledby={ariaLabelledBy}
        aria-modal={ariaModal}
        onClick={onClick}
      >
        {children}
      </div>
    ),
    button: React.forwardRef<HTMLButtonElement, any>(
      ({ children, whileTap, transition, ...props }, ref) => (
        <button ref={ref} {...props}>
          {children}
        </button>
      ),
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("PodaciumConfirmDialog", () => {
  it("renders properly when isOpen is true", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <PodaciumConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Revoke Admin Access"
        description="Are you sure you want to revoke this admin?"
      />,
    );

    expect(screen.getByText("Revoke Admin Access")).toBeDefined();
    expect(
      screen.getByText("Are you sure you want to revoke this admin?"),
    ).toBeDefined();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <PodaciumConfirmDialog
        isOpen={false}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Revoke Admin Access"
      />,
    );

    expect(screen.queryByText("Revoke Admin Access")).toBeNull();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <PodaciumConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Confirm Action"
        confirmText="Yes, Proceed"
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Yes, Proceed" });
    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("enforces type-to-confirm safeguard", () => {
    const handleConfirm = vi.fn();

    render(
      <PodaciumConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Delete Resource"
        typeToConfirm="DELETE-RESOURCE"
        confirmText="Delete Permanently"
      />,
    );

    const confirmButton = screen.getByRole("button", {
      name: "Delete Permanently",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    const input = screen.getByPlaceholderText("DELETE-RESOURCE");
    fireEvent.change(input, { target: { value: "WRONG" } });
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "DELETE-RESOURCE" } });
    expect(confirmButton.disabled).toBe(false);

    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("supports prompt mode and passes input value to onConfirm", () => {
    const handleConfirm = vi.fn();

    render(
      <PodaciumConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Provide Reason"
        promptConfig={{
          label: "Reason",
          placeholder: "Enter resolution reason",
          required: true,
        }}
        confirmText="Submit"
      />,
    );

    const confirmButton = screen.getByRole("button", {
      name: "Submit",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    const input = screen.getByPlaceholderText("Enter resolution reason");
    fireEvent.change(input, {
      target: { value: "Verified by compliance team" },
    });
    expect(confirmButton.disabled).toBe(false);

    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledWith("Verified by compliance team");
  });
});
