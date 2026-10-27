"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export interface CrossFilter {
  field: string;
  operator: "eq" | "in" | "between" | "gte" | "lte";
  value: any;
  label?: string;
  sourceWidgetId?: number;
}

export interface DrilldownStep {
  level: number;
  field: string;
  value: string | number;
  label: string;
}

export interface BiCrossFilterContextValue {
  filters: Record<string, CrossFilter>;
  drilldownPath: Record<number, DrilldownStep[]>;
  setFilter: (field: string, filter: CrossFilter) => void;
  removeFilter: (field: string) => void;
  clearAllFilters: () => void;
  pushDrilldown: (widgetId: number, step: DrilldownStep) => void;
  popDrilldown: (widgetId: number) => void;
  resetDrilldown: (widgetId: number) => void;
}

const BiCrossFilterContext = createContext<BiCrossFilterContextValue | null>(null);

export const BiCrossFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFiltersState] = useState<Record<string, CrossFilter>>({});
  const [drilldownPath, setDrilldownPath] = useState<Record<number, DrilldownStep[]>>({});

  const setFilter = useCallback((field: string, filter: CrossFilter) => {
    setFiltersState((prev) => ({
      ...prev,
      [field]: filter,
    }));
  }, []);

  const removeFilter = useCallback((field: string) => {
    setFiltersState((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFiltersState({});
    setDrilldownPath({});
  }, []);

  const pushDrilldown = useCallback((widgetId: number, step: DrilldownStep) => {
    setDrilldownPath((prev) => {
      const existing = prev[widgetId] || [];
      return {
        ...prev,
        [widgetId]: [...existing, step],
      };
    });
  }, []);

  const popDrilldown = useCallback((widgetId: number) => {
    setDrilldownPath((prev) => {
      const existing = prev[widgetId] || [];
      if (existing.length === 0) return prev;
      return {
        ...prev,
        [widgetId]: existing.slice(0, -1),
      };
    });
  }, []);

  const resetDrilldown = useCallback((widgetId: number) => {
    setDrilldownPath((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      filters,
      drilldownPath,
      setFilter,
      removeFilter,
      clearAllFilters,
      pushDrilldown,
      popDrilldown,
      resetDrilldown,
    }),
    [filters, drilldownPath, setFilter, removeFilter, clearAllFilters, pushDrilldown, popDrilldown, resetDrilldown]
  );

  return (
    <BiCrossFilterContext.Provider value={value}>
      {children}
    </BiCrossFilterContext.Provider>
  );
};

export const useBiCrossFilterContext = () => {
  const ctx = useContext(BiCrossFilterContext);
  if (!ctx) {
    throw new Error("useBiCrossFilterContext must be used within a BiCrossFilterProvider");
  }
  return ctx;
};
