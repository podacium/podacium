import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrillThroughDrawer } from "../DrillThroughDrawer";
import { DrillThroughRecord } from "../types";

describe("DrillThroughDrawer (Pagination & Infinite Scroll Pushdown)", () => {
  const generateMockRecords = (count: number): DrillThroughRecord[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `rec_${i + 1}`,
      date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      entity: `Wilaya Entity ${i + 1}`,
      category: i % 2 === 0 ? "Cloud Infra" : "Escrow Fee",
      amount: 1000 * (i + 1),
      variance: i % 2 === 0 ? 500 : -200,
      status: i % 3 === 0 ? "approved" : "flagged",
    }));
  };

  const records = generateMockRecords(25);

  it("renders drawer with first page sliced to pageSize (default 10)", () => {
    render(
      <DrillThroughDrawer
        isOpen={true}
        onClose={vi.fn()}
        title="Revenue Drill Through"
        records={records}
        pageSize={10}
      />,
    );

    expect(screen.getByText("Revenue Drill Through")).toBeInTheDocument();
    // Record 1 should be visible
    expect(screen.getByText("Wilaya Entity 1")).toBeInTheDocument();
    expect(screen.getByText("Wilaya Entity 10")).toBeInTheDocument();
    // Record 11 should NOT be rendered in DOM, avoiding bloat
    expect(screen.queryByText("Wilaya Entity 11")).not.toBeInTheDocument();
    // Total count indicator
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it("navigates cleanly to page 2 when page button clicked", () => {
    render(
      <DrillThroughDrawer
        isOpen={true}
        onClose={vi.fn()}
        title="Revenue Drill Through"
        records={records}
        pageSize={10}
      />,
    );

    // Click on page 2 button
    const page2Btn = screen.getByRole("button", { name: "2" });
    fireEvent.click(page2Btn);

    // Now record 11 should be visible, record 1 should not
    expect(screen.getByText("Wilaya Entity 11")).toBeInTheDocument();
    expect(screen.queryByText("Wilaya Entity 1")).not.toBeInTheDocument();
  });

  it("switches to infinite scroll mode and loads more items on demand", () => {
    render(
      <DrillThroughDrawer
        isOpen={true}
        onClose={vi.fn()}
        title="Revenue Drill Through"
        records={records}
        pageSize={10}
      />,
    );

    // Toggle mode to Infinite
    const infiniteToggle = screen.getByTitle(
      "Infinite scrolling / continuous list",
    );
    fireEvent.click(infiniteToggle);

    expect(screen.getByText("Continuous scrolling active")).toBeInTheDocument();
    // Load More button should be visible
    const loadMoreBtn = screen.getByRole("button", { name: /Load More/ });
    expect(loadMoreBtn).toBeInTheDocument();

    fireEvent.click(loadMoreBtn);
    // After clicking load more, entity 11 should also be in DOM alongside entity 1
    expect(screen.getByText("Wilaya Entity 1")).toBeInTheDocument();
    expect(screen.getByText("Wilaya Entity 11")).toBeInTheDocument();
  });

  it("invokes server-side pagination callback when pushdown is configured", () => {
    const handlePageChange = vi.fn();
    render(
      <DrillThroughDrawer
        isOpen={true}
        onClose={vi.fn()}
        title="Remote Pushdown Drill Through"
        records={records.slice(0, 10)}
        totalRecords={100}
        pageSize={10}
        onPageChange={handlePageChange}
      />,
    );

    expect(screen.getByText("pushdown active")).toBeInTheDocument();
    const nextBtn = screen.getByLabelText("Next page");
    fireEvent.click(nextBtn);

    expect(handlePageChange).toHaveBeenCalledWith(2, 10);
  });
});
