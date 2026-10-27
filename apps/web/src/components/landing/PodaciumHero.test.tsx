import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntlProvider } from "@/lib/i18n";
import en from "../../../locales/en/home.json";
import { PodaciumHero } from "./PodaciumHero";

// Canvas is not implemented in jsdom; the grid is decorative only.
vi.mock("@/components/velora/PodaciumRetroGrid", () => ({
  PodaciumRetroGrid: () => null,
}));

// The global test setup mocks next/link down to its children, which hides
// `href`; render a real anchor here so navigation targets are asserted.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const renderHero = () =>
  render(
    <IntlProvider messages={{ home: en }} locale="en">
      <PodaciumHero />
    </IntlProvider>,
  );

describe("PodaciumHero", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders the headline, subtitle and both calls to action", () => {
    renderHero();

    expect(
      screen.getByRole("heading", { level: 1, name: /learn the skill/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(en.hero.headline.part2)).toBeInTheDocument();
    expect(screen.getByText(en.hero.headline.part3)).toBeInTheDocument();
    expect(screen.getByText(en.hero.subtitle)).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: en.hero.cta.primary }),
    ).toHaveAttribute("href", "/learn");
    expect(
      screen.getByRole("button", { name: en.hero.cta.secondary }),
    ).toBeInTheDocument();
  });

  it("scrolls to the explainer when the secondary CTA is used", () => {
    renderHero();

    const explainer = document.createElement("div");
    explainer.id = "explainer-video";
    document.body.appendChild(explainer);

    fireEvent.click(
      screen.getByRole("button", { name: en.hero.cta.secondary }),
    );

    expect(explainer.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    explainer.remove();
  });

  it("describes the dashboard preview for assistive tech", () => {
    renderHero();

    expect(
      screen.getByRole("img", { name: en.hero.dashboard.ariaLabel }),
    ).toBeInTheDocument();
  });

  it("lists the four pillars and the trust facts", () => {
    renderHero();

    const pillars = screen.getByRole("list", {
      name: en.hero.pillarsAriaLabel,
    });
    expect(pillars.querySelectorAll("li")).toHaveLength(4);

    for (const item of Object.values(en.hero.trust.items)) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
