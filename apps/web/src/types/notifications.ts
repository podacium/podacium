/**
 * Canonical TypeScript types for Podacium Notifications.
 * Synchronized with FastAPI Pydantic v2 schemas in services/api/app/schemas/notifications.py.
 */

export type NotificationCategory =
  | "SECURITY"
  | "PROJECT"
  | "COURSE"
  | "MARKETING"
  | "SYSTEM"
  | "BILLING"
  | "MESSAGING"
  | "FREELANCE"
  | "EDUCATION"
  | "LIVE"
  | "SUPPORT"
  | "BI";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ActionVariant = "primary" | "secondary" | "danger" | "outline";

export interface NotificationAction {
  type?: string;
  label: string;
  target?: string;
  url?: string;
  action?: string;
  variant?: ActionVariant;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface NotificationActor {
  id: number;
  name: string;
  avatar_url?: string;
  avatarUrl?: string;
  role?: string;
}

export interface NotificationPayload {
  entity_type: string;
  entity_id: string;
  action_url: string;
  actor?: NotificationActor;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface NotificationDelivery {
  id: number;
  channel: "IN_APP" | "EMAIL" | "PUSH" | "SMS" | "WEBHOOK";
  status: "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "RETRYING";
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  retry_count: number;
  external_id?: string | null;
}

export interface NotificationItem {
  id: number;
  user_id?: number;
  userId?: number;
  type: string;
  title?: string | null;
  body: string;
  data?: Record<string, any> | null;
  payload?: NotificationPayload | null;
  category?: NotificationCategory | null;
  priority: NotificationPriority;
  is_read: boolean;
  isRead?: boolean;
  read_at?: string | null;
  readAt?: string | null;
  in_app_delivered?: boolean;
  inAppDelivered?: boolean;
  email_sent?: boolean;
  emailSent?: boolean;
  email_sent_at?: string | null;
  emailSentAt?: string | null;
  push_sent?: boolean;
  pushSent?: boolean;
  push_sent_at?: string | null;
  pushSentAt?: string | null;
  created_at: string;
  createdAt?: string;
  deleted_at?: string | null;
  deletedAt?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
  actions?: NotificationAction[] | null;
  deliveries?: NotificationDelivery[];
}

export type NotificationResponse = NotificationItem;

export interface NotificationPreferences {
  id?: number;
  user_id?: number;
  userId?: number;
  email_notifications: boolean;
  emailNotifications?: boolean;
  push_notifications: boolean;
  pushNotifications?: boolean;
  in_app_notifications: boolean;
  inAppNotifications?: boolean;
  sms_notifications: boolean;
  smsNotifications?: boolean;
  marketing_emails: boolean;
  marketingEmails?: boolean;
  newsletter: boolean;
  digest_frequency: "REALTIME" | "HOURLY" | "DAILY" | "WEEKLY";
  digestFrequency?: "REALTIME" | "HOURLY" | "DAILY" | "WEEKLY";
  quiet_hours_start?: string | null;
  quietHoursStart?: string | null;
  quiet_hours_end?: string | null;
  quietHoursEnd?: string | null;
  quiet_hours_timezone?: string;
  quietHoursTimezone?: string;
  digest_time?: string | null;
  digestTime?: string | null;
  digest_timezone?: string;
  digestTimezone?: string;
  digest_day?: number | null;
  digestDay?: number | null;
  category_preferences?: Record<string, Record<string, boolean>> | null;
  categoryPreferences?: Record<string, Record<string, boolean>> | null;
}
