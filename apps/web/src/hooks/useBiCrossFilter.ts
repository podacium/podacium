"use client";

import { useState, useCallback } from "react";

export interface BiFilterState {
  category?: string;
  startDate?: string;
  endDate?: string;
  searchValue?: string;
  selectedSegment?: string;
  activeFilters: Record<string, any>;
}

export function useBiCrossFilter() {
  const [filters, setFilters] = useState<BiFilterState>({
    activeFilters: {},
  });

  const setCrossFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => {
      const nextFilters = { ...prev.activeFilters };
      if (value === undefined || value === null || value === "") {
        delete nextFilters[key];
      } else {
        nextFilters[key] = value;
      }
      return {
        ...prev,
        activeFilters: nextFilters,
        [key]: value,
      };
    });
  }, []);

  const clearCrossFilters = useCallback(() => {
    setFilters({ activeFilters: {} });
  }, []);

  return {
    filters: filters.activeFilters,
    filterState: filters,
    setCrossFilter,
    clearCrossFilters,
  };
}
