"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import {
  MessageSquare,
  X,
  CheckCircle2,
  CornerDownRight,
  Pin,
  Send,
  User,
  Filter,
  Trash2,
  Clock,
} from "lucide-react";

export interface CommentItem {
  id: number;
  dashboard_id: number;
  widget_id?: number | null;
  author_id: number;
  author_name?: string;
  author_avatar?: string;
  parent_id?: number | null;
  content: string;
  position_x?: number | null;
  position_y?: number | null;
  is_resolved: boolean;
  created_at: string;
  replies_count?: number;
}

interface DashboardCommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: number;
  activeWidgetId?: number | null;
  comments: CommentItem[];
  onAddComment: (
    content: string,
    widgetId?: number | null,
    parentId?: number | null,
    posX?: number | null,
    posY?: number | null,
  ) => Promise<void>;
  onToggleResolve: (
    commentId: number,
    currentResolved: boolean,
  ) => Promise<void>;
}

export function DashboardCommentDrawer({
  isOpen,
  onClose,
  dashboardId,
  activeWidgetId,
  comments,
  onAddComment,
  onToggleResolve,
}: DashboardCommentDrawerProps) {
  const t = useTranslations("bi");
  const [filterMode, setFilterMode] = useState<"all" | "widget" | "unresolved">(
    "all",
  );
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredComments = comments.filter((c) => {
    if (c.parent_id) return false; // Filter top-level threads first
    if (
      filterMode === "widget" &&
      activeWidgetId &&
      c.widget_id !== activeWidgetId
    )
      return false;
    if (filterMode === "unresolved" && c.is_resolved) return false;
    return true;
  });

  const getReplies = (parentId: number) => {
    return comments.filter((c) => c.parent_id === parentId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddComment(newCommentText.trim(), activeWidgetId, replyingToId);
      setNewCommentText("");
      setReplyingToId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end" size="md">
      <DrawerContent
        className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 dark:bg-slate-900"
        overlayClassName="z-40 bg-black/60"
      >
        {/* Header */}
        <DrawerHeader className="items-center border-slate-800 bg-slate-900/80 px-4 py-4 backdrop-blur">
          <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            {t("dashboards.comments.title")}
          </DrawerTitle>
          <DrawerClose
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={t("dashboards.comments.closeDrawer")}
          />
        </DrawerHeader>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <button
              onClick={() => setFilterMode("all")}
              className={cn(
                "px-2.5 py-1 rounded-full transition-colors",
                filterMode === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200",
              )}
            >
              {t("dashboards.comments.filterAll", {
                count: comments.filter((c) => !c.parent_id).length,
              })}
            </button>
            {activeWidgetId && (
              <button
                onClick={() => setFilterMode("widget")}
                className={cn(
                  "px-2.5 py-1 rounded-full transition-colors",
                  filterMode === "widget"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200",
                )}
              >
                {t("dashboards.comments.filterWidget")}
              </button>
            )}
            <button
              onClick={() => setFilterMode("unresolved")}
              className={cn(
                "px-2.5 py-1 rounded-full transition-colors",
                filterMode === "unresolved"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200",
              )}
            >
              {t("dashboards.comments.filterUnresolved")}
            </button>
          </div>
        </div>

        {/* Comments List */}
        <DrawerBody className="space-y-4 p-4">
          {filteredComments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 opacity-40" />
              <p className="text-sm">{t("dashboards.comments.noComments")}</p>
            </div>
          ) : (
            filteredComments.map((comment) => {
              const replies = getReplies(comment.id);
              return (
                <div
                  key={comment.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all space-y-2.5",
                    comment.is_resolved
                      ? "bg-slate-900/40 border-slate-800/60 opacity-75"
                      : "bg-slate-850/90 border-slate-800",
                  )}
                >
                  {/* Comment Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center font-bold text-xs">
                        {comment.author_name ? (
                          comment.author_name[0].toUpperCase()
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-200">
                          {comment.author_name ||
                            t("dashboards.comments.teamMember")}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                          {comment.position_x != null && (
                            <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 font-mono text-[9px]">
                              <Pin className="w-2.5 h-2.5" />{" "}
                              {t("dashboards.comments.pin", {
                                x: Math.round(comment.position_x),
                                y: Math.round(comment.position_y || 0),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onToggleResolve(comment.id, comment.is_resolved)
                      }
                      className={cn(
                        "p-1 rounded-md transition-colors text-xs flex items-center gap-1",
                        comment.is_resolved
                          ? "text-emerald-400 hover:text-slate-300"
                          : "text-slate-400 hover:text-emerald-400",
                      )}
                      title={
                        comment.is_resolved
                          ? t("dashboards.comments.markUnresolved")
                          : t("dashboards.comments.markResolved")
                      }
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                    <button
                      onClick={() =>
                        setReplyingToId(
                          replyingToId === comment.id ? null : comment.id,
                        )
                      }
                      className="hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium"
                    >
                      <CornerDownRight className="w-3 h-3" />{" "}
                      {t("dashboards.comments.replyCount", {
                        count: replies.length,
                      })}
                    </button>
                  </div>

                  {/* Thread Replies */}
                  {replies.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-slate-800 space-y-2 pt-1">
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-xs"
                        >
                          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                            <span className="font-semibold text-slate-300">
                              {reply.author_name ||
                                t("dashboards.comments.user")}
                            </span>
                            <span>
                              {new Date(reply.created_at).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <p className="text-slate-300">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </DrawerBody>

        {/* Compose Footer */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 space-y-2 border-t border-slate-800 bg-slate-950/60 p-4"
        >
          {replyingToId && (
            <div className="flex items-center justify-between text-xs text-indigo-400 bg-indigo-950/50 px-2.5 py-1 rounded-md">
              <span>
                {t("dashboards.comments.replyingTo", { id: replyingToId })}
              </span>
              <button
                type="button"
                onClick={() => setReplyingToId(null)}
                className="hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={
                replyingToId
                  ? t("dashboards.comments.replyPlaceholder")
                  : t("dashboards.comments.addPlaceholder")
              }
              className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCommentText.trim()}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </DrawerContent>
    </PodaciumDrawer>
  );
}
