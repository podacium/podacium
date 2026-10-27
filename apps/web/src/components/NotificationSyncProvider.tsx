/**
 * NotificationSyncProvider
 *
 * Mounts the WebSocket connection once at the app level and pipes
 * incoming `notification` events directly into the TanStack Query cache.
 */
"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { prependNotification } from "@/hooks/useNotifications";
import type { NotificationResponse } from "@/lib/api";

export function NotificationSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const qc = useQueryClient();

  const onNotification = useCallback(
    (raw: any) => {
      if (!raw) return;
      const notif: NotificationResponse = raw.notification || raw.data || raw;
      if (notif && typeof notif.id === "number") {
        prependNotification(qc, notif);
      }
    },
    [qc],
  );

  useWebSocket({ onNotification });

  return <>{children}</>;
}
