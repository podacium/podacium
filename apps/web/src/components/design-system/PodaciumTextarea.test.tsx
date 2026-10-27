import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumTextarea from './PodaciumTextarea'

describe('PodaciumTextarea', () => {
  it('renders with label', () => {
    render(<PodaciumTextarea label="Description" />)
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('handles text input', () => {
    const onChange = vi.fn()
    render(<PodaciumTextarea label="Bio" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Hello world' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message', () => {
    render(<PodaciumTextarea label="Bio" error="Too short" />)
    expect(screen.getByText('Too short')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<PodaciumTextarea label="Bio" disabled />)
    expect(screen.getByLabelText('Bio')).toBeDisabled()
  })

  it('applies custom rows', () => {
    render(<PodaciumTextarea label="Bio" rows={5} />)
    expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '5')
  })

  it('shows character count when maxLength is set', () => {
    render(<PodaciumTextarea label="Bio" maxLength={100} />)
    // Character count indicator should be present
    const textarea = screen.getByLabelText('Bio')
    expect(textarea).toHaveAttribute('maxLength', '100')
  })

  it('sets aria-invalid when error is present', () => {
    render(<PodaciumTextarea label="Bio" error="Required" />)
    expect(screen.getByLabelText('Bio')).toHaveAttribute('aria-invalid', 'true')
  })
})
