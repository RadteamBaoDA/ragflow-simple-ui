/**
 * @fileoverview Types for the AI feature.
 * @module features/ai/types/ai.types
 */

/**
 * @description Props for RagflowIframe component.
 */
export interface RagflowIframeProps {
  /** The type of RAGFlow interface to embed */
  path: 'chat' | 'search'
}

/**
 * @description Error state for iframe loading failures.
 */
export interface IframeError {
  /** Type of error for styling and messaging */
  type: 'network' | 'forbidden' | 'notfound' | 'server' | 'unknown'
  /** HTTP status code if available */
  statusCode?: number
  /** Error message to display */
  message: string
}
