import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LanguageSwitcher, { handleLanguageChange } from "./LanguageSwitcher";
import { IntlProvider } from "@/lib/i18n";

describe("handleLanguageChange", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        pathname: "/fr/about",
        search: "?lang=fr&ref=test",
        hash: "#section",
        href: "https://podacium.com/fr/about?lang=fr&ref=test#section",
      },
    });
    document.cookie = "";
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("atomically rewrites path prefix from /fr/... to /ar/...", () => {
    handleLanguageChange("ar");

    expect(window.location.href).toBe("/ar/about?ref=test#section");
    expect(document.cookie).toContain("locale=ar");
    expect(document.cookie).toContain("NEXT_LOCALE=ar");
  });

  it("atomically rewrites unprefixed path /about to /ar/about", () => {
    window.location.pathname = "/about";
    window.location.search = "";
    window.location.hash = "";

    handleLanguageChange("ar");

    expect(window.location.href).toBe("/ar/about");
    expect(document.cookie).toContain("locale=ar");
  });

  it("atomically rewrites root path / to /kab", () => {
    window.location.pathname = "/";
    window.location.search = "";
    window.location.hash = "";

    handleLanguageChange("kab");

    expect(window.location.href).toBe("/kab");
    expect(document.cookie).toContain("locale=kab");
  });
});

describe("LanguageSwitcher Component", () => {
  it("renders with active language indicator", () => {
    render(
      <IntlProvider
        messages={{
          common: { settings: { account: { language: "Language" } } },
        }}
        locale="fr"
      >
        <LanguageSwitcher />
      </IntlProvider>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(button.textContent).toContain("FR");
  });

  it("opens dropdown and displays supported languages", () => {
    render(
      <IntlProvider messages={{ common: {} }} locale="fr">
        <LanguageSwitcher />
      </IntlProvider>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText("العربية")).toBeDefined();
    expect(screen.getByText("English")).toBeDefined();
    expect(screen.getByText("Taqbaylit")).toBeDefined();
  });
});
