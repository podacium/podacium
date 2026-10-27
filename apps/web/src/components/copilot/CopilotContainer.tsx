"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Bot,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  X,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { useTranslations } from "@/lib/i18n";
import { ComposerEditor, AttachedEntity } from "./composer/ComposerEditor";
import { HitlActionCard, ActionIntent } from "./hitl/HitlActionCard";

export type CopilotDockMode =
  "floating_bubble" | "right_docked" | "full_composer";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  engine?: string;
  actionIntent?: ActionIntent;
  attachedEntities?: AttachedEntity[];
  isStreaming?: boolean;
}

export interface CopilotContainerProps {
  initialMode?: CopilotDockMode;
  sessionId?: string;
  locale?: string;
  currentUserId?: string;
  onClose?: () => void;
  className?: string;
}

export function CopilotContainer({
  initialMode = "floating_bubble",
  sessionId,
  locale = "fr",
  onClose,
  className,
}: CopilotContainerProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<CopilotDockMode>(initialMode);
  const [isOpen, setIsOpen] = useState<boolean>(
    initialMode !== "floating_bubble",
  );
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        locale === "ar"
          ? "مرحباً بك! أنا المساعد الذكي لبوداسيوم. يمكنك سؤالي عن مسارات التعلم، المشاريع، أو مراجعة العقود."
          : "Bonjour ! Je suis l'assistant Copilot de Podacium. Comment puis-je vous accompagner aujourd'hui ?",
      engine: "gemini",
    },
  ]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (
    text: string,
    attachedEntities: AttachedEntity[],
  ) => {
    if (!text && attachedEntities.length === 0) return;

    const userMsgId = `user-${Date.now()}`;
    const userMessage: CopilotMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      attachedEntities,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: CopilotMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      // Stream response via SSE endpoint
      const response = await fetch("/api/v1/support/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          locale,
          session_id: sessionId,
          attached_entities: attachedEntities,
        }),
      });

      if (!response.ok || !response.body) {
        // Fallback to static endpoint
        const fallbackResp = await fetch("/api/v1/support/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            locale,
            session_id: sessionId,
          }),
        });
        const fallbackData = await fallbackResp.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: fallbackData.reply || "Une erreur est survenue.",
                  isStreaming: false,
                  category: fallbackData.category,
                  engine: fallbackData.engine,
                }
              : msg,
          ),
        );
        setIsGenerating(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulated += data.token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulated }
                      : msg,
                  ),
                );
              }
              if (data.action_intent) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, actionIntent: data.action_intent }
                      : msg,
                  ),
                );
              }
              if (data.done) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          isStreaming: false,
                          category: data.category,
                          engine: data.engine,
                        }
                      : msg,
                  ),
                );
              }
            } catch {
              // Ignore malformed chunk
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  locale === "ar"
                    ? "عذراً، حدث خطأ أثناء معالجة الطلب."
                    : "Désolé, une erreur est survenue lors du traitement.",
                isStreaming: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // If floating bubble is closed, show only the circular floating trigger
  if (mode === "floating_bubble" && !isOpen) {
    return (
      <div className={cn("fixed bottom-6 right-6 z-50", className)}>
        <button
          type="button"
          data-testid="copilot-bubble-trigger"
          onClick={() => setIsOpen(true)}
          aria-label={t("copilot.container.openAria")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/20"
        >
          <Bot className="h-7 w-7" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="copilot-container"
      data-mode={mode}
      className={cn(
        "flex flex-col bg-background border border-border shadow-2xl transition-all duration-300 z-50 overflow-hidden",
        mode === "floating_bubble" &&
          "fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[580px] max-h-[85vh] rounded-2xl",
        mode === "right_docked" &&
          "fixed top-0 right-0 h-screen w-[440px] max-w-[90vw] border-l rounded-none",
        mode === "full_composer" &&
          "fixed inset-4 md:inset-8 z-50 rounded-2xl border backdrop-blur-xl",
        className,
      )}
    >
      {/* Copilot Header */}
      <div className="flex items-center justify-between border-b border-border bg-slate-50 dark:bg-slate-900/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                {t("copilot.container.title")}
              </span>
              <PodaciumBadge
                variant="gradient"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {t("copilot.container.geminiVersion")}
              </PodaciumBadge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {t("copilot.container.agentSafety")}
            </p>
          </div>
        </div>

        {/* Mode & Window Controls */}
        <div className="flex items-center gap-1">
          {mode !== "full_composer" ? (
            <button
              type="button"
              data-testid="mode-full-btn"
              onClick={() => setMode("full_composer")}
              aria-label={t("copilot.container.expandAria")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="mode-docked-btn"
              onClick={() => setMode("right_docked")}
              aria-label={t("copilot.container.dockRightSideAria")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}

          {mode !== "right_docked" && (
            <button
              type="button"
              data-testid="mode-dock-toggle-btn"
              onClick={() => setMode("right_docked")}
              aria-label={t("copilot.container.dockRightAria")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )}

          {mode !== "floating_bubble" && (
            <button
              type="button"
              data-testid="mode-bubble-btn"
              onClick={() => setMode("floating_bubble")}
              aria-label={t("copilot.container.floatingBubbleAria")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            data-testid="copilot-close-btn"
            onClick={() => {
              if (mode === "floating_bubble") {
                setIsOpen(false);
              }
              onClose?.();
            }}
            aria-label={t("copilot.container.closeAria")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Message Stream Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`copilot-message-${msg.role}`}
            className={cn(
              "flex flex-col gap-1 max-w-[85%]",
              msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start",
            )}
          >
            {/* Attached Entities Taglist */}
            {msg.attachedEntities && msg.attachedEntities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {msg.attachedEntities.map((ent) => (
                  <span
                    key={ent.id}
                    className="inline-flex items-center gap-1 rounded-sm bg-primary/15 text-primary text-[10px] font-mono px-1.5 py-0.5"
                  >
                    {ent.label}
                  </span>
                ))}
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-foreground rounded-bl-xs",
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {msg.content}
              </div>

              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />
              )}
            </div>

            {/* Assistant Actions: Copy, Category, HITL Card */}
            {msg.role === "assistant" && !msg.isStreaming && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                {msg.engine && (
                  <span>
                    {t("common.uiLabels.enginePrefix")} {msg.engine}
                  </span>
                )}
                {msg.category && <span>• {msg.category}</span>}
                <button
                  type="button"
                  data-testid="copy-msg-btn"
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="flex items-center gap-0.5 hover:text-foreground transition-colors ml-1"
                >
                  {copiedId === msg.id ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>
                    {copiedId === msg.id
                      ? t("copilot.container.copied")
                      : t("copilot.container.copy")}
                  </span>
                </button>
              </div>
            )}

            {/* Embedded Human-in-the-Loop Action Confirmation Card */}
            {msg.actionIntent && (
              <div className="w-full mt-2">
                <HitlActionCard intent={msg.actionIntent} />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Bottom Tray */}
      <div className="border-t border-border bg-slate-50/50 dark:bg-slate-900/30 p-3 shrink-0">
        <ComposerEditor onSend={handleSendMessage} disabled={isGenerating} />
      </div>
    </div>
  );
}

export default CopilotContainer;
