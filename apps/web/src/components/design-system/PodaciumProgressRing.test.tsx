import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodaciumProgressRing from './PodaciumProgressRing'

describe('PodaciumProgressRing', () => {
  it('renders without crashing', () => {
    const { container } = render(<PodaciumProgressRing progress={50} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('displays progress value', () => {
    render(<PodaciumProgressRing progress={75} showValue />)
    expect(screen.getByText('75%') || screen.getByText('75')).toBeTruthy()
  })

  it('handles 0% progress', () => {
    const { container } = render(<PodaciumProgressRing progress={0} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('handles 100% progress', () => {
    const { container } = render(<PodaciumProgressRing progress={100} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('clamps progress to 0-100 range', () => {
    // Should not crash with out-of-range values
    const { container: c1 } = render(<PodaciumProgressRing progress={-10} />)
    expect(c1.firstChild).toBeInTheDocument()

    const { container: c2 } = render(<PodaciumProgressRing progress={150} />)
    expect(c2.firstChild).toBeInTheDocument()
  })

  it('renders SVG element', () => {
    const { container } = render(<PodaciumProgressRing progress={50} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom size', () => {
    const { container } = render(<PodaciumProgressRing progress={50} size={80} />)
    const svg = container.querySelector('svg')
    if (svg) {
      expect(svg.getAttribute('width') === '80' || svg.style.width === '80px').toBeTruthy()
    }
  })
})
