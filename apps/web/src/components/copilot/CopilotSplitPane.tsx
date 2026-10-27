"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useBidi, useTranslations } from "@/lib/i18n";
import { GripVertical } from "lucide-react";

export interface CopilotSplitPaneProps {
  chatSlot: React.ReactNode;
  canvasSlot: React.ReactNode;
  defaultRatio?: number; // 38 by default
  minRatio?: number; // 25
  maxRatio?: number; // 70
  className?: string;
  mobileView?: "chat" | "canvas";
}

export function CopilotSplitPane({
  chatSlot,
  canvasSlot,
  defaultRatio = 38,
  minRatio = 25,
  maxRatio = 70,
  className,
  mobileView = "chat",
}: CopilotSplitPaneProps) {
  const { isRTL } = useBidi();
  const { t } = useTranslations();
  const [ratio, setRatio] = useState<number>(defaultRatio);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [collapsedPane, setCollapsedPane] = useState<"chat" | "canvas" | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRatioRef = useRef<number>(defaultRatio);
  const ratioRef = useRef<number>(ratio);
  const rafRef = useRef<number | null>(null);
  ratioRef.current = ratio;

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        let newRatio: number;
        if (isRTL) {
          const distFromRight = rect.right - clientX;
          newRatio = (distFromRight / rect.width) * 100;
        } else {
          const distFromLeft = clientX - rect.left;
          newRatio = (distFromLeft / rect.width) * 100;
        }

        const clamped = Math.min(Math.max(newRatio, minRatio), maxRatio);
        setRatio(clamped);
        setCollapsedPane(null);
      });
    },
    [isDragging, isRTL, minRatio, maxRatio],
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDrag);
      window.addEventListener("mouseup", stopDrag);
      window.addEventListener("touchmove", handleDrag);
      window.addEventListener("touchend", stopDrag);
    }
    return () => {
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", handleDrag);
      window.removeEventListener("touchend", stopDrag);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, handleDrag, stopDrag]);

  // Keyboard Shortcuts: ⌘\ (toggle canvas), ⌘[ (collapse chat), ⌘] (collapse canvas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsedPane((prev) => {
          if (prev === "canvas") {
            setRatio(prevRatioRef.current || defaultRatio);
            return null;
          }
          prevRatioRef.current = ratioRef.current;
          return "canvas";
        });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        setCollapsedPane((prev) => {
          if (prev === "chat") {
            setRatio(prevRatioRef.current || defaultRatio);
            return null;
          }
          prevRatioRef.current = ratioRef.current;
          return "chat";
        });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        setCollapsedPane((prev) => {
          if (prev === "canvas") {
            setRatio(prevRatioRef.current || defaultRatio);
            return null;
          }
          prevRatioRef.current = ratioRef.current;
          return "canvas";
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [defaultRatio]);

  const handleSeparatorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setRatio((r) => {
          const delta = isRTL ? step : -step;
          return Math.min(Math.max(r + delta, minRatio), maxRatio);
        });
        setCollapsedPane(null);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setRatio((r) => {
          const delta = isRTL ? -step : step;
          return Math.min(Math.max(r + delta, minRatio), maxRatio);
        });
        setCollapsedPane(null);
      } else if (e.key === "Home") {
        e.preventDefault();
        setRatio(minRatio);
        setCollapsedPane(null);
      } else if (e.key === "End") {
        e.preventDefault();
        setRatio(maxRatio);
        setCollapsedPane(null);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setRatio(defaultRatio);
        setCollapsedPane(null);
      }
    },
    [isRTL, minRatio, maxRatio, defaultRatio],
  );

  const effectiveChatRatio =
    collapsedPane === "chat" ? 0 : collapsedPane === "canvas" ? 100 : ratio;
  const effectiveCanvasRatio = 100 - effectiveChatRatio;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full h-full overflow-hidden bg-background",
        isDragging && "select-none cursor-col-resize is-resizing",
        className,
      )}
    >
      {/* Mobile view (<lg screens): show only the active tab */}
      <div className="flex lg:hidden w-full h-full overflow-hidden">
        {mobileView === "chat" ? (
          <div className="w-full h-full overflow-hidden flex flex-col">
            {chatSlot}
          </div>
        ) : (
          <div className="w-full h-full overflow-hidden flex flex-col bg-muted/10 dark:bg-slate-950/40">
            {canvasSlot}
          </div>
        )}
      </div>

      {/* Desktop split-pane (>=lg screens): show resizable dual panes */}
      <div className="hidden lg:flex w-full h-full overflow-hidden">
        {/* Chat Stream (Left in LTR / Right in RTL) */}
        <div
          id="chat-panel"
          data-testid="chat-panel"
          style={{ width: `${effectiveChatRatio}%` }}
          className={cn(
            "h-full overflow-hidden transition-[width] duration-75 flex flex-col border-e border-border/70",
            isDragging && "transition-none",
            collapsedPane === "chat" && "hidden",
          )}
        >
          <div className="flex-1 overflow-y-auto h-full flex flex-col">
            {chatSlot}
          </div>
        </div>

        {/* Draggable Divider */}
        {collapsedPane === null && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuenow={Math.round(ratio)}
            aria-valuemin={minRatio}
            aria-valuemax={maxRatio}
            aria-controls="chat-panel canvas-panel"
            aria-label={t("component.copilot.splitPaneResizeHandle")}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onKeyDown={handleSeparatorKeyDown}
            onDoubleClick={() => setRatio(defaultRatio)}
            className={cn(
              "relative z-20 flex w-2.5 -mx-1.5 cursor-col-resize items-center justify-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-full touch-none",
              isDragging && "bg-primary/20",
            )}
          >
            <div className="h-8 w-1 rounded-full bg-border group-hover:bg-primary group-hover:scale-y-125 transition-all flex items-center justify-center">
              <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* Live Canvas Workspace (Right in LTR / Left in RTL) */}
        <div
          id="canvas-panel"
          data-testid="canvas-panel"
          style={{ width: `${effectiveCanvasRatio}%` }}
          className={cn(
            "h-full overflow-hidden transition-[width] duration-75 flex flex-col bg-muted/10 dark:bg-slate-950/40",
            isDragging && "transition-none",
            collapsedPane === "canvas" && "hidden",
          )}
        >
          <div className="flex-1 overflow-y-auto h-full flex flex-col">
            {canvasSlot}
          </div>
        </div>
      </div>
    </div>
  );
}
