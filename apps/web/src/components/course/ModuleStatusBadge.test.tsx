import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModuleStatusBadge } from "./ModuleStatusBadge";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string, vars?: any) => {
    const map: Record<string, string> = {
      "contentReview.statuses.draft": "Draft",
      "contentReview.statuses.inReview": "In Review",
      "contentReview.statuses.published": "Published",
      "contentReview.statuses.archived": "Archived",
    };
    if (key === "contentReview.statusAriaLabel") {
      return `Module status: ${vars?.status || ""}`;
    }
    return map[key] || key;
  },
}));

describe("ModuleStatusBadge", () => {
  it("renders DRAFT status with correct label and styling", () => {
    render(<ModuleStatusBadge status="DRAFT" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Draft");
    expect(badge).toHaveClass("bg-gray-100 dark:bg-slate-800");
  });

  it("renders IN_REVIEW status with correct label", () => {
    render(<ModuleStatusBadge status="IN_REVIEW" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("In Review");
    expect(badge).toHaveClass("bg-amber-50");
  });

  it("renders PUBLISHED status with correct label", () => {
    render(<ModuleStatusBadge status="PUBLISHED" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Published");
    expect(badge).toHaveClass("bg-emerald-50");
  });

  it("renders ARCHIVED status with correct label", () => {
    render(<ModuleStatusBadge status="ARCHIVED" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Archived");
    expect(badge).toHaveClass("bg-red-50");
  });

  it("has accessible aria-label", () => {
    render(<ModuleStatusBadge status="PUBLISHED" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Module status: Published");
  });

  it("accepts custom className", () => {
    render(<ModuleStatusBadge status="DRAFT" className="mt-2" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("mt-2");
  });
});
