"use client";

import React, { useEffect, useState, useRef } from "react";

export type StreamLifecycleStatus =
  "idle" | "thinking" | "streaming" | "completed" | "stopped" | "error";

export interface AgentAccessibilityAnnouncerProps {
  status: StreamLifecycleStatus;
  assistantName?: string;
  errorMessage?: string;
  locale?: string;
  activeTool?: string | null;
}

const MESSAGES = {
  en: {
    thinking: "Thinking. Please wait.",
    streaming: "Assistant is replying.",
    completed: "Assistant finished replying.",
    stopped: "Generation stopped.",
    error: "Failed to generate reply.",
  },
  fr: {
    thinking: "En réflexion. Veuillez patienter.",
    streaming: "L'assistant répond.",
    completed: "L'assistant a terminé sa réponse.",
    stopped: "Génération interrompue.",
    error: "Échec de génération de la réponse.",
  },
  ar: {
    thinking: "جارٍ التفكير. يرجى الانتظار.",
    streaming: "المساعد يقوم بالرد الآن.",
    completed: "أكمل المساعد الرد.",
    stopped: "تم إيقاف الإنشاء.",
    error: "تعذر إنشاء الرد.",
  },
  kab: {
    thinking: "Asugen... rǧu kra.",
    streaming: "Amallal yerra-d tura.",
    completed: "Amallal ifuk tiririt.",
    stopped: "Iḥbes usekmem.",
    error: "Ur yezmir ara ad d-yerr.",
  },
} as const;

export function AgentAccessibilityAnnouncer({
  status,
  assistantName = "Podacium AI",
  errorMessage,
  locale = "fr",
  activeTool,
}: AgentAccessibilityAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<string>("");
  const prevStatusRef = useRef<StreamLifecycleStatus>("idle");

  const activeLocale = (
    locale in MESSAGES ? locale : "fr"
  ) as keyof typeof MESSAGES;
  const strings = MESSAGES[activeLocale];

  useEffect(() => {
    if (status === prevStatusRef.current) return;
    prevStatusRef.current = status;

    let text = "";
    switch (status) {
      case "thinking":
        text = `${assistantName}: ${strings.thinking}`;
        break;
      case "streaming":
        text = `${assistantName}: ${strings.streaming}`;
        break;
      case "completed":
        text = `${assistantName}: ${strings.completed}`;
        break;
      case "stopped":
        text = strings.stopped;
        break;
      case "error":
        text = errorMessage || strings.error;
        break;
      default:
        text = "";
    }

    if (text) {
      setAnnouncement("");
      const timer = window.setTimeout(() => setAnnouncement(text), 60);
      return () => window.clearTimeout(timer);
    }
  }, [status, assistantName, errorMessage, strings]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
