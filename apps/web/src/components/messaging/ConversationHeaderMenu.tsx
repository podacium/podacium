"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  BellOff,
  Bell,
  Eraser,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Conversation } from "./types";
import { api } from "@/lib/api";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";

export interface ConversationHeaderMenuProps {
  conversation: Conversation;
  onTogglePin?: (isPinned: boolean) => Promise<void>;
  onToggleArchive?: (isArchived: boolean) => Promise<void>;
  onToggleMute?: (isMuted: boolean) => Promise<void>;
  onClearHistory?: () => Promise<void>;
  onDeleteConversation?: (scope: "everyone" | "me") => Promise<void>;
}

export function ConversationHeaderMenu({
  conversation,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onClearHistory,
  onDeleteConversation,
}: ConversationHeaderMenuProps) {
  const t = useTranslations("messaging");
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await actionFn();
      setIsOpen(false);
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePin = async () => {
    if (onTogglePin) {
      await onTogglePin(!conversation.isPinned);
    } else {
      await api.patch(
        `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
        { isPinned: !conversation.isPinned },
      );
    }
  };

  const handleArchive = async () => {
    if (onToggleArchive) {
      await onToggleArchive(!conversation.isArchived);
    } else {
      await api.patch(
        `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
        { isArchived: !conversation.isArchived },
      );
    }
  };

  const handleMute = async () => {
    if (onToggleMute) {
      await onToggleMute(!conversation.isMuted);
    } else {
      const mutedUntil = !conversation.isMuted
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null;
      await api.patch(
        `/api/messaging/conversations/${conversation.conversationId || conversation.id}/settings`,
        { mutedUntil },
      );
    }
  };

  const handleClear = async () => {
    if (onClearHistory) {
      await onClearHistory();
    } else {
      await api.post(
        `/api/messaging/conversations/${conversation.conversationId || conversation.id}/clear`,
      );
    }
  };

  const handleDelete = async (scope: "everyone" | "me") => {
    if (onDeleteConversation) {
      await onDeleteConversation(scope);
    } else {
      await api.delete(
        `/api/messaging/conversations/${conversation.conversationId || conversation.id}?scope=${scope}`,
      );
    }
  };

  return (
    <div className="relative inline-block text-start" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        title={t("conversation.options")}
        aria-label={t("conversation.options")}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute end-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-sm">
          {/* Pin / Unpin */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleAction(handlePin)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-start cursor-pointer"
          >
            {conversation.isPinned ? (
              <>
                <PinOff className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.unpin")}</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.pin")}</span>
              </>
            )}
          </button>

          {/* Archive / Unarchive */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleAction(handleArchive)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-start cursor-pointer"
          >
            {conversation.isArchived ? (
              <>
                <ArchiveRestore className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.unarchive")}</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.archive")}</span>
              </>
            )}
          </button>

          {/* Mute / Unmute */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleAction(handleMute)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-start cursor-pointer"
          >
            {conversation.isMuted ? (
              <>
                <Bell className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.unmute")}</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 text-slate-400" />
                <span>{t("conversation.mute")}</span>
              </>
            )}
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

          {/* Clear History */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setIsOpen(false);
              setShowClearConfirm(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-start cursor-pointer"
          >
            <Eraser className="w-4 h-4" />
            <span>{t("conversation.clearHistory")}</span>
          </button>

          {/* Delete Conversation */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setIsOpen(false);
              setShowDeleteConfirm(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-start cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t("conversation.delete")}</span>
          </button>
        </div>
      )}

      {/* Clear History Modal */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-start animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <Eraser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t("conversation.clearHistory")}
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
              {t("conversation.clearHistoryConfirm")}
            </p>
            <div className="flex justify-end gap-2">
              <PodaciumButton
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                disabled={isProcessing}
              >
                {t("conversation.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="destructive"
                size="sm"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await handleClear();
                    setShowClearConfirm(false);
                  } catch (err) {
                    console.error("Clear history failed:", err);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
              >
                {t("conversation.clearHistory")}
              </PodaciumButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Modal */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-start animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t("conversation.delete")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("conversation.deleteConfirm")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 my-4">
              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await handleDelete("me");
                    setShowDeleteConfirm(false);
                  } catch (err) {
                    console.error("Delete conversation failed:", err);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-start transition-all cursor-pointer group disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t("conversation.deleteForMe")}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("message.deleteForMeDesc")}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await handleDelete("everyone");
                    setShowDeleteConfirm(false);
                  } catch (err) {
                    console.error("Delete conversation failed:", err);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="flex items-start gap-3 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 text-start transition-all cursor-pointer group disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    {t("conversation.deleteForEveryone")}
                  </div>
                  <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                    {t("message.deleteForEveryoneDesc")}
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <PodaciumButton
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessing}
              >
                {t("conversation.cancel")}
              </PodaciumButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
