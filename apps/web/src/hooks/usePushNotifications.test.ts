import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePushNotifications } from "./usePushNotifications";
import { notificationsApi } from "@/lib/api";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock notificationsApi
vi.mock("@/lib/api", () => ({
  notificationsApi: {
    registerPushSubscription: vi.fn().mockResolvedValue({ success: true }),
    unregisterPushSubscription: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("usePushNotifications", () => {
  let mockSubscription: any;
  let mockPushManager: any;
  let mockRegistration: any;

  beforeEach(() => {
    mockSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      toJSON: vi.fn(() => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        keys: {
          p256dh: "mock-p256dh-key",
          auth: "mock-auth-secret",
        },
      })),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };

    mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(mockSubscription),
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    };

    mockRegistration = {
      pushManager: mockPushManager,
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve(mockRegistration),
      },
      writable: true,
      configurable: true,
    });

    (window as any).PushManager = function () {};
    (window as any).Notification = {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("detects push notification support and initial subscription status", async () => {
    const { result } = renderHook(() => usePushNotifications());
    expect(result.current.isSupported).toBe(true);

    // Wait for async getSubscription in useEffect
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isSubscribed).toBe(true);
  });

  it("successfully subscribes and registers with backend", async () => {
    mockPushManager.getSubscription.mockResolvedValueOnce(null);
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await Promise.resolve();
    });

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(true);
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(mockPushManager.subscribe).toHaveBeenCalled();
    expect(notificationsApi.registerPushSubscription).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      p256dh: "mock-p256dh-key",
      auth: "mock-auth-secret",
      user_agent: navigator.userAgent,
    });
    expect(result.current.isSubscribed).toBe(true);
  });

  it("handles denied permission gracefully", async () => {
    mockPushManager.getSubscription.mockResolvedValue(null);
    (window.Notification.requestPermission as any).mockResolvedValueOnce(
      "denied",
    );
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await Promise.resolve();
    });

    let success = true;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("notifications.pushPermissionDenied");
    expect(result.current.isSubscribed).toBe(false);
  });

  it("successfully unsubscribes", async () => {
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await Promise.resolve();
    });

    let success = false;
    await act(async () => {
      success = await result.current.unsubscribe();
    });

    expect(success).toBe(true);
    expect(notificationsApi.unregisterPushSubscription).toHaveBeenCalledWith(
      "https://fcm.googleapis.com/fcm/send/test-endpoint",
    );
    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);
  });
});
