import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import DeveloperPage from "./page";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, whileTap, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("Developer Portal & Layer 13 Platform", () => {
  it("renders Developer Portal header, badge, and tabs", () => {
    render(<DeveloperPage />);

    expect(screen.getByText("Developer Platform")).toBeInTheDocument();
    expect(screen.getByText("Layer 13 Enterprise")).toBeInTheDocument();
    expect(screen.getByText("API Keys & Scopes")).toBeInTheDocument();
    expect(
      screen.getByText("Standard Webhooks & Deliveries"),
    ).toBeInTheDocument();
    expect(screen.getByText("Visual DAG Workflows")).toBeInTheDocument();
  });

  it("displays masked API keys and active 7-day rotation grace window widget", () => {
    render(<DeveloperPage />);

    // Masked secrets
    expect(
      screen.getByText("sk_live_podacium_••••••••••••3x9Q"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("sk_live_podacium_••••••••••••9v8A"),
    ).toBeInTheDocument();

    // Active & Rotating status badges
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Rotation Grace Active")).toBeInTheDocument();

    // Grace countdown widget
    expect(screen.getByText(/Grace Window: 6d 21h left/i)).toBeInTheDocument();
  });

  it("opens Create Scoped Key modal and displays granular scope categories", () => {
    render(<DeveloperPage />);

    const createButton = screen.getByRole("button", {
      name: /create api key/i,
    });
    fireEvent.click(createButton);

    expect(screen.getByText("Create Scoped API Key")).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getAllByText("read:courses").length).toBeGreaterThan(1);
    expect(screen.getByText("write:enrollments")).toBeInTheDocument();
    expect(screen.getByText("Contracts")).toBeInTheDocument();
    expect(screen.getAllByText("read:contracts").length).toBeGreaterThan(1);
    expect(screen.getAllByText("write:milestones").length).toBeGreaterThan(1);
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getAllByText("read:invoices").length).toBeGreaterThan(1);
    expect(screen.getByText("create:payouts")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
    expect(screen.getByText("manage:webhooks")).toBeInTheDocument();
  });

  it("switches to Standard Webhooks tab and renders delivery table", () => {
    render(<DeveloperPage />);

    const webhooksTab = screen.getByText("Standard Webhooks & Deliveries");
    fireEvent.click(webhooksTab);

    expect(
      screen.getByText("Standard Webhooks Deliveries"),
    ).toBeInTheDocument();
    expect(screen.getByText("Svix Standard V1 Compliant")).toBeInTheDocument();
    expect(screen.getByText("contract.created")).toBeInTheDocument();
    expect(screen.getByText("200 OK")).toBeInTheDocument();
    expect(screen.getByText("504 Gateway Timeout")).toBeInTheDocument();
  });

  it("opens Delivery Inspector slide-over with Standard Webhooks headers and payload", () => {
    render(<DeveloperPage />);

    const webhooksTab = screen.getByText("Standard Webhooks & Deliveries");
    fireEvent.click(webhooksTab);

    // Click on contract.created delivery row
    const row = screen.getByText("contract.created");
    fireEvent.click(row);

    // Inspector opens
    expect(screen.getByText("Delivery Inspector")).toBeInTheDocument();
    expect(screen.getByText("Standard Webhooks Headers")).toBeInTheDocument();
    expect(screen.getAllByText("msg_2tQ9L1x49zP").length).toBe(2);
    expect(screen.getByText("Dispatched JSON Payload")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend payload/i }),
    ).toBeInTheDocument();
  });

  it("switches to Visual DAG Workflows tab and displays canvas with verification status", () => {
    render(<DeveloperPage />);

    const workflowsTab = screen.getByText("Visual DAG Workflows");
    fireEvent.click(workflowsTab);

    expect(
      screen.getByText("Automated Workflow DAG Orchestrator"),
    ).toBeInTheDocument();
    expect(screen.getByText(/DAG Verified: Acyclic/i)).toBeInTheDocument();
    expect(screen.getByText("Contract Signed")).toBeInTheDocument();
    expect(screen.getByText("Extism Payload Transformer")).toBeInTheDocument();
    expect(screen.getByText("Dispatch Standard Webhook")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export json/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import json/i }),
    ).toBeInTheDocument();
  });

  it("opens SDK Quickstart modal and switches between language snippets", () => {
    render(<DeveloperPage />);

    const quickstartButtons = screen.getAllByRole("button", {
      name: /quickstart/i,
    });
    expect(quickstartButtons.length).toBeGreaterThan(0);
    fireEvent.click(quickstartButtons[0]);

    expect(screen.getByText(/SDK Quickstart:/i)).toBeInTheDocument();
    expect(screen.getByText("cURL")).toBeInTheDocument();
    expect(screen.getByText("Python (httpx)")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();

    // Switch to Python
    fireEvent.click(screen.getByText("Python (httpx)"));
    expect(screen.getByText(/import httpx/i)).toBeInTheDocument();

    // Switch to TypeScript
    fireEvent.click(screen.getByText("TypeScript"));
    expect(screen.getByText(/fetchCourses/i)).toBeInTheDocument();
  });

  it("opens Webhook Simulator modal and simulates test event dispatch", async () => {
    render(<DeveloperPage />);

    const webhooksTab = screen.getByText("Standard Webhooks & Deliveries");
    fireEvent.click(webhooksTab);

    const testEventButton = screen.getByRole("button", {
      name: /dispatch test event/i,
    });
    fireEvent.click(testEventButton);

    expect(screen.getByText("Dispatch Test Webhook Event")).toBeInTheDocument();
    const dispatchButton = screen.getByRole("button", {
      name: /dispatch mock event/i,
    });
    fireEvent.click(dispatchButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Standard Webhook Dispatched \(200 OK\)/i),
      ).toBeInTheDocument();
    });
  });
});
