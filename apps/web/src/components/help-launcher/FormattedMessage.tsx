"use client";

import React, { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { useStreamingMarkdownStabilizer } from "@/hooks/useStreamingMarkdownStabilizer";

/**
 * Enterprise XSS-safe Markdown & BiDi renderer for assistant replies.
 *
 * Supports:
 * - Bold: `**bold**` or `__bold__` (recursively parses inner content)
 * - Italic: `*italic*` or `_italic_`
 * - Inline code: `` `inline code` `` with BiDi isolation (`<bdi dir="ltr">`)
 * - Links: `[label](url)` (recursively parses label for inner bold / code)
 * - Bold links: `**[label](url)**` and `[**label**](url)`
 * - Bare URLs: `https://...` or `http://...`
 * - Multi-line Code blocks: ```lang ... ``` with syntax header and copy button
 * - Headings: `# `, `## `, `### `
 * - Blockquotes: `> `
 * - Bullet lists (`- `, `* `, `• `) and numbered lists (`1. `)
 *
 * All rendered as native React elements — zero raw HTML injection vulnerability.
 */

// Matches:
// 1. Bold wrapped link: **[label](url)**
// 2. Standard link: [label](url)
// 3. Inline code: `code`
// 4. Bold: **bold** or __bold__
// 5. Italic: *italic* or _italic_
// 6. Bare URL: https?://...
const INLINE_PATTERN =
  /(\*\*\[[^\]]+?\]\((?:https?:\/\/|\/)[^\s)]+?\)\*\*|\[[^\]]+?\]\((?:https?:\/\/|\/)[^\s)]+?\)|`[^`]+?`|\*\*[^*]+?\*\*|__(?:[^_]+?)__|https?:\/\/[^\s)]+|\*(?!\*)[^*]+?\*|_(?!_)[^_]+?_)/g;

function isSafeHref(href: string): boolean {
  return href.startsWith("/") || /^https?:\/\//i.test(href);
}

function CodeBlockView({
  language,
  content,
}: {
  language?: string;
  content: string;
}) {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error in insecure context
    }
  }, [content]);

  return (
    <div
      className="my-2 rounded-xl overflow-hidden border border-border/80 bg-slate-950 text-slate-100 shadow-xs font-mono text-xs"
      dir="ltr"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 select-none">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={
            copied ? t("component.copilot.copied") : t("component.copilot.copy")
          }
          title={
            copied ? t("component.copilot.copied") : t("component.copilot.copy")
          }
          className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px] p-1 rounded hover:bg-slate-800"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function renderLink(
  label: string,
  href: string,
  key: string,
  depth: number,
): React.ReactNode {
  if (!isSafeHref(href)) return <span key={key}>{label}</span>;
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      key={key}
      href={href}
      className="font-medium text-primary underline underline-offset-2 hover:text-indigo-600 break-words transition-colors inline-flex items-baseline gap-0.5"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <bdi dir="auto">
        {depth < 5 ? renderInline(label, `${key}-l`, depth + 1) : label}
      </bdi>
    </a>
  );
}

export function renderInline(
  text: string,
  keyPrefix = "i",
  depth = 0,
): React.ReactNode[] {
  if (!text) return [];
  if (depth > 5)
    return [<React.Fragment key={keyPrefix}>{text}</React.Fragment>];

  return text.split(INLINE_PATTERN).map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (!part) return null;

    // 1. Bold wrapped link: **[label](url)**
    if (part.startsWith("**[") && part.endsWith(")**") && part.length > 6) {
      const innerLink = part.slice(2, -2);
      const md = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(innerLink);
      if (md) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderLink(md[1], md[2], `${key}-bl`, depth + 1)}
          </strong>
        );
      }
    }

    // 2. Bold text: **bold** or __bold__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const inner = part.slice(2, -2);
      if (!inner.trim()) {
        return <React.Fragment key={key}>{part}</React.Fragment>;
      }
      return (
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(inner, `${key}-b`, depth + 1)}
        </strong>
      );
    }

    // 3. Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const codeContent = part.slice(1, -1);
      return (
        <code
          key={key}
          dir="ltr"
          className="rounded bg-muted/80 border border-border px-1.5 py-0.5 font-mono text-[0.88em] text-foreground inline-block align-baseline"
        >
          <bdi dir="ltr">{codeContent}</bdi>
        </code>
      );
    }

    // 4. Markdown link: [label](url)
    const md = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (md) {
      return renderLink(md[1], md[2], key, depth);
    }

    // 5. Bare URL: https://... or http://...
    if (/^https?:\/\//i.test(part)) {
      return renderLink(part, part, key, depth);
    }

    // 6. Italic text: *italic* or _italic_
    if (
      (part.startsWith("*") &&
        part.endsWith("*") &&
        part.length >= 3 &&
        !part.startsWith("**")) ||
      (part.startsWith("_") &&
        part.endsWith("_") &&
        part.length >= 3 &&
        !part.startsWith("__"))
    ) {
      const inner = part.slice(1, -1);
      if (!inner.trim()) {
        return <React.Fragment key={key}>{part}</React.Fragment>;
      }
      return (
        <em key={key} className="italic text-foreground">
          {renderInline(inner, `${key}-em`, depth + 1)}
        </em>
      );
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export type Block =
  | { type: "p"; text: string }
  | { type: "code"; language: string; content: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "blockquote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
      alignments?: ("left" | "center" | "right")[];
    }
  | { type: "gap" };

function parseTableRow(line: string): string[] {
  let cleaned = line.trim();
  if (cleaned.startsWith("|")) cleaned = cleaned.slice(1);
  if (cleaned.endsWith("|")) cleaned = cleaned.slice(0, -1);
  return cleaned.split("|").map((cell) => cell.trim());
}

function isTableDelimiterRow(line: string): boolean {
  if (!line || !line.includes("|")) return false;
  const cells = parseTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function parseTableAlignments(line: string): ("left" | "center" | "right")[] {
  const cells = parseTableRow(line);
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Check for code fence start/end: ``` or ```lang
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "code",
          language: codeLanguage,
          content: codeLines.join("\n"),
        });
        inCodeBlock = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    const line = raw.trimEnd();

    // Tables: check if current line and next line form a markdown table header & delimiter
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableDelimiterRow(lines[i + 1])
    ) {
      const headers = parseTableRow(line);
      const alignments = parseTableAlignments(lines[i + 1]);
      blocks.push({ type: "table", headers, rows: [], alignments });
      i++; // consume delimiter row
      continue;
    }

    // Table rows if we are currently inside a table block
    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.type === "table" &&
      line.includes("|") &&
      line.trim().length > 0
    ) {
      if (!isTableDelimiterRow(line)) {
        last.rows.push(parseTableRow(line));
      }
      continue;
    }

    // Headings: ###, ##, #
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: headingMatch[2] });
      continue;
    }

    // Blockquote: >
    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      blocks.push({ type: "blockquote", text: quoteMatch[1] });
      continue;
    }

    // Lists
    const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      const text = (bullet ?? numbered)![1];
      if (last && last.type === type) {
        last.items.push(text);
      } else {
        blocks.push({ type, items: [text] });
      }
    } else if (!line.trim()) {
      if (last && last.type !== "gap") {
        blocks.push({ type: "gap" });
      }
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  // Handle unclosed code block (e.g. streaming mid-block)
  if (inCodeBlock) {
    blocks.push({
      type: "code",
      language: codeLanguage,
      content: codeLines.join("\n"),
    });
  }

  while (blocks.length && blocks[blocks.length - 1].type === "gap") {
    blocks.pop();
  }

  return blocks;
}

export interface FormattedMessageProps {
  content: string;
  className?: string;
  /** Renders a blinking caret after the last block while tokens stream in. */
  streaming?: boolean;
}

export function FormattedMessage({
  content,
  className,
  streaming,
}: FormattedMessageProps) {
  const stabilizedContent = useStreamingMarkdownStabilizer(
    content,
    !!streaming,
  );
  const blocks = toBlocks(stabilizedContent);
  const caret = streaming ? (
    <span
      aria-hidden
      data-testid="streaming-caret"
      className="inline-block w-1.5 h-3.5 ms-0.5 align-[-2px] rounded-sm bg-primary animate-pulse"
    />
  ) : null;

  return (
    <div className={cn("space-y-1.5 break-words", className)} dir="auto">
      {blocks.map((block, idx) => {
        const isLast = idx === blocks.length - 1;
        if (block.type === "gap") return <div key={idx} className="h-0.5" />;

        if (block.type === "code") {
          return (
            <div key={idx}>
              <CodeBlockView
                language={block.language}
                content={block.content}
              />
              {isLast && caret}
            </div>
          );
        }

        if (block.type === "heading") {
          const Tag =
            block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          const sizeClass =
            block.level === 1
              ? "text-base font-bold text-foreground mt-2 mb-1"
              : block.level === 2
                ? "text-sm font-semibold text-foreground mt-1.5 mb-1"
                : "text-xs font-semibold text-foreground mt-1 mb-0.5";
          return (
            <Tag key={idx} className={sizeClass}>
              {renderInline(block.text, `h${idx}`, 0)}
              {isLast && caret}
            </Tag>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={idx}
              className="border-s-2 border-primary/50 ps-3 italic text-muted-foreground my-1 text-[0.92em]"
            >
              {renderInline(block.text, `bq${idx}`, 0)}
              {isLast && caret}
            </blockquote>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={idx}
              className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-card/60 shadow-xs"
            >
              <table className="w-full text-xs text-start border-collapse">
                {block.headers.length > 0 && (
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      {block.headers.map((h, hIdx) => {
                        const align = block.alignments?.[hIdx] ?? "left";
                        return (
                          <th
                            key={hIdx}
                            className={cn(
                              "px-3 py-2 text-foreground font-semibold",
                              align === "center" && "text-center",
                              align === "right" && "text-end",
                              align === "left" && "text-start",
                            )}
                          >
                            {renderInline(h, `th${idx}-${hIdx}`, 0)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-border/60">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {row.map((cell, cIdx) => {
                        const align = block.alignments?.[cIdx] ?? "left";
                        return (
                          <td
                            key={cIdx}
                            className={cn(
                              "px-3 py-2 text-foreground/90",
                              align === "center" && "text-center",
                              align === "right" && "text-end",
                              align === "left" && "text-start",
                            )}
                          >
                            {renderInline(cell, `td${idx}-${rIdx}-${cIdx}`, 0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLast && caret}
            </div>
          );
        }

        if (block.type === "p") {
          return (
            <p key={idx} className="leading-relaxed">
              {renderInline(block.text, `p${idx}`, 0)}
              {isLast && caret}
            </p>
          );
        }

        const ListTag = block.type;
        return (
          <ListTag
            key={idx}
            className={cn(
              "space-y-1 ps-4 leading-relaxed marker:text-primary/70",
              ListTag === "ul" ? "list-disc" : "list-decimal",
            )}
          >
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx}>
                {renderInline(item, `l${idx}-${itemIdx}`, 0)}
                {isLast && itemIdx === block.items.length - 1 && caret}
              </li>
            ))}
          </ListTag>
        );
      })}
      {blocks.length === 0 && caret}
    </div>
  );
}

export default FormattedMessage;
