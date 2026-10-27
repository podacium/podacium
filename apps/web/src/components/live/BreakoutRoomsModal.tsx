"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, Send, AlertTriangle, X, Radio } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface BreakoutSessionState {
  isActive: boolean;
  roomsCount: number;
  durationMinutes: number;
  endsAt: number;
  latestBroadcast?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  activeSession: BreakoutSessionState | null;
  onStartBreakout: (roomsCount: number, durationMinutes: number) => void;
  onEndBreakout: () => void;
  onBroadcastMessage: (message: string) => void;
}

export function BreakoutRoomsModal({
  open,
  onClose,
  isHost,
  activeSession,
  onStartBreakout,
  onEndBreakout,
  onBroadcastMessage,
}: Props) {
  const t = useTranslations("live");
  const [roomsCount, setRoomsCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [remainingSecs, setRemainingSecs] = useState<number>(0);

  useEffect(() => {
    if (!activeSession?.isActive || !activeSession.endsAt) {
      setRemainingSecs(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(
        0,
        Math.floor((activeSession.endsAt - Date.now()) / 1000),
      );
      setRemainingSecs(diff);
      if (diff === 0 && isHost) {
        onEndBreakout();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, isHost, onEndBreakout]);

  if (!open) return null;

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    onBroadcastMessage(broadcastMsg.trim());
    setBroadcastMsg("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="breakout-modal-backdrop"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden text-white p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakout-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 id="breakout-title" className="text-sm font-bold text-white">
                {t("room.breakout.title")}
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeSession?.isActive
                  ? t("room.breakout.activeHint")
                  : t("room.breakout.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {activeSession?.isActive ? (
          <div className="py-4 space-y-4">
            {/* Active Status & Timer */}
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {activeSession.roomsCount} {t("room.breakout.roomsActive")}
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-white tracking-wider my-1">
                {formatRemaining(remainingSecs)}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                {t("room.breakout.timeRemaining")}
              </p>
            </div>

            {/* Broadcast message input */}
            {isHost && (
              <form onSubmit={handleSendBroadcast} className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  {t("room.breakout.broadcastTitle")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder={t("room.breakout.broadcastPlaceholder")}
                    className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!broadcastMsg.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{t("common.send")}</span>
                  </button>
                </div>
              </form>
            )}

            {/* End session early button */}
            {isHost && (
              <button
                onClick={onEndBreakout}
                className="w-full py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{t("room.breakout.endNow")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Rooms Count Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                {t("room.breakout.numberRooms")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRoomsCount(n)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      roomsCount === n
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {n} {t("room.breakout.rooms")}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                {t("room.breakout.duration")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMinutes(m)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      durationMinutes === m
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "bg-slate-950 border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            {/* Launch button */}
            {isHost ? (
              <button
                onClick={() => onStartBreakout(roomsCount, durationMinutes)}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-purple-900/40"
              >
                <Radio className="h-4 w-4" />
                <span>{t("room.breakout.startRooms")}</span>
              </button>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">
                {t("room.breakout.waitingHost")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
