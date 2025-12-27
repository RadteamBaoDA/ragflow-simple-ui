import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Headless UI Listbox and Transition just to allow rendering
vi.mock('@headlessui/react', () => {
  const React = require('react')
  const Button = ({ children, className }: any) => React.createElement('button', { className }, children)
  const Options = ({ children }: any) => React.createElement('div', {}, children)
  const Option = ({ children, value }: any) => React.createElement('div', { 'data-value': value }, typeof children === 'function' ? children({ selected: false, active: false }) : children)
  
  const ListboxComponent = ({ children, value, onChange }: any) => {
    return typeof children === 'function' ? children({ open: false }) : children
  }
  ListboxComponent.Button = Button
  ListboxComponent.Options = Options
  ListboxComponent.Option = Option
  
  return {
    Listbox: ListboxComponent,
    Transition: ({ children }: any) => React.createElement('div', {}, children)
  }
})

vi.mock('lucide-react', () => {
  const React = require('react')
  return {
    ChevronDown: () => React.createElement('span', { 'data-testid': 'chev' }),
    Check: () => React.createElement('span', { 'data-testid': 'check' })
  }
})

import { Select } from '../../src/components/Select'

describe('Select', () => {
  const options = [
    { id: '1', name: 'One' },
    { id: '2', name: 'Two' }
  ]

  it('shows selected option name', () => {
    render(<Select value={'2'} onChange={() => {}} options={options} />)
    expect(screen.getAllByText('Two').length).toBeGreaterThan(0)
  })

  it('shows placeholder when no selected option', () => {
    render(<Select value={'x'} onChange={() => {}} options={options} />)
    expect(screen.getByText('Select...')).toBeInTheDocument()
  })

  it('applies disabled styles', () => {
    const { container } = render(<Select value={'1'} onChange={() => {}} options={options} disabled />)
    expect(container.querySelector('.opacity-50')).toBeTruthy()
    expect(container.querySelector('.cursor-not-allowed')).toBeTruthy()
  })
})
