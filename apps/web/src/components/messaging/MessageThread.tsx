/**
 * Message Thread - Enterprise Grade
 *
 * Displays messages in a conversation with rich input, reactions, actions, typing indicators,
 * presence, voice notes, formatted markdown, and image lightbox previews.
 */

"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { Conversation, Message, MessageAttachment } from "./types";
import { MessageInput } from "./MessageInput";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";
import { FormattedMessageText } from "./FormattedMessageText";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { FileAttachmentCard } from "./FileAttachmentCard";
import { FilePreviewModal } from "./FilePreviewModal";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { ConversationHeaderMenu } from "./ConversationHeaderMenu";
import {
  Loader2,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Edit2,
  Trash2,
  Smile,
  Check,
  CheckCheck,
  Reply,
  Copy,
  FileText,
  Download,
  ImageIcon,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { ChatFiscalShield } from "@/components/chat/ChatFiscalShield";
import { cn, resolveFileUrl } from "@/lib/utils";

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  currentUserId: number;
  typingUsers?: string[];
  onBack?: () => void;
  onSendMessage: (
    content: string,
    replyToId?: string,
    directAudioUrl?: string,
    attachments?: File[],
  ) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (
    messageId: string,
    scope?: "everyone" | "me",
  ) => Promise<void>;
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (messageId: string, emoji: string) => Promise<void>;
  onLoadMore: () => void;
  onMarkAsRead: (lastReadMessageId?: string) => Promise<void>;
  onUpdateSettings: (settings: {
    mutedUntil?: string;
    isArchived?: boolean;
    isPinned?: boolean;
  }) => Promise<void>;
  onTogglePin?: (isPinned: boolean) => Promise<void>;
  onToggleArchive?: (isArchived: boolean) => Promise<void>;
  onToggleMute?: (isMuted: boolean) => Promise<void>;
  onClearHistory?: () => Promise<void>;
  onDeleteConversation?: (scope?: "everyone" | "me") => Promise<void>;
  onLeave: () => Promise<void>;
  onTyping?: () => void;
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMessageDate(
  dateString: string,
  t: (key: string) => string,
): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return t("message.today");
  if (date.toDateString() === yesterday.toDateString())
    return t("message.yesterday");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shouldShowDateSeparator(
  current: Message,
  previous?: Message,
): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.createdAt).toDateString();
  const previousDate = new Date(previous.createdAt).toDateString();
  return currentDate !== previousDate;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export function MessageThread({
  conversation,
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  currentUserId,
  typingUsers = [],
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onAddReaction,
  onRemoveReaction,
  onLoadMore,
  onMarkAsRead,
  onUpdateSettings,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onClearHistory,
  onDeleteConversation,
  onLeave,
  onTyping,
}: MessageThreadProps) {
  const t = useTranslations("messaging");
  const { isRTL } = useBidi();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] =
    useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] =
    useState<MessageAttachment | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const handleCopyMessage = useCallback((message: Message) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "instant",
      });
    }
  }, []);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && isInitialLoad.current) {
      scrollToBottom(false);
      isInitialLoad.current = false;
    }
  }, [messages.length, scrollToBottom]);

  // Mark as read when conversation changes
  useEffect(() => {
    if (conversation && messages.length > 0) {
      onMarkAsRead();
    }
  }, [conversation?.conversationId, messages.length, onMarkAsRead]);

  // Handle scroll for pagination and scroll button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);

    if (scrollTop < 50 && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  const handleSend = useCallback(
    async (content: string, attachments?: File[], directAudioUrl?: string) => {
      await onSendMessage(
        content,
        replyingTo?.messageId,
        directAudioUrl,
        attachments,
      );
      setReplyingTo(null);
      setTimeout(() => scrollToBottom(true), 100);
    },
    [onSendMessage, replyingTo, scrollToBottom],
  );

  const handleEdit = useCallback(
    async (content: string) => {
      if (!editingMessage) return;
      await onEditMessage(editingMessage.messageId, content);
      setEditingMessage(null);
    },
    [editingMessage, onEditMessage],
  );

  const currentParticipant = conversation.participants?.find(
    (p) => p.userId === currentUserId,
  );
  const userRole: "CLIENT" | "FREELANCER" | "OTHER" =
    currentParticipant?.role === "FREELANCER"
      ? "FREELANCER"
      : currentParticipant?.role === "CLIENT"
        ? "CLIENT"
        : "CLIENT";

  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== currentUserId,
  );

  const displayName =
    conversation.displayTitle ||
    conversation.participants
      .filter((p) => p.userId !== currentUserId)
      .map((p) => p.user?.fullName)
      .filter(Boolean)
      .join(", ") ||
    t("conversations.title");

  const avatarUrl =
    conversation.avatarUrl || otherParticipant?.user?.profilePictureUrl;

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("messages.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 sm:p-4 border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 shadow-xs">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("conversation.back")}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft
              className={cn(
                "w-5 h-5 text-gray-600 dark:text-slate-400",
                isRTL ? "rotate-180" : "",
              )}
            />
          </button>
        )}
        {(() => {
          const otherUserId =
            otherParticipant?.userId ||
            otherParticipant?.user?.id ||
            otherParticipant?.user?.username;
          const profileHref = otherUserId ? `/profile/${otherUserId}` : "#";

          return (
            <Link
              href={profileHref}
              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-85 transition-opacity group cursor-pointer"
            >
              <div className="relative flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover shadow-xs ring-2 ring-white dark:ring-slate-800 group-hover:ring-blue-400 transition-all"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-xs ring-2 ring-white dark:ring-slate-800 group-hover:ring-blue-400 transition-all">
                    {getInitials(displayName || "U")}
                  </div>
                )}
                {/* Presence Indicator Dot */}
                <span className="absolute bottom-0 end-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <bdi dir="auto">{displayName}</bdi>
                  </h3>
                </div>
                {conversation.type === "FREELANCE" &&
                  conversation.metadata?.contractId && (
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t("freelance.contractConversation")}
                    </p>
                  )}
              </div>
            </Link>
          );
        })()}

        {/* Header Actions Menu (Three horizontal dots) */}
        <div className="flex items-center gap-1">
          <ConversationHeaderMenu
            conversation={conversation}
            onTogglePin={
              onTogglePin
                ? () => onTogglePin(!conversation.isPinned)
                : undefined
            }
            onToggleArchive={
              onToggleArchive
                ? () => onToggleArchive(!conversation.isArchived)
                : undefined
            }
            onToggleMute={
              onToggleMute
                ? () => onToggleMute(!conversation.isMuted)
                : undefined
            }
            onClearHistory={onClearHistory}
            onDeleteConversation={onDeleteConversation}
          />
        </div>
      </div>

      {/* Fiscal Shield Banner for Freelance / Contract Conversations */}
      {conversation.type === "FREELANCE" && (
        <div className="px-4 pt-2">
          <ChatFiscalShield
            userRole={userRole}
            contractAmountDzd={conversation.metadata?.contractAmount || 50000}
          />
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2.5"
      >
        {/* Load More */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium disabled:opacity-50 cursor-pointer"
            >
              {isLoadingMore ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("messages.loadingMore")}
                </span>
              ) : (
                t("messages.loadMore")
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-center">
            <div className="flex items-center gap-2 justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mb-3 shadow-xs">
              <MessageSquare className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-gray-800 dark:text-slate-200 font-semibold text-sm">
              {t("messages.empty")}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs">
              {t("messages.emptyDescription")}
            </p>
          </div>
        )}

        {/* Message Items */}
        {messages.map((message, index) => {
          const isOwn = message.senderId === currentUserId;
          const showDate = shouldShowDateSeparator(
            message,
            messages[index - 1],
          );
          const showAvatar =
            !isOwn &&
            (index === messages.length - 1 ||
              messages[index + 1]?.senderId !== message.senderId);

          const isVoiceNote =
            message.content === "[Voice Note]" ||
            message.attachments?.some(
              (a) =>
                a.fileType?.startsWith("audio/") ||
                a.fileUrl?.endsWith(".webm") ||
                a.fileUrl?.endsWith(".opus") ||
                a.fileUrl?.endsWith(".mp3"),
            );

          const audioAttachment = message.attachments?.find(
            (a) =>
              a.fileType?.startsWith("audio/") ||
              a.fileUrl?.endsWith(".webm") ||
              a.fileUrl?.endsWith(".opus") ||
              a.fileUrl?.endsWith(".mp3"),
          );

          const imageAttachments =
            message.attachments?.filter(
              (a) =>
                a.fileType?.startsWith("image/") ||
                /\.(jpg|jpeg|png|webp|gif)$/i.test(a.fileUrl),
            ) || [];

          const otherAttachments =
            message.attachments?.filter(
              (a) =>
                !a.fileType?.startsWith("audio/") &&
                !a.fileType?.startsWith("image/") &&
                !/\.(webm|opus|mp3|jpg|jpeg|png|webp|gif)$/i.test(a.fileUrl),
            ) || [];

          const isFlaggedWithWarning =
            message.moderationStatus === "FLAGGED_WITH_WARNING" ||
            message.metadata?.moderationStatus === "FLAGGED_WITH_WARNING" ||
            Boolean(message.metadata?.moderation_notice);

          return (
            <React.Fragment key={message.messageId}>
              {showDate && (
                <div className="flex items-center justify-center py-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full shadow-xs">
                    {formatMessageDate(message.createdAt, t)}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  "group/row relative flex flex-col mb-1 w-full",
                  isOwn ? "items-end" : "items-start",
                )}
                onMouseEnter={() => setHoveredMessageId(message.messageId)}
                onMouseLeave={() => {
                  setHoveredMessageId(null);
                  setActiveReactionPickerMessageId(null);
                }}
              >
                {isFlaggedWithWarning && (
                  <div className="w-full max-w-[85%] sm:max-w-[75%] my-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {t("shield.title")}
                      </p>
                      <p className="mt-0.5 opacity-90 leading-relaxed">
                        {t("shield.warningPrefix")}
                        <strong>{t("shield.escrowInsurance")}</strong>
                        {t("shield.forfeitsInvoice")}
                        <strong>{t("shield.anaeLaw")}</strong>
                        {t("shield.revokesIp")}
                        <strong>{t("shield.ondaLaw")}</strong>.
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          className="underline hover:text-amber-950 dark:hover:text-white font-medium cursor-pointer"
                        >
                          {t("shield.learnEscrow")}
                        </button>
                        <span className="opacity-40">•</span>
                        <button
                          type="button"
                          className="underline hover:text-amber-950 dark:hover:text-white font-medium cursor-pointer"
                        >
                          {t("shield.howAnaeWorks")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%]",
                    isOwn ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {/* Avatar for other users */}
                  {!isOwn && (
                    <div className="flex-shrink-0 w-7">
                      {showAvatar && message.sender ? (
                        <Link
                          href={`/profile/${message.senderId || message.sender.id || message.sender.username}`}
                          className="hover:opacity-80 transition-opacity cursor-pointer inline-block"
                          title={message.sender.fullName}
                        >
                          {message.sender.profilePictureUrl ? (
                            <img
                              src={message.sender.profilePictureUrl}
                              alt={message.sender.fullName}
                              className="w-7 h-7 rounded-full object-cover shadow-xs"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs">
                              {getInitials(message.sender.fullName)}
                            </div>
                          )}
                        </Link>
                      ) : (
                        <div className="w-7" />
                      )}
                    </div>
                  )}

                  {/* Bubble Container */}
                  <div className="relative group/bubble">
                    {/* Emoji Reaction Popover */}
                    {activeReactionPickerMessageId === message.messageId && (
                      <div
                        className={cn(
                          "absolute -top-10 flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100",
                          isOwn ? "end-0" : "start-0",
                        )}
                      >
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onAddReaction(message.messageId, emoji);
                              setActiveReactionPickerMessageId(null);
                            }}
                            className="p-1 hover:scale-125 transition-transform text-base cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Actual Bubble */}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 shadow-xs transition-all",
                        isOwn
                          ? "bg-blue-600 text-white rounded-ee-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-es-xs",
                        message.messageType === "SYSTEM"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 italic text-center !w-full border border-amber-200 dark:border-amber-800/60"
                          : "",
                      )}
                    >
                      {/* Audio Voice Note Player */}
                      {isVoiceNote && audioAttachment?.fileUrl ? (
                        <AudioWaveformPlayer
                          src={resolveFileUrl(audioAttachment.fileUrl)}
                          isOwn={isOwn}
                        />
                      ) : (
                        <FormattedMessageText
                          content={message.content}
                          isOwn={isOwn}
                        />
                      )}

                      {/* Image Attachment Grid */}
                      {imageAttachments.length > 0 && (
                        <div
                          className={cn(
                            "mt-2 grid gap-1.5",
                            imageAttachments.length === 1
                              ? "grid-cols-1"
                              : "grid-cols-2",
                          )}
                        >
                          {imageAttachments.map((img) => (
                            <div
                              key={img.id}
                              onClick={() => setPreviewAttachment(img)}
                              className="relative overflow-hidden rounded-2xl cursor-pointer group/img aspect-video bg-black/10 border border-black/5 dark:border-white/5"
                            >
                              <img
                                src={resolveFileUrl(img.fileUrl)}
                                alt={img.fileName}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Non-Image File Attachments */}
                      {otherAttachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {otherAttachments.map((att) => (
                            <FileAttachmentCard
                              key={att.id}
                              attachment={att}
                              isOwn={isOwn}
                              onPreview={setPreviewAttachment}
                            />
                          ))}
                        </div>
                      )}

                      {/* Message Metadata (Timestamp, Edited, Status) */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5 mt-1 text-[11px]",
                          isOwn
                            ? "justify-end text-blue-100"
                            : "justify-start text-slate-500 dark:text-slate-400",
                        )}
                      >
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {message.isEdited && (
                          <span>· {t("message.edited")}</span>
                        )}
                        {isOwn && message.status && (
                          <span className="inline-flex items-center">
                            {message.status === "READ" ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                            ) : message.status === "DELIVERED" ? (
                              <CheckCheck className="w-3.5 h-3.5 opacity-70" />
                            ) : message.status === "SENDING" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reactions Display Pill */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div
                        className={cn(
                          "flex flex-wrap gap-1 mt-1",
                          isOwn ? "justify-end" : "justify-start",
                        )}
                      >
                        {Array.from(
                          new Set(message.reactions.map((r) => r.emoji)),
                        ).map((emoji) => {
                          const count = message.reactions.filter(
                            (r) => r.emoji === emoji,
                          ).length;
                          const hasUserReacted = message.reactions.some(
                            (r) =>
                              r.emoji === emoji && r.userId === currentUserId,
                          );

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() =>
                                hasUserReacted
                                  ? onRemoveReaction(message.messageId, emoji)
                                  : onAddReaction(message.messageId, emoji)
                              }
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer shadow-xs",
                                hasUserReacted
                                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300"
                                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50",
                              )}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px]">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Side-Anchored Action Bar (Placed horizontally next to the message bubble) */}
                  {message.messageType !== "SYSTEM" && (
                    <div
                      className={cn(
                        "flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-gray-200/80 dark:border-slate-700/80 rounded-full shadow-sm px-1 py-0.5 self-center transition-all duration-150 flex-shrink-0",
                        hoveredMessageId === message.messageId ||
                          activeReactionPickerMessageId === message.messageId
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-95 pointer-events-none group-hover/row:opacity-100 group-hover/row:scale-100 group-hover/row:pointer-events-auto",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionPickerMessageId(
                            activeReactionPickerMessageId === message.messageId
                              ? null
                              : message.messageId,
                          )
                        }
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        title={t("input.emoji")}
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        title={t("message.reply")}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(message)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                        title={
                          copiedMessageId === message.messageId
                            ? t("message.copied")
                            : t("message.copy")
                        }
                      >
                        {copiedMessageId === message.messageId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => setEditingMessage(message)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                          title={t("message.edit")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingMessage(message)}
                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-full text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors"
                        title={t("message.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Live Typing Indicator Bubble */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="w-7 flex-shrink-0" />
            <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl rounded-es-xs px-3.5 py-2 flex items-center gap-2 shadow-xs">
              <span className="text-xs font-medium">
                {typingUsers.join(", ")} {t("conversation.typing")}
              </span>
              <div className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="absolute bottom-20 end-6 z-20">
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            aria-label={t("messages.scrollToBottom")}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-105 cursor-pointer"
          >
            <ArrowDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        onSend={handleSend}
        onEdit={editingMessage ? handleEdit : undefined}
        onTyping={onTyping}
        editingMessage={
          editingMessage ? { content: editingMessage.content } : undefined
        }
        replyingTo={
          replyingTo
            ? {
                senderName: replyingTo.sender?.fullName || "",
                content: replyingTo.content,
              }
            : undefined
        }
        onCancelEdit={() => setEditingMessage(null)}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Universal File Preview Modal (PDF, Image, Video, Audio, Code, Docs) */}
      <FilePreviewModal
        isOpen={Boolean(previewAttachment)}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Legacy Image Lightbox Modal */}
      {lightboxImageUrl && (
        <ImageLightboxModal
          isOpen={Boolean(lightboxImageUrl)}
          imageUrl={lightboxImageUrl}
          onClose={() => setLightboxImageUrl(null)}
        />
      )}

      {/* Delete Message Scope Modal */}
      {deletingMessage && (
        <DeleteMessageModal
          isOpen={Boolean(deletingMessage)}
          message={deletingMessage}
          currentUserId={currentUserId}
          onClose={() => setDeletingMessage(null)}
          onConfirmDelete={async (messageId, scope) => {
            await onDeleteMessage(messageId, scope);
            setDeletingMessage(null);
          }}
        />
      )}
    </div>
  );
}

export default MessageThread;
