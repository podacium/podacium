import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CopilotContainer } from "./CopilotContainer";

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "copilot.container.title": "Podacium Copilot",
    "copilot.container.geminiVersion": "Gemini 2.5",
    "copilot.container.agentSafety": "Autonomous Agent & HITL Safety",
    "copilot.container.openAria": "Open Podacium Copilot",
    "copilot.container.expandAria": "Expand to full composer",
    "copilot.container.dockRightSideAria": "Dock to right side",
    "copilot.container.dockRightAria": "Dock to right",
    "copilot.container.floatingBubbleAria": "Switch to floating bubble",
    "copilot.container.closeAria": "Close copilot",
    "copilot.container.copied": "Copié",
    "copilot.container.copy": "Copier",
  };
  const t = (key?: string) => (key && dictionary[key]) || key || "";
  t.t = t;
  return {
    useTranslations: () => t,
  };
});

describe("CopilotContainer Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders floating bubble trigger when closed in floating_bubble mode", () => {
    render(<CopilotContainer initialMode="floating_bubble" />);

    const bubbleTrigger = screen.getByTestId("copilot-bubble-trigger");
    expect(bubbleTrigger).toBeInTheDocument();
  });

  it("opens copilot container when clicking floating bubble trigger", () => {
    render(<CopilotContainer initialMode="floating_bubble" />);

    const bubbleTrigger = screen.getByTestId("copilot-bubble-trigger");
    fireEvent.click(bubbleTrigger);

    const container = screen.getByTestId("copilot-container");
    expect(container).toBeInTheDocument();
    expect(screen.getByText("Podacium Copilot")).toBeInTheDocument();
    expect(screen.getByText("Gemini 2.5")).toBeInTheDocument();
  });

  it("renders directly in right_docked mode", () => {
    render(<CopilotContainer initialMode="right_docked" />);

    const container = screen.getByTestId("copilot-container");
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute("data-mode", "right_docked");
  });

  it("allows switching dockable modes between right_docked, full_composer, and floating_bubble", () => {
    render(<CopilotContainer initialMode="right_docked" />);

    // Expand to full composer
    const expandBtn = screen.getByTestId("mode-full-btn");
    fireEvent.click(expandBtn);
    expect(screen.getByTestId("copilot-container")).toHaveAttribute(
      "data-mode",
      "full_composer",
    );

    // Switch back to docked mode
    const dockBtn = screen.getByTestId("mode-docked-btn");
    fireEvent.click(dockBtn);
    expect(screen.getByTestId("copilot-container")).toHaveAttribute(
      "data-mode",
      "right_docked",
    );

    // Switch to floating bubble
    const bubbleBtn = screen.getByTestId("mode-bubble-btn");
    fireEvent.click(bubbleBtn);
    expect(screen.getByTestId("copilot-container")).toHaveAttribute(
      "data-mode",
      "floating_bubble",
    );
  });

  it("opens @ mention dropdown when typing @ in the composer", () => {
    render(<CopilotContainer initialMode="right_docked" />);

    const textarea = screen.getByTestId("composer-textarea");
    fireEvent.change(textarea, { target: { value: "Review @" } });

    const dropdown = screen.getByTestId("mention-dropdown");
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText("@course:42")).toBeInTheDocument();
    expect(screen.getByText("@contract:104")).toBeInTheDocument();
  });

  it("attaches entity tag when clicking a mention option", () => {
    render(<CopilotContainer initialMode="right_docked" />);

    const textarea = screen.getByTestId("composer-textarea");
    fireEvent.change(textarea, { target: { value: "Can you analyze @" } });

    const courseOption = screen.getByTestId("mention-option-course");
    fireEvent.click(courseOption);

    // Attached entity bar should show @course:42
    const attachedBar = screen.getByTestId("attached-entities-bar");
    expect(attachedBar).toBeInTheDocument();
    expect(attachedBar.textContent).toContain("@course:42");
  });

  it("renders user message and calls fetch when sending a message", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let called = false;
          return {
            read: async () => {
              if (!called) {
                called = true;
                const encoder = new TextEncoder();
                const chunk =
                  'data: {"token": "Bonjour, "}\n\ndata: {"token": "voici les cours."}\n\ndata: {"done": true, "category": "LEARNING", "engine": "gemini"}\n\n';
                return { value: encoder.encode(chunk), done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      },
    });
    global.fetch = fakeFetch;

    render(<CopilotContainer initialMode="right_docked" />);

    const textarea = screen.getByTestId("composer-textarea");
    fireEvent.change(textarea, {
      target: { value: "Quels sont les cours de Python ?" },
    });

    const sendBtn = screen.getByTestId("composer-send-btn");
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(
      screen.getByText("Quels sont les cours de Python ?"),
    ).toBeInTheDocument();
    expect(fakeFetch).toHaveBeenCalled();
  });
});
