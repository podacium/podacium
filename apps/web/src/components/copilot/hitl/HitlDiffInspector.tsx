"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Columns2, AlignJustify } from "lucide-react";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface HitlDiffInspectorProps {
  before?: string | Record<string, any> | null;
  after?: string | Record<string, any> | null;
  defaultViewMode?: "split" | "unified";
  className?: string;
  title?: string;
}

function stringifyPayload(
  val: string | Record<string, any> | null | undefined,
): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];
  const diff: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oLine = oldLines[oldIdx];
    const nLine = newLines[newIdx];

    if (oLine !== undefined && nLine !== undefined) {
      if (oLine === nLine) {
        diff.push({
          type: "unchanged",
          content: oLine,
          lineNumberOld: oldIdx + 1,
          lineNumberNew: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      } else {
        diff.push({
          type: "removed",
          content: oLine,
          lineNumberOld: oldIdx + 1,
        });
        diff.push({
          type: "added",
          content: nLine,
          lineNumberNew: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      }
    } else if (oLine !== undefined) {
      diff.push({
        type: "removed",
        content: oLine,
        lineNumberOld: oldIdx + 1,
      });
      oldIdx++;
    } else if (nLine !== undefined) {
      diff.push({
        type: "added",
        content: nLine,
        lineNumberNew: newIdx + 1,
      });
      newIdx++;
    }
  }

  return diff;
}

export function HitlDiffInspector({
  before,
  after,
  defaultViewMode = "split",
  className,
  title = "Parameter Changes",
}: HitlDiffInspectorProps) {
  const t = useTranslations();
  const [viewMode, setViewMode] = useState<"split" | "unified">(
    defaultViewMode,
  );

  const oldStr = stringifyPayload(before);
  const newStr = stringifyPayload(after);
  const diffLines = computeDiff(oldStr, newStr);

  const oldLinesList = oldStr.split("\n");
  const newLinesList = newStr.split("\n");
  const maxLineCount = Math.max(oldLinesList.length, newLinesList.length);

  return (
    <div
      data-testid="hitl-diff-inspector"
      className={cn(
        "rounded-lg border border-border bg-slate-50 dark:bg-slate-950 font-mono text-xs overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-slate-100 dark:bg-slate-900 px-3 py-2">
        <span className="font-semibold text-slate-700 dark:text-slate-300 font-sans text-xs">
          {title}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("split")}
            aria-label={t("copilot.hitl.diff.splitViewAria")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
              viewMode === "split"
                ? "bg-white dark:bg-slate-800 text-primary font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span>{t("copilot.hitl.diff.split")}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("unified")}
            aria-label={t("copilot.hitl.diff.unifiedViewAria")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
              viewMode === "unified"
                ? "bg-white dark:bg-slate-800 text-primary font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <AlignJustify className="h-3.5 w-3.5" />
            <span>{t("copilot.hitl.diff.unified")}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-72 overflow-y-auto p-2">
        {viewMode === "split" ? (
          <div className="grid grid-cols-2 gap-2 min-w-[420px]">
            {/* Old side */}
            <div className="border-r border-border/60 pr-2">
              <div className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 mb-1">
                {t("copilot.hitl.diff.before")}
              </div>
              {Array.from({ length: maxLineCount }).map((_, idx) => {
                const line = oldLinesList[idx];
                const isDifferent = line !== newLinesList[idx];
                return (
                  <div
                    key={`old-${idx}`}
                    className={cn(
                      "flex items-start gap-2 py-0.5 px-1 rounded-xs whitespace-pre-wrap break-all",
                      isDifferent && line !== undefined
                        ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                        : "text-slate-600 dark:text-slate-400",
                    )}
                  >
                    <span className="w-5 shrink-0 text-right select-none text-muted-foreground/60 text-[10px]">
                      {line !== undefined ? idx + 1 : ""}
                    </span>
                    <span className="w-3 shrink-0 text-center select-none font-bold">
                      {isDifferent && line !== undefined ? "-" : " "}
                    </span>
                    <span className="flex-1">{line ?? ""}</span>
                  </div>
                );
              })}
            </div>

            {/* New side */}
            <div className="pl-2">
              <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                {t("copilot.hitl.diff.after")}
              </div>
              {Array.from({ length: maxLineCount }).map((_, idx) => {
                const line = newLinesList[idx];
                const isDifferent = line !== oldLinesList[idx];
                return (
                  <div
                    key={`new-${idx}`}
                    className={cn(
                      "flex items-start gap-2 py-0.5 px-1 rounded-xs whitespace-pre-wrap break-all",
                      isDifferent && line !== undefined
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "text-slate-600 dark:text-slate-400",
                    )}
                  >
                    <span className="w-5 shrink-0 text-right select-none text-muted-foreground/60 text-[10px]">
                      {line !== undefined ? idx + 1 : ""}
                    </span>
                    <span className="w-3 shrink-0 text-center select-none font-bold">
                      {isDifferent && line !== undefined ? "+" : " "}
                    </span>
                    <span className="flex-1">{line ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Unified View */
          <div className="space-y-0.5">
            {diffLines.map((line, idx) => (
              <div
                key={`unified-${idx}`}
                className={cn(
                  "flex items-start gap-2 py-0.5 px-2 rounded-xs whitespace-pre-wrap break-all",
                  line.type === "added" &&
                    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium",
                  line.type === "removed" &&
                    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-medium",
                  line.type === "unchanged" &&
                    "text-slate-600 dark:text-slate-400",
                )}
              >
                <span className="w-6 shrink-0 text-right select-none text-muted-foreground/60 text-[10px]">
                  {line.lineNumberOld ?? ""}
                </span>
                <span className="w-6 shrink-0 text-right select-none text-muted-foreground/60 text-[10px]">
                  {line.lineNumberNew ?? ""}
                </span>
                <span className="w-3 shrink-0 text-center select-none font-bold">
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                </span>
                <span className="flex-1">{line.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HitlDiffInspector;
