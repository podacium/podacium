/**
 * Conversation List - Enterprise Grade
 *
 * Displays list of conversations with search, filtering, and pagination.
 * Features: virtualization-ready, optimistic updates, BiDi/RTL support, Podacium design system.
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  Conversation,
  Participant,
  ConversationType,
  UserMinimal,
} from "./types";
import {
  Search,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Pin,
  Archive,
  VolumeX,
  X,
  User,
} from "lucide-react";
import { ConversationHeaderMenu } from "./ConversationHeaderMenu";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  currentUserId?: number;
  onCreateConversation?: (userId: number) => Promise<Conversation>;
  className?: string;
}

function formatTimeAgo(
  dateString: string,
  t: (key: string, params?: any) => string,
): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("time.justNow");
  if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
  if (diffHr < 24) return t("time.hoursAgo", { count: diffHr });
  if (diffDay < 7) return t("time.daysAgo", { count: diffDay });
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getConversationDisplayInfo(
  conversation: Conversation,
  currentUserId?: number,
): {
  title: string;
  avatarUrl?: string;
  subtitle?: string;
} {
  if (conversation.displayTitle) {
    return {
      title: conversation.displayTitle,
      avatarUrl: conversation.avatarUrl,
    };
  }

  const otherParticipants = conversation.participants.filter(
    (p) => p.userId !== currentUserId,
  );

  if (otherParticipants.length === 0) {
    return { title: "Unknown" };
  }

  if (otherParticipants.length === 1 && otherParticipants[0].user) {
    return {
      title: otherParticipants[0].user.fullName,
      avatarUrl: otherParticipants[0].user.profilePictureUrl,
    };
  }

  const names = otherParticipants
    .filter((p) => p.user)
    .map((p) => p.user!.fullName);

  return {
    title:
      names.slice(0, 2).join(", ") +
      (names.length > 2 ? ` +${names.length - 2}` : ""),
  };
}

export function ConversationList({
  conversations,
  isLoading,
  hasMore,
  onLoadMore,
  onRefresh,
  selectedConversationId,
  onSelectConversation,
  currentUserId,
  onCreateConversation,
  className = "",
}: ConversationListProps) {
  const t = useTranslations("messaging");
  const { isRTL } = useBidi();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversationModal, setShowNewConversationModal] =
    useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<UserMinimal[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "all" | "direct" | "contracts" | "archived"
  >("all");

  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!userSearchQuery.trim() || userSearchQuery.length < 2) {
        setSearchedUsers([]);
        return;
      }

      setSearchingUsers(true);
      try {
        const response = await api.get<{ users: UserMinimal[] }>(
          `/api/messaging/users/search?q=${encodeURIComponent(userSearchQuery)}&limit=10`,
        );
        setSearchedUsers(response.users || []);
      } catch (error) {
        console.error("Failed to search users:", error);
        setSearchedUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchQuery]);

  const handleCreateConversation = async (userId: number) => {
    if (!onCreateConversation) return;

    setCreating(true);
    setCreateError(null);

    try {
      const conversation = await onCreateConversation(userId);
      setShowNewConversationModal(false);
      setUserSearchQuery("");
      setSearchedUsers([]);
      onSelectConversation(conversation);
    } catch (error: any) {
      setCreateError(error?.message || t("errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  // Counts for each tab
  const tabCounts = useMemo(() => {
    return {
      all: conversations.filter((c) => !c.isArchived).length,
      direct: conversations.filter(
        (c) =>
          !c.isArchived && !c.metadata?.contractId && c.type !== "FREELANCE",
      ).length,
      contracts: conversations.filter(
        (c) =>
          !c.isArchived &&
          (Boolean(c.metadata?.contractId) || c.type === "FREELANCE"),
      ).length,
      archived: conversations.filter((c) => Boolean(c.isArchived)).length,
    };
  }, [conversations]);

  // Filter conversations by tab and search
  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (activeTab === "archived") {
      list = list.filter((c) => Boolean(c.isArchived));
    } else {
      list = list.filter((c) => !c.isArchived);
      if (activeTab === "direct") {
        list = list.filter(
          (c) => !c.metadata?.contractId && c.type !== "FREELANCE",
        );
      } else if (activeTab === "contracts") {
        list = list.filter(
          (c) => Boolean(c.metadata?.contractId) || c.type === "FREELANCE",
        );
      }
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter((conv) => {
      const info = getConversationDisplayInfo(conv, currentUserId);
      return (
        info.title.toLowerCase().includes(query) ||
        conv.participants.some((p) =>
          p.user?.fullName.toLowerCase().includes(query),
        )
      );
    });
  }, [conversations, activeTab, searchQuery, currentUserId]);

  // Sort: pinned first, then by updatedAt
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredConversations]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (
        scrollHeight - scrollTop - clientHeight < 100 &&
        hasMore &&
        !isLoading
      ) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-white dark:bg-slate-900 border-e border-gray-200 dark:border-slate-800",
        className,
      )}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {t("conversations.title")}
          </h2>
          {onCreateConversation && (
            <button
              type="button"
              onClick={() => setShowNewConversationModal(true)}
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
              title={t("conversations.startNew")}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("conversations.search")}
            className="w-full ps-9 pe-4 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
          {(
            [
              {
                id: "all",
                label: t("conversations.all"),
                count: tabCounts.all,
              },
              {
                id: "direct",
                label: t("conversations.direct"),
                count: tabCounts.direct,
              },
              {
                id: "contracts",
                label: t("conversations.contracts"),
                count: tabCounts.contracts,
              },
              {
                id: "archived",
                label: t("conversations.archived"),
                count: tabCounts.archived,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/50",
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    activeTab === tab.id
                      ? "bg-white/25 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {sortedConversations.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-700 dark:text-slate-300 font-semibold text-sm">
              {searchQuery
                ? t("conversations.noResults")
                : t("conversations.empty")}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs">
              {searchQuery ? "" : t("conversations.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800/80">
            {sortedConversations.map((conversation) => {
              const isSelected =
                conversation.conversationId === selectedConversationId;
              const info = getConversationDisplayInfo(
                conversation,
                currentUserId,
              );

              return (
                <ConversationItem
                  key={conversation.conversationId}
                  conversation={conversation}
                  isSelected={isSelected}
                  displayInfo={info}
                  currentUserId={currentUserId}
                  onClick={() => onSelectConversation(conversation)}
                  onRefresh={onRefresh}
                />
              );
            })}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="p-4 flex justify-center">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversationModal && (
        <PodaciumModal
          isOpen={showNewConversationModal}
          onClose={() => {
            setShowNewConversationModal(false);
            setUserSearchQuery("");
            setSearchedUsers([]);
          }}
          title={t("conversations.startNew")}
          size="md"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder={t("conversations.searchUsers")}
                className="w-full ps-9 pe-4 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            {createError && (
              <p className="text-rose-500 dark:text-rose-400 text-xs">
                {createError}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800">
              {searchingUsers ? (
                <div className="p-6 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>{t("conversations.searching")}</span>
                </div>
              ) : searchedUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-xs">
                  {userSearchQuery.length >= 2
                    ? t("conversations.noUsersFound")
                    : t("conversations.typeToSearch")}
                </div>
              ) : (
                searchedUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleCreateConversation(user.id)}
                    disabled={creating}
                    className="w-full flex items-center gap-3 p-3 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 text-start transition-all cursor-pointer group disabled:opacity-50"
                  >
                    {user.profile_picture_url ? (
                      <img
                        src={user.profile_picture_url}
                        alt={user.full_name}
                        className="w-10 h-10 rounded-full object-cover shadow-xs ring-1 ring-gray-200 dark:ring-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-xs ring-1 ring-white/20">
                        {getInitials(user.full_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <bdi dir="auto">{user.full_name}</bdi>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 capitalize mt-0.5">
                        {user.role}
                      </p>
                    </div>
                    {creating && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </PodaciumModal>
      )}
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  displayInfo: { title: string; avatarUrl?: string; subtitle?: string };
  currentUserId?: number;
  onClick: () => void;
  onRefresh?: () => void;
}

function ConversationItem({
  conversation,
  isSelected,
  displayInfo,
  currentUserId,
  onClick,
  onRefresh,
}: ConversationItemProps) {
  const t = useTranslations("messaging");
  const lastMessage = conversation.lastMessage;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative w-full flex items-center gap-3 p-3.5 text-start transition-all cursor-pointer border-s-4",
        isSelected
          ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-600 dark:border-blue-500 shadow-xs"
          : "hover:bg-gray-50/90 dark:hover:bg-slate-800/70 border-transparent",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {displayInfo.avatarUrl ? (
          <img
            src={displayInfo.avatarUrl}
            alt={displayInfo.title}
            className="w-11 h-11 rounded-full object-cover shadow-xs ring-1 ring-gray-200/80 dark:ring-slate-700"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-xs ring-1 ring-white/20">
            {getInitials(displayInfo.title)}
          </div>
        )}

        {/* Unread badge */}
        {conversation.unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
          </span>
        )}

        {/* Pinned indicator */}
        {conversation.isPinned && (
          <span className="absolute -bottom-1 -end-1 w-4 h-4 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-xs">
            <Pin className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "truncate text-sm",
              conversation.unreadCount > 0
                ? "text-gray-900 dark:text-white font-bold"
                : isSelected
                  ? "text-blue-950 dark:text-blue-200 font-semibold"
                  : "text-gray-900 dark:text-slate-100 font-semibold",
            )}
          >
            <bdi dir="auto">{displayInfo.title}</bdi>
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {lastMessage && (
              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                {formatTimeAgo(lastMessage.createdAt, t)}
              </span>
            )}
            <div
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
            >
              <ConversationHeaderMenu
                conversation={conversation}
                onTogglePin={async (isPinned) => {
                  await api.patch(
                    `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
                    { isPinned },
                  );
                  onRefresh?.();
                }}
                onToggleArchive={async (isArchived) => {
                  await api.patch(
                    `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
                    { isArchived },
                  );
                  onRefresh?.();
                }}
                onToggleMute={async (isMuted) => {
                  const mutedUntil = isMuted
                    ? new Date(
                        Date.now() + 365 * 24 * 60 * 60 * 1000,
                      ).toISOString()
                    : null;
                  await api.patch(
                    `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
                    { mutedUntil },
                  );
                  onRefresh?.();
                }}
                onClearHistory={async () => {
                  await api.post(
                    `/api/messaging/conversations/${conversation.conversationId || conversation.id}/clear`,
                  );
                  onRefresh?.();
                }}
                onDeleteConversation={async (scope) => {
                  await api.delete(
                    `/api/messaging/conversations/${conversation.conversationId || conversation.id}?scope=${scope}`,
                  );
                  onRefresh?.();
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          {conversation.isMuted && (
            <VolumeX className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          )}
          {conversation.isArchived && (
            <Archive className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          )}
          <p
            className={cn(
              "text-xs truncate",
              conversation.unreadCount > 0
                ? "text-gray-900 dark:text-slate-200 font-semibold"
                : "text-gray-500 dark:text-slate-400",
            )}
          >
            {lastMessage ? (
              lastMessage.isOwnMessage ? (
                <>
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("message.you")}:{" "}
                  </span>
                  <bdi dir="auto">{lastMessage.content}</bdi>
                </>
              ) : (
                <bdi dir="auto">{lastMessage.content}</bdi>
              )
            ) : (
              <span className="text-gray-400 dark:text-slate-500 italic">
                {t("messages.empty")}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConversationList;
