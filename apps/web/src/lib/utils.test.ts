import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (className utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active')).toBe('base active')
    expect(cn('base', false && 'active')).toBe('base')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null)).toBe('base')
  })

  it('merges tailwind classes correctly', () => {
    // twMerge should resolve conflicts
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  it('handles objects (clsx style)', () => {
    expect(cn({ active: true, disabled: false })).toBe('active')
  })
})
