"use client";

import React from "react";
import { useIsRecording } from "@livekit/components-react";
import { useTranslations } from "@/lib/i18n";

export function RecordingIndicator() {
  const t = useTranslations("live");
  const isRecording = useIsRecording();

  if (!isRecording) return null;

  return (
    <span className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      {t("room.recording")}
    </span>
  );
}
