import { describe, it, expect } from "vitest";
import {
  formatDZD,
  formatNumberDZ,
  formatPercentageDZ,
  BIDI_CHARS,
} from "./formatDZD";

describe("formatDZD", () => {
  it("formats basic integer", () => {
    expect(formatDZD(1500)).toBe("1 500 د.ج");
  });

  it("formats large numbers with space separators", () => {
    expect(formatDZD(1500000)).toBe("1 500 000 د.ج");
  });

  it("formats with decimals", () => {
    expect(formatDZD(1500.5, { decimals: 2 })).toBe("1 500,50 د.ج");
  });

  it("hides symbol when showSymbol is false", () => {
    expect(formatDZD(1500, { showSymbol: false })).toBe("1 500");
  });

  it("returns dash for null", () => {
    expect(formatDZD(null)).toBe("—");
  });

  it("returns dash for undefined", () => {
    expect(formatDZD(undefined)).toBe("—");
  });

  it("returns dash for empty string", () => {
    expect(formatDZD("")).toBe("—");
  });

  it("returns dash for NaN string", () => {
    expect(formatDZD("not a number")).toBe("—");
  });

  it("handles string numbers", () => {
    expect(formatDZD("2500")).toBe("2 500 د.ج");
  });

  it("handles zero", () => {
    expect(formatDZD(0)).toBe("0 د.ج");
  });

  it("handles negative numbers", () => {
    expect(formatDZD(-5000)).toBe("-5 000 د.ج");
  });

  describe("compact mode", () => {
    it("formats thousands as K", () => {
      expect(formatDZD(15000, { compact: true })).toBe("15K د.ج");
    });

    it("formats millions as M", () => {
      expect(formatDZD(1500000, { compact: true })).toBe("1,5M د.ج");
    });

    it("formats billions as Md", () => {
      expect(formatDZD(2000000000, { compact: true })).toBe("2Md د.ج");
    });

    it("keeps small numbers as-is", () => {
      expect(formatDZD(500, { compact: true })).toBe("500 د.ج");
    });
  });

  describe("BiDi (UAX #9) directional isolation", () => {
    it("formats compact millions with bidi isolation", () => {
      const result = formatDZD(1500000, { compact: true, isolate: true });
      expect(result).toBe(
        `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}1,5M${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}د.ج${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`,
      );
    });

    it("formats compact billions with bidi isolation", () => {
      const result = formatDZD(2000000000, { compact: true, isolate: true });
      expect(result).toBe(
        `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}2Md${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}د.ج${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`,
      );
    });

    it("formats standard currency with bidi isolation", () => {
      const result = formatDZD(15000, { isolate: true });
      expect(result).toBe(
        `${BIDI_CHARS.FSI}${BIDI_CHARS.LRI}15 000${BIDI_CHARS.PDI}${BIDI_CHARS.NBSP}${BIDI_CHARS.FSI}د.ج${BIDI_CHARS.PDI}${BIDI_CHARS.PDI}`,
      );
    });

    it("formats number without symbol but with bidi isolation", () => {
      const result = formatDZD(15000, { showSymbol: false, isolate: true });
      expect(result).toBe(`${BIDI_CHARS.LRI}15 000${BIDI_CHARS.PDI}`);
    });

    it("preserves existing non-isolated format for backward compatibility", () => {
      expect(formatDZD(1500000, { compact: true })).toBe("1,5M د.ج");
      expect(formatDZD(15000)).toBe("15 000 د.ج");
    });
  });
});

describe("formatNumberDZ", () => {
  it("formats with space separators", () => {
    expect(formatNumberDZ(15000)).toBe("15 000");
  });

  it("formats with decimals", () => {
    expect(formatNumberDZ(1234.56, 2)).toBe("1 234,56");
  });

  it("returns dash for null", () => {
    expect(formatNumberDZ(null)).toBe("—");
  });
});

describe("formatPercentageDZ", () => {
  it("formats percentage with comma decimal", () => {
    expect(formatPercentageDZ(45.5)).toBe("45,5%");
  });

  it("formats integer percentage", () => {
    expect(formatPercentageDZ(100, 0)).toBe("100%");
  });

  it("returns dash for null", () => {
    expect(formatPercentageDZ(null)).toBe("—");
  });
});
