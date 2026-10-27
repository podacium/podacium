"use client";

import React, { useState, useCallback } from "react";
import {
  useLocalParticipant,
  useRemoteParticipants,
  useDataChannel,
} from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import { Hand, HandMetal, ChevronDown } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useHandRaise } from "./HandRaiseContext";

interface Props {
  isHost: boolean;
  className?: string;
}

export function HandRaise({ isHost, className = "" }: Props) {
  const t = useTranslations("live");
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [handRaised, setHandRaised] = useState(false);
  const [showRaisedList, setShowRaisedList] = useState(false);
  const localIdentity = localParticipant?.identity || "";

  const { raisedHands, raiseHand, lowerHand, lowerAllHands } = useHandRaise();

  const { send } = useDataChannel(
    "handraise",
    useCallback(
      (msg: ReceivedDataMessage) => {
        try {
          const raw = new TextDecoder().decode(msg.payload);
          const data = JSON.parse(raw);
          if (data.action === "raise") {
            raiseHand(data.senderIdentity);
          } else if (data.action === "lower") {
            lowerHand(data.senderIdentity);
          } else if (data.action === "lower_all") {
            lowerAllHands();
            setHandRaised(false);
          }
        } catch (err) {
          console.error("Malformed handraise DataChannel message", err);
        }
      },
      [raiseHand, lowerHand, lowerAllHands],
    ),
  );

  const toggleHand = async () => {
    const next = !handRaised;
    setHandRaised(next);
    if (next) {
      raiseHand(localIdentity);
    } else {
      lowerHand(localIdentity);
    }
    await send(
      new TextEncoder().encode(
        JSON.stringify({
          action: next ? "raise" : "lower",
          senderIdentity: localIdentity,
          senderName: localParticipant?.name || localIdentity,
        }),
      ),
      { reliable: true },
    );
  };

  const handleLowerAll = async () => {
    await send(
      new TextEncoder().encode(
        JSON.stringify({ action: "lower_all", senderIdentity: localIdentity }),
      ),
      { reliable: true },
    );
    lowerAllHands();
    setHandRaised(false);
  };

  const raisedCount = raisedHands.size;
  const raisedNames = remoteParticipants
    .filter((p) => raisedHands.has(p.identity))
    .map((p) => p.name || p.identity);

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleHand}
          className={`min-w-[48px] min-h-[48px] p-3 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
            handRaised
              ? "bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-400/20 ring-2 ring-amber-300"
              : "bg-white/5 hover:bg-white/10 active:bg-white/15 text-white"
          }`}
          title={
            handRaised ? t("room.handRaise.lower") : t("room.handRaise.raise")
          }
          aria-label={
            handRaised ? t("room.handRaise.lower") : t("room.handRaise.raise")
          }
        >
          {handRaised ? (
            <HandMetal className="h-5 w-5" />
          ) : (
            <Hand className="h-5 w-5" />
          )}
        </button>

        {isHost && raisedCount > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRaisedList(!showRaisedList)}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center gap-1 px-3 py-2 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold transition-all active:scale-95"
              aria-label={t("room.handRaise.raisedHands")}
            >
              <span>{raisedCount}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showRaisedList && (
              <div className="absolute bottom-full end-0 mb-3 bg-slate-900/98 border border-white/15 rounded-2xl shadow-2xl p-3 z-50 min-w-[220px] backdrop-blur-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-300">
                    {t("room.handRaise.raisedHands")}
                  </span>
                </div>
                <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                  {raisedNames.map((name) => (
                    <div
                      key={name}
                      className="text-xs text-gray-200 flex items-center gap-2 p-1.5 rounded-lg bg-white/5"
                    >
                      <Hand className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleLowerAll}
                  className="w-full min-h-[48px] flex items-center justify-center text-xs text-center text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 font-semibold rounded-xl transition-all active:scale-95"
                >
                  {t("room.handRaise.lowerAll")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isHost && raisedCount > 0 && (
        <div
          className="absolute -top-14 inset-x-0 mx-auto w-fit z-40 bg-amber-400 text-slate-950 rounded-full px-4 py-2 shadow-lg cursor-pointer hover:bg-amber-300 active:scale-95 transition-all whitespace-nowrap"
          onClick={handleLowerAll}
        >
          <span className="text-xs font-bold flex items-center gap-1.5">
            <Hand className="h-4 w-4" />
            {t("handRaise.raised", { count: String(raisedCount) })}
          </span>
        </div>
      )}
    </div>
  );
}
