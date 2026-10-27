"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations, useBidi } from "@/lib/i18n";

interface ViewAsToggleProps {
  value: "public" | "followers" | "self";
  onChange: (value: "public" | "followers" | "self") => void;
}

export function ViewAsToggle({ value, onChange }: ViewAsToggleProps) {
  const t = useTranslations("profile.viewAs");
  const { dir, isRTL, textAlign } = useBidi();
  const [open, setOpen] = useState(false);

  const options = [
    { value: "public" as const, label: t("public") },
    { value: "followers" as const, label: t("follower") },
    { value: "self" as const, label: t("self") },
  ];

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 transition-colors"
      >
        <Eye className="w-4 h-4" />
        <span>{selected?.label}</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            dir={dir}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className={cn(
              "absolute top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg z-50 py-1",
              isRTL ? "right-0" : "left-0",
            )}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span
                  className="flex-1"
                  style={{ textAlign: textAlign("left") }}
                >
                  {opt.label}
                </span>
                {value === opt.value && (
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
