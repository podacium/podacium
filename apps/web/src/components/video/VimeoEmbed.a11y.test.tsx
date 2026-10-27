import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { VimeoEmbed } from "./VimeoEmbed";

// PodaciumButton renders through framer-motion; keep axe focused on semantics.
vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}));

const labels = {
  play: "Play the intro",
  unavailable: "This video can’t be played here right now.",
  watchOnVimeo: "Watch on Vimeo",
  retry: "Try again",
};

describe("VimeoEmbed a11y", () => {
  it("has no violations before the video is started", async () => {
    const { container } = render(
      <VimeoEmbed
        videoId="1167634797"
        title="Podacium intro"
        labels={labels}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations in the fallback state", async () => {
    const { container } = render(
      <VimeoEmbed
        videoId="1167634797"
        title="Podacium intro"
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://player.vimeo.com",
          data: JSON.stringify({
            event: "error",
            data: { method: "ready", message: "restricted" },
          }),
        }),
      );
    });

    // The embedded Vimeo frame is cross-origin and cannot be inspected in
    // jsdom, so frame analysis is disabled for this state.
    expect(await axe(container, { iframes: false })).toHaveNoViolations();
  });
});
