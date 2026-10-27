import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoExplainer from "./VideoExplainer";

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

vi.mock("@/lib/i18n", () => {
  const translations: Record<string, string> = {
    "video.title": "Understand how Podacium works in under 2 minutes",
    "video.description": "Learn how we turn data into opportunities.",
    "video.play": "Play the 2-minute intro",
    "video.unavailable": "This video can’t be played here right now.",
    "video.watchOnVimeo": "Watch on Vimeo",
    "video.retry": "Try again",
    "video.steps.capture.title": "Capture",
    "video.steps.capture.desc": "High-fidelity learning data.",
    "video.steps.validate.title": "Validate",
    "video.steps.validate.desc": "Skill-linked project assessment.",
    "video.steps.signal.title": "Signal",
    "video.steps.signal.desc": "Market-ready visibility.",
    "uiLabels.podaciumIntroTitle": "Podacium intro",
  };
  const t = (key: string) => translations[key] ?? key;
  return {
    useTranslations: () => t,
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("VideoExplainer", () => {
  it("renders the explainer video as a click-to-play facade", () => {
    render(<VideoExplainer />);

    expect(
      screen.getByRole("button", { name: "Play the 2-minute intro" }),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("mounts the Vimeo iframe with a valid embed URL once played", () => {
    render(<VideoExplainer />);

    fireEvent.click(
      screen.getByRole("button", { name: "Play the 2-minute intro" }),
    );

    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const src = iframe!.getAttribute("src") ?? "";
    expect(src).toContain("https://player.vimeo.com/video/1167634797?");
    expect(src).not.toContain("&amp;");
    expect(iframe).toHaveAttribute("title", "Podacium intro");
  });
});
