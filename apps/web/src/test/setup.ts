import "@testing-library/jest-dom";
import { vi, expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import React from "react";

expect.extend(axeMatchers);

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: vi.fn(({ children }: { children: React.ReactNode }) => children),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = vi.fn();
}

// ── Default Test i18n Messages ────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { setDefaultTestMessages } from "@/lib/i18n";

function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

try {
  const localesDir = path.resolve(__dirname, "../../locales/en");
  if (fs.existsSync(localesDir)) {
    const files = fs.readdirSync(localesDir);
    let messages: Record<string, any> = {};

    for (const file of files) {
      if (file.endsWith(".json")) {
        const ns = path.basename(file, ".json");
        try {
          const content = JSON.parse(
            fs.readFileSync(path.join(localesDir, file), "utf-8"),
          );
          messages = deepMerge(messages, content);
          messages[ns] = deepMerge(messages[ns] || {}, content);
        } catch {
          // ignore parsing error in test setup
        }
      }
    }
    setDefaultTestMessages(messages);
  }
} catch {
  // ignore in environments without filesystem access
}
