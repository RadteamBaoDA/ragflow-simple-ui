/**
 * @file index.ts
 * @description Barrel file for exporting AI feature components and pages.
 * Centralizes exports for easier imports across the application.
 */

// Export the AI Chat page component
export { default as AiChatPage } from './pages/AiChatPage';

// Export the AI Search page component
export { default as AiSearchPage } from './pages/AiSearchPage';

// Export the Tokenizer page component for text processing
export { default as TokenizerPage } from './pages/TokenizerPage';

// Export the reusable Ragflow Iframe component
export { default as RagflowIframe } from './components/RagflowIframe';
