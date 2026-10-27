/**
 * Notifications API module.
 * Handles notification CRUD, preferences, and admin broadcast.
 */

import { apiClient } from "./client";
import { NotificationCategory, NotificationPriority } from "./types";

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface NotificationResponse {
  id: number;
  userId: number;
  type: string;
  title?: string;
  body: string;
  data?: Record<string, any>;
  category?: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  emailSent?: boolean;
  // compatibility snake_case fields
  is_read?: boolean;
  created_at?: string;
  email_sent?: boolean;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  total: number;
  unread_count: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  by_category: Record<string, number>;
}

export interface NotificationPreferencesBase {
  email_notifications: boolean;
  push_notifications: boolean;
  in_app_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  newsletter: boolean;
  digest_frequency: string;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_timezone?: string;
  digest_time?: string | null;
  digest_timezone?: string;
  digest_day?: number | null;
}

export interface NotificationPreferencesResponse extends NotificationPreferencesBase {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  category_preferences?: Record<string, Record<string, boolean>>;
}

export type NotificationPreferencesUpdate =
  Partial<NotificationPreferencesBase>;

// =============================================================================
// NOTIFICATIONS API METHODS
// =============================================================================

export const notificationsApi = {
  getAll(params?: {
    page?: number;
    skip?: number;
    limit?: number;
    category?: string;
    priority?: string;
    is_read?: boolean;
    start_date?: string;
    end_date?: string;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<NotificationListResponse>(
      `/api/notifications${query}`,
    );
  },

  getStats() {
    return apiClient.get<NotificationStats>("/api/notifications/stats");
  },

  markAsRead(id: number) {
    return apiClient.post<void>(`/api/notifications/${id}/read`);
  },

  markAllAsRead() {
    return apiClient.post<{ markedCount: number; notificationIds: number[] }>(
      "/api/notifications/read-all",
    );
  },

  bulkUpdate(notificationIds: number[], isRead: boolean) {
    return apiClient.post<{ markedCount: number; notificationIds: number[] }>(
      "/api/notifications/bulk-update",
      {
        notificationIds,
        isRead,
      },
    );
  },

  delete(id: number) {
    return apiClient.delete<{ success: boolean; message: string }>(
      `/api/notifications/${id}`,
    );
  },

  getPreferences() {
    return apiClient.get<NotificationPreferencesResponse>(
      "/api/notifications/preferences",
    );
  },

  updatePreferences(data: NotificationPreferencesUpdate) {
    return apiClient.put<NotificationPreferencesResponse>(
      "/api/notifications/preferences",
      data,
    );
  },

  registerPushSubscription(subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent?: string;
  }) {
    return apiClient.post<{ success: boolean }>(
      "/api/notifications/push-subscriptions",
      subscription,
    );
  },

  unregisterPushSubscription(endpoint: string) {
    return apiClient.delete<{ success: boolean }>(
      `/api/notifications/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
    );
  },
};
