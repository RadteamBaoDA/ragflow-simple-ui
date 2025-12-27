import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

// Mock external deps
vi.mock('@headlessui/react', () => {
  const Switch = ({ checked, onChange, children, className }: any) => (
    <button data-testid="switch" aria-pressed={checked} className={className} onClick={() => onChange(!checked)}>
      {children}
    </button>
  )
  ;(Switch as any).Group = ({ children }: any) => <div>{children}</div>
  ;(Switch as any).Label = ({ children, ...props }: any) => <label {...props}>{children}</label>
  return { Switch }
})

vi.mock('lucide-react', () => ({ Check: ({ children }: any) => <span data-testid="check">✓{children}</span> }))

import { Checkbox } from '../../src/components/Checkbox'

describe('Checkbox', () => {
  it('renders label and className and toggles', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Accept" className="extra" />)

    expect(screen.getByText('Accept')).toBeInTheDocument()
    const sw = screen.getByTestId('switch')
    expect(sw).toBeInTheDocument()
    expect(sw).not.toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)

    // render checked
    render(<Checkbox checked={true} onChange={onChange} />)
    expect(screen.getAllByTestId('check').length).toBeGreaterThanOrEqual(1)
  })

  it('renders without label', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} />)
    expect(screen.queryByText('Accept')).not.toBeInTheDocument()
  })
})
