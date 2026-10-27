"use client";

/**
 * Live Chat Widget — Crisp Integration.
 *
 * Loads the Crisp live chat widget for customer support with:
 * - Ad-blocker & network failure resilience
 * - Automatic locale (en/fr/ar/kab) & RTL synchronization
 * - Real-time authenticated user metadata synchronization
 * - Route change visibility management
 *
 * Configuration:
 *   Set NEXT_PUBLIC_CRISP_WEBSITE_ID in environment variables.
 *   Configure Crisp webhook at: https://app.crisp.chat → Settings → Webhooks
 *   Webhook URL: https://backend-api.podacium.com/api/v1/webhooks/crisp
 *
 * @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
    __crisp_status?: "loading" | "loaded" | "blocked" | "disabled";
  }
}

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID || "";

export default function LiveChat() {
  const pathname = usePathname();
  const locale = useLocale();
  const { isRTL } = useBidi();
  const { user, isAuthenticated } = useAuth();

  const isLiveRoom =
    pathname?.includes("/room") || pathname?.startsWith("/live/");

  useEffect(() => {
    // Skip if no Crisp ID configured or on server
    if (typeof window === "undefined") return;

    if (!CRISP_WEBSITE_ID) {
      window.__crisp_status = "disabled";
      return;
    }

    if (window.$crisp && window.__crisp_status === "loaded") return;

    window.__crisp_status = "loading";

    // Initialize Crisp queue
    window.$crisp = window.$crisp || [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;

    // Timeout detection for ad-blockers (e.g. uBlock Origin / Brave Shields)
    const timeoutId = window.setTimeout(() => {
      if (
        window.__crisp_status === "loading" &&
        (!window.$crisp || window.$crisp.length === 0)
      ) {
        window.__crisp_status = "blocked";
        window.dispatchEvent(
          new CustomEvent("crisp:status", { detail: { status: "blocked" } }),
        );
      }
    }, 4000);

    script.onload = () => {
      window.clearTimeout(timeoutId);
      window.__crisp_status = "loaded";
      window.$crisp.push(["config", "color:theme", ["blue"]]);
      window.$crisp.push(["do", "chat:hide"]);
      window.dispatchEvent(
        new CustomEvent("crisp:status", { detail: { status: "loaded" } }),
      );
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      window.__crisp_status = "blocked";
      window.dispatchEvent(
        new CustomEvent("crisp:status", { detail: { status: "blocked" } }),
      );
    };

    document.head.appendChild(script);

    return () => {
      window.clearTimeout(timeoutId);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [isLiveRoom]);

  // Keep widget hidden during distraction-free rooms or route changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.$crisp) return;
    try {
      window.$crisp.push(["do", "chat:hide"]);
    } catch {
      // ignore
    }
  }, [pathname, isLiveRoom]);

  // Sync locale & RTL direction to Crisp
  useEffect(() => {
    if (typeof window === "undefined" || !window.$crisp) return;
    try {
      const crispLocale =
        locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en";
      window.$crisp.push(["config", "container:locale", [crispLocale]]);
      window.$crisp.push([
        "set",
        "session:data",
        [
          [
            ["locale", locale],
            ["direction", isRTL ? "rtl" : "ltr"],
          ],
        ],
      ]);
    } catch {
      // ignore
    }
  }, [locale, isRTL]);

  // Sync user profile & authentication status globally
  useEffect(() => {
    if (typeof window === "undefined" || !window.$crisp) return;
    try {
      if (isAuthenticated && user) {
        window.$crisp.push(["set", "user:email", [user.email]]);
        window.$crisp.push([
          "set",
          "user:nickname",
          [user.fullName || user.email],
        ]);
        window.$crisp.push([
          "set",
          "session:data",
          [
            [
              ["user_id", String(user.id)],
              ["user_role", user.role || "STUDENT"],
              ["current_page", pathname || window.location.pathname],
            ],
          ],
        ]);
      }
    } catch {
      // ignore
    }
  }, [user, isAuthenticated, pathname]);

  // Render nothing — Crisp injects its own UI
  return null;
}
