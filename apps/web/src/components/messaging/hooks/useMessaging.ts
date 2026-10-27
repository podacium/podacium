/**
 * Messaging Hook - Enterprise Grade
 *
 * Comprehensive React hook for messaging functionality.
 * Features: caching, optimistic updates, real-time WebSocket sync, typing indicators, presence.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Conversation,
  ConversationListResponse,
  Message,
  MessageListResponse,
  CreateMessageRequest,
  CreateDirectConversationRequest,
  CreateConversationRequest,
  UpdateMessageRequest,
  MarkAsReadRequest,
  UpdateParticipantRequest,
  AddReactionRequest,
  MessagingEvent,
} from "../types";

// Cache configuration
const CACHE_TTL = 30000; // 30 seconds
const MESSAGE_POLL_INTERVAL = 15000; // 15 seconds

interface UseMessagingOptions {
  currentUserId: number;
  initialConversationId?: string;
  initialUserId?: number;
  enablePolling?: boolean;
}

interface UseMessagingReturn {
  // Conversations
  conversations: Conversation[];
  isLoadingConversations: boolean;
  conversationsError: string | null;
  hasMoreConversations: boolean;
  loadConversations: (page?: number) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;

  // Active conversation
  activeConversation: Conversation | null;
  setActiveConversation: (conversation: Conversation | null) => void;

  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;
  hasMoreMessages: boolean;
  nextCursor: string | undefined;
  loadMessages: (conversationId: string, cursor?: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;

  // Actions
  sendMessage: (
    content: string,
    replyToId?: string,
    directAudioUrl?: string,
    fileAttachments?: File[],
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (
    messageId: string,
    scope?: "everyone" | "me",
  ) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  markAsRead: (lastReadMessageId?: string) => Promise<void>;
  updateParticipantSettings: (
    settings: UpdateParticipantRequest,
  ) => Promise<void>;

  // Conversation management
  togglePinConversation: (
    conversationId: string,
    isPinned: boolean,
  ) => Promise<void>;
  toggleArchiveConversation: (
    conversationId: string,
    isArchived: boolean,
  ) => Promise<void>;
  toggleMuteConversation: (
    conversationId: string,
    isMuted: boolean,
  ) => Promise<void>;
  clearChatHistory: (conversationId: string) => Promise<void>;
  deleteConversation: (
    conversationId: string,
    scope?: "everyone" | "me",
  ) => Promise<void>;
  createDirectConversation: (otherUserId: number) => Promise<Conversation>;
  createConversation: (
    data: CreateConversationRequest,
  ) => Promise<Conversation>;
  leaveConversation: () => Promise<void>;

  // Real-time
  isConnected: boolean;
  typingUsers: string[];
  sendTypingIndicator: () => void;

  // Utilities
  clearErrors: () => void;
}

export function useMessaging(options: UseMessagingOptions): UseMessagingReturn {
  const {
    currentUserId,
    initialConversationId,
    initialUserId,
    enablePolling = true,
  } = options;

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [conversationsPage, setConversationsPage] = useState(1);

  // Active conversation state
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // Typing state
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Refs for polling and caching
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const conversationsCacheRef = useRef<{
    data: Conversation[];
    timestamp: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Real-time WebSocket connection
  const handleWsMessage = useCallback(
    (event: any) => {
      if (!event) return;

      const eventType = event.eventType || event.type;
      const msg = event.message || event.data;

      if (eventType === "NEW_MESSAGE" && msg) {
        if (
          activeConversation &&
          (String(msg.conversationId) === String(activeConversation.id) ||
            msg.conversationId === activeConversation.conversationId)
        ) {
          setMessages((prev) => {
            const clientMsgId =
              msg.clientMessageId || msg.metadata?.clientMessageId;
            const exists = prev.some(
              (m) =>
                m.messageId === msg.messageId ||
                (clientMsgId && m.messageId === clientMsgId),
            );
            if (exists) {
              return prev.map((m) =>
                (clientMsgId && m.messageId === clientMsgId) ||
                m.messageId === msg.messageId
                  ? msg
                  : m,
              );
            }
            return [...prev, msg];
          });
        }

        // Update conversation list last message
        setConversations((prev) =>
          prev.map((c) => {
            if (
              String(c.id) === String(msg.conversationId) ||
              c.conversationId === msg.conversationId
            ) {
              return {
                ...c,
                lastMessage: msg,
                lastMessageAt: msg.createdAt,
                unreadCount:
                  c.conversationId === activeConversation?.conversationId
                    ? 0
                    : c.unreadCount + 1,
              };
            }
            return c;
          }),
        );
      } else if (eventType === "MESSAGE_UPDATED" && msg) {
        setMessages((prev) =>
          prev.map((m) => (m.messageId === msg.messageId ? msg : m)),
        );
      } else if (eventType === "MESSAGE_DELETED") {
        const messageId = event.messageId || event.message_id;
        if (messageId) {
          setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
        }
      } else if (
        eventType === "REACTION" &&
        event.messageId &&
        event.reaction
      ) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId === event.messageId) {
              const reactions =
                event.action === "removed"
                  ? m.reactions.filter(
                      (r) =>
                        !(
                          r.userId === event.reaction.userId &&
                          r.emoji === event.reaction.emoji
                        ),
                    )
                  : [...m.reactions, event.reaction];
              return { ...m, reactions };
            }
            return m;
          }),
        );
      }
    },
    [activeConversation],
  );

  const activeConversationRef = useRef(activeConversation);
  activeConversationRef.current = activeConversation;

  const handleWsTyping = useCallback(
    (data: { userId: number; conversationId: number | string }) => {
      if (!activeConversationRef.current) return;
      if (data.userId === currentUserId) return;
      if (
        String(data.conversationId) ===
          String(activeConversationRef.current.id) ||
        String(data.conversationId) ===
          activeConversationRef.current.conversationId
      ) {
        const sender = activeConversationRef.current.participants.find(
          (p) => p.userId === data.userId,
        );
        const name = sender?.user?.fullName || "Someone";
        setTypingUsers((prev) => Array.from(new Set([...prev, name])));

        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== name));
        }, 3500);
      }
    },
    [currentUserId],
  );

  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  const loadConversations = useCallback(async (page: number = 1) => {
    if (page === 1 && conversationsCacheRef.current) {
      const age = Date.now() - conversationsCacheRef.current.timestamp;
      if (age < CACHE_TTL) {
        setConversations(conversationsCacheRef.current.data);
        return;
      }
    }

    setIsLoadingConversations(true);
    setConversationsError(null);

    try {
      const response = await api.get<ConversationListResponse>(
        `/api/messaging/conversations?page=${page}&page_size=20`,
      );

      if (page === 1) {
        setConversations(response.items);
        conversationsCacheRef.current = {
          data: response.items,
          timestamp: Date.now(),
        };
      } else {
        setConversations((prev) => [...prev, ...response.items]);
      }

      setHasMoreConversations(response.hasMore);
      setConversationsPage(page);
    } catch (error: any) {
      setConversationsError(error.message || "Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!hasMoreConversations || isLoadingConversations) return;
    await loadConversations(conversationsPage + 1);
  }, [
    hasMoreConversations,
    isLoadingConversations,
    conversationsPage,
    loadConversations,
  ]);

  const refreshConversations = useCallback(async () => {
    conversationsCacheRef.current = null;
    await loadConversations(1);
  }, [loadConversations]);

  // ============================================================================
  // MESSAGES
  // ============================================================================

  const loadMessages = useCallback(
    async (conversationId: string, cursor?: string) => {
      if (!conversationId) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoadingMessages(true);
      setMessagesError(null);

      try {
        const url = cursor
          ? `/api/messaging/conversations/${conversationId}/messages?cursor=${cursor}&limit=50`
          : `/api/messaging/conversations/${conversationId}/messages?limit=50`;

        const response = await api.get<MessageListResponse>(url, {
          signal: abortControllerRef.current.signal,
        });

        if (cursor) {
          setMessages((prev) => [...response.items, ...prev]);
        } else {
          setMessages(response.items);
        }

        setHasMoreMessages(response.hasMore);
        setNextCursor(response.nextCursor);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          setMessagesError(error.message || "Failed to load messages");
        }
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  const loadMoreMessages = useCallback(async () => {
    if (
      !activeConversation ||
      !hasMoreMessages ||
      isLoadingMessages ||
      !nextCursor
    )
      return;
    await loadMessages(activeConversation.conversationId, nextCursor);
  }, [
    activeConversation,
    hasMoreMessages,
    isLoadingMessages,
    nextCursor,
    loadMessages,
  ]);

  const refreshMessages = useCallback(async () => {
    if (!activeConversation) return;
    await loadMessages(activeConversation.conversationId);
  }, [activeConversation, loadMessages]);

  const handleWsConnect = useCallback(() => {
    if (activeConversationRef.current) {
      loadMessages(activeConversationRef.current.conversationId);
    }
    loadConversations();
  }, [loadMessages, loadConversations]);

  const { isConnected, sendTyping: wsSendTyping } = useWebSocket({
    onMessage: handleWsMessage,
    onTyping: handleWsTyping,
    onConnect: handleWsConnect,
    autoReconnect: true,
  });

  const sendTypingIndicator = useCallback(() => {
    if (!activeConversation) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return; // throttle 2s
    lastTypingSentRef.current = now;
    wsSendTyping(activeConversation.id);
  }, [activeConversation, wsSendTyping]);

  // ============================================================================
  // MESSAGE ACTIONS
  // ============================================================================

  const sendMessage = useCallback(
    async (
      content: string,
      replyToId?: string,
      directAudioUrl?: string,
      fileAttachments?: File[],
    ) => {
      if (!activeConversation) return;

      let attachmentsPayload = directAudioUrl
        ? [
            {
              fileName: `voice-note-${Date.now()}.webm`,
              fileType: "audio/webm",
              fileSize: Math.round(directAudioUrl.length * 0.75),
              fileUrl: directAudioUrl,
            },
          ]
        : undefined;

      if (fileAttachments && fileAttachments.length > 0) {
        const filePayloads = await Promise.all(
          fileAttachments.map(async (file) => {
            try {
              const uploadRes = await api.uploadWithProgress(
                file,
                "attachments",
              );
              if (uploadRes && uploadRes.url) {
                return {
                  fileName: file.name,
                  fileType: file.type || "application/octet-stream",
                  fileSize: file.size,
                  fileUrl: uploadRes.url,
                };
              }
            } catch (uploadErr) {
              console.warn(
                "Storage upload failed, falling back to data URL:",
                uploadErr,
              );
            }

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            return {
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              fileSize: file.size,
              fileUrl: base64,
            };
          }),
        );
        attachmentsPayload = attachmentsPayload
          ? [...attachmentsPayload, ...filePayloads]
          : filePayloads;
      }

      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: 0,
        messageId: tempId,
        conversationId: activeConversation.id,
        senderId: currentUserId,
        content,
        messageType: "TEXT",
        status: "SENDING",
        isEdited: false,
        createdAt: new Date().toISOString(),
        version: 0,
        attachments: attachmentsPayload
          ? attachmentsPayload.map((a, idx) => ({
              id: idx + 1,
              fileName: a.fileName,
              fileType: a.fileType,
              fileSize: a.fileSize,
              fileUrl: a.fileUrl,
              createdAt: new Date().toISOString(),
            }))
          : [],
        reactions: [],
        readReceipts: [],
        isOwnMessage: true,
        replyToId,
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const response = await api.post<Message>(
          `/api/messaging/conversations/${activeConversation.conversationId}/messages`,
          {
            content,
            messageType: "TEXT",
            replyToId,
            attachments: attachmentsPayload,
            clientMessageId: tempId,
          },
        );

        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempId ? response : m)),
        );

        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === activeConversation.conversationId
              ? {
                  ...c,
                  lastMessage: response,
                  lastMessageAt: response.createdAt,
                }
              : c,
          ),
        );
      } catch (error: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === tempId ? { ...m, status: "FAILED" as const } : m,
          ),
        );
        throw error;
      }
    },
    [activeConversation, currentUserId],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversation) return;

      try {
        const response = await api.patch<Message>(
          `/api/messaging/messages/${messageId}`,
          { content },
        );

        setMessages((prev) =>
          prev.map((m) => (m.messageId === messageId ? response : m)),
        );
      } catch (error: any) {
        setMessagesError(error.message || "Failed to edit message");
        throw error;
      }
    },
    [activeConversation],
  );

  const deleteMessage = useCallback(
    async (messageId: string, scope: "everyone" | "me" = "everyone") => {
      try {
        await api.delete(`/api/messaging/messages/${messageId}?scope=${scope}`);
        setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      } catch (error: any) {
        setMessagesError(error.message || "Failed to delete message");
        throw error;
      }
    },
    [],
  );

  const togglePinConversation = useCallback(
    async (conversationId: string, isPinned: boolean) => {
      try {
        await api.patch(
          `/api/messaging/conversations/${conversationId}/settings`,
          { isPinned },
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === conversationId ? { ...c, isPinned } : c,
          ),
        );
        if (activeConversation?.conversationId === conversationId) {
          setActiveConversation((prev) =>
            prev ? { ...prev, isPinned } : null,
          );
        }
      } catch (error: any) {
        setConversationsError(error.message || "Failed to update pin");
        throw error;
      }
    },
    [activeConversation],
  );

  const toggleArchiveConversation = useCallback(
    async (conversationId: string, isArchived: boolean) => {
      try {
        await api.patch(
          `/api/messaging/conversations/${conversationId}/settings`,
          { isArchived },
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === conversationId ? { ...c, isArchived } : c,
          ),
        );
        if (activeConversation?.conversationId === conversationId) {
          setActiveConversation((prev) =>
            prev ? { ...prev, isArchived } : null,
          );
        }
      } catch (error: any) {
        setConversationsError(error.message || "Failed to update archive");
        throw error;
      }
    },
    [activeConversation],
  );

  const toggleMuteConversation = useCallback(
    async (conversationId: string, isMuted: boolean) => {
      try {
        const mutedUntil = isMuted
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null;
        await api.patch(
          `/api/messaging/conversations/${conversationId}/settings`,
          { mutedUntil },
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === conversationId ? { ...c, isMuted } : c,
          ),
        );
        if (activeConversation?.conversationId === conversationId) {
          setActiveConversation((prev) => (prev ? { ...prev, isMuted } : null));
        }
      } catch (error: any) {
        setConversationsError(error.message || "Failed to update mute");
        throw error;
      }
    },
    [activeConversation],
  );

  const clearChatHistory = useCallback(async (conversationId: string) => {
    try {
      await api.post(`/api/messaging/conversations/${conversationId}/clear`);
      setMessages([]);
    } catch (error: any) {
      setMessagesError(error.message || "Failed to clear chat history");
      throw error;
    }
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string, scope: "everyone" | "me" = "me") => {
      try {
        await api.delete(
          `/api/messaging/conversations/${conversationId}?scope=${scope}`,
        );
        setConversations((prev) =>
          prev.filter((c) => c.conversationId !== conversationId),
        );
        if (activeConversation?.conversationId === conversationId) {
          setActiveConversation(null);
          setMessages([]);
        }
      } catch (error: any) {
        setConversationsError(error.message || "Failed to delete conversation");
        throw error;
      }
    },
    [activeConversation],
  );

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeConversation) return;

      try {
        await api.post(`/api/messaging/messages/${messageId}/reactions`, {
          emoji,
        });

        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId === messageId) {
              return {
                ...m,
                reactions: [
                  ...m.reactions,
                  {
                    id: Date.now(),
                    userId: currentUserId,
                    emoji,
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }
            return m;
          }),
        );
      } catch (error: any) {
        setMessagesError(error.message || "Failed to add reaction");
        throw error;
      }
    },
    [activeConversation, currentUserId],
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeConversation) return;

      try {
        await api.delete(
          `/api/messaging/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        );

        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId === messageId) {
              return {
                ...m,
                reactions: m.reactions.filter(
                  (r) => !(r.userId === currentUserId && r.emoji === emoji),
                ),
              };
            }
            return m;
          }),
        );
      } catch (error: any) {
        setMessagesError(error.message || "Failed to remove reaction");
        throw error;
      }
    },
    [activeConversation, currentUserId],
  );

  const lastMarkReadRef = useRef<{ id: string; time: number }>({
    id: "",
    time: 0,
  });

  const markAsRead = useCallback(
    async (lastReadMessageId?: string) => {
      if (!activeConversation) return;
      const now = Date.now();
      if (
        lastMarkReadRef.current.id === activeConversation.conversationId &&
        now - lastMarkReadRef.current.time < 3000
      ) {
        return;
      }
      lastMarkReadRef.current = {
        id: activeConversation.conversationId,
        time: now,
      };

      try {
        await api.post(
          `/api/messaging/conversations/${activeConversation.conversationId}/read`,
          { lastReadMessageId },
        );

        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === activeConversation.conversationId
              ? { ...c, unreadCount: 0 }
              : c,
          ),
        );
      } catch (error: any) {
        console.error("Failed to mark as read:", error);
      }
    },
    [activeConversation],
  );

  const updateParticipantSettings = useCallback(
    async (settings: UpdateParticipantRequest) => {
      if (!activeConversation) return;

      try {
        await api.patch(
          `/api/messaging/conversations/${activeConversation.conversationId}/settings`,
          settings,
        );

        const updated = await api.get<Conversation>(
          `/api/messaging/conversations/${activeConversation.conversationId}`,
        );
        setActiveConversation(updated);

        setConversations((prev) =>
          prev.map((c) =>
            c.conversationId === updated.conversationId ? updated : c,
          ),
        );
      } catch (error: any) {
        setMessagesError(error.message || "Failed to update settings");
        throw error;
      }
    },
    [activeConversation],
  );

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  const createDirectConversation = useCallback(
    async (otherUserId: number): Promise<Conversation> => {
      const response = await api.post<Conversation>(
        "/api/messaging/conversations/direct",
        {
          otherUserId,
        },
      );

      setConversations((prev) => {
        const exists = prev.some(
          (c) => c.conversationId === response.conversationId,
        );
        if (!exists) {
          return [response, ...prev];
        }
        return prev;
      });

      return response;
    },
    [],
  );

  const createConversation = useCallback(
    async (data: CreateConversationRequest): Promise<Conversation> => {
      const response = await api.post<Conversation>(
        "/api/messaging/conversations",
        data,
      );
      setConversations((prev) => [response, ...prev]);
      return response;
    },
    [],
  );

  const leaveConversation = useCallback(async () => {
    if (!activeConversation) return;

    await api.post(
      `/api/messaging/conversations/${activeConversation.conversationId}/leave`,
    );

    setConversations((prev) =>
      prev.filter(
        (c) => c.conversationId !== activeConversation.conversationId,
      ),
    );

    setActiveConversation(null);
    setMessages([]);
  }, [activeConversation]);

  // ============================================================================
  // POLLING (FALLBACK)
  // ============================================================================

  useEffect(() => {
    if (!enablePolling || !activeConversation) return;

    const poll = async () => {
      try {
        const response = await api.get<MessageListResponse>(
          `/api/messaging/conversations/${activeConversation.conversationId}/messages?limit=50`,
        );

        setMessages((prev) => {
          const incomingMap = new Map(
            response.items.map((m) => [m.messageId, m]),
          );
          let hasChanges = false;

          const updated = prev.map((m) => {
            const incoming = incomingMap.get(m.messageId);
            if (
              incoming &&
              (incoming.content !== m.content ||
                incoming.reactions.length !== m.reactions.length ||
                incoming.isEdited !== m.isEdited ||
                incoming.status !== m.status)
            ) {
              hasChanges = true;
              return incoming;
            }
            return m;
          });

          const existingIds = new Set(prev.map((m) => m.messageId));
          const newItems = response.items.filter(
            (m) => !existingIds.has(m.messageId),
          );

          if (newItems.length > 0) {
            hasChanges = true;
            return [...updated, ...newItems];
          }

          return hasChanges ? updated : prev;
        });
      } catch (error) {
        // Silent fail for polling
      }
    };

    pollingRef.current = setInterval(poll, MESSAGE_POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [enablePolling, activeConversation?.conversationId]);

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (initialConversationId) {
      api
        .get<Conversation>(
          `/api/messaging/conversations/${initialConversationId}`,
        )
        .then(setActiveConversation)
        .catch(console.error);
    }
  }, [initialConversationId]);

  useEffect(() => {
    if (!initialUserId || initialUserId === currentUserId) return;
    let isCancelled = false;

    const findOrCreate = async () => {
      try {
        const direct = await createDirectConversation(initialUserId);
        if (!isCancelled) {
          setActiveConversation(direct);
        }
      } catch (err) {
        console.error("Failed to initiate direct conversation:", err);
      }
    };

    findOrCreate();

    return () => {
      isCancelled = true;
    };
  }, [initialUserId, currentUserId, createDirectConversation]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.conversationId);
    }
  }, [activeConversation?.conversationId, loadMessages]);

  const clearErrors = useCallback(() => {
    setConversationsError(null);
    setMessagesError(null);
  }, []);

  return {
    conversations,
    isLoadingConversations,
    conversationsError,
    hasMoreConversations,
    loadConversations,
    loadMoreConversations,
    refreshConversations,
    activeConversation,
    setActiveConversation,
    messages,
    isLoadingMessages,
    messagesError,
    hasMoreMessages,
    nextCursor,
    loadMessages,
    loadMoreMessages,
    refreshMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    togglePinConversation,
    toggleArchiveConversation,
    toggleMuteConversation,
    clearChatHistory,
    deleteConversation,
    addReaction,
    removeReaction,
    markAsRead,
    updateParticipantSettings,
    createDirectConversation,
    createConversation,
    leaveConversation,
    isConnected,
    typingUsers,
    sendTypingIndicator,
    clearErrors,
  };
}
