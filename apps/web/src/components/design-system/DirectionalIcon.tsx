"use client";

import React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Universal physical objects that MUST NOT be mirrored in RTL
const UNIVERSAL_PHYSICAL_ICONS = new Set([
  "Play",
  "Pause",
  "Square",
  "Volume",
  "Volume1",
  "Volume2",
  "VolumeX",
  "Clock",
  "Clock4",
  "Search",
  "Shield",
  "ShieldCheck",
  "ShieldAlert",
  "Check",
  "CheckCircle",
  "CheckCircle2",
  "CheckSquare",
  "Camera",
  "Mic",
  "Phone",
  "FileText",
  "Loader2",
  "RefreshCw",
]);

// Directional progression icons that MUST be mirrored in RTL
const DIRECTIONAL_PROGRESSION_ICONS = new Set([
  "ArrowRight",
  "ArrowLeft",
  "ChevronRight",
  "ChevronLeft",
  "ChevronsRight",
  "ChevronsLeft",
  "CornerDownRight",
  "CornerDownLeft",
  "CornerUpRight",
  "CornerUpLeft",
  "MoveRight",
  "MoveLeft",
  "ArrowUpRight",
  "ArrowDownRight",
  "History",
  "Redo",
  "Undo",
  "ExternalLink",
]);

export interface DirectionalIconProps extends React.ComponentPropsWithoutRef<"svg"> {
  /** The Lucide icon component to render */
  icon: LucideIcon;
  /**
   * Directional behavior override:
   * - "auto": automatically determine based on icon name per Apple HIG & W3C i18n
   * - "mirror": force rotate-180 in RTL
   * - "preserve": never rotate (universal physical object)
   * Default: "auto"
   */
  behavior?: "auto" | "mirror" | "preserve";
  /** Icon size */
  size?: number | string;
}

/**
 * DirectionalIcon renders an SVG icon with automatic RTL mirroring compliance
 * conforming to Apple Human Interface Guidelines for Arabic RTL and W3C i18n rules.
 */
export const DirectionalIcon: React.FC<DirectionalIconProps> = ({
  icon: IconComponent,
  behavior = "auto",
  className,
  size = 18,
  ...props
}) => {
  const iconName = IconComponent.displayName || IconComponent.name || "";

  let shouldMirror = false;
  if (behavior === "mirror") {
    shouldMirror = true;
  } else if (behavior === "preserve") {
    shouldMirror = false;
  } else {
    // "auto" detection
    if (UNIVERSAL_PHYSICAL_ICONS.has(iconName)) {
      shouldMirror = false;
    } else if (DIRECTIONAL_PROGRESSION_ICONS.has(iconName)) {
      shouldMirror = true;
    } else if (
      iconName.includes("Right") ||
      iconName.includes("Left") ||
      iconName.includes("Chevron") ||
      iconName.includes("Arrow")
    ) {
      shouldMirror = true;
    }
  }

  return (
    <IconComponent
      size={size}
      className={cn(
        shouldMirror && "rtl:rotate-180 rtl:transform transition-transform",
        className,
      )}
      data-testid="directional-icon"
      aria-hidden="true"
      {...props}
    />
  );
};

export default DirectionalIcon;
