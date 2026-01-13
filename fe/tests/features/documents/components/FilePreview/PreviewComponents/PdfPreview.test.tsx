import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PdfPreview } from '../../../../../src/features/documents/components/FilePreview/PreviewComponents/PdfPreview'

describe('PdfPreview', () => {
  it('renders PDF iframe', () => {
    const { container } = render(<PdfPreview url="test.pdf" />)
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
  })

  it('sets correct iframe source', () => {
    const { container } = render(<PdfPreview url="test.pdf" />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('test.pdf')
  })

  it('renders download button', () => {
    const { container } = render(<PdfPreview url="test.pdf" />)
    const downloadLink = container.querySelector('a[download]')
    expect(downloadLink).toBeTruthy()
  })

  it('download link has correct href', () => {
    const { container } = render(<PdfPreview url="https://example.com/test.pdf" />)
    const downloadLink = container.querySelector('a[download]')
    expect(downloadLink?.getAttribute('href')).toBe('https://example.com/test.pdf')
  })
})
