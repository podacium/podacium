import { describe, it, expect } from "vitest";
import { formatNotificationContent } from "./notificationFormat";
import { NotificationResponse } from "@/types/notifications";

const mockT = ((key: string, vars?: any) => {
  if (key === "notifications.chat.new_message") {
    return `New message from ${vars?.sender_name || ""}`;
  }
  if (key === "notifications.chat.sent_attachment") {
    return "Sent an attachment";
  }
  if (key === "notifications.chat.voice_note") {
    return "[Voice Note]";
  }
  if (key === "settings-devices.notifications.newDevice.title") {
    return "New Device Detected";
  }
  if (key === "settings-devices.notifications.newDevice.body") {
    return `New device (${vars?.device || ""}) accessed your account`;
  }
  if (key === "notifications.categories.MESSAGING") {
    return "Messages";
  }
  if (key === "notifications.categories.SECURITY") {
    return "Security";
  }
  return key;
}) as any;

mockT.isolate = (text: string) => `\u2066${text}\u2069`;

describe("formatNotificationContent", () => {
  it("formats new message notification with key", () => {
    const notif: NotificationResponse = {
      id: 1,
      user_id: 1,
      type: "NEW_MESSAGE",
      title: "notifications.chat.new_message",
      body: "notifications.chat.voice_note",
      category: "MESSAGING",
      priority: "NORMAL",
      data: { sender_name: "Mohamed Redha" },
      is_read: false,
      created_at: new Date().toISOString(),
      email_sent: false,
    };

    const result = formatNotificationContent(notif, mockT);
    expect(result.title).toContain("Mohamed Redha");
    expect(result.body).toBe("[Voice Note]");
    expect(result.categoryLabel).toBe("Messages");
  });

  it("handles legacy string pattern 'New message from ...'", () => {
    const notif: NotificationResponse = {
      id: 2,
      user_id: 1,
      type: "NEW_MESSAGE",
      title: "New message from Mohamed Redha HABIB",
      body: "Sent an attachment",
      category: "SYSTEM",
      priority: "NORMAL",
      data: {},
      is_read: false,
      created_at: new Date().toISOString(),
      email_sent: false,
    };

    const result = formatNotificationContent(notif, mockT);
    expect(result.title).toContain("Mohamed Redha HABIB");
    expect(result.body).toBe("Sent an attachment");
    expect(result.categoryLabel).toBe("Messages");
  });

  it("formats device login notification", () => {
    const notif: NotificationResponse = {
      id: 3,
      user_id: 1,
      type: "security_alert",
      title: "settings-devices.notifications.newDevice.title",
      body: "settings-devices.notifications.newDevice.body",
      category: "SECURITY",
      priority: "URGENT",
      data: { device: "Chrome" },
      is_read: false,
      created_at: new Date().toISOString(),
      email_sent: true,
    };

    const result = formatNotificationContent(notif, mockT);
    expect(result.title).toBe("New Device Detected");
    expect(result.body).toContain("Chrome");
    expect(result.categoryLabel).toBe("Security");
  });
});
