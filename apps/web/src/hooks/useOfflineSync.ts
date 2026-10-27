"use client";

import { useState, useEffect, useCallback } from "react";
import {
  enqueueOfflineMutation,
  getPendingCount,
  syncPendingMutations,
  subscribeToSyncEvents,
  OfflineMutation,
} from "@/lib/offlineSync";

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await syncPendingMutations();
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const unsubscribe = subscribeToSyncEvents(() => {
      refreshPendingCount();
    });

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPendingCount, triggerSync]);

  // Synchronize W3C App Badging API with pending offline mutations
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as unknown as {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge === "function") {
      if (pendingCount > 0) {
        nav.setAppBadge(pendingCount).catch(() => {});
      } else if (typeof nav.clearAppBadge === "function") {
        nav.clearAppBadge().catch(() => {});
      }
    }
  }, [pendingCount]);

  const queueAction = useCallback(
    async (
      mutation: Omit<
        OfflineMutation,
        "id" | "createdAt" | "status" | "retryCount" | "idempotency_key"
      > & { idempotency_key?: string },
    ): Promise<OfflineMutation> => {
      const record = await enqueueOfflineMutation(mutation);
      await refreshPendingCount();
      return record;
    },
    [refreshPendingCount],
  );

  return {
    isOnline,
    pendingCount,
    isSyncing,
    queueAction,
    syncNow: triggerSync,
    refreshPendingCount,
  };
}
