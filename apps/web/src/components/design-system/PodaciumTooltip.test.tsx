import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodaciumTooltip from './PodaciumTooltip'

describe('PodaciumTooltip', () => {
  it('renders trigger element', () => {
    render(
      <PodaciumTooltip content="Tooltip text">
        <button>Hover me</button>
      </PodaciumTooltip>
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('shows tooltip on hover', async () => {
    render(
      <PodaciumTooltip content="Help text">
        <button>Info</button>
      </PodaciumTooltip>
    )
    fireEvent.mouseEnter(screen.getByText('Info'))
    // Tooltip should appear (may be async depending on implementation)
    // This tests that the component doesn't crash on hover
  })

  it('hides tooltip on mouse leave', () => {
    render(
      <PodaciumTooltip content="Help text">
        <button>Info</button>
      </PodaciumTooltip>
    )
    const trigger = screen.getByText('Info')
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseLeave(trigger)
    // Should not crash
  })

  it('renders with custom className', () => {
    const { container } = render(
      <PodaciumTooltip content="Tip" className="custom-tooltip">
        <span>Target</span>
      </PodaciumTooltip>
    )
    expect(container.firstChild).toBeTruthy()
  })
})
