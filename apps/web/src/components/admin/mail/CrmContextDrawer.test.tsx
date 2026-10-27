import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CrmContextDrawer } from "./CrmContextDrawer";

vi.mock("@/lib/i18n", () => {
  const translator = (key: string, _vars?: any, fallback?: string) => {
    return fallback || key;
  };
  return {
    useTranslations: () => translator,
    useLocale: () => "en",
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("CrmContextDrawer Component", () => {
  it("renders empty state when no CRM entities are linked", () => {
    render(<CrmContextDrawer crmContext={null} />);
    expect(screen.getByText("admin.mail.crm.noContext")).toBeInTheDocument();
  });

  it("renders linked contract and ticket cards when present", () => {
    const mockCrm = {
      contract: {
        id: 42,
        title: "Frontend Engineering Scope",
        status: "ACTIVE",
      },
      ticket: {
        id: 7,
        subject: "Payment verification delay",
        status: "OPEN",
      },
    };

    render(<CrmContextDrawer crmContext={mockCrm} />);

    expect(screen.getByText("Frontend Engineering Scope")).toBeInTheDocument();
    expect(
      screen.getByText("admin.mail.crm.linkedContract"),
    ).toBeInTheDocument();
    expect(screen.getByText("Payment verification delay")).toBeInTheDocument();
    expect(screen.getByText("admin.mail.crm.linkedTicket")).toBeInTheDocument();
  });
});
