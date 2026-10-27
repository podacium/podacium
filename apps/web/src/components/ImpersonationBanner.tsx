"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

interface ImpersonationActor {
  id: number;
  email: string;
  role: string;
  reason: string;
  impersonation_session_id?: string;
}

interface JwtPayload {
  sub: string | number;
  role?: string;
  actor?: ImpersonationActor;
  exp?: number;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function ImpersonationBanner() {
  const { t } = useTranslations();
  const router = useRouter();
  const [impersonationData, setImpersonationData] = useState<{
    userId: string | number;
    userName: string;
    actor: ImpersonationActor;
    exp: number;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("15:00");

  useEffect(() => {
    // Check access_token from localStorage or cookie or session
    const checkToken = () => {
      let rawToken: string | null = null;
      if (typeof window !== "undefined") {
        rawToken =
          localStorage.getItem("access_token") ||
          sessionStorage.getItem("access_token") ||
          getCookie("access_token") ||
          getCookie("__Host-access_token");
      }

      if (!rawToken) {
        setImpersonationData(null);
        return;
      }

      const payload = parseJwt(rawToken);
      if (payload && payload.actor && payload.exp) {
        // Also get user full name from storage if available
        let userName = `User #${payload.sub}`;
        try {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const u = JSON.parse(storedUser);
            if (u.fullName || u.email) {
              userName = u.fullName || u.email;
            }
          }
        } catch {}

        setImpersonationData({
          userId: payload.sub,
          userName,
          actor: payload.actor,
          exp: payload.exp,
        });
      } else {
        setImpersonationData(null);
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 3000);
    return () => clearInterval(interval);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!impersonationData) return;

    const updateTimer = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remainingSeconds = Math.max(0, impersonationData.exp - nowSeconds);

      if (remainingSeconds <= 0) {
        setTimeRemaining("00:00 (Expired)");
        return;
      }

      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      setTimeRemaining(
        `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      );
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [impersonationData]);

  const exitImpersonation = () => {
    // Clear impersonation session
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      document.cookie =
        "access_token=; path=/; max-age=0; SameSite=Lax; Secure";
      document.cookie =
        "__Host-access_token=; path=/; max-age=0; SameSite=Lax; Secure";

      // Restore original admin token if backed up
      const backupAdminToken = localStorage.getItem("admin_backup_token");
      if (backupAdminToken) {
        localStorage.setItem("access_token", backupAdminToken);
        localStorage.removeItem("admin_backup_token");
      }
    }
    setImpersonationData(null);
    router.push("/admin/users");
  };

  if (!impersonationData) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-black px-4 py-2 font-mono text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="w-4 h-4 text-black animate-pulse shrink-0" />
        <span>
          <strong>{t("admin.impersonation.active")}</strong>{" "}
          {impersonationData.userName} ( #{impersonationData.userId})
        </span>
        <span className="opacity-75">
          | {t("admin.impersonation.actor")} {impersonationData.actor.email}
        </span>
        <span className="bg-black/20 px-2 py-0.5 rounded font-sans font-semibold">
          {t("admin.impersonation.mutationsBlocked")}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="tabular-nums">
          ⏱️ {timeRemaining} {t("admin.impersonation.remaining")}
        </span>
        <button
          onClick={exitImpersonation}
          className="bg-black text-white px-3 py-1 rounded text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          {t("admin.impersonation.exit")}
        </button>
      </div>
    </div>
  );
}
