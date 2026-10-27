"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  useRemoteParticipants,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { motion } from "framer-motion";
import { Video, Presentation as PresentationIcon } from "lucide-react";
import { Track, type Participant } from "livekit-client";
import { useTranslations } from "@/lib/i18n";
import { ParticipantTile } from "./ParticipantTile";
import type { LayoutMode } from "./ControlBar";

interface Props {
  isHost?: boolean;
  ownerId?: number | null;
  layoutMode?: LayoutMode;
  onSelectParticipant?: (participant: Participant) => void;
}

const SPRING = { type: "spring", stiffness: 300, damping: 20 } as const;

export function VideoConference({
  ownerId = null,
  layoutMode = "spotlight",
  onSelectParticipant,
}: Props) {
  const t = useTranslations("live");
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const speakingParticipants = useSpeakingParticipants();
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);

  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<Participant | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active speaker hysteresis (400ms debounce + 1.8s hold timer)
  useEffect(() => {
    const rawSpeaker = speakingParticipants[0] ?? null;

    if (rawSpeaker) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (!activeSpeaker) {
        setActiveSpeaker(rawSpeaker);
      } else if (activeSpeaker.identity !== rawSpeaker.identity) {
        if (!debounceTimerRef.current) {
          debounceTimerRef.current = setTimeout(() => {
            setActiveSpeaker(rawSpeaker);
            debounceTimerRef.current = null;
          }, 400);
        }
      }
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (activeSpeaker && !holdTimerRef.current) {
        holdTimerRef.current = setTimeout(() => {
          setActiveSpeaker(null);
          holdTimerRef.current = null;
        }, 1800);
      }
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [speakingParticipants, activeSpeaker]);

  const allParticipants = localParticipant
    ? [localParticipant, ...remoteParticipants]
    : remoteParticipants;

  const isPreviousSpeakerStillSpeaking =
    activeSpeaker &&
    speakingParticipants.some((p) => p.identity === activeSpeaker.identity);

  const currentActiveSpeaker = isPreviousSpeakerStillSpeaking
    ? activeSpeaker
    : (speakingParticipants[0] ?? activeSpeaker ?? null);

  const screenShareParticipant = screenShareTracks[0]?.participant ?? null;
  const hostIdentity = ownerId ? String(ownerId) : null;

  // Determine spotlight candidate: Pinned > Screen Share > Active Speaker > Host
  const spotlightParticipant =
    (pinnedIdentity
      ? allParticipants.find((p) => p.identity === pinnedIdentity)
      : null) ||
    screenShareParticipant ||
    currentActiveSpeaker ||
    (hostIdentity
      ? allParticipants.find((p) => p.identity === hostIdentity)
      : null);

  const others = spotlightParticipant
    ? allParticipants.filter(
        (p) => p.identity !== spotlightParticipant.identity,
      )
    : allParticipants.slice(1);

  const spotlightIsSpeaking =
    !!spotlightParticipant &&
    speakingParticipants.some(
      (p) => p.identity === spotlightParticipant.identity,
    );

  const handleSelect = (participant: Participant) => {
    if (onSelectParticipant && /^\d+$/.test(participant.identity)) {
      onSelectParticipant(participant);
    }
  };

  const handleTogglePin = (identity: string) => {
    setPinnedIdentity((prev) => (prev === identity ? null : identity));
  };

  const tile = (participant: Participant, large = false) => {
    const isSpeaking = speakingParticipants.some(
      (p) => p.identity === participant.identity,
    );
    return (
      <motion.div
        layout
        transition={SPRING}
        className={`${large ? "h-full w-full" : "aspect-video w-full"} ${
          onSelectParticipant ? "cursor-pointer" : ""
        } ${
          isSpeaking
            ? "ring-2 ring-emerald-400 rounded-2xl shadow-[0_0_24px_rgba(52,211,153,0.35)]"
            : ""
        }`}
        onClick={() => handleSelect(participant)}
        data-testid={`tile-wrap-${participant.identity}`}
      >
        <ParticipantTile
          participant={participant}
          large={large}
          isHost={!!(hostIdentity && participant.identity === hostIdentity)}
          pinned={pinnedIdentity === participant.identity}
          onPin={() => handleTogglePin(participant.identity)}
        />
      </motion.div>
    );
  };

  if (allParticipants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-8 py-10 text-center overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_65%)]"
          />
          <div className="relative">
            <div className="relative mx-auto mb-4 w-14 h-14">
              <span className="absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-40 animate-ping" />
              <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-900/40">
                <Video className="h-6 w-6 text-white" />
              </span>
            </div>
            <p className="text-gray-200 text-sm font-semibold">
              {t("room.waitingForParticipants")}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t("room.waitingHint")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Layout Mode: GRID (Adaptive for 1 to 50+ participants)
  if (layoutMode === "grid") {
    const count = allParticipants.length;
    const gridCols =
      count <= 1
        ? "grid-cols-1 max-w-4xl mx-auto"
        : count <= 2
          ? "grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto"
          : count <= 4
            ? "grid-cols-2"
            : count <= 6
              ? "grid-cols-2 sm:grid-cols-3"
              : count <= 9
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3"
                : count <= 16
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                  : count <= 25
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
                    : count <= 36
                      ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-6"
                      : "grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8";

    return (
      <div className="h-full p-3 overflow-y-auto">
        <div className={`grid ${gridCols} gap-3 h-full auto-rows-fr`}>
          {allParticipants.map((p) => (
            <div key={p.identity} className="h-full min-h-[140px]">
              {tile(p, false)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Layout Mode: PRESENTATION (Screen Share / Speaker takes 100% stage, floating miniature bottom bar)
  if (layoutMode === "presentation") {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <div className="flex-1 min-h-0 relative">
          {spotlightParticipant && (
            <motion.div
              key={spotlightParticipant.identity}
              layout
              transition={SPRING}
              className="h-full relative rounded-2xl overflow-hidden"
            >
              {tile(spotlightParticipant, true)}
            </motion.div>
          )}
        </div>
        {others.length > 0 && (
          <div className="h-16 lg:h-20 shrink-0">
            <div className="flex gap-2 h-full overflow-x-auto pb-1 scrollbar-thin">
              {others.map((p) => (
                <div key={p.identity} className="w-28 lg:w-32 shrink-0">
                  {tile(p, false)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: SPOTLIGHT MODE
  if (allParticipants.length === 1) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-4xl aspect-video">
          {tile(allParticipants[0], true)}
        </div>
      </div>
    );
  }

  if (allParticipants.length === 2 && !pinnedIdentity) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl">
          {allParticipants.map((p) => (
            <div key={p.identity} className="aspect-video">
              {tile(p, true)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showStrip = Boolean(spotlightParticipant && others.length > 2);

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      {/* Main Spotlight area */}
      <div className="flex-1 min-h-0 relative">
        {spotlightParticipant ? (
          <motion.div
            key={spotlightParticipant.identity}
            layout
            transition={SPRING}
            className="h-full relative cursor-pointer"
            onClick={() => handleSelect(spotlightParticipant)}
            data-testid={`spotlight-wrap-${spotlightParticipant.identity}`}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: spotlightIsSpeaking ? 1.02 : 1, opacity: 1 }}
              transition={SPRING}
              className={`h-full rounded-2xl overflow-hidden ${
                spotlightIsSpeaking
                  ? "shadow-[0_0_36px_-8px_rgba(139,92,246,0.7)]"
                  : ""
              }`}
            >
              {tile(spotlightParticipant, true)}
            </motion.div>
          </motion.div>
        ) : (
          <div className="h-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-fr">
            {allParticipants.map((p) => (
              <div key={p.identity} className="h-full">
                {tile(p, false)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Participant bottom strip */}
      {showStrip && (
        <div className="h-20 lg:h-24 shrink-0">
          <div className="flex gap-2 h-full overflow-x-auto pb-1 scrollbar-thin">
            {others.map((p) => (
              <div key={p.identity} className="w-32 lg:w-36 shrink-0">
                {tile(p, false)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
