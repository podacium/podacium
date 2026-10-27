"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { MessageThread } from "@/components/messaging/MessageThread";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { api } from "@/lib/api";
import {
  Conversation,
  Message,
  MessageListResponse,
} from "@/components/messaging/types";
import { Loader2, AlertCircle, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function ContractMessagesPage() {
  const routeParams = useParams();
  const contractId = routeParams?.id as string;
  const t = useTranslations("messaging");
  const { isRTL } = useBidi();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const fetchMessages = useCallback(
    async (conversationId: string | number, cursor?: string) => {
      try {
        setLoadingMessages(true);
        const queryParams = new URLSearchParams();
        queryParams.append("limit", "50");
        if (cursor) queryParams.append("cursor", cursor);

        const response = await api.get<MessageListResponse>(
          `/api/messaging/conversations/${conversationId}/messages?${queryParams.toString()}`,
        );

        if (cursor) {
          setMessages((prev) => [...response.items, ...prev]);
        } else {
          setMessages(response.items || []);
        }
        setHasMore(Boolean(response.hasMore));
        setNextCursor(response.nextCursor);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  const fetchConversation = useCallback(async () => {
    if (!isAuthenticated || !user || !contractId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get<Conversation>(
        `/api/messaging/contracts/${contractId}/conversation`,
      );
      setConversation(response);

      // Fetch messages for this conversation
      await fetchMessages(response.conversationId || response.id);
    } catch (err: any) {
      if (err?.status === 403) {
        setError(t("errors.notParticipant"));
      } else if (err?.status === 404) {
        setError(t("errors.conversationNotFound"));
      } else {
        setError(t("messages.error"));
      }
    } finally {
      setLoading(false);
    }
  }, [contractId, isAuthenticated, user, t, fetchMessages]);

  const handleLoadMore = useCallback(() => {
    if (conversation && nextCursor && !loadingMessages) {
      fetchMessages(conversation.conversationId || conversation.id, nextCursor);
    }
  }, [conversation, nextCursor, loadingMessages, fetchMessages]);

  const handleSendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!conversation || !user) return;
      const targetId = conversation.conversationId || conversation.id;

      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: 0,
        messageId: tempId,
        conversationId: conversation.id,
        senderId: user.id,
        content,
        messageType: "TEXT",
        status: "SENDING",
        isEdited: false,
        createdAt: new Date().toISOString(),
        version: 0,
        attachments: [],
        reactions: [],
        readReceipts: [],
        isOwnMessage: true,
        replyToId,
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const payload: {
          content: string;
          messageType: string;
          replyToId?: string;
        } = {
          content,
          messageType: "TEXT",
        };
        if (replyToId) {
          payload.replyToId = replyToId;
        }

        const newMessage = await api.post<Message>(
          `/api/messaging/conversations/${targetId}/messages`,
          payload,
        );

        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempId ? newMessage : m)),
        );

        setConversation((prev) =>
          prev
            ? {
                ...prev,
                lastMessage: newMessage,
                lastMessageAt: newMessage.createdAt,
              }
            : null,
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === tempId ? { ...m, status: "FAILED" as const } : m,
          ),
        );
        console.error("Failed to send message:", err);
        throw err;
      }
    },
    [conversation, user],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        const updated = await api.patch<Message>(
          `/api/messaging/messages/${messageId}`,
          { content },
        );
        setMessages((prev) =>
          prev.map((m) => (m.messageId === messageId ? updated : m)),
        );
      } catch (err) {
        console.error("Failed to edit message:", err);
        throw err;
      }
    },
    [],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string, scope: "everyone" | "me" = "everyone") => {
      try {
        await api.delete(`/api/messaging/messages/${messageId}?scope=${scope}`);
        setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      } catch (err) {
        console.error("Failed to delete message:", err);
        throw err;
      }
    },
    [],
  );

  const handleAddReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;
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
                    userId: user.id,
                    emoji,
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }
            return m;
          }),
        );
      } catch (err) {
        console.error("Failed to add reaction:", err);
      }
    },
    [user],
  );

  const handleRemoveReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;
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
                  (r) => !(r.userId === user.id && r.emoji === emoji),
                ),
              };
            }
            return m;
          }),
        );
      } catch (err) {
        console.error("Failed to remove reaction:", err);
      }
    },
    [user],
  );

  const handleMarkAsRead = useCallback(async () => {
    if (!conversation) return;
    const targetId = conversation.conversationId || conversation.id;

    try {
      await api.post(`/api/messaging/conversations/${targetId}/read`);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              unreadCount: 0,
            }
          : null,
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }, [conversation]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && user && contractId) {
      fetchConversation();
    }
  }, [isAuthenticated, user, contractId, fetchConversation]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Navbar />
        <div
          className="pt-20 flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 5rem)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {t("messages.loading")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Navbar />
        <div className="pt-20" />
        <AuthRequiredModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            router.push("/");
          }}
          onLogin={() => router.push("/auth/login")}
          onSignup={() => router.push("/auth/signup")}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60">
        <Navbar />
        <main className="pt-24 sm:pt-28 pb-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">
                {error}
              </h2>
              <div className="flex gap-3 mt-4">
                <PodaciumButton
                  onClick={() => fetchConversation()}
                  variant="primary"
                  size="sm"
                >
                  {t("conversations.retry")}
                </PodaciumButton>
                <Link href={`/hub/contracts/${contractId}`}>
                  <PodaciumButton variant="secondary" size="sm">
                    {t("conversation.back")}
                  </PodaciumButton>
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60">
      <Navbar />
      <main className="pt-24 sm:pt-28 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Link
              href={`/hub/contracts/${contractId}`}
              className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              <FileText className="w-4 h-4" />
              <span>{t("freelance.viewContract")}</span>
            </Link>
            <span className="text-gray-300 dark:text-slate-700">/</span>
            <span className="text-gray-700 dark:text-slate-300 font-medium">
              {t("page.title")}
            </span>
          </div>

          {/* Message Thread */}
          {conversation && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden"
              style={{ height: "calc(100vh - 12rem)" }}
            >
              <MessageThread
                conversation={conversation}
                messages={messages}
                currentUserId={user.id}
                onBack={() => router.push(`/hub/contracts/${contractId}`)}
                onSendMessage={handleSendMessage}
                onMarkAsRead={handleMarkAsRead}
                onLoadMore={handleLoadMore}
                isLoading={loading}
                isLoadingMore={loadingMessages}
                hasMore={hasMore}
                error={error}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onAddReaction={handleAddReaction}
                onRemoveReaction={handleRemoveReaction}
                onUpdateSettings={async () => {}}
                onLeave={async () => {}}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
