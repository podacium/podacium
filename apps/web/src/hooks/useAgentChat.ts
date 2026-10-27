import { useState, useRef, useCallback, useEffect } from "react";
import { useDataStreamParser } from "./useDataStreamParser";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import type {
  StreamFrame,
  AgentChatMessage,
  ActionConfirmationPayload,
  CanvasSyncPayload,
} from "@/types/agent-stream";

export interface UseAgentChatOptions {
  apiEndpoint?: string;
  initialSessionId?: string;
  onActionExecuteSuccess?: (intentId: string, result: unknown) => void;
  onError?: (err: Error) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const {
    apiEndpoint = "/api/v1/agent/chat/stream",
    initialSessionId,
    onActionExecuteSuccess,
    onError,
  } = options;

  const locale = useLocale();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(
    initialSessionId || null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeCanvasArtifact, setActiveCanvasArtifact] =
    useState<CanvasSyncPayload | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const { parseChunk, reset: resetParser } = useDataStreamParser();

  // Clean up abort and pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setActiveTool(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.status === "streaming"
            ? { ...m, status: "stopped", isStreaming: false, stopped: true }
            : m,
        ),
      );
    }
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, preferredLocale?: string) => {
      const cleanInput = userInput.trim();
      if (!cleanInput || isStreaming) return;

      const userMsgId = `usr_${Date.now()}`;
      const botMsgId = `ast_${Date.now()}`;

      const userMessage: AgentChatMessage = {
        id: userMsgId,
        role: "user",
        content: cleanInput,
        timestamp: new Date(),
        status: "completed",
      };

      const assistantPlaceholder: AgentChatMessage = {
        id: botMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        status: "streaming",
        isStreaming: true,
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsStreaming(true);
      setActiveTool(null);
      resetParser();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const activeLocale = preferredLocale || locale || "fr";

      try {
        const baseUrl = (
          process.env.NEXT_PUBLIC_API_URL || "https://backend-api.podacium.com"
        ).replace(/\/$/, "");

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-Locale": activeLocale,
        };

        if (typeof document !== "undefined") {
          const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
          if (match) {
            headers["X-CSRF-Token"] = decodeURIComponent(match[1]);
          }
        }

        const response = await fetch(`${baseUrl}${apiEndpoint}`, {
          method: "POST",
          headers,
          credentials: "include", // Sends HttpOnly session cookies
          body: JSON.stringify({
            message: cleanInput,
            locale: activeLocale,
            session_id: sessionId || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `HTTP Error ${response.status}: ${response.statusText}`,
          );
        }
        if (!response.body) {
          throw new Error("No readable response body received from stream.");
        }

        const reader = response.body.getReader();
        let accumulatedText = "";
        let receivedDoneFrame = false;
        let receivedErrorFrame = false;

        const flushTokens = () => {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, content: accumulatedText } : m,
            ),
          );
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          parseChunk(value, (frame: StreamFrame) => {
            switch (frame.type) {
              case "token": {
                accumulatedText += frame.token;
                if (rafIdRef.current === null) {
                  rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === botMsgId
                          ? { ...m, content: accumulatedText }
                          : m,
                      ),
                    );
                  });
                }
                break;
              }
              case "tool_call": {
                setActiveTool(frame.tool_call.name);
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== botMsgId) return m;
                    const existingCalls = m.toolCalls || [];
                    const updated = [
                      ...existingCalls.filter(
                        (c) => c.name !== frame.tool_call.name,
                      ),
                      frame.tool_call,
                    ];
                    return { ...m, toolCalls: updated };
                  }),
                );
                break;
              }
              case "widget": {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== botMsgId) return m;
                    const existingWidgets =
                      m.widgets || (m.widget ? [m.widget] : []);
                    return {
                      ...m,
                      widget: frame.widget,
                      widgets: [...existingWidgets, frame.widget],
                    };
                  }),
                );
                break;
              }
              case "action_confirmation": {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== botMsgId) return m;
                    const existingWidgets =
                      m.widgets || (m.widget ? [m.widget] : []);
                    return {
                      ...m,
                      widget: frame.action_confirmation,
                      widgets: [...existingWidgets, frame.action_confirmation],
                      actionConfirmation: frame.action_confirmation,
                    };
                  }),
                );
                break;
              }
              case "canvas_sync": {
                setActiveCanvasArtifact(frame.canvas_sync);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? { ...m, canvasArtifact: frame.canvas_sync }
                      : m,
                  ),
                );
                break;
              }
              case "done": {
                receivedDoneFrame = true;
                flushTokens();
                if (frame.session_id) setSessionId(frame.session_id);
                setIsStreaming(false);
                setActiveTool(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? {
                          ...m,
                          content: accumulatedText,
                          status: "completed",
                          isStreaming: false,
                          category: frame.category,
                        }
                      : m,
                  ),
                );
                break;
              }
              case "error": {
                receivedErrorFrame = true;
                flushTokens();
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? {
                          ...m,
                          status: "error",
                          error: frame.message,
                          isStreaming: false,
                        }
                      : m,
                  ),
                );
                break;
              }
            }
          });
        }

        // Flush any buffered tokens on stream finish
        flushTokens();

        // Handle abrupt disconnection without a clean done frame
        if (!receivedDoneFrame && !receivedErrorFrame) {
          setIsStreaming(false);
          setActiveTool(null);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== botMsgId) return m;
              const hasContent = Boolean(
                accumulatedText.trim() || m.content?.trim(),
              );
              return {
                ...m,
                content: accumulatedText || m.content,
                status: hasContent ? "completed" : "error",
                error: hasContent ? undefined : "Connexion interrompue.",
                isStreaming: false,
              };
            }),
          );
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          return;
        }
        const errorMsg =
          err instanceof Error ? err.message : "Erreur de connexion";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  status: "error",
                  isStreaming: false,
                  content:
                    m.content ||
                    "Une erreur est survenue lors de la communication avec l'assistant.",
                  error: errorMsg,
                }
              : m,
          ),
        );
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        setIsStreaming(false);
        setActiveTool(null);
        abortControllerRef.current = null;
      }
    },
    [
      apiEndpoint,
      isStreaming,
      locale,
      onError,
      parseChunk,
      resetParser,
      sessionId,
    ],
  );

  // Cryptographic Two-Phase HITL Action Confirmation Handler
  const confirmAction = useCallback(
    async (intentId: string, token: string) => {
      const idempotencyKey = `hitl_exec_${intentId}_${Date.now()}`;
      try {
        const res = (await api.post("/api/v1/agent/execute-confirmed-action", {
          intent_id: intentId,
          token,
          idempotency_key: idempotencyKey,
        })) as { success: boolean; data?: unknown; error?: string };

        if (!res.success) {
          throw new Error(res.error || "Action confirmation execution failed.");
        }

        onActionExecuteSuccess?.(intentId, res.data);
        return res;
      } catch (err: unknown) {
        throw err;
      }
    },
    [onActionExecuteSuccess],
  );

  return {
    messages,
    sessionId,
    isStreaming,
    activeTool,
    activeCanvasArtifact,
    sendMessage,
    stopStream,
    confirmAction,
    setMessages,
    setSessionId,
  };
}
