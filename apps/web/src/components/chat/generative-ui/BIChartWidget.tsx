"use client";

import React, { useState } from "react";
import {
  Download,
  Table as TableIcon,
  BarChart2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { PodaciumCard, PodaciumButton } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { BIChartWidgetPayload } from "./types";

export interface BIChartWidgetProps {
  payload: BIChartWidgetPayload;
  className?: string;
}

export function BIChartWidget({ payload, className }: BIChartWidgetProps) {
  const { t } = useTranslations();
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  // Export CSV RFC 4180 with spreadsheet formula injection protection
  const handleExportCsv = () => {
    if (!payload.data?.length) return;
    const headers = Object.keys(payload.data[0]);
    const escapeCsvCell = (val: unknown) => {
      let str = String(val ?? "");
      // Prevent formula injection in Excel/Calc
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return JSON.stringify(str);
    };

    const csvContent = [
      headers.join(","),
      ...payload.data.map((row) =>
        headers.map((h) => escapeCsvCell(row[h])).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${(payload.title || "chart").toLowerCase().replace(/\s+/g, "_")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metricKey = payload.metricKey || "value";
  const dimensionKey = payload.dimensionKey || "label";

  // Calculate maximum value for SVG bar scaling
  const maxVal = Math.max(
    ...payload.data.map((d) => Number(d[metricKey]) || 0),
    1,
  );

  return (
    <PodaciumCard
      className={cn(
        "my-2 w-full max-w-xl overflow-hidden p-0 border border-border",
        className,
      )}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 bg-secondary/20">
        <div>
          <h4 className="font-semibold text-foreground text-sm">
            {payload.title}
          </h4>
          {payload.description && (
            <p className="text-muted-foreground text-xs mt-0.5">
              {payload.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "chart" ? "table" : "chart")
            }
            aria-label={
              viewMode === "chart"
                ? t("component.generativeUi.biChart.viewTable")
                : t("component.generativeUi.biChart.viewChart")
            }
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={
              viewMode === "chart"
                ? t("component.generativeUi.biChart.viewTable")
                : t("component.generativeUi.biChart.viewChart")
            }
          >
            {viewMode === "chart" ? (
              <TableIcon className="w-4 h-4" />
            ) : (
              <BarChart2 className="w-4 h-4" />
            )}
          </button>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs h-7 px-2"
          >
            <Download className="w-3 h-3 me-1" />
            CSV
          </PodaciumButton>
        </div>
      </div>

      {/* KPI Badges */}
      {payload.kpis && payload.kpis.length > 0 && (
        <div className="p-3 bg-secondary/30 border-b border-border grid grid-cols-2 sm:grid-cols-3 gap-2">
          {payload.kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-card border border-border/60"
            >
              <span className="text-[10px] text-muted-foreground block truncate">
                {kpi.label}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono text-sm font-bold text-foreground">
                  {kpi.value}
                </span>
                {kpi.delta && (
                  <span
                    className={cn(
                      "text-[10px] font-medium flex items-center gap-0.5",
                      kpi.delta.isPositive
                        ? "text-emerald-600"
                        : "text-destructive",
                    )}
                  >
                    {kpi.delta.isPositive ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5" />
                    )}
                    {kpi.delta.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visualization Canvas */}
      <div className="p-4">
        {viewMode === "chart" ? (
          <div className="space-y-2">
            {payload.data.slice(0, 8).map((item, i) => {
              const val = Number(item[metricKey]) || 0;
              const pct = Math.min(100, Math.round((val / maxVal) * 100));
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium truncate max-w-[200px]">
                      {String(item[dimensionKey] || "")}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {val.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-52">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 px-2 font-medium capitalize text-start">
                    {dimensionKey}
                  </th>
                  <th className="py-1.5 px-2 font-medium capitalize text-start">
                    {metricKey}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payload.data.map((row, i) => (
                  <tr key={i} className="hover:bg-secondary/40">
                    <td className="py-1.5 px-2 font-medium text-foreground">
                      {String(row[dimensionKey] ?? "")}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-muted-foreground">
                      {String(row[metricKey] ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PodaciumCard>
  );
}
