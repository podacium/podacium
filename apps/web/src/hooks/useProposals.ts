'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { freelancingApi, type ProposalCreate } from '@/lib/api/freelancing'
import type { ContractCreate } from '@/lib/api/types'

const MY_PROPOSALS_KEY = ['proposals', 'mine'] as const
const PROJECT_PROPOSALS_KEY = (projectId: number) => ['proposals', 'project', projectId] as const

export function useMyProposals() {
  return useQuery({
    queryKey: MY_PROPOSALS_KEY,
    queryFn: () => freelancingApi.getMyProposals(),
  })
}

export function useProjectProposals(projectId: number) {
  return useQuery({
    queryKey: PROJECT_PROPOSALS_KEY(projectId),
    queryFn: () => freelancingApi.getProjectProposals(projectId),
    enabled: projectId > 0,
  })
}

export function useSubmitProposal(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProposalCreate) => freelancingApi.submitProposal(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECT_PROPOSALS_KEY(projectId) })
      qc.invalidateQueries({ queryKey: MY_PROPOSALS_KEY })
    },
  })
}

export function useAcceptProposal(proposalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data?: ContractCreate) => freelancingApi.acceptProposal(proposalId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: MY_PROPOSALS_KEY })
    },
  })
}

export function useRejectProposal(proposalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => freelancingApi.rejectProposal(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_PROPOSALS_KEY })
    },
  })
}
