import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumInput from './PodaciumInput'

describe('PodaciumInput', () => {
  it('renders with label', () => {
    render(<PodaciumInput label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders without label', () => {
    const { container } = render(<PodaciumInput placeholder="Type here" />)
    expect(container.querySelector('input')).toBeInTheDocument()
    expect(container.querySelector('label')).not.toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<PodaciumInput label="Email" error="Invalid email" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email')
  })

  it('shows hint when no error', () => {
    render(<PodaciumInput label="Email" hint="We'll never share your email" />)
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument()
  })

  it('hides hint when error is present', () => {
    render(<PodaciumInput label="Email" hint="Hint text" error="Error text" />)
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
    expect(screen.getByText('Error text')).toBeInTheDocument()
  })

  it('sets aria-invalid when error is present', () => {
    render(<PodaciumInput label="Email" error="Required" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('sets aria-describedby to error id', () => {
    render(<PodaciumInput label="Email" error="Required" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-describedby', 'input-email-error')
  })

  it('sets aria-describedby to hint id when no error', () => {
    render(<PodaciumInput label="Email" hint="Hint" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-describedby', 'input-email-hint')
  })

  it('handles onChange events', () => {
    const onChange = vi.fn()
    render(<PodaciumInput label="Name" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<PodaciumInput label="Name" disabled />)
    expect(screen.getByLabelText('Name')).toBeDisabled()
  })

  it('renders left icon', () => {
    render(<PodaciumInput label="Search" leftIcon={<span data-testid="left-icon">🔍</span>} />)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders right icon', () => {
    render(<PodaciumInput label="Password" rightIcon={<span data-testid="right-icon">👁</span>} />)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('applies error variant styling', () => {
    const { container } = render(<PodaciumInput error="Error" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('border-red-500')
  })

  it('applies size variants', () => {
    const { container } = render(<PodaciumInput inputSize="lg" />)
    const input = container.querySelector('input')
    expect(input?.className).toContain('h-12')
  })

  it('uses custom id when provided', () => {
    render(<PodaciumInput id="custom-id" label="Custom" />)
    expect(screen.getByLabelText('Custom')).toHaveAttribute('id', 'custom-id')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement>
    render(<PodaciumInput ref={ref} label="Ref test" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
