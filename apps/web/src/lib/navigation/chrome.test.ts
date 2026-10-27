import { describe, it, expect } from "vitest";
import {
  resolveChromeMode,
  normalizePathname,
  isItemActive,
  CHROME,
} from "./chrome";

describe("navigation chrome resolver", () => {
  it("normalizes locale-prefixed routes", () => {
    expect(normalizePathname("/ar/dashboard")).toBe("/dashboard");
    expect(normalizePathname("/fr/admin/users")).toBe("/admin/users");
    expect(normalizePathname("/kab/learn")).toBe("/learn");
    expect(normalizePathname("/en")).toBe("/");
    expect(normalizePathname("/dashboard")).toBe("/dashboard");
  });

  it("resolves correct chrome modes across all application route archetypes", () => {
    // Focus Mode
    expect(resolveChromeMode("/learn/courses/ai-mastery/lesson/lesson-4")).toBe(
      "focus",
    );
    expect(resolveChromeMode("/ar/live/session-123")).toBe("focus");

    // Canvas Mode
    expect(resolveChromeMode("/copilot")).toBe("canvas");
    expect(resolveChromeMode("/fr/copilot")).toBe("canvas");
    expect(resolveChromeMode("/podalil")).toBe("canvas");
    expect(resolveChromeMode("/ar/podalil")).toBe("canvas");
    expect(resolveChromeMode("/bi/dashboards/dash-99")).toBe("canvas");
    expect(resolveChromeMode("/bi/reports/rep-42")).toBe("canvas");

    // Admin Console
    expect(resolveChromeMode("/admin")).toBe("admin");
    expect(resolveChromeMode("/fr/admin/users")).toBe("admin");
    expect(resolveChromeMode("/admin/settings")).toBe("admin");

    // Instructor Studio
    expect(resolveChromeMode("/learn/manage")).toBe("studio");
    expect(resolveChromeMode("/learn/create/lesson")).toBe("studio");

    // Account & Settings
    expect(resolveChromeMode("/settings")).toBe("account");
    expect(resolveChromeMode("/settings/devices")).toBe("account");

    // Workspace
    expect(resolveChromeMode("/dashboard")).toBe("workspace");
    expect(resolveChromeMode("/dashboard/learning")).toBe("workspace");
    expect(resolveChromeMode("/hub/contracts/123")).toBe("workspace");
    expect(resolveChromeMode("/notifications")).toBe("workspace");

    // Discover & Catalog
    expect(resolveChromeMode("/learn")).toBe("discover");
    expect(resolveChromeMode("/learn/courses")).toBe("discover");
    expect(resolveChromeMode("/hub/projects")).toBe("discover");
    expect(resolveChromeMode("/bi/datasets")).toBe("discover");
    expect(resolveChromeMode("/help")).toBe("discover");
    expect(resolveChromeMode("/profile/me")).toBe("discover");

    // Marketing / Fallback
    expect(resolveChromeMode("/")).toBe("marketing");
    expect(resolveChromeMode("/about")).toBe("marketing");
    expect(resolveChromeMode("/pricing")).toBe("marketing");
  });

  it("maps chrome spec variants correctly", () => {
    expect(CHROME.marketing.navbar).toBe("full");
    expect(CHROME.marketing.showFooter).toBe(true);

    expect(CHROME.workspace.navbar).toBe("compact");
    expect(CHROME.workspace.hasSpine).toBe(true);
    expect(CHROME.workspace.showFooter).toBe(false);

    expect(CHROME.admin.navbar).toBe("compact");
    expect(CHROME.admin.hasSpine).toBe(true);

    expect(CHROME.focus.navbar).toBe("focus");
    expect(CHROME.focus.showBottomNav).toBe(false);
  });

  it("accurately evaluates active state of items with prefix and exact matching", () => {
    expect(
      isItemActive("/dashboard", { href: "/dashboard", match: "exact" }),
    ).toBe(true);
    expect(
      isItemActive("/dashboard/learning", {
        href: "/dashboard",
        match: "exact",
      }),
    ).toBe(false);

    expect(
      isItemActive("/admin/users", { href: "/admin/users", match: "prefix" }),
    ).toBe(true);
    expect(
      isItemActive("/admin/users/123/edit", {
        href: "/admin/users",
        match: "prefix",
      }),
    ).toBe(true);
    expect(
      isItemActive("/ar/admin/users", {
        href: "/admin/users",
        match: "prefix",
      }),
    ).toBe(true);
  });
});
