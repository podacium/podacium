"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WakeLockSentinelLike extends EventTarget {
  released: boolean;
  type: "screen";
  release: () => Promise<void>;
  onrelease: ((this: WakeLockSentinelLike, ev: Event) => any) | null;
}

export interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<boolean>;
  release: () => Promise<void>;
}

/**
 * React hook to manage Screen Wake Lock API.
 * Prevents mobile screens from dimming or locking during active live video/audio sessions.
 * Automatically re-acquires the lock on document visibility restoration (e.g. app switching).
 */
export function useWakeLock(autoAcquire = false): UseWakeLockReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const shouldLockRef = useRef(autoAcquire);

  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      "wakeLock" in navigator &&
      typeof (navigator as any).wakeLock?.request === "function";
    setIsSupported(supported);
  }, []);

  const release = useCallback(async () => {
    shouldLockRef.current = false;
    if (sentinelRef.current && !sentinelRef.current.released) {
      try {
        await sentinelRef.current.release();
      } catch (err) {
        console.warn("[WakeLock] Error releasing lock:", err);
      } finally {
        sentinelRef.current = null;
        setIsActive(false);
      }
    } else {
      setIsActive(false);
    }
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    shouldLockRef.current = true;
    if (
      typeof navigator === "undefined" ||
      !("wakeLock" in navigator) ||
      typeof (navigator as any).wakeLock?.request !== "function"
    ) {
      return false;
    }

    // If already active and not released, return true
    if (sentinelRef.current && !sentinelRef.current.released) {
      setIsActive(true);
      return true;
    }

    try {
      const sentinel: WakeLockSentinelLike = await (
        navigator as any
      ).wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener("release", () => {
        setIsActive(false);
        sentinelRef.current = null;
      });

      return true;
    } catch (err) {
      // Common causes: battery saver mode, tab not active, system policy
      console.warn("[WakeLock] Request failed:", err);
      setIsActive(false);
      return false;
    }
  }, []);

  // Handle visibility changes: OS automatically releases wake locks on tab hide.
  // Re-acquire lock when user returns to active tab.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldLockRef.current) {
        request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [request]);

  // Auto-acquire lock if enabled
  useEffect(() => {
    if (autoAcquire) {
      request();
    }
    return () => {
      release();
    };
  }, [autoAcquire, request, release]);

  return {
    isSupported,
    isActive,
    request,
    release,
  };
}
