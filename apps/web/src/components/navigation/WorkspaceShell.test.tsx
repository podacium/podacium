import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkspaceShell } from "./WorkspaceShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("WorkspaceShell Component", () => {
  it("renders with preset='workspace' without requiring sections prop", () => {
    render(
      <WorkspaceShell preset="workspace">
        <div data-testid="dashboard-content">Dashboard Content</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-shell")).toBeDefined();
    expect(screen.getByTestId("dashboard-content")).toBeDefined();
  });

  it("renders with preset='admin'", () => {
    render(
      <WorkspaceShell preset="admin">
        <div data-testid="admin-content">Admin Content</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-shell")).toBeDefined();
    expect(screen.getByTestId("admin-content")).toBeDefined();
  });

  it("renders with preset='studio'", () => {
    render(
      <WorkspaceShell preset="studio">
        <div data-testid="studio-content">Studio Content</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-shell")).toBeDefined();
    expect(screen.getByTestId("studio-content")).toBeDefined();
  });

  it("renders with preset='account'", () => {
    render(
      <WorkspaceShell preset="account">
        <div data-testid="account-content">Account Content</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-shell")).toBeDefined();
    expect(screen.getByTestId("account-content")).toBeDefined();
  });

  it("omits persistent desktop rail when hideSidebar is true", () => {
    render(
      <WorkspaceShell preset="admin" hideSidebar={true}>
        <div data-testid="mail-content">Mail Suite</div>
      </WorkspaceShell>,
    );

    expect(screen.getByTestId("workspace-shell")).toBeDefined();
    expect(screen.getByTestId("mail-content")).toBeDefined();
    expect(screen.queryByTestId("workspace-sidebar")).toBeNull();
  });
});
