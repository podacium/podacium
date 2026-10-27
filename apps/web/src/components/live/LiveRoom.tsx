"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useDataChannel,
  useRoomContext,
} from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare,
  HelpCircle,
  Users,
  LayoutDashboard,
  BarChart,
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  UserPlus,
  UserMinus,
  Radio,
  CheckCircle,
  X,
} from "lucide-react";
import type { Participant } from "livekit-client";

import { VideoConference } from "./VideoConference";
import { ParticipantTile } from "./ParticipantTile";
import { ChatPanel } from "./ChatPanel";
import { QAPanel, type Question } from "./QAPanel";
import { ControlBar, type LayoutMode } from "./ControlBar";
import { ScreenShareOverlay } from "./ScreenShareOverlay";
import { ConnectionStatus } from "./ConnectionStatus";
import { RecordingIndicator } from "./RecordingIndicator";
import { ParticipantList } from "./ParticipantList";
import { Whiteboard } from "./Whiteboard";
import { Polls } from "./Polls";
import { EcosystemPanel } from "./EcosystemPanel";
import { BottomSheet } from "./BottomSheet";
import { HandRaiseProvider } from "./HandRaiseContext";
import { BreakoutBanner } from "./BreakoutBanner";
import type { BreakoutSessionState } from "./BreakoutRoomsModal";
import { useTranslations, useBidi } from "@/lib/i18n";
import { playJoinChime, playLeaveChime } from "@/lib/audioChimes";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useLiveMediaSession } from "@/hooks/useLiveMediaSession";

type SidebarTab = "chat" | "qa" | "polls" | "participants";

const SIDEBAR_TABS: {
  id: SidebarTab;
  icon: React.ElementType;
  labelKey: string;
}[] = [
  { id: "chat", icon: MessageSquare, labelKey: "room.sidebar.chat" },
  { id: "qa", icon: HelpCircle, labelKey: "room.sidebar.qa" },
  { id: "polls", icon: BarChart, labelKey: "room.sidebar.polls" },
  { id: "participants", icon: Users, labelKey: "room.sidebar.participants" },
];

interface Props {
  roomName: string;
  sessionId: string;
  ownerId: number | null;
  onLeave: () => void;
  onEndSession: () => void;
}

function MeetingTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className="flex items-center gap-1 text-xs text-white/60 tabular-nums">
      <Clock className="h-3 w-3" />
      {display}
    </span>
  );
}

interface RoomToast {
  id: number;
  name: string;
  kind: "join" | "leave";
}

