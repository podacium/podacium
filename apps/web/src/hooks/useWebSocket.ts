/**
 * WebSocket hook & client manager for real-time messaging and notifications.
 *
 * Architecture (2026-09-15):
 *  1. Global singleton WebSocketManager:
 *     - Only ONE active WebSocket connection exists per browser session.
 *     - Components subscribe/unsubscribe callbacks without tearing down the socket.
 *     - Page navigation across routes does NOT close and reopen the socket.
 *  2. In-flight ticket deduplication:
 *     - If multiple callers / renders trigger connect(), they share the single
 *       in-flight ticket Promise. Never duplicate POST /api/auth/ws-ticket.
 *  3. Throttled ticket fetching & rate limit defense:
 *     - Minimum 2s between ticket fetches.
 *     - 429 response backs off for 30s before retrying.
 *     - 401 halts reconnect until user logs in again.
 *  4. Clean teardown ONLY on logout:
 *     - Socket closes when isAuthenticated becomes false or page unloads.
 */
"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, isAuthenticationError } from "@/lib/api";

type MessageHandler = (data: any) => void;

export interface UseWebSocketOptions {
  onMessage?: MessageHandler;
  onNotification?: MessageHandler;
  onTyping?: (data: {
    userId: number;
    conversationId: number | string;
  }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number; // kept for backwards compat
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (type: string, data?: any) => void;
  sendTyping: (conversationId: number | string) => void;
  markRead: (messageId: number | string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 8;

interface Subscriber {
  options: UseWebSocketOptions;
  onStatusChange?: (connected: boolean) => void;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isAuthenticated = false;
  private circuitBreakerOpen = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private stableTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private ticketPromise: Promise<string | null> | null = null;
  private lastTicketFetchTime = 0;
  private isUnloading = false;

  private subscribers = new Set<Subscriber>();
  private statusListeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      const handleUnload = () => {
        this.isUnloading = true;
        this.disconnect(1000, "Page unload", false);
      };

      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);
      window.addEventListener("pageshow", () => {
        this.isUnloading = false;
      });
    }
  }

  public getStatus = (): boolean => {
    return this.isConnected;
  };

  public subscribeStatus = (callback: () => void): (() => void) => {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  };

  public subscribe(
    options: UseWebSocketOptions,
    onStatusChange?: (connected: boolean) => void,
  ): () => void {
    const subscriber: Subscriber = { options, onStatusChange };
    this.subscribers.add(subscriber);

    // Initial sync
    onStatusChange?.(this.isConnected);
    if (this.isConnected) {
      options.onConnect?.();
    }

    return () => {
      this.subscribers.delete(subscriber);
      // NOTE: We do NOT disconnect the socket on unmount!
      // The connection persists across navigation.
    };
  }

  public setAuthenticated(auth: boolean) {
    if (this.isAuthenticated === auth) return;
    this.isAuthenticated = auth;

    if (auth) {
      this.circuitBreakerOpen = false;
      this.reconnectAttempts = 0;
      this.connect();
    } else {
      this.disconnect(1000, "User logged out");
    }
  }

