import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodaciumBadge from './PodaciumBadge'

describe('PodaciumBadge', () => {
  it('renders with text content', () => {
    render(<PodaciumBadge>Active</PodaciumBadge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies default variant', () => {
    const { container } = render(<PodaciumBadge>Default</PodaciumBadge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toBeTruthy()
  })

  it('applies success variant', () => {
    const { container } = render(<PodaciumBadge variant="success">Success</PodaciumBadge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('emerald')
  })

  it('applies destructive/error variant', () => {
    const { container } = render(<PodaciumBadge variant="destructive">Error</PodaciumBadge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('destructive')
  })

  it('applies gradient variant', () => {
    const { container } = render(<PodaciumBadge variant="gradient">Premium</PodaciumBadge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-gradient-to-r')
    expect(badge.className).toContain('text-white')
  })

  it('accepts custom className', () => {
    const { container } = render(<PodaciumBadge className="custom-class">Custom</PodaciumBadge>)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('custom-class')
  })
})
