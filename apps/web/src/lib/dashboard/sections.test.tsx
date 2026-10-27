import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { PlatformMetricsSection } from "./sections";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string, _vars?: any, fallback?: string) => {
    const translations: Record<string, string> = {
      "dashboard.stats.platformUsers": "مستخدمي المنصة",
      "dashboard.stats.revenue": "الإيرادات",
      "dashboard.stats.activeCourses.title": "الدورات النشطة",
      "dashboard.stats.activeProjects.title": "المشاريع النشطة",
      "dashboard.stats.transactions": "المعاملات",
      "dashboard.adminSections.health.uptime": "وقت التشغيل",
      "dashboard.adminSections.platform.title": "مؤشرات المنصة",
    };
    return translations[key] || fallback || key;
  },
  useBidi: () => ({ isRTL: true, dir: "rtl" }),
  useLocale: () => "ar",
}));

describe("PlatformMetricsSection", () => {
  const mockStats = {
    total_users: 8,
    users_growth: -25.0,
    total_revenue: 0,
    revenue_growth: 0.0,
    active_courses: 4,
    active_projects: 0,
    total_transactions: 0,
    system_uptime: 99.9,
  };

  it("renders null when stats are undefined", () => {
    const { container } = render(<PlatformMetricsSection stats={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the executive floating capsule dock with all 6 metrics", () => {
    render(<PlatformMetricsSection stats={mockStats} />);
    const tablist = screen.getByRole("tablist", { name: "مؤشرات المنصة" });
    expect(tablist).toBeDefined();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(6);
  });

  it("expands the active anchor metric by default and displays value and growth", () => {
    render(
      <PlatformMetricsSection stats={mockStats} initialActiveId="users" />,
    );
    const usersTab = screen.getByRole("tab", { name: "مستخدمي المنصة" });
    expect(usersTab.getAttribute("aria-selected")).toBe("true");

    // Shows metric value
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    // Shows metric growth
    expect(screen.getAllByText("-25.0%").length).toBeGreaterThan(0);
  });

  it("switches active metric and expands on click", () => {
    render(
      <PlatformMetricsSection stats={mockStats} initialActiveId="users" />,
    );
    const revenueTab = screen.getByRole("tab", { name: "الإيرادات" });

    fireEvent.click(revenueTab);
    expect(revenueTab.getAttribute("aria-selected")).toBe("true");

    // Panel updates to revenue spotlight
    const panel = screen.getByRole("tabpanel");
    expect(panel.textContent).toContain("الإيرادات");
  });

  it("temporarily expands hovered tab on mouse enter", () => {
    render(
      <PlatformMetricsSection stats={mockStats} initialActiveId="users" />,
    );
    const coursesTab = screen.getByRole("tab", { name: "الدورات النشطة" });

    fireEvent.mouseEnter(coursesTab);
    // The tab should now have the expanded container visible
    expect(coursesTab.querySelector(".max-w-\\[200px\\]")).not.toBeNull();
  });
});
