import { describe, it, expect } from "vitest";
import { sanitizeCsvCell } from "@/lib/csv";

describe("CSV Formula Injection Sanitization (CWE-1236)", () => {
  it("escapes formula trigger '=' by prepending a single quote", () => {
    const malicious = "=cmd|'/C calc'!A0";
    const sanitized = sanitizeCsvCell(malicious);
    expect(sanitized).toBe("\"'=cmd|'/C calc'!A0\"");
  });

  it("escapes formula trigger '+' by prepending a single quote", () => {
    const malicious = "+1234567";
    const sanitized = sanitizeCsvCell(malicious);
    expect(sanitized).toBe('"\'+1234567"');
  });

  it("escapes formula trigger '-' on non-numeric strings", () => {
    const malicious = "-2+3+cmd|' /C calc'!A0";
    const sanitized = sanitizeCsvCell(malicious);
    expect(sanitized).toBe("\"'-2+3+cmd|' /C calc'!A0\"");
  });

  it("preserves genuine negative numbers as numbers", () => {
    const negativeNumber = -45.5;
    const sanitized = sanitizeCsvCell(negativeNumber);
    expect(sanitized).toBe("-45.5");
  });

  it("escapes formula trigger '@' by prepending a single quote", () => {
    const malicious = "@SUM(A1:A10)";
    const sanitized = sanitizeCsvCell(malicious);
    expect(sanitized).toBe('"\'@SUM(A1:A10)"');
  });

  it("escapes tab '\\t' and carriage return '\\r' triggers", () => {
    const tabMalicious = "\t=1+1";
    const sanitized = sanitizeCsvCell(tabMalicious);
    expect(sanitized).toBe('"\'\t=1+1"');
  });

  it("escapes internal double quotes by doubling them according to RFC 4180", () => {
    const textWithQuotes = 'He said "Hello"';
    const sanitized = sanitizeCsvCell(textWithQuotes);
    expect(sanitized).toBe('"He said ""Hello"""');
  });

  it("safely handles null and undefined values", () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });
});
