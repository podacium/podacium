import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComposeModal } from "./ComposeModal";
import { mailApi } from "@/lib/api/mail";

vi.mock("@/lib/api/mail", () => ({
  mailApi: {
    sendEmail: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

describe("ComposeModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <ComposeModal isOpen={false} onClose={vi.fn()} accountId="acc-123" />,
    );
    expect(
      screen.queryByText("admin.mail.composer.newEmail"),
    ).not.toBeInTheDocument();
  });

  it("renders compose modal when isOpen is true", () => {
    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo="client@example.com"
        initialSubject="Project Proposal"
      />,
    );

    expect(
      screen.getByText(/(?:New Message|admin\.mail\.composer\.newEmail)/i),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("client@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Project Proposal")).toBeInTheDocument();
  });

  it("displays validation error when attempting to send without recipient", async () => {
    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo=""
        initialSubject="Subject"
      />,
    );

    const sendBtn = screen.getByRole("button", {
      name: /(?:Send|admin\.mail\.actions\.send)/i,
    });
    fireEvent.click(sendBtn);

    expect(
      await screen.findByText("A recipient is required"),
    ).toBeInTheDocument();
    expect(mailApi.sendEmail).not.toHaveBeenCalled();
  });

  it("displays localized validation error when attempting to send without subject", async () => {
    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo="client@example.com"
        initialSubject=""
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /(?:Send|admin\.mail\.actions\.send)/i,
      }),
    );

    expect(
      await screen.findByText("A subject is required"),
    ).toBeInTheDocument();
    expect(mailApi.sendEmail).not.toHaveBeenCalled();
  });

  it("escapes user HTML in the outbound MIME body", async () => {
    (mailApi.sendEmail as any).mockResolvedValueOnce({ id: 1 });

    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo="client@example.com"
        initialSubject="Escaping"
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        /(?:Write your message here\.\.\.|admin\.mail\.composer\.placeholder)/i,
      ),
      {
        target: {
          value: '<script>alert("xss")</script> **bold** _italic_ `code`',
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /(?:Send|admin\.mail\.actions\.send)/i,
      }),
    );

    await waitFor(() => {
      const payload = (mailApi.sendEmail as any).mock.calls[0][0];
      expect(payload.body_html).toContain("&lt;script&gt;");
      expect(payload.body_html).not.toContain("<script>");
      expect(payload.body_html).toContain("<strong>bold</strong>");
      expect(payload.body_html).toContain("<em>italic</em>");
      expect(payload.body_html).toContain("<code>code</code>");
    });
  });

  it("uploads attachments scoped to the sending account", async () => {
    (mailApi.uploadAttachment as any).mockResolvedValueOnce({
      attachment_id: "att-1",
      file_name: "report.pdf",
      mime_type: "application/pdf",
      file_size_bytes: 10,
      sha256: "abc",
      scan_status: "clean",
    });

    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo="client@example.com"
        initialSubject="Attachment"
      />,
    );

    const safeFile = new File(["%PDF-1.4"], "report.pdf", {
      type: "application/pdf",
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [safeFile] } });

    await waitFor(() => {
      expect(mailApi.uploadAttachment).toHaveBeenCalledTimes(1);
      const formData = (mailApi.uploadAttachment as any).mock.calls[0][0];
      expect(formData.get("account_id")).toBe("acc-123");
      expect((formData.get("file") as File).name).toBe("report.pdf");
    });
  });

  it("dispatches send request and triggers onSentSuccess and onClose", async () => {
    (mailApi.sendEmail as any).mockResolvedValueOnce({
      id: 1,
      message_id: "msg-999",
      internet_message_id: "<msg-999@podacium.com>",
    });

    const onCloseMock = vi.fn();
    const onSuccessMock = vi.fn();

    render(
      <ComposeModal
        isOpen={true}
        onClose={onCloseMock}
        accountId="acc-123"
        initialTo="colleague@podacium.com"
        initialSubject="Sync Meeting"
        onSentSuccess={onSuccessMock}
      />,
    );

    const bodyInput = screen.getByPlaceholderText(
      /(?:Write your message here\.\.\.|admin\.mail\.composer\.placeholder)/i,
    );
    fireEvent.change(bodyInput, {
      target: { value: "Let's review the platform updates." },
    });

    const sendBtn = screen.getByRole("button", {
      name: /(?:Send|admin\.mail\.actions\.send)/i,
    });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mailApi.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: "acc-123",
          to_addresses: ["colleague@podacium.com"],
          subject: "Sync Meeting",
          body_text: "Let's review the platform updates.",
        }),
      );
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it("activates Undo Send countdown and allows cancellation via Undo button", async () => {
    const onCloseMock = vi.fn();
    const onSuccessMock = vi.fn();

    render(
      <ComposeModal
        isOpen={true}
        onClose={onCloseMock}
        accountId="acc-123"
        initialTo="user@podacium.com"
        initialSubject="Test Buffer"
        undoBufferSeconds={5}
        onSentSuccess={onSuccessMock}
      />,
    );

    const bodyInput = screen.getByPlaceholderText(
      /(?:Write your message here\.\.\.|admin\.mail\.composer\.placeholder)/i,
    );
    fireEvent.change(bodyInput, { target: { value: "Hello world" } });

    const sendBtn = screen.getByRole("button", {
      name: /(?:Send|admin\.mail\.actions\.send)/i,
    });
    fireEvent.click(sendBtn);

    // Undo send banner must appear with countdown
    expect(await screen.findByTestId("undo-send-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Dispatching message in 5s\.\.\./i),
    ).toBeInTheDocument();

    // Click Undo button
    const undoBtn = screen.getByRole("button", { name: /Undo \(Esc\)/i });
    fireEvent.click(undoBtn);

    // Banner dismissed and sendEmail was NOT dispatched
    expect(screen.queryByTestId("undo-send-banner")).not.toBeInTheDocument();
    expect(mailApi.sendEmail).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it("blocks dangerous executable attachments from being uploaded", async () => {
    render(
      <ComposeModal
        isOpen={true}
        onClose={vi.fn()}
        accountId="acc-123"
        initialTo="user@podacium.com"
        initialSubject="Payload Test"
      />,
    );

    // Create a mock executable file (.exe)
    const dangerousFile = new File(["malicious binary"], "trojan.exe", {
      type: "application/x-msdownload",
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [dangerousFile] } });

    expect(
      await screen.findByText(/Blocked dangerous attachment: "trojan\.exe"/i),
    ).toBeInTheDocument();
    expect(mailApi.uploadAttachment).not.toHaveBeenCalled();
  });
});
