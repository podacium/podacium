import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'transfer-token-123' }),
  useRouter: () => mockRouter,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 2, email: 'recipient@test.com' }, loading: false }),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ dir: 'ltr' }),
  useLocale: () => 'en',
}))

const mockApi = vi.hoisted(() => ({ acceptTransfer: vi.fn() }))
vi.mock('@/lib/api/live-sessions', () => ({ liveSessionsApi: mockApi }))

import AcceptTransferPage from './page'

describe('AcceptTransferPage', () => {
  it('calls the accept API with the token and shows the accepted state', async () => {
    mockApi.acceptTransfer.mockResolvedValue({ id: 1, liveSessionId: 'sess-001', userId: 2, status: 'confirmed' })

    render(<AcceptTransferPage />)

    fireEvent.click(screen.getByRole('button', { name: 'transfer.accept' }))

    await waitFor(() => {
      expect(mockApi.acceptTransfer).toHaveBeenCalledWith('transfer-token-123')
    })
    expect(await screen.findByText('transfer.accepted')).toBeInTheDocument()
  })

  it('shows an error state when the accept call is rejected', async () => {
    mockApi.acceptTransfer.mockRejectedValue(new Error('not for you'))

    render(<AcceptTransferPage />)

    fireEvent.click(screen.getByRole('button', { name: 'transfer.accept' }))

    expect(await screen.findByText('not for you')).toBeInTheDocument()
  })
})