import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../src/features/ai/components/RagflowIframe', () => ({
  default: ({ path }: any) => <div data-testid="rf-iframe" data-path={path} />
}))

import AiChatPage from '../../../src/features/ai/pages/AiChatPage'

describe('AiChatPage', () => {
  it('renders with chat path', () => {
    render(<AiChatPage />)
    const el = screen.getByTestId('rf-iframe')
    expect(el).toBeInTheDocument()
    expect(el.getAttribute('data-path')).toBe('chat')
  })
})
