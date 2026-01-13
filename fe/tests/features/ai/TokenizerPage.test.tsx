import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, d?: string) => d || k }) }))

const enc = { encode: vi.fn((t: string) => t.split('').map((_, i) => i)), decode: vi.fn((n: number[]) => n.map(x => String.fromCharCode(x + 97)).join('')) }
vi.mock('js-tiktoken', () => ({ encodingForModel: vi.fn(() => enc), getEncoding: vi.fn(() => enc) }))
vi.mock('lucide-react', () => ({ Eraser: () => null, Copy: () => null, Check: () => null, FileCode: () => null }))

Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })

import TokenizerPage from '../../../src/features/ai/pages/TokenizerPage'

describe('TokenizerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enc.encode.mockImplementation((t: string) => t.split('').map((_, i) => i))
    enc.decode.mockImplementation((n: number[]) => n.map(x => String.fromCharCode(x + 97)).join(''))
  })

  it('renders empty state', async () => {
    render(<TokenizerPage />)
    // Wait for tokenizer to finish loading
    await screen.findByText('Tokens will appear here...')
    expect(screen.getByText('Tokens will appear here...')).toBeInTheDocument()
  })

  it('encodes text on change', async () => {
    render(<TokenizerPage />)
    // Wait for tokenizer to be ready before interacting
    await screen.findByText('Tokens will appear here...')
    const ta = screen.getByPlaceholderText('Enter text here to see token count...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'abc' } })
    expect(ta.value).toBe('abc')
    await waitFor(() => expect(enc.encode).toHaveBeenCalledWith('abc'))
  })

  it('clears on clear button', () => {
    render(<TokenizerPage />)
    const ta = screen.getByPlaceholderText('Enter text here to see token count...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'test' } })
    fireEvent.click(screen.getByTitle('Clear'))
    expect(ta.value).toBe('')
  })

  it('copies tokens to clipboard', async () => {
    render(<TokenizerPage />)
    const ta = screen.getByPlaceholderText('Enter text here to see token count...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'x' } })
    await waitFor(() => fireEvent.click(screen.getByTitle('Copy token IDs')))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('changes model encoding', async () => {
    const { encodingForModel, getEncoding } = await import('js-tiktoken')
    render(<TokenizerPage />)
    const sel = screen.getByDisplayValue('GPT-4')
    fireEvent.change(sel, { target: { value: 'gpt-3.5-turbo' } })
    await waitFor(() => expect(encodingForModel).toHaveBeenCalled())
  })

  it('handles encoding error', async () => {
    enc.encode.mockImplementation(() => { throw new Error('fail') })
    render(<TokenizerPage />)
    const ta = screen.getByPlaceholderText('Enter text here to see token count...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'x' } })
    await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument())
  })
})
