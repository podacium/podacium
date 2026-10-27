/**
 * DZD Currency Formatter for Podacium BI
 *
 * Formats monetary values in proper Algerian Dinar format:
 *   15 000,50 د.ج
 *
 * - Space as thousands separator
 * - Comma as decimal separator
 * - د.ج suffix (Dinar symbol)
 * - No $, USD, or dollar references anywhere
 */

// Unicode BiDi control characters (UAX #9)
export const BIDI_CHARS = {
  FSI: "\u2068", // First Strong Isolate
  PDI: "\u2069", // Pop Directional Isolate
  LRI: "\u2066", // Left-to-Right Isolate
  RLI: "\u2067", // Right-to-Left Isolate
  LRM: "\u200E", // Left-to-Right Mark
  RLM: "\u200F", // Right-to-Left Mark
  NBSP: "\u00A0", // Non-Breaking Space
} as const;

export interface FormatDZDOptions {
  decimals?: number;
  showSymbol?: boolean;
  compact?: boolean;
  isolate?: boolean;
}

/**
 * Format a number as DZD currency: "15 000,50 د.ج"
 * @param value - The numeric value to format
 * @param options - Formatting options
 * @returns Formatted DZD string
 */
export function formatDZD(
  value: number | string | null | undefined,
  options: FormatDZDOptions = {},
): string {
  const {
    decimals = 0,
    showSymbol = true,
    compact = false,
    isolate = false,
  } = options;

  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  if (compact) {
    return formatDZDCompact(num, showSymbol, isolate);
  }

  // Format with space as thousands separator, comma as decimal
  const fixed = num.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");

  // Add space as thousands separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  let result = formattedInteger;
  if (decimalPart && decimals > 0) {
    result += "," + decimalPart;
  }

  if (showSymbol) {
    if (isolate) {
      return `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}${result}${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}د.ج${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`;
    }
    result += " د.ج";
  } else if (isolate) {
    return `${BIDI_CHARS.LRI}${result}${BIDI_CHARS.PDI}`;
  }

  return result;
}

/**
 * Format a DZD value in compact form for large numbers
 * Supports both options-driven isolation and direct locale-driven formatting.
 * e.g., 1 500 000 → "1,5M د.ج" or "\u20681,5M\u2069 \u2068د.ج\u2069"
 */
export function formatDZDCompact(
  amount: number,
  localeOrShowSymbol: string | boolean = true,
  isolate: boolean = false,
): string {
  // If string locale is passed directly, e.g. formatDZDCompact(1500000, 'ar')
  if (typeof localeOrShowSymbol === "string") {
    const locale = localeOrShowSymbol;
    const formattedNum = new Intl.NumberFormat(
      locale === "ar" ? "ar-DZ" : "fr-DZ",
      {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
      },
    ).format(amount);

    const currencySymbol = locale === "ar" ? "د.ج" : "DZD";

    if (locale === "ar") {
      return `${BIDI_CHARS.FSI}${formattedNum}${BIDI_CHARS.PDI} ${BIDI_CHARS.FSI}${currencySymbol}${BIDI_CHARS.PDI}`;
    }
    return `${formattedNum} ${currencySymbol}`;
  }

  const showSymbol = localeOrShowSymbol;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = (abs / 1_000_000_000).toFixed(1).replace(".", ",") + "Md";
  } else if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1).replace(".", ",") + "M";
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(1).replace(".", ",") + "K";
  } else {
    formatted = abs.toFixed(0);
  }

  // Remove trailing ,0
  formatted = formatted
    .replace(",0K", "K")
    .replace(",0M", "M")
    .replace(",0Md", "Md");

  const numberPart = sign + formatted;

  if (!showSymbol) {
    return isolate
      ? `${BIDI_CHARS.LRI}${numberPart}${BIDI_CHARS.PDI}`
      : numberPart;
  }

  if (isolate) {
    return `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}${numberPart}${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}د.ج${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`;
  }

  return `${numberPart} د.ج`;
}

/**
 * Format a number with DZD-style separators (no currency symbol)
 * Useful for generic numeric displays in Algerian context
 * e.g., 15000 → "15 000"
 */
export function formatNumberDZ(
  value: number | string | null | undefined,
  decimals: number = 0,
): string {
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const fixed = num.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  if (decimalPart && decimals > 0) {
    return formattedInteger + "," + decimalPart;
  }
  return formattedInteger;
}

/**
 * Format a monetary value for Intl-compatible chart tooltips.
 * Uses DZD formatting instead of browser default which may show $.
 */
export function formatCurrencyForChart(
  value: number,
  _locale?: string,
  decimals: number = 0,
): string {
  return formatDZD(value, { decimals, showSymbol: true });
}

/**
 * Format a percentage value in DZ style
 * e.g., 45.5 → "45,5%"
 */
export function formatPercentageDZ(
  value: number | null | undefined,
  decimals: number = 1,
): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals).replace(".", ",") + "%";
}

/**
 * Locale-aware DZD Currency Formatter for Podacium
 * Formats "15 000 د.ج" in Arabic and "15 000 DZD" (or "15,000 DZD" in English)
 */
export function formatPodaciumCurrency(
  value: number | string | null | undefined,
  locale: string = "ar",
  options: {
    decimals?: number;
    compact?: boolean;
    showSymbol?: boolean;
    isolate?: boolean;
  } = {},
): string {
  const {
    decimals = 0,
    compact = false,
    showSymbol = true,
    isolate = false,
  } = options;
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const isAr = locale === "ar";
  const currencySymbol = isAr ? "د.ج" : "DZD";

  if (compact) {
    const compactFormatted = formatDZDCompact(num, false, isolate);
    if (!showSymbol) return compactFormatted;
    if (isolate) {
      return `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}${compactFormatted}${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}${currencySymbol}${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`;
    }
    return `${compactFormatted}\u00A0${currencySymbol}`;
  }

  const isEn = locale === "en";
  const fixed = num.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");

  const formattedInteger = isEn
    ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  let result = formattedInteger;
  if (decimalPart && decimals > 0) {
    result += (isEn ? "." : ",") + decimalPart;
  }

  if (showSymbol) {
    if (isolate) {
      return `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}${result}${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}${currencySymbol}${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`;
    }
    result += `\u00A0${currencySymbol}`;
  }

  return result;
}
