import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ResizableCodeRunner } from "./ResizableCodeRunner";

describe("ResizableCodeRunner", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it("renders problem title, requirements, and starter code", () => {
    render(<ResizableCodeRunner />);
    expect(
      screen.getAllByText(
        "Algerian Fiscal Tax Engine & Sweep-Line Interval Optimizer",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Pedagogical Requirements")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sort intervals by start timestamp in O(N log N) time complexity.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Run Tests")).toBeInTheDocument();
    expect(screen.getByText("Submit Capstone")).toBeInTheDocument();
  });

  it("unlocks progressive hints level by level", () => {
    render(<ResizableCodeRunner />);
    expect(
      screen.getByText("Progressive Hints (0/3 Unlocked)"),
    ).toBeInTheDocument();

    const unlockBtn = screen.getByText("Unlock Next Hint");
    fireEvent.click(unlockBtn);
    expect(
      screen.getByText("Progressive Hints (1/3 Unlocked)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Hint 1: Conceptual Strategy")).toBeInTheDocument();

    fireEvent.click(unlockBtn);
    expect(
      screen.getByText("Progressive Hints (2/3 Unlocked)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hint 2: Structural Algorithm"),
    ).toBeInTheDocument();

    fireEvent.click(unlockBtn);
    expect(
      screen.getByText("Progressive Hints (3/3 Unlocked)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hint 3: Solution Architecture"),
    ).toBeInTheDocument();
  });

  it("switches console tabs between assertions, xterm, and metrics", () => {
    render(<ResizableCodeRunner />);
    expect(screen.getByText("Test Cases (0/3)")).toBeInTheDocument();

    // Switch to xterm Output tab
    fireEvent.click(screen.getByText("xterm Output"));
    expect(
      screen.getByText(/cgroup quota: 128MB RAM, 0.5 vCPU/i),
    ).toBeInTheDocument();

    // Switch to Sandbox Metrics tab
    fireEvent.click(screen.getByText("Sandbox Metrics"));
    expect(screen.getByText("MicroVM Memory Footprint")).toBeInTheDocument();
    expect(
      screen.getByText("AST Winnowing Plagiarism Check"),
    ).toBeInTheDocument();
  });

  it("runs tests and displays pass/fail chips with execution metrics", async () => {
    const onRunSuccess = vi.fn();
    render(<ResizableCodeRunner onRunSuccess={onRunSuccess} />);

    const runBtn = screen.getByText("Run Tests");
    fireEvent.click(runBtn);

    expect(screen.getByText("Running...")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText("Run Tests")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(onRunSuccess).toHaveBeenCalled();
  });

  it("copies code to clipboard", () => {
    render(<ResizableCodeRunner />);
    const copyBtn = screen.getByTitle("Copy code to clipboard");
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
