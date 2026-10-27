"use client";

import React from "react";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Monitor } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export function ScreenShareOverlay() {
  const t = useTranslations("live");
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  if (screenShareTracks.length === 0) return null;

  const trackRef = screenShareTracks[0];
  const participant = trackRef.participant as Participant | undefined;

  return (
    <div className="absolute inset-0 z-40 bg-gray-900 flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute top-4 start-4 z-10 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-lg">
          <Monitor className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-medium">
            {participant?.name
              ? t("room.screenShare.from", { name: participant.name })
              : t("room.shareScreen")}
          </span>
        </div>
        <div className="w-full h-full">
          <VideoTrack
            trackRef={trackRef}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
