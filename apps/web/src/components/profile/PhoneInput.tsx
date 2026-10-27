"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "@/lib/i18n";

const PHONE_COUNTRIES = [
  {
    code: "+213",
    country: "DZ",
    name: "Algeria",
    maxDigits: 10,
    format: "__ __ __ __ __",
  },
  {
    code: "+212",
    country: "MA",
    name: "Morocco",
    maxDigits: 9,
    format: "__ __ __ __ __",
  },
  {
    code: "+216",
    country: "TN",
    name: "Tunisia",
    maxDigits: 8,
    format: "__ ___ ___",
  },
  {
    code: "+218",
    country: "LY",
    name: "Libya",
    maxDigits: 9,
    format: "__ ___ ____",
  },
  {
    code: "+20",
    country: "EG",
    name: "Egypt",
    maxDigits: 10,
    format: "__ ____ ____",
  },
  {
    code: "+966",
    country: "SA",
    name: "Saudi Arabia",
    maxDigits: 9,
    format: "__ ___ ____",
  },
  {
    code: "+971",
    country: "AE",
    name: "UAE",
    maxDigits: 9,
    format: "__ ___ ____",
  },
  {
    code: "+33",
    country: "FR",
    name: "France",
    maxDigits: 9,
    format: "_ __ __ __ __",
  },
  {
    code: "+1",
    country: "US",
    name: "United States",
    maxDigits: 10,
    format: "(___) ___-____",
  },
  {
    code: "+44",
    country: "GB",
    name: "United Kingdom",
    maxDigits: 10,
    format: "____ ______",
  },
  {
    code: "+49",
    country: "DE",
    name: "Germany",
    maxDigits: 11,
    format: "___ ________",
  },
  {
    code: "+34",
    country: "ES",
    name: "Spain",
    maxDigits: 9,
    format: "___ __ __ __",
  },
  {
    code: "+90",
    country: "TR",
    name: "Turkey",
    maxDigits: 10,
    format: "___ ___ __ __",
  },
] as const;

export function PhoneInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("profile");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCountry = useMemo(() => {
    if (!value) return PHONE_COUNTRIES[0];
    return (
      PHONE_COUNTRIES.find((c) => value.startsWith(c.code)) ||
      PHONE_COUNTRIES[0]
    );
  }, [value]);

  const localNumber = useMemo(() => {
    if (!value) return "";
    if (value.startsWith(selectedCountry.code))
      return value.slice(selectedCountry.code.length).replace(/\D/g, "");
    return value.replace(/\D/g, "");
  }, [value, selectedCountry]);

  const formatNumber = (digits: string) => {
    if (!digits) return "";
    let result = "";
    let di = 0;
    for (const ch of selectedCountry.format) {
      if (di >= digits.length) break;
      if (ch === "_") {
        result += digits[di];
        di++;
      } else {
        result += ch;
      }
    }
    return result;
  };

  const displayNumber = formatNumber(localNumber);
  const placeholder = selectedCountry.format.replace(/_/g, "0");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div className="relative" dir="ltr" ref={dropdownRef}>
      <div className="flex">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 dark:border-slate-800 border-r-0 rounded-l-xl bg-gray-50 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-sm min-w-[88px] justify-center"
          aria-label={t("phone.countryCode")}
        >
          <span className="font-mono font-medium text-gray-700 dark:text-slate-300 text-xs">
            {selectedCountry.country}
          </span>
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {selectedCountry.code}
          </span>
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <input
          type="tel"
          dir="ltr"
          value={displayNumber}
          onChange={(e) => {
            const raw = e.target.value
              .replace(/\D/g, "")
              .slice(0, selectedCountry.maxDigits);
            onChange(raw ? `${selectedCountry.code}${raw}` : "");
          }}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2.5 border border-gray-200 dark:border-slate-800 rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow tracking-wide text-left"
          aria-label={t("phone.number")}
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {PHONE_COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onChange(
                  localNumber
                    ? `${c.code}${localNumber.slice(0, c.maxDigits)}`
                    : "",
                );
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors text-left ${selectedCountry.code === c.code ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-slate-300"}`}
            >
              <span className="w-7 font-mono text-xs text-gray-500 dark:text-slate-400 uppercase">
                {c.country}
              </span>
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="text-gray-400 font-mono text-xs">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
