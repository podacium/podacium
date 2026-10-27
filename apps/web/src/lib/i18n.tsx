"use client";

import React, { createContext, useContext, useMemo } from "react";

type Messages = Record<string, any>;

const IntlContext = createContext<{
  messages: Messages;
  locale: string;
} | null>(null);

let defaultTestMessages: Messages | null = null;
let defaultTestContext: { messages: Messages; locale: string } | null = null;

export function setDefaultTestMessages(messages: Messages | null) {
  defaultTestMessages = messages;
  defaultTestContext = messages ? { messages, locale: "en" } : null;
}

export function IntlProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages;
  locale: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ messages, locale }), [messages, locale]);
  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

// Unicode BiDi control characters
const BIDI = {
  LTR_ISOLATE: "\u2066", // Left-to-Right Isolate
  RTL_ISOLATE: "\u2067", // Right-to-Left Isolate
  FIRST_STRONG_ISOLATE: "\u2068", // First Strong Isolate
  POP_DIRECTIONAL_ISOLATE: "\u2069", // Pop Directional Isolate
  LTR_EMBEDDING: "\u202A", // Left-to-Right Embedding
  RTL_EMBEDDING: "\u202B", // Right-to-Left Embedding
  POP_DIRECTIONAL_FORMATTING: "\u202C", // Pop Directional Formatting
  LTR_MARK: "\u200E", // Left-to-Right Mark
  RTL_MARK: "\u200F", // Right-to-Left Mark
} as const;

/**
 * Determines if a string contains Arabic or RTL characters
 */
function containsRTL(text: string): boolean {
  // Arabic characters range, Hebrew, and other RTL scripts
  const rtlRegex =
    /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlRegex.test(text);
}

/**
 * Determines if a string contains Latin/LTR characters
 */
