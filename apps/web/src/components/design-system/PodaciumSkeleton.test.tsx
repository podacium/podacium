import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodaciumSkeleton from './PodaciumSkeleton'

describe('PodaciumSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PodaciumSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies animate-pulse class', () => {
    const { container } = render(<PodaciumSkeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
  })

  it('applies custom width and height', () => {
    const { container } = render(<PodaciumSkeleton className="w-32 h-8" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('w-32')
    expect(el.className).toContain('h-8')
  })

  it('renders circle variant', () => {
    const { container } = render(<PodaciumSkeleton variant="circle" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('rounded-full')
  })

  it('renders text variant', () => {
    const { container } = render(<PodaciumSkeleton variant="text" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('rounded')
  })
})
