'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { freelancingApi, type ProjectCreate } from '@/lib/api/freelancing'

const PROJECTS_KEY = ['projects'] as const
const PROJECT_KEY = (id: number) => ['projects', id] as const

export function useProjects(params?: { skip?: number; limit?: number; skills?: string[]; search?: string; status?: string }) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, params],
    queryFn: () => freelancingApi.getProjects(params as any),
  })
}

export function usePublicProjects(params?: { skip?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['public-projects', params],
    queryFn: () => freelancingApi.getPublicProjects(params),
  })
}

export function useProject(id: number) {
  return useQuery({
    queryKey: PROJECT_KEY(id),
    queryFn: () => freelancingApi.getProject(id),
    enabled: id > 0,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreate) => freelancingApi.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
      qc.invalidateQueries({ queryKey: ['public-projects'] })
    },
  })
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProjectCreate>) => freelancingApi.updateProject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(id) })
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}
