import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HitlActionCard, ActionIntent } from "./HitlActionCard";

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "copilot.hitl.action.replayError":
      "Action replay prevented: This action token has already been executed or has expired.",
    "copilot.hitl.action.confirmationRequired":
      "Confirmation Required: {toolName}",
    "copilot.hitl.action.intentHash": "Intent #{id}",
    "copilot.hitl.action.proposedChangesTitle": "Proposed State Changes",
    "copilot.hitl.action.actionApproved":
      "Action approved & executed with cryptographic nonce verification.",
    "copilot.hitl.action.actionRejected":
      "Action was rejected by user. No mutations were applied.",
    "copilot.hitl.action.rejectBtn": "Reject / Edit Parameters",
    "copilot.hitl.action.approveBtn": "Approve & Execute",
    "copilot.hitl.diff.before": "Before",
    "copilot.hitl.diff.after": "After",
    "copilot.hitl.diff.split": "Split",
    "copilot.hitl.diff.unified": "Unified",
  };
  const t = (key?: string, vars?: Record<string, string | number>) => {
    if (!key) return "";
    let text = dictionary[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return text;
  };
  t.t = t;
  return {
    useTranslations: () => t,
  };
});

describe("HitlActionCard Component", () => {
  const highRiskIntent: ActionIntent = {
    intentId: "intent-high-12345678",
    actionToken: "token-high-abc",
    toolName: "issue_refund",
    domain: "BILLING",
    riskScore: 0.95,
    summary:
      "Refund 15,000 DZD for Contract #104 Milestone #3 to EDAHABIA card",
    previousParameters: {
      contract_id: 104,
      amount: 0,
      status: "COMPLETED",
    },
    parameters: {
      contract_id: 104,
      amount: 15000,
      status: "REFUNDED",
    },
  };

  const mediumRiskIntent: ActionIntent = {
    intentId: "intent-med-87654321",
    actionToken: "token-med-xyz",
    toolName: "update_milestone_status",
    domain: "HUB",
    riskScore: 0.45,
    summary: "Mark milestone #2 as in review",
    previousParameters: {
      milestone_id: 2,
      status: "IN_PROGRESS",
    },
    parameters: {
      milestone_id: 2,
      status: "SUBMITTED",
    },
  };

  it("renders crimson High Risk badge for financial mutation actions", () => {
    render(<HitlActionCard intent={highRiskIntent} />);

    const badge = screen.getByTestId("hitl-risk-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("HIGH RISK");
    expect(badge.textContent).toContain("95%");
    expect(
      screen.getByText(/Confirmation Required: issue_refund/i),
    ).toBeInTheDocument();
  });

  it("renders amber Medium Risk badge for status updates", () => {
    render(<HitlActionCard intent={mediumRiskIntent} />);

    const badge = screen.getByTestId("hitl-risk-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("MEDIUM RISK");
    expect(badge.textContent).toContain("45%");
  });

  it("renders visual diff inspector with before and after parameters", () => {
    render(<HitlActionCard intent={highRiskIntent} />);

    const diffInspector = screen.getByTestId("hitl-diff-inspector");
    expect(diffInspector).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });

  it("triggers onApprove callback when clicking Approve & Execute", async () => {
    const handleApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <HitlActionCard intent={highRiskIntent} onApprove={handleApprove} />,
    );

    const approveBtn = screen.getByTestId("hitl-approve-btn");
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    expect(handleApprove).toHaveBeenCalledWith(highRiskIntent);
    expect(screen.getByTestId("hitl-success-banner")).toBeInTheDocument();
  });

  it("displays replay conflict banner on HTTP 409 duplicate nonce execution", async () => {
    const handleReplayApprove = vi
      .fn()
      .mockRejectedValue(new Error("409 Conflict: Already executed"));
    render(
      <HitlActionCard
        intent={highRiskIntent}
        onApprove={handleReplayApprove}
      />,
    );

    const approveBtn = screen.getByTestId("hitl-approve-btn");
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    expect(screen.getByTestId("hitl-conflict-banner")).toBeInTheDocument();
    expect(screen.getByText(/Action replay prevented/i)).toBeInTheDocument();
  });

  it("triggers onReject callback and renders rejected banner", async () => {
    const handleReject = vi.fn().mockResolvedValue(undefined);
    render(
      <HitlActionCard intent={mediumRiskIntent} onReject={handleReject} />,
    );

    const rejectBtn = screen.getByTestId("hitl-reject-btn");
    await act(async () => {
      fireEvent.click(rejectBtn);
    });

    expect(handleReject).toHaveBeenCalled();
    expect(screen.getByTestId("hitl-rejected-banner")).toBeInTheDocument();
  });
});
