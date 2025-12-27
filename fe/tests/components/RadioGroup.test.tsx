import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Headless UI primitives used
vi.mock('@headlessui/react', () => {
  const React = require('react')
  return {
    Radio: ({ children }: any) => React.createElement('div', {}, children({ checked: false })),
    RadioGroup: ({ children }: any) => React.createElement('div', {}, children),
    Label: ({ children }: any) => React.createElement('div', {}, children),
    Description: ({ children }: any) => React.createElement('div', {}, children),
    Field: ({ children }: any) => React.createElement('div', {}, children)
  }
})

vi.mock('lucide-react', () => {
  const React = require('react')
  return {
    Check: () => React.createElement('span', { 'data-testid': 'check' })
  }
})

import { RadioGroup } from '../../src/components/RadioGroup'

describe('RadioGroup', () => {
  const options = [
    { value: 'a', label: 'A', icon: '🔥', description: 'desc A' },
    { value: 'b', label: 'B' },
  ]

  it('renders grid columns mapping and options', () => {
    const { container } = render(<RadioGroup value={'a'} onChange={() => {}} options={options} columns={2} />)
    expect(container.querySelector('.grid-cols-2')).toBeTruthy()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('desc A')).toBeInTheDocument()
  })

  it('falls back to default grid columns on invalid columns', () => {
    const { container } = render(<RadioGroup value={'a'} onChange={() => {}} options={options} columns={9 as any} />)
    expect(container.querySelector('.grid-cols-3')).toBeTruthy()
  })
})
