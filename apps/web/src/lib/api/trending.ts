import { apiClient } from './client'

export interface TrendingItem {
  entity_id: string
  entity_type: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
  score: number
  rank: number
}

export interface TrendingResponse {
  entity_type: string
  items: TrendingItem[]
  calculated_at: string
}

export interface CalculateTrendingResponse {
  success: boolean
  entity_type: string
  items_count: number
  message: string
}

const BASE = '/api/v1'

export const trendingApi = {
  async getTrending(entityType: string, limit = 10): Promise<TrendingResponse> {
    return apiClient.get<TrendingResponse>(
      `${BASE}/trending/${entityType}?limit=${limit}`
    )
  },

  async calculateTrending(entityType: string): Promise<CalculateTrendingResponse> {
    return apiClient.post<CalculateTrendingResponse>(
      `${BASE}/trending/admin/trending/calculate?entity_type=${entityType}`
    )
  },
}
