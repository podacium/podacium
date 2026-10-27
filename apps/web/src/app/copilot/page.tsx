"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  Square,
  Bot,
  User,
  RotateCcw,
  GraduationCap,
  Briefcase,
  BarChart3,
  Shield,
  Copy,
  Check,
  MessageSquare,
  Layers,
  ArrowRight,
  Command,
  Camera,
  Mic,
  MicOff,
  Radio,
} from "lucide-react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useGeminiLiveVoice } from "@/hooks/useGeminiLiveVoice";
import { useChatAutoScroll } from "@/hooks/useChatAutoScroll";
import { CopilotSplitPane } from "@/components/copilot/CopilotSplitPane";
import { CopilotCanvasViewer } from "@/components/copilot/CopilotCanvasViewer";
import { WidgetRegistry } from "@/components/chat/WidgetRegistry";
import { ScrollToBottomBadge } from "@/components/chat/ScrollToBottomBadge";
import { AgentAccessibilityAnnouncer } from "@/components/chat/AgentAccessibilityAnnouncer";
import {
  MOTION_GRID_STATES,
  PodaciumBadge,
  PodaciumButton,
  PodaciumMotionGrid,
  PodaciumMotionGridCells,
  PodaciumMotionStatus,
} from "@/components/design-system";
import { useMotionStatus } from "@/hooks/useMotionStatus";
import { ReasoningStepper } from "@/components/copilot/ReasoningStepper";
import { FormattedMessage } from "@/components/help-launcher/FormattedMessage";
import { useTranslations, useLocale } from "@/lib/i18n";
import type { CanvasArtifact, CameraOcrArtifact } from "@/types/copilot";
import type { AgentChatMessage } from "@/types/agent-stream";

interface StarterPrompt {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeVariant?: "gradient" | "success" | "warning" | "default";
  prompt: string;
}

