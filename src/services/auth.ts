// AuthService.ts

export interface SignupData {
  fullName: string
  email: string
  password: string
  provider?: 'EMAIL' | 'GOOGLE' | 'GITHUB' | 'LINKEDIN' | 'PHONE'
  acceptedTerms: boolean
  subscribeNewsletter: boolean
  phoneNumber?: string
  role?: 'STUDENT' | 'BUSINESS' | 'FREELANCER' | 'ADMIN' | 'INSTRUCTOR'
}

export interface LoginData {
  email?: string
  phoneNumber?: string
  password: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in?: number
}

export interface User {
  id: number
  fullName: string
  email: string | null
  emailVerified: boolean
  phoneNumber: string | null
  phoneVerified: boolean
  role: string
  profilePictureUrl: string | null
  bio: string | null
  country: string | null
  city: string | null
  skills: string[]
  createdAt: string
  updatedAt: string
}

export interface SignupResponse {
  message: string
  user_id: number
  verification_sent: boolean
}

export interface EmailAvailabilityResponse {
  available: boolean
}

class AuthService {
  // ========== URL Helpers ==========
  private getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }

  private getApiUrl(endpoint: string): string {
    return `${this.getBaseUrl()}/api${endpoint}`
  }

  // ========== Signup ==========
  async signup(data: SignupData): Promise<SignupResponse> {
    const url = this.getApiUrl('/auth/register')
    const payload = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      provider: data.provider,
      acceptedTerms: data.acceptedTerms,
      subscribeNewsletter: data.subscribeNewsletter,
      phoneNumber: data.phoneNumber,
      role: data.role,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { detail: errorText }
      }

      let errorMessage = 'Registration failed'
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((err: any) => `${err.loc?.join('.')}: ${err.msg}`)
            .join(', ')
        }
      } else if (errorData.message) {
        errorMessage = errorData.message
      }

      throw new Error(errorMessage)
    }

    return response.json()
  }

  // ========== Login ==========
  async login(credentials: LoginData): Promise<AuthResponse> {
    const url = this.getApiUrl('/auth/login')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { detail: `HTTP ${response.status}` }
      }

      let errorMessage = 'Login failed'
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail
      } else if (errorData.message) {
        errorMessage = errorData.message
      }

      throw new Error(errorMessage)
    }

    const authData: AuthResponse = await response.json()
    this.setTokens(authData)
    return authData
  }

  // ========== Logout ==========
  async logout(): Promise<void> {
    if (!this.isBrowser()) return
    try {
      this.clearTokens()
      localStorage.removeItem('user')
    } catch (e) {
      console.warn('Logout error:', e)
    }
  }

  // ========== Current User ==========
  async getCurrentUser(): Promise<User> {
    const token = this.getAccessTokenInternal()
    const url = this.getApiUrl('/auth/me')

    const response = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }

    return response.json()
  }

  // ========== Token Refresh ==========
  private async refreshTokenInternal(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshTokenInternal()
    const url = this.getApiUrl('/auth/refresh-token')

    if (!refreshToken) throw new Error('No refresh token available')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      this.clearTokens()
      throw new Error('Token refresh failed')
    }

    const authData: AuthResponse = await response.json()
    this.setTokens(authData)
    return authData
  }

  // ========== Email Availability ==========
  async checkEmailAvailability(email: string): Promise<EmailAvailabilityResponse> {
    const url = this.getApiUrl('/auth/check-email')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to check email' }))
      throw new Error(err.detail || 'Failed to check email availability')
    }

    return response.json()
  }

  // ========== Password Reset ==========
  async requestPasswordReset(email: string): Promise<void> {
    const url = this.getApiUrl('/auth/forgot-password')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Password reset request failed' }))
      throw new Error(errorData.detail || 'Password reset request failed')
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const url = this.getApiUrl('/auth/reset-password')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Password reset failed' }))
      throw new Error(errorData.detail || 'Password reset failed')
    }
  }

  // ========== Email Verification ==========
  async verifyEmail(token: string): Promise<void> {
    const url = this.getApiUrl('/auth/verify-email')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Email verification failed' }))
      throw new Error(errorData.detail || 'Email verification failed')
    }
  }

  async resendVerification(email: string): Promise<void> {
    const url = this.getApiUrl('/auth/resend-verification')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to resend verification' }))
      throw new Error(errorData.detail || 'Failed to resend verification')
    }
  }

  // ========== Token Utilities ==========
  private setTokens(authData: AuthResponse): void {
    if (!this.isBrowser()) return
    try {
      localStorage.setItem('access_token', authData.access_token)
      localStorage.setItem('refresh_token', authData.refresh_token)
      if (authData.expires_in) {
        const expiresAt = Date.now() + authData.expires_in * 1000
        localStorage.setItem('access_token_expires_at', expiresAt.toString())
      }
    } catch (e) {
      console.warn('Failed to persist tokens to localStorage', e)
    }
  }

  private clearTokens(): void {
    if (!this.isBrowser()) return
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('access_token_expires_at')
  }

  private getAccessTokenInternal(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem('access_token')
  }

  private getRefreshTokenInternal(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem('refresh_token')
  }

  private isTokenExpiredInternal(): boolean {
    if (!this.isBrowser()) return true
    const expiresAt = localStorage.getItem('access_token_expires_at')
    if (!expiresAt) return true
    return Date.now() > parseInt(expiresAt, 10)
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage
  }

  // ========== Public wrappers ==========
  public getAccessToken(): string | null {
    return this.getAccessTokenInternal()
  }

  public isTokenExpired(): boolean {
    return this.isTokenExpiredInternal()
  }

  public async refreshToken(): Promise<AuthResponse> {
    return this.refreshTokenInternal()
  }
}

export const authService = new AuthService()
