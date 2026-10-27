'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { freelancingApi, type DeliveryCreate } from '@/lib/api/freelancing'
import type { ContractStatus } from '@/lib/api'

const CONTRACTS_KEY = ['contracts'] as const
const CONTRACT_KEY = (id: number) => ['contracts', id] as const

export function useContracts(params?: { role?: string; status?: ContractStatus; skip?: number; limit?: number }) {
  return useQuery({
    queryKey: [...CONTRACTS_KEY, params],
    queryFn: () => freelancingApi.getContracts(params as any),
  })
}

export function useContract(id: number) {
  return useQuery({
    queryKey: CONTRACT_KEY(id),
    queryFn: () => freelancingApi.getContract(id),
    enabled: id > 0,
  })
}

export function useDeliverContract(contractId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DeliveryCreate) => freelancingApi.deliverContract(contractId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTRACT_KEY(contractId) })
      qc.invalidateQueries({ queryKey: CONTRACTS_KEY })
    },
  })
}

export function useCompleteContract(contractId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => freelancingApi.completeContract(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTRACT_KEY(contractId) })
      qc.invalidateQueries({ queryKey: CONTRACTS_KEY })
    },
  })
}

export function useCancelContract(contractId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => freelancingApi.cancelContract(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTRACT_KEY(contractId) })
      qc.invalidateQueries({ queryKey: CONTRACTS_KEY })
    },
  })
}