function containsLTR(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/**
 * Determines if text is mixed LTR/RTL
 */
function isMixedBidi(text: string): boolean {
  return containsLTR(text) && containsRTL(text);
}

/**
 * Safely isolates mixed-direction text
 */
export function isolateText(
  text: string,
  forceDirection?: "ltr" | "rtl" | "auto",
): string {
  if (!text || typeof text !== "string") return text;

  const isRTL = containsRTL(text);
  const hasMixed = isMixedBidi(text);

  if (forceDirection === "ltr") {
    return `${BIDI.LTR_ISOLATE}${text}${BIDI.POP_DIRECTIONAL_ISOLATE}`;
  }

  if (forceDirection === "rtl") {
    return `${BIDI.RTL_ISOLATE}${text}${BIDI.POP_DIRECTIONAL_ISOLATE}`;
  }

  if (hasMixed) {
    // For mixed text, use First Strong Isolate to let Unicode algorithm decide
    return `${BIDI.FIRST_STRONG_ISOLATE}${text}${BIDI.POP_DIRECTIONAL_ISOLATE}`;
  }

  if (isRTL) {
    return `${BIDI.RTL_ISOLATE}${text}${BIDI.POP_DIRECTIONAL_ISOLATE}`;
  }

  return text;
}

/**
 * Isolates specific parts of text (like language codes) to always be LTR
 */
export function isolateLTRPart(text: string): string {
  return `${BIDI.LTR_ISOLATE}${text}${BIDI.POP_DIRECTIONAL_ISOLATE}`;
}

/**
 * Hook to get BiDi utilities
 */
export function useBidi() {
  const ctx = useContext(IntlContext);
  const isRTL = ctx?.locale === "ar";

  const bidiUtils = useMemo(
    () => ({
      // Current direction
      dir: isRTL ? "rtl" : ("ltr" as "ltr" | "rtl"),
      isRTL,

      // Text isolation functions
      isolateText,
      isolateLTRPart,

      // Direction-aware spacing
      marginLeft: isRTL ? "marginRight" : "marginLeft",
      marginRight: isRTL ? "marginLeft" : "marginRight",
      paddingLeft: isRTL ? "paddingRight" : "paddingLeft",
      paddingRight: isRTL ? "paddingLeft" : "paddingRight",

      // Direction-aware flex utilities
      flexDirection: (base: "row" | "row-reverse") =>
        isRTL ? (base === "row" ? "row-reverse" : "row") : base,

      // Text alignment
      textAlign: (alignment: "left" | "right" | "center") => {
        if (alignment === "left") return isRTL ? "right" : "left";
        if (alignment === "right") return isRTL ? "left" : "right";
        return alignment;
      },

      // For language codes or other LTR content in RTL context
      forceLTR: (text: string) => isolateLTRPart(text),

      // Check text direction
      getTextDirection: (text: string): "ltr" | "rtl" | "mixed" => {
        if (!text) return isRTL ? "rtl" : "ltr";
        if (isMixedBidi(text)) return "mixed";
        return containsRTL(text) ? "rtl" : "ltr";
      },
    }),
    [isRTL],
  );

  return bidiUtils;
}

export type TranslatorFn = (
  key?: string | undefined,
  vars?: Record<string, string | number> | number | string,
  fallback?: string,
) => string;
export type Translator = TranslatorFn & {
  t: TranslatorFn;
  i18n: { language: string };
  dir: "ltr" | "rtl";
  isolate: typeof isolateText;
  forceLTR: typeof isolateLTRPart;
  raw: (key: string) => any;
};

/**
 * Enhanced nested key lookup resolver with graceful fallback for redundant namespaces.
 */
export function resolveKey(
  dict: Record<string, any>,
  key: string,
): string | undefined {
  if (!dict || typeof dict !== "object") return undefined;
  let result = key.split(".").reduce((acc, part) => acc && acc[part], dict);
  if (!result && key.startsWith("hub.")) {
    // Fallback for redundant namespace prefix
    result = key
      .slice(4)
      .split(".")
      .reduce((acc, part) => acc && acc[part], dict);
  }
  if (!result && key.includes(".")) {
    result = key
      .substring(key.indexOf(".") + 1)
      .split(".")
      .reduce((acc, part) => acc && acc[part], dict);
  }
  return typeof result === "string" ? result : undefined;
}

export function useTranslations(_ns?: string | string[]): Translator {
  const intlCtx = useContext(IntlContext);
  const ctx = intlCtx || defaultTestContext;

  const resolveNamespace = (messages: Messages, ns?: string | string[]) => {
    if (!ns) return messages;
    const tryResolve = (path: string) => {
      const parts = path.split(".");
      let cur: any = messages;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    };

    const tryResolveWithFallback = (path: string) => {
      const direct = tryResolve(path);
      if (direct !== undefined) return direct;
      if (path.includes(".")) {
        const withoutFirstSegment = path.substring(path.indexOf(".") + 1);
        const stripped = tryResolve(withoutFirstSegment);
        if (stripped !== undefined) return stripped;
      }
      return undefined;
    };

    if (Array.isArray(ns)) {
      // return first matching namespace object, or fallback to root
      for (const n of ns) {
        const found = tryResolveWithFallback(n);
        if (found !== undefined) return found;
      }
      return messages;
    }

    const found = tryResolveWithFallback(ns);
    return found !== undefined ? found : messages;
  };

  const base = ctx ? resolveNamespace(ctx.messages, _ns) : {};

  const makeTranslator = (
    context: { messages: Messages; locale: string } | null,
    ns?: string | string[],
  ): TranslatorFn => {
    if (!context) {
      return (
        key: string | undefined,
        vars?: Record<string, string | number> | number | string,
        fallback?: string,
      ) => {
        if (!key) return fallback ?? "";
        if (typeof vars === "number") return `${vars}h ago`;
        return fallback ?? key;
      };
    }

    const isRTL = context.locale === "ar";

    return function t(
      key: string | undefined,
      vars?: Record<string, string | number> | number | string,
      fallback?: string,
    ) {
      if (!key) return fallback ?? "";

      let resolvedFallback = fallback;
      let actualVars: Record<string, string | number> | number | undefined =
        undefined;

      if (typeof vars === "string") {
        resolvedFallback = vars;
      } else if (typeof vars === "object" || typeof vars === "number") {
        actualVars = vars;
      }

      // Search in specific namespace first, then instructor/learn namespaces, then full messages tree
      const searchRoots: any[] = [];
      if (base && base !== context.messages) searchRoots.push(base);
      let lookupKey = key;
      if (key.includes(":")) {
        const [nsPart, rest] = key.split(/:(.+)/);
        const explicit = resolveNamespace(context.messages, nsPart);
        if (explicit && !searchRoots.includes(explicit))
          searchRoots.push(explicit);
        lookupKey = rest;
      }
      if (
        context.messages?.instructor &&
        !searchRoots.includes(context.messages.instructor)
      ) {
        searchRoots.push(context.messages.instructor);
      }
      if (
        context.messages?.learn &&
        !searchRoots.includes(context.messages.learn)
      ) {
        searchRoots.push(context.messages.learn);
      }
      if (!searchRoots.includes(context.messages)) {
        searchRoots.push(context.messages);
      }

      const parts = lookupKey.split(".");
      for (const root of searchRoots) {
        let cur: any = root;
        let failed = false;
        for (const p of parts) {
          if (cur && typeof cur === "object" && p in cur) cur = cur[p];
          else {
            failed = true;
            break;
          }
        }

        // Fallback for redundant namespace prefix (e.g., "hub.contracts...", "common.error")
        if (failed && lookupKey.includes(".")) {
          const strippedParts = lookupKey
            .substring(lookupKey.indexOf(".") + 1)
            .split(".");
          let curStripped: any = root;
          let failedStripped = false;
          for (const p of strippedParts) {
            if (
              curStripped &&
              typeof curStripped === "object" &&
              p in curStripped
            ) {
              curStripped = curStripped[p];
            } else {
              failedStripped = true;
              break;
            }
          }
          if (!failedStripped && typeof curStripped === "string") {
            cur = curStripped;
            failed = false;
          }
        }

        if (!failed && typeof cur === "string") {
          let str = cur;

          // Apply BiDi isolation for mixed content in Arabic locale
          if (isRTL && isMixedBidi(str)) {
            str = isolateText(str, "auto");
          }

          if (actualVars && typeof actualVars === "object") {
            for (const k of Object.keys(actualVars)) {
              const val = (actualVars as Record<string, string>)[k];
              // Isolate variable replacements if they're mixed content
              const safeVal =
                isRTL && isMixedBidi(val) ? isolateText(val, "auto") : val;
              // Support both {var} and {{var}} syntax
              str = str.replace(new RegExp(`{{?${k}}}?`, "g"), String(safeVal));
            }
          }
          if (typeof actualVars === "number") {
            str = str.replace(/{n}/g, String(actualVars));
          }
          return str;
        }
      }

      // fallback: if not found, return resolvedFallback or empty string so || operator works
      if (typeof actualVars === "number") return `${actualVars}h ago`;

      if (resolvedFallback) {
        return isRTL && isMixedBidi(resolvedFallback)
          ? isolateText(resolvedFallback, "auto")
          : resolvedFallback;
      }

      return "";
    };
  };

  const translatorFn = useMemo(() => makeTranslator(ctx, _ns), [ctx, _ns]);
  const isRTL = ctx?.locale === "ar";

  // create a callable function that also has .t and .i18n properties so both
  // usage patterns are supported: `const t = useTranslations()` and
  // `const { t, i18n } = useTranslations()`.
  const translator = translatorFn as unknown as Translator;
  translator.t = translatorFn;
  translator.i18n = { language: ctx?.locale ?? "en" };
  translator.dir = isRTL ? "rtl" : "ltr";
  translator.isolate = isolateText;
  translator.forceLTR = isolateLTRPart;
  translator.raw = (key: string) => {
    if (!ctx) return undefined;
    const searchRoots = [base, ctx.messages];
    for (const root of searchRoots) {
      const parts = key.split(".");
      let cur: any = root;
      let failed = false;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else {
          failed = true;
          break;
        }
      }
      if (!failed) return cur;
    }
    return undefined;
  };

  return translator;
}

export function useLocale() {
  const ctx = useContext(IntlContext);
  return ctx?.locale ?? "en";
}

/**
 * Hook to get text direction based on locale or content
 */
export function useTextDirection(content?: string): "ltr" | "rtl" {
  const ctx = useContext(IntlContext);
  const locale = ctx?.locale ?? "en";

  if (content) {
    return containsRTL(content) ? "rtl" : "ltr";
  }

  return locale === "ar" ? "rtl" : "ltr";
}