interface ChatMessageItemProps {
  msg: AgentChatMessage;
  isStreamingMessage: boolean;
  activeTool?: string | null;
  copiedMessageId: string | null;
  onCopy: (id: string, text: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const ChatMessageItem = React.memo(function ChatMessageItem({
  msg,
  isStreamingMessage,
  activeTool,
  copiedMessageId,
  onCopy,
  t,
}: ChatMessageItemProps) {
  return (
    <div
      className={`flex flex-col ${
        msg.role === "user" ? "items-end" : "items-start"
      } group`}
    >
      <div className="flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%]">
        {/* Avatar */}
        {msg.role === "assistant" && (
          <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
        )}

        <div className="flex flex-col">
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-se-xs shadow-sm shadow-primary/20 whitespace-pre-wrap break-words"
                : "bg-card text-foreground border border-border/80 rounded-ss-xs shadow-xs"
            }`}
          >
            {/* Reasoning & Tool Execution Stepper */}
            {msg.role === "assistant" &&
              (isStreamingMessage ||
                (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0)) && (
                <ReasoningStepper
                  isStreaming={isStreamingMessage}
                  toolCalls={msg.toolCalls}
                  activeTool={isStreamingMessage ? activeTool : null}
                  category={msg.category}
                  defaultExpanded={isStreamingMessage}
                />
              )}

            <bdi dir="auto" className="block w-full">
              {msg.role === "assistant" ? (
                <FormattedMessage
                  content={msg.content}
                  streaming={isStreamingMessage}
                />
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm">
                  {msg.content}
                </div>
              )}
            </bdi>

            {/* Hydrated Generative UI Widgets if attached */}
            {Array.isArray(msg.widgets) && msg.widgets.length > 0 ? (
              <div className="mt-3 w-full space-y-3">
                {msg.widgets.map((w, idx) => (
                  <WidgetRegistry
                    key={`${msg.id}-widget-${idx}`}
                    widget={w}
                    onActionComplete={() => {}}
                  />
                ))}
              </div>
            ) : msg.widget ? (
              <div className="mt-3 w-full">
                <WidgetRegistry
                  widget={msg.widget}
                  onActionComplete={() => {}}
                />
              </div>
            ) : null}
          </div>

          {/* Message Toolbar */}
          {msg.role === "assistant" && (
            <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(msg.id, msg.content)}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                aria-label={t("component.copilot.copyResponseTooltip")}
                title={t("component.copilot.copyResponseTooltip")}
              >
                {copiedMessageId === msg.id ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-[10px] text-emerald-600">
                      {t("component.copilot.copied")}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-[10px]">
                      {t("component.copilot.copy")}
                    </span>
                  </>
                )}
              </button>
              <span>•</span>
              <span className="text-[10px]">
                {t("component.copilot.agentName")}
              </span>
            </div>
          )}
        </div>

        {msg.role === "user" && (
          <div className="h-7 w-7 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0 mt-0.5 border border-border/70">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
});

function parseTableArtifactContent(content: string): {
  data: Record<string, unknown>[];
  metrics: { col: string; alias: string; func: string }[];
  categoryKey: string;
} {
  if (!content) {
    return { data: [], metrics: [], categoryKey: "dim" };
  }
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed)) {
        if (
          parsed.length > 0 &&
          typeof parsed[0] === "object" &&
          parsed[0] !== null
        ) {
          const keys = Object.keys(parsed[0]);
          const categoryKey = keys[0] || "dim";
          const metrics = keys
            .slice(1)
            .map((k) => ({ col: k, alias: k, func: "val" }));
          return { data: parsed, metrics, categoryKey };
        }
      } else if (Array.isArray(parsed.rows) && Array.isArray(parsed.columns)) {
        const cols = parsed.columns;
        const categoryKey = String(cols[0] || "dim");
        const metrics = cols.slice(1).map((k: unknown) => ({
          col: String(k),
          alias: String(k),
          func: "val",
        }));
        return { data: parsed.rows, metrics, categoryKey };
      } else if (Array.isArray(parsed.data)) {
        const dataArr = parsed.data;
        const firstRow =
          dataArr.length > 0 &&
          typeof dataArr[0] === "object" &&
          dataArr[0] !== null
            ? dataArr[0]
            : {};
        const keys = Object.keys(firstRow);
        const categoryKey = parsed.categoryKey || keys[0] || "dim";
        const metrics = Array.isArray(parsed.metrics)
          ? parsed.metrics
          : keys.slice(1).map((k) => ({ col: k, alias: k, func: "val" }));
        return { data: dataArr, metrics, categoryKey };
      }
    }
  } catch {
    // If not JSON format, return safe fallback
  }
  return { data: [], metrics: [], categoryKey: "dim" };
}

export default function CopilotPage() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";
  const initialSessionId =
    searchParams.get("session_id") ||
    (typeof window !== "undefined"
      ? window.sessionStorage.getItem("podacium_agent_session_id") || undefined
      : undefined);
  const locale = useLocale();
  const { t } = useTranslations();

  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");
  const [artifacts, setArtifacts] = useState<CanvasArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    sessionId,
    isStreaming,
    activeTool,
    activeCanvasArtifact,
    sendMessage,
    stopStream,
    confirmAction,
  } = useAgentChat({
    initialSessionId,
  });

  // Sync active agent session ID to sessionStorage for seamless cross-component continuity
  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      window.sessionStorage.setItem("podacium_agent_session_id", sessionId);
    }
  }, [sessionId]);

  const {
    containerRef,
    isPinned,
    unreadCount,
    scrollToBottom,
    notifyNewToken,
    handleScroll,
  } = useChatAutoScroll();

  // Handle new incoming tokens and auto-scroll
  useEffect(() => {
    if (isStreaming) {
      notifyNewToken();
    }
  }, [messages, isStreaming, notifyNewToken]);

  // Synchronize stream-emitted canvas artifacts into local canvas state
  useEffect(() => {
    if (activeCanvasArtifact) {
      const tableParsed =
        activeCanvasArtifact.type === "table"
          ? parseTableArtifactContent(activeCanvasArtifact.content)
          : null;

      const newArtifact: CanvasArtifact = {
        id: activeCanvasArtifact.artifact_id,
        title: activeCanvasArtifact.title,
        type:
          activeCanvasArtifact.type === "code"
            ? "code_sql"
            : activeCanvasArtifact.type === "table"
              ? "bi_visualization"
              : "document_markdown",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(activeCanvasArtifact.type === "code"
          ? {
              code: activeCanvasArtifact.content,
              language: (activeCanvasArtifact.language as any) || "sql",
            }
          : activeCanvasArtifact.type === "table"
            ? {
                chartType: "table" as const,
                categoryKey: tableParsed?.categoryKey || "dim",
                data: tableParsed?.data || [],
                metrics: tableParsed?.metrics || [],
              }
            : {
                markdown: activeCanvasArtifact.content,
              }),
      } as CanvasArtifact;

      setArtifacts((prev) => {
        if (prev.some((a) => a.id === newArtifact.id)) {
          return prev.map((a) => (a.id === newArtifact.id ? newArtifact : a));
        }
        return [...prev, newArtifact];
      });
      setActiveArtifactId(newArtifact.id);
      // Automatically switch to canvas on small screens when a new artifact is created
      setMobileView("canvas");
    }
  }, [activeCanvasArtifact]);

  // Handle initial query param prompt
  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      sendMessage(initialPrompt, locale);
    }
  }, [initialPrompt, locale, messages.length, sendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(text, locale);
    setMobileView("chat");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isStreaming) return;
    setInput("");
    sendMessage(promptText, locale);
    setMobileView("chat");
  };

  const handleCopyMessage = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // Gemini Live Voice & AudioWorklet Full-Duplex Hook
  const {
    isConnected: isVoiceConnected,
    isMuted: isVoiceMuted,
    isSpeaking: isVoiceSpeaking,
    startSession: startVoiceSession,
    stopSession: stopVoiceSession,
    toggleMute: toggleVoiceMute,
    interruptPlayback: interruptVoice,
  } = useGeminiLiveVoice({
    language: locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en",
    onTranscript: () => {},
  });

  const handleOpenScanner = useCallback(() => {
    const existing = artifacts.find((a) => a.type === "camera_ocr");
    if (existing) {
      setActiveArtifactId(existing.id);
    } else {
      const scanArt: CameraOcrArtifact = {
        id: `art_scan_${Date.now()}`,
        title: "Scanner Reçu Fiscal",
        type: "camera_ocr",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "capturing",
      };
      setArtifacts((prev) => [...prev, scanArt]);
      setActiveArtifactId(scanArt.id);
    }
    setMobileView("canvas");
  }, [artifacts]);

  const handleScanSubmit = useCallback(
    async ({
      imageBase64: _img,
      receiptText,
    }: {
      imageBase64: string;
      receiptText?: string;
    }) => {
      sendMessage(
        `Veuillez extraire et vérifier les détails de ce reçu de paiement algérien via l'outil ocr_receipt_scan (BaridiMob/CCP/EDAHABIA). ${receiptText || ""}`,
        locale,
      );
      setMobileView("chat");
    },
    [locale, sendMessage],
  );

