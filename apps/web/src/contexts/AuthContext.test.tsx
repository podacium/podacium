import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const mockApi = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  getCurrentUserLight: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  AuthenticationError: class AuthenticationError extends Error {
    constructor(msg: string) { super(msg); this.name = 'AuthenticationError' }
  },
  handleApiError: (e: any) => e?.message || 'Unknown error',
}))

function TestConsumer() {
  const { user, loading, isAuthenticated, error } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.fullName || 'none'}</span>
      <span data-testid="error">{error || 'none'}</span>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = 'podacium_auth_hint=; max-age=0'
  })

  it('provides initial loading state', () => {
    document.cookie = 'podacium_auth_hint=1; path=/'
    mockApi.getCurrentUserLight.mockReturnValue(new Promise(() => {}))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading').textContent).toBe('true')
  })

  it('sets authenticated state after successful profile fetch', async () => {
    document.cookie = 'podacium_auth_hint=1; path=/'
    mockApi.getCurrentUserLight.mockResolvedValue({
      id: 1, fullName: 'Test User', email: 'test@podacium.com',
      role: 'STUDENT', onboardingCompleted: true,
    })
    mockApi.getCurrentUserProfile.mockResolvedValue({
      id: 1, fullName: 'Test User', email: 'test@podacium.com',
      role: 'STUDENT', emailVerified: true,
      onboardingCompleted: true, skills: [],
      memberships: [], certificates: [], enrollments: [],
      lessonProgresses: [], instructedModules: [],
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
      expect(screen.getByTestId('user').textContent).toBe('Test User')
    })
  })

  it('sets unauthenticated state when profile fetch fails', async () => {
    mockApi.getCurrentUserLight.mockRejectedValue(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('user').textContent).toBe('none')
    })
  })

  it('throws error when useAuth is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider')
    consoleSpy.mockRestore()
  })
})
