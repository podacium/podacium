#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node CLI script. */
/**
 * ============================================================================
 * PODACIUM ENTERPRISE i18n & FRONTEND HARDCODED TEXT AUDIT ENGINE  v2
 * ============================================================================
 *
 * Deeply scans the Podacium web application (`apps/web`) to uncover:
 *
 * 1. The Dictionary Parity & Integrity Engine (100% Deterministic Precision):
 *    - Cross-language missing keys across all 4 locales (en, fr, ar, kab).
 *    - Empty, whitespace-only, null, or placeholder values (TODO, TBD, etc.).
 *    - Variable interpolation mismatches ({count} vs {{count}} across locales).
 *    - Identical values across locales that should differ (copy-paste detection).
 *    - Arabic locale values without any Arabic Unicode characters.
 *    - Kabyle (kab) locale values without any Latin characters.
 *    - Suspicious length ratios between locales (likely truncated translations).
 *    - Double-space artifacts inside translation strings.
 *    - RTL Unicode bidi control characters embedded in strings.
 *    - Code-to-Dictionary Parity:
 *      * Dangling keys (called in code via t(...) but missing in dictionaries).
 *      * Orphan / Unused keys (bloating dictionary files without code usage).
 *
 * 2. The Hardcoded Text Detection Engine (AST-Based):
 *    - Full TypeScript Compiler API AST traversal for 100% syntactic precision.
 *    - Raw JSXText between elements (e.g. <span>Unlocalized text</span>).
 *    - User-facing JSX attributes (placeholder, aria-label, title, alt, etc.).
 *    - Raw string fallback anti-patterns (t(...) || "fallback", ?? "...", or 3rd arg).
 *    - Visible fallbacks: t(key, "literal") where key is missing or an object.
 *    - Non-string keys: t("namespace.object") resolving to an object, not a string.
 *    - Manual interpolation: t(key).replace("{{var}}", value) instead of t(key, vars).
 *    - Hardcoded locale identifiers in toLocaleString/Intl.NumberFormat (warning).
 *    - Raw status/state enum values rendered directly in JSX (warning).
 *    - UI modal / toast calls (toast.error("..."), confirm("..."), alert("...")).
 *    - throw new Error("...") in components / hooks (user-visible error boundaries).
 *    - console.error/warn with natural-language strings (diagnostic but flagged).
 *    - Multi-lingual detection: English, French, Arabic, and Taqbaylit orthography.
 *    - Exhaustive noise suppression (Tailwind classes, SVG paths, URLs, numbers).
 *
 * Usage:
 *   node ./scripts/check-all-locales.js                 # Full audit with code frames
 *   node ./scripts/check-all-locales.js --summary       # Compact summary dashboard
 *   node ./scripts/check-all-locales.js --json          # Machine-readable JSON output
 *   node ./scripts/check-all-locales.js --only-locales  # Audit dictionaries only
 *   node ./scripts/check-all-locales.js --only-code     # Audit source code only
 *   node ./scripts/check-all-locales.js --show-orphans  # Report unused dictionary keys
 *   node ./scripts/check-all-locales.js --file <path>   # Target a specific file or folder
 *   node ./scripts/check-all-locales.js --fix-hints     # Print t(...) suggested fixes
 *   node ./scripts/check-all-locales.js --locale <loc>  # Audit a single locale only
 *   node ./scripts/check-all-locales.js --strict        # Exit non-zero on warnings too
 * ============================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LOCALES = ["en", "fr", "ar", "kab"];
const REPO_ROOT = findRepoRoot(__dirname);
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const LOCALES_DIR = path.join(WEB_ROOT, "locales");
const SRC_DIR = path.join(WEB_ROOT, "src");

function findRepoRoot(startDir) {
  let current = startDir;
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "apps", "web"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir, "..");
}

// User-facing attributes to inspect in JSX
const USER_FACING_PROPS = new Set([
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-errormessage",
  "aria-valuetext",
  "title",
  "alt",
  "label",
  "helpertext",
  "description",
  "subtitle",
  "heading",
  "emptytext",
  "confirmtext",
  "canceltext",
  "errormessage",
  "loadingtext",
  "buttontext",
  "actionlabel",
  "tooltip",
  "badge",
  "successmessage",
  "warningmessage",
]);

// Ignored attributes where strings are purely technical or identifiers
const IGNORED_PROPS = new Set([
  "className",
  "class",
  "style",
  "key",
  "id",
  "name",
  "type",
  "href",
  "to",
  "as",
  "src",
  "rel",
  "target",
  "role",
  "tabIndex",
  "data-testid",
  "method",
  "variant",
  "size",
  "color",
  "viewBox",
  "d",
  "fill",
  "stroke",
  "xmlns",
  "width",
  "height",
  "dir",
  "lang",
  "autoComplete",
]);

// Properties and attributes that declare or pass translation keys
const I18N_KEY_PROPS = new Set([
  "labelkey",
  "titlekey",
  "subtitlekey",
  "desckey",
  "descriptionkey",
  "tooltipkey",
  "placeholderkey",
  "actionlabelkey",
  "actionkey",
  "headerkey",
  "badgekey",
  "emptykey",
  "confirmkey",
  "cancelkey",
  "hintkey",
  "i18nkey",
  "translationkey",
  "msgkey",
  "textkey",
  "errorkey",
  "tabkey",
  "statuskey",
  "helpkey",
  "emptytextkey",
  "buttontextkey",
]);

// Technical identifiers that end in "key" or "keys" but are not i18n translation keys
const TECHNICAL_KEY_PROPS = new Set([
  "key",
  "apikey",
  "secretkey",
  "maskedkey",
  "accesskey",
  "datakey",
  "chartkey",
  "serieskey",
  "categorykey",
  "namekey",
  "visibilitykey",
  "plankey",
  "groupkey",
  "uniquekey",
  "licensekey",
  "privatekey",
  "publickey",
  "sshkey",
  "hotkey",
  "bindkey",
  "refkey",
  "clientkey",
  "serverkey",
  "foreignkey",
  "primarykey",
  "sortkey",
  "storagekey",
  "cachekey",
  "cookiekey",
  "sessionkey",
  "tokenkey",
  "querykey",
  "routekey",
  "idkey",
  "pkkey",
  "statekey",
  "eventkey",
  "typekey",
  "fieldkey",
  "filterkey",
  "rowkey",
  "columnkey",
  "nodekey",
  "itemkey",
  "metakey",
  "ctrlkey",
  "altkey",
  "shiftkey",
]);

function isI18nKeyProp(name) {
  if (!name || typeof name !== "string") return false;
  const lower = name.toLowerCase();
  if (TECHNICAL_KEY_PROPS.has(lower)) return false;
  if (I18N_KEY_PROPS.has(lower)) return true;
  return lower.endsWith("key") || lower.endsWith("keys");
}

// CLI Arguments
const args = process.argv.slice(2);
const IS_JSON = args.includes("--json");
const IS_SUMMARY = args.includes("--summary");
const ONLY_LOCALES = args.includes("--only-locales");
const ONLY_CODE = args.includes("--only-code");
const SHOW_ORPHANS = args.includes("--show-orphans");
const FIX_HINTS = args.includes("--fix-hints");
const STRICT_MODE = args.includes("--strict");
const FILES_ONLY =
  args.includes("--files-only") ||
  args.includes("--counts-only") ||
  args.includes("--by-file");

const FILE_FILTER_IDX = args.indexOf("--file");
const FILE_FILTER = FILE_FILTER_IDX !== -1 ? args[FILE_FILTER_IDX + 1] : null;

const LOCALE_FILTER_IDX = args.indexOf("--locale");
const LOCALE_FILTER =
  LOCALE_FILTER_IDX !== -1 ? args[LOCALE_FILTER_IDX + 1] : null;
const ACTIVE_LOCALES =
  LOCALE_FILTER && LOCALES.includes(LOCALE_FILTER) ? [LOCALE_FILTER] : LOCALES;

// ANSI Colors
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";

// Load TypeScript compiler API
let ts = null;
try {
  ts = require(path.join(REPO_ROOT, "node_modules", "typescript"));
} catch (e) {
  try {
    ts = require(path.join(WEB_ROOT, "node_modules", "typescript"));
  } catch (e2) {
    try {
      ts = require("typescript");
    } catch (e3) {}
  }
}

// ----------------------------------------------------------------------------
// PART 1: THE DICTIONARY PARITY & INTEGRITY ENGINE
// ----------------------------------------------------------------------------

function flattenObject(obj, prefix = "", intermediateKeys = null) {
  const result = {};
  if (typeof obj === "object" && obj !== null) {
    if (prefix && intermediateKeys) intermediateKeys.add(prefix);
    if (Array.isArray(obj)) {
      if (prefix) result[prefix] = obj;
      obj.forEach((item, index) => {
        const itemKey = prefix ? `${prefix}.${index}` : `${index}`;
        if (typeof item === "object" && item !== null) {
          Object.assign(result, flattenObject(item, itemKey, intermediateKeys));
        } else {
          result[itemKey] = item;
        }
      });
    } else {
      for (const [key, val] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          if (Array.isArray(val)) {
            result[newKey] = val;
            val.forEach((item, index) => {
              const itemKey = `${newKey}.${index}`;
              if (typeof item === "object" && item !== null) {
                Object.assign(
                  result,
                  flattenObject(item, itemKey, intermediateKeys),
                );
              } else {
                result[itemKey] = item;
              }
            });
          } else {
            Object.assign(result, flattenObject(val, newKey, intermediateKeys));
          }
        } else {
          result[newKey] = val;
        }
      }
    }
  } else {
    result[prefix] = obj;
  }
  return result;
}

function extractPlaceholders(str) {
  if (typeof str !== "string") return [];
  // Match both {var} and {{var}}, deduplicate by normalizing
  const single = (str.match(/(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})/g) || []).map(
    (m) => m.toLowerCase(),
  );
  const double = (str.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map((m) =>
    m.toLowerCase(),
  );
  return [...new Set([...single, ...double])].sort();
}

const SUSPICIOUS_PLACEHOLDERS =
  /^(?:TODO\b|TBD\b|FIXME\b|\[TRANSLATE\]|UNTRANSLATED\b|LOREM IPSUM|CHANGEME\b|CHANGE_ME\b|\?\?\?)/i;

// RTL Unicode bidi control characters
const RTL_CONTROL_RE = /[\u200F\u200E\u202A-\u202E\u2066-\u2069]/;

// Arabic script detection
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Latin script detection (covers Kabyle characters too)
const LATIN_SCRIPT_RE = /[A-Za-zÀ-ÖØ-öø-ÿɛɣḍṭẓṣḥčǧ]/;

const UNTRANSLATED_ALLOWLIST = new Set([
  "Podacium",
  "Supabase",
  "WebSocket",
  "GitHub",
  "API",
  "URL",
  "HTTP",
  "JSON",
  "CSV",
  "PDF",
  "SQL",
  "HTML",
  "CSS",
  "DZD",
  "USD",
  "EUR",
  "AWS S3 + CloudFront",
  "AWS S3",
  "CloudFront",
  "Bunny Stream",
  "Cloudflare Stream",
  "YouTube Data API v3",
  "Vimeo Pro / Business",
  "Dailymotion API",
  "Chargily Pay",
  "SATIM",
  "Chargily Pay & SATIM",
  "Visa / Mastercard (EUR/USD)",
  "EDAHABIA",
  "CIB",
  "ISO 27001",
  "X (Twitter)",
  "Terraform",
  "Docker",
  "Kubernetes",
  "SELECT * FROM dataset WHERE ...",
  "p < 0.01 • N=14,280",
  "CSV, JSON, Excel",
  "Zakarya Roubhi",
  "Mohamed Redha Habib",
  "Ahmed Merhab",
  "Enter / o",
  "⌘ + Enter",
  "PoDalil v2.4",
  "PoDalil Pro",
  "Art. 169 & 224",
]);

const UNTRANSLATED_KEY_PATTERNS = [
  // Proper nouns: Algerian city / wilaya directories are identical across locales.
  /^bi\.organizations\.enums\.city\./,
  /^organizations\.directory\.wilayas\./,
  /^user\.profile\.geo\.cities\./,
  // Bidirectional demo copy: `en` intentionally shows Arabic in the RTL checkbox demo.
  /^component\.checkbox\.rtl/,
];

function isAllowedIdentical(val, key = "", namespace = "") {
  if (typeof val !== "string") return true;
  const fullKey =
    key && namespace && !key.startsWith(`${namespace}.`)
      ? `${namespace}.${key}`
      : key;
  if (
    fullKey &&
    UNTRANSLATED_KEY_PATTERNS.some((pattern) => pattern.test(fullKey))
  )
    return true;
  const trimmed = val.trim();
  if (UNTRANSLATED_ALLOWLIST.has(trimmed)) return true;
  if (/^[\s\d\p{P}\p{S}]+$/u.test(trimmed)) return true;
  if (/^[\+\d\s\(\)X\-\.]+$/i.test(trimmed)) return true;
  if (
    /^(?:(?:DZD|DA|USD|EUR|GBP|\$|€|£)\s*[\d,.]+|[\d,.]+\s*(?:DZD|DA|USD|EUR|GBP|\$|€|£))$/i.test(
      trimmed,
    )
  )
    return true;
  if (/^\{[a-zA-Z0-9_]+\}(?:\s*[:\-—\/]\s*\{[a-zA-Z0-9_]+\})+$/.test(trimmed))
    return true;
  if (!/\s/.test(trimmed)) return true;
  return false;
}

/** Compute a suspicious length-ratio between two translations. */
function suspiciousLengthRatio(aVal, bVal) {
  if (!aVal || !bVal) return false;
  // Ignore short strings (< 25 characters) to avoid false alarms on short button labels or concise phrases
  if (Math.min(aVal.length, bVal.length) < 25) return false;
  const ratio = aVal.length / bVal.length;
  return ratio > 4.0 || ratio < 0.15;
}

