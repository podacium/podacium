import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumSwitch from './PodaciumSwitch'

describe('PodaciumSwitch', () => {
  it('renders with label', () => {
    render(<PodaciumSwitch label="Enable notifications" />)
    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
  })

  it('toggles on click', () => {
    const onChange = vi.fn()
    render(<PodaciumSwitch label="Toggle" onChange={onChange} />)
    const switchEl = screen.getByRole('switch') || screen.getByRole('checkbox')
    fireEvent.click(switchEl)
    expect(onChange).toHaveBeenCalled()
  })

  it('reflects checked state', () => {
    render(<PodaciumSwitch label="Active" checked />)
    const switchEl = screen.getByRole('switch') || screen.getByRole('checkbox')
    expect(switchEl).toBeChecked()
  })

  it('is disabled when disabled prop is true', () => {
    render(<PodaciumSwitch label="Disabled" disabled />)
    const switchEl = screen.getByRole('switch') || screen.getByRole('checkbox')
    expect(switchEl).toBeDisabled()
  })

  it('has accessible name from label', () => {
    render(<PodaciumSwitch label="Dark mode" />)
    expect(screen.getByLabelText('Dark mode') || screen.getByText('Dark mode')).toBeInTheDocument()
  })
})
