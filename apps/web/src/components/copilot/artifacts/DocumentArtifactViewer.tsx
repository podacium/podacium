"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  Edit3,
  Eye,
  FileText,
  Download,
  Languages,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { PodaciumButton, PodaciumCard } from "@/components/design-system";
import { FormattedMessage } from "@/components/help-launcher/FormattedMessage";
import { useTranslations } from "@/lib/i18n";
import type { DocumentArtifact } from "@/types/copilot";

export interface DocumentArtifactViewerProps {
  artifact: DocumentArtifact;
  onChange?: (newMarkdown: string) => void;
  onEmitPrompt?: (prompt: string) => void;
}

interface FloatingActionPosition {
  top: number;
  left: number;
  selectedText: string;
}

export function DocumentArtifactViewer({
  artifact,
  onChange,
  onEmitPrompt,
}: DocumentArtifactViewerProps) {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [markdown, setMarkdown] = useState(artifact.markdown);
  const [floatingAction, setFloatingAction] =
    useState<FloatingActionPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMarkdown(artifact.markdown);
  }, [artifact.markdown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${(artifact.title || "document").toLowerCase().replace(/\s+/g, "_")}.md`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTextSelection = () => {
    if (isEditing) {
      setFloatingAction(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setFloatingAction(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      setFloatingAction(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        setFloatingAction({
          top: Math.max(8, rect.top - containerRect.top - 46),
          left: Math.max(10, rect.left - containerRect.left + rect.width / 2),
          selectedText: text,
        });
      }
    } catch {
      setFloatingAction(null);
    }
  };

  useEffect(() => {
    const handleDocumentMouseUp = (e: MouseEvent) => {
      // If clicking inside floating popover, don't dismiss immediately
      const target = e.target as HTMLElement;
      if (target.closest(".floating-action-popover")) {
        return;
      }
      setTimeout(handleTextSelection, 10);
    };

    const handleDocumentKeyUp = () => {
      setTimeout(handleTextSelection, 10);
    };

    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("keyup", handleDocumentKeyUp);

    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("keyup", handleDocumentKeyUp);
    };
  }, [isEditing]);

  const handleExecuteAction = (actionType: "darija" | "cidta" | "anpdp") => {
    if (!floatingAction || !onEmitPrompt) return;

    const { selectedText } = floatingAction;
    let prompt = "";

    switch (actionType) {
      case "darija":
        prompt = `Traduire en Darija (Algérien) le texte suivant :\n"${selectedText}"`;
        break;
      case "cidta":
        prompt = `Appliquer Bouclier Fiscal Art. 169 CIDTA sur le passage suivant pour optimiser les déductions fiscales IBS/IRG :\n"${selectedText}"`;
        break;
      case "anpdp":
        prompt = `Ajouter clause ANPDP (Conformité Loi 25-11 relative à la protection des données personnelles) au texte suivant :\n"${selectedText}"`;
        break;
    }

    onEmitPrompt(prompt);
    setFloatingAction(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={containerRef} className="space-y-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {artifact.category
              ? t("component.copilot.document.categoryDoc", {
                  category: artifact.category,
                })
              : t("component.copilot.document.markdown")}
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
            onClick={handleDownload}
            className="text-xs h-8 px-2.5"
          >
            <Download className="h-3.5 w-3.5 me-1" />
            {t("component.copilot.document.downloadMd")}
          </PodaciumButton>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(!isEditing);
              setFloatingAction(null);
            }}
            className="text-xs h-8 px-2.5"
          >
            {isEditing ? (
              <Eye className="h-3.5 w-3.5 me-1" />
            ) : (
              <Edit3 className="h-3.5 w-3.5 me-1" />
            )}
            {isEditing
              ? t("component.copilot.preview")
              : t("component.copilot.edit")}
          </PodaciumButton>
        </div>
      </div>

      {/* Floating Action Popover on Text Highlight */}
      {floatingAction && onEmitPrompt && (
        <div
          data-testid="document-floating-actions"
          className="floating-action-popover absolute z-50 transform -translate-x-1/2 flex items-center gap-1 p-1 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${floatingAction.top}px`,
            left: `${floatingAction.left}px`,
          }}
        >
          <button
            type="button"
            onClick={() => handleExecuteAction("darija")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title={t("component.copilot.document.actions.translateDarijaTitle")}
          >
            <Languages className="h-3.5 w-3.5 text-blue-400" />
            <span>
              {t("component.copilot.document.actions.translateDarija")}
            </span>
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={() => handleExecuteAction("cidta")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title={t("component.copilot.document.actions.applyArticle169Title")}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {t("component.copilot.document.actions.applyArticle169")}
            </span>
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={() => handleExecuteAction("anpdp")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title={t("component.copilot.document.actions.addAnpdpClauseTitle")}
          >
            <Scale className="h-3.5 w-3.5 text-amber-400" />
            <span>
              {t("component.copilot.document.actions.addAnpdpClause")}
            </span>
          </button>
        </div>
      )}

      {/* Editor / Rendered Document */}
      <PodaciumCard className="p-6 border border-border min-h-[350px]">
        {isEditing ? (
          <textarea
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              onChange?.(e.target.value);
            }}
            rows={16}
            className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none resize-y"
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed font-sans select-text">
            <FormattedMessage content={markdown} />
          </div>
        )}
      </PodaciumCard>
    </div>
  );
}
