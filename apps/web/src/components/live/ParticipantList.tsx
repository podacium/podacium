"use client";

import React, { useState } from "react";
import {
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import {
  Mic,
  MicOff,
  Search,
  Hand,
  Crown,
  Star,
  VolumeX,
  ShieldCheck,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useHandRaise } from "./HandRaiseContext";
interface Props {
  isHost?: boolean;
  coHostIdentities?: Set<string>;
  onToggleCoHost?: (identity: string, isCoHost: boolean) => void;
}

export function ParticipantList({
  isHost = false,
  coHostIdentities,
  onToggleCoHost,
}: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { isHandRaised } = useHandRaise();
  const [search, setSearch] = useState("");

  const filtered = participants.filter((p) => {
    const name = p.name || p.identity;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handsRaisedList = filtered.filter((p) => isHandRaised(p.identity));
  const normalList = filtered.filter((p) => !isHandRaised(p.identity));

  const handleMuteRemote = async (identity: string) => {
    if (!room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "mute_participant",
          targetIdentity: identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.error("Mute participant error:", err);
    }
  };

  const handleToggleCoHost = async (identity: string) => {
    if (!room || !isHost) return;
    const isCurrentlyCoHost = !!coHostIdentities?.has(identity);
    const nextState = !isCurrentlyCoHost;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "toggle_cohost",
          targetIdentity: identity,
          isCoHost: nextState,
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
      onToggleCoHost?.(identity, nextState);
    } catch (err) {
      console.error("Toggle co-host error:", err);
    }
  };

  const renderParticipantRow = (p: Participant) => {
    const handRaised = isHandRaised(p.identity);
    const isMe = p.identity === localParticipant?.identity;
    const isCoHostUser = !!coHostIdentities?.has(p.identity);

    return (
      <div
        key={p.identity}
        className="px-3 py-2 flex items-center justify-between hover:bg-slate-900/80 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center relative shrink-0">
            <span className="text-xs font-bold text-white">
              {(p.name || p.identity)[0]?.toUpperCase() || "?"}
            </span>
            {handRaised && (
              <span className="absolute -top-1 -end-1 text-xs">✋</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {p.name || p.identity}
              </span>
              {isMe && (
                <span className="text-[10px] text-purple-400 font-medium">
                  ({t("common.you")})
                </span>
              )}
              {isCoHostUser && (
                <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-medium">
                  {t("room.coHost")}
                </span>
              )}
            </div>
            {handRaised && (
              <span className="text-[10px] text-amber-400 font-medium block">
                {t("room.handRaise.raisedHands")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* 1-Click Promote / Demote Co-Host for Host */}
          {isHost && !isMe && (
            <button
              onClick={() => handleToggleCoHost(p.identity)}
              className={`p-1 rounded-md transition-colors ${
                isCoHostUser
                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/15"
                  : "text-slate-400 hover:text-purple-400 hover:bg-purple-500/15"
              }`}
              title={
                isCoHostUser
                  ? t("room.hostControls.demoteCoHost")
                  : t("room.hostControls.promoteCoHost")
              }
              aria-label={
                isCoHostUser
                  ? t("room.hostControls.demoteCoHost")
                  : t("room.hostControls.promoteCoHost")
              }
              data-testid={`toggle-cohost-${p.identity}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}

          {isHost && !isMe && p.isMicrophoneEnabled && (
            <button
              onClick={() => handleMuteRemote(p.identity)}
              className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title={t("room.hostControls.mute")}
            >
              <VolumeX className="h-3.5 w-3.5" />
            </button>
          )}

          {p.isMicrophoneEnabled ? (
            <span className="p-1 text-emerald-400">
              <Mic className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="p-1 text-red-400">
              <MicOff className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Search Header */}
      <div className="p-3 border-b border-white/10 bg-slate-900/60 shrink-0">
        <div className="relative">
          <Search
            className={`absolute top-2.5 ${dir === "rtl" ? "right-2.5" : "left-2.5"} h-3.5 w-3.5 text-slate-400`}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("room.searchParticipants")}
            className={`w-full text-xs bg-slate-900 border border-white/15 rounded-xl py-1.5 ${dir === "rtl" ? "pe-8 ps-3" : "ps-8 pe-3"} text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500`}
          />
        </div>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {handsRaisedList.length > 0 && (
          <div>
            <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <Hand className="h-3 w-3" />
              <span>
                {t("room.handRaise.raisedHands")} ({handsRaisedList.length})
              </span>
            </div>
            <div className="space-y-0.5 mt-1 bg-amber-500/10 rounded-xl p-1 border border-amber-500/20">
              {handsRaisedList.map(renderParticipantRow)}
            </div>
          </div>
        )}

        <div>
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("room.sidebar.participants")} ({participants.length})
          </div>
          <div className="space-y-0.5 mt-1">
            {normalList.length === 0 && handsRaisedList.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                {t("room.noParticipantsFound")}
              </div>
            )}
            {normalList.map(renderParticipantRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
