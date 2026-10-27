"use client";

import React from "react";
import { Trash2, User, Users, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Message } from "./types";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";

export interface DeleteMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  currentUserId: number;
  onClose: () => void;
  onConfirmDelete: (
    messageId: string,
    scope: "everyone" | "me",
  ) => Promise<void>;
}

export function DeleteMessageModal({
  isOpen,
  message,
  currentUserId,
  onClose,
  onConfirmDelete,
}: DeleteMessageModalProps) {
  const t = useTranslations("messaging");
  const [loadingScope, setLoadingScope] = React.useState<
    "everyone" | "me" | null
  >(null);

  if (!isOpen || !message) return null;

  const isAuthor = message.senderId === currentUserId;

  const handleDelete = async (scope: "everyone" | "me") => {
    setLoadingScope(scope);
    try {
      await onConfirmDelete(message.messageId, scope);
      onClose();
    } catch (err) {
      console.error("Failed to delete message:", err);
    } finally {
      setLoadingScope(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-start animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {t("message.delete")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("message.deleteConfirm")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl mb-5 text-xs text-slate-600 dark:text-slate-300 italic truncate max-w-full">
          &ldquo;{message.content}&rdquo;
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Delete for everyone (only for author) */}
          {isAuthor && (
            <button
              type="button"
              disabled={loadingScope !== null}
              onClick={() => handleDelete("everyone")}
              className="flex items-start gap-3 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 text-start transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {t("message.deleteForEveryone")}
                </div>
                <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  {t("message.deleteForEveryoneDesc")}
                </div>
              </div>
            </button>
          )}

          {/* Delete for me */}
          <button
            type="button"
            disabled={loadingScope !== null}
            onClick={() => handleDelete("me")}
            className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-start transition-all cursor-pointer group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("message.deleteForMe")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("message.deleteForMeDesc")}
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loadingScope !== null}
          >
            {t("conversation.cancel")}
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
}
