"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Loader2,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  User,
  AlertCircle,
  RefreshCw,
  Filter,
  ChevronRight,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations } from "@/lib/i18n";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  relevance: number;
  metadata: Record<string, any>;
}

const typeConfig: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    label: string;
    href: (id: string) => string;
  }
> = {
  module: {
    icon: <BookOpen className="w-4 h-4" />,
    color: "bg-purple-100 text-purple-700",
    label: "Module",
    href: (id) => `/learn/courses/${id}`,
  },
  project: {
    icon: <Briefcase className="w-4 h-4" />,
    color: "bg-blue-100 text-blue-700",
    label: "Project",
    href: (id) => `/hub/projects/${id}`,
  },
  user: {
    icon: <User className="w-4 h-4" />,
    color: "bg-green-100 text-green-700",
    label: "Freelancer",
    href: (id) => `/profile/${id}`,
  },
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();

  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [limit] = useState(20);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const doSearch = useCallback(
    async (q: string, typeFilter?: string | null) => {
      if (!q || q.trim().length < 2) return;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: String(limit),
        });
        if (typeFilter) params.set("type", typeFilter);
        const res = await fetch(`/api/v1/search/?${params}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
      } catch (err: any) {
        setError(err.message || "Search failed");
        setResults([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery, activeType);
  }, [initialQuery, activeType, doSearch]);

  const handleSearch = () => {
    if (query.trim().length < 2) return;
    router.push(`/search/?q=${encodeURIComponent(query.trim())}`, {
      scroll: false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const resultTypes = Array.from(new Set(results.map((r) => r.type)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-slate-100 mb-2">
              {t("search.title")}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400">
              {t("search.subtitle")}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("search.placeholder")}
              className="w-full pl-12 pr-36 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-gray-200 dark:border-slate-800 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-gray-900 dark:text-slate-100 placeholder-gray-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              {isLoading && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center"
              >
                {t("search.searchButton")}
                <ArrowUpRight className="w-4 h-4 ml-2 mr-2" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl p-6 mb-8"
            >
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="text-red-800 dark:text-red-200 font-semibold">
                    {error}
                  </p>
                  <button
                    onClick={() => doSearch(query, activeType)}
                    className="mt-2 text-red-600 dark:text-red-400 text-sm flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 ml-2 mr-2" />{" "}
                    {t("search.tryAgain")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {!isLoading && initialQuery && results.length === 0 && !error && (
            <div className="text-center py-16">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("search.noResults")}
              </h2>
              <p className="text-gray-600 dark:text-slate-400">
                {t("search.tryDifferent")}
              </p>
            </div>
          )}

          {initialQuery && !isLoading && results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-600 dark:text-slate-400">
                  {t("search.resultsCount")}{" "}
                  <span className="font-semibold">{total}</span>{" "}
                  {t("common.uiLabels.resultsFor")}{" "}
                  <span className="font-semibold">
                    &ldquo;{initialQuery}&rdquo;
                  </span>
                </p>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <button
                    onClick={() => setActiveType(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!activeType ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"}`}
                  >
                    {t("search.filterAll")}
                  </button>
                  {resultTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setActiveType(activeType === type ? null : type)
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeType === type ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200"}`}
                    >
                      {type}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {results.map((result, i) => {
                  const config = typeConfig[result.type] || typeConfig.module;
                  return (
                    <motion.div
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={config.href(result.id)}
                        className="group block bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-5 hover:shadow-md hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold ${config.color}`}
                              >
                                {config.icon}
                                <span>{config.label}</span>
                              </span>
                              <span className="text-xs text-gray-400">
                                {t("search.matchPercent", {
                                  pct: Math.round(result.relevance * 100),
                                })}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 group-hover:text-blue-700 dark:text-blue-300 transition-colors truncate">
                              {result.title}
                            </h3>
                            {result.description && (
                              <p className="mt-1 text-gray-600 dark:text-slate-400 text-sm line-clamp-2">
                                {result.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 dark:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-5 animate-pulse"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-16 h-5 bg-gray-200 dark:bg-slate-800/90 rounded" />
                    <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
                  </div>
                  <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
