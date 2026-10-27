"use client";

import React, { useState, useEffect } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track, type RemoteTrackPublication } from "livekit-client";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export function AudioOnlyToggle() {
  const t = useTranslations("live");
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [audioOnly, setAudioOnly] = useState(false);

  const toggle = () => {
    const next = !audioOnly;
    setAudioOnly(next);
    if (next) {
      // Disable local camera uplink to conserve outbound cellular bandwidth
      localParticipant?.setCameraEnabled(false);
      // Unsubscribe from all remote video tracks downlinked by the SFU
      if (room) {
        room.remoteParticipants.forEach((p) => {
          p.videoTrackPublications.forEach((pub) => {
            pub.setSubscribed(false);
            pub.setEnabled(false);
          });
        });
      }
    } else {
      localParticipant?.setCameraEnabled(true);
      if (room) {
        room.remoteParticipants.forEach((p) => {
          p.videoTrackPublications.forEach((pub) => {
            pub.setSubscribed(true);
            pub.setEnabled(true);
          });
        });
      }
    }
  };

  useEffect(() => {
    if (!room || !audioOnly) return;

    // Proactively prevent new remote video tracks from downloading over cellular
    const handleTrackPublished = (pub: RemoteTrackPublication) => {
      if (pub && pub.kind === Track.Kind.Video) {
        pub.setSubscribed(false);
        pub.setEnabled(false);
      }
    };

    const handleTrackSubscribed = (
      _track: unknown,
      pub: RemoteTrackPublication,
    ) => {
      if (pub && pub.kind === Track.Kind.Video) {
        pub.setSubscribed(false);
        pub.setEnabled(false);
      }
    };

    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, audioOnly]);

  return (
    <button
      onClick={toggle}
      className={`min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all active:scale-95 ${
        audioOnly
          ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400"
          : "bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/80 hover:text-white"
      }`}
      title={audioOnly ? t("room.switchToVideo") : t("room.switchToAudio")}
      aria-label={audioOnly ? t("room.switchToVideo") : t("room.switchToAudio")}
    >
      {audioOnly ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <VolumeX className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {audioOnly ? t("room.audio") : t("room.video")}
      </span>
    </button>
  );
}
