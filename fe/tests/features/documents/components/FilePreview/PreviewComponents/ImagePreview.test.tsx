import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { ImagePreview } from '../../../../../src/features/documents/components/FilePreview/PreviewComponents/ImagePreview'

describe('ImagePreview', () => {
  it('renders loading state initially', () => {
    const { container } = render(<ImagePreview url="test.jpg" alt="Test" />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('hides loading spinner after image loads', async () => {
    const { container } = render(<ImagePreview url="test.jpg" alt="Test" />)
    const img = container.querySelector('img')
    
    if (img) {
      fireEvent.load(img)
      await waitFor(() => {
        expect(container.querySelector('.animate-spin')).toBeFalsy()
      })
    }
  })

  it('shows error message when image fails to load', async () => {
    const { container } = render(<ImagePreview url="invalid.jpg" alt="Test" />)
    const img = container.querySelector('img')
    
    if (img) {
      fireEvent.error(img)
      await waitFor(() => {
        expect(container.textContent).toContain('Failed to load image')
      })
    }
  })

  it('renders image with correct attributes', () => {
    const { container } = render(<ImagePreview url="test.jpg" alt="Test Image" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('test.jpg')
    expect(img?.getAttribute('alt')).toBe('Test Image')
  })

  it('applies opacity transition after load', async () => {
    const { container } = render(<ImagePreview url="test.jpg" alt="Test" />)
    const img = container.querySelector('img')
    
    if (img) {
      expect(img.className).toContain('opacity-0')
      fireEvent.load(img)
      await waitFor(() => {
        expect(img.className).toContain('opacity-100')
      })
    }
  })
})
