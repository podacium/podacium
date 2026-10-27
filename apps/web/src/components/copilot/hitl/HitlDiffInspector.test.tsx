import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HitlDiffInspector } from "./HitlDiffInspector";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "copilot.hitl.diff.splitViewAria": "Split view",
      "copilot.hitl.diff.split": "Split",
      "copilot.hitl.diff.unifiedViewAria": "Unified view",
      "copilot.hitl.diff.unified": "Unified",
      "copilot.hitl.diff.before": "Before",
      "copilot.hitl.diff.after": "After",
    };
    return map[key] ?? key;
  },
}));

describe("HitlDiffInspector Component", () => {
  const beforeObj = { status: "PENDING", count: 1 };
  const afterObj = { status: "APPROVED", count: 2 };

  it("renders with title and default split view mode", () => {
    render(
      <HitlDiffInspector
        title="Custom Changes"
        before={beforeObj}
        after={afterObj}
      />,
    );

    expect(screen.getByTestId("hitl-diff-inspector")).toBeInTheDocument();
    expect(screen.getByText("Custom Changes")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("renders localized split and unified view mode toggle buttons", () => {
    render(<HitlDiffInspector before={beforeObj} after={afterObj} />);

    const splitBtn = screen.getByRole("button", { name: "Split view" });
    const unifiedBtn = screen.getByRole("button", { name: "Unified view" });

    expect(splitBtn).toBeInTheDocument();
    expect(unifiedBtn).toBeInTheDocument();
    expect(splitBtn).toHaveTextContent("Split");
    expect(unifiedBtn).toHaveTextContent("Unified");
  });

  it("switches to unified view mode when clicking unified button", () => {
    render(<HitlDiffInspector before="old content" after="new content" />);

    const unifiedBtn = screen.getByRole("button", { name: "Unified view" });
    fireEvent.click(unifiedBtn);

    // In unified view, before and after header columns should not be rendered
    expect(screen.queryByText("Before")).not.toBeInTheDocument();
    expect(screen.queryByText("After")).not.toBeInTheDocument();
  });
});
