"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Play, RotateCcw } from "lucide-react";
import PodaciumButton, {
  buttonVariants,
} from "@/components/design-system/PodaciumButton";
import { cn } from "@/lib/utils";

/**
 * Click-to-play Vimeo facade.
 *
 * The Vimeo iframe is only mounted after an explicit user gesture (so no
 * third-party cookies/network cost on first paint) and its readiness is
 * verified through the Vimeo player postMessage handshake. When Vimeo refuses
 * to serve the video (privacy / domain restriction / takedown) the player
 * never answers `ping`, so we surface a fallback link instead of leaving a
 * silent black box in the page.
 */

const VIMEO_ORIGIN = "https://player.vimeo.com";
const DEFAULT_READY_TIMEOUT_MS = 8000;

export type VimeoEmbedState = "idle" | "loading" | "ready" | "error";

export interface VimeoEmbedLabels {
  /** Visible/accessible label of the play button. */
  play: string;
  /** Shown when the player cannot be reached. */
  unavailable: string;
  /** Label of the link that opens the video on vimeo.com. */
  watchOnVimeo: string;
  /** Label of the retry button shown in the fallback. */
  retry: string;
}

export interface VimeoEmbedProps {
  videoId: string;
  /** Accessible name of the embedded video (iframes require a title). */
  title: string;
  labels: VimeoEmbedLabels;
  /** Poster image displayed before the first click. */
  poster?: string;
  /** How long to wait for Vimeo's `ready` handshake before falling back. */
  readyTimeoutMs?: number;
  className?: string;
}

interface VimeoPlayerMessage {
  event?: string;
  method?: string;
  data?: { method?: string; message?: string; name?: string };
}

function parseMessageData(data: unknown): VimeoPlayerMessage | null {
  let payload = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload && typeof payload === "object"
    ? (payload as VimeoPlayerMessage)
    : null;
}

export function VimeoEmbed({
  videoId,
  title,
  labels,
  poster,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
  className,
}: VimeoEmbedProps) {
  const [state, setState] = useState<VimeoEmbedState>("idle");
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const embedUrl =
    `${VIMEO_ORIGIN}/video/${encodeURIComponent(videoId)}` +
    "?title=0&byline=0&portrait=0&badge=0&autopause=0&player_id=0&app_id=58479&dnt=1&autoplay=1";

  const startPlayback = useCallback(() => setState("loading"), []);

  const pingPlayer = useCallback(() => {
    const frame = iframeRef.current;
    const target = frame?.contentWindow;
    if (!target) return;
    // The frame starts on its initial `about:blank` document, which inherits
    // this origin — posting with a fixed Vimeo targetOrigin would throw there.
    // The payload carries no data, so the wildcard is safe and matches what
    // the official Vimeo SDK does for its first handshake message.
    try {
      target.postMessage(JSON.stringify({ method: "ping" }), "*");
    } catch {
      // Cross-origin frame torn down between render and ping — ignore.
    }
  }, []);

  useEffect(() => {
    if (state !== "loading") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let settled = false;

    const settle = (next: "ready" | "error") => {
      if (settled) return;
      settled = true;
      setState(next);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== VIMEO_ORIGIN) return;
      if (
        event.source &&
        iframe.contentWindow &&
        event.source !== iframe.contentWindow
      ) {
        return;
      }

      const data = parseMessageData(event.data);
      if (!data) return;

      // Vimeo reports restricted/unplayable videos as a `ready` error.
      if (data.event === "error" && data.data?.method === "ready") {
        settle("error");
        return;
      }

      // `ready` event, or the answer to the `ping` we send on mount.
      if (data.event === "ready" || data.method === "ping") {
        settle("ready");
      }
    };

    window.addEventListener("message", handleMessage);
    const timeoutId = window.setTimeout(() => settle("error"), readyTimeoutMs);

    // The frame may have become ready before this effect subscribed.
    pingPlayer();

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeoutId);
    };
  }, [state, readyTimeoutMs, pingPlayer]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    setState("idle");
  }, []);

  return (
    <div
      data-vimeo-state={state}
      className={cn(
        "relative h-full w-full overflow-hidden bg-slate-950",
        className,
      )}
      aria-busy={state === "loading" || undefined}
    >
      {state !== "idle" && (
        <iframe
          key={attempt}
          ref={iframeRef}
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={pingPlayer}
        />
      )}

      {state === "idle" && (
        <button
          type="button"
          onClick={startPlayback}
          aria-label={labels.play}
          className="group absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60 focus-visible:ring-inset"
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-slate-950/40 transition-colors duration-300 group-hover:from-slate-950/70"
          />
          <span className="relative z-10 flex flex-col items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none">
              <Play
                aria-hidden="true"
                className="ms-1 h-7 w-7"
                fill="currentColor"
              />
            </span>
            <span className="text-sm font-medium text-white/90">
              {labels.play}
            </span>
          </span>
        </button>
      )}

      {state === "loading" && (
        <span
          role="status"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
          />
        </span>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 text-center backdrop-blur-sm"
        >
          <AlertTriangle
            aria-hidden="true"
            className="h-8 w-8 text-amber-400"
          />
          <p className="max-w-sm text-sm text-slate-200">
            {labels.unavailable}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://vimeo.com/${encodeURIComponent(videoId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "gradient", size: "sm" })}
            >
              <ExternalLink aria-hidden="true" className="me-2 h-4 w-4" />
              {labels.watchOnVimeo}
            </a>
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={retry}
              icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              className="border-white/20 text-white hover:bg-white/10 dark:border-white/20 dark:text-white"
            >
              {labels.retry}
            </PodaciumButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default VimeoEmbed;
