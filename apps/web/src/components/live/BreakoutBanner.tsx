"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, MessageSquare, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import type { BreakoutSessionState } from "./BreakoutRoomsModal";

interface Props {
  sessionState: BreakoutSessionState | null;
  onOpenModal?: () => void;
  onDismissAnnouncement?: () => void;
}

export function BreakoutBanner({
  sessionState,
  onOpenModal,
  onDismissAnnouncement,
}: Props) {
  const t = useTranslations("live");
  const [remaining, setRemaining] = useState<string>("00:00");

  useEffect(() => {
    if (!sessionState?.isActive || !sessionState.endsAt) return;

    const interval = setInterval(() => {
      const diff = Math.max(
        0,
        Math.floor((sessionState.endsAt - Date.now()) / 1000),
      );
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setRemaining(
        `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState]);

  if (!sessionState?.isActive) return null;

  return (
    <div
      data-testid="breakout-banner"
      className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-slate-900/90 border-b border-purple-500/30 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30 shadow-md backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-purple-200">
          <Users className="h-4 w-4 text-purple-400" />
          <span>
            {t("room.breakout.sessionActive", {
              count: sessionState.roomsCount,
            })}
          </span>
        </span>

        <span className="flex items-center gap-1 font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/30">
          <Clock className="h-3 w-3" />
          <span>{remaining}</span>
        </span>
      </div>

      {sessionState.latestBroadcast && (
        <div className="flex items-center gap-2 bg-purple-500/20 border border-purple-400/30 px-3 py-1 rounded-lg text-purple-100 max-w-md truncate">
          <MessageSquare className="h-3.5 w-3.5 text-amber-300 shrink-0" />
          <span className="font-semibold text-amber-300 shrink-0">
            {t("room.breakout.hostPrefix")}
          </span>
          <span className="truncate">{sessionState.latestBroadcast}</span>
          {onDismissAnnouncement && (
            <button
              onClick={onDismissAnnouncement}
              className="p-0.5 hover:text-white text-purple-300 shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {onOpenModal && (
        <button
          onClick={onOpenModal}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-slate-200 font-medium text-[11px]"
        >
          {t("room.breakout.manage")}
        </button>
      )}
    </div>
  );
}
