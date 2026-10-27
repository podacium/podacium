/**
 * CSV Utility with Formula Injection Sanitization (CWE-1236) and RFC 4180 compliance.
 */

/**
 * Sanitizes a cell value to prevent CSV Formula Injection (CWE-1236).
 * Prepends a single quote (') if the text begins with dangerous spreadsheet execution triggers:
 * '=', '+', '-', '@', '\t', '\r', '|', '%'
 * Numbers and booleans are preserved without quote mangling.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }

  // Preserve valid numbers without quote corruption (e.g. -15.5 remains numeric)
  if (typeof val === "number" && !Number.isNaN(val)) {
    return String(val);
  }

  if (typeof val === "boolean") {
    return String(val);
  }

  let str = typeof val === "object" ? JSON.stringify(val) : String(val);

  // Check for formula injection triggers (accounting for leading whitespace)
  const trimmed = str.trimStart();
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r", "|", "%"];

  if (dangerousPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    // Prefix with single quote (') to force Excel / Calc to treat as plain string
    str = `'${str}`;
  }

  // RFC 4180: escape internal double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates and triggers download of a secure CSV file with UTF-8 BOM for Arabic/French support.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const rowLines = rows.map((r) =>
    r.map((cell) => sanitizeCsvCell(cell)).join(","),
  );

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with Arabic & French characters
  const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("download", safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
