import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AiChatMessage, type ChatMessage } from "./AiChatMessage";

const mockLabels = {
  copy: "Copy answer",
  copied: "Copied",
  helpful: "Helpful",
  unhelpful: "Unhelpful",
  feedbackThanks: "Thanks!",
  stopped: "Response stopped",
  escalatePrompt: "Need specialized help? Speak to human agent.",
  escalateAction: "Escalate to Human Ticket",
  assistantName: "Podacium Assistant",
};

describe("AiChatMessage Component", () => {
  it("renders a user message correctly", () => {
    const msg: ChatMessage = {
      id: "usr_1",
      role: "user",
      content: "Hello from student",
      timestamp: new Date("2026-10-05T12:00:00Z"),
    };

    render(<AiChatMessage message={msg} labels={mockLabels} locale="en" />);

    expect(screen.getByText("Hello from student")).toBeDefined();
  });

  it("renders an assistant message with assistant name and avatar", () => {
    const msg: ChatMessage = {
      id: "ast_1",
      role: "assistant",
      content: "Here is the guidance for certificates.",
      timestamp: new Date("2026-10-05T12:01:00Z"),
    };

    render(<AiChatMessage message={msg} labels={mockLabels} locale="en" />);

    expect(screen.getByText("Podacium Assistant")).toBeDefined();
    expect(
      screen.getByText(/Here is the guidance for certificates/i),
    ).toBeDefined();
  });

  it("calls onFeedback when clicking helpful button", () => {
    const onFeedback = vi.fn();
    const msg: ChatMessage = {
      id: "ast_2",
      role: "assistant",
      content: "Helpful advice",
      timestamp: new Date(),
    };

    render(
      <AiChatMessage
        message={msg}
        labels={mockLabels}
        locale="en"
        onFeedback={onFeedback}
      />,
    );

    const helpfulBtn = screen.getByLabelText("Helpful");
    fireEvent.click(helpfulBtn);

    expect(onFeedback).toHaveBeenCalledWith("ast_2", "helpful");
  });

  it("renders escalation card when suggestedTicket is true", () => {
    const onEscalate = vi.fn();
    const msg: ChatMessage = {
      id: "ast_3",
      role: "assistant",
      content: "I recommend human intervention for billing.",
      timestamp: new Date(),
      suggestedTicket: true,
      category: "BILLING",
    };

    render(
      <AiChatMessage
        message={msg}
        labels={mockLabels}
        locale="en"
        onEscalate={onEscalate}
      />,
    );

    expect(screen.getByText(/Need specialized help\?/i)).toBeDefined();
    const escalateBtn = screen.getByText("Escalate to Human Ticket");
    fireEvent.click(escalateBtn);

    expect(onEscalate).toHaveBeenCalledWith("BILLING");
  });

  it("copies content to clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const msg: ChatMessage = {
      id: "ast_4",
      role: "assistant",
      content: "Text to copy",
      timestamp: new Date(),
    };

    render(<AiChatMessage message={msg} labels={mockLabels} locale="en" />);

    const copyBtn = screen.getByLabelText("Copy answer");
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith("Text to copy");
  });
});
