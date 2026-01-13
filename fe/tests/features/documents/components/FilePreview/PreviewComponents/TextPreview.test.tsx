import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { TextPreview } from '../../../../../src/features/documents/components/FilePreview/PreviewComponents/TextPreview'

global.fetch = vi.fn()

describe('TextPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const { container } = render(<TextPreview url="test.txt" />)
    expect(container.textContent).toContain('Loading')
  })

  it('displays text content after successful fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => 'Hello World'
    } as Response)

    const { container } = render(<TextPreview url="test.txt" />)
    
    await waitFor(() => {
      expect(container.textContent).toContain('Hello World')
    })
  })

  it('shows error message on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false
    } as Response)

    const { container } = render(<TextPreview url="test.txt" />)
    
    await waitFor(() => {
      expect(container.textContent).toContain('Failed to load text file')
    })
  })

  it('shows error message on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const { container } = render(<TextPreview url="test.txt" />)
    
    await waitFor(() => {
      expect(container.textContent).toContain('Failed to load text file')
    })
  })

  it('renders with correct styling', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => 'Test content'
    } as Response)

    const { container } = render(<TextPreview url="test.txt" />)
    
    await waitFor(() => {
      const pre = container.querySelector('pre')
      expect(pre).toBeTruthy()
      expect(pre?.className).toContain('whitespace-pre-wrap')
    })
  })
})
