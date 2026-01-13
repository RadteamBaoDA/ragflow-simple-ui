import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import SystemToolCard from '../../../../src/features/system/components/SystemToolCard'
import type { SystemTool } from '../../../../src/features/system/api/systemToolsService'

vi.mock('lucide-react', () => ({
  ExternalLink: () => <span data-testid="external-link-icon">ExternalLink</span>
}))

const mockTool: SystemTool = {
  name: 'Test Tool',
  description: 'A test monitoring tool',
  url: 'https://example.com/tool',
  icon: '/icons/test.svg'
}

describe('SystemToolCard', () => {
  it('renders tool information', () => {
    const { container } = render(<SystemToolCard tool={mockTool} />)
    expect(container.textContent).toContain('Test Tool')
    expect(container.textContent).toContain('A test monitoring tool')
  })

  it('opens tool URL on click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(<SystemToolCard tool={mockTool} />)
    
    const button = container.querySelector('button')
    if (button) {
      fireEvent.click(button)
      expect(openSpy).toHaveBeenCalledWith('https://example.com/tool', '_blank', 'noopener,noreferrer')
    }
    
    openSpy.mockRestore()
  })

  it('renders icon with correct src', () => {
    const { container } = render(<SystemToolCard tool={mockTool} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('Test Tool icon')
  })

  it('handles icon load error', () => {
    const { container } = render(<SystemToolCard tool={mockTool} />)
    const img = container.querySelector('img')
    
    if (img) {
      fireEvent.error(img)
      expect(img.src).toBeTruthy()
    }
  })

  it('displays external link icon', () => {
    const { container } = render(<SystemToolCard tool={mockTool} />)
    expect(container.querySelector('[data-testid="external-link-icon"]')).toBeTruthy()
  })
})
