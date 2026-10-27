"use client";

import React, { useState, useCallback } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FormattedMessageTextProps {
  content: string;
  isOwn?: boolean;
}

export function FormattedMessageText({
  content,
  isOwn = false,
}: FormattedMessageTextProps) {
  const t = useTranslations("messaging");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback((code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  // Split by code blocks ```lang ... ```
  const parts = React.useMemo(() => {
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    const result: Array<
      | { type: "code"; language: string; content: string }
      | { type: "text"; content: string }
    > = [];

    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      }

      result.push({
        type: "code",
        language: match[1] || "code",
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      result.push({
        type: "text",
        content: content.slice(lastIndex),
      });
    }

    return result;
  }, [content]);

  // Helper for inline markdown: **bold**, *italic*, `code`, URLs
  const renderInline = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const tokens = text.split(urlRegex);

    return tokens.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "underline break-all inline-flex items-center gap-0.5 hover:opacity-80 transition-opacity",
              isOwn
                ? "text-blue-100 font-medium"
                : "text-blue-600 dark:text-blue-400 font-medium",
            )}
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 inline-block" />
          </a>
        );
      }

      // Inline code
      const codeParts = part.split(/`([^`]+)`/g);
      return codeParts.map((sub, j) => {
        if (j % 2 === 1) {
          return (
            <code
              key={`${i}-${j}`}
              className={cn(
                "px-1.5 py-0.5 rounded font-mono text-[13px]",
                isOwn
                  ? "bg-blue-800/60 text-blue-100"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
              )}
            >
              {sub}
            </code>
          );
        }

        // Bold & italic basic render
        const formatted = sub;
        return (
          <span key={`${i}-${j}`} dir="auto">
            <bdi dir="auto">{formatted}</bdi>
          </span>
        );
      });
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed select-text" dir="auto">
      {parts.map((part, index) => {
        if (part.type === "code") {
          const isCopied = copiedIndex === index;
          return (
            <div
              key={index}
              className="my-2 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 text-slate-100 shadow-md font-mono text-xs"
              dir="ltr"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 select-none">
                <span className="font-semibold uppercase tracking-wider">
                  {part.language}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(part.content, index)}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">
                        {t("attachments.copied")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("attachments.copyContent")}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-[12px] leading-snug">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap break-words" dir="auto">
            {renderInline(part.content)}
          </p>
        );
      })}
    </div>
  );
}

export default FormattedMessageText;
