"use client";

import React, { useMemo } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { motion } from "framer-motion";
import { BiDashboardMetadata, BiWidget } from "@/lib/api";
import { WidgetCard } from "./WidgetCard";
import { useTranslations } from "@/lib/i18n";
import { LayoutTemplate } from "lucide-react";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardOverviewProps {
  dashboard: BiDashboardMetadata;
  widgets: BiWidget[];
  isEditable?: boolean;
  onLayoutChange?: (layout: any) => void;
  onDeleteWidget?: (id: number) => void;
  onEditWidget?: (widget: BiWidget) => void;
}

export function DashboardOverview({
  dashboard,
  widgets,
  isEditable = false,
  onLayoutChange,
  onDeleteWidget,
  onEditWidget,
}: DashboardOverviewProps) {
  const { t, dir } = useTranslations("bi");

  // Convert BiWidget[] to RGL layout format
  const layout = useMemo(() => {
    return widgets.map((w) => ({
      i: w.id.toString(),
      x: w.position?.x ?? w.x ?? 0,
      y: w.position?.y ?? w.y ?? 0,
      w: w.position?.w ?? w.w ?? 4,
      h: w.position?.h ?? w.h ?? 3,
      minW: w.position?.minW ?? w.minW ?? 2,
      minH: w.position?.minH ?? w.minH ?? 2,
    }));
  }, [widgets]);

  // Mobile stacked layout (1 column, full width)
  const mobileLayout = useMemo(() => {
    return widgets.map((w, index) => ({
      i: w.id.toString(),
      x: 0,
      y: index * 4,
      w: 1,
      h: Math.max(3, w.position?.h ?? w.h ?? 3),
      minW: 1,
      minH: 2,
    }));
  }, [widgets]);

  // Default breakpoints
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 };

  if (widgets.length === 0 && !isEditable) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-[2.5rem] border-2 border-dashed border-gray-200/50 dark:border-slate-800/50 m-6 shadow-sm"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-blue-400">
          <LayoutTemplate className="w-10 h-10" />
        </div>
        <p className="text-gray-500 dark:text-slate-400 font-black text-xl tracking-tight">
          {t("dashboards.list.empty.description")}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6" dir="ltr">
      {/* RGL works better in LTR container with isRTL prop */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{
          lg: layout,
          md: layout,
          sm: layout,
          xs: mobileLayout,
          xxs: mobileLayout,
        }}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={60}
        margin={[24, 24]}
        isDraggable={isEditable}
        isResizable={isEditable}
        // @ts-expect-error -- react-grid-layout types omit the runtime isRTL option
        isRTL={dir === "rtl"}
        onLayoutChange={(currentLayout: any) => {
          if (isEditable) {
            onLayoutChange?.(currentLayout);
          }
        }}
        draggableHandle=".drag-handle"
        useCSSTransforms={true}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="relative h-full">
            <WidgetCard
              widget={widget}
              className="h-full"
              onDelete={
                isEditable ? () => onDeleteWidget?.(widget.id) : undefined
              }
              onEdit={isEditable ? () => onEditWidget?.(widget) : undefined}
            />
            {isEditable && (
              <div className="drag-handle absolute top-2 end-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-md cursor-move opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 border border-gray-200 dark:border-slate-800">
                <LayoutTemplate className="w-5 h-5 text-gray-500 dark:text-slate-300" />
              </div>
            )}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
