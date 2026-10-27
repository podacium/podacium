/**
 * Notification hooks — TanStack Query v5.
 *
 * Single cache key: ['notifications']
 * All badge, dropdown, and full page notification center components share unified state.
 * WebSocket / SSE events push into the cache via setQueryData.
 */
"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import {
  notificationsApi,
  type NotificationListResponse,
  type NotificationResponse,
  type NotificationStats,
  type NotificationPreferencesResponse,
  type NotificationPreferencesUpdate,
} from "@/lib/api";

// ─── Query config — single source of truth ───────────────────────────────────

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const NOTIFICATIONS_STATS_KEY = ["notifications", "stats"] as const;
export const NOTIFICATIONS_PREFS_KEY = [
  "notifications",
  "preferences",
] as const;

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const err = error as { status?: number; statusCode?: number; name?: string };
  const status = err?.status ?? err?.statusCode;
  if (status === 401 || status === 403 || err?.name === "AuthenticationError") {
    return false;
  }
  return failureCount < 3;
};

/**
 * Apply an optimistic update to every cached notification *list* query.
 *
 * All notification queries share the `["notifications"]` prefix, but only the
 * list query carries a `notifications` array — `stats` and `preferences` are
 * cached under the same prefix. A list-shaped updater applied to those shapes
 * throws inside `onMutate`, and TanStack Query treats a rejected `onMutate` as
 * a failed mutation: `mutationFn` is never called, so the request is never
 * sent and the UI silently snaps back after invalidation. Guards the shape
 * here so only real list entries are touched.
 */
function updateNotificationLists(
  qc: QueryClient,
  updater: (old: NotificationListResponse) => NotificationListResponse,
): void {
  qc.setQueriesData<NotificationListResponse>(
    { queryKey: NOTIFICATIONS_KEY },
    (old) => (old && Array.isArray(old.notifications) ? updater(old) : old),
  );
}

export const notificationsQueryOptions = queryOptions({
  queryKey: NOTIFICATIONS_KEY,
  queryFn: (): Promise<NotificationListResponse> =>
    notificationsApi.getAll({ skip: 0, limit: 50 }),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchInterval: () =>
    typeof document !== "undefined" && document.visibilityState === "visible"
      ? 60_000
      : false,
  refetchOnWindowFocus: true,
  retry: shouldRetry,
  retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Returns the full notification list for dropdown panel and notification center.
 * Re-renders on any change to the cache.
 */
export function useNotifications(
  params?: {
    skip?: number;
    limit?: number;
    is_read?: boolean;
    category?: string;
    priority?: string;
  },
  options?: { enabled?: boolean },
) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: params ? [...NOTIFICATIONS_KEY, params] : NOTIFICATIONS_KEY,
    queryFn: () => notificationsApi.getAll(params || { skip: 0, limit: 50 }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    enabled: options?.enabled,
    retry: shouldRetry,
  });
}

/**
 * Returns only the unread count for the bell badge.
 * `select` ensures this component re-renders ONLY when the integer changes.
 */
export function useUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    ...notificationsQueryOptions,
    enabled: options?.enabled,
    select: (data): number =>
      data.unread_count !== undefined
        ? data.unread_count
        : data.notifications.filter((n) => !n.is_read && !n.isRead).length,
  });
}

/**
 * Returns notification stats (by category, priority, total, unread).
 */
export function useNotificationStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: NOTIFICATIONS_STATS_KEY,
    queryFn: () => notificationsApi.getStats(),
    staleTime: 60_000,
    enabled: options?.enabled,
    retry: shouldRetry,
  });
}

/**
 * Returns user notification preferences.
 */
export function useNotificationPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: NOTIFICATIONS_PREFS_KEY,
    queryFn: () => notificationsApi.getPreferences(),
    staleTime: 5 * 60_000,
    enabled: options?.enabled,
    retry: shouldRetry,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 * Applies an optimistic update immediately; rolls back on error.
 */
export function useMarkAsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),

    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });

      const previous =
        qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);

      updateNotificationLists(qc, (old) => ({
        ...old,
        notifications: old.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, isRead: true } : n,
        ),
        unread_count: Math.max(0, (old.unread_count ?? 0) - 1),
      }));

      return { previous };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_STATS_KEY });
    },
  });
}

/**
 * Mark all notifications as read.
 * Applies an optimistic update immediately; rolls back on error.
 */
export function useMarkAllAsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous =
        qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);

      updateNotificationLists(qc, (old) => ({
        ...old,
        notifications: old.notifications.map((n) => ({
          ...n,
          is_read: true,
          isRead: true,
        })),
        unread_count: 0,
      }));

      return { previous };
    },

    onError: (_err, _v, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_STATS_KEY });
    },
  });
}

/**
 * Bulk mark notifications as read or unread.
 */
export function useBulkMarkAsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, isRead }: { ids: number[]; isRead: boolean }) =>
      notificationsApi.bulkUpdate(ids, isRead),

    onMutate: async ({ ids, isRead }) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous =
        qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);

      updateNotificationLists(qc, (old) => {
        const idSet = new Set(ids);
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            idSet.has(n.id) ? { ...n, is_read: isRead, isRead } : n,
          ),
          unread_count: isRead
            ? Math.max(0, (old.unread_count ?? 0) - ids.length)
            : (old.unread_count ?? 0) + ids.length,
        };
      });

      return { previous };
    },

    onError: (_err, _v, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_STATS_KEY });
    },
  });
}

/**
 * Delete a notification.
 */
export function useDeleteNotification() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id),

    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous =
        qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);

      updateNotificationLists(qc, (old) => {
        const target = old.notifications.find((n) => n.id === id);
        const wasUnread = target ? !target.is_read && !target.isRead : false;
        return {
          ...old,
          notifications: old.notifications.filter((n) => n.id !== id),
          total: Math.max(0, old.total - 1),
          unread_count: wasUnread
            ? Math.max(0, (old.unread_count ?? 0) - 1)
            : old.unread_count,
        };
      });

      return { previous };
    },

    onError: (err: any, _v, context) => {
      const status = err?.status ?? err?.response?.status;
      // If 404, the notification is already deleted on the server — keep optimistic delete
      if (status !== 404 && context?.previous !== undefined) {
        qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_STATS_KEY });
    },
  });
}

/**
 * Update user notification preferences.
 */
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: NotificationPreferencesUpdate) =>
      notificationsApi.updatePreferences(data),

    onSuccess: (updated) => {
      qc.setQueryData(NOTIFICATIONS_PREFS_KEY, updated);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_PREFS_KEY });
    },
  });
}

// ─── Cache helpers (used by WebSocket bridge) ─────────────────────────────────

/**
 * Prepend a new notification into the TQ cache.
 * Called by the WebSocket bridge when a real-time notification arrives.
 */
export function prependNotification(
  qc: ReturnType<typeof useQueryClient>,
  notification: NotificationResponse,
) {
  qc.setQueryData<NotificationListResponse>(NOTIFICATIONS_KEY, (old) => {
    if (!old) {
      return {
        notifications: [notification],
        total: 1,
        unread_count: 1,
      };
    }
    // Avoid duplicates (e.g. if polling also picks it up)
    const exists = old.notifications.some((n) => n.id === notification.id);
    if (exists) return old;

    return {
      ...old,
      notifications: [notification, ...old.notifications],
      total: old.total + 1,
      unread_count: (old.unread_count ?? 0) + 1,
    };
  });
}
