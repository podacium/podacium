import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VimeoEmbed } from "./VimeoEmbed";

const labels = {
  play: "Play the intro",
  unavailable: "This video can’t be played here right now.",
  watchOnVimeo: "Watch on Vimeo",
  retry: "Try again",
};

const VIDEO_ID = "1167634797";

function renderEmbed(
  props: Partial<React.ComponentProps<typeof VimeoEmbed>> = {},
) {
  return render(
    <VimeoEmbed
      videoId={VIDEO_ID}
      title="Podacium intro"
      poster="https://i.vimeocdn.com/video/poster.jpg"
      labels={labels}
      {...props}
    />,
  );
}

function dispatchVimeoMessage(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://player.vimeo.com",
        data: JSON.stringify(data),
      }),
    );
  });
}

function getIframe(container: HTMLElement) {
  return container.querySelector("iframe") as HTMLIFrameElement | null;
}

describe("VimeoEmbed", () => {
  it("shows a poster and a play control without mounting the iframe", () => {
    const { container } = renderEmbed();

    expect(
      screen.getByRole("button", { name: labels.play }),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.vimeocdn.com/video/poster.jpg",
    );
    expect(getIframe(container)).toBeNull();
  });

  it("mounts the Vimeo player with unescaped query parameters after a click", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));

    const iframe = getIframe(container);
    expect(iframe).not.toBeNull();
    const src = iframe!.getAttribute("src") ?? "";
    expect(src).toBe(
      `https://player.vimeo.com/video/${VIDEO_ID}?title=0&byline=0&portrait=0&badge=0&autopause=0&player_id=0&app_id=58479&dnt=1&autoplay=1`,
    );
    expect(src).not.toContain("&amp;");
    expect(iframe).toHaveAttribute("title", "Podacium intro");
    expect(container.firstElementChild).toHaveAttribute(
      "data-vimeo-state",
      "loading",
    );
  });

  it("leaves the loading state when Vimeo answers the ready handshake", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    dispatchVimeoMessage({ event: "ready" });

    expect(container.firstElementChild).toHaveAttribute(
      "data-vimeo-state",
      "ready",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(getIframe(container)).not.toBeNull();
  });

  it("falls back when Vimeo reports that the video cannot play", () => {
    renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    dispatchVimeoMessage({
      event: "error",
      data: { method: "ready", name: "PrivacyError", message: "restricted" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(labels.unavailable);
    const watchLink = screen.getByRole("link", { name: labels.watchOnVimeo });
    expect(watchLink).toHaveAttribute("href", `https://vimeo.com/${VIDEO_ID}`);
    expect(watchLink).toHaveAttribute("target", "_blank");
    expect(watchLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("button", { name: labels.retry }),
    ).toBeInTheDocument();
  });

  it("falls back when the player never becomes ready", async () => {
    renderEmbed({ readyTimeoutMs: 5 });

    fireEvent.click(screen.getByRole("button", { name: labels.play }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      labels.unavailable,
    );
  });

  it("returns to the poster when the fallback retry is used", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    dispatchVimeoMessage({
      event: "error",
      data: { method: "ready", message: "restricted" },
    });
    fireEvent.click(screen.getByRole("button", { name: labels.retry }));

    expect(container.firstElementChild).toHaveAttribute(
      "data-vimeo-state",
      "idle",
    );
    expect(getIframe(container)).toBeNull();
    expect(
      screen.getByRole("button", { name: labels.play }),
    ).toBeInTheDocument();
  });

  it("ignores messages from other origins", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://evil.example",
          data: JSON.stringify({ event: "ready" }),
        }),
      );
    });

    expect(container.firstElementChild).toHaveAttribute(
      "data-vimeo-state",
      "loading",
    );
  });

  it("does not fail on malformed postMessage payloads", () => {
    const { container } = renderEmbed();

    fireEvent.click(screen.getByRole("button", { name: labels.play }));
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://player.vimeo.com",
          data: "not-json",
        }),
      );
    });

    expect(container.firstElementChild).toHaveAttribute(
      "data-vimeo-state",
      "loading",
    );
  });
});
