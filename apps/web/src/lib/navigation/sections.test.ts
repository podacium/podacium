import { describe, it, expect } from "vitest";
import { ADMIN_SECTIONS } from "./sections";
import enAdmin from "../../../locales/en/admin.json";
import arAdmin from "../../../locales/ar/admin.json";
import frAdmin from "../../../locales/fr/admin.json";
import kabAdmin from "../../../locales/kab/admin.json";

function resolveKey(obj: any, path: string): string | undefined {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = cur[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

describe("ADMIN_SECTIONS Internationalization", () => {
  const locales = [
    { code: "en", data: enAdmin },
    { code: "ar", data: arAdmin },
    { code: "fr", data: frAdmin },
    { code: "kab", data: kabAdmin },
  ];

  it("every admin section has a valid translation key in all 4 locales", () => {
    for (const locale of locales) {
      for (const section of ADMIN_SECTIONS) {
        expect(section.labelKey).toBeDefined();
        const translated = resolveKey(locale.data, section.labelKey!);
        expect(
          translated,
          `Section key ${section.labelKey} missing in ${locale.code}/admin.json`,
        ).toBeTruthy();
        expect(translated).not.toBe(section.labelKey);
      }
    }
  });

  it("every admin item has a valid translation key in all 4 locales", () => {
    for (const locale of locales) {
      for (const section of ADMIN_SECTIONS) {
        for (const item of section.items) {
          expect(item.labelKey).toBeDefined();
          const translated = resolveKey(locale.data, item.labelKey);
          expect(
            translated,
            `Item key ${item.labelKey} missing in ${locale.code}/admin.json`,
          ).toBeTruthy();
          expect(translated).not.toBe(item.labelKey);
        }
      }
    }
  });

  it("both admin.sidebar and admin.tabs keys resolve identical values for backward compatibility", () => {
    for (const locale of locales) {
      const sidebar = (locale.data as any).admin.sidebar;
      const tabs = (locale.data as any).admin.tabs;
      expect(tabs).toBeDefined();
      expect(tabs.dashboard).toBe(sidebar.dashboard);
      expect(tabs.analytics).toBe(sidebar.analytics);
      expect(tabs.contentReview).toBe(sidebar.contentReview);
      expect(tabs.users).toBe(sidebar.users);
      expect(tabs.settings).toBe(sidebar.settings);
    }
  });
});
