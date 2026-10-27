import { describe, it, expect } from "vitest";
import { resolveKey, isolateText, isolateLTRPart } from "./i18n";

describe("i18n resolveKey", () => {
  const dictionary = {
    contracts: {
      detail: {
        header: {
          title: "Contract #{id}",
        },
      },
    },
    common: {
      error: "An error occurred",
    },
    error: "Root error message",
  };

  it("resolves standard nested dot path", () => {
    expect(resolveKey(dictionary, "contracts.detail.header.title")).toBe(
      "Contract #{id}",
    );
  });

  it("resolves redundant 'hub.' prefixed keys via fallback", () => {
    expect(resolveKey(dictionary, "hub.contracts.detail.header.title")).toBe(
      "Contract #{id}",
    );
  });

  it("resolves redundant first-segment prefix when nested under root", () => {
    const rootDict = {
      contracts: {
        detail: {
          save: "Save Changes",
        },
      },
    };
    expect(resolveKey(rootDict, "hub.contracts.detail.save")).toBe(
      "Save Changes",
    );
  });

  it("returns undefined for non-existent keys", () => {
    expect(resolveKey(dictionary, "contracts.nonexistent.key")).toBeUndefined();
    expect(resolveKey(dictionary, "hub.nonexistent.key")).toBeUndefined();
  });
});

describe("i18n BiDi isolation utilities", () => {
  it("isolates LTR part with Left-to-Right isolate characters", () => {
    const result = isolateLTRPart("DZD");
    expect(result).toBe("\u2066DZD\u2069");
  });

  it("isolates mixed BiDi text with First Strong Isolate", () => {
    const mixed = "Podacium بالعربية";
    const result = isolateText(mixed);
    expect(result).toBe("\u2068Podacium بالعربية\u2069");
  });

  it("isolates pure Arabic RTL text with Right-to-Left isolate", () => {
    const arabic = "مرحبا";
    const result = isolateText(arabic);
    expect(result).toBe("\u2067مرحبا\u2069");
  });

  it("leaves pure English LTR text unisolated when auto", () => {
    const english = "Hello world";
    const result = isolateText(english);
    expect(result).toBe("Hello world");
  });
});
