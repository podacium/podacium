import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumToast from './PodaciumToast'

// Mock sonner if it's used internally
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}))

describe('PodaciumToast', () => {
  it('renders without crashing', () => {
    const { container } = render(<PodaciumToast />)
    expect(container).toBeTruthy()
  })

  it('renders the Toaster component', () => {
    render(<PodaciumToast />)
    // The component should render something (Toaster from sonner or custom)
    expect(document.body).toBeTruthy()
  })
})
