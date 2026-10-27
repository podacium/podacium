import { describe, it, expect } from "vitest";
import {
  buildPushNotificationOptions,
  type LivePushNotificationPayload,
} from "./service-worker";

describe("service-worker push notification builder", () => {
  it("builds standard push notification options", () => {
    const payload: LivePushNotificationPayload = {
      title: "New Message",
      body: "You received a message from Client",
      url: "/dashboard/messages",
    };

    const options = buildPushNotificationOptions(payload);
    expect(options.body).toBe("You received a message from Client");
    expect(options.actions).toBeUndefined();
    expect(options.data.isLiveSession).toBe(false);
  });

  it("builds live session reminder notification with interactive actions and vibration", () => {
    const payload: LivePushNotificationPayload = {
      title: "Session Starting Now",
      body: "Your Masterclass with Sarah is starting now.",
      action_url: "/live/sess-123/room",
      type: "session_reminder",
      sessionId: "sess-123",
    };

    const options = buildPushNotificationOptions(payload);
    expect(options.data.isLiveSession).toBe(true);
    expect(options.actions).toBeDefined();
    expect(options.actions).toEqual([
      { action: "join", title: "Join Session" },
      { action: "dismiss", title: "Dismiss" },
    ]);
    expect(options.vibrate).toEqual([200, 100, 200, 100, 300]);
    expect(options.tag).toBe("live-session-sess-123");
  });
});
