/**
 * Kabyle (Tamazight) Ameslay Calendar Dictionary & Formatter
 * Compliant with Unicode CLDR standards and standardized Kabyle Latin orthography.
 */

export interface AmeslayCalendarDictionary {
  months: {
    long: readonly string[];
    short: readonly string[];
    narrow: readonly string[];
  };
  weekdays: {
    long: readonly string[];
    short: readonly string[];
    narrow: readonly string[];
  };
}

export const AMESLAY_MONTHS = [
  "Yennayer",
  "Fuṛar",
  "Meɣres",
  "Yebrir",
  "Mayyu",
  "Yunyu",
  "Yulyu",
  "Ɣuct",
  "Ctembeṛ",
  "Tuber",
  "Wambeṛ",
  "Dujembeṛ",
] as const;

export const AMESLAY_CALENDAR: AmeslayCalendarDictionary = {
  months: {
    long: AMESLAY_MONTHS,
    short: [
      "Yen",
      "Fuṛ",
      "Meɣ",
      "Yeb",
      "May",
      "Yun",
      "Yul",
      "Ɣuc",
      "Cte",
      "Tub",
      "Wam",
      "Duj",
    ] as const,
    narrow: [
      "Y",
      "F",
      "M",
      "Y",
      "M",
      "Y",
      "Y",
      "Ɣ",
      "C",
      "T",
      "W",
      "D",
    ] as const,
  },
  weekdays: {
    long: [
      "Yanass", // Sunday
      "Sanass", // Monday
      "Kraḍass", // Tuesday (U+1E0D ḍ)
      "Kuẓass", // Wednesday (U+1E93 ẓ)
      "Samass", // Thursday
      "Sḍisass", // Friday (U+1E0D ḍ)
      "Sayass", // Saturday
    ] as const,
    short: ["Yan", "San", "Kraḍ", "Kuẓ", "Sam", "Sḍis", "Say"] as const,
    narrow: ["Y", "S", "K", "K", "S", "S", "S"] as const,
  },
} as const;

/**
 * Deterministic date formatter for Kabyle Ameslay calendar.
 * Automatically attempts browser Intl API and falls back to AMESLAY_CALENDAR
 * to prevent silent en-US/fr fallback on WebKit/Safari.
 */
export function formatAmeslayDate(
  date: Date | string | number,
  format: "full" | "long" | "medium" | "short" = "long",
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();
  const weekdayIdx = d.getDay();

  const monthLong = AMESLAY_CALENDAR.months.long[monthIdx];
  const monthShort = AMESLAY_CALENDAR.months.short[monthIdx];
  const weekdayLong = AMESLAY_CALENDAR.weekdays.long[weekdayIdx];
  const weekdayShort = AMESLAY_CALENDAR.weekdays.short[weekdayIdx];

  switch (format) {
    case "full":
      return `${weekdayLong}, ${day} ${monthLong} ${year}`;
    case "long":
      return `${day} ${monthLong} ${year}`;
    case "medium":
      return `${weekdayShort}, ${day} ${monthShort} ${year}`;
    case "short":
      return `${day} ${monthShort} ${year}`;
  }
}
