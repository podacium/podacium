"use client";

import React, { useState, useRef, useEffect } from "react";
import { CanvasArtifact } from "@/types/copilot";
import {
  PodaciumTabs,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { SqlArtifactViewer } from "./artifacts/SqlArtifactViewer";
import { DocumentArtifactViewer } from "./artifacts/DocumentArtifactViewer";
import { ActionReviewArtifactViewer } from "./artifacts/ActionReviewArtifactViewer";
import { CameraOcrScanner } from "./artifacts/CameraOcrScanner";
import { WorkflowDagViewer } from "./artifacts/WorkflowDagViewer";
import { WilayaDensityMap } from "@/components/bi/WilayaDensityMap";
import {
  Code2,
  FileText,
  BarChart2,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Terminal,
  Database,
  Layers,
  MapPin,
  Camera,
  GitFork,
  Percent,
  Coins,
  Filter,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface CopilotCanvasViewerProps {
  artifacts: CanvasArtifact[];
  activeArtifactId: string;
  onSelectArtifact: (id: string) => void;
  onExecuteQuery?: (sql: string, datasetId?: number) => void;
  onConfirmHitlAction?: (intentId: string, token: string) => Promise<void>;
  onContextChange?: (updatedArtifact: CanvasArtifact) => void;
  onScanSubmit?: (data: { imageBase64: string; receiptText?: string }) => void;
  onOpenScanner?: () => void;
  onEmitPrompt?: (prompt: string) => void;
}

interface BiTableSelectedCell {
  rowIdx: number;
  colKey: string;
  value: string;
  top: number;
  left: number;
}

export function CopilotCanvasViewer({
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onExecuteQuery,
  onConfirmHitlAction,
  onContextChange,
  onScanSubmit,
  onOpenScanner,
  onEmitPrompt,
}: CopilotCanvasViewerProps) {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const [selectedBiCell, setSelectedBiCell] =
    useState<BiTableSelectedCell | null>(null);
  const biTableContainerRef = useRef<HTMLDivElement>(null);

  if (artifacts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 sm:p-10 text-center text-muted-foreground select-none">
        <div className="relative mb-5">
          <div className="relative h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
            <Layers className="h-7 w-7" />
          </div>
        </div>

        <h3 className="text-base font-bold text-foreground tracking-tight">
          {t("component.copilot.canvasReady")}
        </h3>
        <p className="text-xs max-w-sm mt-1.5 leading-relaxed text-muted-foreground">
          {t("component.copilot.canvasReadyDescription")}
        </p>

        {/* Feature showcase pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-md w-full text-start">
          <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                {t("component.copilot.canvas.features.sqlTitle")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("component.copilot.canvas.features.sqlDesc")}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                {t("component.copilot.canvas.features.docsTitle")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("component.copilot.canvas.features.docsDesc")}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                {t("component.copilot.canvas.features.biTitle")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("component.copilot.canvas.features.biDesc")}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                {t("component.copilot.canvas.features.hitlTitle")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("component.copilot.canvas.features.hitlDesc")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = artifacts.map((art) => ({
    id: art.id,
    label: art.title,
    icon:
      art.type === "code_sql" ? (
        <Code2 className="h-3.5 w-3.5 text-blue-600" />
      ) : art.type === "document_markdown" ? (
        <FileText className="h-3.5 w-3.5 text-emerald-600" />
      ) : art.type === "workflow_dag" ? (
        <GitFork className="h-3.5 w-3.5 text-purple-600" />
      ) : art.type === "camera_ocr" ? (
        <Camera className="h-3.5 w-3.5 text-rose-500" />
      ) : art.type === "bi_visualization" ? (
        art.chartType === "wilaya_map" ||
        art.chartType === "density_map" ||
        art.chartType === "map" ? (
          <MapPin className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <BarChart2 className="h-3.5 w-3.5 text-indigo-600" />
        )
      ) : (
        <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
      ),
  }));

  const activeArtifact =
    artifacts.find((a) => a.id === activeArtifactId) ?? artifacts[0];

  const handleCopyArtifact = () => {
    let content = "";
    if (activeArtifact.type === "code_sql") {
      content = activeArtifact.code || "";
    } else if (activeArtifact.type === "document_markdown") {
      content = activeArtifact.markdown || "";
    } else if (activeArtifact.type === "bi_visualization") {
      if (
        Array.isArray(activeArtifact.data) &&
        activeArtifact.data.length > 0
      ) {
        const cols = [
          activeArtifact.categoryKey,
          ...activeArtifact.metrics.map((m) => m.alias),
        ];
        const header = cols.join("\t");
        const rows = activeArtifact.data.map((r) =>
          cols.map((c) => String(r[c] ?? "")).join("\t"),
        );
        content = [header, ...rows].join("\n");
      } else {
        content = JSON.stringify(activeArtifact.data, null, 2);
      }
    } else if (activeArtifact.type === "workflow_dag") {
      content = JSON.stringify(activeArtifact.nodes, null, 2);
    } else if (activeArtifact.type === "camera_ocr") {
      content =
        activeArtifact.receiptText || activeArtifact.capturedImage || "";
    }
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBiCellClick = (
    e: React.MouseEvent<HTMLTableCellElement>,
    rowIdx: number,
    colKey: string,
    value: string,
  ) => {
    const container = biTableContainerRef.current;
    if (!container) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setSelectedBiCell({
      rowIdx,
      colKey,
      value,
      top: Math.max(8, cellRect.top - containerRect.top - 46),
      left: Math.max(
        20,
        cellRect.left - containerRect.left + cellRect.width / 2,
      ),
    });
  };

  const handleExecuteBiAction = (action: "tva19" | "dzd" | "top5") => {
    if (!selectedBiCell || !onEmitPrompt) return;
    const { colKey, value } = selectedBiCell;

    let prompt = "";
    switch (action) {
      case "tva19":
        prompt = `Appliquer TVA 19% sur la colonne "${colKey}" (valeur actuelle : "${value}") et recalculer les totaux TTC.`;
        break;
      case "dzd":
        prompt = `Convertir en DZD les montants de la colonne "${colKey}" (valeur : "${value}").`;
        break;
      case "top5":
        prompt = `Filtrer Top 5 du jeu de données selon la colonne "${colKey}".`;
        break;
    }

    onEmitPrompt(prompt);
    setSelectedBiCell(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Tabs & Toolbar */}
      <div className="px-4 py-2 border-b border-border/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex-1 overflow-x-auto min-w-0">
          <PodaciumTabs
            tabs={tabs}
            defaultTab={activeArtifact.id}
            onChange={onSelectArtifact}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenScanner && (
            <PodaciumButton
              variant="ghost"
              size="sm"
              onClick={onOpenScanner}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              title={t("component.copilot.canvas.scanTooltip")}
            >
              <Camera className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-[11px] hidden sm:inline">
                {t("component.copilot.scan")}
              </span>
            </PodaciumButton>
          )}

          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={handleCopyArtifact}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title={t("component.copilot.canvas.copyTooltip")}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[11px] text-emerald-600">
                  {t("component.copilot.copied")}
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="text-[11px]">
                  {t("component.copilot.copy")}
                </span>
              </>
            )}
          </PodaciumButton>
        </div>
      </div>

      {/* Artifact Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40 dark:bg-slate-950/30">
        {activeArtifact.type === "code_sql" && (
          <SqlArtifactViewer
            key={activeArtifact.id}
            artifact={activeArtifact}
            onRun={(sql) => onExecuteQuery?.(sql, activeArtifact.datasetId)}
            onChange={(updatedCode) =>
              onContextChange?.({ ...activeArtifact, code: updatedCode })
            }
          />
        )}
        {activeArtifact.type === "document_markdown" && (
          <DocumentArtifactViewer
            key={activeArtifact.id}
            artifact={activeArtifact}
            onEmitPrompt={onEmitPrompt}
            onChange={(updatedMd) =>
              onContextChange?.({ ...activeArtifact, markdown: updatedMd })
            }
          />
        )}
        {activeArtifact.type === "workflow_dag" && (
          <WorkflowDagViewer
            key={activeArtifact.id}
            artifact={activeArtifact}
            onEmitPrompt={onEmitPrompt}
          />
        )}
        {activeArtifact.type === "bi_visualization" &&
          (activeArtifact.chartType === "wilaya_map" ||
          activeArtifact.chartType === "density_map" ||
          activeArtifact.chartType === "map" ? (
            <WilayaDensityMap
              data={
                Array.isArray(activeArtifact.data) &&
                activeArtifact.data.length > 0
                  ? (activeArtifact.data as any)
                  : undefined
              }
            />
          ) : (
            <div
              ref={biTableContainerRef}
              className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    {activeArtifact.title}
                  </h4>
                </div>
                <PodaciumBadge
                  variant="outline"
                  className="text-[10px] font-mono"
                >
                  {t("component.copilot.records", {
                    count: activeArtifact.data.length,
                  })}
                </PodaciumBadge>
              </div>

              {/* Floating Action Popover on Table Cell Highlight */}
              {selectedBiCell && onEmitPrompt && (
                <div
                  data-testid="bi-table-floating-actions"
                  className="floating-action-popover absolute z-50 transform -translate-x-1/2 flex items-center gap-1 p-1 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    top: `${selectedBiCell.top}px`,
                    left: `${selectedBiCell.left}px`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExecuteBiAction("tva19")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    title={t(
                      "component.copilot.canvas.actions.apply19TvaTitle",
                    )}
                  >
                    <Percent className="h-3.5 w-3.5 text-blue-400" />
                    <span>
                      {t("component.copilot.canvas.actions.apply19Tva")}
                    </span>
                  </button>
                  <div className="h-4 w-px bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => handleExecuteBiAction("dzd")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    title={t(
                      "component.copilot.canvas.actions.convertToDzdTitle",
                    )}
                  >
                    <Coins className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      {t("component.copilot.canvas.actions.convertToDzd")}
                    </span>
                  </button>
                  <div className="h-4 w-px bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => handleExecuteBiAction("top5")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-800 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    title={t(
                      "component.copilot.canvas.actions.filterTop5Title",
                    )}
                  >
                    <Filter className="h-3.5 w-3.5 text-amber-400" />
                    <span>
                      {t("component.copilot.canvas.actions.filterTop5")}
                    </span>
                  </button>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-border/70 max-h-[460px]">
                <table className="w-full text-start text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs">
                    <tr className="border-b border-border text-muted-foreground font-medium">
                      <th className="py-2.5 px-3.5 text-start font-semibold">
                        {activeArtifact.categoryKey}
                      </th>
                      {activeArtifact.metrics.map((m) => (
                        <th
                          key={m.alias}
                          className="py-2.5 px-3.5 font-mono text-start font-semibold"
                        >
                          {m.alias}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {activeArtifact.data.map((row, i) => {
                      const categoryVal = String(
                        row[activeArtifact.categoryKey] ?? "",
                      );
                      const isCatSelected =
                        selectedBiCell?.rowIdx === i &&
                        selectedBiCell?.colKey === activeArtifact.categoryKey;

                      return (
                        <tr
                          key={i}
                          className="hover:bg-secondary/40 transition-colors"
                        >
                          <td
                            tabIndex={0}
                            role="gridcell"
                            onClick={(e) =>
                              handleBiCellClick(
                                e,
                                i,
                                activeArtifact.categoryKey,
                                categoryVal,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handleBiCellClick(
                                  e as any,
                                  i,
                                  activeArtifact.categoryKey,
                                  categoryVal,
                                );
                              }
                            }}
                            className={`py-2.5 px-3.5 font-medium text-foreground cursor-pointer select-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              isCatSelected
                                ? "bg-primary/20 ring-2 ring-primary/40 rounded-sm"
                                : ""
                            }`}
                          >
                            {categoryVal}
                          </td>
                          {activeArtifact.metrics.map((m) => {
                            const metricVal = String(row[m.alias] ?? "");
                            const isMetricSelected =
                              selectedBiCell?.rowIdx === i &&
                              selectedBiCell?.colKey === m.alias;

                            return (
                              <td
                                key={m.alias}
                                tabIndex={0}
                                role="gridcell"
                                onClick={(e) =>
                                  handleBiCellClick(e, i, m.alias, metricVal)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    handleBiCellClick(
                                      e as any,
                                      i,
                                      m.alias,
                                      metricVal,
                                    );
                                  }
                                }}
                                className={`py-2.5 px-3.5 font-mono text-muted-foreground cursor-pointer select-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                  isMetricSelected
                                    ? "bg-primary/20 ring-2 ring-primary/40 rounded-sm"
                                    : ""
                                }`}
                              >
                                {metricVal}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        {activeArtifact.type === "action_review" && (
          <ActionReviewArtifactViewer
            artifact={activeArtifact}
            onConfirm={async (intentId, token) => {
              if (onConfirmHitlAction) {
                await onConfirmHitlAction(intentId, token);
              }
            }}
          />
        )}
        {activeArtifact.type === "camera_ocr" && (
          <CameraOcrScanner
            key={activeArtifact.id}
            artifact={activeArtifact}
            onScanSubmit={async (data) => {
              onScanSubmit?.(data);
            }}
            onChange={(updated) => onContextChange?.(updated)}
          />
        )}
      </div>
    </div>
  );
}
