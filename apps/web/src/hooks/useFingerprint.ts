/**
 * FingerprintJS integration hook.
 *
 * Uses a module-level singleton so the agent is initialized once regardless
 * of how many components mount. The visitorId is cached after first generation.
 */

import { persistFingerprintCookie } from "@/lib/device-fingerprint";

let _fpPromise: Promise<any> | null = null;
let _visitorId: string | null = null;
const STORAGE_KEY = "podacium_device_id";

async function getAgent(): Promise<any> {
  if (!_fpPromise) {
    const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
    _fpPromise = FingerprintJS.default.load({ monitoring: false } as any);
  }
  return _fpPromise;
}

export async function getVisitorId(): Promise<string | null> {
  // Publish on every resolution so the Edge sees the device binding before
  // the first navigation (Providers warms this at app boot).
  if (_visitorId) {
    persistFingerprintCookie(_visitorId);
    return _visitorId;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        _visitorId = stored;
        persistFingerprintCookie(_visitorId);
        return _visitorId;
      }
    } catch {}
  }

  try {
    const agent = await getAgent();
    const result = await agent.get();
    if (result?.visitorId) {
      _visitorId = result.visitorId as string;
    }
  } catch {
    // Fallback if FingerprintJS fails or is blocked
  }

  if (!_visitorId && typeof window !== "undefined") {
    try {
      _visitorId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
    } catch {
      _visitorId = Math.random().toString(36).substring(2);
    }
  }

  if (_visitorId && typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, _visitorId);
    } catch {}
  }

  if (_visitorId) persistFingerprintCookie(_visitorId);

  return _visitorId;
}

export function useFingerprint(): {
  getVisitorId: () => Promise<string | null>;
} {
  getVisitorId().catch(() => {});
  return { getVisitorId };
}

export default useFingerprint;
