import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FreelancingLayer from "./FreelancingLayer";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      whileInView,
      viewport,
      transition,
      ...props
    }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock i18n
vi.mock("@/lib/i18n", () => {
  const t = (key: string) => {
    const translations: Record<string, string> = {
      "pillars.hub.talentProfiles.0.skill": "Data Analyst",
      "pillars.hub.talentProfiles.1.skill": "Python Dev",
      "pillars.hub.talentProfiles.2.skill": "BI Engineer",
      "layers.freelancing.label": "Layer 02: Freelancing",
      "pillars.hub.subtitle": "The bridge to market visibility.",
      "pillars.hub.description":
        "We don't just offer a marketplace; we offer readiness indicators.",
      "layers.freelancing.readiness.title": "Readiness",
      "layers.freelancing.readiness.desc":
        "Skills linked automatically to profiles.",
      "layers.freelancing.reputation.title": "Reputation",
      "layers.freelancing.reputation.desc":
        "Flowing directly from learning outcomes.",
      "layers.freelancing.cta": "Explore the Talent Hub",
    };
    return translations[key] || key;
  };
  return {
    useTranslations: () => t,
    useBidi: () => ({
      isRTL: false,
      dir: "ltr",
    }),
  };
});

describe("FreelancingLayer Component", () => {
  it("renders talent match profiles with signal indicators", () => {
    render(<FreelancingLayer />);

    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    expect(screen.getByText("Python Dev")).toBeInTheDocument();
    expect(screen.getByText("BI Engineer")).toBeInTheDocument();

    expect(screen.getByText("SIGNAL_MATCH_98%")).toBeInTheDocument();
    expect(screen.getByText("SIGNAL_MATCH_94%")).toBeInTheDocument();
    expect(screen.getByText("SIGNAL_MATCH_89%")).toBeInTheDocument();
  });

  it("renders layer titles, readiness, and reputation metrics", () => {
    render(<FreelancingLayer />);

    expect(screen.getByText("Layer 02: Freelancing")).toBeInTheDocument();
    expect(
      screen.getByText("The bridge to market visibility."),
    ).toBeInTheDocument();
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(
      screen.getByText("Skills linked automatically to profiles."),
    ).toBeInTheDocument();
    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(
      screen.getByText("Flowing directly from learning outcomes."),
    ).toBeInTheDocument();
  });

  it("renders explore talent hub CTA", () => {
    render(<FreelancingLayer />);

    expect(screen.getByText("Explore the Talent Hub")).toBeInTheDocument();
  });

  it("applies light/dark mode contrast classes to avoid washed-out text", () => {
    const { container } = render(<FreelancingLayer />);
    const section = container.querySelector("section");
    expect(section).toHaveClass(
      "bg-white",
      "dark:bg-slate-900",
      "text-gray-900",
      "dark:text-white",
    );

    const profileName = screen.getByText("Data Analyst");
    expect(profileName).toHaveClass("text-gray-900", "dark:text-white");
  });
});
