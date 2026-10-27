import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DashboardCommentDrawer, CommentItem } from "./DashboardCommentDrawer";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

describe("DashboardCommentDrawer", () => {
  const mockComments: CommentItem[] = [
    {
      id: 1,
      dashboard_id: 10,
      widget_id: 2,
      author_id: 101,
      author_name: "Amine",
      content: "Great revenue trend chart",
      position_x: 45,
      position_y: 60,
      is_resolved: false,
      created_at: "2026-09-04T00:00:00Z",
    },
  ];

  it("renders comments drawer when open", () => {
    render(
      <DashboardCommentDrawer
        isOpen={true}
        onClose={vi.fn()}
        dashboardId={10}
        comments={mockComments}
        onAddComment={vi.fn()}
        onToggleResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("Amine")).toBeInTheDocument();
    expect(screen.getByText("Great revenue trend chart")).toBeInTheDocument();
  });

  it("triggers onAddComment when form is submitted", async () => {
    const handleAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <DashboardCommentDrawer
        isOpen={true}
        onClose={vi.fn()}
        dashboardId={10}
        comments={mockComments}
        onAddComment={handleAdd}
        onToggleResolve={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(
      "dashboards.comments.addPlaceholder",
    );
    fireEvent.change(input, { target: { value: "New comment test" } });

    const submitButton = input.nextElementSibling as HTMLButtonElement;
    fireEvent.click(submitButton);

    expect(handleAdd).toHaveBeenCalledWith("New comment test", undefined, null);
  });
});
