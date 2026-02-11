/**
 * @fileoverview Hook for managing tokenizer state, encoding, and actions.
 * @module features/ai/hooks/useTokenizer
 */
import { useState, useEffect, useMemo } from 'react'
import { encodingForModel, getEncoding, Tiktoken } from 'js-tiktoken'

// ============================================================================
// Types
// ============================================================================

/** Single token chunk for visualization */
export interface TokenChunk {
  /** Integer token ID */
  token: number
  /** Decoded text for the token */
  text: string
  /** Tailwind color class for highlighting */
  colorClass: string
}

export interface UseTokenizerReturn {
  /** Current input text */
  text: string
  /** Update input text */
  setText: (value: string) => void
  /** Selected model name */
  model: string
  /** Update selected model */
  setModel: (value: string) => void
  /** Encoded token IDs */
  tokens: number[]
  /** Whether the encoder is loading */
  isLoading: boolean
  /** Whether tokens were recently copied */
  copied: boolean
  /** Memoized tokenized text chunks for rendering */
  tokenizedText: TokenChunk[]
  /** Clear input and reset tokens */
  handleClear: () => void
  /** Copy token IDs to clipboard */
  handleCopy: () => void
}

// ============================================================================
// Constants
// ============================================================================

/** Pastel colors for token highlighting */
const TOKEN_COLORS = [
  'bg-sky-200 dark:bg-sky-900/50',
  'bg-amber-200 dark:bg-amber-900/50',
  'bg-emerald-200 dark:bg-emerald-900/50',
  'bg-rose-200 dark:bg-rose-900/50',
  'bg-violet-200 dark:bg-violet-900/50',
]

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook encapsulating tokenizer state, encoder initialization,
 * token computation, and clipboard actions.
 * @returns {UseTokenizerReturn} Tokenizer state and handlers.
 */
export const useTokenizer = (): UseTokenizerReturn => {
  const [text, setText] = useState('')
  const [model, setModel] = useState('gpt-4')
  const [tokens, setTokens] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [encoding, setEncoding] = useState<Tiktoken | null>(null)
  const [copied, setCopied] = useState(false)

  /**
   * @description Effect: Initialize the tokenizer encoder based on the selected model.
   * Maps model name to the appropriate tiktoken encoding scheme.
   */
  useEffect(() => {
    setIsLoading(true)
    let enc: Tiktoken | null = null
    try {
      // OpenAI models with specific encodings
      if (model === 'gpt-4' || model === 'gpt-3.5-turbo') {
        enc = encodingForModel(model as 'gpt-4' | 'gpt-3.5-turbo')
      } else if (model === 'text-davinci-003' || model === 'text-davinci-002') {
        enc = getEncoding('p50k_base')
      } else if (model === 'text-embedding-ada-002') {
        enc = getEncoding('cl100k_base')
      }
      // Ollama / vLLM — use cl100k_base as common default
      else {
        enc = getEncoding('cl100k_base')
      }
      setEncoding(enc)
    } catch (e) {
      console.error('Failed to load encoding:', e)
    } finally {
      setIsLoading(false)
    }
  }, [model])

  /** Effect: Encode text whenever input or encoding changes */
  useEffect(() => {
    if (!encoding || !text) {
      setTokens([])
      return
    }
    try {
      setTokens(encoding.encode(text))
    } catch (e) {
      console.error('Encoding error', e)
      setTokens([])
    }
  }, [text, encoding])

  /** Clear input text and reset tokens */
  const handleClear = () => {
    setText('')
    setTokens([])
  }

  /** Copy token IDs array to clipboard */
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(tokens))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /** Memoized tokenized chunks for visualization */
  const tokenizedText = useMemo<TokenChunk[]>(() => {
    if (!encoding) return []

    return tokens.map((token, idx) => ({
      token,
      text: encoding.decode([token]),
      colorClass: TOKEN_COLORS[idx % TOKEN_COLORS.length] ?? TOKEN_COLORS[0] ?? '',
    }))
  }, [tokens, encoding])

  return {
    text,
    setText,
    model,
    setModel,
    tokens,
    isLoading,
    copied,
    tokenizedText,
    handleClear,
    handleCopy,
  }
}
