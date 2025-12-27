import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye" />,
  X: () => <div data-testid="x" />,
  Loader: () => <div data-testid="loader" />,
  Download: () => <div data-testid="download" />,
  ExternalLink: () => <div data-testid="external-link" />,
  AlertCircle: () => <div data-testid="alert-circle" />
}))
vi.mock('@/components/Dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null
}))

import { FilePreviewModal } from '../../../src/features/documents/components/FilePreview/FilePreviewModal'

describe('FilePreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } }))) as any
  })

  it('does not render when closed', () => {
    const { container } = render(
      <FilePreviewModal
        isOpen={false}
        onClose={vi.fn()}
        file={{ name: 'test.pdf', size: 100, lastModified: new Date() }}
      />
    )
    expect(container.querySelector('[data-testid="dialog"]')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={{ name: 'test.pdf', size: 100, lastModified: new Date() }}
      />
    )
    // Check that the download control is present (dialog implementation varies)
    expect(screen.getByTestId('download')).toBeInTheDocument()
  })

  it('displays file name', () => {
    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={{ name: 'test.pdf', size: 100, lastModified: new Date() }}
      />
    )
    expect(screen.getByText(/test.pdf/)).toBeInTheDocument()
  })

  it('shows close button', () => {
    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={{ name: 'test.txt', size: 100, lastModified: new Date() }}
      />
    )
    expect(screen.getByTestId('x')).toBeInTheDocument()
  })

  it('closes on close button click', () => {
    const onClose = vi.fn()
    render(
      <FilePreviewModal
        isOpen={true}
        onClose={onClose}
        file={{ name: 'test.txt', size: 100, lastModified: new Date() }}
      />
    )
    const closeBtn = screen.getByTestId('x').closest('button')
    if (closeBtn) closeBtn.click()
    expect(onClose).toHaveBeenCalled()
  })

  it('handles large files', () => {
    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={{ name: 'large.zip', size: 1073741824, lastModified: new Date() }}
      />
    )
    // multiple places may contain the file name; ensure at least one element contains it
    const matches = screen.getAllByText(/large.zip/)
    expect(matches.length).toBeGreaterThan(0)
  })
})