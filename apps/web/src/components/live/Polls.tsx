"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLocalParticipant, useDataChannel } from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Plus,
  X,
  Check,
  Clock,
  Radio,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import { playHandRaiseChime } from "@/lib/audioChimes";

interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<number, number>;
  votedBy: Record<string, number>; // voterIdentity -> selectedOptionIndex
  createdBy: string;
  isActive: boolean;
  timestamp: number;
}

interface Props {
  isHost: boolean;
  className?: string;
}

export function Polls({ isHost, className = "" }: Props) {
  const t = useTranslations("live");
  const tCommon = useTranslations("common");
  const { localParticipant } = useLocalParticipant();

  const localIdentity = localParticipant?.identity || "";
  const [polls, setPolls] = useState<Poll[]>([]);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const prevPollCountRef = useRef(0);

  const { send } = useDataChannel(
    "polls",
    useCallback((msg: ReceivedDataMessage) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.payload));
        switch (data.action) {
          case "create":
            setPolls((prev) => {
              if (prev.some((p) => p.id === data.id)) return prev;
              playHandRaiseChime();
              return [
                {
                  id: data.id,
                  question: data.question,
                  options: data.options,
                  votes: {},
                  votedBy: {},
                  createdBy: data.createdBy,
                  isActive: true,
                  timestamp: data.timestamp || Date.now(),
                },
                ...prev,
              ];
            });
            break;
          case "vote": {
            const voterId = msg.from?.identity || data.voterIdentity;
            if (!voterId) break;
            setPolls((prev) =>
              prev.map((p) => {
                if (
                  p.id !== data.pollId ||
                  !p.isActive ||
                  p.votedBy[voterId] !== undefined
                ) {
                  return p;
                }
                const optIdx = data.optionIndex;
                if (
                  typeof optIdx !== "number" ||
                  optIdx < 0 ||
                  optIdx >= p.options.length
                ) {
                  return p;
                }
                return {
                  ...p,
                  votes: {
                    ...p.votes,
                    [optIdx]: (p.votes[optIdx] || 0) + 1,
                  },
                  votedBy: {
                    ...p.votedBy,
                    [voterId]: optIdx,
                  },
                };
              }),
            );
            break;
          }
          case "end":
            setPolls((prev) =>
              prev.map((p) =>
                p.id === data.pollId ? { ...p, isActive: false } : p,
              ),
            );
            break;
        }
      } catch (e) {
        console.error("Polls data channel parse error:", e);
      }
    }, []),
  );

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    setOptions(options.map((o, i) => (i === index ? value : o)));
  };

  const createPoll = async () => {
    const trimmedQ = question.trim();
    const filteredOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!trimmedQ || filteredOptions.length < 2) return;

    const poll: Poll = {
      id: `poll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      question: trimmedQ,
      options: filteredOptions,
      votes: {},
      votedBy: {},
      createdBy: localIdentity,
      isActive: true,
      timestamp: Date.now(),
    };

    try {
      await send(
        new TextEncoder().encode(
          JSON.stringify({
            action: "create",
            id: poll.id,
            question: poll.question,
            options: poll.options,
            createdBy: localIdentity,
            timestamp: poll.timestamp,
          }),
        ),
        { reliable: true },
      );
      setPolls((prev) => [poll, ...prev]);
      setCreating(false);
      setQuestion("");
      setOptions(["", ""]);
    } catch (e) {
      console.error("Failed to broadcast poll create:", e);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    try {
      await send(
        new TextEncoder().encode(
          JSON.stringify({
            action: "vote",
            pollId,
            optionIndex,
            voterIdentity: localIdentity,
          }),
        ),
        { reliable: true },
      );
      setPolls((prev) =>
        prev.map((p) => {
          if (
            p.id !== pollId ||
            !p.isActive ||
            p.votedBy[localIdentity] !== undefined
          ) {
            return p;
          }
          return {
            ...p,
            votes: {
              ...p.votes,
              [optionIndex]: (p.votes[optionIndex] || 0) + 1,
            },
            votedBy: {
              ...p.votedBy,
              [localIdentity]: optionIndex,
            },
          };
        }),
      );
    } catch (e) {
      console.error("Failed to broadcast vote:", e);
    }
  };

  const handleEndPoll = async (pollId: string) => {
    try {
      await send(
        new TextEncoder().encode(JSON.stringify({ action: "end", pollId })),
        { reliable: true },
      );
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, isActive: false } : p)),
      );
    } catch (e) {
      console.error("Failed to broadcast poll end:", e);
    }
  };

  const activePolls = polls.filter((p) => p.isActive);
  const endedPolls = polls.filter((p) => !p.isActive);

  const getTotalVotes = (poll: Poll) =>
    Object.values(poll.votes).reduce((a, b) => a + b, 0);

  return (
    <div
      className={`flex flex-col h-full bg-slate-950 text-slate-100 ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-slate-100">
            {t("room.polls.title")}
          </span>
          {activePolls.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold animate-pulse">
              {activePolls.length}
            </span>
          )}
        </div>
        {isHost && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all active:scale-95 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("room.polls.createPoll")}</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Host Poll Creation Form */}
        <AnimatePresence>
          {creating && isHost && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900/90 rounded-2xl p-4 border border-purple-500/40 shadow-md space-y-3 text-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  {t("room.polls.createPoll")}
                </span>
                <button
                  onClick={() => setCreating(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <PodaciumInput
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("room.polls.pollQuestionPlaceholder")}
                inputSize="sm"
                label={t("room.polls.pollQuestion")}
                className="bg-slate-950 border-white/15 text-white placeholder:text-slate-500"
              />

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  {t("room.polls.options")}
                </label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <PodaciumInput
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={t("room.polls.optionPlaceholder", {
                        number: String(i + 1),
                      })}
                      inputSize="sm"
                      className="flex-1 bg-slate-950 border-white/15 text-white placeholder:text-slate-500"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        title={t("room.polls.removeOption")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="text-xs font-medium text-purple-400 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("room.polls.addOption")}
                </button>
              )}

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={createPoll}
                  disabled={
                    !question.trim() ||
                    options.filter((o) => o.trim()).length < 2
                  }
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                >
                  {t("room.polls.launchPoll")}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setQuestion("");
                    setOptions(["", ""]);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {activePolls.length === 0 && endedPolls.length === 0 && !creating && (
          <div className="text-center text-sm text-slate-500 py-12">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40 text-purple-400" />
            <p>{t("room.polls.waitingForPoll")}</p>
            <p className="text-xs text-slate-500 mt-1">
              {isHost
                ? t("room.polls.createPollPrompt")
                : t("room.polls.studentWaiting")}
            </p>
          </div>
        )}

        {activePolls.map((poll) => {
          const myVoteIdx = poll.votedBy[localIdentity];
          const hasVoted = myVoteIdx !== undefined;
          const total = getTotalVotes(poll);

          return (
            <motion.div
              key={poll.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {t("common.live")}
                </span>
                <span className="text-xs text-slate-400 tabular-nums font-medium">
                  {t("room.polls.totalVotes", { count: String(total) })}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-white leading-snug">
                {poll.question}
              </h4>

              <div className="space-y-2">
                {poll.options.map((opt, i) => {
                  const count = poll.votes[i] || 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const isSelected = myVoteIdx === i;

                  return (
                    <button
                      key={i}
                      onClick={() => handleVote(poll.id, i)}
                      disabled={hasVoted}
                      className={`w-full text-start relative overflow-hidden rounded-xl border p-2.5 transition-all ${
                        isSelected
                          ? "border-purple-500 bg-purple-950/40 ring-1 ring-purple-500/50"
                          : hasVoted
                            ? "border-white/10 bg-slate-900/60"
                            : "border-white/10 bg-slate-800/60 hover:border-purple-500 hover:bg-purple-500/10"
                      }`}
                    >
                      {/* Real-time filled percentage background */}
                      {hasVoted && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={`absolute inset-y-0 start-0 ${
                            isSelected ? "bg-purple-500/25" : "bg-slate-700/40"
                          }`}
                        />
                      )}

                      <div className="relative flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-slate-500 shrink-0" />
                          )}
                          <span
                            className={`font-medium truncate ${isSelected ? "text-purple-300 font-semibold" : "text-slate-200"}`}
                          >
                            {opt}
                          </span>
                        </div>

                        {hasVoted && (
                          <span className="font-semibold text-slate-300 tabular-nums shrink-0">
                            {Math.round(pct)}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Host End Poll button */}
              {isHost && (
                <div className="pt-2 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => handleEndPoll(poll.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-medium transition-colors"
                  >
                    {t("room.polls.endPoll")}
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Ended Polls Archive */}
        {endedPolls.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("room.polls.pollEnded")}
            </span>

            {endedPolls.map((poll) => {
              const total = getTotalVotes(poll);
              const maxCount = Math.max(...Object.values(poll.votes), 0);

              return (
                <div
                  key={poll.id}
                  className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 space-y-2.5 opacity-85"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-slate-200 truncate">
                      {poll.question}
                    </h5>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {total} {tCommon("uiLabels.votes")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {poll.options.map((opt, i) => {
                      const count = poll.votes[i] || 0;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      const isWinner = count === maxCount && count > 0;

                      return (
                        <div
                          key={i}
                          className="relative overflow-hidden rounded-lg bg-slate-800 border border-white/10 p-2 text-xs"
                        >
                          <div
                            className={`absolute inset-y-0 start-0 ${
                              isWinner ? "bg-emerald-500/20" : "bg-slate-700/40"
                            }`}
                            style={{ width: `${pct}%` }}
                          />

                          <div className="relative flex items-center justify-between gap-2">
                            <span
                              className={`truncate ${isWinner ? "font-semibold text-emerald-400" : "text-slate-300"}`}
                            >
                              {opt}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                              {Math.round(pct)}% ({count})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
