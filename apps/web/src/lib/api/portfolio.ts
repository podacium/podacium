import { apiClient } from './client'

export interface PortfolioLink {
  url: string
  label: string
}

export interface PortfolioItem {
  id: number
  userId: number
  title: string
  description?: string
  mediaUrls: string[]
  tags: string[]
  links?: PortfolioLink[]
  createdAt: string
  updatedAt: string
}

export interface PortfolioListResponse {
  items: PortfolioItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PortfolioCreate {
  title: string
  description?: string
  media_urls?: string[]
  tags?: string[]
  links?: PortfolioLink[]
}

export interface PortfolioUpdate {
  title?: string
  description?: string
  media_urls?: string[]
  tags?: string[]
  links?: PortfolioLink[]
}

export const portfolioApi = {
  getMyPortfolio(page = 1, pageSize = 12) {
    return apiClient.get<PortfolioListResponse>(
      `/api/v1/portfolio?page=${page}&page_size=${pageSize}`
    )
  },

  getUserPortfolio(userId: number, page = 1, pageSize = 12) {
    return apiClient.get<PortfolioListResponse>(
      `/api/v1/portfolio/${userId}?page=${page}&page_size=${pageSize}`
    )
  },

  create(data: PortfolioCreate) {
    return apiClient.post<PortfolioItem>('/api/v1/portfolio', data)
  },

  update(itemId: number, data: PortfolioUpdate) {
    return apiClient.put<PortfolioItem>(`/api/v1/portfolio/${itemId}`, data)
  },

  delete(itemId: number) {
    return apiClient.delete<void>(`/api/v1/portfolio/${itemId}`)
  },
}
