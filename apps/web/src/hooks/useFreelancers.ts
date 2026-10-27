'use client'

import { useQuery } from '@tanstack/react-query'
import { freelancingApi } from '@/lib/api/freelancing'

export function useFreelancers(params?: {
  skills?: string[]; search?: string; skip?: number; limit?: number;
  min_budget?: number; max_budget?: number; category?: string; rating_min?: number
}) {
  return useQuery({
    queryKey: ['freelancers', params],
    queryFn: () => freelancingApi.getFreelancers(params as any),
    staleTime: 60_000,
  })
}

export function useFreelancerProfile(id: number) {
  return useQuery({
    queryKey: ['freelancers', id],
    queryFn: () => freelancingApi.getFreelancerProfile(id),
    enabled: id > 0,
  })
}