  const handleResetSession = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage?.clear();
      window.location.href = window.location.pathname;
    }
  };

  const starterPrompts: StarterPrompt[] = [
    {
      id: "edtech",
      icon: <GraduationCap className="h-4 w-4 text-blue-600" />,
      title: t("component.copilot.prompts.edtechTitle"),
      badge: t("component.copilot.prompts.edtechBadge"),
      badgeVariant: "gradient",
      prompt: t("component.copilot.prompts.edtechPrompt"),
    },
    {
      id: "freelance",
      icon: <Briefcase className="h-4 w-4 text-emerald-600" />,
      title: t("component.copilot.prompts.freelanceTitle"),
      badge: t("component.copilot.prompts.freelanceBadge"),
      badgeVariant: "success",
      prompt: t("component.copilot.prompts.freelancePrompt"),
    },
    {
      id: "bi",
      icon: <BarChart3 className="h-4 w-4 text-indigo-600" />,
      title: t("component.copilot.prompts.biTitle"),
      badge: t("component.copilot.prompts.biBadge"),
      badgeVariant: "default",
      prompt: t("component.copilot.prompts.biPrompt"),
    },
    {
      id: "tax",
      icon: <Shield className="h-4 w-4 text-amber-600" />,
      title: t("component.copilot.prompts.taxTitle"),
      badge: t("component.copilot.prompts.taxBadge"),
      badgeVariant: "warning",
      prompt: t("component.copilot.prompts.taxPrompt"),
    },
  ];

  const lifecycleStatus = isStreaming
    ? "streaming"
    : messages.length > 0 && messages[messages.length - 1].role === "user"
      ? "thinking"
      : "idle";

  const { state: agentMotionState } = useMotionStatus({
    isStreaming,
    activeTool,
    isListening: isVoiceConnected && !isStreaming,
  });

  return (
    <div className="flex flex-col h-[100dvh] bg-background dark:bg-slate-950 overflow-hidden text-foreground">
      {/* Top Cockpit Header Bar - extends to top of screen behind floating navbar */}
      <header className="pt-[calc(var(--chrome-offset,4.5rem)+0.25rem)] pb-3 px-4 sm:px-6 flex items-center justify-between border-b border-border/80 bg-white/75 dark:bg-slate-900/80 backdrop-blur-xl shrink-0 shadow-xs z-10 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                {t("component.copilot.studioTitle")}
              </h1>
              <PodaciumBadge
                variant="gradient"
                className="text-[10px] h-4.5 px-1.5 font-bold uppercase tracking-wider"
              >
                {t("component.copilot.badgePro")}
              </PodaciumBadge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {t("component.copilot.studioSubtitle")}
            </p>
          </div>
        </div>

        {/* Center / Mobile View Switcher */}
        <div className="flex items-center gap-2">
          {/* Active Tool Badge */}
          {activeTool && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-medium border border-blue-500/20 animate-pulse">
              <PodaciumMotionGrid
                frames={MOTION_GRID_STATES.busy.frames}
                interval={MOTION_GRID_STATES.busy.interval}
                cellSize={2}
                gap={1.5}
                className="text-blue-600 dark:text-blue-400"
              >
                <PodaciumMotionGridCells />
              </PodaciumMotionGrid>
              <span>
                {t("component.copilot.tool")}: {activeTool}
              </span>
            </div>
          )}

          {/* Mobile Tab Switcher (<lg) */}
          <div
            role="tablist"
            aria-label={t("component.copilot.studioTitle")}
            className="flex lg:hidden items-center bg-secondary/80 p-0.5 rounded-xl border border-border/60"
          >
            <button
              role="tab"
              aria-selected={mobileView === "chat"}
              onClick={() => setMobileView("chat")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mobileView === "chat"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{t("component.copilot.tabs.discussion")}</span>
              {messages.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full">
                  {messages.length}
                </span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={mobileView === "canvas"}
              onClick={() => setMobileView("canvas")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                mobileView === "canvas"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{t("component.copilot.tabs.canvas")}</span>
              {artifacts.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full">
                  {artifacts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={handleResetSession}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
            title={t("component.copilot.resetSessionTooltip")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {t("component.copilot.resetSession")}
            </span>
          </PodaciumButton>

          <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-muted-foreground/80 bg-secondary/60 border border-border/60 rounded-lg px-2 py-1">
            <Command className="h-3 w-3" />
            <span>{t("component.copilot.commandShortcut")}</span>
          </div>
        </div>
      </header>

      {/* Main Cockpit Split-Pane Workspace */}
      <main className="flex-1 overflow-hidden relative">
        <CopilotSplitPane
          mobileView={mobileView}
          chatSlot={
            <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs relative overflow-hidden">
              {/* Messages Container */}
              <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5"
              >
                {/* Empty State with Starter Prompts */}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center min-h-[75%] text-center py-8 px-2 max-w-xl mx-auto">
                    <div className="mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                        <Sparkles className="h-6 w-6" />
                      </div>
                    </div>

                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      {t("component.copilot.greetingTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                      {t("component.copilot.greetingSubtitle")}
                    </p>

                    <div className="mt-3 flex justify-center">
                      <PodaciumMotionStatus
                        state={agentMotionState}
                        variant="soft"
                        size="sm"
                        aria-live="off"
                      />
                    </div>

                    {/* Starter Prompts Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-6 text-start">
                      {starterPrompts.map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => handleQuickPrompt(sp.prompt)}
                          className="group p-3.5 rounded-xl border border-border/80 bg-card hover:bg-card/90 hover:border-primary/40 hover:shadow-md active:scale-[0.98] transition-all text-start flex flex-col justify-between cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <div className="p-1.5 rounded-lg bg-secondary/80 group-hover:bg-primary/10 transition-colors">
                              {sp.icon}
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/80">
                              {sp.badge}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                              {sp.title}
                              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180 transition-all" />
                            </h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                              {sp.prompt}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rendered Messages */}
                {messages.map((msg, index) => (
                  <ChatMessageItem
                    key={msg.id}
                    msg={msg}
                    isStreamingMessage={
                      isStreaming && index === messages.length - 1
                    }
                    activeTool={activeTool}
                    copiedMessageId={copiedMessageId}
                    onCopy={handleCopyMessage}
                    t={t}
                  />
                ))}
              </div>

              {/* Floating Scroll to Bottom Badge */}
              <ScrollToBottomBadge
                unreadCount={unreadCount}
                onClick={scrollToBottom}
                visible={!isPinned}
              />

              {/* Screen reader live announcements */}
              <AgentAccessibilityAnnouncer
                status={lifecycleStatus}
                activeTool={activeTool}
                locale={locale}
              />

              {/* Chat Input Dock */}
              <div className="p-3 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-border/80">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-2 max-w-4xl mx-auto rounded-2xl border border-border/80 bg-card p-2 sm:p-2.5 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
                >
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("component.copilot.inputPlaceholder")}
                    rows={1}
                    className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none min-h-[38px] max-h-32 leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 px-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground hidden sm:flex">
                      <span>{t("component.copilot.inputHintSend")}</span>
                      <span>•</span>
                      <span>{t("component.copilot.inputHintNewline")}</span>
                    </div>

                    <div className="flex items-center gap-2 ms-auto">
                      {/* Camera OCR Scanner Trigger */}
                      <PodaciumButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenScanner}
                        className="h-8 px-2.5 text-xs gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        title={t("component.copilot.canvas.scanTooltip")}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {t("component.copilot.scan")}
                        </span>
                      </PodaciumButton>

                      {/* Gemini Live Voice Session Trigger */}
                      <PodaciumButton
                        type="button"
                        variant={isVoiceConnected ? "destructive" : "ghost"}
                        size="sm"
                        onClick={
                          isVoiceConnected
                            ? stopVoiceSession
                            : startVoiceSession
                        }
                        className={`h-8 px-2.5 text-xs gap-1.5 transition-all cursor-pointer ${
                          isVoiceConnected
                            ? "bg-rose-500/15 text-rose-500 border border-rose-500/30 hover:bg-rose-500/25 animate-pulse"
                            : "text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                        }`}
                        title={
                          isVoiceConnected
                            ? t("component.copilot.voice.stopSession")
                            : t("component.copilot.voice.startSession")
                        }
                      >
                        {isVoiceConnected ? (
                          <>
                            <Radio className="h-3.5 w-3.5 animate-spin text-rose-500" />
                            <span className="hidden sm:inline">
                              {t("component.copilot.voice.active")}
                            </span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5 text-blue-500" />
                            <span className="hidden sm:inline">
                              {t("component.copilot.voice.live")}
                            </span>
                          </>
                        )}
                      </PodaciumButton>

                      {isVoiceConnected && (
                        <>
                          <button
                            type="button"
                            onClick={toggleVoiceMute}
                            className="p-1.5 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            aria-label={
                              isVoiceMuted
                                ? t("component.copilot.voice.unmute")
                                : t("component.copilot.voice.mute")
                            }
                            title={
                              isVoiceMuted
                                ? t("component.copilot.voice.unmute")
                                : t("component.copilot.voice.mute")
                            }
                          >
                            {isVoiceMuted ? (
                              <MicOff className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <Mic className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </button>
                          {isVoiceSpeaking && (
                            <button
                              type="button"
                              onClick={interruptVoice}
                              className="px-2 py-1 rounded-lg border border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors cursor-pointer"
                              aria-label={t(
                                "component.copilot.voice.bargeInTitle",
                              )}
                              title={t("component.copilot.voice.bargeInTitle")}
                            >
                              {t("component.copilot.voice.bargeIn")}
                            </button>
                          )}
                        </>
                      )}

                      {isStreaming ? (
                        <PodaciumButton
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={stopStream}
                          className="h-8 px-3 text-xs gap-1.5"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          <span>{t("component.copilot.stop")}</span>
                        </PodaciumButton>
                      ) : (
                        <PodaciumButton
                          type="submit"
                          variant="gradient"
                          size="sm"
                          disabled={!input.trim()}
                          className="h-8 px-3.5 text-xs gap-1.5 shadow-sm shadow-blue-500/20"
                        >
                          <span>{t("component.copilot.send")}</span>
                          <Send className="h-3.5 w-3.5" />
                        </PodaciumButton>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          }
          canvasSlot={
            <div className="h-full bg-card/40 dark:bg-slate-950/40 backdrop-blur-xs flex flex-col overflow-hidden">
              <CopilotCanvasViewer
                artifacts={artifacts}
                activeArtifactId={activeArtifactId}
                onSelectArtifact={setActiveArtifactId}
                onOpenScanner={handleOpenScanner}
                onScanSubmit={handleScanSubmit}
                onContextChange={(updated) =>
                  setArtifacts((prev) =>
                    prev.map((a) => (a.id === updated.id ? updated : a)),
                  )
                }
                onExecuteQuery={async (sql, datasetId) => {
                  sendMessage(
                    `Exécute cette requête SQL sur le jeu de données ${datasetId || ""}:\n\`\`\`sql\n${sql}\n\`\`\``,
                    locale,
                  );
                }}
                onConfirmHitlAction={async (intentId, token) => {
                  await confirmAction(intentId, token);
                }}
                onEmitPrompt={(prompt) => {
                  sendMessage(prompt, locale);
                }}
              />
            </div>
          }
        />
      </main>
    </div>
  );
}