function auditLocales() {
  const report = {
    namespaces: [],
    totalKeys: 0,
    missingKeys: {},
    emptyKeys: {},
    placeholderValues: {},
    placeholderMismatches: [],
    lengthRatioWarnings: [],
    rtlControlWarnings: [],
    doubleSpaceWarnings: [],
    allDefinedKeys: new Map(), // fullKeyWithNs -> Set of locales where defined
    nonLeafKeys: new Set(), // keys that resolve to objects, not strings
    namespaceKeys: new Map(), // ns -> Map<subKey, Set of locales>
    knownNamespaces: new Set(), // set of all namespace names
    rawKeyMap: new Map(), // canonicalKey -> fullKey
  };

  ACTIVE_LOCALES.forEach((loc) => {
    report.missingKeys[loc] = [];
    report.emptyKeys[loc] = [];
    report.placeholderValues[loc] = [];
  });

  const fileSets = {};
  LOCALES.forEach((loc) => {
    const d = path.join(LOCALES_DIR, loc);
    fileSets[loc] = new Set(
      fs.existsSync(d)
        ? fs.readdirSync(d).filter((f) => f.endsWith(".json"))
        : [],
    );
  });

  const allFiles = new Set();
  Object.values(fileSets).forEach((set) => set.forEach((f) => allFiles.add(f)));

  report.fileParityIssues = [];
  allFiles.forEach((f) => {
    LOCALES.forEach((loc) => {
      if (!fileSets[loc].has(f)) {
        report.fileParityIssues.push({ locale: loc, missingFile: f });
      }
    });
  });

  const enDir = path.join(LOCALES_DIR, "en");
  if (!fs.existsSync(enDir)) return report;

  const jsonFiles = Array.from(allFiles);

  for (const file of jsonFiles) {
    const ns = path.basename(file, ".json");
    const nsReport = {
      namespace: ns,
      file,
      keysPerLocale: {},
      missingPerLocale: {},
      emptyPerLocale: {},
      placeholderPerLocale: {},
    };

    ACTIVE_LOCALES.forEach((loc) => {
      nsReport.missingPerLocale[loc] = [];
      nsReport.emptyPerLocale[loc] = [];
      nsReport.placeholderPerLocale[loc] = [];
    });

    const parsed = {};
    const flattened = {};
    const unionKeys = new Set();
    const intermediateKeys = new Set();

    for (const locale of LOCALES) {
      const filePath = path.join(LOCALES_DIR, locale, file);
      if (!fs.existsSync(filePath)) {
        parsed[locale] = {};
        flattened[locale] = {};
        continue;
      }

      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        try {
          parsed[locale] = JSON.parse(fileContent);
        } catch (err) {
          report.jsonErrors = report.jsonErrors || [];
          report.jsonErrors.push({
            file: filePath,
            error: err.message,
            locale,
          });
          parsed[locale] = {};
        }

        // Find empty objects or arrays
        function findEmptyObjects(obj, prefix = "") {
          if (obj !== null && typeof obj === "object") {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
              report.emptyObjects = report.emptyObjects || [];
              report.emptyObjects.push({
                namespace: ns,
                key: prefix || "(root)",
                locale,
              });
            } else {
              if (Array.isArray(obj)) {
                obj.forEach((item, idx) =>
                  findEmptyObjects(
                    item,
                    prefix ? `${prefix}.${idx}` : `${idx}`,
                  ),
                );
              } else {
                keys.forEach((k) =>
                  findEmptyObjects(obj[k], prefix ? `${prefix}.${k}` : k),
                );
              }
            }
          }
        }
        findEmptyObjects(parsed[locale]);

        flattened[locale] = flattenObject(parsed[locale], "", intermediateKeys);
        nsReport.keysPerLocale[locale] = Object.keys(flattened[locale]).length;
        Object.keys(flattened[locale]).forEach((k) => unionKeys.add(k));
      } catch (err) {
        parsed[locale] = {};
        flattened[locale] = {};
      }
    }

    report.totalKeys += unionKeys.size;
    report.knownNamespaces.add(ns);
    if (!report.namespaceKeys.has(ns)) report.namespaceKeys.set(ns, new Map());

    for (const interKey of intermediateKeys) {
      const fullInterKeyWithNs = `${ns}.${interKey}`;
      const fullInterKeyWithColon = `${ns}:${interKey}`;
      report.allDefinedKeys.set(fullInterKeyWithNs, new Set(LOCALES));
      report.allDefinedKeys.set(fullInterKeyWithColon, new Set(LOCALES));
      report.allDefinedKeys.set(interKey, new Set(LOCALES));
      // Only fully-qualified names are tracked as non-leaf: bare intermediate
      // names collide across namespaces (e.g. learn.search.placeholder vs
      // search.placeholder) and produce false positives.
      report.nonLeafKeys.add(fullInterKeyWithNs);
      report.nonLeafKeys.add(fullInterKeyWithColon);
      report.namespaceKeys.get(ns).set(interKey, new Set(LOCALES));
      if (interKey.startsWith(`${ns}.`)) {
        const unwrappedInter = interKey.slice(ns.length + 1);
        report.namespaceKeys.get(ns).set(unwrappedInter, new Set(LOCALES));
        report.allDefinedKeys.set(`${ns}:${unwrappedInter}`, new Set(LOCALES));
        report.nonLeafKeys.add(`${ns}:${unwrappedInter}`);
      }
    }

    for (const key of unionKeys) {
      const fullKeyWithNs = `${ns}.${key}`;
      const fullKeyWithColon = `${ns}:${key}`;

      const definedLocales = new Set();
      LOCALES.forEach((loc) => {
        if (flattened[loc] && key in flattened[loc]) {
          definedLocales.add(loc);
        }
      });

      report.allDefinedKeys.set(fullKeyWithNs, definedLocales);
      report.allDefinedKeys.set(fullKeyWithColon, definedLocales);
      report.allDefinedKeys.set(key, definedLocales);
      report.namespaceKeys.get(ns).set(key, definedLocales);
      if (key.startsWith(`${ns}.`)) {
        const unwrappedKey = key.slice(ns.length + 1);
        report.namespaceKeys.get(ns).set(unwrappedKey, definedLocales);
        report.allDefinedKeys.set(`${ns}:${unwrappedKey}`, definedLocales);
      }
      report.rawKeyMap.set(key, fullKeyWithNs);

      // Check missing keys and empty/placeholder values per locale
      ACTIVE_LOCALES.forEach((loc) => {
        if (!flattened[loc] || !(key in flattened[loc])) {
          const item = { namespace: ns, file, key, locale: loc };
          nsReport.missingPerLocale[loc].push(key);
          report.missingKeys[loc].push(item);
        } else {
          const val = flattened[loc][key];
          if (
            val === "" ||
            (typeof val === "string" && val.trim() === "") ||
            val === null
          ) {
            const item = { namespace: ns, file, key, locale: loc };
            nsReport.emptyPerLocale[loc].push(key);
            report.emptyKeys[loc].push(item);
          } else if (
            typeof val === "string" &&
            SUSPICIOUS_PLACEHOLDERS.test(val.trim())
          ) {
            const item = { namespace: ns, file, key, locale: loc, value: val };
            nsReport.placeholderPerLocale[loc].push(key);
            report.placeholderValues[loc].push(item);
          }

          // Check for embedded RTL bidi control characters
          if (typeof val === "string" && RTL_CONTROL_RE.test(val)) {
            report.rtlControlWarnings.push({
              namespace: ns,
              key,
              locale: loc,
              value: val,
            });
          }

          // Check for double spaces
          if (typeof val === "string" && val.includes("  ")) {
            report.doubleSpaceWarnings.push({
              namespace: ns,
              key,
              locale: loc,
              value: val,
            });
          }
        }
      });

      // Cross-locale quality checks (always against the full LOCALES set)
      const enVal = flattened["en"]?.[key];
      if (typeof enVal === "string") {
        const enVars = extractPlaceholders(enVal);

        for (const loc of ["fr", "ar", "kab"]) {
          const otherVal = flattened[loc]?.[key];
          if (typeof otherVal !== "string") continue;

          // Copy-paste detection: exact en == other
          if (enVal === otherVal && !isAllowedIdentical(enVal, key, ns)) {
            report.untranslatedCopyPaste = report.untranslatedCopyPaste || [];
            report.untranslatedCopyPaste.push({
              namespace: ns,
              key,
              locale: loc,
              value: enVal,
            });
          }

          // Arabic script check: ar values must contain Arabic characters
          if (
            loc === "ar" &&
            !ARABIC_SCRIPT_RE.test(otherVal) &&
            !isAllowedIdentical(otherVal, key, ns)
          ) {
            report.nonArabicValues = report.nonArabicValues || [];
            report.nonArabicValues.push({
              namespace: ns,
              key,
              value: otherVal,
            });
          }

          // Kabyle script check: kab values must contain Latin characters
          if (
            loc === "kab" &&
            !LATIN_SCRIPT_RE.test(otherVal) &&
            !isAllowedIdentical(otherVal, key, ns)
          ) {
            report.nonLatinKabyleValues = report.nonLatinKabyleValues || [];
            report.nonLatinKabyleValues.push({
              namespace: ns,
              key,
              value: otherVal,
            });
          }

          // Suspicious length ratio check
          if (
            typeof enVal === "string" &&
            typeof otherVal === "string" &&
            enVal.length > 5 &&
            suspiciousLengthRatio(enVal, otherVal)
          ) {
            report.lengthRatioWarnings.push({
              namespace: ns,
              key,
              locale: loc,
              enLen: enVal.length,
              otherLen: otherVal.length,
              ratio: (enVal.length / otherVal.length).toFixed(2),
            });
          }

          // Interpolation variable parity
          const otherVars = extractPlaceholders(otherVal);
          if (enVars.join(",") !== otherVars.join(",")) {
            report.placeholderMismatches.push({
              namespace: ns,
              file,
              key,
              enVars,
              otherLocale: loc,
              otherVars,
            });
          }
        }
      }
    }

    report.namespaces.push(nsReport);
  }

  return report;
}

