"use client";

import React, { useState, useEffect } from "react";
import { Play, Copy, Check, Code2, Database, Table } from "lucide-react";
import { PodaciumButton, PodaciumCard } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { SqlArtifact } from "@/types/copilot";

export interface SqlArtifactViewerProps {
  artifact: SqlArtifact;
  onRun?: (code: string) => void;
  onChange?: (newCode: string) => void;
}

export function SqlArtifactViewer({
  artifact,
  onRun,
  onChange,
}: SqlArtifactViewerProps) {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(artifact.code);

  useEffect(() => {
    setCode(artifact.code);
  }, [artifact.code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    onChange?.(e.target.value);
  };

  const lines = code.split("\n");

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            {artifact.language.toUpperCase()} •{" "}
            {t("component.copilot.sql.duckdbEngine")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs h-8 px-2.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 me-1 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 me-1" />
            )}
            {copied
              ? t("component.copilot.copied")
              : t("component.copilot.copy")}
          </PodaciumButton>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs h-8 px-2.5"
          >
            <Code2 className="h-3.5 w-3.5 me-1" />
            {isEditing
              ? t("component.copilot.preview")
              : t("component.copilot.edit")}
          </PodaciumButton>
          <PodaciumButton
            variant="primary"
            size="sm"
            onClick={() => onRun?.(code)}
            className="text-xs h-8 px-3"
          >
            <Play className="h-3.5 w-3.5 me-1 fill-current" />
            {t("component.copilot.sql.runSql")}
          </PodaciumButton>
        </div>
      </div>

      {/* Editor / Code View */}
      <PodaciumCard className="p-0 border border-border overflow-hidden bg-slate-950 text-slate-100 font-mono text-xs">
        {isEditing ? (
          <textarea
            value={code}
            onChange={handleCodeChange}
            rows={Math.max(8, lines.length + 2)}
            className="w-full bg-transparent p-4 font-mono text-xs text-slate-100 focus:outline-none resize-y"
            spellCheck={false}
          />
        ) : (
          <div className="flex overflow-x-auto p-4 select-text">
            {/* Line numbers */}
            <div className="select-none text-slate-600 text-end pe-4 font-mono">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code */}
            <pre className="font-mono text-slate-200">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </PodaciumCard>

      {/* Execution Results Table if present */}
      {artifact.lastExecutionResult && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Table className="h-3.5 w-3.5 text-primary" />
              {t("component.copilot.sql.result")}:{" "}
              {artifact.lastExecutionResult.rowCount}{" "}
              {t("component.copilot.sql.rows")}
            </span>
            <span className="font-mono">
              {artifact.lastExecutionResult.durationMs}ms
            </span>
          </div>

          <PodaciumCard className="p-0 border border-border overflow-x-auto max-h-64">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-muted-foreground font-mono">
                  {artifact.lastExecutionResult.columns.map((col) => (
                    <th key={col} className="py-2 px-3 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {artifact.lastExecutionResult.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-secondary/30 font-mono text-[11px]"
                  >
                    {artifact.lastExecutionResult!.columns.map((col) => (
                      <td key={col} className="py-1.5 px-3">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </PodaciumCard>
        </div>
      )}
    </div>
  );
}
