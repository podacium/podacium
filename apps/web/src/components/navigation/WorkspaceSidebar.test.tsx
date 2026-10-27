import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import type { NavSection } from "@/lib/navigation/chrome";
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  BookOpen,
} from "lucide-react";

let mockPathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: any) => (
    <a
      href={href}
      data-prefetch={prefetch === undefined ? undefined : String(prefetch)}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: any) => (
    <img {...props} alt={props.alt || "icon"} />
  ),
}));

vi.mock("@/lib/i18n", () => {
  const translator = (key: string, vars?: any, fallback?: string) => {
    if (key === "common.loadingScreen.brand") return "Podacium";
    if (vars?.count) return `${vars.count} notifications`;
    return fallback || key;
  };
  return {
    useTranslations: () => translator,
    useLocale: () => "en",
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

const testSections: readonly NavSection[] = [
  {
    id: "core",
    labelKey: "admin.sections.overview",
    items: [
      {
        id: "item-dashboard",
        labelKey: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "item-users",
        labelKey: "Users",
        href: "/admin/users",
        icon: Users,
        badge: { count: 5, tone: "destructive" },
        permissions: ["manage_users"],
      },
      {
        id: "item-settings",
        labelKey: "Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

const mixedSections: readonly NavSection[] = [
  {
    id: "mixed",
    labelKey: "admin.sections.overview",
    items: [
      {
        id: "mixed-dashboard",
        labelKey: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "mixed-review",
        labelKey: "Review",
        href: "/admin/content-review",
        icon: Shield,
        match: "prefix",
      },
      {
        id: "mixed-courses",
        labelKey: "Courses",
        href: "/admin/courses",
        icon: BookOpen,
        match: "prefix",
      },
    ],
  },
];

describe("WorkspaceSidebar Component", () => {
  beforeEach(() => {
    mockPathname = "/admin";
    document.cookie = "";
    delete document.documentElement.dataset.sidebar;
    vi.clearAllMocks();
  });

  it("renders contextual header and navigation items", () => {
    render(
      <WorkspaceSidebar
        sections={testSections}
        labelKey="admin.title"
        title="Admin Console"
        subtitle="Platform Governance"
        initialState="expanded"
      />,
    );

    expect(screen.getByTestId("workspace-sidebar")).toBeDefined();
    expect(screen.getByText("Admin Console")).toBeDefined();
    expect(screen.getByText("Platform Governance")).toBeDefined();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Users")).toBeDefined();
  });

  it("marks the active link with aria-current='page'", () => {
    mockPathname = "/admin";
    render(
      <WorkspaceSidebar sections={testSections} initialState="expanded" />,
    );

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink.getAttribute("aria-current")).toBe("page");

    const usersLink = screen.getByRole("link", { name: /Users/i });
    expect(usersLink.getAttribute("aria-current")).toBeNull();
  });

  it("renders accessible badge count with sr-only description", () => {
    render(
      <WorkspaceSidebar sections={testSections} initialState="expanded" />,
    );

    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("5 notifications")).toBeDefined();
  });

  it("filters items based on canSee permission callback", () => {
    const canSeeMock = (perms?: readonly string[]) => {
      if (perms?.includes("manage_users")) return false;
      return true;
    };

    render(
      <WorkspaceSidebar
        sections={testSections}
        canSee={canSeeMock}
        initialState="expanded"
      />,
    );

    expect(screen.queryByText("Users")).toBeNull();
    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("toggles collapse state and updates cookie and dataset", () => {
    render(
      <WorkspaceSidebar sections={testSections} initialState="expanded" />,
    );

    const aside = screen.getByTestId("workspace-sidebar");
    expect(aside.getAttribute("data-state")).toBe("expanded");

    const collapseBtn = screen.getByTestId("sidebar-collapse-btn");
    fireEvent.click(collapseBtn);

    expect(aside.getAttribute("data-state")).toBe("collapsed");
    expect(document.cookie).toContain("pd_sidebar=collapsed");
    expect(document.documentElement.dataset.sidebar).toBe("collapsed");

    // Click again to expand
    fireEvent.click(collapseBtn);
    expect(aside.getAttribute("data-state")).toBe("expanded");
    expect(document.cookie).toContain("pd_sidebar=expanded");
    expect(document.documentElement.dataset.sidebar).toBe("expanded");
  });

  it("hides links the role gate would reject", () => {
    render(
      <WorkspaceSidebar
        sections={mixedSections}
        role="MODERATOR"
        initialState="expanded"
      />,
    );

    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Review")).toBeDefined();
    expect(screen.queryByText("Courses")).toBeNull();
  });

  it("keeps gated links for roles that pass the gate", () => {
    render(
      <WorkspaceSidebar
        sections={mixedSections}
        role="ADMIN"
        initialState="expanded"
      />,
    );

    expect(screen.getByText("Review")).toBeDefined();
    expect(screen.getByText("Courses")).toBeDefined();
  });

  it("never prefetches role-gated links while the role is unknown", () => {
    render(
      <WorkspaceSidebar sections={mixedSections} initialState="expanded" />,
    );

    // Items stay visible (no hydration flicker) ...
    expect(screen.getByText("Courses")).toBeDefined();
    // ... but the Edge would redirect a prefetch, so it is disabled.
    const courses = screen.getByRole("link", { name: /Courses/i });
    expect(courses.getAttribute("data-prefetch")).toBe("false");

    const dashboard = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboard.getAttribute("data-prefetch")).toBe("true");
  });

  it("prefetches gated links once the role is known to be allowed", () => {
    render(
      <WorkspaceSidebar
        sections={mixedSections}
        role="ADMIN"
        initialState="expanded"
      />,
    );

    const courses = screen.getByRole("link", { name: /Courses/i });
    expect(courses.getAttribute("data-prefetch")).toBe("true");
  });
});
