import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useBidi } from "@/lib/i18n";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  count?: number;
  content?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children?: ((activeTab: string) => React.ReactNode) | React.ReactNode;
  variant?: "underline" | "pills" | "enclosed" | "glass";
  className?: string;
  tabsClassName?: string;
}

const activeIndicator = {
  pills:
    "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-slate-800",
  glass:
    "bg-white/90 dark:bg-slate-900/90 text-blue-700 shadow-md border border-blue-100 backdrop-blur-sm",
};

const PodaciumTabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  children,
  variant = "underline",
  className,
  tabsClassName,
}) => {
  const { isRTL } = useBidi();
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const enabledTabs = tabs.filter((t) => !t.disabled);

  const handleKeyDown = (e: React.KeyboardEvent, currentId: string) => {
    if (enabledTabs.length === 0) return;
    const currentIndex = enabledTabs.findIndex((t) => t.id === currentId);
    let targetIndex = -1;

    const nextKey = isRTL ? "ArrowLeft" : "ArrowRight";
    const prevKey = isRTL ? "ArrowRight" : "ArrowLeft";

    if (e.key === nextKey) {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (e.key === prevKey) {
      e.preventDefault();
      targetIndex =
        (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = enabledTabs.length - 1;
    }

    if (targetIndex >= 0) {
      const targetTab = enabledTabs[targetIndex];
      handleTabChange(targetTab.id);
      const targetButton = tabRefs.current.get(targetTab.id);
      targetButton?.focus();
    }
  };

  const listBase = {
    underline: "border-b border-gray-200 dark:border-slate-800 gap-0",
    pills: "bg-gray-100/80 dark:bg-slate-800/80 rounded-xl p-1 gap-0",
    enclosed: "border-b border-gray-200 dark:border-slate-800 gap-0",
    glass:
      "bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl p-1.5 border border-gray-200/50 dark:border-slate-800/50 shadow-sm gap-0",
  }[variant];

  const tabBase = {
    underline:
      "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-200",
    pills:
      "px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 relative",
    enclosed:
      "px-4 py-2.5 text-sm font-medium border border-b-0 rounded-t-lg -mb-px transition-all duration-200",
    glass:
      "px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative",
  }[variant];

  return (
    <div className={className}>
      <div
        className={cn(
          "flex overflow-x-auto no-scrollbar scroll-smooth",
          listBase,
          tabsClassName,
        )}
        role="tablist"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              onKeyDown={(e) => !tab.disabled && handleKeyDown(e, tab.id)}
              disabled={tab.disabled}
              className={cn(
                tabBase,
                "flex items-center gap-2 whitespace-nowrap select-none",
                variant === "pills" || variant === "glass"
                  ? isActive
                    ? activeIndicator[variant]
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200"
                  : isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-700",
                tab.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    "transition-transform duration-200",
                    isActive && "scale-110",
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full transition-all duration-200",
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-200 dark:bg-slate-800/90 text-gray-600 dark:text-slate-400",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="pt-4"
      >
        {typeof children === "function"
          ? children(activeTab)
          : (children ?? activeTabData?.content)}
      </div>
    </div>
  );
};

PodaciumTabs.displayName = "PodaciumTabs";
export { PodaciumTabs };
export default PodaciumTabs;
