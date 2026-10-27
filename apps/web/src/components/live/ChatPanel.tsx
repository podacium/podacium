"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useChat,
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { Send, Lock, Globe, User } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import { playChatPing } from "@/lib/audioChimes";

interface Props {
  className?: string;
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ className = "" }: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const { chatMessages, send, isSending } = useChat();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [input, setInput] = useState("");
  const [targetRecipient, setTargetRecipient] = useState<string>("everyone");
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(chatMessages.length);

  // Auto-scroll and sound chime on new message
  useEffect(() => {
    if (chatMessages.length > prevCountRef.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && lastMsg.from?.identity !== localParticipant?.identity) {
        playChatPing();
      }
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
    prevCountRef.current = chatMessages.length;
  }, [chatMessages, localParticipant]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    // If a private target recipient is chosen, send strictly to that destination identity via SFU
    let payload = input.trim();
    if (targetRecipient !== "everyone") {
      payload = `[DM:${targetRecipient}] ${payload}`;
      await send(payload, { destinationIdentities: [targetRecipient] });
    } else {
      await send(payload);
    }

    setInput("");
  };

  const otherParticipants = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  );

  return (
    <div
      className={`flex flex-col h-full bg-slate-950 text-slate-100 ${className}`}
    >
      {/* Recipient Target Selector */}
      <div className="px-3 py-2 border-b border-white/10 bg-slate-900/60 flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-400 font-medium">
          {t("room.chat.sendTo")}
        </span>
        <div className="relative flex-1">
          <select
            value={targetRecipient}
            onChange={(e) => setTargetRecipient(e.target.value)}
            className="w-full text-xs font-medium bg-slate-900 border border-white/15 rounded-lg py-1 px-2 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
          >
            <option value="everyone" className="bg-slate-900 text-slate-200">
              🌐 {t("room.chat.everyone")}
            </option>
            {otherParticipants.map((p) => (
              <option
                key={p.identity}
                value={p.identity}
                className="bg-slate-900 text-slate-200"
              >
                🔒 {p.name || p.identity}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages List */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-12">
            <p>{t("room.chat.empty")}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t("room.chat.emptyHint")}
            </p>
          </div>
        )}

        {chatMessages.map((msg) => {
          const isDm = msg.message.startsWith("[DM:");
          let displayMsg = msg.message;
          let dmTarget = "";

          if (isDm) {
            const endIdx = msg.message.indexOf("]");
            if (endIdx > 4) {
              dmTarget = msg.message.slice(4, endIdx);
              displayMsg = msg.message.slice(endIdx + 1).trim();
            }
          }

          const isSender = msg.from?.identity === localParticipant?.identity;
          const isRecipient = dmTarget === localParticipant?.identity;

          // If DM, only show to sender and recipient
          if (isDm && !isSender && !isRecipient) {
            return null;
          }

          return (
            <div
              key={msg.id}
              className={`rounded-xl p-2.5 transition-colors ${
                isDm
                  ? "bg-purple-950/40 border border-purple-500/40 text-purple-200"
                  : isSender
                    ? "bg-purple-950/30 border border-purple-800/40 text-purple-100"
                    : "bg-slate-900/90 border border-white/10 text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-white text-xs truncate">
                    {msg.from?.name || msg.from?.identity || t("common.you")}
                  </span>
                  {isDm && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-medium">
                      <Lock className="h-2.5 w-2.5" />
                      {isSender
                        ? t("room.chat.privateTo", { name: dmTarget })
                        : t("room.chat.private")}
                    </span>
                  )}
                </div>
                {msg.timestamp && (
                  <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {formatTime(msg.timestamp)}
                  </span>
                )}
              </div>
              <p className="text-slate-300 mt-1 text-xs break-words leading-relaxed">
                {displayMsg}
              </p>
            </div>
          );
        })}
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-white/10 shrink-0 bg-slate-950"
      >
        <div className="flex gap-2" dir={dir}>
          <PodaciumInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              targetRecipient === "everyone"
                ? t("room.chat.inputPlaceholder")
                : `${t("room.chat.whisperTo")} ${otherParticipants.find((p) => p.identity === targetRecipient)?.name || targetRecipient}...`
            }
            inputSize="sm"
            className="flex-1 bg-slate-900 border-white/15 text-white placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-all active:scale-95 shadow-sm"
            aria-label={t("room.chat.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
