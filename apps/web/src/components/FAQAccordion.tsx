"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  HelpCircle,
  ArrowRight,
  Search,
  X,
  ThumbsUp,
  ThumbsDown,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { FAQPageJsonLd } from "@/components/StructuredData";

export interface FAQItem {
  id?: string;
  question: string;
  answer: string;
  category?: string;
  keywords?: string[];
}

export interface FAQCategory {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FAQCta {
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
}

export type FAQVariant = "section" | "embedded" | "callout";

export interface FAQAccordionProps {
  items: Array<
    FAQItem | { q: string; a: string; category?: string; id?: string }
  >;
  categories?: FAQCategory[];
  title?: string;
  subtitle?: string;
  variant?: FAQVariant;
  searchable?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  multiOpen?: boolean;
  defaultOpenIds?: string[];
  cta?: FAQCta;
  allLabel?: string;
  showJsonLd?: boolean;
  showFeedback?: boolean;
  className?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  headingLevel?: "h2" | "h3" | "h4";
}

const ANIMATION = {
  SPRING: { type: "spring" as const, stiffness: 250, damping: 25, mass: 0.8 },
  PANEL: {
    duration: 0.28,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
};

/**
 * Normalizes raw input items from different schemas ({question, answer}, {q, a}, or object maps)
 */
export function normalizeFaqItems(raw: unknown): FAQItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((item) => item && typeof item === "object")
      .map((item, idx) => {
        const anyItem = item as Record<string, any>;
        const q = anyItem.question || anyItem.q || "";
        const a = anyItem.answer || anyItem.a || "";
        const cat = anyItem.category;
        const id =
          anyItem.id ||
          `faq-${cat ? `${cat}-` : ""}${idx}-${q.slice(0, 16).replace(/\s+/g, "_").toLowerCase()}`;
        return {
          id,
          question: q,
          answer: a,
          category: cat,
          keywords: anyItem.keywords,
        };
      })
      .filter((item) => item.question && item.answer);
  }

  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, any>)
      .flatMap(([catOrIdx, val]) => {
        if (!val || typeof val !== "object") return [];
        if (Array.isArray(val)) {
          return val.map((subVal, idx) => ({
            id: `faq-${catOrIdx}-${idx}`,
            question: subVal.question || subVal.q || "",
            answer: subVal.answer || subVal.a || "",
            category: catOrIdx,
          }));
        }
        if ("question" in val || "q" in val) {
          return [
            {
              id: `faq-${catOrIdx}`,
              question: val.question || val.q || "",
              answer: val.answer || val.a || "",
              category: val.category || catOrIdx,
            },
          ];
        }
        return Object.entries(val).map(([idx, item]: [string, any]) => ({
          id: `faq-${catOrIdx}-${idx}`,
          question: item.question || item.q || "",
          answer: item.answer || item.a || "",
          category: catOrIdx,
        }));
      })
      .filter((item) => item.question && item.answer);
  }

  return [];
}

/**
 * Highlights matching search substrings safely
 */
