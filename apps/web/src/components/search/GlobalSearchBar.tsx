"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, ArrowUpRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";

interface SearchSuggestion {
  id: string;
  type: string;
  title: string;
}

export default function GlobalSearchBar() {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(
    (q?: string) => {
      const term = (q || query).trim();
      if (!term || term.length < 2) return;
      router.push(`/search/?q=${encodeURIComponent(term)}`);
      setIsOpen(false);
      setQuery("");
    },
    [query, router],
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/v1/search/?q=${encodeURIComponent(query)}&limit=5`,
        );
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder={t("search.placeholder")}
          className="w-full pl-9 pr-16 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 focus:bg-white dark:bg-slate-900 border border-transparent focus:border-blue-500 rounded-lg text-sm text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {isSearching && (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          )}
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSuggestions([]);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={panelRef}
          className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                const dest =
                  s.type === "module"
                    ? `/learn/courses/${s.id}`
                    : s.type === "project"
                      ? `/hub/projects/${s.id}`
                      : `/profile/${s.id}`;
                router.push(dest);
                setIsOpen(false);
                setQuery("");
              }}
              className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 text-left transition-colors"
            >
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {s.type}
              </span>
              <span className="text-sm text-gray-900 dark:text-slate-100 truncate flex-1">
                {s.title}
              </span>
            </button>
          ))}
          <button
            onClick={() => handleSearch()}
            className="w-full flex items-center justify-center px-4 py-2.5 bg-gray-50 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm text-blue-600 dark:text-blue-400 font-medium border-t border-gray-100 dark:border-slate-800 transition-colors"
          >
            <Search className="w-3.5 h-3.5 ml-2 mr-2" />
            {t("search.viewAllResults")}
          </button>
        </div>
      )}
    </div>
  );
}
