"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useDataChannel } from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import { useTranslations } from "@/lib/i18n";
import { SmilePlus } from "lucide-react";

const EMOJIS = ["👍", "❤️", "😊", "🎉", "✋", "🔥", "😮", "👏"];

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  driftDir: number;
  createdAt: number;
}

interface Props {
  className?: string;
}

export function EmojiReactions({ className = "" }: Props) {
  const t = useTranslations("live");
  const { localParticipant } = useLocalParticipant();
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const localIdentity = localParticipant?.identity || "";

  const { send: sendReaction } = useDataChannel(
    "emoji",
    useCallback((msg: ReceivedDataMessage) => {
      try {
        const raw = new TextDecoder().decode(msg.payload);
        const data = JSON.parse(raw);
        if (data.action === "react" && data.emoji) {
          const container = containerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          setFloating((prev) => [
            ...prev.slice(-20),
            {
              id: `emoji_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              emoji: data.emoji,
              x: Math.random() * (rect.width - 40),
              driftDir: Math.random() > 0.5 ? 1 : -1,
              createdAt: Date.now(),
            },
          ]);
        }
      } catch (err) {
        console.error("Malformed emoji DataChannel message", err);
      }
    }, []),
  );

  useEffect(() => {
    if (floating.length === 0) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 2500;
      setFloating((prev) => prev.filter((e) => e.createdAt > cutoff));
    }, 100);
    return () => clearTimeout(timer);
  }, [floating]);

  const sendEmoji = async (emoji: string) => {
    await sendReaction(
      new TextEncoder().encode(
        JSON.stringify({
          action: "react",
          emoji,
          senderIdentity: localIdentity,
        }),
      ),
      { reliable: true },
    );
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setFloating((prev) => [
        ...prev.slice(-20),
        {
          id: `emoji_self_${Date.now()}`,
          emoji,
          x: Math.random() * (rect.width - 40),
          driftDir: Math.random() > 0.5 ? 1 : -1,
          createdAt: Date.now(),
        },
      ]);
    }
    setShowPicker(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floating.map((e) => (
          <span
            key={e.id}
            className="absolute bottom-0 text-xl will-change-transform"
            style={
              {
                left: e.x,
                "--drift-dir": e.driftDir,
                animation:
                  "emoji-float 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards",
              } as React.CSSProperties
            }
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="min-w-[48px] min-h-[48px] p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white flex items-center justify-center transition-all active:scale-95"
          title={t("room.emojiReactions.title")}
          aria-label={t("room.emojiReactions.title")}
        >
          <SmilePlus className="h-5 w-5" />
        </button>

        {showPicker && (
          <div className="absolute bottom-full inset-x-0 mx-auto w-fit mb-3 bg-slate-900/98 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-2xl">
            <div className="flex gap-1.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  className="min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-white/10 active:bg-white/20 rounded-xl transition-all active:scale-110 text-2xl"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
