import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodaciumAvatar from './PodaciumAvatar'

describe('PodaciumAvatar', () => {
  it('renders with image when src is provided', () => {
    render(<PodaciumAvatar src="/avatar.jpg" alt="User" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'User')
  })

  it('renders initials when no src is provided', () => {
    render(<PodaciumAvatar name="John Doe" />)
    expect(screen.getByText('JD') || screen.getByText('J')).toBeTruthy()
  })

  it('renders single initial for single name', () => {
    render(<PodaciumAvatar name="Alice" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('applies size variants', () => {
    const { container } = render(<PodaciumAvatar name="Test" size="lg" />)
    const avatar = container.firstChild as HTMLElement
    expect(avatar.className).toContain('w-')
  })

  it('applies custom className', () => {
    const { container } = render(<PodaciumAvatar name="Test" className="custom" />)
    const avatar = container.firstChild as HTMLElement
    expect(avatar.className).toContain('custom')
  })

  it('has rounded-full for circular shape', () => {
    const { container } = render(<PodaciumAvatar name="Test" />)
    const avatar = container.firstChild as HTMLElement
    expect(avatar.className).toContain('rounded-full')
  })
})
