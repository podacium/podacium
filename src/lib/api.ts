import { authService } from '@/services/auth'

class ApiClient {
  private getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const baseUrl = this.getBaseUrl()
    const url = `${baseUrl}${endpoint}`
    
    console.log('API Request:', url) // Debug log
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    // Add auth token if available
    const token = authService.getAccessToken()
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      }
    }

    try {
      const response = await fetch(url, config)

      // Handle token expiration
      if (response.status === 401) {
        try {
          await authService.refreshToken()
          // Retry the request with new token
          const newToken = authService.getAccessToken()
          if (newToken) {
            config.headers = {
              ...config.headers,
              'Authorization': `Bearer ${newToken}`,
            }
            return await fetch(url, config)
          }
        } catch (refreshError) {
          await authService.logout()
          window.location.href = '/auth/login'
          throw new Error('Session expired. Please log in again.')
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return response
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint)
    return response.json()
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
    return response.json()
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
    return response.json()
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
    return response.json()
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'DELETE',
    })
    return response.json()
  }
}

export const api = new ApiClient()