function HighlightText({
  text,
  highlight,
}: {
  text: string;
  highlight: string;
}) {
  const trimmed = highlight.trim();
  if (!trimmed) return <>{text}</>;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={i}
            className="bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded px-1 py-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export const FAQAccordion: React.FC<FAQAccordionProps> = ({
  items: rawItems,
  categories,
  title,
  subtitle,
  variant = "section",
  searchable = false,
  searchQuery: controlledSearchQuery,
  onSearchChange,
  multiOpen = false,
  defaultOpenIds = [],
  cta,
  allLabel,
  showJsonLd = true,
  showFeedback = true,
  className = "",
  headerSlot,
  footerSlot,
  headingLevel = "h2",
}) => {
  const t = useTranslations();
  const { dir, isolateText } = useBidi();

  // Normalize items to standard structure with deterministic IDs
  const normalizedItems = useMemo(
    () => normalizeFaqItems(rawItems),
    [rawItems],
  );

  // Search state (internal or controlled)
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const isControlledSearch = controlledSearchQuery !== undefined;
  const currentSearch = isControlledSearch
    ? controlledSearchQuery
    : internalSearchQuery;

  const handleSearchChange = useCallback(
    (value: string) => {
      if (!isControlledSearch) {
        setInternalSearchQuery(value);
      }
      onSearchChange?.(value);
    },
    [isControlledSearch, onSearchChange],
  );

  // Active category filter
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Open items tracked by unique stable ID
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenIds),
  );

  // Helpful feedback state map: { [itemId]: boolean }
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>(
    {},
  );

  // Trigger button references for WAI-ARIA arrow-key navigation
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter items by category AND search query
  const filteredItems = useMemo(() => {
    let result = normalizedItems;

    if (activeCategory !== "all") {
      result = result.filter((item) => item.category === activeCategory);
    }

    const query = currentSearch.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query) ||
          item.keywords?.some((k) => k.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [normalizedItems, activeCategory, currentSearch]);

  // Toggle item open/closed by deterministic ID
  const toggleItem = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        if (multiOpen) {
          next.has(id) ? next.delete(id) : next.add(id);
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.clear();
            next.add(id);
          }
        }
        return next;
      });
    },
    [multiOpen],
  );

  // WAI-ARIA APG Keyboard Navigation between accordion buttons
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const total = filteredItems.length;
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % total;
      triggerRefs.current[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + total) % total;
      triggerRefs.current[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      triggerRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      triggerRefs.current[total - 1]?.focus();
    }
  };

  const handleFeedback = (itemId: string, _helpful: boolean) => {
    setFeedbackGiven((prev) => ({ ...prev, [itemId]: true }));
  };

  const TitleTag = headingLevel;
  const QuestionHeadingTag = (
    headingLevel === "h2" ? "h3" : headingLevel === "h3" ? "h4" : "h5"
  ) as "h2" | "h3" | "h4" | "h5";

  // Render Inner Content (shared between section and embedded variants)
  const innerContent = (
    <div className="w-full">
      {showJsonLd && normalizedItems.length > 0 && (
        <FAQPageJsonLd
          items={normalizedItems.map((i) => ({
            question: i.question,
            answer: i.answer,
          }))}
        />
      )}

      {/* Header Slot or Standard Header */}
      {headerSlot
        ? headerSlot
        : (title || subtitle) && (
            <div className="text-center mb-10 md:mb-12">
              {title && (
                <TitleTag className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-4 tracking-tight">
                  {title}
                </TitleTag>
              )}
              {subtitle && (
                <p className="text-base md:text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          )}

      {/* Search Bar */}
      {searchable && (
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative flex items-center">
            <Search className="absolute start-4 w-5 h-5 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={currentSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("common.searchQuestions")}
              aria-label={t("common.searchQuestions")}
              className="w-full ps-11 pe-11 py-3 bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm md:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all text-start"
            />
            {currentSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                aria-label={t("common.clearSearch")}
                className="absolute end-3.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      {categories && categories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 md:gap-2.5 mb-8 md:mb-10">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all duration-200 active:scale-95 ${
              activeCategory === "all"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-xs"
            }`}
          >
            {allLabel || t("common.allTopics")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all duration-200 active:scale-95 ${
                activeCategory === cat.id
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-xs"
              }`}
            >
              {cat.icon && <span className="w-4 h-4">{cat.icon}</span>}
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Accordion List or Empty State */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 max-w-lg mx-auto">
          <HelpCircle className="w-10 h-10 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
            {t("common.noMatchingQuestions")}
          </h4>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            {t("common.noMatchingQuestionsDesc")}
          </p>
          {(currentSearch || activeCategory !== "all") && (
            <button
              type="button"
              onClick={() => {
                handleSearchChange("");
                setActiveCategory("all");
              }}
              className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              {t("common.clearSearch")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 md:space-y-3.5">
          {filteredItems.map((item, index) => {
            const itemId = item.id || `faq-${index}`;
            const isOpen = openIds.has(itemId);
            const isHelpfulSubmitted = feedbackGiven[itemId];

            return (
              <motion.div
                key={itemId}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(index * 0.03, 0.3),
                }}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isOpen
                    ? "border-blue-500/30 dark:border-blue-500/30 bg-white dark:bg-slate-900 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10"
                    : "border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-blue-300/80 dark:hover:border-slate-700 hover:shadow-xs"
                }`}
              >
                {/* Semantic Accessible Heading Wrapper */}
                <QuestionHeadingTag className="m-0 p-0 text-inherit font-inherit">
                  <button
                    ref={(el) => {
                      triggerRefs.current[index] = el;
                    }}
                    id={`faq-trigger-${itemId}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${itemId}`}
                    onClick={() => toggleItem(itemId)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={`w-full px-5 py-4 md:px-6 md:py-4.5 flex items-center justify-between text-start transition-colors duration-150 select-none ${
                      isOpen
                        ? "bg-blue-50/40 dark:bg-blue-950/20"
                        : "hover:bg-gray-50/70 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span
                      className={`text-base md:text-lg font-semibold pe-4 transition-colors ${
                        isOpen
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-slate-100"
                      }`}
                    >
                      <HighlightText
                        text={isolateText(item.question)}
                        highlight={currentSearch}
                      />
                    </span>
                    <div
                      className={`shrink-0 p-1.5 rounded-full transition-colors ${
                        isOpen
                          ? "bg-blue-100/80 dark:bg-blue-900/40"
                          : "bg-gray-100 dark:bg-slate-800"
                      }`}
                    >
                      <ChevronDown
                        className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${
                          isOpen
                            ? "rotate-180 text-blue-600 dark:text-blue-400"
                            : "text-gray-400 dark:text-slate-500"
                        }`}
                      />
                    </div>
                  </button>
                </QuestionHeadingTag>

                {/* Collapsible Panel - preserved in DOM for SEO/AEO crawlers */}
                <motion.div
                  id={`faq-panel-${itemId}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${itemId}`}
                  aria-hidden={!isOpen}
                  initial={false}
                  animate={{
                    height: isOpen ? "auto" : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                  transition={ANIMATION.PANEL}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 md:px-6 md:pb-6 pt-2 md:pt-3 border-t border-gray-100 dark:border-slate-800/80 text-start">
                    <p className="text-sm md:text-base text-gray-600 dark:text-slate-400 leading-relaxed md:leading-loose">
                      <HighlightText
                        text={item.answer}
                        highlight={currentSearch}
                      />
                    </p>

                    {/* Optional Was this helpful? micro-interaction */}
                    {showFeedback && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
                        {isHelpfulSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            {t("common.thankYouFeedback")}
                          </span>
                        ) : (
                          <>
                            <span>{t("common.wasHelpful")}</span>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleFeedback(itemId, true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                              >
                                <ThumbsUp className="w-3 h-3" />
                                {t("common.yes")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFeedback(itemId, false)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                              >
                                <ThumbsDown className="w-3 h-3" />
                                {t("common.no")}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer Slot (e.g. for /contact external link) */}
      {footerSlot && <div className="mt-8">{footerSlot}</div>}

      {/* CTA Section */}
      {cta && (
        <div className="text-center mt-12 md:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-10 max-w-2xl mx-auto shadow-lg"
          >
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <HelpCircle className="w-6 h-6 text-blue-500 dark:text-blue-400" />
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100">
                {cta.title}
              </h3>
            </div>
            <p className="text-sm md:text-base text-gray-600 dark:text-slate-400 mb-6 max-w-xl mx-auto leading-relaxed">
              {cta.description}
            </p>
            <Link
              href={cta.buttonLink}
              className="inline-flex items-center justify-center px-6 py-3 md:px-7 md:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-blue-500/25 text-sm md:text-base"
            >
              {cta.buttonText}
              <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );

  // Embedded Variant: Clean wrapper without outer section padding or background banding
  if (variant === "embedded") {
    return (
      <div dir={dir} className={`w-full ${className}`}>
        {innerContent}
      </div>
    );
  }

  // Section Variant (default): Full-bleed section with responsive padding & subtle contrast background
  return (
    <section
      dir={dir}
      className={`py-16 md:py-24 bg-gray-50/80 dark:bg-slate-950 transition-colors ${className}`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {innerContent}
      </div>
    </section>
  );
};

export default FAQAccordion;
