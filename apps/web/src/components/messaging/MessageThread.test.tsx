import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { MessageThread } from "./MessageThread";
import { Conversation, Message } from "./types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

describe("MessageThread", () => {
  const mockConversation: Conversation = {
    id: 1,
    conversationId: "c-123",
    type: "FREELANCE",
    displayTitle: "Jane Doe",
    isGroup: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      {
        id: 1,
        userId: 1001,
        role: "CLIENT",
        joinedAt: new Date().toISOString(),
        isArchived: false,
        isPinned: false,
        user: {
          id: 1001,
          fullName: "Current User",
        },
      },
      {
        id: 2,
        userId: 1002,
        role: "FREELANCER",
        joinedAt: new Date().toISOString(),
        isArchived: false,
        isPinned: false,
        user: {
          id: 1002,
          fullName: "Jane Doe",
          username: "janedoe",
          profilePictureUrl: "https://example.com/avatar.jpg",
        },
      },
    ],
  };

  const mockMessages: Message[] = [
    {
      id: 1,
      messageId: "m-1",
      conversationId: 1,
      senderId: 1002,
      content: "Hello from Jane!",
      messageType: "TEXT",
      status: "DELIVERED",
      isEdited: false,
      createdAt: new Date().toISOString(),
      version: 1,
      attachments: [],
      reactions: [],
      readReceipts: [],
      isOwnMessage: false,
      sender: {
        id: 1002,
        fullName: "Jane Doe",
        username: "janedoe",
        profilePictureUrl: "https://example.com/avatar.jpg",
      },
    },
    {
      id: 2,
      messageId: "m-2",
      conversationId: 1,
      senderId: 1001,
      content: "[Voice Note]",
      messageType: "TEXT",
      status: "SENT",
      isEdited: false,
      createdAt: new Date().toISOString(),
      version: 1,
      attachments: [
        {
          id: 10,
          fileName: "voice-note-1.webm",
          fileType: "audio/webm",
          fileSize: 12000,
          fileUrl:
            "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAA...",
          createdAt: new Date().toISOString(),
        },
      ],
      reactions: [],
      readReceipts: [],
      isOwnMessage: true,
    },
  ];

  it("renders participant profile link in header", () => {
    render(
      <MessageThread
        conversation={mockConversation}
        messages={mockMessages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        currentUserId={1001}
        onSendMessage={vi.fn()}
        onEditMessage={vi.fn()}
        onDeleteMessage={vi.fn()}
        onAddReaction={vi.fn()}
        onRemoveReaction={vi.fn()}
        onLoadMore={vi.fn()}
        onMarkAsRead={vi.fn()}
        onUpdateSettings={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    const links = screen.getAllByRole("link");
    const headerProfileLink = links.find(
      (l) =>
        l.getAttribute("href") === "/profile/1002" ||
        l.getAttribute("href") === "/profile/janedoe",
    );
    expect(headerProfileLink).toBeDefined();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders profile link for message sender avatar", () => {
    render(
      <MessageThread
        conversation={mockConversation}
        messages={mockMessages}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        currentUserId={1001}
        onSendMessage={vi.fn()}
        onEditMessage={vi.fn()}
        onDeleteMessage={vi.fn()}
        onAddReaction={vi.fn()}
        onRemoveReaction={vi.fn()}
        onLoadMore={vi.fn()}
        onMarkAsRead={vi.fn()}
        onUpdateSettings={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    const messageSenderAvatarLink = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("title") === "Jane Doe");
    expect(messageSenderAvatarLink).toBeDefined();
    expect(messageSenderAvatarLink?.getAttribute("href")).toContain(
      "/profile/",
    );
  });

  it("renders file attachment card for non-audio/image documents", () => {
    const docMessage: Message = {
      id: 3,
      messageId: "m-3",
      conversationId: 1,
      senderId: 1002,
      content: "",
      messageType: "TEXT",
      status: "SENT",
      isEdited: false,
      createdAt: new Date().toISOString(),
      version: 1,
      attachments: [
        {
          id: 11,
          fileName: "contract_spec.pdf",
          fileType: "application/pdf",
          fileSize: 2048000,
          fileUrl: "https://storage.podacium.com/contract_spec.pdf",
          createdAt: new Date().toISOString(),
        },
      ],
      reactions: [],
      readReceipts: [],
      isOwnMessage: false,
      sender: {
        id: 1002,
        fullName: "Jane Doe",
      },
    };

    render(
      <MessageThread
        conversation={mockConversation}
        messages={[docMessage]}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        currentUserId={1001}
        onSendMessage={vi.fn()}
        onEditMessage={vi.fn()}
        onDeleteMessage={vi.fn()}
        onAddReaction={vi.fn()}
        onRemoveReaction={vi.fn()}
        onLoadMore={vi.fn()}
        onMarkAsRead={vi.fn()}
        onUpdateSettings={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByText("contract_spec.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2 MB|2.0 MB/)).toBeInTheDocument();
  });

  it("renders educational nudge banner for FLAGGED_WITH_WARNING messages", () => {
    const flaggedMessage: Message = {
      id: 99,
      messageId: "m-99",
      conversationId: 1,
      senderId: 1002,
      content: "Appelle moi au [NUMÉRO DE TÉLÉPHONE MASQUÉ]",
      messageType: "TEXT",
      status: "DELIVERED",
      isEdited: false,
      createdAt: new Date().toISOString(),
      version: 1,
      moderationStatus: "FLAGGED_WITH_WARNING",
      attachments: [],
      reactions: [],
      readReceipts: [],
      isOwnMessage: false,
      sender: {
        id: 1002,
        fullName: "Jane Doe",
      },
    };

    render(
      <MessageThread
        conversation={mockConversation}
        messages={[flaggedMessage]}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        error={null}
        currentUserId={1001}
        onSendMessage={vi.fn()}
        onEditMessage={vi.fn()}
        onDeleteMessage={vi.fn()}
        onAddReaction={vi.fn()}
        onRemoveReaction={vi.fn()}
        onLoadMore={vi.fn()}
        onMarkAsRead={vi.fn()}
        onUpdateSettings={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Keep Your Contract Protected by Podacium Shield"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Escrow Insurance/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /(?:Law 22-23 \(Self-Entrepreneur Status\)|Loi 22-23 \(Statut de l'Auto-Entrepreneur\)|shield\.anaeLaw)/i,
      ),
    ).toBeInTheDocument();
  });
});
