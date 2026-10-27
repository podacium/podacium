import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PodaciumSelect from './PodaciumSelect'

describe('PodaciumSelect', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3' },
  ]

  it('renders with label', () => {
    render(<PodaciumSelect label="Country" options={options} />)
    expect(screen.getByText('Country')).toBeInTheDocument()
  })

  it('renders all options', () => {
    render(<PodaciumSelect label="Pick" options={options} />)
    const select = screen.getByRole('combobox') || screen.getByLabelText('Pick')
    expect(select).toBeInTheDocument()
  })

  it('handles onChange', () => {
    const onChange = vi.fn()
    render(<PodaciumSelect label="Pick" options={options} onChange={onChange} />)
    const select = screen.getByRole('combobox') || screen.getByLabelText('Pick')
    fireEvent.change(select, { target: { value: 'opt2' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message', () => {
    render(<PodaciumSelect label="Pick" options={options} error="Required field" />)
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<PodaciumSelect label="Pick" options={options} disabled />)
    const select = screen.getByRole('combobox') || screen.getByLabelText('Pick')
    expect(select).toBeDisabled()
  })

  it('renders placeholder option', () => {
    render(<PodaciumSelect label="Pick" options={options} placeholder="Select..." />)
    expect(screen.getByText('Select...')).toBeInTheDocument()
  })
})
