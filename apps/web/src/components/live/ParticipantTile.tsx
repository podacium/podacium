"use client";

import React, { useState } from "react";
import {
  useIsSpeaking,
  VideoTrack,
  useRoomContext,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import {
  MicOff,
  Hand,
  Crown,
  Star,
  MoreVertical,
  Pin,
  VolumeX,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useHandRaise } from "./HandRaiseContext";

interface Props {
  participant: Participant;
  isHost?: boolean;
  isCoHost?: boolean;
  large?: boolean;
  pinned?: boolean;
  onPin?: () => void;
}

function SpeakingWaveform({ title }: { title?: string }) {
  return (
    <div
      className="flex items-end gap-0.5 h-4 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white shadow-xs overflow-hidden"
      title={title}
    >
      <span className="w-0.5 bg-white rounded-full h-3 animate-[equalizer_0.7s_ease-in-out_infinite] origin-bottom [animation-delay:-0.4s]" />
      <span className="w-0.5 bg-white rounded-full h-3.5 animate-[equalizer_0.6s_ease-in-out_infinite] origin-bottom [animation-delay:-0.2s]" />
      <span className="w-0.5 bg-white rounded-full h-2.5 animate-[equalizer_0.8s_ease-in-out_infinite] origin-bottom [animation-delay:-0.5s]" />
    </div>
  );
}

function ParticipantTileComponent({
  participant,
  isHost = false,
  isCoHost = false,
  large = false,
  pinned = false,
  onPin,
}: Props) {
  const t = useTranslations("live");
  const room = useRoomContext();
  const isSpeaking = useIsSpeaking(participant);
  const identity = participant.identity;
  const name = participant.name || identity;
  const isCameraMuted = !participant.isCameraEnabled;
  const isMicMuted = !participant.isMicrophoneEnabled;
  const cameraTrack = participant.getTrackPublication?.(Track.Source.Camera);
  const { isHandRaised } = useHandRaise();
  const handRaised = isHandRaised(identity);

  const [menuOpen, setMenuOpen] = useState(false);

  const avatarLetter = (name || "?")[0].toUpperCase();

  const handleMuteRemote = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      console.error("Mute remote error:", err);
    }
    setMenuOpen(false);
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden bg-slate-900 border border-white/10 transition-all duration-300 ${
        isSpeaking
          ? "ring-2 ring-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
          : "hover:border-white/20"
      } ${large ? "w-full h-full" : "aspect-video"}`}
    >
      {!isCameraMuted && cameraTrack?.track ? (
        <VideoTrack
          trackRef={{
            participant,
            publication: cameraTrack,
            source: Track.Source.Camera,
          }}
          className={`w-full h-full ${
            cameraTrack?.source === Track.Source.ScreenShare
              ? "object-contain bg-slate-950"
              : participant.isLocal
                ? "object-cover -scale-x-100"
                : "object-cover"
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.15),transparent_65%)]"
          />
          <div
            className={`relative rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 shadow-xl shadow-purple-950/50 ring-2 ring-white/20 flex items-center justify-center ${
              large ? "w-24 h-24" : "w-12 h-12"
            }`}
          >
            <span
              className={`font-bold text-white ${large ? "text-3xl" : "text-base"}`}
            >
              {avatarLetter}
            </span>
          </div>
        </div>
      )}

      {/* Top Bar Badges */}
      <div className="absolute top-2 inset-x-2 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {handRaised && (
            <span className="flex items-center gap-1 bg-amber-400 text-slate-950 text-xs font-semibold px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs">
              <Hand className="h-3.5 w-3.5" />
              <span>{t("room.handRaise.raised", { name })}</span>
            </span>
          )}
          {pinned && (
            <span className="p-1.5 rounded-full bg-slate-900/80 text-purple-400 border border-purple-500/30 shadow-md">
              <Pin className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {isSpeaking && <SpeakingWaveform title={t("room.speaking")} />}

          {/* Action Menu button (Touch Ergonomics: >= 48x48px on mobile, visible on touch devices) */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 active:bg-slate-800 text-white backdrop-blur-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all active:scale-95"
              title={t("common.options")}
              aria-label={t("room.participantOptions")}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full mt-1.5 end-0 w-44 rounded-2xl border border-white/15 bg-slate-950/98 p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs text-white"
              >
                {onPin && (
                  <button
                    onClick={() => {
                      onPin();
                      setMenuOpen(false);
                    }}
                    className="w-full min-h-[48px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start hover:bg-white/10 text-gray-200 hover:text-white transition-colors active:scale-95"
                  >
                    <Pin className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-medium">
                      {pinned ? t("room.pin.unpin") : t("room.pin.pin")}
                    </span>
                  </button>
                )}
                {!participant.isLocal && (
                  <button
                    onClick={handleMuteRemote}
                    className="w-full min-h-[48px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start hover:bg-red-500/20 text-red-300 transition-colors active:scale-95"
                  >
                    <VolumeX className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-medium">
                      {t("room.hostControls.mute")}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Name Overlay */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {isHost && (
              <Crown
                className={`${large ? "h-4 w-4" : "h-3.5 w-3.5"} text-amber-400 shrink-0`}
              />
            )}
            {isCoHost && (
              <Star
                className={`${large ? "h-4 w-4" : "h-3.5 w-3.5"} text-blue-400 shrink-0`}
              />
            )}
            <span
              className={`text-white font-medium truncate ${large ? "text-sm" : "text-xs"}`}
            >
              {name}
              {participant.isLocal && ` (${t("common.you")})`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isMicMuted && (
              <span className="flex items-center justify-center bg-red-500/80 text-white p-1.5 rounded-lg">
                <MicOff className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center name overlay for large tiles with no video */}
      {large && isCameraMuted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 ring-4 ring-white/10 shadow-2xl shadow-purple-950/60 mx-auto mb-3 flex items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {avatarLetter}
              </span>
            </div>
            <p className="text-white text-lg font-semibold drop-shadow-sm">
              {name}
            </p>
            <p className="text-gray-400 text-xs drop-shadow-sm mt-0.5">
              {isMicMuted ? t("common.microphoneOff") : t("common.audioOnly")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export const ParticipantTile = React.memo(
  ParticipantTileComponent,
  (prev, next) => {
    return (
      prev.participant.identity === next.participant.identity &&
      prev.participant.isCameraEnabled === next.participant.isCameraEnabled &&
      prev.participant.isMicrophoneEnabled ===
        next.participant.isMicrophoneEnabled &&
      prev.isHost === next.isHost &&
      prev.isCoHost === next.isCoHost &&
      prev.large === next.large &&
      prev.pinned === next.pinned &&
      prev.onPin === next.onPin
    );
  },
);
