/**
 * Static Tailwind class maps for accent colours.
 *
 * Tailwind only emits a class when it appears as a complete string in source,
 * so `bg-${color}-100` never produces CSS. Any colour that varies at runtime
 * must resolve to a full class string here instead.
 */
export type AccentColor = "blue" | "green" | "purple" | "orange" | "red";

export interface AccentStyle {
  /** 100-tint surface, e.g. icon chips and badges */
  bg: string;
  /** 50-tint surface */
  softBg: string;
  /** 600 text/icon colour */
  text: string;
  /** 100 hairline border */
  softBorder: string;
  /** 200 border */
  border: string;
  /** 300 border on hover */
  hoverBorder: string;
  /** 100 tint on hover */
  hoverBg: string;
  /** Gradient start (50) */
  from: string;
  /** Gradient end (50/30) */
  to: string;
  /** Gradient middle accent (500) */
  via: string;
}

export const ACCENT_STYLES: Record<AccentColor, AccentStyle> = {
  blue: {
    bg: "bg-blue-100",
    softBg: "bg-blue-50",
    text: "text-blue-600",
    softBorder: "border-blue-100",
    border: "border-blue-200",
    hoverBorder: "hover:border-blue-300",
    hoverBg: "hover:bg-blue-100",
    from: "from-blue-50",
    to: "to-blue-50/30",
    via: "via-blue-500",
  },
  green: {
    bg: "bg-green-100",
    softBg: "bg-green-50",
    text: "text-green-600",
    softBorder: "border-green-100",
    border: "border-green-200",
    hoverBorder: "hover:border-green-300",
    hoverBg: "hover:bg-green-100",
    from: "from-green-50",
    to: "to-green-50/30",
    via: "via-green-500",
  },
  purple: {
    bg: "bg-purple-100",
    softBg: "bg-purple-50",
    text: "text-purple-600",
    softBorder: "border-purple-100",
    border: "border-purple-200",
    hoverBorder: "hover:border-purple-300",
    hoverBg: "hover:bg-purple-100",
    from: "from-purple-50",
    to: "to-purple-50/30",
    via: "via-purple-500",
  },
  orange: {
    bg: "bg-orange-100",
    softBg: "bg-orange-50",
    text: "text-orange-600",
    softBorder: "border-orange-100",
    border: "border-orange-200",
    hoverBorder: "hover:border-orange-300",
    hoverBg: "hover:bg-orange-100",
    from: "from-orange-50",
    to: "to-orange-50/30",
    via: "via-orange-500",
  },
  red: {
    bg: "bg-red-100",
    softBg: "bg-red-50",
    text: "text-red-600",
    softBorder: "border-red-100",
    border: "border-red-200",
    hoverBorder: "hover:border-red-300",
    hoverBg: "hover:bg-red-100",
    from: "from-red-50",
    to: "to-red-50/30",
    via: "via-red-500",
  },
};

/** Resolve a colour name to its static class set, falling back to blue. */
export function getAccentStyle(color: string): AccentStyle {
  switch (color) {
    case "green":
      return ACCENT_STYLES.green;
    case "purple":
      return ACCENT_STYLES.purple;
    case "orange":
      return ACCENT_STYLES.orange;
    case "red":
      return ACCENT_STYLES.red;
    case "blue":
    default:
      return ACCENT_STYLES.blue;
  }
}
