"use client";

import React from "react";
import { X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DrawerBody,
  DrawerContent,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Swipe-to-dismiss sheet used by the live room. Always dark, because it sits on
 * top of video.
 */
export function BottomSheet({
  open,
  onClose,
  title = "",
  children,
  className = "",
  contentClassName = "",
}: Props) {
  const t = useTranslations("live");

  return (
    <PodaciumDrawer
      isOpen={open}
      onClose={onClose}
      position="bottom"
      size="auto"
      variant="dismissible"
      className={cn(
        "rounded-t-3xl border-t border-white/15 bg-slate-950/[0.98] p-4 pb-safe text-white shadow-2xl dark:border-slate-800/60 dark:bg-slate-950/[0.98]",
        className,
      )}
      overlayClassName="z-40 bg-black/60"
    >
      <DrawerContent>
        {/* Visual drag handle with enlarged touch target */}
        <div
          className="-mt-1 mb-2 flex shrink-0 cursor-grab touch-none justify-center py-1 active:cursor-grabbing"
          aria-hidden="true"
        >
          <div className="h-1.5 w-12 rounded-full bg-white/30" />
        </div>

        <div className="mb-3 flex shrink-0 items-center justify-between">
          {title ? (
            <DrawerTitle className="truncate pe-2 text-base font-semibold text-white">
              {title}
            </DrawerTitle>
          ) : (
            <DrawerTitle className="sr-only">{t("room.more")}</DrawerTitle>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 active:bg-white/10"
            aria-label={t("room.more.close")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <DrawerBody
          className={cn(
            "flex flex-col overscroll-contain p-0",
            contentClassName,
          )}
        >
          {children}
        </DrawerBody>
      </DrawerContent>
    </PodaciumDrawer>
  );
}
