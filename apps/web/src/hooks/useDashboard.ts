'use client'

import { useQuery } from '@tanstack/react-query'
import { freelancingApi } from '@/lib/api/freelancing'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => freelancingApi.getDashboardStats(),
    staleTime: 15_000,
  })
}

export function usePublicStats() {
  return useQuery({
    queryKey: ['public', 'stats'],
    queryFn: () => freelancingApi.getPublicStats(),
    staleTime: 60_000,
  })
}
