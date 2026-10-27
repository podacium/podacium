"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMobileNavigation } from "@/hooks/useMobileNavigation";
import MobileActionSheet from "@/components/MobileActionSheet";
import { useBidi, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { resolveChromeMode, CHROME } from "@/lib/navigation/chrome";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { isRTL } = useBidi();
  const {
    bottomNavItems,
    fabActions,
    isScrolledDown,
    isActionSheetOpen,
    setIsActionSheetOpen,
    toggleActionSheet,
  } = useMobileNavigation();
  const t = useTranslations("nav");

  // Determine visibility from centralized chrome specification
  const chromeMode = resolveChromeMode(pathname);
  if (
    !CHROME[chromeMode].showBottomNav ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup")
  ) {
    return null;
  }

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-200/80 dark:border-slate-800/80 md:hidden print:hidden pb-safe transition-transform duration-300 ease-in-out",
          isScrolledDown && !isActionSheetOpen
            ? "translate-y-[calc(100%+2rem)]"
            : "translate-y-0",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        dir={isRTL ? "rtl" : "ltr"}
        aria-label={t("ariaMobileNav")}
      >
        <div className="flex items-center justify-around h-14 px-2 relative">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;

            // Center Prominent Action Button (FAB) Slot
            if (item.isFab) {
              return (
                <div
                  key={item.id}
                  className="flex-1 flex justify-center h-full items-center relative"
                >
                  <button
                    type="button"
                    onClick={toggleActionSheet}
                    className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center -translate-y-3.5 border-4 border-white dark:border-slate-900 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                      isActionSheetOpen &&
                        "rotate-45 scale-105 shadow-xl ring-2 ring-blue-500",
                    )}
                    aria-label={t("ariaCreateAction")}
                    aria-haspopup="dialog"
                    aria-controls="mobile-action-sheet"
                    aria-expanded={isActionSheetOpen}
                  >
                    <Icon className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>
              );
            }

            // Standard Navigation Slot
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors select-none min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-xl",
                  item.isActive
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-xl transition-all duration-200",
                    item.isActive &&
                      "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 scale-105",
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="truncate mt-0.5 max-w-[64px] text-center">
                  {t.isolate(item.name)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Render Spring Action Sheet */}
      <MobileActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        actions={fabActions}
      />
    </>
  );
}
