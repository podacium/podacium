"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  motion,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  enabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
  enabled = true,
}: PullToRefreshProps) {
  const t = useTranslations("common");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullProgress = useSpring(0, { stiffness: 300, damping: 30 });
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);

  const indicatorY = useTransform(pullProgress, [0, 1], [-60, 0]);
  const indicatorScale = useTransform(pullProgress, [0, 1], [0.6, 1]);
  const arrowRotation = useTransform(pullProgress, [0, 0.5, 1], [0, 0, 180]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    },
    [enabled, isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      currentYRef.current = e.touches[0].clientY;
      const diff = currentYRef.current - startYRef.current;
      if (diff > 10) {
        isPullingRef.current = true;
        const progress = Math.min(diff / threshold, 1.5);
        pullProgress.set(progress);
      }
    },
    [enabled, isRefreshing, threshold, pullProgress],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    const diff = currentYRef.current - startYRef.current;
    if (diff >= threshold) {
      setIsRefreshing(true);
      pullProgress.set(1);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        pullProgress.set(0);
      }
    } else {
      pullProgress.set(0);
    }
  }, [threshold, onRefresh, pullProgress]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-auto overscroll-behavior-y-contain",
        className,
      )}
    >
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute inset-x-0 top-0 z-50 flex items-center justify-center h-12 bg-background/80 backdrop-blur-sm border-b border-border"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("refreshing")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        style={{ y: indicatorY, scale: indicatorScale }}
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-center h-12 pointer-events-none"
      >
        <div className="flex flex-col items-center gap-0.5">
          <motion.div style={{ rotate: arrowRotation }}>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
          <span className="text-[10px] font-medium text-muted-foreground/60">
            {t("pullToRefresh")}
          </span>
        </div>
      </motion.div>

      {children}
    </div>
  );
}
