"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  LifeBuoy,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { FormattedMessage } from "./FormattedMessage";
import { WidgetRegistry } from "@/components/chat/WidgetRegistry";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  category?: string;
  suggestedTicket?: boolean;
  feedback?: "helpful" | "unhelpful";
  /** Set when the user pressed "Stop" mid-stream. */
  stopped?: boolean;
  /** Static greeting — no feedback/copy actions. */
  isGreeting?: boolean;
  /** Generative UI Widget payload */
  widget?: any;
  /** Generative UI Widgets array */
  widgets?: any[];
  /** Active tool calls */
  toolCalls?: Array<{
    name: string;
    status?: string;
    arguments?: Record<string, unknown>;
  }>;
}

export interface AiChatMessageLabels {
  copy: string;
  copied: string;
  helpful: string;
  unhelpful: string;
  feedbackThanks: string;
  stopped: string;
  escalatePrompt: string;
  escalateAction: string;
  assistantName: string;
}

export interface AiChatMessageProps {
  message: ChatMessage;
  labels: AiChatMessageLabels;
  locale: string;
  isStreaming?: boolean;
  isEscalating?: boolean;
  onFeedback?: (id: string, value: "helpful" | "unhelpful") => void;
  onEscalate?: (category?: string) => void;
}

export function formatChatTime(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "kab" ? "fr" : locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-primary/25",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

export function AiChatMessage({
  message,
  labels,
  locale,
  isStreaming,
  isEscalating,
  onFeedback,
  onEscalate,
}: AiChatMessageProps) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const time = formatChatTime(message.timestamp, locale);
  const showActions =
    !isUser &&
    !message.isGreeting &&
    !isStreaming &&
    message.content.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable (insecure context) — fail silently.
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "group flex gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
      data-role={message.role}
    >
      {!isUser && <AssistantAvatar className="mt-0.5" />}

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col",
          isUser ? "items-end" : "items-start",
        )}
      >
        {!isUser && (
          <span className="mb-0.5 ps-0.5 text-[10px] font-semibold text-muted-foreground">
            {labels.assistantName}
          </span>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {message.toolCalls.map((tc, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {tc.name}
              </span>
            ))}
          </div>
        )}

        <div
          aria-busy={isStreaming || undefined}
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
            isUser
              ? "rounded-ee-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-primary/20 whitespace-pre-wrap break-words"
              : "rounded-ss-md border border-border/70 bg-muted/70 text-foreground",
          )}
        >
          {isUser ? (
            <bdi dir="auto" className="block w-full">
              {message.content}
            </bdi>
          ) : (
            <bdi dir="auto" className="block w-full">
              <FormattedMessage
                content={message.content}
                streaming={isStreaming}
              />
            </bdi>
          )}
          {message.widgets && message.widgets.length > 0 ? (
            message.widgets.map((w, idx) => (
              <div key={idx} className="mt-2.5 w-full">
                <WidgetRegistry widget={w} />
              </div>
            ))
          ) : message.widget ? (
            <div className="mt-2.5 w-full">
              <WidgetRegistry widget={message.widget} />
            </div>
          ) : null}
          {message.stopped && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              {labels.stopped}
            </p>
          )}
        </div>

        {/* Meta row: time + actions */}
        <div
          className={cn(
            "mt-1 flex items-center gap-0.5 px-0.5 text-muted-foreground",
            isUser ? "flex-row-reverse" : "",
          )}
        >
          {time && (
            <time className="text-[10px] tabular-nums me-1">{time}</time>
          )}

          {showActions && (
            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity",
                message.feedback
                  ? "opacity-100"
                  : "md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
              )}
            >
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? labels.copied : labels.copy}
                title={copied ? labels.copied : labels.copy}
                className="rounded-md p-1 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onFeedback?.(message.id, "helpful")}
                aria-label={labels.helpful}
                aria-pressed={message.feedback === "helpful"}
                title={labels.helpful}
                className={cn(
                  "rounded-md p-1 hover:bg-muted hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  message.feedback === "helpful" && "text-emerald-600",
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback?.(message.id, "unhelpful")}
                aria-label={labels.unhelpful}
                aria-pressed={message.feedback === "unhelpful"}
                title={labels.unhelpful}
                className={cn(
                  "rounded-md p-1 hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  message.feedback === "unhelpful" && "text-destructive",
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              {message.feedback === "helpful" && (
                <span className="ms-1 text-[10px] font-medium text-emerald-700">
                  {labels.feedbackThanks}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Human escalation suggestion */}
        {!isUser && message.suggestedTicket && !isStreaming && (
          <div className="mt-1.5 flex w-full items-start gap-2.5 rounded-xl border border-indigo-200/70 bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-purple-50/90 p-2.5 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/40">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-indigo-600 shadow-xs dark:text-indigo-400">
              <LifeBuoy className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] leading-snug text-foreground/80">
                {labels.escalatePrompt}
              </p>
              <PodaciumButton
                type="button"
                size="sm"
                variant="outline"
                loading={isEscalating}
                onClick={() => onEscalate?.(message.category)}
                className="h-7 bg-card px-2.5 text-[11px] font-semibold text-indigo-700 hover:bg-muted dark:text-indigo-300"
              >
                {labels.escalateAction}
              </PodaciumButton>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
