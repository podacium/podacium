/**
 * Messaging Layout - Enterprise Grade
 *
 * Main messaging layout component with conversation list and message thread.
 * Features: responsive design, mobile support, optimistic updates.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";
import { useMessaging } from "./hooks/useMessaging";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { Conversation } from "./types";

interface MessagingLayoutProps {
  currentUserId: number;
  initialConversationId?: string;
  initialUserId?: number;
  className?: string;
}

export function MessagingLayout({
  currentUserId,
  initialConversationId,
  initialUserId,
  className = "",
}: MessagingLayoutProps) {
  const t = useTranslations("messaging");
  const [mobileShowThread, setMobileShowThread] = useState(
    Boolean(initialConversationId),
  );

  const {
    // Conversations
    conversations,
    isLoadingConversations,
    conversationsError,
    hasMoreConversations,
    loadMoreConversations,
    refreshConversations,

    // Active conversation
    activeConversation,
    setActiveConversation,

    // Messages
    messages,
    isLoadingMessages,
    messagesError,
    hasMoreMessages,
    nextCursor,
    loadMoreMessages,
    refreshMessages,

    // Actions
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markAsRead,
    updateParticipantSettings,

    // Conversation management
    togglePinConversation,
    toggleArchiveConversation,
    toggleMuteConversation,
    clearChatHistory,
    deleteConversation,
    createDirectConversation,
    leaveConversation,

    // Real-time
    typingUsers,
    sendTypingIndicator,

    // Utilities
    clearErrors,
  } = useMessaging({
    currentUserId,
    initialConversationId,
    initialUserId,
  });

  useEffect(() => {
    if (initialConversationId) {
      setMobileShowThread(true);
    }
  }, [initialConversationId]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const pathname = window.location.pathname;
      const match = pathname.match(/\/hub\/messages\/([^/]+)/);
      if (match && match[1]) {
        const targetId = match[1];
        const found = conversations.find(
          (c) => c.conversationId === targetId || String(c.id) === targetId,
        );
        if (found) {
          setActiveConversation(found);
          setMobileShowThread(true);
        }
      } else if (
        pathname === "/hub/messages" ||
        pathname === "/hub/messages/"
      ) {
        setMobileShowThread(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [conversations, setActiveConversation]);

  const handleSelectConversation = useCallback(
    (conversation: Conversation) => {
      setActiveConversation(conversation);
      setMobileShowThread(true);
      const convId = conversation.conversationId || conversation.id;
      if (typeof window !== "undefined" && window.history) {
        window.history.pushState(null, "", `/hub/messages/${convId}`);
      }
    },
    [setActiveConversation],
  );

  const handleBack = useCallback(() => {
    setMobileShowThread(false);
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState(null, "", "/hub/messages");
    }
  }, []);

  const handleSendMessage = useCallback(
    async (
      content: string,
      replyToId?: string,
      directAudioUrl?: string,
      attachments?: File[],
    ) => {
      await sendMessage(content, replyToId, directAudioUrl, attachments);
    },
    [sendMessage],
  );

  // Error display
  if (conversationsError && conversations.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-[calc(100vh-5rem)] ${className}`}
      >
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
            {t("conversations.error")}
          </h3>
          <p className="text-gray-500 dark:text-slate-400 mb-4">
            {conversationsError}
          </p>
          <button
            onClick={refreshConversations}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("conversations.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[calc(100vh-5rem)] bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}
    >
      {/* Conversation List Panel */}
      <div
        className={`
                w-full lg:w-[380px] lg:min-w-[320px] lg:max-w-[420px] 
                border-r border-gray-200 dark:border-slate-800 
                ${mobileShowThread ? "hidden lg:flex lg:flex-col" : "flex flex-col"}
            `}
      >
        <ConversationList
          conversations={conversations}
          isLoading={isLoadingConversations}
          hasMore={hasMoreConversations}
          onLoadMore={loadMoreConversations}
          onRefresh={refreshConversations}
          selectedConversationId={activeConversation?.conversationId}
          onSelectConversation={handleSelectConversation}
          currentUserId={currentUserId}
          onCreateConversation={createDirectConversation}
        />
      </div>

      {/* Message Thread Panel */}
      <div
        className={`
                flex-1 
                ${mobileShowThread ? "flex flex-col" : "hidden lg:flex lg:flex-col"}
            `}
      >
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            messages={messages}
            isLoading={isLoadingMessages}
            isLoadingMore={isLoadingMessages && messages.length > 0}
            hasMore={hasMoreMessages}
            error={messagesError}
            currentUserId={currentUserId}
            typingUsers={typingUsers}
            onTyping={sendTypingIndicator}
            onBack={handleBack}
            onSendMessage={handleSendMessage}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onAddReaction={addReaction}
            onRemoveReaction={removeReaction}
            onLoadMore={loadMoreMessages}
            onMarkAsRead={markAsRead}
            onUpdateSettings={updateParticipantSettings}
            onTogglePin={(isPinned) =>
              togglePinConversation(activeConversation.conversationId, isPinned)
            }
            onToggleArchive={(isArchived) =>
              toggleArchiveConversation(
                activeConversation.conversationId,
                isArchived,
              )
            }
            onToggleMute={(isMuted) =>
              toggleMuteConversation(activeConversation.conversationId, isMuted)
            }
            onClearHistory={() =>
              clearChatHistory(activeConversation.conversationId)
            }
            onDeleteConversation={(scope) =>
              deleteConversation(activeConversation.conversationId, scope)
            }
            onLeave={leaveConversation}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/30 dark:to-slate-900">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
              {t("page.title")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm">
              {t("page.description")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessagingLayout;
