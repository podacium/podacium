/**
 * Safe plain-text → HTML conversion for outbound mail.
 *
 * Every character is HTML-escaped before a deliberately tiny Markdown subset
 * is applied, so message text can never inject markup or scripts into the
 * MIME body that recipients receive.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToSafeHtml(value: string): string {
  const safe = escapeHtml(value.trim());
  const withMarkdown = safe
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${withMarkdown.replace(
    /\n/g,
    "<br/>",
  )}</div>`;
}
