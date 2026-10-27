'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ViewType } from '@/lib/api'

// ─── Query keys ────────────────────────────────────────────────────────────────

export const biKeys = {
  all: ['bi'] as const,
  dashboards: ['bi', 'dashboards'] as const,
  dashboard: (id: number | string) => ['bi', 'dashboard', id] as const,
  datasets: ['bi', 'datasets'] as const,
  dataset: (id: number | string) => ['bi', 'dataset', id] as const,
  insights: (locale?: string) => ['bi', 'insights', locale] as const,
  health: (orgId?: number, locale?: string) => ['bi', 'health', orgId, locale] as const,
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export function useBiDashboard(dashboardId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: biKeys.dashboard(dashboardId),
    queryFn: () => api.getDashboard(dashboardId, true, ViewType.ANALYST),
    enabled: options?.enabled ?? dashboardId > 0,
  })
}

export function useBiDatasets(options?: {
  enabled?: boolean
  page?: number
  pageSize?: number
  search?: string
  domain?: string
  organizationId?: number
}) {
  const { enabled = true, page = 1, pageSize = 100, search, domain, organizationId } = options || {}
  return useQuery({
    queryKey: [...biKeys.datasets, page, pageSize, search, domain, organizationId],
    queryFn: () => api.getDatasets(page, pageSize, search, domain, organizationId),
    enabled,
  })
}

export function useBiInsights(locale?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: biKeys.insights(locale),
    queryFn: () => api.getInsights(locale),
    enabled: options?.enabled ?? true,
  })
}

export function useBiHealth(orgId?: number, locale?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: biKeys.health(orgId, locale),
    queryFn: () => api.getBusinessHealthScore(orgId, locale),
    enabled: options?.enabled ?? true,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdateBiDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: any }) => api.updateDashboard(Number(id), data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: biKeys.dashboard(id) })
      qc.invalidateQueries({ queryKey: biKeys.dashboards })
    },
  })
}

export function useDeleteBiDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => api.deleteDashboard(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biKeys.dashboards })
    },
  })
}

export function useUpdateBiDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: { name?: string | null; description?: string | null; domain?: string | null } }) =>
      api.updateDataset(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: biKeys.dataset(id) })
      qc.invalidateQueries({ queryKey: biKeys.datasets })
    },
  })
}

export function useDeleteBiDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => api.deleteDataset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biKeys.datasets })
    },
  })
}