// ----------------------------------------------------------------------------
// PART 2: THE HARDCODED TEXT DETECTION ENGINE (AST-BASED)
// ----------------------------------------------------------------------------

function isNaturalLanguageText(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();

  // Too short to be human copy
  if (trimmed.length < 2) return false;

  // Ignore pure punctuation, numbers, currencies, symbols
  if (/^[\s\d\p{P}\p{S}]+$/u.test(trimmed)) return false;

  // Ignore HTML entities: &bull;, &times;, &middot;, &nbsp;, &ldquo;, &rdquo;, etc.
  if (
    /^&(?:bull|times|middot|nbsp|ldquo|rdquo|mdash|ndash|hellip|quot|amp|lt|gt);$/i.test(
      trimmed,
    )
  )
    return false;

  // Ignore numbers with units (e.g. 100px, 50ms, 12rem, 90%, 10MB, 5pts)
  if (
    /^\d+(?:\.\d+)?\s*(?:px|rem|em|ms|s|%|vh|vw|pt|pts|min|mins|h|d|mb|gb|kb|tb|b|dzd|da|usd|eur|gbp|\$|€|£)?$/i.test(
      trimmed,
    )
  )
    return false;

  // Ignore standalone currencies
  if (
    /^(?:DZD|DA|USD|EUR|GBP|\$|€|£)\s*\d+/i.test(trimmed) ||
    /^\d+\s*(?:DZD|DA|USD|EUR|GBP|\$|€|£)/i.test(trimmed)
  )
    return false;

  // Filter out URLs, routes, emails, anchor links
  if (
    /^(?:https?:\/\/|\/api\/|\/|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|mailto:|tel:|#).*/i.test(
      trimmed,
    )
  )
    return false;

  // Filter out SVG path definitions (M, C, L, Z, numbers, commas)
  if (/^M[0-9.,\s-a-zA-Z]+$/i.test(trimmed)) return false;

  // Ignore unit / size delimiters (e.g. "MB /", "GB /", "MB (")
  if (/^(?:MB|GB|KB|B|TB)\s*(?:\/|\(|\/s)\s*$/i.test(trimmed)) return false;

  // Ignore React Context developer invariant assertions (not user-facing)
  if (/^use[A-Za-z0-9_]+\s+must\s+be\s+used\s+within/i.test(trimmed))
    return false;

  // Filter out hex colors, rgb, rgba, hsl
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed))
    return false;

  // Filter out technical keys, UPPER_SNAKE_CASE constants
  if (/^[A-Z0-9_]{3,}$/.test(trimmed)) return false;

  // Filter out MIME types and file extensions
  if (/^(?:application|text|image|audio|video)\/[a-z0-9.+-]+$/.test(trimmed))
    return false;
  if (/^\.[a-zA-Z0-9]+$/.test(trimmed)) return false;

  // Filter out cron expressions (e.g. "* * * * *", "0 0 * * 1")
  if (
    /^[\d\*\/,\-]+ [\d\*\/,\-]+ [\d\*\/,\-]+ [\d\*\/,\-]+ [\d\*\/,\-]+$/.test(
      trimmed,
    )
  )
    return false;

  // Filter out semver-like strings
  if (/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?(?:\+[a-z0-9.]+)?$/i.test(trimmed))
    return false;

  // Filter out common programming keywords used as strings
  const programmingKeywords = new Set([
    "true",
    "false",
    "null",
    "undefined",
    "NaN",
    "Infinity",
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
    "asc",
    "desc",
    "ASC",
    "DESC",
  ]);
  if (programmingKeywords.has(trimmed)) return false;

  // Allowlist check (strip surrounding punctuation or colons)
  const cleanWord = trimmed
    .replace(/^(?:\(|\[|\{)|(?::|\.\.\.|…|[?!.,;)}\]])$/g, "")
    .trim();
  if (
    UNTRANSLATED_ALLOWLIST.has(cleanWord) ||
    UNTRANSLATED_ALLOWLIST.has(trimmed)
  ) {
    return false;
  }

  const safeTechnicalIdentifiers = new Set([
    "ID",
    "URL",
    "API",
    "UI",
    "UX",
    "JSON",
    "CSV",
    "SQL",
    "PDF",
    "DZD",
    "USD",
    "EUR",
    "DA",
    "Esc",
    "Cmd",
    "Ctrl",
    "Alt",
    "Tab",
    "Shift",
    "Enter",
    "Del",
    "X",
    "Y",
    "Z",
    "None",
    "Null",
    "True",
    "False",
    "Button",
    "Card",
    "Input",
    "Modal",
    "Icon",
    "Loader",
    "Search",
    "Props",
    "Context",
    "Error",
    "Promise",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "LIVE",
    "HQ",
    "RC",
    "NIF",
    "NIS",
    "NI",
    "KYC",
    "IP",
    "AI",
    "IA",
    "Aa",
    "KB",
    "MB",
    "GB",
    "kbps",
    "Mbps",
    "ClamAV",
    "LinkedIn",
    "PostgreSQL",
    "WebAuthn",
    "cURL",
    "SHA-256",
    "sha256",
    "webhook-id",
    "webhook-timestamp",
    "webhook-signature",
    "r =",
    "Z =",
    "(|Z| ≥ 2.5)",
  ]);
  if (
    safeTechnicalIdentifiers.has(cleanWord) ||
    safeTechnicalIdentifiers.has(trimmed)
  ) {
    return false;
  }

  // 1. Language Range Detection: Arabic (Unicode block)
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(trimmed))
    return true;

  // 2. Language Range Detection: Taqbaylit (Kabyle) Latin Special Orthography
  if (/[ɣɛḍṭẓṣḥčǧƔƐḌṬẒṢḤČǦ]/.test(trimmed)) return true;

  // 3. Language Range Detection: French accented letters in words
  if (/[éèàçùâêîôûëïüœæÉÈÀÇÙÂÊÎÔÛËÏÜŒÆ]/.test(trimmed)) return true;

  // 4. Single words with punctuation, colons, or ellipses (e.g. Loading..., Gap:, Status:, Outlier, Colonne:)
  const wordPunctMatch = trimmed.match(
    /^([A-Za-z]{2,})(?::|\.\.\.|…|[?!.,;])?$/,
  );
  if (wordPunctMatch) {
    const base = wordPunctMatch[1];
    if (
      safeTechnicalIdentifiers.has(base) ||
      UNTRANSLATED_ALLOWLIST.has(base)
    ) {
      return false;
    }
    return true;
  }

  // 5. Statistical / mathematical copy with word characters and symbols (e.g. (|Z| ≥ 2.5), Z-score)
  if (/[a-zA-Z]/.test(trimmed) && /[:≥≤=><~±|]/.test(trimmed)) {
    return true;
  }

  // 6. Ignore pure CSS / Tailwind utility classes (e.g. "text-emerald-700 font-semibold", "flex items-center gap-2")
  const tokens = trimmed.split(/\s+/);
  const tailwindTokenRe =
    /^(?:[a-z0-9_-]+:)*(?:bg|text|font|border|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|flex|grid|col|row|gap|w|h|min|max|overflow|z|top|bottom|left|right|items|justify|content|self|shadow|opacity|transition|duration|ease|delay|animate|cursor|select|space|inline|block|absolute|relative|fixed|sticky|hidden|truncate|capitalize|uppercase|lowercase|leading|tracking|shrink|grow)[a-z0-9_\-\/\[\]\.\%]*$/;
  if (tokens.length >= 2 && tokens.every((w) => tailwindTokenRe.test(w))) {
    return false;
  }

  // 7. Natural sentence or multi-word English / Latin copy (e.g. "results for", "15 minutes")
  if (/[a-zA-Z]{2,}/.test(trimmed) && /\s+/.test(trimmed)) {
    return true;
  }

  return false;
}

function getCodeFrame(content, line, col) {
  const lines = content.split(/\r?\n/);
  const targetLine = lines[line - 1] || "";
  const pointer = " ".repeat(Math.max(0, col - 1)) + "^";
  return {
    lineText: targetLine.trimEnd(),
    pointerText: pointer,
  };
}

/**
 * Extract the natural language text from a node that might be a string literal,
 * template literal, or template expression. Returns { text, isTemplate } or null.
 */
function extractStringText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node)) {
    return { text: node.text, isTemplate: false };
  }
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, isTemplate: true };
  }
  if (ts.isTemplateExpression(node)) {
    // Extract leading literal head
    const headText = node.head.text;
    if (isNaturalLanguageText(headText)) {
      return { text: headText, isTemplate: true };
    }
    for (const span of node.templateSpans) {
      const spanText = span.literal.text;
      if (isNaturalLanguageText(spanText)) {
        return { text: spanText, isTemplate: true };
      }
    }
  }
  return null;
}

