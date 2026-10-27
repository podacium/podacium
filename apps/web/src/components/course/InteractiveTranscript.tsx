"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, FileText } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface TranscriptCue {
  id: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface InteractiveTranscriptProps {
  vttUrl?: string;
  currentTime: number;
  onSeekTo?: (seconds: number) => void;
  className?: string;
}

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({
  vttUrl,
  currentTime,
  onSeekTo,
  className = "",
}) => {
  const { t } = useTranslations("component");
  const [cues, setCues] = useState<TranscriptCue[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Fetch and parse WebVTT file
  useEffect(() => {
    if (!vttUrl) return;
    setLoading(true);

    fetch(vttUrl)
      .then((res) => res.text())
      .then((vttText) => {
        const parsedCues: TranscriptCue[] = [];
        const lines = vttText.split("\n");
        let currentCue: Partial<TranscriptCue> = {};
        let cueId = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes("-->")) {
            const [startStr, endStr] = line.split("-->").map((s) => s.trim());
            const parseTime = (tStr: string) => {
              const parts = tStr.split(":");
              if (parts.length === 3) {
                return (
                  parseFloat(parts[0]) * 3600 +
                  parseFloat(parts[1]) * 60 +
                  parseFloat(parts[2])
                );
              } else if (parts.length === 2) {
                return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
              }
              return 0;
            };
            currentCue.startSeconds = parseTime(startStr);
            currentCue.endSeconds = parseTime(endStr);
          } else if (
            line &&
            !line.startsWith("WEBVTT") &&
            !line.startsWith("NOTE")
          ) {
            if (currentCue.startSeconds !== undefined) {
              parsedCues.push({
                id: cueId++,
                startSeconds: currentCue.startSeconds,
                endSeconds:
                  currentCue.endSeconds || currentCue.startSeconds + 3,
                text: line,
              });
              currentCue = {};
            }
          }
        }
        setCues(parsedCues);
      })
      .catch((err) => console.warn("Failed to load VTT subtitles", err))
      .finally(() => setLoading(false));
  }, [vttUrl]);

  // Auto-scroll active cue into view
  useEffect(() => {
    if (activeCueRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime]);

  const filteredCues = cues.filter((cue) =>
    cue.text.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatTimestamp = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!vttUrl) return null;

  return (
    <div
      className={`flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-slate-100">
            {t("compcourse.transcript.title")}
          </h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {t("compcourse.transcript.cues", { count: String(cues.length) })}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("compcourse.transcript.searchPlaceholder")}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Cue List */}
      <div className="flex-1 overflow-y-auto space-y-2 pe-1 text-xs">
        {loading ? (
          <div className="text-center text-slate-500 py-8">
            {t("compcourse.transcript.loading")}
          </div>
        ) : filteredCues.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            {t("compcourse.transcript.empty")}
          </div>
        ) : (
          filteredCues.map((cue) => {
            const isActive =
              currentTime >= cue.startSeconds && currentTime <= cue.endSeconds;

            return (
              <div
                key={cue.id}
                ref={isActive ? activeCueRef : null}
                onClick={() => onSeekTo && onSeekTo(cue.startSeconds)}
                className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start space-x-3 ${
                  isActive
                    ? "bg-blue-600/20 border border-blue-500/40 text-blue-200 font-medium"
                    : "hover:bg-slate-800/40 text-slate-300"
                }`}
              >
                <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                  {formatTimestamp(cue.startSeconds)}
                </span>
                <p className="leading-relaxed flex-1">{cue.text}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
