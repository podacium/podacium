"use client";

import { cn } from "@/lib/utils";
import { DrawerContent, PodaciumDrawer } from "@/components/design-system";

export interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  allowDesktop?: boolean;
}

/**
 * Off-canvas navigation panel. The sidebar child owns its own surface
 * (background, border, width), so the drawer itself stays transparent.
 */
export function MobileNavDrawer({
  open,
  onClose,
  labelledBy = "workspace-sidebar-drawer",
  children,
  returnFocusRef,
  allowDesktop = false,
}: MobileNavDrawerProps) {
  const hiddenBelowLg = allowDesktop ? undefined : "lg:hidden";

  return (
    <PodaciumDrawer
      isOpen={open}
      onClose={onClose}
      position="start"
      size="auto"
      labelledBy={labelledBy}
    >
      <DrawerContent
        className={cn(
          "rounded-none border-0 bg-transparent shadow-2xl dark:bg-transparent",
          hiddenBelowLg,
        )}
        overlayClassName={cn("bg-black/40", hiddenBelowLg)}
        returnFocusRef={returnFocusRef}
      >
        {children}
      </DrawerContent>
    </PodaciumDrawer>
  );
}

export default MobileNavDrawer;
