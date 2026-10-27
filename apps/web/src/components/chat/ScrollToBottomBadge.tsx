"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ScrollToBottomBadgeProps {
  visible: boolean;
  unreadCount: number;
  onClick: () => void;
  label?: string;
  unreadLabel?: string;
  className?: string;
}

export function ScrollToBottomBadge({
  visible,
  unreadCount,
  onClick,
  label = "Nouveaux messages",
  unreadLabel = "tokens",
  className,
}: ScrollToBottomBadgeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onClick}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          aria-label={
            unreadCount > 0 ? `${label} (${unreadCount} ${unreadLabel})` : label
          }
          className={cn(
            "absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2",
            "items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-1.5",
            "text-xs font-medium text-foreground shadow-lg backdrop-blur-md",
            "hover:bg-card hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <ChevronDown className="h-4 w-4 text-primary animate-bounce" />
          <span>{label}</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
