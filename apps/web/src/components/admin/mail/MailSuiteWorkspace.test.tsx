import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MailSuiteWorkspace } from "./MailSuiteWorkspace";
import { mailApi } from "@/lib/api/mail";

let wsNotificationHandler: ((data: any) => void) | undefined;

// Mock ResizeObserver and scrollIntoView for cmdk in JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("@/lib/date-utils", () => ({
  useFormatDate: () => ({
    formatRelativeTime: (_d: string) => "just now",
    formatDateTime: (_d: string) => "2026-10-05 14:00",
  }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: (options: { onNotification?: (data: any) => void }) => {
    wsNotificationHandler = options?.onNotification;
    return {
      isConnected: true,
      sendMessage: vi.fn(),
      sendTyping: vi.fn(),
      markRead: vi.fn(),
    };
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/mail", () => ({
  mailApi: {
    listAccounts: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
    executeThreadAction: vi.fn(),
    emptyTrash: vi.fn(),
    syncAccount: vi.fn(),
    sendPresence: vi.fn(),
    getPresence: vi.fn(),
    getDeliverabilityDiagnostics: vi.fn(),
  },
}));

const mockAccounts = [
  {
    id: 1,
    account_id: "acc-101",
    email_address: "admin@podacium.com",
    display_name: "Podacium Admin",
    type: "PERSONAL",
    status: "ACTIVE",
    signature_html: null,
    mailboxes: [
      {
        id: 1,
        mailbox_id: "mb-inbox",
        name: "Inbox",
        remote_name: "INBOX",
        type: "INBOX",
        unread_count: 2,
        total_count: 5,
      },
      {
        id: 2,
        mailbox_id: "mb-sent",
        name: "Sent",
        remote_name: "Sent",
        type: "SENT",
        unread_count: 0,
        total_count: 3,
      },
    ],
  },
];

const mockThreads = [
  {
    id: 10,
    thread_id: "th-201",
    subject: "Algeria EdTech Platform Partnership",
    snippet: "We are interested in licensing Podacium courses...",
    last_message_at: "2026-10-05T12:00:00Z",
    message_count: 2,
    has_attachments: true,
    is_unread: true,
    is_starred: false,
    messages: [],
  },
  {
    id: 11,
    thread_id: "th-202",
    subject: "Escrow Payment Cleared - Contract 88",
    snippet: "The milestone payment of 50,000 DZD was released...",
    last_message_at: "2026-10-05T13:00:00Z",
    message_count: 1,
    has_attachments: false,
    is_unread: false,
    is_starred: true,
    messages: [],
  },
];

