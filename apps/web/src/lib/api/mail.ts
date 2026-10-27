/**
 * Mail Suite API Service Layer
 */

import { apiClient } from "./client";

export interface MailAccount {
  id: number;
  account_id: string;
  email_address: string;
  display_name: string;
  type: "PERSONAL" | "DEPARTMENTAL" | "SHARED";
  status: "ACTIVE" | "DISCONNECTED" | "AUTH_ERROR" | "SYNCING" | "DISABLED";
  quota_bytes?: number | null;
  used_bytes?: number | null;
  signature_html?: string | null;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  mailboxes: Mailbox[];
}

export interface Mailbox {
  id: number;
  mailbox_id: string;
  name: string;
  remote_name: string;
  type:
    | "INBOX"
    | "SENT"
    | "DRAFTS"
    | "TRASH"
    | "SPAM"
    | "ARCHIVE"
    | "STARRED"
    | "CUSTOM";
  unread_count: number;
  total_count: number;
}

export type MailScanStatus =
  "clean" | "skipped" | "failed" | "infected" | "blocked" | "unknown";

export interface MailAttachment {
  attachment_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  content_id?: string | null;
  scan_status?: MailScanStatus;
  download_url: string;
}

export type DeliverabilityStatus = "PASS" | "WARNING" | "FAIL";

export interface SpfDiagnostics {
  status: DeliverabilityStatus;
  record: string | null;
  has_purelymail: boolean;
  has_stale_brevo: boolean;
  policy: string | null;
  warnings: string[];
}

export interface DkimSelectorDiagnostics {
  valid: boolean;
  key_length_bits: number;
  record: string | null;
  error: string | null;
}

export interface DkimDiagnostics {
  status: DeliverabilityStatus;
  selectors: Record<string, DkimSelectorDiagnostics>;
  warnings: string[];
}

export interface DmarcDiagnostics {
  status: DeliverabilityStatus;
  record: string | null;
  policy: string | null;
  rua: string | null;
  is_reject: boolean;
  warnings: string[];
}

export interface MxRecord {
  preference: number;
  host: string;
}

export interface MxDiagnostics {
  status: DeliverabilityStatus;
  records: MxRecord[];
  warnings: string[];
}

export interface DeliverabilityDiagnostics {
  domain: string;
  overall_status: DeliverabilityStatus;
  active_protocols_count: number;
  active_protocols_label: string;
  is_healthy: boolean;
  spf: SpfDiagnostics;
  dkim: DkimDiagnostics;
  dmarc: DmarcDiagnostics;
  mx: MxDiagnostics;
}

export interface MailMessage {
  id: number;
  message_id: string;
  internet_message_id?: string | null;
  from_address: string;
  from_name?: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  snippet?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  status: string;
  priority: string;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  has_attachments: boolean;
  received_at?: string | null;
  sent_at?: string | null;
  created_at: string;
  attachments: MailAttachment[];
}

export interface MailThread {
  id: number;
  thread_id: string;
  subject: string;
  snippet?: string | null;
  last_message_at: string;
  message_count: number;
  has_attachments: boolean;
  is_unread: boolean;
  is_starred: boolean;
  crm_context?: any;
  messages: MailMessage[];
}

export interface PaginatedThreads {
  threads: MailThread[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SendEmailPayload {
  account_id: string;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  in_reply_to?: string;
  references?: string[];
  thread_id?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  attachment_ids?: string[];
  is_draft?: boolean;
}

export const mailApi = {
  async listAccounts(): Promise<MailAccount[]> {
    return apiClient.get<MailAccount[]>("/api/v1/mail/accounts");
  },

  async getAccount(accountId: string): Promise<MailAccount> {
    return apiClient.get<MailAccount>(`/api/v1/mail/accounts/${accountId}`);
  },

  async syncAccount(
    accountId: string,
  ): Promise<{ status: string; synced?: any }> {
    return apiClient.post(`/api/v1/mail/accounts/${accountId}/sync`);
  },

  async listThreads(
    accountId: string,
    mailboxType?: string,
    query?: string,
    page: number = 1,
    limit: number = 25,
  ): Promise<PaginatedThreads> {
    const params = new URLSearchParams();
    if (mailboxType) params.append("mailbox_type", mailboxType);
    if (query) params.append("q", query);
    params.append("page", String(page));
    params.append("limit", String(limit));

    const qs = params.toString();
    return apiClient.get<PaginatedThreads>(
      `/api/v1/mail/accounts/${accountId}/threads${qs ? `?${qs}` : ""}`,
    );
  },

  async getThread(threadId: string): Promise<MailThread> {
    return apiClient.get<MailThread>(`/api/v1/mail/threads/${threadId}`);
  },

  async executeThreadAction(
    threadId: string,
    action:
      | "trash"
      | "spam"
      | "archive"
      | "restore"
      | "mark_read"
      | "mark_unread"
      | "star"
      | "unstar"
      | "purge",
    targetMailboxId?: string,
  ): Promise<{ status: string }> {
    return apiClient.post(`/api/v1/mail/threads/${threadId}/actions`, {
      action,
      target_mailbox_id: targetMailboxId,
    });
  },

  async emptyTrash(accountId: string): Promise<{
    status?: string;
    purged_messages: number;
    purged_threads: number;
  }> {
    return apiClient.post(`/api/v1/mail/accounts/${accountId}/empty-trash`);
  },

  async sendEmail(payload: SendEmailPayload): Promise<MailMessage> {
    return apiClient.post<MailMessage>("/api/v1/mail/send", payload);
  },

  async uploadAttachment(formData: FormData): Promise<{
    attachment_id: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    sha256: string;
    scan_status: MailScanStatus;
  }> {
    return apiClient.upload("/api/v1/mail/attachments/upload", formData);
  },

  async sendPresence(
    threadId: string,
    status: "viewing" | "drafting" = "viewing",
  ): Promise<void> {
    return apiClient.post("/api/v1/mail/presence/heartbeat", {
      thread_id: threadId,
      status,
    });
  },

  async getPresence(threadId: string): Promise<{
    thread_id: string;
    active_admins: Array<{
      admin_id: number;
      admin_name: string;
      admin_email: string;
      status: string;
      updated_at: string;
    }>;
  }> {
    return apiClient.get(`/api/v1/mail/presence/${threadId}`);
  },

  async getDeliverabilityDiagnostics(): Promise<DeliverabilityDiagnostics> {
    return apiClient.get("/api/v1/mail/diagnostics/deliverability");
  },
};
