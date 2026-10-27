"use client";

import { useState, useEffect, useCallback } from "react";
import { notificationsApi } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const t = useTranslations("common");
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);

      // Check current subscription status
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError(t("notifications.pushNotSupported"));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError(t("notifications.pushPermissionDenied"));
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHB4MmWAhw2ckEZo";

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as unknown as BufferSource,
      });

      // Send subscription to backend
      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
        await notificationsApi.registerPushSubscription({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          user_agent: navigator.userAgent,
        });
      }

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to subscribe to push notifications");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJson = subscription.toJSON();
        if (subJson.endpoint) {
          await notificationsApi.unregisterPushSubscription(subJson.endpoint);
        }
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to unsubscribe");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
