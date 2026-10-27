import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PodaciumCheckbox from "./PodaciumCheckbox";

describe("PodaciumCheckbox", () => {
  it("renders with label", () => {
    render(<PodaciumCheckbox label="Accept terms" />);
    expect(screen.getByText("Accept terms")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(
      <PodaciumCheckbox
        label="Accept terms"
        description="By checking, you agree to our terms."
      />,
    );
    expect(
      screen.getByText("By checking, you agree to our terms."),
    ).toBeInTheDocument();
  });

  it("toggles on click", () => {
    const onCheckedChange = vi.fn();
    render(
      <PodaciumCheckbox label="Toggle" onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reflects checked state", () => {
    render(<PodaciumCheckbox label="Active" checked />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("supports indeterminate state", () => {
    render(<PodaciumCheckbox label="Partial" indeterminate />);
    const checkbox = screen.getByRole("checkbox");
    const indicator = checkbox.closest("label")?.querySelector("[data-state]");
    expect(indicator).toHaveAttribute("data-state", "indeterminate");
  });

  it("is disabled when disabled prop is true", () => {
    render(<PodaciumCheckbox label="Disabled" disabled />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <PodaciumCheckbox label="Required" error="This field is required" />,
    );
    expect(screen.getByText("This field is required")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows required indicator", () => {
    render(<PodaciumCheckbox label="Required" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("supports label on left side", () => {
    render(<PodaciumCheckbox label="Left label" labelPosition="left" />);
    const label = screen.getByText("Left label");
    const checkbox = screen.getByRole("checkbox");
    expect(label).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    const { rerender } = render(
      <PodaciumCheckbox label="Outline" variant="outline" />,
    );
    const indicator = screen
      .getByRole("checkbox")
      .closest("label")
      ?.querySelector("[data-state]");
    expect(indicator).toHaveClass("border-input");

    rerender(<PodaciumCheckbox label="Soft" variant="soft" />);
    const softIndicator = screen
      .getByRole("checkbox")
      .closest("label")
      ?.querySelector("[data-state]");
    expect(softIndicator).toHaveClass("bg-muted");
  });

  it("applies size classes", () => {
    const { rerender } = render(<PodaciumCheckbox label="Small" size="sm" />);
    const indicator = screen
      .getByRole("checkbox")
      .closest("label")
      ?.querySelector("[data-state]");
    expect(indicator).toHaveClass("h-3.5", "w-3.5");

    rerender(<PodaciumCheckbox label="Large" size="lg" />);
    const largeIndicator = screen
      .getByRole("checkbox")
      .closest("label")
      ?.querySelector("[data-state]");
    expect(largeIndicator).toHaveClass("h-5", "w-5");
  });

  it("has accessible name from label", () => {
    render(<PodaciumCheckbox label="Dark mode" />);
    expect(screen.getByLabelText("Dark mode")).toBeInTheDocument();
  });

  it("calls both onChange and onCheckedChange", () => {
    const onChange = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      <PodaciumCheckbox
        label="Test"
        onChange={onChange}
        onCheckedChange={onCheckedChange}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("forwards ref", () => {
    const ref = vi.fn();
    render(<PodaciumCheckbox label="Test" ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });
});
