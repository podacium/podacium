import { render } from '@testing-library/react'
import { describe, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import PodaciumButton from './PodaciumButton'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}))

describe('PodaciumButton a11y', () => {
  it('has no violations', async () => {
    const { container } = render(<PodaciumButton>Click me</PodaciumButton>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('primary variant has no violations', async () => {
    const { container } = render(<PodaciumButton variant="primary">Submit</PodaciumButton>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('disabled button has no violations', async () => {
    const { container } = render(<PodaciumButton disabled>Disabled</PodaciumButton>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('loading button has no violations', async () => {
    const { container } = render(<PodaciumButton loading>Loading</PodaciumButton>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
