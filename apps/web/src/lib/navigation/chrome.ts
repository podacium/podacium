import type { LucideIcon } from "lucide-react";

export type ChromeMode =
  | "marketing"
  | "discover"
  | "workspace"
  | "account"
  | "studio"
  | "admin"
  | "canvas"
  | "focus";

export type NavbarVariant = "full" | "compact" | "focus";

export interface ChromeSpec {
  navbar: NavbarVariant;
  hasSpine: boolean;
  showFooter: boolean;
  showBottomNav: boolean;
}

export const CHROME: Record<ChromeMode, ChromeSpec> = {
  marketing: {
    navbar: "full",
    hasSpine: false,
    showFooter: true,
    showBottomNav: true,
  },
  discover: {
    navbar: "full",
    hasSpine: false,
    showFooter: true,
    showBottomNav: true,
  },
  workspace: {
    navbar: "compact",
    hasSpine: true,
    showFooter: false,
    showBottomNav: true,
  },
  account: {
    navbar: "compact",
    hasSpine: true,
    showFooter: false,
    showBottomNav: true,
  },
  studio: {
    navbar: "compact",
    hasSpine: true,
    showFooter: false,
    showBottomNav: true,
  },
  admin: {
    navbar: "compact",
    hasSpine: true,
    showFooter: false,
    showBottomNav: true,
  },
  canvas: {
    navbar: "compact",
    hasSpine: true,
    showFooter: false,
    showBottomNav: false,
  },
  focus: {
    navbar: "focus",
    hasSpine: false,
    showFooter: false,
    showBottomNav: false,
  },
};

/** Order matters: most specific regex match first. */
const RULES: ReadonlyArray<readonly [RegExp, ChromeMode]> = [
  [/^\/learn\/courses\/[^/]+\/lesson\/[^/]+/, "focus"],
  [
    /^\/live\/(?!bookings|create|my-sessions|payouts|replays|transfer)[^/]+$/,
    "focus",
  ],
  [/^\/(copilot|podalil|bodalil|boudalil)(\/|$)/, "canvas"],
  [/^\/bi\/(dashboards|reports)\/(?!new$)[^/]+$/, "canvas"],
  [/^\/admin(\/|$)/, "admin"],
  [/^\/(learn\/(manage|create)|live\/(my-sessions|payouts))(\/|$)/, "studio"],
  [/^\/settings(\/|$)/, "account"],
  [
    /^\/(dashboard|notifications|hub\/(contracts|proposals|messages)|bi\/(organizations|quality|decisions))(\/|$)/,
    "workspace",
  ],
  [/^\/(learn|hub|bi|search|help|docs|profile)(\/|$)/, "discover"],
];

/**
 * Strips optional locale prefix (e.g., /ar, /fr, /kab) to match canonical path.
 */
export function normalizePathname(pathname: string): string {
  const match = pathname.match(/^\/(?:ar|fr|en|kab)(\/.*|$)/);
  if (match) {
    return match[1] || "/";
  }
  return pathname;
}

export function resolveChromeMode(pathname: string): ChromeMode {
  const normalized = normalizePathname(pathname);
  for (const [re, mode] of RULES) {
    if (re.test(normalized)) return mode;
  }
  return "marketing";
}

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
  permissions?: readonly string[];
  badge?: { count: number; tone?: "default" | "destructive" | "warning" };
}

export interface NavSection {
  id: string;
  labelKey?: string;
  items: readonly NavItem[];
}

export function isItemActive(
  pathname: string,
  item: Pick<NavItem, "href" | "match">,
): boolean {
  const normalized = normalizePathname(pathname);
  if (item.match === "exact") return normalized === item.href;
  return normalized === item.href || normalized.startsWith(`${item.href}/`);
}