describe("MailSuiteWorkspace Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mailApi.listAccounts as any).mockResolvedValue(mockAccounts);
    (mailApi.listThreads as any).mockResolvedValue({
      threads: mockThreads,
      total_count: 2,
      page: 1,
      total_pages: 1,
    });
    (mailApi.getThread as any).mockResolvedValue({
      ...mockThreads[0],
      messages: [
        {
          id: 100,
          message_id: "msg-100",
          from_address: "client@algeria-tech.dz",
          from_name: "Karim Meziane",
          to_addresses: ["admin@podacium.com"],
          subject: "Algeria EdTech Platform Partnership",
          snippet: "We are interested in licensing Podacium courses...",
          body_text:
            "We are interested in licensing Podacium courses for university students.",
          body_html:
            "<p>We are interested in licensing Podacium courses for university students.</p>",
          created_at: "2026-10-05T12:00:00Z",
          attachments: [],
        },
      ],
    });
    (mailApi.sendPresence as any).mockResolvedValue(undefined);
    (mailApi.getPresence as any).mockResolvedValue({
      thread_id: "th-201",
      active_admins: [],
    });
    (mailApi.getDeliverabilityDiagnostics as any).mockResolvedValue({
      domain: "podacium.com",
      overall_status: "PASS",
      active_protocols_count: 4,
      active_protocols_label: "4 of 4 authentication protocols active",
      is_healthy: true,
      spf: {
        status: "PASS",
        record: "v=spf1 include:_spf.purelymail.com ~all",
        has_purelymail: true,
        has_stale_brevo: false,
        policy: "~all",
        warnings: [],
      },
      dkim: {
        status: "PASS",
        selectors: {
          default: {
            valid: true,
            key_length_bits: 2048,
            record: "v=DKIM1; k=rsa; p=MIIBIjANBgkq...",
            error: null,
          },
        },
        warnings: [],
      },
      dmarc: {
        status: "PASS",
        record: "v=DMARC1; p=reject; rua=mailto:dmarc@podacium.com",
        policy: "reject",
        rua: "mailto:dmarc@podacium.com",
        is_reject: true,
        warnings: [],
      },
      mx: {
        status: "PASS",
        records: [{ preference: 10, host: "mail.podacium.com" }],
        warnings: [],
      },
    });
  });

  it("renders workspace, loads accounts and displays threads", async () => {
    render(<MailSuiteWorkspace />);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalled();
    });

    const matches = await screen.findAllByText(
      "Algeria EdTech Platform Partnership",
      {},
      { timeout: 5000 },
    );
    expect(matches.length).toBeGreaterThan(0);
    const escrow = await screen.findByText(
      /Escrow Payment Cleared/i,
      {},
      { timeout: 5000 },
    );
    expect(escrow).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("handles folder selection and re-fetches threads", async () => {
    render(<MailSuiteWorkspace />);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalledWith(
        "acc-101",
        "INBOX",
        "",
        1,
        50,
      );
    });

    const sentFolderBtn = await screen.findByRole("button", {
      name: /(?:Sent|admin\.mail\.folders\.sent)/i,
    });
    fireEvent.click(sentFolderBtn);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalledWith(
        "acc-101",
        "SENT",
        "",
        1,
        50,
      );
    });
  });

  it("opens compose modal when compose button is clicked", async () => {
    render(<MailSuiteWorkspace />);

    const composeBtn = await screen.findByRole("button", {
      name: /(?:Compose|admin\.mail\.compose)/i,
    });
    fireEvent.click(composeBtn);

    expect(
      await screen.findByText(
        /(?:New Message|New Email|admin\.mail\.composer\.newEmail)/i,
      ),
    ).toBeInTheDocument();
  });

  it("refreshes threads when real-time WebSocket notification arrives", async () => {
    render(<MailSuiteWorkspace />);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalled();
    });

    const initialCalls = (mailApi.listThreads as any).mock.calls.length;

    // Simulate incoming WebSocket MAIL_SYNC push notification
    if (wsNotificationHandler) {
      act(() => {
        wsNotificationHandler!({
          type: "MAIL_SYNC",
          accountId: "acc-101",
          newMessages: 1,
        });
      });
    }

    await waitFor(() => {
      expect((mailApi.listThreads as any).mock.calls.length).toBeGreaterThan(
        initialCalls,
      );
    });
  });

  it("displays collision warning banner when another admin is drafting", async () => {
    (mailApi.getPresence as any).mockResolvedValue({
      thread_id: "th-201",
      active_admins: [
        {
          admin_id: 42,
          admin_name: "Zakarya",
          admin_email: "roubhizakarya@podacium.com",
          status: "drafting",
          updated_at: "2026-10-05T14:00:00Z",
        },
      ],
    });

    render(<MailSuiteWorkspace />);

    expect(
      await screen.findByText(/Zakarya is currently drafting a reply/i),
    ).toBeInTheDocument();
  });

  it("toggles folder navigation pane collapse on desktop", async () => {
    render(<MailSuiteWorkspace />);

    // Initially collapse button exists in Pane 2 toolbar
    const hideBtn = await screen.findByRole("button", {
      name: /(?:Collapse folders|Hide folders|admin\.mail\.collapseFolders)/i,
    });
    expect(hideBtn).toBeInTheDocument();

    // Click collapse
    fireEvent.click(hideBtn);

    // Now expand button is displayed in the search toolbar
    const showBtn = await screen.findByRole("button", {
      name: /(?:Expand folders|Show folders|admin\.mail\.expandFolders)/i,
    });
    expect(showBtn).toBeInTheDocument();

    // Click expand
    fireEvent.click(showBtn);

    // Collapse button is back
    const restoredBtn = await screen.findByRole("button", {
      name: /(?:Collapse folders|Hide folders|admin\.mail\.collapseFolders)/i,
    });
    expect(restoredBtn).toBeInTheDocument();
  });

  it("displays empty trash banner and handles empty trash in TRASH folder", async () => {
    (mailApi.emptyTrash as any).mockResolvedValue({
      status: "success",
      purged_messages: 5,
      purged_threads: 3,
    });

    render(<MailSuiteWorkspace />);

    // Click on Trash folder
    const trashBtn = await screen.findByRole("button", { name: /trash/i });
    fireEvent.click(trashBtn);

    // Empty trash button should appear in the banner
    const emptyTrashBtns = await screen.findAllByRole("button", {
      name: /(?:Empty Trash|admin\.mail\.actions\.emptyTrash)/i,
    });
    expect(emptyTrashBtns.length).toBeGreaterThan(0);

    // Click Empty Trash to open confirmation modal
    fireEvent.click(emptyTrashBtns[0]);

    // Click Confirm button in the modal
    const allEmptyBtns = await screen.findAllByRole("button", {
      name: /(?:Empty Trash|admin\.mail\.actions\.emptyTrash)/i,
    });
    // The modal confirm button is the last one
    fireEvent.click(allEmptyBtns[allEmptyBtns.length - 1]);

    await waitFor(() => {
      expect(mailApi.emptyTrash).toHaveBeenCalledWith("acc-101");
    });
  });

  it("opens Command Palette on keyboard shortcut and executes jump to folder", async () => {
    render(<MailSuiteWorkspace />);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalled();
    });

    // Press Cmd+K
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    // Verify command palette dialog opened
    expect(
      await screen.findByRole("dialog", { name: /mail command palette/i }),
    ).toBeInTheDocument();

    // Select Jump to Sent
    const sentItem = await screen.findByText(/jump to sent/i);
    fireEvent.click(sentItem);

    // Verify folder switch
    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalledWith(
        "acc-101",
        "SENT",
        "",
        1,
        50,
      );
    });
  });

  it("opens Deliverability DNS diagnostics modal and displays active protocols", async () => {
    render(<MailSuiteWorkspace />);

    // Deliverability button should be visible in Pane 1
    const delivBtn = await screen.findByRole("button", {
      name: /deliverability dns health/i,
    });
    expect(delivBtn).toBeInTheDocument();

    fireEvent.click(delivBtn);

    // Modal opens with checks
    expect(
      await screen.findByText("Email Deliverability & DNS Diagnostics"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Domain: podacium.com/i),
    ).toBeInTheDocument();
    expect(await screen.findByText("SPF Record")).toBeInTheDocument();
    expect(await screen.findByText("DKIM Signature")).toBeInTheDocument();
    expect(await screen.findByText("DMARC Policy")).toBeInTheDocument();
    expect(await screen.findByText("MX Routing")).toBeInTheDocument();
    expect(
      await screen.findByText("v=spf1 include:_spf.purelymail.com ~all"),
    ).toBeInTheDocument();
  });

  it("fails closed when deliverability diagnostics cannot be loaded", async () => {
    (mailApi.getDeliverabilityDiagnostics as any).mockRejectedValue(
      new Error("DNS unavailable"),
    );

    render(<MailSuiteWorkspace />);

    const delivBtn = await screen.findByRole("button", {
      name: /deliverability dns health/i,
    });
    expect(
      await screen.findByText(/Deliverability unknown/i),
    ).toBeInTheDocument();

    fireEvent.click(delivBtn);

    expect(
      await screen.findByText(
        /DNS diagnostics could not be loaded\. Results are unknown\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
  });

  it("updates other admins presence when receiving real-time mail_presence WebSocket event", async () => {
    render(<MailSuiteWorkspace />);

    await waitFor(() => {
      expect(mailApi.listThreads).toHaveBeenCalled();
    });

    // Simulate WebSocket mail_presence event for current thread
    if (wsNotificationHandler) {
      act(() => {
        wsNotificationHandler!({
          type: "mail_presence",
          thread_id: "th-201",
          admin_id: 99,
          admin_name: "Ahmed Bouzid",
          status: "drafting",
        });
      });
    }

    expect(
      await screen.findByText(/Ahmed Bouzid is currently drafting a reply/i),
    ).toBeInTheDocument();
  });
});