export function LiveRoom({
  roomName,
  sessionId,
  ownerId,
  onLeave,
  onEndSession,
}: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const localIdentity = localParticipant?.identity || "";
  const localIdentityNum = parseInt(localIdentity.replace(/^user_/, ""), 10);
  const isHost =
    ownerId !== null &&
    (localIdentity === String(ownerId) ||
      localIdentity === `user_${ownerId}` ||
      localIdentityNum === ownerId);

  // Keep mobile screens awake during active live session
  useWakeLock(true);

  // Background WebRTC audio and lock screen / Bluetooth media controls
  useLiveMediaSession({
    roomName,
    isHost,
    isMuted: !localParticipant?.isMicrophoneEnabled,
    onToggleMic: () => {
      localParticipant?.setMicrophoneEnabled(
        !localParticipant?.isMicrophoneEnabled,
      );
    },
    onLeave,
    isActive: true,
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [screenSharing, setScreenSharing] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("spotlight");
  const [answeringQuestion, setAnsweringQuestion] = useState<Question | null>(
    null,
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<RoomToast[]>([]);
  const toastIdRef = useRef(0);
  const prevIdentitiesRef = useRef<Set<string> | null>(null);

  // Co-Host & Breakout Room State
  const [coHostIdentities, setCoHostIdentities] = useState<Set<string>>(
    new Set(),
  );
  const [breakoutSession, setBreakoutSession] =
    useState<BreakoutSessionState | null>(null);
  const isCoHost = localParticipant
    ? coHostIdentities.has(localParticipant.identity)
    : false;

  // Live Badges counters
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unansweredQACount, setUnansweredQACount] = useState(0);
  const [activePollsCount, setActivePollsCount] = useState(0);

  // Clear unread counts when switching to that tab
  useEffect(() => {
    if (sidebarOpen) {
      if (activeTab === "chat") setUnreadChatCount(0);
      if (activeTab === "qa") setUnansweredQACount(0);
      if (activeTab === "polls") setActivePollsCount(0);
    }
  }, [activeTab, sidebarOpen]);

  // Listen to chat channel for unread message counts
  useDataChannel(
    "chat",
    useCallback(() => {
      if (!sidebarOpen || activeTab !== "chat") {
        setUnreadChatCount((prev) => prev + 1);
      }
    }, [sidebarOpen, activeTab]),
  );

  // Listen to QA channel for live answering broadcasts & new questions
  const { send: sendQA } = useDataChannel(
    "qa",
    useCallback(
      (msg: ReceivedDataMessage) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          if (data.action === "answer_live" && data.question) {
            setAnsweringQuestion(data.question);
          } else if (data.action === "answer" && data.questionId) {
            setAnsweringQuestion((prev) =>
              prev?.id === data.questionId ? null : prev,
            );
            setUnansweredQACount((prev) => Math.max(0, prev - 1));
          } else if (
            data.action === "new_question" ||
            data.action === "question"
          ) {
            if (!sidebarOpen || activeTab !== "qa") {
              setUnansweredQACount((prev) => prev + 1);
            }
          }
        } catch (err) {
          console.error("Live answering sync error:", err);
        }
      },
      [sidebarOpen, activeTab],
    ),
  );

  // Listen to polls channel for active poll broadcasts
  useDataChannel(
    "polls",
    useCallback(
      (msg: ReceivedDataMessage) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          if (data.action === "create" || data.action === "poll_created") {
            if (!sidebarOpen || activeTab !== "polls") {
              setActivePollsCount((prev) => prev + 1);
            }
          } else if (data.action === "end" || data.action === "poll_ended") {
            setActivePollsCount((prev) => Math.max(0, prev - 1));
          }
        } catch (err) {
          console.error("Poll data channel error:", err);
        }
      },
      [sidebarOpen, activeTab],
    ),
  );

  // Listen to room commands (e.g. host remote mute, cameras disable, co-host promotion, breakout events)
  useDataChannel(
    "",
    useCallback(
      (msg: ReceivedDataMessage) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.payload));
          if (!data || typeof data !== "object") return;

          // SECURITY: Verify that remote command originates strictly from the room host or authorized co-host
          const senderIdentity =
            (msg as any).from?.identity ||
            (msg as any).participant?.identity ||
            (msg as any).from ||
            "";
          const isSenderHost =
            ownerId !== null &&
            (senderIdentity === String(ownerId) ||
              senderIdentity === `user_${ownerId}` ||
              parseInt(senderIdentity, 10) === ownerId);
          const isSenderCoHost = coHostIdentities.has(senderIdentity);

          if (!isSenderHost && !isSenderCoHost) {
            console.warn(
              "[LiveRoom] Discarded unauthorized room command from:",
              senderIdentity,
            );
            return;
          }

          if (
            data.action === "mute_participant" &&
            (data.targetIdentity === localIdentity ||
              data.targetIdentity === String(localIdentityNum) ||
              data.targetIdentity === `user_${localIdentityNum}`)
          ) {
            localParticipant?.setMicrophoneEnabled(false);
          } else if (data.action === "mute_all" && !isHost && !isCoHost) {
            localParticipant?.setMicrophoneEnabled(false);
          } else if (
            data.action === "disable_cameras_all" &&
            !isHost &&
            !isCoHost
          ) {
            localParticipant?.setCameraEnabled(false);
          } else if (data.action === "toggle_cohost") {
            setCoHostIdentities((prev) => {
              const next = new Set(prev);
              if (data.isCoHost) {
                next.add(data.targetIdentity);
              } else {
                next.delete(data.targetIdentity);
              }
              return next;
            });
          } else if (data.action === "breakout_start") {
            setBreakoutSession({
              isActive: true,
              roomsCount: data.roomsCount || 2,
              durationMinutes: data.durationMinutes || 10,
              endsAt:
                data.endsAt ||
                Date.now() + (data.durationMinutes || 10) * 60 * 1000,
            });
          } else if (data.action === "breakout_broadcast") {
            setBreakoutSession((prev) =>
              prev ? { ...prev, latestBroadcast: data.message } : null,
            );
          } else if (data.action === "breakout_end") {
            setBreakoutSession(null);
          }
        } catch {
          // Ignore non-JSON messages
        }
      },
      [
        localIdentity,
        localIdentityNum,
        localParticipant,
        isHost,
        isCoHost,
        ownerId,
        coHostIdentities,
      ],
    ),
  );

  const handleStartBreakout = async (
    roomsCount: number,
    durationMinutes: number,
  ) => {
    if (!room || (!isHost && !isCoHost)) return;
    const endsAt = Date.now() + durationMinutes * 60 * 1000;
    const state: BreakoutSessionState = {
      isActive: true,
      roomsCount,
      durationMinutes,
      endsAt,
    };
    setBreakoutSession(state);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "breakout_start",
          roomsCount,
          durationMinutes,
          endsAt,
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.error("Failed to broadcast breakout_start:", e);
    }
  };

  const handleEndBreakout = async () => {
    if (!room || (!isHost && !isCoHost)) return;
    setBreakoutSession(null);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "breakout_end",
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.error("Failed to broadcast breakout_end:", e);
    }
  };

  const handleBroadcastBreakout = async (message: string) => {
    if (!room || (!isHost && !isCoHost)) return;
    setBreakoutSession((prev) =>
      prev ? { ...prev, latestBroadcast: message } : null,
    );
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "breakout_broadcast",
          message,
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.error("Failed to broadcast breakout announcement:", e);
    }
  };

  // Synchronize screen sharing state with local participant status
  useEffect(() => {
    if (localParticipant) {
      setScreenSharing(localParticipant.isScreenShareEnabled);
    }
  }, [localParticipant?.isScreenShareEnabled]);

  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    try {
      if (screenSharing) {
        await localParticipant.setScreenShareEnabled(false);
        setScreenSharing(false);
      } else {
        await localParticipant.setScreenShareEnabled(true);
        setScreenSharing(true);
      }
    } catch {
      setScreenSharing(false);
    }
  };

  const pushToast = useCallback((name: string, kind: "join" | "leave") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, name, kind }]);

    if (kind === "join") {
      playJoinChime();
    } else {
      playLeaveChime();
    }

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const current = new Set(participants.map((p) => p.identity));
    if (prevIdentitiesRef.current === null) {
      prevIdentitiesRef.current = current;
      return;
    }
    const prev = prevIdentitiesRef.current;
    for (const id of current) {
      if (!prev.has(id)) {
        const p = participants.find((x) => x.identity === id);
        if (p && !p.isLocal) pushToast(p.name || id, "join");
      }
    }
    for (const id of prev) {
      if (!current.has(id)) {
        const p = participants.find((x) => x.identity === id);
        if (p && !p.isLocal) pushToast(p.name || id, "leave");
      }
    }
    prevIdentitiesRef.current = current;
  }, [participants, pushToast]);

  const handleSelectParticipant = useCallback((participant: Participant) => {
    const userId = parseInt(participant.identity, 10);
    setSelectedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  const handleDoneAnswering = async () => {
    if (!answeringQuestion) return;
    try {
      await sendQA(
        new TextEncoder().encode(
          JSON.stringify({
            action: "answer",
            questionId: answeringQuestion.id,
          }),
        ),
        { reliable: true },
      );
    } catch (e) {
      console.error("Done answering broadcast failed:", e);
    }
    setAnsweringQuestion(null);
  };

  const getBadgeCount = (id: SidebarTab) => {
    switch (id) {
      case "chat":
        return unreadChatCount;
      case "qa":
        return unansweredQACount;
      case "polls":
        return activePollsCount;
      case "participants":
        return participants.length;
      default:
        return 0;
    }
  };

  const renderSidebarContent = () => {
    switch (activeTab) {
      case "chat":
        return <ChatPanel />;
      case "qa":
        return <QAPanel isHost={isHost} />;
      case "polls":
        return <Polls isHost={isHost} />;
      case "participants":
        return (
          <ParticipantList
            isHost={isHost}
            coHostIdentities={coHostIdentities}
            onToggleCoHost={(id, flag) =>
              setCoHostIdentities((prev) => {
                const n = new Set(prev);
                if (flag) n.add(id);
                else n.delete(id);
                return n;
              })
            }
          />
        );
    }
  };

  return (
    <HandRaiseProvider>
      <div className="dark h-dvh min-h-dvh flex flex-col bg-slate-950 text-white relative overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 backdrop-blur border-b border-white/10 shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Live Indicator */}
            <span
              className="flex items-center gap-1.5 shrink-0"
              data-testid="live-indicator"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                {t("common.live")}
              </span>
            </span>
            <span className="text-sm font-medium text-white truncate max-w-[200px]">
              {roomName}
            </span>
            <MeetingTimer />
            <ConnectionStatus />
            <RecordingIndicator />
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold">{participants.length}</span>
          </div>
        </header>

        {/* Breakout Session Banner */}
        <BreakoutBanner
          sessionState={breakoutSession}
          onDismissAnnouncement={() =>
            setBreakoutSession((prev) =>
              prev ? { ...prev, latestBroadcast: undefined } : null,
            )
          }
        />

        {/* Main Stage & Sidebar */}
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex-1 relative flex flex-col min-w-0">
            <div className="flex-1 relative overflow-hidden">
              {/* Background ambient gradient glow */}
              <motion.div
                aria-hidden
                className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.2),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.16),transparent_55%)]"
                animate={{ opacity: [0.15, 0.25, 0.15] }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Floating Answering Live Question Banner */}
              <AnimatePresence>
                {answeringQuestion && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="absolute top-4 inset-x-4 md:inset-x-16 mx-auto z-40 max-w-2xl"
                  >
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-purple-500/40 bg-slate-950/90 shadow-2xl backdrop-blur-xl text-white">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="p-2 rounded-xl bg-purple-600/30 text-purple-300 shrink-0">
                          <Radio className="h-5 w-5 animate-pulse" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                              {t("room.qa.answeringLive")}
                            </span>
                            <span className="text-xs text-gray-400">
                              • {answeringQuestion.senderName}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white truncate mt-0.5">
                            &ldquo;{answeringQuestion.content}&rdquo;
                          </p>
                        </div>
                      </div>

                      {isHost && (
                        <button
                          onClick={handleDoneAnswering}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm active:scale-95"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>{t("room.qa.doneAnswering")}</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SURFACE A: PRIMARY STAGE CANVAS (Whiteboard Takeover vs VideoConference) */}
              {isWhiteboardOpen ? (
                <div className="h-full flex flex-col min-h-0 bg-slate-950 relative z-10">
                  {/* Adaptive horizontal participant ribbon */}
                  <div className="flex items-center gap-2 p-2 bg-slate-950/95 border-b border-white/10 overflow-x-auto shrink-0 scrollbar-none">
                    {participants.map((p) => (
                      <div
                        key={p.identity}
                        className="w-36 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-white/10 relative cursor-pointer"
                        onClick={() => handleSelectParticipant(p)}
                      >
                        <ParticipantTile
                          participant={p}
                          isHost={isHost && p.identity === String(ownerId)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Full 16:9 Vector Whiteboard Stage */}
                  <div className="flex-1 relative min-h-0 bg-slate-900 overflow-hidden">
                    <Whiteboard isHost={isHost} className="w-full h-full" />
                  </div>
                </div>
              ) : (
                <div className="relative z-10 h-full">
                  <VideoConference
                    isHost={isHost}
                    ownerId={ownerId}
                    layoutMode={layoutMode}
                    onSelectParticipant={handleSelectParticipant}
                  />
                  {screenSharing && <ScreenShareOverlay />}
                </div>
              )}

              {/* SURFACE C: CONTEXTUAL FLOATING INSPECTOR CARD */}
              <AnimatePresence>
                {selectedUserId !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 15 }}
                    transition={{ type: "spring", stiffness: 350, damping: 26 }}
                    className="absolute top-16 start-4 z-40 w-80 sm:w-96 max-h-[calc(100%-8rem)] bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-white"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
                          {t("room.sidebar.ecosystem")}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedUserId(null)}
                        className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label={t("common.close")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 bg-slate-950">
                      <EcosystemPanel
                        sessionId={sessionId}
                        userId={selectedUserId}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* SURFACE B: UNIFIED INTERACTION RAIL (Desktop Sidebar md+) */}
          {sidebarOpen && (
            <aside className="hidden md:flex w-80 lg:w-96 border-s border-white/10 bg-slate-950 flex-col shrink-0 relative">
              <div className="flex border-b border-white/10 bg-slate-900/80 shrink-0">
                {SIDEBAR_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const count = getBadgeCount(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors relative ${
                        activeTab === tab.id
                          ? "text-purple-400 border-b-2 border-purple-500 font-semibold bg-purple-500/10"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                      title={t(tab.labelKey)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline">
                        {t(tab.labelKey)}
                      </span>
                      {count > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                            activeTab === tab.id
                              ? "bg-purple-600 text-white"
                              : "bg-slate-800 text-purple-300"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 overflow-hidden bg-slate-950">
                {renderSidebarContent()}
              </div>
              {/* Desktop Sidebar Collapse Button (md+) */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-1/2 -translate-y-1/2 -start-3.5 z-40 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-full border border-white/10 shadow-lg transition-all active:scale-95"
                title={t("room.sidebar.close")}
                aria-label={t("room.sidebar.close")}
              >
                {dir === "rtl" ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            </aside>
          )}

          {/* Desktop Sidebar Reopen Button (md+) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:block absolute top-1/2 -translate-y-1/2 z-40 bg-slate-900/90 hover:bg-slate-800 text-slate-300 p-2 rounded-s-xl border border-white/10 shadow-lg end-0"
              aria-label={t("room.sidebar.open")}
            >
              {dir === "rtl" ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Mobile BottomSheet Drawer (<md) — Scroll Trap Eliminated */}
          <div className="md:hidden">
            <BottomSheet
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              title={t(
                SIDEBAR_TABS.find((tab) => tab.id === activeTab)?.labelKey ||
                  "room.sidebar.chat",
              )}
              contentClassName="overflow-hidden p-0"
            >
              <div className="h-[65dvh] flex flex-col min-h-0">
                {/* Touch-accessible Tab Switcher (>= 48px target height) with badges */}
                <div className="flex border-b border-white/10 pb-2 mb-2 overflow-x-auto gap-1.5 shrink-0 scrollbar-none">
                  {SIDEBAR_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count = getBadgeCount(tab.id);
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-[48px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all active:scale-95 ${
                          activeTab === tab.id
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "text-gray-300 hover:text-white bg-white/5"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{t(tab.labelKey)}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                              activeTab === tab.id
                                ? "bg-white text-purple-700"
                                : "bg-purple-500 text-white"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Main Content Area: Fills available sheet height without nested scroll trap */}
                <div className="flex-1 min-h-0 rounded-2xl bg-slate-900/90 border border-white/10 overflow-hidden flex flex-col">
                  {renderSidebarContent()}
                </div>
              </div>
            </BottomSheet>
          </div>
        </div>

        {/* Join/Leave Toasts */}
        <div
          className="fixed top-16 end-4 z-50 flex flex-col gap-2 pointer-events-none"
          data-testid="room-toasts"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/90 backdrop-blur px-3 py-2 shadow-lg text-white text-sm"
                data-testid={`toast-${toast.kind}`}
              >
                {toast.kind === "join" ? (
                  <UserPlus className="h-4 w-4 text-emerald-400" />
                ) : (
                  <UserMinus className="h-4 w-4 text-red-400" />
                )}
                <span>
                  {t(
                    toast.kind === "join"
                      ? "room.toast.joined"
                      : "room.toast.left",
                    { name: toast.name },
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Floating Control Bar */}
        <ControlBar
          isHost={isHost}
          isCoHost={isCoHost}
          sessionId={sessionId}
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          onLeave={onLeave}
          onEndSession={onEndSession}
          onToggleScreenShare={toggleScreenShare}
          screenSharing={screenSharing}
          onToggleWhiteboard={() => setIsWhiteboardOpen((prev) => !prev)}
          isWhiteboardOpen={isWhiteboardOpen}
          activeBreakoutSession={breakoutSession}
          onStartBreakout={handleStartBreakout}
          onEndBreakout={handleEndBreakout}
          onBroadcastBreakout={handleBroadcastBreakout}
          className="absolute bottom-6 inset-x-0 mx-auto w-fit z-30"
        />
      </div>
    </HandRaiseProvider>
  );
}
