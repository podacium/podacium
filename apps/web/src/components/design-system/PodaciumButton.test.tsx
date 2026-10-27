import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PodaciumButton from "./PodaciumButton";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}));

describe("PodaciumButton", () => {
  it("renders with children text", () => {
    render(<PodaciumButton>Click me</PodaciumButton>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const onClick = vi.fn();
    render(<PodaciumButton onClick={onClick}>Click</PodaciumButton>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<PodaciumButton disabled>Disabled</PodaciumButton>);
    expect(screen.getByText("Disabled").closest("button")).toBeDisabled();
  });

  it("is disabled when loading", () => {
    render(<PodaciumButton loading>Loading</PodaciumButton>);
    const button = screen.getByText("Loading").closest("button");
    expect(button).toBeDisabled();
  });

  it("shows loading spinner when loading", () => {
    render(<PodaciumButton loading>Submit</PodaciumButton>);
    // Loader2 icon renders as an SVG with animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders as a link when href is provided", () => {
    render(<PodaciumButton href="/dashboard">Go</PodaciumButton>);
    // When href is provided, the component renders via Next's Link
    // which our mock renders as just the children text
    expect(screen.getByText("Go")).toBeInTheDocument();
  });

  it("applies variant classes correctly", () => {
    const { container } = render(
      <PodaciumButton variant="destructive">Delete</PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("bg-destructive");
  });

  it("applies craft variant classes correctly", () => {
    const { container } = render(
      <PodaciumButton variant="craft">Craft Button</PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("btn-craft-secondary");
  });

  it("applies tactile variant classes correctly", () => {
    const { container } = render(
      <PodaciumButton variant="tactile">Copy</PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("btn-tactile-keycap");
  });

  it("applies toggle variant classes correctly", () => {
    const { container } = render(
      <PodaciumButton variant="toggle" aria-pressed="true">
        Agentic
      </PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("btn-tactile-toggle");
  });

  it("applies size classes correctly", () => {
    const { container } = render(
      <PodaciumButton size="lg">Large</PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("h-11");
  });

  it("applies fullWidth class when true", () => {
    const { container } = render(
      <PodaciumButton fullWidth>Full</PodaciumButton>,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("w-full");
  });

  it("renders icon on the left by default", () => {
    render(
      <PodaciumButton icon={<span data-testid="icon">★</span>}>
        Star
      </PodaciumButton>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon.parentElement?.className).toContain("me-2");
  });

  it("renders icon on the right when specified", () => {
    render(
      <PodaciumButton
        icon={<span data-testid="icon">→</span>}
        iconPosition="right"
      >
        Next
      </PodaciumButton>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon.parentElement?.className).toContain("ms-2");
  });

  it("does not show icon when loading", () => {
    render(
      <PodaciumButton loading icon={<span data-testid="icon">★</span>}>
        Loading
      </PodaciumButton>,
    );
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
  });

  it("applies glow halo class when glow prop is set", () => {
    const { container } = render(<PodaciumButton glow>Glow</PodaciumButton>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("hover:animate-ring-pulse");
  });

  it("renders a shimmer sweep on the gradient variant", () => {
    const { container } = render(
      <PodaciumButton variant="gradient">Shine</PodaciumButton>,
    );
    expect(container.querySelector(".shimmer-sweep")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<PodaciumButton aria-label="Submit form">Submit</PodaciumButton>);
    expect(screen.getByLabelText("Submit form")).toBeInTheDocument();
  });
});
