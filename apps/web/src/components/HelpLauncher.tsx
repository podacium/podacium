"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MessageSquare,
  HelpCircle,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowUp,
  ArrowUpRight,
  Square,
  Ticket as TicketIcon,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Clock,
  ExternalLink,
  LogIn,
  FileQuestion,
  Sparkles,
  SquarePen,
  ShieldCheck,
  LifeBuoy,
  Lock,
  CreditCard,
  Award,
  Handshake,
  Inbox,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import {
  AiChatMessage,
  AssistantAvatar,
  type ChatMessage,
} from "@/components/help-launcher/AiChatMessage";

export type { ChatMessage } from "@/components/help-launcher/AiChatMessage";

interface FAQItem {
  category?: string;
  question: string;
  answer: string;
}

interface UserTicket {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

type ViewState =
  "home" | "faq" | "ticket" | "myTickets" | "ticketSuccess" | "aiChat";

export type LauncherEngineMode = "assistance" | "copilot";

interface OpenLauncherDetail {
  view?: ViewState;
  subject?: string;
  /** Optional prompt to send to the assistant immediately (view must be "aiChat"). */
  prompt?: string;
  /** Optional execution mode ("assistance" or "copilot") */
  mode?: LauncherEngineMode;
}

const CHAT_STORAGE_KEY = "podacium.help.chat.v1";
const COMPOSER_MAX_HEIGHT = 120;

const TICKET_CATEGORIES = [
  { value: "GENERAL", labelKey: "help.categories.all" },
  { value: "ACCOUNT", labelKey: "help.categories.account" },
  { value: "LEARNING", labelKey: "help.categories.learning" },
  { value: "HUB", labelKey: "help.categories.hub" },
  { value: "BI", labelKey: "help.categories.bi" },
  { value: "BILLING", labelKey: "help.categories.billing" },
];

const QUICK_PROMPTS = [
  { key: "help.aiChipPayment", icon: CreditCard },
  { key: "help.aiChipCertificate", icon: Award },
  { key: "help.aiChipEscrow", icon: Handshake },
] as const;

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "outline";

const TICKET_STATUS: Record<
  string,
  { variant: BadgeVariant; labelKey: string }
> = {
  OPEN: { variant: "default", labelKey: "help.statusOpen" },
  IN_PROGRESS: { variant: "warning", labelKey: "help.statusInProgress" },
  WAITING_ON_CUSTOMER: { variant: "warning", labelKey: "help.statusWaiting" },
  RESOLVED: { variant: "success", labelKey: "help.statusResolved" },
  CLOSED: { variant: "outline", labelKey: "help.statusClosed" },
};

function isDesktopViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(min-width: 768px)").matches === true
  );
}

function loadStoredChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Omit<ChatMessage, "timestamp"> & { timestamp: string }
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function formatShortDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "kab" ? "fr" : locale, {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function HelpLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { isRTL } = useBidi();
  const locale = useLocale();
  const { user, isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewState>("home");
  const [engineMode, setEngineMode] = useState<LauncherEngineMode>("copilot");
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCrispBlocked, setIsCrispBlocked] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("podacium_launcher_mode");
      if (saved === "copilot" || saved === "assistance") {
        setEngineMode(saved);
      }
      const savedSession = sessionStorage.getItem("podacium_agent_session_id");
      if (savedSession) {
        setAgentSessionId(savedSession);
      }
    } catch {}
  }, []);

  const handleModeChange = (mode: LauncherEngineMode) => {
    setEngineMode(mode);
    try {
      localStorage.setItem("podacium_launcher_mode", mode);
    } catch {}
  };

  // FAQ
  const [faqSearchQuery, setFaqSearchQuery] = useState("");
  const [selectedFaq, setSelectedFaq] = useState<FAQItem | null>(null);
  const [faqFeedback, setFaqFeedback] = useState<
    "helpful" | "unhelpful" | null
  >(null);

  // Ticket form
  const [ticketCategory, setTicketCategory] = useState("GENERAL");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketPrefilled, setTicketPrefilled] = useState(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(
    null,
  );

  // My tickets
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  // AI assistant
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const scrolledUpRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const tRef = useRef(t);
  tRef.current = t;

  const isChat = view === "aiChat";

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const makeGreeting = useCallback(
    (): ChatMessage => ({
      id: "greeting",
      role: "assistant",
      content: tRef.current("help.aiChatGreeting"),
      timestamp: new Date(),
      isGreeting: true,
    }),
    [],
  );

  const ensureGreeting = useCallback(() => {
    setMessages((prev) => (prev.length === 0 ? [makeGreeting()] : prev));
  }, [makeGreeting]);

  const safeScrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const node = chatEndRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({
        behavior: reduceMotion ? "auto" : behavior,
        block: "end",
      });
    }
  };

  const scrollToBottom = () => {
    scrolledUpRef.current = false;
    setIsUserScrolledUp(false);
    safeScrollToBottom("smooth");
  };

  const handleChatScroll = () => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - (el.scrollTop + el.clientHeight) > 80;
    scrolledUpRef.current = isUp;
    setIsUserScrolledUp(isUp);
  };

  const closePanel = useCallback(() => {
    const focusWasInside =
      panelRef.current?.contains(document.activeElement) ?? false;
    setIsOpen(false);
    if (focusWasInside) launcherRef.current?.focus();
  }, []);

  // ─── FAQs ─────────────────────────────────────────────────────────────────
  const faqs = useMemo<FAQItem[]>(() => {
    try {
      const raw = t.raw("help.faqs");
      return Array.isArray(raw) ? (raw as FAQItem[]) : [];
    } catch {
      return [];
    }
  }, [t]);

  const filteredFaqs = useMemo(() => {
    const q = faqSearchQuery.trim().toLowerCase();
    if (!q) return faqs.slice(0, 5);
    return faqs
      .filter(
        (item) =>
          item.question?.toLowerCase().includes(q) ||
          item.answer?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [faqs, faqSearchQuery]);

  // ─── Effects ──────────────────────────────────────────────────────────────
  // Restore the conversation for this tab session.
  useEffect(() => {
    const stored = loadStoredChat();
    if (stored.length > 0) setMessages(stored);
  }, []);

  // Persist the conversation (survives navigation & reloads within the tab).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const meaningful = messages.filter((m) => !m.isGreeting);
      if (meaningful.length === 0) {
        window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify(messages),
        );
      }
    } catch {
      // Storage may be unavailable (private mode / quota) — non-critical.
    }
  }, [messages]);

  // Crisp availability + unread replies.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__crisp_status === "blocked") setIsCrispBlocked(true);

    const handleCrispStatus = (e: Event) => {
      const status = (e as CustomEvent<{ status: string }>).detail?.status;
      if (status === "blocked") setIsCrispBlocked(true);
      else if (status === "loaded") setIsCrispBlocked(false);
    };
    const handleCrispMessage = () => {
      const crispObj = (
        window as unknown as { $crisp?: { get?: (k: string) => number } }
      ).$crisp;
      try {
        setUnreadCount(crispObj?.get?.("chat:unread:count") || 0);
      } catch {
        // ignore Crisp get failures
      }
    };
    const handleCrispClosed = () => {
      window.$crisp?.push(["do", "chat:hide"]);
    };

    window.addEventListener("crisp:status", handleCrispStatus);
    if (window.$crisp) {
      window.$crisp.push(["on", "message:received", handleCrispMessage]);
      window.$crisp.push(["on", "chat:closed", handleCrispClosed]);
    }
    return () => window.removeEventListener("crisp:status", handleCrispStatus);
  }, []);

  // Programmatic open from Navbar search, /help page, etc.
  useEffect(() => {
    function handleOpenEvent(e: Event) {
      const detail = (e as CustomEvent<OpenLauncherDetail>).detail;
      setIsOpen(true);
      if (detail?.mode) {
        setEngineMode(detail.mode);
      }
      if (detail?.view) {
        setView(detail.view);
        if (detail.view === "aiChat") {
          ensureGreeting();
          if (detail.prompt) setPendingPrompt(detail.prompt);
        }
      }
      if (detail?.subject) setTicketSubject(detail.subject);
    }
    window.addEventListener("open-help-launcher", handleOpenEvent);
    return () =>
      window.removeEventListener("open-help-launcher", handleOpenEvent);
  }, [ensureGreeting]);

  // Close on outside click (desktop dropup; the mobile backdrop also lands here).
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        launcherRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Escape: step back to home first, then close.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (view !== "home") setView("home");
      else closePanel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, view, closePanel]);

  // Focus management — desktop only, so mobile keyboards don't pop up uninvited.
  useEffect(() => {
    if (!isOpen || !isDesktopViewport()) return;
    const id = window.requestAnimationFrame(() => {
      if (view === "aiChat")
        composerRef.current?.focus({ preventScroll: true });
      else if (view === "home")
        searchRef.current?.focus({ preventScroll: true });
      else panelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, view]);

  // Keep the newest message in view unless the user scrolled up to read.
  useEffect(() => {
    if (!isChat || scrolledUpRef.current) return;
    safeScrollToBottom(streamingId ? "auto" : "smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isAiLoading, isChat]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [aiInput, isChat]);

  // Abort any in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // ─── Navigation actions ───────────────────────────────────────────────────
  const fetchMyTickets = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingTickets(true);
    try {
      const data = (await api.get("/api/v1/tickets?limit=5")) as {
        tickets?: UserTicket[];
      };
      setTickets(data.tickets || []);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      setTickets([]);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [isAuthenticated]);

  const handleOpenMyTickets = () => {
    setView("myTickets");
    fetchMyTickets();
  };

  const openTicketForm = () => {
    setTicketPrefilled(false);
    setSubmitError(null);
    setView("ticket");
  };

  const handleOpenAiChat = (prompt?: string) => {
    ensureGreeting();
    setView("aiChat");
    if (prompt) setPendingPrompt(prompt);
  };

  const handleNewConversation = () => {
    abortRef.current?.abort();
    stoppedRef.current = true;
    setIsAiLoading(false);
    setStreamingId(null);
    setAiInput("");
    setMessages([makeGreeting()]);
    scrolledUpRef.current = false;
    setIsUserScrolledUp(false);
    composerRef.current?.focus();
  };

  const handleFeedback = (id: string, value: "helpful" | "unhelpful") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              feedback: value,
              suggestedTicket: value === "unhelpful" ? true : m.suggestedTicket,
            }
          : m,
      ),
    );
  };

  // ─── AI: send (SSE streaming with sync fallback) ─────────────────────────
  const handleSendAiMessage = async (overrideText?: string) => {
    const text = (overrideText ?? aiInput).trim();
    if (!text || isAiLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    const historyPayload = messages
      .filter((m) => !m.isGreeting)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setIsAiLoading(true);
    setSrAnnouncement("");
    stoppedRef.current = false;
    scrolledUpRef.current = false;
    setIsUserScrolledUp(false);

    const botMsgId = `ast_${Date.now()}`;
    let streamSucceeded = false;
    let accumulated = "";

    const upsertBot = (patch: Partial<ChatMessage>) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === botMsgId)) {
          return prev.map((m) => (m.id === botMsgId ? { ...m, ...patch } : m));
        }
        return [
          ...prev,
          {
            id: botMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            ...patch,
          },
        ];
      });
    };

    // 1. Token-by-token streaming
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const baseUrl = (
          process.env.NEXT_PUBLIC_API_URL || "https://backend-api.podacium.com"
        ).replace(/\/$/, "");
        const targetEndpoint =
          engineMode === "copilot"
            ? `${baseUrl}/api/v1/agent/chat/stream`
            : `${baseUrl}/api/v1/support/chat/stream`;
        const streamHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-Locale": locale || "fr",
        };
        if (typeof document !== "undefined") {
          const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
          if (match) {
            streamHeaders["X-CSRF-Token"] = decodeURIComponent(match[1]);
          }
        }
        const response = await fetch(targetEndpoint, {
          method: "POST",
          headers: streamHeaders,
          credentials: "include",
          body: JSON.stringify({
            message: text,
            locale: locale || "fr",
            history: historyPayload,
            session_id: agentSessionId || undefined,
          }),
          signal: controller.signal,
        });

        if (response.ok && response.body) {
          setStreamingId(botMsgId);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || "";

            for (const chunk of chunks) {
              const trimmed = chunk.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const jsonStr = trimmed.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr) as {
                  token?: string;
                  tool_call?: { name: string; status?: string };
                  widget?: any;
                  action_confirmation?: any;
                  done?: boolean;
                  session_id?: string;
                  category?: string;
                  domain?: string;
                  suggested_ticket?: boolean;
                };
                if (parsed.token) {
                  accumulated += parsed.token;
                  upsertBot({ content: accumulated });
                }
                if (parsed.tool_call) {
                  upsertBot({
                    toolCalls: [
                      {
                        name: parsed.tool_call.name,
                        status: parsed.tool_call.status || "running",
                      },
                    ],
                  });
                }
                if (parsed.widget) {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== botMsgId) return m;
                      const existingWidgets =
                        m.widgets || (m.widget ? [m.widget] : []);
                      return {
                        ...m,
                        widget: parsed.widget,
                        widgets: [...existingWidgets, parsed.widget],
                      };
                    }),
                  );
                }
                if (parsed.action_confirmation) {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== botMsgId) return m;
                      const existingWidgets =
                        m.widgets || (m.widget ? [m.widget] : []);
                      return {
                        ...m,
                        widget: parsed.action_confirmation,
                        widgets: [
                          ...existingWidgets,
                          parsed.action_confirmation,
                        ],
                      };
                    }),
                  );
                }
                if (parsed.done) {
                  if (parsed.session_id) {
                    setAgentSessionId(parsed.session_id);
                    try {
                      sessionStorage.setItem(
                        "podacium_agent_session_id",
                        parsed.session_id,
                      );
                    } catch {}
                  }
                  upsertBot({
                    category: parsed.category || parsed.domain,
                    suggestedTicket: parsed.suggested_ticket,
                  });
                }
              } catch {
                // Partial JSON chunk — wait for the rest.
              }
            }
          }
          if (accumulated.trim().length > 0) streamSucceeded = true;
        }
      } catch (streamErr) {
        if (stoppedRef.current) {
          if (accumulated) upsertBot({ content: accumulated, stopped: true });
        } else {
          console.warn(
            "Live stream failed, falling back to sync endpoint:",
            streamErr,
          );
        }
      } finally {
        abortRef.current = null;
        setStreamingId(null);
      }
    }

    // 2. Synchronous fallback (skipped if the user pressed Stop)
    if (!streamSucceeded && !stoppedRef.current) {
      try {
        const syncEndpoint =
          engineMode === "copilot"
            ? "/api/v1/agent/chat"
            : "/api/v1/support/chat";
        const res = (await api.post(syncEndpoint, {
          message: text,
          locale: locale || "fr",
          history: historyPayload,
          session_id: agentSessionId || undefined,
        })) as {
          reply?: string;
          category?: string;
          domain?: string;
          session_id?: string;
          suggested_ticket?: boolean;
          widgets?: any[];
          action_confirmation?: any;
        };
        if (!stoppedRef.current) {
          if (res.session_id) {
            setAgentSessionId(res.session_id);
            try {
              sessionStorage.setItem(
                "podacium_agent_session_id",
                res.session_id,
              );
            } catch {}
          }
          const allWidgets = [
            ...(res.widgets || []),
            ...(res.action_confirmation ? [res.action_confirmation] : []),
          ];
          upsertBot({
            content: res.reply || t("help.aiFailed"),
            category: res.category || res.domain,
            suggestedTicket: res.suggested_ticket,
            widgets: allWidgets.length > 0 ? allWidgets : undefined,
          });
        }
      } catch (err) {
        console.error("AI Chat error:", err);
        if (!stoppedRef.current)
          upsertBot({ content: t("help.aiFailed"), suggestedTicket: true });
      }
    }

    setSrAnnouncement(t("help.aiFinishedSpeaking"));
    setIsAiLoading(false);
  };

  const handleStopGenerating = () => {
    stoppedRef.current = true;
    abortRef.current?.abort();
    setIsAiLoading(false);
    setStreamingId(null);
  };

  // Send a queued prompt (from chips, FAQ search, or external events) once in chat.
  useEffect(() => {
    if (!pendingPrompt || view !== "aiChat" || isAiLoading) return;
    const prompt = pendingPrompt;
    setPendingPrompt(null);
    void handleSendAiMessage(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, view, isAiLoading]);

  // ─── Escalation: AI conversation → pre-filled human ticket ───────────────
  const buildFallbackTranscript = () => {
    const transcript = messages
      .filter((m) => !m.isGreeting)
      .map(
        (m) => `[${m.role === "user" ? "Client" : "Assistant"}]\n${m.content}`,
      )
      .join("\n\n");
    return `${t("help.aiTranscriptHeader")}\n${transcript}\n\n${t("help.aiAdditionalDetails")}\n`;
  };

  const handleEscalateToTicket = async (cat?: string) => {
    if (isEscalating) return;
    if (cat && TICKET_CATEGORIES.some((c) => c.value === cat))
      setTicketCategory(cat);
    const conversation = messages.filter((m) => !m.isGreeting);
    const firstUser = conversation.find((m) => m.role === "user");
    if (firstUser)
      setTicketSubject(firstUser.content.replace(/\s+/g, " ").slice(0, 100));
    setSubmitError(null);

    if (conversation.length === 0) {
      setTicketPrefilled(false);
      setView("ticket");
      return;
    }

    setIsEscalating(true);
    try {
      const dossierRes = (await api.post("/api/v1/support/dossier", {
        messages: conversation.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        locale: locale || "fr",
        client_context: {
          page: typeof window !== "undefined" ? window.location.pathname : "/",
          browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      })) as { formatted_markdown?: string; category?: string };

      if (
        dossierRes.category &&
        TICKET_CATEGORIES.some((c) => c.value === dossierRes.category)
      ) {
        setTicketCategory(dossierRes.category);
      }
      setTicketMessage(
        dossierRes.formatted_markdown || buildFallbackTranscript(),
      );
    } catch (err) {
      console.error("Dossier generation fallback:", err);
      setTicketMessage(buildFallbackTranscript());
    } finally {
      setIsEscalating(false);
    }
    setTicketPrefilled(true);
    setView("ticket");
  };

  // ─── Crisp live chat (when available) ────────────────────────────────────
  const handleOpenChat = () => {
    if (
      typeof window !== "undefined" &&
      window.$crisp &&
      window.__crisp_status !== "blocked"
    ) {
      setIsOpen(false);
      try {
        if (user) {
          window.$crisp.push(["set", "user:email", [user.email]]);
          window.$crisp.push([
            "set",
            "user:nickname",
            [user.fullName || user.email],
          ]);
        }
        window.$crisp.push([
          "set",
          "session:data",
          [
            [
              ["current_page", window.location.pathname],
              ["user_role", user?.role || "GUEST"],
            ],
          ],
        ]);
        window.$crisp.push(["do", "chat:show"]);
        window.$crisp.push(["do", "chat:open"]);
      } catch (err) {
        console.error("Failed to open Crisp:", err);
        openTicketForm();
        setIsOpen(true);
      }
    } else {
      setIsCrispBlocked(true);
      openTicketForm();
      setIsOpen(true);
    }
  };

  // ─── Ticket submission ───────────────────────────────────────────────────
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    if (ticketSubject.trim().length < 3) {
      setSubmitError(t("help.formSubjectMin"));
      return;
    }
    if (ticketMessage.trim().length < 10) {
      setSubmitError(t("help.formMessageMin"));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    let finalMessage = ticketMessage.trim();
    if (includeDiagnostics && typeof window !== "undefined") {
      finalMessage += `\n\n--- Diagnostic Context ---\nPage: ${window.location.pathname}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`;
    }

    try {
      const response = (await api.post("/api/v1/tickets", {
        subject: ticketSubject.trim(),
        message: finalMessage,
        category: ticketCategory,
        priority: "NORMAL",
      })) as { ticket_number?: string; id?: number };

      setCreatedTicketNumber(response.ticket_number || `#${response.id}`);
      setView("ticketSuccess");
      setTicketSubject("");
      setTicketMessage("");
      setTicketPrefilled(false);
    } catch (err: unknown) {
      console.error("Ticket submission error:", err);
      setSubmitError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : t("help.ticketSubmitFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Do not render inside live sessions / distraction-free rooms
  if (pathname?.includes("/room") || pathname?.startsWith("/live/")) {
    return null;
  }

  // ─── Render helpers ──────────────────────────────────────────────────────
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const BackChevron = isRTL ? ChevronRight : ChevronLeft;
  const firstName = user?.fullName?.split(" ")[0];
  const showThinking =
    isAiLoading &&
    !messages.some((m) => m.id === streamingId && m.content.length > 0);
  const onlyGreeting = messages.filter((m) => !m.isGreeting).length === 0;

  const headerTitle: Record<ViewState, string> = {
    home: firstName
      ? t("help.greetingNamed", { name: firstName })
      : t("help.greetingGuest"),
    aiChat: t("help.aiChatTitle"),
    faq: t("help.matchingArticles"),
    ticket: t("help.ticketTitle"),
    myTickets: t("help.myRecentTickets"),
    ticketSuccess: t("help.ticketTitle"),
  };

  const messageLabels = {
    copy: t("help.aiCopy"),
    copied: t("help.aiCopied"),
    helpful: t("help.aiHelpful"),
    unhelpful: t("help.aiUnhelpful"),
    feedbackThanks: t("help.aiFeedbackThanks"),
    stopped: t("help.aiStopped"),
    escalatePrompt: t("help.aiEscalatePrompt"),
    escalateAction: t("help.aiEscalateShort"),
    assistantName: t("help.aiAssistantName"),
  };

  const viewMotion = reduceMotion
    ? {}
    : {
        initial: {
          opacity: 0,
          x: view === "home" ? (isRTL ? 12 : -12) : isRTL ? -12 : 12,
        },
        animate: { opacity: 1, x: 0 },
        transition: {
          duration: 0.18,
          ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
        },
      };

  const listRowClass =
    "group flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:bg-muted/80";
  const rowIconClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";

  const renderQuickPrompts = (
    onPick: (prompt: string) => void,
    compact = false,
  ) => (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
      {QUICK_PROMPTS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(t(key))}
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-card/90 px-3 py-1.5 text-[11px] font-medium text-indigo-700 shadow-xs transition-all hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-indigo-800/60 dark:bg-card/90 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/60"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {t(key)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* ─── Floating Action Button ─────────────────────────────────────── */}
      <motion.button
        ref={launcherRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            closePanel();
            return;
          }
          setIsOpen(true);
          setView("home");
          setFaqFeedback(null);
        }}
        whileHover={reduceMotion ? undefined : { scale: 1.05 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
        aria-label={isOpen ? t("help.closeHelp") : t("help.openHelp")}
        aria-expanded={isOpen}
        aria-controls="help-launcher-panel"
        className="fixed bottom-6 end-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-primary/30 transition-shadow hover:shadow-xl hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 md:flex print:hidden"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={isOpen ? "close" : "open"}
            initial={
              reduceMotion
                ? false
                : { rotate: isOpen ? -90 : 90, opacity: 0, scale: 0.6 }
            }
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { rotate: isOpen ? 90 : -90, opacity: 0, scale: 0.6 }
            }
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="flex"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <MessageSquare className="h-6 w-6" />
            )}
          </motion.span>
        </AnimatePresence>

        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop (bottom-sheet mode) */}
            <motion.div
              key="help-backdrop"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm md:hidden"
            />

            {/* ─── Panel: bottom sheet on mobile, dropup on desktop ─────── */}
            <motion.div
              key="help-panel"
              id="help-launcher-panel"
              ref={panelRef}
              role="dialog"
              aria-labelledby="help-panel-heading"
              aria-modal="false"
              tabIndex={-1}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              style={{
                transformOrigin: isRTL ? "bottom left" : "bottom right",
              }}
              className={cn(
                "fixed z-[60] flex flex-col overflow-hidden border border-border/80 bg-card/95 shadow-2xl backdrop-blur-2xl focus:outline-none print:hidden dark:border-border/60 dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                "inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
                "md:inset-x-auto md:bottom-24 md:end-6 md:w-[400px] md:rounded-2xl md:pb-0",
                isChat
                  ? "h-[88dvh] md:h-[min(640px,calc(100dvh-8rem))]"
                  : "max-h-[88dvh] md:max-h-[min(620px,calc(100dvh-8rem))]",
              )}
            >
              {/* ─── Header ─────────────────────────────────────────────── */}
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-14 -end-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 start-6 h-28 w-28 rounded-full bg-purple-300/20 blur-2xl"
                />
                <span
                  aria-hidden
                  className="mx-auto mt-2 block h-1 w-10 rounded-full bg-white/40 md:hidden"
                />

                <div
                  className={cn(
                    "relative flex items-center gap-2.5 px-4",
                    view === "home" ? "pt-4 pb-3" : "py-3",
                  )}
                >
                  {view !== "home" && (
                    <button
                      type="button"
                      onClick={() => setView("home")}
                      aria-label={t("common.back")}
                      title={t("common.back")}
                      className="-ms-1.5 rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <BackChevron className="h-4.5 w-4.5" />
                    </button>
                  )}

                  {view === "aiChat" ? (
                    <span className="relative">
                      <AssistantAvatar className="h-9 w-9 bg-white/20 bg-none shadow-none ring-1 ring-white/30" />
                      <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600" />
                    </span>
                  ) : view === "home" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                      <Sparkles className="h-4.5 w-4.5" />
                    </span>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <h2
                      id="help-panel-heading"
                      className="truncate text-sm font-bold leading-tight tracking-tight"
                    >
                      {headerTitle[view]}
                    </h2>
                    <p className="truncate text-[11px] text-blue-100/90">
                      {view === "aiChat"
                        ? `${t("help.onlineBadge")} · ${t("help.aiChatSubtitle")}`
                        : view === "home"
                          ? t("help.subtitle")
                          : view === "ticket"
                            ? t("help.ticketDesc")
                            : t("help.subtitle")}
                    </p>
                  </div>

                  {view === "aiChat" && !onlyGreeting && (
                    <button
                      type="button"
                      onClick={handleNewConversation}
                      aria-label={t("help.aiNewChat")}
                      title={t("help.aiNewChat")}
                      className="rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePanel}
                    aria-label={t("common.close")}
                    title={t("common.close")}
                    className="rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Home: search lives in the header (Intercom-style) */}
                {view === "home" && (
                  <div className="relative px-4 pb-4">
                    <Search className="pointer-events-none absolute start-7 top-1/2 h-4 w-4 -translate-y-[calc(50%+0.5rem)] text-muted-foreground" />
                    <input
                      ref={searchRef}
                      type="search"
                      value={faqSearchQuery}
                      onChange={(e) => setFaqSearchQuery(e.target.value)}
                      placeholder={t("help.searchPlaceholder")}
                      aria-label={t("help.searchPlaceholder")}
                      className="w-full rounded-xl border border-white/30 bg-card py-2.5 ps-9 pe-9 text-[13px] text-foreground shadow-lg shadow-black/10 placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-white/30 dark:border-white/20 dark:bg-card dark:shadow-black/40 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {faqSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setFaqSearchQuery("");
                          searchRef.current?.focus();
                        }}
                        aria-label={t("help.clearSearch")}
                        className="absolute end-6 top-1/2 -translate-y-[calc(50%+0.5rem)] rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Body ───────────────────────────────────────────────── */}
              {isChat ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* Mode Switcher: Assistance vs Copilot Pro */}
                  <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-3 py-1.5 backdrop-blur-sm">
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
                      <button
                        type="button"
                        onClick={() => handleModeChange("assistance")}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                          engineMode === "assistance"
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LifeBuoy className="h-3 w-3 text-primary" />
                        <span>{t("help.launcher.tabs.assistance")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeChange("copilot")}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                          engineMode === "copilot"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{t("help.launcher.tabs.copilotPro")}</span>
                      </button>
                    </div>

                    {engineMode === "copilot" && (
                      <Link
                        href={
                          agentSessionId
                            ? `/copilot?session_id=${encodeURIComponent(agentSessionId)}`
                            : "/copilot"
                        }
                        onClick={closePanel}
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <span>{t("help.launcher.tabs.studio")}</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  {/* Trust & escalation bar */}
                  <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2 text-[11px]">
                    <ShieldCheck
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-muted-foreground"
                      title={t("help.aiDisclaimer")}
                    >
                      {t("help.aiDisclaimer")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEscalateToTicket()}
                      disabled={isEscalating}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isEscalating ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      <span>{t("help.aiEscalateButton")}</span>
                    </button>
                  </div>

                  <div className="relative min-h-0 flex-1">
                    <div
                      ref={chatScrollContainerRef}
                      onScroll={handleChatScroll}
                      role="log"
                      aria-live="off"
                      aria-label={t("help.aiChatTitle")}
                      className="h-full space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
                    >
                      <div role="status" aria-live="polite" className="sr-only">
                        {srAnnouncement}
                      </div>

                      {messages.map((msg) => (
                        <AiChatMessage
                          key={msg.id}
                          message={msg}
                          labels={messageLabels}
                          locale={locale || "en"}
                          isStreaming={msg.id === streamingId}
                          isEscalating={isEscalating}
                          onFeedback={handleFeedback}
                          onEscalate={handleEscalateToTicket}
                        />
                      ))}

                      {showThinking && (
                        <div aria-busy="true" className="flex items-end gap-2">
                          <AssistantAvatar />
                          <div className="flex items-center gap-1 rounded-2xl rounded-ss-md border border-border/70 bg-muted/70 px-3.5 py-2.5">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500 [animation-delay:0.3s]" />
                            <span className="ms-1.5 text-[11px] font-medium text-muted-foreground">
                              {t("help.aiSending")}
                            </span>
                          </div>
                        </div>
                      )}

                      {onlyGreeting && !isAiLoading && (
                        <div className="space-y-2 ps-9">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("help.aiSuggestedTopics")}
                          </p>
                          {renderQuickPrompts((p) => handleSendAiMessage(p))}
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    <AnimatePresence>
                      {isUserScrolledUp && (
                        <motion.button
                          type="button"
                          onClick={scrollToBottom}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="absolute bottom-3 start-1/2 z-10 flex -translate-x-1/2 rtl:translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-lg backdrop-blur-sm hover:bg-card"
                        >
                          <ChevronDown className="h-3.5 w-3.5 text-primary" />
                          <span>{t("help.aiJumpToBottom")}</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Composer */}
                  <div className="shrink-0 border-t border-border/70 bg-card/90 px-3 pt-2.5 pb-2.5 dark:border-border/60">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendAiMessage();
                      }}
                      className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 ps-3 shadow-xs transition-all focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] dark:bg-muted/40"
                    >
                      <textarea
                        ref={composerRef}
                        rows={1}
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            handleSendAiMessage();
                          }
                        }}
                        placeholder={t("help.aiPlaceholder")}
                        aria-label={t("help.aiPlaceholder")}
                        title={t("help.aiInputHint")}
                        maxLength={2000}
                        className="max-h-[120px] min-h-[24px] flex-1 resize-none self-center bg-transparent py-1 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {isAiLoading ? (
                        <button
                          type="button"
                          onClick={handleStopGenerating}
                          aria-label={t("help.aiStop")}
                          title={t("help.aiStop")}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <Square className="h-3 w-3 fill-current" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!aiInput.trim()}
                          aria-label={t("help.aiSend")}
                          title={t("help.aiSend")}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-primary/30 transition-all hover:scale-105 hover:shadow-md active:scale-95 disabled:scale-100 disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                      )}
                    </form>
                    <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3" aria-hidden />
                      <span className="truncate">
                        {t("help.aiPrivacyNote")}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <motion.div
                  key={view}
                  {...viewMotion}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-foreground"
                >
                  {/* ─── HOME ───────────────────────────────────────────── */}
                  {view === "home" && (
                    <>
                      {faqSearchQuery.trim() ? (
                        <div className="space-y-1.5">
                          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("help.matchingArticles")}
                          </p>
                          {filteredFaqs.length > 0 ? (
                            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card">
                              {filteredFaqs.map((faq, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    setSelectedFaq(faq);
                                    setFaqFeedback(null);
                                    setView("faq");
                                  }}
                                  className={cn(listRowClass, "py-2.5")}
                                >
                                  <FileQuestion
                                    className="h-4 w-4 shrink-0 text-primary/70"
                                    aria-hidden
                                  />
                                  <span className="line-clamp-2 flex-1 text-xs font-medium text-foreground">
                                    {faq.question}
                                  </span>
                                  <Chevron className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-primary" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/80 bg-muted/40 px-4 py-5 text-center">
                              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 dark:from-blue-950 dark:to-indigo-950 dark:text-indigo-400">
                                <FileQuestion className="h-5 w-5" />
                              </span>
                              <p className="text-xs font-semibold text-foreground">
                                {t("help.noMatchingFaq")}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {t("help.tryDifferentOrAsk")}
                              </p>
                            </div>
                          )}
                          {/* Always offer the assistant for the typed query */}
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenAiChat(faqSearchQuery.trim())
                            }
                            className="flex w-full items-center gap-2.5 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2.5 text-start text-xs font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:from-blue-100/70 hover:to-indigo-100/70 dark:border-indigo-800/60 dark:from-indigo-950/50 dark:to-blue-950/50 dark:text-indigo-300 dark:hover:border-indigo-700"
                          >
                            <Sparkles
                              className="h-4 w-4 shrink-0"
                              aria-hidden
                            />
                            <span className="line-clamp-1 flex-1">
                              {t("help.aiAskAbout", {
                                query: faqSearchQuery.trim(),
                              })}
                            </span>
                            <Chevron className="h-4 w-4 shrink-0" />
                          </button>
                          {filteredFaqs.length === 0 && (
                            <button
                              type="button"
                              onClick={openTicketForm}
                              className="w-full py-1 text-center text-xs font-semibold text-primary hover:underline"
                            >
                              {t("help.openTicketAction")}
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* AI assistant hero card */}
                          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-purple-50/90 p-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/40 dark:shadow-none">
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -top-10 -end-8 h-24 w-24 rounded-full bg-indigo-300/25 blur-2xl dark:bg-indigo-600/15"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenAiChat()}
                              className="group relative flex w-full items-center gap-3 text-start focus-visible:outline-none"
                            >
                              <AssistantAvatar className="h-10 w-10" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-bold text-foreground">
                                    {t("help.aiChatTitle")}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {t("help.onlineBadge")}
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {t("help.aiChatSubtitle")}
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenAiChat()}
                              className="relative mt-3 flex w-full items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 text-start text-xs text-muted-foreground shadow-xs transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-primary/60"
                            >
                              <span className="flex-1 truncate">
                                {t("help.aiAskPlaceholder")}
                              </span>
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                                <ArrowUp className="h-3.5 w-3.5" />
                              </span>
                            </button>

                            <div className="relative mt-2.5">
                              {renderQuickPrompts(
                                (p) => handleOpenAiChat(p),
                                true,
                              )}
                            </div>
                          </div>

                          {/* Other channels */}
                          <div className="space-y-1.5">
                            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("help.otherWays")}
                            </p>
                            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card">
                              <button
                                type="button"
                                onClick={() => handleOpenAiChat()}
                                className={listRowClass}
                              >
                                <span
                                  className={cn(
                                    rowIconClass,
                                    "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
                                  )}
                                >
                                  <MessageSquare className="h-4.5 w-4.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-semibold text-foreground">
                                    {t("help.assistantTitle")}
                                  </span>
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t("help.assistantDesc")}
                                  </span>
                                </span>
                                <Chevron className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                              </button>
                              <button
                                type="button"
                                onClick={openTicketForm}
                                className={listRowClass}
                              >
                                <span
                                  className={cn(
                                    rowIconClass,
                                    "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
                                  )}
                                >
                                  <TicketIcon className="h-4.5 w-4.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-semibold text-foreground">
                                    {t("help.ticketTitle")}
                                  </span>
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t("help.ticketDesc")}
                                  </span>
                                </span>
                                <Chevron className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                              </button>
                              {isAuthenticated && (
                                <button
                                  type="button"
                                  onClick={handleOpenMyTickets}
                                  className={listRowClass}
                                >
                                  <span
                                    className={cn(
                                      rowIconClass,
                                      "bg-muted text-muted-foreground dark:bg-muted/80 dark:text-foreground",
                                    )}
                                  >
                                    <Clock className="h-4.5 w-4.5" />
                                  </span>
                                  <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">
                                    {t("help.viewMyTickets")}
                                  </span>
                                  <Chevron className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  router.push("/help");
                                }}
                                className={listRowClass}
                              >
                                <span
                                  className={cn(
                                    rowIconClass,
                                    "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
                                  )}
                                >
                                  <HelpCircle className="h-4.5 w-4.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-semibold text-foreground">
                                    {t("help.browseCenter")}
                                  </span>
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t("help.browseCenterDesc")}
                                  </span>
                                </span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ─── FAQ DETAIL ─────────────────────────────────────── */}
                  {view === "faq" && selectedFaq && (
                    <div className="space-y-4">
                      <article className="space-y-2">
                        <h3 className="text-sm font-bold leading-snug text-foreground">
                          {selectedFaq.question}
                        </h3>
                        <div className="rounded-2xl border border-border/80 bg-muted/40 p-3.5 text-[13px] leading-relaxed text-foreground/85">
                          {selectedFaq.answer}
                        </div>
                      </article>

                      <div className="border-t border-border/70 pt-3 text-center">
                        <p className="mb-2 text-xs text-muted-foreground">
                          {t("help.wasHelpfulPrompt")}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          {(["helpful", "unhelpful"] as const).map((value) => {
                            const active = faqFeedback === value;
                            const Icon =
                              value === "helpful" ? ThumbsUp : ThumbsDown;
                            return (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setFaqFeedback(value)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                                  active &&
                                    value === "helpful" &&
                                    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                                  active &&
                                    value === "unhelpful" &&
                                    "border-red-200 bg-red-50 text-destructive dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400",
                                  !active &&
                                    "border-border text-muted-foreground hover:bg-muted",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {value === "helpful"
                                  ? t("help.yes")
                                  : t("help.no")}
                              </button>
                            );
                          })}
                        </div>

                        {faqFeedback === "helpful" && (
                          <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            {t("help.aiFeedbackThanks")}
                          </p>
                        )}
                        {faqFeedback === "unhelpful" && (
                          <div className="mt-3 space-y-2 rounded-2xl border border-indigo-100 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 p-3 text-start dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-blue-950/40">
                            <p className="text-xs text-foreground/80">
                              {t("help.stillNeedHelp")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <PodaciumButton
                                type="button"
                                size="sm"
                                variant="gradient"
                                onClick={() =>
                                  handleOpenAiChat(selectedFaq.question)
                                }
                                className="h-8 px-3 text-xs"
                                icon={<Sparkles className="h-3.5 w-3.5" />}
                              >
                                {t("help.askAiInstead")}
                              </PodaciumButton>
                              <PodaciumButton
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={openTicketForm}
                                className="h-8 bg-card px-3 text-xs dark:bg-card"
                              >
                                {t("help.ticketTitle")}
                              </PodaciumButton>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── TICKET FORM ────────────────────────────────────── */}
                  {view === "ticket" &&
                    (!isAuthenticated ? (
                      <div className="space-y-3 px-2 py-6 text-center">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 dark:from-blue-950 dark:to-indigo-950 dark:text-indigo-400">
                          <LogIn className="h-6 w-6" />
                        </span>
                        <h3 className="text-sm font-bold text-foreground">
                          {t("help.signInToTicketTitle")}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t("help.signInToTicketDesc")}
                        </p>
                        <PodaciumButton
                          variant="gradient"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            setIsOpen(false);
                            router.push(
                              `/auth/login?redirect=${encodeURIComponent(pathname || "/")}`,
                            );
                          }}
                        >
                          {t("auth.signIn")}
                        </PodaciumButton>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleTicketSubmit}
                        className="space-y-3"
                        noValidate
                      >
                        {ticketPrefilled && (
                          <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 p-2.5 text-[11px] leading-snug text-indigo-800 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-blue-950/40 dark:text-indigo-300">
                            <Sparkles
                              className="mt-px h-3.5 w-3.5 shrink-0"
                              aria-hidden
                            />
                            <span>{t("help.aiPrefilledNotice")}</span>
                          </div>
                        )}

                        <PodaciumSelect
                          id="help-ticket-category"
                          label={t("help.ticketTopic")}
                          selectSize="sm"
                          value={ticketCategory}
                          onChange={(e) => setTicketCategory(e.target.value)}
                          options={TICKET_CATEGORIES.map((c) => ({
                            value: c.value,
                            label: t(c.labelKey),
                          }))}
                        />
                        <PodaciumInput
                          id="help-ticket-subject"
                          label={t("help.ticketSubject")}
                          inputSize="sm"
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder={t("help.ticketSubjectPlaceholder")}
                          required
                          minLength={3}
                          maxLength={200}
                        />
                        <PodaciumTextarea
                          id="help-ticket-details"
                          label={t("help.ticketDetails")}
                          rows={ticketPrefilled ? 7 : 4}
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder={t("help.ticketDetailsPlaceholder")}
                          required
                          minLength={10}
                          className="text-xs"
                        />

                        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={includeDiagnostics}
                            onChange={(e) =>
                              setIncludeDiagnostics(e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]"
                          />
                          <span>{t("help.includeContext")}</span>
                        </label>

                        {submitError && (
                          <div
                            role="alert"
                            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-destructive dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                          >
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        <PodaciumButton
                          type="submit"
                          variant="gradient"
                          size="sm"
                          fullWidth
                          loading={isSubmitting}
                          icon={
                            !isSubmitting ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : undefined
                          }
                        >
                          {isSubmitting
                            ? t("help.submitting")
                            : t("help.submitTicket")}
                        </PodaciumButton>
                      </form>
                    ))}

                  {/* ─── TICKET SUCCESS ─────────────────────────────────── */}
                  {view === "ticketSuccess" && (
                    <div className="space-y-3 px-2 py-6 text-center">
                      <motion.span
                        initial={
                          reduceMotion ? false : { scale: 0.6, opacity: 0 }
                        }
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 15,
                        }}
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-7 w-7" />
                      </motion.span>
                      <h3 className="text-sm font-bold text-foreground">
                        {t("help.ticketCreatedTitle")}
                      </h3>
                      {createdTicketNumber && (
                        <PodaciumBadge variant="outline" className="font-mono">
                          {createdTicketNumber}
                        </PodaciumBadge>
                      )}
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {t("help.ticketCreatedDesc", {
                          number: createdTicketNumber || "",
                        })}
                      </p>
                      <div className="flex flex-col gap-2 pt-2">
                        <PodaciumButton
                          variant="outline"
                          size="sm"
                          fullWidth
                          onClick={handleOpenMyTickets}
                        >
                          {t("help.viewAllTickets")}
                        </PodaciumButton>
                        <PodaciumButton
                          variant="ghost"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            setView("home");
                            setCreatedTicketNumber(null);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {t("common.done")}
                        </PodaciumButton>
                      </div>
                    </div>
                  )}

                  {/* ─── MY TICKETS ─────────────────────────────────────── */}
                  {view === "myTickets" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("help.myRecentTickets")}
                        </span>
                        <button
                          type="button"
                          onClick={openTicketForm}
                          className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          + {t("help.newTicket")}
                        </button>
                      </div>

                      {isLoadingTickets ? (
                        <div className="space-y-2" aria-busy="true">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="h-[60px] animate-shimmer rounded-xl bg-gradient-to-r from-muted via-background to-muted bg-[length:200%_100%] border border-border/50"
                            />
                          ))}
                        </div>
                      ) : tickets.length > 0 ? (
                        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card">
                          {tickets.map((tk) => {
                            const status = TICKET_STATUS[tk.status] ?? {
                              variant: "secondary" as const,
                              labelKey: "",
                            };
                            return (
                              <li key={tk.id} className="space-y-1 px-3.5 py-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {tk.ticket_number}
                                  </span>
                                  <PodaciumBadge
                                    variant={status.variant}
                                    className="px-2 py-0 text-[10px]"
                                  >
                                    {status.labelKey
                                      ? t(status.labelKey)
                                      : tk.status}
                                  </PodaciumBadge>
                                </div>
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {tk.subject}
                                </p>
                                {tk.created_at && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatShortDate(
                                      tk.created_at,
                                      locale || "en",
                                    )}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 dark:from-blue-950 dark:to-indigo-950 dark:text-indigo-400 animate-float-slow">
                            <Inbox className="h-5 w-5" />
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {t("help.noTicketsYet")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default HelpLauncher;