  private notifyStatus(connected: boolean) {
    if (this.isUnloading) return;
    this.isConnected = connected;

    this.statusListeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("[WS] Error in statusListener:", e);
      }
    });

    this.subscribers.forEach((sub) => {
      try {
        sub.onStatusChange?.(connected);
      } catch (e) {
        console.error("[WS] Error in subscriber onStatusChange:", e);
      }
    });
  }

  private notifyConnect() {
    if (this.isUnloading) return;
    this.subscribers.forEach((sub) => {
      try {
        sub.options.onConnect?.();
      } catch (e) {
        console.error("[WS] Error in subscriber onConnect:", e);
      }
    });
  }

  private notifyDisconnect() {
    if (this.isUnloading) return;
    this.subscribers.forEach((sub) => {
      try {
        sub.options.onDisconnect?.();
      } catch (e) {
        console.error("[WS] Error in subscriber onDisconnect:", e);
      }
    });
  }

  private notifyMessage(data: any) {
    if (this.isUnloading) return;
    this.subscribers.forEach((sub) => {
      try {
        sub.options.onMessage?.(data);
      } catch (e) {
        console.error("[WS] Error in subscriber onMessage:", e);
      }
    });
  }

  private notifyNotification(data: any) {
    if (this.isUnloading) return;
    this.subscribers.forEach((sub) => {
      try {
        sub.options.onNotification?.(data);
      } catch (e) {
        console.error("[WS] Error in subscriber onNotification:", e);
      }
    });
  }

  private notifyTyping(data: { userId: number; conversationId: number }) {
    if (this.isUnloading) return;
    this.subscribers.forEach((sub) => {
      try {
        sub.options.onTyping?.(data);
      } catch (e) {
        console.error("[WS] Error in subscriber onTyping:", e);
      }
    });
  }

  private async fetchTicket(): Promise<string | null> {
    // Deduplicate in-flight ticket requests
    if (this.ticketPromise) {
      return this.ticketPromise;
    }

    // Minimum 2s throttle between ticket fetches
    const now = Date.now();
    const elapsed = now - this.lastTicketFetchTime;
    if (elapsed < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
    }
    this.lastTicketFetchTime = Date.now();

    this.ticketPromise = (async () => {
      try {
        const res = await api.post<{ ticket: string }>(
          "/api/auth/ws-ticket",
          {},
          { skipErrorHandling: true, retries: 0 },
        );
        return res?.ticket || null;
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        if (status === 401 || isAuthenticationError(err)) {
          console.warn(
            "[WS] 401 on ws-ticket fetch — session expired, halting reconnect",
          );
          this.circuitBreakerOpen = true;
          return null;
        }
        if (status === 429) {
          console.warn("[WS] 429 rate limited on ws-ticket — backoff 30s");
          this.scheduleReconnect(30_000);
          return null;
        }
        console.warn("[WS] Failed to fetch ws-ticket:", err?.message || err);
        return null;
      } finally {
        this.ticketPromise = null;
      }
    })();

    return this.ticketPromise;
  }

  public async connect() {
    if (typeof window === "undefined") return;
    if (!this.isAuthenticated) return;
    if (this.circuitBreakerOpen) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;
    if (this.isConnecting) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        "[WS] Circuit breaker open — max reconnect attempts reached",
      );
      this.circuitBreakerOpen = true;
      return;
    }

    this.isConnecting = true;

    const ticket = await this.fetchTicket();
    if (!ticket) {
      this.isConnecting = false;
      if (!this.circuitBreakerOpen && this.isAuthenticated) {
        this.scheduleReconnect();
      }
      return;
    }

    if (!this.isAuthenticated) {
      this.isConnecting = false;
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "").replace(
        /\/+$/,
        "",
      ) ?? "backend-api.podacium.com";
    const wsUrl = `${protocol}//${host}/ws?ticket=${ticket}`;

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.notifyStatus(true);
        this.notifyConnect();

        // Start ping heartbeat
        this.startHeartbeat();

        // Stable connection timer: reset reconnect attempts after 5s of uptime
        if (this.stableTimer) clearTimeout(this.stableTimer);
        this.stableTimer = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.reconnectAttempts = 0;
          }
        }, 5_000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "message":
              this.notifyMessage(data.data);
              break;
            case "notification":
              this.notifyNotification(data.data);
              break;
            case "typing":
              this.notifyTyping(data);
              break;
            case "pong":
            case "connected":
              break;
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        if (this.stableTimer) {
          clearTimeout(this.stableTimer);
          this.stableTimer = null;
        }
        if (this.ws === ws) {
          this.ws = null;
        }

        if (this.isUnloading) return;

        this.notifyStatus(false);
        this.notifyDisconnect();

        // Do not reconnect if unauthenticated or explicitly closed
        if (!this.isAuthenticated) return;
        if (event.code === 1000 || event.code >= 4000) {
          console.info(
            `[WS] Connection closed with code ${event.code} — not reconnecting`,
          );
          return;
        }

        this.scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(customDelayMs?: number) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (!this.isAuthenticated || this.circuitBreakerOpen) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        "[WS] Circuit breaker triggered after max consecutive disconnects",
      );
      this.circuitBreakerOpen = true;
      return;
    }

    const delay =
      customDelayMs ??
      Math.min(1_000 * 2 ** (this.reconnectAttempts - 1), 30_000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public disconnect(code = 1000, reason?: string, notifySubscribers = true) {
    const resolvedReason = reason ?? ["Normal", "Closure"].join(" ");
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.stopHeartbeat();
    this.isConnecting = false;

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.close(code, resolvedReason);
      } catch {}
    }

    this.isConnected = false;
    if (notifySubscribers && !this.isUnloading) {
      this.notifyStatus(false);
    }
  }

  public sendMessage(type: string, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }
}

// Module-level global singleton
const wsManager = new WebSocketManager();

const getServerSnapshot = () => false;

export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const { isAuthenticated } = useAuth();
  const isConnected = useSyncExternalStore(
    wsManager.subscribeStatus,
    wsManager.getStatus,
    getServerSnapshot,
  );

  // Keep latest callbacks in a ref
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync auth state with global manager
  useEffect(() => {
    wsManager.setAuthenticated(isAuthenticated);
  }, [isAuthenticated]);

  // Subscribe to connection events
  useEffect(() => {
    const unsubscribe = wsManager.subscribe({
      get onMessage() {
        return optionsRef.current.onMessage;
      },
      get onNotification() {
        return optionsRef.current.onNotification;
      },
      get onTyping() {
        return optionsRef.current.onTyping;
      },
      get onConnect() {
        return optionsRef.current.onConnect;
      },
      get onDisconnect() {
        return optionsRef.current.onDisconnect;
      },
    });

    return unsubscribe;
  }, []);

  const sendMessage = useCallback((type: string, data?: any) => {
    wsManager.sendMessage(type, data);
  }, []);

  const sendTyping = useCallback((conversationId: number | string) => {
    wsManager.sendMessage("typing", { conversationId });
  }, []);

  const markRead = useCallback((messageId: number | string) => {
    wsManager.sendMessage("read", { messageId });
  }, []);

  return { isConnected, sendMessage, sendTyping, markRead };
}
