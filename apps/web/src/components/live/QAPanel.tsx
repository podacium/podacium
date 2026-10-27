"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocalParticipant, useDataChannel } from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import {
  ChevronUp,
  CheckCircle,
  Check,
  X,
  MessageSquare,
  Radio,
  Sparkles,
  Filter,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export interface Question {
  id: string;
  senderIdentity: string;
  senderName: string;
  content: string;
  timestamp: number;
  upvotes: number;
  upvotedBy: string[];
  status: "pending" | "approved" | "answering" | "answered";
}

interface Props {
  isHost: boolean;
  className?: string;
}

export function QAPanel({ isHost, className = "" }: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const { localParticipant } = useLocalParticipant();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | "unanswered" | "answered">(
    "all",
  );
  const [moderation, setModeration] = useState<"direct" | "moderated">(
    "direct",
  );
  const listRef = useRef<HTMLDivElement>(null);
  const localIdentity = localParticipant?.identity || "";
  const localName = localParticipant?.name || localIdentity;

  const { send } = useDataChannel(
    "qa",
    useCallback(
      (msg: ReceivedDataMessage) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          switch (data.action) {
            case "ask":
              setQuestions((prev) => {
                if (prev.some((q) => q.id === data.id)) return prev;
                return [
                  ...prev,
                  {
                    id: data.id,
                    senderIdentity: data.senderIdentity,
                    senderName: data.senderName,
                    content: data.content,
                    timestamp: data.timestamp,
                    upvotes: 0,
                    upvotedBy: [],
                    status: data.status || "approved",
                  },
                ];
              });
              break;
            case "upvote":
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === data.questionId
                    ? {
                        ...q,
                        upvotes: q.upvotes + 1,
                        upvotedBy: [...q.upvotedBy, data.voterIdentity],
                      }
                    : q,
                ),
              );
              break;
            case "approve":
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === data.questionId
                    ? { ...q, status: "approved" as const }
                    : q,
                ),
              );
              break;
            case "reject":
              setQuestions((prev) =>
                prev.filter((q) => q.id !== data.questionId),
              );
              break;
            case "answer_live":
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === data.questionId
                    ? { ...q, status: "answering" as const }
                    : q,
                ),
              );
              break;
            case "answer":
              setQuestions((prev) =>
                prev.map((q) =>
                  q.id === data.questionId
                    ? { ...q, status: "answered" as const }
                    : q,
                ),
              );
              break;
          }
        } catch (e) {
          console.error("QA data channel message parse error:", e);
        }
      },
      [isHost],
    ),
  );

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [questions]);

  const askQuestion = async () => {
    if (!input.trim()) return;
    const question: Question = {
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      senderIdentity: localIdentity,
      senderName: localName,
      content: input.trim(),
      timestamp: Date.now(),
      upvotes: 0,
      upvotedBy: [],
      status: moderation === "moderated" && !isHost ? "pending" : "approved",
    };
    await send(
      new TextEncoder().encode(JSON.stringify({ action: "ask", ...question })),
      { reliable: true },
    );
    setQuestions((prev) => [...prev, question]);
    setInput("");
  };

  const upvoteQuestion = async (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q || q.upvotedBy.includes(localIdentity)) return;
    await send(
      new TextEncoder().encode(
        JSON.stringify({
          action: "upvote",
          questionId,
          voterIdentity: localIdentity,
        }),
      ),
      { reliable: true },
    );
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              upvotes: q.upvotes + 1,
              upvotedBy: [...q.upvotedBy, localIdentity],
            }
          : q,
      ),
    );
  };

  const approveQuestion = async (questionId: string) => {
    if (!isHost) return;
    await send(
      new TextEncoder().encode(
        JSON.stringify({ action: "approve", questionId }),
      ),
      { reliable: true },
    );
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, status: "approved" } : q)),
    );
  };

  const rejectQuestion = async (questionId: string) => {
    if (!isHost) return;
    await send(
      new TextEncoder().encode(
        JSON.stringify({ action: "reject", questionId }),
      ),
      { reliable: true },
    );
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const answerLive = async (q: Question) => {
    if (!isHost) return;
    await send(
      new TextEncoder().encode(
        JSON.stringify({
          action: "answer_live",
          questionId: q.id,
          question: q,
        }),
      ),
      { reliable: true },
    );
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, status: "answering" } : item,
      ),
    );
  };

  const markAnswered = async (questionId: string) => {
    if (!isHost) return;
    await send(
      new TextEncoder().encode(
        JSON.stringify({ action: "answer", questionId }),
      ),
      { reliable: true },
    );
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, status: "answered" } : q)),
    );
  };

  const visibleQuestions = questions.filter((q) => {
    if (
      !isHost &&
      q.status === "pending" &&
      q.senderIdentity !== localIdentity
    ) {
      return false;
    }
    if (filter === "unanswered") return q.status !== "answered";
    if (filter === "answered") return q.status === "answered";
    return true;
  });

  const pendingQuestions = questions.filter((q) => q.status === "pending");

  return (
    <div
      className={`flex flex-col h-full bg-slate-950 text-slate-100 ${className}`}
    >
      {/* Header & Filter Controls */}
      <div className="px-4 py-3 border-b border-white/10 bg-slate-900/60 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">
              {t("room.qa.title")}
            </span>
            {pendingQuestions.length > 0 && isHost && (
              <span className="text-xs bg-amber-500/20 text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                {pendingQuestions.length}
              </span>
            )}
          </div>
          {isHost && (
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-xs border border-white/10">
              <button
                onClick={() => setModeration("direct")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  moderation === "direct"
                    ? "bg-purple-600 text-white font-medium shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t("room.qa.direct")}
              </button>
              <button
                onClick={() => setModeration("moderated")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  moderation === "moderated"
                    ? "bg-purple-600 text-white font-medium shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t("room.qa.moderated")}
              </button>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-white/10"
            }`}
          >
            {t("room.qa.filterAll")}
          </button>
          <button
            onClick={() => setFilter("unanswered")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "unanswered"
                ? "bg-purple-600 text-white"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-white/10"
            }`}
          >
            {t("room.qa.filterUnanswered")}
          </button>
          <button
            onClick={() => setFilter("answered")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "answered"
                ? "bg-purple-600 text-white"
                : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-white/10"
            }`}
          >
            {t("room.qa.filterAnswered")}
          </button>
        </div>
      </div>

      {/* Pending queue for host */}
      {isHost && pendingQuestions.length > 0 && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-xs text-amber-400 font-semibold mb-2">
            {t("room.qa.hostOnly")} ({pendingQuestions.length})
          </p>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {pendingQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-amber-500/30 text-xs text-white"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-300">
                    {q.senderName}:
                  </span>{" "}
                  <span className="text-slate-200">{q.content}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => approveQuestion(q.id)}
                    className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40"
                    title={t("room.qa.approve")}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => rejectQuestion(q.id)}
                    className="p-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/40"
                    title={t("room.qa.reject")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question List */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleQuestions.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-12">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40 text-purple-400" />
            <p>{t("room.qa.empty")}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t("room.qa.emptyHint")}
            </p>
          </div>
        )}

        {visibleQuestions.map((q) => {
          const hasUpvoted = q.upvotedBy.includes(localIdentity);
          const isAnswering = q.status === "answering";
          const isAnswered = q.status === "answered";

          return (
            <div
              key={q.id}
              className={`rounded-2xl p-3 border transition-all ${
                isAnswering
                  ? "bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50 shadow-md"
                  : isAnswered
                    ? "bg-slate-900/40 border-white/5 opacity-70"
                    : "bg-slate-900/90 border-white/10 shadow-xs"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Upvote button */}
                <button
                  onClick={() => upvoteQuestion(q.id)}
                  disabled={hasUpvoted || isAnswered}
                  className={`flex flex-col items-center justify-center min-w-[36px] py-1 px-1.5 rounded-xl border transition-all ${
                    hasUpvoted
                      ? "bg-purple-600 text-white border-purple-600 font-bold"
                      : "bg-slate-800 border-white/10 text-slate-300 hover:border-purple-400 hover:text-white"
                  }`}
                >
                  <ChevronUp className="h-4 w-4" />
                  <span className="text-xs font-semibold tabular-nums">
                    {q.upvotes}
                  </span>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-white truncate">
                      {q.senderName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isAnswering && (
                        <span className="flex items-center gap-1 bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse">
                          <Radio className="h-3 w-3" />
                          {t("room.qa.answeringLive")}
                        </span>
                      )}
                      {isAnswered && (
                        <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                          {t("room.qa.answered")}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-200 leading-snug break-words">
                    {q.content}
                  </p>

                  {/* Host actions */}
                  {isHost && !isAnswered && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                      {!isAnswering && (
                        <button
                          onClick={() => answerLive(q)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
                        >
                          <Radio className="h-3 w-3" />
                          <span>{t("room.qa.answerLive")}</span>
                        </button>
                      )}
                      <button
                        onClick={() => markAnswered(q.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        <span>{t("room.qa.markAnswered")}</span>
                      </button>
                      <button
                        onClick={() => rejectQuestion(q.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        title={t("common.delete")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input box */}
      <div className="p-3 border-t border-white/10 bg-slate-950 shrink-0">
        <div className="flex gap-2" dir={dir}>
          <PodaciumInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("room.qa.inputPlaceholder")}
            inputSize="sm"
            className="flex-1 bg-slate-900 border-white/15 text-white placeholder:text-slate-500"
          />
          <button
            onClick={askQuestion}
            disabled={!input.trim()}
            className="px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
          >
            {t("room.qa.ask")}
          </button>
        </div>
      </div>
    </div>
  );
}
