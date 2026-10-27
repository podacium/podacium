/* eslint-disable react/display-name -- framer-motion mocks are anonymous by design */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Navbar from "./Navbar";

let mockPathname = "/";
let mockAuthenticated = false;
let mockUser: any = null;
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: any) => (
    <img {...props} alt={props.alt || "image"} />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    span: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <span ref={ref} {...props}>
        {children}
      </span>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/lib/i18n", () => {
  const translator = (key: string, _vars?: any, fallback?: string) =>
    fallback || key;
  translator.t = translator;
  translator.raw = () => [];
  return {
    useTranslations: () => translator,
    useLocale: () => "en",
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockAuthenticated,
    loading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    data: { notifications: [] },
    isLoading: false,
    error: null,
  }),
  useUnreadCount: () => ({ data: 0 }),
  useMarkAsRead: () => ({ mutate: vi.fn() }),
  useMarkAllAsRead: () => ({ mutate: vi.fn() }),
}));

vi.mock("./LanguageSwitcher", () => ({
  default: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

vi.mock("@/components/UniversalImage", () => ({
  default: (props: any) => <img {...props} alt={props.alt || "img"} />,
}));

vi.mock("@/components/UserAvatar", () => ({
  default: (props: any) => <div data-testid="user-avatar">{props.alt}</div>,
}));

describe("Navbar Desktop In-Place Search & Auth Compacting", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockAuthenticated = false;
    mockUser = null;
    mockPush.mockClear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders responsive brand logo for guests (compact icon on mobile, full logo on desktop)", () => {
    mockAuthenticated = false;
    mockUser = null;

    render(<Navbar />);

    expect(screen.getByTestId("guest-mobile-logo")).toBeDefined();
    expect(screen.getByTestId("guest-full-logo")).toBeDefined();
    expect(screen.queryByTestId("compact-auth-logo")).toBeNull();
  });

  it("renders compact 36px icon logo across all viewports when authenticated", () => {
    mockAuthenticated = true;
    mockUser = {
      id: 1,
      email: "amina@test.com",
      fullName: "Amina Benali",
      role: "MEMBER",
    };

    render(<Navbar />);

    expect(screen.getByTestId("compact-auth-logo")).toBeDefined();
    expect(screen.queryByTestId("guest-mobile-logo")).toBeNull();
    expect(screen.queryByTestId("guest-full-logo")).toBeNull();
  });

  it("toggles in-place desktop search when 🔍 button is clicked", () => {
    render(<Navbar />);

    const searchTrigger = screen.getByTestId("desktop-search-trigger");
    expect(searchTrigger).toBeDefined();

    fireEvent.click(searchTrigger);

    const input = screen.getByTestId("desktop-search-input");
    expect(input).toBeDefined();
  });

  it("closes in-place search when close button is clicked", () => {
    render(<Navbar />);

    const searchTrigger = screen.getByTestId("desktop-search-trigger");
    fireEvent.click(searchTrigger);

    const closeBtn = screen.getByTestId("desktop-search-close");
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId("desktop-search-input")).toBeNull();
  });

  it("clears query on Escape, then closes on second Escape", () => {
    render(<Navbar />);

    const searchTrigger = screen.getByTestId("desktop-search-trigger");
    fireEvent.click(searchTrigger);

    const input = screen.getByTestId("desktop-search-input");
    fireEvent.change(input, { target: { value: "python" } });
    expect(input).toHaveProperty("value", "python");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveProperty("value", "");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("desktop-search-input")).toBeNull();
  });

  it("fetches and renders categorized search results and dispatches help event on zero-results ask team click", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    });
    global.fetch = fetchMock;

    const eventListener = vi.fn();
    window.addEventListener("open-help-launcher", eventListener);

    render(<Navbar />);

    const searchTrigger = screen.getByTestId("desktop-search-trigger");
    fireEvent.click(searchTrigger);

    const input = screen.getByTestId("desktop-search-input");
    fireEvent.change(input, { target: { value: "unknowntermxyz" } });

    await waitFor(() => {
      expect(screen.getByTestId("ask-team-btn")).toBeDefined();
    });

    const askTeamBtn = screen.getByTestId("ask-team-btn");
    fireEvent.click(askTeamBtn);

    expect(eventListener).toHaveBeenCalled();
    window.removeEventListener("open-help-launcher", eventListener);
  });

  it("adapts navbar container width dynamically based on auth and search states", () => {
    mockAuthenticated = false;
    mockUser = null;
    const { rerender } = render(<Navbar />);

    const nav = screen.getByTestId("main-navbar");
    expect(nav.className).toContain("max-w-7xl");

    // Authenticated state keeps full max-w-7xl so nav links + WorkspaceSwitcher + controls never overlap
    mockAuthenticated = true;
    mockUser = {
      id: 1,
      email: "user@test.com",
      fullName: "Test User",
      role: "MEMBER",
    };
    rerender(<Navbar />);
    expect(nav.className).toContain("max-w-7xl");

    // Search active state focuses with max-w-4xl
    const searchTrigger = screen.getByTestId("desktop-search-trigger");
    fireEvent.click(searchTrigger);
    expect(nav.className).toContain("max-w-4xl");
  });

  it("applies docked positioning and attributes on spine routes like /admin", () => {
    mockPathname = "/admin/users";
    render(<Navbar />);

    const nav = screen.getByTestId("main-navbar");
    expect(nav.getAttribute("data-chrome")).toBe("compact");
    expect(nav.className).toContain("inset-x-3 sm:inset-x-4");
    expect(nav.className).toContain("max-w-5xl");
    expect(nav.className).toContain("mx-auto");
  });

  it("renders minimal cinema header on focus routes like course lessons", () => {
    mockPathname = "/learn/courses/react-101/lesson/intro";
    render(<Navbar />);

    const nav = screen.getByTestId("main-navbar");
    expect(nav.getAttribute("data-chrome")).toBe("focus");
    expect(screen.getByTestId("focus-exit-btn")).toBeDefined();
    expect(screen.getByTestId("focus-search-trigger")).toBeDefined();
    expect(screen.queryByTestId("guest-full-logo")).toBeNull();
  });

  it("renders compact command trigger and hides public marketing menubar on operating routes", () => {
    mockPathname = "/learn/manage";
    render(<Navbar />);

    const nav = screen.getByTestId("main-navbar");
    expect(nav.getAttribute("data-chrome")).toBe("compact");
    expect(screen.getByTestId("compact-search-trigger")).toBeDefined();
    expect(screen.queryByRole("menubar")).toBeNull();
  });
});