function scanFileAST(filePath, content, localeReport, usedKeysInCode) {
  const { allDefinedKeys, namespaceKeys, knownNamespaces, nonLeafKeys } =
    localeReport;
  const issues = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const localTranslators = new Map(); // identifier -> { ns: string | null, isRaw: boolean }
  const fileNamespaces = new Set();
  const localConstants = new Map(); // identifier -> string

  function preScan(n) {
    if (ts.isVariableDeclaration(n)) {
      if (n.initializer && ts.isCallExpression(n.initializer)) {
        const callee = n.initializer.expression;
        let isUseTranslations = false;
        if (ts.isIdentifier(callee) && callee.text === "useTranslations") {
          isUseTranslations = true;
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "useTranslations"
        ) {
          isUseTranslations = true;
        }

        if (isUseTranslations) {
          const firstArg = n.initializer.arguments[0];
          let ns = null;
          if (firstArg && ts.isStringLiteral(firstArg)) {
            ns = firstArg.text;
            fileNamespaces.add(ns);
          } else if (firstArg && ts.isArrayLiteralExpression(firstArg)) {
            firstArg.elements.forEach((el) => {
              if (ts.isStringLiteral(el)) fileNamespaces.add(el.text);
            });
            if (
              firstArg.elements[0] &&
              ts.isStringLiteral(firstArg.elements[0])
            ) {
              ns = firstArg.elements[0].text;
            }
          }

          if (ts.isIdentifier(n.name)) {
            localTranslators.set(n.name.text, {
              ns,
              boundNs: ns,
              isRaw: false,
            });
          } else if (ts.isObjectBindingPattern(n.name)) {
            for (const el of n.name.elements) {
              const prop = el.propertyName
                ? el.propertyName.text
                : el.name.text;
              const alias = el.name.text;
              if (
                prop === "t" ||
                prop === "translator" ||
                prop === "translate" ||
                prop === "formatMessage"
              ) {
                localTranslators.set(alias, { ns, boundNs: ns, isRaw: false });
              } else if (prop === "raw") {
                localTranslators.set(alias, { ns, boundNs: ns, isRaw: true });
              }
            }
          }
        }
      }

      if (
        ts.isIdentifier(n.name) &&
        n.initializer &&
        (ts.isStringLiteral(n.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(n.initializer))
      ) {
        localConstants.set(n.name.text, n.initializer.text);
      }
    }
    ts.forEachChild(n, preScan);
  }
  preScan(sourceFile);

  function getLineCol(node) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(),
    );
    return { line: line + 1, col: character + 1 };
  }

  // Locale identifiers hardcoded in number/date formatting calls bypass the
  // active locale and drift from the app's RTL/LTR + regional conventions.
  const HARDCODED_LOCALE_RE =
    /^(?:ar|en|fr|kab|de|es|it|pt|nl|ru|tr|zh|ja|ko|sv|pl)(?:-[A-Z]{2})?$/;

  function checkHardcodedLocaleArg(arg, calleeName, targetNode) {
    if (!arg || !ts.isStringLiteral(arg)) return;
    if (!HARDCODED_LOCALE_RE.test(arg.text)) return;
    pushIssue(
      arg,
      "HARDCODED_LOCALE_ID",
      "WARNING",
      `Hardcoded locale "${arg.text}" in ${calleeName}(...). Use useLocale() so formatting follows the active language.`,
      arg.text,
    );
  }

  /** Push an i18n issue. */
  function pushIssue(targetNode, type, severity, message, content_str) {
    const loc = getLineCol(targetNode);
    const frame = getCodeFrame(content, loc.line, loc.col);
    issues.push({
      file: filePath,
      line: loc.line,
      col: loc.col,
      type,
      severity,
      content: content_str,
      frame,
      message,
    });
  }

  function isTranslatorExpr(expr) {
    if (!expr) return { isTranslator: false };
    if (ts.isIdentifier(expr)) {
      if (localTranslators.has(expr.text)) {
        return {
          isTranslator: true,
          tName: expr.text,
          ...localTranslators.get(expr.text),
        };
      }
      if (/^(?:t|tc|ct|translator|translate|formatMessage)$/.test(expr.text)) {
        return {
          isTranslator: true,
          tName: expr.text,
          isRaw: false,
          boundNs: null,
        };
      }
      if (/^t[A-Z]\w*$/.test(expr.text)) {
        const suffix = expr.text.slice(1).toLowerCase();
        const matchedNs = knownNamespaces.has(suffix) ? suffix : null;
        return {
          isTranslator: true,
          tName: expr.text,
          isRaw: false,
          boundNs: matchedNs,
        };
      }
    } else if (ts.isPropertyAccessExpression(expr)) {
      if (expr.name.text === "raw" || expr.name.text === "t") {
        const base = isTranslatorExpr(expr.expression);
        if (base.isTranslator) {
          return {
            isTranslator: true,
            tName: `${base.tName}.${expr.name.text}`,
            isRaw: expr.name.text === "raw",
            boundNs: base.boundNs,
          };
        }
      }
      if (
        ts.isIdentifier(expr.expression) &&
        /^(?:props|ctx|intl|i18n)$/.test(expr.expression.text) &&
        expr.name.text === "t"
      ) {
        return {
          isTranslator: true,
          tName: `${expr.expression.text}.t`,
          isRaw: false,
          boundNs: null,
        };
      }
    }
    return { isTranslator: false };
  }

  function resolveKeyName(keyName, boundNs) {
    let resolvedKey = null;
    let definedLocales = null;

    if (boundNs) {
      const candidateWithBound = `${boundNs}.${keyName}`;
      if (allDefinedKeys.has(candidateWithBound)) {
        resolvedKey = candidateWithBound;
        definedLocales = allDefinedKeys.get(candidateWithBound);
      } else if (
        keyName.startsWith(`${boundNs}.`) &&
        allDefinedKeys.has(keyName)
      ) {
        resolvedKey = keyName;
        definedLocales = allDefinedKeys.get(keyName);
      } else if (namespaceKeys.get(boundNs)?.has(keyName)) {
        resolvedKey = candidateWithBound;
        definedLocales = namespaceKeys.get(boundNs).get(keyName);
      }
    }

    if (!resolvedKey) {
      if (allDefinedKeys.has(keyName)) {
        resolvedKey = keyName;
        definedLocales = allDefinedKeys.get(keyName);
      } else if (
        keyName.startsWith("hub.") &&
        allDefinedKeys.has(keyName.slice(4))
      ) {
        resolvedKey = keyName.slice(4);
        definedLocales = allDefinedKeys.get(keyName.slice(4));
      }
    }

    if (!resolvedKey && keyName.includes(":")) {
      const [nsPart, rest] = keyName.split(/:(.+)/);
      const candidate = `${nsPart}.${rest}`;
      if (allDefinedKeys.has(candidate)) {
        resolvedKey = candidate;
        definedLocales = allDefinedKeys.get(candidate);
      }
    }

    if (!resolvedKey && fileNamespaces.size > 0) {
      for (const ns of fileNamespaces) {
        const candidate = `${ns}.${keyName}`;
        if (allDefinedKeys.has(candidate)) {
          resolvedKey = candidate;
          definedLocales = allDefinedKeys.get(candidate);
          break;
        }
        if (namespaceKeys.get(ns)?.has(keyName)) {
          resolvedKey = candidate;
          definedLocales = namespaceKeys.get(ns).get(keyName);
          break;
        }
      }
    }

    return { resolvedKey, definedLocales };
  }

  function checkKey(keyName, boundNs, targetNode, contextMsg, options = {}) {
    if (!keyName || typeof keyName !== "string") return true;

    const { resolvedKey, definedLocales } = resolveKeyName(keyName, boundNs);

    if (resolvedKey && definedLocales) {
      usedKeysInCode.add(resolvedKey);
      usedKeysInCode.add(keyName);

      const missingLocales = ACTIVE_LOCALES.filter(
        (l) => !definedLocales.has(l),
      );
      if (missingLocales.length > 0) {
        pushIssue(
          targetNode,
          "PARTIAL_I18N_KEY",
          "WARNING",
          `Translation key "${keyName}" is missing in [${missingLocales.join(", ")}] (defined in [${Array.from(definedLocales).join(", ")}])`,
          keyName,
        );
      }

      if (nonLeafKeys.has(resolvedKey) && !options.allowObject) {
        pushIssue(
          targetNode,
          "NON_STRING_I18N_KEY",
          "ERROR",
          `Translation key "${keyName}" resolves to an object, not a string. Use a leaf key (for example "${keyName}.placeholder").`,
          keyName,
        );
        return false;
      }

      return true;
    }

    // Check if key exists in another namespace for a helpful hint
    let suggestion = "";
    for (const [ns, map] of namespaceKeys.entries()) {
      if (map.has(keyName)) {
        suggestion = ` Did you mean "${ns}.${keyName}" or useTranslations("${ns}")?`;
        break;
      }
    }

    pushIssue(
      targetNode,
      "DANGLING_I18N_KEY",
      "ERROR",
      `Translation key "${keyName}" not found in locale files (${contextMsg}).${suggestion}`,
      keyName,
    );
    return false;
  }

  function checkKeyPattern(prefix, boundNs, targetNode, contextMsg) {
    if (!prefix || typeof prefix !== "string") return true;

    const candidates = [];
    if (boundNs) candidates.push(`${boundNs}.${prefix}`);
    if (fileNamespaces && fileNamespaces.size > 0) {
      for (const ns of fileNamespaces) {
        candidates.push(`${ns}.${prefix}`);
      }
    }
    candidates.push(prefix);

    let matchedKeys = [];
    for (const p of candidates) {
      for (const [k] of allDefinedKeys.entries()) {
        if (k.startsWith(p)) {
          matchedKeys.push(k);
        }
      }
      if (matchedKeys.length > 0) break;
    }

    if (matchedKeys.length === 0) {
      pushIssue(
        targetNode,
        "DANGLING_I18N_PATTERN",
        "ERROR",
        `Translation key pattern "${prefix}\${...}" does not match any key in locale files (${contextMsg})`,
        prefix,
      );
      return false;
    }

    for (const k of matchedKeys) {
      usedKeysInCode.add(k);
    }
    return true;
  }

  function extractCandidates(node) {
    if (!node) return [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return [{ kind: "exact", text: node.text, node }];
    }
    if (ts.isConditionalExpression(node)) {
      return [
        ...extractCandidates(node.whenTrue),
        ...extractCandidates(node.whenFalse),
      ];
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return [
          ...extractCandidates(node.left),
          ...extractCandidates(node.right),
        ];
      }
      if (
        op === ts.SyntaxKind.PlusToken &&
        (ts.isStringLiteral(node.left) ||
          ts.isNoSubstitutionTemplateLiteral(node.left))
      ) {
        return [{ kind: "prefix", prefix: node.left.text, node: node.left }];
      }
    }
    if (ts.isTemplateExpression(node)) {
      const headText = node.head.text;
      if (headText && headText.length > 0) {
        return [{ kind: "prefix", prefix: headText, node }];
      }
    }
    if (ts.isIdentifier(node) && localConstants.has(node.text)) {
      return [{ kind: "exact", text: localConstants.get(node.text), node }];
    }
    return [];
  }

  function visit(node) {
    // 1. Detect t("key"), ct("key"), translator("key"), tBi("key") calls
    if (ts.isCallExpression(node)) {
      const tInfo = isTranslatorExpr(node.expression);
      if (tInfo.isTranslator) {
        const arg0 = node.arguments[0];
        const candidates = extractCandidates(arg0);

        for (const cand of candidates) {
          if (cand.kind === "exact") {
            checkKey(
              cand.text,
              tInfo.boundNs,
              cand.node,
              `called via ${tInfo.tName}`,
              { allowObject: tInfo.isRaw },
            );
          } else if (cand.kind === "prefix") {
            checkKeyPattern(
              cand.prefix,
              tInfo.boundNs,
              cand.node,
              `called via ${tInfo.tName}`,
            );
          }
        }

        // The custom t(key, fallback) signature treats a string 2nd argument as
        // the rendered fallback. If the key is missing or points at an object,
        // that literal is the text users actually see -> hardcoded leak.
        if (node.arguments.length >= 2) {
          const secondArg = node.arguments[1];
          const extracted = extractStringText(secondArg);
          const exactKey = candidates.find((cand) => cand.kind === "exact");
          if (
            extracted &&
            exactKey &&
            !tInfo.isRaw &&
            isNaturalLanguageText(extracted.text)
          ) {
            const { resolvedKey } = resolveKeyName(
              exactKey.text,
              tInfo.boundNs,
            );
            const keyIsUnusable = !resolvedKey || nonLeafKeys.has(resolvedKey);
            if (keyIsUnusable) {
              pushIssue(
                secondArg,
                "HARDCODED_FALLBACK",
                "ERROR",
                `Fallback string "${extracted.text}" is rendered because key "${exactKey.text}" ${resolvedKey ? "resolves to an object, not a string" : "is missing from the dictionaries"}. Define the key in all locales and pass variables instead of a literal.`,
                extracted.text,
              );
            }
          }
        }

        // Check for 3rd argument raw fallback: t("key", {}, "Raw string")
        if (node.arguments.length >= 3) {
          const thirdArg = node.arguments[2];
          const extracted = extractStringText(thirdArg);
          if (extracted && isNaturalLanguageText(extracted.text)) {
            pushIssue(
              thirdArg,
              extracted.isTemplate
                ? "RAW_TEMPLATE_FALLBACK"
                : "RAW_FALLBACK_STRING",
              "ERROR",
              `Raw fallback string "${extracted.text}" passed as 3rd arg to ${tInfo.tName}(...)`,
              extracted.text,
            );
          }
        }
      }

      // 1b. Detect manual interpolation on a translator result:
      //    t("key").replace("{{count}}", value) bypasses t(key, { count }).
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "replace"
      ) {
        const receiver = node.expression.expression;
        if (
          ts.isCallExpression(receiver) &&
          isTranslatorExpr(receiver.expression).isTranslator
        ) {
          const placeholderArg = node.arguments[0];
          const extracted = extractStringText(placeholderArg);
          if (extracted && /\{\{?[a-zA-Z0-9_]+\}?\}/.test(extracted.text)) {
            pushIssue(
              node,
              "MANUAL_PLACEHOLDER_REPLACE",
              "WARNING",
              `Manual .replace("${extracted.text}") on a translated string bypasses interpolation. Use t(key, { ...vars }) instead.`,
              extracted.text,
            );
          }
        }
      }

      // 1c. Detect hardcoded locale identifiers in formatting calls:
      //    value.toLocaleString("fr-DZ"), Intl.NumberFormat("ar-DZ")
      if (ts.isPropertyAccessExpression(node.expression)) {
        const callee = node.expression;
        const calleeName = callee.name.text;
        const isIntlFormatter =
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === "Intl" &&
          (calleeName === "NumberFormat" || calleeName === "DateTimeFormat");
        if (
          isIntlFormatter ||
          calleeName === "toLocaleString" ||
          calleeName === "toLocaleDateString" ||
          calleeName === "toLocaleTimeString"
        ) {
          checkHardcodedLocaleArg(node.arguments[0], calleeName, node);
        }
      }
    }

    // 1d. Detect `new Intl.NumberFormat("fr-DZ")` / `new Intl.DateTimeFormat(...)`
    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const callee = node.expression;
      if (
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "Intl" &&
        (callee.name.text === "NumberFormat" ||
          callee.name.text === "DateTimeFormat")
      ) {
        checkHardcodedLocaleArg(node.arguments?.[0], callee.name.text, node);
      }
    }

    // 1e. Detect raw status/state enums rendered directly in JSX children:
    //    <span>{item.status}</span> renders "PENDING_VERIFICATION" untranslated.
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "status" ||
        node.expression.name.text === "state") &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      pushIssue(
        node.expression,
        "UNLOCALIZED_STATUS_RENDER",
        "WARNING",
        `Raw "${node.expression.name.text}" value is rendered without translation. Map it to a localized label via t().`,
        node.expression.getText(sourceFile),
      );
    }

    // 2. Detect i18n keys declared in object properties (e.g. labelKey: "...", titleKey: "...")
    if (ts.isPropertyAssignment(node)) {
      const propName = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : null;

      if (propName) {
        const lowerProp = propName.toLowerCase();
        const init = node.initializer;
        const candidates = extractCandidates(init);

        if (isI18nKeyProp(propName)) {
          for (const cand of candidates) {
            if (cand.kind === "exact") {
              checkKey(cand.text, null, cand.node, `in property '${propName}'`);
            }
          }
        } else if (
          ["label", "title", "description", "text", "name", "heading"].includes(
            lowerProp,
          )
        ) {
          for (const cand of candidates) {
            if (cand.kind === "exact" && cand.text.includes(".")) {
              const firstSegment = cand.text.split(".")[0];
              if (knownNamespaces.has(firstSegment)) {
                checkKey(
                  cand.text,
                  null,
                  cand.node,
                  `in property '${propName}'`,
                );
              }
            }
          }
        }
      }
    }

    // 3. Detect i18n keys passed via JSX attributes (e.g. labelKey="...", titleKey="...")
    if (ts.isJsxAttribute(node)) {
      const propName = node.name.text;
      const lowerProp = propName.toLowerCase();
      const init = node.initializer;

      let targetExpr = init;
      if (init && ts.isJsxExpression(init) && init.expression) {
        targetExpr = init.expression;
      }

      const candidates = extractCandidates(targetExpr);

      if (isI18nKeyProp(propName) || lowerProp === "i18nkey") {
        for (const cand of candidates) {
          if (cand.kind === "exact") {
            checkKey(cand.text, null, cand.node, `in prop '${propName}'`);
          }
        }
      } else if (
        [
          "label",
          "title",
          "description",
          "placeholder",
          "emptytext",
          "tooltip",
        ].includes(lowerProp)
      ) {
        for (const cand of candidates) {
          if (cand.kind === "exact" && cand.text.includes(".")) {
            const firstSegment = cand.text.split(".")[0];
            if (knownNamespaces.has(firstSegment)) {
              checkKey(cand.text, null, cand.node, `in prop '${propName}'`);
            }
          }
        }
      }
    }

    // 4. Parameter default text: function Comp({ text = "Loading..." })
    if (ts.isParameter(node) && node.initializer) {
      const ext = extractStringText(node.initializer);
      if (
        ext &&
        !/^[a-z][a-zA-Z0-9_-]*$/.test(ext.text.trim()) &&
        isNaturalLanguageText(ext.text)
      ) {
        const pName = ts.isIdentifier(node.name) ? node.name.text : "param";
        pushIssue(
          node.initializer,
          "HARDCODED_DEFAULT_PROP",
          "ERROR",
          `Hardcoded default text in parameter '${pName}': "${ext.text}"`,
          ext.text,
        );
      }
    }

    // 5. Detect Fallback Anti-Pattern: t(...) || "Fallback String"
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        const left = node.left;
        const right = node.right;

        let leftIsT = false;
        let leftName = "t";

        if (ts.isCallExpression(left)) {
          const tInfo = isTranslatorExpr(left.expression);
          if (tInfo.isTranslator) {
            leftIsT = true;
            leftName = tInfo.tName;
          }
        }

        if (leftIsT) {
          const extracted = extractStringText(right);
          if (extracted && isNaturalLanguageText(extracted.text)) {
            pushIssue(
              right,
              extracted.isTemplate
                ? "RAW_TEMPLATE_FALLBACK"
                : "RAW_FALLBACK_STRING",
              "ERROR",
              `Raw fallback string "${extracted.text}" used with ${leftName}(...)`,
              extracted.text,
            );
          }
        }
      }
    }

    // 6. Detect Raw JSXText between elements: <div>Some text</div>
    if (ts.isJsxText(node)) {
      const rawText = node.text.trim();
      if (isNaturalLanguageText(rawText)) {
        pushIssue(
          node,
          "HARDCODED_JSX_TEXT",
          "ERROR",
          `Hardcoded JSX text: "${rawText}"`,
          rawText,
        );
      }
    }

    // 7. Detect User-Facing JSX Attributes: placeholder="...", aria-label="..."
    if (ts.isJsxAttribute(node)) {
      const propName = node.name.text.toLowerCase();
      if (USER_FACING_PROPS.has(propName)) {
        const init = node.initializer;
        let textVal = null;
        let targetNode = init;

        // Literal: prop="Text"
        if (init && ts.isStringLiteral(init)) {
          textVal = init.text;
        }
        // Expression: prop={"Text"}
        else if (init && ts.isJsxExpression(init) && init.expression) {
          if (ts.isStringLiteral(init.expression)) {
            textVal = init.expression.text;
            targetNode = init.expression;
          } else if (ts.isTemplateExpression(init.expression)) {
            const extracted = extractStringText(init.expression);
            if (extracted && isNaturalLanguageText(extracted.text)) {
              pushIssue(
                init.expression,
                "HARDCODED_TEMPLATE_PROP",
                "ERROR",
                `Hardcoded template literal in prop '${node.name.text}': "${extracted.text}"`,
                extracted.text,
              );
            }
          } else if (ts.isNoSubstitutionTemplateLiteral(init.expression)) {
            textVal = init.expression.text;
            targetNode = init.expression;
          } else if (ts.isConditionalExpression(init.expression)) {
            const cond = init.expression;
            [cond.whenTrue, cond.whenFalse].forEach((branch) => {
              const extracted = extractStringText(branch);
              if (extracted && isNaturalLanguageText(extracted.text)) {
                pushIssue(
                  branch,
                  "HARDCODED_PROP_TEXT",
                  "ERROR",
                  `Hardcoded conditional string in prop '${node.name.text}': "${extracted.text}"`,
                  extracted.text,
                );
              }
            });
          }
        }

        if (textVal && isNaturalLanguageText(textVal)) {
          pushIssue(
            targetNode,
            "HARDCODED_PROP_TEXT",
            "ERROR",
            `Hardcoded string in prop '${node.name.text}': "${textVal}"`,
            textVal,
          );
        }
      }
    }

    // 8. Detect UI calls: toast.error("..."), confirm("..."), alert("...")
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let isUiCall = false;
      let method = "";

      if (
        ts.isIdentifier(expr) &&
        (expr.text === "confirm" ||
          expr.text === "alert" ||
          expr.text === "prompt")
      ) {
        isUiCall = true;
        method = expr.text;
      } else if (ts.isPropertyAccessExpression(expr)) {
        const obj = expr.expression;
        const prop = expr.name;
        if (ts.isIdentifier(obj) && obj.text === "toast") {
          isUiCall = true;
          method = `toast.${prop.text}`;
        }
        if (ts.isIdentifier(obj) && obj.text === "sonner") {
          isUiCall = true;
          method = `sonner.${prop.text}`;
        }
      }

      if (isUiCall) {
        const arg0 = node.arguments[0];
        const extracted = extractStringText(arg0);
        if (extracted && isNaturalLanguageText(extracted.text)) {
          pushIssue(
            arg0,
            extracted.isTemplate
              ? "HARDCODED_UI_TEMPLATE"
              : "HARDCODED_UI_CALL",
            "ERROR",
            `Hardcoded message in ${method}("${extracted.text}")`,
            extracted.text,
          );
        }
      }
    }

    // 9. Legacy next-intl imports
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        specifier.text === "next-intl"
      ) {
        pushIssue(
          node,
          "LEGACY_NEXT_INTL",
          "WARNING",
          `Legacy next-intl import detected. Use @/lib/i18n instead.`,
          "next-intl",
        );
      }
    }

    // 10. setError / setErrorMessage / setStatus
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr)) {
        const name = expr.text;
        if (
          name.startsWith("set") &&
          (name.endsWith("Error") ||
            name.endsWith("Message") ||
            name.endsWith("Status") ||
            name.endsWith("ErrorMessage"))
        ) {
          const arg0 = node.arguments[0];
          const extracted = extractStringText(arg0);
          if (
            extracted &&
            !/^[a-z][a-zA-Z0-9_-]*$/.test(extracted.text.trim()) &&
            isNaturalLanguageText(extracted.text)
          ) {
            pushIssue(
              arg0,
              "HARDCODED_STATE_ERROR",
              "ERROR",
              `Hardcoded text in ${name}: "${extracted.text}"`,
              extracted.text,
            );
          }
        }
      }
    }

    // 11. Ternary / conditional expression text inside JSX
    if (ts.isConditionalExpression(node)) {
      function isStyleOrClassContext(n) {
        let curr = n.parent;
        while (curr) {
          if (ts.isJsxAttribute(curr)) {
            const name = curr.name.text.toLowerCase();
            if (["classname", "class", "style"].includes(name)) return true;
            break;
          }
          if (ts.isCallExpression(curr)) {
            const fnName = ts.isIdentifier(curr.expression)
              ? curr.expression.text
              : "";
            if (["cn", "clsx", "cva", "twMerge"].includes(fnName)) return true;
          }
          if (ts.isJsxElement(curr) || ts.isJsxFragment(curr)) {
            break;
          }
          curr = curr.parent;
        }
        return false;
      }

      if (!isStyleOrClassContext(node)) {
        // If inside a JSX attribute, only inspect if it is a user-facing prop (e.g. title, placeholder)
        let insideAttr = null;
        if (ts.isJsxAttribute(node.parent)) insideAttr = node.parent;
        else if (
          ts.isJsxExpression(node.parent) &&
          node.parent.parent &&
          ts.isJsxAttribute(node.parent.parent)
        ) {
          insideAttr = node.parent.parent;
        }

        if (insideAttr) {
          const attrName = insideAttr.name.text.toLowerCase();
          if (!USER_FACING_PROPS.has(attrName)) return;
        }

        const parent = node.parent;
        if (
          parent &&
          (ts.isJsxExpression(parent) ||
            ts.isJsxElement(parent) ||
            ts.isJsxFragment(parent) ||
            ts.isJsxAttribute(parent))
        ) {
          [node.whenTrue, node.whenFalse].forEach((branch) => {
            if (
              ts.isStringLiteral(branch) &&
              isNaturalLanguageText(branch.text)
            ) {
              pushIssue(
                branch,
                "HARDCODED_TERNARY_TEXT",
                "ERROR",
                `Hardcoded ternary text: "${branch.text}"`,
                branch.text,
              );
            }
          });
        }
      }
    }

    // 12. JSX expression string literals  {" Some text "}
    if (ts.isJsxExpression(node)) {
      const parent = node.parent;
      if (parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
        if (
          node.expression &&
          ts.isStringLiteral(node.expression) &&
          isNaturalLanguageText(node.expression.text)
        ) {
          pushIssue(
            node.expression,
            "HARDCODED_JSX_EXPRESSION",
            "ERROR",
            `Hardcoded JSX expression text: "${node.expression.text}"`,
            node.expression.text,
          );
        }
      }
    }

    // 13. String concatenation inside JSX / prop
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const isTranslatorKeyArg =
        node.parent &&
        ts.isCallExpression(node.parent) &&
        node.parent.arguments[0] === node &&
        isTranslatorExpr(node.parent.expression).isTranslator;
      let inJsx = false;
      let curr = node;
      while (curr && !isTranslatorKeyArg) {
        if (ts.isJsxExpression(curr) || ts.isJsxAttribute(curr)) {
          inJsx = true;
          break;
        }
        curr = curr.parent;
      }
      if (inJsx) {
        [node.left, node.right].forEach((operand) => {
          if (
            ts.isStringLiteral(operand) &&
            isNaturalLanguageText(operand.text)
          ) {
            pushIssue(
              operand,
              "HARDCODED_CONCATENATION",
              "ERROR",
              `Hardcoded text in concatenation: "${operand.text}"`,
              operand.text,
            );
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

// Fallback regex scanner if typescript module is unavailable
function scanFileRegex(filePath, content, localeReport, usedKeysInCode) {
  const issues = [];
  const lines = content.split(/\r?\n/);
  const allDefinedKeys = localeReport?.allDefinedKeys || new Map();
  const namespaceKeys = localeReport?.namespaceKeys || new Map();

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    // 1. Fallback string: t(...) || "..."
    const fallbackMatch = lineText.match(
      /t\([^)]+\)\s*(?:\|\||\?\?)\s*["'`]([^"'`]{2,})["'`]/,
    );
    if (fallbackMatch && isNaturalLanguageText(fallbackMatch[1])) {
      const col = lineText.indexOf(fallbackMatch[0]) + 1;
      issues.push({
        file: filePath,
        line: lineNum,
        col,
        type: "RAW_FALLBACK_STRING",
        severity: "ERROR",
        content: fallbackMatch[1],
        frame: getCodeFrame(content, lineNum, col),
        message: `Raw fallback string "${fallbackMatch[1]}" used with t(...)`,
      });
    }

    // 2. Props: placeholder="..."
    for (const prop of USER_FACING_PROPS) {
      const propRegex = new RegExp(`\\b${prop}=["']([^"']{2,})["']`, "i");
      const match = lineText.match(propRegex);
      if (match && isNaturalLanguageText(match[1])) {
        const col = lineText.indexOf(match[0]) + 1;
        issues.push({
          file: filePath,
          line: lineNum,
          col,
          type: "HARDCODED_PROP_TEXT",
          severity: "ERROR",
          content: match[1],
          frame: getCodeFrame(content, lineNum, col),
          message: `Hardcoded string in prop '${prop}': "${match[1]}"`,
        });
      }
    }

    // 3. UI modal / toast calls
    const toastMatch = lineText.match(
      /(?:toast\.(?:error|success|info)|confirm|alert)\(\s*["'`]([^"'`]{2,})["'`]/,
    );
    if (toastMatch && isNaturalLanguageText(toastMatch[1])) {
      const col = lineText.indexOf(toastMatch[0]) + 1;
      issues.push({
        file: filePath,
        line: lineNum,
        col,
        type: "HARDCODED_UI_CALL",
        severity: "ERROR",
        content: toastMatch[1],
        frame: getCodeFrame(content, lineNum, col),
        message: `Hardcoded UI call string: "${toastMatch[1]}"`,
      });
    }

    // 4. JSX text between tags
    const jsxMatch = lineText.match(/>([^<>{}\\r\\n]{3,})</);
    if (jsxMatch && isNaturalLanguageText(jsxMatch[1])) {
      const col = lineText.indexOf(jsxMatch[0]) + 1;
      issues.push({
        file: filePath,
        line: lineNum,
        col,
        type: "HARDCODED_JSX_TEXT",
        severity: "ERROR",
        content: jsxMatch[1].trim(),
        frame: getCodeFrame(content, lineNum, col),
        message: `Hardcoded JSX text: "${jsxMatch[1].trim()}"`,
      });
    }

    // 5. Record t("...") usages and check dangling keys
    const tMatches = lineText.matchAll(/(?:\bt|\btc|\bct)\(["']([^"']+)["']/g);
    for (const m of tMatches) {
      const keyName = m[1];
      usedKeysInCode.add(keyName);

      if (allDefinedKeys.size > 0 && keyName.includes(".")) {
        let exists = allDefinedKeys.has(keyName);
        if (!exists) {
          for (const [, map] of namespaceKeys.entries()) {
            if (map.has(keyName)) {
              exists = true;
              break;
            }
          }
        }

        if (!exists) {
          const col = lineText.indexOf(m[0]) + 1;
          issues.push({
            file: filePath,
            line: lineNum,
            col,
            type: "DANGLING_I18N_KEY",
            severity: "ERROR",
            content: keyName,
            frame: getCodeFrame(content, lineNum, col),
            message: `Translation key "${keyName}" does not exist in any locale dictionary`,
          });
        }
      }
    }
  });

  return issues;
}

function collectSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        ["node_modules", ".next", "dist", "build", "__tests__", "api"].includes(
          entry.name,
        ) &&
        (entry.name !== "api" ||
          fullPath.includes(path.join("src", "app", "api")))
      ) {
        continue;
      }
      collectSourceFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      if (
        /\.(tsx|ts)$/.test(entry.name) &&
        !/\.(test|spec)\.(tsx|ts)$/.test(entry.name)
      ) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

function auditSourceCode(localeReport) {
  let targetFiles = [];
  if (FILE_FILTER) {
    const absoluteFilter = path.isAbsolute(FILE_FILTER)
      ? FILE_FILTER
      : path.join(process.cwd(), FILE_FILTER);
    if (fs.existsSync(absoluteFilter)) {
      if (fs.statSync(absoluteFilter).isDirectory()) {
        targetFiles = collectSourceFiles(absoluteFilter);
      } else {
        targetFiles = [absoluteFilter];
      }
    } else {
      console.error(
        `${RED}Error: Filter path "${FILE_FILTER}" does not exist.${RESET}`,
      );
      process.exit(1);
    }
  } else {
    targetFiles = collectSourceFiles(SRC_DIR);
  }

  const allIssues = [];
  const scannedFilesCount = targetFiles.length;
  const usedKeysInCode = new Set();

  for (const filePath of targetFiles) {
    let content;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      continue; // skip unreadable files
    }
    let issues = [];

    if (ts) {
      try {
        issues = scanFileAST(filePath, content, localeReport, usedKeysInCode);
      } catch (err) {
        // AST parse failed for this file — fall back to regex
        issues = scanFileRegex(filePath, content, localeReport, usedKeysInCode);
      }
    } else {
      issues = scanFileRegex(filePath, content, localeReport, usedKeysInCode);
    }

    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  }

  return { scannedFilesCount, issues: allIssues, usedKeysInCode };
}

// ----------------------------------------------------------------------------
// PART 3: FORMATTING & CLI REPORTING
// ----------------------------------------------------------------------------

function printReport(localeReport, codeReport) {
  const totalMissing = Object.values(localeReport.missingKeys).reduce(
    (a, b) => a + b.length,
    0,
  );
  const totalEmpty = Object.values(localeReport.emptyKeys).reduce(
    (a, b) => a + b.length,
    0,
  );
  const totalPlaceholder = Object.values(localeReport.placeholderValues).reduce(
    (a, b) => a + b.length,
    0,
  );
  const totalCodeIssues = codeReport.issues.length;
  const totalCodeErrors = codeReport.issues.filter(
    (issue) => issue.severity !== "WARNING",
  ).length;
  const totalCodeWarnings = totalCodeIssues - totalCodeErrors;
  const totalLengthWarnings = (localeReport.lengthRatioWarnings || []).length;
  const totalRtlWarnings = (localeReport.rtlControlWarnings || []).length;
  const totalDoubleSpace = (localeReport.doubleSpaceWarnings || []).length;
  const totalUntranslated = (localeReport.untranslatedCopyPaste || []).length;

  // Calculate Orphan / Unused Keys
  const unusedKeys = [];
  if (codeReport.usedKeysInCode) {
    for (const [key] of localeReport.allDefinedKeys.entries()) {
      if (key.includes(".")) {
        const parts = key.split(".");
        const directKey = parts.slice(1).join(".");
        if (
          !codeReport.usedKeysInCode.has(key) &&
          !codeReport.usedKeysInCode.has(directKey)
        ) {
          unusedKeys.push(key);
        }
      }
    }
  }

  // Calculate issues by file
  const byFile = new Map();
  codeReport.issues.forEach((issue) => {
    const relPath = path.relative(REPO_ROOT, issue.file);
    if (!byFile.has(relPath)) byFile.set(relPath, []);
    byFile.get(relPath).push(issue);
  });
  const sortedFiles = Array.from(byFile.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  if (IS_JSON) {
    console.log(
      JSON.stringify(
        {
          summary: {
            totalUniqueKeys: localeReport.totalKeys,
            missingKeysCount: totalMissing,
            emptyKeysCount: totalEmpty,
            placeholderKeysCount: totalPlaceholder,
            placeholderMismatchCount: localeReport.placeholderMismatches.length,
            lengthRatioWarnings: totalLengthWarnings,
            rtlControlWarnings: totalRtlWarnings,
            doubleSpaceWarnings: totalDoubleSpace,
            scannedSourceFiles: codeReport.scannedFilesCount,
            filesWithIssuesCount: sortedFiles.length,
            codeIssuesCount: totalCodeIssues,
            codeErrorsCount: totalCodeErrors,
            codeWarningsCount: totalCodeWarnings,
            unusedKeysCount: unusedKeys.length,
          },
          localeDiscrepancies: {
            missing: localeReport.missingKeys,
            empty: localeReport.emptyKeys,
            placeholders: localeReport.placeholderValues,
            placeholderMismatches: localeReport.placeholderMismatches,
            jsonErrors: localeReport.jsonErrors || [],
            emptyObjects: localeReport.emptyObjects || [],
            fileParityIssues: localeReport.fileParityIssues || [],
            untranslatedCopyPaste: localeReport.untranslatedCopyPaste || [],
            nonArabicValues: localeReport.nonArabicValues || [],
            nonLatinKabyleValues: localeReport.nonLatinKabyleValues || [],
            lengthRatioWarnings: localeReport.lengthRatioWarnings || [],
            rtlControlWarnings: localeReport.rtlControlWarnings || [],
            doubleSpaceWarnings: localeReport.doubleSpaceWarnings || [],
          },
          sourceCodeIssuesByFile: Object.fromEntries(
            sortedFiles.map(([f, issues]) => [f, issues.length]),
          ),
          sourceCodeIssues: FILES_ONLY ? undefined : codeReport.issues,
          unusedKeys: SHOW_ORPHANS ? unusedKeys : undefined,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `\n${BOLD}${CYAN}==============================================================================${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}      PODACIUM COMPREHENSIVE i18n & FRONTEND HARDCODED TEXT AUDIT v2         ${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}==============================================================================${RESET}\n`,
  );

  // Section 1: Locale Dictionaries
  if (!ONLY_CODE) {
    console.log(
      `${BOLD}${BLUE}[1/2] 4-WAY LOCALE DICTIONARY PARITY (en, fr, ar, kab)${RESET}`,
    );
    console.log(
      `  Namespaces Scanned: ${BOLD}${localeReport.namespaces.length}${RESET}`,
    );
    console.log(
      `  Total Unique Keys:  ${BOLD}${localeReport.totalKeys}${RESET}`,
    );

    ACTIVE_LOCALES.forEach((loc) => {
      const missCount = (localeReport.missingKeys[loc] || []).length;
      const emptyCount = (localeReport.emptyKeys[loc] || []).length;
      const phCount = (localeReport.placeholderValues[loc] || []).length;
      const parityCount = (localeReport.fileParityIssues || []).filter(
        (i) => i.locale === loc,
      ).length;
      const untranslatedCount = (
        localeReport.untranslatedCopyPaste || []
      ).filter((i) => i.locale === loc).length;
      const nonArCount =
        loc === "ar" ? (localeReport.nonArabicValues || []).length : 0;
      const nonLatinKabCount =
        loc === "kab" ? (localeReport.nonLatinKabyleValues || []).length : 0;
      const errCount =
        missCount +
        emptyCount +
        phCount +
        parityCount +
        untranslatedCount +
        nonArCount +
        nonLatinKabCount;
      const color = errCount === 0 ? GREEN : RED;
      let msg = `  Locale [${loc}]: ${color}${missCount} missing keys, ${emptyCount} empty, ${phCount} placeholders${RESET}`;
      if (parityCount) msg += ` ${RED}(${parityCount} missing files)${RESET}`;
      if (untranslatedCount)
        msg += ` ${YELLOW}(${untranslatedCount} untranslated)${RESET}`;
      if (nonArCount) msg += ` ${RED}(${nonArCount} non-arabic)${RESET}`;
      if (nonLatinKabCount)
        msg += ` ${RED}(${nonLatinKabCount} non-latin kab)${RESET}`;
      console.log(msg);
    });

    // Additional quality metrics
    if (totalLengthWarnings > 0) {
      console.log(
        `  ${YELLOW}Length ratio warnings: ${totalLengthWarnings} (suspicious translation size discrepancies)${RESET}`,
      );
    }
    if (totalRtlWarnings > 0) {
      console.log(
        `  ${YELLOW}RTL control char warnings: ${totalRtlWarnings} (embedded bidi control codes)${RESET}`,
      );
    }
    if (totalDoubleSpace > 0) {
      console.log(
        `  ${YELLOW}Double-space warnings: ${totalDoubleSpace} (copy-paste artifacts)${RESET}`,
      );
    }

    const anyNewErrors =
      (localeReport.jsonErrors && localeReport.jsonErrors.length > 0) ||
      (localeReport.emptyObjects && localeReport.emptyObjects.length > 0) ||
      (localeReport.fileParityIssues &&
        localeReport.fileParityIssues.length > 0) ||
      (localeReport.untranslatedCopyPaste &&
        localeReport.untranslatedCopyPaste.length > 0) ||
      (localeReport.nonArabicValues &&
        localeReport.nonArabicValues.length > 0) ||
      (localeReport.nonLatinKabyleValues &&
        localeReport.nonLatinKabyleValues.length > 0);

    if (
      totalMissing > 0 ||
      totalEmpty > 0 ||
      totalPlaceholder > 0 ||
      anyNewErrors
    ) {
      console.log(`\n  ${YELLOW}${BOLD}Discrepancies Breakdown:${RESET}`);
      ACTIVE_LOCALES.forEach((loc) => {
        if (
          localeReport.fileParityIssues &&
          localeReport.fileParityIssues.filter((i) => i.locale === loc).length >
            0
        ) {
          console.log(`\n    ${RED}Missing Files in [${loc}]:${RESET}`);
          localeReport.fileParityIssues
            .filter((i) => i.locale === loc)
            .forEach((item) => {
              console.log(
                `      - ${GRAY}Missing file:${RESET} ${item.missingFile}`,
              );
            });
        }
        if (
          localeReport.jsonErrors &&
          localeReport.jsonErrors.filter((i) => i.locale === loc).length > 0
        ) {
          console.log(`\n    ${RED}JSON Syntax Errors in [${loc}]:${RESET}`);
          localeReport.jsonErrors
            .filter((i) => i.locale === loc)
            .forEach((item) => {
              console.log(`      - ${GRAY}${item.file}:${RESET} ${item.error}`);
            });
        }
        if (
          localeReport.emptyObjects &&
          localeReport.emptyObjects.filter((i) => i.locale === loc).length > 0
        ) {
          console.log(`\n    ${RED}Empty Objects/Arrays in [${loc}]:${RESET}`);
          localeReport.emptyObjects
            .filter((i) => i.locale === loc)
            .forEach((item) => {
              console.log(
                `      - ${GRAY}${item.namespace}:${RESET} ${item.key}`,
              );
            });
        }
        if (
          localeReport.untranslatedCopyPaste &&
          localeReport.untranslatedCopyPaste.filter((i) => i.locale === loc)
            .length > 0
        ) {
          console.log(
            `\n    ${YELLOW}Untranslated Copy-Paste in [${loc}]:${RESET}`,
          );
          localeReport.untranslatedCopyPaste
            .filter((i) => i.locale === loc)
            .slice(0, 10)
            .forEach((item) => {
              console.log(
                `      - ${GRAY}${item.namespace}:${RESET} ${item.key} = "${item.value}"`,
              );
            });
        }
        if (
          loc === "ar" &&
          localeReport.nonArabicValues &&
          localeReport.nonArabicValues.length > 0
        ) {
          console.log(`\n    ${RED}Non-Arabic Content in [ar]:${RESET}`);
          localeReport.nonArabicValues.slice(0, 10).forEach((item) => {
            console.log(
              `      - ${GRAY}${item.namespace}:${RESET} ${item.key} = "${item.value}"`,
            );
          });
        }
        if (
          loc === "kab" &&
          localeReport.nonLatinKabyleValues &&
          localeReport.nonLatinKabyleValues.length > 0
        ) {
          console.log(`\n    ${RED}Non-Latin Content in [kab]:${RESET}`);
          localeReport.nonLatinKabyleValues.slice(0, 10).forEach((item) => {
            console.log(
              `      - ${GRAY}${item.namespace}:${RESET} ${item.key} = "${item.value}"`,
            );
          });
        }
        if ((localeReport.missingKeys[loc] || []).length > 0) {
          console.log(`\n    ${RED}Missing in [${loc}]:${RESET}`);
          localeReport.missingKeys[loc].slice(0, 10).forEach((item) => {
            console.log(`      - ${GRAY}${item.file}:${RESET} ${item.key}`);
          });
          if (localeReport.missingKeys[loc].length > 10) {
            console.log(
              `      ${GRAY}...and ${localeReport.missingKeys[loc].length - 10} more missing keys.${RESET}`,
            );
          }
        }
        if ((localeReport.emptyKeys[loc] || []).length > 0) {
          console.log(`\n    ${RED}Empty Values in [${loc}]:${RESET}`);
          localeReport.emptyKeys[loc].slice(0, 10).forEach((item) => {
            console.log(`      - ${GRAY}${item.file}:${RESET} ${item.key}`);
          });
        }
        if ((localeReport.placeholderValues[loc] || []).length > 0) {
          console.log(
            `\n    ${YELLOW}Suspicious Placeholder Copy in [${loc}]:${RESET}`,
          );
          localeReport.placeholderValues[loc].slice(0, 10).forEach((item) => {
            console.log(
              `      - ${GRAY}${item.file}:${RESET} ${item.key} = "${item.value}"`,
            );
          });
        }
      });
    } else {
      console.log(
        `  ${GREEN}✓ 100% Complete Symmetric Dictionary Parity Across All 4 Languages!${RESET}`,
      );
    }

    if (localeReport.placeholderMismatches.length > 0) {
      console.log(
        `\n  ${YELLOW}${BOLD}Interpolation Variable Mismatches ({var} vs {{var}}):${RESET}`,
      );
      localeReport.placeholderMismatches.slice(0, 10).forEach((m) => {
        console.log(
          `    - ${m.file} [${m.key}]: en has [${m.enVars.join(", ")}] but ${m.otherLocale} has [${m.otherVars.join(", ")}]`,
        );
      });
    }

    if (totalLengthWarnings > 0 && !IS_SUMMARY) {
      console.log(
        `\n  ${YELLOW}${BOLD}Suspicious Length Ratio Translations:${RESET}`,
      );
      (localeReport.lengthRatioWarnings || []).slice(0, 10).forEach((w) => {
        console.log(
          `    - [${w.locale}] ${w.namespace}.${w.key}: ratio=${w.ratio}x (en=${w.enLen}ch, ${w.locale}=${w.otherLen}ch)`,
        );
      });
    }

    if (totalDoubleSpace > 0 && !IS_SUMMARY) {
      console.log(`\n  ${YELLOW}${BOLD}Double-Space Artifacts:${RESET}`);
      (localeReport.doubleSpaceWarnings || []).slice(0, 10).forEach((w) => {
        console.log(
          `    - [${w.locale}] ${w.namespace}.${w.key}: "${w.value}"`,
        );
      });
    }

    if (SHOW_ORPHANS && unusedKeys.length > 0) {
      console.log(
        `\n  ${YELLOW}${BOLD}Unused Dictionary Keys (Candidates for Removal):${RESET}`,
      );
      console.log(
        `  Found ${BOLD}${unusedKeys.length}${RESET} keys never referenced in code.`,
      );
      unusedKeys
        .slice(0, 15)
        .forEach((k) => console.log(`    - ${GRAY}${k}${RESET}`));
      if (unusedKeys.length > 15) {
        console.log(
          `    ${GRAY}...and ${unusedKeys.length - 15} more unused keys.${RESET}`,
        );
      }
    }
    console.log("");
  }

  // Section 2: Source Code Issues
  if (!ONLY_LOCALES) {
    console.log(`${BOLD}${BLUE}[2/2] FRONTEND SOURCE CODE AST SCANNER${RESET}`);
    console.log(
      `  Files Inspected:     ${BOLD}${codeReport.scannedFilesCount}${RESET}`,
    );
    console.log(
      `  AST Parser Active:   ${BOLD}${ts ? GREEN + "TypeScript Compiler API (Full AST)" : YELLOW + "Built-in Lexer"}${RESET}`,
    );
    console.log(
      `  Total Code Issues:   ${totalCodeIssues === 0 ? GREEN + "0" : `${RED}${totalCodeErrors} error(s)${RESET}, ${YELLOW}${totalCodeWarnings} warning(s)${RESET}`}\n`,
    );

    if (totalCodeIssues > 0) {
      if (FILES_ONLY) {
        console.log(
          `  ${BOLD}Files with violations (${sortedFiles.length} files, sorted by count):${RESET}\n`,
        );
        for (const [relPath, issues] of sortedFiles) {
          const countStr = String(issues.length).padStart(4);
          console.log(
            `    ${RED}${countStr} violation${issues.length > 1 ? "s" : " "} ${RESET} ${MAGENTA}${relPath}${RESET}`,
          );
        }
        console.log("");
      } else {
        for (const [relPath, issues] of sortedFiles) {
          console.log(
            `  ${BOLD}${MAGENTA}${relPath}${RESET} (${issues.length} violation${issues.length > 1 ? "s" : ""}):`,
          );
          issues.forEach((issue) => {
            const badges = {
              RAW_FALLBACK_STRING: `${RED}[FALLBACK STRING]${RESET}`,
              RAW_TEMPLATE_FALLBACK: `${RED}[TEMPLATE FALLBACK]${RESET}`,
              HARDCODED_JSX_TEXT: `${RED}[RAW JSX TEXT]${RESET}`,
              HARDCODED_PROP_TEXT: `${YELLOW}[HARDCODED PROP]${RESET}`,
              HARDCODED_TEMPLATE_PROP: `${YELLOW}[TEMPLATE PROP]${RESET}`,
              DANGLING_I18N_KEY: `${RED}[DANGLING KEY]${RESET}`,
              PARTIAL_I18N_KEY: `${YELLOW}[PARTIAL KEY]${RESET}`,
              NON_STRING_I18N_KEY: `${RED}[NON-STRING KEY]${RESET}`,
              HARDCODED_FALLBACK: `${RED}[VISIBLE FALLBACK]${RESET}`,
              MANUAL_PLACEHOLDER_REPLACE: `${RED}[MANUAL REPLACE]${RESET}`,
              HARDCODED_LOCALE_ID: `${YELLOW}[HARDCODED LOCALE]${RESET}`,
              UNLOCALIZED_STATUS_RENDER: `${YELLOW}[RAW STATUS]${RESET}`,
              DANGLING_I18N_PATTERN: `${RED}[DANGLING PATTERN]${RESET}`,
              HARDCODED_DEFAULT_PROP: `${YELLOW}[DEFAULT PROP]${RESET}`,
              HARDCODED_UI_CALL: `${RED}[UI CALL]${RESET}`,
              HARDCODED_UI_TEMPLATE: `${RED}[UI TEMPLATE]${RESET}`,
              LEGACY_NEXT_INTL: `${YELLOW}[LEGACY IMPORT]${RESET}`,
              HARDCODED_THROW_ERROR: `${RED}[THROW ERROR]${RESET}`,
              HARDCODED_STATE_ERROR: `${RED}[STATE ERROR]${RESET}`,
              HARDCODED_TERNARY_TEXT: `${RED}[TERNARY TEXT]${RESET}`,
              HARDCODED_JSX_EXPRESSION: `${RED}[JSX EXPR TEXT]${RESET}`,
              HARDCODED_CONCATENATION: `${RED}[CONCAT TEXT]${RESET}`,
            };
            const typeBadge =
              badges[issue.type] || `${RED}[${issue.type}]${RESET}`;

            console.log(
              `    Line ${String(issue.line).padEnd(4)} ${typeBadge} ${issue.message}`,
            );

            // Print code frame
            if (issue.frame && !IS_SUMMARY) {
              console.log(`      ${GRAY}${issue.frame.lineText}${RESET}`);
              console.log(`      ${RED}${issue.frame.pointerText}${RESET}`);
            }

            if (FIX_HINTS) {
              console.log(
                `      ${CYAN}↳ Hint: Replace with t("...") or define key in locales/${RESET}`,
              );
            }
          });
          console.log("");
        }
      }
    } else {
      console.log(
        `  ${GREEN}✓ Zero hardcoded natural language strings or raw fallbacks found!${RESET}\n`,
      );
    }
  }

  // Section 3: Final Verdict
  console.log(
    `${BOLD}${CYAN}==============================================================================${RESET}`,
  );
  const anyNewDictErrors =
    (localeReport.jsonErrors && localeReport.jsonErrors.length > 0) ||
    (localeReport.emptyObjects && localeReport.emptyObjects.length > 0) ||
    (localeReport.fileParityIssues &&
      localeReport.fileParityIssues.length > 0) ||
    (localeReport.untranslatedCopyPaste &&
      localeReport.untranslatedCopyPaste.length > 0) ||
    (localeReport.nonArabicValues && localeReport.nonArabicValues.length > 0) ||
    (localeReport.nonLatinKabyleValues &&
      localeReport.nonLatinKabyleValues.length > 0);

  const dictionaryHasErrors =
    totalMissing > 0 ||
    totalEmpty > 0 ||
    totalPlaceholder > 0 ||
    anyNewDictErrors;

  const hasErrors =
    (!ONLY_CODE && dictionaryHasErrors) ||
    (!ONLY_LOCALES && totalCodeErrors > 0);

  const hasWarnings =
    (!ONLY_CODE &&
      (totalLengthWarnings > 0 ||
        totalRtlWarnings > 0 ||
        totalDoubleSpace > 0)) ||
    (!ONLY_LOCALES && totalCodeWarnings > 0);

  if (!hasErrors && !hasWarnings) {
    const passedMessage = ONLY_CODE
      ? "PASSED: Zero hardcoded natural language strings or raw fallbacks in source."
      : ONLY_LOCALES
        ? "PASSED: 100% Dictionary Parity Across All 4 Languages!"
        : "PASSED: 100% Internationalized & Zero Discrepancies Across 4 Languages!";
    console.log(`${BOLD}${GREEN}  ${passedMessage}${RESET}`);
  } else if (!hasErrors && hasWarnings && !STRICT_MODE) {
    console.log(
      `${BOLD}${YELLOW}  PASSED WITH WARNINGS: ${totalLengthWarnings} length warnings, ${totalRtlWarnings} RTL warnings, ${totalDoubleSpace} double-space warnings, ${totalCodeWarnings} code warnings.${RESET}`,
    );
    console.log(
      `${GRAY}  Run with --strict to treat warnings as errors.${RESET}`,
    );
  } else {
    const warnSuffix = hasWarnings
      ? `, ${totalLengthWarnings + totalRtlWarnings + totalDoubleSpace + totalCodeWarnings} warnings`
      : "";
    console.log(
      `${BOLD}${RED}  FAILED: Issues found (${totalMissing} missing keys, ${totalEmpty} empty, ${totalPlaceholder} placeholders, ${totalUntranslated} untranslated, ${totalCodeErrors} code errors${warnSuffix}).${RESET}`,
    );
  }
  console.log(
    `${BOLD}${CYAN}==============================================================================${RESET}\n`,
  );

  if ((hasErrors || (hasWarnings && STRICT_MODE)) && !IS_JSON) {
    process.exitCode = 1;
  }
}

function main() {
  const localeReport = auditLocales();
  const codeReport = ONLY_LOCALES
    ? { scannedFilesCount: 0, issues: [], usedKeysInCode: new Set() }
    : auditSourceCode(localeReport);

  printReport(localeReport, codeReport);
}

main();
