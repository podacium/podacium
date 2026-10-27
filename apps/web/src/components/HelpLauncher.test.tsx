import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HelpLauncher from "./HelpLauncher";

let mockPathname = "/dashboard";
let mockAuthenticated = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "help.openHelp": "Open Help",
    "help.closeHelp": "Close Help",
    "help.aiChatTitle": "Podacium AI Assistant",
    "help.aiChatSubtitle": "Answers instantly · Grounded in platform policies",
    "help.aiChatGreeting": "Hello! I am your Podacium Assistant.",
    "help.assistantTitle": "Live Human Chat",
    "help.ticketTitle": "Open a Support Ticket",
    "help.signInToTicketTitle": "Sign in to submit a ticket",
    "help.ticketSubjectPlaceholder": "e.g. Payment issue with EDAHABIA",
    "help.submitTicket": "Submit Ticket",
    "help.aiPlaceholder": "Ask a question about courses, billing...",
    "help.aiChipPayment": "Pay with EDAHABIA",
    "help.aiEscalateButton": "Escalate to Human Ticket",
    "help.createTicketAction": "Open a Support Ticket →",
    "common.back": "Back",
  };
  return {
    useTranslations: () => {
      const t = (
        key: string,
        _vars?: Record<string, unknown>,
        fallback?: string,
      ) =>
        Object.prototype.hasOwnProperty.call(dictionary, key)
          ? dictionary[key]
          : fallback || key;
      t.raw = () => [];
      return t;
    },
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
    useLocale: () => "en",
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthenticated
      ? {
          id: 1,
          email: "user@test.com",
          fullName: "Amina Benali",
          role: "MEMBER",
        }
      : null,
    isAuthenticated: mockAuthenticated,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ tickets: [] }),
    post: vi.fn().mockImplementation((url: string, _data: unknown) => {
      if (url.includes("/support/chat") || url.includes("/agent/chat")) {
        return Promise.resolve({
          reply: "Oui, vous pouvez payer par carte EDAHABIA via Chargily.",
          category: "BILLING",
          suggested_ticket: false,
          engine: "offline_knowledge",
        });
      }
      return Promise.resolve({ ticket_number: "TK-1001", id: 1001 });
    }),
  },
}));

describe("HelpLauncher", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockAuthenticated = false;
    vi.clearAllMocks();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
  });

  it("renders help launcher FAB button on normal routes", () => {
    const { container } = render(<HelpLauncher />);
    const button = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    );
    expect(button).not.toBeNull();
  });

  it("returns null on live session routes", () => {
    mockPathname = "/live/sess-123/room";
    const { container } = render(<HelpLauncher />);
    expect(container.firstChild).toBeNull();
  });

  it("opens dropup panel on click and displays options", () => {
    const { container } = render(<HelpLauncher />);
    const fab = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    )!;
    fireEvent.click(fab);

    // Panel is opened
    expect(screen.getByRole("dialog")).toBeDefined();
    // Options are displayed
    expect(screen.getByText(/Podacium AI Assistant/i)).toBeDefined();
    expect(screen.getByText(/Open a Support Ticket/i)).toBeDefined();
  });

  it("navigates to native AI Assistant chat view and displays greeting", () => {
    const { container } = render(<HelpLauncher />);
    const fab = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    )!;
    fireEvent.click(fab);

    const aiOption = screen.getByText(/Podacium AI Assistant/i);
    fireEvent.click(aiOption);

    // Shows greeting and input
    expect(
      screen.getByText(/Hello! I am your Podacium Assistant/i),
    ).toBeDefined();
    expect(
      screen.getByPlaceholderText(/Ask a question about courses/i),
    ).toBeDefined();
    expect(screen.getByText(/Pay with EDAHABIA/i)).toBeDefined();
  });

  it("sends a message to AI assistant and receives reply", async () => {
    const { container } = render(<HelpLauncher />);
    const fab = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    )!;
    fireEvent.click(fab);

    const aiOption = screen.getByText(/Podacium AI Assistant/i);
    fireEvent.click(aiOption);

    const input = screen.getByPlaceholderText(/Ask a question about courses/i);
    fireEvent.change(input, {
      target: { value: "Puis-je payer par EDAHABIA ?" },
    });

    const form = input.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Oui, vous pouvez payer par carte EDAHABIA via Chargily/i,
        ),
      ).toBeDefined();
    });
  });

  it("escalates AI chat to human ticket", async () => {
    const { container } = render(<HelpLauncher />);
    const fab = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    )!;
    fireEvent.click(fab);

    const aiOption = screen.getByText(/Podacium AI Assistant/i);
    fireEvent.click(aiOption);

    const escalateBtn = screen.getByText(/Escalate to Human Ticket/i);
    fireEvent.click(escalateBtn);

    // Navigates to ticket view
    await waitFor(() => {
      expect(screen.getByText(/Sign in to submit a ticket/i)).toBeDefined();
    });
  });

  it("shows ticket creation form when authenticated", () => {
    mockAuthenticated = true;
    const { container } = render(<HelpLauncher />);
    const fab = container.querySelector(
      'button[aria-controls="help-launcher-panel"]',
    )!;
    fireEvent.click(fab);

    const ticketOption = screen.getByText(/Open a Support Ticket/i);
    fireEvent.click(ticketOption);

    // Form fields are present
    expect(screen.getByPlaceholderText(/e\.g\. Payment issue/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Submit Ticket/i }),
    ).toBeDefined();
  });

  it("streams response token-by-token from SSE endpoint", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"token": "Marhaban "}\n\n'));
        controller.enqueue(encoder.encode('data: {"token": "bikoum!"}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"done": true, "category": "GENERAL"}\n\n'),
        );
        controller.close();
      },
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    try {
      const { container } = render(<HelpLauncher />);
      const fab = container.querySelector(
        'button[aria-controls="help-launcher-panel"]',
      )!;
      fireEvent.click(fab);

      const aiOption = screen.getByText(/Podacium AI Assistant/i);
      fireEvent.click(aiOption);

      const input = screen.getByPlaceholderText(
        /Ask a question about courses/i,
      );
      fireEvent.change(input, { target: { value: "Salam" } });

      const form = input.closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/Marhaban bikoum!/i)).toBeDefined();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
