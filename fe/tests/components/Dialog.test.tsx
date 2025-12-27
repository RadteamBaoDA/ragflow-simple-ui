import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import { Dialog } from '../../src/components/Dialog'

describe('Dialog', () => {
  it('renders title, children, footer and triggers onClose', () => {
    const onClose = vi.fn()

    render(
      <Dialog open={true} onClose={onClose} title={"My Title"} footer={<button>FOOT</button>} maxWidth="sm">
        <div>BODY</div>
      </Dialog>
    )

    expect(screen.getByText('My Title')).toBeInTheDocument()
    expect(screen.getByText('BODY')).toBeInTheDocument()
    expect(screen.getByText('FOOT')).toBeInTheDocument()

    // close button exists and triggers onClose
    const buttons = screen.getAllByRole('button')
    // There will be at least one close button in header; click the last found in header area
    const closeBtn = buttons.find((b) => b !== undefined && b.textContent === '') || buttons[0]
    fireEvent.click(closeBtn as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('applies correct max width classes mapping', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => {}} title={'t'} maxWidth={'none'}>
        <div />
      </Dialog>
    )

    // Check that the dialog rendered - the dialog panel will have the classes
    const dialogPanel = document.querySelector('.max-w-none')
    expect(dialogPanel).toBeTruthy()
  })
})
