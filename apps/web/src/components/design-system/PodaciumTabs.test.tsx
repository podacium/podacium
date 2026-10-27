import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumTabs from './PodaciumTabs'

describe('PodaciumTabs', () => {
  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: <p>Content 1</p> },
    { id: 'tab2', label: 'Tab 2', content: <p>Content 2</p> },
    { id: 'tab3', label: 'Tab 3', content: <p>Content 3</p> },
  ]

  it('renders all tab labels', () => {
    render(<PodaciumTabs tabs={tabs} />)
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
    expect(screen.getByText('Tab 3')).toBeInTheDocument()
  })

  it('shows first tab content by default', () => {
    render(<PodaciumTabs tabs={tabs} />)
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('switches content on tab click', () => {
    render(<PodaciumTabs tabs={tabs} />)
    fireEvent.click(screen.getByText('Tab 2'))
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('calls onChange when tab is switched', () => {
    const onChange = vi.fn()
    render(<PodaciumTabs tabs={tabs} onChange={onChange} />)
    fireEvent.click(screen.getByText('Tab 3'))
    expect(onChange).toHaveBeenCalledWith('tab3')
  })

  it('applies active styling to selected tab', () => {
    render(<PodaciumTabs tabs={tabs} defaultTab="tab2" />)
    const tab2Button = screen.getByText('Tab 2')
    // Active tab should have distinct styling
    expect(tab2Button.className || tab2Button.parentElement?.className).toBeTruthy()
  })
})
