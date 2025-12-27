import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock i18n
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

// Use the real ConfirmProvider but avoid rendering the heavy Dialog; we will rely on the footer texts and callbacks
import { ConfirmProvider, useConfirm } from '../../src/components/ConfirmDialog'

function ConfirmConsumer({ onResult }: any) {
  const confirm = useConfirm()
  return <button onClick={async () => onResult(await confirm({ message: 'Are you sure?' }))}>open</button>
}

describe('ConfirmProvider and useConfirm', () => {
  it('throws when used outside provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const TestComp = () => {
      // attempt to call hook - should throw
      try {
        useConfirm()
      } catch (e) {
        throw e
      }
      return null
    }
    expect(() => render(<TestComp />)).toThrow()
    consoleErrorSpy.mockRestore()
  })

  it('resolves true when confirm clicked and false when cancel clicked', async () => {
    let result1: boolean | undefined
    let result2: boolean | undefined
    
    const { rerender } = render(
      <ConfirmProvider>
        <ConfirmConsumer onResult={(r: boolean) => { result1 = r }} />
      </ConfirmProvider>
    )

    // Test cancel flow
    const openBtn = screen.getByText('open')
    fireEvent.click(openBtn)
    
    const cancelBtn = await screen.findByText('dialog.cancel')
    fireEvent.click(cancelBtn)
    
    // Wait for dialog to close and result to be set
    await waitFor(() => expect(result1).toBe(false), { timeout: 2000 })

    // Test confirm flow
    rerender(
      <ConfirmProvider>
        <ConfirmConsumer onResult={(r: boolean) => { result2 = r }} />
      </ConfirmProvider>
    )
    
    const openBtn2 = screen.getByText('open')
    fireEvent.click(openBtn2)
    
    const confirmBtn = await screen.findByText('dialog.confirm')
    fireEvent.click(confirmBtn)
    
    // Wait for dialog to close and result to be set
    await waitFor(() => expect(result2).toBe(true), { timeout: 2000 })
  })
})
