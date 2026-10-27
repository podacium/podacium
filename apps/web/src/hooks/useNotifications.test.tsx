import type { ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NOTIFICATIONS_KEY,
  NOTIFICATIONS_PREFS_KEY,
  NOTIFICATIONS_STATS_KEY,
  useMarkAllAsRead,
  useMarkAsRead,
  type NotificationListResponse,
} from "./useNotifications";
import { notificationsApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  notificationsApi: {
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

const listResponse = (): NotificationListResponse =>
  ({
    notifications: [
      { id: 1, title: "One", is_read: false, isRead: false },
      { id: 2, title: "Two", is_read: false, isRead: false },
    ],
    total: 2,
    unread_count: 2,
  }) as unknown as NotificationListResponse;

const statsResponse = { total: 2, unread: 2, read: 0 };

/**
 * The notification cache holds three sibling queries under the shared
 * `["notifications"]` prefix: the list, `stats`, and `preferences`. Optimistic
 * updaters must only touch the list — running a list-shaped updater against
 * `stats`/`preferences` throws and aborts the mutation before `mutationFn`
 * ever fires (which is exactly how "mark all read" silently did nothing).
 */
function renderWithCache<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(NOTIFICATIONS_KEY, listResponse());
  queryClient.setQueryData(NOTIFICATIONS_STATS_KEY, statsResponse);
  queryClient.setQueryData(NOTIFICATIONS_PREFS_KEY, {
    emailNotifications: true,
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe("useNotifications mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useMarkAllAsRead calls the API and marks every list item read", async () => {
    vi.mocked(notificationsApi.markAllAsRead).mockResolvedValue({
      markedCount: 2,
      notificationIds: [1, 2],
    });
    const { result, queryClient } = renderWithCache(useMarkAllAsRead);

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(notificationsApi.markAllAsRead).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      const list =
        queryClient.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);
      expect(list?.notifications.every((n) => n.is_read && n.isRead)).toBe(
        true,
      );
      expect(list?.unread_count).toBe(0);
    });

    // Sibling queries must survive untouched.
    expect(queryClient.getQueryData(NOTIFICATIONS_STATS_KEY)).toEqual(
      statsResponse,
    );
  });

  it("useMarkAsRead calls the API and flips only the target notification", async () => {
    vi.mocked(notificationsApi.markAsRead).mockResolvedValue(undefined);
    const { result, queryClient } = renderWithCache(useMarkAsRead);

    await act(async () => {
      await result.current.mutateAsync(1);
    });

    expect(notificationsApi.markAsRead).toHaveBeenCalledWith(1);

    await waitFor(() => {
      const list =
        queryClient.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);
      expect(list?.notifications[0].is_read).toBe(true);
      expect(list?.notifications[1].is_read).toBe(false);
      expect(list?.unread_count).toBe(1);
    });
  });
});
