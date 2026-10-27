"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Check,
  GraduationCap,
  Briefcase,
  Building2,
  UserCog,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface RoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function RoleSelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: RoleSelectorProps) {
  const t = useTranslations("profile");

  const ROLE_OPTIONS = [
    {
      value: "STUDENT",
      label: t("roles.student"),
      icon: GraduationCap,
      color: "text-blue-600",
    },
    {
      value: "FREELANCER",
      label: t("roles.freelancer"),
      icon: Briefcase,
      color: "text-purple-600",
    },
    {
      value: "BUSINESS",
      label: t("roles.business"),
      icon: Building2,
      color: "text-green-600",
    },
    {
      value: "INSTRUCTOR",
      label: t("roles.instructor"),
      icon: UserCog,
      color: "text-yellow-600",
    },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected =
    ROLE_OPTIONS.find((o) => o.value === value) || ROLE_OPTIONS[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl text-left transition-all duration-200 ${
          disabled
            ? "bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-400 cursor-not-allowed"
            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-blue-300 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
            <SelectedIcon className={`h-5 w-5 ${selected.color}`} />
          </div>
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {selected.label}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-500 dark:text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="py-1">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${isSelected ? "bg-blue-100 dark:bg-blue-900/50" : "bg-gray-100 dark:bg-slate-800"}`}
                      >
                        <Icon
                          className={`h-5 w-5 ${isSelected ? option.color : "text-gray-600 dark:text-slate-400"}`}
                        />
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </div>
                    {isSelected && (
                      <Check
                        size={18}
                        className="text-blue-500 dark:text-blue-400"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && !disabled && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
